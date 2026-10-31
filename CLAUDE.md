# The Battlerings of Dimholt

A browser gladiator game in plain HTML, CSS and ES modules: no build step, no server, no dependencies. Read `README.md` for what it is and how to run it, and `DESIGN.md` for how it works. Section 3, "Code framework", covers the layout and the key decisions.

## Where to look

- `DESIGN.md`: the reference for everything built, including the hex battlefield beta and its terrain.
- `TODO.md`: decided-but-unbuilt ideas, plus open code-review findings (bugs, save safety, cleanup).
- `Todo_ranged.md`: the design for ranged attacks on the battlefield. Not built.
- `todo_terrain.md`: the design for multi-level terrain. Built so far: **generation** (`js/rules/terrain.js`), the board's level display, the tester layout picker, and the **melee height rules** (`heightMods`, `inReach` in `js/rules/combat.js`). Its "Build order" lists what's next.

When you build part of a design doc, document it in `DESIGN.md` and mark it built in the design doc. When a rule's behavior changes, update the player Guide prose in `js/ui/screens/guide.js` as well. The Guide's tables come from `data/` and `rules/` automatically.

## Conventions

- **Rules are pure.** `js/rules/` and `js/engine/` never touch the DOM. Combat returns event lists, and the UI presents them.
- **All randomness goes through `js/engine/dice.js`,** so tests can seed it. Never call `Math.random` in rules.
- **The game state is one plain JSON object.** If its shape changes, bump `SAVE_VERSION` and add a migration in `js/engine/save.js`, unless missing fields can safely default (as `grid.height` does).
- **Beta features** run the same code with `betaOn('<id>')` checks (see `js/config.js`) and keep their own saves.

## Testing

The tests are browser pages that print PASS/FAIL lines and set `document.body.dataset.done = 'yes'` when finished:

- `tests/index.html`: rule unit tests and balance simulations.
- `tests/smoke.html`: the main game, played through its real screens.
- `tests/beta-smoke.html`: the hex battlefield beta, played through its real screens.

To run them headless:

1. Serve the repository root: `python -m http.server 8765 --bind 127.0.0.1`.
2. Load each page in Chrome with `--headless=new --dump-dom --virtual-time-budget=120000`. Use a throwaway `--user-data-dir`, because the playthroughs overwrite autosaves.
3. Count the PASS and FAIL lines in the output, ignoring the `<script>` source.
