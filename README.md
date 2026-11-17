# The Battlerings of Dimholt

A browser gladiator game that builds on *Darkwood* (1992), the Macintosh shareware arena game by Robert Chancellor. It's a new fan-created game with its own ideas.

Roll a gladiator and fight your way up the Battlerings, from giant rats to the Red Dragon. Every fight is on a hex battlefield: move, strike, throw your spare weapons, or shoot a sling, bow or crossbow. Buy weapons, armor, and magic. Level up and spend stat points. Hire mercenaries, and coat your blade with venom from poisonous monsters. Beat the Red Dragon to become Captain of the Guard.

It's plain HTML, CSS, and JavaScript modules, with no build step and no server. Games save in your browser, and you can export a save file for backup.

## Play

Once GitHub Pages is on, the game is at https://twinetek.github.io/battlerings_of_dimholt/.

**Beta features:** add `?beta=true` to the address (for example `https://twinetek.github.io/battlerings_of_dimholt/?beta=true`) to show a **Beta features** drop-down on the title screen.

- Each beta feature is the full game with one experimental feature switched on, in its own folder with its own saves.
- It starts from a copy of your main game and never changes it.
- Today there's one beta feature: **Battlefield tester** (`hex_battlefield/`): the battlefield with tester controls for setting up scenarios (add enemies or mercenaries, heal, pick an arena layout, auto-play). New battlefield rules land there first.

**The battlefield** (main game): every fight is on a hex arena with pillars and a layout rolled at random: flat, hills, a stepped ziggurat, or raised ledges with ramps. High ground matters: you can only strike 1 level up or down, attacking up is harder, attacking down hits harder, and throwing down reaches farther. Climbing a level costs extra movement: Strength makes climbing cheaper, Dexterity makes you faster and surer going down, and heavy armor slows you unless you're strong enough to carry it. Too-high cliffs must be gone around, and you can jump down a drop at the cost of falling damage. Monsters move their own way: spiders walk up walls, dragons fly over them, giants step up them. Move and attack an adjacent enemy, or throw any weapon you carry at one in range; each weapon is one throw per fight, so five daggers are five throws. Javelins fly farthest, then daggers and Throwing Axes; a two-handed sword barely flies at all. You gather everything up after each fight, and you can carry any number of weapons. A sling, bow or crossbow in your hand shoots every round but can't strike in melee. Self bows need a minimum Strength; composite bows turn Strength into damage and range. Arrows, bolts and sling stones also come enchanted: seeking, flaming or exploding, and +1. A sling never runs out of stones; bows need arrows and crossbows bolts, which can break when they hit. You gather up the rest after the fight.

## Run locally

ES modules don't load from `file://`, so serve the repository root:

```
python -m http.server
```

Then open these pages:

| Page | What it is |
|---|---|
| http://localhost:8000/ | The game |
| http://localhost:8000/?beta=true | The game, with the beta features drop-down |
| http://localhost:8000/hex_battlefield/ | The battlefield tester beta |
| http://localhost:8000/tests/ | Rule tests and balance simulations |
| http://localhost:8000/tests/smoke.html | Main-game playthrough |
| http://localhost:8000/tests/beta-smoke.html | Beta playthrough: the drop-down, then the tester beta |

The test pages report PASS or FAIL lines. The playthroughs drive the real screens and overwrite autosaves in that browser.

## Where things are

- `js/data/`: monsters, equipment, mercenaries, loot.
- `js/rules/`: game rules as pure functions.
- `js/engine/`: dice, hex grid math, state, saves.
- `js/ui/`: screens.
- `DESIGN.md`: design notes and decisions.
- `TODO.md`: ideas that are decided but not built yet, and open findings from code reviews.
- `Todo_ranged.md`: the design for ranged attacks on the battlefield. Throwing (any weapon you carry), javelins, the sling, and a basic bow and crossbow with arrows and bolts are built; better and magic bows and ammunition, and monsters that shoot, are not.
- `Area_Effects.md`: considerations for area effects on the battlefield: blasts, cones, lines and lingering clouds. Not designed or built yet.

## Credits

This is an unofficial fan project, inspired by *Darkwood* by Robert Chancellor. A separate, faithful remake of Darkwood lives at https://twinetek.github.io/Darkwood/.
