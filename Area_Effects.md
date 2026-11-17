# Area effects on the hex battlefield: considerations

Status: **thinking, nothing built.** This collects what an area effect needs on the battlefield: a blast, a cone, a line or a lingering cloud. It also lists the decisions to make before building one. Once a part is designed and built, move it into `DESIGN.md` as usual.

Today every attack and item hits one target. Two things fake an area:
- **Dragon breath** "hits everyone": you and every mercenary, wherever they stand (`breathe` in `rules/combat.js`). Each victim saves against breath for half, with the high-ground save bonus.
- **Exploding ammunition** hurts only its target, and a miss is a dud (`Todo_ranged.md`, "Blast radius").

## What would use it

| Source | Exists today as | Shape it wants | Notes |
|---|---|---|---|
| Exploding arrows, bolts, stones | +2d6 to the target only | **Burst**, radius 1 | The first user. Decide what a miss does (below). |
| Wand of Fire ("A fireball bursts over…") | 4d6 to your target | **Burst**, radius 1 or 2, or a **cone** | AD&D's wand of fire does both. |
| Wand of Lightning ("Lightning bolt") | 6d6 to your target | **Line**, maybe one that bounces off pillars | The Storm Giant is immune to lightning. |
| Potion of Fiery Breath | 4d6 to your target | **Cone** from you | It's breath, so a cone fits. |
| Red Dragon's fire breath | Everyone, half its hp | **Cone** | The classic shape. |
| Black Dragon's acid breath | Everyone, half its hp | **Line** | AD&D black dragons breathe a line of acid. |
| Acid fog, a spell or a thrown flask (new) | none | **Cloud**: lingers and fades | Your example. Pools in low ground (see Terrain). |
| Smoke, grease, caltrops, burning oil (ideas) | none | **Cloud** or **field** | Smoke blocks sight; grease or caltrops cost movement; oil burns. |
| Blunderbuss or shotgun (later) | none | **Cone** with damage that falls off | Do firearms fit the setting? Decide before designing. |
| Monsters' gas or spores (ideas) | none | **Burst** or **cloud** | Ghouls, spiders and the Hydra could get new tricks. |

There's no spellcasting yet. A "fireball spell" would come through an item (a wand or scroll) or a monster ability, until a spell system is designed.

## Shapes

All shapes are sets of hexes, so a single rule can apply any of them. They need helpers in `engine/hex.js`; today it has `hexagon`, `line`, `neighbors`, `distance` and the path searches.

- **Burst:** every hex within *r* of a center: `hexagon(r, center)` already does this.
  - Radius 1 is 7 hexes, radius 2 is 19.
  - It needs a **ring** helper too, for damage that falls off by distance from the center.
- **Line:** from the source, through the target, out to a length. `H.line` draws one between two hexes; it needs extending past the target.
  - Decide whether a line stops at the first pillar, at the first fighter, or runs through fighters (lightning).
- **Cone:** a 60° wedge from the source toward the target, out to a length. On a hex grid, each step out the wedge grows by one hex (1, 2, 3…).
  - Hex cones are awkward between two of the six directions. Decide whether cones point only along a hex direction (simple, readable) or in any direction, taking hexes whose direction lies within ±30° (smoother, harder to show and test).
- **Cloud:** a burst that **stays**. Each hex holds an **intensity** that changes every round (see "Lingering areas").
- **Later:** a ring (fire around a point), a wall, or a field covering the whole arena.

## Aiming and where it lands

- **At a fighter or at a hex?** Today you click an enemy. A burst is often better aimed at an empty hex between two enemies. That needs an **aiming mode**: pick the attack, hover hexes to preview the area, then click to fire.
- **Range** comes from `rangeProfile` as for any shot: falloff, height, line of sight, moving first. Cones and lines start at you, so only their length matters.
- **Misses:**
  - Exploding ammunition is a dud on a miss for now, by your decision.
  - With a burst, a miss could instead **scatter**: land 1 hex off in a random direction (2 hexes on a bad miss) and blast there. That's dangerous next to your own mercenaries, which is interesting.
  - Aiming at a hex could hit automatically (like a grenade), with scatter only on a natural 1.
- **Where it can reach:** use line of sight from the area's center (a burst) or source (a cone or line) to each hex, reusing `lineOfSight`'s height rules:
  - Pillars and higher ground shelter whatever is behind them.
  - Fighters don't block a fireball, but they might block a blunderbuss.
  - Bursts in three dimensions need a decision: does a blast at level 0 reach someone on a level-3 ledge next to it? Suggestion: a burst reaches up or down 1 level per hex of radius, and line of effect decides the rest.

## Who it affects

- **Everyone in the area:** enemies, mercenaries and **you**. Friendly fire is what makes an area effect a choice rather than a free win. Decide whether the AI's mercenaries try to stay out of your areas.
- **Saving throws:** each victim saves for half.
  - You and mercenaries use the breath table (`saveTarget('breath', level)`), as breath does today. Monsters use `monsterSaveLevel`.
  - Keep the high-ground save bonus (`heightMods(...).save`)?
  - Should a save be against breath for everything, or should spells have a "spell" save?
- **Damage:**
  - **Rolled once per effect** (AD&D) or **once per victim**? Once reads better in the log ("The fireball does 14 damage") and makes saves matter more.
  - **Falloff:** full at the center and half on the outer ring, or the same everywhere? A cone that's strong close and weak far suits a blunderbuss.
  - **Damage types:** `fire`, `acid`, `lightning` and `blast`, through the existing `resisted()` and `immune` lists.
    - Fire still stops a troll regenerating.
    - Is "blast" a type of its own that nothing resists, or is an explosion fire?
- **Crowds:** summoned helpers, mercenary crews and the arena's step-down helper all make crowds, so areas get stronger exactly when fights get bigger. Watch this in the balance simulation (`Todo_ranged.md`, step 6).

## Lingering areas: clouds, fog, fields

Your acid fog: an area that stays for a few rounds and fades.

- **State:** `combat.areas`, a list like:
  ```js
  { id, kind: 'acid-fog', source: 'you', hexes: { key: intensity }, dtype: 'acid', dmg: '2d6', roundsLeft }
  ```
  - It's a plain JSON field that defaults to `[]`, so old saves need no migration.
  - A fight's areas end with the fight.
- **When it hurts:**
  - At the **end of each round**, for everyone inside: `endOfRound` already handles regeneration and poison there.
  - **Entering** a hex mid-move? That's harsher, and it makes walking through a cloud a real decision.
  - Decide whether standing still and walking through hurt the same.
- **How it fades**, and these can combine:
  - **Weakens:** the damage die steps down each round (2d6, 1d6, 1d4, gone).
  - **Shrinks:** the edge hexes clear first.
  - **Drifts:** it moves 1 hex in a direction rolled when it's created, as if blown by wind.
- **With terrain:**
  - Heavy gases **sink**: acid fog spills down levels and pools in low ground. On a ziggurat, it would flood the bottom.
  - Smoke **rises**, or simply blocks sight.
  - The design already plans pits and water ("Questions to workshop" in `DESIGN.md`); a cloud could fill a pit.
- **Sight and movement:**
  - Smoke blocks line of sight (`lineOfSight` would read `combat.areas`).
  - Acid fog doesn't block sight, but costs movement or simply hurts.
  - Grease and caltrops cost movement (`moveCostFor`).
- **Overlaps:** two clouds of the same kind in one hex don't add up; the stronger counts. Different kinds both apply.
- **AI:**
  - Monsters should avoid hexes that hurt them, unless they're immune. This is an extra cost in `advance`'s path search, as cliffs already are.
  - Mercenaries do the same, and auto-play steers you clear too.

## Cone weapons (later)

- **Fire wand as a cone:** at short range it's a better crowd tool than the burst, but it starts at you, so you must be close.
- **Blunderbuss or shotgun:** a weapon (`ranged.family: 'scatter'`?) whose shot is a cone.
  - Either it rolls to hit each fighter in the cone (a firearm feels like an attack, not a save), or each target saves.
  - Damage falls off by distance: brutal close up, weak far away.
  - It probably reloads like the Heavy Crossbow.
  - Fighters in front shield those behind them (cover).
  - Whether firearms belong in Dimholt at all is the first question.

## The player's view

- **Preview before firing:** hovering a target or hex shows the area (tinted hexes), who's in it (marking your own side in red), and expected damage. This works like the move preview and the throw tooltip. Firing into your own mercenaries could ask for confirmation.
- **Animation:** a new event, for example:
  ```js
  { t: 'area', shape, hexes, source, dtype, hits: [{ uid, dmg, saved }] }
  ```
  `breathe` already emits `hits[]`. The presenter flashes the hexes (a new `view.flash(hexes)` hook, beside `move`) and logs one summary line plus a line per victim. With a big crowd it condenses, as mercenary attacks do (`SUMMARIZE_ABOVE`).
- **Lingering areas on the board:**
  - Shaded overlays whose strength shows the intensity, with a legend entry and a hover note ("Acid fog: 1d6 at the end of the round, 2 more rounds").
  - The threat zone could include them.
- **Log:** "The fireball engulfs the Orc, the Goblin and Rennick: 14 damage (Rennick dives aside: 7)."

## Classic fights (no grid)

Old saved fights still run without a board. Areas could fall back to:
- "hits the target" for bursts;
- "hits everyone on the other side" for cones and lines, as breath does today;
- clouds simply not existing.

Alternatively, items with area effects could refuse to work there.

## Where it would go in the code

- **`engine/hex.js`:** `ring`, a line extended past its target, a cone, and perhaps rotating a direction.
- **`rules/areas.js`, new and pure:**
  - `areaHexes(shape, source, target, size)`;
  - line of effect (from `lineOfSight`, without cover);
  - `applyArea(state, area, ev)` for damage, saves, types and the `hits[]` event;
  - lingering-area upkeep: hurt, fade, drift, sink.
- **`rules/ranged.js` / `rules/combat.js`:** exploding ammunition calls `applyArea` instead of adding blast damage. Wands and breath move to shapes. `endOfRound` runs lingering areas.
- **`rules/battlefield.js`:** AI avoidance in `advance`; aiming at a hex in `actYou`; the cost of moving through clouds in `moveCostFor`.
- **Data:** an `area` field on whatever makes one, for example:
  ```js
  area: { shape: 'burst', size: 1, dmg: '2d6', dtype: 'fire', save: 'half', falloff: 'outer-half', linger: null }
  ```
  - On `ENCHANTS.exploding`, on wands in `ITEMS`, and on `breath` in `MONSTERS`.
  - Lingering ones add `linger: { rounds: 3, fade: 'step-down', drift: true, sink: true }`.
- **UI:** an aiming mode, a preview, overlays and the presenter's `flash` hook in `ui/screens/battle.js` and `ui/presenter.js`. The Guide explains the shapes, and the shop text names each item's area.
- **Tests:**
  - **Shapes:** sizes, cones in each direction, lines stopping at pillars, height.
  - **Damage and saves:** friendly fire; saves and immunities; damage rolled once.
  - **Lingering clouds:** fading, drifting, sinking down levels, the AI walking around them.
  - **Playthrough:** a burst through the real screen.

## Decisions to make

1. **Damage:** rolled once per effect or per victim? Falloff by ring, or the same everywhere?
2. **Friendly fire** for everything, including your own fireballs? Should the game ask before you hit your mercenaries?
3. **Exploding misses:** keep the dud, or scatter and blast where it lands?
4. **Aiming at hexes:** worth an aiming mode now, or only bursts centered on a target for the first pass?
5. **Height:** how far up and down a burst reaches, and whether clouds sink.
6. **Lingering areas:**
   - When do they hurt: the end of the round, on entering, or both?
   - Which fading model: weaken, shrink, drift?
7. **Breath:** move dragons to a cone (red) and line (black) now, or keep "hits everyone"? A shape makes dragons beatable by positioning, which is a big balance change.
8. **Wands:** does the Wand of Fire become a burst or a cone? The Wand of Lightning a line?
9. **Cones:** hex directions only, or any angle?
10. **Firearms** in the setting at all?

## Suggested build order

1. **Shape helpers and `rules/areas.js`,** with tests, before any content uses them.
2. **Exploding ammunition** as a radius-1 burst on the target. This is the smallest real use, and it settles friendly fire, saves and the `hits[]` event and its presentation.
3. **Area preview** on the board, before more areas arrive.
4. **Wands:** fire as a burst (or cone), lightning as a line.
5. **Dragon breath** as a cone and a line. It needs a balance pass.
6. **Lingering clouds:** acid fog, with fading, then drifting and sinking with terrain. Then smoke blocking sight.
7. **Aiming at hexes,** and scatter for misses.
8. **Cone weapons,** if firearms are wanted.
