import { describe, it, expect } from 'vitest';
import {
  normalizeTag,
  sanitizeRaw,
  applyRule,
  parseOembedResponse,
} from '../src/meta-utils';
import type { RawMeta, SiteRule } from '../src/meta-utils';

// --- normalizeTag ---

describe('normalizeTag', () => {
  it('lowercases and trims', () => {
    expect(normalizeTag('  NYC  ')).toBe('nyc');
  });

  it('replaces spaces with underscores', () => {
    expect(normalizeTag('New York City')).toBe('new_york_city');
  });

  it('replaces hyphens with underscores', () => {
    expect(normalizeTag('san-francisco')).toBe('san_francisco');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeTag('café & bar!')).toBe('caf_bar');
  });

  it('collapses multiple underscores', () => {
    expect(normalizeTag('a - - b')).toBe('a_b');
  });

  it('strips leading and trailing underscores', () => {
    expect(normalizeTag(' - hello - ')).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeTag('')).toBe('');
    expect(normalizeTag('   ')).toBe('');
  });

  it('handles pure numeric input', () => {
    expect(normalizeTag('2026')).toBe('2026');
  });

  it('handles hostname-style input', () => {
    expect(normalizeTag('example_com')).toBe('example_com');
  });
});

// --- sanitizeRaw ---

describe('sanitizeRaw', () => {
  it('passes through clean string values', () => {
    const raw: RawMeta = { title: 'Hello World' };
    expect(sanitizeRaw(raw)).toEqual({ title: 'Hello World' });
  });

  it('strips HTML tags from strings', () => {
    const raw: RawMeta = { title: 'Hello <b>World</b>' };
    expect(sanitizeRaw(raw)).toEqual({ title: 'Hello World' });
  });

  it('blocks script tags', () => {
    const raw: RawMeta = { title: '<script>alert("xss")</script>Hello' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('blocks javascript: protocol', () => {
    const raw: RawMeta = { url: 'javascript: alert(1)' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('blocks onclick handlers', () => {
    const raw: RawMeta = { desc: 'onclick=alert(1)' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('blocks data:text/html', () => {
    const raw: RawMeta = { html: 'data: text/html,<h1>hi</h1>' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('blocks encoded script tags', () => {
    const raw: RawMeta = { title: '&#60;script&#62;alert(1)&#60;/script&#62;' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('blocks unicode escapes', () => {
    const raw: RawMeta = { title: '\\u003cscript\\u003e' };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('passes through null values', () => {
    const raw: RawMeta = { title: null };
    expect(sanitizeRaw(raw)).toEqual({ title: null });
  });

  it('passes through number values', () => {
    const raw: RawMeta = { width: 800 };
    expect(sanitizeRaw(raw)).toEqual({ width: 800 });
  });

  it('filters arrays, keeping safe strings', () => {
    const raw: RawMeta = { tags: ['safe', '<script>bad</script>', 'also_safe'] };
    expect(sanitizeRaw(raw)).toEqual({ tags: ['safe', 'also_safe'] });
  });

  it('drops array if all entries are suspicious', () => {
    const raw: RawMeta = { tags: ['<script>x</script>'] };
    expect(sanitizeRaw(raw)).toEqual({});
  });

  it('strips HTML from array entries', () => {
    const raw: RawMeta = { tags: ['<b>bold</b> tag'] };
    expect(sanitizeRaw(raw)).toEqual({ tags: ['bold tag'] });
  });

  it('drops empty strings after sanitization', () => {
    const raw: RawMeta = { title: '<br>' };
    expect(sanitizeRaw(raw)).toEqual({ title: null });
  });
});

// --- applyRule ---

describe('applyRule', () => {
  const basicRaw: RawMeta = {
    og_title: 'Test Page',
    og_description: 'A test page for unit tests',
    og_images: 'https://example.com/image.jpg',
    og_site_name: 'Example',
  };

  it('resolves title from priority list', () => {
    const result = applyRule(basicRaw, 'example.com');
    expect(result.title).toBe('Test Page');
  });

  it('resolves description', () => {
    const result = applyRule(basicRaw, 'example.com');
    expect(result.description).toBe('A test page for unit tests');
  });

  it('resolves thumbnail URL', () => {
    const result = applyRule(basicRaw, 'example.com');
    expect(result.thumbnail).toBe('https://example.com/image.jpg');
  });

  it('falls back to hostname for title', () => {
    const result = applyRule({}, 'example.com');
    expect(result.title).toBe('example.com');
  });

  it('uses originalUrl when no canonical', () => {
    const result = applyRule({}, 'example.com', 'https://example.com/page');
    expect(result.url).toBe('https://example.com/page');
  });

  it('prefers canonical over originalUrl', () => {
    const raw: RawMeta = { canonical_url: 'https://example.com/canonical' };
    const result = applyRule(raw, 'example.com', 'https://example.com/page');
    expect(result.url).toBe('https://example.com/canonical');
  });

  it('adds hostname as tag when tag_hostname is true', () => {
    const result = applyRule(basicRaw, 'www.example.com');
    expect(result.tags).toContain('example_com');
  });

  it('adds site_name as tag', () => {
    const result = applyRule(basicRaw, 'example.com');
    expect(result.tags).toContain('example');
  });

  it('deduplicates tags', () => {
    const raw: RawMeta = {
      og_site_name: 'example_com',
    };
    const result = applyRule(raw, 'example.com');
    const exampleCount = result.tags.filter((t) => t === 'example_com').length;
    expect(exampleCount).toBe(1);
  });

  it('sanitizes dangerous values in fields', () => {
    const raw: RawMeta = { og_title: '<script>alert("xss")</script>' };
    const result = applyRule(raw, 'example.com');
    expect(result.title).toBe('example.com'); // falls back to hostname
  });

  it('rejects non-http thumbnail URLs', () => {
    const raw: RawMeta = { og_images: 'javascript:alert(1)' };
    const result = applyRule(raw, 'example.com');
    expect(result.thumbnail).toBeNull();
  });

  it('accepts protocol-relative thumbnail URLs', () => {
    const raw: RawMeta = { og_images: '//cdn.example.com/img.jpg' };
    const result = applyRule(raw, 'example.com');
    expect(result.thumbnail).toBe('https://cdn.example.com/img.jpg');
  });

  it('resolves array values (takes first)', () => {
    const raw: RawMeta = {
      og_title: ['First Title', 'Second Title'],
    };
    const result = applyRule(raw, 'example.com');
    expect(result.title).toBe('First Title');
  });

  it('parses geo_position compound field', () => {
    const raw: RawMeta = { geo_position: '40.7128; -74.0060' };
    const result = applyRule(raw, 'example.com');
    expect(result.latitude).toBeCloseTo(40.7128);
    expect(result.longitude).toBeCloseTo(-74.006);
  });

  it('parses ICBM compound field', () => {
    const raw: RawMeta = { icbm: '40.7128, -74.0060' };
    const result = applyRule(raw, 'example.com');
    expect(result.latitude).toBeCloseTo(40.7128);
    expect(result.longitude).toBeCloseTo(-74.006);
  });

  it('splits authors by comma', () => {
    const raw: RawMeta = { article_author: 'Alice, Bob' };
    const result = applyRule(raw, 'example.com');
    expect(result.authors).toEqual(['Alice', 'Bob']);
  });

  it('adds author names as tags', () => {
    const raw: RawMeta = { article_author: 'Alice' };
    const result = applyRule(raw, 'example.com');
    expect(result.tags).toContain('alice');
  });

  it('normalizes locale as tag', () => {
    const raw: RawMeta = { og_locale: 'en_US' };
    const result = applyRule(raw, 'example.com');
    expect(result.locale).toBe('en_us');
  });

  it('uses custom site rules when provided', () => {
    const customRule: SiteRule = {
      domain: 'custom.com',
      strategy: 'html_scrape',
      strategyConfig: null,
      title: ['custom_field'],
      description: [],
      authors: [],
      thumbnail: [],
      canonicalUrl: [],
      locale: [],
      publishedDate: [],
      modifiedDate: [],
      latitude: [],
      longitude: [],
      placeName: [],
      tags_from: [],
      tags_skip: [],
      tag_hostname: false,
    };

    const raw: RawMeta = { custom_field: 'Custom Title' };
    const result = applyRule(raw, 'custom.com', undefined, [customRule]);
    expect(result.title).toBe('Custom Title');
    expect(result.tags).toEqual([]); // tag_hostname false, no tags_from
  });

  it('matches subdomain rules', () => {
    const rule: SiteRule = {
      domain: 'example.com',
      strategy: 'html_scrape',
      strategyConfig: null,
      title: ['custom_title'],
      description: [],
      authors: [],
      thumbnail: [],
      canonicalUrl: [],
      locale: [],
      publishedDate: [],
      modifiedDate: [],
      latitude: [],
      longitude: [],
      placeName: [],
      tags_from: [],
      tags_skip: [],
      tag_hostname: false,
    };

    const raw: RawMeta = { custom_title: 'Subdomain Match' };
    const result = applyRule(raw, 'blog.example.com', undefined, [rule]);
    expect(result.title).toBe('Subdomain Match');
  });

  it('respects tags_skip', () => {
    const rule: SiteRule = {
      domain: 'skip.com',
      strategy: 'html_scrape',
      strategyConfig: null,
      title: [],
      description: [],
      authors: [],
      thumbnail: [],
      canonicalUrl: [],
      locale: [],
      publishedDate: [],
      modifiedDate: [],
      latitude: [],
      longitude: [],
      placeName: [],
      tags_from: ['og_type', 'og_site_name'],
      tags_skip: ['og_type'],
      tag_hostname: false,
    };

    const raw: RawMeta = { og_type: 'article', og_site_name: 'SkipSite' };
    const result = applyRule(raw, 'skip.com', undefined, [rule]);
    expect(result.tags).toContain('skipsite');
    expect(result.tags).not.toContain('article');
  });
});

// --- parseOembedResponse ---

describe('parseOembedResponse', () => {
  it('extracts all standard oEmbed fields', () => {
    const data = {
      title: 'Video Title',
      description: 'A great video',
      author_name: 'Creator',
      author_url: 'https://example.com/creator',
      provider_name: 'Vimeo',
      thumbnail_url: 'https://example.com/thumb.jpg',
      html: '<iframe src="..."></iframe>',
      type: 'video',
      width: 640,
      height: 360,
      thumbnail_width: 200,
      thumbnail_height: 150,
    };

    const result = parseOembedResponse(data);
    expect(result.oembed_title).toBe('Video Title');
    expect(result.oembed_description).toBe('A great video');
    expect(result.oembed_author).toBe('Creator');
    expect(result.oembed_author_url).toBe('https://example.com/creator');
    expect(result.og_site_name).toBe('Vimeo');
    expect(result.oembed_thumbnail).toBe('https://example.com/thumb.jpg');
    expect(result.oembed_html).toBe('<iframe src="..."></iframe>');
    expect(result.oembed_type).toBe('video');
    expect(result.oembed_width).toBe(640);
    expect(result.oembed_height).toBe(360);
    expect(result.oembed_thumb_width).toBe(200);
    expect(result.oembed_thumb_height).toBe(150);
  });

  it('handles partial data', () => {
    const result = parseOembedResponse({ title: 'Just a Title' });
    expect(result.oembed_title).toBe('Just a Title');
    expect(result.oembed_description).toBeUndefined();
  });

  it('returns empty for null input', () => {
    expect(parseOembedResponse(null)).toEqual({});
  });

  it('returns empty for non-object input', () => {
    expect(parseOembedResponse('string')).toEqual({});
    expect(parseOembedResponse(42)).toEqual({});
  });

  it('ignores non-string fields where strings expected', () => {
    const result = parseOembedResponse({ title: 42, description: true });
    expect(result.oembed_title).toBeUndefined();
    expect(result.oembed_description).toBeUndefined();
  });

  it('ignores non-number fields where numbers expected', () => {
    const result = parseOembedResponse({ width: 'not a number' });
    expect(result.oembed_width).toBeUndefined();
  });
});
