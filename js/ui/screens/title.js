import { readSlot, storageAvailable } from '../../engine/save.js';
import { button, esc } from '../format.js';

export function render() {
  const auto = readSlot('auto');
  const storageNote = storageAvailable()
    ? ''
    : '<p class="flash err">This browser is blocking local storage, so autosave and save slots won\'t work. You can still export your game to a file from Save / Load.</p>';
  return `
    <section class="title-screen">
      <p class="kicker">A gladiator's tale</p>
      <h1 class="game-title"><span class="title-pre">The Battlerings of</span> Dimholt</h1>
      <p class="lede">Your father fell defending Dimholt from an orc invasion. Now you have nothing but a few coins and a promise:
        best the mightiest creature the Battlerings can host and earn a place as Captain of the Guard.</p>
      ${storageNote}
      <div class="menu">
        ${auto ? button('Continue', 'continue', {}, { cls: 'primary' }) : ''}
        ${auto ? `<p class="muted small">${esc(auto.summary)}</p>` : ''}
        ${button('New game', 'go', { to: 'create' }, { cls: auto ? '' : 'primary' })}
        ${button('Load game', 'go', { to: 'saves' })}
        ${button('📖 How to play', 'go', { to: 'guide' }, { cls: 'ghost' })}
        <a class="button-like beta" href="lab/">🧪 Play beta version</a>
        <p class="muted small">${auto ? 'Try the new hex battlefield with a copy of your gladiator. Your real game is not changed.' : 'Try the new hex battlefield.'}</p>
      </div>
      <p class="muted small credit">A new fan-created game with its own ideas, building on <em>Darkwood</em> (1992), the Macintosh shareware game by Robert Chancellor.</p>
    </section>`;
}

export const actions = {
  continue(ctx) {
    const auto = readSlot('auto');
    if (auto) ctx.start(auto.state);
  },
};
