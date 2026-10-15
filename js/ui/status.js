import { esc, bar } from './format.js';
import { maxHp, armorClass, nextLevelXp } from '../rules/character.js';

export function renderStatus(state) {
  const c = state.character;
  const max = maxHp(c);
  const next = nextLevelXp(c);
  const rank = state.flags.captain ? 'Captain of the Guard' : 'Gladiator';
  const points = c.statPoints.length;
  // No link mid-fight: points are spent in town.
  const badge = points && !state.combat && !c.dead
    ? ` <button type="button" class="link points-badge" data-action="go" data-to="training">${points} stat point${points === 1 ? '' : 's'} to spend</button>`
    : '';
  const poisoned = c.poison > 0 && !c.dead ? ` <span class="tag bad">☠ Poisoned ${c.poison}</span>` : '';
  return `
    <div class="status-name"><strong>${esc(c.name)}</strong> <span class="muted">${rank}</span>${poisoned}${badge}</div>
    <dl class="status-grid">
      <div><dt>Level</dt><dd>${c.level}</dd></div>
      <div><dt>XP</dt><dd>${c.xp.toLocaleString()}${next ? `<span class="muted"> / ${next.toLocaleString()}</span>` : ''}</dd></div>
      <div class="hp"><dt>Hit points</dt><dd>${c.hp}/${max}${bar(c.hp, max)}</dd></div>
      <div><dt>AC</dt><dd>${armorClass(c)}</dd></div>
      <div><dt>Gold</dt><dd>${c.gold.toLocaleString()}</dd></div>
      <div><dt>Day</dt><dd>${state.day}</dd></div>
    </dl>`;
}
