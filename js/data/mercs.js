// Mercenaries for hire, one fight at a time. They are built on the same
// fighter rules as the player (level sets saves and extra attacks) but have
// fixed stats and keep nothing between fights.
//
// weapon.plus counts for magic-weapon requirements, so a Veteran can hurt a
// Gargoyle. dmgBonus stands in for the merc's Strength.

export const MERCS = [
  { id: 'militia',   name: 'Militia',   art: '🧑‍🌾', level: 1,  hp: 8,  ac: 7,  thac0: 20,
    weapon: { name: 'Club', dmg: '1d6', plus: 0 }, dmgBonus: 0, wage: 10,
    desc: 'A farmhand with a club. Cheap, brave, and soon dead.' },
  { id: 'sellsword', name: 'Sellsword', art: '🗡️', level: 3,  hp: 20, ac: 5,  thac0: 18,
    weapon: { name: 'Long Sword', dmg: '1d8', plus: 0 }, dmgBonus: 0, wage: 40,
    desc: 'A steady blade for hire.' },
  { id: 'veteran',   name: 'Veteran',   art: '🪖', level: 5,  hp: 35, ac: 3,  thac0: 16,
    weapon: { name: 'Long Sword +1', dmg: '1d8', plus: 1 }, dmgBonus: 1, wage: 150,
    desc: 'Scarred and reliable. The magic sword can hurt Gargoyles and Wights.' },
  { id: 'knight',    name: 'Knight',    art: '🛡️', level: 8,  hp: 55, ac: 1,  thac0: 13,
    weapon: { name: 'Bastard Sword +1', dmg: '1d10', plus: 1 }, dmgBonus: 2, wage: 500,
    desc: 'Heavy armor and three blows every two rounds.' },
  { id: 'champion',  name: 'Champion',  art: '🏅', level: 11, hp: 75, ac: -1, thac0: 10,
    weapon: { name: 'Long Sword +2', dmg: '1d8', plus: 2 }, dmgBonus: 3, wage: 1500,
    desc: 'A legend of the Battlerings. Even Earth Elementals fear the +2 blade.' },
];

export const MERC_BY_ID = Object.fromEntries(MERCS.map(m => [m.id, m]));

export const MERC_NAMES = [
  'Brann', 'Edda', 'Torvin', 'Mira', 'Gunnar', 'Sable', 'Holt', 'Wren', 'Osric', 'Ilse', 'Doran', 'Kestrel',
  'Bram', 'Yara', 'Fenn', 'Rook', 'Agna', 'Corvin', 'Tamsin', 'Ulf', 'Neve', 'Halvard', 'Briar', 'Joss',
];

// crew: { militia: 2, veteran: 1 }
export const crewSize = crew => Object.values(crew ?? {}).reduce((a, b) => a + (b || 0), 0);
export const crewCost = crew => Object.entries(crew ?? {}).reduce((sum, [id, n]) => sum + (MERC_BY_ID[id]?.wage ?? 0) * (n || 0), 0);

export function crewText(crew) {
  return MERCS.filter(m => crew?.[m.id])
    .map(m => (crew[m.id] === 1 ? `a ${m.name}` : `${crew[m.id]} ${m.name === 'Militia' ? 'Militia' : `${m.name}s`}`))
    .join(', ');
}
