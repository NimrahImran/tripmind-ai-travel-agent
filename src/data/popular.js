// Popular destinations shown instantly while typing (before the worldwide
// search answers). Pakistan and nearby favourites are listed generously.
export const POPULAR = [
  ['Dubai', 'United Arab Emirates'], ['Abu Dhabi', 'United Arab Emirates'], ['Doha', 'Qatar'], ['Muscat', 'Oman'],
  ['Makkah', 'Saudi Arabia'], ['Madinah', 'Saudi Arabia'], ['Riyadh', 'Saudi Arabia'], ['Jeddah', 'Saudi Arabia'], ['AlUla', 'Saudi Arabia'],
  ['Istanbul', 'Türkiye'], ['Cappadocia', 'Türkiye'], ['Antalya', 'Türkiye'], ['Bodrum', 'Türkiye'], ['Baku', 'Azerbaijan'], ['Tbilisi', 'Georgia'],
  ['Hunza', 'Pakistan'], ['Skardu', 'Pakistan'], ['Naran', 'Pakistan'], ['Swat', 'Pakistan'], ['Murree', 'Pakistan'], ['Neelum Valley', 'Pakistan'],
  ['Fairy Meadows', 'Pakistan'], ['Lahore', 'Pakistan'], ['Islamabad', 'Pakistan'], ['Karachi', 'Pakistan'], ['Chitral', 'Pakistan'], ['Gilgit', 'Pakistan'],
  ['Kalash Valley', 'Pakistan'], ['Gwadar', 'Pakistan'], ['Multan', 'Pakistan'], ['Peshawar', 'Pakistan'],
  ['Maldives', 'Maldives'], ['Bali', 'Indonesia'], ['Jakarta', 'Indonesia'], ['Lombok', 'Indonesia'], ['Kuala Lumpur', 'Malaysia'], ['Langkawi', 'Malaysia'],
  ['Penang', 'Malaysia'], ['Singapore', 'Singapore'], ['Bangkok', 'Thailand'], ['Phuket', 'Thailand'], ['Chiang Mai', 'Thailand'], ['Krabi', 'Thailand'],
  ['Hanoi', 'Vietnam'], ['Ho Chi Minh City', 'Vietnam'], ['Da Nang', 'Vietnam'], ['Ha Long Bay', 'Vietnam'], ['Siem Reap', 'Cambodia'], ['Manila', 'Philippines'],
  ['Palawan', 'Philippines'], ['Colombo', 'Sri Lanka'], ['Kandy', 'Sri Lanka'], ['Ella', 'Sri Lanka'], ['Kathmandu', 'Nepal'], ['Pokhara', 'Nepal'],
  ['Thimphu', 'Bhutan'], ['Delhi', 'India'], ['Goa', 'India'], ['Jaipur', 'India'], ['Kerala', 'India'], ['Agra', 'India'], ['Dhaka', 'Bangladesh'],
  ['Tokyo', 'Japan'], ['Kyoto', 'Japan'], ['Osaka', 'Japan'], ['Hokkaido', 'Japan'], ['Seoul', 'South Korea'], ['Busan', 'South Korea'], ['Jeju', 'South Korea'],
  ['Beijing', 'China'], ['Shanghai', 'China'], ['Hong Kong', 'China'], ['Taipei', 'Taiwan'], ['Almaty', 'Kazakhstan'], ['Samarkand', 'Uzbekistan'], ['Tashkent', 'Uzbekistan'],
  ['London', 'United Kingdom'], ['Edinburgh', 'United Kingdom'], ['Manchester', 'United Kingdom'], ['Paris', 'France'], ['Nice', 'France'], ['Lyon', 'France'],
  ['Rome', 'Italy'], ['Venice', 'Italy'], ['Florence', 'Italy'], ['Milan', 'Italy'], ['Positano', 'Italy'], ['Amalfi Coast', 'Italy'], ['Cinque Terre', 'Italy'], ['Lake Como', 'Italy'],
  ['Barcelona', 'Spain'], ['Madrid', 'Spain'], ['Seville', 'Spain'], ['Granada', 'Spain'], ['Mallorca', 'Spain'], ['Lisbon', 'Portugal'], ['Porto', 'Portugal'], ['Madeira', 'Portugal'],
  ['Amsterdam', 'Netherlands'], ['Brussels', 'Belgium'], ['Bruges', 'Belgium'], ['Berlin', 'Germany'], ['Munich', 'Germany'], ['Vienna', 'Austria'], ['Salzburg', 'Austria'], ['Hallstatt', 'Austria'],
  ['Zurich', 'Switzerland'], ['Interlaken', 'Switzerland'], ['Lauterbrunnen', 'Switzerland'], ['Lucerne', 'Switzerland'], ['Zermatt', 'Switzerland'], ['Geneva', 'Switzerland'],
  ['Prague', 'Czechia'], ['Budapest', 'Hungary'], ['Krakow', 'Poland'], ['Dubrovnik', 'Croatia'], ['Split', 'Croatia'], ['Ljubljana', 'Slovenia'], ['Lake Bled', 'Slovenia'],
  ['Athens', 'Greece'], ['Santorini', 'Greece'], ['Mykonos', 'Greece'], ['Crete', 'Greece'], ['Copenhagen', 'Denmark'], ['Stockholm', 'Sweden'], ['Oslo', 'Norway'],
  ['Tromsø', 'Norway'], ['Bergen', 'Norway'], ['Helsinki', 'Finland'], ['Lapland', 'Finland'], ['Reykjavik', 'Iceland'], ['Kirkjufell', 'Iceland'], ['Dublin', 'Ireland'],
  ['Cairo', 'Egypt'], ['Luxor', 'Egypt'], ['Sharm El Sheikh', 'Egypt'], ['Marrakech', 'Morocco'], ['Chefchaouen', 'Morocco'], ['Fes', 'Morocco'], ['Zanzibar', 'Tanzania'],
  ['Serengeti', 'Tanzania'], ['Nairobi', 'Kenya'], ['Maasai Mara', 'Kenya'], ['Cape Town', 'South Africa'], ['Mauritius', 'Mauritius'], ['Seychelles', 'Seychelles'],
  ['Petra', 'Jordan'], ['Amman', 'Jordan'], ['Wadi Rum', 'Jordan'],
  ['New York', 'United States'], ['Los Angeles', 'United States'], ['San Francisco', 'United States'], ['Las Vegas', 'United States'], ['Miami', 'United States'],
  ['Orlando', 'United States'], ['Hawaii', 'United States'], ['Chicago', 'United States'], ['Grand Canyon', 'United States'], ['Toronto', 'Canada'], ['Vancouver', 'Canada'],
  ['Banff', 'Canada'], ['Niagara Falls', 'Canada'], ['Cancún', 'Mexico'], ['Mexico City', 'Mexico'], ['Havana', 'Cuba'], ['Rio de Janeiro', 'Brazil'],
  ['Machu Picchu', 'Peru'], ['Cusco', 'Peru'], ['Buenos Aires', 'Argentina'], ['Patagonia', 'Argentina'], ['Galápagos Islands', 'Ecuador'],
  ['Sydney', 'Australia'], ['Melbourne', 'Australia'], ['Gold Coast', 'Australia'], ['Great Barrier Reef', 'Australia'], ['Queenstown', 'New Zealand'],
  ['Auckland', 'New Zealand'], ['Fiji', 'Fiji'], ['Bora Bora', 'French Polynesia'],
].map(([name, country]) => ({ name, country }));

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Instant matches: names starting with the query first, then names containing it. */
export function popularMatches(query, max = 6) {
  const q = fold(query.trim());
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const p of POPULAR) {
    const n = fold(p.name);
    const c = fold(p.country);
    if (n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q))) starts.push(p);
    else if (q.length > 2 && (n.includes(q) || c.startsWith(q))) contains.push(p);
  }
  return [...starts, ...contains].slice(0, max);
}
