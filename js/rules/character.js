// The player character: creation, derived numbers, experience, and levels.
// Characters are plain JSON so they save as-is. Anything that can be worked
// out from other fields (max hp, AC, to-hit) is computed, never stored.

import { roll, die } from '../engine/dice.js';
import { WEAPON_BY_ID, ARMOR_BY_ID, ITEM_BY_ID, UNARMED } from '../data/equipment.js';
import {
  STATS, strBonus, dexAc, conHp, thac0, XP_FOR_LEVEL, MAX_LEVEL,
  FIRST_LEVEL_HP, HIT_DIE, HP_AFTER_NINE, STARTING_GOLD,
} from './tables.js';
import { earnsStatPoint, spendPoints, addTome, revokeLevel } from './stats.js';

// 3d6 in order, like the old books.
export function rollStats() {
  const stats = {};
  for (const [key] of STATS) stats[key] = roll('3d6');
  return stats;
}

export function createCharacter(name, stats) {
  const c = {
    name: name.trim() || 'Derek',
    baseStats: { ...stats },   // the creation roll; never changes
    stats: { ...stats },       // baseStats + statLog, rebuilt by recomputeStats (see stats.js)
    statPoints: [],            // levels whose stat point is unspent
    statLog: [],               // history of stat changes
    level: 1,
    xp: 0,
    hpRolls: [FIRST_LEVEL_HP], // raw hit die per level; Con bonus is added when computing max hp
    hp: 0,
    gold: roll(STARTING_GOLD) * 10,
    weapons: [],               // weapon ids, at most MAX_WEAPONS
    equipped: -1,              // index into weapons, -1 for bare hands
    armor: null,               // armor id
    items: [],                 // { id, charges? }
    wins: {},                  // monster id -> times beaten
    dead: false,
  };
  c.hp = maxHp(c);
  return c;
}

export function maxHp(c) {
  const bonus = conHp(c.stats.con);
  return c.hpRolls.reduce((sum, r, i) => sum + (i < 9 ? Math.max(1, r + bonus) : r), 0);
}

export const weaponOf = c => (c.equipped >= 0 && WEAPON_BY_ID[c.weapons[c.equipped]]) || UNARMED;
export const armorOf = c => (c.armor ? ARMOR_BY_ID[c.armor] : null);

export function ringBonus(c) {
  let best = 0;
  for (const entry of c.items) {
    const it = ITEM_BY_ID[entry.id];
    if (it?.kind === 'ring') best = Math.max(best, it.ac);
  }
  return best; // rings of protection don't stack
}

export function armorClass(c) {
  return 10 + dexAc(c.stats.dex) + (armorOf(c)?.ac ?? 0) - ringBonus(c);
}

export function toHitBonus(c, weapon = weaponOf(c)) {
  return strBonus(c.stats.str).hit + weapon.plus;
}

export function damageBonus(c, weapon = weaponOf(c)) {
  return strBonus(c.stats.str).dmg + weapon.plus;
}

// The d20 roll the character needs to hit a given armor class.
export function rollToHit(c, targetAc, weapon = weaponOf(c)) {
  return thac0(c.level) - targetAc - toHitBonus(c, weapon);
}

export const nextLevelXp = c => (c.level >= MAX_LEVEL ? null : XP_FOR_LEVEL[c.level + 1]);

// Runs a stat change and keeps hit points in step: raising Constitution adds
// the new max hp, lowering it never leaves hp above max.
function changeStats(c, fn) {
  const before = maxHp(c);
  const result = fn();
  const after = maxHp(c);
  if (after > before) c.hp += after - before;
  c.hp = Math.min(c.hp, after);
  return result;
}

export const spendStatPoints = (c, alloc) => changeStats(c, () => spendPoints(c, alloc));
export const readTome = (c, stat) => changeStats(c, () => addTome(c, stat));

// Adds XP and returns any level-ups as [{ level, gain, statPoint }].
export function gainXp(c, xp) {
  c.xp += xp;
  const ups = [];
  while (c.level < MAX_LEVEL && c.xp >= XP_FOR_LEVEL[c.level + 1]) {
    const before = maxHp(c);
    c.level++;
    c.hpRolls.push(c.level <= 9 ? die(HIT_DIE) : HP_AFTER_NINE);
    const gain = maxHp(c) - before;
    c.hp += gain;
    const statPoint = earnsStatPoint(c.level);
    if (statPoint) c.statPoints.push(c.level);
    ups.push({ level: c.level, gain, statPoint });
  }
  return ups;
}

// Level drain. Returns { died } plus whatever stat gain the lost level took
// with it: { lostPoint } for an unspent point, or { lostStat, value }.
export function drainLevel(c) {
  if (c.level <= 1) { c.hp = 0; return { died: true }; }
  const lost = c.level;
  c.level--;
  c.hpRolls.pop();
  c.xp = Math.floor((XP_FOR_LEVEL[c.level] + XP_FOR_LEVEL[c.level + 1]) / 2);
  const taken = revokeLevel(c, lost);
  c.hp = Math.min(c.hp, maxHp(c));
  return { died: false, ...taken };
}

export function heal(c, amount) {
  const before = c.hp;
  c.hp = Math.min(maxHp(c), c.hp + amount);
  return c.hp - before;
}
