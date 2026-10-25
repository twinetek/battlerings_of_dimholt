# The Battlerings of Dimholt: to do

Ideas that are decided in principle but not built yet. Move an item into `DESIGN.md` once it's built.

## Lopsided fights summon help

**Idea.** Solo fights are one on one today. When a fight is badly mismatched in the player's favor, the monster should be able to summon help even without mercenaries. For example, a level 5 fighter attacking a Giant Rat might bring in more rats. This keeps strong characters from farming trivial opponents, and it makes the low end of the list livelier.

**Where it goes.** All summon decisions go through `reinforcementsDue(state)` in `js/rules/combat.js`. Today it returns nothing when `cb.hired === 0` ("Solo fights stay solo"). The new rule adds a second branch there; nothing else in the engine needs to change. Summoning, the warning a round ahead, the arrival, the "every enemy must be defeated" rule, and the XP split already work for any number of enemies.

**Open questions:**

- **What counts as "lopsided"?** Options:
  - Player level against the monster's position on the list, for example more than about 3 levels above where the balance simulator says the monster is a 50% fight.
  - The player's simulated win chance, for example above 98%. This is more accurate, but it needs a fast estimate at fight start.
  - Total XP already earned from that monster type.
- **How many helpers, and how often?** Scale with how lopsided the fight is, for example one extra rat per 2 levels of gap, capped at about 4.
- **Should it be announced on the Battlerings screen** ("The rats sense an easy meal…"), so players know why it happens?
- **Rewards:** should lopsided-fight helpers give XP, or nothing? XP would undercut the anti-farming purpose.
- **Which monsters?** Only those with a `calls` entry? Should the arena master step in for loners when the fight is lopsided?
- **Interaction with mercenaries:** should a lopsided fight with mercenaries use the larger of the two summon caps?

**Testing.** Add unit tests to `tests/index.html` for "no summons when the fight is fair" and "summons when lopsided". Extend the balance simulator to report how often lopsided summons trigger at each level.

## Code review findings (2026-10-22)

From a full review of the repo. All three test pages passed at the time (110 rule checks, 42 main playthrough, 13 beta playthrough). Most important first.

### Bugs

- **Paralysis is much weaker on the hex battlefield.** `endTurn` in `js/rules/battlefield.js` counts your paralysis down (via `playerTurn`) *before* the enemies act. Enemies get automatic hits only while `cb.paralyzed > 0`, so a 1-round paralysis never gives them a free hit, and a d3 paralysis gives one fewer helpless round than the classic fight. Measured against a Ghoul with a paralyzed gladiator: 100% enemy hit rate in the classic fight, 8% on the battlefield. **Fix:** count paralysis down after the enemy loop. **Test:** paralyzed 1 round with an adjacent enemy: its attacks all hit.
- **The battlefield crashes when the board is full.** If no hex is free, `placeNewcomers` leaves a fighter without a position. `advance()` then reads `pos[uid].q` on `undefined` and `endTurn` throws. Reproduced with 40 tester-added rats on a radius-3 board. An enemy with no position also can't be reached but still counts toward victory. Only the tester tools can trigger it today. **Fix:** skip unplaced fighters in `advance`/`endTurn` and place them when a hex frees up, or cap enemies at the free hexes. **Test:** overfill a small board, then `endTurn` doesn't throw.
- **Surrender during a round's animation is lost.** In `js/ui/screens/combat.js`, `act()` returns early while `busy` and only skips the animation, so a confirmed surrender never happens. The battle screen's `run()` has the same pattern. **Fix:** queue the surrender, or block it with a message while busy.
- **Input mid-animation spoils the round.** Pressing U (`pickItem`) or clicking a speed button during playback re-renders the screen, which shows the round's final result early. **Fix:** ignore these while `busy`.

### Save safety

- **An unreadable save can be silently overwritten.** `readSlot` in `js/engine/save.js` returns `null` on any error, including "save from a newer version". The title screen then offers New game, and the next autosave replaces it. `js/main-beta.js` can also copy the main game over a beta autosave it couldn't read. **Fix:** tell "empty" apart from "unreadable", and never autosave over an unreadable slot without asking.
- **Import replaces the current game without asking.** Loading from a slot asks first; import from file (`mount` in `js/ui/screens/saves.js`) doesn't. **Fix:** ask the same question when a game is in progress.

### Beta battlefield UI

- **Hovering the board resets the tester controls.** Every hovered hex calls `setParams`, which redraws the whole screen and resets the tester monster drop-down and radius field. **Fix:** redraw only the board on hover, or keep the tester inputs in params.
- **The board can't be used from the keyboard.** The SVG hexes have no focus or key handling. Fine for a beta; needed before it ships.

### Balance

- **Hiring help against the Giant Scorpion loses XP.** The hiring simulation shows −80 XP per win with one Knight: the arena's step-down helper is a Wight (`ARENA_STEP_DOWN` = 3 places weaker), and its level drain costs more than the fight earns. It's already noted under "Arena step-down surprises" in `DESIGN.md`; this puts a number on it. Options: skip drainers when stepping down, or pick the nearest weaker monster without `special.drain`.

### Cleanup

- **`js/ui/screens/battle.js` repeats code from `js/ui/screens/combat.js` and the presenter:** wages (use `crewCost`), the usable-items list, `trimLog`, `DELAYS`, `sleep`, the end-of-fight buttons, and its own animation loop instead of `TextPresenter`.
- **Unused imports:** `startCombat` in `js/ui/screens/arena.js` and `js/ui/screens/combat.js`; `crewSize` in `js/ui/screens/combat.js`.
- **The classic fight screen's `mount` would throw with no fight in progress** (`ctx.state.combat?.log.length` is `undefined`, then it pushes to `s.combat.log`). Nothing routes there today; `battle.js` already guards with `s.combat &&`.
