// What the player learns: short facts that appear when they do something, and one quick
// question per year in Echo's report. Each fact is shown once per game and collected for the ticket.
import { say } from '../ui/announce.js';

export const FACTS = {
  satellite: { icon: '🛰️', title: 'How NASA sees Dhaka', text: 'NASA\'s Terra satellite circles Earth about 705 km up. Its MODIS camera measures how hot the ground is, in squares about 1 km wide.' },
  sonify: { icon: '🎵', title: 'Turning data into sound', text: 'This is called sonification: numbers become music. Here a hotter block plays a higher note, so you can find heat with your ears.' },
  heatIsland: { icon: '🏙️', title: 'The urban heat island', text: 'Roofs, roads and concrete soak up sunlight and stay hot. That is why built-up blocks show up hotter than green ones in the NASA image.' },
  lst: { icon: '🌡️', title: 'Ground is not air', text: 'Land surface temperature is how hot roofs and roads are. On a sunny day they can be much hotter than the air you breathe.' },
  ndvi: { icon: '🌿', title: 'Measuring green from space', text: 'NDVI compares the red and near-infrared light that plants reflect. Near 0 means bare or built-up ground; above 0.6 means lots of healthy plants.' },
  tree: { icon: '🌳', title: 'Why trees cool', text: 'Trees cool in two ways: their shade keeps the sun off the ground, and their leaves release water vapour, which takes heat away from the air.' },
  roof: { icon: '🏠', title: 'Why white roofs help', text: 'Light colours reflect sunlight; dark colours absorb it. A white roof stays much cooler, so the building and the street around it heat up less.' },
  pond: { icon: '💧', title: 'Why water cools', text: 'Water takes a lot of energy to warm up, and evaporation carries heat away. Ponds and lakes keep the blocks around them cooler.' },
  centre: { icon: '⛺', title: 'Protecting people', text: 'A cooling centre gives shade, water and a place to rest. It keeps people safe in a heat wave, but it does not lower the temperature of the city.' },
  scan: { icon: '📡', title: 'Scanning like a satellite', text: 'Echo\'s scan plays one note for each direction around you. Satellites also scan, line by line, to build up a picture of the Earth.' },
  hidden: { icon: '👂', title: 'Listening for hidden things', text: 'Scientists sometimes find patterns in data by listening, the same way you find the hidden heat here. Sound can reveal what the eye misses.' },
  rain: { icon: '🌧️', title: 'Rain and heat', text: 'NASA POWER records rain for Dhaka. Rain cools the ground as it evaporates; a dry April lets heat build up. Listen: the tabla follows the rain.' },
  trend: { icon: '📈', title: 'A snapshot is not a trend', text: 'One hot April can happen by chance. To see climate change, scientists compare many years, like the 1884–2022 NASA record you heard on the globe.' },
  humidity: { icon: '💦', title: 'How hot it feels', text: 'Dhaka is humid. Wet air makes it harder for sweat to cool us, so the same temperature feels more dangerous on a humid day.' },
  future: { icon: '🔮', title: 'Choices shape the future', text: 'The 2035 and 2050 cities here are imagined. Real future heat depends on choices people make now: energy, green space and how cities are built.' },
  wave: { icon: '🔥', title: 'Heat waves', text: 'A heat wave is several days much hotter than usual. Cooler, greener blocks and safe places to rest help a city get through it.' },
};

const YEAR_FACT = { 2000: 'satellite', 2010: 'trend', 2020: 'hidden', 2024: 'humidity', 2035: 'future', 2050: 'future' };
export const FIX_FACT = { tree: 'tree', roof: 'roof', pond: 'pond', centre: 'centre' };

let onShow = null;
export function onFact(fn) { onShow = fn; }

// Show a fact once per game. Returns true if it was new.
export function learn(id, state) {
  const f = FACTS[id];
  if (!f || !state) return false;
  state.learned ||= [];
  if (state.learned.includes(id)) return false;
  state.learned.push(id);
  onShow?.(f);
  say(`Did you know? ${f.title}. ${f.text}`, { caption: !onShow });
  return true;
}

export function yearFact(year) { return YEAR_FACT[year]; }

// One quick question per year, asked in Echo's report.
export const QUIZ = {
  2000: { q: 'In this game, what does a higher, brighter sitar note mean?', options: ['A hotter place', 'More rain', 'More trees'], answer: 0, why: 'Hot ground is mapped to high pitch. That is how you found the heat by ear.' },
  2010: { q: 'April 2010 was hotter than April 2000. Does that alone prove the climate is warming?', options: ['Yes, two years are enough', 'No, you need many years of data', 'Only if it rained'], answer: 1, why: 'Two snapshots can differ by chance. The 1884–2022 NASA record shows the long-term warming.' },
  2020: { q: 'What does the MODIS satellite measure in these Dhaka images?', options: ['The air temperature', 'How hot the ground surface is', 'How hot people feel'], answer: 1, why: 'It measures land surface temperature: roofs, roads and fields. Air and feeling are different.' },
  2024: { q: 'What does a cooling centre do in a heat wave?', options: ['It cools the whole city', 'It keeps people safe, but does not cool the city', 'It makes it rain'], answer: 1, why: 'It gives people shade, water and rest. Only trees, water and cooler roofs lower the heat of the blocks.' },
  2035: { q: 'Which choice helps keep a future city cooler?', options: ['More concrete', 'Parks and water', 'Cutting trees for roads'], answer: 1, why: 'Green space and water cool the blocks around them. Concrete stores heat.' },
  2050: { q: 'Why do white roofs help?', options: ['They reflect sunlight', 'They make wind', 'They hold rain'], answer: 0, why: 'Light colours reflect sunlight instead of soaking it up as heat.' },
};
