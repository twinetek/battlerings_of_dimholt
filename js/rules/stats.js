// Stat growth: points earned from leveling, and Tomes.
//
// A character's stats are never edited directly. They are rebuilt from the
// creation roll (baseStats) plus a history of changes (statLog), so a Wight's
// level drain can take back exactly the point that level gave, even when
// Tomes were read in between.
//
//   statPoints  levels whose point is still unspent, e.g. [6, 8]
//   statLog     [{ stat, source: 'level', level }, { stat, source: 'tome' }]
//               entries lost to level drain get revoked: true and are kept
//               for the history list

import { NATURAL_MAX, TOME_MAX, STAT_POINT_EVERY } from './tables.js';

export const earnsStatPoint = level => level > 1 && level % STAT_POINT_EVERY === 0;

export const capFor = source => (source === 'tome' ? TOME_MAX : NATURAL_MAX);

export function recomputeStats(c) {
  const s = { ...c.baseStats };
  for (const e of c.statLog) {
    if (!e.revoked && s[e.stat] < capFor(e.source)) s[e.stat]++;
  }
  c.stats = s;
}

// How many more level points a stat can take.
export const roomToGrow = (c, stat) => Math.max(0, NATURAL_MAX - c.stats[stat]);

// alloc: { str: 2, con: 1 }. Spends the oldest points first, so if a level is
// drained later, it takes an unspent point before undoing a choice.
export function spendPoints(c, alloc) {
  const entries = Object.entries(alloc).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return { ok: false, msg: 'Choose a stat to raise first.' };
  if (total > c.statPoints.length) return { ok: false, msg: "You don't have that many stat points." };
  for (const [stat, n] of entries) {
    if (!(stat in c.stats)) return { ok: false, msg: 'No such stat.' };
    if (n > roomToGrow(c, stat)) return { ok: false, msg: `Training can't raise a stat past ${NATURAL_MAX}.` };
  }
  c.statPoints.sort((a, b) => a - b);
  for (const [stat, n] of entries) {
    for (let i = 0; i < n; i++) c.statLog.push({ stat, source: 'level', level: c.statPoints.shift() });
  }
  recomputeStats(c);
  return { ok: true };
}

export function addTome(c, stat) {
  if (c.stats[stat] >= TOME_MAX) return false;
  c.statLog.push({ stat, source: 'tome' });
  recomputeStats(c);
  return true;
}

// Called when level `level` is drained away. Returns what was lost.
export function revokeLevel(c, level) {
  const unspent = c.statPoints.indexOf(level);
  if (unspent >= 0) {
    c.statPoints.splice(unspent, 1);
    return { lostPoint: true };
  }
  for (let i = c.statLog.length - 1; i >= 0; i--) {
    const e = c.statLog[i];
    if (e.source === 'level' && e.level === level && !e.revoked) {
      e.revoked = true;
      recomputeStats(c);
      return { lostStat: e.stat, value: c.stats[e.stat] };
    }
  }
  return {};
}
