// Rule tables, adapted from AD&D for a single fighter. Tune balance here.

export const STATS = [
  ['str', 'Strength'],
  ['int', 'Intelligence'],
  ['wis', 'Wisdom'],
  ['dex', 'Dexterity'],
  ['con', 'Constitution'],
  ['cha', 'Charisma'],
];

// As in the original, only Strength, Dexterity, and Constitution matter,
// and bonuses start at 15.
export function strBonus(s) {
  if (s <= 3) return { hit: -3, dmg: -1 };
  if (s <= 5) return { hit: -2, dmg: -1 };
  if (s <= 7) return { hit: -1, dmg: 0 };
  if (s <= 14) return { hit: 0, dmg: 0 };
  if (s === 15) return { hit: 0, dmg: 1 };
  if (s === 16) return { hit: 1, dmg: 1 };
  if (s === 17) return { hit: 1, dmg: 2 };
  if (s === 18) return { hit: 2, dmg: 3 };
  // 19-25 are only reachable with Tomes.
  return { hit: 2 + Math.ceil((s - 18) / 2), dmg: 3 + (s - 18) }; // 19: +3/+4 ... 25: +6/+10
}

// Armor class adjustment; negative is better.
export function dexAc(d) {
  if (d <= 3) return 4;
  if (d <= 6) return 7 - d;
  if (d <= 14) return 0;
  if (d <= 18) return 14 - d; // 15: -1 ... 18: -4
  return -4 - Math.ceil((d - 18) / 2); // 19: -5 ... 25: -8 (Tomes only)
}

// Extra hit points per level, for levels 1-9.
export function conHp(c) {
  if (c <= 3) return -2;
  if (c <= 6) return -1;
  if (c <= 14) return 0;
  if (c <= 18) return c - 14; // 15: +1 ... 18: +4
  return 4 + Math.ceil((c - 18) / 2); // 19: +5 ... 25: +8 (Tomes only)
}

// XP needed to reach each level (index = level). Gentler than AD&D's
// fighter table, because the only XP source is the arena.
export const XP_FOR_LEVEL = [0, 0, 800, 1800, 3500, 7000, 14000, 26000, 45000, 65000, 90000,
  120000, 155000, 200000, 250000, 310000, 380000, 460000, 540000, 620000, 700000];
export const MAX_LEVEL = XP_FOR_LEVEL.length - 1;

export const FIRST_LEVEL_HP = 10; // a d10 hit die, taken at maximum
export const HIT_DIE = 10;        // rolled for levels 2-9
export const HP_AFTER_NINE = 3;   // flat gain per level from 10 on, no Con bonus

export const thac0 = level => Math.max(1, 21 - level);

// Fighters get 3 attacks every 2 rounds at 7th level, and 2 per round at 13th.
export function attacksThisRound(level, round) {
  if (level >= 13) return 2;
  if (level >= 7) return round % 2 === 0 ? 2 : 1;
  return 1;
}
export const attacksLabel = level => (level >= 13 ? '2' : level >= 7 ? '3/2' : '1');

// Fighter saving throws by level (index 0 = level 1).
const SAVES = {
  paralysis: [14, 14, 13, 13, 11, 11, 10, 10, 8, 8, 7, 7, 5, 5, 4, 4, 3],
  breath:    [17, 17, 16, 16, 13, 13, 12, 12, 9, 9, 8, 8, 5, 5, 4, 4, 4],
};
export function saveTarget(type, level) {
  const t = SAVES[type];
  return t[Math.min(level, t.length) - 1];
}

export const STARTING_GOLD = '5d4';  // times 10
export const INN_PRICE = 2;          // gold per night; one night heals 1 hp, as in the original
export const MAX_WEAPONS = 6;        // from the original
export const MAX_ITEMS = 12;
export const NATURAL_MAX = 18;       // stat points from leveling stop here
export const TOME_MAX = 25;          // Tomes can push a stat this far
export const STAT_POINT_EVERY = 2;   // a stat point at every 2nd level
export const ITEM_SPEED = 3;         // initiative modifier when using an item
export const COMBAT_LOG_LIMIT = 150;
