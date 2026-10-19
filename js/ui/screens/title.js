import { readSlot, storageAvailable, copyMainIntoBeta, mainAutosaveSummary } from '../../engine/save.js';
import { config } from '../../config.js';
import { button, esc } from '../format.js';

export function render() {
  const auto = readSlot('auto');
  const storageNote = storageAvailable()
    ? ''
    : '<p class="flash err">This browser is blocking local storage, so autosave and save slots won\'t work. You can still export your game to a file from Save / Load.</p>';
  return `
    <section class="title-screen">
      <p class="kicker">${config.beta ? '<span class="beta-badge">Beta</span> Hex battlefield' : "A gladiator's tale"}</p>
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
        ${config.beta ? betaTools() : `
        <a class="button-like beta" href="beta/">🧪 Play beta version</a>
        <p class="muted small">The full game with arena fights on the new hex battlefield. It starts from a copy of your gladiator, and your real game is never changed.</p>`}
      </div>
      <p class="muted small credit">A new fan-created game with its own ideas, building on <em>Darkwood</em> (1992), the Macintosh shareware game by Robert Chancellor.</p>
    </section>`;
}

function betaTools() {
  const main = mainAutosaveSummary();
  return `
    ${main ? button('Copy my main game into the beta', 'copyMain', {}, { cls: 'ghost' }) : ''}
    <p class="muted small">${main ? `Main game: ${esc(main)}. ` : ''}The beta keeps its own saves; nothing here changes your main game.</p>
    <a class="button-like" href="../">← Back to the main game</a>`;
}

export const actions = {
  copyMain(ctx) {
    const beta = readSlot('auto');
    if (beta && !window.confirm(`Replace your beta game (${beta.summary}) with a copy of your main game?`)) return;
    const copied = copyMainIntoBeta();
    ctx.flash(copied ? `Copied from your main game: ${copied}.` : 'There is no main game to copy.', copied ? 'ok' : 'err');
    ctx.render();
  },
  continue(ctx) {
    const auto = readSlot('auto');
    if (auto) ctx.start(auto.state);
  },
};
