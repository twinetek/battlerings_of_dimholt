// Battlefield terrain (beta): the level of every hex, from 0 (the arena
// floor) to MAX_HEIGHT. See todo_terrain.md for the full design and DESIGN.md
// ("Terrain") for what's built. This module only generates the levels;
// nothing reads them for movement or combat yet. The Guide lists TERRAINS
// for players, so keep the descriptions in plain words.
//
// combat.grid.height = { "q,r": level }. Hexes that aren't listed are level
// 0, so flat boards and older saves need no height map at all.
//
// Every layout is point-symmetric through the center (q,r -> -q,-r), so your
// side and the enemy side always get equal ground. The two rows at each far
// edge stay level 0, so everyone deploys on the floor.

import * as H from '../engine/hex.js';
import { die, random } from '../engine/dice.js';

export const MAX_HEIGHT = 3;
export const MESA_CHANCE = 0.25; // a hill pair gets a flat top and cliff sides
export const LEDGE_LEVEL = 2;

export const TERRAINS = [
  { id: 'flat',     name: 'Flat',     description: 'An even floor.' },
  { id: 'hills',    name: 'Hills',    description: 'One to three hills, some with sheer sides.' },
  { id: 'ziggurat', name: 'Ziggurat', description: 'A stepped pyramid in the middle, levels 3, 2, 1.' },
  { id: 'ledges',   name: 'Ledges',   description: 'A raised band across the middle, with a ramp up from each side.' },
];
export const TERRAIN_BY_ID = Object.fromEntries(TERRAINS.map(t => [t.id, t]));

const ORIGIN = { q: 0, r: 0 };
export const mirror = h => ({ q: -h.q, r: -h.r });

export const levelOf = (grid, h) => grid.height?.[H.key(h)] ?? 0;

// The rows where fighters deploy (see freeSpots in battlefield.js).
export const isStartRow = (radius, h) => Math.abs(h.r) >= radius - 1;

// ---- Shapes: hex -> level ----

// A hill drops 1 level per ring.
const hill = (center, peak) => h => Math.max(0, peak - H.distance(h, center));

// A mesa has a flat top of radius 1, then drops at least 2 levels (a cliff).
const mesa = (center, peak) => h => {
  const d = H.distance(h, center);
  return d <= 1 ? peak : Math.max(0, peak - d - 1);
};

// ---- Layouts: radius -> { shape, ramps } ----
// ramps are hexes that must stay open (no pillars), because they are the only
// walkable way onto raised ground.

const flat = () => ({ shape: () => 0, ramps: [] });

// Where a pair of hills may stand: off the deployment rows, and at least 2
// from the center, so the hill and its mirror are at least 4 apart.
function hillSpots(radius) {
  return H.hexagon(radius).filter(h => Math.abs(h.r) <= radius - 2 && H.distance(h, ORIGIN) >= 2);
}

// Maybe a hill in the middle, plus a mirrored pair: one to three hills.
function hills(radius) {
  const shapes = [];
  if (die(2) === 1) shapes.push(hill(ORIGIN, 1 + die(2)));
  const spots = hillSpots(radius);
  if (spots.length) {
    const c = spots[die(spots.length) - 1];
    const peak = 1 + die(2);
    const kind = random() < MESA_CHANCE ? mesa : hill;
    shapes.push(kind(c, peak), kind(mirror(c), peak));
  }
  return { shape: h => Math.max(0, ...shapes.map(s => s(h))), ramps: [] };
}

const ziggurat = () => ({ shape: hill(ORIGIN, MAX_HEIGHT), ramps: [] });

// A band across the middle at LEDGE_LEVEL, with cliffs on both long sides,
// and one ramp (level 1) up each side. The ramps mirror each other.
function ledges(radius) {
  const half = radius >= 5 ? 1 : 0; // the band is 3 rows deep on big boards, 1 on small ones
  const row = half + 1;
  const onBoard = h => H.distance(h, ORIGIN) <= radius;
  // A ramp needs both band hexes above it and a floor hex below it on the board.
  const spots = H.hexagon(radius).filter(h => h.r === row && H.distance(h, ORIGIN) <= radius - 1
    && onBoard({ q: h.q, r: h.r - 1 }) && onBoard({ q: h.q + 1, r: h.r - 1 }) && onBoard({ q: h.q, r: h.r + 1 }));
  const ramp = spots[die(spots.length) - 1];
  const ramps = [ramp, mirror(ramp)];
  const rampKeys = new Set(ramps.map(H.key));
  return {
    shape: h => (Math.abs(h.r) <= half ? LEDGE_LEVEL : rampKeys.has(H.key(h)) ? 1 : 0),
    ramps,
  };
}

const LAYOUTS = { flat, hills, ziggurat, ledges };

// ---- Generation ----

// The highest a hex may be: the ground slopes down by at most 1 per row
// toward the deployment rows, so a hill near the edge never ends in a cliff
// in front of the starting line.
const ceilingAt = (radius, h) => Math.min(MAX_HEIGHT, radius - 1 - Math.abs(h.r));

// Returns { height, ramps }: height lists only hexes above the floor, ramps
// are hexes to keep clear of pillars. Unknown ids fall back to flat.
export function generateTerrain(radius, id = 'flat') {
  const { shape, ramps } = (LAYOUTS[id] ?? flat)(radius);
  const height = {};
  for (const h of H.hexagon(radius)) {
    if (isStartRow(radius, h)) continue;
    const level = Math.min(ceilingAt(radius, h), shape(h));
    if (level > 0) height[H.key(h)] = level;
  }
  return { height, ramps: ramps.map(H.key) };
}
