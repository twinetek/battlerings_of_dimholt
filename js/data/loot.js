// Loot that monsters can leave behind. Monsters list their drops as
// loot: [{ item, chance }]. For now all loot is venom; other kinds (hides,
// teeth, rare weapons) can be added here with their own kind.
//
// Venom: potency is the starting poison strength. It fades while carried
// and faster once applied to a weapon (see rules/loot.js). value is gold per
// point of current potency when sold to the Magic Shop.

export const LOOT = [
  { id: 'centipede-venom', name: 'Centipede Venom Sac',    kind: 'venom', source: 'giant-centipede', potency: 2, value: 15 },
  { id: 'spider-venom',    name: 'Spider Venom Gland',     kind: 'venom', source: 'giant-spider',    potency: 4, value: 40 },
  { id: 'scorpion-venom',  name: 'Scorpion Stinger Gland', kind: 'venom', source: 'giant-scorpion',  potency: 5, value: 60 },
  { id: 'wyvern-venom',    name: 'Wyvern Venom Bladder',   kind: 'venom', source: 'wyvern',          potency: 7, value: 120 },
];

export const LOOT_BY_ID = Object.fromEntries(LOOT.map(x => [x.id, x]));
