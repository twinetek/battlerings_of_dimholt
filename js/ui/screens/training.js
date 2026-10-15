// The Training Yard: spend stat points earned from leveling.
// Points are staged with + and - first, then confirmed, because a raise
// can't be undone.

import { STATS, NATURAL_MAX, TOME_MAX, STAT_POINT_EVERY } from '../../rules/tables.js';
import { spendStatPoints } from '../../rules/character.js';
import { roomToGrow } from '../../rules/stats.js';
import { button, esc } from '../format.js';
import { bonusText } from '../stat-text.js';

const staged = params => params.alloc ?? {};
const stagedTotal = alloc => Object.values(alloc).reduce((a, b) => a + b, 0);

function nextPointLevel(level) {
  return (Math.floor(level / STAT_POINT_EVERY) + 1) * STAT_POINT_EVERY;
}

export function render(ctx, params) {
  const c = ctx.state.character;
  const alloc = staged(params);
  const total = c.statPoints.length;
  const left = total - stagedTotal(alloc);

  const rows = STATS.map(([key, label]) => {
    const add = alloc[key] ?? 0;
    const value = c.stats[key] + add;
    const atCap = add >= roomToGrow(c, key);
    const note = c.stats[key] >= NATURAL_MAX && c.stats[key] < TOME_MAX
      ? `Training stops at ${NATURAL_MAX}; Tomes go to ${TOME_MAX}`
      : c.stats[key] >= TOME_MAX ? 'At the maximum' : bonusText(key, value);
    return `
      <tr class="${add ? 'raised' : ''}">
        <td class="num stat">${value}</td>
        <th scope="row">${label}<span class="bonus">${esc(note)}</span></th>
        <td class="num gain">${add ? `+${add}` : ''}</td>
        <td class="act">
          ${button('−', 'less', { stat: key }, { cls: 'step', disabled: !add, title: `Lower ${label}` })}
          ${button('+', 'more', { stat: key }, { cls: 'step', disabled: left <= 0 || atCap, title: `Raise ${label}` })}
        </td>
      </tr>`;
  }).join('');

  return `
    <section class="panel narrow">
      <h2>🎯 Training Yard</h2>
      <p class="muted small">You earn a stat point every ${STAT_POINT_EVERY} levels. Training can raise any stat up to ${NATURAL_MAX};
        Tomes from the Magic Shop can take a stat as high as ${TOME_MAX}. Intelligence, Wisdom, and Charisma don't affect
        the game yet. Unspent points are kept for later.</p>
      <p class="points">Stat points to spend: <strong>${left}</strong>${total && left !== total ? ` <span class="muted small">of ${total}</span>` : ''}</p>
      ${total === 0 ? `<p class="muted">You have no points right now. Your next one comes at level ${nextPointLevel(c.level)}.</p>` : ''}
      <table class="stats roll-table train-table">
        <colgroup><col class="c-value"><col><col class="c-gain"><col class="c-act"></colgroup>
        <tbody>${rows}</tbody>
      </table>
      <div class="row">
        ${button('Confirm training', 'confirm', {}, { cls: 'primary', disabled: !stagedTotal(alloc) })}
        ${button('Reset', 'reset', {}, { cls: 'ghost', disabled: !stagedTotal(alloc) })}
      </div>
    </section>`;
}

export const actions = {
  more(ctx, d) {
    const alloc = { ...staged(ctx.params) };
    alloc[d.stat] = (alloc[d.stat] ?? 0) + 1;
    ctx.setParams({ alloc });
  },
  less(ctx, d) {
    const alloc = { ...staged(ctx.params) };
    alloc[d.stat] = Math.max(0, (alloc[d.stat] ?? 0) - 1);
    ctx.setParams({ alloc });
  },
  reset: ctx => ctx.setParams({ alloc: {} }),
  confirm(ctx) {
    const alloc = staged(ctx.params);
    const raised = STATS.filter(([k]) => alloc[k]).map(([k, label]) => [k, label]);
    const result = ctx.commit(s => spendStatPoints(s.character, alloc));
    if (!result.ok) return;
    const c = ctx.state.character;
    ctx.flash(`Training pays off: ${raised.map(([k, label]) => `${label} ${c.stats[k]}`).join(', ')}.`);
    ctx.setParams({ alloc: {} });
  },
};
