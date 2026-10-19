// Beta features. Each one is the full game with one experimental feature
// switched on, published in its own folder with its own saves, so testing it
// never touches the main game. The title screen lists them in a "Beta
// features" drop-down when the address ends in ?beta=true.
//
// To add a beta feature: add it here, create its folder with an index.html
// like hex_battlefield/index.html (with its id in data-beta-feature), and
// check betaOn('<id>') wherever the game should behave differently.

export const BETA_FEATURES = [
  {
    id: 'hex-battlefield',
    name: 'Hex battlefield',
    folder: 'hex_battlefield/',
    description: 'Arena fights on a hex grid, with tester controls for setting up scenarios.',
  },
];

export const BETA_BY_ID = Object.fromEntries(BETA_FEATURES.map(f => [f.id, f]));

// Set by js/main-beta.js before the app starts; nothing reads it at import time.
export const config = { betaFeature: null };

export const activeBeta = () => BETA_BY_ID[config.betaFeature] ?? null;
export const betaOn = id => config.betaFeature === id;

export const MAIN_SAVE_PREFIX = 'dimholt.save.';
export const betaSavePrefix = id => `dimholt-${id}.save.`;
export const savePrefix = () => (config.betaFeature ? betaSavePrefix(config.betaFeature) : MAIN_SAVE_PREFIX);

// ?beta=true shows the beta drop-down on the title screen.
export const betaMenuRequested = () => new URLSearchParams(location.search).get('beta') === 'true';
