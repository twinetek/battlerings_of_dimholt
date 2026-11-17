// Ranged attacks on the hex battlefield. So far, by you: throwing, and
// shooting a sling, bow or crossbow. Any melee weapon you carry can be
// thrown; each one is a throw, and a thrown weapon stays on the field until
// the fight ends. A weapon with `ranged` shoots from your hand: a sling never
// runs out of stones; a bow uses arrows and a crossbow bolts (data/equipment.js
// AMMO), one per shot, carried as character.ammo { id: count }.
// The rest of the design (monsters and mercenaries that shoot, and more) is
// in Todo_ranged.md; DESIGN.md ("Ranged attacks") describes what's built.
//
// A shot's numbers come from two places:
//   throwStats(c, weapon)              the character and weapon, anywhere
//   shootStats(c, weapon)              the same for a weapon that shoots
//   rangeProfile(state, uid, index)    that, plus the board: distance, height,
//                                      line of sight, cover, and moving first
//
// combat.thrown     indices into character.weapons thrown this fight
// combat.throwPick  the weapon id you chose to throw, or null to let the game
//                   choose (see pickShot: with a loaded shooter in hand, you shoot it)
// combat.handBefore the weapon you held before throwing it, put back in your
//                   hand after the fight
// combat.ammoOut    { ammo id: count } shot this fight and not broken, gathered
//                   up after it (rules/combat.js recoverThrows)
// combat.ammoBroken { ammo id: count } broken on a hit this fight, for the log
// combat.ammoPick  the ammunition id you chose to shoot, or null to let the
//                   game choose (nextAmmo: plain first, magic if the target needs it)
// combat.reloadReady the round a reloading weapon (`ranged.reload`, the Heavy
//                   Crossbow) can shoot again: set to the round after next by a shot
//
// Range: up to its aim range a throw is at full accuracy and damage. Each hex
// beyond costs 1 to hit and 1/8 of the damage, down to half at the maximum
// range (aim + FALLOFF_HEXES). Nothing here touches the DOM or rolls dice.

import * as H from '../engine/hex.js';
import { WEAPON_BY_ID, AMMO, ENCHANTS } from '../data/equipment.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { levelOf, MAX_HEIGHT } from './terrain.js';
import {
  strBonus, dexMissile, strRange, FALLOFF_HEXES, AIM_CAP, HEIGHT_AIM_MAX, COVER_PENALTY, STEADY_DEX,
  ENGAGED_PENALTY, QUICK_DRAW_DEX, QUICK_DRAW_PENALTY, POINT_BLANK, POINT_BLANK_MIN, PIERCE_AC,
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

// Bows, of either family (point blank and quick draw treat them alike).
export const isBow = w => w?.ranged?.family === 'bow' || w?.ranged?.family === 'composite';

// Points of Strength you lack for a self bow (`strMin`), each -1 to hit and
// -1 aim; 0 for anything else.
export const strShortfall = (c, w) => Math.max(0, (w?.ranged?.strMin ?? 0) - c.stats.str);

// The same for a weapon that shoots (`ranged`), by its family. null otherwise.
//   sling      Strength like a thrown weapon (damage and range), Dex to hit
//   bow        a self bow: Dex to hit; Strength adds nothing, but below its
//              `strMin` each point lacking is -1 to hit and -1 aim
//   composite  Dex to hit; Strength's damage and range bonus up to its
//              `pull` (min(Str, pull)), never below 0
//   crossbow   half Dex's missile bonus (rounded toward 0); Strength adds nothing
// All add magic and the weapon's own `hit`. shortfall: see strShortfall.
export function shootStats(c, w) {
  const r = w?.ranged;
  if (!r) return null;
  const str = r.family === 'sling' ? c.stats.str : r.family === 'composite' ? Math.min(c.stats.str, r.pull) : null;
  const dex = dexMissile(c.stats.dex);
  const shortfall = strShortfall(c, w);
  return {
    aim: Math.max(1, Math.min(AIM_CAP, r.aim + w.plus + (str !== null ? strRange(str) : 0)) - shortfall),
    toHit: (r.family === 'crossbow' ? Math.trunc(dex / 2) : dex) + w.plus + (r.hit ?? 0) - shortfall,
    dmgBonus: w.plus + (str === null ? 0 : r.family === 'composite' ? Math.max(0, strBonus(str).dmg) : strBonus(str).dmg),
    steady: c.stats.dex >= STEADY_DEX,
    shortfall,
  };
}

// How well a weapon flies, shot or thrown. null for fists.
export const rangedStats = (c, w) => shootStats(c, w) ?? throwStats(c, w);

// The weapon in your hand if it shoots, else null.
export function shooterInHand(state) {
  const c = state.character;
  const w = c.equipped >= 0 ? WEAPON_BY_ID[c.weapons[c.equipped]?.id] : null;
  return w?.ranged ? w : null;
}

// ---- Ammunition ----

// The ammunition kinds a weapon shoots, cheapest (plain) first.
export const ammoKinds = w => (w?.ranged?.ammo ? AMMO.filter(a => a.for === w.ranged.ammo) : []);
// Does it run out? A sling's plain stones never do.
export const needsAmmo = w => !!w?.ranged?.ammo && !w.ranged.unlimited;
// How many shots you have for it: Infinity for a sling.
export const ammoLeft = (c, w) => (needsAmmo(w) ? ammoKinds(w).reduce((n, a) => n + (c.ammo?.[a.id] ?? 0), 0) : Infinity);
// The kinds you carry for it: [{ a, count }], cheapest first.
export const ammoCarried = (c, w) => ammoKinds(w).map(a => ({ a, count: c.ammo?.[a.id] ?? 0 })).filter(x => x.count > 0);

// The kind the next shot uses, or null for a plain sling stone (or nothing
// left): the kind you picked if you have one; else the cheapest you carry that
// can hurt a target needing magic `need` (plain stones count as the sling's own
// plus); else the cheapest you carry.
export function nextAmmo(c, w, pick = null, need = 0) {
  const have = ammoCarried(c, w).map(x => x.a);
  const chosen = have.find(a => a.id === pick);
  if (chosen) return chosen;
  const hurts = a => w.plus + (a?.plus ?? 0) >= need;
  if (w.ranged?.unlimited && hurts(null)) return null;
  return have.find(hurts) ?? (w.ranged?.unlimited ? null : have[0] ?? null);
}

// What an enchantment does (data/equipment.js ENCHANTS), or {} for plain ammunition.
export const enchantOf = a => (a?.enchant ? ENCHANTS[a.enchant] : {});

// The weapon in your hand if it can shoot right now (a sling, or a bow or
// crossbow with ammunition), else null.
export function readyShooter(state) {
  const w = shooterInHand(state);
  return w && ammoLeft(state.character, w) > 0 && !reloading(state) ? w : null;
}

// Is the weapon in your hand still reloading (a Heavy Crossbow shot last round)?
export function reloading(state) {
  const w = shooterInHand(state);
  const cb = state.combat;
  return !!w?.ranged.reload && !!cb && (cb.reloadReady ?? 0) > cb.round;
}

// "Reloading: your Heavy Crossbow is ready again next round."
export const reloadReason = w => `Reloading: your ${w.name} is ready again next round.`;

// ---- What you have to throw ----

// Your weapons not yet thrown this fight: [{ index, entry, w }].
export function throwable(state) {
  const thrown = state.combat?.thrown ?? [];
  return state.character.weapons
    .map((entry, index) => ({ index, entry, w: WEAPON_BY_ID[entry.id] }))
    .filter(x => x.w?.throw && !thrown.includes(x.index));
}

export const throwsLeft = state => throwable(state).length;

// Anything to shoot or throw this fight?
export const canShoot = state => !!readyShooter(state) || throwsLeft(state) > 0;

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

// What a ranged attack at `targetUid` uses (an index into character.weapons),
// or -1: the kind you chose to throw, if you have one left; else the weapon
// in your hand if it can shoot (readyShooter); else pickThrow's best spare.
export function pickShot(state, targetUid = null) {
  const pick = state.combat?.throwPick;
  if (pick && throwable(state).some(x => x.entry.id === pick)) return pickThrow(state, targetUid);
  if (readyShooter(state)) return state.character.equipped;
  return pickThrow(state, targetUid);
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

// Is a living enemy beside you?
export function engaged(state) {
  const cb = state.combat;
  const me = cb.grid?.pos[YOU];
  return !!me && cb.enemies.some(e => e.hp > 0 && cb.grid.pos[e.uid] && H.adjacent(me, cb.grid.pos[e.uid]));
}

// The shooting modifiers for weapon `w` shot (never thrown) at a target
// `distance` hexes away with armor class `ac`, with full-power range `aim`:
// { engaged, pointBlank, pierce }, each a to-hit change (pointBlank adds damage too).
//   engaged     an enemy beside you: -ENGAGED_PENALTY; from Dex QUICK_DRAW_DEX,
//               -QUICK_DRAW_PENALTY with a bow (either family) or sling (not a crossbow)
//   pointBlank  a bow (either family) or crossbow, not engaged, the target within half the
//               full-power range (rounded up, at least POINT_BLANK_MIN): +POINT_BLANK
//   pierce      the weapon's `pierce` against AC PIERCE_AC or better
export function shotMods(c, w, { isEngaged, distance, aim, ac }) {
  const r = w.ranged;
  const quick = c.stats.dex >= QUICK_DRAW_DEX && r.family !== 'crossbow';
  const close = Math.max(POINT_BLANK_MIN, Math.ceil(aim / 2));
  return {
    engaged: isEngaged ? -(quick ? QUICK_DRAW_PENALTY : ENGAGED_PENALTY) : 0,
    pointBlank: !isEngaged && (isBow(w) || r.family === 'crossbow') && distance <= close ? POINT_BLANK : 0,
    pierce: ac <= PIERCE_AC ? (r.pierce ?? 0) : 0,
  };
}

// Everything about throwing weapon `index` (default: pickShot), or shooting
// it if it's the shooter in your hand (shoot: true), at `targetUid` from
// where you stand:
// { ok, reason, index, shoot, ammo, magic, distance, aim, max, toHit, dmgMult, dmgBonus, parts }.
// Shots (not throws) add the shooting modifiers (shotMods).
// ammo: the AMMO kind the shot uses, or null (a plain sling stone, or a throw).
// Its +1 adds to hit and damage; a seeking one ignores the range, cover and
// moving-first penalties to hit. magic: the weapon's plus plus the ammunition's,
// for monsters only magic can hurt.
// toHit is the whole bonus (stats, range, cover, moving); parts lists each
// piece for tooltips, e.g. [['Dex', 2], ['range', -1]].
export function rangeProfile(state, targetUid, index = pickShot(state, targetUid)) {
  const c = state.character;
  const cb = state.combat;
  const no = reason => ({ ok: false, reason });
  if (!cb.grid) return no('Ranged attacks need the battlefield.');
  const w = WEAPON_BY_ID[c.weapons[index]?.id];
  const shoot = index >= 0 && index === c.equipped && !!w?.ranged;
  if (shoot && reloading(state)) return no(reloadReason(w));
  if (!shoot) {
    const empty = shooterInHand(state);
    if (throwsLeft(state) <= 0 && empty && reloading(state)) return no(`${reloadReason(empty)} You have nothing to throw.`);
    if (throwsLeft(state) <= 0 && empty && needsAmmo(empty)) {
      return no(`You're out of ${ammoKinds(empty)[0].plural.toLowerCase()} for your ${empty.name}, and have nothing to throw.`);
    }
    if (throwsLeft(state) <= 0) return no(c.weapons.length ? "You've thrown every weapon you carry this fight." : 'You have nothing to throw.');
    if (index < 0) return no('The only weapon you have left is the one in your hand. Choose it under Throw to throw it anyway.');
  }
  const target = cb.enemies.find(e => e.uid === targetUid);
  const need = target ? MONSTER_BY_ID[target.monsterId].magicReq : 0;
  const ammo = shoot ? nextAmmo(c, w, cb.ammoPick, need) : null;
  if (shoot && needsAmmo(w) && !ammo) return no(`You're out of ${ammoKinds(w)[0].plural.toLowerCase()} for your ${w.name}.`);
  const stats = shoot ? shootStats(c, w) : throwStats(c, w);
  if (!stats || (!shoot && (cb.thrown ?? []).includes(index))) return no("You can't throw that.");
  const from = cb.grid.pos[YOU], to = cb.grid.pos[targetUid];
  if (!from || !to) return no('No such target.');
  const distance = H.distance(from, to);
  const climb = levelOf(cb.grid, from) - levelOf(cb.grid, to); // positive: throwing down
  const heightAim = Math.max(-MAX_HEIGHT, Math.min(HEIGHT_AIM_MAX, climb));
  const aim = Math.max(1, stats.aim + heightAim);
  const max = aim + FALLOFF_HEXES;
  if (distance > max) return no(`Out of range: ${distance} hexes, and you can ${shoot ? 'shoot' : 'throw'} your ${w.name} ${max}.`);
  const sight = lineOfSight(state, from, to);
  if (!sight.clear) return no('Something blocks your line of sight.');

  const over = Math.max(0, distance - aim);
  const seeking = !!enchantOf(ammo).seeking;
  const mods = shoot
    ? shotMods(c, w, { isEngaged: engaged(state), distance, aim, ac: target ? MONSTER_BY_ID[target.monsterId].ac : 10 })
    : { engaged: 0, pointBlank: 0, pierce: 0 };
  const moved = cb.turn?.movedHexes ?? 0;
  const movePenalty = seeking ? 0 : stats.steady ? Math.ceil(moved / 2) : moved;
  const rangePenalty = seeking ? 0 : over;
  const coverPenalty = seeking ? 0 : COVER_PENALTY * sight.cover;
  const ammoPlus = ammo?.plus ?? 0;
  const parts = [];
  const part = (name, n) => { if (n) parts.push([name, n]); };
  const dex = dexMissile(c.stats.dex);
  part('Dex', shoot && w.ranged.family === 'crossbow' ? Math.trunc(dex / 2) : dex);
  part('magic', w.plus);
  part(ammo ? ammo.name.toLowerCase() : 'ammunition', ammoPlus);
  part('too weak', shoot ? -stats.shortfall : 0);
  part('weapon', shoot ? (w.ranged.hit ?? 0) : w.throw.hit);
  part('range', -rangePenalty);
  part('cover', -coverPenalty);
  part('moved', -movePenalty);
  part('engaged', mods.engaged);
  part('point blank', mods.pointBlank);
  part('pierce', mods.pierce);
  return {
    ok: true, reason: null, index, shoot, ammo: ammo?.id ?? null, magic: w.plus + ammoPlus, distance, aim, max,
    toHit: stats.toHit + ammoPlus - rangePenalty - coverPenalty - movePenalty + mods.engaged + mods.pointBlank + mods.pierce,
    dmgMult: 1 - 0.5 * over / FALLOFF_HEXES,
    dmgBonus: stats.dmgBonus + ammoPlus + mods.pointBlank,
    parts,
  };
}

// Damage for a ranged hit: bonuses first, then the range falloff, at least 1.
export const rangedDamage = (rolled, p) => Math.max(1, Math.floor((rolled + p.dmgBonus) * p.dmgMult));
