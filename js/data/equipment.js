// Weapons, armor, and magic items. Weapon speed and damage follow the AD&D
// 2nd edition Player's Handbook. Magic items and prices are the original
// game's list.

// Weapons are melee weapons (with `throw`) or true ranged weapons (with
// `ranged`): the Sling, the Bow and the Crossbow (see Todo_ranged.md for
// what's planned).
// speed:   added to the initiative roll, lower is faster.
// plus:    magic bonus to hit and damage, and what magicReq checks against.
// throw:   how well it flies when thrown on the battlefield: { aim, hit }
//          aim  hexes at full accuracy and damage, before Str (rules/ranged.js)
//          hit  to-hit adjustment for throwing it
//          Any weapon you carry can be thrown, one throw per weapon per fight;
//          you gather them up afterward.
// ranged:  a weapon that shoots, from your hand: { family, aim, hit?, thing?, ammo? }
//          family  which stats it uses (shootStats in rules/ranged.js):
//                  'sling'      Str adds range and damage, Dex to hit
//                  'bow'        a self bow: Dex to hit; Str adds nothing, but
//                               below strMin you lose 1 to hit and 1 aim a point
//                  'composite'  Dex to hit; Str adds range and damage up to pull
//                  'crossbow'   half Dex to hit; Str adds nothing
//          strMin  a self bow's minimum Strength
//          pull    a composite bow's draw strength: the most Str it uses
//          reload  after a shot it can't shoot again until the round after next
//                  (combat.reloadReady; rules/ranged.js reloading)
//          aim     hexes at full accuracy and damage (a sling's before Str)
//          hit     built-in accuracy
//          pierce  to hit against armor class PIERCE_AC (3) or better (rules/tables.js)
//          thing   what it shoots, for the battle log, if it needs no ammo
//          ammo    the AMMO kind it shoots, one per shot
//          unlimited  plain ammunition is free and never runs out (a sling's
//                  stones); only enchanted kinds are counted
//          It can't be thrown or strike in melee: on the battlefield every
//          attack with it is a shot, even at an enemy beside you. Out of
//          ammunition, you fight with your fists.
const MADE_TO_THROW = { aim: 3, hit: 0 };  // daggers, throwing axes
const HANDY = { aim: 2, hit: -1 };         // small and balanced enough
const AWKWARD = { aim: 1, hit: -2 };       // one-handed weapons
const CLUMSY = { aim: 1, hit: -4 };        // big two-handed weapons

export const WEAPONS = [
  { id: 'dagger',          name: 'Dagger',             cost: 2,     speed: 2,  dmg: '1d4',   plus: 0, throw: MADE_TO_THROW },
  { id: 'throwing-axe',    name: 'Throwing Axe',       cost: 8,     speed: 4,  dmg: '1d6',   plus: 0, throw: MADE_TO_THROW },
  { id: 'javelin',         name: 'Javelin',            cost: 2,     speed: 4,  dmg: '1d6',   plus: 0, throw: { aim: 4, hit: 0 } },
  { id: 'sling',           name: 'Sling',              cost: 1,     speed: 6,  dmg: '1d4',   plus: 0, ranged: { family: 'sling', aim: 3, thing: 'stone', ammo: 'stone', unlimited: true } },
  { id: 'bow',             name: 'Bow',                cost: 30,    speed: 7,  dmg: '1d6',   plus: 0, ranged: { family: 'bow', aim: 5, strMin: 9, ammo: 'arrow' } },
  { id: 'long-bow',        name: 'Long Bow',           cost: 75,    speed: 8,  dmg: '1d6',   plus: 0, ranged: { family: 'bow', aim: 6, strMin: 12, ammo: 'arrow' } },
  { id: 'composite-short-bow', name: 'Composite Short Bow', cost: 100, speed: 6, dmg: '1d6', plus: 0, ranged: { family: 'composite', aim: 4, pull: 17, ammo: 'arrow' } },
  { id: 'composite-long-bow',  name: 'Composite Long Bow',  cost: 250, speed: 7, dmg: '1d6', plus: 0, ranged: { family: 'composite', aim: 6, pull: 18, ammo: 'arrow' } },
  // The Light Crossbow keeps the id 'crossbow' it had as the basic Crossbow, so saves need no change.
  { id: 'crossbow',        name: 'Light Crossbow',     cost: 35,    speed: 7,  dmg: '1d8',   plus: 0, ranged: { family: 'crossbow', aim: 4, hit: 1, pierce: 2, ammo: 'bolt' } },
  { id: 'heavy-crossbow',  name: 'Heavy Crossbow',     cost: 50,    speed: 10, dmg: '1d10',  plus: 0, ranged: { family: 'crossbow', aim: 5, hit: 2, pierce: 2, reload: true, ammo: 'bolt' } },
  { id: 'hand-axe',        name: 'Hand Axe',           cost: 4,     speed: 4,  dmg: '1d6',   plus: 0, throw: HANDY },
  { id: 'short-sword',     name: 'Short Sword',        cost: 10,    speed: 3,  dmg: '1d6',   plus: 0, throw: AWKWARD },
  { id: 'mace',            name: 'Mace',               cost: 8,     speed: 7,  dmg: '1d6+1', plus: 0, throw: AWKWARD },
  { id: 'morning-star',    name: 'Morning Star',       cost: 10,    speed: 7,  dmg: '2d4',   plus: 0, throw: AWKWARD },
  { id: 'battle-axe',      name: 'Battle Axe',         cost: 5,     speed: 7,  dmg: '1d8',   plus: 0, throw: AWKWARD },
  { id: 'long-sword',      name: 'Long Sword',         cost: 15,    speed: 5,  dmg: '1d8',   plus: 0, throw: AWKWARD },
  { id: 'bastard-sword',   name: 'Bastard Sword',      cost: 25,    speed: 6,  dmg: '1d10',  plus: 0, throw: CLUMSY },
  { id: 'halberd',         name: 'Halberd',            cost: 10,    speed: 9,  dmg: '1d10',  plus: 0, throw: CLUMSY },
  { id: 'two-handed-sword', name: 'Two-Handed Sword',  cost: 50,    speed: 10, dmg: '2d6',   plus: 0, throw: CLUMSY },
  { id: 'dagger-1',        name: 'Dagger +1',          cost: 500,   speed: 2,  dmg: '1d4',   plus: 1, throw: MADE_TO_THROW },
  { id: 'long-sword-1',    name: 'Long Sword +1',      cost: 1200,  speed: 5,  dmg: '1d8',   plus: 1, throw: AWKWARD },
  { id: 'battle-axe-1',    name: 'Battle Axe +1',      cost: 1000,  speed: 7,  dmg: '1d8',   plus: 1, throw: AWKWARD },
  { id: 'two-handed-sword-1', name: 'Two-Handed Sword +1', cost: 2500, speed: 10, dmg: '2d6', plus: 1, throw: CLUMSY },
  { id: 'long-sword-2',    name: 'Long Sword +2',      cost: 4000,  speed: 5,  dmg: '1d8',   plus: 2, throw: AWKWARD },
  { id: 'two-handed-sword-2', name: 'Two-Handed Sword +2', cost: 7000, speed: 10, dmg: '2d6', plus: 2, throw: CLUMSY },
  { id: 'long-sword-3',    name: 'Long Sword +3',      cost: 12000, speed: 5,  dmg: '1d8',   plus: 3, throw: AWKWARD },
  { id: 'two-handed-sword-3', name: 'Two-Handed Sword +3', cost: 18000, speed: 10, dmg: '2d6', plus: 3, throw: CLUMSY },
];

// Ammunition enchantments (rules/ranged.js rangeProfile, rules/combat.js
// rangedTurn). Each piece has at most one, and may also be +1.
//   consumed  used up by the shot, hit or miss (never gathered up)
//   fire      extra fire damage on a hit (none against fire-immune monsters;
//             it stops a regenerating monster healing for the rest of the fight)
//   blast     extra damage on a hit; a miss is a dud (no blast radius yet)
//   seeking   ignores cover, and the to-hit penalties for range and moving
//             first (it still needs line of sight; damage still falls off)
export const ENCHANTS = {
  seeking:   { name: 'Seeking',   cost: 40,  seeking: true,
    effect: 'Ignores cover, and the to-hit penalties for range and for moving first' },
  flaming:   { name: 'Flaming',   cost: 60,  fire: '1d6', consumed: true,
    effect: '+1d6 fire damage on a hit, and a troll it hits stops regenerating. Burns up, hit or miss' },
  exploding: { name: 'Exploding', cost: 200, blast: '2d6', consumed: true,
    effect: '+2d6 damage on a hit. A miss is a dud. Used up either way' },
};
export const MAGIC_AMMO_COST = 100;  // +1, per bundle of ENCHANTED_BUNDLE (on top of any enchantment)
export const ENCHANTED_BUNDLE = 5;

// The plain kinds. A sling's plain stones are free and unlimited, so they
// aren't sold or counted; only enchanted stones are.
const AMMO_BASES = [
  { for: 'arrow', name: 'Arrow', plural: 'Arrows', bundle: 10, cost: 1, breakChance: 50 },
  { for: 'bolt',  name: 'Bolt',  plural: 'Bolts',  bundle: 10, cost: 2, breakChance: 25 },
  { for: 'stone', name: 'Stone', plural: 'Stones', breakChance: 25, free: true },
];

// Ammunition, carried as character.ammo { id: count }. Sold in bundles at the
// Weaponsmith. Each shot uses one; a hit breaks it with breakChance (in
// percent), and every other one shot is gathered up after a fight you
// survive, unless its enchantment is consumed. Every kind of ammunition comes
// plain and in each enchantment, each with or without +1, cheapest first:
// 'arrow', 'arrow-1', 'seeking-arrow', 'flaming-bolt-1', 'exploding-stone' ...
// for:      the `ranged.ammo` it fits
// enchant:  an ENCHANTS id, or null
// plus:     0 or 1: adds to hit and damage, and counts as magic (magicReq)
export const AMMO = AMMO_BASES.flatMap(b => [null, ...Object.keys(ENCHANTS)].flatMap(enchant => [0, 1].map(plus => {
  if (!enchant && !plus) {
    return b.free ? null : { id: b.for, name: b.name, plural: b.plural, for: b.for, bundle: b.bundle, cost: b.cost, breakChance: b.breakChance, enchant: null, plus: 0 };
  }
  const pre = enchant ? `${ENCHANTS[enchant].name} ` : '';
  const post = plus ? ' +1' : '';
  return {
    id: `${enchant ? `${enchant}-` : ''}${b.for}${plus ? '-1' : ''}`,
    name: `${pre}${b.name}${post}`,
    plural: `${pre}${b.plural}${post}`,
    for: b.for,
    bundle: ENCHANTED_BUNDLE,
    cost: (enchant ? ENCHANTS[enchant].cost : 0) + (plus ? MAGIC_AMMO_COST : 0),
    breakChance: b.breakChance,
    enchant,
    plus,
  };
})).filter(Boolean).sort((x, y) => x.cost - y.cost));

// What a kind of ammunition does, for the shop and the Guide.
export function ammoEffect(a) {
  const parts = [];
  if (a.plus) parts.push(`+${a.plus} to hit and damage, and counts as magic`);
  if (a.enchant) parts.push(ENCHANTS[a.enchant].effect);
  return parts.join('. ');
}

// Fists can't be thrown.
export const UNARMED = { id: 'fists', name: 'Fists', cost: 0, speed: 1, dmg: '1d2', plus: 0 };

// ac:   adjustment to armor class (an unarmored character is AC 10).
// bulk: how much it slows you on the battlefield, unless you're strong enough
//       to carry it (strCarry in rules/tables.js). Magic armor is no lighter.
export const ARMOR = [
  { id: 'padded',        name: 'Padded Armor',       cost: 4,     ac: -1,  bulk: 0 },
  { id: 'leather',       name: 'Leather Armor',      cost: 5,     ac: -2,  bulk: 0 },
  { id: 'studded',       name: 'Studded Leather',    cost: 20,    ac: -3,  bulk: 0 },
  { id: 'scale',         name: 'Scale Mail',         cost: 50,    ac: -4,  bulk: 1 },
  { id: 'chain',         name: 'Chain Mail',         cost: 75,    ac: -5,  bulk: 1 },
  { id: 'splint',        name: 'Splint Mail',        cost: 150,   ac: -6,  bulk: 2 },
  { id: 'plate',         name: 'Plate Mail',         cost: 600,   ac: -7,  bulk: 2 },
  { id: 'field-plate',   name: 'Field Plate',        cost: 2000,  ac: -8,  bulk: 2 },
  { id: 'full-plate',    name: 'Full Plate',         cost: 4000,  ac: -9,  bulk: 2 },
  { id: 'full-plate-1',  name: 'Full Plate +1',      cost: 9000,  ac: -10, bulk: 2 },
  { id: 'full-plate-2',  name: 'Full Plate +2',      cost: 16000, ac: -11, bulk: 2 },
  { id: 'full-plate-3',  name: 'Full Plate +3',      cost: 30000, ac: -12, bulk: 2 },
];

// kind: potion | ring | wand | tome
// use:  'any' (town or arena) | 'combat' | 'town' | 'passive'
export const ITEMS = [
  { id: 'potion-healing',          name: 'Potion of Healing',          cost: 75,   kind: 'potion', use: 'any',    heal: '1d8',  effect: 'Heals 1-8 hit points' },
  { id: 'potion-extra-healing',    name: 'Potion of Extra Healing',    cost: 200,  kind: 'potion', use: 'any',    heal: '4d6',  effect: 'Heals 4-24 hit points' },
  // The original listed this one as "Potion of Extra Healing" too.
  { id: 'potion-superior-healing', name: 'Potion of Superior Healing', cost: 1000, kind: 'potion', use: 'any',    heal: '8d10', effect: 'Heals 8-80 hit points' },
  { id: 'potion-neutralize-poison', name: 'Potion of Neutralize Poison', cost: 150, kind: 'potion', use: 'any', cure: 'poison', effect: 'Cures poison' },
  { id: 'potion-fiery-breath',     name: 'Potion of Fiery Breath',     cost: 200,  kind: 'potion', use: 'combat', damage: '4d6', dtype: 'fire',
    verb: 'You breathe a gout of flame at', effect: 'Breathe fire for 4-24 damage' },
  { id: 'ring-protection-1', name: 'Ring of Protection +1', cost: 800,  kind: 'ring', use: 'passive', ac: 1, effect: 'Improves armor class by 1' },
  { id: 'ring-protection-2', name: 'Ring of Protection +2', cost: 1200, kind: 'ring', use: 'passive', ac: 2, effect: 'Improves armor class by 2' },
  { id: 'ring-protection-3', name: 'Ring of Protection +3', cost: 2000, kind: 'ring', use: 'passive', ac: 3, effect: 'Improves armor class by 3' },
  { id: 'wand-magic-missiles', name: 'Wand of Magic Missiles', cost: 1000, kind: 'wand', use: 'combat', charges: 10, damage: '4d3+4', dtype: 'magic',
    verb: 'Glowing missiles streak from the wand into', effect: 'Magic missiles for 8-16 damage, never miss' },
  { id: 'wand-fire',      name: 'Wand of Fire',      cost: 1500, kind: 'wand', use: 'combat', charges: 8, damage: '4d6', dtype: 'fire',
    verb: 'A fireball bursts over', effect: 'Fireball for 4-24 damage' },
  { id: 'wand-lightning', name: 'Wand of Lightning', cost: 1850, kind: 'wand', use: 'combat', charges: 8, damage: '6d6', dtype: 'lightning',
    verb: 'A bolt of lightning blasts', effect: 'Lightning bolt for 6-36 damage' },
  { id: 'tome-str', name: 'Tome of Strength',     cost: 2000, kind: 'tome', use: 'town', stat: 'str', effect: 'Permanently raises Strength by 1' },
  { id: 'tome-dex', name: 'Tome of Dexterity',    cost: 2000, kind: 'tome', use: 'town', stat: 'dex', effect: 'Permanently raises Dexterity by 1' },
  { id: 'tome-con', name: 'Tome of Constitution', cost: 2000, kind: 'tome', use: 'town', stat: 'con', effect: 'Permanently raises Constitution by 1' },
];

const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
export const WEAPON_BY_ID = byId(WEAPONS);
export const ARMOR_BY_ID = byId(ARMOR);
export const ITEM_BY_ID = byId(ITEMS);
export const AMMO_BY_ID = byId(AMMO);
