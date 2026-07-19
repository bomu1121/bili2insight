import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadSaved, saveToDisk, type Provider, SETTINGS_VERSION } from "./settings";
import { fetchModels } from "../utils/invoke";

export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

export const useSettingsStore = defineStore("settingsStore", () => {
  const saved = loadSaved();
  const ver = saved;

  const proxy = ref(ver?.proxy ?? "");
  const aiApiUrl = ref(ver?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(ver?.aiApiKey ?? "");
  const aiModel = ref(ver?.aiModel ?? PROVIDERS[0].models[0]);
  const selectedProvider = ref(ver?.selectedProvider ?? 0);
  const customModels = ref<string[]>(ver?.customModels ?? []);

  type AsrModelOption = "paraformer" | "mimo";
  const asrModel = ref<AsrModelOption>(ver?.asrModel ?? "paraformer");
  const asrApiUrl = ref(ver?.asrApiUrl ?? "");
  const asrApiKey = ref(ver?.asrApiKey ?? "");

  function persistSettings() {
    saveToDisk({
      version: SETTINGS_VERSION, proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value,
      aiModel: aiModel.value, selectedProvider: selectedProvider.value, customModels: customModels.value,
      asrModel: asrModel.value, asrApiUrl: asrApiUrl.value, asrApiKey: asrApiKey.value,
    });
  }

  watch([proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, asrModel, asrApiUrl, asrApiKey], () => {
    persistSettings();
  }, { deep: false });

  function switchProvider(idx: number) {
    selectedProvider.value = idx;
    const p = PROVIDERS[idx];
    aiApiUrl.value = p.url;
    if (p.models.length > 0 && customModels.value.length === 0) aiModel.value = p.models[0];
  }

  async function fetchModelList() {
    if (!aiApiKey.value.trim()) return;
    try {
      const models = await fetchModels(aiApiUrl.value, aiApiKey.value.trim());
      if (models.length > 0) { customModels.value = models; aiModel.value = models[0]; persistSettings(); }
    } catch (e: any) { throw e; }
  }

  return {
    PROVIDERS, proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, customModels,
    asrModel, asrApiUrl, asrApiKey,
    switchProvider, fetchModelList, persistSettings,
  };
});