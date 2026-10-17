// Hex battlefield lab: a sandbox for movement and positioning on a hex grid.
// It uses the real monster and mercenary data and the same to-hit and damage
// math as the game, but its own simplified turn loop, so ideas can be tried
// here before the real combat engine learns about positions.
//
// Turn order (a first take, to be workshopped):
//   1. You: move up to your movement, and attack one adjacent enemy, in either order.
//   2. Your mercenaries: each moves toward the nearest enemy and attacks if adjacent.
//   3. Enemies: each moves toward the nearest fighter on your side and attacks if adjacent.

import { MONSTERS, MONSTER_BY_ID } from '../data/monsters.js';
import { MERCS, MERC_BY_ID } from '../data/mercs.js';
import { roll, die, rangeText, parse } from '../engine/dice.js';
import { thac0, attacksThisRound } from '../rules/tables.js';
import * as H from '../engine/hex.js';
import { readSlot, writeSlot } from '../engine/save.js';
import { maxHp, armorClass, weaponOf, rollToHit, damageBonus } from '../rules/character.js';

const SIZE = 30;
const STEP_MS = 140;
const LEVELS = [1, 3, 5, 8, 11, 14];
const PLAYER_MOVE = 4;
const MERC_MOVE = 4;

// First guess at monster movement: lower initiative speed means faster.
export const moveFor = m => Math.max(2, Math.min(8, 6 - Math.round(m.speed / 2)));

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A rough fighter of the chosen level, so the lab doesn't need a save game.
function playerTemplate(level) {
  const gear = level >= 11 ? { w: 'Long Sword +2', dmg: '1d8+5', ac: -2 }
    : level >= 8 ? { w: 'Long Sword +1', dmg: '1d8+3', ac: 0 }
    : level >= 5 ? { w: 'Long Sword +1', dmg: '1d8+2', ac: 2 }
    : level >= 3 ? { w: 'Long Sword', dmg: '1d8+1', ac: 4 }
    : { w: 'Long Sword', dmg: '1d8+1', ac: 6 };
  const hp = 11 + (Math.min(level, 9) - 1) * 7 + Math.max(0, level - 9) * 3;
  const weaponPlus = level >= 11 ? 2 : level >= 5 ? 1 : 0;
  // Strength 16 adds 1 to hit; the weapon's magic adds its plus.
  return { name: `You (level ${level})`, art: '🛡️', hp, ac: gear.ac, thac0: thac0(level) - 1 - weaponPlus, level,
    attacks: [{ name: gear.w, dmg: gear.dmg }], move: PLAYER_MOVE, weaponPlus };
}

// ---- Your gladiator, copied from the game ----
// The lab works on its own copy of the game's autosave (slot "lab"), so
// nothing here can change your real game. The copy is refreshed every time
// the lab opens, or with "Copy again from my game".
const COPY_SLOT = 'lab';
let copy = null; // { savedAt, state } or null

function copyFromGame() {
  const auto = readSlot('auto');
  if (auto?.state?.character) {
    writeSlot(COPY_SLOT, auto.state);
    copy = readSlot(COPY_SLOT);
  } else {
    copy = readSlot(COPY_SLOT); // keep an older copy if the game has none
  }
}

const withBonus = (dice, bonus) => {
  const { n, sides, mod } = parse(dice);
  const total = mod + bonus;
  return `${n}d${sides}${total > 0 ? `+${total}` : total < 0 ? total : ''}`;
};

// The copied character, using the game's own rules for AC, to-hit and damage.
function playerFromSave(c, fullHealth) {
  const w = weaponOf(c);
  return {
    name: c.name, art: '🛡️', level: c.level,
    hp: fullHealth ? maxHp(c) : Math.max(1, c.hp), maxHp: maxHp(c),
    ac: armorClass(c),
    thac0: rollToHit(c, 0, w), // the roll needed against AC 0, with Strength and magic included
    attacks: [{ name: w.name, dmg: withBonus(w.dmg, damageBonus(c, w)) }],
    move: PLAYER_MOVE, weaponPlus: w.plus,
  };
}

function copyInfo() {
  const el = $('copyInfo');
  if (!copy) {
    el.textContent = 'No saved game found, so you fight as a sample gladiator. Start a game first to bring your own.';
    return;
  }
  const c = copy.state.character;
  const when = new Date(copy.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  el.textContent = `${c.name}, level ${c.level}${c.dead ? ' (fallen in your game)' : ''}, copied from your game ${when}. `
    + 'Fights here never change your real game.';
}

let lab;
let uid = 0;

function newUnit(side, base, pos) {
  return { id: `u${++uid}`, side, pos, maxHp: base.hp, moved: false, acted: false, ...base };
}

function setup() {
  const radius = Number($('radius').value);
  const board = H.hexagon(radius);
  const cells = new Set(board.map(H.key));
  const pillars = new Set();
  if ($('pillars').checked) {
    const candidates = board.filter(h => H.distance(h, { q: 0, r: 0 }) >= 1 && Math.abs(h.r) <= radius - 2);
    for (let i = 0; i < radius && candidates.length; i++) {
      pillars.add(H.key(candidates.splice(die(candidates.length) - 1, 1)[0]));
    }
  }
  lab = { radius, board, cells, pillars, units: [], round: 1, phase: 'player', log: [], hover: null, focus: null };

  // Spawn your side along the bottom edge, enemies along the top.
  const spots = dir => board
    .filter(h => !pillars.has(H.key(h)))
    .sort((a, b) => dir * (b.r - a.r) || Math.abs(a.q + a.r / 2) - Math.abs(b.q + b.r / 2));
  const bottom = spots(1);
  const top = spots(-1);

  const choice = $('level').value;
  const me = choice === 'save' && copy
    ? playerFromSave(copy.state.character, $('fullHealth').checked)
    : playerTemplate(Number(choice));
  lab.units.push(newUnit('you', me, bottom.shift()));
  const tier = MERC_BY_ID[$('merc').value];
  for (let i = 0; i < Number($('mercCount').value); i++) {
    lab.units.push(newUnit('ally', {
      name: `${tier.name} ${i + 1}`, art: tier.art, hp: tier.hp, ac: tier.ac, thac0: tier.thac0 - tier.weapon.plus,
      level: tier.level, attacks: [{ name: tier.weapon.name, dmg: `${tier.weapon.dmg}+${tier.weapon.plus + tier.dmgBonus}` }],
      move: MERC_MOVE, weaponPlus: tier.weapon.plus,
    }, bottom.shift()));
  }
  const m = MONSTER_BY_ID[$('monster').value];
  for (let i = 0; i < Number($('count').value); i++) {
    const hp = m.hpFixed ?? Math.max(1, roll(m.hp));
    lab.units.push(newUnit('enemy', {
      name: Number($('count').value) > 1 ? `${m.name} ${i + 1}` : m.name, art: m.art, hp, ac: m.ac, thac0: m.thac0,
      attacks: m.attacks, move: moveFor(m), magicReq: m.magicReq, monsterId: m.id,
    }, top.shift()));
  }
  log('Round 1', 'round');
  log('Your move: click a blue hex to move, or a red enemy next to you to attack.', 'sys');
  render();
}

// ---- Queries ----

const you = () => lab.units.find(u => u.side === 'you');
const living = side => lab.units.filter(u => u.hp > 0 && (!side || (side === 'friends' ? u.side !== 'enemy' : u.side === side)));
const unitAt = h => lab.units.find(u => u.hp > 0 && H.equal(u.pos, h));
const onBoard = h => lab.cells.has(H.key(h)) && !lab.pillars.has(H.key(h));
const freeFor = mover => h => onBoard(h) && (!unitAt(h) || unitAt(h) === mover);
const enemiesOf = u => living(u.side === 'enemy' ? 'friends' : 'enemy');

function hitChance(attacker, target) {
  const need = Math.min(20, Math.max(2, attacker.thac0 - target.ac));
  return Math.round(((21 - need) / 20) * 100);
}

// Hexes an enemy could reach this round and then strike from.
function threatZone() {
  const zone = new Set();
  for (const e of living('enemy')) {
    const reach = H.reachable(e.pos, e.move, freeFor(e));
    for (const k of reach.keys()) {
      for (const n of H.neighbors(H.fromKey(k))) if (onBoard(n)) zone.add(H.key(n));
    }
  }
  return zone;
}

// ---- Actions ----

function log(text, cls = '') {
  lab.log.push({ text, cls });
  const el = $('log');
  el.insertAdjacentHTML('beforeend', `<li class="${cls}">${esc(text)}</li>`);
  el.scrollTop = el.scrollHeight;
}

function attack(attacker, target) {
  const swings = attacker.side === 'enemy' ? attacker.attacks : [attacker.attacks[0]];
  const times = attacker.side === 'enemy' ? 1 : attacksThisRound(attacker.level, lab.round);
  for (let t = 0; t < times; t++) {
    for (const a of swings) {
      if (target.hp <= 0) return;
      if ((target.magicReq ?? 0) > (attacker.weaponPlus ?? 0)) {
        log(`${attacker.name}'s ${a.name} can't harm the ${target.name}.`, 'muted');
        return;
      }
      const r = die(20);
      const hit = r === 20 || (r !== 1 && r >= attacker.thac0 - target.ac);
      if (!hit) {
        log(`${attacker.name}'s ${a.name} misses ${target.name}.`, 'muted');
        continue;
      }
      const dmg = Math.max(1, roll(a.dmg));
      target.hp = Math.max(0, target.hp - dmg);
      log(`${attacker.name}'s ${a.name} hits ${target.name} for ${dmg}.`, attacker.side === 'enemy' ? 'bad' : attacker.side === 'ally' ? 'ally' : 'good');
      if (target.hp <= 0) log(`${target.name} falls!`, target.side === 'enemy' ? 'win' : 'bad');
    }
  }
}

async function walk(unit, path) {
  for (const h of path.slice(0, unit.move)) {
    unit.pos = h;
    render();
    await sleep(STEP_MS);
  }
}

// Move toward the nearest reachable foe, then attack if adjacent.
async function actAI(u, preferred) {
  if (u.hp <= 0 || lab.phase === 'over') return;
  const foes = enemiesOf(u);
  if (!foes.length) return;
  const paths = foes
    .map(f => ({ f, path: H.pathToAdjacent(u.pos, f.pos, freeFor(u)) }))
    .filter(x => x.path)
    .sort((a, b) => (b.f === preferred) - (a.f === preferred) || a.path.length - b.path.length);
  if (!paths.length) return;
  const { f, path } = paths[0];
  if (path.length) await walk(u, path);
  const target = foes.find(x => x === f && H.adjacent(u.pos, x.pos)) ?? foes.find(x => H.adjacent(u.pos, x.pos));
  if (target) {
    attack(u, target);
    render();
    await sleep(STEP_MS * 2);
  }
}

function checkEnd() {
  if (you().hp <= 0) {
    lab.phase = 'over';
    log('You have fallen. Press New battle to try again.', 'bad');
  } else if (!living('enemy').length) {
    lab.phase = 'over';
    log(`Victory in ${lab.round} round${lab.round === 1 ? '' : 's'}!`, 'win');
  }
  return lab.phase === 'over';
}

async function endTurn() {
  if (lab.phase !== 'player') return;
  lab.phase = 'busy';
  render();
  for (const a of living('ally')) {
    await actAI(a, lab.focus);
    if (checkEnd()) return render();
  }
  for (const e of living('enemy')) {
    await actAI(e);
    if (checkEnd()) return render();
  }
  lab.round++;
  for (const u of lab.units) { u.moved = false; u.acted = false; }
  lab.phase = 'player';
  log(`Round ${lab.round}`, 'round');
  render();
}

async function autoTurn() {
  if (lab.phase !== 'player') return;
  const me = you();
  lab.phase = 'busy';
  if (!me.moved) {
    await actAI(me, lab.focus);
    me.moved = true;
    me.acted = true;
  }
  lab.phase = 'player';
  if (!checkEnd()) await endTurn();
}

async function watch() {
  while (lab.phase === 'player') await autoTurn();
}

async function clickHex(h) {
  if (lab.phase !== 'player') return;
  const me = you();
  const target = unitAt(h);
  if (target && target.side === 'enemy') {
    if (me.acted) return hint('You have already attacked this round.');
    if (!H.adjacent(me.pos, target.pos)) return hint(`The ${target.name} is out of reach. Move next to it first.`);
    me.acted = true;
    lab.focus = target;
    attack(me, target);
    checkEnd();
    return render();
  }
  if (target || me.moved) return;
  const path = H.pathToHex(me.pos, h, freeFor(me));
  if (!path || path.length > me.move) return;
  lab.phase = 'busy';
  await walk(me, path);
  me.moved = true;
  lab.phase = 'player';
  render();
}

function hint(text) { $('hint').textContent = text; }

// ---- Drawing ----

function render() {
  const me = you();
  const reach = lab.phase === 'player' && !me.moved ? H.reachable(me.pos, me.move, freeFor(me)) : new Map();
  const hoverPath = lab.hover && reach.has(H.key(lab.hover)) && !unitAt(lab.hover)
    ? new Set(H.pathToHex(me.pos, lab.hover, freeFor(me))?.map(H.key) ?? [])
    : new Set();
  const threat = $('threat').checked && lab.phase !== 'over' ? threatZone() : new Set();

  const pts = lab.board.map(h => H.toPixel(h, SIZE));
  const minX = Math.min(...pts.map(p => p.x)) - SIZE, maxX = Math.max(...pts.map(p => p.x)) + SIZE;
  const minY = Math.min(...pts.map(p => p.y)) - SIZE, maxY = Math.max(...pts.map(p => p.y)) + SIZE;
  const svg = $('board');
  svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  const cells = lab.board.map(h => {
    const k = H.key(h);
    const u = unitAt(h);
    const cls = ['cell'];
    if (lab.pillars.has(k)) cls.push('pillar');
    else if (u?.side === 'enemy' && lab.phase === 'player' && !me.acted && H.adjacent(me.pos, u.pos)) cls.push('attackable');
    else if (hoverPath.has(k)) cls.push('path');
    else if (!u && reach.has(k) && reach.get(k) > 0) cls.push('reach');
    else if (threat.has(k)) cls.push('threat');
    if (u === me) cls.push('selected');
    const pts6 = H.corners(H.toPixel(h, SIZE), SIZE - 1).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `<polygon class="${cls.join(' ')}" points="${pts6}" data-key="${k}"><title>${u ? esc(`${u.name}: ${u.hp}/${u.maxHp} hp, AC ${u.ac}, moves ${u.move}${u.side === 'enemy' ? `, you hit it ${hitChance(me, u)}%, it hits you ${hitChance(u, me)}%` : ''}`) : ''}</title></polygon>`;
  }).join('');

  const units = living().map(u => {
    const p = H.toPixel(u.pos, SIZE);
    const w = SIZE * 1.2;
    const frac = u.hp / u.maxHp;
    return `
      <circle class="ring ${u.side}" cx="${p.x}" cy="${p.y}" r="${SIZE * 0.78}"></circle>
      <text class="unit" x="${p.x}" y="${p.y - 2}">${u.art}</text>
      <rect class="hpbg" x="${p.x - w / 2}" y="${p.y + SIZE * 0.5}" width="${w}" height="5" rx="2"></rect>
      <rect class="hp ${u.side}" x="${p.x - w / 2}" y="${p.y + SIZE * 0.5}" width="${w * frac}" height="5" rx="2"></rect>`;
  }).join('');
  const rocks = [...lab.pillars].map(k => {
    const p = H.toPixel(H.fromKey(k), SIZE);
    return `<text class="pillar-mark" x="${p.x}" y="${p.y}">🪨</text>`;
  }).join('');
  svg.innerHTML = cells + rocks + units;

  $('end').disabled = lab.phase !== 'player';
  $('auto').disabled = lab.phase !== 'player';
  $('watch').disabled = lab.phase !== 'player';
  if (lab.phase === 'player') {
    hint(me.moved && me.acted ? 'You have moved and attacked. End your turn.'
      : me.moved ? 'You have moved. Attack an adjacent enemy (red) or end your turn.'
      : me.acted ? 'You have attacked. You can still move.'
      : 'Move (blue hexes) and attack an adjacent enemy (red), in either order.');
  } else if (lab.phase === 'busy') {
    hint('Others are acting…');
  }
  renderRoster();
}

function renderRoster() {
  const rows = lab.units.map(u => `
    <tr class="${u.hp <= 0 ? 'muted' : ''}">
      <td>${u.art} ${esc(u.name)}</td>
      <td class="num">${u.hp}/${u.maxHp}</td>
      <td class="num">AC ${u.ac}</td>
      <td class="num">Move ${u.move}</td>
    </tr>`).join('');
  $('roster').innerHTML = `<tbody>${rows}</tbody>`;
}

// ---- Wiring ----

function fillControls() {
  $('monster').innerHTML = MONSTERS.map(m => `<option value="${m.id}"${m.id === 'gnoll' ? ' selected' : ''}>${m.art} ${esc(m.name)} (moves ${moveFor(m)})</option>`).join('');
  const mine = copy ? `<option value="save" selected>${esc(copy.state.character.name)} (your gladiator, level ${copy.state.character.level})</option>` : '';
  $('level').innerHTML = mine + LEVELS.map(l => `<option value="${l}"${!copy && l === 3 ? ' selected' : ''}>Sample gladiator, level ${l}</option>`).join('');
  copyInfo();
  $('merc').innerHTML = MERCS.map(m => `<option value="${m.id}"${m.id === 'sellsword' ? ' selected' : ''}>${m.art} ${esc(m.name)} (${rangeText(m.weapon.dmg, m.weapon.plus + m.dmgBonus)} dmg)</option>`).join('');
}

$('board').addEventListener('click', e => {
  const k = e.target.closest('[data-key]')?.dataset.key;
  if (k) clickHex(H.fromKey(k));
});
$('board').addEventListener('mouseover', e => {
  const k = e.target.closest('[data-key]')?.dataset.key ?? null;
  if (k === (lab.hover && H.key(lab.hover))) return;
  lab.hover = k ? H.fromKey(k) : null;
  if (lab.phase === 'player') render();
});
$('end').addEventListener('click', endTurn);
$('auto').addEventListener('click', autoTurn);
$('watch').addEventListener('click', watch);
$('reset').addEventListener('click', () => { $('log').innerHTML = ''; setup(); });
$('threat').addEventListener('change', render);

$('recopy').addEventListener('click', () => {
  copyFromGame();
  fillControls();
  $('log').innerHTML = '';
  setup();
});

copyFromGame();
fillControls();
setup();
