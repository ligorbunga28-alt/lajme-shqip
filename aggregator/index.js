#!/usr/bin/env node
'use strict';
/**
 * Lajme Shqip — news aggregator.
 *
 *   node aggregator/index.js            # runs only when it is 06:00 in London (or UPDATE_HOUR=any / FORCE=true)
 *   node aggregator/index.js --force    # run now
 *   node aggregator/index.js --seed     # also merge docs/data/seed-news.json (first-time content)
 *   node aggregator/index.js --offline  # skip network (tests / seeding)
 *
 * Output:  docs/data/news.json  (read by the website and the mobile app)
 *          docs/feed.xml        (RSS feed of the aggregated news — usable by any RSS reader / other apps)
 *
 * No npm dependencies. Node 18+.
 */

const fs = require('fs');
const path = require('path');
const sources = require('./sources');
const { parseFeed } = require('./rss');
const { classify } = require('./classify');
const { TOPICS, classifyTopic } = require('./topics');
const u = require('./util');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const DATA_DIR = path.join(DOCS, 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const SEED_FILES = [path.join(DATA_DIR, 'seed-news-images.json'), path.join(DATA_DIR, 'seed-news.json')];
const FEED_FILE = path.join(DOCS, 'feed.xml');

const CONFIG = {
  maxAgeDays: Number(process.env.MAX_AGE_DAYS || 7),   // how long a story stays on the site
  maxItems: Number(process.env.MAX_ITEMS || 700),      // overall cap in news.json
  perCategoryMax: 220,
  perSourceMax: 40,                                    // newest N items taken from each feed
  summaryLength: 260,
  concurrency: 8,
  enrichImages: Number(process.env.ENRICH_IMAGES || 60),   // fetch og:image for up to N image-less stories per run (0 = off)
  updateHour: (process.env.UPDATE_HOUR || '6').toLowerCase(), // "6" or "any"
  siteUrl: (process.env.SITE_URL || 'https://USERNAME.github.io/lajme-shqip').replace(/\/$/, ''),
  siteName: 'Lajme Shqip',
};

const argv = new Set(process.argv.slice(2));
const FORCE = argv.has('--force') || /^(1|true|yes)$/i.test(process.env.FORCE || '');
const OFFLINE = argv.has('--offline');
const SEED = argv.has('--seed');

const CATEGORIES = [
  { id: 'albania', sq: 'Shqipëri', en: 'Albania' },
  { id: 'kosovo', sq: 'Kosovë', en: 'Kosovo' },
  { id: 'region', sq: 'Rajoni', en: 'Region' },
  { id: 'diaspora', sq: 'Diaspora', en: 'Diaspora' },
  { id: 'world', sq: 'Bota për shqiptarët', en: 'World on Albanians' },
  { id: 'international', sq: 'Ndërkombëtare', en: 'International' },
];
const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.id));

function log(...args) { console.log(new Date().toISOString().slice(11, 19), ...args); }

// ---------------------------------------------------------------------------------------------
// 1. Schedule gate — GitHub's cron only speaks UTC, so the workflow fires at 05:00 and 06:00 UTC and
//    this check picks the run that is 06:00 in London (BST in summer, GMT in winter).
// ---------------------------------------------------------------------------------------------
function shouldRunNow() {
  if (FORCE) return true;
  if (CONFIG.updateHour === 'any') return true;
  const london = u.londonNow();
  const ok = london.hour === Number(CONFIG.updateHour);
  if (!ok) log(`It is ${london.label} in London — not ${CONFIG.updateHour}:00. Skipping (use --force to run anyway).`);
  return ok;
}

// ---------------------------------------------------------------------------------------------
// 2. Fetch + parse one source (with fallback URL and staleness check)
// ---------------------------------------------------------------------------------------------
function newestDate(feed) {
  let newest = 0;
  for (const it of feed.items) if (it.published && it.published.getTime() > newest) newest = it.published.getTime();
  return newest;
}

async function loadSource(source) {
  const attempts = [source.url, source.fallback].filter(Boolean);
  let lastError = null;
  for (const url of attempts) {
    try {
      const { text } = await u.fetchText(url, { timeout: 25000 });
      const feed = parseFeed(text);
      if (!feed.items.length) throw new Error('feed has no items');
      const newest = newestDate(feed);
      const staleDays = newest ? (Date.now() - newest) / 86400000 : 0;
      if (staleDays > CONFIG.maxAgeDays * 2 && url !== attempts[attempts.length - 1]) {
        throw new Error(`stale (newest item ${Math.round(staleDays)} days old)`);
      }
      return { source, feed, url, error: null };
    } catch (error) {
      lastError = error;
      log(`  ! ${source.id}: ${error.message} (${url})`);
    }
  }
  return { source, feed: null, url: attempts[0], error: lastError ? lastError.message : 'unknown error' };
}

// ---------------------------------------------------------------------------------------------
// 3. Turn feed entries into Lajme Shqip items
// ---------------------------------------------------------------------------------------------
function prettyHost(url) {
  const host = u.hostOf(url);
  if (!host) return '';
  const known = {
    'reuters.com': 'Reuters', 'bbc.com': 'BBC News', 'bbc.co.uk': 'BBC News', 'cnn.com': 'CNN', 'edition.cnn.com': 'CNN',
    'dw.com': 'Deutsche Welle', 'theguardian.com': 'The Guardian', 'aljazeera.com': 'Al Jazeera', 'apnews.com': 'AP News',
    'euronews.com': 'Euronews', 'politico.eu': 'Politico Europe', 'balkaninsight.com': 'Balkan Insight', 'nytimes.com': 'The New York Times',
    'ft.com': 'Financial Times', 'bloomberg.com': 'Bloomberg', 'washingtonpost.com': 'The Washington Post', 'telegraph.co.uk': 'The Telegraph',
    'independent.co.uk': 'The Independent', 'dailymail.co.uk': 'Daily Mail', 'thesun.co.uk': 'The Sun', 'mirror.co.uk': 'The Mirror',
    'standard.co.uk': 'Evening Standard', 'sky.com': 'Sky News', 'news.sky.com': 'Sky News', 'zeriamerikes.com': 'Zëri i Amerikës',
    'evropaelire.org': 'Radio Evropa e Lirë', 'top-channel.tv': 'Top Channel', 'syri.net': 'Syri', 'lapsi.al': 'Lapsi', 'a2news.com': 'A2 CNN',
    'klankosova.tv': 'Klan Kosova', 'rtklive.com': 'RTK', 'gazetatema.net': 'Gazeta Tema', 'shqiptarja.com': 'Shqiptarja', 'report-tv.al': 'Report TV',
    'oranews.tv': 'Ora News', 'politiko.al': 'Politiko', 'newsbomb.al': 'Newsbomb', 'exit.al': 'Exit News', 'ata.gov.al': 'ATA',
    'kosovapress.com': 'KosovaPress', 'zeri.info': 'Zëri', 'nacionale.com': 'Nacionale', 'periskopi.com': 'Periskopi',
    'albinfo.ch': 'Albinfo', 'illyria.com': 'Illyria', 'ansa.it': 'ANSA', 'corriere.it': 'Corriere della Sera', 'repubblica.it': 'La Repubblica',
    'spiegel.de': 'Der Spiegel', 'faz.net': 'FAZ', 'sueddeutsche.de': 'Süddeutsche Zeitung', 'welt.de': 'Die Welt', 'nzz.ch': 'NZZ',
    'blick.ch': 'Blick', '20min.ch': '20 Minuten', 'srf.ch': 'SRF', 'lemonde.fr': 'Le Monde', 'lefigaro.fr': 'Le Figaro',
    'ekathimerini.com': 'Kathimerini', 'hurriyetdailynews.com': 'Hürriyet Daily News', 'dailysabah.com': 'Daily Sabah',
  };
  if (known[host]) return known[host];
  const base = host.split('.').slice(-2, -1)[0] || host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function unwrapRedirect(link, redirector) {
  if (!redirector) return link;
  try {
    const parsed = new URL(link);
    if (redirector === 'bing') {
      const real = parsed.searchParams.get('url');
      if (real && u.isHttpUrl(real)) return real;
    }
  } catch { /* keep link */ }
  return link; // Google News links redirect to the outlet when opened; keep them as they are.
}

function cleanGoogleTitle(title) {
  // Google News titles end with " - Outlet name"
  return title.replace(/\s+[-–|]\s+[^-–|]{2,60}$/, '').trim() || title;
}

function buildItems(result, now) {
  const { source, feed } = result;
  const items = [];
  if (!feed) return items;
  const cutoff = now - CONFIG.maxAgeDays * 86400000;
  let generalKept = 0;

  for (const entry of feed.items.slice(0, CONFIG.perSourceMax)) {
    let title = entry.title;
    let link = unwrapRedirect(entry.link, source.redirector);
    if (source.linkFromGuid && u.isHttpUrl(entry.guid) && !/admin\./.test(entry.guid)) link = entry.guid;
    if (!u.isHttpUrl(link) || !title || title.length < 8) continue;
    if (source.redirector === 'google') title = cleanGoogleTitle(title);

    const published = entry.published || new Date(now);
    if (published.getTime() < cutoff) continue;

    let summary = source.redirector === 'google' ? '' : u.truncate(entry.summary, CONFIG.summaryLength);
    if (summary && u.normalizeTitle(summary).startsWith(u.normalizeTitle(title).slice(0, 40))) summary = summary.length > title.length + 30 ? summary : '';

    const { category, tags, relevant } = classify({ title, summary: entry.summary }, source);
    if (source.filter && !relevant) continue;
    if (source.keep !== undefined && !relevant) {
      if (generalKept >= source.keep) continue;
      generalKept += 1;
    }
    if (source.keep === undefined && !source.filter && source.category === 'international' && !relevant) continue;

    let sourceName = source.name;
    let sourceHome = source.home || '';
    if (source.redirector) {
      const realName = entry.sourceName || prettyHost(link);
      if (realName && (!source.home || source.redirector === 'google' || /^(Google News|Bing News)/.test(source.name))) sourceName = realName;
      if (!sourceHome) sourceHome = entry.sourceUrl || (() => { try { return new URL(link).origin; } catch { return ''; } })();
    }

    const canonical = u.canonicalUrl(link);
    const topic = classifyTopic({ title, summary: entry.summary, url: canonical, categories: entry.categories, category });
    items.push({
      id: u.sha1(canonical).slice(0, 12),
      title,
      url: canonical,
      source: sourceName,
      sourceId: source.id,
      sourceUrl: sourceHome,
      lang: source.lang,
      published: published.toISOString(),
      summary,
      image: source.noImages ? '' : (entry.image || ''),
      category: VALID_CATEGORIES.has(category) ? category : 'world',
      topic,
      tags,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------------------------
// 3b. Pictures: feeds without <media:content> get the article's og:image (a few dozen per run)
// ---------------------------------------------------------------------------------------------
async function enrichImages(items) {
  const todo = items.filter((it) => !it.image && it.sourceId !== 'seed' && !/news\.google\.com/.test(it.url)).slice(0, CONFIG.enrichImages);
  if (!todo.length) return 0;
  let found = 0;
  await u.mapLimit(todo, 6, async (it) => {
    try {
      const { text } = await u.fetchText(it.url, { timeout: 9000, headers: { accept: 'text/html,*/*;q=0.8' } });
      const head = text.slice(0, 60000);
      const m = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i.exec(head)
        || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(head)
        || /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(head);
      if (m && u.isHttpUrl(u.decodeEntities(m[1]))) { it.image = u.decodeEntities(m[1]); found += 1; }
    } catch { /* leave without image */ }
  });
  return found;
}

// ---------------------------------------------------------------------------------------------
// 4. Merge, de-duplicate, rank
// ---------------------------------------------------------------------------------------------
const SOURCE_RANK = { home: 0, international: 1, keyword: 2 };
function rankOf(item) {
  const src = sources.all.find((s) => s.id === item.sourceId);
  if (!src) return 1;
  if (src.redirector) return SOURCE_RANK.keyword;
  if (src.keep !== undefined || src.category === 'world' || src.category === 'international') return SOURCE_RANK.international;
  return SOURCE_RANK.home;
}

function dedupe(items) {
  const byUrl = new Map();
  for (const item of items) {
    const prev = byUrl.get(item.url);
    if (!prev || rankOf(item) < rankOf(prev)) byUrl.set(item.url, { ...prev, ...item, tags: item.tags.length ? item.tags : (prev ? prev.tags : []) });
  }
  const byTitle = new Map();
  for (const item of byUrl.values()) {
    const key = u.normalizeTitle(item.title).slice(0, 70);
    if (!key) continue;
    const prev = byTitle.get(key);
    if (!prev) { byTitle.set(key, item); continue; }
    const keep = rankOf(item) < rankOf(prev) || (rankOf(item) === rankOf(prev) && item.published < prev.published) ? item : prev;
    keep.tags = [...new Set([...(prev.tags || []), ...(item.tags || [])])];
    byTitle.set(key, keep);
  }
  return [...byTitle.values()];
}

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function seedItems(now) {
  const seed = SEED_FILES.flatMap((f) => loadJson(f, []));
  const items = [];
  for (const s of seed) {
    if (!s || !u.isHttpUrl(s.url) || !s.title) continue;
    const canonical = u.canonicalUrl(s.url);
    const published = u.parseDate(s.published) || new Date(now);
    const pseudoSource = { category: VALID_CATEGORIES.has(s.category) ? s.category : 'world', lang: s.lang || 'sq', alwaysRelevant: true };
    const { tags } = classify({ title: s.title, summary: s.summary || '' }, pseudoSource);
    const topic = classifyTopic({ title: s.title, summary: s.summary || '', url: canonical, categories: s.categories || [], category: pseudoSource.category });
    items.push({
      id: u.sha1(canonical).slice(0, 12),
      title: s.title,
      titleEn: s.titleEn && s.titleEn !== s.title ? s.titleEn : undefined,
      url: canonical,
      source: s.source || prettyHost(canonical),
      sourceId: s.sourceId && s.sourceId !== 'bing' ? s.sourceId : 'seed',
      sourceUrl: s.sourceUrl || '',
      lang: s.lang || 'sq',
      published: published.toISOString(),
      summary: u.truncate(s.summary || '', CONFIG.summaryLength),
      summaryEn: s.summaryEn && s.summaryEn !== s.summary ? u.truncate(s.summaryEn, CONFIG.summaryLength) : undefined,
      image: u.isHttpUrl(s.image || '') ? s.image : '',
      category: pseudoSource.category,
      topic,
      tags: [...new Set([...tags, ...(['albania', 'kosovo', 'region', 'diaspora'].includes(pseudoSource.category) ? [pseudoSource.category] : [])])],
    });
  }
  return items;
}

// ---------------------------------------------------------------------------------------------
// 5. Output files
// ---------------------------------------------------------------------------------------------
function writeRss(items, generatedAt) {
  const top = items.slice(0, 100);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    '<channel>',
    `<title>${u.escapeXml(CONFIG.siteName)} — Lajmet shqiptare nga e gjithë bota</title>`,
    `<link>${u.escapeXml(CONFIG.siteUrl)}/</link>`,
    `<atom:link href="${u.escapeXml(CONFIG.siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>`,
    '<description>Albanian news from Albania, Kosovo, the region and the diaspora, plus world coverage about Albanians — updated every morning at 06:00 London time.</description>',
    '<language>sq</language>',
    `<lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>`,
    ...top.map((it) => [
      '<item>',
      `<title>${u.escapeXml(it.title)}</title>`,
      `<link>${u.escapeXml(it.url)}</link>`,
      `<guid isPermaLink="true">${u.escapeXml(it.url)}</guid>`,
      `<pubDate>${new Date(it.published).toUTCString()}</pubDate>`,
      `<category>${u.escapeXml(it.category)}</category>`,
      `<source url="${u.escapeXml(it.sourceUrl || CONFIG.siteUrl)}">${u.escapeXml(it.source)}</source>`,
      it.summary ? `<description>${u.escapeXml(it.summary)}</description>` : '',
      it.image ? `<media:content url="${u.escapeXml(it.image)}" medium="image"/>` : '',
      '</item>',
    ].filter(Boolean).join('')),
    '</channel>',
    '</rss>',
  ].join('\n');
  fs.writeFileSync(FEED_FILE, xml);
}

// ---------------------------------------------------------------------------------------------
async function main() {
  if (!shouldRunNow()) return;
  const started = Date.now();
  const now = Date.now();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const previous = loadJson(NEWS_FILE, { items: [] });
  const cutoff = now - CONFIG.maxAgeDays * 86400000;
  let items = (previous.items || []).filter((it) => it && it.url && new Date(it.published).getTime() >= cutoff);
  log(`Previous items kept: ${items.length}`);

  if (SEED) {
    const seeded = seedItems(now);
    log(`Seed items: ${seeded.length}`);
    items = items.concat(seeded);
  }

  const sourceReport = [];
  let okCount = 0;
  if (!OFFLINE) {
    log(`Fetching ${sources.all.length} sources (${CONFIG.concurrency} at a time)…`);
    const results = await u.mapLimit(sources.all, CONFIG.concurrency, loadSource);
    for (const r of results) {
      const res = r.ok ? r.value : { source: null, feed: null, error: String(r.error) };
      if (!res.source) continue;
      const fresh = buildItems(res, now);
      const ok = Boolean(res.feed);
      if (ok) okCount += 1;
      sourceReport.push({
        id: res.source.id, name: res.source.name, home: res.source.home || '', lang: res.source.lang,
        region: res.source.region || '', category: res.source.category, ok, items: fresh.length,
        error: res.error || undefined, optional: res.source.optional || undefined,
      });
      log(`${ok ? '✓' : '✗'} ${res.source.id.padEnd(18)} ${String(fresh.length).padStart(3)} items${res.error ? '  — ' + res.error : ''}`);
      items = items.concat(fresh);
    }
    if (okCount === 0 && !SEED) {
      console.error('Every source failed — probably no network. Keeping the previous news.json untouched.');
      process.exitCode = 1;
      return;
    }
  } else {
    for (const s of sources.all) sourceReport.push({ id: s.id, name: s.name, home: s.home || '', lang: s.lang, region: s.region || '', category: s.category, ok: false, items: 0, error: 'offline' });
  }

  // Carry translations / pictures forward from the previous run when the same story is seen again.
  const prevById = new Map((previous.items || []).map((it) => [it.id, it]));
  for (const it of items) {
    const p = prevById.get(it.id);
    if (p) { if (p.titleEn && !it.titleEn) it.titleEn = p.titleEn; if (p.summaryEn && !it.summaryEn) it.summaryEn = p.summaryEn; if (!it.image && p.image) it.image = p.image; }
    if (!it.topic) it.topic = classifyTopic(it);
  }

  items = dedupe(items).sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));

  if (!OFFLINE && CONFIG.enrichImages > 0) {
    const found = await enrichImages(items.filter((it) => !it.image && it.category !== 'international').slice(0, CONFIG.enrichImages * 2));
    log(`Pictures added from article pages: ${found}`);
  }

  // Per-category cap, then overall cap.
  const perCat = {};
  items = items.filter((it) => {
    perCat[it.category] = (perCat[it.category] || 0) + 1;
    return perCat[it.category] <= CONFIG.perCategoryMax;
  }).slice(0, CONFIG.maxItems);

  const counts = {};
  for (const c of CATEGORIES) counts[c.id] = 0;
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;

  const generatedAt = new Date(now).toISOString();
  const output = {
    name: CONFIG.siteName,
    generatedAt,
    generatedAtLondon: u.londonNow(new Date(now)).label,
    updateSchedule: 'Every day at 06:00 Europe/London',
    siteUrl: CONFIG.siteUrl,
    feedUrl: `${CONFIG.siteUrl}/feed.xml`,
    total: items.length,
    counts,
    categories: CATEGORIES,
    topics: TOPICS,
    topicCounts: items.reduce((acc, it) => { acc[it.topic] = (acc[it.topic] || 0) + 1; return acc; }, {}),
    quickLinks: sources.QUICK_LINKS,
    liveTv: sources.LIVE_TV,
    sources: sourceReport.length ? sourceReport : previous.sources || [],
    items,
  };
  fs.writeFileSync(NEWS_FILE, JSON.stringify(output, null, 1));
  writeRss(items, generatedAt);
  log(`Done: ${items.length} items from ${okCount} live sources in ${((Date.now() - started) / 1000).toFixed(1)}s → ${path.relative(ROOT, NEWS_FILE)}, ${path.relative(ROOT, FEED_FILE)}`);
  log('Counts:', JSON.stringify(counts));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
