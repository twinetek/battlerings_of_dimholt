// Arena combat. It plays one round at a time and returns a list of event
// objects describing what happened. The rules never touch the screen: a
// presenter turns events into text now, and can turn them into animations
// later without changing anything here.
//
// A fight is your side (you, plus any hired mercenaries) against one or more
// enemies: the opponent you chose, plus any help it summons. A solo fight
// against one monster plays exactly like the original Darkwood.
//
// Round sequence:
//   1. Reinforcements announced last round arrive.
//   2. Initiative: d10 + your weapon speed against d10 + the lead enemy's
//      speed; lower goes first. Each side then acts as a group: you first,
//      then your mercenaries in order; or each enemy in order.
//   3. After every blow, check who has fallen.
//   4. End of round: regeneration, poison (enemies, you, mercenaries), then
//      the reinforcement check.
//
// Every unit has a uid: 'you', allies 'a1', 'a2' ..., enemies 'e1', 'e2' ...
// Events that change hit points carry hp: { uid, hp } (or a list in hits[])
// so a presenter can update the right bar.

import { roll, die, random } from '../engine/dice.js';
import { MONSTERS, MONSTER_BY_ID } from '../data/monsters.js';
import { ITEM_BY_ID } from '../data/equipment.js';
import { MERCS, MERC_BY_ID, MERC_NAMES, crewCost, crewText } from '../data/mercs.js';
import { attacksThisRound, saveTarget, strBonus, ITEM_SPEED } from './tables.js';
import { weaponOf, weaponEntry, armorClass, rollToHit, gainXp, drainLevel, heal } from './character.js';
import { rollLoot, liveCoatings, venomName } from './loot.js';
import { LOOT_BY_ID } from '../data/loot.js';
import { exposeToPoison, notePoisonDamage, sweatOut, curePoison } from './poison.js';

export const PLAYER = 'you';
export const SUMMON_CHANCE_PER_MERC = 0.1;
export const SUMMON_CHANCE_MAX = 0.5;
export const ARENA_STEP_DOWN = 3; // the arena master sends a creature this many places weaker

const living = list => list.filter(u => u.hp > 0);
export const mainEnemy = cb => cb.enemies.find(e => e.main);

// ---- Setup ----

function addEnemy(cb, monsterId, opts = {}) {
  const m = MONSTER_BY_ID[monsterId];
  const hp = m.hpFixed ?? Math.max(1, roll(m.hp));
  const sameKind = cb.enemies.filter(e => e.monsterId === monsterId).length;
  cb.nextEnemy++;
  const e = {
    uid: `e${cb.nextEnemy}`, monsterId, name: sameKind ? `${m.name} ${sameKind + 1}` : m.name,
    hp, maxHp: hp, breathLeft: m.breath?.uses ?? 0, regenBlocked: false, poison: 0,
    main: !!opts.main, summoned: !!opts.summoned, killedBy: null,
  };
  cb.enemies.push(e);
  return e;
}

function pickNames(count) {
  const pool = [...MERC_NAMES];
  const names = [];
  for (let i = 0; i < count; i++) {
    if (!pool.length) pool.push(...MERC_NAMES);
    names.push(pool.splice(die(pool.length) - 1, 1)[0]);
  }
  return names;
}

// crew: { militia: 2, veteran: 1 }. Wages are paid now and never refunded.
export function startCombat(state, monsterId, crew = {}) {
  const c = state.character;
  const wages = crewCost(crew);
  if (wages > c.gold) return { ok: false, msg: "You can't afford those wages." };
  c.gold -= wages;
  const cb = {
    monsterId,                          // the opponent you chose
    round: 0,
    paralyzed: 0,                       // your turns left to skip
    over: false, result: null, cause: null, // result: victory | death | surrender
    enemies: [], allies: [], nextEnemy: 0,
    hired: 0, wages, crew: { ...crew },
    target: null,                       // uid of the enemy you're attacking
    summon: { halfDone: false, pending: 0 },
    log: [],
  };
  state.combat = cb;
  state.arenaVisit = true; // leaving the Battlerings later ends the visit (one clock tick)
  cb.target = addEnemy(cb, monsterId, { main: true }).uid;

  const tiers = MERCS.flatMap(m => Array(crew[m.id] || 0).fill(m));
  const names = pickNames(tiers.length);
  tiers.forEach((m, i) => {
    cb.allies.push({ uid: `a${i + 1}`, mercId: m.id, name: `${m.name} ${names[i]}`, hp: m.hp, maxHp: m.hp, paralyzed: 0, poison: 0 });
  });
  cb.hired = tiers.length;
  return { ok: true };
}

// Opening events for the log (the rules never write text themselves).
export function openingEvents(state) {
  const cb = state.combat;
  const ev = [{ t: 'start', foe: MONSTER_BY_ID[cb.monsterId].name }];
  if (cb.hired) ev.push({ t: 'hired', crew: crewText(cb.crew), wages: cb.wages });
  if (state.character.poison > 0) ev.push({ t: 'poisonCarried', strength: state.character.poison });
  return ev;
}

export const canHurt = (c, m) => weaponOf(c).plus >= m.magicReq;

export function headsLeft(e, m) {
  return Math.max(1, Math.ceil(e.hp / (e.maxHp / m.special.heads)));
}

export function setTarget(cb, uid) {
  const e = cb.enemies.find(x => x.uid === uid && x.hp > 0);
  if (e) cb.target = e.uid;
  return !!e;
}

function currentTarget(cb) {
  let t = cb.enemies.find(e => e.uid === cb.target && e.hp > 0);
  if (!t) {
    t = living(cb.enemies).find(e => e.main) ?? living(cb.enemies)[0];
    if (t) cb.target = t.uid;
  }
  return t;
}

// ---- The round ----

// action: { type: 'fight' } | { type: 'use', index } | { type: 'surrender' }
export function playRound(state, action) {
  const c = state.character;
  const cb = state.combat;
  if (!cb || cb.over) return [];
  const ev = [];

  if (action.type === 'surrender') {
    const fine = Math.min(c.gold, MONSTER_BY_ID[cb.monsterId].fine);
    c.gold -= fine;
    finish(cb, 'surrender');
    ev.push({ t: 'surrender', fine, crew: cb.hired > 0 });
    afterFight(state, ev);
    return ev;
  }

  cb.round++;
  ev.push({ t: 'round', n: cb.round });
  while (cb.summon.pending > 0) {
    cb.summon.pending--;
    summon(state, ev);
  }

  let playerFirst = false;
  if (cb.paralyzed === 0) {
    const lead = living(cb.enemies).find(e => e.main) ?? living(cb.enemies)[0];
    const speed = action.type === 'use' ? ITEM_SPEED : weaponOf(c).speed;
    playerFirst = die(10) + speed <= die(10) + MONSTER_BY_ID[lead.monsterId].speed;
  }
  ev.push({ t: 'initiative', first: playerFirst ? 'player' : 'monster' });

  const turns = playerFirst ? [partyTurn, enemiesTurn] : [enemiesTurn, partyTurn];
  for (const turn of turns) {
    if (cb.over) break;
    turn(state, action, ev);
  }
  if (!cb.over) endOfRound(state, ev);
  return ev;
}

// ---- Your side ----

function partyTurn(state, action, ev) {
  const cb = state.combat;
  playerTurn(state, action, ev);
  for (const a of cb.allies) {
    if (cb.over) return;
    if (a.hp > 0) allyTurn(state, a, ev);
  }
}

function playerTurn(state, action, ev) {
  const c = state.character;
  const cb = state.combat;
  if (cb.paralyzed > 0) {
    cb.paralyzed--;
    ev.push({ t: 'paralyzedSkip', you: true });
    return;
  }
  if (action.type === 'use') {
    useItem(state, action.index, ev);
    return;
  }
  const w = weaponOf(c);
  const swings = attacksThisRound(c.level, cb.round);
  for (let i = 0; i < swings && !cb.over; i++) {
    const e = currentTarget(cb);
    const m = MONSTER_BY_ID[e.monsterId];
    if (w.plus < m.magicReq) {
      ev.push({ t: 'immune', weapon: w.name, req: m.magicReq, target: e.name });
      return;
    }
    const need = rollToHit(c, m.ac, w);
    const r = die(20);
    const hit = r === 20 || (r !== 1 && r >= need);
    if (!hit) {
      ev.push({ t: 'attack', by: 'player', hit: false, weapon: w.name, target: e.name });
      continue;
    }
    const dmg = Math.max(1, roll(w.dmg) + strBonus(c.stats.str).dmg + w.plus);
    hurtEnemy(state, e, dmg, ev, { t: 'attack', by: 'player', hit: true, weapon: w.name }, PLAYER);
    if (e.hp > 0) envenom(state, e, ev);
  }
}

// Monsters save against poison like a fighter of level 21 - THAC0.
export const monsterSaveLevel = m => Math.max(1, 21 - m.thac0);

// Each live coating on your weapon gets its own chance to poison the enemy
// you just hit. Undead and earth creatures are immune, and no monster can be
// poisoned by its own kind's venom.
function envenom(state, e, ev) {
  const coatings = liveCoatings(state, weaponEntry(state.character));
  if (!coatings.length) return;
  const m = MONSTER_BY_ID[e.monsterId];
  if (m.immune.includes('poison')) {
    if (!e.toldImmune) ev.push({ t: 'venomImmune', target: e.name });
    e.toldImmune = true;
    return;
  }
  const results = [];
  for (const ct of coatings) {
    const venom = venomName(ct.source);
    if (ct.source === e.monsterId) {
      if (!e.toldOwn) results.push({ venom, outcome: 'own' });
      e.toldOwn = true;
      continue;
    }
    if (die(20) >= saveTarget('poison', monsterSaveLevel(m))) {
      results.push({ venom, outcome: 'resisted' });
      continue;
    }
    e.poison = e.poison > 0 ? Math.max(e.poison, ct.now) + 1 : ct.now;
    results.push({ venom, outcome: 'takes' });
  }
  if (results.length) ev.push({ t: 'venom', target: e.name, results, strength: e.poison });
}

const resisted = (m, type, dmg) => (m.resist.includes(type) ? Math.ceil(dmg / 2) : dmg);

function allyTurn(state, a, ev) {
  const cb = state.combat;
  const tier = MERC_BY_ID[a.mercId];
  if (a.paralyzed > 0) {
    a.paralyzed--;
    ev.push({ t: 'paralyzedSkip', actor: a.name });
    return;
  }
  const swings = attacksThisRound(tier.level, cb.round);
  for (let i = 0; i < swings && !cb.over; i++) {
    const e = currentTarget(cb); // mercenaries follow your lead
    const m = MONSTER_BY_ID[e.monsterId];
    if (tier.weapon.plus < m.magicReq) {
      ev.push({ t: 'allyImmune', actor: a.name, target: e.name });
      return;
    }
    const need = tier.thac0 - m.ac - tier.weapon.plus;
    const r = die(20);
    const hit = r === 20 || (r !== 1 && r >= need);
    if (!hit) {
      ev.push({ t: 'attack', by: 'ally', hit: false, actor: a.name, target: e.name });
      continue;
    }
    const dmg = Math.max(1, roll(tier.weapon.dmg) + tier.weapon.plus + tier.dmgBonus);
    hurtEnemy(state, e, dmg, ev, { t: 'attack', by: 'ally', hit: true, actor: a.name }, a.uid);
  }
}

function useItem(state, index, ev) {
  const c = state.character;
  const cb = state.combat;
  const entry = c.items[index];
  const it = entry && ITEM_BY_ID[entry.id];
  if (!it || (it.use !== 'combat' && it.use !== 'any')) {
    ev.push({ t: 'fumble' });
    return;
  }
  if (it.heal) {
    c.items.splice(index, 1);
    const amount = heal(c, roll(it.heal));
    ev.push({ t: 'heal', item: it.name, amount, hp: { uid: PLAYER, hp: c.hp } });
    return;
  }
  if (it.cure) {
    c.items.splice(index, 1);
    ev.push({ t: 'cured', item: it.name, had: curePoison(c) });
    return;
  }
  // Damage items: potions are used up, wands spend a charge.
  if (it.charges) {
    entry.charges--;
    if (entry.charges <= 0) c.items.splice(index, 1);
  } else {
    c.items.splice(index, 1);
  }
  const e = currentTarget(cb);
  const m = MONSTER_BY_ID[e.monsterId];
  if (it.dtype === 'fire' && m.special.regen) e.regenBlocked = true;
  if (m.immune.includes(it.dtype)) {
    ev.push({ t: 'itemImmune', item: it.name, dtype: it.dtype, target: e.name });
  } else {
    hurtEnemy(state, e, resisted(m, it.dtype, roll(it.damage)), ev, { t: 'itemHit', item: it.name, verb: it.verb }, PLAYER);
  }
  if (it.charges && entry.charges <= 0) ev.push({ t: 'wandEmpty', item: it.name });
}

function hurtEnemy(state, e, dmg, ev, event, killer) {
  const cb = state.combat;
  const m = MONSTER_BY_ID[e.monsterId];
  const headsBefore = m.special.heads ? headsLeft(e, m) : 0;
  e.hp = Math.max(0, e.hp - dmg);
  Object.assign(event, { dmg, target: e.name, hp: { uid: e.uid, hp: e.hp } });
  ev.push(event);
  if (e.hp <= 0) {
    e.killedBy = killer;
    ev.push({ t: 'enemyDown', name: e.name, crowd: cb.enemies.length > 1 || cb.hired > 0 });
    for (const g of rollLoot(state, e.monsterId)) {
      ev.push({ t: 'loot', from: e.name, item: LOOT_BY_ID[g.id].name, potency: g.potency });
    }
    if (living(cb.enemies).length === 0) victory(state, ev);
  } else if (m.special.heads && headsLeft(e, m) < headsBefore) {
    ev.push({ t: 'heads', actor: e.name, left: headsLeft(e, m) });
  }
}

// ---- The enemy side ----

function enemiesTurn(state, action, ev) {
  const cb = state.combat;
  for (const e of living(cb.enemies)) {
    if (cb.over) return;
    if (e.hp > 0) enemyTurn(state, e, ev);
  }
}

// Each attack picks a random living target on your side.
function pickTarget(state) {
  const c = state.character;
  const options = [];
  if (c.hp > 0) options.push({ you: true, uid: PLAYER });
  for (const a of living(state.combat.allies)) options.push({ you: false, uid: a.uid, ally: a });
  if (options.length <= 1) return options[0];
  return options[Math.floor(random() * options.length)];
}

function enemyTurn(state, e, ev) {
  const c = state.character;
  const cb = state.combat;
  const m = MONSTER_BY_ID[e.monsterId];

  if (m.breath && e.breathLeft > 0 && random() < m.breath.chance) {
    e.breathLeft--;
    breathe(state, e, m, ev);
    return;
  }

  const count = m.special.heads ? headsLeft(e, m) : m.attacks.length;
  for (let i = 0; i < count && !cb.over; i++) {
    const a = m.attacks[i % m.attacks.length];
    const target = pickTarget(state);
    if (!target) return;
    const tier = target.ally && MERC_BY_ID[target.ally.mercId];
    const ac = target.you ? armorClass(c) : tier.ac;
    const helpless = target.you ? cb.paralyzed > 0 : target.ally.paralyzed > 0;
    const need = m.thac0 - ac;
    const r = die(20);
    const hit = helpless || r === 20 || (r !== 1 && r >= need);
    const base = { t: 'attack', by: 'enemy', actor: e.name, attack: a.name, you: target.you, target: target.you ? PLAYER : target.ally.name };
    if (!hit) {
      ev.push({ ...base, hit: false });
      continue;
    }
    const dmg = Math.max(1, roll(a.dmg));
    if (target.you) {
      hurtPlayer(state, dmg, ev, { ...base, hit: true });
      if (cb.over) return;
      afflictPlayer(state, e, m, a, ev);
    } else {
      hurtAlly(state, target.ally, dmg, ev, { ...base, hit: true });
      if (target.ally.hp > 0) afflictAlly(state, target.ally, e, m, a, ev);
    }
  }
}

function afflictPlayer(state, e, m, a, ev) {
  const c = state.character;
  const cb = state.combat;
  if (a.poison) {
    const p = exposeToPoison(c, m.id, a.poison);
    ev.push(p.resisted
      ? { t: 'poisonResisted', you: true, actor: e.name, attack: a.name }
      : { t: 'poisoned', you: true, strength: p.strength, stacked: p.stacked });
  }
  if (m.special.paralyze && cb.paralyzed === 0 && die(20) < saveTarget('paralysis', c.level)) {
    cb.paralyzed = die(3);
    ev.push({ t: 'paralyzed', you: true, rounds: cb.paralyzed });
  }
  if (m.special.drain) {
    const { died, lostPoint, lostStat, value } = drainLevel(c);
    ev.push({ t: 'drain', level: c.level, hp: { uid: PLAYER, hp: c.hp }, lostPoint, lostStat, value });
    if (died) defeat(state, ev, 'drain');
  }
}

// Mercenaries suffer the same afflictions, but only for this fight. They have
// no levels to drain, so a drain does extra damage instead.
function afflictAlly(state, ally, e, m, a, ev) {
  const tier = MERC_BY_ID[ally.mercId];
  if (a.poison) {
    if (die(20) >= saveTarget('poison', tier.level)) {
      ev.push({ t: 'poisonResisted', target: ally.name });
    } else {
      const stacked = ally.poison > 0;
      ally.poison = stacked ? Math.max(ally.poison, a.poison) + 1 : a.poison;
      ev.push({ t: 'poisoned', target: ally.name, strength: ally.poison, stacked });
    }
  }
  if (m.special.paralyze && ally.paralyzed === 0 && die(20) < saveTarget('paralysis', tier.level)) {
    ally.paralyzed = die(3);
    ev.push({ t: 'paralyzed', target: ally.name, rounds: ally.paralyzed });
  }
  if (m.special.drain) {
    hurtAlly(state, ally, roll('1d8'), ev, { t: 'allyDrain', actor: e.name, target: ally.name });
  }
}

// Breath hits everyone on your side; each target saves separately.
function breathe(state, e, m, ev) {
  const c = state.character;
  const cb = state.combat;
  const base = Math.max(1, Math.ceil(e.hp / 2));
  const hits = [];
  const fallen = [];
  if (c.hp > 0) {
    const saved = die(20) >= saveTarget('breath', c.level);
    const dmg = saved ? Math.ceil(base / 2) : base;
    c.hp = Math.max(0, c.hp - dmg);
    hits.push({ you: true, uid: PLAYER, name: PLAYER, dmg, saved, hp: c.hp });
  }
  for (const a of living(cb.allies)) {
    const saved = die(20) >= saveTarget('breath', MERC_BY_ID[a.mercId].level);
    const dmg = saved ? Math.ceil(base / 2) : base;
    a.hp = Math.max(0, a.hp - dmg);
    hits.push({ you: false, uid: a.uid, name: a.name, dmg, saved, hp: a.hp });
    if (a.hp <= 0) fallen.push(a.name);
  }
  ev.push({ t: 'breath', actor: e.name, name: m.breath.name, hits });
  for (const name of fallen) ev.push({ t: 'allyDown', name });
  if (c.hp <= 0) defeat(state, ev, 'wounds');
}

function hurtPlayer(state, dmg, ev, event, cause = 'wounds') {
  const c = state.character;
  c.hp = Math.max(0, c.hp - dmg);
  Object.assign(event, { dmg, hp: { uid: PLAYER, hp: c.hp } });
  ev.push(event);
  if (c.hp <= 0) defeat(state, ev, cause);
}

function hurtAlly(state, ally, dmg, ev, event) {
  ally.hp = Math.max(0, ally.hp - dmg);
  Object.assign(event, { dmg, hp: { uid: ally.uid, hp: ally.hp } });
  ev.push(event);
  if (ally.hp <= 0) ev.push({ t: 'allyDown', name: ally.name });
}

// ---- End of round ----

function endOfRound(state, ev) {
  const c = state.character;
  const cb = state.combat;
  for (const e of living(cb.enemies)) {
    const m = MONSTER_BY_ID[e.monsterId];
    if (m.special.regen && !e.regenBlocked && e.hp < e.maxHp) {
      const amount = Math.min(m.special.regen, e.maxHp - e.hp);
      e.hp += amount;
      ev.push({ t: 'regen', actor: e.name, amount, hp: { uid: e.uid, hp: e.hp } });
    }
  }
  for (const e of living(cb.enemies)) {
    if (!(e.poison > 0)) continue;
    const m = MONSTER_BY_ID[e.monsterId];
    const dmg = resisted(m, 'poison', e.poison);
    e.poison--;
    hurtEnemy(state, e, dmg, ev, { t: 'enemyPoisonTick', resists: m.resist.includes('poison') }, PLAYER);
    if (cb.over) return;
    if (e.hp > 0 && e.poison === 0) ev.push({ t: 'enemyPoisonEnds', target: e.name });
  }
  if (c.poison > 0) {
    const dmg = c.poison;
    c.poison--;
    notePoisonDamage(c, dmg);
    hurtPlayer(state, dmg, ev, { t: 'poisonTick', you: true }, 'poison');
    if (cb.over) return;
    if (c.poison === 0) ev.push({ t: 'poisonEnds', you: true });
  }
  for (const a of living(cb.allies)) {
    if (a.poison <= 0) continue;
    const dmg = a.poison;
    a.poison--;
    hurtAlly(state, a, dmg, ev, { t: 'poisonTick', target: a.name });
    if (a.hp > 0 && a.poison === 0) ev.push({ t: 'poisonEnds', target: a.name });
  }

  const due = reinforcementsDue(state);
  for (let i = 0; i < due.now; i++) summon(state, ev);
  if (due.warn) {
    cb.summon.pending += due.warn;
    ev.push({ t: 'summonWarning', actor: mainEnemy(cb).name, by: MONSTER_BY_ID[cb.monsterId].calls === 'arena' ? 'arena' : 'kin' });
  }
}

// ---- Reinforcements ----

// The one place that decides whether help is coming. Returns how many arrive
// right now and how many are announced for next round.
//   - Only when you hired mercenaries. (Solo fights stay solo; see TODO.md
//     for a future "lopsided fight" rule that would hook in here.)
//   - Only while the opponent you chose is alive, and only if it calls.
//   - Never more helpers on the field (or on the way) than mercenaries hired.
//   - The first time the opponent drops below half its hit points, it calls
//     at once. Otherwise there's a 10% chance per living mercenary each round
//     (at most 50%), announced a round ahead.
export function reinforcementsDue(state) {
  const cb = state.combat;
  const due = { now: 0, warn: 0 };
  const main = mainEnemy(cb);
  const m = MONSTER_BY_ID[cb.monsterId];
  if (!m.calls || cb.hired === 0 || !main || main.hp <= 0) return due;

  const onField = living(cb.enemies).filter(e => e.summoned).length;
  let room = cb.hired - onField - cb.summon.pending;
  if (!cb.summon.halfDone && main.hp < main.maxHp / 2) {
    cb.summon.halfDone = true;
    if (room > 0) {
      due.now = 1;
      room--;
    }
  }
  const chance = Math.min(SUMMON_CHANCE_MAX, SUMMON_CHANCE_PER_MERC * living(cb.allies).length);
  if (room > 0 && random() < chance) due.warn = 1;
  return due;
}

export function summonKind(m) {
  if (m.calls === 'kin') return m.id;
  if (m.calls === 'arena') {
    const i = MONSTERS.findIndex(x => x.id === m.id);
    return MONSTERS[Math.max(0, i - ARENA_STEP_DOWN)].id;
  }
  return m.calls;
}

function summon(state, ev) {
  const cb = state.combat;
  const m = MONSTER_BY_ID[cb.monsterId];
  const kind = MONSTER_BY_ID[summonKind(m)];
  const e = addEnemy(cb, kind.id, { summoned: true });
  ev.push({ t: 'arrive', name: e.name, kind: kind.name, by: m.calls === 'arena' ? 'arena' : 'kin', caller: mainEnemy(cb).name });
}

// ---- Endings ----

// Leftover poison is applied when you walk out of the ring.
function afterFight(state, ev) {
  const c = state.character;
  if (c.poison <= 0 || c.dead) return;
  const { dmg, lingering } = sweatOut(c);
  ev.push({ t: 'sweat', dmg, lingering, hp: { uid: PLAYER, hp: c.hp } });
}

// Every enemy is down. XP from all of them is split evenly among everyone who
// fought (mercenaries' shares are lost). Gold comes only from the opponent you
// chose; summoned helpers pay nothing.
function victory(state, ev) {
  const c = state.character;
  const cb = state.combat;
  const chosen = MONSTER_BY_ID[cb.monsterId];
  finish(cb, 'victory');
  const totalXp = cb.enemies.reduce((sum, e) => sum + MONSTER_BY_ID[e.monsterId].xp, 0);
  const party = 1 + cb.hired;
  const xp = Math.floor(totalXp / party);
  c.gold += chosen.gold;
  for (const e of cb.enemies) c.wins[e.monsterId] = (c.wins[e.monsterId] ?? 0) + 1;
  ev.push({ t: 'victory', xp, totalXp, party, gold: chosen.gold, foe: chosen.name, solo: cb.enemies.length === 1 && cb.hired === 0 });
  for (const up of gainXp(c, xp)) ev.push({ t: 'levelUp', ...up, hp: { uid: PLAYER, hp: c.hp } });
  if (chosen.final && !state.flags.captain) {
    // With hired help, the Guard's promise needs your own killing blow.
    if (cb.hired === 0 || mainEnemy(cb).killedBy === PLAYER) {
      state.flags.captain = true;
      ev.push({ t: 'captain' });
    } else {
      ev.push({ t: 'captainDenied', foe: chosen.name });
    }
  }
  afterFight(state, ev);
}

function defeat(state, ev, cause = 'wounds') {
  if (state.combat.over) return;
  finish(state.combat, 'death');
  state.combat.cause = cause;
  state.character.dead = true;
  ev.push({ t: 'death', cause });
}

function finish(cb, result) {
  cb.over = true;
  cb.result = result;
}
