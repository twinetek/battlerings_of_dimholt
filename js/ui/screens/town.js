// The town map. For v0.1 it's a grid of buildings; later it can become a
// drawn map with clickable buildings, like the original's main window.

import { button } from '../format.js';

const PLACES = [
  { to: 'arena',     icon: '⚔️', name: 'The Battlerings', desc: 'Choose a foe and fight for gold and glory.' },
  { to: 'weapons',   icon: '🗡️', name: 'Weaponsmith',     desc: 'Blades, axes, and enchanted steel.' },
  { to: 'armor',     icon: '🛡️', name: 'Armorer',         desc: 'Trade up your armor.' },
  { to: 'magic',     icon: '🔮', name: 'Magic Shop',      desc: 'Potions, rings, wands, and tomes.' },
  { to: 'inn',       icon: '🛏️', name: 'The Griffin Inn', desc: 'Sleep to heal your wounds.' },
  { to: 'training',  icon: '🎯', name: 'Training Yard',   desc: 'Spend stat points earned from leveling.' },
  { to: 'character', icon: '📜', name: 'Equipment',       desc: 'Stats, gear, and items.' },
  { to: 'saves',     icon: '💾', name: 'Save / Load',     desc: 'Save slots and file backups.' },
  { to: 'guide',     icon: '📖', name: 'Guide',           desc: 'Rules, stats, monsters, and gear.' },
];

export function render(ctx) {
  const captain = ctx.state.flags.captain;
  const points = ctx.state.character.statPoints.length;
  return `
    <section>
      <h2>The City of Dimholt</h2>
      <p class="muted">${captain
        ? 'The guards salute as you pass. The arena is still open if you want more glory.'
        : 'The roar of the Battlerings carries over the rooftops. Where will you go?'}</p>
      <div class="town-map">
        ${PLACES.map(p => `
          <button type="button" class="place" data-action="go" data-to="${p.to}">
            <span class="place-icon" aria-hidden="true">${p.icon}</span>
            <span class="place-name">${p.name}${p.to === 'training' && points ? ` <span class="tag">${points} to spend</span>` : ''}</span>
            <span class="place-desc">${p.desc}</span>
          </button>`).join('')}
      </div>
      <div class="row end">${button('Quit to title', 'go', { to: 'title' }, { cls: 'ghost small' })}</div>
    </section>`;
}

export const keys = {
  a: ctx => ctx.go('arena'),
  w: ctx => ctx.go('weapons'),
  r: ctx => ctx.go('armor'),
  m: ctx => ctx.go('magic'),
  i: ctx => ctx.go('inn'),
  t: ctx => ctx.go('training'),
  e: ctx => ctx.go('character'),
  s: ctx => ctx.go('saves'),
  g: ctx => ctx.go('guide'),
};
