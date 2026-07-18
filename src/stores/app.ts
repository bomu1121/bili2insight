import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo, PageInfo, TaskState, QueueItem } from "../utils/types";
import { runPipelineWithPage, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { runPipelineLocal } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export interface Provider { name: string; url: string; models: string[]; }
export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

const PROMPT_GUANDIAN = [
  "你是一位深度内容编辑，专门将口语化的视频文案提炼为有思考深度、有逻辑归类的结构化笔记。你不做简单的逐句转写，而是理解视频在讨论哪些核心议题，然后把分散在全文中的相关现象、事实、例证和判断整合到一起，形成有机的「观点块」。",
  "",
  "## 固定输出格式",
  "接到视频文案后，严格按以下结构输出：",
  "",
  "【总体概要】",
  "（用3-5句话概括：视频讲了什么主题、作者的核心态度/立场是什么、得出了什么关键结论。这是给没看过视频的人快速建立认知的导语。）",
  "",
  "【核心观点与支撑】",
  "对于视频中每一个重要的论点，按以下结构整理成一个「观点块」：",
  "",
  "### 观点块1：[用一句话提炼这个观点的核心主张]",
  "- 现象/背景：（跟这个观点相关的具体事件、数据、行业动向、个人经历等客观信息，把这些分散在原文各处但同属一个话题的内容整合在一起）",
  "- 作者的判断：（作者针对上述现象明确表达的主观看法、评价、立场或态度）",
  "- 补充例证：（如果有的话，作者用来进一步支撑自己判断的案例、对比、数据等）",
  "",
  "### 观点块2：[核心主张]",
  "- 现象/背景：",
  "- 作者的判断：",
  "- 补充例证：",
  "",
  "（观点块的数量视视频内容而定，通常3-6个；排列顺序遵循原文的论证逻辑，而非时间顺序）",
  "",
  "【情绪基调与弦外之音】",
  "（如果视频有明显的情绪色彩、未明说的潜台词、或作者反复流露的某种矛盾心态，用1-2句话点出。如果没有，可省略此栏。）",
  "",
  "## 提炼方法论（内化执行，不在输出中体现）",
  "1. **归类优先**：拿到文案后，先在脑中划出视频讨论的3-6个核心议题，然后把原文中属于同一议题的内容归拢，不要按原文出现顺序逐句处理。",
  "2. **观点与事实捆绑**：每条「观点块」必须是「判断+支撑」的完整组合，不能出现纯事实罗列或空洞观点。",
  "3. **去噪不降维**：删除口语填充词、重复强调、无关岔开话题，但保留所有对理解观点有价值的信息。",
  "4. **严格忠于原意**：所有归类和整合都必须在原文中有直接依据，不自行脑补、不添加作者没说过的判断。",
  "5. **语言一致**：输出语言与原文保持一致。",
  "",
  "## 行为边界",
  "- 只输出上述结构，不添加开场白、解释或额外建议。",
  "- 如果用户发送的内容明显不是视频文案，回复：「请提供一段视频文案，我来帮你提炼观点和事实。」",
].join("\n");

const PROMPT_TECH = [
  "你是一位技术文档工程师，专门将口语化的技术教程、编程教学、工具演示类视频文案，提炼为结构严谨、可直接用于学习和实操的结构化技术笔记。",
  "",
  "你的提炼目标不是\"概括\"，而是\"还原\"——让一个没有看过原视频的开发者/学习者，仅凭你的提炼就能理解核心概念并完成关键操作。",
  "",
  "## 固定输出格式",
  "接到视频文案后，严格按以下结构输出：",
  "",
  "【视频目标】",
  "（用一句话说清楚：这个视频最终要教会观众什么？解决什么问题？达成什么效果？）",
  "",
  "【前置条件】",
  "- 需要的软件/工具/环境及版本号",
  "- 需要的前置知识（如果有）",
  "- 其他依赖或准备工作",
  "（如果没有明确提及，写\"无特殊前置\"，不要编造）",
  "",
  "【核心概念】（如果有的话）",
  "对于视频中涉及的关键技术概念、术语、原理，用简明扼要的方式逐个解释：",
  "- **概念A**：一句话定义 + 在这个场景中的作用",
  "- **概念B**：一句话定义 + 在这个场景中的作用",
  "（如果视频纯粹是操作演示、不涉及概念讲解，此栏可省略）",
  "",
  "【操作步骤】",
  "这是提炼的核心。按视频的实际操作顺序，每一步包含：",
  "1. **步骤名称**（简短概括这一步要做什么）",
  "   - 具体操作：做了什么动作、点击了什么、输入了什么",
  "   - 关键配置/参数/代码：（如果有，尽量完整保留原文中的配置项、参数值、命令、代码片段）",
  "   - 预期结果：（执行后应该看到什么、得到什么反馈）",
  "   - ⚠️ 易错点：（如果视频中提到这一步容易出错或有注意事项）",
  "",
  "2. **步骤名称**",
  "   - ...",
  "",
  "（步骤数量不限，忠实于视频实际操作流程。如果视频演示了多个方案或分支路径，分别整理。）",
  "",
  "【关键技术细节】",
  "将在视频各处散布但至关重要的技术信息集中列出：",
  "- 配置项/参数的具体值",
  "- 版本兼容性说明",
  "- 性能数据或对比数据",
  "- 快捷键、命令行、文件路径",
  "- 任何\"如果...否则...\"的条件分支逻辑",
  "（逐条列出，不遗漏任何一个可操作的技术细节）",
  "",
  "【常见坑与解决方案】",
  "把视频中提到的所有容易出错的地方、报错信息及对应的解决方法、作者踩过的坑集中整理：",
  "- 坑1：现象描述 → 原因 → 解决方式",
  "- 坑2：...",
  "（如果没有，写\"未提及\"）",
  "",
  "【最终效果 / 成果验证】",
  "（视频结束时，操作完成后得到的结果是什么？如何验证是否成功？有没有给出最终效果的展示或对比？若有性能对比、前后对比等数据，一并整理。）",
  "",
  "【延伸与参考】（如果有的话）",
  "- 视频中提到的进一步学习方向、相关资源链接、参考文档",
  "- 作者推荐的替代方案或进阶路径",
  "",
  "## 提炼方法论（内化执行，不在输出中体现）",
  "1. **结构化还原优先**：先在脑中还原出这个教程的\"知识树\"——根节点是目标，一级分支是核心步骤，二级分支是每步的细节和注意事项，然后逐层填充。",
  "2. **技术信息零损耗**：配置、版本号、命令、参数、代码片段等技术细节，原文怎么说的就怎么记，绝不简化或改写。宁可看起来啰嗦，也不能让学习者因为信息缺失而卡住。",
  "3. **口语转技术书面语**：删除\"然后\"\"那个\"\"就是说\"\"呃\"等口语填充词，但保留所有技术实质内容；将\"你点那个地方\"\"把这个改了\"等模糊表达在不改变操作的前提下转化为明确的动作描述。",
  "4. **区分\"作者观点\"和\"技术事实\"**：如果视频作者说\"我觉得这个配置最好\"，标记为作者建议；如果说的是客观的技术事实（\"这个参数默认值是8080\"），直接记录为事实。",
  "5. **不添加原文没有的技术信息**：如果某个配置项视频没有给出具体值，不要自行补全；如果某个操作步骤在原文中模糊带过，如实标注\"原文未明确说明\"。",
  "6. **语言一致**：输出语言与原文保持一致。代码、命令、技术术语保持原文写法，不翻译。",
  "",
  "## 行为边界",
  "- 只输出上述结构，不添加开场白、评价或闲聊。",
  "- 如果用户发送的内容明显不是技术教程/课程类视频文案，回复：\"请提供一段技术教程或课程类的视频文案，我来帮你提炼成结构化笔记。\"",
].join("\\n")

const PROMPT_TRACE = [
  "你是专业的视频文案信息提取与溯源助手。从视频文字稿中提取有用信息，并为每一条标注清晰的信源。",
  "",
  "有用信息：关键事实、数据、观点、结论、名称、操作步骤、注意事项。信源要求：时间戳或原文定位 + 原文引用。",
  "按类型分块输出，信息密集时先给不超过200字的核心摘要。不编造，语义模糊加注存疑。",
].join("\n")

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  { name: "观点提炼", prompt: PROMPT_GUANDIAN, builtin: true },
  { name: "技术文案提炼", prompt: PROMPT_TECH, builtin: true },
  { name: "信息溯源", prompt: PROMPT_TRACE, builtin: true },
];

const STORAGE_KEY = "bili2insight-settings"; const SETTINGS_VERSION = 4;

function loadSaved(): Record<string,any>|null { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch(_){return null;} }
function saveToDisk(d:Record<string,any>) { d.version = SETTINGS_VERSION; try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(_){} }

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();
  const ver = saved;

  const url = ref("");
  const proxy = ref(ver?.proxy ?? "");
  const aiApiUrl = ref(ver?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(ver?.aiApiKey ?? "");
  const aiModel = ref(ver?.aiModel ?? PROVIDERS[0].models[0]);
  const selectedProvider = ref(ver?.selectedProvider ?? 0);
  const customModels = ref<string[]>(ver?.customModels ?? []);
  const selectedTemplateIndex = ref(ver?.selectedTemplateIndex ?? 0);
  const customTemplates = ref<PromptTemplate[]>(ver?.customTemplates ?? []);

  // --- ASR settings ---
  type AsrModelOption = "paraformer" | "mimo";
  const asrModel = ref<AsrModelOption>(ver?.asrModel ?? "paraformer");
  const asrApiUrl = ref(ver?.asrApiUrl ?? "");
  const asrApiKey = ref(ver?.asrApiKey ?? "");

  const allTemplates = computed(() => [...BUILTIN_TEMPLATES, ...customTemplates.value]);
  const aiPrompt = computed(() => {
    const idx = selectedTemplateIndex.value;
    if (idx < BUILTIN_TEMPLATES.length) return BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - BUILTIN_TEMPLATES.length;
    return customTemplates.value[ci]?.prompt ?? "";
  });

  // ---------- Pipeline state ----------
  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");
  const preview = ref<VideoInfo | null>(null);
  const previewLoading = ref(false);

  // ---------- Multi-page state ----------
  const selectedPages = ref<Set<number>>(new Set());
  const tasks = ref<TaskState[]>([]);
  const activeTaskIndex = ref(-1);
  const activeResultTab = ref<number>(0); // 0 = first page, N = pages[N-1], N+1 = merged

  // ---------- Queue state ----------
  const queue = ref<QueueItem[]>([]);
  const isProcessing = ref(false);
  const queueCount = computed(() => queue.value.length);

  const videoPages = computed<PageInfo[]>(() => preview.value?.pages ?? []);

  // All completed task results
  const completedTasks = computed(() => tasks.value.filter(t => t.status === "done"));
  const hasMultiPages = computed(() => videoPages.value.length > 1);

  // Active result (current tab)
  const activeResult = computed(() => {
    if (completedTasks.value.length === 0) return result.value;
    if (activeResultTab.value < completedTasks.value.length) {
      return completedTasks.value[activeResultTab.value].result;
    }
    // "merged" tab
    return null;
  });

  const mergedMarkdown = computed(() => {
    if (completedTasks.value.length === 0) return "";
    const parts = completedTasks.value.map(t => {
      if (!t.result) return "";
      return `## ${t.pageInfo.part}\n\n${t.result.markdown}`;
    });
    return `# ${preview.value?.title ?? ""}\n\n${parts.join("\n\n---\n\n")}`;
  });

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let unlisten: (() => void) | null = null;

  // ---------- Persistence ----------
  function persistSettings() {
    saveToDisk({
      version: SETTINGS_VERSION, proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value,
      aiModel: aiModel.value, selectedProvider: selectedProvider.value, customModels: customModels.value,
      selectedTemplateIndex: selectedTemplateIndex.value, customTemplates: customTemplates.value,
      asrModel: asrModel.value, asrApiUrl: asrApiUrl.value, asrApiKey: asrApiKey.value,
    });
  }

  watch([proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, selectedTemplateIndex, customTemplates, asrModel, asrApiUrl, asrApiKey], () => {
    persistSettings();
  }, { deep: false });

  // ---------- Login state ----------
  const showLogin = ref(false);
  const qrUrl = ref('');
  const qrcodeKey = ref('');
  const qrPolling = ref(false);
  const qrStatusMessage = ref('');
  const qrStatus = ref(''); // 'waiting' | 'scanned' | 'expired' | 'success'
  const loginError = ref('');
  const isLoggedIn = ref(false);
  const loginUname = ref('');
  const loginUid = ref(0);
  const loginFace = ref('');
  const cookiesSaved = ref<Record<string,string>>({});
  let qrPollTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- Favorites state ----------
  const favFolders = ref<any[]>([]);
  const favLoading = ref(false);
  const favCurrentFolderId = ref(0);
  const favCurrentFolderTitle = ref('');
  const favIsCollected = ref(false);
  const favCurrentFolderMid = ref(0);
  const favVideos = ref<any[]>([]);
  const favPage = ref(1);
  const favTotalPages = ref(0);
  const favTotal = ref(0);
  const favLoadingVideos = ref(false);
  const favSelectedVideos = ref<Set<number>>(new Set());
  const followItems = ref<any[]>([]);
  const followLoading = ref(false);
  const followType = ref(1); // 1=anime, 2=drama
  const followPage = ref(1);
  const followTotalPages = ref(0);
  const followTotal = ref(0);
  const watchLaterItems = ref<any[]>([]);
  const watchLaterLoading = ref(false);
  const watchLaterPage = ref(1);
  const watchLaterTotalPages = ref(0);
  const historyItems = ref<any[]>([]);
  const historyLoading = ref(false);
  const historyPage = ref(1);
  const historyTotalPages = ref(0);



  const cookiesFilePath = ref('');
  async function initCookiesPath() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      cookiesFilePath.value = await invoke<string>('get_cookies_path');
    } catch(_) {
      const home = typeof localStorage !== 'undefined' ? localStorage.getItem('bili2insight-cookies-path') || '' : '';
      cookiesFilePath.value = home || 'cookies.json';
    }
  }

  // ---------- Login functions ----------
  async function startLogin() {
    loginError.value = ''; qrStatus.value = 'waiting'; qrStatusMessage.value = '正在生成二维码...';
    console.log("[login] startLogin called"); showLogin.value = true;
    try {
      const { qrGenerate } = await import('../utils/invoke');
      const result = await qrGenerate(proxy.value || undefined); console.log("[login] qrGenerate OK, key:", result.qrcode_key.slice(0,20));
      qrUrl.value = result.qr_url;
      qrcodeKey.value = result.qrcode_key;
      qrStatusMessage.value = '请使用B站客户端扫码';
      qrStatus.value = 'waiting';
      startPolling();
    } catch (e: any) {
      loginError.value = String(e);
      qrStatus.value = 'error';
      qrStatusMessage.value = '获取二维码失败';
    }
  }

  function startPolling() {
    stopPolling();
    qrPolling.value = true;
    qrPollTimer = setInterval(pollQr, 2000);
    pollQr();
  }

  async function pollQr() {
    if (!qrcodeKey.value || qrStatus.value === 'success') { stopPolling(); return; }
    try {
      const { qrPoll } = await import('../utils/invoke');
      const result = await qrPoll(qrcodeKey.value, cookiesFilePath.value, proxy.value || undefined);
      console.log("[login] pollQr:", {code: result.status_code, msg: result.message, logged: result.logged_in, hasCookies: result.cookies && Object.keys(result.cookies).length > 0});
      if (result.status_code === 0 && result.logged_in) {
        qrStatus.value = 'success'; console.log('[login] *** QR LOGIN SUCCESS, cookies keys:', result.cookies ? Object.keys(result.cookies) : 'none');
        qrStatusMessage.value = '登录成功！';
        stopPolling(); console.log('[login] saving cookies to localStorage...'); cookiesSaved.value = result.cookies || {};
        if (result.cookies) {
      try { localStorage.setItem('bili2insight-cookies', JSON.stringify(result.cookies)); } catch(_) {}
    }
    // Set logged-in state IMMEDIATELY from cookies, don't wait for verification
    isLoggedIn.value = true;
    loginUname.value = loginUname.value || '...';
    await checkLoginAfterAuth();
        setTimeout(() => { showLogin.value = false; }, 1500);
      } else if (result.status_code === 86090) {
        qrStatus.value = 'scanned';
        qrStatusMessage.value = '已扫码，请在手机上确认';
      } else if (result.status_code === 86038) {
        qrStatus.value = 'expired';
        qrStatusMessage.value = '二维码已过期，请刷新';
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
    qrUrl.value = ''; qrcodeKey.value = ''; qrStatus.value = '';
  }

async function checkLoginAfterAuth() {
    console.log("[login] checkLoginAfterAuth: verifying cookies...");
    try {
      const cookiesStr = JSON.stringify(cookiesSaved.value);
      const { checkLogin } = await import('../utils/invoke');
      const result = await checkLogin(cookiesStr, proxy.value || undefined); console.log("[login] checkLoginAfterAuth:", {logged_in: result.logged_in, uname: result.uname, uid: result.uid}); isLoggedIn.value = result.logged_in;
      loginUname.value = result.uname;
      loginUid.value = result.uid;
      loginFace.value = result.face;
    } catch (e: any) { console.error("[login] checkLoginAfterAuth FAILED:", e); }
  }

  async function checkLoginStatus() {
    try {
      let cookies: Record<string,string> = {};
      try {
        // Read from persistent file first (matching upstream Bili23-Downloader),
        // fall back to localStorage for backward compatibility.
        let saved: string | null = null;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          saved = await invoke<string>('read_cookies_file');
        } catch(_) {}
        if (!saved) {
          saved = localStorage.getItem('bili2insight-cookies');
        }
        if (saved) cookies = JSON.parse(saved);
      } catch(_) {}
      console.log("[login] checkLoginStatus: found cookies, keys:", Object.keys(cookies)); if (Object.keys(cookies).length === 0) {console.log("[login] checkLoginStatus: no cookies, not logged in"); isLoggedIn.value = false; return;
      }
      cookiesSaved.value = cookies;
      const { checkLogin } = await import('../utils/invoke');
      const result = await checkLogin(JSON.stringify(cookies), proxy.value || undefined); console.log("[login] checkLoginStatus result:", {logged_in: result.logged_in, uname: result.uname}); isLoggedIn.value = result.logged_in;
      loginUname.value = result.uname;
      loginUid.value = result.uid;
      loginFace.value = result.face;
    } catch (_) { isLoggedIn.value = false; }
  }

  async function doLogout() {
    stopPolling();
    try { localStorage.removeItem('bili2insight-cookies'); } catch(_) {}
    cookiesSaved.value = {};
    isLoggedIn.value = false;
    loginUname.value = ''; loginUid.value = 0; loginFace.value = '';
    favFolders.value = []; favVideos.value = [];
    cancelLogin();
  }

  // ---------- Favorites functions ----------
  async function loadFavFolders() {
    favLoading.value = true;
    try {
      const cookiesStr = JSON.stringify(cookiesSaved.value);
      const { favGetFolders } = await import('../utils/invoke');
      const result = await favGetFolders(cookiesStr, proxy.value || undefined);
      favFolders.value = result.folders; console.log("FAV loadFavFolders OK:", result.folders.length, "folders");
      loginUname.value = result.uname;
      loginUid.value = result.uid;
      loginFace.value = result.face;
      isLoggedIn.value = true;
    } catch (e: any) {
      loginError.value = String(e);
      if (String(e).includes('expired') || String(e).includes('login')) {
        isLoggedIn.value = false;
      }
    } finally { favLoading.value = false; }
  }

  async function loadCollectedVideos(seasonId: number, mid: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const ck = JSON.stringify(cookiesSaved.value);
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke<any>('fav_collected_videos', { cookiesJson: ck, folderId: seasonId, mid, page, proxy: proxy.value || undefined });
      favVideos.value = r.videos;
      favPage.value = page;
      favTotalPages.value = r.total_pages;
      favTotal.value = r.total;
      favCurrentFolderId.value = seasonId;
    } catch(e:any){ loginError.value = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  async function loadFavVideos(folderId: number, page: number) {
    favLoadingVideos.value = true;
    try {
      const cookiesStr = JSON.stringify(cookiesSaved.value); console.log("FAV loadFavVideos: folder=" + folderId + " page=" + page + " hasCookies=" + Object.keys(cookiesSaved.value || {}).length); const { favGetVideos } = await import('../utils/invoke');
      const result = await favGetVideos(cookiesStr, folderId, page, proxy.value || undefined);
      favVideos.value = result.videos; console.log("FAV loadFavVideos OK:", result.videos.length, "videos, total=", result.total);
      favPage.value = page;
      favTotalPages.value = result.total_pages;
      favTotal.value = result.total;
      favCurrentFolderId.value = folderId;
    } catch (e: any) { console.error("FAV loadFavVideos ERROR:", e); loginError.value = String(e); }
    finally { favLoadingVideos.value = false; }
  }

  
  async function loadFollowList(fType: number, page: number) {
    followLoading.value = true;
    try {
      const cookiesStr = JSON.stringify(cookiesSaved.value);
      const { favGetFollowList } = await import('../utils/invoke');
      const result = await favGetFollowList(cookiesStr, fType, page, proxy.value || undefined);
      followItems.value = result.items;
      followPage.value = result.page;
      followTotalPages.value = result.total_pages;
      followTotal.value = result.total;
      followType.value = fType;
    } catch (e: any) { loginError.value = String(e); }
    finally { followLoading.value = false; }
  }

  
  async function loadWatchLater(page: number) {
    watchLaterLoading.value = true;
    try {
      const ck = JSON.stringify(cookiesSaved.value);
      const { favWatchLater } = await import("../utils/invoke");
      const r = await favWatchLater(ck, page, proxy.value || undefined);
      watchLaterItems.value = r.items; watchLaterPage.value = r.page;
      watchLaterTotalPages.value = r.total_pages;
    } catch(e:any){ loginError.value = String(e); }
    finally { watchLaterLoading.value = false; }
  }
  async function loadHistory(page: number) {
    historyLoading.value = true;
    try {
      const ck = JSON.stringify(cookiesSaved.value);
      const { favHistory } = await import("../utils/invoke");
      const r = await favHistory(ck, page, proxy.value || undefined);
      historyItems.value = r.items; historyPage.value = r.page;
      historyTotalPages.value = r.total_pages;
    } catch(e:any){ loginError.value = String(e); }
    finally { historyLoading.value = false; }
  }

  function openFavFolder(folder: any) {
    favCurrentFolderId.value = folder.id;
    favCurrentFolderTitle.value = folder.title;
    favSelectedVideos.value = new Set();
    favIsCollected.value = !!folder.collected;
    favCurrentFolderMid.value = folder.mid || 0;
    if (folder.collected) {
      loadCollectedVideos(folder.id, folder.mid, 1);
    } else {
      loadFavVideos(folder.id, 1);
    }
  }

  function toggleFavVideo(idx: number) {
    const s = new Set(favSelectedVideos.value);
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    favSelectedVideos.value = s;
  }

  function selectAllFavVideos() {
    favSelectedVideos.value = new Set(favVideos.value.map((_: any, i: number) => i));
  }

  function addFavVideosToQueue() {
    const sel: any[] = [];
    favSelectedVideos.value.forEach(i => { if (i < favVideos.value.length) sel.push(favVideos.value[i]); });
    if (sel.length === 0) return;
    sel.forEach(v => {
      const url = 'https://www.bilibili.com/video/' + v.bvid;
      addQueueItem({
        url,
        pageInfo: { page: 1, part: v.title, cid: v.cid, duration: v.duration },
        source: 'fav'
      });
    });
  }




  // ---------- Lifecycle ----------
  function switchProvider(idx: number) { selectedProvider.value = idx; const p = PROVIDERS[idx]; aiApiUrl.value = p.url; if (p.models.length>0 && customModels.value.length===0) aiModel.value = p.models[0]; }
  async function init() { console.log("[login] App init - checking..."); await initCookiesPath(); console.log("[login] cookies path:", cookiesFilePath.value);
    unlisten = await listen<PipelineProgress>("pipeline-progress", (ev) => {
      progress.value = ev.payload;
      const stageMap: Record<string,string> = {download:"下载中",ffmpeg:"转换格式",asr:"语音识别",refine:"AI 校对",ai:"AI 分析",done:"完成",preview:"检测中"};
      const msgMap: Record<string,string> = {"Getting video info and downloading audio...":"获取视频信息并下载音频...","Download complete":"下载完成","Converting audio format...":"转换音频格式...","Audio conversion complete":"音频转换完成","Running speech recognition...":"运行语音识别...","Speech recognition complete":"语音识别完成","AI proofreading transcript...":"AI 校对文稿...","Transcript proofread":"文稿校对完成","Extracting insights with AI...":"AI 提炼观点...","AI insights ready":"AI 观点提炼完成","Complete":"处理完成","Detecting video...":"检测视频中..."};
      // Update active task (multi-page pipeline in SourceUrlView)
      if (activeTaskIndex.value >= 0 && activeTaskIndex.value < tasks.value.length) {
        const task = tasks.value[activeTaskIndex.value];
        task.progress = ev.payload.progress;
        task.stageLabel = stageMap[ev.payload.stage] || ev.payload.stage;
        task.message = msgMap[ev.payload.message] || ev.payload.message;
      }
      // Update running queue item
      const qIdx = queue.value.findIndex(q => q.status === 'running');
      if (qIdx >= 0) {
        console.log('progress listener: updating queue[', qIdx, '] stage=', ev.payload.stage, 'progress=', ev.payload.progress, 'msg=', ev.payload.message?.slice(0,50));
        const q = [...queue.value];
        q[qIdx] = { ...q[qIdx], progress: ev.payload.progress, stageLabel: stageMap[ev.payload.stage] || ev.payload.stage, message: msgMap[ev.payload.message] || ev.payload.message };
        queue.value = q;
      }
    });
    await checkLoginStatus();
  }
  function cleanup() { if (unlisten) { unlisten(); unlisten = null; } }

  // ---------- URL detection ----------
  async function detectUrl(val: string) {
    if (previewTimer) clearTimeout(previewTimer);
    preview.value = null; previewLoading.value = false;
    selectedPages.value = new Set();
    if (!val.trim() || !val.includes("bilibili.com")) return;
    previewLoading.value = true;
    previewTimer = setTimeout(async () => {
      try {
        const info = await previewVideo(val, proxy.value||undefined);
        preview.value = info;
        if (info.pages && info.pages.length > 0) {
            const matchIdx = info.pages.findIndex(p => p.cid === info.cid);
            selectedPages.value = new Set([matchIdx >= 0 ? matchIdx : 0]);
        }
      } catch (e: any) { console.error("preview error:", e); error.value = String(e); }
      finally { previewLoading.value = false; }
    }, 600);
  }
  watch(url, (val) => { detectUrl(val); });

  // ---------- Page selection ----------
  function togglePage(idx: number) {
    const s = new Set(selectedPages.value);
    if (s.has(idx)) s.delete(idx); else s.add(idx);
    selectedPages.value = s;
  }
  // ---------- Preview (exposed for HomeView) ----------
  async function previewVideoFn(val: string) {
    return await previewVideo(val, proxy.value || undefined);
  }

  // ---------- Queue management ----------
  function addQueueItem(input: { url: string; pageInfo: PageInfo; source?: string }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    queue.value = [...queue.value, {
      id,
      source: (input.source || 'url') as QueueItem['source'],
      url: input.url,
      pageInfo: input.pageInfo,
      status: 'pending' as const,
      progress: 0,
      stageLabel: '等待中',
      message: '',
      result: null,
      error: '',
      createdAt: Date.now(),
    }];
  }

  async function processQueue() {
    if (isProcessing.value) return;
    console.log("processQueue started", queue.value.length, "items");
    isProcessing.value = true;
    try {
      for (let i = 0; i < queue.value.length; i++) {
        const item = queue.value[i];
        if (item.status !== 'pending') continue;
        const updated = [...queue.value];
        updated[i] = { ...item, status: 'running' as const, stageLabel: '开始处理' };
        queue.value = updated;
        console.log('processQueue: item', i, 'set to running, url=', item.url?.slice(0,50), 'cid=', item.pageInfo.cid, 'part=', item.pageInfo.part);
        try {
          let result: PipelineResult;
          if (item.source === 'local') {
            result = await runPipelineLocal(item.url!, item.pageInfo.part, aiApiUrl.value || undefined, aiApiKey.value || undefined, aiModel.value || undefined, aiPrompt.value || undefined, asrModel.value, asrApiUrl.value || undefined, asrApiKey.value || undefined);
          } else {
            result = await runPipelineWithPage(item.url!, proxy.value || undefined, aiApiUrl.value || undefined, aiApiKey.value || undefined, aiModel.value || undefined, aiPrompt.value || undefined, item.pageInfo.cid, asrModel.value, asrApiUrl.value || undefined, asrApiKey.value || undefined);
          }
          console.log('processQueue: item', i, 'DONE, bvid=', result.video_info.bvid, 'title=', result.video_info.title?.slice(0,40));
          const done = [...queue.value];
          done[i] = { ...done[i], status: 'done' as const, progress: 1, stageLabel: '完成', result };
          queue.value = done;
        } catch (e: any) {
          const err = [...queue.value];
          err[i] = { ...err[i], status: 'error' as const, error: String(e) };
          queue.value = err;
        }
        // Brief yield to let the event loop breathe between items
        await new Promise(r => setTimeout(r, 100));
      }
    } finally { isProcessing.value = false; }
  }

    function selectAllPages() {
    selectedPages.value = new Set(videoPages.value.map((_, i) => i));
  }

  // ---------- Pipeline ----------
  async function startPipeline() {
    if (!url.value.trim()) { error.value = "请输入 Bilibili 视频链接"; return; }
    if (!preview.value) return;

    const pages = videoPages.value;
    const selected: number[] = [];
    selectedPages.value.forEach(i => { if (i < pages.length) selected.push(i); });

    if (selected.length === 0) {
      error.value = "请至少选择一个分P";
      return;
    }

    // Reset state
    processing.value = true; error.value = ""; result.value = null;
    tasks.value = selected.map(i => ({
      pageKey: i,
      pageInfo: pages[i],
      status: "pending" as const,
      progress: 0, stageLabel: "等待中", message: "",
      result: null, error: "",
    }));
    activeTaskIndex.value = -1;

    // Sequential processing
    for (let ti = 0; ti < tasks.value.length; ti++) {
      activeTaskIndex.value = ti;
      tasks.value[ti].status = "running";
      try {
        const res = await runPipelineWithPage(
          url.value, proxy.value||undefined, aiApiUrl.value||undefined, aiApiKey.value||undefined,
          aiModel.value||undefined, aiPrompt.value||undefined, tasks.value[ti].pageInfo.cid,
          asrModel.value, asrApiUrl.value||undefined, asrApiKey.value||undefined,
        );
        tasks.value[ti].status = "done";
        tasks.value[ti].result = res;
        tasks.value[ti].progress = 1;
        tasks.value[ti].stageLabel = "完成";
        // For single page, also set legacy result
        if (tasks.value.length === 1) result.value = res;
      } catch (e: any) {
        tasks.value[ti].status = "error";
        tasks.value[ti].error = String(e);
      }
    }

    processing.value = false;
    activeTaskIndex.value = -1;
    if (completedTasks.value.length > 0) {
      activeResultTab.value = 0;
    }
  }

  // ---------- Fetch models ----------
  async function fetchModelList() {
    if (!aiApiKey.value.trim()) { error.value = "请先输入 API 密钥"; return; }
    try { const models = await fetchModels(aiApiUrl.value, aiApiKey.value.trim()); if (models.length>0) { customModels.value = models; aiModel.value = models[0]; persistSettings(); } }
    catch (e: any) { const msg = String(e); error.value = msg.includes("401") ? "API 密钥无效" : "获取失败: "+msg; }
  }

  // ---------- Template management ----------
  function selectTemplate(idx: number) { selectedTemplateIndex.value = idx; }
  function addCustomTemplate() {
    const name = "自定义 "+(customTemplates.value.length+1);
    customTemplates.value = [...customTemplates.value, { name, prompt: "请分析以下视频文案...", builtin: false }];
    selectedTemplateIndex.value = BUILTIN_TEMPLATES.length + customTemplates.value.length - 1;
  }
  function deleteCustomTemplate(idx: number) {
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    customTemplates.value = customTemplates.value.filter((_, i) => i !== ci);
    if (selectedTemplateIndex.value >= idx) selectedTemplateIndex.value = Math.max(0, selectedTemplateIndex.value - 1);
  }
  function updateTemplatePrompt(idx: number, prompt: string) {
    if (idx < BUILTIN_TEMPLATES.length) return;
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    const updated = [...customTemplates.value];
    updated[ci] = { ...updated[ci], prompt };
    customTemplates.value = updated;
  }
  function updateTemplateName(idx: number, name: string) {
    if (idx < BUILTIN_TEMPLATES.length) return;
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    const updated = [...customTemplates.value];
    updated[ci] = { ...updated[ci], name };
    customTemplates.value = updated;
  }

  // ---------- Export ----------
  async function exportToFile() {
    const md = activeResultTab.value < completedTasks.value.length
      ? completedTasks.value[activeResultTab.value]?.result?.markdown ?? ""
      : mergedMarkdown.value;
    if (!md) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultName = completedTasks.value.length <= 1
        ? `${preview.value?.title ?? "output"}.md`
        : activeResultTab.value < completedTasks.value.length
          ? `${completedTasks.value[activeResultTab.value].pageInfo.part}.md`
          : `${preview.value?.title ?? "merged"}_合并.md`;
      const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath: defaultName });
      if (path) await saveResultToFile({ ...completedTasks.value[0]?.result as any, markdown: md }, path);
    } catch (e: any) { error.value = String(e); }
  }

  return {
    url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider, processing, progress, result, error,
    preview, previewLoading, PROVIDERS, BUILTIN_TEMPLATES, allTemplates, selectedTemplateIndex, customTemplates, customModels, asrModel, asrApiUrl, asrApiKey,
    selectedPages, tasks, activeTaskIndex, videoPages, completedTasks, hasMultiPages, activeResultTab,
    activeResult, mergedMarkdown,
    init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList,
    selectTemplate, addCustomTemplate, deleteCustomTemplate, updateTemplatePrompt, updateTemplateName, persistSettings,
    togglePage, selectAllPages,
    queue, isProcessing, queueCount, previewVideoFn, addQueueItem, processQueue,
    // Login
    showLogin, qrUrl, qrcodeKey, qrPolling, qrStatusMessage, qrStatus, loginError, isLoggedIn, loginUname, loginUid, loginFace, cookiesSaved, cookiesFilePath, initCookiesPath,
    startLogin, pollQr, stopPolling, cancelLogin, checkLoginStatus, doLogout, checkLoginAfterAuth,
    // Favorites
    favFolders, favLoading, favCurrentFolderId, favCurrentFolderTitle, favIsCollected, favCurrentFolderMid, favVideos, favPage, favTotalPages, favTotal, favLoadingVideos, favSelectedVideos,
    loadFavFolders, loadFavVideos, loadCollectedVideos, openFavFolder, toggleFavVideo, selectAllFavVideos, addFavVideosToQueue, followItems, followLoading, followType, followPage, followTotalPages, followTotal, loadFollowList, watchLaterItems, watchLaterLoading, watchLaterPage, watchLaterTotalPages, loadWatchLater, historyItems, historyLoading, historyPage, historyTotalPages, loadHistory,
  };
});
