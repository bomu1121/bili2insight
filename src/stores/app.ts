import { defineStore } from "pinia";
import { ref, watch, computed } from "vue";
import type { PipelineResult, PipelineProgress, VideoInfo } from "../utils/types";
import { runPipeline, saveResultToFile, previewVideo, fetchModels } from "../utils/invoke";
import { listen } from "@tauri-apps/api/event";

export interface Provider { name: string; url: string; models: string[]; }
export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

const PROVIDERS: Provider[] = [
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  { name: "OpenAI", url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { name: "Custom", url: "", models: [] },
];

const PROMPT_GUANDIAN = [
  "你是深度内容编辑，专门将口语化的视频文案提炼为有思考深度、有逻辑归类的结构化笔记。不做简单逐句改写，而是理解视频在讨论哪些核心议题，然后把分散在全文中的相关现象、事实、例证和判断整合到一起，形成有机的观点块。",
  "",
  "【总体概要】",
  "（3-5句话概括：视频讲了什么主题、作者的核心态度/立场是什么、得出了什么关键结论。）",
  "",
  "【核心观点与支撑】",
  "### 观点块N：[用一句话提炼这个观点的核心主张]",
  "- 现象/背景：跟这个观点相关的具体事件、数据、行业动向、个人经历等客观信息",
  "- 作者的判断：作者针对上述现象明确表达的主观看法、评价、立场或态度",
  "- 补充例证：作者用来进一步支撑自己判断的案例、对比、数据等",
  "",
  "3-6个观点块，按论证逻辑排序，非时间顺序",
  "",
  "【情绪基调与弦外之音】",
  "1-2句话点出明显情绪色彩、未明说的潜台词或反复流露的矛盾心态。可省略。",
].join("\n");

const PROMPT_TECH = [
  "你是技术文档工程师，专门将口语化的技术教程、编程教学、工具演示类视频文案，提炼为结构严谨、可直接用于学习和实操的结构化技术笔记。",
  "提炼目标不是概括，而是还原——让一个没有看过原视频的开发者/学习者，仅凭你的提炼就能理解核心概念并完成关键操作。",
  "",
  "【视频目标】",
  "（用一句话说清楚：这个视频最终要教会观众什么？解决什么问题？达成什么效果？）",
  "",
  "【前置条件】",
  "- 需要的软件/工具/环境及版本号",
  "- 需要的前置知识（如果有）",
  "- 其他依赖或准备工作",
  "（如果没有明确提及，写无特殊前置，不要编造）",
  "",
  "【核心概念】（如果有的话）",
  "对于视频中涉及的关键技术概念、术语、原理，用简明扼要的方式逐个解释。如果视频纯粹是操作演示可不写。",
  "",
  "【操作步骤】",
  "按视频的实际操作顺序，每一步包含：步骤名称、具体操作、关键配置/参数/代码、预期结果、易错点。",
  "（步骤数量不限，忠实于视频实际操作流程。如果视频演示了多个方案或分支路径，分别整理。）",
  "",
  "【关键技术细节】",
  "将在视频各处散布但至关重要的技术信息集中列出：配置项/参数的具体值、版本兼容性说明、性能数据或对比数据、快捷键、命令行、文件路径。",
  "",
  "【常见坑与解决方案】",
  "把视频中提到的所有容易出错的地方、报错信息及对应的解决方法集中整理。如果没有写未提及。",
  "",
  "【最终效果 / 成果验证】",
  "（操作完成后得到的结果是什么？如何验证是否成功？）",
  "",
  "【延伸与参考】（如果有的话）",
  "视频中提到的进一步学习方向、相关资源链接、参考文档。",
  "",
  "提炼原则：结构化还原优先；技术信息零损耗；口语转技术书面语；区分作者观点和技术事实；不添加原文没有的技术信息。",
  "只输出上述结构，不添加开场白、评价或闲聊。",
].join("\n");

const PROMPT_TRACE = [
  "你是专业的视频文案信息提取与溯源助手。从用户提供的视频文字稿中提取有用信息，并为每一条信息标注清晰的信源，让读者能够直接核对原文。",
  "",
  "有用信息定义：关键事实、数据、统计数字、日期、金额、比例；明确的观点、结论、判断、预测；重要的名称（人名、地名、机构名、产品名、专有名词）；操作步骤、方法、建议、注意事项。",
  "",
  "信源要求：每条信息标注时间戳（如果原文稿有时间戳）或原文定位（如无时间戳）。原文引用用双引号包裹，1-2句关键原句。",
  "",
  "输出格式：按类型分块（事实数据、观点结论、操作步骤等），每条单独编号。如果原文稿较长、信息密集，可先给出不超过200字的核心信息摘要。",
  "",
  "特别注意：文稿中没有明确信息就说经分析未发现符合要求的有用信息，不编造。文稿语义模糊可在信源后加注存疑并说明原因。直接输出结果，不打招呼不结束语。",
].join("\n");

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  { name: "观点提炼", prompt: PROMPT_GUANDIAN, builtin: true },
  { name: "技术文案提炼", prompt: PROMPT_TECH, builtin: true },
  { name: "信息溯源", prompt: PROMPT_TRACE, builtin: true },
];

const STORAGE_KEY = "bili2insight-settings"; const SETTINGS_VERSION = 3;

function loadSaved(): Record<string,any>|null { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch(_){return null;} }
function saveToDisk(d:Record<string,any>) { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(_){} }

export const useAppStore = defineStore("app", () => {
  const saved = loadSaved();
  const ver = saved?.version === SETTINGS_VERSION ? saved : null;

  const url = ref("");
  const proxy = ref(ver?.proxy ?? "http://127.0.0.1:7897");
  const aiApiUrl = ref(ver?.aiApiUrl ?? PROVIDERS[0].url);
  const aiApiKey = ref(ver?.aiApiKey ?? "");
  const aiModel = ref(ver?.aiModel ?? PROVIDERS[0].models[0]);
  const selectedProvider = ref(ver?.selectedProvider ?? 0);
  const customModels = ref<string[]>(ver?.customModels ?? []);
  const selectedTemplateIndex = ref(ver?.selectedTemplateIndex ?? 0);
  const customTemplates = ref<PromptTemplate[]>(ver?.customTemplates ?? []);
  const editingTemplateIdx = ref(ver?.selectedTemplateIndex ?? 0);

  // Build templates: builtin + custom
  const allTemplates = computed(() => [...BUILTIN_TEMPLATES, ...customTemplates.value]);

  // aiPrompt derived from selected template
  const aiPrompt = computed(() => {
    const idx = selectedTemplateIndex.value;
    if (idx < BUILTIN_TEMPLATES.length) return BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - BUILTIN_TEMPLATES.length;
    return customTemplates.value[ci]?.prompt ?? "";
  });

  const processing = ref(false);
  const progress = ref<PipelineProgress | null>(null);
  const result = ref<PipelineResult | null>(null);
  const error = ref("");

  const preview = ref<VideoInfo | null>(null);
  const previewLoading = ref(false);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let unlisten: (() => void) | null = null;

  function persistSettings() {
    saveToDisk({
      version: SETTINGS_VERSION,
      proxy: proxy.value, aiApiUrl: aiApiUrl.value, aiApiKey: aiApiKey.value,
      aiModel: aiModel.value, selectedProvider: selectedProvider.value,
      customModels: customModels.value,
      selectedTemplateIndex: selectedTemplateIndex.value,
      customTemplates: customTemplates.value,
    });
  }

  watch([proxy, aiApiUrl, aiApiKey, aiModel, selectedProvider, selectedTemplateIndex, customTemplates], () => {
    persistSettings();
  }, { deep: false });

  function switchProvider(idx: number) { selectedProvider.value = idx; const p = PROVIDERS[idx]; aiApiUrl.value = p.url; if (p.models.length>0 && customModels.value.length===0) aiModel.value = p.models[0]; }
  async function init() { unlisten = await listen<PipelineProgress>("pipeline-progress", (ev) => { progress.value = ev.payload; }); }
  function cleanup() { if (unlisten) { unlisten(); unlisten = null; } }

  async function startPipeline() {
    if (!url.value.trim()) { error.value = "Please enter a Bilibili video URL"; return; }
    processing.value = true; error.value = ""; result.value = null;
    try { result.value = await runPipeline(url.value, proxy.value||undefined, aiApiUrl.value||undefined, aiApiKey.value||undefined, aiModel.value||undefined, aiPrompt.value||undefined); }
    catch (e: any) { error.value = String(e); }
    finally { processing.value = false; }
  }

  async function detectUrl(val: string) {
    if (previewTimer) clearTimeout(previewTimer);
    preview.value = null; previewLoading.value = false;
    if (!val.trim() || !val.includes("bilibili.com")) return;
    previewLoading.value = true;
    previewTimer = setTimeout(async () => { try { preview.value = await previewVideo(val, proxy.value||undefined); } catch (e: any) { console.error("preview error:", e); error.value = String(e); } finally { previewLoading.value = false; } }, 600);
  }
  watch(url, (val) => { detectUrl(val); });

  async function fetchModelList() {
    if (!aiApiKey.value.trim()) { error.value = "Please enter API key first"; return; }
    try { const models = await fetchModels(aiApiUrl.value, aiApiKey.value.trim()); if (models.length>0) { customModels.value = models; aiModel.value = models[0]; persistSettings(); } }
    catch (e: any) { const msg = String(e); error.value = msg.includes("401") ? "Invalid API key" : "Fetch failed: "+msg; }
  }

  function selectTemplate(idx: number) { selectedTemplateIndex.value = idx; editingTemplateIdx.value = idx; }
  function addCustomTemplate() {
    const name = "Custom "+(customTemplates.value.length+1);
    customTemplates.value = [...customTemplates.value, { name, prompt: "请分析以下视频文案...", builtin: false }];
    selectedTemplateIndex.value = BUILTIN_TEMPLATES.length + customTemplates.value.length - 1;
    editingTemplateIdx.value = selectedTemplateIndex.value;
  }
  function deleteCustomTemplate(idx: number) {
    const ci = idx - BUILTIN_TEMPLATES.length;
    if (ci < 0 || ci >= customTemplates.value.length) return;
    customTemplates.value = customTemplates.value.filter((_, i) => i !== ci);
    if (selectedTemplateIndex.value >= idx) {
      selectedTemplateIndex.value = Math.max(0, selectedTemplateIndex.value - 1);
      editingTemplateIdx.value = selectedTemplateIndex.value;
    }
  }
  function updateTemplatePrompt(idx: number, prompt: string) {
    if (idx < BUILTIN_TEMPLATES.length) return; // builtin prompts are immutable
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

  async function exportToFile() {
    if (!result.value) return;
    try { const { save } = await import("@tauri-apps/plugin-dialog"); const path = await save({ filters:[{name:"Markdown",extensions:["md"]}], defaultPath:`${result.value.video_info.title}.md` }); if (path) await saveResultToFile(result.value, path); }
    catch (e: any) { error.value = String(e); }
  }

  return { url, proxy, aiApiUrl, aiApiKey, aiModel, aiPrompt, selectedProvider, processing, progress, result, error, preview, previewLoading, PROVIDERS, customModels, BUILTIN_TEMPLATES, allTemplates, selectedTemplateIndex, editingTemplateIdx, customTemplates, init, cleanup, startPipeline, exportToFile, switchProvider, fetchModelList, selectTemplate, addCustomTemplate, deleteCustomTemplate, updateTemplatePrompt, updateTemplateName, persistSettings };
});