/**
 * Copyright 2026 Daniel Smith
 * SPDX-License-Identifier: Apache-2.0
 *
 * Metadata extraction utilities for Alap Gather.
 * Extracted from editors/shared/meta/ (meta-rules.ts + fetch-strategy.ts).
 * When editors/shared/meta becomes a proper package, this file goes away.
 */

// --- Types ---

export interface DesiredFields {
  url: string;
  title: string;
  description: string;
  authors: string[];
  keywords: string[];
  thumbnail: string | null;
  tags: string[];
  siteName: string | null;
  canonicalUrl: string | null;
  locale: string | null;
  publishedDate: string | null;
  modifiedDate: string | null;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
}

export type FetchStrategy =
  | 'html_scrape'
  | 'oembed'
  | 'json_api'
  | 'at_protocol'
  | 'abstract_redirect';

export interface SiteRule {
  domain: string;
  strategy: FetchStrategy;
  strategyConfig: Record<string, unknown> | null;
  title: string[];
  description: string[];
  authors: string[];
  thumbnail: string[];
  canonicalUrl: string[];
  locale: string[];
  publishedDate: string[];
  modifiedDate: string[];
  latitude: string[];
  longitude: string[];
  placeName: string[];
  tags_from: string[];
  tags_skip: string[];
  tag_hostname: boolean;
}

export type RawMeta = Record<string, string | string[] | number | null>;

// --- Default rule ---

const DEFAULT_RULE: SiteRule = {
  domain: '_default',
  strategy: 'html_scrape',
  strategyConfig: null,
  title: ['og_title', 'twitter_title', 'title_tag', 'oembed_title'],
  description: ['og_description', 'twitter_description', 'meta_description', 'oembed_description'],
  authors: ['article_author', 'meta_author', 'oembed_author'],
  thumbnail: ['og_images', 'twitter_image', 'oembed_thumbnail'],
  canonicalUrl: ['canonical_url'],
  locale: ['og_locale'],
  publishedDate: ['article_published_time', 'date', 'dc_date'],
  modifiedDate: ['article_modified_time', 'dcterms_modified'],
  latitude: ['place_latitude'],
  longitude: ['place_longitude'],
  placeName: ['geo_placename'],
  tags_from: [
    'og_site_name', 'og_type', 'article_section', 'meta_section',
    'meta_keywords', 'article_tags', 'og_locale',
  ],
  tags_skip: [],
  tag_hostname: true,
};

const getRuleForDomain = (hostname: string, rules: SiteRule[] = []): SiteRule => {
  const clean = hostname.toLowerCase().replace(/^www\./, '');

  const exact = rules.find(r => clean === r.domain);
  if (exact) return exact;

  const domainFallback = rules.find(r => clean.endsWith(`.${r.domain}`));
  if (domainFallback) return domainFallback;

  return DEFAULT_RULE;
};

// --- normalizeTag ---

export const normalizeTag = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');

// --- Sanitization ---

const sanitize = (val: string): string | null => {
  if (!val) return null;
  if (/<script/i.test(val)) return null;
  if (/javascript\s*:/i.test(val)) return null;
  if (/on\w+\s*=/i.test(val)) return null;
  if (/data\s*:\s*text\/html/i.test(val)) return null;
  return val.replace(/<[^>]+>/g, '').trim();
};

const sanitizeUrl = (val: string): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return null;
};

const decodeEntities = (val: string): string =>
  val
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(lt|gt|amp|quot|apos);/gi, (_, name) => {
      const map: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
      return map[name.toLowerCase()] ?? _;
    });

const isSuspicious = (val: string): boolean => {
  const decoded = decodeEntities(val);
  if (/<script/i.test(decoded)) return true;
  if (/javascript\s*:/i.test(decoded)) return true;
  if (/on\w+\s*=/i.test(decoded)) return true;
  if (/data\s*:\s*text\/html/i.test(decoded)) return true;
  if (/\\u/i.test(decoded)) return true;
  return false;
};

// --- sanitizeRaw ---

export const sanitizeRaw = (
  raw: RawMeta,
): RawMeta => {
  const cleaned: RawMeta = {};

  for (const [key, val] of Object.entries(raw)) {
    if (val === null || typeof val === 'number') {
      cleaned[key] = val;
      continue;
    }
    if (typeof val === 'string') {
      if (isSuspicious(val)) continue;
      cleaned[key] = val.replace(/<[^>]+>/g, '').trim() || null;
      continue;
    }
    if (Array.isArray(val)) {
      const safe = val
        .filter((v): v is string => typeof v === 'string' && !isSuspicious(v))
        .map(v => v.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
      if (safe.length > 0) cleaned[key] = safe;
      continue;
    }
  }

  return cleaned;
};

// --- applyRule ---

export const applyRule = (
  raw: RawMeta,
  hostname: string,
  originalUrl?: string,
  rules: SiteRule[] = [],
): DesiredFields => {
  const rule = getRuleForDomain(hostname, rules);

  const resolveString = (keys: string[]): string | null => {
    for (const key of keys) {
      const val = raw[key];
      if (typeof val === 'string') {
        const clean = sanitize(val);
        if (clean) return clean;
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        const clean = sanitize(val[0]);
        if (clean) return clean;
      }
    }
    return null;
  };

  const resolveUrl = (keys: string[]): string | null => {
    for (const key of keys) {
      const val = raw[key];
      if (typeof val === 'string') {
        const clean = sanitizeUrl(val);
        if (clean) return clean;
      }
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
        const clean = sanitizeUrl(val[0]);
        if (clean) return clean;
      }
    }
    return null;
  };

  const resolveNumber = (keys: string[]): number | null => {
    for (const key of keys) {
      const val = raw[key];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const n = parseFloat(val);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  };

  // Resolve geo from compound fields
  if (raw.geo_position && typeof raw.geo_position === 'string') {
    const [lat, lng] = raw.geo_position.split(';').map(s => parseFloat(s.trim()));
    if (!isNaN(lat)) raw.geo_position_lat = lat;
    if (!isNaN(lng)) raw.geo_position_lng = lng;
  }
  if (raw.icbm && typeof raw.icbm === 'string') {
    const [lat, lng] = raw.icbm.split(',').map(s => parseFloat(s.trim()));
    if (!isNaN(lat)) raw.icbm_lat = lat;
    if (!isNaN(lng)) raw.icbm_lng = lng;
  }

  // Build tags
  const skipSet = new Set(rule.tags_skip);
  const seen = new Set<string>();
  const tags: string[] = [];

  const addTag = (val: string) => {
    for (const part of val.split(',')) {
      const normalized = normalizeTag(part);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        tags.push(normalized);
      }
    }
  };

  if (rule.tag_hostname) {
    addTag(hostname.replace(/^www\./, '').replace(/\./g, '_'));
  }

  for (const key of rule.tags_from) {
    if (skipSet.has(key)) continue;
    const val = raw[key];
    if (typeof val === 'string' && val) addTag(val);
    if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === 'string' && v) addTag(v);
      }
    }
  }

  // Keywords
  const keywords: string[] = [];
  const rawKeywords = raw.meta_keywords;
  if (Array.isArray(rawKeywords)) {
    for (const k of rawKeywords) {
      if (typeof k === 'string') {
        const clean = sanitize(k);
        if (clean) keywords.push(clean);
      }
    }
  }

  // Authors
  const authorRaw = resolveString(rule.authors);
  const authors: string[] = [];
  if (authorRaw) {
    for (const a of authorRaw.split(',')) {
      const clean = sanitize(a);
      if (clean) {
        authors.push(clean);
        addTag(clean);
      }
    }
  }

  const locale = resolveString(rule.locale);
  const canonical = resolveUrl(rule.canonicalUrl);

  return {
    url: canonical ?? originalUrl ?? '',
    title: resolveString(rule.title) ?? hostname,
    description: resolveString(rule.description) ?? '',
    authors,
    keywords,
    thumbnail: resolveUrl(rule.thumbnail),
    tags,
    siteName: resolveString(['og_site_name']),
    canonicalUrl: canonical,
    locale: locale ? normalizeTag(locale) : null,
    publishedDate: resolveString(rule.publishedDate),
    modifiedDate: resolveString(rule.modifiedDate),
    latitude: resolveNumber([...rule.latitude, 'geo_position_lat', 'icbm_lat']),
    longitude: resolveNumber([...rule.longitude, 'geo_position_lng', 'icbm_lng']),
    placeName: resolveString(rule.placeName),
  };
};

// --- parseOembedResponse ---

export const parseOembedResponse = (data: unknown): RawMeta => {
  if (!data || typeof data !== 'object') return {};

  const obj = data as Record<string, unknown>;
  const raw: RawMeta = {};

  if (typeof obj.title === 'string') raw.oembed_title = obj.title;
  if (typeof obj.description === 'string') raw.oembed_description = obj.description;
  if (typeof obj.author_name === 'string') raw.oembed_author = obj.author_name;
  if (typeof obj.author_url === 'string') raw.oembed_author_url = obj.author_url;
  if (typeof obj.provider_name === 'string') raw.og_site_name = obj.provider_name;
  if (typeof obj.thumbnail_url === 'string') raw.oembed_thumbnail = obj.thumbnail_url;
  if (typeof obj.html === 'string') raw.oembed_html = obj.html;
  if (typeof obj.type === 'string') raw.oembed_type = obj.type;

  if (typeof obj.width === 'number') raw.oembed_width = obj.width;
  if (typeof obj.height === 'number') raw.oembed_height = obj.height;
  if (typeof obj.thumbnail_width === 'number') raw.oembed_thumb_width = obj.thumbnail_width;
  if (typeof obj.thumbnail_height === 'number') raw.oembed_thumb_height = obj.thumbnail_height;

  return raw;
};
