// Loot and venom.
//
// The clock (state.clock) ticks once per arena visit and once per inn night.
// Potency is never updated tick by tick; it's worked out from when a gland
// was found (gotAt) or a coating applied (appliedAt):
//   gland in your pack:  -1 potency every GLAND_DECAY_TICKS ticks
//   coating on a weapon: -1 strength every tick
// Spoiled glands and spent coatings are cleared whenever the clock moves.

import { random } from '../engine/dice.js';
import { LOOT_BY_ID } from '../data/loot.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { WEAPON_BY_ID } from '../data/equipment.js';
import { GLAND_DECAY_TICKS, MAX_COATINGS } from './tables.js';

const ok = msg => ({ ok: true, msg });
const fail = msg => ({ ok: false, msg });

export const glandPotency = (state, g) =>
  Math.max(0, g.potency - Math.floor((state.clock - g.gotAt) / GLAND_DECAY_TICKS));

export const coatingStrength = (state, ct) => Math.max(0, ct.strength - (state.clock - ct.appliedAt));

// Ticks until a gland loses its next point of potency.
export const ticksToNextFade = (state, g) => GLAND_DECAY_TICKS - ((state.clock - g.gotAt) % GLAND_DECAY_TICKS);

export function freshness(potency, start) {
  if (potency <= 1) return 'Nearly spent';
  return potency >= start ? 'Fresh' : 'Fading';
}

export const glandValue = (state, g) => glandPotency(state, g) * LOOT_BY_ID[g.id].value;

// Live coatings on a weapon entry, with their current strength.
export function liveCoatings(state, entry) {
  return (entry?.coatings ?? [])
    .map(ct => ({ ...ct, now: coatingStrength(state, ct) }))
    .filter(ct => ct.now > 0);
}

export const venomName = source => MONSTER_BY_ID[source].name.replace('Giant ', '');

export function coatingLabel(state, entry) {
  return liveCoatings(state, entry).map(ct => `${venomName(ct.source)} ${ct.now}`).join(', ');
}

// Roll a dead monster's drops. Returns the loot entries added.
export function rollLoot(state, monsterId) {
  const found = [];
  for (const drop of MONSTER_BY_ID[monsterId].loot) {
    if (random() < drop.chance) {
      const item = LOOT_BY_ID[drop.item];
      const g = { id: item.id, potency: item.potency, gotAt: state.clock };
      state.character.loot.push(g);
      found.push(g);
    }
  }
  return found;
}

export function advanceClock(state, ticks) {
  if (ticks <= 0) return [];
  state.clock += ticks;
  return prune(state);
}

// Leaving the Battlerings after fighting ends an arena visit: one tick.
export function endArenaVisit(state) {
  if (!state.arenaVisit) return [];
  state.arenaVisit = false;
  return advanceClock(state, 1);
}

// Drop spoiled glands and spent coatings. Returns names of spoiled glands.
function prune(state) {
  const c = state.character;
  const spoiled = c.loot.filter(g => glandPotency(state, g) <= 0).map(g => LOOT_BY_ID[g.id].name);
  c.loot = c.loot.filter(g => glandPotency(state, g) > 0);
  for (const w of c.weapons) w.coatings = w.coatings.filter(ct => coatingStrength(state, ct) > 0);
  return spoiled;
}

export function applyVenom(state, lootIndex, weaponIndex) {
  const c = state.character;
  const g = c.loot[lootIndex];
  const w = c.weapons[weaponIndex];
  if (!g || !w) return fail('Choose a gland and a weapon.');
  const item = LOOT_BY_ID[g.id];
  const potency = glandPotency(state, g);
  if (potency <= 0) return fail(`The ${item.name} has spoiled.`);
  const weaponName = WEAPON_BY_ID[w.id].name;
  w.coatings = w.coatings.filter(ct => coatingStrength(state, ct) > 0);
  const same = w.coatings.find(ct => ct.source === item.source);
  if (same) {
    const strength = Math.max(coatingStrength(state, same), potency);
    Object.assign(same, { strength, appliedAt: state.clock });
  } else {
    if (w.coatings.length >= MAX_COATINGS) return fail(`Your ${weaponName} already carries ${MAX_COATINGS} venoms.`);
    w.coatings.push({ source: item.source, item: item.id, strength: potency, appliedAt: state.clock });
  }
  c.loot.splice(lootIndex, 1);
  return ok(same
    ? `You work fresh venom into your ${weaponName}. The ${venomName(item.source)} coating is now strength ${same.strength}.`
    : `You coat your ${weaponName} with ${venomName(item.source).toLowerCase()} venom (strength ${potency}). It fades each night and each arena visit.`);
}

export function sellLoot(state, index) {
  const c = state.character;
  const g = c.loot[index];
  if (!g) return fail('No such loot.');
  const price = glandValue(state, g);
  c.loot.splice(index, 1);
  c.gold += price;
  return ok(`The alchemist pays ${price} gold for the ${LOOT_BY_ID[g.id].name}.`);
}
