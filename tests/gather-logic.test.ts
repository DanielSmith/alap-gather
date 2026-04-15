/**
 * Tests for gather.ts logic.
 *
 * gather.ts grabs DOM elements at module scope, so we can't import it directly
 * in unit tests. Instead we test the logic patterns by reimplementing the pure
 * functions here. This validates the algorithms without requiring the full DOM.
 *
 * For functions that ARE importable (meta-utils, state), see their own test files.
 */

import { describe, it, expect } from 'vitest';
import type { CollectedItem, GatherFolder } from '../src/types';

// --- Helpers (mirroring gather.ts internals) ---

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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function toCollectedItem(resolved: { guid?: string; id: string; label: string; url: string; tags?: string[]; description?: string; thumbnail?: string; createdAt?: string | number; meta?: Record<string, unknown> }): CollectedItem {
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

// --- isValidItem ---

describe('isValidItem', () => {
  it('accepts object with url and label strings', () => {
    expect(isValidItem({ url: 'https://x.com', label: 'X' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidItem(null)).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidItem('string')).toBe(false);
    expect(isValidItem(42)).toBe(false);
  });

  it('rejects missing url', () => {
    expect(isValidItem({ label: 'No URL' })).toBe(false);
  });

  it('rejects missing label', () => {
    expect(isValidItem({ url: 'https://x.com' })).toBe(false);
  });

  it('rejects non-string url', () => {
    expect(isValidItem({ url: 42, label: 'X' })).toBe(false);
  });
});

// --- exportEntryToItem ---

describe('exportEntryToItem', () => {
  it('creates item from full entry', () => {
    const entry = {
      id: 'my_id', label: 'My Label', url: 'https://example.com',
      tags: ['tag1'], description: 'desc', thumbnail: 'thumb.jpg',
      createdAt: '2026-01-01', meta: { key: 'val' },
      gather_folder: 'f_1',
    };

    const item = exportEntryToItem('key', entry);
    expect(item.id).toBe('my_id');
    expect(item.label).toBe('My Label');
    expect(item.url).toBe('https://example.com');
    expect(item.tags).toEqual(['tag1']);
    expect(item.description).toBe('desc');
    expect(item.thumbnail).toBe('thumb.jpg');
    expect(item.meta).toEqual({ key: 'val' });
    expect(item.gather_folder).toBe('f_1');
  });

  it('falls back to key for id and label', () => {
    const item = exportEntryToItem('fallback_key', { url: 'https://x.com' });
    expect(item.id).toBe('fallback_key');
    expect(item.label).toBe('fallback_key');
  });

  it('defaults arrays and objects', () => {
    const item = exportEntryToItem('k', { url: 'https://x.com' });
    expect(item.tags).toEqual([]);
    expect(item.meta).toEqual({});
    expect(item.description).toBe('');
    expect(item.thumbnail).toBe('');
  });

  it('handles null meta gracefully', () => {
    const item = exportEntryToItem('k', { url: 'u', meta: null });
    expect(item.meta).toEqual({});
  });
});

// --- escapeHtml ---

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles combined escapes', () => {
    expect(escapeHtml('<a href="x&y">')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;');
  });

  it('passes through clean strings', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

// --- normalizeUrl ---

describe('normalizeUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeUrl('https://example.com///')).toBe('https://example.com');
  });

  it('leaves non-trailing slashes alone', () => {
    expect(normalizeUrl('https://example.com/path/to/page')).toBe('https://example.com/path/to/page');
  });

  it('handles url with no trailing slash', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });
});

// --- toCollectedItem ---

describe('toCollectedItem', () => {
  it('converts a full resolved link', () => {
    const resolved = {
      guid: 'guid_1', id: 'id_1', label: 'Label', url: 'https://x.com',
      tags: ['a', 'b'], description: 'desc', thumbnail: 'thumb.jpg',
      createdAt: '2026-01-01', meta: { source: 'test' },
    };

    const item = toCollectedItem(resolved);
    expect(item.id).toBe('guid_1');
    expect(item.label).toBe('Label');
    expect(item.tags).toEqual(['a', 'b']);
    expect(item.meta).toEqual({ source: 'test' });
  });

  it('falls back to id when guid missing', () => {
    const resolved = { id: 'id_1', label: 'L', url: 'u' };
    expect(toCollectedItem(resolved).id).toBe('id_1');
  });

  it('falls back to url when both guid and id missing', () => {
    const resolved = { id: '', label: 'L', url: 'https://x.com' };
    expect(toCollectedItem(resolved).id).toBe('https://x.com');
  });

  it('falls back to id for label when label missing', () => {
    const resolved = { id: 'my_id', label: '', url: 'u' };
    expect(toCollectedItem(resolved).label).toBe('my_id');
  });

  it('converts numeric createdAt to string', () => {
    const resolved = { id: 'i', label: 'L', url: 'u', createdAt: 1234567890 };
    expect(toCollectedItem(resolved).createdAt).toBe('1234567890');
  });

  it('defaults optional fields', () => {
    const resolved = { id: 'i', label: 'L', url: 'u' };
    const item = toCollectedItem(resolved);
    expect(item.tags).toEqual([]);
    expect(item.description).toBe('');
    expect(item.thumbnail).toBe('');
    expect(item.createdAt).toBe('');
    expect(item.meta).toEqual({});
  });
});

// --- Import logic ---

describe('importJSON logic', () => {
  function importJSON(data: unknown): { items: CollectedItem[]; folders: GatherFolder[] } {
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

    return { items, folders: importedFolders };
  }

  it('imports from array format', () => {
    const data = [
      { id: 'i1', label: 'Item 1', url: 'https://a.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
      { id: 'i2', label: 'Item 2', url: 'https://b.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const { items } = importJSON(data);
    expect(items).toHaveLength(2);
  });

  it('imports from allLinks format', () => {
    const data = {
      settings: { listType: 'ul' },
      allLinks: {
        coffee1: { label: 'Blue Bottle', url: 'https://bluebottle.com', tags: ['coffee'] },
        coffee2: { label: 'Stumptown', url: 'https://stumptown.com' },
      },
    };
    const { items } = importJSON(data);
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('Blue Bottle');
    expect(items[0].tags).toEqual(['coffee']);
  });

  it('imports folders from gather section', () => {
    const data = {
      allLinks: { a: { label: 'A', url: 'https://a.com' } },
      gather: {
        folders: [
          { id: 'f_1', name: 'My Folder', collapsed: false },
        ],
      },
    };
    const { folders } = importJSON(data);
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('My Folder');
  });

  it('skips entries without url', () => {
    const data = {
      allLinks: {
        valid: { label: 'Valid', url: 'https://a.com' },
        invalid: { label: 'No URL' },
      },
    };
    const { items } = importJSON(data);
    expect(items).toHaveLength(1);
  });

  it('filters invalid array items', () => {
    const data = [
      { label: 'Good', url: 'https://a.com' },
      { noLabel: true, noUrl: true },
      'not an object',
      null,
    ];
    const { items } = importJSON(data);
    expect(items).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(importJSON(null).items).toHaveLength(0);
    expect(importJSON(undefined).items).toHaveLength(0);
    expect(importJSON({}).items).toHaveLength(0);
  });

  it('preserves gather_folder assignment', () => {
    const data = {
      allLinks: {
        item1: { label: 'In Folder', url: 'https://a.com', gather_folder: 'f_1' },
      },
      gather: { folders: [{ id: 'f_1', name: 'F1', collapsed: false }] },
    };
    const { items, folders } = importJSON(data);
    expect(items[0].gather_folder).toBe('f_1');
    expect(folders[0].id).toBe('f_1');
  });
});

// --- Export logic ---

describe('buildExportConfig logic', () => {
  function buildExportConfig(collected: CollectedItem[]): Record<string, unknown> {
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

    return { settings: { listType: 'ul' }, allLinks };
  }

  it('exports items as allLinks', () => {
    const items: CollectedItem[] = [
      { id: 'item_1', label: 'Test', url: 'https://x.com', tags: ['a'], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const config = buildExportConfig(items);
    const allLinks = config.allLinks as Record<string, Record<string, unknown>>;
    expect(allLinks.item_1).toBeDefined();
    expect(allLinks.item_1.label).toBe('Test');
    expect(allLinks.item_1.tags).toEqual(['a']);
  });

  it('sanitizes IDs to valid keys', () => {
    const items: CollectedItem[] = [
      { id: 'ext-123.456', label: 'X', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const config = buildExportConfig(items);
    const allLinks = config.allLinks as Record<string, Record<string, unknown>>;
    expect(allLinks.ext_123_456).toBeDefined();
  });

  it('omits empty optional fields', () => {
    const items: CollectedItem[] = [
      { id: 'i', label: 'L', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const config = buildExportConfig(items);
    const allLinks = config.allLinks as Record<string, Record<string, unknown>>;
    const entry = allLinks.i;
    expect(entry.tags).toBeUndefined();
    expect(entry.description).toBeUndefined();
    expect(entry.thumbnail).toBeUndefined();
    expect(entry.meta).toBeUndefined();
  });

  it('includes settings', () => {
    const config = buildExportConfig([]);
    expect(config.settings).toEqual({ listType: 'ul' });
  });
});

// --- Markdown export ---

describe('renderMarkdownItem logic', () => {
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

  it('renders heading with link', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'My Link', url: 'https://x.com',
      tags: [], description: '', thumbnail: '', createdAt: '', meta: {},
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines[0]).toBe('## [My Link](https://x.com)');
  });

  it('renders description', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'L', url: 'u',
      tags: [], description: 'A great page', thumbnail: '', createdAt: '', meta: {},
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines).toContain('A great page');
  });

  it('renders tags as hashtags', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'L', url: 'u',
      tags: ['coffee', 'nyc'], description: '', thumbnail: '', createdAt: '', meta: {},
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines).toContain('#coffee #nyc');
  });

  it('renders photo credit with URL', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'L', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '',
      meta: { photoCredit: 'Alice', photoCreditUrl: 'https://alice.com' },
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines).toContain('Photo: [Alice](https://alice.com)');
  });

  it('renders photo credit without URL', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'L', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '',
      meta: { photoCredit: 'Bob' },
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines).toContain('Photo: Bob');
  });

  it('renders thumbnail as image', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'My Image', url: 'u', tags: [], description: '',
      thumbnail: 'https://img.com/photo.jpg', createdAt: '', meta: {},
    };
    renderMarkdownItem(item, lines, 1);
    expect(lines).toContain('![My Image](https://img.com/photo.jpg)');
  });

  it('uses correct heading depth', () => {
    const lines: string[] = [];
    const item: CollectedItem = {
      id: 'i', label: 'Deep', url: 'u',
      tags: [], description: '', thumbnail: '', createdAt: '', meta: {},
    };
    renderMarkdownItem(item, lines, 2);
    expect(lines[0]).toMatch(/^### /);
  });
});

// --- Bookmark export ---

describe('exportBookmarks logic', () => {
  function buildBookmarkHtml(collected: CollectedItem[], folders: GatherFolder[]): string {
    const folderIds = new Set(folders.map((f) => f.id));
    const lines: string[] = [];
    lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    lines.push('<!-- This is an automatically generated file. -->');
    lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
    lines.push('<TITLE>Gathered Collection</TITLE>');
    lines.push('<H1>Gathered Collection</H1>');
    lines.push('<DL><p>');

    for (const folder of folders) {
      lines.push(`    <DT><H3>${escapeHtml(folder.name)}</H3>`);
      lines.push(`    <DL><p>`);
      const folderItems = collected.filter((item) => item.gather_folder === folder.id);
      for (const item of folderItems) {
        lines.push(`        <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.label)}</A>`);
      }
      lines.push(`    </DL><p>`);
    }

    const rootItems = collected.filter((item) =>
      !item.gather_folder || !folderIds.has(item.gather_folder),
    );
    for (const item of rootItems) {
      lines.push(`    <DT><A HREF="${escapeHtml(item.url)}">${escapeHtml(item.label)}</A>`);
    }

    lines.push('</DL><p>');
    return lines.join('\n');
  }

  it('generates valid Netscape bookmark format', () => {
    const items: CollectedItem[] = [
      { id: 'i1', label: 'Example', url: 'https://example.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const html = buildBookmarkHtml(items, []);
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('<A HREF="https://example.com">Example</A>');
  });

  it('groups items into folders', () => {
    const folders: GatherFolder[] = [{ id: 'f1', name: 'Coffee', collapsed: false }];
    const items: CollectedItem[] = [
      { id: 'i1', label: 'Blue Bottle', url: 'https://bb.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {}, gather_folder: 'f1' },
      { id: 'i2', label: 'Root Item', url: 'https://root.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const html = buildBookmarkHtml(items, folders);
    expect(html).toContain('<H3>Coffee</H3>');
    expect(html).toContain('Blue Bottle');
    // Root item should be outside the folder DL
    const folderEnd = html.indexOf('    </DL><p>');
    const rootItemPos = html.indexOf('Root Item');
    expect(rootItemPos).toBeGreaterThan(folderEnd);
  });

  it('escapes special characters in labels and URLs', () => {
    const items: CollectedItem[] = [
      { id: 'i1', label: 'A & B <script>', url: 'https://x.com?a=1&b=2', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];
    const html = buildBookmarkHtml(items, []);
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).toContain('https://x.com?a=1&amp;b=2');
  });

  it('orphaned folder items appear at root', () => {
    const items: CollectedItem[] = [
      { id: 'i1', label: 'Orphan', url: 'https://x.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {}, gather_folder: 'deleted_folder' },
    ];
    const html = buildBookmarkHtml(items, []);
    expect(html).toContain('Orphan');
  });
});

// --- externalDropToItem logic ---

describe('externalDropToItem logic', () => {
  function externalDropToItem(url: string, label: string, description: string): CollectedItem {
    let hostname = '';
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { /* skip */ }

    const tags: string[] = [];
    if (hostname) {
      const normalized = hostname.replace(/\./g, '_').trim().toLowerCase()
        .replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '')
        .replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
      if (normalized) tags.push(normalized);
    }
    tags.push('external_drop');

    return {
      id: `ext_test`,
      label,
      url,
      tags,
      description,
      thumbnail: '',
      createdAt: new Date().toISOString(),
      meta: { source: 'external_drop' },
    };
  }

  it('extracts hostname as tag', () => {
    const item = externalDropToItem('https://www.example.com/page', 'Example', '');
    expect(item.tags).toContain('example_com');
  });

  it('always includes external_drop tag', () => {
    const item = externalDropToItem('https://example.com', 'X', '');
    expect(item.tags).toContain('external_drop');
  });

  it('sets source in meta', () => {
    const item = externalDropToItem('https://example.com', 'X', '');
    expect(item.meta.source).toBe('external_drop');
  });

  it('preserves label and description', () => {
    const item = externalDropToItem('https://x.com', 'My Label', 'Some desc');
    expect(item.label).toBe('My Label');
    expect(item.description).toBe('Some desc');
  });

  it('handles invalid URL gracefully', () => {
    const item = externalDropToItem('not-a-url', 'Bad', '');
    expect(item.tags).toContain('external_drop');
    expect(item.url).toBe('not-a-url');
  });
});

// --- addToTray deduplication ---

describe('addToTray deduplication logic', () => {
  it('deduplicates by URL', () => {
    const collected: CollectedItem[] = [
      { id: 'i1', label: 'First', url: 'https://example.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];

    const newItem: CollectedItem = {
      id: 'i2', label: 'Duplicate', url: 'https://example.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {},
    };

    const isDuplicate = collected.some((c) => c.url === newItem.url);
    expect(isDuplicate).toBe(true);
  });

  it('allows different URLs', () => {
    const collected: CollectedItem[] = [
      { id: 'i1', label: 'First', url: 'https://a.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {} },
    ];

    const newItem: CollectedItem = {
      id: 'i2', label: 'Second', url: 'https://b.com', tags: [], description: '', thumbnail: '', createdAt: '', meta: {},
    };

    const isDuplicate = collected.some((c) => c.url === newItem.url);
    expect(isDuplicate).toBe(false);
  });
});

// --- Folder operations ---

describe('folder operations logic', () => {
  it('removeFolder promotes items to root', () => {
    const collected: CollectedItem[] = [
      { id: 'i1', label: 'L', url: 'u', tags: [], description: '', thumbnail: '', createdAt: '', meta: {}, gather_folder: 'f_1' },
      { id: 'i2', label: 'L2', url: 'u2', tags: [], description: '', thumbnail: '', createdAt: '', meta: {}, gather_folder: 'f_2' },
    ];

    // Simulate removeFolder('f_1')
    for (const item of collected) {
      if (item.gather_folder === 'f_1') {
        item.gather_folder = undefined;
      }
    }

    expect(collected[0].gather_folder).toBeUndefined();
    expect(collected[1].gather_folder).toBe('f_2');
  });

  it('renameFolder falls back to default name on empty', () => {
    const folder: GatherFolder = { id: 'f_1', name: 'Old Name', collapsed: false };
    const newName = '   ';
    folder.name = newName.trim() || 'default_name';
    expect(folder.name).toBe('default_name');
  });

  it('toggleFolderCollapse flips state', () => {
    const folder: GatherFolder = { id: 'f_1', name: 'F', collapsed: false };
    folder.collapsed = !folder.collapsed;
    expect(folder.collapsed).toBe(true);
    folder.collapsed = !folder.collapsed;
    expect(folder.collapsed).toBe(false);
  });
});

// --- Save/Load round-trip ---

describe('save/load round-trip', () => {
  function buildGatherExport(collected: CollectedItem[], folders: GatherFolder[]): Record<string, unknown> {
    const allLinks: Record<string, Record<string, unknown>> = {};

    for (const item of collected) {
      const key = item.id.replace(/[^a-zA-Z0-9_]/g, '_');
      const entry: Record<string, unknown> = { label: item.label, url: item.url };
      if (item.tags.length > 0) entry.tags = item.tags;
      if (item.description) entry.description = item.description;
      if (item.thumbnail) entry.thumbnail = item.thumbnail;
      if (item.createdAt) entry.createdAt = item.createdAt;
      if (Object.keys(item.meta).length > 0) entry.meta = item.meta;
      if (item.gather_folder) entry.gather_folder = item.gather_folder;
      allLinks[key] = entry;
    }

    const config: Record<string, unknown> = { settings: { listType: 'ul' }, allLinks };
    if (folders.length > 0) {
      config.gather = { folders: [...folders] };
    }
    return config;
  }

  it('round-trips items and folders through JSON', () => {
    const folders: GatherFolder[] = [{ id: 'f_1', name: 'Folder', collapsed: false }];
    const items: CollectedItem[] = [
      { id: 'item_1', label: 'Test', url: 'https://x.com', tags: ['tag'], description: 'desc', thumbnail: 'thumb', createdAt: '2026-01-01', meta: { k: 'v' }, gather_folder: 'f_1' },
    ];

    const exported = buildGatherExport(items, folders);
    const json = JSON.stringify(exported);
    const parsed = JSON.parse(json);

    // Verify structure
    expect(parsed.allLinks.item_1.label).toBe('Test');
    expect(parsed.allLinks.item_1.gather_folder).toBe('f_1');
    expect(parsed.gather.folders).toHaveLength(1);
    expect(parsed.gather.folders[0].id).toBe('f_1');
  });
});
