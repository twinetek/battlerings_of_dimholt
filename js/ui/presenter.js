// Turns combat events into something the player sees.
//
// describe() maps one event to a log line. TextPresenter plays a list of
// events into a view, one line at a time, and updates the hp bars as it goes.
// A future graphical presenter only has to implement play(events, view),
// for example by running a sprite animation per event before logging it.

import { STATS } from '../rules/tables.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const statName = key => STATS.find(([k]) => k === key)?.[1] ?? key;

function drainText(e) {
  let text = `A deathly chill drains your life force! You are now level ${e.level}.`;
  if (e.lostPoint) text += ' An unspent stat point is lost.';
  if (e.lostStat) text += ` Your ${statName(e.lostStat)} falls to ${e.value}.`;
  return text;
}

export function describe(e, names) {
  const M = `the ${names.monster}`;
  const Mcap = `The ${names.monster}`;
  switch (e.t) {
    case 'start': return { text: `You step onto the sand. ${Mcap} awaits!`, cls: 'sys' };
    case 'round': return { text: `Round ${e.n}`, cls: 'round' };
    case 'initiative': return null; // implied by the order of the lines that follow
    case 'attack':
      if (e.who === 'player') {
        return e.hit
          ? { text: `You hit ${M} with your ${e.weapon} for ${e.dmg} damage.`, cls: 'good' }
          : { text: `You swing your ${e.weapon} and miss.`, cls: 'muted' };
      }
      return e.hit
        ? { text: `${Mcap}'s ${e.attack} hits you for ${e.dmg} damage.`, cls: 'bad' }
        : { text: `${Mcap}'s ${e.attack} misses.`, cls: 'muted' };
    case 'immune': return { text: `Your ${e.weapon} has no effect on ${M}. You need a +${e.req} weapon!`, cls: 'warn' };
    case 'heads': return { text: `${Mcap} has ${e.left} head${e.left === 1 ? '' : 's'} left.`, cls: 'sys' };
    case 'breath':
      return e.saved
        ? { text: `${Mcap} breathes ${e.name}! You dive aside but still take ${e.dmg} damage.`, cls: 'bad' }
        : { text: `${Mcap} breathes ${e.name}! You take ${e.dmg} damage.`, cls: 'bad' };
    case 'paralyzed': return { text: `You are paralyzed for ${e.rounds} round${e.rounds === 1 ? '' : 's'}!`, cls: 'bad' };
    case 'paralyzedSkip': return { text: 'You are paralyzed and cannot act.', cls: 'warn' };
    case 'drain': return { text: drainText(e), cls: 'bad' };
    case 'regen': return { text: `${Mcap} regenerates ${e.amount} hit points.`, cls: 'warn' };
    case 'heal': return { text: `You drink the ${e.item} and recover ${e.amount} hit points.`, cls: 'good' };
    case 'itemHit': return { text: `${e.verb} ${M} for ${e.dmg} damage.`, cls: 'good' };
    case 'itemImmune': return { text: `${Mcap} is unharmed by the ${e.dtype}!`, cls: 'warn' };
    case 'wandEmpty': return { text: `The ${e.item} crumbles to dust, its charges spent.`, cls: 'sys' };
    case 'fumble': return { text: 'You fumble in your pack and find nothing useful.', cls: 'muted' };
    case 'victory': return { text: `${Mcap} falls! You earn ${e.xp} experience and ${e.gold} gold.`, cls: 'win' };
    case 'levelUp': return { text: `You have reached level ${e.level}! (+${e.gain} max hit points${e.statPoint ? ', and a stat point to spend at the Training Yard' : ''})`, cls: 'win' };
    case 'captain': return { text: 'The crowd is on its feet. You have bested the mightiest creature the Battlerings could host. Dimholt has a new Captain of the Guard!', cls: 'win' };
    case 'death': return e.cause === 'poison'
      ? { text: 'You succumb to the poison...', cls: 'bad' }
      : { text: `You have been slain by ${M}...`, cls: 'bad' };
    case 'poisoned': return e.stacked
      ? { text: `More venom! The poison grows stronger (strength ${e.strength}).`, cls: 'bad' }
      : { text: `You are poisoned! (strength ${e.strength})`, cls: 'bad' };
    case 'poisonResisted': return { text: `You resist the venom of ${M}'s ${e.attack}.`, cls: 'good' };
    case 'poisonTick': return { text: `Poison burns you for ${e.dmg} damage.`, cls: 'bad' };
    case 'poisonEnds': return { text: 'The poison wears off.', cls: 'sys' };
    case 'poisonCarried': return { text: `The poison in your blood still burns (strength ${e.strength}).`, cls: 'warn' };
    case 'cured': return { text: e.had ? `You drink the ${e.item}. The poison is gone.` : `You drink the ${e.item}, but you weren't poisoned.`, cls: e.had ? 'good' : 'muted' };
    case 'sweat': return e.lingering
      ? { text: `The venom burns on as you leave the ring (-${e.dmg} hp). You're down to 1 hp and the poison lingers (strength ${e.lingering}). Cure it before your next fight!`, cls: 'warn' }
      : { text: `You sweat out the rest of the venom (-${e.dmg} hp).`, cls: 'warn' };
    case 'surrender': return { text: `You yield. The arena master collects a fine of ${e.fine} gold.`, cls: 'warn' };
    default: return null;
  }
}

export function describeAll(events, names) {
  return events.map(e => describe(e, names)).filter(Boolean);
}

export class TextPresenter {
  constructor() { this.skipping = false; }

  skip() { this.skipping = true; }

  // view: { names, log(line), setHp(side, hp), delay }
  async play(events, view) {
    this.skipping = false;
    for (const e of events) {
      if (e.playerHp !== undefined) view.setHp('player', e.playerHp);
      if (e.monsterHp !== undefined) view.setHp('monster', e.monsterHp);
      const line = describe(e, view.names);
      if (!line) continue;
      view.log(line);
      if (view.delay && !this.skipping) await sleep(line.cls === 'round' ? view.delay / 2 : view.delay);
    }
  }
}
