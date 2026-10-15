// Character creation: roll 3d6 for each stat, reroll as often as you like.

import { rollStats, createCharacter, maxHp, armorClass } from '../../rules/character.js';
import { newGameState } from '../../engine/state.js';
import { STATS } from '../../rules/tables.js';
import { button, esc } from '../format.js';
import { bonusText } from '../stat-text.js';

export function render(ctx, params) {
  if (!params.stats) {
    params.stats = rollStats();
    params.rolls = 1;
  }
  const s = params.stats;
  const preview = createCharacter('x', s);
  const rows = STATS.map(([key, label]) => `
    <tr>
      <td class="num stat">${s[key]}</td>
      <th scope="row">${label}<span class="bonus">${bonusText(key, s[key])}</span></th>
    </tr>`).join('');
  return `
    <section class="panel narrow">
      <h2>Create your gladiator</h2>
      <label class="field">Name
        <input id="hero-name" type="text" maxlength="24" autocomplete="off" value="${esc(params.name ?? 'Derek')}">
      </label>
      <p class="muted small">Only Strength, Dexterity, and Constitution affect the game, and their bonuses start at 15.</p>
      <table class="stats roll-table">
        <colgroup><col class="c-value"><col></colgroup>
        <tbody>${rows}</tbody>
      </table>
      <dl class="facts roll-summary">
        <div><dt>Starting hit points</dt><dd>${maxHp(preview)}</dd></div>
        <div><dt>Armor class</dt><dd>${armorClass(preview)}</dd></div>
      </dl>
      <div class="row">
        ${button('🎲 Reroll', 'reroll', {}, { title: 'Shortcut: R' })}
        <span class="muted small rolls">Rolls: ${params.rolls}</span>
      </div>
      <div class="row">
        ${button('Begin', 'begin', {}, { cls: 'primary' })}
        ${button('Cancel', 'go', { to: 'title' }, { cls: 'ghost' })}
      </div>
    </section>`;
}

const nameValue = () => document.getElementById('hero-name')?.value ?? '';

export const actions = {
  reroll(ctx) {
    ctx.setParams({ stats: rollStats(), rolls: ctx.params.rolls + 1, name: nameValue() });
  },
  begin(ctx) {
    const c = createCharacter(nameValue(), ctx.params.stats);
    ctx.start(newGameState(c));
    ctx.flash(`Welcome to Dimholt, ${c.name}. You have ${c.gold} gold to your name. Buy a weapon and some armor before you fight.`);
    ctx.render();
  },
};

export const keys = {
  r: ctx => actions.reroll(ctx),
};

export function mount(ctx, root) {
  root.querySelector('#hero-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') actions.begin(ctx);
  });
}
