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

import { AlapUI, AlapLightbox, AlapLens } from 'alap';
import type { AlapConfig, AlapEngine, AlapLink, ResolvedLink } from 'alap/core';
import 'alap/lightbox.css';
import 'alap/lens.css';
import { normalizeTag, applyRule, sanitizeRaw, parseOembedResponse } from './meta-utils';
import { demoConfig } from './config';
import type { CollectedItem, GatherFolder } from './types';
import {
  collected, folders, activeFolderId, setActiveFolderId,
  persistGather, restoreGather, findItem, generateId,
} from './state';
import { initHighNotes, summonOrCreate } from './highnotes';

const DRAG_THRESHOLD_PX = 8;

const trayList = document.getElementById('gather-list') as HTMLUListElement;
const trayEmpty = document.getElementById('gather-empty') as HTMLElement;
const trayCount = document.getElementById('gather-count') as HTMLElement;
const dropzone = document.getElementById('gather-dropzone') as HTMLElement;
const clearBtn = document.getElementById('gather-clear') as HTMLButtonElement;
const exportBtn = document.getElementById('gather-export') as HTMLButtonElement;
const lightboxBtn = document.getElementById('gather-lightbox') as HTMLButtonElement;
const lensBtn = document.getElementById('gather-lens') as HTMLButtonElement;
const markdownBtn = document.getElementById('gather-markdown') as HTMLButtonElement;
const bookmarksBtn = document.getElementById('gather-bookmarks') as HTMLButtonElement;
const saveBtn = document.getElementById('gather-save') as HTMLButtonElement;
const gatherTray = document.getElementById('gather-tray') as HTMLElement;


// --- Folder operations ---

const folderAddBtn = document.getElementById('gather-folder-add') as HTMLButtonElement;


function defaultFolderName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function createFolder(): void {
  const folder: GatherFolder = {
    id: generateId('f'),
    name: defaultFolderName(),
    collapsed: false,
  };
  folders.push(folder);
  persistGather();
  renderFullTray();

  // Focus the new folder's name input for immediate rename
  const input = trayList.querySelector<HTMLInputElement>(
    `[data-gather-folder-id="${CSS.escape(folder.id)}"] .gather-folder-name`,
  );
  if (input) {
    input.focus();
    input.select();
  }
}

function removeFolder(folderId: string): void {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return;

  // Promote items to root
  for (const item of collected) {
    if (item.gather_folder === folderId) {
      item.gather_folder = undefined;
    }
  }

  const index = folders.indexOf(folder);
  if (index !== -1) folders.splice(index, 1);

  if (activeFolderId === folderId) setActiveFolderId(null);

  persistGather();
  renderFullTray();
}

function renameFolder(folderId: string, newName: string): void {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return;
  folder.name = newName.trim() || defaultFolderName();
  persistGather();
}

function toggleFolderCollapse(folderId: string): void {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return;
  folder.collapsed = !folder.collapsed;
  persistGather();

  // Toggle class on existing container instead of full re-render
  const folderEl = trayList.querySelector(`[data-gather-folder-id="${CSS.escape(folderId)}"]`);
  if (folderEl) {
    const container = folderEl.nextElementSibling;
    if (container?.classList.contains('gather-folder-children')) {
      container.classList.toggle('collapsed', folder.collapsed);
    }
    // Update toggle icon
    const toggle = folderEl.querySelector('.gather-folder-toggle');
    if (toggle) toggle.textContent = folder.collapsed ? '\u25B6' : '\u25BC';
  }
}

function setActiveFolder(folderId: string | null): void {
  setActiveFolderId(folderId);

  // Update folder active states in place
  trayList.querySelectorAll('.gather-folder').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-gather-folder-id') === folderId);
  });

  // Update child item indicators in place
  trayList.querySelectorAll('.gather-folder-children').forEach((container) => {
    const folderEl = container.previousElementSibling;
    const isActive = folderEl?.getAttribute('data-gather-folder-id') === folderId;
    container.querySelectorAll('.gather-folder-child').forEach((child) => {
      child.classList.toggle('folder-active', isActive);
    });
  });
}

// --- Folder drag ghost ---

let folderDragGhost: HTMLElement | null = null;

function createFolderDragGhost(name: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'gather-folder-ghost';
  ghost.textContent = name;
  document.body.appendChild(ghost);
  return ghost;
}

// Position ghost during folder drags
gatherTray.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes('application/x-gather-folder')) return;
  if (folderDragGhost) {
    folderDragGhost.style.left = `${e.clientX}px`;
    folderDragGhost.style.top = `${e.clientY}px`;
  }
});

function renderFolderItem(folder: GatherFolder): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'gather-folder';
  li.setAttribute('data-gather-folder-id', folder.id);
  if (activeFolderId === folder.id) li.classList.add('active');

  // Drag handle for reordering folders
  const handle = document.createElement('span');
  handle.className = 'gather-folder-handle';
  handle.textContent = '\u2630';
  handle.draggable = true;
  handle.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('application/x-gather-folder', folder.id);
    e.dataTransfer!.effectAllowed = 'move';

    // Use transparent 1px image so native ghost doesn't show
    const blank = document.createElement('canvas');
    blank.width = 1;
    blank.height = 1;
    e.dataTransfer!.setDragImage(blank, 0, 0);

    li.classList.add('gather-dragging');
    gatherTray.classList.add('folder-dragging');
    folderDragGhost = createFolderDragGhost(folder.name);
  });
  handle.addEventListener('dragend', () => {
    li.classList.remove('gather-dragging');
    gatherTray.classList.remove('folder-dragging');
    if (folderDragGhost) {
      folderDragGhost.remove();
      folderDragGhost = null;
    }
    trayList.querySelectorAll('.gather-drop-before, .gather-drop-after, .gather-folder-drop-target').forEach((el) => {
      el.classList.remove('gather-drop-before', 'gather-drop-after', 'gather-folder-drop-target');
    });
  });
  li.appendChild(handle);

  const toggle = document.createElement('button');
  toggle.className = 'gather-folder-toggle';
  toggle.type = 'button';
  toggle.textContent = folder.collapsed ? '\u25B6' : '\u25BC';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveFolderId(folder.id);
    toggleFolderCollapse(folder.id);
  });
  li.appendChild(toggle);

  const nameInput = document.createElement('input');
  nameInput.className = 'gather-folder-name';
  nameInput.type = 'text';
  nameInput.value = folder.name;
  nameInput.addEventListener('blur', () => { renameFolder(folder.id, nameInput.value); });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  li.appendChild(nameInput);

  const remove = document.createElement('button');
  remove.className = 'gather-folder-remove';
  remove.type = 'button';
  remove.textContent = '\u00d7';
  remove.setAttribute('aria-label', `Remove folder ${folder.name}`);
  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFolder(folder.id);
  });
  li.appendChild(remove);

  li.addEventListener('click', () => {
    setActiveFolder(folder.id);
  });

  // Drop target: items drop INTO folder, folders reorder (before/after)
  li.addEventListener('dragover', (e) => {
    const types = e.dataTransfer?.types;
    if (!types?.includes('application/x-gather-item') && !types?.includes('application/x-gather-folder')) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    li.classList.remove('gather-drop-before', 'gather-drop-after', 'gather-folder-drop-target');

    if (types?.includes('application/x-gather-folder')) {
      const rect = li.getBoundingClientRect();
      const y = (e.clientY - rect.top) / rect.height;
      li.classList.add(y < 0.5 ? 'gather-drop-before' : 'gather-drop-after');
    } else {
      li.classList.add('gather-folder-drop-target');
    }
  });
  li.addEventListener('dragleave', () => {
    li.classList.remove('gather-folder-drop-target', 'gather-drop-before', 'gather-drop-after');
  });
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const wasBefore = li.classList.contains('gather-drop-before');
    li.classList.remove('gather-folder-drop-target', 'gather-drop-before', 'gather-drop-after');

    // Item dropped onto folder
    const itemId = e.dataTransfer?.getData('application/x-gather-item');
    if (itemId) {
      const item = collected.find((c) => c.id === itemId);
      if (item) {
        item.gather_folder = folder.id;
        persistGather();
        renderFullTray();
      }
      return;
    }

    // Folder dropped — reorder
    const folderId = e.dataTransfer?.getData('application/x-gather-folder');
    if (!folderId || folderId === folder.id) return;
    const draggedFolder = folders.find((f) => f.id === folderId);
    if (!draggedFolder) return;

    const dragIdx = folders.indexOf(draggedFolder);
    if (dragIdx === -1) return;
    folders.splice(dragIdx, 1);
    const targetIdx = folders.indexOf(folder);
    if (targetIdx === -1) { folders.push(draggedFolder); }
    else { folders.splice(wasBefore ? targetIdx : targetIdx + 1, 0, draggedFolder); }

    persistGather();
    renderFullTray();
  });

  return li;
}

// --- Full tray render ---

function renderFullTray(): void {
  trayList.innerHTML = '';
  const folderIds = new Set(folders.map((f) => f.id));

  // Render each folder and its items (children always in DOM, animated via container)
  for (const folder of folders) {
    trayList.appendChild(renderFolderItem(folder));
    const isActive = activeFolderId === folder.id;
    const folderItems = collected.filter((item) => item.gather_folder === folder.id);

    const container = document.createElement('div');
    container.className = 'gather-folder-children';
    if (folder.collapsed) container.classList.add('collapsed');

    const inner = document.createElement('div');
    inner.className = 'gather-folder-children-inner';
    for (const item of folderItems) {
      const li = renderTrayItem(item);
      li.classList.add('gather-folder-child');
      if (isActive) li.classList.add('folder-active');
      inner.appendChild(li);
    }

    container.appendChild(inner);
    trayList.appendChild(container);
  }

  // Root-level items (no folder, or orphaned from a deleted folder)
  const rootItems = collected.filter((item) =>
    !item.gather_folder || !folderIds.has(item.gather_folder),
  );
  for (const item of rootItems) {
    trayList.appendChild(renderTrayItem(item));
  }

  updateTrayVisibility();
}

folderAddBtn.addEventListener('click', createFolder);

// Reset active folder when clicking the tray header
const trayHeader = document.querySelector('.gather-tray-header') as HTMLElement;
trayHeader.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('button')) return;
  setActiveFolder(null);
});

// Drop on header = move item to root
trayHeader.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes('application/x-gather-item')) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  trayHeader.classList.add('gather-folder-drop-target');
});
trayHeader.addEventListener('dragleave', () => {
  trayHeader.classList.remove('gather-folder-drop-target');
});
trayHeader.addEventListener('drop', (e) => {
  e.preventDefault();
  trayHeader.classList.remove('gather-folder-drop-target');

  const itemId = e.dataTransfer?.getData('application/x-gather-item');
  if (itemId) {
    const item = collected.find((c) => c.id === itemId);
    if (item) {
      item.gather_folder = undefined;
      persistGather();
      renderFullTray();
    }
  }
});

// --- Tray visibility ---

function updateTrayVisibility(): void {
  const hasItems = collected.length > 0;
  trayEmpty.classList.toggle('hidden', hasItems);
  clearBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  exportBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  lightboxBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  lensBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  markdownBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  bookmarksBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  saveBtn.style.visibility = hasItems ? 'visible' : 'hidden';
  trayCount.textContent = hasItems ? String(collected.length) : '';
}

function renderTrayItem(item: CollectedItem): HTMLLIElement {
  const li = document.createElement('li');
  li.setAttribute('data-gather-id', item.id);
  li.draggable = true;

  li.addEventListener('dragstart', (e) => {
    e.dataTransfer?.setData('application/x-gather-item', item.id);
    e.dataTransfer!.effectAllowed = 'move';
    li.classList.add('gather-dragging');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('gather-dragging');
    trayList.querySelectorAll('.gather-drop-before, .gather-drop-after').forEach((el) => {
      el.classList.remove('gather-drop-before', 'gather-drop-after');
    });
  });

  li.addEventListener('click', () => {
    setActiveFolder(item.gather_folder ?? null);
  });

  li.addEventListener('dblclick', () => {
    const tray = document.getElementById('gather-tray');
    const liRect = li.getBoundingClientRect();
    const trayRect = tray ? tray.getBoundingClientRect() : liRect;
    // Position to the left of the tray, vertically aligned with the item
    const cardWidth = 280;
    const x = trayRect.left - cardWidth - 16;
    const y = liRect.top;
    summonOrCreate(item.id, x, y);
  });

  // Drop target: dropping an item onto another item moves it into the same folder
  // and reorders it next to the target
  li.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('application/x-gather-item')) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    li.classList.remove('gather-drop-before', 'gather-drop-after');
    const rect = li.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    li.classList.add(y < 0.5 ? 'gather-drop-before' : 'gather-drop-after');
  });
  li.addEventListener('dragleave', () => {
    li.classList.remove('gather-drop-before', 'gather-drop-after');
  });
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const before = li.classList.contains('gather-drop-before');
    li.classList.remove('gather-drop-before', 'gather-drop-after');

    const draggedId = e.dataTransfer?.getData('application/x-gather-item');
    if (!draggedId || draggedId === item.id) return;
    const dragged = collected.find((c) => c.id === draggedId);
    if (!dragged) return;

    // Move into the same folder as the target
    dragged.gather_folder = item.gather_folder;

    // Reorder in the collected array
    const dragIdx = collected.indexOf(dragged);
    if (dragIdx === -1) return;
    collected.splice(dragIdx, 1);
    const targetIdx = collected.indexOf(item);
    if (targetIdx === -1) { collected.push(dragged); }
    else { collected.splice(before ? targetIdx : targetIdx + 1, 0, dragged); }

    persistGather();
    renderFullTray();
  });

  const label = document.createElement('span');
  label.className = 'gather-item-label';
  label.textContent = item.label;
  label.title = item.url;
  li.appendChild(label);

  // Enrich button for external drops — try to fetch richer metadata
  if (item.tags.includes('external_drop')) {
    const enrich = document.createElement('button');
    enrich.className = 'gather-item-enrich';
    enrich.type = 'button';
    enrich.textContent = '\u2197';
    enrich.setAttribute('aria-label', `Fetch metadata for ${item.label}`);
    enrich.addEventListener('click', () => { onEnrichClick(item.id, enrich); });
    li.appendChild(enrich);
  }

  const remove = document.createElement('button');
  remove.className = 'gather-item-remove';
  remove.type = 'button';
  remove.textContent = '\u00d7';
  remove.setAttribute('aria-label', `Remove ${item.label}`);
  li.appendChild(remove);

  return li;
}

function addToTray(item: CollectedItem): void {
  if (collected.some((c) => c.url === item.url)) return;

  if (activeFolderId) {
    item.gather_folder = activeFolderId;
  }

  collected.unshift(item);
  renderFullTray();
  persistGather();
}

function removeFromTray(id: string): void {
  const index = collected.findIndex((c) => c.id === id);
  if (index === -1) return;

  collected.splice(index, 1);
  const li = trayList.querySelector(`[data-gather-id="${CSS.escape(id)}"]`);
  if (li) li.remove();
  updateTrayVisibility();
  persistGather();
}

function clearTray(): void {
  collected.length = 0;
  folders.length = 0;
  setActiveFolderId(null);
  trayList.innerHTML = '';
  updateTrayVisibility();
  persistGather();
}

function buildExportConfig(): Record<string, unknown> {
  const allLinks: Record<string, Record<string, unknown>> = {};

  for (const item of collected) {
    const key = item.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const entry: Record<string, unknown> = {
      label: item.label,
      url: item.url,
    };

    if (item.tags.length > 0) entry.tags = item.tags;
    if (item.description) entry.description = item.description;
    if (item.thumbnail) entry.thumbnail = item.thumbnail;
    if (item.createdAt) entry.createdAt = item.createdAt;
    if (Object.keys(item.meta).length > 0) entry.meta = item.meta;

    allLinks[key] = entry;
  }

  return {
    settings: { listType: 'ul' },
    allLinks,
  };
}

function exportJSON(): void {
  const config = buildExportConfig();
  navigator.clipboard.writeText(JSON.stringify(config, null, 2));

  const original = exportBtn.textContent;
  exportBtn.textContent = 'Copied!';
  setTimeout(() => { exportBtn.textContent = original; }, 1500);
}

// --- Markdown export (Obsidian-friendly, folder-aware) ---

function renderMarkdownItem(item: CollectedItem, lines: string[], headingDepth: number): void {
  const prefix = '#'.repeat(headingDepth + 1);
  lines.push(`${prefix} [${item.label}](${item.url})`);

  if (item.description) {
    lines.push(`${item.description}`);
    lines.push('');
  }

  if (item.tags.length > 0) {
    lines.push(item.tags.map((t) => `#${t}`).join(' '));
    lines.push('');
  }

  const meta = item.meta;
  if (meta.photoCredit) {
    const credit = meta.photoCreditUrl
      ? `Photo: [${meta.photoCredit}](${meta.photoCreditUrl})`
      : `Photo: ${meta.photoCredit}`;
    lines.push(credit);
    lines.push('');
  }

  if (item.thumbnail) {
    lines.push(`![${item.label}](${item.thumbnail})`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
}

function exportMarkdown(): void {
  const lines: string[] = [];
  const folderIds = new Set(folders.map((f) => f.id));
  lines.push(`# Gathered Collection`);
  lines.push(`> ${collected.length} items collected on ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Folders and their items
  for (const folder of folders) {
    lines.push(`## ${folder.name}`);
    lines.push('');
    const folderItems = collected.filter((item) => item.gather_folder === folder.id);
    for (const item of folderItems) {
      renderMarkdownItem(item, lines, 2);
    }
  }

  // Root-level items
  const rootItems = collected.filter((item) =>
    !item.gather_folder || !folderIds.has(item.gather_folder),
  );
  for (const item of rootItems) {
    renderMarkdownItem(item, lines, 1);
  }

  navigator.clipboard.writeText(lines.join('\n'));

  const original = markdownBtn.textContent;
  markdownBtn.textContent = 'Copied!';
  setTimeout(() => { markdownBtn.textContent = original; }, 1500);
}

// --- Netscape bookmark HTML export ---

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportBookmarks(): void {
  const folderIds = new Set(folders.map((f) => f.id));
  const lines: string[] = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<!-- This is an automatically generated file. -->');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Gathered Collection</TITLE>');
  lines.push('<H1>Gathered Collection</H1>');
  lines.push('<DL><p>');

  // Folders and their items
  for (const folder of folders) {
    lines.push(`    <DT><H3>${escapeHtml(folder.name)}</H3>`);
    lines.push(`    <DL><p>`);
    const folderItems = collected.filter((item) => item.gather_folder === folder.id);
    for (const item of folderItems) {
      lines.push(`        <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.label)}</A>`);
    }
    lines.push(`    </DL><p>`);
  }

  // Root-level items
  const rootItems = collected.filter((item) =>
    !item.gather_folder || !folderIds.has(item.gather_folder),
  );
  for (const item of rootItems) {
    lines.push(`    <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.label)}</A>`);
  }

  lines.push('</DL><p>');

  const blob = new Blob([lines.join('\n')], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gathered-bookmarks.html';
  a.click();
  URL.revokeObjectURL(url);

  const original = bookmarksBtn.textContent;
  bookmarksBtn.textContent = 'Saved!';
  setTimeout(() => { bookmarksBtn.textContent = original; }, 1500);
}

// --- Save Gather (full round-trip JSON) ---

function buildGatherExport(): Record<string, unknown> {
  const config = buildExportConfig();

  // Add gather_folder to each item in allLinks
  const allLinks = config.allLinks as Record<string, Record<string, unknown>>;
  for (const item of collected) {
    const key = item.id.replace(/[^a-zA-Z0-9_]/g, '_');
    if (allLinks[key] && item.gather_folder) {
      allLinks[key].gather_folder = item.gather_folder;
    }
  }

  if (folders.length > 0) {
    (config as Record<string, unknown>).gather = { folders: [...folders] };
  }

  return config;
}

function saveGather(): void {
  const data = buildGatherExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gather-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const original = saveBtn.textContent;
  saveBtn.textContent = 'Saved!';
  setTimeout(() => { saveBtn.textContent = original; }, 1500);
}

// --- JSON import (file drop or paste) ---

function isValidItem(obj: unknown): obj is CollectedItem {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.url === 'string' && typeof o.label === 'string';
}

function exportEntryToItem(key: string, entry: Record<string, unknown>): CollectedItem {
  return {
    id: (entry.id as string) || key,
    label: (entry.label as string) || key,
    url: (entry.url as string) || '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    description: (entry.description as string) || '',
    thumbnail: (entry.thumbnail as string) || '',
    createdAt: (entry.createdAt as string) || '',
    meta: (typeof entry.meta === 'object' && entry.meta !== null ? entry.meta : {}) as Record<string, unknown>,
    gather_folder: (entry.gather_folder as string) || undefined,
  };
}

function importJSON(data: unknown): number {
  let items: CollectedItem[] = [];
  let importedFolders: GatherFolder[] = [];

  if (Array.isArray(data)) {
    items = data.filter(isValidItem);
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    if (obj.allLinks && typeof obj.allLinks === 'object') {
      for (const [key, entry] of Object.entries(obj.allLinks as Record<string, Record<string, unknown>>)) {
        const item = exportEntryToItem(key, entry);
        if (item.url) items.push(item);
      }
    }

    if (obj.gather && typeof obj.gather === 'object') {
      const gather = obj.gather as Record<string, unknown>;
      if (Array.isArray(gather.folders)) {
        importedFolders = gather.folders.filter(
          (f: unknown): f is GatherFolder =>
            !!f && typeof f === 'object' && typeof (f as GatherFolder).id === 'string',
        );
      }
    }
  }

  for (const f of importedFolders) {
    if (!folders.some((existing) => existing.id === f.id)) {
      folders.push(f);
    }
  }

  let count = 0;
  for (const item of items) {
    if (!collected.some((c) => c.url === item.url)) {
      collected.unshift(item);
      count++;
    }
  }

  if (count > 0 || importedFolders.length > 0) {
    renderFullTray();
    persistGather();
  }

  return count;
}

function handleImportFile(file: File): void {
  file.text().then((text) => {
    try {
      const data = JSON.parse(text);
      const count = importJSON(data);
      showImportFeedback(count);
    } catch { /* not valid JSON — ignore */ }
  });
}

function showImportFeedback(count: number): void {
  if (count === 0) return;
  gatherTray.classList.add('json-import-active');
  setTimeout(() => { gatherTray.classList.remove('json-import-active'); }, 1200);
}

gatherTray.addEventListener('paste', (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData('text/plain');
  if (!text) return;

  try {
    const data = JSON.parse(text);
    const count = importJSON(data);
    showImportFeedback(count);
    if (count > 0) e.preventDefault();
  } catch { /* not JSON — ignore */ }
});

// --- External link drop (non-Alap links dragged onto the tray) ---

const SAFE_URL_RE = /^https?:\/\//i;

/**
 * Parse a dropped HTML fragment to extract href, label, and surrounding text.
 * Browsers wrap dragged links in an anchor tag inside the text/html payload.
 */
function parseDroppedHtml(html: string): { url: string; label: string; description: string } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const anchor = doc.querySelector('a[href]');
  if (!anchor) return null;

  const url = anchor.getAttribute('href') ?? '';
  if (!SAFE_URL_RE.test(url)) return null;

  const label = (anchor.textContent ?? '').trim();

  // Grab any text outside the anchor as a description hint
  const body = doc.body;
  if (anchor.parentNode) anchor.remove();
  const description = (body.textContent ?? '').trim().slice(0, 300);

  return { url, label: label || url, description };
}

/**
 * Build a CollectedItem from an external drop.
 * Tags are derived from the hostname; label and description come from the HTML fragment.
 */
function externalDropToItem(url: string, label: string, description: string): CollectedItem {
  let hostname = '';
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { /* skip */ }

  const tags: string[] = [];
  if (hostname) {
    const tag = normalizeTag(hostname.replace(/\./g, '_'));
    if (tag) tags.push(tag);
  }
  tags.push('external_drop');

  return {
    id: generateId('ext'),
    label,
    url,
    tags,
    description,
    thumbnail: '',
    createdAt: new Date().toISOString(),
    meta: { source: 'external_drop' },
  };
}

function onTrayDragOver(e: DragEvent): void {
  if (!e.dataTransfer) return;
  const types = e.dataTransfer.types;
  if (!types.includes('text/html') && !types.includes('text/uri-list')
    && !types.includes('text/plain') && !types.includes('Files')) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  gatherTray.classList.add('external-drop-active');
}

function onTrayDragLeave(): void {
  gatherTray.classList.remove('external-drop-active');
}

function onTrayDrop(e: DragEvent): void {
  e.preventDefault();
  gatherTray.classList.remove('external-drop-active');
  if (!e.dataTransfer) return;

  // JSON file import takes priority
  const files = Array.from(e.dataTransfer.files);
  const jsonFile = files.find((f) => f.name.endsWith('.json'));
  if (jsonFile) {
    handleImportFile(jsonFile);
    return;
  }

  // Check for enriched Alap item data (piggybacked from menu dragstart)
  const alapItemJson = e.dataTransfer.getData('application/x-alap-item');
  if (alapItemJson) {
    try {
      const item: CollectedItem = JSON.parse(alapItemJson);
      console.log('[Gather] tray drop — enriched item:', item.id, 'tags:', item.tags);
      addToTray(item);
      // Best-effort: merge any additional oEmbed data on top of config data
      tryEnrich(item).then((changed) => {
        if (changed) {
          persistGather();
          renderFullTray();
        }
      });
      return;
    } catch { /* malformed JSON — fall through */ }
  }

  // Try HTML — richest data for external drops
  const html = e.dataTransfer.getData('text/html');
  if (html) {
    const parsed = parseDroppedHtml(html);
    if (parsed) {
      const item = externalDropToItem(parsed.url, parsed.label, parsed.description);
      addToTray(item);
      tryEnrich(item).then((changed) => {
        if (changed) {
          persistGather();
          renderFullTray();
        }
      });
      return;
    }
  }

  // Fall back to plain text URLs
  const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (!text) return;

  const urls = text.split('\n').map((s) => s.trim()).filter((s) => SAFE_URL_RE.test(s));
  for (const url of urls) {
    let label = url;
    try { label = new URL(url).hostname; } catch { /* use full url */ }
    const item = externalDropToItem(url, label, '');
    addToTray(item);
    tryEnrich(item).then((changed) => {
      if (changed) {
        persistGather();
        renderFullTray();
      }
    });
  }
}

gatherTray.addEventListener('dragover', onTrayDragOver);
gatherTray.addEventListener('dragleave', onTrayDragLeave);
gatherTray.addEventListener('drop', onTrayDrop);

// --- Client-side enrichment (best-effort, no proxy) ---

// Only providers whose oEmbed endpoints send Access-Control-Allow-Origin.
// YouTube, Flickr, Twitter/X all block CORS from the browser.
const OEMBED_PROVIDERS: Array<{ pattern: RegExp; endpoint: string }> = [
  { pattern: /vimeo\.com\/\d+/, endpoint: 'https://vimeo.com/api/oembed.json?url=${url}' },
  { pattern: /open\.spotify\.com\//, endpoint: 'https://open.spotify.com/oembed?url=${url}' },
];

/**
 * Try to enrich a collected item using client-side oEmbed.
 * Returns true if the item was updated, false if nothing was available.
 */
async function tryEnrich(item: CollectedItem): Promise<boolean> {
  const provider = OEMBED_PROVIDERS.find((p) => p.pattern.test(item.url));
  if (!provider) return false;

  try {
    const fetchUrl = provider.endpoint.replace('${url}', encodeURIComponent(item.url));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = await response.json();
    const raw = parseOembedResponse(data);
    const sanitized = sanitizeRaw(raw);

    const hostname = new URL(item.url).hostname.replace(/^www\./, '');
    const fields = applyRule(sanitized, hostname, item.url);

    let changed = false;

    if (fields.title && fields.title !== hostname) {
      item.label = fields.title;
      changed = true;
    }
    if (fields.description) {
      item.description = fields.description;
      changed = true;
    }
    if (fields.thumbnail) {
      item.thumbnail = fields.thumbnail;
      changed = true;
    }
    if (fields.tags.length > 0) {
      const merged = new Set([...item.tags, ...fields.tags]);
      item.tags = [...merged];
      changed = true;
    }

    return changed;
  } catch {
    return false;
  }
}

/**
 * Handle the enrich button click on a tray item.
 */
async function onEnrichClick(id: string, btn: HTMLButtonElement): Promise<void> {
  const item = collected.find((c) => c.id === id);
  if (!item) return;

  btn.textContent = '\u2026';
  btn.disabled = true;

  const enriched = await tryEnrich(item);

  if (enriched) {
    // Update the label in the tray
    const li = trayList.querySelector(`[data-gather-id="${CSS.escape(id)}"]`);
    if (li) {
      const label = li.querySelector('.gather-item-label');
      if (label) {
        label.textContent = item.label;
        (label as HTMLElement).title = item.url;
      }
    }
    btn.textContent = '\u2713';
    persistGather();
  } else {
    btn.textContent = '\u2014';
  }

  setTimeout(() => { btn.remove(); }, 1200);
}

// --- Remove, clear, and export handlers ---

trayList.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as HTMLElement).closest('.gather-item-remove');
  if (!btn) return;
  const li = btn.closest('li');
  if (!li) return;
  const id = li.getAttribute('data-gather-id');
  if (id) removeFromTray(id);
});

clearBtn.addEventListener('click', clearTray);
exportBtn.addEventListener('click', exportJSON);
markdownBtn.addEventListener('click', exportMarkdown);
bookmarksBtn.addEventListener('click', exportBookmarks);
saveBtn.addEventListener('click', saveGather);

// --- Gather context ---
//
// When launching a lightbox or lens from the tray, the context is the
// collection itself — not the page config. Tag clicks, expressions, and
// navigation all resolve against only the collected items.

function buildGatherConfig(): AlapConfig {
  const allLinks: Record<string, AlapLink> = {};

  for (const item of collected) {
    const key = item.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const entry: AlapLink = {
      label: item.label,
      url: item.url,
    };
    if (item.tags.length > 0) entry.tags = item.tags;
    if (item.description) entry.description = item.description;
    if (item.thumbnail) entry.thumbnail = item.thumbnail;
    if (item.createdAt) entry.createdAt = item.createdAt;
    if (Object.keys(item.meta).length > 0) entry.meta = item.meta;

    allLinks[key] = entry;
  }

  return {
    settings: { listType: 'ul', menuTimeout: 8000 },
    allLinks,
  };
}

function collectedToLinks(): ResolvedLink[] {
  return collected.map((item) => ({
    id: item.id.replace(/[^a-zA-Z0-9_]/g, '_'),
    label: item.label,
    url: item.url,
    tags: item.tags,
    description: item.description || undefined,
    thumbnail: item.thumbnail || undefined,
    createdAt: item.createdAt || undefined,
    meta: Object.keys(item.meta).length > 0 ? item.meta : undefined,
  }));
}

// --- Lightbox (gather context) ---

function openLightbox(): void {
  if (collected.length === 0) return;

  const gatherConfig = buildGatherConfig();
  const lightbox = new AlapLightbox(gatherConfig, { selector: '.gather-lightbox-noop' });
  lightbox.openWith({ links: collectedToLinks(), initialIndex: 0 });
}

lightboxBtn.addEventListener('click', openLightbox);

// --- Lens (gather context) ---

function openLens(): void {
  if (collected.length === 0) return;

  const gatherConfig = buildGatherConfig();
  const lens = new AlapLens(gatherConfig, { selector: '.gather-lens-noop' });
  lens.openWith({ links: collectedToLinks(), initialIndex: 0 });
}

lensBtn.addEventListener('click', openLens);

// --- Link data lookup ---

/**
 * Find the trigger element that currently has an open menu.
 * Returns the expression and anchor ID needed to resolve links.
 */
function getActiveTrigger(): { expression: string; anchorId: string | undefined } | null {
  const trigger = document.querySelector<HTMLElement>('[aria-expanded="true"]');
  if (!trigger) return null;
  const expression = trigger.getAttribute('data-alap-linkitems');
  if (!expression) return null;
  return { expression, anchorId: trigger.id || undefined };
}

/**
 * Look up the full ResolvedLink data for a menu item by matching its href
 * against the currently resolved set of links from the engine.
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}


function lookupLink(engine: AlapEngine, url: string, triggerInfo?: { expression: string; anchorId: string | undefined } | null): ResolvedLink | null {
  const active = triggerInfo ?? getActiveTrigger();
  if (!active) return null;

  const normalized = normalizeUrl(url);
  const links = engine.resolve(active.expression, active.anchorId);
  return links.find((link) => normalizeUrl(link.url) === normalized) ?? null;
}

/**
 * Convert a ResolvedLink to a CollectedItem, preserving all available metadata.
 */
function toCollectedItem(resolved: ResolvedLink): CollectedItem {
  return {
    id: resolved.guid || resolved.id || resolved.url,
    label: resolved.label || resolved.id,
    url: resolved.url,
    tags: resolved.tags ?? [],
    description: resolved.description ?? '',
    thumbnail: resolved.thumbnail ?? '',
    createdAt: resolved.createdAt != null ? String(resolved.createdAt) : '',
    meta: resolved.meta ?? {},
  };
}

/**
 * Build a CollectedItem from the DOM element as a fallback
 * when the engine lookup fails.
 */
function toCollectedItemFromDom(el: HTMLAnchorElement): CollectedItem {
  return {
    id: el.getAttribute('data-alap-guid') || el.href || el.textContent || '',
    label: el.textContent || '',
    url: el.href || '',
    tags: [],
    description: '',
    thumbnail: el.getAttribute('data-alap-thumbnail') || '',
    createdAt: '',
    meta: {},
  };
}

// --- Enrich native drags from menu items with engine data ---

/**
 * When a menu item is dragged natively (HTML5 drag), piggyback the full
 * resolved item data into dataTransfer so the tray drop handler can use it.
 */
document.addEventListener('dragstart', (e) => {
  const menuItem = (e.target as HTMLElement).closest<HTMLAnchorElement>(
    '#alapelem a[role="menuitem"]',
  );
  if (!menuItem || !e.dataTransfer) return;
  if (!engine) return;

  const triggerInfo = getActiveTrigger();
  if (!triggerInfo) return;

  const url = menuItem.href;
  const resolved = lookupLink(engine, url, triggerInfo);
  if (resolved) {
    const item = toCollectedItem(resolved);
    e.dataTransfer.setData('application/x-alap-item', JSON.stringify(item));
    console.log('[Gather] enriched dragstart:', item.id, item.label, 'tags:', item.tags);
  }
}, { capture: true });

// --- Drag interaction (delegated on document, scoped to menu items) ---

let engine: AlapEngine | null = null;

let dragState: {
  startX: number;
  startY: number;
  itemEl: HTMLAnchorElement;
  ghost: HTMLElement | null;
  isDragging: boolean;
  triggerInfo: { expression: string; anchorId: string | undefined } | null;
} | null = null;

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return;

  const menuItem = (e.target as HTMLElement).closest<HTMLAnchorElement>(
    '#alapelem a[role="menuitem"]',
  );
  if (!menuItem) return;

  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    itemEl: menuItem,
    ghost: null,
    isDragging: false,
    triggerInfo: getActiveTrigger(),
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', cleanupDrag);
}

function onPointerMove(e: PointerEvent): void {
  if (!dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!dragState.isDragging) {
    if (distance < DRAG_THRESHOLD_PX) return;

    dragState.isDragging = true;
    dragState.itemEl.classList.add('gather-dragging');

    const ghost = document.createElement('div');
    ghost.className = 'gather-ghost';
    ghost.textContent = dragState.itemEl.textContent || '';
    document.body.appendChild(ghost);
    dragState.ghost = ghost;

    dropzone.classList.add('active');
  }

  if (dragState.ghost) {
    dragState.ghost.style.left = `${e.clientX}px`;
    dragState.ghost.style.top = `${e.clientY}px`;
  }

  const dropRect = dropzone.getBoundingClientRect();
  const tray = document.getElementById('gather-tray');
  const trayRect = tray ? tray.getBoundingClientRect() : dropRect;

  const overDrop = (e.clientX >= dropRect.left && e.clientX <= dropRect.right
    && e.clientY >= dropRect.top && e.clientY <= dropRect.bottom)
    || (e.clientX >= trayRect.left && e.clientX <= trayRect.right
    && e.clientY >= trayRect.top && e.clientY <= trayRect.bottom);

  dropzone.classList.toggle('hovering', overDrop);
}

function cleanupDrag(): void {
  if (!dragState) return;
  dragState.itemEl.classList.remove('gather-dragging');
  if (dragState.ghost) {
    dragState.ghost.remove();
  }
  dropzone.classList.remove('active', 'hovering');
  dragState = null;
}

function onPointerUp(e: PointerEvent): void {
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', cleanupDrag);

  if (!dragState) return;

  if (dragState.isDragging) {
    e.preventDefault();

    dragState.itemEl.addEventListener(
      'click',
      (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      },
      { once: true, capture: true },
    );

    const dropRect = dropzone.getBoundingClientRect();
    const tray = document.getElementById('gather-tray');
    const trayRect = tray ? tray.getBoundingClientRect() : dropRect;

    const inZone = (e.clientX >= dropRect.left && e.clientX <= dropRect.right
      && e.clientY >= dropRect.top && e.clientY <= dropRect.bottom)
      || (e.clientX >= trayRect.left && e.clientX <= trayRect.right
      && e.clientY >= trayRect.top && e.clientY <= trayRect.bottom);

    console.log('[Gather] pointerUp — isDragging:', dragState.isDragging, 'inZone:', inZone, 'engine:', !!engine, 'triggerInfo:', dragState.triggerInfo);
    if (inZone && engine) {
      const url = dragState.itemEl.href;
      const resolved = lookupLink(engine, url, dragState.triggerInfo);
      console.log('[Gather] lookup:', url, '→', resolved ? `found (tags: ${resolved.tags})` : 'NOT FOUND, using DOM fallback');
      const item = resolved
        ? toCollectedItem(resolved)
        : toCollectedItemFromDom(dragState.itemEl);
      addToTray(item);
    }
  }

  cleanupDrag();
}

document.addEventListener('pointerdown', onPointerDown);

// Safety net: if a drag ghost lingers (menu dismissed mid-drag, etc.), kill it on click
document.addEventListener('click', () => {
  if (dragState) cleanupDrag();
}, true);

// --- Init ---

async function init() {
  restoreGather();
  renderFullTray();
  initHighNotes();

  const ui = new AlapUI(demoConfig);
  engine = ui.getEngine();

  const triggers = document.querySelectorAll<HTMLElement>('[data-alap-linkitems]');
  const atprotoExpressions = Array.from(triggers)
    .map((el) => el.dataset.alapLinkitems ?? '')
    .filter((expr) => expr.includes(':atproto:'));

  if (atprotoExpressions.length > 0) {
    await engine.preResolve(atprotoExpressions);
  }

  (window as any).alapUI = ui;
  (window as any).gathered = collected;
}

init();
