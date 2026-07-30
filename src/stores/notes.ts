import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { NoteFolder, NoteEntry } from '../utils/types';
import {
  notesCreateFolder, notesGetFolders, notesUpdateFolder, notesDeleteFolder,
  notesCreateNote, notesGetNotes,  notesUpdateNote, notesDeleteNote,
} from '../utils/invoke';

export const useNotesStore = defineStore('notes', () => {
  const folders = ref<NoteFolder[]>([]);
  const notes = ref<NoteEntry[]>([]);
  const currentFolderId = ref<string | null>(null);
  const currentNoteId = ref<string | null>(null);
  const loadingFolders = ref(false);
  const loadingNotes = ref(false);

  const currentFolder = computed(() => folders.value.find(f => f.id === currentFolderId.value) ?? null);
  const currentNote = computed(() => notes.value.find(n => n.id === currentNoteId.value) ?? null);

  async function loadFoldersAndReturn() {
    const result = await notesGetFolders();
    folders.value = result;
    return result;
  }

  async function loadFolders() {
    loadingFolders.value = true;
    try { folders.value = await notesGetFolders(); }
    catch (e: any) { console.error('Load folders failed:', e); }
    finally { loadingFolders.value = false; }
  }

  async function createFolder(title: string, color: string = '') {
    const folder = await notesCreateFolder(title, color);
    folders.value = [folder, ...folders.value];
    return folder;
  }

  async function renameFolder(id: string, title: string) {
    const updated = await notesUpdateFolder(id, title);
    if (updated) {
      const idx = folders.value.findIndex(f => f.id === id);
      if (idx >= 0) folders.value[idx] = updated;
    }
    return updated;
  }

  async function removeFolder(id: string) {
    const ok = await notesDeleteFolder(id);
    if (ok) {
      folders.value = folders.value.filter(f => f.id !== id);
      if (currentFolderId.value === id) {
        currentFolderId.value = null;
        notes.value = [];
      }
    }
    return ok;
  }

  async function loadNotes(folderId: string) {
    currentFolderId.value = folderId;
    loadingNotes.value = true;
    try { notes.value = await notesGetNotes(folderId); }
    catch (e: any) { console.error('Load notes failed:', e); }
    finally { loadingNotes.value = false; }
  }

  async function createNote(folderId: string, title: string, content: string = '') {
    const note = await notesCreateNote(folderId, title, content);
    notes.value = [note, ...notes.value];
    currentNoteId.value = note.id;
    return note;
  }

  async function updateNote(id: string, title?: string, content?: string) {
    const updated = await notesUpdateNote(id, title, content);
    if (updated) {
      const idx = notes.value.findIndex(n => n.id === id);
      if (idx >= 0) notes.value[idx] = updated;
      // Refresh sort order
      notes.value = [...notes.value].sort((a, b) => b.updated_at - a.updated_at);
    }
    return updated;
  }

  async function removeNote(id: string) {
    const ok = await notesDeleteNote(id);
    if (ok) {
      notes.value = notes.value.filter(n => n.id !== id);
      if (currentNoteId.value === id) currentNoteId.value = null;
    }
    return ok;
  }

  function selectNote(id: string | null) {
    currentNoteId.value = id;
  }

  return {
    folders, notes, currentFolderId, currentNoteId, currentFolder, currentNote,
    loadingFolders, loadingNotes,
    loadFolders, loadFoldersAndReturn, createFolder, renameFolder, removeFolder,
    loadNotes, createNote, updateNote, removeNote, selectNote,
  };
});
