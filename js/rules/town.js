// Town actions: shops, the inn, and using items outside the arena.
// Each returns { ok, msg } and changes the game state only when ok.

import { roll } from '../engine/dice.js';
import { WEAPON_BY_ID, ARMOR_BY_ID, ITEM_BY_ID } from '../data/equipment.js';
import { MAX_WEAPONS, MAX_ITEMS, TOME_MAX, INN_PRICE, STATS } from './tables.js';
import { maxHp, heal, armorOf, readTome } from './character.js';

const ok = msg => ({ ok: true, msg });
const fail = msg => ({ ok: false, msg });

export const sellPrice = thing => Math.floor(thing.cost / 2);

export function itemSellPrice(entry) {
  const it = ITEM_BY_ID[entry.id];
  if (it.charges) return Math.floor(sellPrice(it) * entry.charges / it.charges);
  return sellPrice(it);
}

// ---- Weapons ----

export function buyWeapon(c, id) {
  const w = WEAPON_BY_ID[id];
  if (!w) return fail('No such weapon.');
  if (c.weapons.length >= MAX_WEAPONS) return fail(`You can carry at most ${MAX_WEAPONS} weapons. Sell one first.`);
  if (c.gold < w.cost) return fail(`You can't afford the ${w.name}.`);
  c.gold -= w.cost;
  c.weapons.push(id);
  if (c.equipped < 0) c.equipped = c.weapons.length - 1;
  return ok(`You buy the ${w.name}${c.weapons[c.equipped] === id ? ' and take it in hand' : ''}.`);
}

export function sellWeapon(c, index) {
  const w = WEAPON_BY_ID[c.weapons[index]];
  if (!w) return fail('No such weapon.');
  const price = sellPrice(w);
  c.weapons.splice(index, 1);
  c.gold += price;
  if (c.equipped === index) c.equipped = c.weapons.length ? 0 : -1;
  else if (c.equipped > index) c.equipped--;
  return ok(`You sell the ${w.name} for ${price} gold.`);
}

export function equipWeapon(c, index) {
  const w = WEAPON_BY_ID[c.weapons[index]];
  if (!w) return fail('No such weapon.');
  c.equipped = index;
  return ok(`You ready the ${w.name}.`);
}

// ---- Armor (one suit at a time; the old suit is traded in) ----

export function armorPrice(c, id) {
  const tradeIn = armorOf(c) ? sellPrice(armorOf(c)) : 0;
  return Math.max(0, ARMOR_BY_ID[id].cost - tradeIn);
}

export function buyArmor(c, id) {
  const a = ARMOR_BY_ID[id];
  if (!a) return fail('No such armor.');
  if (c.armor === id) return fail(`You are already wearing ${a.name}.`);
  const price = armorPrice(c, id);
  if (c.gold < price) return fail(`You can't afford the ${a.name}.`);
  const old = armorOf(c);
  c.gold -= price;
  c.armor = id;
  return ok(old
    ? `You trade in your ${old.name} and pay ${price} gold for ${a.name}.`
    : `You buy ${a.name} for ${price} gold.`);
}

export function sellArmor(c) {
  const a = armorOf(c);
  if (!a) return fail('You have no armor to sell.');
  const price = sellPrice(a);
  c.gold += price;
  c.armor = null;
  return ok(`You sell your ${a.name} for ${price} gold.`);
}

// ---- Magic items ----

export function buyItem(c, id) {
  const it = ITEM_BY_ID[id];
  if (!it) return fail('No such item.');
  if (c.items.length >= MAX_ITEMS) return fail(`Your pack holds at most ${MAX_ITEMS} magic items.`);
  if (c.gold < it.cost) return fail(`You can't afford the ${it.name}.`);
  c.gold -= it.cost;
  c.items.push(it.charges ? { id, charges: it.charges } : { id });
  return ok(`You buy the ${it.name}.`);
}

export function sellItem(c, index) {
  const entry = c.items[index];
  if (!entry) return fail('No such item.');
  const it = ITEM_BY_ID[entry.id];
  const price = itemSellPrice(entry);
  c.items.splice(index, 1);
  c.gold += price;
  return ok(`You sell the ${it.name} for ${price} gold.`);
}

export function useItemInTown(c, index) {
  const entry = c.items[index];
  const it = entry && ITEM_BY_ID[entry.id];
  if (!it) return fail('No such item.');
  if (it.use === 'combat') return fail(`The ${it.name} can only be used in the arena.`);
  if (it.use === 'passive') return fail(`The ${it.name} works on its own while you carry it.`);
  if (it.heal) {
    if (c.hp >= maxHp(c)) return fail('You are already at full health.');
    c.items.splice(index, 1);
    const amount = heal(c, roll(it.heal));
    return ok(`You drink the ${it.name} and recover ${amount} hit points.`);
  }
  if (it.stat) {
    if (c.stats[it.stat] >= TOME_MAX) return fail(`You read the ${it.name}, but there is nothing more it can teach you.`);
    c.items.splice(index, 1);
    readTome(c, it.stat);
    const label = STATS.find(([k]) => k === it.stat)[1];
    return ok(`You study the ${it.name}. Your ${label} rises to ${c.stats[it.stat]}.`);
  }
  return fail('Nothing happens.');
}

// ---- The inn: one night heals one hit point ----

export function innQuote(c) {
  const missing = maxHp(c) - c.hp;
  const affordable = Math.floor(c.gold / INN_PRICE);
  const nights = Math.min(missing, affordable);
  return { missing, nights, cost: nights * INN_PRICE };
}

export function stayAtInn(state, nightsWanted) {
  const c = state.character;
  const { missing } = innQuote(c);
  if (missing <= 0) return fail('You are not hurt. The innkeeper waves you off without charging you.');
  const nights = Math.min(nightsWanted, missing, Math.floor(c.gold / INN_PRICE));
  if (nights <= 0) return fail(`A night costs ${INN_PRICE} gold, and you can't pay.`);
  c.gold -= nights * INN_PRICE;
  heal(c, nights);
  state.day += nights;
  const tail = c.hp >= maxHp(c) ? ' You are fully healed.' : '';
  return ok(`You sleep ${nights} night${nights === 1 ? '' : 's'} for ${nights * INN_PRICE} gold and recover ${nights} hit point${nights === 1 ? '' : 's'}.${tail}`);
}
