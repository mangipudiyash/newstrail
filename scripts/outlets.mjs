// The outlets NewsTrail follows. Every feed here is an official, public RSS feed published for syndication.
// scope: "IN" = Indian outlet, "INTL" = international. lat/lon = newsroom HQ (where the dot sits on the map).
const O = (id, name, country, city, lat, lon, color, feeds) => ({ id, name, country, city, lat, lon, color, scope: country === "India" ? "IN" : "INTL", feeds });

export const OUTLETS = [
  O("ndtv", "NDTV", "India", "New Delhi", 28.55, 77.27, "#E4002B", ["https://feeds.feedburner.com/ndtvnews-top-stories"]),
  O("toi", "Times of India", "India", "Mumbai", 18.93, 72.83, "#D7261E", ["https://timesofindia.indiatimes.com/rssfeedstopstories.cms"]),
  O("ht", "Hindustan Times", "India", "New Delhi", 28.63, 77.22, "#00A3E0", ["https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", "https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml"]),
  O("hindu", "The Hindu", "India", "Chennai", 13.06, 80.27, "#1A4C8B", ["https://www.thehindu.com/news/national/feeder/default.rss", "https://www.thehindu.com/news/international/feeder/default.rss"]),
  O("indiatoday", "India Today", "India", "Noida", 28.57, 77.32, "#C8102E", ["https://www.indiatoday.in/rss/1206578"]),
  O("ie", "Indian Express", "India", "New Delhi", 28.60, 77.23, "#2E5AAC", ["https://indianexpress.com/section/india/feed/", "https://indianexpress.com/section/world/feed/"]),
  O("news18", "News18", "India", "Noida", 28.58, 77.33, "#E31E24", ["https://www.news18.com/commonfeeds/v1/eng/rss/india.xml", "https://www.news18.com/commonfeeds/v1/eng/rss/world.xml"]),
  O("et", "Economic Times", "India", "Mumbai", 18.96, 72.82, "#F2A900", ["https://economictimes.indiatimes.com/rssfeedstopstories.cms"]),
  O("zee", "Zee News", "India", "Noida", 28.54, 77.39, "#7B2CBF", ["https://zeenews.india.com/rss/india-national-news.xml"]),
  O("mint", "Mint", "India", "New Delhi", 28.62, 77.21, "#F47920", ["https://www.livemint.com/rss/news"]),
  O("bbc", "BBC", "United Kingdom", "London", 51.52, -0.14, "#BB1919", ["https://feeds.bbci.co.uk/news/world/rss.xml"]),
  O("guardian", "The Guardian", "United Kingdom", "London", 51.53, -0.12, "#052962", ["https://www.theguardian.com/world/rss"]),
  O("sky", "Sky News", "United Kingdom", "London", 51.49, -0.31, "#C90020", ["https://feeds.skynews.com/feeds/rss/world.xml"]),
  O("aljazeera", "Al Jazeera", "Qatar", "Doha", 25.29, 51.53, "#FA9000", ["https://www.aljazeera.com/xml/rss/all.xml"]),
  O("nyt", "New York Times", "United States", "New York", 40.76, -73.99, "#111111", ["https://rss.nytimes.com/services/xml/rss/nyt/World.xml"]),
  O("cnn", "CNN", "United States", "Atlanta", 33.76, -84.39, "#CC0000", ["http://rss.cnn.com/rss/edition_world.rss"]),
  O("npr", "NPR", "United States", "Washington", 38.90, -77.01, "#3266CC", ["https://feeds.npr.org/1004/rss.xml"]),
  O("fox", "Fox News", "United States", "New York", 40.76, -73.98, "#003366", ["https://moxie.foxnews.com/google-publisher/world.xml"]),
  O("dw", "DW", "Germany", "Bonn", 50.72, 7.12, "#05B2FC", ["https://rss.dw.com/rdf/rss-en-world"]),
  O("france24", "France 24", "France", "Paris", 48.83, 2.26, "#00A1DE", ["https://www.france24.com/en/rss"]),
  O("abc", "ABC Australia", "Australia", "Sydney", -33.88, 151.20, "#0B2C4A", ["https://www.abc.net.au/news/feed/2942460/rss.xml"]),
  O("scmp", "South China Morning Post", "Hong Kong", "Hong Kong", 22.28, 114.16, "#FFCA05", ["https://www.scmp.com/rss/91/feed"]),
];
export const byId = Object.fromEntries(OUTLETS.map(o => [o.id, o]));
