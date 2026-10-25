# Ranged attacks on the hex battlefield: design

Status: designed, not built. This is for the hex battlefield beta (`hex_battlefield/`). Move the settled parts into `DESIGN.md` once they're built.

## Goals

- **Distance matters twice:** shots get less accurate and hit softer the farther they fly.
- **One rule for every shooter:** you, mercenaries and monsters all use the same range math.
- **No free kiting:** a fast archer must not be able to shoot a slow giant forever while backing away.
- **Classic fights keep working:** `rules/combat.js` is shared with the main game, so a ranged weapon must still do something sensible when there's no grid.
- **Readable on the board:** before you shoot, you can see your hit chance and damage at that distance.
- **Builds matter:** the weapon and your stats can push accuracy, range and damage *up*, not just down. A strong archer with a composite bow and a nimble crossbowman should play differently.

## Core rule: the range profile

Every ranged weapon (and monster ranged attack) has an **aim range**, measured in hexes:

- **Up to the aim range:** full accuracy, full damage.
- **Beyond it:** each extra hex costs **−1 to hit** and **12.5% of the damage**.
- **Maximum range:** aim + `FALLOFF_HEXES` (4). At maximum range a shot is −4 to hit and does half damage. Beyond that you can't shoot.

The aim range used here is the shooter's **effective aim**: the weapon's base aim adjusted by Strength, magic and any Strength shortfall. That's how stats and weapons extend or shorten range (see "Weapon and character scaling").

```
over     = max(0, distance - aim)          // aim = effective aim
toHitMod = -over                           // -1 per hex
dmgMult  = 1 - 0.5 * over / FALLOFF_HEXES  // 100% at aim, 50% at max
damage   = max(1, floor((roll(dmg) + dmgBonus) * dmgMult))
```

`dmgBonus` and the to-hit bonuses also come from scaling. Bonuses are added before the falloff, so a strong archer still loses half at maximum range, but half of a bigger number.

Why a flat zone and then a falloff, rather than a penalty from the first hex? On a radius-5 board, two fighters are at most 10 hexes apart. A flat zone makes "step into your aim range" a clear, readable goal, and the falloff makes long shots a real gamble without forbidding them. One shared falloff width (4 hexes) means players learn one rule; weapons differ by aim range, accuracy bonus and damage.

Long bow example (aim 6):

| Distance | To hit | Damage | 1d6 average |
|---|---|---|---|
| 2-6 | +0 | 100% | 3.5 |
| 7 | −1 | 88% | 3.0 |
| 8 | −2 | 75% | 2.5 |
| 9 | −3 | 63% | 2.0 |
| 10 | −4 | 50% | 1.5 (min 1) |

## Other modifiers

These apply on top of the range profile. All of them are to-hit changes and they stack.

| Situation | Modifier | Why |
|---|---|---|
| **Engaged:** any enemy is adjacent to the shooter | −4 | Firing a bow with an orc in your face. This makes mercenaries who screen you valuable. Thrown weapons ignore it. |
| **Moved first:** you moved this turn before shooting | −1 per hex moved (max −4) | Standing still is steadier. |
| **Cover:** each fighter (either side) on the line of fire, between shooter and target | −2 each | Shooting past your own crew is harder. There's no friendly fire in version 1. |
| **Weapon, stats, magic** | see "Weapon and character scaling" | Bonuses that make good shooters better. |

**Natural 1 and 20** keep working as they do in melee: a 20 always hits, even at maximum range with cover, and a 1 always misses. Only the damage falloff still applies to a natural 20.

## Weapon and character scaling

Three things can raise a shot's accuracy, range and damage: **the weapon's design**, **Strength** and **Dexterity**. Magic adds to all three. Each weapon family uses them differently, so the choice of weapon follows the character.

### How each weapon family scales

| Family | Weapons | Strength | Dexterity | Weapon's own edge |
|---|---|---|---|---|
| **Thrown** | Javelins, Sling | Full Str damage bonus and Str range bonus | Missile to-hit bonus | Never engaged; javelins work in melee |
| **Self bow** (a plain bow) | Short Bow, Long Bow | Needs a minimum Str (`strMin`); no bonus above it | Missile to-hit bonus | Long reach, cheap |
| **Composite bow** (built to a draw strength, its `pull`) | Composite Short Bow, Composite Long Bow | Str damage and range bonus, **up to the bow's pull** | Missile to-hit bonus | Strong archers get thrown-weapon damage at bow range |
| **Crossbow** | Light, Heavy | None. Damage and range are fixed. | **Half** the missile to-hit bonus (rounded down) | Built-in accuracy, plus **armor piercing** |

### Strength

- **Damage:** thrown weapons add the full `strBonus(str).dmg` (the melee damage table). Composite bows add `strBonus(min(str, pull)).dmg`, so a pull-17 bow gives at most +2 even to a Str 18 archer. Self bows and crossbows add nothing.
- **Range:** a new table, `strRange(str)`, for thrown weapons and composite bows (capped by pull):

  | Str | 3-15 | 16-17 | 18 | 19-20 | 21-22 | 23-24 | 25 |
  |---|---|---|---|---|---|---|---|
  | Aim bonus | +0 | +1 | +2 | +3 | +4 | +5 | +6 |

- **Too weak for the bow:** each point of Str below a self bow's `strMin` is −1 to hit and −1 aim. A weakling with a long bow can still shoot, just badly. Composite bows have no minimum (a weak archer simply gets no bonus). Crossbows have none (you crank them).

### Dexterity

- **Missile to-hit bonus,** `dexMissile(dex)`: a new table following AD&D.

  | Dex | 3 | 4-5 | 6-15 | 16 | 17 | 18 | 19-20 | 21-22 | 23-24 | 25 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | To hit | −3 | −2 | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 |

  Above 18 it's `3 + ceil((dex − 18) / 2)`, the same shape as the Strength to-hit formula. Crossbows get half.
- **Steady hands (Dex 17+):** the moved-first penalty is halved (−1 per 2 hexes moved, rounded up).
- **Quick draw (Dex 18+):** the engaged penalty for bows drops from −4 to −2. It still applies to crossbows: reloading with an orc in your face is slow whatever your Dex.

So Dex finally matters outside armor class, mostly for bows. Crossbows are deliberately the weapon that works for a character with average stats.

### The weapon's own accuracy and damage

- **Magic `plus`:** +1 to hit and +1 damage per plus, as in melee, and **+1 aim per plus** (enchanted arrows fly true). It still counts for `magicReq`.
- **Built-in accuracy (`hit`):** light crossbow +1, heavy crossbow +2.
- **Armor piercing (`pierce`):** crossbows get an extra +2 to hit against AC 3 or better. That covers the Storm Giant, dragons, the Quickling and plated mercenaries. It gives crossbows a late-game role.
- **Point blank:** for bows and crossbows, a target within half your effective aim (rounded up, at least 2 hexes, and you're not engaged) gives **+1 to hit and +1 damage**. Closing in is rewarded, but only short of the melee line.

### Aim cap

The effective aim is capped at `AIM_CAP = 8`, so the falloff still matters at the far side of a radius-5 board (10 hexes across). Max range is still effective aim + 4.

### Putting it together

```
aim     = min(AIM_CAP, w.aim + plus + strRange(min(str, pull)) [thrown/composite]
                                  - strShortfall [self bows])
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

## Line of sight

- **The line:** draw the hex line from shooter to target (the cube-coordinate lerp and round at redblobgames.com/grids/hexagons, the same source as `engine/hex.js`).
- **What blocks it:** pillars block the line completely.
- **What doesn't:** fighters give cover (−2 each) but never block.
- **Lines along a hex edge:** compute the line twice, nudged by +ε and −ε. The shot is allowed if either line is clear (generous to the shooter). Cover counts from the clearer of the two lines.
- **New helpers in `engine/hex.js`:** `line(a, b)` and `lineOfSight(a, b, blocks)`. Both are pure and testable, with no game knowledge.

## Moving and shooting (anti-kiting)

The battlefield currently allows "move up to 4 and act once, in either order". For a **ranged action**:

- **Move, then shoot:** allowed, at −1 to hit per hex moved.
- **Shoot, then move:** you can still move, but **at most 1 hex**.

So retreating 4 hexes and shooting costs −4, and shooting then retreating covers only 1 hex. Slow monsters can close the gap, and the radius-5 board limits circling. Giants also get thrown boulders (see below), which punish standing at range against them.

Melee is unchanged.

## Weapons

These are new entries in `WEAPONS` (`data/equipment.js`), with new fields:

```js
{ id: 'composite-long-bow', name: 'Composite Long Bow', cost: 250, speed: 7, dmg: '1d6', plus: 0,
  ranged: { family: 'composite', aim: 6, pull: 18 } }
{ id: 'heavy-crossbow', name: 'Heavy Crossbow', cost: 50, speed: 10, dmg: '1d10', plus: 0,
  ranged: { family: 'crossbow', aim: 5, hit: 2, pierce: 2, reload: true } }
```

- `family`: `'thrown' | 'self' | 'composite' | 'crossbow'`. It decides the scaling (see the table above) and the engaged penalty. Thrown weapons are never engaged.
- `strMin` (self bows), `pull` (composite bows), `hit` and `pierce` (crossbows), `reload` and `throws` are optional, and default to 0 or false.
- **Unlimited ammunition** for bows, crossbows and slings, as the original game never tracked consumables apart from wand charges.
- **Shots per round** follow the fighter's normal `attacksThisRound` (3/2 at 7th, 2 at 13th). A bow doesn't add extra shots on top.

Base aim is before scaling; your own aim shows in the shop and on the board.

| Weapon | Family | Cost | Damage | Base aim | Str | Accuracy | Notes |
|---|---|---|---|---|---|---|---|
| Sling | thrown | 1 | 1d4 | 3 | full dmg + range | Dex | Cheap starter; good for a strong novice. |
| Javelins (3) | thrown | 6 | 1d6 | 2 | full dmg + range | Dex | 3 throws per fight, refilled after; then a 1d6 spear in melee. |
| Short Bow | self | 30 | 1d6 | 4 | min 9 | Dex | |
| Long Bow | self | 75 | 1d6 | 6 | min 12 | Dex | |
| Composite Short Bow | composite | 100 | 1d6 | 4 | up to pull 17 | Dex | |
| Composite Long Bow | composite | 250 | 1d6 | 6 | up to pull 18 | Dex | The strong archer's bow. |
| Light Crossbow | crossbow | 35 | 1d8 | 4 | none | ½ Dex, +1, pierce +2 | |
| Heavy Crossbow | crossbow | 50 | 1d10 | 5 | none | ½ Dex, +2, pierce +2 | Reloads: it can fire only every other round. |
| Composite Long Bow +1 | composite | 1800 | 1d6 | 6 | up to pull 18 | Dex | Hurts Gargoyles and Wights; +1 aim. |
| Heavy Crossbow +1 | crossbow | 1500 | 1d10 | 5 | none | ½ Dex, +3, pierce +2 | Hurts Gargoyles and Wights; +1 aim. |
| Composite Long Bow +2 | composite | 6000 | 1d6 | 6 | up to pull 18 | Dex | Hurts the Earth Elemental; +2 aim. |

- **Magic bows:** `plus` counts for `magicReq` exactly as for melee, so +1 and +2 bows let a ranged build hurt magic-only monsters.
- **Venom:** coatings work unchanged on any weapon entry (`envenom` reads the weapon in hand), so poisoned arrows come for free. That's intended.
- **Heavy crossbow:** after a shot, `cb.turn.reloading = true` (and the same on a mercenary). It clears at the start of your next turn but one. The UI shows "Reloading".
- **Javelins:** throws left live on the fight (`cb.throws`), not the weapon entry, so nothing needs a save migration and a new fight always starts full.

**Classic fights (no grid):** a ranged weapon is used at its aim range: no range, movement, cover or engaged modifiers. Its stat and weapon bonuses still apply: Dex, `hit`, `pierce`, Str damage, the `strMin` shortfall and magic. Point blank doesn't, since there are no distances. So it's simply a weapon whose numbers come from the same scaling. To avoid confusing the main game, the Weaponsmith lists ranged weapons only when `betaOn('hex-battlefield')`. Saves copied between main and beta still load either way.

## Switching weapons mid-fight

A bow user needs to draw a sword when the troll arrives. On the battlefield, **"Ready another weapon" replaces your move** for the round: you can switch and still act, but you can't move. Classic fights stay as they are, with no switching.

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
- **Rules:** monsters use the same range profile, cover and line of sight. Boulders are thrown, so no engaged penalty.
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

- **`engine/hex.js`:** `line`, `lineOfSight`.
- **`rules/character.js`:** `rangedStats(c, weapon)` returns `{ aim, max, toHit, dmgBonus, engagedPenalty, movePenaltyPerHex }`: the scaling for this character and weapon, independent of the board. The shop, the Character screen and the board tooltip all read it, so they always agree.
- **`rules/battlefield.js`:** `rangeProfile(state, shooterUid, targetUid, weapon)` combines `rangedStats` (or a mercenary's or monster's fixed numbers) with the board: distance, line of sight, cover, engaged, moved and point blank. It returns `{ ok, reason, distance, toHitMod, dmgMult, dmgBonus, cover, parts }`, where `parts` lists each modifier for the tooltip. Its reasons are `'out of range'`, `'no line of sight'` and `'reloading'`. With no grid it returns only the stat and weapon parts. Moving records `cb.turn.movedHexes`.
- **`rules/combat.js`:**
  - `inReach` becomes "can this attacker attack this target with this weapon": melee checks adjacency as now; ranged weapons check `rangeProfile(...).ok`.
  - `playerTurn`, `allyTurn` and `enemyTurn` add `toHitMod` to the roll needed and multiply damage by `dmgMult`.
  - Attack events gain `ranged: true, distance, dmgMult` so the presenter can say "at 8 hexes".
  - The rules stay free of screen code, as now.
- **`rules/tables.js`:** `FALLOFF_HEXES = 4`, `AIM_CAP = 8`, `ENGAGED_PENALTY = 4`, `COVER_PENALTY = 2`, `PIERCE_AC = 3`, `dexMissile(d)`, `strRange(s)`.
- **`ui/stat-text.js`:** Dex rows say "Armor class 2 better, +2 with bows"; Str rows mention range for thrown and composite weapons.
- **Weaponsmith:** ranged weapons show "Your aim: 8 hexes · +2 to hit · +3 damage" from `rangedStats`. A self bow you're too weak for shows a warning tag ("needs Str 12").
- **`ui/presenter.js`:** new lines, for example "You loose an arrow at the Troll (8 hexes) and hit for 3 damage." and "The Hill Giant hurls a boulder at you…".
- **`ui/screens/battle.js`:**
  - With a ranged weapon in hand, enemies in range and in sight are marked as attackable at any distance. Clicking one shoots it.
  - Hovering an enemy shows "Composite Long Bow · 8 hexes · 60% to hit · 4-9 damage", with the parts listed: "Dex +2, range −0, cover −2, moved −1".
  - A faint ring shows the aim range and maximum range around you.
  - Hexes with no line of sight to your target are dimmed.
- **Save:** bump `SAVE_VERSION` to 5 with a migration that sets `rangedLeft` on enemies of in-progress fights (`??=`). `cb.throws` and `cb.turn.movedHexes` default safely when missing.

## Testing

- **`tests/index.html`, unit checks:**
  - Hex line: endpoints, length = distance + 1, every step adjacent.
  - Line of sight: blocked by a pillar; clear along an edge when either nudged line is clear.
  - Range profile at aim, aim + 1 and max: −0/−1/−4 to hit and 100%/87.5%/50% damage. Out of range beyond max.
  - Engaged penalty for missile weapons, not for thrown ones.
  - The moved-first penalty, and shoot-then-move being capped at 1 hex.
  - Cover counts fighters on the line, not the shooter or the target.
  - Classic fight: a ranged weapon has no range, cover or movement modifiers, but keeps its stat and weapon bonuses.
  - Scaling, through `rangedStats`:
    - Composite bow damage and range capped at pull (Str 18 with pull 17 gives +2 damage, +1 aim).
    - Self bow shortfall: −1 hit and −1 aim per point.
    - Crossbows take half Dex and ignore Str.
    - Pierce only against AC 3 or better.
    - Magic adds aim.
    - Aim is capped at 8.
    - Steady hands at Dex 17 and quick draw at Dex 18.
    - Point blank only within half aim and when not engaged.
    - The worked example's two gladiators get exactly the numbers in the table.
  - Heavy crossbow skips alternate rounds.
  - Javelin throws run out, then it falls back to melee.
  - Giant throws respect `uses` and line of sight.
- **Balance simulation:** a battlefield simulation that pits gladiators against each monster from the normal deployment, with the AI playing your turn. Run three builds at the same level:
  - A melee build: long sword.
  - A strong archer: Str 18, Dex 17, composite long bow + long sword.
  - An average crossbowman: Str 10, Dex 10, heavy crossbow + long sword.

  Watch whether the archer beats slow giants or trolls far more often than the melee build (if so, tighten shoot-then-move, `AIM_CAP` or `strRange`). Also watch whether the crossbow is a fair choice for low-stat characters rather than a trap.
- **`tests/beta-smoke.html`:** buy a short bow, shoot an enemy at range through the real screen, and check the log line and the hit-chance tooltip.

## Build order

1. Hex line and line of sight, with tests.
2. `dexMissile`, `strRange` and `rangedStats` (all the scaling), then the range profile and board modifiers, plus the classic-fight fallback.
3. Player ranged weapons in the shop (beta only), shooting on the board, tooltips.
4. The shoot-then-move rule, weapon switching, heavy crossbow reload, javelins.
5. Giant boulders.
6. The battlefield balance simulation; tune the numbers.
7. Phase 2: Archer mercenaries.

## Open questions

- **Thrown daggers and hand axes:** throw your melee weapon, then be unarmed until you walk onto its hex to pick it up? Tactically interesting, but it needs items lying on the board.
- **Friendly fire:** should a miss by 1-2 hit a fighter giving cover?
- **Reach 2 for halberds and long spears:** this is the same `rangeProfile` idea with no falloff. It's listed in `DESIGN.md` under "Reach and ranged attacks".
- **Breath as a cone or line** with range, using the same line helper.
- **Height and big monsters:** if giants come to occupy several hexes, do they block line of sight like pillars?
- **Should Dex's missile bonus show in the Training Yard and Character screen** only in the beta, or always?
- **Should level improve shooting beyond THAC0 and extra attacks?** For example, a "marksman" step at 7th level that adds +1 aim, or reduces the falloff to −1 per 2 hexes for the first 2 hexes past aim.
- **Better range-based damage on a natural 20?** For example, maximum weapon damage before the falloff, or only within aim.
- **Should a composite bow's pull be chosen at purchase** (pull 16, 17 or 18 at rising prices), as in AD&D, rather than fixed per bow?
- **Should Str also lengthen a self bow's range** a little (+1 aim at Str 18), or is "minimum only" the cleaner split from composite bows?
