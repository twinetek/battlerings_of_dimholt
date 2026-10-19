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

### The beta: hex battlefield

The **beta** (`beta/`, opened from **Play beta version** on the title screen) is the full game: town, shops, Training Yard, saves and guide. It runs from the same code as the main game with one switch on, `config.beta` (`js/config.js`, set by `js/main-beta.js`). In the beta, arena fights take place on the hex battlefield. When the battlefield is ready to graduate, the main game turns the switch on too; nothing is duplicated.

- **Saves:** the beta keeps its own saves (prefix `dimholt-beta.save.`), so it never touches the main game.
  - On first launch it copies the main game's autosave.
  - "Copy my main game into the beta" on the beta title screen copies again, after asking before it replaces a beta game.
- **Starting fights:** they all go through `ui/fight.js` (`beginFight`).
  - The main game calls `startCombat` and the classic combat screen.
  - The beta calls `startBattle` (`rules/battlefield.js`) and the battle screen (`ui/screens/battle.js`).
- **Same rules:** the battlefield doesn't re-implement combat. `rules/combat.js` still resolves every attack, poison, venom, loot, summon, item and the Captain rule. The battlefield adds positions:
  - `combat.grid = { radius, pillars, pos }` holds everyone's position.
  - With a grid, weapon attacks only reach adjacent fighters (`inReach`), and monsters only strike fighters next to them.
  - Wands, the fiery potion and dragon breath are unchanged.
  - `battlefield.js` moves fighters and runs the turn pieces that `combat.js` exports (`beginRound`, `playerTurn`, `allyTurn`, `enemyTurn`, `endOfRound`).
- **Tester controls** on the battle screen, for setting up scenarios:
  - Add an enemy (counts as a summoned helper: XP, no gold) or a free mercenary.
  - Heal to full.
  - Rebuild the arena with a new radius or pillars.
  - Show or hide the enemy threat zone.
  - Auto-play your turn or the whole fight.
- **`js/engine/hex.js`** is the grid math: axial coordinates, distance, boards, reachable hexes and pathfinding. It's unit-tested.
- **Tests:** `tests/index.html` covers the battlefield rules, and `tests/beta-smoke.html` plays the beta through its real screens.
- **The old standalone lab** (`lab/`) has been retired. Its board and AI now live in the battle screen and `battlefield.js`.

**Battlefield rules so far (to workshop):**

- **Turn order:**
  1. You move up to 4 hexes and attack one adjacent enemy, in either order.
  2. Each mercenary moves 4 toward the nearest enemy (preferring the one you last attacked) and attacks if adjacent.
  3. Each enemy moves toward the nearest fighter on your side and makes all its attacks if adjacent.
- **Monster movement** is a first guess from initiative speed: `6 − speed/2`, clamped to 2-8. That gives the Quickling 8, rats and spiders 4-5, and giants 2-3.
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
- **Mercenary orders:** "guard me", "attack target", "hold".
- **Big monsters** occupying several hexes: giants, dragons, the Hydra.
- **Arena features:** pits, fire, and walls of the ring, plus spawn points for reinforcements.
- **Moving vs. attacking:** does moving cost attacks (for example, no 3/2 extra attack after a full move)?
- **Threat display:** show the threat zone inside your movement range too, so you can see which of your moves are dangerous.

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
│   │   └── combat.js     Round-by-round combat that returns events
│   └── ui/               Everything that touches the DOM
│       ├── app.js        Router, autosave, click/key dispatch
│       ├── presenter.js  Turns combat events into log lines (and later animations)
│       ├── status.js     Character status bar
│       ├── format.js     HTML helpers
│       └── screens/      One module per screen
└── tests/
    ├── index.html        Rule unit tests and the balance simulator
    └── smoke.html        Scripted playthrough of the real UI
```

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
- http://localhost:8000/beta/ for the beta.
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
