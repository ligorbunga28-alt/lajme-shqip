'use strict';
// Dependency-free RSS 2.0 / RSS 1.0 (RDF) / Atom parser.
// It is deliberately tolerant: real-world Albanian feeds contain unescaped ampersands,
// mislabelled languages, malformed enclosures and HTML inside titles.

const { decodeEntities, stripHtml, parseDate, isHttpUrl } = require('./util');

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function unwrapCdata(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** First matching tag content among `names` (case-insensitive, namespace-aware). */
function getTag(block, names) {
  for (const name of names) {
    const re = new RegExp('<' + escapeRe(name) + '(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</' + escapeRe(name) + '\\s*>)', 'i');
    const m = re.exec(block);
    if (m && m[1] !== undefined) return unwrapCdata(m[1]).trim();
  }
  return '';
}

/** All tags with the given name, returning their attribute maps + inner text. */
function getTags(block, name) {
  const out = [];
  const re = new RegExp('<' + escapeRe(name) + '(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</' + escapeRe(name) + '\\s*>)', 'gi');
  let m;
  while ((m = re.exec(block))) {
    out.push({ attrs: parseAttrs(m[1] || ''), text: unwrapCdata(m[2] || '').trim() });
  }
  return out;
}

function parseAttrs(s) {
  const attrs = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

function cleanText(s) {
  return stripHtml(s).replace(/\s+/g, ' ').trim();
}

function pickImage(block, htmlSources) {
  const candidates = [];
  for (const t of getTags(block, 'media:content')) {
    const url = t.attrs.url;
    const isImage = (t.attrs.medium === 'image') || /^image\//i.test(t.attrs.type || '') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url || '');
    if (url && isImage) candidates.push(url);
  }
  for (const t of getTags(block, 'media:thumbnail')) if (t.attrs.url) candidates.push(t.attrs.url);
  for (const t of getTags(block, 'enclosure')) {
    if (t.attrs.url && (/^image\//i.test(t.attrs.type || '') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(t.attrs.url))) candidates.push(t.attrs.url);
  }
  const imgTag = getTag(block, ['image']);
  if (imgTag && /^https?:/i.test(imgTag)) candidates.push(imgTag);
  for (const html of htmlSources) {
    const m = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html || '');
    if (m) candidates.push(decodeEntities(m[1]));
  }
  for (const c of candidates) {
    const url = String(c).trim();
    if (isHttpUrl(url) && !/(pixel|spacer|1x1|feedburner|gravatar|emoji|\.svg(\?|$))/i.test(url)) return url;
  }
  return '';
}

function atomLink(block) {
  const links = getTags(block, 'link');
  let best = '';
  for (const l of links) {
    const href = l.attrs.href;
    if (!href) continue;
    const rel = (l.attrs.rel || 'alternate').toLowerCase();
    if (rel === 'alternate' && (!l.attrs.type || /html/i.test(l.attrs.type))) return href.trim();
    if (!best && rel !== 'enclosure' && rel !== 'self') best = href.trim();
  }
  // RSS-style <link>text</link>
  const text = getTag(block, ['link']);
  if (text && /^https?:/i.test(text)) return text.trim();
  return best;
}

function parseItem(block, isAtom) {
  const title = cleanText(getTag(block, ['title']));
  let link = isAtom ? atomLink(block) : getTag(block, ['link']);
  if (!link || !/^https?:/i.test(link)) {
    const alt = atomLink(block) || getTag(block, ['guid', 'id']);
    if (alt && /^https?:/i.test(alt)) link = alt;
  }
  link = decodeEntities(String(link || '').trim());
  const guid = getTag(block, ['guid', 'id']) || link;
  const description = getTag(block, ['content:encoded', 'description', 'summary', 'content', 'media:description']);
  const shortDescription = getTag(block, ['description', 'summary']);
  const published = parseDate(getTag(block, ['pubDate', 'published', 'dc:date', 'updated', 'lastBuildDate', 'a10:updated', 'issued']));
  const categories = getTags(block, 'category').map((c) => cleanText(c.attrs.term || c.text)).filter(Boolean);
  const author = cleanText(getTag(block, ['dc:creator', 'author', 'name', 'creator']));
  const sourceTag = getTags(block, 'source')[0];
  const newsSource = cleanText(getTag(block, ['News:Source', 'news:source']));
  return {
    title,
    link,
    guid: guid.trim(),
    summary: cleanText(shortDescription || description),
    contentHtml: unwrapCdata(description),
    published,
    categories,
    author,
    image: pickImage(block, [description, shortDescription]),
    sourceName: sourceTag ? cleanText(sourceTag.text) : newsSource,
    sourceUrl: sourceTag ? (sourceTag.attrs.url || '') : '',
  };
}

/**
 * Parse feed XML text into { title, link, items[] }.
 * Returns items in feed order (usually newest first).
 */
function parseFeed(xml) {
  const text = String(xml || '').replace(/^\uFEFF/, '');
  if (!/<(rss|feed|rdf:RDF|channel|item|entry)[\s>]/i.test(text)) {
    throw new Error('Not an RSS/Atom feed' + (/<html[\s>]/i.test(text.slice(0, 2000)) ? ' (got HTML)' : ''));
  }
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text) && !/<rdf:RDF/i.test(text);
  const itemRe = isAtom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry\s*>/gi : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi;

  const firstItem = text.search(isAtom ? /<entry[\s>]/i : /<item[\s>]/i);
  const head = firstItem > 0 ? text.slice(0, firstItem) : text;
  const feedTitle = cleanText(getTag(head, ['title']));
  const feedLink = isAtom ? atomLink(head) : getTag(head, ['link']);

  const items = [];
  let m;
  while ((m = itemRe.exec(text))) {
    try {
      const item = parseItem(m[1], isAtom);
      if (item.title && item.link) items.push(item);
    } catch { /* skip broken item */ }
  }
  return { title: feedTitle, link: feedLink, isAtom, items };
}

module.exports = { parseFeed, getTag, getTags, parseAttrs };
