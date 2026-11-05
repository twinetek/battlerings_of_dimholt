// The hex battlefield (beta). Fights keep every rule from rules/combat.js;
// this module adds positions, movement, and the turn order on the grid.
//
// combat.grid = { radius, pillars: [hex keys], height: { key: level }, pos: { uid: { q, r } } }
// (height comes from rules/terrain.js; melee reach and the height modifiers in
// rules/combat.js read it, movement doesn't yet)
// combat.turn = { moved, acted, movedHexes, shot } for your turn this round
// combat.throwsUsed = throws you've made this fight (rules/ranged.js)
//
// A round on the battlefield:
//   1. You: move up to PLAYER_MOVE hexes and act once (attack an adjacent enemy,
//      throw a thrown weapon at one in range, or use an item), in either order,
//      then end your turn. After a throw you can move only SHOT_MOVE hexes.
//   2. Each mercenary moves toward your target (or the nearest enemy) and
//      attacks if it ends next to one.
//   3. Each enemy moves toward the nearest fighter on your side and attacks
//      whoever is next to it. Breath still reaches everyone.
//   4. End of round (regeneration, poison, reinforcements), then the next
//      round begins and newcomers are placed at the far edge.

import * as H from '../engine/hex.js';
import { die } from '../engine/dice.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { MERC_BY_ID } from '../data/mercs.js';
import { maxHp, weaponOf } from './character.js';
import { rangeProfile } from './ranged.js';
import { SHOT_MOVE } from './tables.js';
import { generateTerrain, levelOf } from './terrain.js';
import {
  startCombat, setTarget, inReach, meleeReach, spawnEnemy, rangedTarget, PLAYER,
  beginRound, playerTurn, allyTurn, enemyTurn, endOfRound,
} from './combat.js';

export const PLAYER_MOVE = 4;
export const MERC_MOVE = 4;
// Terrain stays flat by default until movement and the board use levels
// (see todo_terrain.md).
export const DEFAULT_FIELD = { radius: 5, pillars: true, terrain: 'flat' };

// First guess, tuned in playtests: lower initiative speed moves farther.
export const moveFor = m => Math.max(2, Math.min(8, 6 - Math.round(m.speed / 2)));

const ORIGIN = { q: 0, r: 0 };
const ok = (events = []) => ({ ok: true, events });
const fail = msg => ({ ok: false, msg, events: [] });

// ---- Queries ----

export function moveOf(cb, uid) {
  if (uid === PLAYER) return PLAYER_MOVE;
  const e = cb.enemies.find(x => x.uid === uid);
  return e ? moveFor(MONSTER_BY_ID[e.monsterId]) : MERC_MOVE;
}

// How far a fighter can move right now: after a ranged attack you only step.
const stepsLeft = (cb, uid) => (uid === PLAYER && cb.turn?.shot ? SHOT_MOVE : moveOf(cb, uid));

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

export const reachableFor = (state, uid) =>
  H.reachable(state.combat.grid.pos[uid], stepsLeft(state.combat, uid), passableFor(state, uid));

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

export function deploy(state, field = DEFAULT_FIELD) {
  const cb = state.combat;
  const radius = field.radius ?? DEFAULT_FIELD.radius;
  // Terrain first, so pillars can keep clear of the ramps onto raised ground.
  const { height, ramps } = generateTerrain(radius, field.terrain ?? DEFAULT_FIELD.terrain);
  const keepOpen = new Set(ramps.flatMap(k => [k, ...H.neighbors(H.fromKey(k)).map(H.key)]));
  const pillars = [];
  if (field.pillars ?? true) {
    const candidates = H.hexagon(radius)
      .filter(h => H.distance(h, ORIGIN) >= 1 && Math.abs(h.r) <= radius - 2 && !keepOpen.has(H.key(h)));
    for (let i = 0; i < radius && candidates.length; i++) pillars.push(H.key(candidates.splice(die(candidates.length) - 1, 1)[0]));
  }
  cb.grid = { radius, pillars, height, pos: {} };
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
  const path = H.pathToHex(cb.grid.pos[PLAYER], to, passableFor(state, PLAYER));
  if (!path || !path.length || path.length > stepsLeft(cb, PLAYER)) {
    return fail(cb.turn.shot ? `After a throw you can move only ${SHOT_MOVE} hex.` : "You can't get there this round.");
  }
  cb.grid.pos[PLAYER] = path.at(-1);
  cb.turn.moved = true;
  cb.turn.movedHexes = path.length;
  return ok([{ t: 'move', uid: PLAYER, path }]);
}

// action: { type: 'fight', target, ranged? } | { type: 'use', index, target? }
// A fight action strikes your target in melee if you can reach it. If not and
// you hold a thrown weapon, you throw at it (ranged: true forces a throw).
// Otherwise you strike whoever else is in reach.
export function actYou(state, action) {
  const cb = state.combat;
  if (cb.over) return fail('The fight is over.');
  if (cb.paralyzed > 0) return fail('You are paralyzed and cannot act.');
  if (cb.turn.acted) return fail('You have already acted this round.');
  if (action.target) setTarget(cb, action.target);
  let act = action;
  if (action.type === 'fight') {
    const thrower = !!weaponOf(state.character).ranged;
    const enemies = livingUnits(state).filter(u => u.side === 'enemy');
    const meleeTarget = !action.ranged && inReach(cb, PLAYER, cb.target);
    let shot = thrower && !meleeTarget ? rangeProfile(state, cb.target) : null;
    if (action.ranged && !action.target && !shot?.ok) {
      // A throw with no target named: the nearest enemy you can hit.
      const alt = rangedTarget(state);
      if (alt) { setTarget(cb, alt.uid); shot = rangeProfile(state, alt.uid); }
    }
    if (action.ranged && !shot?.ok) return fail(shot?.reason ?? "Your weapon can't be thrown.");
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

// Step toward the nearest foe (preferring `preferUid`), up to the mover's
// movement, unless already able to strike one. "Toward" means to a hex it can
// strike from: next to the foe and within its height reach.
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
  const options = foes
    .map(f => ({ f, path: H.pathTo(from, strikeSpot(cb.grid.pos[f.uid]), passableFor(state, uid)) }))
    .filter(x => x.path)
    .sort((a, b) => (b.f === preferred) - (a.f === preferred) || a.path.length - b.path.length);
  if (!options.length || !options[0].path.length) return;
  const steps = options[0].path.slice(0, stepsLeft(cb, uid));
  cb.grid.pos[uid] = steps.at(-1);
  if (uid === PLAYER) cb.turn.movedHexes = steps.length;
  ev.push({ t: 'move', uid, path: steps });
}

// Let the AI play your turn (tester tool). A thrower not yet in melee throws
// before moving (moving first costs accuracy); then everyone moves toward
// their target and strikes, or throws if still out of reach.
export function autoYou(state) {
  const cb = state.combat;
  const ev = [];
  if (cb.over || cb.paralyzed > 0) return ok(ev);
  const near = () => livingUnits(state).filter(u => u.side === 'enemy' && inReach(cb, PLAYER, u.uid));
  const tryThrow = () => {
    if (cb.turn.acted || !weaponOf(state.character).ranged || near().length) return;
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
