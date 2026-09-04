'use strict';
/**
 * Relevance + classification rules.
 *
 *  isRelevant(text, lang)  -> does this story mention Albania / Kosovo / Albanians?
 *  classify(item, source)  -> { category, tags, relevant }
 *
 * Categories:  albania | kosovo | region | diaspora | world | international
 * Tags (any of): albania, kosovo, region, diaspora — used by the site/app so that e.g. a BBC story
 * about Kosovo (category "world") also appears under the "Kosovë" tab.
 *
 * All patterns are Unicode-aware (ë, ç, Greek, Cyrillic) — JS `\b` only understands ASCII, so we use
 * letter look-arounds instead.
 */

const L = String.raw`\p{L}*`; // any letters (word suffix)
const NB = String.raw`(?<![\p{L}\p{N}])`; // "not preceded by a letter/number"  (Unicode word start)
const NE = String.raw`(?![\p{L}\p{N}])`;  // "not followed by a letter/number"  (Unicode word end)
const wordRe = (alternatives) => new RegExp(`${NB}(?:${alternatives})${NE}`, 'iu');

const ALBANIA_WORDS = String.raw`albania${L}|albanien${L}|albanie|shqip[eë]ri${L}|shqiperi${L}|tiran[aeë]${L}|durr[eë]s${L}|vlor[aeë]${L}|shkod[eë]r${L}|shkodra${L}|elbasan${L}|kor[cç][eë]${L}|gjirokast${L}|sarand[aeë]${L}|edi rama|sali berisha|ilir meta|bajram begaj|erion veliaj|lulzim basha|taulant balla|enver hoxha|ismail kadare|skanderbeg|sk[eë]nderbe${L}|arnavutluk|αλβαν${L}|албани${L}`;
const KOSOVO_WORDS = String.raw`kosov[oaeë]${L}|kosovar${L}|pristina|prishtin[aeë]${L}|prizren${L}|gjakov[aeë]${L}|mitrovic[aeë]${L}|pej[aeë]|ferizaj${L}|gjilan${L}|albin kurti|vjosa osmani|hashim tha[cç]i|ramush haradinaj|kadri veseli|isa mustafa|lumir abdixhiku|kfor|eulex|unmik|κόσοβο|косов${L}`;
const REGION_WORDS = String.raw`tetov[oaeë]${L}|shkup${L}|kumanov[oaeë]${L}|gostivar${L}|strug[aeë]${L}|dib[eë]r${L}|preshev[aeë]${L}|bujanoc${L}|medvegj[aeë]${L}|ulqin${L}|ulcinj|tuzi?|çam[eë]ri${L}|chameria|cham albanians|ali ahmeti|bujar osmani|arben taravari|izet mexhiti|north macedonia.{0,60}albanian|albanian.{0,60}north macedonia|montenegro.{0,60}albanian|albanian.{0,60}montenegro|greece.{0,60}albanian minority`;
const PEOPLE_WORDS = String.raw`albanian${L}|albaner${L}|albanesi|albanese|albanais${L}|shqiptar${L}|arnavut${L}|kosovar${L}|kosovaren`;
const CELEB_WORDS = String.raw`dua lipa|rita ora|bebe rexha|ava max|era istrefi|ermal meta|granit xhaka|xherdan shaqiri|armando broja|kristjan asllani|edon zhegrova|mirlind daku|vedat muriqi|milot rashica|amir rrahmani|inva mula|majlinda kelmendi|distria krasniqi|nora gjakova|lorik cana|elseid hysaj|berat djimsiti|jasir asani|nedim bajrami|hellbanianz|dritan abazovi[cć]|mother teresa|n[eë]n[eë] tereza`;

const ALBANIA_RE = wordRe(ALBANIA_WORDS);
const KOSOVO_RE = wordRe(KOSOVO_WORDS);
const REGION_RE = wordRe(REGION_WORDS);
const PEOPLE_RE = wordRe(PEOPLE_WORDS);
const CELEB_RE = wordRe(CELEB_WORDS);

// "Albanese" is also the surname of Australia's prime minister — never count that as Albanian news.
const FALSE_POSITIVE_RE = /\b(anthony albanese|albanese government|pm albanese|prime minister albanese|albanese's|albanese said|mr albanese|licia albanese|francesca albanese)\b/i;
const HISTORIC_RE = /\bcaucasian albania\b/i;

const DIASPORA_COUNTRY_WORDS = String.raw`uk|u\.k\.|britain|british|england|london|manchester|birmingham|scotland|wales|ireland|dublin|germany|german|berlin|munich|stuttgart|hamburg|frankfurt|switzerland|swiss|zurich|geneva|basel|bern|lausanne|austria|vienna|italy|italian|rome|milan|turin|naples|bari|greece|greek|athens|thessaloniki|france|french|paris|lyon|marseille|belgium|brussels|antwerp|netherlands|dutch|amsterdam|rotterdam|sweden|swedish|stockholm|malm[öo]|norway|oslo|denmark|copenhagen|finland|helsinki|spain|spanish|madrid|barcelona|portugal|lisbon|canada|canadian|toronto|montreal|vancouver|calgary|edmonton|usa|u\.s\.|united states|america${L}|new york|brooklyn|bronx|staten island|new jersey|michigan|detroit|chicago|boston|philadelphia|florida|texas|california|los angeles|australia${L}|sydney|melbourne|turkey|turkish|istanbul|ankara|izmir|croatia|zagreb|slovenia|ljubljana|luxembourg|czech|prague|poland|warsaw|ukraine|kyiv|dubai|emirates|qatar|doha|japan|tokyo|china|beijing|zvic[eë]r${L}|gjermani${L}|angli${L}|britani${L}|lond[eë]r${L}|londra|itali${L}|greqi${L}|franc[eë]${L}|belgjik${L}|holand${L}|suedi${L}|norvegji${L}|danimark${L}|austri${L}|shba|amerik${L}|kanada${L}|australi${L}|turqi${L}|kroaci${L}|slloveni${L}|arabi${L}|nju jork|çikago|mi[cç]igan`;
const DIASPORA_RE = wordRe(DIASPORA_COUNTRY_WORDS);
const DIASPORA_STRONG_RE = new RegExp(
  `${NB}(?:` + String.raw`diaspor${L}|m[eë]rgat${L}|m[eë]rgimtar${L}|emigrant${L}|emigracion${L}|kurbet${L}|migrant${L}|asylum|azil${L}|deport${L}|d[eë]bo${L}|refugee${L}|albanian[- ]born|kosovo[- ]born|albanian (?:community|communities|nationals?|man|woman|men|women|boy|girl|teen${L}|family|families|gang${L}|mafia|migrants?|refugees?|criminals?|worker${L}|student${L}|footballer|singer|boxer|actor|actress|businessman|doctor|nurse|restaurant|church|mosque|festival|flag|heritage|descent|origin|roots)|albanians? (?:in|living in|from|abroad)|(?:shqiptar${L}|kosovar${L}) (?:n[eë]|t[eë]|e|i) (?:` + DIASPORA_COUNTRY_WORDS + String.raw`)|(?:` + DIASPORA_COUNTRY_WORDS + String.raw`)[^.]{0,40}(?<![\p{L}])(?:shqiptar${L}|kosovar${L})|(?:me origjin[eë]|me prejardhje) shqiptare` + `)${NE}`,
  'iu',
);

function isRelevant(text, lang) {
  const t = String(text || '');
  if (!t) return false;
  if (HISTORIC_RE.test(t)) return false;
  if (ALBANIA_RE.test(t) || KOSOVO_RE.test(t) || REGION_RE.test(t) || CELEB_RE.test(t)) return true;
  if (PEOPLE_RE.test(t)) {
    // "albanese" alone only counts for Italian-language sources (it is Italian for "Albanian").
    if (/\balbanese\b/i.test(t) && !/\balbanesi\b/i.test(t) && lang !== 'it') return false;
    return !FALSE_POSITIVE_RE.test(t);
  }
  return false;
}

function tagsFor(text) {
  const t = String(text || '');
  const tags = new Set();
  if (ALBANIA_RE.test(t)) tags.add('albania');
  if (KOSOVO_RE.test(t)) tags.add('kosovo');
  if (REGION_RE.test(t)) tags.add('region');
  const peopleAbroad = PEOPLE_RE.test(t) && DIASPORA_RE.test(t);
  if (DIASPORA_STRONG_RE.test(t) || (peopleAbroad && !tags.has('albania') && !tags.has('kosovo'))) tags.add('diaspora');
  return tags;
}

/**
 * Decide the category + tags of one item.
 * @param {{title:string, summary:string}} item
 * @param {{category:string, lang:string, filter?:boolean, alwaysRelevant?:boolean}} source
 */
function classify(item, source) {
  const text = `${item.title || ''} . ${item.summary || ''}`;
  const relevant = Boolean(source.alwaysRelevant) || isRelevant(text, source.lang);
  const tags = tagsFor(text);
  const titleTags = tagsFor(item.title || '');
  let category = source.category;

  const homeOutlet = ['albania', 'kosovo', 'region', 'diaspora'].includes(source.category) && !source.filter && !source.redirector;

  if (homeOutlet) {
    // Home outlets keep their section; diaspora stories in their titles are surfaced under "Diaspora".
    if (titleTags.has('diaspora') && source.category !== 'diaspora') category = 'diaspora';
    tags.add(source.category);
  } else if (relevant) {
    if (source.category === 'diaspora' || tags.has('diaspora')) category = 'diaspora';
    else if (['albania', 'kosovo', 'region'].includes(source.category)) category = source.category;
    else category = 'world';
    if (source.lang === 'sq' && category === 'world') {
      // Albanian-language world outlets (DW Shqip, VOA, REL): file under the place they talk about.
      if (titleTags.has('kosovo') && !titleTags.has('albania')) category = 'kosovo';
      else if (titleTags.has('albania') && !titleTags.has('kosovo')) category = 'albania';
      else if (titleTags.has('region')) category = 'region';
    }
    if (category !== 'world' && category !== 'diaspora') tags.add(category);
  } else {
    category = source.category === 'world' ? 'international' : source.category;
  }

  return { category, tags: [...tags], relevant };
}

module.exports = { isRelevant, classify, tagsFor, ALBANIA_RE, KOSOVO_RE, REGION_RE, PEOPLE_RE, DIASPORA_STRONG_RE };
