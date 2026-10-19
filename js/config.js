// Build switches. The beta (beta/index.html, via js/main-beta.js) turns
// `beta` on before the app starts; nothing reads these at import time.
//
// beta: arena fights use the hex battlefield (rules/battlefield.js), with
//       tester controls, and saves live under their own prefix so the beta
//       never touches the main game.

export const config = { beta: false };

export const MAIN_SAVE_PREFIX = 'dimholt.save.';
export const BETA_SAVE_PREFIX = 'dimholt-beta.save.';
export const savePrefix = () => (config.beta ? BETA_SAVE_PREFIX : MAIN_SAVE_PREFIX);
