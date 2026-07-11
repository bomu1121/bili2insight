<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from "vue";
import { NInput, NButton, NSpace, NText, NIcon, createDiscreteApi, NDrawer, NDrawerContent, NSelect } from "naive-ui";
import { SettingsSharp, VideocamOutline, ListOutline } from "@vicons/ionicons5";
import { useRouter } from "vue-router";
import { useAppStore } from "./stores/app";
const { message } = createDiscreteApi(["message"]);
const store = useAppStore();
const router = useRouter();
const showSettings = ref(false);
onMounted(() => store.init()); onUnmounted(() => store.cleanup());
watch(() => store.error, (val) => { if (val) message.error(val); });

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
        <n-button text @click="router.push('/queue')" style="position:relative;">
          <template #icon><n-icon><ListOutline /></n-icon></template>队列
          <span v-if="store.queueCount > 0" class="hdr-badge">{{ store.queueCount }}</span>
        </n-button>
        <n-button text @click="showSettings=true"><template #icon><n-icon><SettingsSharp /></n-icon></template>设置</n-button>
      </n-space>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <!-- Settings drawer -->
    <n-drawer v-model:show="showSettings" width="440"><n-drawer-content title="设置" closable><n-space vertical style="gap:16px;">
      <div><n-text depth="3" style="font-size:12px;">HTTP 代理</n-text><n-input v-model:value="store.proxy" placeholder="http://127.0.0.1:7897" size="small" /></div>
      <div><n-text depth="3" style="font-size:12px;">AI 提供商</n-text><n-select v-model:value="store.selectedProvider" :options="store.PROVIDERS.map((p:any,i:number)=>({label:p.name,value:i}))" size="small" @update:value="(i:number)=>store.switchProvider(i)" /></div>
      <div><n-text depth="3" style="font-size:12px;">API 地址</n-text><n-input v-model:value="store.aiApiUrl" size="small" /></div>
      <div>
        <n-text depth="3" style="font-size:12px;">API 密钥</n-text>
        <n-space :size="6" style="margin-top:4px;flex-wrap:nowrap;">
          <n-input v-model:value="store.aiApiKey" type="password" placeholder="sk-..." size="small" show-password-on="click" style="flex:1;min-width:0;" />
          <n-button size="small" @click="store.fetchModelList()" style="flex-shrink:0;white-space:nowrap;">测试连接 &amp; 拉取模型</n-button>
        </n-space>
      </div>
      <div v-if="store.customModels.length>0||store.PROVIDERS[store.selectedProvider].models.length>0">
        <n-text depth="3" style="font-size:12px;">模型</n-text><n-select v-model:value="store.aiModel" :options="(store.customModels.length>0?store.customModels:store.PROVIDERS[store.selectedProvider].models).map((m:string)=>({label:m,value:m}))" size="small" />
      </div>
      <div v-else><n-text depth="3" style="font-size:12px;">模型</n-text><n-input v-model:value="store.aiModel" size="small" /></div>
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
        <n-input :value="store.allTemplates[store.selectedTemplateIndex]?.name??''" @update:value="(v:string)=>store.updateTemplateName(store.selectedTemplateIndex, v)" size="small" style="margin-top:4px;" />
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
</style>