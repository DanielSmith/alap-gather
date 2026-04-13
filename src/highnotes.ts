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

/**
 * HighNotes — Floating cards materialized from the gather tray.
 *
 * Cards float in their own z-plane above the page. They never enter
 * the host DOM flow. Two positioning modes: viewport-pinned (fixed)
 * and document-anchored (absolute, scrolls with page).
 */

import { AlapLens, AlapLightbox } from 'alap';
import type { AlapConfig, AlapLink, ResolvedLink } from 'alap/core';
import 'alap/lens.css';
import 'alap/lightbox.css';
import type { CollectedItem, HighNoteCard } from './types';
import { cards, collected, findItem, generateId, persistCards, restoreCards } from './state';

// --- Constants ---

const Z_FLOOR = 20000;
const Z_CEILING = 30000;
const Z_STEP = 100;
const GATHER_ITEM_MIME = 'application/x-gather-item';

// --- Stacking state ---

// Most-recently-touched order. Index 0 = topmost card.
const stackOrder: string[] = [];
let highWaterMark = Z_FLOOR;

// --- Card layer ---

let layer: HTMLElement | null = null;

function ensureLayer(): HTMLElement {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'highnotes-layer';
  layer.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: 0',
    'width: 100%',
    'height: 0',
    'pointer-events: none',
    'z-index: ' + Z_FLOOR,
    'overflow: visible',
  ].join(';');
  document.body.appendChild(layer);
  return layer;
}

// --- Z-stacking ---

function raiseCard(cardId: string): void {
  const idx = stackOrder.indexOf(cardId);
  if (idx > 0) stackOrder.splice(idx, 1);
  if (idx !== 0) stackOrder.unshift(cardId);

  highWaterMark += Z_STEP;

  if (highWaterMark >= Z_CEILING) {
    rebaseZIndices();
    // rebase already assigned correct z to every card including this one
    return;
  }

  const el = document.getElementById(`highnote-${cardId}`);
  if (el) el.style.zIndex = String(highWaterMark);
}

function rebaseZIndices(): void {
  console.log('[HighNotes] REBASE #' + Date.now(), '— highWaterMark was', highWaterMark, '— rebasing', stackOrder.length, 'cards');
  // Walk oldest → newest so newest gets the highest z
  for (let i = stackOrder.length - 1; i >= 0; i--) {
    const z = Z_FLOOR + ((stackOrder.length - 1 - i) * Z_STEP);
    const el = document.getElementById(`highnote-${stackOrder[i]}`);
    if (el) el.style.zIndex = String(z);
  }
  // Reset high water mark to just above the topmost card
  highWaterMark = Z_FLOOR + ((stackOrder.length - 1) * Z_STEP);
}

// --- Card rendering ---

function renderCard(card: HighNoteCard): HTMLElement {
  const el = document.createElement('div');
  el.id = `highnote-${card.id}`;
  el.className = 'highnote-card';
  const pos = card.mode === 'pinned' ? 'fixed' : 'absolute';
  el.style.cssText = [
    `position: ${pos}`,
    'pointer-events: auto',
    `left: ${card.x}px`,
    `top: ${card.y}px`,
    `z-index: ${highWaterMark}`,
  ].join(';');

  const item = card.item;

  // Header with label and controls
  const header = document.createElement('div');
  header.className = 'highnote-header';

  const label = document.createElement('span');
  label.className = 'highnote-label';
  label.textContent = item.label;
  header.appendChild(label);

  const controls = document.createElement('span');
  controls.className = 'highnote-controls';

  // Pin toggle
  const pinBtn = document.createElement('button');
  pinBtn.className = 'highnote-pin';
  pinBtn.type = 'button';
  pinBtn.title = card.mode === 'pinned' ? 'Unpin (scroll with page)' : 'Pin to viewport';
  pinBtn.setAttribute('aria-label', pinBtn.title);
  pinBtn.innerHTML = card.mode === 'pinned' ? pinFilledSvg() : pinOutlineSvg();
  pinBtn.addEventListener('click', () => togglePin(card.id));
  controls.appendChild(pinBtn);

  // Dismiss
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'highnote-dismiss';
  dismissBtn.type = 'button';
  dismissBtn.title = 'Dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss card');
  dismissBtn.textContent = '\u00d7';
  dismissBtn.addEventListener('click', () => dismiss(card.id));
  controls.appendChild(dismissBtn);

  header.appendChild(controls);
  el.appendChild(header);

  // Body — everything below header, collapsible
  const body = document.createElement('div');
  body.className = 'highnote-body';
  if (card.collapsed) body.style.display = 'none';

  // Thumbnail
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.className = 'highnote-thumbnail';
    img.src = item.thumbnail;
    img.alt = item.label;
    body.appendChild(img);
  }

  // Description
  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'highnote-description';
    desc.textContent = item.description;
    body.appendChild(desc);
  }

  // Tags (clickable — launches lens filtered to that tag)
  if (item.tags.length > 0) {
    const tagsEl = document.createElement('div');
    tagsEl.className = 'highnote-tags';
    for (const tag of item.tags) {
      const chip = document.createElement('span');
      chip.className = 'highnote-tag';
      chip.textContent = tag;
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openLensForTag(tag);
      });
      tagsEl.appendChild(chip);
    }
    body.appendChild(tagsEl);
  }

  // Visit link
  const visitLink = document.createElement('a');
  visitLink.className = 'highnote-visit';
  visitLink.href = item.url;
  visitLink.target = '_blank';
  visitLink.rel = 'noopener';
  visitLink.textContent = 'Visit \u2192';
  body.appendChild(visitLink);

  el.appendChild(body);

  // Double-click header to toggle expand/collapse
  header.addEventListener('dblclick', (e) => {
    e.preventDefault();
    card.collapsed = !card.collapsed;
    body.style.display = card.collapsed ? 'none' : '';
    el.classList.toggle('highnote-collapsed', card.collapsed);
    persistCards();
  });

  // Drag to reposition
  makeDraggable(el, card);

  // Raise on interact
  el.addEventListener('pointerdown', () => raiseCard(card.id));

  return el;
}

// --- Drag to reposition ---

function makeDraggable(el: HTMLElement, card: HighNoteCard): void {
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  const header = el.querySelector('.highnote-header') as HTMLElement;
  if (!header) return;

  header.style.cursor = 'grab';

  header.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    origX = card.x;
    origY = card.y;
    header.style.cursor = 'grabbing';
    header.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      card.x = origX + (ev.clientX - startX);
      card.y = origY + (ev.clientY - startY);
      el.style.left = `${card.x}px`;
      el.style.top = `${card.y}px`;
    };

    const onUp = () => {
      header.style.cursor = 'grab';
      header.removeEventListener('pointermove', onMove);
      header.removeEventListener('pointerup', onUp);

      // Clamp so the header always stays grabbable
      const headerH = header.offsetHeight;
      const cardW = el.offsetWidth;
      const minVisible = 40;
      card.x = Math.max(-cardW + minVisible, Math.min(window.innerWidth - minVisible, card.x));
      card.y = Math.max(0, Math.min(window.innerHeight - headerH, card.y));
      el.style.left = `${card.x}px`;
      el.style.top = `${card.y}px`;

      persistCards();
    };

    header.addEventListener('pointermove', onMove);
    header.addEventListener('pointerup', onUp);
  });
}

// --- Pin toggle ---

function togglePin(cardId: string): void {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;

  card.mode = card.mode === 'pinned' ? 'anchored' : 'pinned';

  const el = document.getElementById(`highnote-${cardId}`);
  if (!el) return;

  if (card.mode === 'pinned') {
    el.style.position = 'fixed';
  } else {
    el.style.position = 'absolute';
    card.x += window.scrollX;
    card.y += window.scrollY;
    el.style.left = `${card.x}px`;
    el.style.top = `${card.y}px`;
  }

  const pinBtn = el.querySelector('.highnote-pin') as HTMLButtonElement;
  if (pinBtn) {
    pinBtn.innerHTML = card.mode === 'pinned' ? pinFilledSvg() : pinOutlineSvg();
    pinBtn.title = card.mode === 'pinned' ? 'Unpin (scroll with page)' : 'Pin to viewport';
    pinBtn.setAttribute('aria-label', pinBtn.title);
  }

  persistCards();
}

// --- Dismiss ---

function dismiss(cardId?: string): void {
  if (!cardId) {
    cards.length = 0;
    stackOrder.length = 0;
    const l = ensureLayer();
    l.innerHTML = '';
    persistCards();
    return;
  }

  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx !== -1) cards.splice(idx, 1);

  const stackIdx = stackOrder.indexOf(cardId);
  if (stackIdx !== -1) stackOrder.splice(stackIdx, 1);

  const el = document.getElementById(`highnote-${cardId}`);
  if (el) el.remove();

  persistCards();
}

// --- Show / Hide ---

function show(cardId?: string): void {
  const targets = cardId ? cards.filter((c) => c.id === cardId) : cards;
  for (const card of targets) {
    card.visible = true;
    const el = document.getElementById(`highnote-${card.id}`);
    if (el) el.style.display = '';
  }
  persistCards();
}

function hide(cardId?: string): void {
  const targets = cardId ? cards.filter((c) => c.id === cardId) : cards;
  for (const card of targets) {
    card.visible = false;
    const el = document.getElementById(`highnote-${card.id}`);
    if (el) el.style.display = 'none';
  }
  persistCards();
}

// --- Move ---

function moveCard(cardId: string, x: number, y: number, relative = false): void {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return;
  card.x = relative ? card.x + x : x;
  card.y = relative ? card.y + y : y;
  const el = document.getElementById(`highnote-${card.id}`);
  if (el) {
    el.style.left = `${card.x}px`;
    el.style.top = `${card.y}px`;
  }
  persistCards();
}

// --- Surface an existing card (duplicate drag prevention) ---

function surfaceExisting(card: HighNoteCard): void {
  // Make visible if hidden
  card.visible = true;
  const el = document.getElementById(`highnote-${card.id}`);
  if (el) {
    el.style.display = '';

    // Raise to top of stack
    raiseCard(card.id);

    // Brief highlight to draw the eye
    el.style.transition = 'box-shadow 0.3s';
    el.style.boxShadow = '0 0 0 3px #88bbff, 0 8px 32px rgba(0, 0, 0, 0.4)';
    setTimeout(() => {
      el.style.boxShadow = '';
      setTimeout(() => { el.style.transition = ''; }, 300);
    }, 800);

    // If document-anchored, scroll viewport to show it
    if (card.mode === 'anchored') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  persistCards();
  console.log('[HighNotes] Surfaced existing card:', card.id, card.item.label);
}

// --- Materialize: create a card from a collected item ---

function materialize(itemId: string, x: number, y: number): HighNoteCard | null {
  const item = findItem(itemId);
  if (!item) return null;

  // If a card for this item already exists, surface it instead of duplicating
  const existing = cards.find((c) => c.item.id === itemId);
  if (existing) {
    surfaceExisting(existing);
    return existing;
  }

  const card: HighNoteCard = {
    id: generateId('hn'),
    item: { ...item },
    x,
    y,
    mode: 'pinned',
    visible: true,
    collapsed: false,
  };

  cards.push(card);
  stackOrder.unshift(card.id);
  highWaterMark += Z_STEP;
  if (highWaterMark >= Z_CEILING) rebaseZIndices();

  const el = renderCard(card);
  ensureLayer().appendChild(el);
  persistCards();

  console.log('[HighNotes] Materialized:', card.id, item.label, `at (${x}, ${y})`);
  return card;
}

// --- Drop handler: listen for gather items dropped outside the tray ---

function initDropHandler(): void {
  const tray = document.getElementById('gather-tray');
  console.log('[HighNotes] initDropHandler — tray:', tray ? 'found' : 'NOT FOUND');

  document.addEventListener('dragover', (e) => {
    const hasGatherData = e.dataTransfer?.types.includes(GATHER_ITEM_MIME);
    const inTray = tray && tray.contains(e.target as Node);
    if (!hasGatherData) return;
    if (inTray) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  });

  document.addEventListener('drop', (e) => {
    console.log('[HighNotes] drop event — types:', Array.from(e.dataTransfer?.types ?? []));
    if (!e.dataTransfer?.types.includes(GATHER_ITEM_MIME)) {
      console.log('[HighNotes] drop ignored — no gather MIME type');
      return;
    }
    if (tray && tray.contains(e.target as Node)) {
      console.log('[HighNotes] drop ignored — inside tray');
      return;
    }
    e.preventDefault();

    const itemId = e.dataTransfer?.getData(GATHER_ITEM_MIME);
    console.log('[HighNotes] drop accepted — itemId:', itemId, 'at', e.clientX, e.clientY);
    if (!itemId) return;

    materialize(itemId, e.clientX, e.clientY);
  });
}

// --- Tag click → lens ---

function openLensForTag(tag: string): void {
  const matching = collected.filter((item) => item.tags.includes(tag));
  if (matching.length === 0) return;

  const allLinks: Record<string, AlapLink> = {};
  const links: ResolvedLink[] = [];

  for (const item of matching) {
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

    links.push({ id: key, ...entry });
  }

  const config: AlapConfig = {
    settings: { listType: 'ul', menuTimeout: 8000 },
    allLinks,
  };

  const lightbox = new AlapLightbox(config, { selector: '.highnote-lightbox-noop' });
  lightbox.openWith({ links, initialIndex: 0 });
}

// --- Restore persisted cards on load ---

function restoreRenderedCards(): void {
  restoreCards();
  if (cards.length === 0) return;

  const l = ensureLayer();
  for (const card of cards) {
    stackOrder.push(card.id);
    highWaterMark += Z_STEP;
    const el = renderCard(card);
    if (!card.visible) el.style.display = 'none';
    l.appendChild(el);
  }

  if (highWaterMark >= Z_CEILING) rebaseZIndices();
}

// --- SVG icons ---

function pinFilledSvg(): string {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2z"/></svg>';
}

function pinOutlineSvg(): string {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2z"/></svg>';
}

// --- Summon or create (called from gather tray double-click) ---

export function summonOrCreate(itemId: string, nearX: number, nearY: number): void {
  const existing = cards.find((c) => c.item.id === itemId);
  if (existing) {
    // Move the card to the requested position
    existing.x = nearX;
    existing.y = nearY;
    existing.mode = 'pinned';
    existing.visible = true;

    const el = document.getElementById(`highnote-${existing.id}`);
    if (el) {
      el.style.position = 'fixed';
      el.style.left = `${existing.x}px`;
      el.style.top = `${existing.y}px`;
      el.style.display = '';

      // Update pin icon
      const pinBtn = el.querySelector('.highnote-pin') as HTMLButtonElement;
      if (pinBtn) {
        pinBtn.innerHTML = pinFilledSvg();
        pinBtn.title = 'Unpin (scroll with page)';
        pinBtn.setAttribute('aria-label', pinBtn.title);
      }
    }

    surfaceExisting(existing);
    persistCards();
  } else {
    // Not yet a HighNote — materialize it
    materialize(itemId, nearX, nearY);
  }
}

// --- Layer visibility toggle ---

let layerVisible = true;

function toggleLayerVisibility(): void {
  layerVisible = !layerVisible;
  if (layer) {
    layer.style.display = layerVisible ? '' : 'none';
  }

  const btn = document.getElementById('highnotes-toggle');
  if (btn) {
    btn.style.opacity = layerVisible ? '1' : '0.4';
    btn.title = layerVisible ? 'Hide HighNotes' : 'Show HighNotes';
  }
}

// --- Public API (attached to the layer element) ---

export function initHighNotes(): void {
  console.log('[HighNotes] initializing');
  initDropHandler();
  restoreRenderedCards();

  const toggleBtn = document.getElementById('highnotes-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleLayerVisibility);
  }

  // Expose API on window for console testing
  (window as any).highNotes = {
    dismiss,
    show,
    hide,
    moveCard,
    toggleLayerVisibility,
    getCards: () => [...cards],
    materialize,
  };
}
