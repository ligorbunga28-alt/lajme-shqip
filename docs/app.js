/* Lajme Shqip — website logic (TV-portal layout). No build step, no dependencies.
   Reads data/news.json (written by the aggregator) or window.LAJME_DATA when the data is embedded.
   Routing: #top | #politike | #ekonomi | … | #live   (region + search are kept in memory). */
(function () {
  'use strict';

  var I18N = window.LAJME_I18N;
  var REGIONS = ['albania', 'kosovo', 'region', 'diaspora', 'world', 'international'];
  var HOME_STRIPS = ['politike', 'kronike', 'ekonomi', 'bote', 'sport', 'showbiz', 'teknologji', 'kulture', 'shendet', 'opinion'];
  var PAGE_SIZE = 18;
  var REGION_CODES = { AL: 'AL', XK: 'KS', MK: 'MK', RS: 'RS', ME: 'ME', CH: 'CH', US: 'US', GB: 'UK', DE: 'DE', IT: 'IT', FR: 'FR', QA: 'QA', EU: 'EU', CZ: 'CZ', GR: 'GR', TR: 'TR' };

  var state = {
    lang: pref('lang') || (/^en/i.test(navigator.language || '') ? 'en' : 'sq'),
    theme: pref('theme') || 'auto',
    view: 'top',
    region: '',
    query: '',
    page: 1,
    data: null,
    installPrompt: null,
  };
  if (!I18N[state.lang]) state.lang = 'sq';

  var $ = function (sel) { return document.querySelector(sel); };
  var els = {};

  // ---------- helpers ----------
  function pref(key) { try { return localStorage.getItem('lajme.' + key); } catch (e) { return null; } }
  function setPref(key, value) { try { localStorage.setItem('lajme.' + key, value); } catch (e) { /* private mode */ } }
  function t(key) { var v = I18N[state.lang][key]; if (v === undefined) v = I18N.sq[key]; return v === undefined ? key : v; }
  function fmt(str, n) { return String(str).replace('{n}', n); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function topicName(id) {
    var tp = (state.data && state.data.topics || []).filter(function (x) { return x.id === id; })[0];
    return tp ? (tp[state.lang] || tp.sq) : id;
  }
  function uniq(items) { var seen = {}; return items.filter(function (it) { if (seen[it.id]) return false; seen[it.id] = true; return true; }); }

  // ---------- theme ----------
  function applyTheme() {
    var root = document.documentElement;
    if (state.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', state.theme);
  }

  // ---------- data ----------
  function load() {
    if (window.LAJME_DATA && window.LAJME_DATA.items) { state.data = window.LAJME_DATA; state.view = readHash(); render(); refreshInBackground(); return; }
    els.content.innerHTML = '<div class="state"><p>' + esc(t('loading')) + '</p></div>';
    fetchData().then(function (data) { state.data = data; state.view = readHash(); render(); })
      .catch(function () {
        els.content.innerHTML = '<div class="state"><p>' + esc(t('error')) + '</p><button class="btn" type="button" id="retry">' + esc(t('retry')) + '</button></div>';
        $('#retry').addEventListener('click', load);
      });
  }
  function fetchData() {
    var url = (window.LAJME_DATA_URL || 'data/news.json') + '?v=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function refreshInBackground() {
    if (!window.LAJME_DATA_URL) return;
    fetchData().then(function (data) {
      if (data && data.generatedAt && state.data && data.generatedAt > state.data.generatedAt) { state.data = data; render(); }
    }).catch(function () { /* offline or not deployed yet */ });
  }

  // ---------- time ----------
  function timeAgo(iso) {
    var ms = Date.now() - new Date(iso).getTime();
    var min = Math.round(ms / 60000);
    if (min < 2) return t('justNow');
    if (min < 60) return fmt(t('minutesAgo'), min);
    var h = Math.round(min / 60);
    if (h === 1) return t('hourAgo');
    if (h < 24) return fmt(t('hoursAgo'), h);
    var d = Math.round(h / 24);
    if (d === 1) return t('yesterday');
    return fmt(t('daysAgo'), d);
  }
  function clock(iso) {
    var d = new Date(iso), now = new Date();
    var hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return hh;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function longDate(d) {
    var wd = t('weekdays')[d.getDay()], mo = t('months')[d.getMonth()];
    return state.lang === 'sq' ? wd + ', ' + d.getDate() + ' ' + mo + ' ' + d.getFullYear() : wd + ', ' + d.getDate() + ' ' + mo + ' ' + d.getFullYear();
  }
  function londonParts(iso) {
    var d = new Date(iso);
    try {
      var time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
      var zone = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' }).formatToParts(d).filter(function (p) { return p.type === 'timeZoneName'; })[0];
      var date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit' }).format(d);
      return { time: time, zone: zone ? zone.value : '', date: date };
    } catch (e) { return { time: d.toLocaleTimeString(), zone: '', date: d.toLocaleDateString() }; }
  }

  // ---------- selection ----------
  function pool() {
    var items = state.data.items;
    if (!state.region) return items;
    if (state.region === 'world' || state.region === 'international') return items.filter(function (it) { return it.category === state.region; });
    return items.filter(function (it) { return it.category === state.region || (it.tags || []).indexOf(state.region) !== -1; });
  }
  function homePool() {
    // Home mixes everything but keeps general world headlines to a handful.
    var intl = 0;
    return pool().filter(function (it) { if (it.category !== 'international') return true; intl += 1; return intl <= 8; });
  }
  function byTopic(items, topic) { return items.filter(function (it) { return it.topic === topic; }); }
  function search(items) {
    var q = fold(state.query).trim();
    if (!q) return items;
    return items.filter(function (it) { return fold(it.title + ' ' + (it.titleEn || '') + ' ' + (it.summary || '') + ' ' + (it.summaryEn || '') + ' ' + it.source).indexOf(q) !== -1; });
  }
  function pickWithImages(items, n) {
    var withImg = items.filter(function (it) { return it.image; }), out = withImg.slice(0, n);
    if (out.length < n) items.forEach(function (it) { if (out.length < n && out.indexOf(it) === -1) out.push(it); });
    return out;
  }
  function displayTitle(it) { return state.lang === 'en' && it.titleEn ? it.titleEn : it.title; }
  function displaySummary(it) { return state.lang === 'en' && it.summaryEn ? it.summaryEn : (it.summary || ''); }
  function regionCode(it) {
    var src = (state.data.sources || []).filter(function (s) { return s.id === it.sourceId; })[0];
    return src && src.region ? (REGION_CODES[src.region] || src.region) : '';
  }

  // ---------- rendering: pieces ----------
  var ICON = {
    ext: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9"/></svg>',
    share: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8M5 5l3-3 3 3M3 9v4h10V9"/></svg>',
    translate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 4h7M5.5 2v2M8 4c-.6 3-2.6 5.5-5.5 7M4 6.5c1 1.8 2.6 3.3 4.5 4.3M9 14l3-7 3 7M10 12h4"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
    sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/></svg>',
    auto: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11" fill="currentColor" stroke="none"/></svg>',
  };

  function picHtml(it, big) {
    var initial = (it.source || '?').replace(/^(the|gazeta|radio)\s+/i, '').charAt(0).toUpperCase();
    if (it.image) return '<img src="' + esc(it.image) + '" alt="" loading="' + (big ? 'eager' : 'lazy') + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ph\',textContent:\'' + esc(initial) + '\'}))">';
    return '<div class="ph" style="--ph: var(--t-' + esc(it.topic || 'aktualitet') + ')">' + esc(initial) + '</div>';
  }
  function badgeHtml(it, soft) {
    return '<span class="badge' + (soft ? ' soft' : '') + '" style="--tc: var(--t-' + esc(it.topic || 'aktualitet') + ')">' + esc(topicName(it.topic || 'aktualitet')) + '</span>';
  }
  function metaHtml(it, opts) {
    opts = opts || {};
    var cc = regionCode(it);
    return '<div class="meta">' +
      '<span class="src">' + (cc ? '<span class="cc">' + esc(cc) + ' </span>' : '') + esc(it.source) + '</span>' +
      '<time datetime="' + esc(it.published) + '" title="' + esc(new Date(it.published).toLocaleString()) + '">' + esc(timeAgo(it.published)) + '</time>' +
      (opts.region && it.category && it.category !== 'international' ? '<span>' + esc(t(it.category)) + '</span>' : '') +
      (it.lang && it.lang !== 'sq' ? '<span>' + esc((t('langNames') || {})[it.lang] || it.lang) + '</span>' : '') +
      '</div>';
  }
  function actsHtml(it) {
    var to = state.lang === 'sq' ? 'sq' : 'en';
    var tr = it.lang !== to ? '<a class="act" href="https://translate.google.com/translate?sl=auto&tl=' + to + '&u=' + encodeURIComponent(it.url) + '" target="_blank" rel="noopener">' + ICON.translate + esc(t('translate')) + '</a>' : '';
    return '<div class="acts">' + tr + '<button class="act share" type="button" data-url="' + esc(it.url) + '" data-title="' + esc(displayTitle(it)) + '">' + ICON.share + esc(t('share')) + '</button></div>';
  }
  function cardHtml(it, opts) {
    opts = opts || {};
    var cls = 'card' + (opts.overlay ? ' overlay' : '') + (opts.lead ? ' lead' : '') + (opts.side ? ' side' : '');
    var title = '<h3 class="title">' + esc(displayTitle(it)) + '</h3>';
    if (opts.overlay) {
      return '<article class="' + cls + '"><a class="main" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
        '<div class="pic">' + picHtml(it, opts.lead) + '</div>' +
        '<div class="text">' + badgeHtml(it) + title + metaHtml(it, { region: true }) + '</div></a></article>';
    }
    var summary = displaySummary(it);
    return '<article class="' + cls + '"><a class="main" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
      '<div class="pic">' + picHtml(it, false) + '<span class="badge">' + esc(topicName(it.topic || 'aktualitet')) + '</span></div>' +
      title + (summary && opts.summary ? '<p class="sum">' + esc(summary) + '</p>' : '') + '</a>' +
      metaHtml(it, { region: !!opts.region }) + (opts.acts === false ? '' : actsHtml(it)) + '</article>';
  }
  function rowHtml(it) {
    return '<a class="row" href="' + esc(it.url) + '" target="_blank" rel="noopener"><div class="pic">' + picHtml(it, false) + '</div>' +
      '<div><h4 class="title">' + esc(displayTitle(it)) + '</h4>' + metaHtml(it) + '</div></a>';
  }
  function secHead(title, count, moreHref, hint) {
    return '<div class="sec-head"><h2 class="sec-title">' + esc(title) + (count != null ? '<span class="n">' + count + '</span>' : '') + '</h2>' +
      (moreHref ? '<a class="sec-more" href="' + esc(moreHref) + '">' + esc(t('seeAll')) + '</a>' : '') + '</div>' +
      (hint ? '<p class="sec-hint">' + esc(hint) + '</p>' : '');
  }
  function heroHtml(items) {
    var picks = pickWithImages(items, 3);
    if (!picks.length) return '';
    var rest = items.filter(function (it) { return picks.indexOf(it) === -1; }).slice(0, 4);
    var html = '<div class="hero">' + cardHtml(picks[0], { overlay: true, lead: true }) +
      picks.slice(1).map(function (it) { return cardHtml(it, { overlay: true, side: true }); }).join('') + '</div>';
    if (rest.length) html += '<div class="grid cols-4" style="margin-top:18px">' + rest.map(function (it) { return cardHtml(it, { acts: false }); }).join('') + '</div>';
    return { html: html, used: picks.concat(rest) };
  }

  // ---------- rendering: views ----------
  function renderHome() {
    var items = search(homePool());
    if (!items.length) { els.content.innerHTML = '<div class="state"><p>' + esc(t('noResults')) + '</p></div>'; return; }
    var used = {}, html = '';
    var hero = heroHtml(items);
    if (hero) { html += '<section>' + hero.html + '</section>'; hero.used.forEach(function (it) { used[it.id] = true; }); }
    HOME_STRIPS.forEach(function (topic) {
      var list = byTopic(items, topic).filter(function (it) { return !used[it.id]; });
      if (list.length < 3) return;
      var lead = pickWithImages(list, 1)[0];
      var rows = list.filter(function (it) { return it !== lead; }).slice(0, 4);
      html += '<section>' + secHead(topicName(topic), byTopic(pool(), topic).length, '#' + topic) +
        '<div class="strip">' + cardHtml(lead, { summary: true }) + '<div class="list">' + rows.map(rowHtml).join('') + '</div></div></section>';
      [lead].concat(rows).forEach(function (it) { used[it.id] = true; });
    });
    var remaining = items.filter(function (it) { return !used[it.id]; });
    if (remaining.length) {
      var shown = remaining.slice(0, state.page * PAGE_SIZE);
      html += '<section>' + secHead(t('more'), remaining.length) + '<div class="grid cols-3">' + shown.map(function (it) { return cardHtml(it, { region: true }); }).join('') + '</div>' +
        (shown.length < remaining.length ? '<div class="more" style="margin-top:18px"><button class="btn" type="button" id="more-btn">' + esc(t('loadMore')) + ' (' + (remaining.length - shown.length) + ')</button></div>' : '') + '</section>';
    }
    els.content.innerHTML = html;
  }

  function renderTopic(topic) {
    var items = search(byTopic(pool(), topic));
    var html = secHead(topicName(topic), items.length, null, state.region ? (t('hints') || {})[state.region] : '');
    if (!items.length) { els.content.innerHTML = html + '<div class="state"><p>' + esc(t('noResults')) + '</p></div>'; return; }
    var hero = heroHtml(items);
    var used = {};
    if (hero) { html += hero.html; hero.used.forEach(function (it) { used[it.id] = true; }); }
    var rest = items.filter(function (it) { return !used[it.id]; });
    var shown = rest.slice(0, state.page * PAGE_SIZE);
    html += '<div class="grid cols-3" style="margin-top:22px">' + shown.map(function (it) { return cardHtml(it, { summary: true, region: true }); }).join('') + '</div>';
    if (shown.length < rest.length) html += '<div class="more" style="margin-top:18px"><button class="btn" type="button" id="more-btn">' + esc(t('loadMore')) + ' (' + (rest.length - shown.length) + ')</button></div>';
    els.content.innerHTML = html;
  }

  function renderSearch() {
    var items = search(pool());
    var html = secHead(t('searchResults') + ': “' + state.query + '”', items.length);
    if (!items.length) { els.content.innerHTML = html + '<div class="state"><p>' + esc(t('noResults')) + '</p></div>'; return; }
    var shown = items.slice(0, state.page * PAGE_SIZE);
    html += '<div class="grid cols-3">' + shown.map(function (it) { return cardHtml(it, { summary: true, region: true }); }).join('') + '</div>';
    if (shown.length < items.length) html += '<div class="more" style="margin-top:18px"><button class="btn" type="button" id="more-btn">' + esc(t('loadMore')) + '</button></div>';
    els.content.innerHTML = html;
  }

  function renderLive() {
    var chans = state.data.liveTv || [];
    var html = secHead(t('liveTv'), chans.length) + '<p class="live-note">' + esc(t('liveHint')) + '</p><div class="live-grid">' +
      chans.map(function (c) {
        return '<div class="live-card"><h3 class="name"><span class="badge">' + esc(t('live')) + '</span>' + esc(c.name) + '<span class="cc">' + esc(c.country === 'XK' ? 'KS' : c.country) + '</span></h3>' +
          '<div class="btns"><a class="primary" href="' + esc(c.live) + '" target="_blank" rel="noopener">' + ICON.play + esc(t('watchLive')) + '</a>' +
          (c.youtube ? '<a href="' + esc(c.youtube) + '" target="_blank" rel="noopener">' + ICON.ext + 'YouTube</a>' : '') +
          (c.home ? '<a href="' + esc(c.home) + '" target="_blank" rel="noopener">' + ICON.ext + esc(c.home.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/.*$/, '')) + '</a>' : '') + '</div></div>';
      }).join('') + '</div>';
    els.content.innerHTML = html;
  }

  function renderContent() {
    if (state.view === 'live') return renderLive();
    if (state.query.trim()) return renderSearch();
    if (state.view === 'top') return renderHome();
    return renderTopic(state.view);
  }

  // ---------- rendering: chrome ----------
  function renderChrome() {
    var d = state.data;
    document.documentElement.lang = state.lang;
    document.title = t('name') + ' — ' + t('tagline');
    $('#strip-date').textContent = longDate(new Date());
    var lp = d ? londonParts(d.generatedAt) : null;
    $('#strip-updated').textContent = lp ? t('updated') + ' ' + lp.date + ' ' + lp.time + ' ' + lp.zone + ' · ' + t('london') : t('schedule');
    els.search.placeholder = t('search'); els.search.setAttribute('aria-label', t('searchLabel'));
    els.langBtn.textContent = t('langSwitch'); els.langBtn.title = t('langSwitchTitle');
    els.themeBtn.innerHTML = (state.theme === 'dark' ? ICON.moon : state.theme === 'light' ? ICON.sun : ICON.auto) + '<span>' + esc(state.theme === 'auto' ? 'Auto' : state.theme) + '</span>';
    els.themeBtn.title = t('theme');
    $('#ticker-lbl').textContent = t('breaking');
    if (!d) return;
    // Primary nav: home + topics that have stories
    var topics = (d.topics || []).filter(function (tp) { return (d.topicCounts || {})[tp.id]; });
    els.nav.innerHTML = '<a href="#top"' + (state.view === 'top' && !state.query ? ' aria-current="page"' : '') + '>' + esc(t('home')) + '</a>' +
      topics.map(function (tp) { return '<a href="#' + tp.id + '"' + (state.view === tp.id && !state.query ? ' aria-current="page"' : '') + '>' + esc(tp[state.lang] || tp.sq) + '</a>'; }).join('') +
      '<a href="#live"' + (state.view === 'live' ? ' aria-current="page"' : '') + ' style="color:var(--red)">' + esc(t('liveTv')) + '</a>';
    // Region chips
    var counts = {};
    d.items.forEach(function (it) { counts[it.category] = (counts[it.category] || 0) + 1; (it.tags || []).forEach(function (tg) { if (tg !== it.category) counts[tg] = (counts[tg] || 0) + 1; }); });
    els.regionbar.innerHTML = '<span class="lbl">' + esc(t('regionLabel')) + '</span><button class="chip" type="button" data-region="" aria-pressed="' + (!state.region) + '">' + esc(t('allRegions')) + '</button>' +
      REGIONS.map(function (r) { return '<button class="chip" type="button" data-region="' + r + '" aria-pressed="' + (state.region === r) + '">' + esc(t(r)) + '<span class="n">' + (counts[r] || 0) + '</span></button>'; }).join('');
    // Ticker: newest 12 from the whole pool (duplicated for a seamless loop)
    var latest = d.items.slice(0, 12).map(function (it) { return '<a href="' + esc(it.url) + '" target="_blank" rel="noopener"><time>' + esc(clock(it.published)) + '</time>' + esc(displayTitle(it)) + '</a>'; }).join('');
    $('#ticker-items').innerHTML = latest + latest;
  }

  function renderRail() {
    var d = state.data, p = pool();
    var lp = londonParts(d.generatedAt);
    var html = '';
    // Live TV
    var chans = (d.liveTv || []).slice(0, 8);
    html += '<div class="rb live"><h2>' + esc(t('liveTv')) + '<span class="n">' + (d.liveTv || []).length + ' ' + esc(t('channels').toLowerCase()) + '</span></h2><p>' + esc(t('liveHint')) + '</p>' +
      '<ul class="channels">' + chans.map(function (c) { return '<li><a href="' + esc(c.live) + '" target="_blank" rel="noopener">' + esc(c.name) + '<span class="cc">' + esc(c.country === 'XK' ? 'KS' : c.country) + '</span></a></li>'; }).join('') + '</ul>' +
      '<div class="app-links" style="margin-top:10px"><a href="#live" style="color:#fff;border-color:rgba(255,255,255,0.3)">' + esc(t('seeAll')) + '</a></div>' +
      '<div class="stamp"><span class="time">' + esc(lp.time) + '</span><span class="lbl">' + esc(lp.zone) + ' · ' + esc(t('updatedAt')) + ' · ' + esc(t('schedule')) + '</span></div></div>';
    // Latest
    var latest = p.slice(0, 12);
    html += '<div class="rb"><h2>' + esc(t('latest')) + '</h2><ul class="latest">' + latest.map(function (it) {
      return '<li><time>' + esc(clock(it.published)) + '</time><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(displayTitle(it)) + '<span class="s">' + esc(it.source) + '</span></a></li>';
    }).join('') + '</ul></div>';
    // Region blocks (Kosovo + Diaspora + World on Albanians) when not already filtered to them
    [['kosovo', 5], ['diaspora', 5], ['world', 5]].forEach(function (pair) {
      var r = pair[0];
      if (state.region === r) return;
      var list = d.items.filter(function (it) { return it.category === r || (r !== 'world' && (it.tags || []).indexOf(r) !== -1); }).slice(0, pair[1]);
      if (!list.length) return;
      html += '<div class="rb"><h2>' + esc(t(r)) + '<button class="n chip-link" type="button" data-region="' + r + '" style="cursor:pointer">' + esc(t('seeAll')) + '</button></h2><div class="list">' + list.map(rowHtml).join('') + '</div></div>';
    });
    // International media quick links
    html += '<div class="rb"><h2>' + esc(t('quickLinks')) + '</h2><p>' + esc(t('quickLinksHint')) + '</p><ul class="links" style="margin-top:8px">' +
      (d.quickLinks || []).map(function (l) { return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + ICON.ext + '</a></li>'; }).join('') + '</ul></div>';
    // Sources
    var seen = {}, bySrc = {};
    d.items.forEach(function (it) { bySrc[it.source] = (bySrc[it.source] || 0) + 1; });
    var listed = (d.sources || []).filter(function (s) { if (!s.home || /Google News|Bing News/.test(s.name) || seen[s.name]) return false; seen[s.name] = true; return s.ok || s.items > 0 || !s.error || s.error === 'offline'; });
    html += '<div class="rb"><h2>' + esc(t('sources')) + '<span class="n">' + listed.length + '</span></h2><p>' + esc(fmt(t('sourcesHint'), listed.length)) + '</p><ul class="sources-list" style="margin-top:8px">' +
      listed.map(function (s) { var n = bySrc[s.name] || 0; return '<li><a href="' + esc(s.home) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>' + (n ? '<span class="n">' + n + '</span>' : '') + '</li>'; }).join('') + '</ul></div>';
    // App + RSS
    var store = window.LAJME_STORE || {};
    html += '<div class="rb"><h2>' + esc(t('getApp')) + '</h2><p>' + esc(t('rssHint')) + '</p><div class="app-links">' +
      '<button type="button" id="install-btn"' + (state.installPrompt ? '' : ' hidden') + '>' + esc(t('install')) + '</button>' +
      (store.android ? '<a href="' + esc(store.android) + '" target="_blank" rel="noopener">' + esc(t('android')) + '</a>' : '') +
      (store.ios ? '<a href="' + esc(store.ios) + '" target="_blank" rel="noopener">' + esc(t('ios')) + '</a>' : '') +
      '<a href="' + esc(d.feedUrl && !/USERNAME/.test(d.feedUrl) ? d.feedUrl : 'feed.xml') + '">' + esc(t('rss')) + '</a></div></div>';
    els.rail.innerHTML = html;
  }

  function renderFooter() {
    var d = state.data;
    var topics = (d.topics || []).filter(function (tp) { return (d.topicCounts || {})[tp.id]; });
    els.footer.innerHTML =
      '<div><h3>Lajme Shqip</h3><p>' + esc(t('aboutText')) + '</p><p class="fine">' + esc(t('schedule')) + ' · © ' + new Date().getFullYear() + ' Lajme Shqip</p></div>' +
      '<div><h3>' + esc(t('sections')) + '</h3><ul>' + topics.map(function (tp) { return '<li><a href="#' + tp.id + '">' + esc(tp[state.lang] || tp.sq) + '</a></li>'; }).join('') + '<li><a href="#live">' + esc(t('liveTv')) + '</a></li></ul></div>' +
      '<div><h3>' + esc(t('regionLabel')) + '</h3><ul>' + REGIONS.map(function (r) { return '<li><button class="chip-link" type="button" data-region="' + r + '" style="color:var(--on-band);cursor:pointer">' + esc(t(r)) + '</button></li>'; }).join('') +
      '<li style="margin-top:8px"><a href="privacy.html">' + esc(t('privacy')) + '</a> · <a href="feed.xml">RSS</a></li></ul></div>';
  }

  function render() {
    applyTheme();
    renderChrome();
    if (!state.data) return;
    renderContent();
    renderRail();
    renderFooter();
  }

  function toast(message) {
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = message; el.setAttribute('role', 'status');
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1800);
  }

  // ---------- events ----------
  function goTo(view) {
    state.view = view; state.page = 1; state.query = ''; els.search.value = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function readHash() {
    var h = (location.hash || '#top').replace('#', '');
    var valid = h === 'top' || h === 'live' || (state.data && (state.data.topics || []).some(function (tp) { return tp.id === h; }));
    return valid ? h : 'top';
  }
  function bind() {
    window.addEventListener('hashchange', function () { goTo(readHash()); });
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-region]');
      if (chip) { state.region = chip.getAttribute('data-region') || null; state.region = state.region || ''; state.page = 1; render(); if (!chip.classList.contains('chip')) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      var more = e.target.closest('#more-btn');
      if (more) { state.page += 1; renderContent(); return; }
      var share = e.target.closest('.share');
      if (share) {
        var url = share.getAttribute('data-url'), title = share.getAttribute('data-title');
        if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast(t('copied')); });
        return;
      }
      if (e.target.closest('#install-btn') && state.installPrompt) { state.installPrompt.prompt(); state.installPrompt = null; renderRail(); }
    });
    var timer;
    els.search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.query = els.search.value; state.page = 1;
        if (state.view === 'live' && state.query) { state.view = 'top'; try { history.replaceState(null, '', '#top'); } catch (e) { /* ignore */ } }
        render();
      }, 150);
    });
    els.langBtn.addEventListener('click', function () { state.lang = state.lang === 'sq' ? 'en' : 'sq'; setPref('lang', state.lang); render(); });
    els.themeBtn.addEventListener('click', function () {
      state.theme = state.theme === 'auto' ? 'dark' : state.theme === 'dark' ? 'light' : 'auto'; setPref('theme', state.theme); applyTheme(); renderChrome();
    });
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); state.installPrompt = e; var b = $('#install-btn'); if (b) b.hidden = false; });
    setInterval(function () { $('#strip-date').textContent = longDate(new Date()); }, 60000); // keep the date fresh without rebuilding the nav
  }

  function init() {
    els.content = $('#content'); els.rail = $('#rail'); els.footer = $('#footer'); els.nav = $('#nav'); els.regionbar = $('#regionbar');
    els.search = $('#search'); els.langBtn = $('#lang-btn'); els.themeBtn = $('#theme-btn');
    applyTheme();
    renderChrome();
    bind();
    state.view = readHash();
    load();
    if ('serviceWorker' in navigator && !window.LAJME_DATA && /^https?:/.test(location.protocol) && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
