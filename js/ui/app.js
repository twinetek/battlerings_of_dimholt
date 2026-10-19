// The app shell: owns the game state, routes between screens, autosaves,
// and dispatches clicks.
//
// A screen is a module with:
//   render(ctx, params)      -> HTML string for the main area
//   actions { name(ctx, data, el) }   handlers for [data-action] clicks
//   mount(ctx, root, params) optional, runs after render (focus, listeners)
//   keys { key(ctx) }        optional keyboard shortcuts

import { writeSlot } from '../engine/save.js';
import { renderStatus } from './status.js';
import * as title from './screens/title.js';
import * as create from './screens/create.js';
import * as town from './screens/town.js';
import * as shops from './screens/shops.js';
import * as inn from './screens/inn.js';
import * as character from './screens/character.js';
import * as arena from './screens/arena.js';
import * as combat from './screens/combat.js';
import * as saves from './screens/saves.js';
import * as training from './screens/training.js';
import * as guide from './screens/guide.js';
import * as endings from './screens/endings.js';
import * as battle from './screens/battle.js';
import { fightScreen } from './fight.js';

const SCREENS = {
  title, create, town, inn, character, arena, combat, battle, saves, training, guide,
  weapons: shops.weapons, armor: shops.armor, magic: shops.magic,
  dead: endings.dead, captain: endings.captain,
};

// Screens that don't show the character status bar.
const NO_STATUS = new Set(['title', 'create', 'dead']);

// Screens that get a "Back to town" link in the top bar.
const TOWN_LINK = new Set(['weapons', 'armor', 'magic', 'inn', 'character', 'arena', 'saves', 'training', 'guide']);

export function createApp({ screenEl, statusEl, flashEl, navEl }) {
  let state = null;
  let current = { name: 'title', params: {} };
  let flash = null;

  const ctx = {
    get state() { return state; },
    get params() { return current.params; },

    // Replace the whole game (new game or load) and go to the right screen.
    start(newState) {
      state = newState;
      autosave();
      ctx.go(routeFor(state));
    },

    // Change state, autosave, re-render.
    commit(fn) {
      const result = fn(state);
      autosave();
      if (result && typeof result === 'object' && 'msg' in result) ctx.flash(result.msg, result.ok ? 'ok' : 'err');
      render();
      return result;
    },

    // Change state and autosave without re-rendering (used during combat playback).
    mutate(fn) {
      const result = fn(state);
      autosave();
      return result;
    },

    go(name, params = {}) {
      current = { name, params };
      flash = null;
      render();
      window.scrollTo({ top: 0 });
    },

    setParams(params) {
      current.params = { ...current.params, ...params };
      render();
    },

    flash(msg, kind = 'ok') { flash = { msg, kind }; },

    render,
  };

  function autosave() {
    if (state?.character) writeSlot('auto', state);
  }

  function render() {
    const screen = SCREENS[current.name];
    screenEl.innerHTML = screen.render(ctx, current.params);
    screenEl.dataset.screen = current.name;
    statusEl.innerHTML = state?.character && !NO_STATUS.has(current.name) ? renderStatus(state) : '';
    const inTown = state?.character && !state.character.dead && !state.combat;
    navEl.innerHTML = inTown && TOWN_LINK.has(current.name)
      ? '<button type="button" class="link" data-action="go" data-to="town">← Back to town</button>'
      : '';
    flashEl.innerHTML = flash ? `<p class="flash ${flash.kind}" role="status">${escapeText(flash.msg)}</p>` : '';
    screen.mount?.(ctx, screenEl, current.params);
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const name = el.dataset.action;
    const screen = SCREENS[current.name];
    const handler = screen.actions?.[name] ?? GLOBAL_ACTIONS[name];
    if (!handler) return;
    e.preventDefault();
    handler(ctx, { ...el.dataset }, el);
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches?.('input, textarea, select')) return;
    const handler = SCREENS[current.name].keys?.[e.key.toLowerCase()];
    if (handler) {
      e.preventDefault();
      handler(ctx);
    }
  });

  return ctx;
}

const GLOBAL_ACTIONS = {
  go: (ctx, d) => ctx.go(d.to),
};

// Where a freshly loaded game should land.
export function routeFor(state) {
  if (state.character.dead) return 'dead';
  if (state.combat) return fightScreen(state);
  return 'town';
}

const escapeText = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
