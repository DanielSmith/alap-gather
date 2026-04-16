/**
 * Copyright 2026 Daniel Smith
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared constants for Alap Gather.
 */

// --- Timing ---

export const BUTTON_FEEDBACK_MS = 1500;
export const IMPORT_FEEDBACK_MS = 1200;
export const FETCH_TIMEOUT_MS = 5000;

// --- Drag ---

export const DRAG_THRESHOLD_PX = 8;

// --- HighNotes card layout ---

export const CARD_WIDTH = 280;
export const CARD_GAP = 16;
export const MIN_VISIBLE_PX = 40;

// --- HighNotes card animation ---

export const HIGHLIGHT_MS = 800;
export const TRANSITION_CLEAR_MS = 300;
export const HIGHLIGHT_SHADOW = '0 0 0 3px #88bbff, 0 8px 32px rgba(0, 0, 0, 0.4)';

// --- MIME types ---

export const GATHER_ITEM_MIME = 'application/x-gather-item';
export const GATHER_FOLDER_MIME = 'application/x-gather-folder';
export const ALAP_ITEM_MIME = 'application/x-alap-item';

// --- Selectors ---

export const MENU_ITEM_SELECTOR = '#alapelem a[role="menuitem"]';
