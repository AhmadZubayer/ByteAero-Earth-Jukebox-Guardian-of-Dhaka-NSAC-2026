// The six rounds, and how each district is laid out. Pure data/functions (no DOM).
import { N } from './heat.js';

export const DISTRICT_NAMES = [
  'Kite Lane', 'Mango Para', 'Shapla Block', 'Banyan Square', 'Boat Ghat',
  'Lantern Lane', 'Tea Corner', 'Rickshaw Row', 'Lotus Market', 'Jamun Street',
  'Monsoon Court', 'Tin Roof Row', 'Clay Pot Corner', 'Cycle Bazaar', 'Palm Para',
  'Kadam Corner', 'School Lane', 'Rooftop Hill', 'Ferry Road', 'Bamboo Bazaar',
  'Pond Side', 'Hilsa Market', 'Brick Kiln Road', 'Sari Street', 'River Gate',
];

// Heat-wave strength (game estimate) from NASA POWER April maximum air temperature at Dhaka.
export const waveFromTmax = (tmax) => 1.6 + (tmax - 38) * 0.22;

export const ROUNDS = [
  {
    year: 2000, real: true, spots: 1, coins: 14, time: 210, hidden: false, waveBonus: 0.25,
    title: 'Every place has a sound',
    lesson: 'Hot places sound higher and brighter. Follow the sound to find the heat.',
    fragment: 'We remember the old trees on our street…',
  },
  {
    year: 2010, real: true, spots: 2, coins: 16, time: 220, hidden: false,
    title: 'Two hot spots',
    lesson: 'Compare two dates carefully. Two snapshots are not a trend.',
    fragment: '…the summers felt longer every year…',
  },
  {
    year: 2020, real: true, spots: 1, coins: 12, time: 200, hidden: true, talk: true,
    title: 'Hidden heat',
    lesson: 'A satellite measures how hot the ground surface is. That is not the same as how hot the air feels to a person.',
    fragment: '…someone listened to the ground, not only the sky…',
  },
  {
    year: 2024, real: true, spots: 1, coins: 10, time: 180, hidden: false, centre: true, waveBonus: 0.7,
    title: 'The hottest April air',
    lesson: 'Budgets force choices. A cooling centre keeps people safe, but it does not cool the city.',
    fragment: '…they kept people safe on the worst days…',
  },
  {
    year: 2035, real: false, spots: 2, coins: 16, time: 210, hidden: false, choices: true,
    title: 'Choose the future',
    lesson: 'Choices made today shape the heat of tomorrow.',
    fragment: '…they chose what kind of city to build…',
  },
  {
    year: 2050, real: false, spots: 3, coins: 18, time: 240, hidden: false, final: true,
    title: 'The last heat wave',
    lesson: 'The ending is ours to write.',
    fragment: '…and now we can hear the birds again.',
  },
];

// Imagined changes for 2035 and 2050, applied to the 2024 NASA pattern (game estimates).
export const CHOICES = {
  energy: {
    clean: { label: 'Clean energy', text: 'Solar panels and cleaner buses. Less waste heat and pollution.', wave: -0.45 },
    coal: { label: 'Coal power', text: 'Cheap power now, but more heat-trapping gases and smoke.', wave: 0.55 },
  },
  land: {
    parks: { label: 'Parks and water', text: 'Keep green spaces and ponds as the city grows.', base: -0.35, ndvi: 0.08 },
    concrete: { label: 'More concrete', text: 'Build over the open ground. More roads and roofs.', base: 0.55, ndvi: -0.1 },
  },
};

function hash(i, k = 1) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }

// How a district is built, from its NDVI: greener blocks have fewer buildings and more trees.
export function layoutDistrict(cell, i) {
  const ndvi = cell.ndvi ?? 0.4;
  const nBuildings = Math.max(1, Math.min(4, Math.round(1 + (0.62 - ndvi) * 9)));
  const corners = [0, 1, 2, 3].sort((a, b) => hash(i, a) - hash(i, b));
  const buildingCorners = corners.slice(0, nBuildings);
  const openCorners = corners.slice(nBuildings);
  const treePlots = 4 + openCorners.length * 2;
  const existing = Math.min(treePlots - 1, Math.round(ndvi * treePlots * 0.75));
  return { nBuildings, buildingCorners, openCorners, treePlots, existingTrees: existing, freeTrees: treePlots - existing, roofs: nBuildings, bigSite: 1 };
}

// Can another fix of this type go in district d, given fixes already placed?
export function plotFree(layouts, d, type, fixes) {
  const here = fixes.filter((f) => f.district === d);
  const L = layouts[d];
  if (type === 'tree') return here.filter((f) => f.type === 'tree').length < L.freeTrees;
  if (type === 'roof') return here.filter((f) => f.type === 'roof').length < L.roofs;
  return !here.some((f) => f.type === 'pond' || f.type === 'centre'); // one big site per block
}

// Cells (LST, NDVI per district) for a round. Real years use NASA data; 2035/2050 are imagined.
export function cellsFor(data, round, state = {}) {
  if (round.real) return data.districts[round.year].map((c) => ({ ...c }));
  const base = data.districts[2024];
  const land = CHOICES.land[state.land || 'parks'];
  const scale = round.year === 2050 ? 1.5 : 1;
  const planted = state.planted || new Array(N).fill(0); // trees and ponds that stayed and grew
  return base.map((c, i) => ({
    ...c,
    lst: c.lst == null ? null : c.lst + 0.6 * scale - (round.year === 2050 ? 0 : 0) + land.base * scale - Math.min(1.2, planted[i] * 0.18),
    ndvi: c.ndvi == null ? null : Math.max(0.05, Math.min(0.85, c.ndvi + land.ndvi * scale + Math.min(0.15, planted[i] * 0.02))),
    imagined: true,
  }));
}

export function waveFor(data, round, state = {}) {
  if (round.real) return waveFromTmax(data.power[round.year].aprT2MMax) + (round.waveBonus || 0);
  const base = waveFromTmax(data.power[2024].aprT2MMax) + (round.year === 2050 ? 0.35 : 0.15);
  const energy = CHOICES.energy[state.energy || 'clean'];
  return base + energy.wave * (round.year === 2050 ? 1.15 : 1);
}
