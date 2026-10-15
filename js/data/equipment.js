// Weapons, armor, and magic items. Weapon speed and damage follow the AD&D
// 2nd edition Player's Handbook. Magic items and prices are the original
// game's list.

// speed: added to the initiative roll, lower is faster.
// plus:  magic bonus to hit and damage, and what magicReq checks against.
export const WEAPONS = [
  { id: 'dagger',          name: 'Dagger',             cost: 2,     speed: 2,  dmg: '1d4',   plus: 0 },
  { id: 'hand-axe',        name: 'Hand Axe',           cost: 4,     speed: 4,  dmg: '1d6',   plus: 0 },
  { id: 'short-sword',     name: 'Short Sword',        cost: 10,    speed: 3,  dmg: '1d6',   plus: 0 },
  { id: 'mace',            name: 'Mace',               cost: 8,     speed: 7,  dmg: '1d6+1', plus: 0 },
  { id: 'morning-star',    name: 'Morning Star',       cost: 10,    speed: 7,  dmg: '2d4',   plus: 0 },
  { id: 'battle-axe',      name: 'Battle Axe',         cost: 5,     speed: 7,  dmg: '1d8',   plus: 0 },
  { id: 'long-sword',      name: 'Long Sword',         cost: 15,    speed: 5,  dmg: '1d8',   plus: 0 },
  { id: 'bastard-sword',   name: 'Bastard Sword',      cost: 25,    speed: 6,  dmg: '1d10',  plus: 0 },
  { id: 'halberd',         name: 'Halberd',            cost: 10,    speed: 9,  dmg: '1d10',  plus: 0 },
  { id: 'two-handed-sword', name: 'Two-Handed Sword',  cost: 50,    speed: 10, dmg: '2d6',   plus: 0 },
  { id: 'dagger-1',        name: 'Dagger +1',          cost: 500,   speed: 2,  dmg: '1d4',   plus: 1 },
  { id: 'long-sword-1',    name: 'Long Sword +1',      cost: 1200,  speed: 5,  dmg: '1d8',   plus: 1 },
  { id: 'battle-axe-1',    name: 'Battle Axe +1',      cost: 1000,  speed: 7,  dmg: '1d8',   plus: 1 },
  { id: 'two-handed-sword-1', name: 'Two-Handed Sword +1', cost: 2500, speed: 10, dmg: '2d6', plus: 1 },
  { id: 'long-sword-2',    name: 'Long Sword +2',      cost: 4000,  speed: 5,  dmg: '1d8',   plus: 2 },
  { id: 'two-handed-sword-2', name: 'Two-Handed Sword +2', cost: 7000, speed: 10, dmg: '2d6', plus: 2 },
  { id: 'long-sword-3',    name: 'Long Sword +3',      cost: 12000, speed: 5,  dmg: '1d8',   plus: 3 },
  { id: 'two-handed-sword-3', name: 'Two-Handed Sword +3', cost: 18000, speed: 10, dmg: '2d6', plus: 3 },
];

export const UNARMED = { id: 'fists', name: 'Fists', cost: 0, speed: 1, dmg: '1d2', plus: 0 };

// ac: adjustment to armor class (an unarmored character is AC 10).
export const ARMOR = [
  { id: 'padded',        name: 'Padded Armor',       cost: 4,     ac: -1 },
  { id: 'leather',       name: 'Leather Armor',      cost: 5,     ac: -2 },
  { id: 'studded',       name: 'Studded Leather',    cost: 20,    ac: -3 },
  { id: 'scale',         name: 'Scale Mail',         cost: 50,    ac: -4 },
  { id: 'chain',         name: 'Chain Mail',         cost: 75,    ac: -5 },
  { id: 'splint',        name: 'Splint Mail',        cost: 150,   ac: -6 },
  { id: 'plate',         name: 'Plate Mail',         cost: 600,   ac: -7 },
  { id: 'field-plate',   name: 'Field Plate',        cost: 2000,  ac: -8 },
  { id: 'full-plate',    name: 'Full Plate',         cost: 4000,  ac: -9 },
  { id: 'full-plate-1',  name: 'Full Plate +1',      cost: 9000,  ac: -10 },
  { id: 'full-plate-2',  name: 'Full Plate +2',      cost: 16000, ac: -11 },
  { id: 'full-plate-3',  name: 'Full Plate +3',      cost: 30000, ac: -12 },
];

// kind: potion | ring | wand | tome
// use:  'any' (town or arena) | 'combat' | 'town' | 'passive'
export const ITEMS = [
  { id: 'potion-healing',          name: 'Potion of Healing',          cost: 75,   kind: 'potion', use: 'any',    heal: '1d8',  effect: 'Heals 1-8 hit points' },
  { id: 'potion-extra-healing',    name: 'Potion of Extra Healing',    cost: 200,  kind: 'potion', use: 'any',    heal: '4d6',  effect: 'Heals 4-24 hit points' },
  // The original listed this one as "Potion of Extra Healing" too.
  { id: 'potion-superior-healing', name: 'Potion of Superior Healing', cost: 1000, kind: 'potion', use: 'any',    heal: '8d10', effect: 'Heals 8-80 hit points' },
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
