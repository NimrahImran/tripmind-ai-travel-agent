// Hero destinations. Photos: Unsplash (free Unsplash License).
const img = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

const raw = [
  {
    id: 'positano',
    name: 'Positano',
    country: 'Italy',
    region: 'Amalfi Coast',
    lat: 40.628,
    lng: 14.485,
    photo: '1760867333704-872f5ff51cdd',
    tone: ['#c9744a', '#2d4f6b'],
    blurb:
      'Pastel houses tumble down a cliff into the Tyrrhenian Sea. Spend mornings on lemon-scented terraces and evenings on a boat to hidden coves.',
    facts: ['Best: May–Sep', 'Lemon groves', 'Boat days'],
    bestMonths: 'May to September',
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    region: 'Tegallalang',
    lat: -8.4095,
    lng: 115.1889,
    photo: '1559628233-eb1b1a45564b',
    tone: ['#5f8f3a', '#1f3b2c'],
    blurb:
      'Emerald rice terraces carved by hand over centuries, water temples at dawn and slow afternoons in Ubud’s jungle cafés.',
    facts: ['Best: Apr–Oct', 'Rice terraces', 'Temples'],
    bestMonths: 'April to October',
  },
  {
    id: 'cappadocia',
    name: 'Cappadocia',
    country: 'Türkiye',
    region: 'Göreme',
    lat: 38.6431,
    lng: 34.8289,
    photo: '1733303987597-7c8814ad3768',
    tone: ['#d08a4e', '#3b2a3f'],
    blurb:
      'Hundreds of balloons rise over fairy chimneys at sunrise. Sleep in a cave hotel and hike valleys painted pink and gold.',
    facts: ['Best: Apr–Jun', 'Balloon rides', 'Cave hotels'],
    bestMonths: 'April to June, September to October',
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    region: 'Oia',
    lat: 36.4618,
    lng: 25.3753,
    photo: '1563789031959-4c02bcb41319',
    tone: ['#3f7fb5', '#1b2f4a'],
    blurb:
      'Whitewashed lanes, blue domes and a caldera that turns copper at sunset. Swim at red and black sand beaches in between.',
    facts: ['Best: Jun–Sep', 'Caldera sunsets', 'Volcanic beaches'],
    bestMonths: 'June to September',
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    region: 'Kiyomizu-dera',
    lat: 35.0116,
    lng: 135.7681,
    photo: '1545569341-9eb8b30979d9',
    tone: ['#b5483a', '#2a2a33'],
    blurb:
      'Wooden pagodas above maple forests, quiet tea houses and lantern-lit Gion streets. A city that rewards walking slowly.',
    facts: ['Best: Mar–May', 'Temples', 'Tea houses'],
    bestMonths: 'March to May, October to November',
  },
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Maldives',
    region: 'North Malé Atoll',
    lat: 4.1755,
    lng: 73.5093,
    photo: '1602217401731-1b9d5c2384f7',
    tone: ['#2fa6b0', '#0f3a4a'],
    blurb:
      'Wooden jetties over glass-clear lagoons, reef snorkelling from your doorstep and sandbanks that vanish with the tide.',
    facts: ['Best: Nov–Apr', 'Lagoons', 'Reef snorkelling'],
    bestMonths: 'November to April',
  },
  {
    id: 'hunza',
    name: 'Hunza',
    country: 'Pakistan',
    region: 'Gilgit-Baltistan',
    lat: 36.3167,
    lng: 74.65,
    photo: '1592875146220-b769961ebe54',
    tone: ['#7d8fa3', '#22313f'],
    blurb:
      'Snow peaks above apricot orchards, 800-year-old forts and the turquoise Attabad Lake along the Karakoram Highway.',
    facts: ['Best: Apr–Oct', 'Old forts', 'Karakoram Highway'],
    bestMonths: 'April to October',
  },
  {
    id: 'iceland',
    name: 'Kirkjufell',
    country: 'Iceland',
    region: 'Snæfellsnes',
    lat: 64.9416,
    lng: -23.3054,
    photo: '1668544282309-b398f31b49e7',
    tone: ['#4f7a6a', '#152a2c'],
    blurb:
      'A lone arrowhead mountain above twin waterfalls. In winter the Northern Lights dance right over it.',
    facts: ['Best: Jun–Aug', 'Waterfalls', 'Northern Lights'],
    bestMonths: 'June to August, or September to March for auroras',
  },
  {
    id: 'machu-picchu',
    name: 'Machu Picchu',
    country: 'Peru',
    region: 'Andes',
    lat: -13.1631,
    lng: -72.545,
    photo: '1590089171605-171f3b536f74',
    tone: ['#6c8a54', '#232f24'],
    blurb:
      'The lost Inca citadel floats in cloud at 2,430 metres. Arrive on the Inca Trail or by train through the Sacred Valley.',
    facts: ['Best: May–Sep', 'Inca Trail', 'Sacred Valley'],
    bestMonths: 'May to September',
  },
  {
    id: 'lauterbrunnen',
    name: 'Lauterbrunnen',
    country: 'Switzerland',
    region: 'Bernese Oberland',
    lat: 46.5935,
    lng: 7.9091,
    photo: '1612178010892-205e565c4c5d',
    tone: ['#5d86a8', '#1d2c3a'],
    blurb:
      'A valley of 72 waterfalls under the Jungfrau. Ride cogwheel trains to car-free villages and alpine lakes.',
    facts: ['Best: Jun–Sep', '72 waterfalls', 'Alpine trains'],
    bestMonths: 'June to September',
  },
];

export const destinations = raw.map((d) => ({
  ...d,
  image: img(d.photo, 1920),
  imageMid: img(d.photo, 1400),
  imageMobile: img(d.photo, 1000),
  thumb: img(d.photo, 520),
}));

export const formatCoords = (lat, lng) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
