import http from 'node:http';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const PORT = Number(process.env.PORT || 8080);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

import { SOURCE_REGISTRY, FEEDS as REGISTRY_FEEDS } from './sources/source_registry.js';
import { checkFeed } from './sources/source_health.js';

const feeds = REGISTRY_FEEDS.map(({ category, url, source }) => [category, source.name, url, source]);

const clean = (v) => typeof v === 'string' ? v.trim() : '';
const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);

function stripHtml(value) {
  return clean(String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' '));
}
function validUrl(value, { image = false } = {}) {
  try {
    let raw = clean(value);
    if (raw.startsWith('//')) raw = `https:${raw}`;
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (image && u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  } catch { return ''; }
}
function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function firstValue(...values) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}
function extractLink(item) {
  for (const link of arr(item?.link)) {
    if (typeof link === 'string') { const u = validUrl(link); if (u) return u; }
    if (link && typeof link === 'object') {
      const u = validUrl(link['@_href'] || link.href || link['#text']);
      if (u) return u;
    }
  }
  return validUrl(item?.guid?.['#text'] || item?.guid || item?.id);
}

// --- Date normalization -----------------------------------------------
// RSS feeds send dates in all sorts of formats (RFC-822 is the most common:
// "Wed, 17 Sep 2026 08:00:00 GMT"). Dart's DateTime.tryParse() only
// understands ISO 8601, so anything else silently fails on the client and
// shows up as "N/A". We normalize everything to real ISO 8601 here so the
// client never has to guess a format.
function normalizeDate(raw) {
  const value = clean(raw);
  if (!value) return '';
  if (/^0+$/.test(value)) return ''; // epoch-zero / placeholder, not a real date
  if (/^\d{10}$/.test(value)) {
    const d = new Date(Number(value) * 1000);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  if (/^\d{13}$/.test(value)) {
    const d = new Date(Number(value));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  // Date's built-in parser understands both RFC-822/2822 and ISO 8601.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

// --- Image extraction ---------------------------------------------------
// Previously this just took the first candidate in enclosure > media:content
// > thumbnail order with no regard for resolution, so a 32x32 site icon
// could easily beat a full article photo. Now we score every candidate by
// known/inferred width, reject icons/logos/SVGs, and upgrade common CMS
// thumbnail query params to a larger size.
const REJECT_IMAGE_PATTERN = /(icon|logo|sprite|avatar|favicon|placeholder|blank\.gif|1x1|pixel|spacer)/i;

function candidateWidth(url) {
  const m = String(url).match(/[?&](?:w|width)=(\d+)/i) || String(url).match(/-(\d{2,4})x\d{2,4}\./);
  return m ? parseInt(m[1], 10) : 0;
}

function upgradeThumbnailUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    let changed = false;
    for (const key of ['w', 'width']) {
      if (u.searchParams.has(key)) {
        const val = parseInt(u.searchParams.get(key), 10);
        if (Number.isFinite(val) && val > 0 && val < 320) {
          u.searchParams.set(key, '1024');
          changed = true;
        }
      }
    }
    if (u.searchParams.has('resize')) {
      const m = u.searchParams.get('resize').match(/^(\d+),(\d+)$/);
      if (m && parseInt(m[1], 10) < 320) {
        u.searchParams.set('resize', '1024,768');
        changed = true;
      }
    }
    return changed ? u.toString() : rawUrl;
  } catch {
    return rawUrl;
  }
}

function extractImage(item) {
  const candidates = [];
  const pushCandidate = (value, explicitWidth = 0) => {
    const u = validUrl(value, { image: true });
    if (!u) return;
    if (REJECT_IMAGE_PATTERN.test(u)) return;
    if (/\.svg(\?|$)/i.test(u)) return;
    const width = Number(explicitWidth) || candidateWidth(u) || 400;
    candidates.push({ url: u, width });
  };

  // Handle all common RSS/Atom image containers, including nested
  // media:group structures used by several publishers.
  const visit = (value, key = '') => {
    if (!value) return;
    if (typeof value === 'string') {
      if (/image|media|thumbnail|enclosure|content|src|href|url/i.test(key)) pushCandidate(value, 0);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key);
      return;
    }
    if (typeof value === 'object') {
      const url = value['@_url'] || value['@_href'] || value.url || value.href || value['#text'];
      const width = Number(value['@_width'] || value.width || 0);
      if (url) pushCandidate(url, width);
      for (const [childKey, childValue] of Object.entries(value)) {
        if (childKey === '#text' || childKey === '@_url' || childKey === '@_href' || childKey === '@_width') continue;
        visit(childValue, childKey);
      }
    }
  };
  for (const key of ['enclosure', 'media:content', 'media:thumbnail', 'media:group', 'image', 'media:content@url']) {
    visit(item?.[key], key);
  }

  // Some feeds put the hero image only inside encoded HTML.
  const html = String(item?.['content:encoded'] || item?.description || item?.summary || '');
  for (const m of html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|data-original|srcset)=["']([^"']+)["']/gi)) {
    const raw = String(m[1]).split(',')[0].trim().split(/\s+/)[0];
    pushCandidate(raw, 0);
  }

  // Also recognize JSON-like image fields that some Atom feeds expose.
  visit(item?.thumbnail, 'thumbnail');
  visit(item?.imageUrl, 'imageUrl');

  if (!candidates.length) return '';
  // Prefer a genuinely large image; if dimensions are unknown, retain the
  // first publisher-provided candidate rather than discarding it.
  candidates.sort((a, b) => b.width - a.width);
  return upgradeThumbnailUrl(candidates[0].url);
}

// Fallback for articles whose RSS entry gave us nothing usable: fetch the
// article page and pull its og:image meta tag. Bounded concurrency + a
// per-URL cache + a short timeout so a slow/broken site can't stall the
// whole feed refresh.
const ogImageCache = new Map();
let ogFetchesInFlight = 0;
const OG_IMAGE_CONCURRENCY = 4;

async function fetchOgImage(articleUrl) {
  if (ogImageCache.has(articleUrl)) return ogImageCache.get(articleUrl);
  while (ogFetchesInFlight >= OG_IMAGE_CONCURRENCY) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  ogFetchesInFlight++;
  try {
    const response = await fetch(articleUrl, {
      headers: { 'User-Agent': 'TruthNewsBackend/2.0 (+https://truthnews.app)' },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) { ogImageCache.set(articleUrl, ''); return ''; }
    const html = await response.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const image = match ? validUrl(match[1], { image: true }) : '';
    ogImageCache.set(articleUrl, image);
    return image;
  } catch {
    ogImageCache.set(articleUrl, '');
    return '';
  } finally {
    ogFetchesInFlight--;
  }
}

async function backfillImages(stories) {
  const missing = stories.filter((s) => !s.imageUrl);
  await Promise.all(missing.map(async (s) => {
    const image = await fetchOgImage(s.articleUrl);
    if (image) s.imageUrl = image;
  }));
  return stories;
}

function toStory(item, category, source, sourceMeta = null) {
  const title = clean(item?.title);
  const url = extractLink(item);
  if (!title || !url) return null;
  const publishedAt = normalizeDate(firstValue(item?.pubDate, item?.isoDate, item?.published, item?.updated, item?.['dc:date'], item?.date));
  const description = stripHtml(item?.description || item?.summary || item?.['content:encoded'] || item?.content || '');
  const image = extractImage(item);
  return {
    id: crypto.createHash('sha256').update(`${source}|${url}`).digest('hex').slice(0, 24),
    headline: decodeEntities(title),
    neutralSummary: decodeEntities(description || title),
    summarySource: 'source',
    category,
    publishedAt,
    sourceName: source,
    articleUrl: url,
    imageUrl: image,
    semanticLabel: decodeEntities(title),
    isBreaking: false,
    categories: sourceMeta?.categories || [category],
    country: sourceMeta?.country || '',
    region: sourceMeta?.region || '',
    sourceType: sourceMeta?.sourceType || 'publisher',
    politicalLean: ALLOWED_LEANS.has(sourceMeta?.politicalLean) ? sourceMeta.politicalLean : 'Center',
    politicalLeanConfidence: sourceMeta?.politicalLeanConfidence || 'low',
    articlePoliticalEstimate: 'Unknown',
    articlePoliticalEstimateConfidence: 'low',
    storyClusterId: '',
  };
}
async function fetchFeed(category, source, url, sourceMeta) {
  const response = await fetch(url, { headers: { 'User-Agent': 'TruthNewsBackend/2.0 (+https://truthnews.app)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${source}: Feed ${response.status}`);
  const xml = await response.text();
  const data = parser.parse(xml);
  const items = arr(data?.rss?.channel?.item).concat(arr(data?.feed?.entry));
  return items.map(x => toStory(x, category, source, sourceMeta)).filter(Boolean);
}

// --- RSS feed cache -------------------------------------------------------
// Previously every /news request re-downloaded and re-parsed all ~28 RSS
// feeds from scratch, which is most of why the app was slow to load. Feeds
// don't change second-to-second, so we cache each feed's parsed items for a
// short TTL and dedupe concurrent requests for the same feed. On a fetch
// failure we fall back to the last good copy (however stale) instead of
// dropping that outlet from the whole response.
const FEED_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes
const feedCache = new Map(); // url -> { items, fetchedAt }
const feedInFlight = new Map(); // url -> Promise

async function fetchFeedCached(category, source, url, sourceMeta) {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < FEED_CACHE_TTL_MS) {
    return cached.items;
  }
  if (feedInFlight.has(url)) return feedInFlight.get(url);
  const promise = fetchFeed(category, source, url, sourceMeta)
    .then((items) => {
      feedCache.set(url, { items, fetchedAt: Date.now() });
      feedInFlight.delete(url);
      return items;
    })
    .catch((error) => {
      feedInFlight.delete(url);
      if (cached) return cached.items; // graceful degradation: serve stale copy
      throw error;
    });
  feedInFlight.set(url, promise);
  return promise;
}
function titleTerms(title) {
  const stop = new Set(['the','a','an','and','or','of','to','in','on','for','with','as','at','by','from','is','are','was','were','be','been','has','have','had','this','that','after','before','over','into','amid','says','said','new','news']);
  return new Set(clean(title).toLowerCase().replace(/[^a-z0-9£$%]+/g,' ').split(/\s+/).filter(w => w.length >= 3 && !stop.has(w)));
}
function titlesMatch(a,b) {
  const left=titleTerms(a), right=titleTerms(b);
  if(left.size<3 || right.size<3) return false;
  let intersection=0; for(const w of left) if(right.has(w)) intersection++;
  const union=new Set([...left,...right]).size;
  return intersection>=3 && (intersection/union>=0.42 || intersection/Math.min(left.size,right.size)>=0.72);
}

// Picks which outlet's fields (headline/url/image/date) represent the
// merged story. Previously this was always "whichever outlet's article
// created the merge group" — and since BBC feeds are listed first, BBC
// effectively always won regardless of which outlets actually covered the
// story. Now we score each candidate on data completeness (has an image,
// has a real publish date) and break ties with a stable hash of the
// article URL, so the "winner" no longer depends on feed fetch order.
function pickRepresentative(candidates) {
  let best = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    let score = 0;
    if (candidate.imageUrl) score += 2;
    if (candidate.publishedAt) score += 1;
    // Fractional, deterministic tiebreak so ties don't always resolve to
    // the same outlet (e.g. all fall back with no image/date).
    const hashFraction = parseInt(
      crypto.createHash('sha256').update(candidate.articleUrl).digest('hex').slice(0, 8),
      16,
    ) / 0xffffffff;
    score += hashFraction;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function extractNamedTerms(text) {
  return new Set(String(text || '').match(/\b[A-Z][A-Za-zÀ-ÖØ-öø-ÿ]{2,}\b/g) || []);
}
function datesClose(a, b) {
  if (!a || !b) return true;
  const da = new Date(a).getTime(), db = new Date(b).getTime();
  return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) <= 36 * 60 * 60 * 1000 : true;
}
function shouldCluster(a, b) {
  if (a.category !== b.category && !(a.categories || []).some(c => (b.categories || []).includes(c))) return false;
  if (!datesClose(a.publishedAt, b.publishedAt)) return false;
  const titleOk = titlesMatch(a.headline, b.headline);
  if (titleOk) return true;
  const na = extractNamedTerms(a.headline), nb = extractNamedTerms(b.headline);
  let common = 0; for (const x of na) if (nb.has(x)) common++;
  return common >= 2 && titleTerms(a.headline).size >= 4 && titleTerms(b.headline).size >= 4;
}
function mergeStories(stories) {
  const groups = [];
  for (const story of stories) {
    let group = groups.find(g => shouldCluster(g.representative, story));
    if (!group) {
      group = { category: story.category, headline: story.headline, neutralSummary: story.neutralSummary, candidates: [], representative: story };
      groups.push(group);
    }
    if (!group.candidates.some(c => c.sourceName === story.sourceName)) {
      group.candidates.push(story);
    }
    if ((story.neutralSummary || '').length > (group.neutralSummary || '').length) {
      group.neutralSummary = story.neutralSummary;
    }
  }
  return groups
    .map((group) => {
      const representative = pickRepresentative(group.candidates);
      const outlets = group.candidates.map((c) => ({
        name: c.sourceName,
        lean: resolveLean(c.sourceName, c.politicalLean),
        framing: '',
        politicalLeanConfidence: c.politicalLeanConfidence || 'low',
        articleUrl: c.articleUrl,
        imageUrl: c.imageUrl || '',
        publishedAt: c.publishedAt || '',
      }));
      const clusterId = crypto.createHash('sha256').update(outlets.map(o => o.articleUrl).sort().join('|')).digest('hex').slice(0, 24);
      return {
        id: clusterId,
        headline: representative.headline,
        neutralSummary: group.neutralSummary || representative.neutralSummary,
        summarySource: 'source',
        category: group.category,
        publishedAt: representative.publishedAt,
        sourceName: representative.sourceName,
        articleUrl: representative.articleUrl,
        imageUrl: representative.imageUrl,
        semanticLabel: representative.headline,
        isBreaking: false,
        categories: [...new Set(group.candidates.flatMap(c => c.categories || [group.category]))],
        country: representative.country || '',
        region: representative.region || '',
        sourceType: representative.sourceType || 'publisher',
        politicalLean: resolveLean(representative.sourceName, representative.politicalLean),
        politicalLeanConfidence: representative.politicalLeanConfidence || 'low',
        articlePoliticalEstimate: 'Unknown',
        articlePoliticalEstimateConfidence: 'low',
        storyClusterId: clusterId,
        outletCount: outlets.length,
        outlets,
      };
    })
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 60);
}

const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);
const aiCache = new Map();

// --- Outlet lean resolution ----------------------------------------------
// Publisher leaning is source metadata, not an article-level inference. Every
// registry entry is normalized to one of the five visible labels, and this
// fallback guarantees malformed/legacy payloads cannot expose an unrated
// outlet to the client.
const ALLOWED_LEANS = new Set(['Center', 'Lean Left', 'Left', 'Lean Right', 'Right']);
const STATIC_LEAN_FALLBACK = Object.fromEntries(
  SOURCE_REGISTRY.map(source => [source.name.trim().toLowerCase(), source.politicalLean])
);
const outletLeanCache = new Map();

function resolveLean(name, aiLean) {
  const key = clean(name).toLowerCase();
  if (ALLOWED_LEANS.has(aiLean)) {
    outletLeanCache.set(key, aiLean);
    return aiLean;
  }
  if (outletLeanCache.has(key)) return outletLeanCache.get(key);
  const fallback = STATIC_LEAN_FALLBACK[key] || 'Center';
  outletLeanCache.set(key, fallback);
  return fallback;
}

async function openAIJson(prompt) {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      input: prompt,
      text: { format: { type: 'json_object' } },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0,300)}`);
  }
  const data = await response.json();
  const text = data.output_text || data.output?.flatMap(x => x.content || []).map(x => x.text || '').join('') || '';
  try { return JSON.parse(text); } catch { return null; }
}
async function enrichStory(story) {
  const key = `story:${story.id}`;
  if (aiCache.has(key)) return { ...story, ...aiCache.get(key) };

  if (!OPENAI_API_KEY) {
    const outlets = story.outlets.map(o => ({ ...o, lean: resolveLean(o.name, o.lean) }));
    return { ...story, outlets };
  }

  const sourceText = story.outlets.map(o => `${o.name}: ${o.articleUrl}`).join('\n');
  const prompt = `You are the neutral editorial assistant for a news aggregation app.
Return JSON with exactly:
{"summary":"...","summarySource":"ai"}
Rules:
- Write a factual, neutral summary of the story in 70-110 words. Do not add facts not supported by the supplied headline/description.
- Do not persuade, praise, condemn, or speculate.
- Do not assign political labels to publishers. Publisher metadata is maintained separately from article analysis.
Story headline: ${story.headline}
Existing source description: ${story.neutralSummary}
Outlets:
${sourceText}`;
  try {
    const result = await openAIJson(prompt);
    const summary = clean(result?.summary);
    const outlets = story.outlets.map(o => ({ ...o, lean: resolveLean(o.name, o.lean) }));
    const patch = {
      ...(summary && summary.split(/\s+/).length >= 60 ? { neutralSummary: summary, summarySource:'ai' } : {}),
      outlets,
    };
    aiCache.set(key, patch);
    return { ...story, ...patch };
  } catch (e) {
    console.error('AI enrichment failed:', e.message);
    const outlets = story.outlets.map(o => ({ ...o, lean: resolveLean(o.name, o.lean) }));
    return { ...story, outlets };
  }
}

async function getStories(categories) {
  const wanted = new Set(categories.length ? categories : feeds.map(([c]) => c));
  const selected = feeds.filter(([category]) => wanted.has(category));
  const results = [];
  const requests = selected.map((feed) =>
    fetchFeedCached(...feed)
      .then(value => { results.push({ status: 'fulfilled', value }); return value; })
      .catch(error => { results.push({ status: 'rejected', reason: error }); return []; })
  );

  // The main All feed stays fast. Category-specific requests, however, are
  // used to warm the app with a useful batch for that tab, so give them a
  // larger startup budget and prefer at least 10 merged stories when the
  // available publishers can provide them. Slow/broken feeds remain isolated.
  const FAST_START_MS = categories.length === 1 ? 7000 : 2200;
  if (categories.length === 1) {
    const deadline = Date.now() + FAST_START_MS;
    while (Date.now() < deadline) {
      const merged = mergeStories(
        results
            .flatMap(r => r.status === 'fulfilled' ? r.value : [])
            .filter((s, index, all) => all.findIndex(x => x.articleUrl === s.articleUrl) === index),
      );
      if (merged.length >= 10 || results.length >= requests.length) break;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  } else {
    await Promise.race([
      Promise.all(requests),
      new Promise(resolve => setTimeout(resolve, FAST_START_MS)),
    ]);
  }

  const seen = new Set();
  const unique = results.flatMap(r => r.status === 'fulfilled' ? r.value : []).filter(s => {
    if (seen.has(s.articleUrl)) return false;
    seen.add(s.articleUrl);
    return true;
  });
  return mergeStories(unique);
}
// --- /news response cache -------------------------------------------------
// On top of the per-feed cache above, cache the fully merged+enriched
// response per requested category set. A request that lands within the
// fresh window returns instantly with no upstream work at all. A request
// that lands after the fresh window but before the stale ceiling triggers a
// background refresh while still answering immediately from the last good
// copy, so the user never waits on AI/image enrichment. Concurrent requests
// for the same category set share a single in-flight computation instead of
// each kicking off their own full fetch ("thundering herd").
const NEWS_FRESH_MS = 90 * 1000; // serve straight from cache, no refresh
const NEWS_STALE_CEILING_MS = 20 * 60 * 1000; // still usable if refresh fails
const newsCache = new Map(); // key -> { articles, fetchedAt }
const newsInFlight = new Map(); // key -> Promise

function newsCacheKey(categories) {
  return categories.length ? [...categories].sort().join(',') : '__all__';
}

async function backgroundEnrichNews(key, articles) {
  try {
    const imageCandidates = articles.filter(s => !s.imageUrl).slice(0, 36);
    if (imageCandidates.length) await backfillImages(imageCandidates);

    // AI is deliberately limited and fully off the critical rendering path.
    const aiCandidates = articles.slice(0, 20);
    const concurrency = 4;
    for (let i = 0; i < aiCandidates.length; i += concurrency) {
      await Promise.all(aiCandidates.slice(i, i + concurrency).map(enrichStory));
    }
    const cached = newsCache.get(key);
    if (cached) cached.fetchedAt = Date.now();
  } catch (error) {
    console.error('Background enrichment failed:', error.message);
  }
}

function refreshNews(key, categories) {
  if (newsInFlight.has(key)) return newsInFlight.get(key);
  const promise = getStories(categories)
    .then((articles) => {
      newsCache.set(key, { articles, fetchedAt: Date.now() });
      newsInFlight.delete(key);
      // Never make users wait for article-page image lookups or AI.
      // Those upgrades mutate the cached stories for subsequent requests.
      queueMicrotask(() => backgroundEnrichNews(key, articles));
      return articles;
    })
    .catch((error) => {
      newsInFlight.delete(key);
      throw error;
    });
  newsInFlight.set(key, promise);
  return promise;
}

async function getStoriesCached(categories, forceRefresh = false) {
  const key = newsCacheKey(categories);
  if (forceRefresh) {
    // Explicit feed refreshes bypass the response cache so category feeds can
    // keep discovering newly published stories while the user scrolls.
    return refreshNews(key, categories);
  }
  const cached = newsCache.get(key);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  if (cached && age < NEWS_FRESH_MS) return cached.articles;
  if (cached && age < NEWS_STALE_CEILING_MS) {
    // Serve the stale-but-usable copy immediately; refresh in the background
    // so the *next* request is fresh again. Never let a slow/failed refresh
    // block a request that already has good data to show.
    refreshNews(key, categories).catch(() => {});
    return cached.articles;
  }
  // No usable cache at all: this request has to wait for the real fetch,
  // but a fetch failure here is a hard failure -- no fallback to serve.
  return refreshNews(key, categories);
}

function sendJson(res,status,body) {
  const text=JSON.stringify(body);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120','Access-Control-Allow-Origin':'*'});
  res.end(text);
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS'});return res.end();}
  const requestUrl=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='GET' && requestUrl.pathname==='/health') {
    const sources = SOURCE_REGISTRY.map(s => ({
      sourceId: s.sourceId, name: s.name, enabled: s.enabled,
      verificationStatus: s.verificationStatus, feedCount: s.feedUrls.length,
      lastHealth: s.lastHealth,
    }));
    return sendJson(res,200,{ok:true,aiConfigured:Boolean(OPENAI_API_KEY),sourceCount:SOURCE_REGISTRY.length,enabledSourceCount:SOURCE_REGISTRY.filter(s=>s.enabled).length,feedCount:feeds.length,cachedFeeds:feedCache.size,cachedNewsResponses:newsCache.size,sources});
  }
  if(req.method==='GET' && requestUrl.pathname==='/source-health') {
    const results = [];
    for (const source of SOURCE_REGISTRY) {
      for (const feed of source.feedUrls) {
        const health = await checkFeed(feed.url);
        source.lastHealth = { ...health, checkedAt: new Date().toISOString(), category: feed.category, url: feed.url };
        results.push({sourceId: source.sourceId, name: source.name, category: feed.category, url: feed.url, ...health});
      }
    }
    return sendJson(res,200,{sources: results});
  }
  if(req.method!=='GET' || requestUrl.pathname!=='/news') return sendJson(res,404,{error:'Not found'});
  try {
    const categories=clean(requestUrl.searchParams.get('categories')).split(',').map(clean).filter(Boolean);
    const forceRefresh=requestUrl.searchParams.get('refresh') === '1';
    const articles=await getStoriesCached(categories, forceRefresh);
    if(!articles.length) return sendJson(res,503,{error:'News is temporarily unavailable.'});
    return sendJson(res,200,{articles});
  } catch(error) {
    console.error(error);
    return sendJson(res,503,{error:'News is temporarily unavailable.'});
  }
});
server.listen(PORT,()=>console.log(`Truth backend listening on :${PORT}`));
