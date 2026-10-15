import { INN_PRICE } from '../../rules/tables.js';
import { maxHp } from '../../rules/character.js';
import { innQuote, stayAtInn } from '../../rules/town.js';
import { button, backToTown, bar, gp } from '../format.js';

export function render(ctx) {
  const c = ctx.state.character;
  const max = maxHp(c);
  const q = innQuote(c);
  const fullText = q.missing <= 0
    ? 'You are fully rested.'
    : q.nights < q.missing
      ? `Healing fully takes ${q.missing} nights, but you can only pay for ${q.nights}.`
      : `Healing fully takes ${q.missing} night${q.missing === 1 ? '' : 's'} (${gp(q.cost)}).`;
  return `
    <section class="panel narrow">
      <h2>🛏️ The Griffin Inn</h2>
      <p class="muted">"A bed's ${INN_PRICE} gold a night, friend. You'll mend a little each night you sleep."</p>
      <p>Hit points: <strong>${c.hp} / ${max}</strong></p>
      ${bar(c.hp, max)}
      <p>${fullText}</p>
      <div class="row">
        ${button(`Stay one night (${gp(INN_PRICE)})`, 'night')}
        ${button('Stay until healed', 'full', {}, { cls: 'primary', disabled: q.nights <= 0 })}
      </div>
      <div class="row">${backToTown()}</div>
    </section>`;
}

export const actions = {
  night: ctx => ctx.commit(s => stayAtInn(s, 1)),
  full: ctx => ctx.commit(s => stayAtInn(s, Infinity)),
};

export const keys = {
  h: ctx => actions.full(ctx),
};
