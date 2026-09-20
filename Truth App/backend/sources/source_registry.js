// Canonical source registry. New sources stay disabled until their official
// feed/API endpoint has been verified by the runtime health checker.
// Political-lean values from the initial product target are stored as targets,
// not as objective facts.
const ALLOWED_LEANS = new Set(['Left', 'Lean Left', 'Center', 'Lean Right', 'Right']);

const common = (id, name, lean, country, region, categories, verification='unverified') => ({
  sourceId: id, name, homepage: '', feedUrls: [], country, region,
  language: 'en', categories, sourceType: 'publisher',
  // Every outlet is always assigned one of the five visible labels.
  // Registry entries use the supplied product target unless it is invalid.
  politicalLean: ALLOWED_LEANS.has(lean) ? lean : 'Center',
  politicalLeanConfidence: 'low',
  ratingProvider: 'initial-target', ratingDate: '', ratingNotes:
    'Initial target supplied for product configuration; not independently verified.',
  enabled: false, verificationStatus: verification, lastHealth: null,
});

const definitions = [
  common("bbc-news", "BBC News", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business", "Technology", "Science", "Health"], "legacy"),
  common("reuters", "Reuters", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business", "Finance", "Markets", "Technology", "Science", "Health"], "unverified"),
  common("associated-press", "Associated Press", "Lean Left", "United States", "North America", ["World", "US", "Politics", "Business", "Science", "Health"], "unverified"),
  common("al-jazeera", "Al Jazeera", "Lean Left", "Qatar", "Middle East", ["World", "Middle East", "Politics", "Business"], "legacy"),
  common("deutsche-welle", "Deutsche Welle", "Center", "Germany", "Europe", ["World", "Europe", "Business", "Technology", "Science"], "legacy"),
  common("france-24", "France 24", "Center", "France", "Europe", ["World", "Europe", "Politics", "Business"], "legacy"),
  common("euronews", "Euronews", "Center", "France", "Europe", ["World", "Europe", "Politics", "Business"], "legacy"),
  common("sky-news", "Sky News", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business"], "legacy"),
  common("voice-of-america", "Voice of America", "Center", "United States", "North America", ["World", "US", "Politics", "Asia", "Africa", "Middle East"], "unverified"),
  common("nhk-world", "NHK World", "Center", "Japan", "East Asia", ["World", "Asia", "Japan", "Business", "Technology"], "unverified"),
  common("abc-news", "ABC News", "Center", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Health", "Entertainment"], "unverified"),
  common("cbs-news", "CBS News", "Center", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Health"], "unverified"),
  common("nbc-news", "NBC News", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Health"], "unverified"),
  common("cnn", "CNN", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Health", "Entertainment"], "legacy"),
  common("fox-news", "Fox News", "Right", "United States", "North America", ["US", "Politics", "Business", "World"], "unverified"),
  common("pbs-newshour", "PBS NewsHour", "Center", "United States", "North America", ["US", "Politics", "World", "Science", "Health"], "legacy"),
  common("npr", "NPR", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Science", "Health"], "legacy"),
  common("usa-today", "USA Today", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Health", "Sports"], "unverified"),
  common("newsnation", "NewsNation", "Center", "United States", "North America", ["US", "Politics", "World", "Crime", "Defense"], "unverified"),
  common("the-hill", "The Hill", "Center", "United States", "North America", ["US", "Politics", "Business"], "unverified"),
  common("politico", "POLITICO", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business"], "unverified"),
  common("axios", "Axios", "Lean Left", "United States", "North America", ["US", "Politics", "Business", "Technology"], "unverified"),
  common("new-york-times", "The New York Times", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Science", "Health", "Culture"], "legacy"),
  common("washington-post", "The Washington Post", "Lean Left", "United States", "North America", ["US", "Politics", "World", "Business", "Technology", "Science", "Health"], "unverified"),
  common("wall-street-journal", "The Wall Street Journal", "Center", "United States", "North America", ["US", "Business", "Finance", "Markets", "Technology", "Politics"], "unverified"),
  common("bloomberg", "Bloomberg News", "Center", "United States", "North America", ["Business", "Finance", "Markets", "Technology", "World"], "unverified"),
  common("new-yorker", "The New Yorker", "Left", "United States", "North America", ["Politics", "World", "Culture", "Opinion", "Analysis"], "unverified"),
  common("atlantic", "The Atlantic", "Lean Left", "United States", "North America", ["Politics", "World", "Culture", "Opinion", "Analysis"], "unverified"),
  common("newsweek", "Newsweek", "Center", "United States", "North America", ["US", "World", "Politics", "Business", "Technology"], "unverified"),
  common("business-insider", "Business Insider", "Lean Left", "United States", "North America", ["Business", "Finance", "Markets", "Technology"], "unverified"),
  common("forbes", "Forbes", "Center", "United States", "North America", ["Business", "Finance", "Markets", "Technology"], "unverified"),
  common("propublica", "ProPublica", "Lean Left", "United States", "North America", ["US", "Politics", "Crime", "Security", "Environment"], "unverified"),
  common("daily-wire", "The Daily Wire", "Right", "United States", "North America", ["US", "Politics", "Culture", "Opinion"], "unverified"),
  common("new-york-post", "New York Post", "Right", "United States", "North America", ["US", "Politics", "World", "Entertainment", "Sports"], "unverified"),
  common("national-review", "National Review", "Right", "United States", "North America", ["US", "Politics", "Opinion", "Analysis"], "unverified"),
  common("washington-examiner", "Washington Examiner", "Lean Right", "United States", "North America", ["US", "Politics", "Business"], "unverified"),
  common("american-conservative", "The American Conservative", "Right", "United States", "North America", ["US", "Politics", "Opinion", "Analysis"], "unverified"),
  common("newsmax", "Newsmax", "Right", "United States", "North America", ["US", "Politics", "World", "Business"], "unverified"),
  common("epoch-times", "The Epoch Times", "Right", "United States", "North America", ["US", "Politics", "World", "Business"], "unverified"),
  common("reason", "Reason", "Lean Right", "United States", "North America", ["US", "Politics", "Business", "Opinion", "Analysis"], "unverified"),
  common("guardian", "The Guardian", "Lean Left", "United Kingdom", "Europe", ["World", "Politics", "Business", "Technology", "Culture", "Environment"], "legacy"),
  common("independent", "The Independent", "Lean Left", "United Kingdom", "Europe", ["World", "Politics", "Business", "Culture", "Climate"], "unverified"),
  common("telegraph", "The Telegraph", "Right", "United Kingdom", "Europe", ["World", "Politics", "Business", "Finance", "Culture"], "unverified"),
  common("daily-mail", "Daily Mail", "Right", "United Kingdom", "Europe", ["World", "Politics", "Health", "Entertainment", "Lifestyle"], "unverified"),
  common("daily-express", "Daily Express", "Right", "United Kingdom", "Europe", ["World", "Politics", "Health", "Entertainment"], "unverified"),
  common("the-times", "The Times", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business", "Finance", "Culture"], "unverified"),
  common("financial-times", "Financial Times", "Center", "United Kingdom", "Europe", ["Business", "Finance", "Markets", "World"], "unverified"),
  common("spectator", "The Spectator", "Right", "United Kingdom", "Europe", ["Politics", "Opinion", "Analysis", "Culture"], "unverified"),
  common("sky-news-uk", "Sky News UK", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business"], "legacy"),
  common("bbc-news-uk", "BBC News UK", "Center", "United Kingdom", "Europe", ["World", "Politics", "Business", "Technology"], "legacy"),
  common("the-hindu", "The Hindu", "Center", "India", "South Asia", ["India", "World", "Politics", "Business", "Science", "Culture"], "unverified"),
  common("indian-express", "The Indian Express", "Center", "India", "South Asia", ["India", "Politics", "World", "Business", "Technology"], "unverified"),
  common("times-of-india", "Times of India", "Center", "India", "South Asia", ["India", "World", "Politics", "Business", "Sports", "Entertainment"], "unverified"),
  common("hindustan-times", "Hindustan Times", "Center", "India", "South Asia", ["India", "World", "Politics", "Business", "Technology"], "unverified"),
  common("ndtv", "NDTV", "Lean Left", "India", "South Asia", ["India", "World", "Politics", "Business", "Technology"], "unverified"),
  common("india-today", "India Today", "Center", "India", "South Asia", ["India", "World", "Politics", "Business", "Technology"], "unverified"),
  common("the-print", "The Print", "Center", "India", "South Asia", ["India", "Politics", "World", "Business", "Defense", "Security"], "unverified"),
  common("deccan-herald", "Deccan Herald", "Center", "India", "South Asia", ["India", "Politics", "Business", "World"], "unverified"),
  common("tribune-india", "The Tribune India", "Center", "India", "South Asia", ["India", "Politics", "World", "Business"], "unverified"),
  common("economic-times", "The Economic Times", "Center", "India", "South Asia", ["India", "Business", "Finance", "Markets", "Technology"], "unverified"),
  common("cbc-news", "CBC News", "Center", "Canada", "North America", ["Canada", "World", "Politics", "Business", "Technology", "Health"], "legacy"),
  common("ctv-news", "CTV News", "Center", "Canada", "North America", ["Canada", "World", "Politics", "Business"], "unverified"),
  common("global-news", "Global News", "Center", "Canada", "North America", ["Canada", "World", "Politics", "Business"], "unverified"),
  common("national-post", "National Post", "Lean Right", "Canada", "North America", ["Canada", "Politics", "Business", "World"], "unverified"),
  common("toronto-star", "Toronto Star", "Lean Left", "Canada", "North America", ["Canada", "Politics", "World", "Business", "Culture"], "unverified"),
  common("abc-australia", "ABC Australia", "Center", "Australia", "Oceania", ["Australia", "World", "Politics", "Business", "Science"], "unverified"),
  common("sbs-news", "SBS News", "Center", "Australia", "Oceania", ["Australia", "World", "Politics", "Culture"], "unverified"),
  common("sydney-morning-herald", "The Sydney Morning Herald", "Center", "Australia", "Oceania", ["Australia", "World", "Politics", "Business"], "unverified"),
  common("the-australian", "The Australian", "Lean Right", "Australia", "Oceania", ["Australia", "World", "Politics", "Business"], "unverified"),
  common("new-zealand-herald", "The New Zealand Herald", "Center", "New Zealand", "Oceania", ["New Zealand", "World", "Politics", "Business"], "unverified"),
  common("politico-europe", "Politico Europe", "Lean Left", "Belgium", "Europe", ["Europe", "Politics", "Business", "World"], "unverified"),
  common("the-local-europe", "The Local Europe", "Center", "Sweden", "Europe", ["Europe", "Travel", "Culture", "Politics"], "unverified"),
  common("rfi", "RFI", "Center", "France", "Europe", ["World", "Europe", "Africa", "Middle East"], "unverified"),
  common("der-spiegel", "Der Spiegel", "Lean Left", "Germany", "Europe", ["Europe", "World", "Politics", "Business"], "unverified"),
  common("bild", "Bild", "Right", "Germany", "Europe", ["Germany", "Europe", "World", "Politics", "Sports"], "unverified"),
  common("le-monde", "Le Monde", "Center", "France", "Europe", ["France", "Europe", "World", "Politics", "Business"], "unverified"),
  common("le-figaro", "Le Figaro", "Lean Right", "France", "Europe", ["France", "Europe", "World", "Politics", "Business"], "unverified"),
  common("el-pais", "El Pa\u00eds", "Lean Left", "Spain", "Europe", ["Spain", "Europe", "World", "Politics", "Business"], "unverified"),
  common("corriere-della-sera", "Corriere della Sera", "Center", "Italy", "Europe", ["Italy", "Europe", "World", "Politics", "Business"], "unverified"),
  common("scmp", "South China Morning Post", "Center", "Hong Kong", "East Asia", ["China", "Asia", "World", "Business", "Technology"], "unverified"),
  common("channel-newsasia", "Channel NewsAsia", "Center", "Singapore", "Southeast Asia", ["Singapore", "Asia", "World", "Business", "Politics"], "unverified"),
  common("straits-times", "The Straits Times", "Center", "Singapore", "Southeast Asia", ["Singapore", "Asia", "World", "Business"], "unverified"),
  common("nikkei-asia", "Nikkei Asia", "Center", "Japan", "East Asia", ["Japan", "Asia", "Business", "Finance", "Technology"], "unverified"),
  common("japan-times", "The Japan Times", "Center", "Japan", "East Asia", ["Japan", "Asia", "World", "Politics", "Business"], "unverified"),
  common("korea-herald", "Korea Herald", "Center", "South Korea", "East Asia", ["South Korea", "Asia", "World", "Business"], "unverified"),
  common("korea-times", "Korea Times", "Center", "South Korea", "East Asia", ["South Korea", "Asia", "World", "Business"], "unverified"),
  common("dawn", "Dawn", "Center", "Pakistan", "South Asia", ["Pakistan", "Asia", "World", "Politics", "Business"], "unverified"),
  common("express-tribune-pakistan", "The Express Tribune Pakistan", "Center", "Pakistan", "South Asia", ["Pakistan", "Asia", "World", "Politics", "Business"], "unverified"),
  common("hindu-businessline", "The Hindu BusinessLine", "Center", "India", "South Asia", ["India", "Business", "Finance", "Markets"], "unverified"),
  common("arab-news", "Arab News", "Center", "Saudi Arabia", "Middle East", ["Middle East", "World", "Business", "Politics"], "unverified"),
  common("middle-east-eye", "Middle East Eye", "Lean Left", "United Kingdom", "Middle East", ["Middle East", "World", "Politics"], "unverified"),
  common("national-uae", "The National UAE", "Center", "United Arab Emirates", "Middle East", ["Middle East", "World", "Business", "Politics"], "unverified"),
  common("al-arabiya-english", "Al Arabiya English", "Center", "Saudi Arabia", "Middle East", ["Middle East", "World", "Business", "Politics"], "unverified"),
  common("africanews", "Africanews", "Center", "France", "Africa", ["Africa", "World", "Politics", "Business"], "unverified"),
  common("daily-maverick", "Daily Maverick", "Lean Left", "South Africa", "Africa", ["South Africa", "Africa", "World", "Politics", "Business"], "unverified"),
  common("mail-guardian", "Mail & Guardian", "Lean Left", "South Africa", "Africa", ["South Africa", "Africa", "Politics", "Culture"], "unverified"),
  common("africa-report", "The Africa Report", "Center", "France", "Africa", ["Africa", "Politics", "Business", "World"], "unverified"),
  common("buenos-aires-times", "Buenos Aires Times", "Center", "Argentina", "South America", ["Argentina", "South America", "World", "Business"], "unverified"),
  common("agencia-brasil", "Ag\u00eancia Brasil", "Center", "Brazil", "South America", ["Brazil", "South America", "World", "Politics", "Business"], "unverified"),
];

const feedConfig = {
  "bbc-news": [["World", "https://feeds.bbci.co.uk/news/world/rss.xml"], ["Business", "https://feeds.bbci.co.uk/news/business/rss.xml"], ["Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"], ["Politics", "https://feeds.bbci.co.uk/news/politics/rss.xml"], ["Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"], ["Health", "https://feeds.bbci.co.uk/news/health/rss.xml"]],
  "npr": [["World", "https://feeds.npr.org/1004/rss.xml"], ["Business", "https://feeds.npr.org/1006/rss.xml"], ["Technology", "https://feeds.npr.org/1019/rss.xml"], ["Politics", "https://feeds.npr.org/1014/rss.xml"], ["Science", "https://feeds.npr.org/1007/rss.xml"], ["Health", "https://feeds.npr.org/1008/rss.xml"]],
  "al-jazeera": [["World", "https://www.aljazeera.com/xml/rss/all.xml"]],
  "deutsche-welle": [["World", "https://rss.dw.com/rdf/rss-en-all"]],
  "france-24": [["World", "https://www.france24.com/en/rss"]],
  "euronews": [["World", "https://www.euronews.com/rss?format=mrss&level=theme&name=news"]],
  "sky-news": [["World", "https://feeds.skynews.com/feeds/rss/home.xml"]],
  "cbc-news": [["World", "https://www.cbc.ca/webfeed/rss/rss-topstories"]],
  "pbs-newshour": [["World", "https://www.pbs.org/newshour/feeds/rss/headlines"]],
  "cnn": [["World", "https://rss.cnn.com/rss/edition.rss"]],
  "new-york-times": [["World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"], ["Politics", "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"], ["Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"], ["Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"]],
  "guardian": [["World", "https://www.theguardian.com/world/rss"], ["Politics", "https://www.theguardian.com/politics/rss"], ["Business", "https://www.theguardian.com/business/rss"], ["Technology", "https://www.theguardian.com/technology/rss"]],
};

for (const source of definitions) {
  const configured = feedConfig[source.sourceId] || [];
  source.feedUrls = configured.map(([category, url]) => ({ category, url }));
  if (configured.length && source.verificationStatus === 'legacy') {
    // These feeds already existed in the working application and are retained
    // for backward compatibility. They are still health-checked at runtime.
    source.enabled = true;
    source.ratingNotes = 'Legacy working feed retained; political label remains a product target until independently rated.';
  }
}

export const SOURCE_REGISTRY = definitions;
export const FEEDS = definitions.flatMap(source =>
  source.enabled ? source.feedUrls.map(feed => ({ ...feed, source })) : []
);
export const SOURCE_BY_ID = new Map(definitions.map(source => [source.sourceId, source]));
