// The hex battlefield screen (beta). Same fights as the classic combat screen
// (rules/combat.js), on a grid (rules/battlefield.js), plus tester controls
// for setting up scenarios.

import { MONSTERS, MONSTER_BY_ID } from '../../data/monsters.js';
import { MERCS, MERC_BY_ID } from '../../data/mercs.js';
import { ITEM_BY_ID } from '../../data/equipment.js';
import { maxHp, armorClass, weaponEntry, rollToHit } from '../../rules/character.js';
import { playRound, setTarget, openingEvents, inReach, PLAYER } from '../../rules/combat.js';
import {
  DEFAULT_FIELD, boardHexes, isPillar, livingUnits, occupant, reachableFor, threatZone, moveOf,
  moveYou, actYou, endTurn, autoYou, testerAddEnemy, testerAddMerc, testerHeal, testerRebuild,
} from '../../rules/battlefield.js';
import * as H from '../../engine/hex.js';
import { COMBAT_LOG_LIMIT } from '../../rules/tables.js';
import { toLines, describeAll, SUMMARIZE_ABOVE } from '../presenter.js';
import { button, esc, gp } from '../format.js';
import { itemLabel, coatingTag } from './shops.js';
import { actions as combatActions } from './combat.js';

const SIZE = 30;
const DELAYS = { instant: 0, fast: 60, normal: 160 };
let busy = false;
let skipping = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const field = s => s.settings.battle ?? DEFAULT_FIELD;
const showThreat = s => s.settings.battleThreat ?? true;
const summarize = cb => cb.hired > SUMMARIZE_ABOVE;

function unitInfo(s, uid) {
  const c = s.character;
  const cb = s.combat;
  if (uid === PLAYER) {
    return { uid, side: 'you', name: c.name, art: '🛡️', hp: c.hp, max: maxHp(c), ac: armorClass(c),
      poison: c.poison, paralyzed: cb.paralyzed };
  }
  const a = cb.allies.find(x => x.uid === uid);
  if (a) {
    const t = MERC_BY_ID[a.mercId];
    return { uid, side: 'ally', name: a.name, art: t.art, hp: a.hp, max: a.maxHp, ac: t.ac, poison: a.poison, paralyzed: a.paralyzed };
  }
  const e = cb.enemies.find(x => x.uid === uid);
  const m = MONSTER_BY_ID[e.monsterId];
  return { uid, side: 'enemy', name: e.name, art: m.art, hp: e.hp, max: e.maxHp, ac: m.ac, poison: e.poison ?? 0, paralyzed: 0 };
}

const yourTurn = s => !s.combat.over && !busy;

// ---- Board ----

function boardSvg(s, params) {
  const cb = s.combat;
  const pos = cb.grid.pos;
  const me = pos[PLAYER];
  const canMove = yourTurn(s) && !cb.turn.moved && cb.paralyzed === 0;
  const canAct = yourTurn(s) && !cb.turn.acted && cb.paralyzed === 0;
  const reach = canMove ? reachableFor(s, PLAYER) : new Map();
  const hover = params.hover ? H.fromKey(params.hover) : null;
  const pathKeys = hover && reach.has(params.hover) && !occupant(s, hover)
    ? new Set((H.pathToHex(me, hover, h => reach.has(H.key(h))) ?? []).map(H.key))
    : new Set();
  const threat = showThreat(s) && !cb.over ? threatZone(s) : new Set();
  const hexes = boardHexes(cb);

  const cells = hexes.map(h => {
    const k = H.key(h);
    const who = occupant(s, h);
    const cls = ['cell'];
    if (isPillar(cb, h)) cls.push('pillar');
    else if (who?.startsWith('e') && canAct && inReach(cb, PLAYER, who)) cls.push('attackable');
    else if (pathKeys.has(k)) cls.push('path');
    else if (!who && reach.has(k) && reach.get(k) > 0) cls.push('reach');
    else if (threat.has(k)) cls.push('threat');
    if (who === cb.target && !cb.over) cls.push('targeted');
    const pts = H.corners(H.toPixel(h, SIZE), SIZE - 1).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const tip = who ? unitTip(s, who) : '';
    return `<polygon class="${cls.join(' ')}" points="${pts}" data-action="hex" data-key="${k}">${tip ? `<title>${esc(tip)}</title>` : ''}</polygon>`;
  }).join('');

  const rocks = cb.grid.pillars.map(k => {
    const p = H.toPixel(H.fromKey(k), SIZE);
    return `<text class="pillar-mark" x="${p.x}" y="${p.y}">🪨</text>`;
  }).join('');

  const units = livingUnits(s).map(({ uid }) => {
    const u = unitInfo(s, uid);
    const p = H.toPixel(pos[uid], SIZE);
    const w = SIZE * 1.2;
    return `
      <g class="unit-g" id="unit-${uid}" transform="translate(${p.x},${p.y})">
        <circle class="ring ${u.side}" r="${SIZE * 0.78}"></circle>
        <text class="unit" y="-2">${u.art}</text>
        <rect class="hpbg" x="${-w / 2}" y="${SIZE * 0.5}" width="${w}" height="5" rx="2"></rect>
        <rect class="hp ${u.side}" id="hpbar-${uid}" x="${-w / 2}" y="${SIZE * 0.5}" width="${w * Math.max(0, u.hp) / u.max}" height="5" rx="2"></rect>
        ${u.poison > 0 ? `<text class="badge" x="${SIZE * 0.55}" y="${-SIZE * 0.45}">☠</text>` : ''}
        ${u.paralyzed > 0 ? `<text class="badge" x="${-SIZE * 0.55}" y="${-SIZE * 0.45}">💤</text>` : ''}
      </g>`;
  }).join('');

  const pts = hexes.map(h => H.toPixel(h, SIZE));
  const minX = Math.min(...pts.map(p => p.x)) - SIZE, maxX = Math.max(...pts.map(p => p.x)) + SIZE;
  const minY = Math.min(...pts.map(p => p.y)) - SIZE, maxY = Math.max(...pts.map(p => p.y)) + SIZE;
  return `<svg id="board" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="img" aria-label="Battlefield">${cells}${rocks}${units}</svg>`;
}

function unitTip(s, uid) {
  const u = unitInfo(s, uid);
  const me = unitInfo(s, PLAYER);
  let tip = `${u.name}: ${u.hp}/${u.max} hp, AC ${u.ac}, moves ${moveOf(s.combat, uid)}`;
  if (u.side === 'enemy') {
    const m = MONSTER_BY_ID[s.combat.enemies.find(e => e.uid === uid).monsterId];
    const youNeed = Math.min(20, Math.max(2, rollNeed(s, m.ac)));
    const itNeeds = Math.min(20, Math.max(2, m.thac0 - me.ac));
    tip += `. You hit it ${Math.round(((21 - youNeed) / 20) * 100)}%, it hits you ${Math.round(((21 - itNeeds) / 20) * 100)}%`;
  }
  return tip;
}

// The d20 roll you need against an AC, with your bonuses (same as the arena screen).
const rollNeed = (s, ac) => rollToHit(s.character, ac);

// ---- Side panels ----

function roster(s) {
  const cb = s.combat;
  const all = [PLAYER, ...cb.allies.map(a => a.uid), ...cb.enemies.map(e => e.uid)].map(uid => unitInfo(s, uid));
  return `<table class="roster"><tbody>${all.map(u => `
    <tr class="${u.hp <= 0 ? 'muted' : ''}${u.uid === cb.target && !cb.over ? ' is-target' : ''}">
      <td><span class="dot ${u.side}"></span>${u.art} ${esc(u.name)}${u.uid === cb.target && !cb.over ? ' 🎯' : ''}</td>
      <td class="num">${Math.max(0, u.hp)}/${u.max}</td>
      <td class="num">AC ${u.ac}</td>
      <td class="num">Move ${moveOf(cb, u.uid)}</td>
      <td>${u.poison > 0 && u.hp > 0 ? `<span class="tag bad">☠ ${u.poison}</span>` : ''}${u.paralyzed > 0 && u.hp > 0 ? ' <span class="tag bad">Paralyzed</span>' : ''}</td>
    </tr>`).join('')}</tbody></table>`;
}

function testerPanel(s) {
  const f = field(s);
  const over = s.combat.over;
  return `
    <div class="panel tester">
      <h3>🧪 Tester controls</h3>
      <p class="muted small">Beta tools for setting up scenarios. They bend the rules: added enemies count as summoned helpers
        (experience, no gold), added mercenaries are free.</p>
      <label class="field small">Add an enemy
        <span class="row tight"><select id="tester-monster">${MONSTERS.map(m => `<option value="${m.id}"${m.id === s.combat.monsterId ? ' selected' : ''}>${m.art} ${esc(m.name)}</option>`).join('')}</select>
        ${button('Add', 'addEnemy', {}, { cls: 'small', disabled: over || busy })}</span></label>
      <label class="field small">Add a mercenary (free)
        <span class="row tight"><select id="tester-merc">${MERCS.map(m => `<option value="${m.id}">${m.art} ${esc(m.name)}</option>`).join('')}</select>
        ${button('Add', 'addMerc', {}, { cls: 'small', disabled: over || busy })}</span></label>
      <div class="row tight">${button('Heal me to full', 'heal', {}, { cls: 'small', disabled: over || busy })}</div>
      <label class="field small">Arena radius <input id="tester-radius" type="number" min="3" max="9" value="${f.radius}"></label>
      <label class="small"><input id="tester-pillars" type="checkbox"${f.pillars ? ' checked' : ''}> Pillars</label>
      <div class="row tight">${button('Rebuild battlefield', 'rebuild', {}, { cls: 'small', disabled: over || busy })}</div>
      <label class="small"><input type="checkbox" data-action="threat"${showThreat(s) ? ' checked' : ''}> Show enemy threat zone</label>
      <div class="row tight">
        ${button('Auto-play my turn', 'autoTurn', {}, { cls: 'small', disabled: over || busy })}
        ${button('Auto-play the fight', 'autoFight', {}, { cls: 'small', disabled: over || busy })}
      </div>
    </div>`;
}

function hintText(s) {
  const cb = s.combat;
  if (cb.over) return '';
  if (busy) return 'Others are acting…';
  if (cb.paralyzed > 0) return 'You are paralyzed. End your turn.';
  const t = cb.turn;
  if (t.moved && t.acted) return 'You have moved and acted. End your turn.';
  if (t.moved) return 'Attack an adjacent enemy (red), use an item, or end your turn.';
  if (t.acted) return 'You can still move (blue hexes), then end your turn.';
  return 'Move (blue hexes) and attack an adjacent enemy (red), in either order. Click any enemy to make it your target.';
}

// ---- Render ----

export function render(ctx, params) {
  const s = ctx.state;
  const c = s.character;
  const cb = s.combat;
  if (!cb?.grid) return `<p>No battle in progress.</p>${button('Back to town', 'go', { to: 'town' })}`;
  const m = MONSTER_BY_ID[cb.monsterId];

  let controls;
  if (cb.over) {
    const next = cb.result === 'death' ? 'dead' : cb.result === 'victory' && s.flags.captain && !s.flags.captainSeen ? 'captain' : 'town';
    const label = cb.result === 'death' ? 'Continue' : cb.result === 'victory' ? 'Collect your winnings' : 'Leave the arena';
    const wages = Object.entries(cb.crew).reduce((sum, [id, n]) => sum + MERC_BY_ID[id].wage * n, 0);
    controls = `
      <div class="row">
        ${button(label, 'leave', { to: next }, { cls: 'primary' })}
        ${cb.result !== 'death' ? button(`Fight another ${esc(m.name)}${wages ? ' alone' : ''}`, 'again', { crew: 'none' }, { cls: 'ghost' }) : ''}
        ${cb.result !== 'death' && wages ? button(`…with the same crew (${gp(wages)})`, 'again', { crew: 'same' }, { cls: 'ghost', disabled: c.gold < wages }) : ''}
      </div>`;
  } else if (params.picking) {
    const items = c.items.map((entry, index) => ({ entry, index, it: ITEM_BY_ID[entry.id] })).filter(x => x.it.use === 'combat' || x.it.use === 'any');
    controls = `
      <div class="panel use-list">
        <h3>Use which item?</h3>
        <p class="muted small">Wands and the fiery potion reach your target (🎯) anywhere on the field.</p>
        ${items.length
          ? `<ul class="list">${items.map(x => `<li><span>${itemLabel(x.entry)} <span class="muted small">${esc(x.it.effect)}</span></span>${button('Use', 'use', { index: x.index }, { cls: 'small' })}</li>`).join('')}</ul>`
          : '<p class="muted">You have nothing you can use in combat.</p>'}
        ${button('Cancel', 'cancelUse', {}, { cls: 'ghost' })}
      </div>`;
  } else {
    const stuck = cb.paralyzed > 0;
    controls = `
      <div class="row battle-buttons">
        ${button('End turn', 'endTurn', {}, { cls: 'primary', disabled: busy, title: 'Shortcut: E' })}
        ${button('🧪 Use item', 'pickItem', {}, { disabled: busy || stuck || cb.turn.acted })}
        ${button(`🏳️ Surrender (${gp(Math.min(c.gold, m.fine))})`, 'surrender', {}, { cls: 'ghost', disabled: busy })}
      </div>`;
  }

  const venom = coatingTag(s, weaponEntry(c));
  return `
    <section class="battle">
      <p class="beta-note small">Beta: the hex battlefield. Round ${cb.round}.${venom ? ` Blade venom:${venom}` : ''}</p>
      <div class="battle-grid">
        <div>
          <div class="board-wrap">${boardSvg(s, params)}</div>
          <p class="hint" id="hint">${esc(hintText(s))}</p>
          ${controls}
          <ol class="log" id="combat-log" aria-live="polite">${cb.log.map(l => `<li class="${l.cls}">${esc(l.text)}</li>`).join('')}</ol>
          <p class="muted small row">Speed:
            ${['instant', 'fast', 'normal'].map(sp => button(sp, 'speed', { speed: sp }, { cls: `link${s.settings.combatSpeed === sp ? ' on' : ''}` })).join(' ')}</p>
        </div>
        <aside>
          <div class="panel"><h3>Fighters</h3><div class="table-wrap">${roster(s)}</div>
            <p class="muted small">Legend: blue hexes, where you can move · red, an enemy you can attack ·
              amber, where an enemy could reach and strike this round · 🪨 pillar.</p></div>
          ${testerPanel(s)}
        </aside>
      </div>
    </section>`;
}

// ---- Playing events on the board ----

function trimLog(cb) {
  if (cb.log.length > COMBAT_LOG_LIMIT) cb.log.splice(0, cb.log.length - COMBAT_LOG_LIMIT);
}

async function play(s, events) {
  const delay = DELAYS[s.settings.combatSpeed] ?? 0;
  const opts = { summarize: summarize(s.combat) };
  const logEl = document.getElementById('combat-log');
  const flush = async chunk => {
    for (const line of toLines(chunk, opts)) {
      for (const { uid, hp } of line.hp) {
        const bar = document.getElementById(`hpbar-${uid}`);
        if (!bar) continue;
        const full = Number(bar.previousElementSibling.getAttribute('width'));
        const max = uid === PLAYER ? maxHp(s.character) : [...s.combat.allies, ...s.combat.enemies].find(u => u.uid === uid)?.maxHp ?? 1;
        bar.setAttribute('width', String(full * Math.max(0, hp) / max));
      }
      logEl?.insertAdjacentHTML('beforeend', `<li class="${line.cls}">${esc(line.text)}</li>`);
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
      if (delay && !skipping) await sleep(line.cls === 'round' ? delay / 2 : delay);
    }
  };
  let chunk = [];
  for (const e of events) {
    if (e.t !== 'move') {
      chunk.push(e);
      continue;
    }
    await flush(chunk);
    chunk = [];
    const g = document.getElementById(`unit-${e.uid}`);
    for (const h of e.path) {
      const p = H.toPixel(h, SIZE);
      g?.setAttribute('transform', `translate(${p.x},${p.y})`);
      if (delay && !skipping) await sleep(Math.max(50, delay * 0.6));
    }
  }
  await flush(chunk);
}

// Run a rules call, log its events, animate them, then re-render.
async function run(ctx, fn) {
  if (busy) {
    skipping = true;
    return { ok: false };
  }
  const s = ctx.state;
  if (!s.combat || s.combat.over) return { ok: false };
  const r = ctx.mutate(state => {
    const result = fn(state);
    if (result.ok) {
      state.combat.log.push(...describeAll(result.events, { summarize: summarize(state.combat) }));
      trimLog(state.combat);
    }
    return result;
  });
  if (!r.ok) {
    if (r.msg) {
      const hint = document.getElementById('hint');
      if (hint) hint.textContent = r.msg;
    }
    return r;
  }
  busy = true;
  skipping = false;
  document.querySelectorAll('.battle button').forEach(b => { b.disabled = true; });
  await play(s, r.events);
  busy = false;
  ctx.setParams({ picking: false, hover: null });
  return r;
}

// ---- Actions ----

export const actions = {
  hex(ctx, d) {
    const s = ctx.state;
    const cb = s.combat;
    if (busy || cb.over) return;
    const h = H.fromKey(d.key);
    const who = occupant(s, h);
    if (who?.startsWith('e')) {
      if (!cb.turn.acted && cb.paralyzed === 0 && inReach(cb, PLAYER, who)) {
        run(ctx, st => actYou(st, { type: 'fight', target: who }));
      } else {
        ctx.mutate(st => setTarget(st.combat, who));
        ctx.render();
        const hint = document.getElementById('hint');
        if (hint) hint.textContent = `Target set: ${unitInfo(s, who).name}. Your mercenaries and wands will aim at it.`;
      }
      return;
    }
    if (!who) run(ctx, st => moveYou(st, h));
  },
  endTurn: ctx => run(ctx, endTurn),
  async autoTurn(ctx) {
    const r = await run(ctx, autoYou);
    if (r.ok && !ctx.state.combat.over) await run(ctx, endTurn);
  },
  async autoFight(ctx) {
    for (let i = 0; i < 200 && ctx.state.combat && !ctx.state.combat.over; i++) {
      const r = await run(ctx, autoYou);
      if (!r.ok) break;
      if (!ctx.state.combat.over) await run(ctx, endTurn);
    }
  },
  pickItem: ctx => ctx.setParams({ picking: true }),
  cancelUse: ctx => ctx.setParams({ picking: false }),
  use: (ctx, d) => run(ctx, st => actYou(st, { type: 'use', index: Number(d.index) })),
  surrender(ctx) {
    const s = ctx.state;
    const m = MONSTER_BY_ID[s.combat.monsterId];
    if (window.confirm(`Surrender to the ${m.name}? The arena fines you ${Math.min(s.character.gold, m.fine)} gold.`)) {
      run(ctx, st => ({ ok: true, events: playRound(st, { type: 'surrender' }) }));
    }
  },
  leave: combatActions.leave,
  again: combatActions.again,
  speed: combatActions.speed,

  // Tester controls
  addEnemy: ctx => run(ctx, st => testerAddEnemy(st, document.getElementById('tester-monster').value)),
  addMerc: ctx => run(ctx, st => testerAddMerc(st, document.getElementById('tester-merc').value)),
  heal: ctx => run(ctx, testerHeal),
  rebuild(ctx) {
    const f = {
      radius: Math.max(3, Math.min(9, Number(document.getElementById('tester-radius').value) || DEFAULT_FIELD.radius)),
      pillars: document.getElementById('tester-pillars').checked,
    };
    ctx.mutate(st => { st.settings.battle = f; });
    run(ctx, st => testerRebuild(st, f));
  },
  threat(ctx) {
    ctx.commit(st => { st.settings.battleThreat = !showThreat(st); });
  },
};

export const keys = {
  e: ctx => (ctx.state.combat?.over ? null : actions.endTurn(ctx)),
};

export function mount(ctx, root) {
  const s = ctx.state;
  const logEl = root.querySelector('#combat-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
  if (s.combat && !s.combat.log.length) {
    ctx.mutate(st => { st.combat.log.push(...describeAll([...openingEvents(st), { t: 'round', n: st.combat.round }])); });
    logEl?.insertAdjacentHTML('beforeend', s.combat.log.map(l => `<li class="${l.cls}">${esc(l.text)}</li>`).join(''));
  }
  // Hovering a hex you can reach previews the path.
  root.querySelector('#board')?.addEventListener('mouseover', e => {
    const k = e.target.closest('[data-key]')?.dataset.key ?? null;
    const cb = ctx.state.combat;
    if (busy || !cb || cb.over || cb.turn.moved || k === (ctx.params.hover ?? null)) return;
    ctx.setParams({ hover: k });
  });
}
