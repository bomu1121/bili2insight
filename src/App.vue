<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NText, NIcon, NTabs, NTabPane, createDiscreteApi, NDrawer, NDrawerContent, NSelect, NConfigProvider, type GlobalThemeOverrides } from "naive-ui";
import { SettingsSharp, ListOutline, PlayOutline, TrashOutline, EyeOutline, CheckmarkCircle, CloseCircle, SyncOutline, PersonCircleOutline, LogOutOutline, RefreshOutline, PhonePortraitOutline, QrCodeOutline, ArrowForward, CopyOutline, LinkOutline, FolderOpenOutline, CloudUploadOutline, TimeOutline } from "@vicons/ionicons5";
import { useRoute, useRouter } from "vue-router";
import { useAppStore } from "./stores/app";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settingsStore";
import { useTemplateStore } from "./stores/templates";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const templateStore = useTemplateStore();
const router = useRouter();
const route = useRoute();
const showSettings = ref(false);
const showQueue = ref(false);
const qrTab = ref("qr");

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#00AEEC",
    primaryColorHover: "#00A1DB",
    primaryColorPressed: "#0090C4",
    primaryColorSuppl: "#00AEEC",
    infoColor: "#2080F0",
    successColor: "#18A058",
    warningColor: "#F0A020",
    errorColor: "#D03050",
    borderRadius: "6px",
    borderColor: "#E5E7EB",
    textColorBase: "#1D2129",
    textColor2: "#6B7280",
    textColor3: "#9CA3AF",
    bodyColor: "#F4F5F7",
    cardColor: "#FFFFFF",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Button: {
    borderRadiusMedium: "6px",
    borderRadiusSmall: "6px",
    borderRadiusTiny: "6px",
    fontWeight: "500",
  },
  Input: {
    borderRadius: "6px",
  },
  Card: {
    borderRadius: "12px",
  },
  Checkbox: {
    borderRadius: "4px",
  },
};

onMounted(async () => { await store.init(); });
onUnmounted(() => store.cleanup());
watch(() => store.error, (val) => { if (val) message.error(val); });

const isQueueRoute = computed(() => route.path === "/queue" || route.path.startsWith("/result"));

function viewResult(id: string) { showQueue.value = false; router.push(`/result/${id}`); }
function openQueuePage() { showQueue.value = false; router.push("/queue"); }
function startProcessing() { store.processQueue(); }
function clearDone() { store.queue = store.queue.filter(q => q.status !== "done" && q.status !== "error"); }
function stopProcessing() { store.cancelQueue(); }
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
  <n-config-provider :theme-overrides="themeOverrides">
  <div class="app-root">
    <aside class="side">
      <div class="side-brand" @click="router.push('/')" title="返回首页">
        <div class="logo-mark">B2</div>
        <div class="logo-text">
          <span class="brand-name">Bili2Insight</span>
          <span class="brand-sub">AI 观点笔记</span>
        </div>
      </div>

      <nav class="side-nav">
        <div class="nav-group">
          <div class="nav-caption">来源</div>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/url' }" @click="router.push('/source/url')">
            <n-icon :size="17"><LinkOutline /></n-icon>
            <span class="nav-label">B站链接</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/fav' }" @click="router.push('/source/fav')">
            <n-icon :size="17"><FolderOpenOutline /></n-icon>
            <span class="nav-label">收藏夹</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/source/local' }" @click="router.push('/source/local')">
            <n-icon :size="17"><CloudUploadOutline /></n-icon>
            <span class="nav-label">本地文件</span>
          </button>
        </div>
        <div class="nav-group">
          <div class="nav-caption">工作台</div>
          <button type="button" class="nav-item" :class="{ on: isQueueRoute }" @click="showQueue = true">
            <n-icon :size="17"><ListOutline /></n-icon>
            <span class="nav-label">处理队列</span>
            <span v-if="store.isProcessing" class="nav-pulse" title="正在处理" />
            <span v-if="store.queueCount > 0" class="nav-badge tnum">{{ store.queueCount }}</span>
          </button>
          <button type="button" class="nav-item" :class="{ on: route.path === '/history' }" @click="router.push('/history')">
            <n-icon :size="17"><TimeOutline /></n-icon>
            <span class="nav-label">历史记录</span>
          </button>
        </div>
      </nav>

      <div class="side-foot">
        <button
          type="button"
          class="side-user"
          @click="openLogin"
          :title="authStore.isLoggedIn ? authStore.loginUname : '登录 B 站账号'"
        >
          <span class="side-avatar">
            <img v-if="authStore.isLoggedIn && authStore.loginFace" :src="authStore.loginFace" referrerpolicy="no-referrer" />
            <n-icon v-else :size="18" color="var(--color-text-secondary)"><PersonCircleOutline /></n-icon>
            <span v-if="authStore.isLoggedIn" class="side-online" />
          </span>
          <span class="side-user-meta">
            <span class="side-user-name">{{ authStore.isLoggedIn ? authStore.loginUname : "未登录" }}</span>
            <span class="side-user-hint">{{ authStore.isLoggedIn ? "B站账号" : "点击登录 B 站" }}</span>
          </span>
        </button>
        <button type="button" class="side-set" @click="showSettings = true" title="设置">
          <n-icon :size="17"><SettingsSharp /></n-icon>
        </button>
      </div>
    </aside>

    <main class="app-main">
      <router-view />
    </main>

    <!-- Queue Drawer -->
    <n-drawer v-model:show="showQueue" width="420" placement="right">
      <n-drawer-content title="处理队列" closable>
        <div class="queue-drawer" v-if="store.queue.length > 0">
          <div class="queue-actions">
            <n-button size="small" type="primary" @click="startProcessing" :disabled="store.isProcessing || store.queue.filter(q=>q.status==='pending').length===0">
              <template #icon><n-icon><PlayOutline /></n-icon></template>开始处理
            </n-button>
            <n-button v-if="store.isProcessing" size="small" type="warning" @click="stopProcessing">
              <template #icon><n-icon><CloseCircle /></n-icon></template>停止
            </n-button>
            <n-button size="small" @click="clearDone" :disabled="store.queue.filter(q=>q.status==='done'||q.status==='error').length===0">
              <template #icon><n-icon><TrashOutline /></n-icon></template>清除已完成
            </n-button>
            <n-button size="small" @click="copyAllTitles" :disabled="store.queue.length===0">
              <template #icon><n-icon><CopyOutline /></n-icon></template>复制标题
            </n-button>
          </div>
          <div class="queue-list">
            <div v-for="item in store.queue" :key="item.id" class="q-item" :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }">
              <div class="q-row1">
                <span class="q-s">
                  <n-icon v-if="item.status === 'done'" color="var(--color-success)" size="16"><CheckmarkCircle /></n-icon>
                  <n-icon v-else-if="item.status === 'error'" color="var(--color-error)" size="16"><CloseCircle /></n-icon>
                  <n-icon v-else-if="item.status === 'running'" color="var(--color-brand)" size="16" class="spinning"><SyncOutline /></n-icon>
                  <span v-else class="q-pending-dot">&#9679;</span>
                </span>
                <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
                <div class="q-meta">
                  <span class="q-dur tnum">{{ (item.pageInfo.duration ? String(Math.floor(item.pageInfo.duration/60)).padStart(2,'0') + ':' + String(item.pageInfo.duration%60).padStart(2,'0') : '') }}</span>
                  <span v-if="item.status !== 'done'" class="q-tag" :class="item.status">
                    {{ item.status === 'error' ? '失败' : item.status === 'running' ? item.stageLabel : '等待' }}
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
                  <n-button v-if="item.status === 'done'" size="tiny" text @click="viewResult(item.id)" style="padding:0 4px;">
                    <template #icon><n-icon size="16"><EyeOutline /></n-icon></template>
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
          <n-icon :size="40" color="var(--color-text-tertiary)"><ListOutline /></n-icon>
          <span>队列为空</span>
          <span class="queue-empty-hint">返回首页添加视频后在此处理</span>
        </n-text>
        <template #footer>
          <button type="button" class="queue-full-link" @click="openQueuePage">
            打开完整队列页
            <n-icon :size="14"><ArrowForward /></n-icon>
          </button>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- Login Drawer -->
    <n-drawer :show="authStore.showLogin" @update:show="(v) => { if (!v) authStore.cancelLogin(); }" width="400">
      <n-drawer-content title="B站登录" closable>
        <!-- Logged-in state -->
        <div class="login-body" v-if="authStore.isLoggedIn">
          <div class="login-success">
            <img v-if="authStore.loginFace" :src="authStore.loginFace" class="login-avatar-lg" referrerpolicy="no-referrer" />
            <n-icon v-else size="64" color="var(--color-brand)"><PersonCircleOutline /></n-icon>
            <n-text strong class="login-uname">{{ authStore.loginUname }}</n-text>
            <n-text depth="3" class="login-uid">UID: {{ authStore.loginUid }}</n-text>
            <n-button type="error" size="small" @click="authStore.doLogout()" style="margin-top:18px;">
              <template #icon><n-icon><LogOutOutline /></n-icon></template>退出登录
            </n-button>
          </div>
        </div>

        <!-- Login tabs: QR + SMS -->
        <div v-else>
          <n-tabs v-model:value="qrTab" type="line" size="medium" animated>
            <n-tab-pane name="qr" tab="扫码登录">
              <template #tab>
                <n-icon size="18"><QrCodeOutline /></n-icon>
                <span style="margin-left:6px;">扫码登录</span>
              </template>
              <div class="tab-content">
                <div class="qr-section">
                  <div class="qr-code-wrap">
                    <img v-if="authStore.qrUrl" :src="'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(authStore.qrUrl)" class="qr-code-img" referrerpolicy="no-referrer" />
                    <div v-if="authStore.qrStatus === 'expired'" class="qr-overlay" @click="refreshLogin">
                      <n-icon size="28"><RefreshOutline /></n-icon>
                      <n-text depth="3">二维码已过期，点击刷新</n-text>
                    </div>
                    <div v-if="authStore.qrStatus === 'success'" class="qr-overlay success">
                      <n-icon size="32" color="var(--color-success)"><CheckmarkCircle /></n-icon>
                      <n-text class="login-ok-text">登录成功</n-text>
                    </div>
                  </div>
                  <div class="qr-status" v-if="authStore.qrStatusMessage">
                    <n-text depth="3" style="font-size:13px;">{{ authStore.qrStatusMessage }}</n-text>
                  </div>
                </div>
                <n-text v-if="authStore.loginError" depth="3" type="error" style="font-size:11px;text-align:center;display:block;margin-top:10px;">{{ authStore.loginError }}</n-text>
              </div>
            </n-tab-pane>

            <n-tab-pane name="sms" tab="短信登录">
              <template #tab>
                <n-icon size="18"><PhonePortraitOutline /></n-icon>
                <span style="margin-left:6px;">短信登录</span>
              </template>
              <div class="tab-content">
                <div class="sms-section">
                  <n-input v-model:value="smsPhone" placeholder="手机号" size="large" style="width:100%;" />
                  <n-space style="width:100%;margin-top:12px;" :size="8">
                    <n-input v-model:value="smsCode" placeholder="短信验证码" size="large" style="flex:1;" />
                    <n-button type="primary" @click="doSendSms" :disabled="smsSending || smsCountdown > 0" :loading="smsSending" style="flex-shrink:0;">
                      {{ smsCountdown > 0 ? smsCountdown + 's' : smsSent ? '重新获取' : '获取验证码' }}
                    </n-button>
                  </n-space>
                  <n-button type="primary" block @click="message.info('短信登录需要验证码，即将开发')" style="margin-top:16px;">
                    <template #icon><n-icon><ArrowForward /></n-icon></template>登录
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
/* ===== 外壳：侧边栏 + 内容 ===== */
.app-root {
  height: 100vh;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  background: var(--color-bg);
}
.side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  z-index: 2;
}
.side-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 14px;
  cursor: pointer;
  user-select: none;
}
.logo-mark {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(150deg, #22262e, var(--color-ink) 60%);
  color: #fff;
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: -0.04em;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(22, 24, 29, 0.22);
}
.logo-mark::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-brand);
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
}
.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
  white-space: nowrap;
}
.brand-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.side-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-caption {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  padding: 0 22px 6px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  margin: 0 10px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-1), color var(--dur-1);
}
.nav-item .n-icon {
  color: var(--color-text-tertiary);
  transition: color var(--dur-1);
  flex-shrink: 0;
}
.nav-item:hover {
  background: var(--color-ink-soft);
  color: var(--color-text);
}
.nav-item:hover .n-icon {
  color: var(--color-text);
}
.nav-item.on {
  background: var(--color-ink);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(22, 24, 29, 0.18);
}
.nav-item.on .n-icon {
  color: #fff;
}
.nav-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-badge {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--color-brand);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nav-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-brand);
  animation: pulse-dot 1.2s var(--ease-out) infinite;
  flex-shrink: 0;
}

.side-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--color-border);
}
.side-user {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-1);
}
.side-user:hover {
  background: var(--color-ink-soft);
}
.side-avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  flex-shrink: 0;
}
.side-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.side-online {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-success);
  border: 2px solid #fff;
}
.side-user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}
.side-user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.side-user-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}
.side-set {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur-1), color var(--dur-1);
}
.side-set:hover {
  background: var(--color-ink-soft);
  color: var(--color-text);
}

.app-main {
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ===== 队列抽屉 ===== */
.queue-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.queue-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 2px;
}
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 72px 16px;
  text-align: center;
  color: var(--color-text-secondary);
}
.queue-empty-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.queue-full-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 2px 0;
  transition: color var(--dur-1);
}
.queue-full-link:hover {
  color: var(--color-brand);
}
.q-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 11px 12px 10px 15px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--dur-1), box-shadow var(--dur-1);
  overflow: hidden;
  min-width: 0;
}
.q-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: transparent;
}
.q-item:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}
.q-item.running {
  border-color: var(--color-brand-border);
}
.q-item.running::before {
  background: var(--color-brand);
}
.q-item.done {
  border-color: var(--color-success-border);
}
.q-item.done::before {
  background: var(--color-success);
}
.q-item.error {
  border-color: var(--color-error-border);
}
.q-item.error::before {
  background: var(--color-error);
}
.q-row1 {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  min-width: 0;
  width: 100%;
}
.q-row2 {
  padding-left: 28px;
}
.q-s {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.q-pending-dot {
  color: var(--color-text-tertiary);
  font-size: 14px;
}
.q-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.q-meta {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.q-dur {
  font-size: 11px;
  color: var(--color-text-secondary);
}
.q-tag {
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-ink-soft);
}
.q-tag.running {
  color: var(--color-brand-pressed);
  background: var(--color-brand-soft);
}
.q-tag.error {
  color: var(--color-error);
  background: var(--color-error-soft);
}
.q-elapsed {
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.q-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.q-tpl-select {
  width: 72px;
}
.q-tpl-select .n-base-selection {
  --n-height: 24px;
  font-size: 11px;
}
.q-tpl-select .n-base-selection-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.q-bar {
  height: 4px;
  background: var(--color-brand-soft);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.q-fill {
  height: 100%;
  background: var(--color-brand);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

/* ===== 登录抽屉 ===== */
.login-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 0;
  gap: 16px;
}
.login-success {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.login-uname {
  font-size: 17px;
  margin-top: 14px;
}
.login-uid {
  font-size: 13px;
  margin-top: 4px;
}
.login-ok-text {
  color: var(--color-success);
}
.login-avatar-lg {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid var(--color-brand-soft);
  box-shadow: 0 8px 20px rgba(0, 174, 236, 0.18);
}
.tab-content {
  padding: 20px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.qr-code-wrap {
  width: 208px;
  height: 208px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
}
.qr-code-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qr-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}
.qr-overlay.success {
  cursor: default;
}
.qr-status {
  padding: 5px 12px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
}
.sms-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 300px;
}

/* ===== 设置抽屉 ===== */
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 12px;
}
.settings-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-xs);
}
.settings-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.settings-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.field-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.field-grow {
  flex: 1;
  min-width: 0;
}
.tpl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
