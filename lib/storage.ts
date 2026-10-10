import type { NoticeDraft, SavedNotice } from "./types";

const KEY = "schoolnotice-ai:recent";
const MAX = 20;

export const STORAGE_ERROR_MESSAGE =
  "Your browser blocked saving recent notices. The notice still works, but it won't appear in Recent Notices.";

interface Result { ok: boolean; items: SavedNotice[] }

function read(): Result {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return { ok: true, items: Array.isArray(parsed) ? (parsed as SavedNotice[]) : [] };
  } catch {
    return { ok: false, items: [] };
  }
}

function write(items: SavedNotice[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX))); return true; } catch { return false; }
}

export function loadHistory(): Result { return read(); }

export function addToHistory(draft: NoticeDraft): Result {
  const items = [{ ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() }, ...read().items].slice(0, MAX);
  return { ok: write(items), items };
}

export function removeFromHistory(id: string): Result {
  const items = read().items.filter((i) => i.id !== id);
  return { ok: write(items), items };
}

export function clearHistory(): boolean {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}
