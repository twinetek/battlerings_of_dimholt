// Ranged attacks on the hex battlefield (beta). So far: throwing, by you.
// Any weapon you carry can be thrown; each one is a throw, and a thrown
// weapon stays on the field until the fight ends. The full design (bows,
// crossbows, monsters and mercenaries that shoot) is in Todo_ranged.md;
// DESIGN.md ("Ranged attacks") describes what's built.
//
// A throw's numbers come from two places:
//   throwStats(c, weapon)              the character and weapon, anywhere
//   rangeProfile(state, uid, index)    that, plus the board: distance, height,
//                                      line of sight, cover, and moving first
//
// combat.thrown     indices into character.weapons thrown this fight
// combat.throwPick  the weapon id you chose to throw, or null to let the game
//                   choose (see pickThrow)
// combat.handBefore the weapon you held before throwing it, put back in your
//                   hand after the fight
//
// Range: up to its aim range a throw is at full accuracy and damage. Each hex
// beyond costs 1 to hit and 1/8 of the damage, down to half at the maximum
// range (aim + FALLOFF_HEXES). Nothing here touches the DOM or rolls dice.

import * as H from '../engine/hex.js';
import { WEAPON_BY_ID } from '../data/equipment.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { levelOf, MAX_HEIGHT } from './terrain.js';
import {
  strBonus, dexMissile, strRange, FALLOFF_HEXES, AIM_CAP, HEIGHT_AIM_MAX, COVER_PENALTY, STEADY_DEX,
} from './tables.js';

const YOU = 'you';

// What a character does with a weapon when throwing it, before the board:
// aim range, to-hit and damage bonuses. null if it can't be thrown (fists).
export function throwStats(c, w) {
  const t = w?.throw;
  if (!t) return null;
  return {
    aim: Math.min(AIM_CAP, t.aim + w.plus + strRange(c.stats.str)),
    toHit: dexMissile(c.stats.dex) + w.plus + t.hit,
    dmgBonus: w.plus + strBonus(c.stats.str).dmg,
    steady: c.stats.dex >= STEADY_DEX,
  };
}

// ---- What you have to throw ----

// Your weapons not yet thrown this fight: [{ index, entry, w }].
export function throwable(state) {
  const thrown = state.combat?.thrown ?? [];
  return state.character.weapons
    .map((entry, index) => ({ index, entry, w: WEAPON_BY_ID[entry.id] }))
    .filter(x => x.w?.throw && !thrown.includes(x.index));
}

export const throwsLeft = state => throwable(state).length;

// The same, grouped by kind for the throw picker:
// [{ id, name, count, inHand }], best throwers first.
export function throwGroups(state) {
  const groups = new Map();
  for (const x of throwable(state)) {
    const g = groups.get(x.entry.id) ?? { id: x.entry.id, name: x.w.name, count: 0, inHand: false, w: x.w };
    g.count++;
    if (x.index === state.character.equipped) g.inHand = true;
    groups.set(x.entry.id, g);
  }
  return [...groups.values()].sort(byThrowing).map(({ w, ...g }) => g);
}

// Best thrower first, then the cheaper one (keep the good steel for later).
const byThrowing = (a, b) => (b.w.throw.aim + b.w.throw.hit) - (a.w.throw.aim + a.w.throw.hit)
  || a.w.plus - b.w.plus || a.w.cost - b.w.cost;

// Which weapon (an index into character.weapons) you'd throw at `targetUid`,
// or -1. Your chosen kind if you have one left, a spare before the one in
// your hand. With no choice, the best spare weapon that can hurt the target;
// the game never throws the weapon in your hand unless you choose it.
export function pickThrow(state, targetUid = null) {
  const c = state.character;
  const cb = state.combat;
  const left = throwable(state);
  const spareFirst = (a, b) => (a.index === c.equipped) - (b.index === c.equipped) || a.index - b.index;
  const chosen = left.filter(x => x.entry.id === cb?.throwPick).sort(spareFirst);
  if (chosen.length) return chosen[0].index;
  const enemy = cb?.enemies?.find(e => e.uid === targetUid);
  const need = enemy ? MONSTER_BY_ID[enemy.monsterId].magicReq : 0;
  const spares = left.filter(x => x.index !== c.equipped)
    .sort((a, b) => (b.w.plus >= need) - (a.w.plus >= need) || byThrowing(a, b) || a.index - b.index);
  return spares[0]?.index ?? -1;
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

// Everything about throwing weapon `index` (default: pickThrow) at
// `targetUid` from where you stand:
// { ok, reason, index, distance, aim, max, toHit, dmgMult, dmgBonus, parts }.
// toHit is the whole bonus (stats, range, cover, moving); parts lists each
// piece for tooltips, e.g. [['Dex', 2], ['range', -1]].
export function rangeProfile(state, targetUid, index = pickThrow(state, targetUid)) {
  const c = state.character;
  const cb = state.combat;
  const no = reason => ({ ok: false, reason });
  if (!cb.grid) return no('Throwing needs the battlefield.');
  if (throwsLeft(state) <= 0) return no(c.weapons.length ? "You've thrown every weapon you carry this fight." : 'You have nothing to throw.');
  if (index < 0) return no('The only weapon you have left is the one in your hand. Choose it under Throw to throw it anyway.');
  const w = WEAPON_BY_ID[c.weapons[index]?.id];
  const stats = throwStats(c, w);
  if (!stats || (cb.thrown ?? []).includes(index)) return no("You can't throw that.");
  const from = cb.grid.pos[YOU], to = cb.grid.pos[targetUid];
  if (!from || !to) return no('No such target.');
  const distance = H.distance(from, to);
  const climb = levelOf(cb.grid, from) - levelOf(cb.grid, to); // positive: throwing down
  const heightAim = Math.max(-MAX_HEIGHT, Math.min(HEIGHT_AIM_MAX, climb));
  const aim = Math.max(1, stats.aim + heightAim);
  const max = aim + FALLOFF_HEXES;
  if (distance > max) return no(`Out of range: ${distance} hexes, and you can throw your ${w.name} ${max}.`);
  const sight = lineOfSight(state, from, to);
  if (!sight.clear) return no('Something blocks your line of sight.');

  const over = Math.max(0, distance - aim);
  const moved = cb.turn?.movedHexes ?? 0;
  const movePenalty = stats.steady ? Math.ceil(moved / 2) : moved;
  const parts = [];
  const part = (name, n) => { if (n) parts.push([name, n]); };
  part('Dex', dexMissile(c.stats.dex));
  part('magic', w.plus);
  part('weapon', w.throw.hit);
  part('range', -over);
  part('cover', -COVER_PENALTY * sight.cover);
  part('moved', -movePenalty);
  return {
    ok: true, reason: null, index, distance, aim, max,
    toHit: stats.toHit - over - COVER_PENALTY * sight.cover - movePenalty,
    dmgMult: 1 - 0.5 * over / FALLOFF_HEXES,
    dmgBonus: stats.dmgBonus,
    parts,
  };
}

// Damage for a ranged hit: bonuses first, then the range falloff, at least 1.
export const rangedDamage = (rolled, p) => Math.max(1, Math.floor((rolled + p.dmgBonus) * p.dmgMult));
