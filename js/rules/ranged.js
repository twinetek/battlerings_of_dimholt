// Ranged attacks on the hex battlefield (beta). So far: thrown weapons, by
// you. The full design (bows, crossbows, monsters and mercenaries that shoot)
// is in Todo_ranged.md; DESIGN.md ("Ranged attacks") describes what's built.
//
// A shot's numbers come from two places:
//   rangedStats(c, weapon)       the character and weapon, anywhere
//   rangeProfile(state, uid)     that, plus the board: distance, height,
//                                line of sight, cover, and moving first
//
// Range: up to its aim range a throw is at full accuracy and damage. Each hex
// beyond costs 1 to hit and 1/8 of the damage, down to half at the maximum
// range (aim + FALLOFF_HEXES). Nothing here touches the DOM or rolls dice.

import * as H from '../engine/hex.js';
import { levelOf, MAX_HEIGHT } from './terrain.js';
import { weaponOf } from './character.js';
import {
  strBonus, dexMissile, strRange, FALLOFF_HEXES, AIM_CAP, HEIGHT_AIM_MAX, COVER_PENALTY, STEADY_DEX,
} from './tables.js';

const YOU = 'you';

// What a character does with a ranged weapon, before the board: aim range,
// to-hit and damage bonuses, and throws per fight. null for melee weapons.
export function rangedStats(c, w = weaponOf(c)) {
  const r = w.ranged;
  if (!r) return null;
  const thrown = r.family === 'thrown';
  return {
    aim: Math.min(AIM_CAP, r.aim + w.plus + (thrown ? strRange(c.stats.str) : 0)),
    toHit: dexMissile(c.stats.dex) + w.plus + (r.hit ?? 0),
    dmgBonus: w.plus + (thrown ? strBonus(c.stats.str).dmg : 0),
    throws: r.throws ?? Infinity,
    steady: c.stats.dex >= STEADY_DEX,
  };
}

export function throwsLeft(state) {
  const s = rangedStats(state.character);
  return s ? Math.max(0, s.throws - (state.combat?.throwsUsed ?? 0)) : 0;
}

// ---- Line of sight ----
// The line runs from the shooter's eye to the target's body, both half a
// level above their hexes. A pillar on it, or ground higher than it, blocks
// the shot. A fighter in between gives cover if its body (1 level tall)
// reaches the line, so from high ground you shoot over heads.

function occupants(state) {
  const cb = state.combat;
  const map = new Map();
  const add = (uid, alive) => { if (alive && cb.grid.pos[uid]) map.set(H.key(cb.grid.pos[uid]), uid); };
  add(YOU, state.character.hp > 0);
  for (const a of cb.allies) add(a.uid, a.hp > 0);
  for (const e of cb.enemies) add(e.uid, e.hp > 0);
  return map;
}

function traceLine(state, from, to, nudge, who) {
  const grid = state.combat.grid;
  const hexes = H.line(from, to, nudge);
  const n = hexes.length - 1;
  const eye = levelOf(grid, from) + 0.5, aimAt = levelOf(grid, to) + 0.5;
  let cover = 0;
  for (let i = 1; i < n; i++) {
    const h = hexes[i];
    const k = H.key(h);
    const lineH = eye + (aimAt - eye) * (i / n);
    if (grid.pillars.includes(k) || levelOf(grid, h) > lineH) return { clear: false, cover: 0 };
    if (who.has(k) && levelOf(grid, h) + 1 > lineH) cover++;
  }
  return { clear: true, cover };
}

// { clear, cover }: clear if either way of drawing an edge-hugging line is
// clear (generous to the shooter); cover from the clearer of the two.
export function lineOfSight(state, from, to) {
  const who = occupants(state);
  who.delete(H.key(from));
  who.delete(H.key(to));
  const lines = [traceLine(state, from, to, 1, who), traceLine(state, from, to, -1, who)].filter(l => l.clear);
  if (!lines.length) return { clear: false, cover: 0 };
  return { clear: true, cover: Math.min(...lines.map(l => l.cover)) };
}

// ---- The shot ----

// Everything about your ranged attack at `targetUid` from where you stand:
// { ok, reason, distance, aim, max, toHit, dmgMult, dmgBonus, parts }.
// toHit is the whole bonus (stats, range, cover, moving); parts lists each
// piece for tooltips, e.g. [['Dex', 2], ['range', -1]].
export function rangeProfile(state, targetUid) {
  const c = state.character;
  const cb = state.combat;
  const stats = rangedStats(c);
  const no = reason => ({ ok: false, reason });
  if (!stats) return no('Your weapon can\'t be thrown.');
  if (!cb.grid) return no('Throwing needs the battlefield.');
  if (throwsLeft(state) <= 0) return no(`You've thrown all your ${weaponOf(c).ranged.thing}s this fight.`);
  const from = cb.grid.pos[YOU], to = cb.grid.pos[targetUid];
  if (!from || !to) return no('No such target.');
  const distance = H.distance(from, to);
  const climb = levelOf(cb.grid, from) - levelOf(cb.grid, to); // positive: throwing down
  const heightAim = Math.max(-MAX_HEIGHT, Math.min(HEIGHT_AIM_MAX, climb));
  const aim = Math.max(1, stats.aim + heightAim);
  const max = aim + FALLOFF_HEXES;
  if (distance > max) return no(`Out of range: ${distance} hexes, and you can throw ${max}.`);
  const sight = lineOfSight(state, from, to);
  if (!sight.clear) return no('Something blocks your line of sight.');

  const over = Math.max(0, distance - aim);
  const moved = cb.turn?.movedHexes ?? 0;
  const movePenalty = stats.steady ? Math.ceil(moved / 2) : moved;
  const parts = [];
  const part = (name, n) => { if (n) parts.push([name, n]); };
  part('Dex', dexMissile(c.stats.dex));
  part('magic', weaponOf(c).plus);
  part('weapon', weaponOf(c).ranged.hit ?? 0);
  part('range', -over);
  part('cover', -COVER_PENALTY * sight.cover);
  part('moved', -movePenalty);
  return {
    ok: true, reason: null, distance, aim, max,
    toHit: stats.toHit - over - COVER_PENALTY * sight.cover - movePenalty,
    dmgMult: 1 - 0.5 * over / FALLOFF_HEXES,
    dmgBonus: stats.dmgBonus,
    parts,
  };
}

// Damage for a ranged hit: bonuses first, then the range falloff, at least 1.
export const rangedDamage = (rolled, p) => Math.max(1, Math.floor((rolled + p.dmgBonus) * p.dmgMult));
