// The hex battlefield, where every arena fight takes place. Fights keep every rule from rules/combat.js;
// this module adds positions, movement, and the turn order on the grid.
//
// combat.grid = { radius, pillars: [hex keys], height: { key: level }, terrain: layout id, pos: { uid: { q, r } } }
// (height comes from rules/terrain.js; melee reach and the height modifiers in
// rules/combat.js read it, and so does movement, below)
// combat.turn = { moved, acted, movedHexes, shot } for your turn this round
// combat.thrown, throwPick, handBefore: the weapons you've thrown this fight
// and which kind you'll throw next (rules/ranged.js)
//
// A round on the battlefield:
//   1. You: move (PLAYER_MOVE movement points; see "Movement" below) and act
//      once (attack an adjacent enemy, throw one of your weapons at one in range,
//      or use an item), in either order, then end your turn. After a throw you
//      can only take one step (SHOT_MOVE).
//   2. Each mercenary moves toward your target (or the nearest enemy) and
//      attacks if it ends next to one.
//   3. Each enemy moves toward the nearest fighter on your side and attacks
//      whoever is next to it. Breath still reaches everyone.
//   4. End of round (regeneration, poison, reinforcements), then the next
//      round begins and newcomers are placed at the far edge.

import * as H from '../engine/hex.js';
import { die, roll } from '../engine/dice.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { MERC_BY_ID } from '../data/mercs.js';
import { WEAPON_BY_ID } from '../data/equipment.js';
import { maxHp, moveStats } from './character.js';
import { rangeProfile, throwsLeft } from './ranged.js';
import {
  SHOT_MOVE, BASE_MOVE, CLIMB_COST, CLIMB_MAX, DROP_COST, SAFE_DROP, JUMP_EXTRA, FALL_DIE, conHp, saveTarget,
} from './tables.js';
import { generateTerrain, levelOf, pickTerrain, RANDOM } from './terrain.js';
import {
  startCombat, setTarget, inReach, meleeReach, spawnEnemy, rangedTarget, PLAYER,
  beginRound, playerTurn, allyTurn, enemyTurn, endOfRound,
} from './combat.js';

export const PLAYER_MOVE = BASE_MOVE; // before your Dexterity and armor
export const MERC_MOVE = 4;
// The main game always fights here: pillars, and a layout rolled at random
// each fight. Only the beta's tester controls change it. A field that names
// no terrain is flat.
export const DEFAULT_FIELD = { radius: 5, pillars: true, terrain: RANDOM };

// First guess, tuned in playtests: lower initiative speed moves farther.
export const moveFor = m => Math.max(2, Math.min(8, 6 - Math.round(m.speed / 2)));

const ORIGIN = { q: 0, r: 0 };
const ok = (events = []) => ({ ok: true, events });
const fail = msg => ({ ok: false, msg, events: [] });

// ---- Queries ----

// Movement points per round: yours from your stats and armor.
export function moveOf(state, uid) {
  if (uid === PLAYER) return moveStats(state.character).mp;
  const e = state.combat.enemies.find(x => x.uid === uid);
  return e ? moveFor(MONSTER_BY_ID[e.monsterId]) : MERC_MOVE;
}

// Movement points a fighter has right now: after a ranged attack you only step.
const stepsLeft = (state, uid) => (uid === PLAYER && state.combat.turn?.shot ? SHOT_MOVE : moveOf(state, uid));

export const isPillar = (cb, h) => cb.grid.pillars.includes(H.key(h));
export const onBoard = (cb, h) => H.distance(h, ORIGIN) <= cb.grid.radius && !isPillar(cb, h);
export const boardHexes = cb => H.hexagon(cb.grid.radius);

// Living fighters with positions: [{ uid, side: 'you' | 'ally' | 'enemy' }]
export function livingUnits(state) {
  const cb = state.combat;
  const out = [];
  if (state.character.hp > 0) out.push({ uid: PLAYER, side: 'you' });
  for (const a of cb.allies) if (a.hp > 0) out.push({ uid: a.uid, side: 'ally' });
  for (const e of cb.enemies) if (e.hp > 0) out.push({ uid: e.uid, side: 'enemy' });
  return out.filter(u => cb.grid.pos[u.uid]);
}

export function occupant(state, h) {
  const k = H.key(h);
  return livingUnits(state).find(u => H.key(state.combat.grid.pos[u.uid]) === k)?.uid ?? null;
}

export const passableFor = (state, uid) => h => {
  if (!onBoard(state.combat, h)) return false;
  const who = occupant(state, h);
  return !who || who === uid;
};

// ---- Movement ----
// Movement is a budget of points (moveOf) spent per step:
//   level with you     1
//   up n levels        1 + climbCost × n    (no more than climbMax levels)
//   down n levels      1 + dropCost × n     (no more than safeDrop levels)
// Your numbers come from your Strength, Dexterity and armor (moveStats in
// rules/character.js); mercenaries and monsters use the base numbers until
// their traits are built (todo_terrain.md). The first step of a move is
// always allowed, even if it costs more than the budget, and it ends the move,
// so slow movers are never stuck at the foot of a slope.
//
// Jumping (you only, for now): you may drop up to JUMP_EXTRA levels past your
// safe drop, at the normal cost, taking falling damage (takeFall). A jump is
// always the last step of a move, the hex you chose, never a step along the
// way, so the game never hurts you on a path it picked.

export function moveStatsOf(state, uid) {
  const mp = stepsLeft(state, uid);
  if (uid === PLAYER) return { ...moveStats(state.character), mp };
  return { mp, climbCost: CLIMB_COST, climbMax: CLIMB_MAX, dropCost: DROP_COST, safeDrop: SAFE_DROP };
}

// cost(from, to) for one step of `uid`, Infinity if it can't be taken.
// With jumps, drops of up to JUMP_EXTRA past the safe drop are allowed too.
export function stepCostFor(state, uid, ms = moveStatsOf(state, uid), jumps = false) {
  const grid = state.combat.grid;
  const passable = passableFor(state, uid);
  const deepest = ms.safeDrop + (jumps ? JUMP_EXTRA : 0);
  return (from, to) => {
    if (!passable(to)) return Infinity;
    const rise = levelOf(grid, to) - levelOf(grid, from);
    if (rise > ms.climbMax || -rise > deepest) return Infinity;
    return 1 + (rise > 0 ? ms.climbCost * rise : -rise * ms.dropCost);
  };
}

// Levels a step from `from` to `to` drops past the mover's safe drop (0 if none).
const fallLevels = (state, ms, from, to) =>
  Math.max(0, levelOf(state.combat.grid, from) - levelOf(state.combat.grid, to) - ms.safeDrop);

// Where `uid` can move this turn: a Map of key -> { cost, prev, jump? } (see
// H.pathIn). Includes the start at cost 0, any first step over budget, and,
// for you, hexes you can only reach by ending the move with a jump (jump: the
// levels you'd fall past your safe drop).
export function reachableFor(state, uid) {
  const from = state.combat.grid.pos[uid];
  const ms = moveStatsOf(state, uid);
  const cost = stepCostFor(state, uid, ms);
  const map = H.cheapestReachable(from, ms.mp, cost);
  for (const n of H.neighbors(from)) {
    const c = cost(from, n);
    if (c < Infinity && !map.has(H.key(n))) map.set(H.key(n), { cost: c, prev: from });
  }
  if (uid !== PLAYER) return map;
  const jump = stepCostFor(state, uid, ms, true);
  const landings = new Map();
  for (const [k, v] of map) {
    const at = H.fromKey(k);
    if (v.cost > ms.mp) continue; // an over-budget first step ends the move
    for (const n of H.neighbors(at)) {
      const nk = H.key(n);
      const levels = fallLevels(state, ms, at, n);
      if (map.has(nk) || !levels) continue;
      const total = v.cost + jump(at, n);
      if (total === Infinity || (total > ms.mp && v.prev)) continue; // the first step may still go over budget
      if (!landings.has(nk) || landings.get(nk).cost > total) landings.set(nk, { cost: total, prev: at, jump: levels });
    }
  }
  for (const [k, v] of landings) map.set(k, v);
  return map;
}

// The path `uid` would take to `to` this turn (hexes after its own), or null.
export const pathFor = (state, uid, to) => H.pathIn(reachableFor(state, uid), to);

// Can a fighter of `uid` on hex `from` strike someone on hex `to`? Adjacent and
// within its height reach (the same test as inReach, for hexes not yet occupied).
const canStrike = (cb, uid, from, to) =>
  H.adjacent(from, to) && Math.abs(levelOf(cb.grid, from) - levelOf(cb.grid, to)) <= meleeReach(cb, uid);

// Hexes some enemy could reach this round and then strike from.
export function threatZone(state) {
  const cb = state.combat;
  const zone = new Set();
  for (const u of livingUnits(state).filter(x => x.side === 'enemy')) {
    for (const k of reachableFor(state, u.uid).keys()) {
      const from = H.fromKey(k);
      for (const n of H.neighbors(from)) if (onBoard(cb, n) && canStrike(cb, u.uid, from, n)) zone.add(H.key(n));
    }
  }
  return zone;
}

const foesOf = (state, uid) => livingUnits(state).filter(u => (uid.startsWith('e') ? u.side !== 'enemy' : u.side === 'enemy'));

// ---- Setup ----

// Starting spots: your side along the bottom edge, enemies along the top,
// nearest the middle first.
function freeSpots(state, top) {
  const cb = state.combat;
  return boardHexes(cb)
    .filter(h => onBoard(cb, h) && !occupant(state, h))
    .sort((a, b) => (top ? a.r - b.r : b.r - a.r) || Math.abs(a.q + a.r / 2) - Math.abs(b.q + b.r / 2));
}

// Give every fighter without a position a starting spot.
export function placeNewcomers(state) {
  const cb = state.combat;
  for (const u of [{ uid: PLAYER }, ...cb.allies, ...cb.enemies]) {
    if (cb.grid.pos[u.uid] || (u.uid !== PLAYER && u.hp <= 0)) continue;
    const spot = freeSpots(state, u.uid.startsWith('e'))[0];
    if (spot) cb.grid.pos[u.uid] = spot;
  }
}

// Can a fighter walk from your starting edge to the enemy's under the base
// movement rules (no cliffs up or down, no pillars)? Pillars on the Ledges
// band can otherwise seal it off, and a fight where nobody can reach anybody
// never ends. Stats and traits will only make climbing easier, never harder.
export function crossable(radius, height, pillars) {
  const grid = { height };
  const blocked = new Set(pillars);
  const open = h => H.distance(h, ORIGIN) <= radius && !blocked.has(H.key(h));
  const starts = H.hexagon(radius).filter(h => h.r === radius && open(h));
  const seen = new Set(starts.map(H.key));
  const queue = [...starts];
  while (queue.length) {
    const h = queue.shift();
    if (h.r === -radius) return true;
    for (const n of H.neighbors(h)) {
      const rise = levelOf(grid, n) - levelOf(grid, h);
      if (!open(n) || seen.has(H.key(n)) || rise > CLIMB_MAX || -rise > SAFE_DROP) continue;
      seen.add(H.key(n));
      queue.push(n);
    }
  }
  return false;
}

const DEPLOY_TRIES = 20;

export function deploy(state, field = DEFAULT_FIELD) {
  const cb = state.combat;
  const radius = field.radius ?? DEFAULT_FIELD.radius;
  const terrain = field.terrain === RANDOM ? pickTerrain() : field.terrain ?? 'flat';
  // Terrain first, so pillars can keep clear of the ramps onto raised ground.
  // If the result can't be crossed, roll it again; the last try has no pillars.
  let height, pillars;
  for (let tries = 1; ; tries++) {
    let ramps;
    ({ height, ramps } = generateTerrain(radius, terrain));
    const keepOpen = new Set(ramps.flatMap(k => [k, ...H.neighbors(H.fromKey(k)).map(H.key)]));
    pillars = [];
    if ((field.pillars ?? true) && tries < DEPLOY_TRIES) {
      const candidates = H.hexagon(radius)
        .filter(h => H.distance(h, ORIGIN) >= 1 && Math.abs(h.r) <= radius - 2 && !keepOpen.has(H.key(h)));
      for (let i = 0; i < radius && candidates.length; i++) pillars.push(H.key(candidates.splice(die(candidates.length) - 1, 1)[0]));
    }
    if (tries >= DEPLOY_TRIES || crossable(radius, height, pillars)) break;
  }
  cb.grid = { radius, pillars, height, terrain, pos: {} };
  cb.turn = newTurn();
  placeNewcomers(state);
}

const newTurn = () => ({ moved: false, acted: false, movedHexes: 0, shot: false });

// Start a fight on the battlefield: the normal startCombat, then deployment.
export function startBattle(state, monsterId, crew = {}, field = DEFAULT_FIELD) {
  const r = startCombat(state, monsterId, crew);
  if (!r.ok) return r;
  state.combat.round = 1; // the battlefield starts in round 1, your move
  deploy(state, field);
  return r;
}

// ---- Your turn ----

export function moveYou(state, to) {
  const cb = state.combat;
  if (cb.over) return fail('The fight is over.');
  if (cb.paralyzed > 0) return fail('You are paralyzed and cannot move.');
  if (cb.turn.moved) return fail('You have already moved this round.');
  const reach = reachableFor(state, PLAYER);
  const path = H.pathIn(reach, to);
  if (!path || !path.length) {
    if (cb.turn.shot) return fail('After a throw you can take only one step.');
    const ms = moveStatsOf(state, PLAYER);
    const rise = levelOf(cb.grid, to) - levelOf(cb.grid, cb.grid.pos[PLAYER]);
    if (H.adjacent(to, cb.grid.pos[PLAYER]) && rise > ms.climbMax) {
      return fail(`That's too high: you can climb ${ms.climbMax} level${ms.climbMax === 1 ? '' : 's'} in a step. Find a slope.`);
    }
    if (H.adjacent(to, cb.grid.pos[PLAYER]) && -rise > ms.safeDrop + JUMP_EXTRA) {
      return fail(`That's too far down to jump: at most ${ms.safeDrop + JUMP_EXTRA} levels.`);
    }
    return fail("You can't get there this round.");
  }
  cb.grid.pos[PLAYER] = path.at(-1);
  cb.turn.moved = true;
  cb.turn.movedHexes = path.length;
  const ev = [{ t: 'move', uid: PLAYER, path }];
  const levels = reach.get(H.key(to)).jump;
  if (levels) takeFall(state, levels, ev);
  return ok(ev);
}

// Falling damage for a jump `levels` past your safe drop: FALL_DIE per level,
// less your Constitution hit-point bonus (a penalty adds to it), halved by a
// saving throw against paralysis. A fall never takes you below 1 hp.
export const fallRange = (c, levels) => [Math.max(0, levels - conHp(c.stats.con)), Math.max(0, levels * FALL_DIE - conHp(c.stats.con))];

function takeFall(state, levels, ev) {
  const c = state.character;
  let dmg = Math.max(0, roll(`${levels}d${FALL_DIE}`) - conHp(c.stats.con));
  const saved = die(20) >= saveTarget('paralysis', c.level);
  if (saved) dmg = Math.floor(dmg / 2);
  const before = c.hp;
  c.hp = Math.max(Math.min(c.hp, 1), c.hp - dmg);
  ev.push({ t: 'fall', levels, dmg: before - c.hp, saved, hp: { uid: PLAYER, hp: c.hp } });
}

// action: { type: 'fight', target, ranged? } | { type: 'use', index, target? }
// A fight action strikes your target in melee if you can reach it. If not and
// you have a weapon to throw, you throw it (ranged: true forces a throw).
// Otherwise you strike whoever else is in reach.
export function actYou(state, action) {
  const cb = state.combat;
  if (cb.over) return fail('The fight is over.');
  if (cb.paralyzed > 0) return fail('You are paralyzed and cannot act.');
  if (cb.turn.acted) return fail('You have already acted this round.');
  if (action.target) setTarget(cb, action.target);
  let act = action;
  if (action.type === 'fight') {
    const thrower = state.character.weapons.length > 0;
    const enemies = livingUnits(state).filter(u => u.side === 'enemy');
    const meleeTarget = !action.ranged && inReach(cb, PLAYER, cb.target);
    let shot = thrower && !meleeTarget ? rangeProfile(state, cb.target) : null;
    if (action.ranged && !action.target && !shot?.ok) {
      // A throw with no target named: the nearest enemy you can hit.
      const alt = rangedTarget(state);
      if (alt) { setTarget(cb, alt.uid); shot = rangeProfile(state, alt.uid); }
    }
    if (action.ranged && !shot?.ok) return fail(shot?.reason ?? "You have nothing left to throw.");
    if (shot?.ok) {
      act = { ...action, ranged: true };
    } else if (!meleeTarget && !enemies.some(u => inReach(cb, PLAYER, u.uid))) {
      const besideOnly = enemies.some(u => H.adjacent(cb.grid.pos[PLAYER], cb.grid.pos[u.uid]));
      return fail(besideOnly
        ? 'That enemy is too far above or below you to reach. Find a hex within 1 level of it.'
        : shot ? shot.reason : 'No enemy is within reach. Move next to one first.');
    }
  }
  const ev = [];
  playerTurn(state, act, ev);
  cb.turn.acted = true;
  if (act.ranged) cb.turn.shot = true;
  return ok(ev);
}

// Choose which kind of weapon to throw next (a weapon id), or null to let
// the game choose. Changing your mind doesn't use up your turn.
export function setThrowPick(state, id) {
  if (id && !WEAPON_BY_ID[id]?.throw) return fail("You can't throw that.");
  state.combat.throwPick = id || null;
  return ok([]);
}

// Step toward the nearest foe (preferring `preferUid`), along the cheapest
// path and as far as its movement points go, unless already able to strike
// one. "Toward" means to a hex it can strike from: next to the foe and within
// its height reach.
function advance(state, uid, ev, preferUid = null) {
  const cb = state.combat;
  const from = cb.grid.pos[uid];
  const foes = foesOf(state, uid);
  const preferred = foes.find(f => f.uid === preferUid);
  if (foes.some(f => inReach(cb, uid, f.uid))) {
    // Already engaged; only a mercenary chasing your target moves on.
    if (!preferred || inReach(cb, uid, preferred.uid)) return;
  }
  const strikeSpot = target => h => canStrike(cb, uid, h, target);
  const ms = moveStatsOf(state, uid);
  const cost = stepCostFor(state, uid, ms);
  const options = foes
    .map(f => ({ f, route: H.cheapestPath(from, strikeSpot(cb.grid.pos[f.uid]), cost) }))
    .filter(x => x.route)
    .sort((a, b) => (b.f === preferred) - (a.f === preferred) || a.route.cost - b.route.cost);
  if (!options.length || !options[0].route.path.length) return;
  // Walk as far as the points go; the first step is always allowed.
  const steps = [];
  let spent = 0;
  let at = from;
  for (const h of options[0].route.path) {
    const c = cost(at, h);
    if (steps.length && spent + c > ms.mp) break;
    steps.push(h);
    spent += c;
    at = h;
  }
  cb.grid.pos[uid] = steps.at(-1);
  if (uid === PLAYER) cb.turn.movedHexes = steps.length;
  ev.push({ t: 'move', uid, path: steps });
}

// Let the AI play your turn (tester tool). If you're not yet in melee and
// have a spare weapon to throw, you throw before moving (moving first costs
// accuracy); then you move toward your target and strike, or throw if still
// out of reach.
export function autoYou(state) {
  const cb = state.combat;
  const ev = [];
  if (cb.over || cb.paralyzed > 0) return ok(ev);
  const near = () => livingUnits(state).filter(u => u.side === 'enemy' && inReach(cb, PLAYER, u.uid));
  const tryThrow = () => {
    if (cb.turn.acted || !throwsLeft(state) || near().length) return;
    const r = actYou(state, { type: 'fight', ranged: true });
    if (r.ok) ev.push(...r.events);
  };
  tryThrow();
  if (!cb.turn.moved && !cb.over) {
    advance(state, PLAYER, ev, cb.target);
    cb.turn.moved = true;
  }
  if (!cb.turn.acted && !cb.over) {
    const close = near();
    if (close.length) {
      const target = close.find(u => u.uid === cb.target) ?? close[0];
      ev.push(...actYou(state, { type: 'fight', target: target.uid }).events);
    } else {
      tryThrow();
    }
  }
  return ok(ev);
}

// Everyone else acts, the round ends, and the next one begins.
export function endTurn(state) {
  const cb = state.combat;
  const ev = [];
  if (cb.over) return ok(ev);
  if (cb.paralyzed > 0) playerTurn(state, { type: 'fight' }, ev); // counts the paralysis down

  for (const a of cb.allies) {
    if (cb.over) break;
    if (a.hp <= 0) continue;
    if (a.paralyzed === 0) advance(state, a.uid, ev, cb.target);
    allyTurn(state, a, ev);
  }
  for (const e of cb.enemies.filter(x => x.hp > 0)) {
    if (cb.over) break;
    if (e.hp <= 0) continue;
    advance(state, e.uid, ev);
    enemyTurn(state, e, ev);
  }
  if (!cb.over) endOfRound(state, ev);
  placeNewcomers(state);
  if (!cb.over) {
    beginRound(state, ev);
    placeNewcomers(state);
    cb.turn = newTurn();
  }
  return ok(ev);
}

// ---- Tester tools (beta) ----

export function testerAddEnemy(state, monsterId) {
  const ev = spawnEnemy(state, monsterId);
  placeNewcomers(state);
  return ok(ev);
}

export function testerAddMerc(state, mercId) {
  const cb = state.combat;
  const tier = MERC_BY_ID[mercId];
  const n = cb.allies.length + 1;
  cb.allies.push({ uid: `a${n}`, mercId, name: `${tier.name} ${n} (tester)`, hp: tier.hp, maxHp: tier.hp, paralyzed: 0, poison: 0 });
  cb.hired++;
  placeNewcomers(state);
  return ok([{ t: 'hired', crew: `${tier.name} (tester, free)`, wages: 0 }]);
}

export function testerHeal(state) {
  const c = state.character;
  c.hp = maxHp(c);
  state.combat.paralyzed = 0;
  return ok([]);
}

// Redraw the arena with a new size or pillars; fighters are redeployed.
export function testerRebuild(state, field) {
  deploy(state, field);
  return ok([]);
}
