// The whole game is one plain JSON object. Saving is JSON.stringify,
// loading is JSON.parse plus migrations (see save.js).

export const SAVE_VERSION = 4;

export function newGameState(character) {
  return {
    version: SAVE_VERSION,
    character,
    day: 1,
    clock: 0,           // ticks once per arena visit and once per inn night
    arenaVisit: false,  // true after a fight, until you leave the Battlerings
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
