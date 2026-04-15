import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CollectedItem, GatherFolder, HighNoteCard } from '../src/types';

// State module uses mutable arrays — we need fresh imports each test.
// Re-import after clearing the module cache.

let state: typeof import('../src/state');

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  state = await import('../src/state');
});

// --- generateId ---

describe('generateId', () => {
  it('starts with the given prefix', () => {
    const id = state.generateId('item');
    expect(id).toMatch(/^item_/);
  });

  it('includes a timestamp segment', () => {
    const id = state.generateId('test');
    const parts = id.split('_');
    // prefix_timestamp_random
    expect(parts.length).toBe(3);
    const ts = Number(parts[1]);
    expect(ts).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => state.generateId('x')));
    expect(ids.size).toBe(100);
  });
});

// --- findItem ---

describe('findItem', () => {
  it('finds an item by id', () => {
    const item: CollectedItem = {
      id: 'test_1', label: 'Test', url: 'https://example.com',
      tags: [], description: '', thumbnail: '', createdAt: '', meta: {},
    };
    state.collected.push(item);
    expect(state.findItem('test_1')).toBe(item);
  });

  it('returns undefined for missing id', () => {
    expect(state.findItem('nonexistent')).toBeUndefined();
  });
});

// --- findCard ---

describe('findCard', () => {
  it('finds a card by id', () => {
    const card: HighNoteCard = {
      id: 'card_1',
      item: { id: 'i1', label: 'L', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
      x: 0, y: 0, mode: 'pinned', visible: true, collapsed: false,
    };
    state.cards.push(card);
    expect(state.findCard('card_1')).toBe(card);
  });

  it('returns undefined for missing id', () => {
    expect(state.findCard('nonexistent')).toBeUndefined();
  });
});

// --- setActiveFolderId ---

describe('setActiveFolderId', () => {
  it('sets the active folder', () => {
    state.setActiveFolderId('folder_1');
    expect(state.activeFolderId).toBe('folder_1');
  });

  it('clears with null', () => {
    state.setActiveFolderId('folder_1');
    state.setActiveFolderId(null);
    expect(state.activeFolderId).toBeNull();
  });
});

// --- Persistence: persistGather / restoreGather ---

describe('persistGather / restoreGather', () => {
  it('round-trips collected items through localStorage', async () => {
    const item: CollectedItem = {
      id: 'rt_1', label: 'Roundtrip', url: 'https://example.com',
      tags: ['tag1', 'tag2'], description: 'desc', thumbnail: 'thumb.jpg',
      createdAt: '2026-01-01', meta: { key: 'value' },
    };
    state.collected.push(item);
    state.persistGather();

    // Re-import to get fresh arrays
    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreGather();

    expect(fresh.collected).toHaveLength(1);
    expect(fresh.collected[0]).toEqual(item);
  });

  it('round-trips folders through localStorage', async () => {
    const folder: GatherFolder = { id: 'f_1', name: 'Test Folder', collapsed: false };
    state.folders.push(folder);
    state.persistGather();

    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreGather();

    expect(fresh.folders).toHaveLength(1);
    expect(fresh.folders[0].id).toBe('f_1');
    expect(fresh.folders[0].name).toBe('Test Folder');
  });

  it('strips legacy parent property from folders', async () => {
    // Simulate old format with parent property
    localStorage.setItem('gather_folders', JSON.stringify([
      { id: 'f_1', name: 'Old', collapsed: false, parent: 'root' },
    ]));

    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreGather();

    expect(fresh.folders[0]).not.toHaveProperty('parent');
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem('gather_items', 'not valid json{{{');

    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreGather();

    expect(fresh.collected).toHaveLength(0);
  });

  it('handles missing localStorage keys', async () => {
    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreGather();

    expect(fresh.collected).toHaveLength(0);
    expect(fresh.folders).toHaveLength(0);
  });
});

// --- Persistence: persistCards / restoreCards ---

describe('persistCards / restoreCards', () => {
  it('round-trips cards through localStorage', async () => {
    const card: HighNoteCard = {
      id: 'hn_1',
      item: { id: 'i1', label: 'Card Item', url: 'https://example.com', tags: ['test'], description: '', thumbnail: '', createdAt: '', meta: {} },
      x: 100, y: 200, mode: 'pinned', visible: true, collapsed: false,
    };
    state.cards.push(card);
    state.persistCards();

    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreCards();

    expect(fresh.cards).toHaveLength(1);
    expect(fresh.cards[0].id).toBe('hn_1');
    expect(fresh.cards[0].x).toBe(100);
    expect(fresh.cards[0].y).toBe(200);
    expect(fresh.cards[0].mode).toBe('pinned');
  });

  it('handles corrupted card storage gracefully', async () => {
    localStorage.setItem('highnotes_cards', '!!!');

    vi.resetModules();
    const fresh = await import('../src/state');
    fresh.restoreCards();

    expect(fresh.cards).toHaveLength(0);
  });
});
