# Terrain and elevation on the hex battlefield: design

Status: designed, not built. Terrain generation is already built and documented in `DESIGN.md` ("Terrain"); this file covers the rest. This is for the hex battlefield beta (`hex_battlefield/`). It builds on the ranged-attack design in `Todo_ranged.md`. Move the settled parts into `DESIGN.md` once they're built.

## Goals

- **Height is a resource:** high ground should be worth fighting for, and getting there should cost something.
- **Stats matter in three dimensions:** Dexterity carries you farther on the flat and down slopes; Strength carries you up them (and your armor); Constitution softens falls.
- **Monsters move differently:** a spider walks up a cliff, a giant steps up it, and a dragon flies over it.
- **One set of numbers:** you, mercenaries and monsters all follow the same terrain rules, with traits instead of special cases.
- **Classic fights keep working:** with no grid, every terrain modifier is 0.

## The terrain model

- **Levels:** each hex has a whole-number **level** from 0 (the arena floor) to `MAX_HEIGHT` (3), set when the arena is generated. `DESIGN.md` ("Terrain") describes the layouts, how levels are stored, and `levelOf`.
- **A step:** moving between two adjacent hexes is a step **up** or **down** by the difference in their levels. A difference of 0 is flat.
- **Pillars** stay as they are: impassable, and they block every line of sight. They're "infinitely tall".
- **Cliffs and slopes:** a **slope** is a difference of 1 between neighbors; a **cliff** is a difference of 2 or more. The board draws cliffs as thick edges, so you can see where you can't walk.

## Movement

Movement becomes a budget of **movement points (MP)** per turn instead of a count of hexes:

| Step into a hex that is… | MP cost |
|---|---|
| Level with you | 1 |
| Up by *n* levels | 1 + `climbCost` × *n* |
| Down by *n* levels | 1 + `dropCost` × *n* |

Two limits apply to a single step:

- **`climbMax`:** the most levels you can climb in one step. A higher step is a wall; go around or find a slope.
- **`safeDrop`:** the most levels you can step down safely. You may still **jump** down farther, up to `safeDrop + 2`, and take falling damage (see below).

**The first step is always allowed** if it's within `climbMax` and your jump limit, even if it costs more MP than you have. That way slow fighters (giants with 2 MP) are never stuck at the foot of a slope. After that first step, your turn's movement is over.

Pathfinding changes from "fewest hexes" to "cheapest MP". It uses a small Dijkstra search over the board (at most 91 hexes on a radius-5 board, so cost is no concern).

### Base numbers and what stats change

| | Base | Changed by |
|---|---|---|
| **MP on the flat** | 4 | Dexterity, armor bulk (offset by Strength) |
| **`climbCost`** (extra MP per level up) | 2 | Strength |
| **`climbMax`** (levels per step) | 1 | Strength |
| **`dropCost`** (extra MP per level down) | 1 | Dexterity |
| **`safeDrop`** (levels per step without harm) | 1 | Dexterity |
| **Fall damage** | 1d6 per level beyond `safeDrop` | Constitution |

**Dexterity: speed on the flat and agility going down.**

| Dex | 3-5 | 6-15 | 16 | 17-18 | 19-22 | 23-25 |
|---|---|---|---|---|---|---|
| MP | −1 | +0 | +0 | +1 | +2 | +3 |
| `dropCost` | 2 | 1 | 0 | 0 | 0 | 0 |
| `safeDrop` | 1 | 1 | 2 | 2 | 3 | 3 |

**Strength: climbing, and carrying armor.**

| Str | 3-8 | 9-15 | 16-17 | 18 | 19-22 | 23-25 |
|---|---|---|---|---|---|---|
| `climbCost` | 3 | 2 | 1 | 1 | 1 | 0 |
| `climbMax` | 1 | 1 | 1 | 2 | 2 | 3 |
| Armor bulk carried free | 0 | 0 | 1 | 2 | 2 | 3 |

**Armor bulk** is a new field on armor. It's how Strength affects flat movement: heavy armor slows you down unless you're strong enough to carry it.

| Armor | Bulk |
|---|---|
| None, Padded, Leather, Studded | 0 |
| Scale, Chain | 1 |
| Splint, Plate, Field Plate, Full Plate (any +) | 2 |

```
MP = 4 + dexMove(dex) - max(0, bulk - strCarry(str))    // never below 2
```

Magic armor is no lighter. That's a deliberate trade-off against its better AC; see the open questions.

**Constitution: surviving falls.** A jump beyond `safeDrop` deals 1d6 per extra level. Subtract the character's `conHp(con)` bonus (the hit-point table) once from the total; a negative bonus adds damage. A successful saving throw against paralysis halves the damage (it's the closest AD&D save to "land well"). A fall can't kill you; it stops at 1 hp, like poison sweating out at the end of a fight.

**Example.** Climbing two slopes (each 1 level) and walking 1 hex on top:

| Gladiator | MP | Climb cost | Path cost | Makes it? |
|---|---|---|---|---|
| Str 10, Dex 10, chain mail | 4 − 1 (bulk 1, carries 0) = **3** | 2 | 3 + 3 + 1 = 7 | No. Takes 3 turns: one per slope, then the last hex. |
| Str 16, Dex 17, chain mail | 4 + 1 − 0 (carries 1) = **5** | 1 | 2 + 2 + 1 = 5 | Yes, exactly. |
| Str 18, Dex 10, plate | 4 − 0 (carries 2) = **4** | 1 | 2 + 2 + 1 = 5 | No; but with `climbMax` 2 they can take a 2-level cliff directly instead (1 + 2 = 3 MP). |

### Monster and mercenary traits

Monsters have no stats, so they get **movement traits**. These set the same five numbers. A monster's flat MP is still `moveFor(m)` from `rules/battlefield.js`.

| Trait | Who | Effect |
|---|---|---|
| *(none)* | Most monsters | The base numbers: climb cost 2, climbMax 1, drop cost 1, safeDrop 1 |
| `climber` | Giant Spider, Giant Centipede | Climb cost 0, climbMax 3. They walk up walls. |
| `tall` | Ettin, Minotaur, Hill/Fire/Storm Giant, Troll, Earth Elemental | Climb cost 1, climbMax 2, safeDrop 2. Melee reaches 2 levels (see below). |
| `flier` | Gargoyle, Wyvern, Black Dragon, Red Dragon | Ignores climb and drop costs and limits. Never falls. |
| `nimble` | Quickling, Giant Rat, Kobold, Goblin | Drop cost 0, safeDrop 2. |

Mercenaries use fixed numbers like everything else about them. Militia, Sellsword and Veteran use the base numbers with 4 MP. The Knight and Champion wear plate: 3 MP, but climb cost 1 (they're strong).

## Melee and height

**Reach:** melee needs the two fighters to be adjacent **and** no more than **1 level apart**. `tall` monsters reach **2 levels**. Fighters who are adjacent but too far apart vertically can't strike each other, which is how a cliff edge becomes a safe perch.

Let **h** = the attacker's level minus the defender's level (positive means the attacker is above).

| Situation | Effect | Constant |
|---|---|---|
| **Attacking up** (h < 0) | −2 to hit per level | `UPHILL_TO_HIT` = 2 |
| **Attacking down** (h > 0) | +2 damage per level, added before the minimum of 1 | `DOWNHILL_DMG` = 2 |
| **Defending from above** (the defender is higher, h < 0) | +2 per level to the defender's saving throws against that attack's effects | `HIGH_GROUND_SAVE` = 2 |

**"Defending down"** in the request is read as *the defender stands above the attacker and fights downward*. So the high-ground fighter gets the save bonus, the low-ground attacker gets the to-hit penalty, and the high-ground attacker gets the damage bonus. High ground is good in all three ways, and all three are symmetric between your side and the enemies.

What the save bonus covers:

- **Poison** from a monster's attack: `exposeToPoison` for you, and the same save for mercenaries.
- **Paralysis** (Ghoul touch).
- **Your venom** against a monster standing above you: the monster gets the bonus, so it's symmetric.
- **Breath:** the save compares each target's level with the dragon's. A dragon below you breathing up gives +2 per level.
- **Level drain** has no save today. It stays that way, and terrain doesn't change it.

**Where this lives:** `inReach` in `rules/combat.js` already decides melee reach on the grid. It gains the height check. A new `heightMods(cb, attackerUid, defenderUid)` returns `{ toHit, dmg, save }`, which `playerTurn`, `allyTurn`, `enemyTurn`, `afflictPlayer`, `afflictAlly`, `envenom` and `breathe` add in. With no grid, every value is 0.

## Ranged attacks and height

These extend the range profile in `Todo_ranged.md`.

### Range

- **Shooting down:** +1 effective aim per level below you, to at most +2. Gravity helps, and you can see farther.
- **Shooting up:** −1 effective aim per level above you.
- **The aim cap:** the height bonus is added *after* `AIM_CAP`. A good perch can push you past the cap by up to 2 hexes, which makes towers worth taking.
- **Maximum range** is still effective aim + `FALLOFF_HEXES`, so the far end of your range moves too.

```
aim = min(AIM_CAP, <weapon and stat aim from Todo_ranged.md>)
      + clamp(shooterLevel - targetLevel, -MAX_HEIGHT, +2)
```

Shooting up never gains anything, so archers want to be high and their targets low. To-hit and damage don't otherwise change with height for ranged attacks. Only the range does, as the request asked, and the line of sight below.

### Line of sight in three dimensions

The hex line from `Todo_ranged.md` gets a height check. Treat the shooter's eye and the target's body as **half a level** above their hexes. Then the height of the line of fire at a fraction *t* of the way along is:

```
lineH(t) = shooterLevel + 0.5 + (targetLevel - shooterLevel) * t
```

- **Terrain blocks** if a hex on the line has `level > lineH(t)`. A hill between two fighters on the floor hides them from each other.
- **Fighters give cover** (−2 each, as before) only if their body reaches the line: `theirLevel + 1 > lineH(t)`. From high ground you shoot **over** the heads of fighters below.
- **Pillars** always block.

Example: an archer on level 2, a hill of level 1 halfway, and a target on the floor. The line is at 2.5 − 1 = 1.5 over the hill, which is above level 1, so the shot is clear. An orc on the floor in between has its body top at 1, below 1.5, so it gives no cover. The same shot taken from the floor is blocked by the hill.

## The board

- **Shading:** each level is drawn lighter than the one below, with the level number in small type in the hex corner.
- **Cliffs:** edges between hexes 2+ levels apart are drawn thick. Edges you can climb, given your own `climbMax`, are drawn thinner.
- **Move preview:** hovering a hex shows the path *and its MP cost* ("5 of 5 MP"). A jump hex shows its fall damage range ("jump: 1-6 damage").
- **Tooltips:** hovering an enemy adds the terrain parts: "uphill −2 to hit", "you're above it: +2 damage", "out of reach: 2 levels apart".
- **Threat zone:** the amber zone already covers "hexes an enemy can reach and strike from". It now uses each enemy's MP and its melee height reach.
- **Tester controls:**
  - A layout picker (Flat, Hills, Ziggurat, Ledges) next to radius and pillars. Its choice goes in `settings.battle.terrain`.
  - A "Paint height" toggle: click a hex to raise it 1, Shift-click to lower it. That's for setting up scenarios, like the other tester controls.

## Monster AI

- **Paths:** `advance` uses the cheapest path, not the shortest.
- **Falls:** monsters don't jump if the fall could do more than a quarter of their current hp.
- **High ground:** when two hexes next to the target are equally cheap, a monster picks the higher one.
- **Archers and throwers** (giants with boulders, Archer mercenaries) prefer hexes higher than their target. That's the same rule, applied when choosing where to shoot from.
- **Mercenaries** follow the same rules. A "hold the high ground" order joins the mercenary-order ideas already listed in `DESIGN.md`.

## Where it goes in the code

- **`engine/hex.js`:**
  - `cheapestReachable(start, budget, cost)` and `cheapestPath(start, done, cost)`, where `cost(from, to)` returns a number or `Infinity`.
  - The existing BFS helpers stay for flat uses.
- **`rules/tables.js`:**
  - Constants: `UPHILL_TO_HIT`, `DOWNHILL_DMG`, `HIGH_GROUND_SAVE`, `MELEE_HEIGHT_REACH = 1`, `HEIGHT_AIM_MAX = 2`.
  - Tables: `dexMove`, `dexDrop`, `strClimb`, `strCarry`.
- **`data/equipment.js`:** `bulk` on each armor.
- **`data/monsters.js`:** `move: ['climber' | 'tall' | 'flier' | 'nimble']`.
- **`data/mercs.js`:** per-tier MP and climb numbers.
- **`rules/character.js`:** `moveStats(c)` returns `{ mp, climbCost, climbMax, dropCost, safeDrop }` from stats and armor. The Character screen shows it.
- **`rules/battlefield.js`:**
  - `stepCost(state, uid, from, to)`, `moveStatsOf(state, uid)` (for you, a mercenary or a monster) and `fallDamage`.
  - `moveYou`, `advance`, `reachableFor` and `threatZone` switch to MP.
  - `cb.turn.movedHexes` (from `Todo_ranged.md`) counts hexes, not MP.
- **`rules/combat.js`:**
  - `heightMods`, the reach check in `inReach`, and the save bonus passed into `saveTarget` comparisons.
  - Attack events gain `height: h`, so the presenter can say "You strike down at the Orc".
  - Falls are new `fall` events with `dmg` and `hp`.
- **`ui/presenter.js`:** lines for falls, uphill and downhill blows, and "out of reach" ("The Ettin can't reach you on the ledge.").
- **`ui/screens/battle.js`:** shading, cliff edges, MP previews, tooltips, the layout picker and the paint tool.
- **Save:** the new fight fields here (`movedHexes`, fall state) default safely when missing. If this ships with `Todo_ranged.md`, that design's version 5 migration covers both.

## Testing

- **`tests/index.html`, unit checks:**
  - **Pathfinding:** Dijkstra finds the cheapest path, not the shortest; `cheapestReachable` respects the budget.
  - **Step costs:** flat 1; up and down with each Str and Dex row; `climbMax` walls; jumps allowed to `safeDrop + 2` and refused beyond.
  - **First step:** always allowed for a slow mover, and it ends the move.
  - **MP:** the three gladiators in the example get exactly those numbers; armor bulk is offset by Strength; MP never drops below 2.
  - **Falls:** 1d6 per extra level, the Con adjustment, the save halving it, never below 1 hp.
  - **Traits:** climbers, tall, fliers and nimble each change the numbers as listed.
  - **Melee reach:** 1 level, and 2 for `tall`.
  - **Height modifiers:** uphill −2 to hit per level; downhill +2 damage per level; save bonuses for poison, paralysis, venom and breath when the defender is above.
  - **Ranged:** aim +1 per level shooting down (capped at +2 and allowed past `AIM_CAP`); −1 per level shooting up.
  - **3D line of sight:** a hill blocks between floor fighters; a perch sees over it; fighters below the line give no cover.
  - **Classic fight:** every terrain modifier is 0.
- **Balance simulation:** extend the battlefield simulation from `Todo_ranged.md` to run each build on Flat, Hills and Ziggurat. Watch whether terrain swings win rates by more than about 10 points; if it does, the symmetric layout isn't enough and the constants are too big. Also compare a strong plate-wearer with an agile leather-wearer, to check that both builds have their ground.
- **`tests/beta-smoke.html`:** pick the Ziggurat layout, climb to a higher hex through the real screen, and check the MP preview and an uphill or downhill log line.

## Build order

1. Cheapest-path search, step costs and MP for you. Board shading and cliff edges.
2. Stats: `moveStats`, armor bulk, falls. Character screen display.
3. Melee reach and height modifiers, including saves.
4. Monster and mercenary traits; AI using the cheapest path and preferring high ground.
5. Ranged range by height and 3D line of sight. This depends on `Todo_ranged.md` being built first.
6. The layout picker, the paint tool, making Hills the default layout, and the balance simulation; tune the constants.

## Open questions

- **Should attacking down also help to-hit** (+1), or is +2 damage enough? The request only specifies damage, so this design keeps to-hit unchanged.
- **Should high ground also improve armor class,** or is the save bonus the defender's only reward?
- **Should magic armor have less bulk** (+1 armor counts 1 lighter)? That would make expensive armor a movement upgrade too.
- **Pits and water:** levels below the floor, and hexes that cost extra MP (mud, shallow water)?
- **Knockback:** should a big hit (giants, the Minotaur's charge) push a fighter off a ledge, with falling damage?
- **Fliers:** should fliers ignore melee height reach too, so a dragon can always reach you on a tower? Or should they have to land on a hex like everyone else?
- **Reach weapons** (halberds) from `Todo_ranged.md`'s open questions could reach 2 levels as well as 2 hexes.
- **Should terrain stay symmetric** once the arena has named layouts, or should some layouts favor the challenger on purpose, for example the Red Dragon fighting from a ziggurat?
