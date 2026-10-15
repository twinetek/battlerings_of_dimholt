// The weaponsmith, the armorer, and the magic shop.

import { WEAPONS, WEAPON_BY_ID, ARMOR, ITEMS, ITEM_BY_ID } from '../../data/equipment.js';
import { MAX_WEAPONS, MAX_ITEMS } from '../../rules/tables.js';
import { armorOf } from '../../rules/character.js';
import * as town from '../../rules/town.js';
import { rangeText } from '../../engine/dice.js';
import { button, backToTown, esc, gp, signed } from '../format.js';

const goldLine = c => `<p class="purse">You have <strong>${gp(c.gold)}</strong>.</p>`;

// Ask before selling anything valuable.
const confirmSale = (name, price) => price < 100 || window.confirm(`Sell the ${name} for ${price} gold?`);

const weaponName = w => (w.plus ? `<span class="magic">${esc(w.name)}</span>` : esc(w.name));

export const weapons = {
  render(ctx) {
    const c = ctx.state.character;
    const full = c.weapons.length >= MAX_WEAPONS;
    const forSale = WEAPONS.map(w => `
      <tr>
        <td>${weaponName(w)}</td>
        <td class="num">${rangeText(w.dmg, w.plus)}</td>
        <td class="num">${w.speed}</td>
        <td class="num">${gp(w.cost)}</td>
        <td class="act">${button('Buy', 'buy', { id: w.id }, { disabled: full || c.gold < w.cost })}</td>
      </tr>`).join('');
    const owned = c.weapons.length
      ? c.weapons.map((id, i) => {
        const w = WEAPON_BY_ID[id];
        const eq = i === c.equipped;
        return `
          <tr class="${eq ? 'equipped' : ''}">
            <td>${weaponName(w)}${eq ? ' <span class="tag">in hand</span>' : ''}</td>
            <td class="num">${rangeText(w.dmg, w.plus)}</td>
            <td class="num">${w.speed}</td>
            <td class="num">${gp(town.sellPrice(w))}</td>
            <td class="act">
              ${eq ? '' : button('Equip', 'equip', { index: i })}
              ${button('Sell', 'sell', { index: i }, { cls: 'ghost' })}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="5" class="muted">You have no weapons. You would be fighting with your fists.</td></tr>';
    return `
      <section>
        <h2>🗡️ Weaponsmith</h2>
        <p class="muted">Damage includes any magic bonus. Speed is added to your initiative roll, so lower strikes first.
          Gargoyles and wights need a +1 weapon to harm; earth elementals need +2.</p>
        ${goldLine(c)}
        <div class="cols">
          <div class="panel">
            <h3>For sale</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Weapon</th><th class="num">Damage</th><th class="num">Speed</th><th class="num">Cost</th><th></th></tr></thead>
              <tbody>${forSale}</tbody>
            </table></div>
          </div>
          <div class="panel">
            <h3>Your weapons <span class="muted small">(${c.weapons.length}/${MAX_WEAPONS})</span></h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Weapon</th><th class="num">Damage</th><th class="num">Speed</th><th class="num">Sells for</th><th></th></tr></thead>
              <tbody>${owned}</tbody>
            </table></div>
          </div>
        </div>
        <div class="row">${backToTown()}</div>
      </section>`;
  },
  actions: {
    buy: (ctx, d) => ctx.commit(s => town.buyWeapon(s.character, d.id)),
    equip: (ctx, d) => ctx.commit(s => town.equipWeapon(s.character, Number(d.index))),
    sell(ctx, d) {
      const w = WEAPON_BY_ID[ctx.state.character.weapons[d.index]];
      if (w && confirmSale(w.name, town.sellPrice(w))) ctx.commit(s => town.sellWeapon(s.character, Number(d.index)));
    },
  },
};

export const armor = {
  render(ctx) {
    const c = ctx.state.character;
    const current = armorOf(c);
    const rows = ARMOR.map(a => {
      const price = town.armorPrice(c, a.id);
      const wearing = c.armor === a.id;
      return `
        <tr class="${wearing ? 'equipped' : ''}">
          <td>${a.name.includes('+') ? `<span class="magic">${esc(a.name)}</span>` : esc(a.name)}${wearing ? ' <span class="tag">wearing</span>' : ''}</td>
          <td class="num">${signed(a.ac)}</td>
          <td class="num">${gp(a.cost)}</td>
          <td class="num">${wearing ? '' : gp(price)}</td>
          <td class="act">${wearing ? '' : button('Buy', 'buy', { id: a.id }, { disabled: c.gold < price })}</td>
        </tr>`;
    }).join('');
    return `
      <section>
        <h2>🛡️ Armorer</h2>
        <p class="muted">You can wear one suit at a time. Your current armor is taken as a trade-in at half its price.
          Lower armor class is better; an unarmored fighter is AC 10.</p>
        ${goldLine(c)}
        <p>Wearing: <strong>${current ? esc(current.name) : 'nothing'}</strong>
          ${current ? button(`Sell for ${gp(town.sellPrice(current))}`, 'sell', {}, { cls: 'ghost small' }) : ''}</p>
        <div class="panel">
          <div class="table-wrap"><table>
            <thead><tr><th>Armor</th><th class="num">AC adjust</th><th class="num">List price</th><th class="num">With trade-in</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>
        <div class="row">${backToTown()}</div>
      </section>`;
  },
  actions: {
    buy: (ctx, d) => ctx.commit(s => town.buyArmor(s.character, d.id)),
    sell(ctx) {
      const a = armorOf(ctx.state.character);
      if (a && confirmSale(a.name, town.sellPrice(a))) ctx.commit(s => town.sellArmor(s.character));
    },
  },
};

export function itemLabel(entry) {
  const it = ITEM_BY_ID[entry.id];
  return it.charges ? `${esc(it.name)} <span class="muted">(${entry.charges} charges)</span>` : esc(it.name);
}

export const magic = {
  render(ctx) {
    const c = ctx.state.character;
    const full = c.items.length >= MAX_ITEMS;
    const forSale = ITEMS.map(it => `
      <tr>
        <td><span class="magic">${esc(it.name)}</span></td>
        <td class="muted">${esc(it.effect)}${it.charges ? `, ${it.charges} charges` : ''}</td>
        <td class="num">${gp(it.cost)}</td>
        <td class="act">${button('Buy', 'buy', { id: it.id }, { disabled: full || c.gold < it.cost })}</td>
      </tr>`).join('');
    const owned = c.items.length
      ? c.items.map((entry, i) => {
        const it = ITEM_BY_ID[entry.id];
        const usable = it.use === 'any' || it.use === 'town';
        return `
          <tr>
            <td>${itemLabel(entry)}</td>
            <td class="num">${gp(town.itemSellPrice(entry))}</td>
            <td class="act">
              ${usable ? button('Use', 'use', { index: i }) : ''}
              ${button('Sell', 'sell', { index: i }, { cls: 'ghost' })}
            </td>
          </tr>`;
      }).join('')
      : '<tr><td colspan="3" class="muted">Your pack is empty.</td></tr>';
    return `
      <section>
        <h2>🔮 Magic Shop</h2>
        <p class="muted">Rings work while you carry them, but only your best ring counts. Wands and the fiery potion work only in the arena.
          Tomes are read in town.</p>
        ${goldLine(c)}
        <div class="cols">
          <div class="panel">
            <h3>For sale</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Item</th><th>Effect</th><th class="num">Cost</th><th></th></tr></thead>
              <tbody>${forSale}</tbody>
            </table></div>
          </div>
          <div class="panel">
            <h3>Your items <span class="muted small">(${c.items.length}/${MAX_ITEMS})</span></h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Item</th><th class="num">Sells for</th><th></th></tr></thead>
              <tbody>${owned}</tbody>
            </table></div>
          </div>
        </div>
        <div class="row">${backToTown()}</div>
      </section>`;
  },
  actions: {
    buy: (ctx, d) => ctx.commit(s => town.buyItem(s.character, d.id)),
    use: (ctx, d) => ctx.commit(s => town.useItemInTown(s.character, Number(d.index))),
    sell(ctx, d) {
      const entry = ctx.state.character.items[d.index];
      if (entry && confirmSale(ITEM_BY_ID[entry.id].name, town.itemSellPrice(entry))) {
        ctx.commit(s => town.sellItem(s.character, Number(d.index)));
      }
    },
  },
};
