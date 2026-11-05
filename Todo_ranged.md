# Ranged attacks on the hex battlefield: design

Status: partly built. **Throwing** is built: you can throw any (melee) weapon you carry, one throw per weapon per fight, with each weapon's own `throw: { aim, hit }`. Built with it, the machinery every ranged attack shares:
- the range profile;
- Dexterity's missile bonus and Strength's range bonus;
- range by height and line of sight in three dimensions;
- cover;
- the moved-first penalty and the shoot-then-move limit;
- the board, tooltip, shop and log support.

`DESIGN.md` ("Ranged attacks") documents all of that; this file covers the rest. This is for the hex battlefield beta (`hex_battlefield/`). Move the settled parts into `DESIGN.md` once they're built.

## Goals

- **Distance matters twice:** shots get less accurate and hit softer the farther they fly.
- **One rule for every shooter:** you, mercenaries and monsters all use the same range math.
- **No free kiting:** a fast archer must not be able to shoot a slow giant forever while backing away.
- **Classic fights keep working:** `rules/combat.js` is shared with the main game, so a ranged weapon must still do something sensible when there's no grid.
- **Readable on the board:** before you shoot, you can see your hit chance and damage at that distance.
- **Builds matter:** the weapon and your stats can push accuracy, range and damage *up*, not just down. A strong archer with a composite bow and a nimble crossbowman should play differently.

## Still to build on the shared rules

The range profile, cover, moving first and line of sight are built (see `DESIGN.md`). These modifiers are not:

| Situation | Modifier | Why |
|---|---|---|
| **Engaged:** any enemy is adjacent to the shooter | −4 | Firing a bow with an orc in your face. This makes mercenaries who screen you valuable. Thrown weapons ignore it. |
| **Quick draw (Dex 18+)** | the engaged penalty for bows drops to −2 | It still applies to crossbows: reloading with an orc in your face is slow whatever your Dex. |
| **Point blank:** for bows and crossbows, a target within half your effective aim (rounded up, at least 2 hexes) and you're not engaged | +1 to hit, +1 damage | Closing in is rewarded, but only short of the melee line. |
| **Armor piercing (`pierce`):** crossbows, against AC 3 or better | +2 to hit | Covers the Storm Giant, dragons, the Quickling and plated mercenaries. It gives crossbows a late-game role. |

- **Engaged penalty:** shooting while engaged is allowed; it just costs to-hit.
- **Built-in accuracy (`hit`):** light crossbow +1, heavy crossbow +2. `throwStats` already adds a weapon's throwing `hit`; the bow version should add `ranged.hit` the same way.

## Weapon families still to build

The **thrown** family is built. Each family uses Strength and Dexterity differently, so the choice of weapon follows the character:

| Family | Weapons | Strength | Dexterity | Weapon's own edge |
|---|---|---|---|---|
| **Thrown** (built) | Any melee weapon, through its `throw` profile (daggers and Throwing Axes fly best); still to add: Javelin | Full Str damage bonus and Str range bonus | Missile to-hit bonus | Never engaged; it's your melee weapon too |
| **Sling** | Sling | Full Str damage bonus and Str range bonus | Missile to-hit bonus | Unlimited stones; a true ranged weapon (`ranged`), so not a melee weapon |
| **Self bow** (a plain bow) | Short Bow, Long Bow | Needs a minimum Str (`strMin`); no bonus above it | Missile to-hit bonus | Long reach, cheap |
| **Composite bow** (built to a draw strength, its `pull`) | Composite Short Bow, Composite Long Bow | Str damage and range bonus, **up to the bow's pull** | Missile to-hit bonus | Strong archers get thrown-weapon damage at bow range |
| **Crossbow** | Light, Heavy | None. Damage and range are fixed. | **Half** the missile to-hit bonus (rounded down) | Built-in accuracy, plus armor piercing |

- **Composite bows** add `strBonus(min(str, pull)).dmg` and `strRange(min(str, pull))`. A pull-17 bow gives at most +2 damage even to a Str 18 archer.
- **Too weak for a self bow:** each point of Str below its `strMin` is −1 to hit and −1 aim. A weakling with a long bow can still shoot, just badly. Composite bows have no minimum (a weak archer simply gets no bonus). Crossbows have none (you crank them).
- **Magic `plus`** adds to hit, damage and aim (+1 per plus), as it already does for thrown weapons.

### Putting it together

```
aim     = min(AIM_CAP, w.aim + plus + strRange(min(str, pull)) [thrown/composite]
                                  - strShortfall [self bows])
          + height (built)
toHit   = dexMissile(dex) [halved for crossbows] + plus + w.hit
          + pierce [AC <= 3] + pointBlank - strShortfall
          - over - engaged - moved - cover
need    = thac0(level) - targetAC - toHit
dmgBonus = plus + pointBlank + strBonus(...).dmg [thrown/composite, capped by pull]
```

**Example.** Two level 5 gladiators (THAC0 16) shoot a Gnoll (AC 5) 8 hexes away.

| | Strong archer | Average gladiator |
|---|---|---|
| Stats | Str 18, Dex 17 | Str 10, Dex 10 |
| Weapon | Composite Long Bow (pull 18) | Long Bow (Str min 12) |
| Effective aim | 6 + 2 (Str) = **8** | 6 − 2 (too weak) = **4** |
| Past aim | 0 | 4 (−4 to hit, 50% damage) |
| To hit | +2 (Dex) | −2 (too weak) − 4 (range) |
| Roll needed | 16 − 5 − 2 = **9 (60%)** | 16 − 5 + 6 = **17 (20%)** |
| Damage | 1d6 + 3 = **4-9 (avg 6.5)** | half of 1d6, min 1: **1-3 (avg 1.7)** |

The same average gladiator with a **Heavy Crossbow** (aim 5, no Str needed, +2 accuracy, armor piercing doesn't apply at AC 5): 3 past aim, so −3 + 2 = −1 to hit, needing **12 (45%)**, for 62.5% of 1d10: **1-6 (avg 3.1)**, every other round. That makes the crossbow the right weapon for that character, which is the point.

## Weapons still to add

New entries in `WEAPONS` (`data/equipment.js`) use the existing `ranged` field:

```js
{ id: 'composite-long-bow', name: 'Composite Long Bow', cost: 250, speed: 7, dmg: '1d6', plus: 0,
  ranged: { family: 'composite', aim: 6, pull: 18, thing: 'arrow' } }
{ id: 'heavy-crossbow', name: 'Heavy Crossbow', cost: 50, speed: 10, dmg: '1d10', plus: 0,
  ranged: { family: 'crossbow', aim: 5, hit: 2, pierce: 2, reload: true, thing: 'bolt' } }
```

- **New fields:** `strMin` (self bows), `pull` (composite bows), `pierce` and `reload` (crossbows). All are optional, defaulting to 0 or false.
- **Ammunition:** unlimited for bows, crossbows and slings, as the original game never tracked consumables apart from wand charges. A javelin is a single melee weapon with a good `throw` profile, like a dagger: carry three to throw three.
- **Shots per round:** they follow `attacksThisRound` (3/2 at 7th, 2 at 13th), as throws already do.
- **Melee:** bows and crossbows aren't melee weapons. Beside an enemy you're engaged; a bow user needs weapon switching (below) or a mercenary screen.

| Weapon | Family | Cost | Damage | Base aim | Str | Accuracy | Notes |
|---|---|---|---|---|---|---|---|
| Sling | sling | 1 | 1d4 | 3 | full dmg + range | Dex | Cheap starter; good for a strong novice. Unlimited stones. |
| Javelin | thrown | 2 | 1d6 | 4 | full dmg + range | Dex | One throw each, like a dagger; a 1d6 spear in melee. `throw: { aim: 4, hit: 0 }`, sold only in the beta. |
| Short Bow | self | 30 | 1d6 | 4 | min 9 | Dex | |
| Long Bow | self | 75 | 1d6 | 6 | min 12 | Dex | |
| Composite Short Bow | composite | 100 | 1d6 | 4 | up to pull 17 | Dex | |
| Composite Long Bow | composite | 250 | 1d6 | 6 | up to pull 18 | Dex | The strong archer's bow. |
| Light Crossbow | crossbow | 35 | 1d8 | 4 | none | ½ Dex, +1, pierce +2 | |
| Heavy Crossbow | crossbow | 50 | 1d10 | 5 | none | ½ Dex, +2, pierce +2 | Reloads: it can fire only every other round. |
| Composite Long Bow +1 | composite | 1800 | 1d6 | 6 | up to pull 18 | Dex | Hurts Gargoyles and Wights; +1 aim. |
| Heavy Crossbow +1 | crossbow | 1500 | 1d10 | 5 | none | ½ Dex, +3, pierce +2 | Hurts Gargoyles and Wights; +1 aim. |
| Composite Long Bow +2 | composite | 6000 | 1d6 | 6 | up to pull 18 | Dex | Hurts the Earth Elemental; +2 aim. |

- **Heavy crossbow:** after a shot, `cb.turn.reloading = true` (and the same on a mercenary). It clears at the start of your next turn but one. The UI shows "Reloading". `rangeProfile` gains the reason "Reloading".
- **Classic fights (no grid):** bows and crossbows are used at their aim range, with no range, movement, cover or engaged modifiers. Their stat and weapon bonuses still apply: Dex, `hit`, `pierce`, Str damage, the `strMin` shortfall and magic. Point blank doesn't, since there are no distances. There's no throwing in classic fights.

## Switching weapons mid-fight

A bow user needs to draw a sword when the troll arrives. On the battlefield, **"Ready another weapon" replaces your move** for the round: you can switch and still act, but you can't move. Classic fights stay as they are, with no switching. Throws are already tracked per weapon (`cb.thrown`), and throwing the weapon in your hand already draws another (`drawWeapon` in `rules/combat.js`) and puts the original back after the fight (`cb.handBefore`); switching can reuse both.

## Monsters with ranged attacks

A new optional monster field:

```js
ranged: { name: 'boulder', dmg: '2d8', aim: 3, uses: 2 }
```

- **Who throws:** giants hurl boulders, as in AD&D.
  - Hill Giant 2d8, aim 3.
  - Fire Giant 2d10, aim 3.
  - Storm Giant 2d12, aim 4.
- **How many:** 2 boulders per fight each, tracked on the enemy as `rangedLeft`.
- **What a throw replaces:** a throw replaces all of that monster's attacks for the turn.
- **Rules:**
  - Monsters use the same range profile, height, cover and line of sight.
  - `rangeProfile` today works for you only. It needs a shooter uid, and a source of numbers for monsters and mercenaries in place of `rangedStats`.
  - Boulders are thrown, so no engaged penalty.
- **Scaling:** monsters have no stats, so their `dmg` and `aim` already include it (giants are strong). They get no Dex or point-blank bonus.
- **Monster AI:**
  - It throws when no foe is adjacent, it has boulders left, some foe is in line of sight within max range, and its hit chance is at least 30%.
  - Otherwise it advances and melees as now. It targets the foe with the best hit chance.
- **Classic fights ignore `ranged`;** monsters fight as now.
- **Dragon breath** stays "hits everyone" for now. A cone or line with range is a separate design (see open questions).

## Mercenaries (phase 2)

A new **Archer** tier between Sellsword and Veteran:
- **Stats:** level 3, 16 hp, AC 6, THAC0 18, wage 60.
- **Weapons:** a composite long bow and a dagger as a backup. Like other mercenaries, it has fixed numbers instead of stats: effective aim 7, +1 to hit, +1 damage (`dmgBonus`).

Archer AI:
1. If an enemy is adjacent, step 1 hex away if possible (taking the shoot-then-move rule into account); else stab with the dagger.
2. Otherwise shoot your target if it's in line of sight and range, else the enemy with the best hit chance.
3. If no shot is possible, move to the nearest hex that has one.

## Where it goes in the code

- **`rules/ranged.js`:**
  - A `rangedStats(c, weapon)` beside `throwStats` for the sling, self bow, composite and crossbow families: `strMin`, `pull`, half Dex for crossbows, and `pierce`. `rangeProfile` picks between them by whether the weapon has `ranged`.
  - `rangeProfile` gains a shooter uid (for monsters and mercenaries), the engaged penalty with quick draw, point blank, and `'Reloading'`.
- **`rules/combat.js`:**
  - Bow and crossbow attacks go through the same `rangedTurn` as throws, but shoot the weapon in hand and never use it up.
  - `allyTurn` and `enemyTurn` get ranged branches.
- **`rules/tables.js`:** `ENGAGED_PENALTY = 4`, `PIERCE_AC = 3`.
- **`ui/stat-text.js`:** Dex rows say "Armor class 2 better, +2 with thrown weapons and bows"; Str rows mention range for thrown and composite weapons.
- **Weaponsmith:** a self bow you're too weak for shows a warning tag ("needs Str 12").
- **`ui/presenter.js`:** lines such as "You loose an arrow at the Troll (8 hexes)…" and "The Hill Giant hurls a boulder at you…".
- **`ui/screens/battle.js`:**
  - A faint ring shows the aim range and maximum range around you.
  - Hexes with no line of sight to your target are dimmed.
- **Save:** bump `SAVE_VERSION` to 6 with a migration that sets `rangedLeft` on enemies of in-progress fights (`??=`).

## Testing

- **`tests/index.html`, unit checks:**
  - Engaged penalty for bows and crossbows, not for thrown weapons; quick draw at Dex 18.
  - Scaling, through `rangedStats` (bows) and `throwStats`:
    - Composite bow damage and range capped at pull (Str 18 with pull 17 gives +2 damage, +1 aim).
    - Self bow shortfall: −1 hit and −1 aim per point.
    - Crossbows take half Dex and ignore Str.
    - Pierce only against AC 3 or better.
    - Point blank only within half aim and when not engaged.
    - The worked example's two gladiators get exactly the numbers in the table.
  - Heavy crossbow skips alternate rounds.
  - Giant throws respect `uses` and line of sight.
- **Balance simulation:** a battlefield simulation that pits gladiators against each monster from the normal deployment, with the AI playing your turn. Run four builds at the same level:
  - A melee build: long sword.
  - A thrower: throwing axes.
  - A strong archer: Str 18, Dex 17, composite long bow + long sword.
  - An average crossbowman: Str 10, Dex 10, heavy crossbow + long sword.

  Watch whether ranged builds beat slow giants or trolls far more often than the melee build. If so, tighten shoot-then-move, `AIM_CAP` or `strRange`. Also watch whether the crossbow is a fair choice for low-stat characters rather than a trap.
- **`tests/beta-smoke.html`:** buy a short bow and shoot an enemy at range through the real screen, as the playthrough already does with throwing axes.

## Build order

1. ~~Throwing weapons and the shared range machinery~~ (built).
2. Javelins and the sling.
3. Bows and crossbows: the remaining families, the engaged penalty, point blank, pierce, reload.
4. Weapon switching.
5. Giant boulders, which need `rangeProfile` for monsters.
6. The battlefield balance simulation; tune the numbers.
7. Phase 2: Archer mercenaries.

## Open questions

- **Friendly fire:** should a miss by 1-2 hit a fighter giving cover?
- **Reach 2 for halberds and long spears:** this is the same `rangeProfile` idea with no falloff. It's listed in `DESIGN.md` under "Reach and ranged attacks".
- **Breath as a cone or line** with range, using the same line helper.
- **Height and big monsters:** if giants come to occupy several hexes, do they block line of sight like pillars?
- **Should Dex's missile bonus show in the Training Yard and Character screen** only in the beta, or always?
- **Should level improve shooting beyond THAC0 and extra attacks?** For example, a "marksman" step at 7th level that adds +1 aim, or reduces the falloff to −1 per 2 hexes for the first 2 hexes past aim.
- **Better range-based damage on a natural 20?** For example, maximum weapon damage before the falloff, or only within aim.
- **Should a composite bow's pull be chosen at purchase** (pull 16, 17 or 18 at rising prices), as in AD&D, rather than fixed per bow?
- **Should Str also lengthen a self bow's range** a little (+1 aim at Str 18), or is "minimum only" the cleaner split from composite bows?
