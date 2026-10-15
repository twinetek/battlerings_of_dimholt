// The opponent dialog: pick a foe, read its details, enter the arena.

import { MONSTERS, MONSTER_BY_ID } from '../../data/monsters.js';
import { weaponOf, armorClass, rollToHit, maxHp } from '../../rules/character.js';
import { startCombat, canHurt } from '../../rules/combat.js';
import { rangeText } from '../../engine/dice.js';
import { button, backToTown, esc, gp, d20Chance } from '../format.js';
import { confirmPoisoned } from './combat.js';

export function specialText(m) {
  const notes = [];
  if (m.special.paralyze) notes.push('Paralyzing touch');
  if (m.special.drain) notes.push('Drains levels');
  if (m.special.regen) notes.push(`Regenerates ${m.special.regen} hp a round`);
  if (m.special.heads) notes.push(`${m.special.heads} heads, one attack each`);
  if (m.breath) notes.push(`Breathes ${m.breath.name}`);
  if (m.immune.length) notes.push(`Immune to ${m.immune.join(', ')}`);
  for (const a of m.attacks.filter(x => x.poison)) notes.push(`Poison ${a.poison} on its ${a.name}`);
  return notes.join('. ') || 'None';
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
      <div class="row">${button(`Fight the ${esc(m.name)}`, 'fight', { id: m.id }, { cls: 'primary' })}</div>
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
      <div class="row">${backToTown()}</div>
    </section>`;
}

export const actions = {
  select: (ctx, d) => ctx.setParams({ id: d.id }),
  fight(ctx, d) {
    if (!confirmPoisoned(ctx.state.character)) return;
    ctx.mutate(s => {
      s.lastFoe = d.id;
      startCombat(s, d.id);
    });
    ctx.go('combat');
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
