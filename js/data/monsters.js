// Arena opponents, in the original game's order of toughness.
// XP and award gold come from the 1992 Darkwood Read Me, which this game builds on.
// Combat stats are adapted from AD&D 1st/2nd edition and tuned so the
// list gets steadily harder.
//
// hp       dice for hit points (rolled per fight), or hpFixed
// ac       armor class (lower is harder to hit)
// thac0    roll needed to hit armor class 0
// speed    added to a d10 for initiative (lower acts first)
// attacks  one entry per attack each round
// magicReq weapon bonus needed to land a blow (0 = any weapon)
// immune   damage types that do nothing (fire, lightning, acid)
// special  paralyze | drain | regen: n | heads: n
// poison   on an attack: the poison strength it inflicts (see rules/poison.js)
// calls    who answers when it calls for help (only when you hire mercenaries):
//          'kin' (its own kind), a monster id, or 'arena' (the arena master sends
//          something weaker). No calls = it never summons.
// breath   { name, type, uses, chance } (damage is half the dragon's current hp)
// art      placeholder portrait until real sprites exist (see DESIGN.md)

export const MONSTERS = [
  { id: 'giant-rat', name: 'Giant Rat', art: '🐀', hp: '1d4', ac: 7, thac0: 20, speed: 3,
    calls: 'kin',
    attacks: [{ name: 'bite', dmg: '1d3' }], xp: 75, gold: 10,
    desc: 'A filthy rodent the size of a dog. Every gladiator starts here.' },
  { id: 'kobold', name: 'Kobold', art: '🦎', hp: '1d4+1', ac: 7, thac0: 20, speed: 5,
    calls: 'kin',
    attacks: [{ name: 'spear', dmg: '1d6' }], xp: 90, gold: 20,
    desc: 'A small, scaly, yapping humanoid with a sharpened spear.' },
  { id: 'giant-centipede', name: 'Giant Centipede', art: '🐛', hp: '1d6', ac: 9, thac0: 20, speed: 3,
    calls: 'kin',
    attacks: [{ name: 'bite', dmg: '1d2', poison: 2 }], xp: 100, gold: 22,
    desc: 'A yard of chittering legs. Its bite is weak, but the venom stings.' },
  { id: 'goblin', name: 'Goblin', art: '👺', hp: '1d8', ac: 6, thac0: 20, speed: 5,
    calls: 'kin',
    attacks: [{ name: 'short sword', dmg: '1d6' }], xp: 110, gold: 25,
    desc: 'Cruel and cowardly, but quick with a blade.' },
  { id: 'orc', name: 'Orc', art: '👹', hp: '1d8+1', ac: 6, thac0: 19, speed: 5,
    calls: 'kin',
    attacks: [{ name: 'axe', dmg: '1d8' }], xp: 150, gold: 30,
    desc: 'The same breed that killed your father two seasons ago.' },
  { id: 'bugbear', name: 'Bugbear', art: '🐻', hp: '3d8+1', ac: 5, thac0: 17, speed: 6,
    calls: 'goblin',
    attacks: [{ name: 'morning star', dmg: '2d4+1' }], xp: 250, gold: 40,
    desc: 'A hairy giant goblin that hits far harder than it looks.' },
  { id: 'gnoll', name: 'Gnoll', art: '🐺', hp: '3d8', ac: 5, thac0: 17, speed: 6,
    calls: 'kin',
    attacks: [{ name: 'halberd', dmg: '2d4+2' }], xp: 300, gold: 50,
    desc: 'A hyena-headed brute swinging a rusty halberd.' },
  { id: 'minotaur', name: 'Minotaur', art: '🐂', hp: '4d8+4', ac: 6, thac0: 15, speed: 5,
    calls: 'arena',
    attacks: [{ name: 'horns', dmg: '1d6' }, { name: 'axe', dmg: '1d8' }], xp: 300, gold: 55,
    desc: 'Bull-headed and furious. It gores and chops in the same breath.' },
  { id: 'ettin', name: 'Ettin', art: '👥', hp: '5d8', ac: 4, thac0: 16, speed: 7,
    calls: 'arena',
    attacks: [{ name: 'left club', dmg: '1d8' }, { name: 'right club', dmg: '1d8' }], xp: 300, gold: 70,
    desc: 'A two-headed giant. Each head controls one arm, and each arm holds a club.' },
  { id: 'gargoyle', name: 'Gargoyle', art: '🗿', hp: '4d8+4', ac: 5, thac0: 15, speed: 4, magicReq: 1,
    calls: 'kin',
    attacks: [{ name: 'claw', dmg: '1d3' }, { name: 'claw', dmg: '1d3' }, { name: 'bite', dmg: '1d6' }, { name: 'horn', dmg: '1d4' }],
    xp: 400, gold: 180,
    desc: 'Living stone. Ordinary steel glances off its hide.' },
  { id: 'giant-spider', name: 'Giant Spider', art: '🕷️', hp: '4d8+4', ac: 4, thac0: 15, speed: 4,
    calls: 'giant-centipede',
    attacks: [{ name: 'bite', dmg: '2d4', poison: 4 }], xp: 450, gold: 250,
    desc: 'Patient, hairy, and venomous. Bring an antidote.' },
  { id: 'ghoul', name: 'Ghoul', art: '🧟', hp: '3d8', ac: 6, thac0: 16, speed: 4, special: { paralyze: true },
    calls: 'kin',
    attacks: [{ name: 'claw', dmg: '1d3' }, { name: 'claw', dmg: '1d3' }, { name: 'bite', dmg: '1d6' }],
    xp: 500, gold: 400,
    desc: 'Its touch can paralyze. A paralyzed gladiator is an easy meal.' },
  { id: 'wight', name: 'Wight', art: '👻', hp: '4d8+3', ac: 5, thac0: 15, speed: 4, magicReq: 1, special: { drain: true },
    calls: 'ghoul',
    attacks: [{ name: 'chilling touch', dmg: '1d4' }], xp: 700, gold: 500,
    desc: 'Each touch drains a level of experience. Pays well for good reason.' },
  { id: 'quickling', name: 'Quickling', art: '⚡', hp: '2d8+2', ac: -3, thac0: 13, speed: -10,
    calls: 'kin',
    attacks: [{ name: 'dagger', dmg: '1d4' }, { name: 'dagger', dmg: '1d4' }, { name: 'dagger', dmg: '1d4' }],
    xp: 900, gold: 600,
    desc: 'A blur of malice. Very hard to hit, but fragile once you connect.' },
  { id: 'hydra', name: 'Hydra', art: '🐍', hpFixed: 48, ac: 5, thac0: 13, speed: 6, special: { heads: 6 },
    attacks: [{ name: 'head', dmg: '1d6' }], xp: 800, gold: 700,
    desc: 'Six snapping heads. Each wound you deal silences another one.' },
  { id: 'giant-scorpion', name: 'Giant Scorpion', art: '🦂', hp: '5d8+5', ac: 3, thac0: 13, speed: 5,
    calls: 'arena',
    attacks: [{ name: 'claw', dmg: '1d10' }, { name: 'claw', dmg: '1d10' }, { name: 'sting', dmg: '1d4', poison: 5 }],
    xp: 1000, gold: 750,
    desc: 'Two crushing claws, and a stinger that keeps hurting long after it lands.' },
  { id: 'hill-giant', name: 'Hill Giant', art: '🪨', hp: '8d8+2', ac: 4, thac0: 12, speed: 7,
    calls: 'arena',
    attacks: [{ name: 'club', dmg: '2d8' }], xp: 1200, gold: 800,
    desc: 'Dim, slow, and enormous. One swing can flatten a novice.' },
  { id: 'fire-giant', name: 'Fire Giant', art: '🔥', hp: '10d8+3', ac: 3, thac0: 10, speed: 6, immune: ['fire'],
    calls: 'arena',
    attacks: [{ name: 'greatsword', dmg: '2d10+3' }], xp: 1400, gold: 900,
    desc: 'Forge-skinned and immune to flame.' },
  { id: 'storm-giant', name: 'Storm Giant', art: '⛈️', hp: '11d8+4', ac: 1, thac0: 9, speed: 5, immune: ['lightning'],
    calls: 'arena',
    attacks: [{ name: 'greatsword', dmg: '2d10+4' }], xp: 1600, gold: 1000,
    desc: 'The noblest of giants, and lightning means nothing to it.' },
  { id: 'earth-elemental', name: 'Earth Elemental', art: '⛰️', hp: '12d8', ac: 2, thac0: 9, speed: 8, magicReq: 2,
    attacks: [{ name: 'fist', dmg: '4d8' }], xp: 2000, gold: 1500,
    desc: 'A walking landslide. Only a +2 weapon can harm it.' },
  { id: 'troll', name: 'Troll', art: '🧌', hp: '8d8+8', ac: 4, thac0: 12, speed: 4, special: { regen: 3 },
    calls: 'arena',
    attacks: [{ name: 'claw', dmg: '1d4+4' }, { name: 'claw', dmg: '1d4+4' }, { name: 'bite', dmg: '2d6' }],
    xp: 1800, gold: 1500,
    desc: 'Regenerates 3 hit points a round. Fire stops it from healing.' },
  { id: 'wyvern', name: 'Wyvern', art: '🪽', hp: '7d8+7', ac: 3, thac0: 12, speed: 4,
    calls: 'arena',
    attacks: [{ name: 'bite', dmg: '2d8' }, { name: 'tail sting', dmg: '1d6', poison: 7 }], xp: 2400, gold: 1800,
    desc: "A dragon's lesser cousin with a deadly poisoned tail." },
  { id: 'black-dragon', name: 'Black Dragon', art: '🐉', hp: '10d8', ac: 2, thac0: 10, speed: 4, immune: ['acid'],
    breath: { name: 'acid', type: 'acid', uses: 3, chance: 0.33 },
    attacks: [{ name: 'claw', dmg: '1d6' }, { name: 'claw', dmg: '1d6' }, { name: 'bite', dmg: '3d6' }],
    xp: 6000, gold: 3000,
    desc: 'Spits acid. Its breath weakens as it is wounded.' },
  { id: 'red-dragon', name: 'Red Dragon', art: '🐲', hp: '14d8', ac: -1, thac0: 6, speed: 3, immune: ['fire'], final: true,
    breath: { name: 'fire', type: 'fire', uses: 3, chance: 0.25 },
    attacks: [{ name: 'claw', dmg: '1d10' }, { name: 'claw', dmg: '1d10' }, { name: 'bite', dmg: '3d10' }],
    xp: 12000, gold: 5000,
    desc: 'The mightiest creature the arena can host. No one has beaten it in 24 seasons.' },
];

for (const m of MONSTERS) {
  m.magicReq ??= 0;
  m.immune ??= [];
  m.special ??= {};
  m.calls ??= null;
  m.fine = Math.ceil(m.gold / 10); // the original's surrender fine: 10% of the award
}

export const MONSTER_BY_ID = Object.fromEntries(MONSTERS.map(m => [m.id, m]));
