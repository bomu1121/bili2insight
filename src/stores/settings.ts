// Shared types, constants, and persistence for bili2insight settings

export interface Provider { name: string; url: string; models: string[]; }
export interface PromptTemplate { name: string; prompt: string; builtin: boolean; }

export const STORAGE_KEY = "bili2insight-settings";
export const SETTINGS_VERSION = 4;

export function loadSaved(): Record<string,any>|null {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch (_) { return null; }
}

export function saveToDisk(d: Record<string,any>) {
  d.version = SETTINGS_VERSION;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  catch (_) {}
}
