<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NText, NIcon, NTabs, NTabPane, createDiscreteApi, NDrawer, NDrawerContent, NSelect } from "naive-ui";
import { SettingsSharp, VideocamOutline, ListOutline, PlayOutline, TrashOutline, EyeOutline, CheckmarkCircle, CloseCircle, SyncOutline, PersonCircleOutline, LogOutOutline, RefreshOutline, PhonePortraitOutline, QrCodeOutline, ArrowForward } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "./stores/app";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const router = useRouter();
const showSettings = ref(false);
const showQueue = ref(false);
const qrTab = ref("qr");

onMounted(async () => { await store.init(); });
onUnmounted(() => store.cleanup());
watch(() => store.error, (val) => { if (val) message.error(val); });

function viewResult(id: string) { showQueue.value = false; router.push(`/result/${id}`); }
function startProcessing() { store.processQueue(); }
function clearDone() { store.queue = store.queue.filter(q => q.status !== "done" && q.status !== "error"); }

// SMS state
const smsPhone = ref("");
const smsCode = ref("");
const smsSending = ref(false);
const smsSent = ref(false);
const smsCountdown = ref(0);

function openLogin() {
  if (store.isLoggedIn) { store.showLogin = true; return; }
  store.startLogin();
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

function refreshLogin() { store.cancelLogin(); store.startLogin(); }

const tplPrompt = computed({
  get: () => {
    const idx = store.selectedTemplateIndex;
    if (idx < store.BUILTIN_TEMPLATES.length) return store.BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - store.BUILTIN_TEMPLATES.length;
    return store.customTemplates[ci]?.prompt ?? "";
  },
  set: (val: string) => {
    const idx = store.selectedTemplateIndex;
    if (idx < store.BUILTIN_TEMPLATES.length) return;
    store.updateTemplatePrompt(idx, val);
  }
});
</script>

<template>
  <div class="app-root">
    <header class="app-header">
      <div class="header-left">
        <n-icon size="24" color="#00aeec"><VideocamOutline /></n-icon>
        <n-text strong style="font-size:18px;">Bili2Insight</n-text>
      </div>
      <n-space :size="8">
        <n-button text @click="showQueue = true" style="position:relative;">
          <template #icon><n-icon><ListOutline /></n-icon></template>队列
          <span v-if="store.queueCount > 0" class="hdr-badge">{{ store.queueCount }}</span>
        </n-button>
        <div class="hdr-avatar" @click="openLogin" :title="store.isLoggedIn ? store.loginUname : '登录'">
          <img v-if="store.isLoggedIn && store.loginFace" :src="store.loginFace" class="hdr-avatar-img" referrerpolicy="no-referrer" />
          <n-icon v-else :color="store.isLoggedIn ? '#18a058' : '#999'" size="22"><PersonCircleOutline /></n-icon>
        </div>
        <n-button text @click="showSettings=true"><template #icon><n-icon><SettingsSharp /></n-icon></template>设置</n-button>
      </n-space>
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
            <n-button size="small" @click="clearDone" :disabled="store.queue.filter(q=>q.status==='done'||q.status==='error').length===0">
              <template #icon><n-icon><TrashOutline /></n-icon></template>清除已完成
            </n-button>
          </div>
          <div class="queue-list">
            <div v-for="item in store.queue" :key="item.id" class="q-item" :class="{ running: item.status === 'running', done: item.status === 'done', error: item.status === 'error' }">
              <span class="q-s">
                <n-icon v-if="item.status === 'done'" color="#18a058" size="16"><CheckmarkCircle /></n-icon>
                <n-icon v-else-if="item.status === 'error'" color="#d03050" size="16"><CloseCircle /></n-icon>
                <n-icon v-else-if="item.status === 'running'" color="#2080f0" size="16" class="spinning"><SyncOutline /></n-icon>
                <span v-else style="color:#ccc;font-size:14px;">&#9679;</span>
              </span>
              <div class="q-info">
                <n-text style="font-size:13px;">{{ item.pageInfo.part }}</n-text>
                <n-text depth="3" style="font-size:11px;">P{{ item.pageInfo.page }} &middot; {{ item.status === 'done' ? '完成' : item.status === 'error' ? '失败' : item.status === 'running' ? item.stageLabel : '等待中' }}</n-text>
                <div class="q-bar" v-if="item.status === 'running'"><div class="q-fill" :style="{ width: Math.round(item.progress*100)+'%' }"></div></div>
              </div>
              <n-button v-if="item.status === 'done'" size="tiny" text @click="viewResult(item.id)">
                <template #icon><n-icon size="16"><EyeOutline /></n-icon></template>
              </n-button>
            </div>
          </div>
        </div>
        <n-text depth="3" v-else style="display:block;text-align:center;padding:60px 0;">队列为空，返回首页添加视频</n-text>
      </n-drawer-content>
    </n-drawer>

    <!-- Login Drawer -->
    <n-drawer :show="store.showLogin" @update:show="(v) => { if (!v) store.cancelLogin(); }" width="400">
      <n-drawer-content title="B站登录" closable>
        <!-- Logged-in state -->
        <div class="login-body" v-if="store.isLoggedIn">
          <div class="login-success">
            <img v-if="store.loginFace" :src="store.loginFace" class="login-avatar-lg" referrerpolicy="no-referrer" />
            <n-icon v-else size="64" color="#00aeec"><PersonCircleOutline /></n-icon>
            <n-text strong style="font-size:17px;margin-top:12px;">{{ store.loginUname }}</n-text>
            <n-text depth="3" style="font-size:13px;">UID: {{ store.loginUid }}</n-text>
            <n-button type="error" size="small" @click="store.doLogout()" style="margin-top:18px;">
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
                    <img v-if="store.qrUrl" :src="'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(store.qrUrl)" class="qr-code-img" referrerpolicy="no-referrer" />
                    <div v-if="store.qrStatus === 'expired'" class="qr-overlay" @click="refreshLogin">
                      <n-icon size="28"><RefreshOutline /></n-icon>
                      <n-text depth="3">二维码已过期，点击刷新</n-text>
                    </div>
                    <div v-if="store.qrStatus === 'success'" class="qr-overlay success">
                      <n-icon size="32" color="#18a058"><CheckmarkCircle /></n-icon>
                      <n-text style="color:#18a058;">登录成功</n-text>
                    </div>
                  </div>
                  <div class="qr-status" v-if="store.qrStatusMessage">
                    <n-text depth="3" style="font-size:13px;">{{ store.qrStatusMessage }}</n-text>
                  </div>
                </div>
                <n-text v-if="store.loginError" depth="3" type="error" style="font-size:11px;text-align:center;display:block;margin-top:10px;">{{ store.loginError }}</n-text>
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
    <n-drawer v-model:show="showSettings" width="440"><n-drawer-content title="设置" closable><n-space vertical style="gap:16px;">
      <div><n-text depth="3" style="font-size:12px;">HTTP 代理</n-text><n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" /></div>
      <div><n-text depth="3" style="font-size:12px;">AI 提供商</n-text><n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p,i)=>({label:p.name,value:i}))" size="small" @update:value="(i) => store.switchProvider(i)" /></div>
      <div><n-text depth="3" style="font-size:12px;">API 地址</n-text><n-input v-model:value="store.aiApiUrl" size="small" /></div>
      <div>
        <n-text depth="3" style="font-size:12px;">API 密钥</n-text>
        <n-space :size="6" style="margin-top:4px;flex-wrap:nowrap;">
          <n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" style="flex:1;min-width:0;" />
          <n-button size="small" @click="store.fetchModelList()" style="flex-shrink:0;white-space:nowrap;">测试连接 &amp; 拉取模型</n-button>
        </n-space>
      </div>
      <div v-if="store.customModels.length>0||store.PROVIDERS[store.selectedProvider].models.length>0">
        <n-text depth="3" style="font-size:12px;">模型</n-text><n-select v-model:value="store.aiModel" :options="(store.customModels.length>0?store.customModels:store.PROVIDERS[store.selectedProvider].models).map(m=>({label:m,value:m}))" size="small" />
      </div>
      <div v-else><n-text depth="3" style="font-size:12px;">模型</n-text><n-input v-model:value="store.aiModel" size="small" /></div>
      <div>
        <n-text depth="3" style="font-size:12px;">ASR 语音识别模型</n-text>
        <n-select v-model:value="store.asrModel" :options="[{label:'Paraformer (本地)',value:'paraformer'},{label:'MiMo-V2.5 (API)',value:'mimo'}]" size="small" style="margin-top:4px;" />
      </div>
      <div v-if="store.asrModel === 'mimo'">
        <n-text depth="3" style="font-size:12px;">ASR API 地址</n-text>
        <n-input v-model:value="store.asrApiUrl" placeholder="https://api.xiaomimimo.com/v1/chat/completions" size="small" style="margin-top:4px;" />
      </div>
      <div v-if="store.asrModel === 'mimo'">
        <n-text depth="3" style="font-size:12px;">ASR API 密钥 (可选)</n-text>
        <n-input v-model:value="store.asrApiKey" type="password" placeholder="可选，默认不传递" size="small" show-password-on="click" style="margin-top:4px;" />
      </div>
      <div>
        <n-space justify="space-between" align="center"><n-text depth="3" style="font-size:12px;">提示词模版</n-text><n-button size="tiny" @click="store.addCustomTemplate()">+ 新增</n-button></n-space>
        <n-space style="margin-top:4px;flex-wrap:wrap;" :size="4">
          <n-button v-for="(t, i) in store.allTemplates" :key="i" :type="store.selectedTemplateIndex===i ? 'primary' : 'default'" size="tiny" @click="store.selectTemplate(i)" :title="t.name">{{ t.name }}
            <template v-if="i >= store.BUILTIN_TEMPLATES.length" #icon><n-icon size="14" style="cursor:pointer;margin-left:4px;" @click.stop="store.deleteCustomTemplate(i)"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></n-icon></template>
          </n-button>
        </n-space>
      </div>
      <div v-if="store.selectedTemplateIndex >= store.BUILTIN_TEMPLATES.length">
        <n-text depth="3" style="font-size:12px;">模版名称</n-text>
        <n-input :value="store.allTemplates[store.selectedTemplateIndex]?.name??''" @update:value="(v) => store.updateTemplateName(store.selectedTemplateIndex, v)" size="small" style="margin-top:4px;" />
      </div>
      <div>
        <n-text depth="3" style="font-size:12px;">提示词内容{{ store.selectedTemplateIndex < store.BUILTIN_TEMPLATES.length ? ' (内置模版不可编辑)' : '' }}</n-text>
        <n-input v-model:value="tplPrompt" type="textarea" :rows="6" size="small" style="margin-top:4px;" :disabled="store.selectedTemplateIndex < store.BUILTIN_TEMPLATES.length" />
      </div>
    </n-space></n-drawer-content></n-drawer>
  </div>
</template>

<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:#f5f5f5}
.app-root{height:100vh;display:grid;grid-template-rows:56px 1fr}
.app-header{display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:#fff;border-bottom:1px solid #e8e8e8;z-index:1}
.header-left{display:flex;align-items:center;gap:8px}
.app-main{overflow:hidden;display:flex;flex-direction:column}
.hdr-badge{position:absolute;top:-4px;right:-6px;background:#d03050;color:#fff;font-size:10px;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600}
.hdr-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;overflow:hidden;border:2px solid transparent;flex-shrink:0}
.hdr-avatar:hover{border-color:#00aeec}
.hdr-avatar-img{width:100%;height:100%;object-fit:cover;border-radius:50%}

.queue-drawer{display:flex;flex-direction:column;gap:10px}
.queue-actions{display:flex;gap:8px;margin-bottom:4px}
.queue-list{display:flex;flex-direction:column;gap:6px}
.q-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid #eee;background:#fff;transition:background .2s}
.q-item.running{background:#f0f7ff;border-color:#c8ddf8}
.q-item.done{background:#f6ffed;border-color:#c8e8b8}
.q-item.error{background:#fff2f0;border-color:#f0c8c0}
.q-s{flex-shrink:0;width:20px;display:flex;align-items:center;justify-content:center}
.q-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.q-bar{width:100%;height:3px;background:#eee;border-radius:2px;overflow:hidden;margin-top:2px}
.q-fill{height:100%;background:#2080f0;border-radius:2px;transition:width .3s ease}

.login-body{display:flex;flex-direction:column;align-items:center;padding:20px 0;gap:16px}
.login-success{display:flex;flex-direction:column;align-items:center}
.login-avatar-lg{width:64px;height:64px;border-radius:50%;border:2px solid #e8e8e8}
.tab-content{padding:16px 4px;display:flex;flex-direction:column;align-items:center}
.qr-section{display:flex;flex-direction:column;align-items:center;gap:10px}
.qr-code-wrap{width:200px;height:200px;border-radius:10px;overflow:hidden;position:relative;background:#fff;border:1px solid #eee}
.qr-code-img{width:100%;height:100%;object-fit:contain}
.qr-overlay{position:absolute;inset:0;background:rgba(255,255,255,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer}
.qr-overlay.success{cursor:default}
.qr-status{padding:4px 12px;background:#f5f5f5;border-radius:6px}
.sms-section{display:flex;flex-direction:column;align-items:center;width:100%;max-width:300px}

@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.spinning{animation:spin 1s linear infinite}

/* Global thin scrollbar (matches ResultView) */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#c0c0c0;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#a0a0a0}
*{scrollbar-width:thin;scrollbar-color:#c0c0c0 transparent}
</style>