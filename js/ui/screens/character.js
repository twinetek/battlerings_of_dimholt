// The equipment dialog: stats, combat numbers, gear, and items.

import { WEAPON_BY_ID, ITEM_BY_ID } from '../../data/equipment.js';
import { MONSTERS } from '../../data/monsters.js';
import { STATS, strBonus, dexAc, conHp, thac0, attacksLabel } from '../../rules/tables.js';
import { weaponOf, armorOf, armorClass, ringBonus, maxHp, toHitBonus, damageBonus } from '../../rules/character.js';
import { equipWeapon, useItemInTown } from '../../rules/town.js';
import { rangeText } from '../../engine/dice.js';
import { button, backToTown, esc, signed } from '../format.js';
import { itemLabel } from './shops.js';

function statNote(key, v) {
  if (key === 'str') { const b = strBonus(v); return `${signed(b.hit)} hit, ${signed(b.dmg)} dmg`; }
  if (key === 'dex') return `${signed(dexAc(v))} AC`;
  if (key === 'con') return `${signed(conHp(v))} hp/level`;
  return '';
}

export function render(ctx) {
  const c = ctx.state.character;
  const w = weaponOf(c);
  const a = armorOf(c);
  const stats = STATS.map(([key, label]) => `
    <tr><th scope="row">${label}</th><td class="num stat">${c.stats[key]}</td><td class="muted small">${statNote(key, c.stats[key])}</td></tr>`).join('');

  const weapons = c.weapons.length
    ? c.weapons.map((id, i) => {
      const wp = WEAPON_BY_ID[id];
      return `<li class="${i === c.equipped ? 'equipped' : ''}">
        <span>${esc(wp.name)} <span class="muted small">${rangeText(wp.dmg, wp.plus)} dmg, speed ${wp.speed}</span></span>
        ${i === c.equipped ? '<span class="tag">in hand</span>' : button('Equip', 'equip', { index: i }, { cls: 'small' })}
      </li>`;
    }).join('')
    : '<li class="muted">No weapons. Visit the Weaponsmith.</li>';

  const items = c.items.length
    ? c.items.map((entry, i) => {
      const it = ITEM_BY_ID[entry.id];
      const usable = it.use === 'any' || it.use === 'town';
      return `<li><span>${itemLabel(entry)} <span class="muted small">${esc(it.effect)}</span></span>
        ${usable ? button('Use', 'use', { index: i }, { cls: 'small' }) : ''}</li>`;
    }).join('')
    : '<li class="muted">No magic items.</li>';

  const statName = key => STATS.find(([k]) => k === key)[1];
  const history = c.statLog.length
    ? [...c.statLog].reverse().map(e => {
      const what = e.source === 'tome' ? 'Tome' : `Level ${e.level} point`;
      return `<li class="${e.revoked ? 'revoked' : ''}"><span>${statName(e.stat)} +1</span>
        <span class="muted small">${what}${e.revoked ? ', lost to level drain' : ''}</span></li>`;
    }).join('')
    : '<li class="muted">No training or Tomes yet.</li>';
  const points = c.statPoints.length;

  const wins = MONSTERS.filter(m => c.wins[m.id])
    .map(m => `<li><span>${m.art} ${esc(m.name)}</span><span class="num">${c.wins[m.id]}</span></li>`).join('')
    || '<li class="muted">No victories yet.</li>';

  return `
    <section>
      <h2>📜 ${esc(c.name)}</h2>
      <div class="cols">
        <div class="panel">
          <h3>Stats</h3>
          <table class="stats"><tbody>${stats}</tbody></table>
          <p class="small">${points
            ? `${points} stat point${points === 1 ? '' : 's'} to spend. ${button('Go to the Training Yard', 'go', { to: 'training' }, { cls: 'small' })}`
            : '<span class="muted">You earn a stat point every 2 levels.</span>'}</p>
        </div>
        <div class="panel">
          <h3>In combat</h3>
          <dl class="facts">
            <div><dt>Hit points</dt><dd>${c.hp} / ${maxHp(c)}</dd></div>
            <div><dt>Armor class</dt><dd>${armorClass(c)} <span class="muted small">(10${a ? ` ${signed(a.ac)} armor` : ''}${dexAc(c.stats.dex) ? ` ${signed(dexAc(c.stats.dex))} dex` : ''}${ringBonus(c) ? ` -${ringBonus(c)} ring` : ''})</span></dd></div>
            <div><dt>THAC0</dt><dd>${thac0(c.level)} <span class="muted small">(${signed(toHitBonus(c))} to hit)</span></dd></div>
            <div><dt>Weapon</dt><dd>${esc(w.name)}</dd></div>
            <div><dt>Damage</dt><dd>${rangeText(w.dmg, damageBonus(c))}</dd></div>
            <div><dt>Attacks per round</dt><dd>${attacksLabel(c.level)}</dd></div>
            <div><dt>Armor</dt><dd>${a ? esc(a.name) : 'None'}</dd></div>
          </dl>
        </div>
      </div>
      <div class="cols">
        <div class="panel"><h3>Weapons</h3><ul class="list">${weapons}</ul></div>
        <div class="panel"><h3>Magic items</h3><ul class="list">${items}</ul></div>
        <div class="panel"><h3>Arena record</h3><ul class="list">${wins}</ul></div>
        <div class="panel"><h3>Stat history</h3><ul class="list">${history}</ul></div>
      </div>
      <div class="row">${backToTown()}</div>
    </section>`;
}

export const actions = {
  equip: (ctx, d) => ctx.commit(s => equipWeapon(s.character, Number(d.index))),
  use: (ctx, d) => ctx.commit(s => useItemInTown(s.character, Number(d.index))),
};
