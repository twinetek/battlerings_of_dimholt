// The beta: the full game, with arena fights on the hex battlefield and its
// own saves. The first time it opens, it copies your main game's autosave.
import { boot } from './boot.js';
import { config } from './config.js';
import { readSlot, copyMainIntoBeta } from './engine/save.js';

config.beta = true;
if (!readSlot('auto')) copyMainIntoBeta();
boot();
