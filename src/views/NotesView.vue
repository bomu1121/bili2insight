<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from "vue";
import { NButton, NIcon, NInput, NSpace, NSelect } from "naive-ui";
import { FolderOpen, FileText, Plus, Trash2, Edit3, Search, StickyNote, ArrowLeft, PenLine, Highlighter } from "lucide-vue-next";
import { message } from "../utils/feedback";
import { useNotesStore } from "../stores/notes";
import DmailConfirm from "../components/DmailConfirm.vue";
import type { NoteFolder, NoteEntry } from "../utils/types";
import { renderMarkdown as renderMd } from "../utils/markdown";

const store = useNotesStore();

const folderSearch = ref("");
const folderCreating = ref(false);
const newFolderTitle = ref("");
const editingFolderId = ref<string | null>(null);
const editingFolderTitle = ref("");

const noteTitleInput = ref<HTMLInputElement | null>(null);
const contentTextarea = ref<HTMLTextAreaElement | null>(null);
const showPreview = ref(true);
const sidebarCollapsed = ref(false);
const folderDeleteId = ref<string | null>(null);
const noteDeleteId = ref<string | null>(null);

// --- 右键菜单（笔记列表删除）---
const noteCtx = ref<{ x: number; y: number; noteId: string; title: string } | null>(null);
const noteCtxEl = ref<HTMLElement | null>(null);
function openNoteCtx(e: MouseEvent, note: NoteEntry) {
  const W = 176, H = 96;
  noteCtx.value = {
    x: Math.min(e.clientX, window.innerWidth - W - 8),
    y: Math.min(e.clientY, window.innerHeight - H - 8),
    noteId: note.id,
    title: note.title || "无标题",
  };
  window.addEventListener("pointerdown", closeNoteCtxOnOutside, true);
  window.addEventListener("keydown", onNoteCtxKey, true);
}
function closeNoteCtxOnOutside(e: PointerEvent) {
  if (!noteCtxEl.value || !noteCtxEl.value.contains(e.target as Node)) closeNoteCtx();
}
function onNoteCtxKey(e: KeyboardEvent) {
  if (e.key === "Escape") closeNoteCtx();
}
function closeNoteCtx() {
  noteCtx.value = null;
  window.removeEventListener("pointerdown", closeNoteCtxOnOutside, true);
  window.removeEventListener("keydown", onNoteCtxKey, true);
}
function ctxDeleteNote() {
  if (!noteCtx.value) return;
  const id = noteCtx.value.noteId;
  closeNoteCtx();
  noteDeleteId.value = id;
}

const folderDeleteMessage = computed(() => {
  const f = store.folders.find(x => x.id === folderDeleteId.value);
  return f ? `确认删除文件夹「${f.title}」及其所有笔记？删除后无法恢复。` : "";
});

// --- Note sorting ---
type NoteSortMode = "updated" | "created" | "titleAsc" | "titleDesc" | "manual";
const noteSort = ref<NoteSortMode>((localStorage.getItem("notes-sort") as NoteSortMode) || "updated");
watch(noteSort, (v) => { try { localStorage.setItem("notes-sort", v); } catch (_) {} });
const sortOptions: { label: string; value: NoteSortMode }[] = [
  { label: "最近更新", value: "updated" },
  { label: "最近创建", value: "created" },
  { label: "标题 A→Z", value: "titleAsc" },
  { label: "标题 Z→A", value: "titleDesc" },
  { label: "手动排序", value: "manual" },
];
const sortedNotes = computed(() => {
  const list = [...store.notes];
  switch (noteSort.value) {
    case "created": return list.sort((a, b) => b.created_at - a.created_at);
    case "titleAsc": return list.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh-Hans-CN"));
    case "titleDesc": return list.sort((a, b) => (b.title || "").localeCompare(a.title || "", "zh-Hans-CN"));
    case "manual": return list.sort((a, b) => a.sort_order - b.sort_order || b.updated_at - a.updated_at);
    default: return list.sort((a, b) => b.updated_at - a.updated_at);
  }
});

// --- Drag reorder (manual mode) ---
// ref: SortableJS -- live reorder while dragging + `animation: 150ms` for smooth "make room"
const dragNoteId = ref<string | null>(null);
const dragPreview = ref<NoteEntry[] | null>(null);
const dragBaseOrder = ref<NoteEntry[] | null>(null); // 拖拽开始时的顺序快照，用于跳过无变化提交
const dragGhost = ref<{ x: number; y: number; title: string; date: string; preview: string } | null>(null);
const displayNotes = computed(() => dragPreview.value ?? sortedNotes.value);

let pointerDown: { noteId: string; x: number; y: number } | null = null;
let suppressClick = false;
let edgeScrollRaf = 0;
let lastPointer = { x: 0, y: 0 };
let dragPointerInZone = false;

function onNotePointerDown(e: PointerEvent, note: NoteEntry) {
  if (e.button !== 0 || !store.currentFolderId) return;
  pointerDown = { noteId: note.id, x: e.clientX, y: e.clientY };
  window.addEventListener("pointermove", onWindowPointerMove);
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("pointercancel", cleanupNoteDrag);
}
function onWindowPointerMove(e: PointerEvent) {
  if (!pointerDown) return;
  if (!dragNoteId.value) {
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    if (Math.abs(dx) + Math.abs(dy) < 6) return; // 移动阈值，区分点击与拖拽
    const note = store.notes.find(n => n.id === pointerDown!.noteId);
    dragNoteId.value = pointerDown.noteId;
    dragPreview.value = [...sortedNotes.value];
    dragBaseOrder.value = [...sortedNotes.value];
    noteSort.value = "manual";
    dragGhost.value = {
      x: e.clientX + 14, y: e.clientY + 16,
      title: note?.title || "无标题",
      date: note ? fmtDate(note.updated_at) : "",
      preview: note?.content ? truncateText(note.content, 90) : "",
    };
    lastPointer = { x: e.clientX, y: e.clientY };
    suppressClick = false;
    document.body.style.userSelect = "none";
    document.body.classList.add("drag-active");
    startEdgeScroll();
  } else {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (dragGhost.value) {
      dragGhost.value.x = e.clientX + 14;
      dragGhost.value.y = e.clientY + 16;
    }
    updateDropPreview(e);
  }
}
function updateDropPreview(e: PointerEvent) {
  if (!dragNoteId.value || !dragPreview.value) return;
  const gridEl = document.querySelector<HTMLElement>(".note-grid");
  const sbEl = document.querySelector<HTMLElement>(".sb-note-items");
  const zoneEl = (gridEl && rectContains(gridEl.getBoundingClientRect(), e.clientX, e.clientY)) ? gridEl
    : (sbEl && rectContains(sbEl.getBoundingClientRect(), e.clientX, e.clientY)) ? sbEl : null;
  dragPointerInZone = !!zoneEl;
  if (!zoneEl) return; // 指针不在任一放置区时保持现状，松开即 snap-back
  const arr = dragPreview.value;
  const from = arr.findIndex(n => n.id === dragNoteId.value);
  if (from < 0) return;
  for (const el of Array.from(zoneEl.querySelectorAll<HTMLElement>("[data-note-drag]"))) {
    if (el.dataset.noteDrag === dragNoteId.value) continue;
    const rect = el.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) continue;
    const to = arr.findIndex(n => n.id === el.dataset.noteDrag);
    if (to < 0) continue;
    const after = e.clientY > rect.top + rect.height / 2;
    let target = after ? to + 1 : to;
    if (from < target) target -= 1;
    if (from === target) return;
    const before = captureDragRects(); // 先快照当前位置，再让位
    const [moved] = arr.splice(from, 1);
    arr.splice(target, 0, moved);
    flipAfterNextTick(before);
    return;
  }
}
function rectContains(r: DOMRect, x: number, y: number) {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
// ref: SortableJS -- auto-scroll while dragging near the edge of the scroll container
function startEdgeScroll() {
  if (edgeScrollRaf) return;
  const loop = () => {
    edgeScrollRaf = requestAnimationFrame(loop);
    if (!dragNoteId.value) { cancelAnimationFrame(edgeScrollRaf); edgeScrollRaf = 0; return; }
    const el = document.elementFromPoint(lastPointer.x, lastPointer.y);
    const scroller = el?.closest<HTMLElement>(".note-grid, .sb-note-items");
    if (!scroller) return;
    const r = scroller.getBoundingClientRect();
    const edge = 64;
    let dy = 0;
    if (lastPointer.y < r.top + edge) dy = -Math.max(6, (r.top + edge - lastPointer.y) * 0.6);
    else if (lastPointer.y > r.bottom - edge) dy = Math.max(6, (lastPointer.y - (r.bottom - edge)) * 0.6);
    if (dy) {
      scroller.scrollTop += dy;
      updateDropPreview({ clientX: lastPointer.x, clientY: lastPointer.y } as PointerEvent);
    }
  };
  edgeScrollRaf = requestAnimationFrame(loop);
}
async function onWindowPointerUp() {
  const folderId = store.currentFolderId;
  const preview = dragPreview.value;
  const base = dragBaseOrder.value;
  const dragged = !!dragNoteId.value;
  suppressClick = dragged;
  const ids = preview?.map(n => n.id) ?? null;
  const unchanged = !!(ids && base && ids.join("\u0000") === base.map(n => n.id).join("\u0000"));
  const outside = dragged && !dragPointerInZone;
  releaseDragVisuals();
  dragBaseOrder.value = null;
  dragPointerInZone = false;
  if (!dragged || !ids || !folderId || unchanged) { dragPreview.value = null; return; }
  if (outside && base) {
    const before = captureDragRects(); // 已在放置区外松手：预览顺序 → 原顺序，滑回去而不提交
    dragPreview.value = [...base];
    await nextTick();
    animateFromRects(before);
    return;
  }
  try { await store.reorderNotes(folderId, ids); }
  catch (e: any) {
    const before = captureDragRects(); // 预览顺序 → 原顺序，滑回去而不是瞬跳
    dragPreview.value = null;
    await nextTick();
    animateFromRects(before);
    message.error("排序保存失败: " + String(e));
    return;
  }
  dragPreview.value = null;
}
function captureDragRects() {
  const rects = new Map<string, DOMRect>();
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-note-drag]"))) {
    if (el.dataset.noteDrag) rects.set(el.dataset.noteDrag, el.getBoundingClientRect());
  }
  return rects;
}
// ref: SortableJS `animation: 150ms` -- FLIP via Web Animations API, 连续让位时无缝衔接
function flipAfterNextTick(before: Map<string, DOMRect>) {
  void nextTick().then(() => animateFromRects(before));
}
function animateFromRects(from: Map<string, DOMRect>) {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-note-drag]"))) {
    const id = el.dataset.noteDrag ?? "";
    const f = from.get(id);
    if (!f) continue;
    el.getAnimations().forEach(a => a.cancel()); // 取消进行中的动画，元素回到布局位
    const r = el.getBoundingClientRect();
    const dx = f.x - r.x;
    const dy = f.y - r.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
      { duration: 140, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }
}
function releaseDragVisuals() {
  window.removeEventListener("pointermove", onWindowPointerMove);
  window.removeEventListener("pointerup", onWindowPointerUp);
  window.removeEventListener("pointercancel", cleanupNoteDrag);
  if (edgeScrollRaf) { cancelAnimationFrame(edgeScrollRaf); edgeScrollRaf = 0; }
  pointerDown = null;
  dragNoteId.value = null;
  dragGhost.value = null;
  document.body.style.userSelect = "";
  document.body.classList.remove("drag-active");
}
function cleanupNoteDrag() {
  releaseDragVisuals();
  dragPreview.value = null;
  dragBaseOrder.value = null;
}
function onNoteClick(note: NoteEntry) {
  if (suppressClick) { suppressClick = false; return; }
  showPreview.value = true;
  store.selectNote(note.id);
}

// --- Folder ---
const filteredFolders = computed(() => {
  if (!folderSearch.value.trim()) return store.folders;
  const q = folderSearch.value.toLowerCase();
  return store.folders.filter(f => f.title.toLowerCase().includes(q));
});

async function startCreateFolder() {
  folderCreating.value = true; newFolderTitle.value = ""; await nextTick();
}
async function confirmCreateFolder() {
  const title = newFolderTitle.value.trim();
  if (!title) { folderCreating.value = false; return; }
  try { await store.createFolder(title); folderCreating.value = false; newFolderTitle.value = ""; }
  catch (e: any) { message.error("\u521b\u5efa\u5931\u8d25: " + String(e)); }
}
function startRenameFolder(folder: NoteFolder) {
  editingFolderId.value = folder.id; editingFolderTitle.value = folder.title;
}
async function confirmRenameFolder() {
  const id = editingFolderId.value; const title = editingFolderTitle.value.trim();
  if (!id || !title) { editingFolderId.value = null; return; }
  try { await store.renameFolder(id, title); } catch (e: any) { message.error("\u91cd\u547d\u540d\u5931\u8d25: " + String(e)); }
  editingFolderId.value = null;
}
async function removeFolder(id: string) {
  try { await store.removeFolder(id); } catch (e: any) { message.error("\u5220\u9664\u5931\u8d25: " + String(e)); }
}
function selectFolder(folder: NoteFolder) {
  store.loadNotes(folder.id); store.selectNote(null);
}

// --- Note ---
async function createNewNote() {
  if (!store.currentFolderId) return;
  try {
    await store.createNote(store.currentFolderId, "\u65b0\u7b14\u8bb0");
    await nextTick();
    noteTitleInput.value?.focus(); noteTitleInput.value?.select();
  } catch (e: any) { message.error("\u521b\u5efa\u5931\u8d25: " + String(e)); }
}
async function handleNoteTitleChange(noteId: string, title: string) {
  try { await store.updateNote(noteId, title); } catch (e: any) { message.error("\u4fdd\u5b58\u5931\u8d25: " + String(e)); }
}
let contentSaveTimer: ReturnType<typeof setTimeout> | null = null;
function handleContentChange(noteId: string, content: string) {
  if (contentSaveTimer) clearTimeout(contentSaveTimer);
  contentSaveTimer = setTimeout(async () => {
    try { await store.updateNote(noteId, undefined, content); } catch (e: any) {}
  }, 600);
}

// --- 高亮模式：开关开启后，选中的文本自动以 ==..== 高亮并保存 ---
const highlightMode = ref(false);
function toggleHighlightMode() {
  highlightMode.value = !highlightMode.value;
  message.info(highlightMode.value ? "高亮模式已开启：选中文本即自动高亮并保存" : "已退出高亮模式");
}
function onTextareaSelection() {
  if (!highlightMode.value) return;
  wrapHighlightSelection(); // 同步执行，松手/按键即高亮，无延迟
}
// 预览模式（阅读状态）下选中文本 → 直接高亮并保存，不离开预览
function onPreviewSelection() {
  if (!highlightMode.value) return;
  wrapPreviewSelection(); // 同步执行，松手即高亮，无延迟
}
// 把与选区相交的完整 ==..== 高亮块整体纳入，避免残留半边标记
function expandSelectionToHighlightBlocks(text: string, start: number, end: number) {
  const hlRe = /==([\s\S]*?)==/g;
  let m: RegExpExecArray | null;
  while ((m = hlRe.exec(text))) {
    const ms = m.index;
    const me = m.index + m[0].length;
    if (start < me && end > ms) {
      if (ms < start) start = ms;
      if (me > end) end = me;
    }
  }
  return { start, end };
}
async function wrapPreviewSelection() {
  if (!store.currentNote) return;
  const sel = (window.getSelection()?.toString() ?? "").trim();
  if (!sel) return;
  const source = store.currentNote.content;
  let start = -1;
  let end = -1;
  const direct = source.indexOf(sel);
  if (direct >= 0) {
    start = direct;
    end = direct + sel.length;
  } else {
    // 选区可能跨已高亮/加粗等标记内容：去掉标记字符后匹配，再映射回源偏移
    const marks = new Set(["#", "*", "`", "=", "-", ">", "[", "]", "(", ")"]);
    const plain: string[] = [];
    const map: number[] = [];
    for (let i = 0; i < source.length; i++) {
      if (!marks.has(source[i])) { plain.push(source[i]); map.push(i); }
    }
    const plainText = plain.join("");
    let selPlain = "";
    for (const ch of sel) { if (!marks.has(ch)) selPlain += ch; }
    const pi = plainText.indexOf(selPlain);
    if (pi >= 0 && pi + selPlain.length - 1 < map.length) {
      start = map[pi];
      end = map[pi + selPlain.length - 1] + 1;
    }
  }
  if (start < 0 || end <= start) {
    message.info("无法定位所选文本，请缩小选择范围后重试");
    return;
  }
  // 扩展选区以包含相交的高亮块，再统一清理
  const expanded = expandSelectionToHighlightBlocks(source, start, end);
  start = expanded.start;
  end = expanded.end;
  const inner = source.slice(start, end);
  // 已处于 ==..== 内则不重复包裹
  if (inner.startsWith("==") && inner.endsWith("==")) return;
  // 移除选区内已有的 == 标记，避免嵌套高亮导致渲染错乱
  const clean = inner.replace(/==/g, "");
  if (!clean) return;
  const newContent = source.slice(0, start) + "==" + clean + "==" + source.slice(end);
  if (newContent === source) return;
  // 立即保存（不走输入防抖），store 更新后预览原地重渲染高亮
  try { await store.updateNote(store.currentNote.id, undefined, newContent); }
  catch (e: any) { message.error("高亮保存失败: " + String(e)); }
}
function wrapHighlightSelection() {
  const ta = contentTextarea.value;
  if (!ta) return;
  let start = ta.selectionStart;
  let end = ta.selectionEnd;
  if (start == null || end == null || start === end) return;
  const text = ta.value;
  // 扩展选区以包含相交的高亮块，再统一清理
  const expanded = expandSelectionToHighlightBlocks(text, start, end);
  start = expanded.start;
  end = expanded.end;
  const sel = text.slice(start, end);
  if (!sel) return;
  // 已处于 ==..== 内则不重复包裹
  if (sel.startsWith("==") && sel.endsWith("==")) return;
  // 移除选区内已有的 == 标记，避免嵌套高亮导致渲染错乱
  const clean = sel.replace(/==/g, "");
  if (!clean) return;
  ta.setRangeText("==" + clean + "==", start, end, "end");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.focus();
  ta.setSelectionRange(start + 2, end + 2); // 选区停留高亮内容内部，便于继续编辑
}
function onTitleChange(e: Event) {
  const t = e.target as HTMLInputElement;
  if (store.currentNote) handleNoteTitleChange(store.currentNote.id, t.value);
}
function autoResizeTextarea() {
  const ta = contentTextarea.value;
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}
function onContentInput(e: Event) {
  const t = e.target as HTMLTextAreaElement;
  if (store.currentNote) handleContentChange(store.currentNote.id, t.value);
  autoResizeTextarea();
}
async function removeNote(id: string) {
  try { await store.removeNote(id); } catch (e: any) { message.error("\u5220\u9664\u5931\u8d25: " + String(e)); }
}
async function confirmRemoveFolder() {
  const id = folderDeleteId.value;
  if (!id) return;
  folderDeleteId.value = null;
  await removeFolder(id);
}
async function confirmRemoveNote() {
  const id = noteDeleteId.value;
  if (!id) return;
  noteDeleteId.value = null;
  await removeNote(id);
}
function goBackToNotes() {
  showPreview.value = true;
  store.selectNote(null);
}

// Keep the edit area growing with content: when entering edit mode or switching
// notes, sync textarea height to its content so the page scrolls as one region.
watch([showPreview, () => store.currentNoteId], () => {
  if (!showPreview.value) nextTick(() => autoResizeTextarea());
});

function fmtDate(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return p(d.getMonth() + 1) + "/" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function fmtDateFull(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function truncateText(text: string, maxLen = 80) {
  if (!text) return "";
  const plain = text.replace(/[#*`\-\[\]()>]/g, "").replace(/\n/g, " ").trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain;
}

onMounted(async () => {
  await store.loadFolders();
});
</script>

<template>
  <div class="notes-root" :class="{ 'note-open': !!store.currentNote, 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Left: Sidebar (ref: Obsidian foldable sidebar) -->
    <aside class="notes-sidebar">
      <div class="sidebar-head">
        <div class="title-wrap">
          <n-icon :size="15"><FolderOpen /></n-icon>
          <span class="sb-title">文件夹</span>
        </div>
        <n-button size="tiny" @click="startCreateFolder" :disabled="folderCreating" quaternary>
          <template #icon><n-icon :size="14"><Plus /></n-icon></template>
        </n-button>
      </div>

      <div class="sidebar-search" v-if="store.folders.length > 1">
        <n-input v-model:value="folderSearch" placeholder="搜索..." size="small" clearable>
          <template #prefix><n-icon :size="13"><Search /></n-icon></template>
        </n-input>
      </div>

      <div v-if="folderCreating" class="folder-create-row">
        <n-input v-model:value="newFolderTitle" placeholder="文件夹名称" size="small" :autofocus="true"
          @keyup.enter="confirmCreateFolder" @blur="confirmCreateFolder" />
      </div>

      <!-- Folder List -->
      <div class="folder-list">
        <div
          v-for="folder in filteredFolders"
          :key="folder.id"
          class="folder-item"
          :class="{ active: store.currentFolderId === folder.id }"
          @click="selectFolder(folder)"
        >
          <div class="folder-color-dot" :style="{ background: folder.color || 'var(--color-accent-purple)' }"></div>
          <div class="folder-body" v-if="editingFolderId !== folder.id">
            <span class="folder-title">{{ folder.title }}</span>
          </div>
          <div class="folder-body" v-else>
            <n-input v-model:value="editingFolderTitle" size="tiny" :autofocus="true"
              @keyup.enter="confirmRenameFolder" @blur="confirmRenameFolder" />
          </div>
          <div class="folder-actions" v-if="editingFolderId !== folder.id">
            <button type="button" class="fa-btn" @click.stop="startRenameFolder(folder)" title="重命名">
              <n-icon :size="12"><Edit3 /></n-icon>
            </button>
            <button type="button" class="fa-btn danger" @click.stop="folderDeleteId = folder.id" title="删除">
              <n-icon :size="12"><Trash2 /></n-icon>
            </button>
          </div>
        </div>

        <div class="sidebar-empty" v-if="!store.loadingFolders && !folderCreating && filteredFolders.length === 0">
          <div class="empty-icon-box"><n-icon :size="20" color="var(--color-text-tertiary)"><StickyNote /></n-icon></div>
          <span class="empty-text">{{ folderSearch ? "无匹配" : "暂无文件夹" }}</span>
        </div>
      </div>

      <!-- Compact note list when folder is selected (ref: Obsidian file list) -->
      <div class="sb-divider" v-if="store.currentFolderId"></div>
      <div class="sb-note-list" v-if="store.currentFolderId">
        <div class="sb-note-head">
          <span class="sb-note-label">{{ store.currentFolder?.title }}</span>
          <span class="sb-note-count tnum">{{ store.notes.length }}</span>
        </div>
        <div class="sb-note-items">
          <div
            v-for="note in displayNotes"
            :key="note.id"
            class="sb-note-item"
            :class="{ active: store.currentNoteId === note.id, dragging: dragNoteId === note.id }"
            :data-note-drag="note.id"
            @pointerdown="onNotePointerDown($event, note)"
            @click="onNoteClick(note)"
            @contextmenu.prevent="openNoteCtx($event, note)"
          >
            <n-icon :size="13"><FileText /></n-icon>
            <span class="sb-note-title">{{ note.title || "无标题" }}</span>
            <span class="sb-note-date tnum">{{ fmtDate(note.updated_at) }}</span>
          </div>
          <div class="sb-note-empty" v-if="store.notes.length === 0 && !store.loadingNotes">
            <span class="empty-text">空文件夹</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right: Content Area -->
    <main class="notes-content">

      <!-- No folder selected -->
      <div class="content-empty" v-if="!store.currentFolderId">
        <div class="empty-icon-box large"><n-icon :size="32" color="var(--color-text-tertiary)"><StickyNote /></n-icon></div>
        <span class="empty-title">选择文件夹</span>
        <span class="empty-hint">从左侧选择一个文件夹，或创建新文件夹开始整理笔记</span>
      </div>

      <!-- Folder selected, note list view (ref: Bear cards) -->
      <div class="content-note-list" v-else-if="!store.currentNote">
        <div class="cnl-head">
          <div class="breadcrumb">
            <span class="bc-current">{{ store.currentFolder?.title }}</span>
          </div>
          <div class="cnl-actions">
            <n-select v-model:value="noteSort" :options="sortOptions" size="small" class="sort-select" />
            <n-button size="small" @click="createNewNote" type="primary" ghost>
              <template #icon><n-icon :size="14"><Plus /></n-icon></template>
              新建笔记
            </n-button>
          </div>
        </div>

        <div class="note-grid" v-if="displayNotes.length > 0">
          <div
            v-for="note in displayNotes"
            :key="note.id"
            class="note-card"
            :class="{ dragging: dragNoteId === note.id }"
            :data-note-drag="note.id"
            @pointerdown="onNotePointerDown($event, note)"
            @click="onNoteClick(note)"
            @contextmenu.prevent="openNoteCtx($event, note)"
          >
            <div class="note-card-inner">
              <div class="note-card-head">
                <span class="note-card-title">{{ note.title || "无标题" }}</span>
                <span class="note-card-date tnum">{{ fmtDate(note.updated_at) }}</span>
              </div>
              <div class="note-card-preview" v-if="note.content">
                {{ truncateText(note.content, 120) }}
              </div>
              <div class="note-card-empty-preview" v-else>空笔记 — 点击编辑</div>
            </div>
            <div class="note-card-accent"></div>
          </div>
        </div>

        <div class="sort-hint" v-if="noteSort === 'manual' && displayNotes.length > 0">
          手动排序：拖拽卡片，其他卡片会自动让位
        </div>

        <div class="content-empty" v-else-if="!store.loadingNotes">
          <div class="empty-icon-box large"><n-icon :size="32" color="var(--color-text-tertiary)"><FileText /></n-icon></div>
          <span class="empty-title">此文件夹为空</span>
          <span class="empty-hint">创建你的第一篇笔记</span>
          <n-button size="small" @click="createNewNote" type="primary" ghost><template #icon><n-icon :size="14"><Plus /></n-icon></template>新建笔记</n-button>
        </div>
      </div>

      <!-- Note open: Full reading view (ref: ResultView reading quality) -->
      <div class="content-editor" v-else>
        <!-- Toolbar -->
        <div class="editor-toolbar">
          <div class="toolbar-left">
            <button type="button" class="back-btn" @click="goBackToNotes" title="返回笔记列表">
              <n-icon :size="16"><ArrowLeft /></n-icon>
            </button>
            <div class="breadcrumb">
              <button type="button" class="bc-link" @click="goBackToNotes">{{ store.currentFolder?.title }}</button>
              <span class="bc-sep">/</span>
              <span class="bc-current">{{ store.currentNote?.title || "无标题" }}</span>
            </div>
          </div>
          <n-space :size="4">
            <n-button
              size="tiny"
              quaternary
              :type="highlightMode ? 'primary' : 'default'"
              @click="toggleHighlightMode"
              title="高亮模式：选中文本即自动高亮并保存"
            >
              <template #icon><n-icon :size="14"><Highlighter /></n-icon></template>
            </n-button>
            <n-button size="tiny" :type="!showPreview ? 'primary' : 'default'" @click="showPreview = false" quaternary>
              <template #icon><n-icon :size="14"><PenLine /></n-icon></template>
            </n-button>
            <n-button size="tiny" :type="showPreview ? 'primary' : 'default'" @click="showPreview = true" quaternary>预览</n-button>
            <n-button size="tiny" type="error" quaternary @click="noteDeleteId = store.currentNote.id">
              <template #icon><n-icon :size="14"><Trash2 /></n-icon></template>
            </n-button>
          </n-space>
        </div>

        <!-- Edit mode -->
        <div class="editor-scroll" v-if="!showPreview">
          <div class="editor-inner">
            <input ref="noteTitleInput" class="editor-title-input"
              :value="store.currentNote.title" placeholder="笔记标题" @change="onTitleChange" />
            <div class="editor-meta tnum">更新于 {{ fmtDateFull(store.currentNote.updated_at) }}</div>
            <textarea ref="contentTextarea" class="editor-textarea"
              :value="store.currentNote.content" placeholder="输入 Markdown 内容..."
              @input="onContentInput" @mouseup="onTextareaSelection" @keyup="onTextareaSelection"></textarea>
          </div>
        </div>

        <!-- Preview mode (ref: ResultView markdown preview) -->
        <div class="editor-scroll" v-else>
          <div class="editor-inner">
            <h1 class="preview-title">{{ store.currentNote.title || "无标题" }}</h1>
            <div class="editor-meta tnum">更新于 {{ fmtDateFull(store.currentNote.updated_at) }}</div>
            <div class="md-preview" v-if="store.currentNote.content" v-html="renderMd(store.currentNote.content)" @mouseup="onPreviewSelection"></div>
            <div class="preview-empty" v-else>
              <n-icon :size="24" color="var(--color-text-tertiary)"><StickyNote /></n-icon>
              <span>暂无内容 — 切换到编辑模式开始写作</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <DmailConfirm
      :show="!!folderDeleteId"
      severity="danger"
      :message="folderDeleteMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmRemoveFolder"
      @cancel="folderDeleteId = null"
    />
    <DmailConfirm
      :show="!!noteDeleteId"
      severity="danger"
      message="确认删除此笔记？删除后无法恢复。"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmRemoveNote"
      @cancel="noteDeleteId = null"
    />

    <div
      v-if="noteCtx"
      ref="noteCtxEl"
      class="note-ctx"
      :style="{ left: noteCtx.x + 'px', top: noteCtx.y + 'px' }"
      @click.stop
      @contextmenu.prevent
    >
      <div class="ctx-title" :title="noteCtx.title">{{ noteCtx.title }}</div>
      <button type="button" class="ctx-item danger" @pointerdown.stop @click="ctxDeleteNote">
        <n-icon :size="13"><Trash2 /></n-icon>
        删除笔记
      </button>
    </div>

    <div v-if="dragGhost" class="drag-ghost" :style="{ transform: 'translate(' + dragGhost.x + 'px, ' + dragGhost.y + 'px) rotate(2deg)' }">
      <div class="drag-ghost-title-row">
        <span class="drag-ghost-title">{{ dragGhost.title }}</span>
        <span class="drag-ghost-date tnum">{{ dragGhost.date }}</span>
      </div>
      <div class="drag-ghost-preview" v-if="dragGhost.preview">{{ dragGhost.preview }}</div>
    </div>
  </div>
</template>

<style scoped>
/* === Notes Layout — Two-Column (ref: Obsidian workspace) === */
.notes-root {
  height: 100%;
  display: grid;
  grid-template-columns: 220px 1fr;
  background: var(--color-bg);
  transition: grid-template-columns var(--dur-3) var(--ease-out);
}

/* ===== LEFT: Sidebar ===== */
.notes-sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  min-height: 0;
  overflow: hidden;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.sidebar-head .title-wrap { display: flex; align-items: center; gap: 7px; color: var(--color-text); }
.sb-title { font-size: 13px; font-weight: 650; }
.sidebar-search { padding: 8px 12px; flex-shrink: 0; }
.folder-create-row { padding: 6px 12px; flex-shrink: 0; }

.folder-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

/* folder item */
.folder-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; margin: 1px 6px;
  border-radius: var(--radius-sm); cursor: pointer;
  transition: background var(--dur-1); position: relative;
}
.folder-item:hover { background: var(--color-ink-soft); }
.folder-item.active { background: var(--color-brand-soft); }
.folder-item.active::before {
  content: ""; position: absolute; left: 0; top: 6px; bottom: 6px;
  width: 2.5px; border-radius: 0 1.5px 1.5px 0;
  background: var(--color-brand); box-shadow: 0 0 4px rgba(139,62,62,0.3);
}
.folder-item.active .folder-title { color: var(--color-brand); font-weight: 600; }
.folder-color-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 5px rgba(148,136,192,0.35);
}
.folder-item.active .folder-color-dot { box-shadow: 0 0 6px rgba(139,62,62,0.5); }
.folder-body { flex: 1; min-width: 0; }
.folder-title {
  font-size: 13px; color: var(--color-text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.folder-actions { display: flex; gap: 2px; opacity: 0; transition: opacity var(--dur-1); }
.folder-item:hover .folder-actions { opacity: 1; }
.fa-btn {
  width: 24px; height: 24px; border-radius: var(--radius-xs);
  border: none; background: transparent; color: var(--color-text-tertiary);
  cursor: pointer; display: grid; place-items: center;
  transition: background var(--dur-1), color var(--dur-1);
}
.fa-btn:hover { background: var(--color-ink-soft); color: var(--color-text-secondary); }
.fa-btn.danger:hover { background: var(--color-error-soft); color: var(--color-error); }

/* sidebar empty */
.sidebar-empty {
  display: flex; flex-direction: column; align-items: center;
  padding: 24px 16px; text-align: center; gap: 4px;
}

/* sidebar compact note list (ref: Obsidian file list) */
.sb-divider {
  height: 1px; background: var(--color-border); margin: 0 10px; flex-shrink: 0;
}
.sb-note-list {
  flex: 0 0 auto;
  max-height: 40%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sb-note-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 6px; flex-shrink: 0;
}
.sb-note-label { font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
.sb-note-count { font-size: 10px; color: var(--color-text-tertiary); }
.sb-note-items {
  overflow-y: auto; padding: 2px 0 8px;
  flex: 1; min-height: 0;
}
.sb-note-item {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 5px 14px; cursor: grab; font-size: 12px;
  color: var(--color-text-secondary); transition: background var(--dur-1), opacity var(--dur-1);
}
.sb-note-item:hover { background: var(--color-ink-soft); }
.sb-note-item.active { background: var(--color-brand-soft); color: var(--color-brand); }
.sb-note-item.dragging { opacity: 0.35; pointer-events: none; }
.sb-note-item .n-icon { color: var(--color-text-tertiary); flex-shrink: 0; }
.sb-note-item.active .n-icon { color: var(--color-brand); }
.sb-note-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-note-date { font-size: 9.5px; color: var(--color-text-tertiary); flex-shrink: 0; }
.sb-note-empty { text-align: center; padding: 8px 0; }

/* drag ghost (ref: Zendesk Garden -- grabbed item follows cursor with no delay) */
.drag-ghost {
  position: fixed; left: 0; top: 0; z-index: 1000; pointer-events: none;
  width: min(300px, 62vw);
  padding: 12px 14px; background: var(--color-surface);
  border: 1px solid var(--color-border-strong); border-radius: var(--radius-md);
  box-shadow: var(--shadow-hover);
  transform-origin: top left; will-change: transform;
}
.drag-ghost-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.drag-ghost-title {
  font-size: 13px; font-weight: 600; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.drag-ghost-date { font-size: 10px; color: var(--color-text-tertiary); flex-shrink: 0; }
.drag-ghost-preview {
  font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 6px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* ===== RIGHT: Content Area ===== */
.notes-content {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* empty states */
.content-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 10px; padding: 60px 20px; text-align: center;
}
.empty-icon-box {
  width: 42px; height: 42px; border-radius: var(--radius-lg);
  background: var(--color-ink-soft); display: grid; place-items: center; margin-bottom: 4px;
}
.empty-icon-box.large { width: 60px; height: 60px; border-radius: 14px; }
.empty-title { font-size: 15px; font-weight: 650; color: var(--color-text-secondary); }
.empty-hint { font-size: 12px; color: var(--color-text-tertiary); max-width: 280px; }
.empty-text { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }

/* Note list cards (ref: Bear card grid) */
.content-note-list {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
}
.cnl-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px 12px; border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.cnl-actions { display: flex; align-items: center; gap: 10px; }
.sort-select { width: 128px; }
.sort-hint {
  padding: 6px 24px 0; font-size: 11px; color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.note-grid {
  flex: 1; overflow-y: auto; padding: 16px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px; align-content: start;
}
.note-card {
  position: relative; overflow: visible;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); cursor: grab;
  transition: border-color var(--dur-2), box-shadow var(--dur-2), opacity var(--dur-1);
  box-shadow: var(--shadow-xs);
}
.note-card:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
.note-card.dragging { opacity: 0.35; pointer-events: none; }
.note-card-inner { padding: 14px 16px; }
.note-card-accent {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: transparent; transition: background var(--dur-2);
}
.note-card:hover .note-card-accent { background: var(--color-brand); }
.note-card-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
}
.note-card-title {
  font-size: 14px; font-weight: 600; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
}
.note-card-date { font-size: 10.5px; color: var(--color-text-tertiary); flex-shrink: 0; }
.note-card-preview {
  font-size: 12.5px; color: var(--color-text-tertiary); margin-top: 8px;
  line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3;
  -webkit-box-orient: vertical; overflow: hidden;
  height: calc(12.5px * 1.55 * 3); /* 固定三行预览高度，保证卡片等高 */
}
.note-card-empty-preview {
  font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 8px;
  font-style: italic; opacity: 0.5;
  height: calc(12.5px * 1.55 * 3); /* 与预览区等高，空笔记卡片同样等高 */
}

/* ===== Editor (ref: ResultView reading quality) ===== */
.content-editor {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
}
.editor-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--color-border);
  background: var(--color-surface); flex-shrink: 0; min-height: 44px;
}
.toolbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.back-btn {
  width: 30px; height: 30px; border-radius: var(--radius-sm); border: none;
  background: transparent; color: var(--color-text-secondary);
  cursor: pointer; display: grid; place-items: center; flex-shrink: 0;
  transition: background var(--dur-1), color var(--dur-1);
}
.back-btn:hover { background: var(--color-ink-soft); color: var(--color-brand); }

/* breadcrumb */
.breadcrumb { display: flex; align-items: center; gap: 5px; font-size: 12.5px; min-width: 0; }
.bc-link {
  border: none; background: transparent; font-family: inherit; font-size: inherit;
  color: var(--color-text-tertiary); cursor: pointer; padding: 0;
  transition: color var(--dur-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;
}
.bc-link:hover { color: var(--color-brand); }
.bc-sep { color: var(--color-border-strong); font-family: var(--font-mono); font-size: 11px; flex-shrink: 0; }
.bc-current { color: var(--color-text); font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Editor scrollable area with centered content */
.editor-scroll {
  flex: 1; min-height: 0; overflow-y: auto;
  scrollbar-gutter: stable;
}
.editor-inner {
  max-width: 780px;
  margin: 0 auto;
  padding: 28px 32px 60px;
}

/* plain edit mode */
.editor-title-input {
  width: 100%; border: none; background: transparent;
  font-family: inherit; font-size: 22px; font-weight: 750;
  color: var(--color-text); outline: none; padding: 0;
  letter-spacing: -0.005em;
}
.editor-title-input::placeholder { color: var(--color-text-tertiary); font-weight: 400; }
.editor-meta {
  padding: 8px 0 16px; font-size: 11px; color: var(--color-text-tertiary);
}
.editor-textarea {
  width: 100%; min-height: 400px; border: none; background: transparent;
  font-family: var(--font-mono); font-size: 14px; line-height: 1.85;
  color: var(--color-text); resize: none; outline: none; padding: 0;
}
.editor-textarea::placeholder { color: var(--color-text-tertiary); }

/* preview mode */
.preview-title {
  font-size: 24px; font-weight: 750; color: var(--color-text);
  letter-spacing: -0.01em; line-height: 1.3; margin: 0;
}
.preview-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 60px 0; color: var(--color-text-tertiary); font-size: 13px;
}

/* Markdown preview (ref: ResultView quality) */
.md-preview {
  line-height: 1.85; color: var(--color-text); font-size: 15px;
  padding-top: 4px;
}
.md-preview :deep(h1) { font-size: 22px; margin: 20px 0 12px; color: var(--color-text); font-weight: 750; letter-spacing: -.01em; }
.md-preview :deep(h2) { font-size: 17px; margin: 24px 0 10px; padding-left: 12px; border-left: 3px solid var(--color-brand); color: var(--color-text); line-height: 1.4; font-weight: 700; }
.md-preview :deep(h3) { font-size: 15.5px; margin: 18px 0 8px; color: var(--color-text); font-weight: 650; }
.md-preview :deep(p) { margin: 12px 0; }
.md-preview :deep(strong) { color: var(--color-brand-pressed); font-weight: 700; }
.md-preview :deep(mark) {
  /* ref: tokens.css ::selection -- 与默认文本选区高亮色保持一致 */
  background: var(--color-selection); color: inherit;
  border-radius: 3px; padding: 0 2px;
}
.md-preview :deep(code) { background: var(--color-surface-muted); border: 1px solid var(--color-border); padding: 2px 6px; border-radius: var(--radius-xs); font-size: 13px; font-family: var(--font-mono); }
.md-preview :deep(li) { margin-left: 24px; margin-bottom: 6px; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--color-border); margin: 24px 0; }
/* ref: SortableJS -- grabbing cursor while dragging */
:global(body.drag-active), :global(body.drag-active *) { cursor: grabbing !important; }

/* 右键菜单（ref: Linear / Notion context menu） */
.note-ctx {
  position: fixed; z-index: 1200; min-width: 168px; padding: 4px;
  background: var(--color-surface); border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm); box-shadow: var(--shadow-hover);
  animation: ctx-in 120ms var(--ease-out);
}
@keyframes ctx-in {
  from { opacity: 0; transform: translateY(-3px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.ctx-title {
  padding: 6px 10px 5px; font-size: 11px; color: var(--color-text-tertiary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 10px; border: none; background: transparent; border-radius: 6px;
  font-size: 12px; font-family: inherit; color: var(--color-text);
  cursor: pointer; transition: background var(--dur-1), color var(--dur-1);
}
.ctx-item:hover { background: var(--color-ink-soft); }
.ctx-item.danger { color: var(--color-error); }
.ctx-item.danger:hover { background: var(--color-error-soft); }
</style>
