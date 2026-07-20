<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NText, NIcon, NTabs, NTabPane, createDiscreteApi, NDrawer, NDrawerContent, NSelect, NConfigProvider, type GlobalThemeOverrides } from "naive-ui";
import { SettingsSharp, ListOutline, PlayOutline, TrashOutline, EyeOutline, CheckmarkCircle, CloseCircle, SyncOutline, PersonCircleOutline, LogOutOutline, RefreshOutline, PhonePortraitOutline, QrCodeOutline, ArrowForward, CopyOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "./stores/app";
import { useAuthStore } from "./stores/auth";

import { useTemplateStore } from "./stores/templates";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const authStore = useAuthStore();

const templateStore = useTemplateStore();
const router = useRouter();
const showSettings = ref(false);
const showQueue = ref(false);
const qrTab = ref("qr");

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#00AEEC",
    primaryColorHover: "#0099D3",
    primaryColorPressed: "#0088BC",
    primaryColorSuppl: "#00AEEC",
    infoColor: "#2080F0",
    successColor: "#18A058",
    warningColor: "#F0A020",
    errorColor: "#D03050",
    borderRadius: "6px",
    borderColor: "#E8EAED",
    textColorBase: "#1A1A1A",
    textColor2: "#8A8F98",
    textColor3: "#B0B4BC",
    bodyColor: "#F5F7FA",
    cardColor: "#FFFFFF",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Button: {
    borderRadiusMedium: "6px",
    borderRadiusSmall: "6px",
    borderRadiusTiny: "6px",
  },
  Input: {
    borderRadius: "6px",
  },
  Card: {
    borderRadius: "10px",
  },
};

onMounted(async () => { await store.init(); });
onUnmounted(() => store.cleanup());
watch(() => store.error, (val) => { if (val) message.error(val); });

function viewResult(id: string) { showQueue.value = false; router.push(`/result/${id}`); }
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
    <header class="app-header">
      <div class="header-left" @click="router.push('/')" title="返回首页">
        <div class="logo-mark">B2</div>
        <div class="logo-text">
          <span class="header-title">Bili2Insight</span>
          <span class="header-sub">观点提炼</span>
        </div>
      </div>
      <div class="header-right">
        <button type="button" class="hdr-btn" @click="showQueue = true">
          <n-icon :size="18"><ListOutline /></n-icon>
          <span>队列</span>
          <span v-if="store.queueCount > 0" class="hdr-badge">{{ store.queueCount }}</span>
        </button>
        <button
          type="button"
          class="hdr-avatar"
          @click="openLogin"
          :title="authStore.isLoggedIn ? authStore.loginUname : '登录'"
        >
          <img v-if="authStore.isLoggedIn && authStore.loginFace" :src="authStore.loginFace" class="hdr-avatar-img" referrerpolicy="no-referrer" />
          <n-icon v-else :size="22" color="var(--color-text-secondary)"><PersonCircleOutline /></n-icon>
          <span v-if="authStore.isLoggedIn" class="hdr-online" />
        </button>
        <button type="button" class="hdr-btn icon-only" @click="showSettings = true" title="设置">
          <n-icon :size="18"><SettingsSharp /></n-icon>
        </button>
      </div>
    </header>

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
                  <n-icon v-else-if="item.status === 'running'" color="var(--color-info)" size="16" class="spinning"><SyncOutline /></n-icon>
                  <span v-else class="q-pending-dot">&#9679;</span>
                </span>
                <span class="q-title" :title="item.pageInfo.part">{{ item.pageInfo.part }}</span>
                <div class="q-meta">
                  <span class="q-dur">{{ (item.pageInfo.duration ? String(Math.floor(item.pageInfo.duration/60)).padStart(2,'0') + ':' + String(item.pageInfo.duration%60).padStart(2,'0') : '') }}</span>
                  <span v-if="item.status !== 'done'" class="q-tag" :class="item.status">
                    {{ item.status === 'error' ? '失败' : item.status === 'running' ? item.stageLabel : '等待' }}
                  </span>
                  <span class="q-elapsed">{{ item.elapsedMs ? fmtElapsed(item.elapsedMs) : '' }}</span>
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
              <n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" />
            </label>
          </section>

          <section class="settings-section">
            <div class="settings-section-title">AI 模型</div>
            <label class="field">
              <span class="field-label">AI 提供商</span>
              <n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p,i)=>({label:p.name,value:i}))" size="small" @update:value="(i) => store.switchProvider(i)" />
            </label>
            <label class="field">
              <span class="field-label">API 地址</span>
              <n-input v-model:value="store.aiApiUrl" size="small" />
            </label>
            <label class="field">
              <span class="field-label">API 密钥</span>
              <div class="field-row">
                <n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" class="field-grow" />
                <n-button size="small" @click="store.fetchModelList()">测试连接 &amp; 拉取模型</n-button>
              </div>
            </label>
            <label class="field" v-if="store.customModels.length>0||store.PROVIDERS[store.selectedProvider].models.length>0">
              <span class="field-label">模型</span>
              <n-select v-model:value="store.aiModel" :options="(store.customModels.length>0?store.customModels:store.PROVIDERS[store.selectedProvider].models).map(m=>({label:m,value:m}))" size="small" />
            </label>
            <label class="field" v-else>
              <span class="field-label">模型</span>
              <n-input v-model:value="store.aiModel" size="small" />
            </label>
          </section>

          <section class="settings-section">
            <div class="settings-section-title">语音识别</div>
            <label class="field">
              <span class="field-label">ASR 语音识别模型</span>
              <n-select v-model:value="store.asrModel" :options="[{label:'Paraformer (本地)',value:'paraformer'},{label:'MiMo-V2.5 (API)',value:'mimo'}]" size="small" />
            </label>
            <label class="field" v-if="store.asrModel === 'mimo'">
              <span class="field-label">ASR API 地址</span>
              <n-input v-model:value="store.asrApiUrl" placeholder="https://api.xiaomimimo.com/v1/chat/completions" size="small" />
            </label>
            <label class="field" v-if="store.asrModel === 'mimo'">
              <span class="field-label">ASR API 密钥 (可选)</span>
              <n-input v-model:value="store.asrApiKey" type="password" placeholder="可选，默认不传递" size="small" show-password-on="click" />
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
.app-root {
  height: 100vh;
  display: grid;
  grid-template-rows: var(--header-height) 1fr;
  background: var(--color-bg);
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px 0 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border);
  z-index: 2;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  border-radius: 10px;
  padding: 4px 6px 4px 4px;
  transition: background 0.15s;
}
.header-left:hover {
  background: var(--color-bg);
}
.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(145deg, var(--color-brand), #0088c9);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.04em;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 12px rgba(0, 174, 236, 0.28);
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}
.header-sub {
  font-size: 11px;
  color: var(--color-text-secondary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-main {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.hdr-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
}
.hdr-btn:hover {
  border-color: rgba(0, 174, 236, 0.35);
  color: var(--color-brand);
  background: var(--color-brand-soft);
}
.hdr-btn.icon-only {
  width: 34px;
  padding: 0;
  justify-content: center;
}
.hdr-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-error);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.hdr-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  cursor: pointer;
  overflow: hidden;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  padding: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hdr-avatar:hover {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px rgba(0, 174, 236, 0.12);
}
.hdr-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hdr-online {
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  border: 1.5px solid #fff;
}

.queue-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.queue-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 4px;
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
.q-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 10px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
  overflow: hidden;
  min-width: 0;
}
.q-item:hover {
  border-color: var(--color-border-strong);
}
.q-item.running {
  background: var(--color-info-soft);
  border-color: var(--color-info-border);
}
.q-item.done {
  background: var(--color-success-soft);
  border-color: var(--color-success-border);
}
.q-item.error {
  background: var(--color-error-soft);
  border-color: var(--color-error-border);
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
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.04);
}
.q-tag.running {
  color: var(--color-info);
  background: rgba(32, 128, 240, 0.1);
}
.q-tag.error {
  color: var(--color-error);
  background: rgba(208, 48, 80, 0.1);
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
  background: rgba(32, 128, 240, 0.15);
  border-radius: 999px;
  overflow: hidden;
}
.q-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b9eff, var(--color-info));
  border-radius: 999px;
  transition: width 0.3s ease;
}

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
  border-radius: 999px;
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
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
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
  padding: 6px 12px;
  background: var(--color-bg);
  border-radius: 999px;
  border: 1px solid var(--color-border);
}
.sms-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 300px;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 12px;
}
.settings-section {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
  text-transform: none;
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



