# The Battlerings of Dimholt: design notes

A new fan-created game that builds on *Darkwood* (1992), the Macintosh shareware arena game by Robert Chancellor. It started as a copy of this repo's faithful Darkwood remake (`/Darkwood`) and adds its own ideas. Darkwood stays as close to the original as we can make it, and new ideas go here.

## What's new compared to Darkwood

### Stat points from leveling

- **Earning points:** you earn one stat point at every 2nd level (2, 4, 6 … 20), 10 in all.
- **Spending:** points are spent at the **Training Yard** in town. A status-bar link and a tag on the town map show when points are waiting.
- **No obligation:** points can be banked indefinitely.
- **Any stat:** points can go into any of the six stats, including Intelligence, Wisdom, and Charisma, which don't affect the game yet.
- **Staged changes:** you stage changes with + and −, then press **Confirm training**, because a raise can't be undone.
- **Caps:**
  - Training stops at **18**.
  - Tomes from the Magic Shop can raise a stat to **25**, and the Strength, Dexterity, and Constitution bonus tables now extend to 25.
  - There is no exceptional Strength (18/xx).
- **Constitution is retroactive**, as with Tomes: raising it adds hit points to every level from 1 to 9 at once.

**Stat history and level drain.** Stats are never edited in place:

- **What's stored:** each character keeps `baseStats` (the creation roll), `statLog` (each raise, from a level point or a Tome), and `statPoints` (the levels whose point is still unspent).
- **How current stats are built:** `stats` is rebuilt by replaying the log over the base, in `rules/stats.js`.
- **When a Wight drains level L:**
  - If L's point is unspent, the drain removes it.
  - Otherwise the raise made with L's point is marked `revoked`, and stats are rebuilt.
  - Tomes read in between still count.
- **Spending order:** the oldest points are spent first, so a drain takes an unspent point before undoing a choice.
- **Re-earning:** a drained level gives its point back when you reach it again.
- **Visible history:** revoked raises stay in the history list on the Equipment screen, crossed out.

### Poison

Four venomous monsters, adapted from D&D, are slotted into the difficulty order:

| Monster | Placed after | Poisoned attack | Strength | XP | Award |
|---|---|---|---:|---:|---:|
| Giant Centipede | Kobold | bite | 2 | 100 | 22 |
| Giant Spider | Gargoyle | bite | 4 | 450 | 250 |
| Giant Scorpion | Hydra | sting (its claws aren't poisoned) | 5 | 1,000 | 750 |
| Wyvern | Troll | tail sting | 7 | 2,400 | 1,800 |

Rules (`rules/poison.js`):

- **Saving throw.** When a poisoned attack hits, the fighter rolls a saving throw against poison (the paralysis table). A success blocks the poison, but the attack's damage still lands.
- **Strength.** A failed save sets `character.poison` to the attack's strength.
  - At the end of each round the character takes that much damage, then the strength drops by 1. Total damage is S(S+1)/2.
  - Poison can kill; the death screen and log say so (`combat.cause = 'poison'`).
- **Stacking.** A new dose while already poisoned sets the strength to the higher of the two, plus 1.
- **After a fight.** On a win or surrender, the remaining poison is applied at once.
  - It can't take the character below 1 hp. Anything that would is left in `character.poison` and **lingers** into the next fight.
  - The status bar shows "Poisoned N".
  - The Battlerings screen warns, and starting a fight while poisoned asks for confirmation.
- **Cures.** The Potion of Neutralize Poison (150 gp) works in town or in a fight. One night at the inn also cures it.
- **History.** `character.poisonRecord[monsterId] = { poisoned, resisted, damage }` is shown as "Poison history" on the Equipment screen.

Poison lives on the character, not the fight, so it carries between fights. The save format is now version 2, and its migration adds the poison fields to older saves.

### Mercenaries and reinforcements

**Combat engine.** Fights are your side (`you` plus `combat.allies`) against `combat.enemies`. `combat.monsterId` is still the opponent you chose, and its enemy has `main: true`.

- **Turns:** each side acts as a group on its initiative: you, then each mercenary in order, or each enemy in order.
- **Targeting:**
  - You choose a target by clicking an enemy card (`combat.target`), and mercenaries attack your target.
  - Each enemy attack picks a random living fighter on your side.
  - Breath hits everyone on your side, and each fighter saves separately.
- **Events:** every event names who acted (`actor`, `target`, `by: player | ally | enemy`). Events that change hit points carry `hp: { uid, hp }` or a `hits[]` list, so a presenter can update the right bar.
- **Solo fights:** a solo fight against one monster plays exactly as before. The balance table is unchanged.
- **Save format:** version 3, whose migration converts a fight saved mid-round.

**Mercenaries** (`data/mercs.js`):

| Tier | Hit points | AC | THAC0 | Weapon | Attacks | Wage |
|---|---:|---:|---:|---|---:|---:|
| Militia | 8 | 7 | 20 | Club | 1 | 10 gp |
| Sellsword | 20 | 5 | 18 | Long Sword | 1 | 40 gp |
| Veteran | 35 | 3 | 16 | Long Sword +1 | 1 | 150 gp |
| Knight | 55 | 1 | 13 | Bastard Sword +1 | 3/2 | 500 gp |
| Champion | 75 | −1 | 10 | Long Sword +2 | 3/2 | 1,500 gp |

- **Hiring:** the Battlerings screen has a Hire help panel. Wages are paid up front with no refunds, and there's no limit on crew size.
- **One fight only:** the crew disbands after every fight. "Fight another … with the same crew" and "Same crew as last time" re-hire in one click.
- **Afflictions:** mercenaries can be poisoned and paralyzed during the fight. A Wight's drain does an extra 1d8 damage to them instead of taking a level.
- **Persistence:** they keep nothing between fights.
- **Captain ending:** with hired help, Captain of the Guard requires your own killing blow on the Red Dragon.
- **Large crews:** above 3 mercenaries, each run of mercenary attacks is condensed into one log line.

**Reinforcements:**

- **When:** only when mercenaries are hired, decided in `reinforcementsDue()`.
  - Help comes only from the opponent you chose, and only while it's alive.
  - The first time it drops below 50% hp, it summons at once.
  - Otherwise there's a 10% chance per living mercenary each round (at most 50%), announced a round ahead.
- **Cap:** summoned enemies on the field or on the way never exceed the number of mercenaries hired.
- **Who comes:** each monster's `calls` is `kin`, a monster id, or `arena`. The arena master sends the monster 3 places weaker on the list. The Hydra, Earth Elemental and dragons never call.
- **Winning:** every enemy must be defeated. XP from all of them is split evenly among everyone who fought, and the mercenaries' shares are lost. Gold comes only from the chosen opponent.

The "lopsided solo fight" summon rule is tracked in `TODO.md`.

**Balance findings** (from the hiring simulation in `tests/index.html`, fighting two levels below each opponent's solo 50% level):

- **Hiring helps a lot.** One mercenary of the matching tier typically lifts the win rate from about 20% to 55-90%. Two lift it to 75-100%.
- **Dragons can be farmed early.** They never summon, so they're the extreme case. A level 5 fighter with one Champion beats the Black Dragon about 92% of the time. Each win nets 1,500 gold after wages and 3,000 XP.
- **Arena step-down surprises:** the Giant Scorpion's arena helper is a Wight, which can drain levels.

Possible fixes, still to be decided:

- Mercenaries won't fight for an employer far below their own level.
- XP is weighted by level instead of split evenly.
- Higher wages for the top tiers.
- Dragons summon too, for example "the arena sends the dragon's brood".

### Loot, starting with venom

Code: `data/loot.js` (loot items), `rules/loot.js` (clock, decay, applying and selling venom), and venom in `rules/combat.js` (`envenom`, enemy poison ticks, loot rolls on each kill). The Guide's "Loot and venom" section is generated from the same data.

**Drops.**

| Monster | Loot | Starting potency | Drop chance |
|---|---|---:|---:|
| Giant Centipede | Centipede venom sac | 2 | 30% |
| Giant Spider | Spider venom gland | 4 | 30% |
| Giant Scorpion | Scorpion stinger gland | 5 | 35% |
| Wyvern | Wyvern venom bladder | 7 | 40% |

- Summoned helpers can drop loot too. Glands can be sold to the Magic Shop for gold, priced by current potency.
- Drops come from a general `loot` list on each monster, such as `[{ item, chance }]`, so later loot plugs into the same system.

**The clock.** `state.clock` ticks once per **arena visit**, meaning one tick when you leave the Battlerings after fighting, however many fights that was. It also ticks once per **night** at the inn.

**Decay.** Potency is calculated from the clock, never stored tick by tick:

- **Glands in your pack** lose 1 potency every **20 ticks**, so they survive long inn stays. A wyvern gland lasts about 140 ticks and a centipede sac about 40.
- **Coatings on a weapon** lose 1 strength every tick. A coating lasts a whole arena visit but fades fast at the inn, so apply venom right before you fight.

**Coating weapons.**

- **Applying:** "Apply to…" any weapon you own uses up the gland, and the coating starts at the gland's current potency.
- **Stacking:** different venoms stack on one weapon, up to 3. The same venom again refreshes it to the higher strength.
- **Selling** a weapon loses its coatings.

**Poisoning monsters.**

- **On each hit,** every coating gets its own chance to poison. The monster saves against poison as a fighter of level 21 − THAC0, using the same table as yours.
- **A failed save** poisons the monster with the coating's strength. It takes that much damage at the end of each round, then the strength drops by 1.
- **Stacking:** a new dose while already poisoned becomes the higher of the two, plus 1. This is tracked per enemy, for that fight only.
- **Immune:** undead (Ghoul, Wight) and stone or earth creatures (Gargoyle, Earth Elemental).
- **Own venom:** a monster can never be poisoned by its own kind's venom, so a scorpion can't be killed with scorpion poison.
- **Resistance (new, general mechanic):** monsters can list damage types they resist. Resisted damage is halved, rounded up. Dragons resist poison, so each round's poison damage is halved, while the duration stays the same. Fire, lightning and acid resistance can use the same field later.
- **Mercenaries' weapons** are never coated.

**Pack limit:** removed, for magic items and loot alike.

**Save format version 4:**

- Weapons change from ids to `{ id, coatings: [] }`.
- `character.loot` and `state.clock` are added.
- Enemies in a fight gain `poison`.

**Save format version 5** (any weapon can be thrown; see "Ranged attacks"): the beta's Throwing Daggers and Throwing Axes sets become that many single weapons, and a fight's `throwsUsed` becomes `thrown`, `throwPick` and `handBefore`.

### The battlefield and beta features

**Beta features** are listed in `BETA_FEATURES` in `js/config.js`. Each one is the full game (town, shops, Training Yard, saves and guide) running from the same code as the main game, with one experimental feature switched on, and published in its own folder.

- **How a feature switches on:** the folder's `index.html` names its feature (`<html data-beta-feature="hex-battlefield">`) and loads `js/main-beta.js`, which sets `config.betaFeature`. The code asks `betaOn('hex-battlefield')` wherever behavior differs.
- **The drop-down:** the title screen shows a **Beta features** drop-down only when the address has `?beta=true`, and always inside a beta feature. It lists the main game and every beta feature, and **Open** goes there with `?beta=true` kept.
- **Promoting a feature:** when it's ready to graduate, the main game switches it on too; nothing is duplicated.
- **Adding a feature:** add an entry to `BETA_FEATURES`, create its folder with an `index.html` like `hex_battlefield/index.html`, and check `betaOn('<id>')` where the game should differ.

**The hex battlefield** started as the first beta feature and has graduated: **every arena fight in the main game is on it**, with pillars and a terrain layout rolled at random each fight. The beta (`hex_battlefield/`, id `hex-battlefield`, now named **Battlefield tester**) keeps the tester controls, and new battlefield rules (movement stats and monster traits next) land there first.

- **Main game vs. beta:**

  | | Main game | Battlefield tester beta |
  |---|---|---|
  | Arena | `DEFAULT_FIELD`: radius 5, random pillars, random layout each fight | Random too by default; the tester controls can fix a layout, radius or pillars (`settings.battle`) |
  | Tester controls | None: no adding enemies or mercenaries, healing, rebuilding or auto-play | All of them |
  | Mercenaries | Only the crew hired on the Battlerings screen before the fight | The same, plus free ones from the tester controls |
  | Throwing | Yes, including the Throwing Axe for sale | Yes |
  | Guide | "The battlefield" section, with terrain, high ground and throwing | Adds the tester controls |

- **Saves:** each beta feature keeps its own saves (prefix `dimholt-<id>.save.`, for example `dimholt-hex-battlefield.save.`), so it never touches the main game.
  - On first launch it copies the main game's autosave.
  - "Copy my main game into this beta" on its title screen copies again, after asking before it replaces a beta game.
- **Starting fights:** they all go through `ui/fight.js` (`beginFight`), which calls `startBattle` (`rules/battlefield.js`) and opens the battle screen (`ui/screens/battle.js`).
  - **The classic combat screen** (`ui/screens/combat.js`) stays only to finish fights saved before the battlefield reached the main game. `fightScreen` routes a fight with no `combat.grid` there, and its "Fight another" button starts the next fight on the battlefield. No save migration was needed.
- **Same rules:** the battlefield doesn't re-implement combat. `rules/combat.js` still resolves every attack, poison, venom, loot, summon, item and the Captain rule. The battlefield adds positions:
  - `combat.grid = { radius, pillars, height, pos }` holds the arena and everyone's position. `height` is the terrain (see "Terrain" below).
  - With a grid, weapon attacks only reach adjacent fighters (`inReach`), and monsters only strike fighters next to them. On raised terrain, reach and the height modifiers below also apply.
  - Wands, the fiery potion and dragon breath are unchanged.
  - `battlefield.js` moves fighters and runs the turn pieces that `combat.js` exports (`beginRound`, `playerTurn`, `allyTurn`, `enemyTurn`, `endOfRound`).
- **Tester controls** on the battle screen (beta only), for setting up scenarios:
  - Add an enemy (counts as a summoned helper: XP, no gold) or a free mercenary.
  - Heal to full.
  - Rebuild the arena with a new layout (terrain, or "Random each battle"), radius or pillars.
  - Paint height: raise or lower single hexes.
  - Show or hide the enemy threat zone.
  - Auto-play your turn or the whole fight.
- **`js/engine/hex.js`** is the grid math: axial coordinates, distance, boards, reachable hexes and pathfinding. It's unit-tested.
- **Tests:** `tests/index.html` covers the battlefield rules and the random layouts. `tests/smoke.html` plays the main game's fights on the board the way a player would (attack a red hex, or walk to the blue hex nearest an enemy, then end the turn); checks a layout was rolled and named, with no tester or auto-play controls and that a hired mercenary is deployed; and loads a fight saved without a grid onto the classic screen. `tests/beta-smoke.html` opens the drop-down with `?beta=true`, picks the beta, and plays it through its real screens.
- **The old standalone lab** (`lab/`) has been retired. Its board and AI now live in the battle screen and `battlefield.js`.

**Battlefield rules so far (to workshop):**

- **Turn order:**
  1. You move up to 4 hexes and attack one adjacent enemy (or throw one of your weapons at one in range; see "Ranged attacks"), in either order.
  2. Each mercenary moves 4 toward the nearest enemy (preferring the one you last attacked) and attacks if adjacent.
  3. Each enemy moves toward the nearest fighter on your side and makes all its attacks if adjacent.
- **Monster movement** is a first guess from initiative speed: `6 − speed/2`, clamped to 2-8. That gives the Quickling 8, rats and spiders 4-5, and giants 2-3. On raised ground the points are spent per step; see "Movement across levels" below.
- **Melee range is 1 hex.** Fighters block movement, but there's no zone of control, so you can walk past enemies.
- **Visual aids:**
  - Blue hexes show where you can move, with the path previewed on hover.
  - Red marks an enemy you can attack.
  - The amber "threat zone" covers every hex an enemy could reach and strike this round.
  - Hovering any fighter shows hit chances.
- **Reinforcements** enter at the far edge of the arena.

**Questions to workshop:**

- **Initiative:** should it decide move order, per side or per fighter, instead of you always moving first?
- **Zone of control:** should leaving a hex next to an enemy end your movement or provoke a free attack?
- **Reach and ranged attacks:** halberds and dragon breath could have reach 2, and breath could hit a cone or line.
- **Mercenary orders:** "guard me", "attack target", "hold", "hold the high ground".
- **Big monsters** occupying several hexes: giants, dragons, the Hydra.
- **Arena features:** pits, water and mud (levels below the floor, hexes that cost extra movement), fire, and walls of the ring, plus spawn points for reinforcements. Raised ground is built; see "Terrain" below.
- **Height and combat:** should attacking down also add +1 to hit, or is +2 damage enough? Should high ground improve armor class, or is the save bonus the defender's only reward?
- **Magic armor bulk:** should +1 armor count 1 lighter, making expensive armor a movement upgrade too?
- **Knockback:** should a big hit (giants, the Minotaur's charge) push a fighter off a ledge, with falling damage?
- **Fliers and reach:** should fliers ignore melee height reach, so a dragon can always reach you on a tower, or land on a hex like everyone else? Should halberds reach 2 levels as well as 2 hexes?
- **Unfair layouts:** should some layouts favor the opponent on purpose, for example the Red Dragon fighting from a ziggurat? Today every layout is symmetric.
- **Moving vs. attacking:** does moving cost attacks (for example, no 3/2 extra attack after a full move)?
- **Threat display:** show the threat zone inside your movement range too, so you can see which of your moves are dangerous.

**Terrain: rolled at random each fight, and used in movement, melee and throwing**

Multi-level terrain is complete: every fight's arena is **generated** from a randomly rolled layout and **shown on the board**, and **movement, melee and throwing all use it**. Your Strength, Dexterity and armor change how you move; monsters move by their traits and mercenaries by their tier; anyone can jump down a drop at the cost of falling damage. Testers can pick a layout or paint heights by hand. The design notes that drove it (the old `todo_terrain.md`) are folded into this section; the questions still open are under "Questions to workshop" above.

- **Movement across levels** (`rules/battlefield.js`, numbers in `rules/tables.js`): movement is a budget of points per round (`moveOf(state, uid)`: yours from `moveStats`, a mercenary's `MERC_MOVE` or its tier's `move.mp`, a monster's `moveFor`), spent per step:

  | Step into a hex that is… | Cost |
  |---|---|
  | Level with you | 1 |
  | Up *n* levels | 1 + `climbCost` × *n* |
  | Down *n* levels | 1 + `dropCost` × *n* |

  - **Limits:** a step can climb at most `climbMax` levels and drop at most `safeDrop` without harm. The base numbers are `CLIMB_COST` 2, `CLIMB_MAX` 1, `DROP_COST` 1, `SAFE_DROP` 1.
  - **Who gets which numbers** (`moveStatsOf(state, uid)`):
    - **You:** from your stats and armor (below).
    - **Mercenaries:** the base numbers with `MERC_MOVE` (4) points, except tiers with a `move` override in `data/mercs.js`: the Knight and Champion wear plate, 3 points, but climb for +1.
    - **Monsters:** the base numbers, changed by their traits (`move` in `data/monsters.js`, numbers in `MOVE_TRAITS`):

      | Trait | Who | Effect |
      |---|---|---|
      | *(none)* | Everyone else | The base numbers |
      | `climber` | Giant Spider, Giant Centipede | Climb free, any height: they walk up walls |
      | `tall` | Minotaur, Ettin, Hill/Fire/Storm Giant, Earth Elemental, Troll | Climb +1 per level, 2 levels a step; drop 2 safely. Also 2-level melee reach (below) |
      | `flier` | Gargoyle, Wyvern, Black Dragon, Red Dragon | Ignore levels: no climb or drop costs or limits, never fall. Pillars and fighters still block them |
      | `nimble` | Giant Rat, Kobold, Goblin, Quickling | Step down free; drop 2 safely |
  - **Your stats and armor** (`moveStats(c)` in `rules/character.js`, shown on the Character screen as Movement, Climbing and Going down):

    | Score | 3-5 | 6-8 | 9-15 | 16 | 17 | 18 | 19-22 | 23-25 |
    |---|---|---|---|---|---|---|---|---|
    | Dex: movement (`dexMove`) | −1 | 0 | 0 | 0 | +1 | +1 | +2 | +3 |
    | Dex: per level down, safe drop (`dexDrop`) | +2, 1 | +1, 1 | +1, 1 | 0, 2 | 0, 2 | 0, 2 | 0, 3 | 0, 3 |
    | Str: per level up, levels a step (`strClimb`) | +3, 1 | +3, 1 | +2, 1 | +1, 1 | +1, 1 | +1, 2 | +1, 2 | 0, 3 |
    | Str: armor bulk carried free (`strCarry`) | 0 | 0 | 0 | 1 | 1 | 2 | 2 | 3 |

    - **Armor bulk** (`bulk` on each armor; the Armorer and the Guide show it): 0 up to Studded Leather, 1 for Scale and Chain, 2 from Splint Mail up. Magic armor is no lighter.
    - `mp = BASE_MOVE (4) + dexMove − max(0, bulk − strCarry)`, never below `MIN_MOVE` (2). For example: Str 10/Dex 10 in chain has 3; Str 16/Dex 17 in chain has 5 and climbs for +1; Str 18/Dex 10 in plate has 4 and climbs 2 levels a step.
  - **Jumping:** dropping past your safe drop, up to `JUMP_EXTRA` (2) levels farther, at the normal cost, takes falling damage (`takeFall`): `levels`d6 (`FALL_DIE`), less your `conHp` bonus (a penalty adds; monsters and mercenaries have none), halved by a save against paralysis (a monster saves at `monsterSaveLevel`, a mercenary at its level). A fall never takes anyone below 1 hp. Each fall is a `fall` event ("You jump down and land hard: 6 damage, halved as you roll with the fall." / "The Orc jumps down and lands hard: 8 damage.").
    - **You** jump only as the **last step of a move**: `reachableFor` adds those landings as `jump` entries after the search, from hexes reached safely (orange hexes, with the damage range from `fallRange` in the tooltip), so a path the game picks never includes a jump you didn't click. Auto-play never jumps for you.
    - **Monsters and mercenaries** may jump anywhere on their path, but only as far as `aiJumpLevels(hp)` allows: the worst fall (6 per level) must stay within `AI_FALL_SHARE` (a quarter) of their current hp. So a 9-hp orc won't jump a level, a 24-hp one will jump 1, a 48-hp one 2. Fliers never fall.
    - Deeper drops are refused with "too far down to jump", higher climbs with "too high".
  - **The first step is always allowed,** even over budget, and it ends the move. Slow movers (giants with 2 points) are never stuck at the foot of a slope, and after a throw (`SHOT_MOVE`, 1 point) you can still take any one step.
  - **One cost function:** everyone goes through `moveStatsOf` and `stepCostFor(state, uid, ms, jumpLevels)`, which also treats other fighters and pillars as impassable.
  - **Search:** `engine/hex.js` has `cheapestReachable(start, budget, cost)` (a Map of key → `{ cost, prev }`), `pathIn(map, goal)` and `cheapestPath(start, done, cost)`, a small Dijkstra search. `reachableFor` (blue hexes, the threat zone) adds the over-budget first steps. `moveYou` follows the cheapest path. `cb.turn.movedHexes` still counts hexes, for the throwing penalty.
  - **AI** (`advance`, for monsters, mercenaries and your auto-play): it searches the whole board once, finds every hex it could strike each foe from, and heads for the cheapest; **of equally cheap spots it takes the highest**. Then it walks that path as far as its points go, taking falling damage for any jump on the way. So monsters go around a ridge (cost 4) rather than over it (6), and a spider with two equal spots beside you takes the raised one.
  - **No arena can lock up:** pillars once landed on the Ledges band between its two ramps and sealed the sides apart, so no one could reach anyone (5 stalled fights in 2,000 simulated). `deploy` checks `crossable(radius, height, pillars)`, a walk from your starting edge to the enemy's under the base rules without jumps (the weakest mover's rules, so stats and traits only make an arena easier), and rolls the arena again if it fails (up to 20 times; the last try has no pillars). After the fix: 0 stalls in 2,000.
- **Random layouts:** `DEFAULT_FIELD.terrain` is `RANDOM`, so `deploy` calls `pickTerrain()` (`rules/terrain.js`), which rolls through `dice.js` by each layout's `weight`: Flat 3, Hills 3, Ziggurat 2, Ledges 2 (30/30/20/20%). The chosen id is stored as `combat.grid.terrain`, so reloading shows the same arena; the battle screen's round line names it ("Arena: Hills."). A field with no `terrain` (as tests pass) is flat, and saves from before have no `grid.terrain` and simply show no name.
- **Balance** (`tests/index.html`, "Terrain balance", seeded, 200 fights per cell): three level-1 builds with a long sword, played by auto-play against a Kobold, Goblin and Orc on each layout. The test fails if any layout moves a build's win rate more than 20 points from the flat arena, or any build drops below 50%. At the time of writing the largest swing is 13 points: the agile build (Str 10, Dex 17, leather) against an Orc goes from 69% flat to 81% on the Ziggurat and Ledges, since Dex 17 drops 2 levels safely. That's the intended "agile builds have their ground". The strong plate build wins 94-100% everywhere; its edge is armor class, not terrain. Fights on Ledges run about 2 rounds longer, since crossing goes by the ramps.

- **Where it lives:** `js/rules/terrain.js`. It's pure and uses only `engine/hex.js` and `engine/dice.js`, so it's unit-testable and seedable.
- **The model:**
  - Each hex has a whole-number level from 0 (the floor) to `MAX_HEIGHT` (3).
  - The name `MAX_HEIGHT` avoids `MAX_LEVEL` in `rules/tables.js`, which is the character level cap.
  - `combat.grid.height = { "q,r": level }` lists only hexes above the floor. A missing entry, or a missing `height` (older saves), means level 0, so no save migration was needed.
  - Read levels with `levelOf(grid, hex)`, never `grid.height[...]` directly.
- **How a battle gets terrain:**
  - `deploy(state, field)` calls `generateTerrain(radius, field.terrain)` and gets back `{ height, ramps }`.
  - Terrain is generated before the pillars.
  - Pillars are never placed on a ramp or next to one, so raised ground stays reachable.
  - The main game always rolls a layout (`DEFAULT_FIELD`). In the beta, the layout comes from `settings.battle.terrain` (default "Random each battle"), next to `radius` and `pillars`. The tester panel's **Arena layout** picker sets it when you press **Rebuild battlefield**, and later fights use it too.
- **Layouts** (`TERRAINS`):
  - **Flat:** no height map. It uses no random numbers, so flat battles roll exactly as they did before terrain existed.
  - **Hills:** a 50% chance of a hill in the middle, plus a mirrored pair, so one to three hills in all.
    - Each hill peaks at level 2-3 and drops 1 per ring.
    - With `MESA_CHANCE` (25%), the pair are instead **mesas**: a flat top of radius 1 with sheer sides, which are cliffs of 2 or more levels.
  - **Ziggurat:** a stepped pyramid at the center, levels 3/2/1. It has no randomness.
  - **Ledges:** a band across the middle at `LEDGE_LEVEL` (2), with cliffs along both long sides.
    - The band is 3 rows deep on radius 5+ boards, 1 row on smaller ones.
    - One level-1 **ramp** on each side, mirroring each other, is the only way up for a fighter who climbs one level at a time.
- **Guarantees** (all unit-tested):
  - **Symmetry:** every layout is point-symmetric through the center (`q,r → −q,−r`), so neither side gets better ground.
  - **Starting rows:** the two rows at each far edge (`isStartRow`), where fighters deploy, stay at level 0.
  - **Height ceiling:** a hex may be at most `radius − 1 − |r|` high, capped at `MAX_HEIGHT`. The ground slopes down to the starting rows instead of ending in a cliff in front of them. On a radius-3 board this flattens the ziggurat to 2/1.
  - **Bounds:** levels stay within 1-`MAX_HEIGHT` in the map and on the board.
  - **Reachability:** on ledges, both sides can walk up one level at a time, and removing the ramps cuts the band off.
- **On the board** (`ui/screens/battle.js`, styles in `css/game.css`):
  - Raised hexes get a tint over the cell (`.level-shade`, stronger per level) and their level number at the top of the hex (`.level-mark`). The tint uses the ink color: lighter ground in the dark theme, darker in the light theme.
  - Neighbors 2 or more levels apart get a thick **cliff** edge (`.cliff`). `cliffEdges(grid)` in `terrain.js` finds them, each pair once.
  - The overlays ignore the pointer, so clicks and hover still reach the cells.
  - A 2-level edge you're strong enough to climb in one step (Str 18+) is drawn as a thinner dashed line (`.cliff.climbable`) instead of a full cliff.
  - Hover tooltips give a raised hex's level, and a fighter's level. Hovering a hex you can move to shows the move's cost in the tooltip and the hint line ("Level 1. Moving here costs 3 of your 4 movement."), or for an over-budget first step that it's allowed and ends your move. Jump hexes are orange (`.cell.jump`) and add the falling damage range.
  - The legend explains shading, cliffs, climbable edges and jump hexes only when the arena has raised ground.
  - **Paint height** (beta tester controls): Off / Raise / Lower; while on, clicking a hex raises or lowers it a level within 0-`MAX_HEIGHT` (`testerPaint`). Pillars can't be painted. Like the other tester tools it bends the rules: it can make a cliff nobody can cross.
- **Adding a layout:** write a function `radius → { shape(hex) → level, ramps: [hex] }`, register it in `LAYOUTS` and `TERRAINS`, and keep it symmetric. A shape that's mirror-symmetric (for example built from `mirror(center)` pairs combined with `Math.max`) stays symmetric after the ceiling is applied. The symmetry test runs every registered layout, so a lopsided one fails it.
- **Melee and height** (`rules/combat.js`, constants in `rules/tables.js`). Let *h* be the attacker's level minus the defender's.

  | Rule | Effect | Constant |
  |---|---|---|
  | **Reach** | A blow reaches an adjacent fighter at most 1 level up or down. Monsters with `move: ['tall']` reach 2. | `MELEE_HEIGHT_REACH`, `TALL_HEIGHT_REACH` |
  | **Attacking up** (h < 0) | −2 to hit per level | `UPHILL_TO_HIT` |
  | **Attacking down** (h > 0) | +2 damage per level, added before the minimum of 1 | `DOWNHILL_DMG` |
  | **Defending from above** (h < 0) | +2 per level to the defender's saves against that attacker | `HIGH_GROUND_SAVE` |

  - **Interpretation:** "defending down" means the defender stands above its attacker. So high ground helps all three ways, for both sides.
  - **The `tall` monsters:** Minotaur, Ettin, the three giants, Troll and Earth Elemental. Reach isn't symmetric: a giant on a ledge 2 levels up can strike you, but you can't strike back until you're within 1 level.
  - **What the save bonus covers:** a monster's poison (`exposeToPoison` takes a `bonus`) and paralysis, for you and for mercenaries. Also your venom against a monster above you (`envenom`), and breath: each target compares its level with the breather's. Level drain still has no save.
  - **The code:**
    - `heightMods(cb, attackerUid, defenderUid)` returns `{ h, toHit, dmg, save }`. Every melee blow in `playerTurn`, `allyTurn` and `enemyTurn` adds them, and the afflictions take `save`.
    - `inReach` checks the height reach; `meleeReach(cb, uid)` gives it per fighter.
    - **Without a grid every value is 0** and no extra dice are rolled, so the main game and the balance simulator are unchanged.
    - Wands and the fiery potion ignore height.
  - **Movement AI:** `advance` heads for a hex the mover can *strike* from: adjacent and within its height reach. So an orc beside you on a cliff top walks round to a slope, or, if it's sturdy enough, jumps down, instead of standing there. The threat zone uses the same test.
  - **What the player sees:**
    - Melee lines in the log end with ", striking down from above." or ", attacking uphill.". Attack events carry `height` when it isn't 0.
    - Hovering an enemy beside you shows hit chances with height included, who holds the high ground, and only the effects that apply. Out-of-reach directions say "You can't reach it (2 levels up)".
    - Attacking out of reach explains why: "That enemy is too far above or below you to reach."
  - **Tests:** a fixed-roll test shows each modifier flipping a hit to a miss, or a failed save to a pass, at exactly its threshold: reach, uphill, downhill damage, poison, paralysis, venom and breath saves. The AI tests check moving to a strike spot, tall reach, and the threat zone.
- **Ranged range by height** and line of sight in three dimensions are part of throwing (see "Ranged attacks").
- **Terrain tests** (`tests/index.html`):
  - **Layouts:** symmetry for every layout, flat start rows, the ceiling, bounds, ramps, cliff edges, random-layout weights over 1,000 rolls, and 40 main-game deployments (layout recorded, pillars, everyone on the floor).
  - **Movement:** the weighted search (cheapest around an expensive hex, budgets, walls); step costs up and down; cliffs refused with the reason; the first-step rule for you and a slow giant; monsters going around a ridge; the flat-floor full move.
  - **Stats:** the three example gladiators, the minimum of 2, Tome scores, magic armor, Str 18 climbing a 2-level cliff, Dex 17 dropping 2 free, plate slowing a weak fighter.
  - **Jumping:** the jump hex and its cost, nothing beyond the landing, the damage range, fixed-roll falls (failed save, Con 16, never below 1 hp, a save halving), Dex 17 shrinking the jump, too-deep drops refused, auto-play never jumping.
  - **Traits and tiers:** every trait in the data is defined and on the right monsters; each trait's numbers; a spider and a dragon going up a 3-level wall (the dragon still stopped by a pillar) and an orc not; Knight, Champion and Militia numbers.
  - **AI:** the jump limit by hp; a 9-hp orc staying on a column, a 60-hp orc jumping down and taking the fall, a sturdy melee orc jumping down beside you and attacking; a dragon flying down without falling; a spider taking the higher of two equal strike spots, both ways round; the log lines.
  - **Crossability:** the exact sealed Ledges layout is rejected and 300 random arenas are all crossable.
  - **Paint tool:** raising to the cap, lowering back to no entry, pillars refused.
  - **Balance:** the terrain balance bounds above.
- **Playthroughs:** `tests/smoke.html` plays main-game fights on whatever layout is rolled, avoiding hexes where a cliff stops its blows. `tests/beta-smoke.html` rebuilds the arena as a Ziggurat and as Ledges, then on a flat floor paints a hill beside you with **Paint height**, checks the hover preview's cost against your stats, climbs it, and paints a 2-level edge to check it's drawn as a cliff or as climbable for your Strength.

**Ranged attacks: throwing any weapon, javelins, the sling, and bows and crossbows**

The full ranged design (bows, crossbows, giants throwing boulders, archer mercenaries) is in `Todo_ranged.md`. So far **throwing**, the **sling**, and a basic **bow** and **crossbow** with **arrows and bolts** are built, by you only, along with the rules every later ranged attack will share. Weapons in `data/equipment.js` are melee weapons (with `throw`) or true ranged weapons (with `ranged`): the Sling, Bow and Crossbow.

- **Any weapon you carry can be thrown, once per fight each.** Five daggers, two Daggers +1 and two Throwing Axes are nine throws. A thrown weapon stays on the field until the fight ends.
  - **No weapon limit:** the original's 6-weapon cap (`MAX_WEAPONS`) is gone, in the main game too, so you can carry as many spares as you can pay for. The Weaponsmith and the Equipment screen stack identical weapons ("Dagger ×5"; "Sell one"). The weapon in your hand, and any with venom on it, get a row of their own.
  - **How well each one flies** (`throw: { aim, hit }` on each weapon):

    | Profile | Weapons | Base aim | To hit |
    |---|---|---|---|
    | Javelin | Javelin | 4 | 0 |
    | Made to throw | Dagger, Dagger +1, Throwing Axe | 3 | 0 |
    | Handy | Hand Axe | 2 | −1 |
    | Awkward | Short Sword, Mace, Morning Star, Battle Axe, Long Sword (and their magic versions) | 1 | −2 |
    | Clumsy | Bastard Sword, Halberd, Two-Handed Sword (and magic versions) | 1 | −4 |

    Fists (`UNARMED`) have no profile and can't be thrown.
  - **The Throwing Axe** (1d6, speed 4, 8 gold) exists to be thrown. It's sold in the main game too, now that main-game fights are on the battlefield.
  - **The Javelin** (1d6, speed 4, 2 gold) is the longest throw: base aim 4, so a Str 16 gladiator throws it at full power to 5 hexes. Like a dagger it's one throw each, and a melee weapon (a short spear) too. It's sold everywhere. With no choice made, the game throws javelins first.
  - **Which weapon you throw:** the **Throw** picker under the battle buttons sets `combat.throwPick` (`setThrowPick` in `rules/battlefield.js`), a weapon id or null. `pickThrow` in `rules/ranged.js` turns it into one weapon:
    - With a kind chosen, a spare of that kind before the one in your hand. When that kind runs out, it falls back to no choice.
    - With no choice ("Best spare"), the best spare weapon that can hurt the target (its plus meets the monster's `magicReq`): best `aim + hit` first, then the lower plus, then the cheaper one, so plain daggers go before the Dagger +1 unless the target needs magic.
    - The game never throws the weapon in your hand unless you choose its kind. With nothing else left, clicking a distant enemy says so.
  - **Throwing the weapon in your hand** draws another (`drawWeapon` in `rules/combat.js`): one of the same kind you haven't thrown, else the most expensive left, else your fists. `combat.handBefore` remembers what you started with. Log: "You draw your Long Sword." / "You fight on with your fists."
  - **Venom:** a coated weapon carries its coatings when thrown, and poisons what it hits like a melee blow.
  - **Initiative:** a throw rolls with the thrown weapon's speed.
  - **Throws are never lost:** when a fight you survive ends (victory or surrender), you recover every weapon you threw, hits and misses alike, and the weapon you started with goes back in your hand.
    - `recoverThrows` in `rules/combat.js` runs at the start of `afterFight`. It logs "You gather up 3 Daggers and the Throwing Axe you threw, and take your Long Sword back in hand." and clears `combat.thrown`.
  - **Melee:** beside an enemy (in melee reach) you fight with the weapon in your hand, with all the melee rules, including height.
  - **Classic fights** (only fights saved before the battlefield) have no grid, so there's no throwing there.
- **The Sling** (`{ id: 'sling', cost: 1, speed: 6, dmg: '1d4', ranged: { family: 'sling', aim: 3, thing: 'stone' } }`): a true ranged weapon, shot from your hand.
  - **Unlimited stones.** Shooting never uses the sling up or adds to `combat.thrown`, so it shoots every round.
  - **Numbers** (`shootStats(c, w)` in `rules/ranged.js`, the twin of `throwStats`): aim = min(`AIM_CAP`, 3 + magic + `strRange(Str)`); to hit `dexMissile(Dex)` + magic + `ranged.hit`; damage adds Strength's full damage bonus and magic. Everything else is the same range profile as a throw: falloff, height, line of sight, cover, moving first, and `SHOT_MOVE` after the shot.
  - **It can't strike.** With a sling in hand every attack is a shot, even at an enemy beside you (`actYou` never melees with it), and auto-play shoots whenever it has a shot, else closes in. Until weapon switching is built, a slinger who wants to fight in melee equips another weapon in town.
  - **Throwing as well:** pick a kind in the picker (it reads "Shoot or throw: Shoot your Sling · Dagger ×2 …") and you throw that instead, keeping the sling in hand; when that kind runs out you shoot again. `pickShot` in `rules/ranged.js` decides: a chosen kind with spares left, else the sling in hand, else `pickThrow`. A sling can't be thrown (it has no `throw`).
  - **No venom:** stones carry none, and `applyVenom` refuses a sling ("A Sling has no blade to coat.").
  - **Initiative** rolls with the sling's speed. **Magic-only monsters** ignore plain stones.
  - **Classic fights** (no grid): `toHitBonus` aims a ranged weapon with Dex instead of Str, so a sling in an old classic fight still uses the right stat.
  - **Shown:** the Weaponsmith and Equipment screen ("Shoots stones (never runs out): full power to 4 hexes, reaches 8. Can't strike in melee"), dashed red hexes for every enemy in range (beside you too), the hover note ("Shoot your Sling: …"), the hint, and the log ("Your Sling sends a stone into the Kobold (4 hexes) for 4 damage." / "Your Sling's stone whistles past the Kobold (6 hexes).").
- **The Bow and the Crossbow** (`ranged.family` `'bow'` and `'crossbow'`), basic versions that better and magic ones will build on:

  | Weapon | Cost | Speed | Damage | Full power to | To hit | Strength | Shoots |
  |---|---|---|---|---|---|---|---|
  | Bow | 30 | 7 | 1d6 | 5 hexes | Dex missile bonus | adds nothing | arrows |
  | Crossbow | 35 | 7 | 1d8 | 4 hexes | half the Dex missile bonus (rounded toward 0), +1 of its own | adds nothing | bolts |

  - `shootStats` reads the family: a sling takes Strength's range and damage; a bow and crossbow don't. `toHitBonus` and `damageBonus` in `rules/character.js` use `shootStats` for any shooter, so the Character screen matches.
  - Everything else is as for the sling: the range profile, a shot every attack (beside an enemy too), the dashed hexes, no venom and no coating, `SHOT_MOVE` after a shot.
- **Ammunition** (`AMMO` in `data/equipment.js`): arrows (10 for 1 gold, **50%** break on a hit) and bolts (10 for 2 gold, **25%**).
  - **Carried** as `character.ammo` `{ id: count }`, any number. Saves from before it have no `ammo` field; every read defaults it to empty, so the save version is unchanged.
  - **Bought and sold** at the Weaponsmith's Ammunition panel, a bundle at a time (`buyAmmo`, `sellAmmo` in `rules/town.js`; selling pays half). The Character screen lists what you carry.
  - **Which ammunition a weapon takes:** its `ranged.ammo` names a kind, and each `AMMO` entry's `for` says which kind it is, so later magic or flaming arrows are just new entries (`ammoKinds`, best first; `nextAmmo` takes the first you have; `ammoLeft` counts them all, Infinity for a sling).
  - **Each shot uses one** (`rangedTurn` in `rules/combat.js`; `rangeProfile` reports its `ammo`). A hit breaks it with its `breakChance` (a d100); everything else shot, hits and misses, goes into `combat.ammoOut`, broken ones into `combat.ammoBroken`.
  - **Gathered up** when a fight you survive ends (`recoverAmmo`, called from `recoverThrows`): "You gather up 7 arrows (3 broke)." Dying loses them with everything else.
  - **Running out:** "You've shot your last arrow." ends your shots that round. `readyShooter` is then null: the next attack throws a spare weapon if you have one (`pickShot`), and beside an enemy you **fight with your fists**, since a bow can't strike (`playerTurn` uses `UNARMED` for a shooter on the grid). Clicking a distant enemy says "You're out of arrows for your Bow, and have nothing to throw."
  - **Shown:** the picker reads "Shoot or throw: Shoot your Bow, 17 arrows · Dagger ×2", or notes you're out; the Weaponsmith says "Shoots arrows (sold below)"; the log says "Your Bow sends an arrow into the Orc (5 hexes) for 4 damage. The arrow breaks."
- **State:** `combat.thrown` (indices into `character.weapons`), `combat.throwPick`, `combat.handBefore`. Save version 5 turns the old beta sets into single weapons: Throwing Daggers into 3 Daggers (the first keeps any venom), Throwing Axes into 2 Throwing Axes.
- **Where it lives:** `js/rules/ranged.js`, which is pure: no DOM, no dice.
  - `throwStats(c, weapon)` and `shootStats(c, weapon)`: the character's numbers with that weapon, anywhere; `rangedStats` is whichever applies. `shooterInHand` and `canShoot` say whether you have a sling in hand, or anything to shoot or throw.
  - `throwable`, `throwsLeft`, `throwGroups` (for the picker) and `pickThrow`: what you have left to throw.
  - `rangeProfile(state, targetUid, index = pickShot(...))`: those plus the board; the result's `index` is the weapon, and `shoot` says it's the sling in your hand.
  - `lineOfSight` and `rangedDamage`.
  - `rangedTurn` in `rules/combat.js` makes the throws and shots.
- **The range profile:**
  - Up to the **full-power range** (the effective aim) a throw is at full accuracy and damage.
  - Each hex beyond costs 1 to hit and 1/8 of the damage, down to half at the maximum range: aim + `FALLOFF_HEXES` (4).
  - Damage is `max(1, floor((roll + bonuses) × multiplier))`.
  - A natural 20 still always hits and a 1 always misses.
- **Effective aim** = min(`AIM_CAP` 8, base aim + magic + `strRange(Str)`) + height.
  - `strRange`: Str 16-17 +1, 18 +2, then +1 per 2 points (Tomes).
  - Height: +1 per level throwing down, at most `HEIGHT_AIM_MAX` (2), added after the cap; −1 per level throwing up.
- **To hit:** `need = THAC0(level) − AC − toHit`, where `toHit` adds up:
  - `dexMissile(Dex)`: Dex 16 +1, 17 +2, 18 +3, then +1 per 2 points. Dexterity, not Strength, aims a throw.
  - The weapon's magic, and its throwing `hit`.
  - −1 per hex past full power.
  - −`COVER_PENALTY` (2) per fighter on the line.
  - −1 per hex you moved first (halved, rounded up, from Dex `STEADY_DEX` 17).

  Damage adds Strength's melee damage bonus and magic.
- **Line of sight in three dimensions:**
  - The line runs from your eye to the target's body, each half a level above its hex (`H.line`, drawn twice, nudged to either side of an ambiguous hex edge).
  - A pillar on it, or ground higher than it, blocks the throw.
  - Another fighter gives cover only if its body (1 level tall) reaches the line, so from high ground you throw over heads.
  - The throw is allowed if either nudged line is clear; cover counts from the clearer one.
- **Turn rules:**
  - Clicking an enemy strikes it if it's in melee reach, else throws at it if `rangeProfile` allows, else strikes whoever is in reach.
  - An enemy beside you but 2 levels up is out of melee reach, so you throw.
  - A throw is your action. Each of your attacks that round throws one weapon (3/2 at 7th level, 2 at 13th), picked afresh each time.
  - A throw at a target that falls goes to the nearest enemy you can still hit.
  - After a throw you can move only `SHOT_MOVE` (1) hex, so you can't throw and then run (`cb.turn.shot`).
  - Moving first records `cb.turn.movedHexes`.
  - Magic-only monsters ignore plain throws, without using one up.
- **Auto-play** (tester tool): if you're not yet in melee and have a spare weapon, you throw before moving (so you pay no moved-first penalty), then advance 1 hex. Otherwise you advance and strike, or throw if still out of reach.
- **What the player sees:**
  - Enemies you can throw at get a dashed red hex.
  - The Throw picker lists what's left by kind ("Best spare · Dagger ×4 · Throwing Axe ×2 · Long Sword (in hand)"), or says you've thrown everything.
  - The hint mentions throwing.
  - Hovering an enemy shows "Throw your Dagger: 5 hexes, 30% to hit, 88% damage (Dex +2, range −1, cover −2)", or why you can't throw: out of range, line of sight, nothing left, only the weapon in hand.
  - Log lines: "You throw your Dagger at the Orc (5 hexes) and hit for 3 damage, weakened by the distance.", the draw lines, and "You've thrown every weapon you carry…".
  - The Weaponsmith and Equipment screen show each weapon's throw for you ("Thrown: full power to 4 hexes, reaches 8, −2 to hit"), and the Guide explains the rules.
- **Tests:**
  - **Unit checks:** hex lines; the Dex and Str tables; `throwStats` per weapon profile and with magic; counting, grouping and picking throws (including magic for a gargoyle); falloff at aim, aim + 1 and max; height; pillars, hills and cover from above; moving first; and a fixed-roll throw.
  - **Throwing in play:** throwing every spare; choosing the weapon in hand and drawing (another of its kind, the long sword, fists); recovery and putting your weapon back; melee beside an enemy; throwing up a cliff; the gargoyle; venom on a thrown dagger; auto-play; classic fights; the log; the version 4 save migration.
  - **Bows and crossbows:** their numbers by Str and Dex (half Dex for crossbows, rounded toward 0); which ammunition each takes; buying and selling bundles, also on a save without `ammo`; a shot using an arrow; a seeded break and a miss that doesn't break; the last arrow; fists beside an enemy when out; gathering up after a surrender, and the log lines; bolts; falling back to a spare dagger; auto-play; no coating. A Node simulation of 2,000 shots each measured the break rates at 50.1% and 25.0%.
  - **Javelins and the sling:** the javelin's numbers, the picker throwing it first, a 5-hex javelin hit; sling numbers by Str and Dex; a shot at 4 hexes and out of range at 9; six shots in a row with nothing used up; the step after a shot; shooting an enemy beside you; picking a dagger to throw with the sling in hand, then shooting again; a sling with nothing else; no venom and no coating; the gargoyle; auto-play beside and far away; Dex to-hit for classic fights; the log line.
  - **The beta playthrough** buys two Throwing Axes, rebuilds without pillars, walks up, picks axes in the Throw picker and throws one through the real board. Later it buys a Javelin and a Sling, takes the sling in hand, checks the shop, Guide, hint and picker, and shoots a kobold through the real board. Then it buys a Bow and 20 arrows, checks the picker's count, shoots, and checks the arrows that didn't break come back after the fight.

### Player guide

The in-game **Guide** (`js/ui/screens/guide.js`) explains the goal, character creation, what each stat does, leveling, stat points and Tomes, combat math, every monster, special abilities, gear, the inn, saving, and keyboard shortcuts. You can open it from the title screen, the town map, the Battlerings screen, or with the <kbd>G</kbd> key in town.

Every table in it (stat bonuses 3-25, the level table, monsters, weapons, armor, and magic items) is generated from `data/` and `rules/tables.js`, so it updates itself when balance changes. If you change a rule's *behavior*, such as how breath weapons work, update the prose in `guide.js` too.

Balance hasn't been retuned for the extra points yet. The balance simulator in `tests/index.html` still assumes no training.

## 1. Research: the original games

### Darkwood (1992)

- **Author:** Robert Chancellor, La Verne, CA. Shareware, $10 registration.
- **Platform:** 68K Macintosh, System 7 to Mac OS 9. The Macintosh Repository archives versions 1.0, 1.2 (1992), 2.0, and 2.5 (1993).
- **Story:** Darkwood is a city in the northern regions with no walls, kept safe by a powerful City Guard. You are Derek, a stable hand whose father died defending the city from an orc invasion. The city has promised that anyone who bests the most powerful creature the arena can host becomes a Captain of the Guard. No one has done it in 24 seasons.
- **Character:** six stats, 3 to 18, rolled as in D&D: Strength, Intelligence, Wisdom, Dexterity, Constitution, and Charisma. Only Strength (to hit and damage), Dexterity (armor class), and Constitution (hit points per level) matter, and bonuses generally start at 15.
- **Main window:** shows Level, XP, HP (current/max), AC (lower is better), and Gold, next to a clickable map of the city.
- **Buildings:**
  - **Arena:** an opponent dialog lists foes with their XP, award, surrender fine, and the magic weapon bonus needed to hit them.
  - **Weapon shop:** shows cost, speed (lower is faster, and it modifies initiative), and damage range. You can carry up to 6 weapons, and you sell them back for less than you paid.
  - **Armorer:** you wear one suit at a time, and buying a new one trades in the old. An unarmored character is AC 10.
  - **Magic shop:** potions, rings, wands with charges, and tomes.
  - **Inn:** each night heals 1 hp. There's a "Stay Until Healed" button, and you aren't charged if you're already at full hp.
  - **Equipment dialog:** switch weapons and use magic items.
- **Combat:** fought in rounds, and some creatures attack several times a round. Each round goes:
  1. Decide who strikes first. This is random, modified by weapon speed.
  2. The first attacker strikes, then the game checks whether the defender died.
  3. The second attacker strikes, then the same check.

  To-hit is modified by level, Strength, and magic weapon bonus. Damage is the weapon's damage plus Strength and magic bonuses. Your buttons are **Fight**, **Use** (an item, which takes your whole round), and **Surrender** (end the fight and pay a fine of about 10% of the award). Hit points show as green bars.
- **Special abilities:** some creatures drain levels and pay more than others of similar strength. Some are hard to hit but die quickly, and others are easy to hit but have huge hp.

Source: the original *Read Me* that shipped with v1.0, archived on discmaster.textfiles.com.

### Siege of Darkwood (1993)

The sequel adds a turn-based layer. You move around a tile map, scout the approaching enemies, and choose which battle to fight next, healing between fights. You must eventually defeat every squad before time runs out, or the enemy breaks into the castle. A modern PICO-8 remake by petpolitics on itch.io describes the hero as Derek Silverhand defending Darkwood from "Torque's hordes" over 10 waves, with a Temple for healing.

### Sources

- Original Read Me (PDF): https://discmaster.textfiles.com/file/10452/101.ISO/Role%20Play/Darkwood%20%EF%BE%84/Read%20Me.WORD/Read%20Me.pdf
- Darkwood on Macintosh Repository: https://www.macintoshrepository.org/3666-darkwood
- Siege of Darkwood on Macintosh Repository: https://www.macintoshrepository.org/4561-siege-of-darkwood
- PICO-8 remake: https://petpolitics.itch.io/siege-of-darkwood

## 2. Opponents

The names, order, XP, and award money are **exactly the original list** from the Read Me. The original lists names catalog-style ("Rat, Giant", "Giant, Hill"); this remake uses natural word order. The combat stats are this remake's, adapted from AD&D and tuned with the balance simulator (`tests/index.html`). The original's Read Me doesn't publish them.

| # | Opponent | XP | Award | Fine | AC | HP | Attacks | Magic req. | Special |
|---|---|---:|---:|---:|---:|---|---|---|---|
| 1 | Giant Rat | 75 | 10 | 1 | 7 | 1d4 | bite 1-3 | | |
| 2 | Kobold | 90 | 20 | 2 | 7 | 1d4+1 | spear 1-6 | | |
| 3 | Goblin | 110 | 25 | 3 | 6 | 1d8 | short sword 1-6 | | |
| 4 | Orc | 150 | 30 | 3 | 6 | 1d8+1 | axe 1-8 | | |
| 5 | Bugbear | 250 | 40 | 4 | 5 | 3d8+1 | morning star 3-9 | | |
| 6 | Gnoll | 300 | 50 | 5 | 5 | 3d8 | halberd 4-10 | | |
| 7 | Minotaur | 300 | 55 | 6 | 6 | 4d8+4 | horns 1-6, axe 1-8 | | |
| 8 | Ettin | 300 | 70 | 7 | 4 | 5d8 | two clubs 1-8 | | |
| 9 | Gargoyle | 400 | 180 | 18 | 5 | 4d8+4 | 4 attacks | +1 | |
| 10 | Ghoul | 500 | 400 | 40 | 6 | 3d8 | 3 attacks | | Paralyzing touch |
| 11 | Wight | 700 | 500 | 50 | 5 | 4d8+3 | touch 1-4 | +1 | Level drain |
| 12 | Quickling | 900 | 600 | 60 | -3 | 2d8+2 | 3 daggers | | Nearly always strikes first |
| 13 | Hydra | 800 | 700 | 70 | 5 | 48 | 6 heads, 1-6 | | Attacks drop as heads die |
| 14 | Hill Giant | 1,200 | 800 | 80 | 4 | 8d8+2 | club 2-16 | | |
| 15 | Fire Giant | 1,400 | 900 | 90 | 3 | 10d8+3 | sword 5-23 | | Immune to fire |
| 16 | Storm Giant | 1,600 | 1,000 | 100 | 1 | 11d8+4 | sword 6-24 | | Immune to lightning |
| 17 | Earth Elemental | 2,000 | 1,500 | 150 | 2 | 12d8 | fist 4-32 | +2 | |
| 18 | Troll | 1,800 | 1,500 | 150 | 4 | 8d8+8 | 2 claws, bite | | Regenerates 3/round; fire stops it |
| 19 | Black Dragon | 6,000 | 3,000 | 300 | 2 | 10d8 | 2 claws, bite | | Acid breath |
| 20 | Red Dragon | 12,000 | 5,000 | 500 | -1 | 14d8 | 2 claws, bite | | Fire breath; beating it ends the story |

Dragon breath does half the dragon's *current* hp, and half that again on a successful save, so wounding a dragon weakens its breath.

From the balance simulation, a gladiator with Str 16, Dex 15, and Con 15, using gear they could afford by then and only pressing Fight, wins about half the time at these levels: Bugbear 2, Gnoll 3, Ettin 4, Gargoyle 4, Hydra 7, Hill Giant 5, Fire Giant 7, Storm Giant 9, Earth Elemental 8, Troll 8, Black Dragon 7, and Red Dragon 13. Potions and wands bring the dragon within reach a few levels earlier.

### Ideas for more opponents (after v0.1)

Siege mode needs groups, and the arena could use variety. Candidates from the same AD&D bestiary: Skeleton and Zombie (undead squads, maybe needing blunt weapons), Hobgoblin and Orc Captain (squad leaders), Ogre, Owlbear, Wraith, Basilisk (petrify), Manticore (tail spikes at range), Vampire, and Beholder as a secret boss. For the siege, the antagonist "Torque" and his warband would bring Orc squads, Goblin wolf riders, Troll siege beasts, and a Black Dragon mount.

## 3. Code framework

### Goals

- Static files only, so it's hosted on GitHub Pages with **no build step and no backend**.
- Saves stay in the player's browser, with file export for backups.
- Rules are separate from presentation, so v0.1's text-and-buttons UI can later get graphics and animation without touching the rules.

### Layout

```
battlerings_of_dimholt/   (repository root)
├── index.html            Page shell; loads js/main.js as an ES module
├── css/game.css          Theme and layout
├── js/
│   ├── main.js           Boots the app
│   ├── engine/           Infrastructure, no game rules
│   │   ├── dice.js       All randomness: "2d4+1" parsing, seedable RNG
│   │   ├── hex.js        Hex grid math: distance, boards, reachable hexes, paths
│   │   ├── state.js      Shape of the save-game state, SAVE_VERSION
│   │   └── save.js       localStorage slots, file export/import, migrations
│   ├── data/             Pure data tables (edit these to add content)
│   │   ├── monsters.js   Arena opponents
│   │   └── equipment.js  Weapons, armor, magic items
│   ├── rules/            Game logic: pure functions on plain state, no DOM
│   │   ├── tables.js     Stat bonuses, XP table, THAC0, saves, prices
│   │   ├── stats.js      Stat points, Tomes, stat history, drain
│   │   ├── character.js  Creation, derived stats, leveling, level drain
│   │   ├── town.js       Shops, inn, using items in town
│   │   ├── combat.js     Round-by-round combat that returns events
│   │   ├── battlefield.js The battlefield: deployment, movement, turn order
│   │   ├── terrain.js    Battlefield terrain: random layouts, level generation
│   │   └── ranged.js     The battlefield: range, line of sight, throwing
│   └── ui/               Everything that touches the DOM
│       ├── app.js        Router, autosave, click/key dispatch
│       ├── presenter.js  Turns combat events into log lines (and later animations)
│       ├── status.js     Character status bar
│       ├── format.js     HTML helpers
│       └── screens/      One module per screen
└── tests/
    ├── index.html        Rule unit tests and the balance simulator
    ├── smoke.html        Scripted playthrough of the real UI
    └── beta-smoke.html   Scripted playthrough of the battlefield tester beta
```

Design docs for work not built yet sit next to this file: `TODO.md` (decided ideas and open review findings) and `Todo_ranged.md` (ranged attacks on the battlefield; throwing any weapon is built). When part of one is built, document it here and mark it built there. Multi-level terrain had its own design doc, now fully built and folded into "Terrain" above.

### Key decisions

**One plain JSON state object.** The whole game is `{ version, character, day, combat, flags, settings }`. Derived numbers such as max hp, AC, and to-hit are computed from it and never stored, so saves stay small and can't contradict themselves. Max hp is rebuilt from the raw hit-die rolls in `hpRolls`, which makes level drain and a Tome of Constitution work exactly.

**Rules are pure; combat emits events.** `playRound(state, action)` changes state and returns a list of events, such as `{ t: 'attack', who: 'player', hit: true, dmg: 6, monsterHp: 3 }`. The rules never render anything. The UI hands the events to a **presenter**:

- v0.1's `TextPresenter` turns each event into a log line, updates the hp bars, and waits a moment.
- A future `SpritePresenter` implements the same `play(events, view)` and plays a swing, hit flash, or breath animation for each event before logging it. Neither the rules nor the save format change.

**Screens are tiny modules.** Each exports `render(ctx, params)` returning HTML, plus `actions` for its `data-action` buttons and optional `keys` and `mount`. Swapping the town's button grid for a drawn, clickable city map (as in the original) only changes `screens/town.js`.

**Randomness goes through `dice.js`.** Tests call `setRng(seeded(n))` for repeatable runs, and the balance simulator plays thousands of fights in a few seconds.

**Saving with no backend:**

- **Autosave** writes to localStorage after every action, including each combat round, so reloading the page can't undo a bad fight.
- **Three manual slots** let players keep a safe point. Death is permanent for the character, but you can load a slot.
- **Export and import** download and upload a `.dimholt.json` file, for backups and moving between devices.
- Each save is wrapped in an envelope `{ format, version, savedAt, summary, state }`. When the state shape changes, bump `SAVE_VERSION` and add a step to `MIGRATIONS` in `save.js`, so old saves keep loading.
- All storage calls are wrapped in try/catch. If storage is blocked, the game still runs and points the player to file export.

**Why no framework or bundler?** The UI is small, native ES modules work in every current browser, and this repo's convention is no build step. If the UI grows (canvas, sprite sheets, audio), the rules layer can be reused as-is under any renderer: Canvas 2D, PixiJS, or Phaser loaded from a CDN.

### Running locally

ES modules don't load from `file://`, so serve the folder:

```
python -m http.server
```

Run it from the repository root, then open these pages:

- http://localhost:8000/ for the game.
- http://localhost:8000/?beta=true for the game with the beta features drop-down, and http://localhost:8000/hex_battlefield/ for the battlefield tester beta.
- `/tests/` for rule tests and the balance simulations.
- `/tests/smoke.html` for the main-game UI playthrough.
- `/tests/beta-smoke.html` for the beta playthrough.

The playthroughs overwrite autosaves in that browser.

## 4. Roadmap

**v0.1 (this version):**

- Character creation with 3d6 rolls and rerolls
- Town with the weaponsmith, armorer, magic shop, inn, equipment screen, and saves
- All 20 original opponents
- Combat with Fight, Use, and Surrender
- Special abilities: paralysis, level drain, regeneration, hydra heads, breath weapons, immunities, and magic-weapon requirements
- Level-ups, plus extra attacks at levels 7 and 13
- Captain of the Guard ending
- Autosave, three save slots, and file export/import

**v0.2: polish and feel**
- Sound effects, keyboard focus and screen-reader pass, settings screen (theme, combat speed)
- Arena stats: fastest kill, total gold won
- Balance pass from real play; maybe shields and Strength requirements for heavy weapons

**v0.3: graphics**
- Drawn town map with clickable buildings, like the original's main window
- Monster portraits replacing the emoji (`art` field → image path), then a `SpritePresenter` with idle, attack, hit, and death frames
- Damage numbers and hp-bar tweening driven by the existing combat events

**v0.4: Siege of Darkwood mode**
- New `rules/siege.js`: a tile map, squads with positions and a march timer, and a castle hp/breach clock
- Squads are lists of monsters fought one at a time (or as a group, with an `enemies[]` combat extension)
- Scouting a squad before engaging, choosing battle order, healing at a Temple between fights
- A save-format migration that adds `state.siege`, plus a campaign that carries an arena character into the siege
