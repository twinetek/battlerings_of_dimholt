// Starting a fight. Every new fight is on the hex battlefield: a flat arena
// with pillars in the main game; the hex-battlefield beta adds terrain and
// tester controls (settings.battle). The classic screen (screens/combat.js)
// only finishes fights saved before the battlefield, which have no grid.
import { betaOn } from '../config.js';
import { crewSize } from '../data/mercs.js';
import { startBattle, DEFAULT_FIELD } from '../rules/battlefield.js';

export const fightScreen = state => (state.combat?.grid ? 'battle' : 'combat');

export function beginFight(ctx, monsterId, crew = {}) {
  const result = ctx.mutate(s => {
    const field = betaOn('hex-battlefield') ? s.settings.battle ?? DEFAULT_FIELD : DEFAULT_FIELD;
    const r = startBattle(s, monsterId, crew, field);
    if (r.ok) {
      s.lastFoe = monsterId;
      if (crewSize(crew)) s.lastCrew = { ...crew };
    }
    return r;
  });
  if (!result.ok) {
    ctx.flash(result.msg, 'err');
    ctx.render();
    return false;
  }
  ctx.go(fightScreen(ctx.state));
  return true;
}
