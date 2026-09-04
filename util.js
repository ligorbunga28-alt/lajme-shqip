'use strict';
// Small dependency-free helpers shared by the aggregator.
// Works on Node 18+ (uses the built-in fetch / AbortController / Intl).

const crypto = require('crypto');

const USER_AGENT =
  'Mozilla/5.0 (compatible; LajmeShqipBot/1.0; +https://github.com/lajme-shqip) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', laquo: '«',
  raquo: '»', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™',
  ccedil: 'ç', Ccedil: 'Ç', euml: 'ë', Euml: 'Ë', eacute: 'é', egrave: 'è',
  agrave: 'à', aacute: 'á', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  bull: '•', middot: '·', deg: '°', times: '×', shy: '',
};

function decodeEntities(input) {
  if (!input) return '';
  return String(input).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try { return String.fromCodePoint(code); } catch { return match; }
    }
    const key = entity in NAMED_ENTITIES ? entity : entity.toLowerCase();
    return key in NAMED_ENTITIES ? NAMED_ENTITIES[key] : match;
  });
}

/** Remove tags / scripts and collapse whitespace. Entities are decoded twice on purpose
 *  (feeds frequently double-encode: `&amp;amp;`). */
function stripHtml(input) {
  if (!input) return '';
  let text = String(input).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  if (/&(lt|gt|#60|#62);/i.test(text)) text = decodeEntities(text); // escaped HTML (Atom "type=html")
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|br|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(decodeEntities(text));
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-]+$/, '') + '…';
}

function sha1(text) {
  return crypto.createHash('sha1').update(String(text)).digest('hex');
}

/** Lower-case, strip diacritics + punctuation. Used for near-duplicate detection. */
function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'yclid', 'mc_cid', 'mc_eid', 'ref', 'ref_src', 'igshid', 'ocid', 'cmpid', 'ito',
];

function canonicalUrl(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = '';
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    u.hostname = u.hostname.toLowerCase();
    let out = u.toString();
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return String(url || '').trim();
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function isHttpUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!u.hostname.includes('.') || /https?$/i.test(u.hostname) || u.pathname.startsWith('//')) return false; // "http://botasot.infohttps://cdn…"
    return true;
  } catch { return false; }
}

/** Current time in Europe/London (handles GMT/BST automatically). */
function londonNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const hour = parseInt(parts.hour, 10) % 24; // Intl may return "24" for midnight in some runtimes
  return {
    hour,
    minute: parseInt(parts.minute, 10),
    zone: parts.timeZoneName, // "BST" or "GMT"
    label: `${parts.day}/${parts.month}/${parts.year} ${String(hour).padStart(2, '0')}:${parts.minute} ${parts.timeZoneName}`,
  };
}

function parseDate(value) {
  if (!value) return null;
  let s = String(value).trim();
  if (!s) return null;
  let d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    // Common feed quirks: "Thu, 03 Sep 2026 10:00:00 +0200 " / "2026-09-03 10:00:00" / "03.09.2026 10:00"
    s = s.replace(/^[a-z]{3,9},?\s+/i, '').replace(/\s+/g, ' ');
    d = new Date(s);
    if (Number.isNaN(d.getTime())) d = new Date(s.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) {
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
      if (m) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 6, m[5] ? +m[5] : 0));
    }
  }
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() > now + 6 * 3600 * 1000) return new Date(now); // clock skew / wrong year
  return d;
}

function decodeBuffer(buffer, contentType) {
  let charset = null;
  const ct = /charset=["']?([\w-]+)/i.exec(contentType || '');
  if (ct) charset = ct[1];
  if (!charset) {
    const head = buffer.subarray(0, 300).toString('latin1');
    const m = /encoding=["']([\w-]+)["']/i.exec(head);
    if (m) charset = m[1];
  }
  charset = (charset || 'utf-8').toLowerCase();
  if (charset === 'utf8') charset = 'utf-8';
  try { return new TextDecoder(charset).decode(buffer); } catch { return buffer.toString('utf8'); }
}

async function fetchText(url, { timeout = 20000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.7',
        'accept-language': 'sq,en;q=0.8,de;q=0.6',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { text: decodeBuffer(buffer, res.headers.get('content-type')), url: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

/** Run `fn` over `items` with at most `limit` in flight. Never throws: results carry {ok,value,error}. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try { results[i] = { ok: true, value: await fn(items[i], i) }; }
      catch (error) { results[i] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function escapeXml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports = {
  USER_AGENT, decodeEntities, stripHtml, truncate, sha1, normalizeTitle, canonicalUrl, hostOf, isHttpUrl,
  londonNow, parseDate, decodeBuffer, fetchText, mapLimit, escapeXml,
};
