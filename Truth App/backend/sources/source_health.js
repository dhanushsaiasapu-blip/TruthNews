import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const TIMEOUT_MS = 8000;

export async function checkFeed(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TruthNewsBackend/2.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = parser.parse(xml);
    const items = Array.isArray(data?.rss?.channel?.item)
      ? data.rss.channel.item
      : data?.rss?.channel?.item ? [data.rss.channel.item]
      : Array.isArray(data?.feed?.entry) ? data.feed.entry
      : data?.feed?.entry ? [data.feed.entry] : [];
    return { ok: true, httpStatus: response.status, responseTimeMs: Date.now() - started, articleCount: items.length, error: '' };
  } catch (error) {
    return { ok: false, httpStatus: 0, responseTimeMs: Date.now() - started, articleCount: 0, error: String(error?.message || error) };
  }
}
