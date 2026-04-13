/**
 * Copyright 2026 Daniel Smith
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { CollectedItem, GatherFolder, HighNoteCard } from './types';

const STORAGE_KEY_ITEMS = 'gather_items';
const STORAGE_KEY_FOLDERS = 'gather_folders';
const STORAGE_KEY_CARDS = 'highnotes_cards';

// --- Shared mutable state ---

export const collected: CollectedItem[] = [];
export const folders: GatherFolder[] = [];
export const cards: HighNoteCard[] = [];
export let activeFolderId: string | null = null;

export function setActiveFolderId(id: string | null): void {
  activeFolderId = id;
}

// --- Persistence ---

export function persistGather(): void {
  localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(collected));
  localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
}

export function persistCards(): void {
  localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
}

export function restoreGather(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (raw) {
      const parsed: CollectedItem[] = JSON.parse(raw);
      for (const item of parsed) collected.push(item);
    }
    const rawFolders = localStorage.getItem(STORAGE_KEY_FOLDERS);
    if (rawFolders) {
      const parsed: GatherFolder[] = JSON.parse(rawFolders);
      for (const f of parsed) {
        delete (f as unknown as Record<string, unknown>).parent;
        folders.push(f);
      }
    }
  } catch { /* corrupted storage — start fresh */ }
}

export function restoreCards(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CARDS);
    if (raw) {
      const parsed: HighNoteCard[] = JSON.parse(raw);
      for (const card of parsed) cards.push(card);
    }
  } catch { /* corrupted storage — start fresh */ }
}

// --- Lookups ---

export function findItem(id: string): CollectedItem | undefined {
  return collected.find((item) => item.id === id);
}

export function findCard(id: string): HighNoteCard | undefined {
  return cards.find((card) => card.id === id);
}

// --- ID generation ---

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
