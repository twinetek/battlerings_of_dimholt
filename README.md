# The Battlerings of Dimholt

A browser gladiator game that builds on *Darkwood* (1992), the Macintosh shareware arena game by Robert Chancellor. It's a new fan-created game with its own ideas.

Roll a gladiator and fight your way up the Battlerings, from giant rats to the Red Dragon. Buy weapons, armor, and magic. Level up and spend stat points. Hire mercenaries, and coat your blade with venom from poisonous monsters. Beat the Red Dragon to become Captain of the Guard.

It's plain HTML, CSS, and JavaScript modules, with no build step and no server. Games save in your browser, and you can export a save file for backup.

## Play

Once GitHub Pages is on, the game is at https://twinetek.github.io/battlerings_of_dimholt/.

## Run locally

ES modules don't load from `file://`, so serve the repository root:

```
python -m http.server
```

Then open these pages:

| Page | What it is |
|---|---|
| http://localhost:8000/ | The game |
| http://localhost:8000/tests/ | Rule tests and balance simulations |
| http://localhost:8000/tests/smoke.html | A playthrough of the real screens |

The test pages report PASS or FAIL lines. The playthrough overwrites the autosave and slot 3 in that browser.

## Where things are

- `js/data/`: monsters, equipment, mercenaries, loot.
- `js/rules/`: game rules as pure functions.
- `js/engine/`: dice, state, saves.
- `js/ui/`: screens.
- `DESIGN.md`: design notes and decisions.
- `TODO.md`: ideas that are decided but not built yet.

## Credits

This is an unofficial fan project, inspired by *Darkwood* by Robert Chancellor. A separate, faithful remake of Darkwood lives at https://twinetek.github.io/Darkwood/.
