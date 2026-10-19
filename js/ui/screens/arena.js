// The opponent dialog: pick a foe, read its details, enter the arena.

import { MONSTERS, MONSTER_BY_ID } from '../../data/monsters.js';
import { weaponOf, armorClass, rollToHit, maxHp } from '../../rules/character.js';
import { startCombat, canHurt, summonKind } from '../../rules/combat.js';
import { MERCS, crewCost, crewSize, crewText } from '../../data/mercs.js';
import { LOOT_BY_ID } from '../../data/loot.js';
import { rangeText } from '../../engine/dice.js';
import { button, backToTown, esc, gp, d20Chance } from '../format.js';
import { confirmPoisoned } from './combat.js';
import { beginFight } from '../fight.js';

export function specialText(m) {
  const notes = [];
  if (m.special.paralyze) notes.push('Paralyzing touch');
  if (m.special.drain) notes.push('Drains levels');
  if (m.special.regen) notes.push(`Regenerates ${m.special.regen} hp a round`);
  if (m.special.heads) notes.push(`${m.special.heads} heads, one attack each`);
  if (m.breath) notes.push(`Breathes ${m.breath.name}`);
  if (m.immune.length) notes.push(`Immune to ${m.immune.join(', ')}`);
  if (m.resist.length) notes.push(`Resists ${m.resist.join(', ')} (half damage)`);
  for (const a of m.attacks.filter(x => x.poison)) notes.push(`Poison ${a.poison} on its ${a.name}`);
  for (const drop of m.loot) notes.push(`May drop a ${LOOT_BY_ID[drop.item].name} (${Math.round(drop.chance * 100)}%)`);
  if (m.calls) {
    const kind = MONSTER_BY_ID[summonKind(m)].name;
    notes.push(m.calls === 'arena' ? `With mercenaries: the arena sends a ${kind}` : `With mercenaries: calls ${kind}s`);
  }
  return notes.join('. ') || 'None';
}

export function callsText(m) {
  if (!m.calls) return '';
  const kind = MONSTER_BY_ID[summonKind(m)].name;
  return m.calls === 'arena'
    ? `If you bring mercenaries, the arena master sends in a ${kind}`
    : `If you bring mercenaries, it calls ${m.calls === 'kin' ? 'its own kind' : `${kind}s`} for help`;
}

const staged = params => params.crew ?? {};

function hirePanel(ctx, m, crew) {
  const c = ctx.state.character;
  const n = crewSize(crew);
  const cost = crewCost(crew);
  const rows = MERCS.map(t => {
    const count = crew[t.id] ?? 0;
    const cantHurt = t.weapon.plus < m.magicReq;
    return `
      <tr>
        <td><span aria-hidden="true">${t.art}</span> ${esc(t.name)}${cantHurt ? ` <span class="tag bad">can't hurt it</span>` : ''}
          <span class="muted small block">${esc(t.desc)}</span></td>
        <td class="num">${t.hp}</td>
        <td class="num">${t.ac}</td>
        <td class="num">${rangeText(t.weapon.dmg, t.weapon.plus + t.dmgBonus)}</td>
        <td class="num">${gp(t.wage)}</td>
        <td class="act">
          ${button('−', 'fewer', { merc: t.id }, { cls: 'step', disabled: !count, title: `One fewer ${t.name}` })}
          <span class="count">${count}</span>
          ${button('+', 'more', { merc: t.id }, { cls: 'step', disabled: c.gold < cost + t.wage, title: `Hire a ${t.name}` })}
        </td>
      </tr>`;
  }).join('');
  const last = ctx.state.lastCrew;
  return `
    <div class="panel hire">
      <h3>Hire help <span class="muted small">(optional, paid per fight)</span></h3>
      <p class="muted small">Mercenaries fight beside you for one fight, then leave. Wages are paid up front and aren't refunded.
        Experience is split evenly among everyone who fights, and the mercenaries' shares are lost.
        ${m.calls ? `<strong>${esc(callsText(m))}</strong>, up to one helper per mercenary.` : `The ${esc(m.name)} never calls for help.`}</p>
      <div class="table-wrap"><table class="hire-table">
        <thead><tr><th>Mercenary</th><th class="num">HP</th><th class="num">AC</th><th class="num">Damage</th><th class="num">Wage</th><th class="act">Hire</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p>${n
        ? `Crew: ${esc(crewText(crew))}. Wages <strong>${gp(cost)}</strong> against an award of ${gp(m.gold)}. You'd earn 1/${n + 1} of the experience.`
        : 'No crew: you fight alone and keep all the experience.'}
        ${n ? button('Clear', 'clearCrew', {}, { cls: 'link small' }) : ''}
        ${!n && last && crewSize(last) ? button(`Same crew as last time (${gp(crewCost(last))})`, 'lastCrew', {}, { cls: 'link small', disabled: c.gold < crewCost(last) }) : ''}</p>
    </div>`;
}

function fightButton(ctx, m) {
  const crew = staged(ctx.params);
  const n = crewSize(crew);
  const cost = crewCost(crew);
  const label = n ? `Fight the ${esc(m.name)} with ${n} mercenar${n === 1 ? 'y' : 'ies'} (${gp(cost)})` : `Fight the ${esc(m.name)}`;
  return button(label, 'fight', { id: m.id }, { cls: 'primary', disabled: cost > ctx.state.character.gold });
}

function details(ctx, m) {
  const c = ctx.state.character;
  const w = weaponOf(c);
  const hurt = canHurt(c, m);
  const youHit = d20Chance(rollToHit(c, m.ac, w));
  const itHits = d20Chance(m.thac0 - armorClass(c));
  const attacks = m.special.heads
    ? `${m.special.heads} × ${rangeText(m.attacks[0].dmg)}`
    : m.attacks.map(a => rangeText(a.dmg)).join(' / ');
  const lowHp = c.hp < maxHp(c) / 2;
  return `
    <div class="foe-card">
      <div class="portrait" aria-hidden="true">${m.art}</div>
      <h3>${esc(m.name)}</h3>
      <p class="muted">${esc(m.desc)}</p>
      <dl class="facts">
        <div><dt>Armor class</dt><dd>${m.ac}</dd></div>
        <div><dt>Hit dice</dt><dd>${m.hpFixed ? `${m.hpFixed} hp` : m.hp}</dd></div>
        <div><dt>Attacks per round</dt><dd>${m.special.heads ? m.special.heads : m.attacks.length}</dd></div>
        <div><dt>Damage</dt><dd>${attacks}</dd></div>
        <div><dt>Magic weapon req.</dt><dd>${m.magicReq ? `+${m.magicReq}` : 'No'}</dd></div>
        <div><dt>Special</dt><dd>${specialText(m)}</dd></div>
        <div><dt>Experience</dt><dd>${m.xp.toLocaleString()}</dd></div>
        <div><dt>Award</dt><dd>${gp(m.gold)}</dd></div>
        <div><dt>Surrender fine</dt><dd>${gp(m.fine)}</dd></div>
        <div><dt>Times beaten</dt><dd>${c.wins[m.id] ?? 0}</dd></div>
      </dl>
      <p class="small">${hurt
        ? `With your ${esc(w.name)} you hit it about <strong>${youHit}%</strong> of the time. It hits you about <strong>${itHits}%</strong> of the time.`
        : `<span class="warn-text">Your ${esc(w.name)} can't harm it. You need a +${m.magicReq} weapon or offensive magic.</span>`}</p>
      ${lowHp ? '<p class="small warn-text">You are badly hurt. Consider a night at the inn first.</p>' : ''}
      ${c.poison > 0 ? `<p class="small warn-text">☠ You are still poisoned (strength ${c.poison}). It will keep hurting you every round. Cure it with a Potion of Neutralize Poison or a night at the inn.</p>` : ''}
      <div class="row">${fightButton(ctx, m)}</div>
    </div>`;
}

export function render(ctx, params) {
  const c = ctx.state.character;
  const selected = MONSTER_BY_ID[params.id] ?? MONSTER_BY_ID[ctx.state.lastFoe] ?? MONSTERS[0];
  const rows = MONSTERS.map(m => `
    <tr class="${m.id === selected.id ? 'selected' : ''}" data-action="select" data-id="${m.id}" tabindex="0">
      <td><span aria-hidden="true">${m.art}</span> ${esc(m.name)}${c.wins[m.id] ? ' <span class="tag">✓</span>' : ''}</td>
      <td class="num">${m.xp.toLocaleString()}</td>
      <td class="num">${m.gold.toLocaleString()}</td>
    </tr>`).join('');
  return `
    <section>
      <h2>⚔️ The Battlerings</h2>
      <p class="muted">Opponents are listed from weakest to strongest. Choose carefully: you can surrender mid-fight, but the arena fines you. ${button('Full monster stats in the Guide', 'go', { to: 'guide' }, { cls: 'link small' })}</p>
      <div class="cols arena-cols">
        <div class="panel">
          <div class="table-wrap"><table class="foes">
            <thead><tr><th>Opponent</th><th class="num">XP</th><th class="num">Award</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
        <div class="panel">${details(ctx, selected)}</div>
      </div>
      ${hirePanel(ctx, selected, staged(params))}
      <div class="row">${backToTown()}</div>
    </section>`;
}

export const actions = {
  select: (ctx, d) => ctx.setParams({ id: d.id }),
  more(ctx, d) {
    const crew = { ...staged(ctx.params) };
    crew[d.merc] = (crew[d.merc] ?? 0) + 1;
    ctx.setParams({ crew });
  },
  fewer(ctx, d) {
    const crew = { ...staged(ctx.params) };
    crew[d.merc] = Math.max(0, (crew[d.merc] ?? 0) - 1);
    if (!crew[d.merc]) delete crew[d.merc];
    ctx.setParams({ crew });
  },
  clearCrew: ctx => ctx.setParams({ crew: {} }),
  lastCrew: ctx => ctx.setParams({ crew: { ...ctx.state.lastCrew } }),
  fight(ctx, d) {
    if (!confirmPoisoned(ctx.state.character)) return;
    beginFight(ctx, d.id, staged(ctx.params));
  },
};

export function mount(ctx, root) {
  root.querySelectorAll('tr[data-action="select"]').forEach(tr => {
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ctx.setParams({ id: tr.dataset.id });
      }
    });
  });
}
