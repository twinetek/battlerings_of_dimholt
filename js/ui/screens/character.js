// The equipment dialog: stats, combat numbers, gear, and items.

import { WEAPON_BY_ID, ITEM_BY_ID } from '../../data/equipment.js';
import { MONSTERS, MONSTER_BY_ID } from '../../data/monsters.js';
import { STATS, strBonus, dexAc, conHp, thac0, attacksLabel } from '../../rules/tables.js';
import { weaponOf, armorOf, armorClass, ringBonus, maxHp, toHitBonus, damageBonus } from '../../rules/character.js';
import { equipWeapon, useItemInTown } from '../../rules/town.js';
import { rangeText } from '../../engine/dice.js';
import { button, backToTown, esc, signed, gp } from '../format.js';
import { itemLabel, coatingTag } from './shops.js';
import { LOOT_BY_ID } from '../../data/loot.js';
import { glandPotency, glandValue, freshness, ticksToNextFade, applyVenom } from '../../rules/loot.js';
import { MAX_COATINGS } from '../../rules/tables.js';

function statNote(key, v) {
  if (key === 'str') { const b = strBonus(v); return `${signed(b.hit)} hit, ${signed(b.dmg)} dmg`; }
  if (key === 'dex') return `${signed(dexAc(v))} AC`;
  if (key === 'con') return `${signed(conHp(v))} hp/level`;
  return '';
}

// Venom in your pack, with the "Apply to..." weapon chooser.
function lootPanel(ctx, params) {
  const s = ctx.state;
  const c = s.character;
  if (!c.loot.length) return '<div class="panel"><h3>Loot</h3><p class="muted">Nothing yet. Poisonous monsters sometimes leave venom behind.</p></div>';
  const rows = c.loot.map((g, i) => {
    const item = LOOT_BY_ID[g.id];
    const p = glandPotency(s, g);
    const applying = params.applying === i;
    const chooser = applying ? `
      <div class="apply-choose">
        <p class="small">Coat which weapon? Coatings fade by 1 each night and each arena visit. Up to ${MAX_COATINGS} different venoms per weapon.</p>
        ${c.weapons.length
          ? c.weapons.map((w, wi) => button(`${esc(WEAPON_BY_ID[w.id].name)}${wi === c.equipped ? ' (in hand)' : ''}`, 'apply', { loot: i, weapon: wi }, { cls: 'small' })).join(' ')
          : '<span class="muted">You have no weapons to coat.</span>'}
        ${button('Cancel', 'cancelApply', {}, { cls: 'ghost small' })}
      </div>` : '';
    return `<li class="loot-row"><span>${esc(item.name)}
        <span class="muted small">${freshness(p, item.potency)}: potency ${p}, fades again in ${ticksToNextFade(s, g)} ticks · alchemist pays ${gp(glandValue(s, g))}</span></span>
        ${applying ? '' : button('Apply to…', 'startApply', { index: i }, { cls: 'small' })}${chooser}</li>`;
  }).join('');
  return `<div class="panel"><h3>Loot</h3><ul class="list">${rows}</ul>
    <p class="muted small">The venom clock is at ${s.clock}. It ticks once per arena visit and once per night at the inn.</p></div>`;
}

export function render(ctx, params = {}) {
  const c = ctx.state.character;
  const w = weaponOf(c);
  const a = armorOf(c);
  const stats = STATS.map(([key, label]) => `
    <tr><th scope="row">${label}</th><td class="num stat">${c.stats[key]}</td><td class="muted small">${statNote(key, c.stats[key])}</td></tr>`).join('');

  const weapons = c.weapons.length
    ? c.weapons.map((entry, i) => {
      const wp = WEAPON_BY_ID[entry.id];
      return `<li class="${i === c.equipped ? 'equipped' : ''}">
        <span>${esc(wp.name)} <span class="muted small">${rangeText(wp.dmg, wp.plus)} dmg, speed ${wp.speed}</span>${coatingTag(ctx.state, entry)}</span>
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

  const poisonRows = Object.entries(c.poisonRecord).map(([id, r]) => ({ m: MONSTER_BY_ID[id], ...r }));
  const totals = poisonRows.reduce((t, r) => ({ poisoned: t.poisoned + r.poisoned, resisted: t.resisted + r.resisted, damage: t.damage + r.damage }), { poisoned: 0, resisted: 0, damage: 0 });
  const poisonHistory = poisonRows.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Source</th><th class="num">Poisoned</th><th class="num">Resisted</th><th class="num">Damage</th></tr></thead>
        <tbody>${poisonRows.map(r => `<tr><td>${r.m.art} ${esc(r.m.name)}</td><td class="num">${r.poisoned}</td><td class="num">${r.resisted}</td><td class="num">${r.damage}</td></tr>`).join('')}
        <tr class="total"><th>Total</th><td class="num">${totals.poisoned}</td><td class="num">${totals.resisted}</td><td class="num">${totals.damage}</td></tr></tbody>
      </table></div>`
    : '<p class="muted">Never poisoned.</p>';

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
        ${lootPanel(ctx, params)}
        <div class="panel"><h3>Arena record</h3><ul class="list">${wins}</ul></div>
        <div class="panel"><h3>Stat history</h3><ul class="list">${history}</ul></div>
        <div class="panel"><h3>Poison history</h3>
          ${c.poison > 0 ? `<p class="warn-text small">☠ Poisoned right now (strength ${c.poison}).</p>` : ''}
          ${poisonHistory}</div>
      </div>
      <div class="row">${backToTown()}</div>
    </section>`;
}

export const actions = {
  startApply: (ctx, d) => ctx.setParams({ applying: Number(d.index) }),
  cancelApply: ctx => ctx.setParams({ applying: null }),
  apply(ctx, d) {
    ctx.commit(s => applyVenom(s, Number(d.loot), Number(d.weapon)));
    ctx.setParams({ applying: null });
  },
  equip: (ctx, d) => ctx.commit(s => equipWeapon(s.character, Number(d.index))),
  use: (ctx, d) => ctx.commit(s => useItemInTown(s.character, Number(d.index))),
};
