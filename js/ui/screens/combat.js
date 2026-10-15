// The combat dialog: your side on the left (you, then any mercenaries), the
// enemies on the right, a log below, and the original's three buttons: Fight,
// Use, Surrender. With more than one enemy, click one to make it your target.

import { MONSTER_BY_ID } from '../../data/monsters.js';
import { ITEM_BY_ID } from '../../data/equipment.js';
import { MERC_BY_ID, crewCost, crewSize } from '../../data/mercs.js';
import { weaponOf, weaponEntry, armorClass, maxHp, damageBonus } from '../../rules/character.js';
import { endArenaVisit } from '../../rules/loot.js';
import { playRound, startCombat, headsLeft, setTarget, openingEvents, PLAYER } from '../../rules/combat.js';
import { attacksLabel, COMBAT_LOG_LIMIT } from '../../rules/tables.js';
import { rangeText } from '../../engine/dice.js';
import { TextPresenter, describeAll, SUMMARIZE_ABOVE } from '../presenter.js';
import { button, esc, bar, gp } from '../format.js';
import { itemLabel, coatingTag } from './shops.js';

const presenter = new TextPresenter();

// Warn before starting a fight while poison lingers.
export function confirmPoisoned(c) {
  return c.poison <= 0 || window.confirm(
    `You are still poisoned (strength ${c.poison}). It will keep hurting you every round of the next fight. `
    + 'A Potion of Neutralize Poison or a night at the inn cures it.\n\nFight anyway?');
}
let busy = false;

const DELAYS = { instant: 0, fast: 60, normal: 160 };

function logHtml(lines) {
  return lines.map(l => `<li class="${l.cls}">${esc(l.text)}</li>`).join('');
}

function usableItems(c) {
  return c.items
    .map((entry, index) => ({ entry, index, it: ITEM_BY_ID[entry.id] }))
    .filter(x => x.it.use === 'combat' || x.it.use === 'any');
}

const summarize = cb => cb.hired > SUMMARIZE_ABOVE;

function maxHpOf(s, uid) {
  if (uid === PLAYER) return maxHp(s.character);
  return [...s.combat.allies, ...s.combat.enemies].find(u => u.uid === uid)?.maxHp ?? 1;
}

function playerCard(s) {
  const c = s.character;
  const cb = s.combat;
  const w = weaponOf(c);
  const max = maxHp(c);
  return `
    <div class="fighter player">
      <div class="portrait" aria-hidden="true">🛡️</div>
      <h3>${esc(c.name)}</h3>
      <div class="hp-line"><span id="hp-text-${PLAYER}">${c.hp} / ${max}</span></div>
      <div id="hp-${PLAYER}">${bar(c.hp, max)}</div>
      <dl class="facts compact">
        <div><dt>AC</dt><dd>${armorClass(c)}</dd></div>
        <div><dt>Attacks</dt><dd>${attacksLabel(c.level)}</dd></div>
        <div><dt>${esc(w.name)}</dt><dd>${rangeText(w.dmg, damageBonus(c))}</dd></div>
      </dl>
      ${cb.paralyzed > 0 ? '<p class="tag bad">Paralyzed</p>' : ''}
      ${c.poison > 0 ? `<p class="tag bad">☠ Poisoned ${c.poison}</p>` : ''}
      ${coatingTag(s, weaponEntry(c)) ? `<p class="small">Blade venom:${coatingTag(s, weaponEntry(c))}</p>` : ''}
    </div>`;
}

function allyCard(a) {
  const tier = MERC_BY_ID[a.mercId];
  const down = a.hp <= 0;
  return `
    <div class="fighter ally mini${down ? ' down' : ''}">
      <div class="mini-head"><span class="mini-art" aria-hidden="true">${tier.art}</span>
        <strong>${esc(a.name)}</strong></div>
      <div id="hp-${a.uid}">${bar(a.hp, a.maxHp)}</div>
      <p class="small muted">${down ? 'Fallen' : `AC ${tier.ac} · ${esc(tier.weapon.name)} ${rangeText(tier.weapon.dmg, tier.weapon.plus + tier.dmgBonus)}`}
        ${a.paralyzed > 0 && !down ? ' <span class="tag bad">Paralyzed</span>' : ''}
        ${a.poison > 0 && !down ? ` <span class="tag bad">☠ ${a.poison}</span>` : ''}</p>
    </div>`;
}

function enemyCard(cb, e, many) {
  const m = MONSTER_BY_ID[e.monsterId];
  const down = e.hp <= 0;
  const attacks = m.special.heads ? headsLeft(e, m) : m.attacks.length;
  const damage = m.special.heads ? rangeText(m.attacks[0].dmg) : m.attacks.map(a => rangeText(a.dmg)).join(' / ');
  const targeted = many && !down && cb.target === e.uid;
  const body = `
      <div class="portrait${e.main ? '' : ' small-portrait'}" aria-hidden="true">${m.art}</div>
      <h3>${esc(e.name)}</h3>
      <div class="hp-line muted small">${down ? 'Defeated' : targeted ? '🎯 Your target' : e.summoned ? 'Summoned' : ''}${!down && e.poison > 0 ? ` <span class="tag bad">☠ Poisoned ${e.poison}</span>` : ''}</div>
      <div id="hp-${e.uid}">${bar(e.hp, e.maxHp)}</div>
      <dl class="facts compact">
        <div><dt>AC</dt><dd>${m.ac}</dd></div>
        <div><dt>Attacks</dt><dd>${attacks}</dd></div>
        <div><dt>Damage</dt><dd>${damage}</dd></div>
      </dl>`;
  const cls = `fighter monster${down ? ' down' : ''}${targeted ? ' targeted' : ''}`;
  // Living enemies are clickable targets once there's more than one.
  return many && !down && !cb.over
    ? `<button type="button" class="${cls}" data-action="target" data-uid="${e.uid}" aria-pressed="${targeted}" title="Target the ${esc(e.name)}">${body}</button>`
    : `<div class="${cls}">${body}</div>`;
}

export function render(ctx, params) {
  const s = ctx.state;
  const c = s.character;
  const cb = s.combat;
  if (!cb) return '<p>No fight in progress.</p>' + button('Back to town', 'go', { to: 'town' });
  const m = MONSTER_BY_ID[cb.monsterId];
  const many = cb.enemies.length > 1;

  let controls;
  if (cb.over) {
    const next = cb.result === 'death' ? 'dead' : cb.result === 'victory' && s.flags.captain && !s.flags.captainSeen ? 'captain' : 'town';
    const label = cb.result === 'death' ? 'Continue' : cb.result === 'victory' ? 'Collect your winnings' : 'Leave the arena';
    const cost = crewCost(cb.crew);
    controls = `
      <div class="row">
        ${button(label, 'leave', { to: next }, { cls: 'primary' })}
        ${cb.result !== 'death' ? button(`Fight another ${esc(m.name)}${cb.hired ? ' alone' : ''}`, 'again', { crew: 'none' }, { cls: 'ghost' }) : ''}
        ${cb.result !== 'death' && cb.hired ? button(`…with the same crew (${gp(cost)})`, 'again', { crew: 'same' }, { cls: 'ghost', disabled: c.gold < cost }) : ''}
      </div>`;
  } else if (params.picking) {
    const items = usableItems(c);
    controls = `
      <div class="panel use-list">
        <h3>Use which item?</h3>
        ${items.length
          ? `<ul class="list">${items.map(x => `<li><span>${itemLabel(x.entry)} <span class="muted small">${esc(x.it.effect)}</span></span>${button('Use', 'use', { index: x.index }, { cls: 'small' })}</li>`).join('')}</ul>`
          : '<p class="muted">You have nothing you can use in combat.</p>'}
        ${button('Cancel', 'cancelUse', {}, { cls: 'ghost' })}
      </div>`;
  } else {
    const paralyzed = cb.paralyzed > 0;
    controls = `
      <div class="row combat-buttons">
        ${button(paralyzed ? 'Struggle' : '⚔️ Fight', 'fight', {}, { cls: 'primary', title: 'Shortcut: F' })}
        ${button('🧪 Use', 'pickItem', {}, { disabled: paralyzed, title: 'Shortcut: U' })}
        ${button(`🏳️ Surrender (${gp(Math.min(c.gold, m.fine))})`, 'surrender', {}, { cls: 'ghost', title: 'Shortcut: S' })}
      </div>`;
  }

  const pending = cb.summon.pending > 0 && !cb.over
    ? `<p class="tag bad incoming">⚠ ${cb.summon.pending === 1 ? 'Reinforcements arrive' : `${cb.summon.pending} reinforcements arrive`} next round</p>`
    : '';

  return `
    <section class="combat">
      <div class="combatants">
        <div class="side">
          ${playerCard(s)}
          ${cb.allies.length ? `<div class="crew">${cb.allies.map(allyCard).join('')}</div>` : ''}
        </div>
        <div class="versus" aria-hidden="true">vs</div>
        <div class="side">
          ${many && !cb.over ? '<p class="muted small target-hint">Click an enemy to target it. Your mercenaries follow your lead.</p>' : ''}
          ${cb.enemies.map(e => enemyCard(cb, e, many)).join('')}
          ${pending}
        </div>
      </div>
      <ol class="log" id="combat-log" aria-live="polite">${logHtml(cb.log)}</ol>
      ${controls}
      <p class="muted small row">
        Combat speed:
        ${['instant', 'fast', 'normal'].map(sp => button(sp, 'speed', { speed: sp }, { cls: `link${s.settings.combatSpeed === sp ? ' on' : ''}` })).join(' ')}
      </p>
    </section>`;
}

function trimLog(cb) {
  if (cb.log.length > COMBAT_LOG_LIMIT) cb.log.splice(0, cb.log.length - COMBAT_LOG_LIMIT);
}

// Play a round: rules first (state is saved immediately), then the presenter
// replays the events, then a full re-render shows the settled state.
async function act(ctx, action) {
  if (busy) {
    presenter.skip();
    return;
  }
  const s = ctx.state;
  if (!s.combat || s.combat.over) return;
  busy = true;
  const opts = { summarize: summarize(s.combat) };
  const events = ctx.mutate(state => {
    const ev = playRound(state, action);
    state.combat.log.push(...describeAll(ev, opts));
    trimLog(state.combat);
    return ev;
  });

  document.querySelectorAll('.combat-buttons button, .use-list button, [data-action="target"]').forEach(b => { b.disabled = true; });
  const logEl = document.getElementById('combat-log');
  await presenter.play(events, {
    ...opts,
    delay: DELAYS[s.settings.combatSpeed] ?? 0,
    log(line) {
      if (!logEl) return;
      logEl.insertAdjacentHTML('beforeend', logHtml([line]));
      logEl.scrollTop = logEl.scrollHeight;
    },
    setHp(uid, hp) {
      const el = document.getElementById(`hp-${uid}`);
      if (!el) return; // a newly arrived enemy appears on the next render
      const max = maxHpOf(s, uid);
      el.innerHTML = bar(hp, Math.max(max, hp));
      if (uid === PLAYER) {
        const t = document.getElementById(`hp-text-${PLAYER}`);
        if (t) t.textContent = `${hp} / ${max}`;
      }
    },
  });
  busy = false;
  ctx.setParams({ picking: false });
}

export const actions = {
  fight: ctx => act(ctx, { type: 'fight' }),
  pickItem: ctx => ctx.setParams({ picking: true }),
  cancelUse: ctx => ctx.setParams({ picking: false }),
  use: (ctx, d) => act(ctx, { type: 'use', index: Number(d.index) }),
  target(ctx, d) {
    if (busy) return;
    ctx.commit(s => { setTarget(s.combat, d.uid); });
  },
  surrender(ctx) {
    const s = ctx.state;
    const m = MONSTER_BY_ID[s.combat.monsterId];
    if (window.confirm(`Surrender to the ${m.name}? The arena fines you ${Math.min(s.character.gold, m.fine)} gold.`)) {
      act(ctx, { type: 'surrender' });
    }
  },
  leave(ctx, d) {
    const spoiled = ctx.mutate(s => {
      if (s.character.dead) return [];
      s.combat = null;
      return endArenaVisit(s); // one clock tick per arena visit
    });
    ctx.go(d.to);
    if (spoiled.length) {
      ctx.flash(`Your venom has spoiled: ${spoiled.join(', ')}.`, 'err');
      ctx.render();
    }
  },
  again(ctx, d) {
    const s = ctx.state;
    const id = s.combat.monsterId;
    const crew = d.crew === 'same' ? { ...s.combat.crew } : {};
    if (!confirmPoisoned(s.character)) return;
    const result = ctx.mutate(state => {
      const r = startCombat(state, id, crew);
      if (r.ok && crewSize(crew)) state.lastCrew = crew;
      return r;
    });
    if (!result.ok) {
      ctx.flash(result.msg, 'err');
      ctx.render();
      return;
    }
    ctx.go('combat');
  },
  speed(ctx, d) {
    ctx.commit(s => { s.settings.combatSpeed = d.speed; });
  },
};

export const keys = {
  f: ctx => (ctx.state.combat?.over ? null : actions.fight(ctx)),
  u: ctx => (ctx.state.combat?.over ? null : actions.pickItem(ctx)),
  s: ctx => (ctx.state.combat?.over ? null : actions.surrender(ctx)),
};

export function mount(ctx, root) {
  const logEl = root.querySelector('#combat-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  if (!ctx.state.combat?.log.length) {
    // First render of a new fight: log the opening lines.
    ctx.mutate(s => { s.combat.log.push(...describeAll(openingEvents(s))); });
    logEl?.insertAdjacentHTML('beforeend', logHtml(ctx.state.combat.log));
  }
}
