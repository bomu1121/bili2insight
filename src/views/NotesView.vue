<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from "vue";
import { NButton, NIcon, NInput, NSpace, NPopconfirm, createDiscreteApi } from "naive-ui";
import { FolderOpen, FileText, Plus, Trash2, Edit3, Search, StickyNote, ArrowLeft, PenLine } from "lucide-vue-next";
import { useNotesStore } from "../stores/notes";
import type { NoteFolder } from "../utils/types";

const store = useNotesStore();
const { message } = createDiscreteApi(["message"]);

const folderSearch = ref("");
const folderCreating = ref(false);
const newFolderTitle = ref("");
const editingFolderId = ref<string | null>(null);
const editingFolderTitle = ref("");

const noteTitleInput = ref<HTMLInputElement | null>(null);
const contentTextarea = ref<HTMLTextAreaElement | null>(null);
const showPreview = ref(true);
const sidebarCollapsed = ref(false);

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
function onTitleChange(e: Event) {
  const t = e.target as HTMLInputElement;
  if (store.currentNote) handleNoteTitleChange(store.currentNote.id, t.value);
}
function onContentInput(e: Event) {
  const t = e.target as HTMLTextAreaElement;
  if (store.currentNote) handleContentChange(store.currentNote.id, t.value);
}
async function removeNote(id: string) {
  try { await store.removeNote(id); } catch (e: any) { message.error("\u5220\u9664\u5931\u8d25: " + String(e)); }
}
function goBackToNotes() {
  showPreview.value = true;
  store.selectNote(null);
}

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

function renderMd(text: string) {
  if (!text) return "";
  let h = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, (_, s) => "<h3>" + s + "</h3>")
    .replace(/^## (.+)$/gm, (_, s) => "<h2>" + s + "</h2>")
    .replace(/^# (.+)$/gm, (_, s) => "<h1>" + s + "</h1>")
    .replace(/\*\*(.+?)\*\*/g, (_, s) => "<strong>" + s + "</strong>")
    .replace(/`([^`]+)`/g, (_, s) => "<code>" + s + "</code>")
    .replace(/^- (.+)$/gm, (_, s) => "<li>" + s + "</li>")
    .replace(/^(\d+)\. (.+)$/gm, (_2, _3, s) => "<li>" + s + "</li>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  return "<p>" + h + "</p>";
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
            <n-popconfirm @positive-click="removeFolder(folder.id)">
              <template #trigger>
                <button type="button" class="fa-btn danger" @click.stop title="删除">
                  <n-icon :size="12"><Trash2 /></n-icon>
                </button>
              </template>
              确认删除文件夹及其所有笔记？
            </n-popconfirm>
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
            v-for="note in store.notes"
            :key="note.id"
            class="sb-note-item"
            :class="{ active: store.currentNoteId === note.id }"
            @click="showPreview = true; store.selectNote(note.id)"
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
          <n-button size="small" @click="createNewNote" type="primary" ghost>
            <template #icon><n-icon :size="14"><Plus /></n-icon></template>
            新建笔记
          </n-button>
        </div>

        <div class="note-grid" v-if="store.notes.length > 0">
          <div
            v-for="note in store.notes"
            :key="note.id"
            class="note-card"
            @click="showPreview = true; store.selectNote(note.id)"
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
            <n-button size="tiny" :type="!showPreview ? 'primary' : 'default'" @click="showPreview = false" quaternary>
              <template #icon><n-icon :size="14"><PenLine /></n-icon></template>
            </n-button>
            <n-button size="tiny" :type="showPreview ? 'primary' : 'default'" @click="showPreview = true" quaternary>预览</n-button>
            <n-popconfirm @positive-click="removeNote(store.currentNote.id)">
              <template #trigger>
                <n-button size="tiny" type="error" quaternary><template #icon><n-icon :size="14"><Trash2 /></n-icon></template></n-button>
              </template>
              确认删除此笔记？
            </n-popconfirm>
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
              @input="onContentInput"></textarea>
          </div>
        </div>

        <!-- Preview mode (ref: ResultView markdown preview) -->
        <div class="editor-scroll" v-else>
          <div class="editor-inner">
            <h1 class="preview-title">{{ store.currentNote.title || "无标题" }}</h1>
            <div class="editor-meta tnum">更新于 {{ fmtDateFull(store.currentNote.updated_at) }}</div>
            <div class="md-preview" v-if="store.currentNote.content" v-html="renderMd(store.currentNote.content)"></div>
            <div class="preview-empty" v-else>
              <n-icon :size="24" color="var(--color-text-tertiary)"><StickyNote /></n-icon>
              <span>暂无内容 — 切换到编辑模式开始写作</span>
            </div>
          </div>
        </div>
      </div>
    </main>
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
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px; cursor: pointer; font-size: 12px;
  color: var(--color-text-secondary); transition: background var(--dur-1);
}
.sb-note-item:hover { background: var(--color-ink-soft); }
.sb-note-item.active { background: var(--color-brand-soft); color: var(--color-brand); }
.sb-note-item .n-icon { color: var(--color-text-tertiary); flex-shrink: 0; }
.sb-note-item.active .n-icon { color: var(--color-brand); }
.sb-note-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-note-date { font-size: 9.5px; color: var(--color-text-tertiary); flex-shrink: 0; }
.sb-note-empty { text-align: center; padding: 8px 0; }

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
.note-grid {
  flex: 1; overflow-y: auto; padding: 16px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px; align-content: start;
}
.note-card {
  position: relative; overflow: hidden;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); cursor: pointer;
  transition: border-color var(--dur-2), box-shadow var(--dur-2);
  box-shadow: var(--shadow-xs);
}
.note-card:hover { border-color: var(--color-border-strong); box-shadow: var(--shadow-sm); }
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
}
.note-card-empty-preview {
  font-size: 11.5px; color: var(--color-text-tertiary); margin-top: 8px;
  font-style: italic; opacity: 0.5;
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
.md-preview :deep(code) { background: var(--color-surface-muted); border: 1px solid var(--color-border); padding: 2px 6px; border-radius: var(--radius-xs); font-size: 13px; font-family: var(--font-mono); }
.md-preview :deep(li) { margin-left: 24px; margin-bottom: 6px; }
.md-preview :deep(hr) { border: none; border-top: 1px solid var(--color-border); margin: 24px 0; }
</style>
