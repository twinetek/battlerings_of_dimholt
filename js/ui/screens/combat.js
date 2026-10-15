// The combat dialog: you on the left, the foe on the right, a log below,
// and the original's three buttons: Fight, Use, Surrender.

import { MONSTER_BY_ID } from '../../data/monsters.js';
import { ITEM_BY_ID } from '../../data/equipment.js';
import { weaponOf, armorClass, maxHp, damageBonus } from '../../rules/character.js';
import { playRound, startCombat, headsLeft } from '../../rules/combat.js';
import { attacksLabel, COMBAT_LOG_LIMIT } from '../../rules/tables.js';
import { rangeText } from '../../engine/dice.js';
import { TextPresenter, describeAll } from '../presenter.js';
import { button, esc, bar, gp } from '../format.js';
import { itemLabel } from './shops.js';

const presenter = new TextPresenter();
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

export function render(ctx, params) {
  const s = ctx.state;
  const c = s.character;
  const cb = s.combat;
  if (!cb) return '<p>No fight in progress.</p>' + button('Back to town', 'go', { to: 'town' });
  const m = MONSTER_BY_ID[cb.monsterId];
  const w = weaponOf(c);
  const max = maxHp(c);
  const foeAttacks = m.special.heads ? headsLeft(cb, m) : m.attacks.length;
  const foeDamage = m.special.heads ? rangeText(m.attacks[0].dmg) : m.attacks.map(a => rangeText(a.dmg)).join(' / ');

  let controls;
  if (cb.over) {
    const next = cb.result === 'death' ? 'dead' : cb.result === 'victory' && s.flags.captain && !s.flags.captainSeen ? 'captain' : 'town';
    const label = cb.result === 'death' ? 'Continue' : cb.result === 'victory' ? 'Collect your winnings' : 'Leave the arena';
    controls = `
      <div class="row">
        ${button(label, 'leave', { to: next }, { cls: 'primary' })}
        ${cb.result !== 'death' ? button(`Fight another ${esc(m.name)}`, 'again', {}, { cls: 'ghost' }) : ''}
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

  return `
    <section class="combat">
      <div class="combatants">
        <div class="fighter player">
          <div class="portrait" aria-hidden="true">🛡️</div>
          <h3>${esc(c.name)}</h3>
          <div class="hp-line"><span id="player-hp-text">${c.hp} / ${max}</span></div>
          <div id="player-hp">${bar(c.hp, max)}</div>
          <dl class="facts compact">
            <div><dt>AC</dt><dd>${armorClass(c)}</dd></div>
            <div><dt>Attacks</dt><dd>${attacksLabel(c.level)}</dd></div>
            <div><dt>${esc(w.name)}</dt><dd>${rangeText(w.dmg, damageBonus(c))}</dd></div>
          </dl>
          ${cb.paralyzed > 0 ? '<p class="tag bad">Paralyzed</p>' : ''}
        </div>
        <div class="versus" aria-hidden="true">vs</div>
        <div class="fighter monster">
          <div class="portrait" aria-hidden="true">${m.art}</div>
          <h3>${esc(m.name)}</h3>
          <div class="hp-line muted small">${cb.hp <= 0 ? 'Defeated' : ''}</div>
          <div id="monster-hp">${bar(cb.hp, cb.maxHp)}</div>
          <dl class="facts compact">
            <div><dt>AC</dt><dd>${m.ac}</dd></div>
            <div><dt>Attacks</dt><dd>${foeAttacks}</dd></div>
            <div><dt>Damage</dt><dd>${foeDamage}</dd></div>
          </dl>
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
  const names = { monster: MONSTER_BY_ID[s.combat.monsterId].name };
  const events = ctx.mutate(state => {
    const ev = playRound(state, action);
    state.combat.log.push(...describeAll(ev, names));
    if (state.combat.log.length > COMBAT_LOG_LIMIT) state.combat.log.splice(0, state.combat.log.length - COMBAT_LOG_LIMIT);
    return ev;
  });

  document.querySelectorAll('.combat-buttons button, .use-list button').forEach(b => { b.disabled = true; });
  const logEl = document.getElementById('combat-log');
  const max = maxHp(s.character);
  await presenter.play(events, {
    names,
    delay: DELAYS[s.settings.combatSpeed] ?? 0,
    log(line) {
      if (!logEl) return;
      logEl.insertAdjacentHTML('beforeend', logHtml([line]));
      logEl.scrollTop = logEl.scrollHeight;
    },
    setHp(side, hp) {
      const el = document.getElementById(`${side}-hp`);
      if (!el) return;
      el.innerHTML = side === 'player' ? bar(hp, Math.max(max, hp)) : bar(hp, s.combat.maxHp);
      if (side === 'player') {
        const t = document.getElementById('player-hp-text');
        if (t) t.textContent = `${hp} / ${maxHp(s.character)}`;
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
  surrender(ctx) {
    const s = ctx.state;
    const m = MONSTER_BY_ID[s.combat.monsterId];
    if (window.confirm(`Surrender to the ${m.name}? The arena fines you ${Math.min(s.character.gold, m.fine)} gold.`)) {
      act(ctx, { type: 'surrender' });
    }
  },
  leave(ctx, d) {
    ctx.mutate(s => { if (!s.character.dead) s.combat = null; });
    ctx.go(d.to);
  },
  again(ctx) {
    const id = ctx.state.combat.monsterId;
    ctx.mutate(s => startCombat(s, id));
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
    // First render of a new fight: log the opening line.
    ctx.mutate(s => { s.combat.log.push(...describeAll([{ t: 'start' }], { monster: MONSTER_BY_ID[s.combat.monsterId].name })); });
    logEl?.insertAdjacentHTML('beforeend', logHtml(ctx.state.combat.log));
  }
}
