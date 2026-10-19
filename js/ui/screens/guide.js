// The player's guide. Every number in the tables is read from the game's
// data and rule files, so the guide stays correct when balance changes.

import { MONSTERS, MONSTER_BY_ID } from '../../data/monsters.js';
import { WEAPONS, WEAPON_BY_ID, ARMOR, ITEMS } from '../../data/equipment.js';
import {
  STATS, strBonus, dexAc, conHp, XP_FOR_LEVEL, MAX_LEVEL, FIRST_LEVEL_HP, HIT_DIE, HP_AFTER_NINE,
  thac0, attacksLabel, saveTarget, STARTING_GOLD, INN_PRICE, MAX_WEAPONS, GLAND_DECAY_TICKS, MAX_COATINGS,
  NATURAL_MAX, TOME_MAX, STAT_POINT_EVERY, ITEM_SPEED,
} from '../../rules/tables.js';
import { earnsStatPoint } from '../../rules/stats.js';
import { rangeText, span } from '../../engine/dice.js';
import { button, esc, gp, signed, d20Chance } from '../format.js';
import { specialText } from './arena.js';
import { poisonTotal } from '../../rules/poison.js';
import { config } from '../../config.js';
import { PLAYER_MOVE, MERC_MOVE, moveFor } from '../../rules/battlefield.js';
import { MERCS } from '../../data/mercs.js';
import { LOOT_BY_ID } from '../../data/loot.js';
import { summonKind, SUMMON_CHANCE_PER_MERC, SUMMON_CHANCE_MAX } from '../../rules/combat.js';

const SECTIONS = () => [
  ['g-goal', 'The goal'],
  ['g-create', 'Creating your gladiator'],
  ['g-stats', 'Stats'],
  ['g-progress', 'Leveling up'],
  ['g-training', 'Stat points and Tomes'],
  ['g-combat', 'How combat works'],
  ...(config.beta ? [['g-battlefield', 'The hex battlefield (beta)']] : []),
  ['g-monsters', 'Monsters'],
  ['g-specials', 'Special abilities'],
  ['g-poison', 'Poison'],
  ['g-mercs', 'Mercenaries'],
  ['g-reinforce', 'Reinforcements'],
  ['g-loot', 'Loot and venom'],
  ['g-weapons', 'Weapons'],
  ['g-armor', 'Armor'],
  ['g-magic', 'Magic items'],
  ['g-town', 'Town, healing, and saving'],
  ['g-keys', 'Keyboard shortcuts'],
];

const table = (head, rows, cls = '') => `
  <div class="table-wrap"><table class="guide-table ${cls}">
    <thead><tr>${head.map(h => `<th${h.num ? ' class="num"' : ''}>${h.label ?? h}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
const num = label => ({ label, num: true });
const tr = cells => `<tr>${cells.map(c => (typeof c === 'object' ? `<td class="num">${c.v}</td>` : `<td>${c}</td>`)).join('')}</tr>`;
const n = v => ({ v });

function statTable() {
  const rows = [];
  for (let v = 3; v <= TOME_MAX; v++) {
    const s = strBonus(v);
    rows.push(tr([
      v <= NATURAL_MAX ? `${v}` : `${v} <span class="muted small">(Tome)</span>`,
      n(signed(s.hit)), n(signed(s.dmg)), n(signed(dexAc(v))), n(signed(conHp(v))),
    ]));
  }
  return table(['Score', num('Str to hit'), num('Str damage'), num('Dex AC'), num('Con hp/level')], rows, 'compact-rows');
}

function levelTable() {
  const rows = [];
  for (let L = 1; L <= MAX_LEVEL; L++) {
    rows.push(tr([
      `${L}`,
      n(XP_FOR_LEVEL[L].toLocaleString()),
      L === 1 ? `${FIRST_LEVEL_HP} + Con` : L <= 9 ? `1-${HIT_DIE} + Con` : `+${HP_AFTER_NINE}`,
      n(thac0(L)),
      n(attacksLabel(L)),
      n(saveTarget('paralysis', L)),
      n(saveTarget('breath', L)),
      earnsStatPoint(L) ? '✓' : '',
    ]));
  }
  return table(['Level', num('XP needed'), 'Hit points gained', num('THAC0'), num('Attacks'),
    num('Save: paralysis & poison'), num('Save: breath'), 'Stat point'], rows, 'compact-rows');
}

function monsterTable() {
  const rows = MONSTERS.map(m => {
    const hp = m.hpFixed ? `${m.hpFixed}` : `<span class="nowrap">${m.hp} <span class="muted small">(${rangeText(m.hp)})</span></span>`;
    const attacks = m.special.heads
      ? `${m.special.heads} heads, ${rangeText(m.attacks[0].dmg)} each`
      : m.attacks.map(a => `${esc(a.name)} ${rangeText(a.dmg)}`).join(', ');
    return tr([
      `<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`,
      n(m.ac), hp, n(m.thac0), n(signed(m.speed)), attacks,
      m.magicReq ? `+${m.magicReq}` : '',
      esc(specialText(m) === 'None' ? '' : specialText(m)),
      n(m.xp.toLocaleString()), n(m.gold.toLocaleString()), n(m.fine.toLocaleString()),
    ]);
  });
  return table(['Opponent', num('AC'), 'Hit points', num('THAC0'), num('Speed'), 'Attacks per round',
    'Weapon needed', 'Special', num('XP'), num('Award'), num('Fine')], rows, 'monster-table');
}

function battlefieldSection() {
  const moves = MONSTERS.map(m => `${esc(m.name)} ${moveFor(m)}`).join(', ');
  return `
      <h3 id="g-battlefield">The hex battlefield (beta)</h3>
      <p>In the beta, every arena fight takes place on a hex-shaped arena. All the rules above still apply; the battlefield adds positions.</p>
      <ul>
        <li><strong>Your turn.</strong> Move up to ${PLAYER_MOVE} hexes (the blue ones; hover to see the path) and attack one adjacent enemy
          (red), in either order. Using an item replaces your attack. Then press <strong>End turn</strong>.</li>
        <li><strong>Reach.</strong> Weapons reach only the six hexes around you. Wands and the Potion of Fiery Breath reach your target
          anywhere on the field. Dragon breath still hits everyone on your side.</li>
        <li><strong>Targets.</strong> Click any enemy to make it your target (🎯). Your mercenaries move toward it and attack it when they can.</li>
        <li><strong>Everyone else.</strong> After your turn, each mercenary moves up to ${MERC_MOVE} hexes and attacks; then each enemy moves
          toward the nearest fighter on your side and attacks whoever is next to it. Pillars (🪨) and other fighters block movement.</li>
        <li><strong>Monster movement</strong> per round: ${moves}.</li>
        <li><strong>Reinforcements</strong> enter at the far edge of the arena.</li>
        <li><strong>The amber zone</strong> marks every hex an enemy could reach and strike this round.</li>
        <li><strong>Tester controls</strong> on the battle screen let you add enemies or free mercenaries, heal, rebuild the arena,
          and auto-play turns. They're for trying out scenarios and bend the rules.</li>
      </ul>`;
}

function lootTable() {
  const rows = [];
  for (const m of MONSTERS) {
    for (const drop of m.loot) {
      const item = LOOT_BY_ID[drop.item];
      rows.push(tr([`<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`, esc(item.name), n(`${Math.round(drop.chance * 100)}%`),
        n(item.potency), n(gp(item.value)), n(gp(item.value * item.potency)), n(item.potency * GLAND_DECAY_TICKS)]));
    }
  }
  return table(['Monster', 'Loot', num('Drop chance'), num('Potency'), num('Pays per point'), num('Pays when fresh'), num('Ticks until it spoils')], rows);
}

function venomTargetsTable() {
  return table(['Opponent', 'Weapon venom', num('Saves as level'), num('Save needed')], MONSTERS.map(m => {
    const level = Math.max(1, 21 - m.thac0);
    const note = m.immune.includes('poison') ? 'Immune'
      : m.resist.includes('poison') ? 'Resists: half damage'
      : m.loot.length ? 'Immune to its own venom' : 'Normal';
    return tr([`<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`, note, n(level), n(m.immune.includes('poison') ? '' : saveTarget('poison', level))]);
  }));
}

function mercTable() {
  return table(['Mercenary', num('HP'), num('AC'), num('THAC0'), 'Weapon', num('Damage'), num('Attacks'), num('Saves as level'), num('Wage')],
    MERCS.map(t => tr([`<span aria-hidden="true">${t.art}</span> ${esc(t.name)}`, n(t.hp), n(t.ac), n(t.thac0), esc(t.weapon.name),
      n(rangeText(t.weapon.dmg, t.weapon.plus + t.dmgBonus)), n(attacksLabel(t.level)), n(t.level), n(gp(t.wage))])));
}

function callsTable() {
  return table(['Opponent', 'Calls for help', 'Who comes'], MONSTERS.map(m => {
    if (!m.calls) return tr([`<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`, '<span class="muted">Never</span>', '']);
    const kind = MONSTER_BY_ID[summonKind(m)];
    return tr([`<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`,
      m.calls === 'arena' ? 'The arena master sends help' : 'Calls for help',
      `<span aria-hidden="true">${kind.art}</span> ${esc(kind.name)}`]);
  }));
}

function poisonTable() {
  const rows = [];
  for (const m of MONSTERS) {
    for (const a of m.attacks.filter(x => x.poison)) {
      const s = a.poison;
      const ticks = Array.from({ length: s }, (_, i) => s - i).join(' + ');
      rows.push(tr([`<span aria-hidden="true">${m.art}</span> ${esc(m.name)}`, esc(a.name), n(s), `${ticks}`, n(poisonTotal(s))]));
    }
  }
  return table(['Monster', 'Poisoned attack', num('Strength'), 'Damage each round', num('Total')], rows);
}

// Worked THAC0 examples, computed from the real rules so they stay correct.
function thac0Examples() {
  const you = (level, str, weaponId, monsterId, note) => {
    const w = WEAPON_BY_ID[weaponId];
    const m = MONSTER_BY_ID[monsterId];
    const bonus = strBonus(str).hit + w.plus;
    return { who: `You: level ${level}, Strength ${str}, ${w.name}`, target: m.name,
      t0: thac0(level), ac: m.ac, bonus, note };
  };
  const them = (monsterId, yourAc, note) => {
    const m = MONSTER_BY_ID[monsterId];
    return { who: m.name, target: 'You', t0: m.thac0, ac: yourAc, bonus: 0, note };
  };
  const rows = [
    you(1, 12, 'long-sword', 'giant-rat', "A typical first fight. No bonuses, so it's just THAC0 minus AC."),
    you(5, 17, 'long-sword-1', 'gargoyle', 'Strength 17 adds 1 and the +1 sword adds 1 more.'),
    you(8, 18, 'long-sword-2', 'quickling', 'A negative AC makes you need more: subtracting −3 adds 3.'),
    you(1, 12, 'long-sword', 'quickling', 'Above 20, only a natural 20 hits.'),
    them('hill-giant', 2, 'Monsters use the same formula against your AC.'),
    them('hill-giant', -2, 'Four points of better armor cut its chance by 20%.'),
    them('red-dragon', 6, 'Needs 1 or less: everything but a natural 1 hits.'),
  ].map(x => {
    const need = x.t0 - x.ac - x.bonus;
    const paren = v => (v < 0 ? `(${String(v).replace('-', '−')})` : `${v}`);
    const math = `${x.t0} − ${paren(x.ac)} − ${x.bonus} = <strong>${String(need).replace('-', '−')}</strong>`;
    return tr([
      esc(x.who), esc(x.target), n(x.t0), n(String(x.ac).replace('-', '−')), n(x.bonus ? signed(x.bonus) : '0'),
      n(math), n(`${d20Chance(need)}%`), `<span class="muted small">${esc(x.note)}</span>`,
    ]);
  });
  return table(['Attacker', 'Target', num("Attacker's THAC0"), num("Target's AC"), num("Attacker's Bonuses"),
    num("Attacker's Roll Needed"), num('Chance'), 'Why'], rows, 'thac0-table');
}

function weaponTable() {
  return table(['Weapon', num('Damage'), num('Speed'), num('Magic'), num('Cost'), num('Sells for')],
    WEAPONS.map(w => tr([esc(w.name), n(rangeText(w.dmg, w.plus)), n(w.speed), n(w.plus ? `+${w.plus}` : ''), n(gp(w.cost)), n(gp(Math.floor(w.cost / 2)))])));
}

function armorTable() {
  return table(['Armor', num('AC adjust'), num('Your AC with it*'), num('Cost')],
    ARMOR.map(a => tr([esc(a.name), n(signed(a.ac)), n(10 + a.ac), n(gp(a.cost))])));
}

function itemTable() {
  const where = { any: 'Town or arena', combat: 'Arena only', town: 'Town only', passive: 'Always on' };
  return table(['Item', 'Effect', 'Use', num('Charges'), num('Cost')],
    ITEMS.map(it => tr([esc(it.name), esc(it.effect), where[it.use], n(it.charges ?? ''), n(gp(it.cost))])));
}

export function render(ctx) {
  const inGame = !!ctx.state?.character;
  const toc = SECTIONS().map(([id, title]) => `<li><a href="#${id}" data-action="jump" data-id="${id}">${title}</a></li>`).join('');
  const startGold = span(STARTING_GOLD);
  return `
    <section class="guide">
      <h2>📖 Gladiator's Guide</h2>
      <p class="muted">Everything you need to know to survive the Battlerings. All numbers below come straight from the game's rules.</p>
      <nav class="panel guide-toc" aria-label="Guide sections"><ol>${toc}</ol></nav>

      <h3 id="g-goal">The goal</h3>
      <p>Dimholt is kept safe by its City Guard, and the city has promised that anyone who beats the mightiest creature
        the Battlerings can host becomes a Captain of the Guard. That creature is the <strong>Red Dragon</strong>.
        Start with the weakest opponents, win gold and experience, buy better gear, and work your way up the list.
        After you become Captain you can keep fighting as long as you like.</p>

      <h3 id="g-create">Creating your gladiator</h3>
      <ul>
        <li>Each of the six stats is rolled on 3d6, so it ranges from 3 to 18. You can reroll as often as you like before you begin.</li>
        <li>You start at level 1 with ${FIRST_LEVEL_HP} hit points plus your Constitution bonus (minimum 1).</li>
        <li>You start with ${startGold.min * 10}-${startGold.max * 10} gold (${STARTING_GOLD} × 10) and no equipment.
          A Long Sword (${gp(15)}) and Leather Armor (${gp(5)}) are an affordable first kit.</li>
      </ul>

      <h3 id="g-stats">Stats</h3>
      <ul>
        <li><strong>Strength</strong> adds to your chance to hit and to the damage of every weapon blow. It doesn't affect wands or potions.</li>
        <li><strong>Dexterity</strong> changes your armor class. Lower AC is better, so a negative adjustment helps.</li>
        <li><strong>Constitution</strong> adds hit points for each of your first 9 levels. Changes to Constitution apply
          to all of those levels at once, so raising it also raises the hit points you already have.</li>
        <li><strong>Intelligence, Wisdom, and Charisma</strong> don't affect the game yet. You can still raise them.</li>
      </ul>
      <p>Bonuses start at 15, and very low scores give penalties. Scores above ${NATURAL_MAX} can only be reached with Tomes.</p>
      ${statTable()}

      <h3 id="g-progress">Leveling up</h3>
      <p>You earn experience (XP) only by winning fights. When your XP reaches the next level's total you level up, even in
        the middle of a fight, and you gain hit points right away. Each level improves your <strong>THAC0</strong>
        ("To Hit Armor Class 0"), which makes you more accurate, and your saving throws, which help you resist paralysis
        and dragon breath. Fighters get extra attacks at level 7 (3 attacks every 2 rounds) and level 13 (2 every round).
        The highest level is ${MAX_LEVEL}.</p>
      ${levelTable()}

      <h3 id="g-training">Stat points and Tomes</h3>
      <ul>
        <li>You earn one <strong>stat point</strong> at every ${STAT_POINT_EVERY === 2 ? 'second' : `${STAT_POINT_EVERY}th`} level
          (levels ${STAT_POINT_EVERY}, ${STAT_POINT_EVERY * 2}, ${STAT_POINT_EVERY * 3} … ${MAX_LEVEL - (MAX_LEVEL % STAT_POINT_EVERY)}).</li>
        <li>Spend points at the <strong>Training Yard</strong> in town. Use + and − to plan, then press Confirm training.
          You don't have to spend them right away; unspent points are kept.</li>
        <li>Points can go into any stat, but training can't raise a stat above <strong>${NATURAL_MAX}</strong>.</li>
        <li><strong>Tomes</strong> from the Magic Shop raise Strength, Dexterity, or Constitution by 1, up to <strong>${TOME_MAX}</strong>.</li>
        <li>If a Wight drains a level that gave you a stat point, you lose that point. If it was still unspent, it simply
          disappears; if you spent it, that stat goes back down. Tomes are never lost. Reaching the level again gives the point back.</li>
        <li>The Equipment screen shows your full stat history.</li>
      </ul>

      <h3 id="g-combat">How combat works</h3>
      <p>Fights are played one round at a time. Each round you choose <strong>Fight</strong>, <strong>Use</strong> an item, or <strong>Surrender</strong>.</p>
      <ol>
        <li><strong>Initiative.</strong> You roll 1d10 plus your weapon's speed (or ${ITEM_SPEED} when using an item).
          The monster rolls 1d10 plus its speed. The lower total acts first, and ties go to you.</li>
        <li><strong>To hit.</strong> The attacker rolls 1d20 and needs at least: <code>THAC0 − target's AC − bonuses</code>.
          Your bonuses are Strength's to-hit bonus plus your weapon's magic bonus. A natural 20 always hits and a natural 1 always misses.
          The Battlerings screen shows your chance to hit each opponent and its chance to hit you.
          <p>THAC0 means "To Hit Armor Class 0": the d20 roll you need to hit a target with AC 0. Every point of AC above 0
            makes the target easier to hit, and every point below 0 makes it harder. Lower THAC0 is better, and yours
            drops by 1 each level. Each point of the roll you need is worth 5% chance.</p>
          ${thac0Examples()}</li>
        <li><strong>Damage.</strong> Your damage is the weapon's dice plus Strength's damage bonus plus the weapon's magic bonus, at least 1.</li>
        <li>After every blow, check whether anyone has fallen. Then the other side acts.</li>
      </ol>
      <ul>
        <li><strong>Armor class</strong> = 10 + armor adjustment + Dexterity adjustment − your best Ring of Protection.</li>
        <li><strong>Use</strong> takes your whole action for the round, and the monster still attacks.</li>
        <li><strong>More than one enemy?</strong> Click an enemy's card to make it your target. Your attacks, wands, and potions
          of fiery breath go to your target, and your mercenaries attack it too. When it falls, you move on to the next enemy automatically.
          Each enemy attack picks a random living fighter on your side.</li>
        <li><strong>Surrender</strong> ends the fight immediately. The arena fines you 10% of the opponent's award, or all your gold if you have less.</li>
        <li><strong>Death</strong> is permanent for that character. The game autosaves after every round, so reloading can't undo a fight,
          but you can load one of your manual save slots.</li>
      </ul>

      ${config.beta ? battlefieldSection() : ''}

      <h3 id="g-monsters">Monsters</h3>
      <p>Opponents are listed in order of toughness. Hit points are rolled fresh for each fight from the dice shown.
        Speed is added to the monster's initiative roll, so lower is faster. "Weapon needed" means a weapon with at
        least that magic bonus is required to harm it; wands still work.</p>
      ${monsterTable()}

      <h3 id="g-specials">Special abilities</h3>
      <ul>
        <li><strong>Paralyzing touch</strong> (Ghoul): each hit that lands lets you roll a saving throw against paralysis.
          Fail it and you can't act for 1-3 rounds, and every attack against you hits automatically.</li>
        <li><strong>Level drain</strong> (Wight): every hit takes away one level, along with its hit points and its stat point.
          Your XP drops to halfway through the new level. A drain at level 1 kills you.</li>
        <li><strong>Regeneration</strong> (Troll): heals 3 hit points at the end of every round. Fire damage, from the Potion of
          Fiery Breath or the Wand of Fire, stops it from regenerating for the rest of the fight.</li>
        <li><strong>Many heads</strong> (Hydra): it attacks once per remaining head. Every sixth of its hit points you take away kills a head.</li>
        <li><strong>Breath weapon</strong> (dragons): up to 3 times a fight, a dragon may breathe instead of attacking.
          The breath deals half the dragon's current hit points, so wounding it weakens the breath. A successful saving throw halves the damage again.</li>
        <li><strong>Immunities</strong>: Fire Giants and Red Dragons ignore fire, Storm Giants ignore lightning, and Black Dragons ignore acid.</li>
        <li><strong>Speed</strong> (Quickling): it almost always strikes first, and its AC of −3 makes it very hard to hit.</li>
        <li><strong>Poison</strong> (Giant Centipede, Giant Spider, Giant Scorpion, Wyvern): see the next section.</li>
      </ul>

      <h3 id="g-poison">Poison</h3>
      <p>Some attacks are venomous. Poison keeps hurting you after the blow lands, and it can outlast the fight.</p>
      <ul>
        <li><strong>Saving throw.</strong> Each time a poisoned attack hits you, you roll a saving throw against poison
          (the same number as against paralysis; see the level table). Succeed and you shrug off the venom, though the
          attack's normal damage still lands. Higher levels resist more often.</li>
        <li><strong>Strength.</strong> Fail and you are <strong>Poisoned</strong> with that attack's strength. At the end of
          every round you take damage equal to the strength, then it drops by 1. Strength 4 deals 4, 3, 2, then 1: 10 in all.</li>
        <li><strong>Stacking.</strong> Poisoned again while already poisoned? Your strength becomes the higher of the two, plus 1.
          Repeated stings get worse, but they don't simply add up.</li>
        <li><strong>After the fight.</strong> When you win or surrender, any poison left is applied all at once as you leave.
          It can't drop you below 1 hit point after a fight. If it would, you stop at 1 and the rest of the poison
          <strong>lingers</strong> into your next fight, where it starts burning again from the first round.</li>
        <li><strong>Warning.</strong> The status bar shows <span class="tag bad">☠ Poisoned</span> while poison lingers, and the
          game asks you to confirm before you start a fight while poisoned.</li>
        <li><strong>Cures.</strong> A Potion of Neutralize Poison (${gp(ITEMS.find(i => i.cure).cost)}, Magic Shop) works in town or
          in a fight (it uses your turn). One night at the inn also cures it. Healing potions don't.</li>
        <li><strong>Death.</strong> Poison can kill you during a fight. The log will say "You succumb to the poison."</li>
        <li><strong>Turn it around.</strong> Poisonous monsters can drop venom you can put on your own weapon. See Loot and venom.</li>
        <li><strong>History.</strong> The Equipment screen keeps a poison record: how often each monster poisoned you,
          how often you resisted, and how much damage its poison did.</li>
      </ul>
      ${poisonTable()}

      <h3 id="g-mercs">Mercenaries</h3>
      <p>On the Battlerings screen you can hire fellow fighters for a single fight. Pick your opponent, use + and − in the
        <strong>Hire help</strong> panel, then press Fight.</p>
      <ul>
        <li><strong>Wages</strong> are paid when the fight starts and are never refunded, even if you surrender or a mercenary falls.
          You can hire as many as you can afford.</li>
        <li><strong>One fight only.</strong> Your crew leaves after every fight, and they don't gain experience or keep anything.
          "Fight another … with the same crew" and "Same crew as last time" re-hire them in one click, at full price.</li>
        <li><strong>How they fight.</strong> Your side acts on your initiative: you first, then each mercenary.
          Mercenaries always attack your target. They can be poisoned and paralyzed like you. A Wight's draining touch
          does an extra 1-8 damage to them instead of taking a level. Dragon breath hits every fighter on your side.</li>
        <li><strong>Magic weapons count.</strong> A mercenary whose weapon isn't magic enough can't hurt Gargoyles, Wights,
          or Earth Elementals, and the hiring panel says so.</li>
        <li><strong>Experience is split</strong> evenly among everyone who fought, alive or fallen, and the mercenaries' shares
          are lost. With two mercenaries you earn a third. The opponent's gold award is all yours.</li>
        <li><strong>The Red Dragon.</strong> With hired help, you only become Captain of the Guard if you land the killing blow yourself.</li>
        <li>If you fall, the fight is lost no matter who is still standing.</li>
      </ul>
      ${mercTable()}

      <h3 id="g-reinforce">Reinforcements</h3>
      <p>Bring help, and your opponent may bring some too. Solo fights are always one on one.</p>
      <ul>
        <li><strong>At half health.</strong> The first time your opponent drops below half its hit points, it summons help at once.</li>
        <li><strong>Each round</strong> there's a ${Math.round(SUMMON_CHANCE_PER_MERC * 100)}% chance per living mercenary
          (at most ${Math.round(SUMMON_CHANCE_MAX * 100)}%) that it calls for help. The log warns you, and help arrives at the start of the next round.</li>
        <li><strong>Limit.</strong> There are never more summoned enemies on the sand (or on their way) than mercenaries you hired.</li>
        <li>Only the opponent you chose can call for help, and only while it's alive.</li>
        <li><strong>Every enemy must be defeated</strong> to win, summoned ones included. They add their experience to the split,
          but they don't pay any gold.</li>
        <li>Pack creatures call their own kind. Loners get help from the arena master, who sends a creature a few places weaker on the list.
          The Hydra, Earth Elemental, and dragons never call for help.</li>
      </ul>
      ${callsTable()}

      <h3 id="g-loot">Loot and venom</h3>
      <p>Poisonous monsters sometimes leave their venom behind when they die, including summoned ones. Use it to coat your
        weapons, or sell it to the alchemist at the Magic Shop.</p>
      <ul>
        <li><strong>The clock.</strong> Venom fades with time. The clock ticks <strong>once per arena visit</strong> (however many
          fights you have before going back to town) and <strong>once per night</strong> at the inn. The Equipment screen shows the clock.</li>
        <li><strong>In your pack</strong>, venom loses 1 potency every ${GLAND_DECAY_TICKS} ticks, so it survives long rests.
          At 0 it spoils and is thrown out. The alchemist pays by current potency, so fresh venom is worth more.</li>
        <li><strong>Coating a weapon.</strong> On the Equipment screen, press "Apply to…" on a gland and pick any weapon you own.
          The gland is used up and the coating starts at its potency. A coating loses 1 strength <strong>every tick</strong>, so coat
          your weapon right before an arena visit, not before a night at the inn.</li>
        <li><strong>Stacking.</strong> A weapon can carry up to ${MAX_COATINGS} different venoms, say wyvern and scorpion. Applying the same venom
          again refreshes it to the stronger of the two. Selling a weapon loses its coatings.</li>
        <li><strong>Poisoning monsters.</strong> Every time you hit with a coated weapon in hand, each coating gets its own chance:
          the monster rolls a saving throw against poison, as a fighter of level 21 − its THAC0. If it fails, it's poisoned with the coating's
          strength and follows the same rules as poison on you: damage equal to the strength at the end of every round, then the strength drops by 1,
          and a second venom taking hold makes it the higher of the two plus 1.</li>
        <li><strong>Immune and resistant.</strong> Undead (Ghoul, Wight) and creatures of stone and earth (Gargoyle, Earth Elemental) are
          immune. No monster can be poisoned by its own kind's venom, so scorpion venom does nothing to a Giant Scorpion. Dragons resist
          poison: each round's poison damage is halved (rounded up).</li>
        <li>Only your weapon carries venom; mercenaries' weapons don't.</li>
      </ul>
      ${lootTable()}
      <p class="muted small">How easily each opponent shrugs off venom from your weapon:</p>
      ${venomTargetsTable()}

      <h3 id="g-weapons">Weapons</h3>
      <p>You can carry up to ${MAX_WEAPONS} weapons and switch between them at the Equipment screen. Damage includes the
        magic bonus but not your Strength bonus. Speed is added to your initiative roll, so lower is faster. Everything sells back for half price.</p>
      ${weaponTable()}

      <h3 id="g-armor">Armor</h3>
      <p>You wear one suit at a time. When you buy new armor, the armorer takes your old suit as a trade-in at half its price.</p>
      ${armorTable()}
      <p class="muted small">* Before Dexterity and rings.</p>

      <h3 id="g-magic">Magic items</h3>
      <p>Rings work while you carry them, but only your best ring counts.
        Wands lose a charge each use and crumble when empty; a partly used wand sells for less. Wands and the fiery potion always hit,
        even against monsters that need a magic weapon, unless the monster is immune to that kind of damage.</p>
      ${itemTable()}

      <h3 id="g-town">Town, healing, and saving</h3>
      <ul>
        <li><strong>The Griffin Inn</strong>: each night costs ${gp(INN_PRICE)}, heals 1 hit point, and cures poison. Each night also ticks the venom clock. "Stay until healed" sleeps as many nights as you need, or as many as you can afford.</li>
        <li><strong>Healing potions</strong> heal faster and work in the arena too, but cost more.</li>
        <li><strong>Saving</strong>: the game autosaves in your browser after every action. Save / Load has 3 extra slots,
          and you can export your game to a file as a backup or to move it to another device. Clearing your browser data erases saves that aren't exported.</li>
      </ul>

      <h3 id="g-keys">Keyboard shortcuts</h3>
      ${table(['Where', 'Keys'], [
        tr(['Character creation', '<kbd>R</kbd> reroll, <kbd>Enter</kbd> in the name box to begin']),
        tr(['Town', '<kbd>A</kbd> Battlerings, <kbd>W</kbd> Weaponsmith, <kbd>R</kbd> Armorer, <kbd>M</kbd> Magic Shop, <kbd>I</kbd> Inn, <kbd>T</kbd> Training Yard, <kbd>E</kbd> Equipment, <kbd>S</kbd> Save / Load, <kbd>G</kbd> Guide']),
        tr(['Combat', '<kbd>F</kbd> fight (press again to skip the animation), <kbd>U</kbd> use an item, <kbd>S</kbd> surrender']),
        tr(['Inn', '<kbd>H</kbd> stay until healed']),
      ])}

      <div class="row">${inGame ? button('← Back to town', 'go', { to: 'town' }, { cls: 'ghost' }) : button('← Back', 'go', { to: 'title' }, { cls: 'ghost' })}
        ${button('↑ Top', 'jump', { id: 'top' }, { cls: 'ghost' })}</div>
    </section>`;
}

export const actions = {
  jump(ctx, d) {
    if (d.id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};
