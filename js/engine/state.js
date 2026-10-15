// The whole game is one plain JSON object. Saving is JSON.stringify,
// loading is JSON.parse plus migrations (see save.js).

export const SAVE_VERSION = 2;

export function newGameState(character) {
  return {
    version: SAVE_VERSION,
    character,
    day: 1,
    combat: null,       // set while a fight is in progress
    flags: {},          // story flags, such as captain
    settings: { combatSpeed: 'normal' },
  };
}

export function summarize(state) {
  const c = state.character;
  if (!c) return 'Empty';
  const status = c.dead ? 'Dead' : state.flags.captain ? 'Captain of the Guard' : `Level ${c.level}`;
  return `${c.name}, ${status}, ${c.gold.toLocaleString()} gold, day ${state.day}`;
}
