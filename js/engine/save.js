// Saving with no server: browser localStorage for quick slots, and JSON file
// export/import for backups and moving between devices.
//
// localStorage can throw (private windows, blocked site data), so every call
// is wrapped and the game keeps running without it.

import { SAVE_VERSION, summarize } from './state.js';
import { MONSTER_BY_ID } from '../data/monsters.js';

const PREFIX = 'dimholt.save.';
const FORMAT = 'dimholt-save';
export const SLOTS = ['auto', '1', '2', '3'];

// MIGRATIONS[n] upgrades a version-n state to version n+1. When the state
// shape changes, bump SAVE_VERSION and add a step here so old saves load.
const MIGRATIONS = {
  // Version 2 added poison.
  1: state => {
    const c = state.character;
    c.poison ??= 0;
    c.poisonSource ??= null;
    c.poisonRecord ??= {};
    return state;
  },
  // Version 3: fights became your side against a list of enemies.
  2: state => {
    const cb = state.combat;
    if (cb && !cb.enemies) {
      state.combat = {
        monsterId: cb.monsterId, round: cb.round, paralyzed: cb.paralyzed ?? 0,
        over: cb.over, result: cb.result, cause: cb.cause ?? null,
        enemies: [{ uid: 'e1', monsterId: cb.monsterId, name: MONSTER_BY_ID[cb.monsterId]?.name ?? 'Opponent', hp: cb.hp, maxHp: cb.maxHp,
          breathLeft: cb.breathLeft ?? 0, regenBlocked: !!cb.regenBlocked, main: true, summoned: false, killedBy: null }],
        allies: [], nextEnemy: 1, hired: 0, wages: 0, crew: {}, target: 'e1',
        summon: { halfDone: false, pending: 0 }, log: cb.log ?? [],
      };
    }
    return state;
  },
};

function migrate(state) {
  let v = state.version ?? 1;
  if (v > SAVE_VERSION) throw new Error('This save is from a newer version of the game.');
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No upgrade path from save version ${v}.`);
    state = step(state);
    v++;
    state.version = v;
  }
  return state;
}

function envelope(state) {
  return {
    format: FORMAT,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    summary: summarize(state),
    state,
  };
}

function unwrap(data) {
  if (!data || data.format !== FORMAT || !data.state?.character) {
    throw new Error("That file isn't a Battlerings of Dimholt save.");
  }
  return { savedAt: data.savedAt, summary: data.summary, state: migrate(data.state) };
}

export function storageAvailable() {
  try {
    const k = PREFIX + 'test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function writeSlot(slot, state) {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify(envelope(state)));
    return true;
  } catch {
    return false;
  }
}

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    return raw ? unwrap(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  try { localStorage.removeItem(PREFIX + slot); } catch { /* nothing to do */ }
}

export function listSlots() {
  return SLOTS.map(slot => ({ slot, save: readSlot(slot) }));
}

export function exportToFile(state) {
  const blob = new Blob([JSON.stringify(envelope(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = state.character.name.replace(/[^\w-]+/g, '_') || 'dimholt';
  a.href = url;
  a.download = `${name}-day${state.day}.dimholt.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importFromFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Battlerings of Dimholt save.");
  }
  return unwrap(data).state;
}
