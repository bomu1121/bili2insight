<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NText, NIcon, NTabs, NTabPane, NPopover, NSwitch, NDrawer, NDrawerContent, NSelect, NConfigProvider, type GlobalThemeOverrides } from "naive-ui";
import { message } from "./utils/feedback";
import { zhCN, dateZhCN } from "naive-ui";
import { Settings, List, Play, Trash2, Eye, CircleCheckBig, CircleX, CircleStop, RefreshCw, CircleUserRound, LogOut, RotateCw, Smartphone, QrCode, ArrowRight, Copy, LinkIcon, FolderOpen, CloudUpload, Clock, BookOpen } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "./stores/app";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settingsStore";
import { useTemplateStore } from "./stores/templates";
import { useMagnetic, useTilt } from "./composables/useMagnetic";
import { useRipple } from "./composables/useScrollReveal";
const store = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const templateStore = useTemplateStore();
const logoRef = ref<HTMLElement | null>(null);
const avatarRef = ref<HTMLElement | null>(null);
useMagnetic(logoRef, { strength: 0.6, radius: 120 });
useTilt(avatarRef, { maxTilt: 12 });
const { createRipple } = useRipple();


const isDarkMode = ref(true);
const darkOverrides: GlobalThemeOverrides = {
  common: { primaryColor: "#8B3E3E", primaryColorHover: "#A04A4A", primaryColorPressed: "#783030", primaryColorSuppl: "#8B3E3E", infoColor: "#439AB1", successColor: "#1DED3F", warningColor: "#FF8E42", errorColor: "#B53A3A", borderRadius: "6px", borderColor: "#332E28", textColorBase: "#E8E0D5", textColor2: "#A89E92", textColor3: "#6B6359", bodyColor: "#1A1512", cardColor: "#24211D", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif', inputColor: "#1E1B17", modalColor: "#24211D", popoverColor: "#24211D", tableColor: "#24211D", actionColor: "#24211D", dividerColor: "#332E28" },
  Button: { borderRadiusMedium: "6px", borderRadiusSmall: "6px", borderRadiusTiny: "6px", fontWeight: "500", textColorGhost: "#A89E92", borderGhost: "#454038" },
  Input: { borderRadius: "6px", color: "#1E1B17", border: "#332E28", borderHover: "#454038", borderFocus: "#8B3E3E", boxShadowFocus: "0 0 0 2px rgba(139,62,62,0.18)", textColor: "#E8E0D5", placeholderColor: "#6B6359" },
  Card: { borderRadius: "10px", color: "#24211D", borderColor: "#332E28" }, Checkbox: { borderRadius: "4px", colorChecked: "#8B3E3E", borderChecked: "#8B3E3E" },
  Drawer: { color: "#24211D", textColor: "#E8E0D5", titleTextColor: "#E8E0D5" }, Tabs: { tabTextColorActiveLine: "#8B3E3E", tabTextColorHoverLine: "#8B3E3E", barColor: "#8B3E3E" },
  Select: { peers: { InternalSelection: { color: "#1E1B17", border: "#332E28", borderHover: "#454038", borderFocus: "#8B3E3E", textColor: "#E8E0D5" } } },
  Pagination: { itemColor: "#24211D", itemColorActive: "#1A1512", itemTextColor: "#A89E92", itemTextColorActive: "#8B3E3E", itemBorder: "#332E28", itemBorderActive: "#8B3E3E" },
  Popconfirm: { color: "#24211D" }, Dialog: { color: "#24211D", textColor: "#E8E0D5" }, Spin: { color: "#8B3E3E" },
  Menu: { itemColorActive: "rgba(139,62,62,0.07)", itemTextColorActive: "#8B3E3E" },
};
const lightOverrides: GlobalThemeOverrides = {
  common: { primaryColor: "#7B2D2D", primaryColorHover: "#8E3A3A", primaryColorPressed: "#642020", primaryColorSuppl: "#7B2D2D", infoColor: "#2A7A8C", successColor: "#1B7A2D", warningColor: "#D4702A", errorColor: "#A03030", borderRadius: "6px", borderColor: "#D8D0C5", textColorBase: "#1A1512", textColor2: "#5C5448", textColor3: "#8C8276", bodyColor: "#F5F0E8", cardColor: "#FAF7F2", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif', inputColor: "#F0EBE3", modalColor: "#FAF7F2", popoverColor: "#FAF7F2", tableColor: "#FAF7F2", actionColor: "#FAF7F2", dividerColor: "#D8D0C5" },
  Button: { borderRadiusMedium: "6px", borderRadiusSmall: "6px", borderRadiusTiny: "6px", fontWeight: "500", textColorGhost: "#5C5448", borderGhost: "#BFB5A8" },
  Input: { borderRadius: "6px", color: "#F0EBE3", border: "#D8D0C5", borderHover: "#BFB5A8", borderFocus: "#7B2D2D", boxShadowFocus: "0 0 0 2px rgba(123,45,45,0.15)", textColor: "#1A1512", placeholderColor: "#8C8276" },
  Card: { borderRadius: "10px", color: "#FAF7F2", borderColor: "#D8D0C5" }, Checkbox: { borderRadius: "4px", colorChecked: "#7B2D2D", borderChecked: "#7B2D2D" },
  Drawer: { color: "#FAF7F2", textColor: "#1A1512", titleTextColor: "#1A1512" }, Tabs: { tabTextColorActiveLine: "#7B2D2D", tabTextColorHoverLine: "#7B2D2D", barColor: "#7B2D2D" },
  Select: { peers: { InternalSelection: { color: "#F0EBE3", border: "#D8D0C5", borderHover: "#BFB5A8", borderFocus: "#7B2D2D", textColor: "#1A1512" } } },
  Pagination: { itemColor: "#FAF7F2", itemColorActive: "#F5F0E8", itemTextColor: "#5C5448", itemTextColorActive: "#7B2D2D", itemBorder: "#D8D0C5", itemBorderActive: "#7B2D2D" },
  Popconfirm: { color: "#FAF7F2" }, Dialog: { color: "#FAF7F2", textColor: "#1A1512" }, Spin: { color: "#7B2D2D" },
  Menu: { itemColorActive: "rgba(123,45,45,0.07)", itemTextColorActive: "#7B2D2D" },
};
const themeOverrides = computed(() => isDarkMode.value ? darkOverrides : lightOverrides);
function toggleTheme() {
  const apply = () => {
    isDarkMode.value = !isDarkMode.value;
    document.documentElement.dataset.theme = isDarkMode.value ? 'dark' : 'light';
    localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light');
  };
  if (document.startViewTransition) {
    document.startViewTransition(() => apply());
  } else {
    apply();
  }
}

const router = useRouter();
const route = useRoute();
const showSettings = ref(false);
const showQueue = ref(false);
const qrTab = ref("qr");


onMounted(async () => { const saved = localStorage.getItem("theme"); if (saved === "light") { isDarkMode.value = false; document.documentElement.dataset.theme = "light"; } await store.init(); });
onUnmounted(() => store.cleanup());
watch(() => store.error, (val) => { if (val) message.error(val); });

const isQueueRoute = computed(() => route.path === "/queue" || route.path.startsWith("/result"));

function viewResult(id: string) { showQueue.value = false; router.push(`/result/${id}`); }
function openQueuePage() { showQueue.value = false; router.push("/queue"); }
function startProcessing() { store.processQueue(); }
function clearDone() { store.queue = store.queue.filter(q => q.status !== "done" && q.status !== "error" && q.status !== "cancelled"); }
function stopProcessing() {
  const stopped = store.cancelQueue();
  message[stopped ? "success" : "info"](stopped ? "已停止 " + stopped + " 项处理" : "已停止处理");
}
async function copyAllTitles() {
  const text = store.queue.map(q => q.pageInfo.part).join('\n');
  try { await navigator.clipboard.writeText(text); } catch (_) {}
}

const templateOptions = computed(() => {
  const opts = templateStore.allTemplates.map((t, i) => ({ label: t.name, value: i }));
  return [{ label: `默认（${templateStore.allTemplates[templateStore.selectedTemplateIndex]?.name ?? ""}）`, value: -1 }, ...opts];
});

function updateItemTemplate(itemId: string, val: number) {
  const q = [...store.queue];
  const idx = q.findIndex(qi => qi.id === itemId);
  if (idx < 0) return;
  q[idx] = { ...q[idx], templateIndex: val >= 0 ? val : undefined };
  store.queue = q;
}

const fmtElapsed = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m${s}s`;
};

// SMS state
const smsPhone = ref("");
const smsCode = ref("");
const smsSending = ref(false);
const smsSent = ref(false);
const smsCountdown = ref(0);

function openLogin() {
  if (authStore.isLoggedIn) { authStore.showLogin = true; return; }
  authStore.startLogin();
}
async function doSendSms() {
  if (!smsPhone.value) { message.warning("请输入手机号"); return; }
  smsSending.value = true;
  try {
    // For now, SMS send requires valid captcha token which needs Geetest integration
    message.info("短信登录需要验证码，即将开发");
  } catch(e: any) { message.error(String(e)); }
  finally { smsSending.value = false; }
}

function refreshLogin() { authStore.cancelLogin(); authStore.startLogin(); }

const tplPrompt = computed({
  get: () => {
    const idx = templateStore.selectedTemplateIndex;
    if (idx < templateStore.BUILTIN_TEMPLATES.length) return templateStore.BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - templateStore.BUILTIN_TEMPLATES.length;
    return templateStore.customTemplates[ci]?.prompt ?? "";
  },
  set: (val: string) => {
    const idx = templateStore.selectedTemplateIndex;
    if (idx < templateStore.BUILTIN_TEMPLATES.length) return;
    templateStore.updateTemplatePrompt(idx, val);
  }
});
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
  <div class="app-root">
    <aside class="side">
      <div class="side-brand" @click="router.push('/')" title="返回首页">
        <div ref="logoRef" class="logo-mark magnetic"><svg viewBox="0 0 34 34" width="34" height="34" class="logo-gear"><circle cx="17" cy="17" r="12" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.85"/><circle cx="17" cy="17" r="5.5" fill="none" stroke="currentColor" stroke-width="2" opacity="0.9"/><line x1="17" y1="3" x2="17" y2="6.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="17" y1="27.5" x2="17" y2="31" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="3" y1="17" x2="6.5" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="27.5" y1="17" x2="31" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="7.1" y1="7.1" x2="9.6" y2="9.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="24.4" y1="24.4" x2="26.9" y2="26.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="7.1" y1="26.9" x2="9.6" y2="24.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="24.4" y1="9.6" x2="26.9" y2="7.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></div>
        <div class="logo-text">
          <span class="brand-name">Reading Steiner</span>
          <span class="brand-sub">B站视频 AI 观点笔记</span>
        </div>
      </div>

      <nav class="side-nav">
        <div class="nav-group">
          <div class="nav-caption">> 信号源</div>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/url' }" @click="router.push('/source/url'); createRipple($event)">
            <n-icon :size="17"><LinkIcon /></n-icon>
            <span class="nav-label">B站链接</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/fav' }" @click="router.push('/source/fav'); createRipple($event)">
            <n-icon :size="17"><FolderOpen /></n-icon>
            <span class="nav-label">B站收藏</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/local' }" @click="router.push('/source/local'); createRipple($event)">
            <n-icon :size="17"><CloudUpload /></n-icon>
            <span class="nav-label">本地文件</span>
          </button>
        </div>
        <div class="nav-group">
          <div class="nav-caption">> 观测台</div>
          <button type="button" class="nav-item" :class="{ on: isQueueRoute }" @click="showQueue = true; createRipple($event)">
            <n-icon :size="17"><List /></n-icon>
            <span class="nav-label">处理队列</span>
            <span v-if="store.isProcessing" class="nav-pulse signal-dot" title="正在处理" />
            <span v-if="store.queueCount > 0" class="nav-badge tnum">{{ store.queueCount }}</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/notes' }" @click="router.push('/notes'); createRipple($event)">
            <n-icon :size="17"><BookOpen /></n-icon>
            <span class="nav-label">笔记</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/history' }" @click="router.push('/history'); createRipple($event)">
            <n-icon :size="17"><Clock /></n-icon>
            <span class="nav-label">历史记录</span>
          </button>
        </div>
      </nav>

      <div class="side-foot"><div class="divergence-display tnum"><span class="div-label">Divergence</span><span class="div-number">1.048596</span></div>
        <!-- 已登录: popover 菜单 -->
        <n-popover v-if="authStore.isLoggedIn" trigger="click" placement="top-end" :width="220" :show-arrow="false">
          <template #trigger>
            <button type="button" class="side-user" :title="authStore.loginUname">
              <span ref="avatarRef" class="side-avatar tilt-card">
                <img v-if="authStore.loginFace" :src="authStore.loginFace" referrerpolicy="no-referrer" />
                <n-icon v-else :size="18" color="var(--color-text-secondary)"><CircleUserRound /></n-icon>
                <span class="side-online" />
              </span>
              <span class="side-user-meta">
                <span class="side-user-name">{{ authStore.loginUname }}</span>
                <span class="side-user-hint">B站观测者</span>
              </span>
            </button>
          </template>
          <div class="user-popover">
            <div class="up-head">
              <img v-if="authStore.loginFace" :src="authStore.loginFace" class="up-avatar" referrerpolicy="no-referrer" />
              <n-icon v-else size="32" color="var(--color-brand)"><CircleUserRound /></n-icon>
              <div class="up-meta">
                <span class="up-name">{{ authStore.loginUname }}</span>
                <span class="up-uid tnum">LAB MEM {{ String(authStore.loginUid).padStart(6, '0') }}</span>
              </div>
            </div>
            <div class="up-actions">
              <button type="button" class="up-item" @click="router.push('/source/fav')">
                <n-icon size="16"><FolderOpen /></n-icon>
                <span>B站收藏</span>
              </button>
              <button type="button" class="up-item danger" @click="authStore.doLogout()">
                <n-icon size="16"><LogOut /></n-icon>
                <span>退出登录</span>
              </button>
            </div>
          </div>
        </n-popover>
        <!-- 未登录: 打开登录 drawer -->
        <button
          v-else
          type="button"
          class="side-user"
          @click="openLogin"
          title="登录 B 站账号"
        >
          <span ref="avatarRef" class="side-avatar tilt-card">
            <n-icon :size="18" color="var(--color-text-secondary)"><CircleUserRound /></n-icon>
          </span>
          <span class="side-user-meta">
            <span class="side-user-name">LAB MEM 000</span>
            <span class="side-user-hint">> 启动观测</span>
          </span>
        </button>
        <div class="worldline-toggle" @click="toggleTheme" :title="isDarkMode ? '世界线跳跃: α → β 吸引子场' : '世界线跳跃: β → α 吸引子场'"><span class="wl-field" :class="{ on: isDarkMode }">α</span><span class="wl-track"><span class="wl-thumb" :class="{ right: !isDarkMode }"></span></span><span class="wl-field" :class="{ on: !isDarkMode }">β</span></div><button type="button" class="side-set" @click="showSettings = true" title="设置">
          <n-icon :size="17"><Settings /></n-icon>
        </button>
      </div>
    </aside>

    <main class="app-main">
      <router-view />
    </main>

    <!-- Queue Drawer -->
    <n-drawer v-model:show="showQueue" width="420" placement="right">
      <n-drawer-content title="观测队列" closable>
        <div class="queue-drawer" v-if="store.queue.length > 0">
          <div class="queue-actions">
            <n-button size="small" type="primary" @click="startProcessing" :disabled="store.isProcessing || store.queue.filter(q=>q.status==='pending').length===0">
              <template #icon><n-icon><Play /></n-icon></template>开始观测
            </n-button>
            <n-button v-if="store.isProcessing" size="small" type="warning" @click="stopProcessing">
              <template #icon><n-icon><CircleX /></n-icon></template>停止
            </n-button>
            <n-button size="small" @click="clearDone" :disabled="store.queue.filter(q=>q.status==='done'||q.status==='error'||q.status==='cancelled').length===0">
              <template #icon><n-icon><Trash2 /></n-icon></template>清除已完成
            </n-button>
            <n-button size="small" @click="copyAllTitles" :disabled="store.queue.length===0">
              <template #icon><n-icon><Copy /></n-icon></template>复制标题
            </n-button>
          </div>
          <div class="queue-list">
            <div v-for="item in store.queue" :key="item.id" class="q-item" :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error', cancelled: item.status === 'cancelled' }">
              <div class="q-row1">
                <span class="q-s">
                  <n-icon v-if="item.status === 'done'" color="var(--color-success)" size="16"><CircleCheckBig /></n-icon>
                  <n-icon v-else-if="item.status === 'error'" color="var(--color-error)" size="16"><CircleX /></n-icon>
                  <n-icon v-else-if="item.status === 'running'" color="var(--color-brand)" size="16" class="spinning"><RefreshCw /></n-icon>
                  <n-icon v-else-if="item.status === 'cancelled'" color="var(--color-warning)" size="16"><CircleStop /></n-icon>
                  <span v-else class="q-pending-dot">&#9679;</span>
                </span>
                <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
                <div class="q-meta">
                  <span class="q-dur tnum">{{ (item.pageInfo.duration ? String(Math.floor(item.pageInfo.duration/60)).padStart(2,'0') + ':' + String(item.pageInfo.duration%60).padStart(2,'0') : '') }}</span>
                  <span v-if="item.status !== 'done'" class="q-tag" :class="item.status">
                    {{ item.status === 'error' ? '失败' : item.status === 'running' ? item.stageLabel : item.status === 'cancelled' ? '已停止' : '等待' }}
                  </span>
                  <span class="q-elapsed tnum">{{ item.elapsedMs ? fmtElapsed(item.elapsedMs) : '' }}</span>
                </div>
                <div class="q-action">
                  <n-select
                    v-if="item.status === 'pending'"
                    :value="item.templateIndex ?? -1"
                    :options="templateOptions"
                    size="tiny"
                    :consistent-menu-width="false"
                    class="q-tpl-select"
                    @update:value="(v: number) => updateItemTemplate(item.id, v)"
                  />
                  <n-button v-if="item.status === 'running'" size="tiny" text @click="store.cancelQueueItem(item.id)" style="padding:0 4px;" title="取消该任务">
                    <template #icon><n-icon size="16" color="var(--color-warning)"><CircleStop /></n-icon></template>
                  </n-button>
                  <n-button v-if="item.status === 'cancelled' || item.status === 'error'" size="tiny" text @click="store.restartQueueItem(item.id)" style="padding:0 4px;" title="重新开始">
                    <template #icon><n-icon size="16" color="var(--color-brand)"><RotateCw /></n-icon></template>
                  </n-button>
                  <n-button v-if="item.status === 'done'" size="tiny" text @click="viewResult(item.id)" style="padding:0 4px;">
                    <template #icon><n-icon size="16"><Eye /></n-icon></template>
                  </n-button>
                </div>
              </div>
              <div v-if="item.status === 'running'" class="q-row2">
                <div class="q-bar"><div class="q-fill" :style="{ width: Math.round(item.progress*100)+'%' }"></div></div>
              </div>
            </div>
          </div>
        </div>
        <n-text depth="3" v-else class="queue-empty">
          <n-icon :size="40" color="var(--color-text-tertiary)"><List /></n-icon>
          <span>队列为空</span>
          <span class="queue-empty-hint">返回首页添加视频后在此处理</span>
        </n-text>
        <template #footer>
          <button type="button" class="queue-full-link" @click="openQueuePage">
            打开完整队列页
            <n-icon :size="14"><ArrowRight /></n-icon>
          </button>
        </template>
      </n-drawer-content>
    </n-drawer>

        <!-- Login Drawer — PhoneWave 实验终端 -->
    <n-drawer :show="authStore.showLogin" @update:show="(v) => { if (!v) authStore.cancelLogin(); }" width="420">
      <n-drawer-content title="> 观测者认证" closable>
        <!-- 登录: QR + SMS -->
        <div class="login-terminal">
          <n-tabs v-model:value="qrTab" type="line" size="medium" animated>
            <n-tab-pane name="qr" tab="扫码登录">
              <template #tab>
                <n-icon size="18"><QrCode /></n-icon>
                <span style="margin-left:6px;">扫码登录</span>
              </template>
              <div class="tab-content">
                <div class="qr-chamber">
                  <div class="chamber-scanline"></div>
                  <div class="chamber-body">
                    <img v-if="authStore.qrUrl" :src="'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(authStore.qrUrl)" class="qr-code-img" referrerpolicy="no-referrer" />
                    <div v-if="authStore.qrStatus === 'expired'" class="chamber-overlay" @click="refreshLogin">
                      <n-icon size="28"><RotateCw /></n-icon>
                      <n-text depth="3">量子态坍塔，点击重建</n-text>
                    </div>
                    <div v-if="authStore.qrStatus === 'success'" class="chamber-overlay success">
                      <n-icon size="32" color="var(--color-success)"><CircleCheckBig /></n-icon>
                      <n-text class="login-ok-text">世界线收敛完成</n-text>
                    </div>
                  </div>
                </div>
                <div class="pipeline" v-if="authStore.qrStatus && authStore.qrStatus !== 'error'">
                  <div class="pipeline-stage" :class="{ active: authStore.qrStatus === 'waiting', done: authStore.qrStatus === 'scanned' || authStore.qrStatus === 'success' }">
                    <span class="stage-dot"></span>
                    <span class="stage-label">量子态生成</span>
                  </div>
                  <div class="pipeline-connector" :class="{ active: authStore.qrStatus === 'scanned' || authStore.qrStatus === 'success' }"></div>
                  <div class="pipeline-stage" :class="{ active: authStore.qrStatus === 'scanned', done: authStore.qrStatus === 'success' }">
                    <span class="stage-dot"></span>
                    <span class="stage-label">观测确认</span>
                  </div>
                  <div class="pipeline-connector" :class="{ active: authStore.qrStatus === 'success' }"></div>
                  <div class="pipeline-stage" :class="{ active: authStore.qrStatus === 'success', done: authStore.qrStatus === 'success' }">
                    <span class="stage-dot"></span>
                    <span class="stage-label">世界线收敛</span>
                  </div>
                </div>
                <div class="qr-status-msg" v-if="authStore.qrStatusMessage">
                  <n-text depth="3" style="font-size:13px;">{{ authStore.qrStatusMessage }}</n-text>
                </div>
                <n-text v-if="authStore.loginError" depth="3" type="error" style="font-size:11px;text-align:center;display:block;margin-top:10px;">{{ authStore.loginError }}</n-text>
              </div>
            </n-tab-pane>

            <n-tab-pane name="sms" tab="短信登录">
              <template #tab>
                <n-icon size="18"><Smartphone /></n-icon>
                <span style="margin-left:6px;">备用协议</span>
              </template>
              <div class="tab-content">
                <div class="sms-section">
                  <div class="sms-header tnum">备用协议 B — 短信认证</div>
                  <n-input v-model:value="smsPhone" placeholder="手机号" size="large" style="width:100%;" />
                  <n-space style="width:100%;margin-top:12px;" :size="8">
                    <n-input v-model:value="smsCode" placeholder="短信验证码" size="large" style="flex:1;" />
                    <n-button type="primary" @click="doSendSms" :disabled="smsSending || smsCountdown > 0" :loading="smsSending" style="flex-shrink:0;">
                      {{ smsCountdown > 0 ? smsCountdown + 's' : smsSent ? '重新获取' : '获取验证码' }}
                    </n-button>
                  </n-space>
                  <n-button type="primary" block @click="message.info('短信登录需要验证码，即将开发')" style="margin-top:16px;">
                    <template #icon><n-icon><ArrowRight /></n-icon></template>认证
                  </n-button>
                </div>
              </div>
            </n-tab-pane>
          </n-tabs>
        </div>
      </n-drawer-content>
    </n-drawer>

    <!-- Settings Drawer -->
    <n-drawer v-model:show="showSettings" width="460">
      <n-drawer-content title="设置" closable>
        <div class="settings-body">
          <section class="settings-section">
            <div class="settings-section-title">网络</div>
            <label class="field">
              <span class="field-label">HTTP 代理</span>
              <n-input v-model:value="settingsStore.proxy" placeholder="http://127.0.0.1:7897" size="small" />
            </label>
          </section>

          <section class="settings-section">
            <div class="settings-section-title">队列</div>
            <div class="settings-row">
              <div class="settings-row-text">
                <span class="field-label">添加后自动开始处理</span>
                <span class="settings-hint">加入队列后立即开始处理，无需手动点击</span>
              </div>
              <n-switch v-model:value="settingsStore.autoProcessQueue" size="small" />
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-title">AI 模型</div>
            <label class="field">
              <span class="field-label">AI 提供商</span>
              <n-select v-model:value="settingsStore.selectedProvider" :options="settingsStore.PROVIDERS.map((p,i)=>({label:p.name,value:i}))" size="small" @update:value="(i) => settingsStore.switchProvider(i)" />
            </label>
            <label class="field">
              <span class="field-label">API 地址</span>
              <n-input v-model:value="settingsStore.aiApiUrl" size="small" />
            </label>
            <label class="field">
              <span class="field-label">API 密钥</span>
              <div class="field-row">
                <n-input v-model:value="settingsStore.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" class="field-grow" />
                <n-button size="small" @click="settingsStore.fetchModelList()">测试连接 &amp; 拉取模型</n-button>
              </div>
            </label>
            <label class="field" v-if="settingsStore.customModels.length>0||settingsStore.PROVIDERS[settingsStore.selectedProvider].models.length>0">
              <span class="field-label">模型</span>
              <n-select v-model:value="settingsStore.aiModel" :options="(settingsStore.customModels.length>0?settingsStore.customModels:settingsStore.PROVIDERS[settingsStore.selectedProvider].models).map(m=>({label:m,value:m}))" size="small" />
            </label>
            <label class="field" v-else>
              <span class="field-label">模型</span>
              <n-input v-model:value="settingsStore.aiModel" size="small" />
            </label>
          </section>

          <section class="settings-section">
            <div class="settings-section-title">语音识别</div>
            <label class="field">
              <span class="field-label">ASR 语音识别模型</span>
              <n-select v-model:value="settingsStore.asrModel" :options="[{label:'Paraformer (本地)',value:'paraformer'},{label:'MiMo-V2.5 (API)',value:'mimo'}]" size="small" />
            </label>
            <label class="field" v-if="settingsStore.asrModel === 'mimo'">
              <span class="field-label">ASR API 地址</span>
              <n-input v-model:value="settingsStore.asrApiUrl" placeholder="https://api.xiaomimimo.com/v1/chat/completions" size="small" />
            </label>
            <label class="field" v-if="settingsStore.asrModel === 'mimo'">
              <span class="field-label">ASR API 密钥 (可选)</span>
              <n-input v-model:value="settingsStore.asrApiKey" type="password" placeholder="可选，默认不传递" size="small" show-password-on="click" />
            </label>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <div class="settings-section-title">提示词模版</div>
              <n-button size="tiny" @click="templateStore.addCustomTemplate()">+ 新增</n-button>
            </div>
            <div class="tpl-chips">
              <n-button
                v-for="(t, i) in templateStore.allTemplates"
                :key="i"
                :type="templateStore.selectedTemplateIndex===i ? 'primary' : 'default'"
                size="tiny"
                @click="templateStore.selectTemplate(i)"
                :title="t.name"
              >{{ t.name }}
                <template v-if="i >= templateStore.BUILTIN_TEMPLATES.length" #icon>
                  <n-icon size="14" style="cursor:pointer;margin-left:4px;" @click.stop="templateStore.deleteCustomTemplate(i)">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </n-icon>
                </template>
              </n-button>
            </div>
            <label class="field" v-if="templateStore.selectedTemplateIndex >= templateStore.BUILTIN_TEMPLATES.length">
              <span class="field-label">模版名称</span>
              <n-input :value="templateStore.allTemplates[templateStore.selectedTemplateIndex]?.name??''" @update:value="(v) => templateStore.updateTemplateName(templateStore.selectedTemplateIndex, v)" size="small" />
            </label>
            <label class="field">
              <span class="field-label">提示词内容{{ templateStore.selectedTemplateIndex < templateStore.BUILTIN_TEMPLATES.length ? ' (内置模版不可编辑)' : '' }}</span>
              <n-input v-model:value="tplPrompt" type="textarea" :rows="6" size="small" :disabled="templateStore.selectedTemplateIndex < templateStore.BUILTIN_TEMPLATES.length" />
            </label>
          </section>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
  </n-config-provider>
</template>

<style>
.app-root { height: 100vh; display: grid; grid-template-columns: var(--sidebar-width) minmax(0, 1fr); background: var(--color-bg); position: relative; }

.side { display: flex; flex-direction: column; min-height: 0; background: var(--color-surface); border-right: 1px solid var(--color-border); z-index: 2; }
.side-brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 16px; cursor: pointer; user-select: none; border-bottom: 1px solid var(--color-border); position: relative; overflow: hidden; }
.side-brand::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(139,62,62,0.04) 0%, transparent 70%); opacity: 0; transition: opacity 0.4s; pointer-events: none; }
.side-brand:hover::after { opacity: 1; }
.logo-mark { position: relative; width: 34px; height: 34px; border-radius: 9px; background: transparent; color: var(--color-brand); display: grid; place-items: center; flex-shrink: 0; box-shadow: var(--brand-glow-soft); transition: box-shadow var(--dur-3) var(--ease-out); }
.side-brand:hover .logo-mark { box-shadow: 0 0 8px rgba(139,62,62,0.5), 0 0 16px rgba(139,62,62,0.2); }
.logo-gear { animation: spin 20s linear infinite; }
.side-brand:hover .logo-gear { animation-duration: 3s; }
.logo-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.brand-name { font-size: 13px; font-weight: 750; letter-spacing: -0.005em; color: var(--color-text); white-space: nowrap; font-family: var(--font-mono); }
.brand-sub { font-size: 10.5px; color: var(--color-text-tertiary); white-space: nowrap; transition: color 0.3s; }
.side-brand:hover .brand-sub { color: var(--color-text-secondary); }

.side-nav { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 0 10px; display: flex; flex-direction: column; gap: 20px; }
.nav-group { display: flex; flex-direction: column; gap: 3px; }
.nav-caption { font-size: 10.5px; font-weight: 600; color: var(--color-text-tertiary); padding: 0 20px 7px; font-family: var(--font-mono); letter-spacing: 0.04em; }
/* ref: mdc-ripple -- bounded ripple needs an overflow:hidden host */
.nav-item { display: flex; align-items: center; gap: 10px; height: 38px; margin: 0 8px; padding: 0 14px; border: none; border-radius: var(--radius-md); background: linear-gradient(90deg, rgba(139,62,62,0.12), rgba(139,62,62,0.04)); background-size: 0% 100%; background-repeat: no-repeat; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; text-align: left; transition: background-size 0.45s cubic-bezier(0.22,0.61,0.36,1), color 0.25s cubic-bezier(0.22,0.61,0.36,1); position: relative; overflow: hidden; }
.nav-item .n-icon { color: var(--color-text-tertiary); flex-shrink: 0; transition: color 0.25s cubic-bezier(0.22,0.61,0.36,1), filter 0.3s ease; }
.nav-item::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2.5px; border-radius: 0 1.5px 1.5px 0; background: transparent; transition: background 0.3s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.3s; }
.nav-item:hover { background-size: 100% 100%; }
.nav-item:hover .n-icon { color: var(--color-text); filter: drop-shadow(0 0 3px rgba(255,255,255,0.15)); }
.nav-item.on { background: rgba(139, 62, 62, 0.06); background-size: auto; color: var(--color-brand); letter-spacing: 0.015em; }
.nav-item.on .n-icon { color: var(--color-brand); filter: drop-shadow(0 0 3px rgba(139,62,62,0.3)); }
.nav-item.on::before { background: var(--color-brand); box-shadow: 0 0 4px rgba(139,62,62,0.5), 0 0 8px rgba(139,62,62,0.2); }
.nav-item.on .nav-label { text-shadow: 0 0 10px rgba(139,62,62,0.12); }
.nav-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-badge { min-width: 20px; height: 18px; padding: 0 6px; border-radius: var(--radius-full); background: var(--color-brand); color: var(--color-text-inverse); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--brand-glow-soft); transition: box-shadow 0.3s; }
.nav-item:hover .nav-badge { box-shadow: 0 0 8px rgba(139,62,62,0.4); }
.nav-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--color-brand); box-shadow: var(--brand-glow); animation: pulse-dot 1.6s var(--ease-out) infinite; flex-shrink: 0; }

.side-foot { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px 10px; border-top: 1px solid var(--color-border); }
.divergence-display { display: flex; align-items: center; gap: 8px; padding: 5px 12px; background: var(--color-surface-muted); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.div-label { font-size: 9px; font-weight: 600; color: var(--color-text-tertiary); letter-spacing: 0.06em; text-transform: uppercase; font-family: var(--font-mono); }
.div-number { font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: var(--color-brand); text-shadow: var(--divergence-glow); letter-spacing: 0.03em; }
.side-user { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border: none; border-radius: var(--radius-md); background: transparent; font-family: inherit; cursor: pointer; text-align: left; transition: background var(--dur-2); }
.side-user:hover { background: var(--color-ink-soft); }
.side-avatar { position: relative; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--color-border); background: var(--color-surface-muted); flex-shrink: 0; transform-style: preserve-3d; perspective: 200px; transition: transform 0.5s var(--ease-out); }
.side-avatar img { width: 100%; height: 100%; object-fit: cover; }
.side-online { position: absolute; right: 0; bottom: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); border: 2px solid var(--color-surface); box-shadow: 0 0 4px rgba(0,204,102,0.4); }
.side-user-meta { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; flex: 1; }
.side-user-name { font-size: 12px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side-user-hint { font-size: 10px; color: var(--color-text-tertiary); white-space: nowrap; font-family: var(--font-mono); letter-spacing: 0.02em; }
.side-user:hover .side-avatar {
  box-shadow: var(--divergence-glow), 0 0 8px rgba(255,140,66,0.12);
}
@keyframes worldline-flicker {
  0%, 100% { opacity: 1; }
  15% { opacity: 0.7; }
  30% { opacity: 1; }
  45% { opacity: 0.85; }
  60% { opacity: 1; }
}
.side-set { width: 30px; height: 30px; border: none; border-radius: var(--radius-md); background: transparent; color: var(--color-text-secondary); display: grid; place-items: center; cursor: pointer; flex-shrink: 0; transition: background var(--dur-2), color var(--dur-2), box-shadow var(--dur-2); }
.side-set:hover { background: var(--color-ink-soft); color: var(--color-brand); box-shadow: var(--brand-glow-soft); }
/* Worldline Toggle — α/β attractor field switch */
.worldline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: border-color var(--dur-2), box-shadow var(--dur-2), background var(--dur-2);
  user-select: none;
  flex-shrink: 0;
}
.worldline-toggle:hover {
  border-color: var(--color-brand-border);
  box-shadow: var(--brand-glow-soft);
}
.wl-field {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  transition: color var(--dur-2), text-shadow var(--dur-2);
  width: 14px;
  text-align: center;
  line-height: 1;
}
.wl-field.on {
  color: var(--color-brand);
  text-shadow: var(--divergence-glow);
}
.wl-track {
  width: 24px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--color-border);
  position: relative;
  transition: background var(--dur-2);
}
.worldline-toggle:hover .wl-track {
  background: var(--color-border-strong);
}
.wl-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-brand);
  box-shadow: var(--brand-glow);
  transition: left var(--dur-3) var(--ease-out), background var(--dur-2);
}
.wl-thumb.right {
  left: 15px;
}

.app-main { min-width: 0; overflow: hidden; display: flex; flex-direction: column; }

/* Nav scanline */
.nav-item.on::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent 5%, rgba(139,62,62,0.6) 20%, rgba(139,62,62,0.6) 80%, transparent 95%); box-shadow: 0 0 4px rgba(139,62,62,0.3); animation: scanline-sweep 2.8s ease-in-out infinite; pointer-events: none; }

/* Queue drawer */
.queue-drawer { display: flex; flex-direction: column; gap: 12px; }
.queue-actions { display: flex; gap: 5px; flex-wrap: nowrap; padding: 2px 0 14px; border-bottom: 1px solid var(--color-border); margin-bottom: 6px; }
/* ref: GitHub Actions sidebar -- compact button group in narrow panels */
.queue-actions .n-button { font-size: 11px !important; padding: 0 8px !important; min-width: unset !important; }
.queue-list { display: flex; flex-direction: column; gap: 8px; }
.queue-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 72px 16px; text-align: center; color: var(--color-text-secondary); animation: empty-enter 0.5s var(--ease-out) both; }
.queue-empty .n-icon { animation: materialize 0.5s var(--spring-snappy) both; }
.queue-full-link { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; padding: 2px 0; transition: color var(--dur-2), text-shadow var(--dur-2); }
.queue-full-link:hover { color: var(--color-brand); text-shadow: var(--divergence-glow); }
.q-item { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 11px 12px 10px 15px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-xs); transition: border-color var(--dur-2), box-shadow var(--dur-2); overflow: hidden; min-width: 0; }
.q-item::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 2px 2px 0; background: transparent; transition: background var(--dur-2), box-shadow var(--dur-2); }
.q-item:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.q-item.running { border-color: var(--color-brand-border); box-shadow: var(--shadow-card); }
.q-item.running::before { background: var(--color-brand); box-shadow: var(--brand-glow-soft); }
.q-item.done { border-color: var(--color-success-border); }
.q-item.done::before { background: var(--color-success); }
.q-item.error { border-color: var(--color-error-border); }
.q-item.error::before { background: var(--color-error); }
.q-item.cancelled { border-color: var(--color-warning-border); }
.q-item.cancelled::before { background: var(--color-warning); }
.q-row1 { display: flex; align-items: center; gap: 10px; min-height: 24px; min-width: 0; width: 100%; }
.q-row2 { padding-left: 28px; }
.q-s { flex-shrink: 0; width: 20px; display: flex; align-items: center; justify-content: center; }
.q-pending-dot { color: var(--color-text-tertiary); }
.q-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-meta { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
.q-dur { font-size: 11px; color: var(--color-text-secondary); font-family: var(--font-mono); }
.q-tag { font-size: 10.5px; font-weight: 600; color: var(--color-text-secondary); padding: 1px 7px; border-radius: var(--radius-full); background: var(--color-ink-soft); font-family: var(--font-mono); }
.q-tag.running { color: var(--color-brand); background: var(--color-brand-soft); }
.q-tag.error { color: var(--color-error); background: var(--color-error-soft); }
.q-tag.cancelled { color: var(--color-warning); background: var(--color-warning-soft); }
.q-elapsed { font-size: 10px; color: var(--color-text-tertiary); font-family: var(--font-mono); }
.q-action { flex-shrink: 0; display: flex; align-items: center; }
.q-bar { width: 100%; height: 4px; background: var(--color-brand-soft); border-radius: var(--radius-full); overflow: hidden; }
.q-fill { height: 100%; background: linear-gradient(90deg, var(--color-brand-pressed), var(--color-brand), var(--color-brand-hover)); border-radius: var(--radius-full); transition: width 0.3s ease; box-shadow: var(--brand-glow-soft); }

/* === Login Terminal — PhoneWave 实验终端 === */
/* ref: Steins;Gate phone-trigger + VN UI + divergence-meter */

.login-terminal {
  display: flex;
  flex-direction: column;
  padding: 8px 4px 24px;
  min-height: 380px;
}

/* --- User Popover (logged-in menu) --- */
.user-popover {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}
.up-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 12px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 4px;
}
.up-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.up-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}
.up-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.up-uid {
  font-size: 11px;
  color: var(--divergence-color);
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}
.up-actions {
  display: flex;
  flex-direction: column;
}
.up-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-2), color var(--dur-2);
}
.up-item:hover {
  background: var(--color-ink-soft);
  color: var(--color-text);
}
.up-item.danger:hover {
  background: var(--color-error-soft);
  color: var(--color-error);
}
.up-item .n-icon {
  flex-shrink: 0;
  color: inherit;
}

/* --- QR Chamber (PhoneWave) --- */
.qr-chamber {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}
.qr-chamber::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid var(--color-brand-border);
  pointer-events: none;
  z-index: 2;
}
.chamber-scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(139,62,62,0.3), transparent);
  animation: scanline-sweep 2.8s ease-in-out infinite;
  z-index: 3;
  pointer-events: none;
}
.chamber-body {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--color-surface-muted);
}
.qr-code-img {
  width: 200px;
  height: 200px;
  display: block;
}
.chamber-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  z-index: 4;
  background: var(--color-surface);
}
.chamber-overlay.success {
  background: var(--color-surface);
}

/* --- Pipeline Status (Divergence Meter style) --- */
.pipeline {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 20px;
  padding: 0 12px;
}
.pipeline-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.stage-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-strong);
  transition: background var(--dur-3), box-shadow var(--dur-3);
}
.pipeline-stage.active .stage-dot {
  background: var(--divergence-color);
  box-shadow: var(--divergence-glow);
  animation: pulse-dot 1.6s var(--ease-out) infinite;
}
.pipeline-stage.done .stage-dot {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(29,237,63,0.4);
}
.stage-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  white-space: nowrap;
  transition: color var(--dur-2);
}
.pipeline-stage.active .stage-label {
  color: var(--divergence-color);
}
.pipeline-stage.done .stage-label {
  color: var(--color-success);
}
.pipeline-connector {
  width: 20px;
  height: 1px;
  background: var(--color-border);
  flex-shrink: 0;
  margin-bottom: 16px;
  transition: background var(--dur-3), box-shadow var(--dur-3);
}
.pipeline-connector.active {
  background: var(--divergence-color);
  box-shadow: var(--divergence-glow);
}

/* --- QR Status Message --- */
.qr-status-msg {
  margin-top: 14px;
  text-align: center;
}

/* --- SMS Section (Backup Protocol) --- */
.sms-section {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.sms-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 0.03em;
}

/* --- Tab content spacing --- */
.tab-content {
  padding: 20px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* --- Fix: disable tab-pane animation in login drawer to prevent residue --- */
.login-terminal .n-tab-pane {
  animation: none !important;
}



.settings-body { display: flex; flex-direction: column; gap: 14px; padding-bottom: 12px; }
.settings-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-xs); transition: border-color var(--dur-2); }
.settings-section:hover { border-color: var(--color-border-strong); }
.settings-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.settings-section-title { font-size: 11px; font-weight: 700; color: var(--color-text-secondary); font-family: var(--font-mono); letter-spacing: 0.03em; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; color: var(--color-text-secondary); }
.field-row { display: flex; gap: 8px; align-items: center; }
.field-grow { flex: 1; min-width: 0; }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.settings-row-text { display: flex; flex-direction: column; gap: 2px; }
.settings-hint { font-size: 11px; color: var(--color-text-tertiary); }
.tpl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
/* === View Transition — theme switch crossfade === */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) {
  animation: vt-fade-out 0.35s var(--ease-out) both;
}
::view-transition-new(root) {
  animation: vt-fade-in 0.35s var(--ease-out) both;
}
@keyframes vt-fade-out {
  to { opacity: 0; }
}
@keyframes vt-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Smooth color transitions for theme switch — VS Code pattern (ref: VS Code) */
html[data-theme] *,
html[data-theme] *::before,
html[data-theme] *::after {
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s ease;
}


/* --- Light theme chamber overlay --- */
[data-theme="light"] .chamber-overlay {
  /* inherits surface color from theme */
}

</style>
