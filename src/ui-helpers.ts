/**
 * Copyright 2026 Daniel Smith
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared UI helpers for Alap Gather.
 */

import { BUTTON_FEEDBACK_MS } from './constants';

// --- Button feedback ---

/**
 * Flash a temporary message on a button, then restore the original text.
 */
export function showButtonFeedback(
  btn: HTMLElement,
  message: string,
  duration = BUTTON_FEEDBACK_MS,
): void {
  const original = btn.textContent;
  btn.textContent = message;
  setTimeout(() => { btn.textContent = original; }, duration);
}

// --- Pin button ---

function pinFilledSvg(): string {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2z"/></svg>';
}

function pinOutlineSvg(): string {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2z"/></svg>';
}

/**
 * Update a pin button's icon, title, and aria-label to match the card mode.
 */
export function updatePinButton(
  btn: HTMLButtonElement,
  mode: 'pinned' | 'anchored',
): void {
  btn.innerHTML = mode === 'pinned' ? pinFilledSvg() : pinOutlineSvg();
  btn.title = mode === 'pinned' ? 'Unpin (scroll with page)' : 'Pin to viewport';
  btn.setAttribute('aria-label', btn.title);
}
