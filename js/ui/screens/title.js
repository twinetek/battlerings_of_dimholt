import { readSlot, storageAvailable, copyMainIntoBeta, mainAutosaveSummary } from '../../engine/save.js';
import { BETA_FEATURES, activeBeta, betaMenuRequested } from '../../config.js';
import { button, esc } from '../format.js';

export function render() {
  const auto = readSlot('auto');
  const beta = activeBeta();
  const storageNote = storageAvailable()
    ? ''
    : '<p class="flash err">This browser is blocking local storage, so autosave and save slots won\'t work. You can still export your game to a file from Save / Load.</p>';
  return `
    <section class="title-screen">
      <p class="kicker">${beta ? `<span class="beta-badge">Beta</span> ${esc(beta.name)}` : "A gladiator's tale"}</p>
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
        ${beta ? betaTools(beta) : ''}
        ${beta || betaMenuRequested() ? betaMenu(beta) : ''}
      </div>
      <p class="muted small credit">A new fan-created game with its own ideas, building on <em>Darkwood</em> (1992), the Macintosh shareware game by Robert Chancellor.</p>
    </section>`;
}

// Inside a beta feature: copy the main game in again, or go back to it.
function betaTools(beta) {
  const main = mainAutosaveSummary();
  return `
    ${main ? button('Copy my main game into this beta', 'copyMain', {}, { cls: 'ghost' }) : ''}
    <p class="muted small">${main ? `Main game: ${esc(main)}. ` : ''}${esc(beta.name)} keeps its own saves; nothing here changes your main game.</p>`;
}

// The drop-down of beta features (and the main game). Paths are relative to
// wherever we are: the main game's root, or a beta feature's folder.
function betaMenu(beta) {
  const base = beta ? '../' : '';
  const options = [
    `<option value="${base}?beta=true"${beta ? '' : ' selected'}>Main game</option>`,
    ...BETA_FEATURES.map(f => `<option value="${base}${f.folder}?beta=true"${beta?.id === f.id ? ' selected' : ''}
      data-description="${esc(f.description)}">Beta: ${esc(f.name)}</option>`),
  ].join('');
  return `
    <div class="beta-menu">
      <label for="beta-select">🧪 Beta features</label>
      <div class="row tight center">
        <select id="beta-select">${options}</select>
        ${button('Open', 'openBeta', {}, { cls: 'small' })}
      </div>
      <p class="muted small" id="beta-description">${esc(beta ? beta.description : 'Choose a beta feature to try it with a copy of your gladiator.')}</p>
    </div>`;
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
  openBeta() {
    const target = document.getElementById('beta-select')?.value;
    if (target) window.location.href = target;
  },
};

export function mount(ctx, root) {
  const select = root.querySelector('#beta-select');
  select?.addEventListener('change', () => {
    const chosen = select.selectedOptions[0];
    const text = chosen.dataset.description ?? 'The main game, without beta features.';
    root.querySelector('#beta-description').textContent = text;
  });
}
