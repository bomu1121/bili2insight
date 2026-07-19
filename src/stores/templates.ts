import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

const STORAGE_KEY = "bili2insight-templates";

function loadTemplates(): Record<string, any> | null {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function saveTemplates(d: Record<string, any>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  catch { /* quota exceeded — silently ignore */ }
}

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
  "- 现象/背景：（跟这个观点相关的具体事件、数据、行业动向、个人经历等客观信息）",
  "- 作者的判断：（作者针对上述现象明确表达的主观看法、评价、立场或态度）",
  "- 补充例证：（作者用来进一步支撑自己判断的案例、对比、数据等）",
  "",
  "（观点块的数量视视频内容而定，通常3-6个；排列顺序遵循原文的论证逻辑，而非时间顺序）",
  "",
  "【情绪基调与弦外之音】",
  "（如果视频有明显的情绪色彩、未明说的潜台词、或作者反复流露的某种矛盾心态，用1-2句话点出。如果没有，可省略此栏。）",
  "",
  "## 提炼方法论（内化执行，不在输出中体现）",
  "1. **归类优先**",
  "2. **观点与事实捆绑**",
  "3. **去噪不降维**",
  "4. **严格忠于原意**",
  "5. **语言一致**",
  "",
  "## 行为边界",
  "- 只输出上述结构，不添加开场白、解释或额外建议。",
  "- 如果用户发送的内容明显不是视频文案，回复：「请提供一段视频文案，我来帮你提炼观点和事实。」",
].join("\n");

const PROMPT_TECH = [
  "你是一位技术文档工程师，专门将口语化的技术教程、编程教学、工具演示类视频文案，提炼为结构严谨的结构化技术笔记。",
  "",
  "## 固定输出格式",
  "【视频目标】（用一句话说清楚：这个视频最终要教会观众什么）",
  "【前置条件】（需要的软件/工具/环境及版本号、前置知识）",
  "【核心概念】（关键技术概念逐个解释）",
  "【操作步骤】（按实际操作顺序，每步包含操作、配置/代码、预期结果、易错点）",
  "【关键技术细节】（配置项/参数值/兼容性/命令行等）",
  "【常见坑与解决方案】",
  "【最终效果 / 成果验证】",
  "【延伸与参考】",
  "",
  "## 行为边界",
  "- 只输出上述结构，不添加开场白、评价或闲聊。",
].join("\n");

const PROMPT_TRACE = [
  "你是专业的视频文案信息提取与溯源助手。从视频文字稿中提取有用信息，并为每一条标注清晰的信源。",
  "有用信息：关键事实、数据、观点、结论、名称、操作步骤、注意事项。信源要求：时间戳或原文定位 + 原文引用。",
  "按类型分块输出，信息密集时先给不超过200字的核心摘要。不编造，语义模糊加注存疑。",
].join("\n");

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  { name: "观点提炼", prompt: PROMPT_GUANDIAN, builtin: true },
  { name: "技术文案提炼", prompt: PROMPT_TECH, builtin: true },
  { name: "信息溯源", prompt: PROMPT_TRACE, builtin: true },
];

export const useTemplateStore = defineStore("templates", () => {
  const saved = loadTemplates();

  const selectedTemplateIndex = ref<number>(saved?.selectedTemplateIndex ?? 0);
  const customTemplates = ref<PromptTemplate[]>(saved?.customTemplates ?? []);

  const allTemplates = computed(() => [...BUILTIN_TEMPLATES, ...customTemplates.value]);

  const aiPrompt = computed(() => {
    const idx = selectedTemplateIndex.value;
    if (idx < BUILTIN_TEMPLATES.length) return BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - BUILTIN_TEMPLATES.length;
    return customTemplates.value[ci]?.prompt ?? "";
  });

  function resolvePrompt(templateIndex?: number): string {
    const idx = templateIndex ?? selectedTemplateIndex.value;
    if (idx < BUILTIN_TEMPLATES.length) return BUILTIN_TEMPLATES[idx].prompt;
    const ci = idx - BUILTIN_TEMPLATES.length;
    return customTemplates.value[ci]?.prompt ?? "";
  }

  function selectTemplate(idx: number) { selectedTemplateIndex.value = idx; }

  function addCustomTemplate() {
    const name = "自定义 " + (customTemplates.value.length + 1);
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

  // Persist on change
  watch([selectedTemplateIndex, customTemplates], () => {
    saveTemplates({ selectedTemplateIndex: selectedTemplateIndex.value, customTemplates: customTemplates.value });
  }, { deep: false });

  return {
    BUILTIN_TEMPLATES, selectedTemplateIndex, customTemplates,
    allTemplates, aiPrompt, resolvePrompt,
    selectTemplate, addCustomTemplate, deleteCustomTemplate, updateTemplatePrompt, updateTemplateName,
  };
});