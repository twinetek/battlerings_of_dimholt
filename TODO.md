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
