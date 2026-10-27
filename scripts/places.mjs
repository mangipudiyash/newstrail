// Place names → coordinates, used to find where a story happened (its epicentre).
// Ordered most-specific first within each group; `rank` 3 = locality, 2 = city, 1 = state/country.
const P = (name, lat, lon, rank, alias = []) => ({ name, lat, lon, rank, alias });

export const PLACES = [
  // Hyderabad localities
  P("Kukatpally", 17.4948, 78.3996, 3), P("Madhapur", 17.4483, 78.3915, 3), P("Gachibowli", 17.4401, 78.3489, 3),
  P("Kondapur", 17.4600, 78.3570, 3), P("Ameerpet", 17.4375, 78.4483, 3), P("Banjara Hills", 17.4126, 78.4392, 3),
  P("Jubilee Hills", 17.4326, 78.4071, 3), P("Charminar", 17.3616, 78.4747, 3), P("Dilsukhnagar", 17.3688, 78.5247, 3),
  P("LB Nagar", 17.3457, 78.5522, 3, ["L.B. Nagar"]), P("Miyapur", 17.4968, 78.3614, 3), P("Uppal", 17.4058, 78.5591, 3),
  P("Begumpet", 17.4447, 78.4664, 3), P("Shamshabad", 17.2403, 78.4294, 3), P("Hitech City", 17.4435, 78.3772, 3, ["HITEC City"]),
  P("Mehdipatnam", 17.3959, 78.4331, 3), P("Kompally", 17.5390, 78.4860, 3), P("Medchal", 17.6298, 78.4815, 3),
  P("Secunderabad", 17.4399, 78.4983, 3), P("Cyberabad", 17.4500, 78.3800, 3), P("Rachakonda", 17.3700, 78.5600, 3),
  // Telangana & Andhra Pradesh
  P("Hyderabad", 17.3850, 78.4867, 2), P("Warangal", 17.9689, 79.5941, 2), P("Karimnagar", 18.4386, 79.1288, 2),
  P("Khammam", 17.2473, 80.1514, 2), P("Nizamabad", 18.6725, 78.0941, 2), P("Nalgonda", 17.0575, 79.2671, 2),
  P("Mahbubnagar", 16.7375, 77.9858, 2), P("Adilabad", 19.6641, 78.5320, 2), P("Siddipet", 18.1018, 78.8520, 2),
  P("Vijayawada", 16.5062, 80.6480, 2), P("Visakhapatnam", 17.6868, 83.2185, 2, ["Vizag"]), P("Amaravati", 16.5150, 80.5150, 2),
  P("Guntur", 16.3067, 80.4365, 2), P("Tirupati", 13.6288, 79.4192, 2, ["Tirumala"]), P("Nellore", 14.4426, 79.9865, 2),
  P("Kurnool", 15.8281, 78.0373, 2), P("Kakinada", 16.9891, 82.2475, 2), P("Rajahmundry", 17.0005, 81.8040, 2),
  P("Anantapur", 14.6819, 77.6006, 2), P("Kadapa", 14.4673, 78.8242, 2), P("Srikakulam", 18.2949, 83.8938, 2),
  P("Ongole", 15.5057, 80.0499, 2), P("Eluru", 16.7107, 81.0952, 2), P("Chittoor", 13.2172, 79.1003, 2),
  P("Telangana", 17.8500, 79.1000, 1), P("Andhra Pradesh", 15.9129, 79.7400, 1),
  // India — cities
  P("New Delhi", 28.6139, 77.2090, 2, ["Delhi"]), P("Mumbai", 19.0760, 72.8777, 2), P("Bengaluru", 12.9716, 77.5946, 2, ["Bangalore"]),
  P("Chennai", 13.0827, 80.2707, 2), P("Kolkata", 22.5726, 88.3639, 2), P("Pune", 18.5204, 73.8567, 2),
  P("Ahmedabad", 23.0225, 72.5714, 2), P("Jaipur", 26.9124, 75.7873, 2), P("Lucknow", 26.8467, 80.9462, 2),
  P("Patna", 25.5941, 85.1376, 2), P("Bhopal", 23.2599, 77.4126, 2), P("Chandigarh", 30.7333, 76.7794, 2),
  P("Srinagar", 34.0837, 74.7973, 2), P("Guwahati", 26.1445, 91.7362, 2), P("Bhubaneswar", 20.2961, 85.8245, 2),
  P("Thiruvananthapuram", 8.5241, 76.9366, 2), P("Kochi", 9.9312, 76.2673, 2), P("Noida", 28.5355, 77.3910, 2),
  P("Gurugram", 28.4595, 77.0266, 2, ["Gurgaon"]), P("Varanasi", 25.3176, 82.9739, 2), P("Ayodhya", 26.7922, 82.1998, 2),
  P("Nagpur", 21.1458, 79.0882, 2), P("Indore", 22.7196, 75.8577, 2), P("Surat", 21.1702, 72.8311, 2),
  P("Imphal", 24.8170, 93.9368, 2), P("Ranchi", 23.3441, 85.3096, 2), P("Raipur", 21.2514, 81.6296, 2),
  P("Dehradun", 30.3165, 78.0322, 2), P("Shimla", 31.1048, 77.1734, 2), P("Panaji", 15.4909, 73.8278, 2),
  P("Coimbatore", 11.0168, 76.9558, 2), P("Madurai", 9.9252, 78.1198, 2), P("Mysuru", 12.2958, 76.6394, 2, ["Mysore"]),
  P("Pahalgam", 34.0161, 75.3150, 2), P("Leh", 34.1526, 77.5771, 2),
  // India — states / UTs
  P("Maharashtra", 19.6633, 75.3003, 1), P("Karnataka", 15.3173, 75.7139, 1), P("Tamil Nadu", 11.1271, 78.6569, 1),
  P("Kerala", 10.1632, 76.6413, 1), P("Gujarat", 22.6708, 71.5724, 1), P("Rajasthan", 26.5727, 73.8390, 1),
  P("Uttar Pradesh", 26.8467, 80.9462, 1), P("Bihar", 25.0961, 85.3131, 1), P("West Bengal", 22.9868, 87.8550, 1),
  P("Odisha", 20.9517, 85.0985, 1), P("Madhya Pradesh", 22.9734, 78.6569, 1), P("Punjab", 31.1471, 75.3412, 1),
  P("Haryana", 29.0588, 76.0856, 1), P("Assam", 26.2006, 92.9376, 1), P("Manipur", 24.6637, 93.9063, 1),
  P("Jharkhand", 23.6102, 85.2799, 1), P("Chhattisgarh", 21.2787, 81.8661, 1), P("Uttarakhand", 30.0668, 79.0193, 1),
  P("Himachal Pradesh", 31.1048, 77.1734, 1), P("Goa", 15.2993, 74.1240, 1), P("Jammu and Kashmir", 33.7782, 76.5762, 1, ["Kashmir", "Jammu"]),
  P("Ladakh", 34.2268, 77.5619, 1), P("Sikkim", 27.5330, 88.5122, 1), P("Tripura", 23.9408, 91.9882, 1),
  P("Meghalaya", 25.4670, 91.3662, 1), P("Nagaland", 26.1584, 94.5624, 1), P("Mizoram", 23.1645, 92.9376, 1), P("Arunachal Pradesh", 28.2180, 94.7278, 1),
  // World — cities first, then countries
  P("Washington", 38.9072, -77.0369, 2), P("New York", 40.7128, -74.0060, 2), P("London", 51.5074, -0.1278, 2),
  P("Paris", 48.8566, 2.3522, 2), P("Moscow", 55.7558, 37.6173, 2), P("Kyiv", 50.4501, 30.5234, 2),
  P("Beijing", 39.9042, 116.4074, 2), P("Tokyo", 35.6762, 139.6503, 2), P("Dubai", 25.2048, 55.2708, 2),
  P("Riyadh", 24.7136, 46.6753, 2), P("Tehran", 35.6892, 51.3890, 2), P("Islamabad", 33.6844, 73.0479, 2),
  P("Karachi", 24.8607, 67.0011, 2), P("Lahore", 31.5204, 74.3587, 2), P("Dhaka", 23.8103, 90.4125, 2),
  P("Kathmandu", 27.7172, 85.3240, 2), P("Colombo", 6.9271, 79.8612, 2), P("Kabul", 34.5553, 69.2075, 2),
  P("Gaza", 31.5017, 34.4668, 2), P("Jerusalem", 31.7683, 35.2137, 2), P("Tel Aviv", 32.0853, 34.7818, 2),
  P("Beirut", 33.8938, 35.5018, 2), P("Damascus", 33.5138, 36.2765, 2), P("Baghdad", 33.3152, 44.3661, 2),
  P("Doha", 25.2854, 51.5310, 2), P("Singapore", 1.3521, 103.8198, 2), P("Sydney", -33.8688, 151.2093, 2),
  P("Toronto", 43.6532, -79.3832, 2), P("Berlin", 52.5200, 13.4050, 2), P("Brussels", 50.8503, 4.3517, 2),
  P("Geneva", 46.2044, 6.1432, 2), P("Strait of Hormuz", 26.5667, 56.2500, 2, ["Hormuz"]), P("Khyber Pakhtunkhwa", 34.9526, 72.3311, 2),
  P("United States", 38.9072, -77.0369, 1, ["US", "U.S.", "USA", "America"]), P("United Kingdom", 51.5074, -0.1278, 1, ["UK", "Britain"]),
  P("China", 39.9042, 116.4074, 1), P("Pakistan", 33.6844, 73.0479, 1), P("Bangladesh", 23.8103, 90.4125, 1),
  P("Nepal", 27.7172, 85.3240, 1), P("Sri Lanka", 6.9271, 79.8612, 1), P("Afghanistan", 34.5553, 69.2075, 1),
  P("Iran", 35.6892, 51.3890, 1), P("Iraq", 33.3152, 44.3661, 1), P("Israel", 31.7683, 35.2137, 1),
  P("Lebanon", 33.8938, 35.5018, 1), P("Syria", 33.5138, 36.2765, 1), P("Saudi Arabia", 24.7136, 46.6753, 1), P("UAE", 24.4539, 54.3773, 1, ["United Arab Emirates"]), P("Qatar", 25.2854, 51.5310, 1),
  P("Yemen", 15.3694, 44.1910, 1, ["Houthi", "Houthis"]),
  P("Ukraine", 50.4501, 30.5234, 1), P("Russia", 55.7558, 37.6173, 1), P("Japan", 35.6762, 139.6503, 1),
  P("South Korea", 37.5665, 126.9780, 1), P("North Korea", 39.0392, 125.7625, 1), P("Taiwan", 25.0330, 121.5654, 1),
  P("Myanmar", 19.7633, 96.0785, 1), P("Thailand", 13.7563, 100.5018, 1), P("Indonesia", -6.2088, 106.8456, 1),
  P("Australia", -35.2809, 149.1300, 1), P("Canada", 45.4215, -75.6972, 1), P("Mexico", 19.4326, -99.1332, 1),
  P("Brazil", -15.7975, -47.8919, 1), P("France", 48.8566, 2.3522, 1), P("Germany", 52.5200, 13.4050, 1),
  P("Italy", 41.9028, 12.4964, 1), P("Spain", 40.4168, -3.7038, 1), P("Turkey", 39.9334, 32.8597, 1, ["Türkiye"]),
  P("Egypt", 30.0444, 31.2357, 1), P("Djibouti", 11.5880, 43.1450, 1), P("South Africa", -25.7479, 28.2293, 1),
  P("Nigeria", 9.0765, 7.3986, 1), P("Kenya", -1.2921, 36.8219, 1), P("Maldives", 4.1755, 73.5093, 1),
];

// Regional sections with no named place are pinned to their capital.
const SECTION_HOME = { Telangana: "Hyderabad", "Andhra Pradesh": "Amaravati" };

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = PLACES.flatMap(p => [p.name, ...p.alias].map(n => ({ p, re: new RegExp(`(^|[^A-Za-z])${esc(n)}(?![A-Za-z])`, n.length <= 3 ? "" : "i") })));

/** Up to two places for a story: title matches first, most specific first. */
export function placesFor(title, text, categories = []) {
  const found = [];
  for (const src of [title, text]) {
    for (const { p, re } of MATCHERS) if (re.test(src) && !found.includes(p)) found.push(p);
    if (found.length) break;
  }
  if (!found.length) { const home = categories.map(c => SECTION_HOME[c]).find(Boolean); if (home) found.push(PLACES.find(p => p.name === home)); }
  // drop a place when a more specific one inside the same area was found (e.g. keep Kukatpally, drop Hyderabad)
  const best = found.sort((a, b) => b.rank - a.rank).filter((p, i, arr) => !arr.slice(0, i).some(q => q.rank > p.rank && Math.hypot(q.lat - p.lat, q.lon - p.lon) < 3));
  return best.slice(0, 2).map(({ name, lat, lon, rank }) => ({ name, lat, lon, rank }));
}
