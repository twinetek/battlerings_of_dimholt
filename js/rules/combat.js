// Arena combat. It plays one round at a time and returns a list of event
// objects describing what happened. The rules never touch the screen: a
// presenter turns events into text now, and can turn them into animations
// later without changing anything here.
//
// Round sequence, from the original Read Me:
//   1. Determine who strikes first (d10 + weapon speed; lower goes first)
//   2. First attacker strikes, then check whether the second one died
//   3. Second attacker strikes, then check whether the first one died

import { roll, die, random } from '../engine/dice.js';
import { MONSTER_BY_ID } from '../data/monsters.js';
import { ITEM_BY_ID } from '../data/equipment.js';
import { attacksThisRound, saveTarget, strBonus, ITEM_SPEED } from './tables.js';
import { weaponOf, armorClass, rollToHit, gainXp, drainLevel, heal } from './character.js';
import { exposeToPoison, notePoisonDamage, sweatOut, curePoison } from './poison.js';

export function startCombat(state, monsterId) {
  const m = MONSTER_BY_ID[monsterId];
  const hp = m.hpFixed ?? Math.max(1, roll(m.hp));
  state.combat = {
    monsterId, hp, maxHp: hp, round: 0,
    paralyzed: 0,                       // player turns left to skip
    breathLeft: m.breath?.uses ?? 0,
    regenBlocked: false,                // set once fire hurts a regenerating monster
    over: false, result: null,          // result: victory | death | surrender
    log: [],
  };
  return [{ t: 'start' }];
}

export const canHurt = (c, m) => weaponOf(c).plus >= m.magicReq;

export function headsLeft(cb, m) {
  return Math.max(1, Math.ceil(cb.hp / (cb.maxHp / m.special.heads)));
}

// action: { type: 'fight' } | { type: 'use', index } | { type: 'surrender' }
export function playRound(state, action) {
  const c = state.character;
  const cb = state.combat;
  if (!cb || cb.over) return [];
  const m = MONSTER_BY_ID[cb.monsterId];
  const ev = [];

  if (action.type === 'surrender') {
    const fine = Math.min(c.gold, m.fine);
    c.gold -= fine;
    finish(cb, 'surrender');
    ev.push({ t: 'surrender', fine });
    afterFight(state, ev);
    return ev;
  }

  cb.round++;
  ev.push({ t: 'round', n: cb.round });

  let playerFirst = false;
  if (cb.paralyzed === 0) {
    const speed = action.type === 'use' ? ITEM_SPEED : weaponOf(c).speed;
    playerFirst = die(10) + speed <= die(10) + m.speed;
  }
  ev.push({ t: 'initiative', first: playerFirst ? 'player' : 'monster' });

  const turns = playerFirst ? [playerTurn, monsterTurn] : [monsterTurn, playerTurn];
  for (const turn of turns) {
    if (cb.over) break;
    turn(state, m, action, ev);
  }
  if (!cb.over) endOfRound(state, m, ev);
  return ev;
}

function playerTurn(state, m, action, ev) {
  const c = state.character;
  const cb = state.combat;
  if (cb.paralyzed > 0) {
    cb.paralyzed--;
    ev.push({ t: 'paralyzedSkip' });
    return;
  }
  if (action.type === 'use') {
    useItem(state, m, action.index, ev);
    return;
  }
  const w = weaponOf(c);
  if (w.plus < m.magicReq) {
    ev.push({ t: 'immune', weapon: w.name, req: m.magicReq });
    return;
  }
  const swings = attacksThisRound(c.level, cb.round);
  for (let i = 0; i < swings && !cb.over; i++) {
    const need = rollToHit(c, m.ac, w);
    const r = die(20);
    const hit = r === 20 || (r !== 1 && r >= need);
    if (!hit) {
      ev.push({ t: 'attack', who: 'player', hit: false, weapon: w.name });
      continue;
    }
    const dmg = Math.max(1, roll(w.dmg) + strBonus(c.stats.str).dmg + w.plus);
    hurtMonster(state, m, dmg, ev, { t: 'attack', who: 'player', hit: true, weapon: w.name, dmg });
  }
}

function useItem(state, m, index, ev) {
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
    ev.push({ t: 'heal', item: it.name, amount, playerHp: c.hp });
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
  if (it.dtype === 'fire' && m.special.regen) cb.regenBlocked = true;
  if (m.immune.includes(it.dtype)) {
    ev.push({ t: 'itemImmune', item: it.name, dtype: it.dtype });
  } else {
    hurtMonster(state, m, roll(it.damage), ev, { t: 'itemHit', item: it.name, verb: it.verb, dmg: 0 });
  }
  if (it.charges && entry.charges <= 0) ev.push({ t: 'wandEmpty', item: it.name });
}

function hurtMonster(state, m, dmg, ev, event) {
  const cb = state.combat;
  const headsBefore = m.special.heads ? headsLeft(cb, m) : 0;
  cb.hp = Math.max(0, cb.hp - dmg);
  event.dmg = dmg;
  event.monsterHp = cb.hp;
  ev.push(event);
  if (cb.hp <= 0) {
    victory(state, m, ev);
  } else if (m.special.heads && headsLeft(cb, m) < headsBefore) {
    ev.push({ t: 'heads', left: headsLeft(cb, m) });
  }
}

function monsterTurn(state, m, action, ev) {
  const c = state.character;
  const cb = state.combat;

  if (m.breath && cb.breathLeft > 0 && random() < m.breath.chance) {
    cb.breathLeft--;
    let dmg = Math.max(1, Math.ceil(cb.hp / 2));
    const saved = die(20) >= saveTarget('breath', c.level);
    if (saved) dmg = Math.ceil(dmg / 2);
    hurtPlayer(state, dmg, ev, { t: 'breath', name: m.breath.name, saved });
    return;
  }

  const count = m.special.heads ? headsLeft(cb, m) : m.attacks.length;
  for (let i = 0; i < count && !cb.over; i++) {
    const a = m.attacks[i % m.attacks.length];
    const need = m.thac0 - armorClass(c);
    const r = die(20);
    const hit = cb.paralyzed > 0 || r === 20 || (r !== 1 && r >= need);
    if (!hit) {
      ev.push({ t: 'attack', who: 'monster', hit: false, attack: a.name });
      continue;
    }
    hurtPlayer(state, Math.max(1, roll(a.dmg)), ev, { t: 'attack', who: 'monster', hit: true, attack: a.name });
    if (cb.over) return;

    if (a.poison) {
      const p = exposeToPoison(c, m.id, a.poison);
      ev.push(p.resisted ? { t: 'poisonResisted', attack: a.name } : { t: 'poisoned', strength: p.strength, stacked: p.stacked });
    }

    if (m.special.paralyze && cb.paralyzed === 0) {
      if (die(20) < saveTarget('paralysis', c.level)) {
        cb.paralyzed = die(3);
        ev.push({ t: 'paralyzed', rounds: cb.paralyzed });
      }
    }
    if (m.special.drain) {
      const { died, lostPoint, lostStat, value } = drainLevel(c);
      ev.push({ t: 'drain', level: c.level, playerHp: c.hp, lostPoint, lostStat, value });
      if (died) defeat(state, ev, 'drain');
    }
  }
}

function hurtPlayer(state, dmg, ev, event, cause = 'wounds') {
  const c = state.character;
  c.hp = Math.max(0, c.hp - dmg);
  event.dmg = dmg;
  event.playerHp = c.hp;
  ev.push(event);
  if (c.hp <= 0) defeat(state, ev, cause);
}

function endOfRound(state, m, ev) {
  const cb = state.combat;
  if (m.special.regen && !cb.regenBlocked && cb.hp < cb.maxHp) {
    const amount = Math.min(m.special.regen, cb.maxHp - cb.hp);
    cb.hp += amount;
    ev.push({ t: 'regen', amount, monsterHp: cb.hp });
  }
  const c = state.character;
  if (c.poison > 0) {
    const dmg = c.poison;
    c.poison--;
    notePoisonDamage(c, dmg);
    hurtPlayer(state, dmg, ev, { t: 'poisonTick' }, 'poison');
    if (!cb.over && c.poison === 0) ev.push({ t: 'poisonEnds' });
  }
}

// Leftover poison is applied when you walk out of the ring.
function afterFight(state, ev) {
  const c = state.character;
  if (c.poison <= 0 || c.dead) return;
  const { dmg, lingering } = sweatOut(c);
  ev.push({ t: 'sweat', dmg, lingering, playerHp: c.hp });
}

function victory(state, m, ev) {
  const c = state.character;
  finish(state.combat, 'victory');
  c.gold += m.gold;
  c.wins[m.id] = (c.wins[m.id] ?? 0) + 1;
  ev.push({ t: 'victory', xp: m.xp, gold: m.gold });
  for (const up of gainXp(c, m.xp)) ev.push({ t: 'levelUp', ...up, playerHp: c.hp });
  if (m.final && !state.flags.captain) {
    state.flags.captain = true;
    ev.push({ t: 'captain' });
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
