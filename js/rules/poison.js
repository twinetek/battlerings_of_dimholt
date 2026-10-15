// Poison. A poisoned character has a strength (c.poison). At the end of each
// combat round it deals that much damage, then drops by 1, so strength 4 does
// 4 + 3 + 2 + 1 = 10 in all.
//
// Poison lives on the character, not the fight: whatever is left when a fight
// ends is applied at once, but a win or surrender can't take you below 1 hp.
// If it would, you stop at 1 and the rest lingers into your next fight until
// it's cured (Potion of Neutralize Poison, or a night at the inn).

import { die } from '../engine/dice.js';
import { saveTarget } from './tables.js';

export const poisonTotal = strength => (strength * (strength + 1)) / 2;

// Per-monster history: { [monsterId]: { poisoned, resisted, damage } }
export function recordFor(c, monsterId) {
  c.poisonRecord[monsterId] ??= { poisoned: 0, resisted: 0, damage: 0 };
  return c.poisonRecord[monsterId];
}

// A poisoned attack hit. Saving throw first; a new dose on top of an old one
// takes the higher strength plus 1.
export function exposeToPoison(c, monsterId, dose) {
  const rec = recordFor(c, monsterId);
  if (die(20) >= saveTarget('poison', c.level)) {
    rec.resisted++;
    return { resisted: true };
  }
  const stacked = c.poison > 0;
  c.poison = stacked ? Math.max(c.poison, dose) + 1 : dose;
  c.poisonSource = monsterId;
  rec.poisoned++;
  return { resisted: false, strength: c.poison, stacked };
}

export function notePoisonDamage(c, dmg) {
  if (c.poisonSource && dmg > 0) recordFor(c, c.poisonSource).damage += dmg;
}

// End of a fight you survived. Returns { dmg, lingering }.
export function sweatOut(c) {
  let dmg = 0;
  while (c.poison > 0 && c.hp - c.poison >= 1) {
    c.hp -= c.poison;
    dmg += c.poison;
    c.poison--;
  }
  if (c.poison > 0) {
    dmg += c.hp - 1;
    c.hp = 1;
  }
  notePoisonDamage(c, dmg);
  return { dmg, lingering: c.poison };
}

export function curePoison(c) {
  const had = c.poison;
  c.poison = 0;
  return had;
}
