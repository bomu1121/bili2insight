import { defineStore } from "pinia";
import { ref } from "vue";
import { loadSaved } from "./settings";
import { isAuthExpired } from "../utils/errors";
import { qrGenerate, qrPoll, checkLogin } from "../utils/invoke";

export const useAuthStore = defineStore("auth", () => {
  const saved = loadSaved();
  const proxy = ref(saved?.proxy ?? "");

  // ---------- Login state ----------
  const showLogin = ref(false);
  const qrUrl = ref("");
  const qrcodeKey = ref("");
  const qrPolling = ref(false);
  const qrStatusMessage = ref("");
  const qrStatus = ref("");
  const loginError = ref("");
  const isLoggedIn = ref(false);
  const loginUname = ref("");
  const loginUid = ref(0);
  const loginFace = ref("");
  const cookiesSaved = ref<Record<string, string>>({});
  let qrPollTimer: ReturnType<typeof setInterval> | null = null;

  const cookiesFilePath = ref("");
  async function initCookiesPath() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      cookiesFilePath.value = await invoke<string>("get_cookies_path");
    } catch (_) {
      const home = typeof localStorage !== "undefined" ? localStorage.getItem("bili2insight-cookies-path") || "" : "";
      cookiesFilePath.value = home || "cookies.json";
    }
  }

  // ---------- Login functions ----------
  async function startLogin() {
    loginError.value = ""; qrStatus.value = "waiting"; qrStatusMessage.value = "正在生成二维码...";
    console.log("[login] startLogin called"); showLogin.value = true;
    try {
      const result = await qrGenerate(proxy.value || undefined);
      console.log("[login] qrGenerate OK, key:", result.qrcode_key.slice(0, 20));
      qrUrl.value = result.qr_url;
      qrcodeKey.value = result.qrcode_key;
      qrStatusMessage.value = "请使用B站客户端扫码";
      qrStatus.value = "waiting";
      startPolling();
    } catch (e: any) {
      loginError.value = String(e);
      qrStatus.value = "error";
      qrStatusMessage.value = "获取二维码失败";
    }
  }

  function startPolling() {
    stopPolling();
    qrPolling.value = true;
    qrPollTimer = setInterval(pollQr, 2000);
    pollQr();
  }

  async function pollQr() {
    if (!qrcodeKey.value || qrStatus.value === "success") { stopPolling(); return; }
    try {
      const result = await qrPoll(qrcodeKey.value, cookiesFilePath.value, proxy.value || undefined);
      console.log("[login] pollQr:", { code: result.status_code, msg: result.message, logged: result.logged_in, hasCookies: result.cookies && Object.keys(result.cookies).length > 0 });
      if (result.status_code === 0 && result.logged_in) {
        qrStatus.value = "success"; console.log("[login] *** QR LOGIN SUCCESS, cookies keys:", result.cookies ? Object.keys(result.cookies) : "none");
        qrStatusMessage.value = "登录成功！";
        stopPolling(); console.log("[login] saving cookies to localStorage..."); cookiesSaved.value = result.cookies || {};
        if (result.cookies) {
          try { localStorage.setItem("bili2insight-cookies", JSON.stringify(result.cookies)); } catch (_) { }
        }
        isLoggedIn.value = true;
        loginUname.value = loginUname.value || "...";
        await checkLoginAfterAuth();
        setTimeout(() => { showLogin.value = false; }, 1500);
      } else if (result.status_code === 86090) {
        qrStatus.value = "scanned";
        qrStatusMessage.value = "已扫码，请在手机上确认";
      } else if (result.status_code === 86038) {
        qrStatus.value = "expired";
        qrStatusMessage.value = "二维码已过期，请刷新";
        stopPolling();
      }
    } catch (e: any) {
      loginError.value = String(e);
    }
  }

  function stopPolling() {
    qrPolling.value = false;
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
  }

  function cancelLogin() {
    stopPolling();
    showLogin.value = false;
    qrUrl.value = ""; qrcodeKey.value = ""; qrStatus.value = "";
  }

  async function checkLoginAfterAuth() {
    console.log("[login] checkLoginAfterAuth: verifying cookies...");
    try {
      const cookiesStr = JSON.stringify(cookiesSaved.value);
      const result = await checkLogin(cookiesStr, proxy.value || undefined);
      console.log("[login] checkLoginAfterAuth:", { logged_in: result.logged_in, uname: result.uname, uid: result.uid });
      isLoggedIn.value = result.logged_in;
      loginUname.value = result.uname;
      loginUid.value = result.uid;
      loginFace.value = result.face;
    } catch (e: any) { console.error("[login] checkLoginAfterAuth FAILED:", e); if (isAuthExpired(e)) { doLogout(); } }
  }

  async function checkLoginStatus() {
    try {
      let cookies: Record<string, string> = {};
      try {
        let saved: string | null = null;
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          saved = await invoke<string>("read_cookies_file");
        } catch (_) { }
        if (!saved) {
          saved = localStorage.getItem("bili2insight-cookies");
        }
        if (saved) cookies = JSON.parse(saved);
      } catch (_) { }
      console.log("[login] checkLoginStatus: found cookies, keys:", Object.keys(cookies));
      if (Object.keys(cookies).length === 0) {
        console.log("[login] checkLoginStatus: no cookies, not logged in");
        isLoggedIn.value = false; return;
      }
      cookiesSaved.value = cookies;
      const result = await checkLogin(JSON.stringify(cookies), proxy.value || undefined);
      console.log("[login] checkLoginStatus result:", { logged_in: result.logged_in, uname: result.uname });
      isLoggedIn.value = result.logged_in;
      loginUname.value = result.uname;
      loginUid.value = result.uid;
      loginFace.value = result.face;
      if (result.logged_in) {
        try { localStorage.setItem("bili2insight-cookies", JSON.stringify(cookies)); } catch (_) { }
      }
    } catch (e: any) { console.error("[login] checkLoginStatus ERROR:", e); isLoggedIn.value = false; if (isAuthExpired(e)) { doLogout(); } }
  }

  async function doLogout() {
    stopPolling();
    isLoggedIn.value = false; loginUname.value = ""; loginUid.value = 0; loginFace.value = "";
    cookiesSaved.value = {}; showLogin.value = false;
    try { localStorage.removeItem("bili2insight-cookies"); } catch (_) { }
    try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("clear_cookies_file"); } catch (_) { }
  }

  return {
    proxy, showLogin, qrUrl, qrcodeKey, qrPolling, qrStatusMessage, qrStatus, loginError,
    isLoggedIn, loginUname, loginUid, loginFace, cookiesSaved, cookiesFilePath, initCookiesPath,
    startLogin, pollQr, stopPolling, cancelLogin, checkLoginStatus, doLogout, checkLoginAfterAuth,
  };
});
