// Which countries is a headline about? A transparent keyword list: country names, demonyms, capitals, regions and
// well-known places. Ambiguous words (e.g. "Georgia", "Congress", "Jordan" the name) are left out on purpose.
// Used to compare what each newsroom covers at home with what it covers abroad.
const C = {
  India: `India|Indian|Indians|New Delhi|Delhi|Mumbai|Bengaluru|Bangalore|Chennai|Kolkata|Hyderabad|Pune|Ahmedabad|Jaipur|Lucknow|Patna|Bhopal|Chandigarh|Srinagar|Guwahati|Bhubaneswar|Kochi|Noida|Gurugram|Varanasi|Ayodhya|Nagpur|Indore|Surat|Ranchi|Raipur|Dehradun|Shimla|Coimbatore|Madurai|Mysuru|Visakhapatnam|Vijayawada|Amaravati|Telangana|Andhra Pradesh|Maharashtra|Karnataka|Tamil Nadu|Kerala|Gujarat|Rajasthan|Uttar Pradesh|Bihar|West Bengal|Odisha|Madhya Pradesh|Haryana|Assam|Manipur|Jharkhand|Chhattisgarh|Uttarakhand|Himachal|Goa|Jammu|Kashmir|Ladakh|Sikkim|Tripura|Meghalaya|Nagaland|Mizoram|Arunachal|Lok Sabha|Rajya Sabha|Supreme Court of India|Modi|BJP|Sensex|Nifty|ISRO|RBI|rupee`,
  "United States": `United States|U\\.S\\.|US|USA|America|American|Americans|Washington|White House|Pentagon|New York|California|Texas|Florida|Chicago|Los Angeles|San Francisco|Seattle|Boston|Atlanta|Michigan|Ohio|Pennsylvania|Arizona|Nevada|Virginia|Mississippi|Louisiana|Alabama|Tennessee|Kentucky|Colorado|Oregon|Minnesota|Wisconsin|Missouri|Iowa|Utah|New Jersey|Maryland|Massachusetts|North Carolina|South Carolina|Oklahoma|Kansas|Nebraska|Idaho|Montana|Alaska|Hawaii|Trump|Biden|midterms?|Senate|Capitol Hill|FBI|Supreme Court justices?|Wall Street`,
  "United Kingdom": `United Kingdom|UK|U\\.K\\.|Britain|British|England|English|Scotland|Scottish|Wales|Welsh|Northern Ireland|London|Manchester|Birmingham|Liverpool|Leeds|Glasgow|Edinburgh|Cardiff|Belfast|Westminster|Downing Street|Starmer|NHS|Tories|Labour|Reform UK|Met Police`,
  China: `China|Chinese|Beijing|Shanghai|Xi Jinping|Shenzhen|Guangzhou|Tibet|Xinjiang`,
  "Hong Kong": `Hong Kong|HK`,
  Pakistan: `Pakistan|Pakistani|Islamabad|Karachi|Lahore|Khyber Pakhtunkhwa|Balochistan`,
  Bangladesh: `Bangladesh|Bangladeshi|Dhaka`, Nepal: `Nepal|Nepali|Kathmandu`, "Sri Lanka": `Sri Lanka|Sri Lankan|Colombo`,
  Afghanistan: `Afghanistan|Afghan|Kabul|Taliban`, Iran: `Iran|Iranian|Tehran`, Iraq: `Iraq|Iraqi|Baghdad`,
  Israel: `Israel|Israeli|Israelis|Jerusalem|Tel Aviv|Netanyahu|IDF`, Palestine: `Gaza|Palestine|Palestinian|Palestinians|West Bank|Hamas`,
  Lebanon: `Lebanon|Lebanese|Beirut|Hezbollah`, Syria: `Syria|Syrian|Damascus`, "Saudi Arabia": `Saudi|Riyadh|Aramco`,
  UAE: `UAE|Emirates|Dubai|Abu Dhabi`, Qatar: `Qatar|Qatari|Doha`, Yemen: `Yemen|Yemeni|Houthi|Houthis`, Jordan: `Jordanian|Amman|Jordan's`,
  Ukraine: `Ukraine|Ukrainian|Ukrainians|Kyiv|Zelensky|Zelenskyy`, Russia: `Russia|Russian|Russians|Moscow|Kremlin|Putin`,
  Japan: `Japan|Japanese|Tokyo`, "South Korea": `South Korea|South Korean|Seoul`, "North Korea": `North Korea|North Korean|Pyongyang|Kim Jong`,
  Taiwan: `Taiwan|Taiwanese|Taipei`, Myanmar: `Myanmar|Burmese`, Thailand: `Thailand|Thai|Bangkok`, Indonesia: `Indonesia|Indonesian|Jakarta`,
  Australia: `Australia|Australian|Australians|Sydney|Melbourne|Brisbane|Perth|Adelaide|Canberra|Queensland|Victoria's|New South Wales|Tasmania|Albanese`,
  Canada: `Canada|Canadian|Toronto|Ottawa|Vancouver|Montreal|Carney`, Mexico: `Mexico|Mexican`, Brazil: `Brazil|Brazilian|Lula|Rio de Janeiro|São Paulo`,
  France: `France|French|Paris|Macron|Marseille|Lyon`, Germany: `Germany|German|Germans|Berlin|Munich|Hamburg|Frankfurt|Bundestag|Merz|Bonn|Cologne`,
  Italy: `Italy|Italian|Rome|Milan|Meloni`, Spain: `Spain|Spanish|Madrid|Barcelona`, Turkey: `Turkey|Türkiye|Turkiye|Turkish|Ankara|Istanbul|Erdogan`,
  Egypt: `Egypt|Egyptian|Cairo`, "South Africa": `South Africa|South African|Johannesburg|Cape Town`, Nigeria: `Nigeria|Nigerian|Lagos|Abuja`,
  Kenya: `Kenya|Kenyan|Nairobi`, Sudan: `Sudan|Sudanese|Khartoum|Darfur`, Maldives: `Maldives|Maldivian`, Singapore: `Singapore|Singaporean`,
  Venezuela: `Venezuela|Venezuelan|Caracas|Maduro|Machado`, Serbia: `Serbia|Serbian|Belgrade|Vučić|Vucic`, Poland: `Poland|Polish|Warsaw`,
  Romania: `Romania|Romanian|Bucharest`, Uganda: `Uganda|Ugandan|Kampala`,
  Congo: `Congo|Congolese|Brazzaville|Kinshasa|DRC`,
  Ireland: `Ireland|Irish|Dublin|Taoiseach|Cork|Galway`, "New Zealand": `New Zealand|Kiwi|Wellington|Auckland|Christchurch|Luxon`,
  Argentina: `Argentina|Argentine|Argentinian|Buenos Aires|Milei`, Uruguay: `Uruguay|Uruguayan|Montevideo`,
};
// case-sensitive for short all-caps codes (US, UK, HK, IDF…), case-insensitive otherwise
const RX = Object.entries(C).map(([country, list]) => {
  const terms = list.split("|"), caps = terms.filter(t => /^[A-Z.\\]+$/.test(t)), rest = terms.filter(t => !caps.includes(t));
  return { country, caps: caps.length ? new RegExp(`(?<![\\p{L}])(${caps.join("|")})(?![\\p{L}])`, "u") : null,
           rest: new RegExp(`(?<![\\p{L}])(${rest.join("|")})(?![\\p{L}])`, "iu") };
});
export const COUNTRIES = Object.keys(C);
/** Countries a headline is about, in no particular order. */
export function countriesIn(text) {
  return RX.filter(({ caps, rest }) => rest.test(text) || (caps && caps.test(text))).map(r => r.country);
}

// regions for the weekly "hot zones"
export const REGION = {
  "South Asia": ["India", "Pakistan", "Bangladesh", "Nepal", "Sri Lanka", "Afghanistan", "Maldives"],
  "Middle East": ["Iran", "Iraq", "Israel", "Palestine", "Lebanon", "Syria", "Saudi Arabia", "UAE", "Qatar", "Yemen", "Jordan", "Turkey", "Egypt"],
  Europe: ["United Kingdom", "Ireland", "France", "Germany", "Italy", "Spain", "Ukraine", "Russia", "Serbia", "Poland", "Romania"],
  Americas: ["United States", "Canada", "Mexico", "Brazil", "Venezuela", "Argentina", "Uruguay"],
  "East Asia": ["China", "Hong Kong", "Japan", "South Korea", "North Korea", "Taiwan", "Myanmar", "Thailand", "Indonesia", "Singapore"],
  Africa: ["South Africa", "Nigeria", "Kenya", "Sudan", "Uganda", "Congo"],
  Oceania: ["Australia", "New Zealand"],
};
export const regionOf = Object.fromEntries(Object.entries(REGION).flatMap(([r, cs]) => cs.map(c => [c, r])));
