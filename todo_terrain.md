# Terrain and elevation on the hex battlefield: design

Status: partly built. Terrain generation, a random layout for every fight (in the main game too), the board's level shading and cliff edges, the tester layout picker, the melee height rules (reach, uphill and downhill, high-ground saves, the `tall` reach), ranged range by height with line of sight in three dimensions (built with throwing weapons), **movement costs** (build order step 1: movement points, climb and drop costs and limits, the first-step rule, cheapest-path search, and the check that every arena can be crossed), and **your stats and armor in movement** (step 2: Strength, Dexterity, armor bulk, jumping and falling damage, the Character screen) are already built and documented in `DESIGN.md` ("Terrain"); this file covers the rest. Build it in the beta (`hex_battlefield/`) first. It builds on the ranged-attack design in `Todo_ranged.md`. Move the settled parts into `DESIGN.md` once they're built.

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

Built (`DESIGN.md`, "Movement across levels"): movement points, step costs, `climbMax`/`safeDrop`, the first-step rule, the cheapest-path search, your Strength, Dexterity and armor bulk (`moveStats`), and jumping with falling damage for you. Still to build here: mercenary and monster numbers (traits, below), and jumping for them (with the AI rule under "Monster AI").

### Monster and mercenary traits

Monsters have no stats, so they get **movement traits**. These set the same five numbers. A monster's flat MP is still `moveFor(m)` from `rules/battlefield.js`.

| Trait | Who | Effect |
|---|---|---|
| *(none)* | Most monsters | The base numbers: climb cost 2, climbMax 1, drop cost 1, safeDrop 1 |
| `climber` | Giant Spider, Giant Centipede | Climb cost 0, climbMax 3. They walk up walls. |
| `tall` | Ettin, Minotaur, Hill/Fire/Storm Giant, Troll, Earth Elemental | Climb cost 1, climbMax 2, safeDrop 2. (Their 2-level melee reach is built.) |
| `flier` | Gargoyle, Wyvern, Black Dragon, Red Dragon | Ignores climb and drop costs and limits. Never falls. |
| `nimble` | Quickling, Giant Rat, Kobold, Goblin | Drop cost 0, safeDrop 2. |

Mercenaries use fixed numbers like everything else about them. Militia, Sellsword and Veteran use the base numbers with 4 MP. The Knight and Champion wear plate: 3 MP, but climb cost 1 (they're strong).

## The board

- **Climbable edges:** edges you can climb, given your own `climbMax`, are drawn thinner than cliffs (cliffs are already drawn).
- **Move preview:** hovering a hex shows the path *and its MP cost* ("5 of 5 MP"). (Jump hexes are built: orange, with the fall damage range in their tooltip.)
- **Threat zone:** the amber zone already covers "hexes an enemy can reach and strike from". It already respects melee height reach; it switches to each enemy's MP.
- **Tester paint tool:** a "Paint height" toggle: click a hex to raise it 1, Shift-click to lower it. That's for setting up scenarios, like the other tester controls.

## Monster AI

- **Paths:** `advance` uses the cheapest path, not the shortest.
- **Falls:** monsters don't jump if the fall could do more than a quarter of their current hp.
- **High ground:** when two hexes next to the target are equally cheap, a monster picks the higher one.
- **Archers and throwers** (giants with boulders, Archer mercenaries) prefer hexes higher than their target. That's the same rule, applied when choosing where to shoot from.
- **Mercenaries** follow the same rules. A "hold the high ground" order joins the mercenary-order ideas already listed in `DESIGN.md`.

## Where it goes in the code

- **`data/monsters.js`:** add `'climber'`, `'flier'` and `'nimble'` to the `move` field (it exists, with `'tall'`).
- **`data/mercs.js`:** per-tier MP and climb numbers.
- **`rules/battlefield.js`:** `moveStatsOf` (built: your stats, base numbers for everyone else) reads traits and mercenary tiers; monsters and mercenaries get jumps (`stepCostFor` already takes a `jumps` flag) with the AI rule.
- **`ui/screens/battle.js`:** climbable edges, MP previews and the paint tool. (Falls are built: `fall` events, their log line and orange jump hexes.)
- **Save:** the new fight fields here (fall state) should default safely when missing; otherwise bump `SAVE_VERSION` to 6 (5 was used by throwing).

## Testing

- **`tests/index.html`, unit checks:**
  - **Traits:** climbers, tall, fliers and nimble each change the numbers as listed.
  - **Classic fight:** every movement modifier is 0.
- **Balance simulation:** extend the battlefield simulation from `Todo_ranged.md` to run each build on Flat, Hills and Ziggurat. Watch whether terrain swings win rates by more than about 10 points; if it does, the symmetric layout isn't enough and the constants are too big. Also compare a strong plate-wearer with an agile leather-wearer, to check that both builds have their ground.
- **`tests/beta-smoke.html`:** pick the Ziggurat layout, climb to a higher hex through the real screen, and check the MP preview.

## Build order

1. ~~Cheapest-path search, step costs and movement points~~ (built, base numbers for everyone).
2. ~~Stats: `moveStats`, armor bulk, falls. Character screen display~~ (built; jumping is yours only until step 3).
3. Monster and mercenary traits; AI using the cheapest path and preferring high ground.
4. The paint tool and the balance simulation; tune the constants. (Random layouts per fight already replaced "make Hills the default".)

## Open questions

- **Should attacking down also help to-hit** (+1), or is +2 damage enough? The request only specifies damage, so this design keeps to-hit unchanged.
- **Should high ground also improve armor class,** or is the save bonus the defender's only reward?
- **Should magic armor have less bulk** (+1 armor counts 1 lighter)? That would make expensive armor a movement upgrade too.
- **Pits and water:** levels below the floor, and hexes that cost extra MP (mud, shallow water)?
- **Knockback:** should a big hit (giants, the Minotaur's charge) push a fighter off a ledge, with falling damage?
- **Fliers:** should fliers ignore melee height reach too, so a dragon can always reach you on a tower? Or should they have to land on a hex like everyone else?
- **Reach weapons** (halberds) from `Todo_ranged.md`'s open questions could reach 2 levels as well as 2 hexes.
- **Should terrain stay symmetric** once the arena has named layouts, or should some layouts favor the challenger on purpose, for example the Red Dragon fighting from a ziggurat?
