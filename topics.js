'use strict';
/**
 * Topic classification — the sections a TV news portal uses (Top Channel / A2 CNN / News24 style):
 *
 *   politike | ekonomi | kronike | bote | sport | showbiz | teknologji | kulture | shendet | opinion | aktualitet
 *
 * Signals, in order of trust:
 *   1. the feed's own <category> tags (e.g. "Sport", "Kronikë", "Showbiz")
 *   2. the article URL path (e.g. /sport/, /kronike/, /ekonomi/)
 *   3. keyword rules on title + summary (Albanian + English), scored — highest score wins
 *   4. defaults: international items → "bote", everything else → "aktualitet"
 */

const L = String.raw`\p{L}*`;
const NB = String.raw`(?<![\p{L}\p{N}])`;
const NE = String.raw`(?![\p{L}\p{N}])`;
const re = (alts) => new RegExp(`${NB}(?:${alts})${NE}`, 'giu');

const TOPICS = [
  { id: 'politike', sq: 'Politikë', en: 'Politics' },
  { id: 'ekonomi', sq: 'Ekonomi', en: 'Economy' },
  { id: 'kronike', sq: 'Kronikë', en: 'Crime & Accidents' },
  { id: 'bote', sq: 'Botë', en: 'World' },
  { id: 'sport', sq: 'Sport', en: 'Sport' },
  { id: 'showbiz', sq: 'Showbiz', en: 'Showbiz' },
  { id: 'teknologji', sq: 'Teknologji', en: 'Technology' },
  { id: 'kulture', sq: 'Kulturë', en: 'Culture' },
  { id: 'shendet', sq: 'Shëndetësi', en: 'Health' },
  { id: 'opinion', sq: 'Opinion', en: 'Opinion' },
  { id: 'aktualitet', sq: 'Aktualitet', en: 'Current affairs' },
];
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

// Feed category tag → topic (lower-cased, diacritics stripped; exact, prefix or substring for longer needles)
const CATEGORY_HINTS = [
  ['sport', 'sport'], ['futboll', 'sport'], ['football', 'sport'], ['basketboll', 'sport'], ['tenis', 'sport'], ['superliga', 'sport'], ['kombetarja', 'sport'],
  ['showbiz', 'showbiz'], ['magazin', 'showbiz'], ['argetim', 'showbiz'], ['entertainment', 'showbiz'], ['lifestyle', 'showbiz'], ['fun', 'showbiz'], ['pop news', 'showbiz'], ['vip', 'showbiz'], ['celeb', 'showbiz'], ['horoskop', 'showbiz'], ['receta', 'showbiz'],
  ['ekonomi', 'ekonomi'], ['econom', 'ekonomi'], ['biznes', 'ekonomi'], ['business', 'ekonomi'], ['financ', 'ekonomi'], ['money', 'ekonomi'], ['turizem', 'ekonomi'], ['tourism', 'ekonomi'],
  ['kronik', 'kronike'], ['krim', 'kronike'], ['crime', 'kronike'], ['aksident', 'kronike'], ['polici', 'kronike'], ['drejtesi', 'kronike'], ['gjykat', 'kronike'], ['blu', 'kronike'],
  ['politik', 'politike'], ['politic', 'politike'], ['zgjedhje', 'politike'], ['election', 'politike'], ['qeveri', 'politike'], ['parlament', 'politike'], ['kuvend', 'politike'], ['bashkimi evropian', 'politike'],
  ['bote', 'bote'], ['bota', 'bote'], ['world', 'bote'], ['nderkombetar', 'bote'], ['international', 'bote'], ['ballkan', 'bote'], ['rajon', 'bote'], ['evrop', 'bote'], ['europe', 'bote'], ['global', 'bote'],
  ['teknologji', 'teknologji'], ['tech', 'teknologji'], ['shkenc', 'teknologji'], ['science', 'teknologji'], ['auto', 'teknologji'], ['digital', 'teknologji'],
  ['kultur', 'kulture'], ['culture', 'kulture'], ['art', 'kulture'], ['libr', 'kulture'], ['book', 'kulture'], ['histori', 'kulture'], ['history', 'kulture'], ['fe', 'kulture'], ['religion', 'kulture'], ['muzik', 'kulture'], ['music', 'kulture'], ['arsim', 'kulture'], ['education', 'kulture'],
  ['shendet', 'shendet'], ['health', 'shendet'], ['mjek', 'shendet'], ['medic', 'shendet'], ['diet', 'shendet'], ['fitness', 'shendet'], ['wellness', 'shendet'],
  ['opinion', 'opinion'], ['editorial', 'opinion'], ['analiz', 'opinion'], ['analysis', 'opinion'], ['koment', 'opinion'], ['column', 'opinion'], ['blog', 'opinion'], ['debat', 'opinion'], ['intervist', 'opinion'], ['interview', 'opinion'],
  ['aktualitet', 'aktualitet'], ['lajme', 'aktualitet'], ['news', 'aktualitet'], ['vendi', 'aktualitet'], ['sociale', 'aktualitet'], ['shoqeri', 'aktualitet'],
];

const URL_HINTS = [
  [/\/(sport|sporti|futboll|football|soccer|basketball|tenis|superliga)(\/|$)/i, 'sport'],
  [/\/(showbiz|showbizz|magazina|magazine|argetim|entertainment|lifestyle|popnews|pop-news|fun|vip|celebrity|horoskopi)(\/|$)/i, 'showbiz'],
  [/\/(ekonomi|economy|business|biznes|financa|finance|money|turizem|tourism)(\/|$)/i, 'ekonomi'],
  [/\/(kronike|kronika|krim|crime|aksident|drejtesi|justice|blu)(\/|$)/i, 'kronike'],
  [/\/(politike|politika|politics|zgjedhjet|elections)(\/|$)/i, 'politike'],
  [/\/(bota|bote|world|nderkombetare|international|ballkani|balkans|rajoni|region|evropa|europe|rajoni-bota)(\/|$)/i, 'bote'],
  [/\/(teknologji|tech|technology|shkence|science|auto|digital)(\/|$)/i, 'teknologji'],
  [/\/(kulture|kultura|culture|arte|art|histori|history|libra|books|muzike|music|arsim|education)(\/|$)/i, 'kulture'],
  [/\/(shendet|shendetesi|health|mjekesi|medicine|dieta|diet|fitness)(\/|$)/i, 'shendet'],
  [/\/(opinion|opinione|editorial|analiza|analysis|koment|komente|column|blog|intervista)(\/|$)/i, 'opinion'],
];

// Keyword rules. Each match adds the rule weight (max 4 matches per rule); the topic with the highest score wins.
const RULES = [
  { topic: 'sport', weight: 3, re: re(String.raw`sport${L}|futboll${L}|football|soccer|basketboll${L}|basketball|nba|tenis${L}|tennis|volejboll${L}|volleyball|ndeshj${L}|kampionat${L}|championship|superlig${L}|kategoria superiore|premier league|serie a|bundesliga|la liga|ligue 1|champions league|europa league|conference league|liga e kampion${L}|kombëtarj${L}|kombetarj${L}|national team|uefa|fifa|gol|goli|golat|gola|golash|goal|goals|trajner${L}|coach|lojtar${L}|player${L}|sulmues${L}|striker|portier${L}|goalkeeper|mesfushor${L}|midfielder|olimpi${L}|olympic${L}|boks${L}|boxing|boksier${L}|boxer|mundj${L}|wrestling|xhudo|judo|karate|atlet${L}|athlet${L}|maraton${L}|marathon|world cup|kupa e botës|euro 20\d\d|formula 1|grand prix|medalj${L}|medal${L}|stadium${L}|klubi|klubet|club|skuadr${L}|squad|derbi|derby|penallti|penalty|gjysmëfinal${L}|semi-final|finale|finalja|finalen|xhaka|shaqiri|broja|asllani|muriqi|rashica|zhegrova|daku|rrahmani|hysaj|djimsiti|asani|bajrami|mbappé|mbappe|ronaldo|messi|haaland|arsenal|chelsea|liverpool|manchester united|manchester city|real madrid|barcelona|juventus|bayern|psg|kf tirana|partizani|vllaznia|kf drita|fc prishtina|olimpik${L}|kombëtarja|kombetarja|federat${L} e futbollit|fshf|ffk`) },
  { topic: 'showbiz', weight: 3, re: re(String.raw`showbiz${L}|vip|këngëtar${L}|kengetar${L}|singer|reper${L}|rapper|aktor${L}|actor|actress|kinema|festival${L}|celebrit${L}|celebrity|big brother|bbv${L}|bbvip|përputhen|perputhen|dua lipa|rita ora|bebe rexha|ava max|era istrefi|ermal meta|noizy|ledri|tayna|dafina|elvana|enca|capital t|mozzik|loredana|dhurata|instagram|tiktok|reality|koncert${L}|concert${L}|album${L}|këng${L}|keng${L}|klip${L}|videoklip${L}|serial${L}|netflix|hollywood|oscar${L}|grammy|mod[aë]|modës|fashion|miss universe|miss albania|influencer${L}|glamour|sensual${L}|provoku${L}|dasm${L}|wedding|divorc${L}|divorce|shtatzën${L}|pregnan${L}|beqar${L}|çift${L}|couple|i dashur|e dashur|girlfriend|boyfriend|romanc${L}|romance|horoskop${L}|horoscope|receta|recipe|gatim${L}|kuzhin${L}|foto${L} e fundit|bikini|vjeshtë${L} e modës|sfilat${L}|parfum${L}|bukuri${L}|beauty|makeup|makijazh${L}`) },
  { topic: 'kronike', weight: 3, re: re(String.raw`kronik${L}|vra|vrau|vrahet|vritet|vrarë|vrasj${L}|vrasës${L}|murder${L}|killed|killing|shot dead|plagos${L}|wounded|injured|aksident${L}|accident|crash${L}|përplas${L}|arrest${L}|prangos${L}|prangat|detained|polici${L}|police|gjykat${L}|court|gjyq${L}|trial|prokuror${L}|prosecut${L}|spak|gjkko|hetim${L}|investigat${L}|drog${L}|drug${L}|kanabis${L}|cannabis|kokain${L}|cocaine|heroin${L}|trafik${L}|trafficking|grabit${L}|robbery|vjedh${L}|theft|stole${L}|dhun${L}|violence|përleshj${L}|brawl|shpërthim${L}|explosion|zjarr${L}|fire|flakë${L}|blaze|përmbyt${L}|flood${L}|tërmet${L}|earthquake|viktim${L}|victim${L}|vdekur|vdes|vdiq|died|dies|dead|death|kufom${L}|body found|zhduk${L}|missing|rrëmb${L}|kidnap${L}|krim${L}|crime${L}|criminal${L}|gang${L}|band[ëa]${L}|mafia|burg${L}|prison|jail${L}|dënoh${L}|dënuar|sentenced|ekstrad${L}|extradit${L}|femicid${L}|abuz${L}|abuse|përdhun${L}|rape|thik${L}|stabb${L}|armë${L}|weapon${L}|gun|guns|sekuestr${L}|seized|kontraband${L}|smuggl${L}|mashtr${L}|fraud|korrupsion${L}|corruption|ryshfet${L}|bribe${L}|pastrim parash|money laundering|mbyt${L}|drown${L}|helmim${L}|poison${L}|zjarrfikës${L}|firefighter${L}|i dyshuar|e dyshuar|suspect${L}|i kërkuar|e kërkuar|wanted by|cannabis farm|shpërthen|explodes|goditur|hit by|shkelur|run over|përdhunim${L}`) },
  { topic: 'ekonomi', weight: 3, re: re(String.raw`ekonomi${L}|econom${L}|biznes${L}|business${L}|tregu|tregjet|market${L}|çmim${L}|cmim${L}|price${L}|inflacion${L}|inflation|bank[aë]${L}|banking|lek|lekë|lekësh|lekun|lekët|dollar${L}|tatim${L}|tax|taxes|taks${L}|buxhet${L}|budget${L}|investim${L}|investitor${L}|invest${L}|burs${L}|stock${L}|papunësi${L}|unemployment|rrog${L}|paga|pagat|pagave|wage${L}|salar${L}|pension${L}|energji${L}|energy|naft${L}|oil|karburant${L}|fuel|gazi|gazit|gazsjellës${L}|gas|elektri${L}|electricity|turizëm${L}|turizem${L}|tourism|turist${L}|tourist${L}|eksport${L}|export${L}|import${L}|fmn|imf|banka botërore|world bank|bqk|bsh|tregti${L}|trade|kompani${L}|compan${L}|ndërmarrj${L}|sipërmarr${L}|entrepreneur${L}|startup${L}|kredi${L}|loan${L}|hipotek${L}|mortgage${L}|pasuri${L} e paluajtshme|real estate|apartament${L}|qira${L}|rent|ndërtim${L}|construction|infrastruktur${L}|infrastructure|aeroport${L}|airport|porti|portin|portet|hekurudh${L}|railway|bujqësi${L}|agricultur${L}|fermer${L}|farmer${L}|rritj${L} ekonomike|gdp|pbb|remitanc${L}|remittance${L}|tvsh|vat|dogan${L}|customs|bitcoin|crypto|kripto|çmimet|shtrenjt${L}|lirë${L}|inflacioni|konsumator${L}|consumer${L}|tregtar${L}|merchant${L}|dyqan${L}|shop${L}|supermarket${L}|tenderi|tender${L}|koncesion${L}|concession${L}|ppp|borxh${L}|debt|deficit${L}|fitim${L}|profit${L}|humbje financiare|financ${L}`) },
  { topic: 'politike', weight: 2, re: re(String.raw`politik${L}|politic${L}|qeveri${L}|government${L}|kryeminist${L}|prime minister|president${L}|minist${L}|parlament${L}|parliament${L}|kuvend${L}|deput${L}|mp|mps|lawmaker${L}|zgjedhj${L}|election${L}|vot[aëoi]${L}|parti${L}|party|opozit${L}|opposition|koalicion${L}|coalition|reform${L}|ligj${L}|law|bill|kushtetut${L}|constitution${L}|rama|berisha|kurti|osmani|veliaj|basha|haradinaj|thaçi|thaci|abdixhiku|vetëvendosje|vetevendosje|ldk|pdk|aak|nisma|lsi|bashki${L}|mayor|kryetar${L}|bashkimi evropian|european union|integrim${L}|integration|nato|kfor|eulex|dialog${L}|dialogue|diplomat${L}|ambasad${L}|embass${L}|ambassador|senat${L}|senate|congress|kongres${L}|referendum${L}|kryebashkiak${L}|komun[aë]${L}|municipal${L}|shba|usa|trump|biden|putin|merz|macron|meloni|starmer|erdogan|vučić|vucic|serbi${L}|serbia${L}|beograd|belgrade|bruksel${L}|brussels|uashington|washington|okb|united nations|sanksion${L}|sanction${L}|marrëveshj${L}|agreement|samit${L}|summit|kandidat${L}|candidate|mandat${L}|kabinet${L}|cabinet|dorëheqj${L}|resign${L}|mocion${L}|motion|protest${L}|demonstrat${L}|grev[aë]${L}|strike|sindikat${L}|komision${L}|commission|kryetar${L} i kuvendit|speaker|gjykata kushtetuese|constitutional court|vetting|kqz|cec|ministri${L}|ministry|ministria|kryetari i bashkisë|qeveria|kabineti|projektligj${L}|draft law|seanc${L}|session|debat${L} parlamentar|byroja politike|kryesia|asamble${L}|assembly|liberalizim${L}|viza${L}|visa|anëtarësim${L}|membership|njohj${L}|recognition|sovranitet${L}|sovereignty`) },
  { topic: 'teknologji', weight: 3, re: re(String.raw`teknologji${L}|technolog${L}|tech|inteligjenc${L} artificiale|artificial intelligence|iphone|apple|google|microsoft|samsung|android|ios|aplikacion${L}|app|apps|smartphone${L}|telefon${L} inteligjent|kompjuter${L}|computer${L}|laptop${L}|interneti|softuer${L}|software|kiber${L}|cyber${L}|hacker${L}|hakeri|robot${L}|chatgpt|openai|tesla|spacex|nasa|satelit${L}|satellite${L}|hapësir${L}|space|raket${L}|rocket|shkenc${L}|scienc${L}|scientist${L}|inovacion${L}|innovation|5g|blockchain|whatsapp|facebook|meta ai|elon musk|zuckerberg|drone${L}|dron${L}|makina elektrike|electric car${L}|bateri${L}|batter${L}|çip${L}|chip${L}|nvidia|privatësi${L}|privacy|gaming|video ?lojë${L}|playstation|xbox|nintendo|algoritm${L}|algorithm${L}|të dhënat personale|personal data|rrjet${L} social${L}|social media|youtube|streaming|wi-?fi|kabll${L}|fiber|starlink|celular${L}|mobile network|sim`) },
  { topic: 'kulture', weight: 3, re: re(String.raw`kultur${L}|cultur${L}|art|arti|artist${L}|piktor${L}|painter${L}|piktur${L}|painting${L}|ekspozit${L}|exhibition${L}|muze${L}|museum${L}|teat${L}|theatre|theater|libr${L}|book${L}|shkrimtar${L}|writer${L}|poet${L}|poezi${L}|poetry|letërsi${L}|literature|kadare|roman|romani|novel${L}|histori${L}|histor${L}|arkeolog${L}|archaeolog${L}|trashëgimi${L}|heritage|unesco|dokumentar${L}|documentary|oper[aë]|balet${L}|ballet|orkestr${L}|orchestra|folklor${L}|folk|traditë${L}|tradition${L}|gjuh${L} shqipe|albanian language|alfabet${L}|feja|fetar${L}|religio${L}|kish${L}|church${L}|xhami${L}|mosque${L}|bektashi${L}|ortodoks${L}|orthodox|katolik${L}|catholic|mysliman${L}|muslim${L}|krishtlindj${L}|christmas|bajram${L}|eid|pashk${L}|easter|papa|pope|skënderbe${L}|skanderbeg|ilir${L}|illyria${L}|kalaj${L}|castle${L}|arkitektur${L}|architectur${L}|film${L}|regjisor${L}|director|cinema|shfaqj${L}|premier[aë]|premiere|skulptur${L}|sculptur${L}|fotografi${L}|photograph${L}|bibliotek${L}|librar${L}|akademi${L}|academy|universitet${L}|universit${L}|arsim${L}|educat${L}|shkoll${L}|school${L}|student${L}|nxënës${L}|pupil${L}|mësues${L}|teacher${L}|viti shkollor|school year|matur${L}|diplom${L}|kurrikul${L}|curriculum|profesor${L}|professor${L}|rektor${L}|monument${L}|amfiteat${L}|butrint${L}|apoloni${L}|gjirokastr${L} unesco|berat unesco`) },
  { topic: 'shendet', weight: 3, re: re(String.raw`shëndet${L}|shendet${L}|health${L}|mjek${L}|doctor${L}|spital${L}|hospital${L}|sëmundj${L}|semundj${L}|disease${L}|illness${L}|virus${L}|covid${L}|grip${L}|flu|vaksin${L}|vaccin${L}|kancer${L}|cancer${L}|diabet${L}|zemr${L}|heart|infarkt${L}|stroke|pacient${L}|patient${L}|ilaç${L}|ilac${L}|medicin${L}|medicine${L}|farmaci${L}|pharmac${L}|dietë${L}|diet${L}|ushqim${L}|nutrition|fitness|psikolog${L}|psycholog${L}|depresion${L}|depression|stres${L}|stress|gjum${L}|sleep|epidemi${L}|pandemi${L}|obez${L}|obes${L}|shëndetësi${L}|healthcare|qsut|urgjenc${L} mjekësore|ambulanc${L}|kirurg${L}|surge${L}|operacion${L} kirurgjik|surgery|transplant${L}|dhurues${L}|donor|gjak${L}|blood|alergji${L}|allerg${L}|vitamin${L}|kalori${L}|calories|humbj${L} pesh${L}|weight loss|dhjamos${L}|shtatzëni|pregnancy|foshnj${L}|infant${L}|higjien${L}|hygiene|dentist${L}|dhëmb${L}|teeth|lëkur${L}|skin|mushkëri${L}|lung${L}|veshk${L}|kidney${L}|mëlçi${L}|liver|infeksion${L}|infection${L}|antibiotik${L}|antibiotic${L}|isshp|obsh|oms|infermier${L}|nurse${L}|barn${L}|drugstore|simptom${L}|symptom${L}|trajtim${L}|treatment${L}|terapi${L}|therap${L}|autizëm|autism|alzheimer${L}|demenc${L}|dementia|tension${L} i gjakut|blood pressure|kolesterol${L}|cholesterol`) },
  { topic: 'opinion', weight: 4, re: re(String.raw`opinion${L}|editorial${L}|op-ed|analiz[aë]${L}|analysis|kolumn${L}|column${L}|columnist|pikëpamje|viewpoint|explainer|intervist${L}|interview${L}|nga [A-ZÇË]${L} [A-ZÇË]${L}:`) },
  { topic: 'bote', weight: 2, re: re(String.raw`botë${L}|bote${L}|world|ndërkombëtar${L}|international|lufta|luftë${L}|war|ukrain${L}|ukraine|rusi${L}|russia${L}|gaza|izrael${L}|israel${L}|hamas${L}|iran${L}|liban${L}|lebanon|sirian${L}|syria${L}|kina|kinë|kinës|kinez${L}|china|chinese|tajvan${L}|taiwan|korea|koreja|koreane|korea${L}|japoni${L}|japan${L}|india|indian|indiane|indisë|pakistan${L}|afganistan${L}|afghanistan|turqi${L}|turkey|egjipt${L}|egypt|afrik${L}|africa${L}|amerik${L}|america${L}|kanada${L}|canada${L}|meksik${L}|mexico|brazil${L}|argjentin${L}|argentina|australi${L}|australia${L}|gjermani${L}|germany|franc${L}|france|itali${L}|italy|spanj${L}|spain|britani${L}|britain|angli${L}|england|greqi${L}|greece|maqedoni${L}|macedonia|mal i zi|montenegro|kroaci${L}|croatia|bosnj${L}|bosnia|bullgari${L}|bulgaria|rumani${L}|romania|hungari${L}|hungary|poloni${L}|poland|suedi${L}|sweden|norvegji${L}|norway|holand${L}|netherlands|belgjik${L}|belgium|zvic${L}|switzerland|austri${L}|austria|eu|nato|okb|united nations|nasa|pentagon${L}|kremlin${L}|shtëpia e bardhë|white house|zelensky|zelenski|netanyahu|xi jinping|kim jong|modi|papa|pope|onu|trump|putin|macron|merz|meloni|starmer|erdogan|vučić|vucic`) },
];

function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function topicFromCategories(categories) {
  for (const raw of categories || []) {
    const c = fold(raw).trim();
    if (!c) continue;
    for (const [needle, topic] of CATEGORY_HINTS) {
      if (c === needle || (needle.length > 2 && c.startsWith(needle)) || (needle.length > 3 && c.includes(needle))) return topic;
    }
  }
  return null;
}

function topicFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    for (const [rx, topic] of URL_HINTS) if (rx.test(p)) return topic;
  } catch { /* ignore */ }
  return null;
}

function score(text) {
  const scores = {};
  for (const rule of RULES) {
    const matches = text.match(rule.re);
    if (matches) scores[rule.topic] = (scores[rule.topic] || 0) + rule.weight * Math.min(matches.length, 4);
  }
  return scores;
}

/**
 * @param {{title:string, summary?:string, url?:string, categories?:string[], category?:string}} item
 * @returns {string} topic id
 */
function classifyTopic(item) {
  const fromCat = topicFromCategories(item.categories);
  const fromUrl = topicFromUrl(item.url);
  const title = String(item.title || '');
  const scores = score(`${title} . ${title} . ${item.summary || ''}`); // the title counts double
  const isIntl = item.category === 'international';
  if (isIntl) scores.bote = (scores.bote || 0) + 6; // general world headlines live under Botë unless a topic is unmistakable
  if (fromCat) scores[fromCat] = (scores[fromCat] || 0) + 6;
  if (fromUrl) scores[fromUrl] = (scores[fromUrl] || 0) + 5;
  if (!isIntl && scores.bote && fromCat !== 'bote' && fromUrl !== 'bote') scores.bote -= 2; // home stories that merely mention a country
  let best = null, bestScore = 0;
  for (const [topic, s] of Object.entries(scores)) if (s > bestScore) { best = topic; bestScore = s; }
  if (!best || bestScore < 3) return isIntl ? 'bote' : 'aktualitet';
  return TOPIC_IDS.has(best) ? best : 'aktualitet';
}

module.exports = { TOPICS, classifyTopic, topicFromCategories, topicFromUrl };
