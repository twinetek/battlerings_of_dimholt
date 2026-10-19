// Entry point for a beta feature's folder. The page names its feature with
// <html data-beta-feature="...">. The first time it opens, it copies the main
// game's autosave so testing starts from your own gladiator.
import { boot } from './boot.js';
import { config, BETA_BY_ID } from './config.js';
import { readSlot, copyMainIntoBeta } from './engine/save.js';

const id = document.documentElement.dataset.betaFeature;
if (!BETA_BY_ID[id]) throw new Error(`Unknown beta feature "${id}". Add it to BETA_FEATURES in js/config.js.`);
config.betaFeature = id;
if (!readSlot('auto')) copyMainIntoBeta();
boot();
