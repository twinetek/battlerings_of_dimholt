// Turns combat events into something the player sees.
//
// toLines() maps events to log lines, each carrying the hit-point changes it
// covers. TextPresenter plays those lines into a view one at a time and
// updates the hp bars as it goes. A future graphical presenter only has to
// implement play(events, view), for example by running a sprite animation per
// event before logging it.
//
// With a large crew (more than SUMMARIZE_ABOVE mercenaries), each run of
// mercenary attacks is condensed into one line.

import { STATS } from '../rules/tables.js';

export const SUMMARIZE_ABOVE = 3;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const statName = key => STATS.find(([k]) => k === key)?.[1] ?? key;
const article = name => (/^[AEIOU]/.test(name) ? 'an' : 'a');

function drainText(e) {
  let text = `A deathly chill drains your life force! You are now level ${e.level}.`;
  if (e.lostPoint) text += ' An unspent stat point is lost.';
  if (e.lostStat) text += ` Your ${statName(e.lostStat)} falls to ${e.value}.`;
  return text;
}

function breathText(e) {
  const parts = e.hits.map(h => (h.you
    ? (h.saved ? `you dive aside but take ${h.dmg}` : `you take ${h.dmg}`)
    : `${h.name} takes ${h.dmg}${h.saved ? ' (dodged half)' : ''}`));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `The ${e.actor} breathes ${e.name}! ${list.charAt(0).toUpperCase()}${list.slice(1)} damage.`;
}

// "Wyvern and scorpion venom take hold: the Hill Giant is poisoned (strength 9)."
function venomLine(e) {
  const list = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);
  const of = outcome => e.results.filter(r => r.outcome === outcome).map(r => r.venom.toLowerCase());
  const takes = of('takes'), resisted = of('resisted'), own = of('own');
  const parts = [];
  if (takes.length) {
    const t = list(takes);
    parts.push(`${t.charAt(0).toUpperCase()}${t.slice(1)} venom ${takes.length > 1 ? 'take' : 'takes'} hold: the ${e.target} is poisoned (strength ${e.strength})`);
  }
  if (resisted.length) parts.push(`${takes.length ? 'it' : `The ${e.target}`} resists the ${list(resisted)} venom`);
  if (own.length) parts.push(`${takes.length || resisted.length ? 'it' : `The ${e.target}`} is immune to ${list(own)} venom, its own kind's`);
  return { text: `${parts.join('; ')}.`, cls: takes.length ? 'good' : 'muted' };
}

export function describe(e) {
  const who = e.you ? 'you' : e.target;
  switch (e.t) {
    case 'start': return { text: `You step onto the sand. The ${e.foe} awaits!`, cls: 'sys' };
    case 'hired': return { text: `Fighting at your side: ${e.crew}. You paid ${e.wages} gold in wages.`, cls: 'sys' };
    case 'round': return { text: `Round ${e.n}`, cls: 'round' };
    case 'initiative': return null; // implied by the order of the lines that follow
    case 'attack':
      if (e.by === 'player') {
        return e.hit
          ? { text: `You hit the ${e.target} with your ${e.weapon} for ${e.dmg} damage.`, cls: 'good' }
          : { text: `You swing your ${e.weapon} at the ${e.target} and miss.`, cls: 'muted' };
      }
      if (e.by === 'ally') {
        return e.hit
          ? { text: `${e.actor} hits the ${e.target} for ${e.dmg} damage.`, cls: 'ally' }
          : { text: `${e.actor} misses the ${e.target}.`, cls: 'muted' };
      }
      if (e.you) {
        return e.hit
          ? { text: `The ${e.actor}'s ${e.attack} hits you for ${e.dmg} damage.`, cls: 'bad' }
          : { text: `The ${e.actor}'s ${e.attack} misses you.`, cls: 'muted' };
      }
      return e.hit
        ? { text: `The ${e.actor}'s ${e.attack} hits ${e.target} for ${e.dmg} damage.`, cls: 'warn' }
        : { text: `The ${e.actor}'s ${e.attack} misses ${e.target}.`, cls: 'muted' };
    case 'immune': return { text: `Your ${e.weapon} has no effect on the ${e.target}. You need a +${e.req} weapon!`, cls: 'warn' };
    case 'allyImmune': return { text: `${e.actor}'s weapon can't harm the ${e.target}.`, cls: 'muted' };
    case 'heads': return { text: `The ${e.actor} has ${e.left} head${e.left === 1 ? '' : 's'} left.`, cls: 'sys' };
    case 'breath': return { text: breathText(e), cls: 'bad' };
    case 'paralyzed': return e.you
      ? { text: `You are paralyzed for ${e.rounds} round${e.rounds === 1 ? '' : 's'}!`, cls: 'bad' }
      : { text: `${e.target} is paralyzed!`, cls: 'warn' };
    case 'paralyzedSkip': return e.you
      ? { text: 'You are paralyzed and cannot act.', cls: 'warn' }
      : { text: `${e.actor} is paralyzed and can't act.`, cls: 'muted' };
    case 'drain': return { text: drainText(e), cls: 'bad' };
    case 'allyDrain': return { text: `The ${e.actor}'s chilling touch withers ${e.target} for ${e.dmg} more damage.`, cls: 'warn' };
    case 'regen': return { text: `The ${e.actor} regenerates ${e.amount} hit points.`, cls: 'warn' };
    case 'heal': return { text: `You drink the ${e.item} and recover ${e.amount} hit points.`, cls: 'good' };
    case 'itemHit': return { text: `${e.verb} the ${e.target} for ${e.dmg} damage.`, cls: 'good' };
    case 'itemImmune': return { text: `The ${e.target} is unharmed by the ${e.dtype}!`, cls: 'warn' };
    case 'wandEmpty': return { text: `The ${e.item} crumbles to dust, its charges spent.`, cls: 'sys' };
    case 'fumble': return { text: 'You fumble in your pack and find nothing useful.', cls: 'muted' };
    case 'enemyDown': return e.crowd ? { text: `The ${e.name} falls!`, cls: 'good' } : null;
    case 'allyDown': return { text: `${e.name} falls!`, cls: 'bad' };
    case 'noReach': return { text: 'No enemy is within reach of your weapon.', cls: 'muted' };
    case 'move': return null; // shown by the battlefield, not the log
    case 'loot': return { text: `The ${e.from} leaves behind a ${e.item} (potency ${e.potency})!`, cls: 'win' };
    case 'venom': return venomLine(e);
    case 'venomImmune': return { text: `The venom on your blade does nothing to the ${e.target}.`, cls: 'muted' };
    case 'enemyPoisonTick': return { text: `Venom burns the ${e.target} for ${e.dmg} damage${e.resists ? ' (it resists poison: half damage)' : ''}.`, cls: 'good' };
    case 'enemyPoisonEnds': return { text: `The venom in the ${e.target} wears off.`, cls: 'muted' };
    case 'summonWarning': return e.by === 'arena'
      ? { text: 'The arena master signals the gate. Something is coming next round!', cls: 'warn' }
      : { text: `The ${e.actor} shrieks for help! More will come next round.`, cls: 'warn' };
    case 'arrive': return e.by === 'tester'
      ? { text: `Tester: ${article(e.kind)} ${e.kind} joins the fight. (${e.name})`, cls: 'sys' }
      : e.by === 'arena'
      ? { text: `The gate opens: ${article(e.kind)} ${e.kind} charges onto the sand! (${e.name})`, cls: 'warn' }
      : { text: `Another ${e.kind} answers the ${e.caller}'s call! (${e.name})`, cls: 'warn' };
    case 'victory': return e.solo
      ? { text: `The ${e.foe} falls! You earn ${e.xp} experience and ${e.gold} gold.`, cls: 'win' }
      : { text: `Victory! You earn ${e.xp} experience${e.party > 1 ? ` (your share of ${e.totalXp}, split ${e.party} ways)` : ''} and ${e.gold} gold.`, cls: 'win' };
    case 'levelUp': return { text: `You have reached level ${e.level}! (+${e.gain} max hit points${e.statPoint ? ', and a stat point to spend at the Training Yard' : ''})`, cls: 'win' };
    case 'captain': return { text: 'The crowd is on its feet. You have bested the mightiest creature the Battlerings could host. Dimholt has a new Captain of the Guard!', cls: 'win' };
    case 'captainDenied': return { text: `The crowd cheers your crew, but the Guard's promise is for the one who strikes the final blow. Defeat the ${e.foe} with your own hand to become Captain.`, cls: 'warn' };
    case 'death': return e.cause === 'poison'
      ? { text: 'You succumb to the poison...', cls: 'bad' }
      : { text: 'You have been slain...', cls: 'bad' };
    case 'poisoned': return e.stacked
      ? { text: e.you ? `More venom! The poison grows stronger (strength ${e.strength}).` : `More venom for ${who} (strength ${e.strength}).`, cls: e.you ? 'bad' : 'warn' }
      : { text: e.you ? `You are poisoned! (strength ${e.strength})` : `${who} is poisoned! (strength ${e.strength})`, cls: e.you ? 'bad' : 'warn' };
    case 'poisonResisted': return e.you
      ? { text: `You resist the venom of the ${e.actor}'s ${e.attack}.`, cls: 'good' }
      : { text: `${e.target} resists the venom.`, cls: 'muted' };
    case 'poisonTick': return e.you
      ? { text: `Poison burns you for ${e.dmg} damage.`, cls: 'bad' }
      : { text: `Poison burns ${e.target} for ${e.dmg} damage.`, cls: 'warn' };
    case 'poisonEnds': return e.you ? { text: 'The poison wears off.', cls: 'sys' } : { text: `${e.target}'s poison wears off.`, cls: 'muted' };
    case 'poisonCarried': return { text: `The poison in your blood still burns (strength ${e.strength}).`, cls: 'warn' };
    case 'cured': return { text: e.had ? `You drink the ${e.item}. The poison is gone.` : `You drink the ${e.item}, but you weren't poisoned.`, cls: e.had ? 'good' : 'muted' };
    case 'sweat': return e.lingering
      ? { text: `The venom burns on as you leave the ring (-${e.dmg} hp). You're down to 1 hp and the poison lingers (strength ${e.lingering}). Cure it before your next fight!`, cls: 'warn' }
      : { text: `You sweat out the rest of the venom (-${e.dmg} hp).`, cls: 'warn' };
    case 'surrender': return { text: `You yield${e.crew ? ', and your crew lowers their weapons' : ''}. The arena master collects a fine of ${e.fine} gold.`, cls: 'warn' };
    default: return null;
  }
}

const hpChanges = e => (e.hits ? e.hits.map(h => ({ uid: h.uid, hp: h.hp })) : e.hp ? [e.hp] : []);

// opts.summarize: condense each run of mercenary attacks into one line.
export function toLines(events, opts = {}) {
  const lines = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (opts.summarize && e.t === 'attack' && e.by === 'ally') {
      const run = [];
      while (i < events.length && events[i].t === 'attack' && events[i].by === 'ally') run.push(events[i++]);
      i--;
      const hits = run.filter(x => x.hit);
      const dmg = hits.reduce((s, x) => s + x.dmg, 0);
      lines.push({
        text: `Your mercenaries swing ${run.length} times: ${hits.length} hit${hits.length === 1 ? '' : 's'} for ${dmg} damage.`,
        cls: hits.length ? 'ally' : 'muted', hp: run.flatMap(hpChanges),
      });
      continue;
    }
    const line = describe(e);
    const hp = hpChanges(e);
    if (line) lines.push({ ...line, hp });
    else if (hp.length && lines.length) lines.at(-1).hp.push(...hp);
  }
  return lines;
}

// Text-only lines for the saved combat log.
export const describeAll = (events, opts) => toLines(events, opts).map(({ text, cls }) => ({ text, cls }));

export class TextPresenter {
  constructor() { this.skipping = false; }

  skip() { this.skipping = true; }

  // view: { log(line), setHp(uid, hp), delay, summarize }
  async play(events, view) {
    this.skipping = false;
    for (const line of toLines(events, { summarize: view.summarize })) {
      for (const { uid, hp } of line.hp) view.setHp(uid, hp);
      view.log(line);
      if (view.delay && !this.skipping) await sleep(line.cls === 'round' ? view.delay / 2 : view.delay);
    }
  }
}
