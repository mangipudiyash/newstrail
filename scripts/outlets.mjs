// The outlets NewsTrail follows. Every feed here is an official, public RSS feed published for syndication.
// scope: "IN" = Indian outlet, "INTL" = international. lat/lon = newsroom HQ (where the dot sits on the map).
// feeds: { home: [...], world: [...] } — the outlet's national section and its world section, so we can compare
// what each newsroom puts first at home with what it reports about other countries. page = its national front, for proof screenshots.
const O = (id, name, country, city, lat, lon, color, feeds, page) => ({ id, name, country, city, lat, lon, color, scope: country === "India" ? "IN" : "INTL", feeds, page });

export const OUTLETS = [
  O("ndtv", "NDTV", "India", "New Delhi", 28.55, 77.27, "#E4002B", { home: ["https://feeds.feedburner.com/ndtvnews-india-news"], world: ["https://feeds.feedburner.com/ndtvnews-world-news"] }, "https://www.ndtv.com/india"),
  O("toi", "Times of India", "India", "Mumbai", 18.93, 72.83, "#D7261E", { home: ["https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"], world: ["https://timesofindia.indiatimes.com/rssfeeds/296589292.cms"] }, "https://timesofindia.indiatimes.com/india"),
  O("ht", "Hindustan Times", "India", "New Delhi", 28.63, 77.22, "#00A3E0", { home: ["https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"], world: ["https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml"] }, "https://www.hindustantimes.com/india-news"),
  O("hindu", "The Hindu", "India", "Chennai", 13.06, 80.27, "#1A4C8B", { home: ["https://www.thehindu.com/news/national/feeder/default.rss"], world: ["https://www.thehindu.com/news/international/feeder/default.rss"] }, "https://www.thehindu.com/news/national/"),
  O("indiatoday", "India Today", "India", "Noida", 28.57, 77.32, "#C8102E", { home: ["https://www.indiatoday.in/rss/1206578"], world: ["https://www.indiatoday.in/rss/1206577"] }, "https://www.indiatoday.in/india"),
  O("scroll", "Scroll.in", "India", "New Delhi", 28.59, 77.20, "#E5322D", { home: ["https://feeds.feedburner.com/ScrollinArticles.rss"], world: [] }, "https://scroll.in/latest/"),
  O("news18", "News18", "India", "Noida", 28.58, 77.33, "#E31E24", { home: ["https://www.news18.com/commonfeeds/v1/eng/rss/india.xml"], world: ["https://www.news18.com/commonfeeds/v1/eng/rss/world.xml"] }, "https://www.news18.com/india/"),
  O("et", "Economic Times", "India", "Mumbai", 18.96, 72.82, "#F2A900", { home: ["https://economictimes.indiatimes.com/news/india/rssfeeds/81582957.cms"], world: ["https://economictimes.indiatimes.com/news/international/world-news/rssfeeds/858478126.cms"] }, "https://economictimes.indiatimes.com/news/india"),
  O("zee", "Zee News", "India", "Noida", 28.54, 77.39, "#7B2CBF", { home: ["https://zeenews.india.com/rss/india-national-news.xml"], world: [] }, "https://zeenews.india.com/india"),
  O("mint", "Mint", "India", "New Delhi", 28.62, 77.21, "#F47920", { home: ["https://www.livemint.com/rss/news"], world: [] }, "https://www.livemint.com/news/india"),
  O("bbc", "BBC", "United Kingdom", "London", 51.52, -0.14, "#BB1919", { home: ["https://feeds.bbci.co.uk/news/uk/rss.xml"], world: ["https://feeds.bbci.co.uk/news/world/rss.xml"] }, "https://www.bbc.com/news/uk"),
  O("guardian", "The Guardian", "United Kingdom", "London", 51.53, -0.12, "#052962", { home: ["https://www.theguardian.com/uk-news/rss"], world: ["https://www.theguardian.com/world/rss"] }, "https://www.theguardian.com/uk-news"),
  O("sky", "Sky News", "United Kingdom", "London", 51.49, -0.31, "#C90020", { home: ["https://feeds.skynews.com/feeds/rss/uk.xml"], world: ["https://feeds.skynews.com/feeds/rss/world.xml"] }, "https://news.sky.com/uk"),
  O("aljazeera", "Al Jazeera", "Qatar", "Doha", 25.29, 51.53, "#FA9000", { home: [], world: ["https://www.aljazeera.com/xml/rss/all.xml"] }, "https://www.aljazeera.com/middle-east/"),
  O("nyt", "New York Times", "United States", "New York", 40.76, -73.99, "#111111", { home: ["https://rss.nytimes.com/services/xml/rss/nyt/US.xml"], world: ["https://rss.nytimes.com/services/xml/rss/nyt/World.xml"] }, "https://www.nytimes.com/section/us"),
  O("npr", "NPR", "United States", "Washington", 38.90, -77.01, "#3266CC", { home: ["https://feeds.npr.org/1003/rss.xml"], world: ["https://feeds.npr.org/1004/rss.xml"] }, "https://www.npr.org/sections/national/"),
  O("fox", "Fox News", "United States", "New York", 40.76, -73.98, "#003366", { home: ["https://moxie.foxnews.com/google-publisher/us.xml"], world: ["https://moxie.foxnews.com/google-publisher/world.xml"] }, "https://www.foxnews.com/us"),
  O("dw", "DW", "Germany", "Bonn", 50.72, 7.12, "#05B2FC", { home: ["https://rss.dw.com/rdf/rss-en-ger"], world: ["https://rss.dw.com/rdf/rss-en-world"] }, "https://www.dw.com/en/germany/s-1432"),
  O("france24", "France 24", "France", "Paris", 48.83, 2.26, "#00A1DE", { home: ["https://www.france24.com/en/france/rss"], world: ["https://www.france24.com/en/rss"] }, "https://www.france24.com/en/france/"),
  O("abc", "ABC Australia", "Australia", "Sydney", -33.88, 151.20, "#0B2C4A", { home: ["https://www.abc.net.au/news/feed/51120/rss.xml"], world: ["https://www.abc.net.au/news/feed/2942460/rss.xml"] }, "https://www.abc.net.au/news/australia"),
  O("scmp", "South China Morning Post", "Hong Kong", "Hong Kong", 22.28, 114.16, "#FFCA05", { home: ["https://www.scmp.com/rss/2/feed"], world: ["https://www.scmp.com/rss/91/feed"] }, "https://www.scmp.com/news/hong-kong"),
];
export const byId = Object.fromEntries(OUTLETS.map(o => [o.id, o]));
