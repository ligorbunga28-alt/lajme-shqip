'use strict';
/**
 * All news sources for Lajme Shqip.
 *
 * Every entry: { id, name, url, home, lang, region, category, ...options }
 *   category  default section for items from this feed:
 *             albania | kosovo | region | diaspora | world | international
 *   filter    true  -> keep ONLY items that mention Albania/Kosovo/Albanians (keyword feeds, world media)
 *   keep      for international outlets: number of newest general headlines to keep for the
 *             "International" section (relevant items are always kept and moved to "world")
 *   fallback  alternative feed URL (used when the primary fails or is stale)
 *   redirector 'bing' | 'google' -> unwrap the outlet's real link + source name
 *
 * Verified 3 Sep 2026: feeds marked "verified" returned valid XML. Feeds that stopped working
 * are skipped automatically (the run never fails because of one source) and listed in
 * docs/data/news.json -> sources[].ok so you can see which ones need attention.
 *
 * To add a source: append one object to the right list below. That's it.
 */

const ALBANIA = [
  { id: 'balkanweb', name: 'BalkanWeb', url: 'https://www.balkanweb.com/feed/', home: 'https://www.balkanweb.com', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'euronews-al', name: 'Euronews Albania', url: 'https://euronews.al/feed/', home: 'https://euronews.al', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'euronews-al-en', name: 'Euronews Albania (EN)', url: 'https://euronews.al/en/feed/', home: 'https://euronews.al/en/', lang: 'en', region: 'AL', category: 'albania' }, // verified
  { id: 'tiranatimes', name: 'Tirana Times', url: 'https://www.tiranatimes.com/feed/', home: 'https://www.tiranatimes.com', lang: 'en', region: 'AL', category: 'albania' }, // verified
  { id: 'reporter-al', name: 'Reporter.al (BIRN)', url: 'https://www.reporter.al/feed/', home: 'https://www.reporter.al', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'rtsh', name: 'RTSH', url: 'https://rtsh.al/feed/', home: 'https://rtsh.al', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'abcnews-al', name: 'ABC News Albania', url: 'https://abcnews.al/feed/', home: 'https://abcnews.al', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'vizionplus', name: 'Vizion Plus', url: 'https://www.vizionplus.tv/feed/', home: 'https://www.vizionplus.tv', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  { id: 'panorama', name: 'Panorama', url: 'https://www.panorama.com.al/feed/', home: 'https://www.panorama.com.al', lang: 'sq', region: 'AL', category: 'albania' }, // verified (low volume)
  { id: 'citizens', name: 'Citizens Channel', url: 'https://citizens.al/feed/', home: 'https://citizens.al', lang: 'en', region: 'AL', category: 'albania' }, // verified (low volume)
  { id: 'albanianpost', name: 'Albanian Post', url: 'https://admin.albanianpost.com/feed/', home: 'https://albanianpost.com', lang: 'sq', region: 'AL', category: 'albania' }, // verified
  // Outlets without a working RSS feed (Top Channel, Syri, Lapsi, A2 CNN, Report TV, Ora News, Shqiptarja,
  // Gazeta Tema, Politiko, Newsbomb, ATA, Exit.al ...) are still covered through the Google News / Bing
  // keyword feeds below, which index them.
  { id: 'topchannel', name: 'Top Channel', url: 'https://top-channel.tv/feed/', home: 'https://top-channel.tv', lang: 'sq', region: 'AL', category: 'albania', optional: true },
  { id: 'exit-en', name: 'Exit News', url: 'https://exit.al/en/feed/', home: 'https://exit.al/en/', lang: 'en', region: 'AL', category: 'albania', optional: true },
  { id: 'ata', name: 'ATA', url: 'https://ata.gov.al/feed/', home: 'https://ata.gov.al', lang: 'sq', region: 'AL', category: 'albania', optional: true },
];

const KOSOVO = [
  { id: 'telegrafi', name: 'Telegrafi', url: 'https://telegrafi.com/feeds/feed.rss', home: 'https://telegrafi.com', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'koha', name: 'Koha Ditore', url: 'https://www.koha.net/rss', home: 'https://www.koha.net', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified (Atom)
  { id: 'gazetaexpress', name: 'Gazeta Express', url: 'https://www.gazetaexpress.com/feed/', home: 'https://www.gazetaexpress.com', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'kallxo', name: 'Kallxo', url: 'https://kallxo.com/feed/', home: 'https://kallxo.com', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'insajderi', name: 'Insajderi', url: 'https://insajderi.org/feed/', home: 'https://insajderi.org', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'insajderi-com', name: 'Gazeta Insajderi', url: 'https://insajderi.com/feed/', home: 'https://insajderi.com', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'prishtinainsight', name: 'Prishtina Insight', url: 'https://prishtinainsight.com/feed/', home: 'https://prishtinainsight.com', lang: 'en', region: 'XK', category: 'kosovo' }, // verified
  { id: 'botasot', name: 'Bota Sot', url: 'https://www.botasot.info/rss/', home: 'https://www.botasot.info', lang: 'sq', region: 'XK', category: 'kosovo', noImages: true }, // verified (broken enclosures)
  { id: 'lajmi', name: 'Lajmi.net', url: 'https://lajmi.net/feed/', home: 'https://lajmi.net', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'indeksonline', name: 'Indeksonline', url: 'https://indeksonline.net/feed/', home: 'https://indeksonline.net', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'epokaere', name: 'Epoka e Re', url: 'https://www.epokaere.com/feed/', home: 'https://www.epokaere.com', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'sbunker', name: 'Sbunker', url: 'https://sbunker.org/feed/', home: 'https://sbunker.org', lang: 'sq', region: 'XK', category: 'kosovo' }, // verified
  { id: 'kosovo20', name: 'Kosovo 2.0', url: 'https://admin.kosovotwopointzero.com/feed/', home: 'https://kosovotwopointzero.com', lang: 'sq', region: 'XK', category: 'kosovo', linkFromGuid: true }, // verified (titles only)
  { id: 'klankosova', name: 'Klan Kosova', url: 'https://klankosova.tv/feed/', home: 'https://klankosova.tv', lang: 'sq', region: 'XK', category: 'kosovo', optional: true },
  { id: 'rtk', name: 'RTK', url: 'https://www.rtklive.com/rss', home: 'https://www.rtklive.com', lang: 'sq', region: 'XK', category: 'kosovo', optional: true },
];

const REGION = [
  { id: 'alsat', name: 'Alsat', url: 'https://alsat.mk/feed/', home: 'https://alsat.mk', lang: 'sq', region: 'MK', category: 'region' }, // verified
  { id: 'portalb', name: 'Portalb', url: 'https://portalb.mk/feed/', home: 'https://portalb.mk', lang: 'sq', region: 'MK', category: 'region' }, // verified
  { id: 'koha-mk', name: 'Koha (Shkup)', url: 'https://koha.mk/feed/', home: 'https://koha.mk', lang: 'sq', region: 'MK', category: 'region' }, // verified
  { id: 'preshevapress', name: 'Presheva Press', url: 'https://preshevapress.com/feed/', home: 'https://preshevapress.com', lang: 'sq', region: 'RS', category: 'region', optional: true },
  { id: 'ulqini', name: 'Ulqini.info', url: 'https://ulqini.info/feed/', home: 'https://ulqini.info', lang: 'sq', region: 'ME', category: 'region', optional: true },
];

const DIASPORA = [
  { id: 'albinfo', name: 'Albinfo (Zvicër)', url: 'https://www.albinfo.ch/feed/', home: 'https://www.albinfo.ch', lang: 'sq', region: 'CH', category: 'diaspora' }, // verified
  { id: 'illyria', name: 'Illyria (New York)', url: 'https://www.illyria.com/feed/', home: 'https://www.illyria.com', lang: 'sq', region: 'US', category: 'diaspora' }, // verified
  { id: 'albeu', name: 'Albeu', url: 'https://albeu.com/feed/', home: 'https://albeu.com', lang: 'sq', region: 'EU', category: 'diaspora', optional: true },
  { id: 'diasporashqiptare', name: 'Diaspora Shqiptare', url: 'https://diasporashqiptare.al/feed/', home: 'https://diasporashqiptare.al', lang: 'sq', region: 'AL', category: 'diaspora', optional: true },
];

// International outlets. Relevant items (mentioning Albania/Kosovo/Albanians) go to "world";
// the newest `keep` general headlines go to "international".
const INTERNATIONAL = [
  { id: 'bbc', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', fallback: 'https://www.bing.com/news/search?q=site%3Abbc.com&format=rss', home: 'https://www.bbc.com/news', lang: 'en', region: 'GB', category: 'international', keep: 10 },
  { id: 'bbc-europe', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', home: 'https://www.bbc.com/news/world/europe', lang: 'en', region: 'GB', category: 'international', keep: 4 },
  { id: 'cnn', name: 'CNN', url: 'https://www.bing.com/news/search?q=site%3Acnn.com&format=rss', redirector: 'bing', home: 'https://edition.cnn.com', lang: 'en', region: 'US', category: 'international', keep: 8 },
  { id: 'reuters', name: 'Reuters', url: 'https://www.bing.com/news/search?q=site%3Areuters.com&format=rss', redirector: 'bing', fallback: 'https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen', home: 'https://www.reuters.com', lang: 'en', region: 'GB', category: 'international', keep: 8 },
  { id: 'dw', name: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all', fallback: 'https://www.bing.com/news/search?q=site%3Adw.com&format=rss', home: 'https://www.dw.com/en/', lang: 'en', region: 'DE', category: 'international', keep: 8 },
  { id: 'dw-sq', name: 'DW Shqip', url: 'https://rss.dw.com/rdf/rss-sq-all', fallback: 'https://www.bing.com/news/search?q=site%3Adw.com%2Fsq&format=rss', home: 'https://www.dw.com/sq/', lang: 'sq', region: 'DE', category: 'world', keep: 8, alwaysRelevant: true },
  { id: 'guardian', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', home: 'https://www.theguardian.com/world', lang: 'en', region: 'GB', category: 'international', keep: 6 },
  { id: 'guardian-albania', name: 'The Guardian', url: 'https://www.theguardian.com/world/albania/rss', home: 'https://www.theguardian.com/world/albania', lang: 'en', region: 'GB', category: 'world', alwaysRelevant: true },
  { id: 'guardian-kosovo', name: 'The Guardian', url: 'https://www.theguardian.com/world/kosovo/rss', home: 'https://www.theguardian.com/world/kosovo', lang: 'en', region: 'GB', category: 'world', alwaysRelevant: true },
  { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', home: 'https://www.aljazeera.com', lang: 'en', region: 'QA', category: 'international', keep: 6 }, // verified
  { id: 'euronews', name: 'Euronews', url: 'https://www.euronews.com/rss?level=vertical&name=news', home: 'https://www.euronews.com', lang: 'en', region: 'FR', category: 'international', keep: 6 }, // verified
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/europe/rss', home: 'https://www.france24.com/en/', lang: 'en', region: 'FR', category: 'international', keep: 4, optional: true },
  { id: 'politico-eu', name: 'Politico Europe', url: 'https://www.politico.eu/feed/', home: 'https://www.politico.eu', lang: 'en', region: 'EU', category: 'international', keep: 4, optional: true },
  { id: 'euractiv', name: 'Euractiv', url: 'https://www.euractiv.com/sections/enlargement/feed/', home: 'https://www.euractiv.com/sections/enlargement/', lang: 'en', region: 'EU', category: 'international', keep: 3, optional: true },
  { id: 'balkaninsight', name: 'Balkan Insight', url: 'https://balkaninsight.com/feed/', home: 'https://balkaninsight.com', lang: 'en', region: 'EU', category: 'world', keep: 6, optional: true },
  { id: 'voa-sq', name: 'Zëri i Amerikës', url: 'https://www.bing.com/news/search?q=site%3Azeriamerikes.com&format=rss', redirector: 'bing', home: 'https://www.zeriamerikes.com', lang: 'sq', region: 'US', category: 'world', alwaysRelevant: true, optional: true },
  { id: 'rel-sq', name: 'Radio Evropa e Lirë', url: 'https://www.bing.com/news/search?q=site%3Aevropaelire.org&format=rss', redirector: 'bing', home: 'https://www.evropaelire.org', lang: 'sq', region: 'CZ', category: 'world', alwaysRelevant: true, optional: true },
];

// Keyword feeds: the engine that finds Albanians "anywhere in the world, good or bad".
// Each query is checked against the relevance filter as well, so unrelated hits are dropped.
const gn = (q, hl, gl) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${gl}%3A${hl.split('-')[0]}`;
const bing = (q, mkt) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss${mkt ? `&setmkt=${mkt}&setlang=${mkt.split('-')[0]}` : ''}`;

const KEYWORD = [
  // English-language world coverage
  { id: 'gn-albania-en', name: 'Google News', url: gn('Albania OR Albanian OR Albanians', 'en-GB', 'GB'), redirector: 'google', lang: 'en', category: 'world', filter: true, optional: true },
  { id: 'gn-kosovo-en', name: 'Google News', url: gn('Kosovo OR Kosovar OR Pristina', 'en-US', 'US'), redirector: 'google', lang: 'en', category: 'world', filter: true, optional: true },
  { id: 'gn-geo-albania', name: 'Google News', url: 'https://news.google.com/rss/headlines/section/geo/Albania?hl=en-US&gl=US&ceid=US%3Aen', redirector: 'google', lang: 'en', category: 'world', filter: true, optional: true },
  { id: 'gn-geo-kosovo', name: 'Google News', url: 'https://news.google.com/rss/headlines/section/geo/Kosovo?hl=en-US&gl=US&ceid=US%3Aen', redirector: 'google', lang: 'en', category: 'world', filter: true, optional: true },
  { id: 'bing-albania', name: 'Bing News', url: bing('Albania'), redirector: 'bing', lang: 'en', category: 'world', filter: true }, // verified
  { id: 'bing-albanian', name: 'Bing News', url: bing('Albanian OR Albanians'), redirector: 'bing', lang: 'en', category: 'world', filter: true }, // verified
  { id: 'bing-kosovo', name: 'Bing News', url: bing('Kosovo'), redirector: 'bing', lang: 'en', category: 'world', filter: true }, // verified
  { id: 'bing-tirana', name: 'Bing News', url: bing('Tirana OR Pristina'), redirector: 'bing', lang: 'en', category: 'world', filter: true },
  { id: 'bing-diaspora-en', name: 'Bing News', url: bing('"Albanian community" OR "Albanian diaspora" OR "Albanian-born" OR "Kosovo-born"'), redirector: 'bing', lang: 'en', category: 'diaspora', filter: true },
  // Albanian-language: Google News indexes Top Channel, Syri, Lapsi, A2, Report TV, Klan Kosova, RTK ...
  { id: 'gn-shqiperi', name: 'Google News', url: gn('Shqipëri OR Shqipëria OR Tiranë', 'sq', 'AL'), redirector: 'google', lang: 'sq', category: 'albania', optional: true },
  { id: 'gn-kosove', name: 'Google News', url: gn('Kosovë OR Kosova OR Prishtinë', 'sq', 'AL'), redirector: 'google', lang: 'sq', category: 'kosovo', optional: true },
  { id: 'gn-diaspora-sq', name: 'Google News', url: gn('diaspora shqiptare OR mërgata OR "shqiptarët në"', 'sq', 'AL'), redirector: 'google', lang: 'sq', category: 'diaspora', optional: true },
  { id: 'gn-maqedoni', name: 'Google News', url: gn('shqiptarët Maqedoni OR Tetovë OR Shkup OR Preshevë OR Ulqin', 'sq', 'AL'), redirector: 'google', lang: 'sq', category: 'region', optional: true },
  { id: 'bing-shqip', name: 'Bing News', url: bing('Shqipëri OR Shqipëria OR shqiptarët', 'sq-AL'), redirector: 'bing', lang: 'sq', category: 'albania', filter: true },
  { id: 'bing-kosove', name: 'Bing News', url: bing('Kosovë OR Kosova', 'sq-AL'), redirector: 'bing', lang: 'sq', category: 'kosovo', filter: true },
  // Other languages where Albanians are often in the news
  { id: 'gn-albanien-de', name: 'Google News (DE)', url: gn('Albanien OR Albaner OR Kosovo', 'de', 'DE'), redirector: 'google', lang: 'de', category: 'world', filter: true, optional: true },
  { id: 'bing-albanien-de', name: 'Bing News (DE)', url: bing('Albanien OR Albaner OR Kosovo', 'de-DE'), redirector: 'bing', lang: 'de', category: 'world', filter: true },
  { id: 'gn-albania-it', name: 'Google News (IT)', url: gn('Albania OR albanesi OR Kosovo', 'it', 'IT'), redirector: 'google', lang: 'it', category: 'world', filter: true, optional: true },
  { id: 'bing-albania-it', name: 'Bing News (IT)', url: bing('Albania OR albanesi OR Kosovo', 'it-IT'), redirector: 'bing', lang: 'it', category: 'world', filter: true },
  { id: 'gn-albanie-fr', name: 'Google News (FR)', url: gn('Albanie OR albanais OR Kosovo', 'fr', 'FR'), redirector: 'google', lang: 'fr', category: 'world', filter: true, optional: true },
  { id: 'gn-albania-el', name: 'Google News (GR)', url: gn('Αλβανία OR Αλβανοί OR Κόσοβο', 'el', 'GR'), redirector: 'google', lang: 'el', category: 'world', filter: true, optional: true },
  { id: 'gn-albania-tr', name: 'Google News (TR)', url: gn('Arnavutluk OR Arnavut OR Kosova', 'tr', 'TR'), redirector: 'google', lang: 'tr', category: 'world', filter: true, optional: true },
  { id: 'gn-albania-ch', name: 'Google News (CH)', url: gn('Albanien OR Albaner OR Kosovaren', 'de', 'CH'), redirector: 'google', lang: 'de', category: 'diaspora', filter: true, optional: true },
  { id: 'gn-albania-us', name: 'Google News (US)', url: gn('Albanian OR Albanians "New York" OR Michigan OR Chicago OR Boston', 'en-US', 'US'), redirector: 'google', lang: 'en', category: 'diaspora', filter: true, optional: true },
  { id: 'gn-albania-uk', name: 'Google News (UK)', url: gn('Albanian OR Albanians London OR Britain OR "Home Office"', 'en-GB', 'GB'), redirector: 'google', lang: 'en', category: 'diaspora', filter: true, optional: true },
];

// Quick links shown on the site/app (not fetched).
const QUICK_LINKS = [
  { name: 'BBC News', url: 'https://www.bbc.com/news' },
  { name: 'CNN', url: 'https://edition.cnn.com' },
  { name: 'Reuters', url: 'https://www.reuters.com/world/' },
  { name: 'Deutsche Welle', url: 'https://www.dw.com/en/' },
  { name: 'DW Shqip', url: 'https://www.dw.com/sq/' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com' },
  { name: 'Euronews', url: 'https://www.euronews.com' },
  { name: 'Zëri i Amerikës', url: 'https://www.zeriamerikes.com' },
  { name: 'Radio Evropa e Lirë', url: 'https://www.evropaelire.org' },
  { name: 'Balkan Insight', url: 'https://balkaninsight.com' },
  { name: 'Top Channel', url: 'https://top-channel.tv' },
  { name: 'Klan Kosova', url: 'https://klankosova.tv' },
  { name: 'RTK', url: 'https://www.rtklive.com' },
];


// Live TV — official live pages (verified 3 Sep 2026) + YouTube channels. Shown in the "Live" section.
const LIVE_TV = [
  { id: 'topchannel', name: 'Top Channel', country: 'AL', live: 'https://top-channel.tv/topnewslive/', youtube: 'https://www.youtube.com/@TopChannelAlbania', youtubeId: 'UCyny-dfYPbE-CjAkzkZqF8A', home: 'https://top-channel.tv' },
  { id: 'a2cnn', name: 'A2 CNN', country: 'AL', live: 'https://a2news.com/live', youtube: 'https://www.youtube.com/@A2CNN', youtubeId: 'UCO-B2zbHROkxpMLjwQX6C8A', home: 'https://a2news.com' },
  { id: 'news24', name: 'News24', country: 'AL', live: 'https://www.news24.al/livestream/', youtube: 'https://www.youtube.com/@News24Albania', youtubeId: 'UC8X73IwfsLqlTaAHbXG05lg', home: 'https://www.news24.al' },
  { id: 'reporttv', name: 'Report TV', country: 'AL', live: 'https://report-tv.al/report_live', youtube: 'https://www.youtube.com/@ReportTVAlbania', youtubeId: 'UCk_fYBSdzmwhZEDPG5L4ShQ', home: 'https://report-tv.al' },
  { id: 'abcnews', name: 'ABC News', country: 'AL', live: 'https://abcnews.al/live/', youtube: 'https://www.youtube.com/channel/UCSd7F2EXAw0_Pgdc1Y1JKIg', youtubeId: 'UCSd7F2EXAw0_Pgdc1Y1JKIg', home: 'https://abcnews.al' },
  { id: 'euronewsal', name: 'Euronews Albania', country: 'AL', live: 'https://euronews.al/live/', youtube: 'https://www.youtube.com/channel/UChR-A__NS_C5kHDWj3PeAhw', youtubeId: 'UChR-A__NS_C5kHDWj3PeAhw', home: 'https://euronews.al' },
  { id: 'rtsh', name: 'RTSH', country: 'AL', live: 'https://www.youtube.com/@RadioTelevizioniShqiptar/streams', youtube: 'https://www.youtube.com/@RadioTelevizioniShqiptar', youtubeId: 'UCpiewjt_Bvzkebn6l1hwWOg', home: 'https://rtsh.al' },
  { id: 'klan', name: 'TV Klan', country: 'AL', live: 'https://tvklan.al/tv', youtube: 'https://www.youtube.com/@televizioniKLAN', youtubeId: 'UCN_5x0OTax_ProZjhww5PuA', home: 'https://tvklan.al' },
  { id: 'oranews', name: 'Ora News', country: 'AL', live: 'https://www.oranews.tv/live/', youtube: 'https://www.youtube.com/@rtvoranews1', youtubeId: 'UCU-25_ycYvBv60_nMHUxAwA', home: 'https://www.oranews.tv' },
  { id: 'syri', name: 'Syri TV', country: 'AL', live: 'https://www.syri.net/video.html?v=1.5', youtube: 'https://www.youtube.com/@syritv', youtubeId: 'UCrhOdWxeea0IF_H7jV4y7tQ', home: 'https://www.syri.net' },
  { id: 'vizionplus', name: 'Vizion Plus', country: 'AL', live: 'https://www.vizionplus.tv/livestream/', youtube: 'https://www.youtube.com/@VizionPlusAlbania', youtubeId: 'UCXZu85c9j8i_WDtip9hXZTQ', home: 'https://www.vizionplus.tv' },
  { id: 'klankosova', name: 'Klan Kosova', country: 'XK', live: 'https://klankosova.tv/tv', youtube: 'https://www.youtube.com/@KlanKosovaOfficial', youtubeId: 'UC_SXHVF21a9FqvEbtsyNcPg', home: 'https://klankosova.tv' },
  { id: 'rtk', name: 'RTK', country: 'XK', live: 'https://www.rtklive.com/sq/livestream/rtk1/', youtube: 'https://www.youtube.com/@RTKOfficial', youtubeId: 'UCLKm461v_m6OcgJOQDlXuuw', home: 'https://www.rtklive.com' },
  { id: 'rtv21', name: 'RTV 21', country: 'XK', live: 'https://rtv21.tv/direkt/rtv21', youtube: 'https://www.youtube.com/@rtv21', youtubeId: 'UC8Uy4yaBNxp0ocYLrLNNrxQ', home: 'https://rtv21.tv' },
  { id: 't7', name: 'T7', country: 'XK', live: 'https://www.televizioni7.com/live/', youtube: 'https://www.youtube.com/@T7videos', youtubeId: 'UCWJe7loIldFtmfaVHYaQw0g', home: 'https://www.televizioni7.com' },
  { id: 'dukagjini', name: 'RTV Dukagjini', country: 'XK', live: 'https://www.dukagjini.com/tv/', youtube: 'https://www.youtube.com/@DukagjiniTV', youtubeId: 'UCL3nrPOUK0MCcm5nFk800xQ', home: 'https://www.dukagjini.com' },
  { id: 'kanal10', name: 'Kanal 10', country: 'XK', live: 'https://www.youtube.com/@Kanal10Live/streams', youtube: 'https://www.youtube.com/@Kanal10Live', youtubeId: 'UCw72VwqUWpNDlO9caRyLGNQ', home: 'https://kanal10.live' },
  { id: 'alsat', name: 'Alsat', country: 'MK', live: 'https://www.youtube.com/@televizionialsatm/streams', youtube: 'https://www.youtube.com/@televizionialsatm', youtubeId: 'UCjHWbpNN6ID61Mq5q4hlEhA', home: 'https://alsat.mk' },
];

module.exports = {
  ALBANIA, KOSOVO, REGION, DIASPORA, INTERNATIONAL, KEYWORD, QUICK_LINKS, LIVE_TV,
  all: [...ALBANIA, ...KOSOVO, ...REGION, ...DIASPORA, ...INTERNATIONAL, ...KEYWORD],
};
