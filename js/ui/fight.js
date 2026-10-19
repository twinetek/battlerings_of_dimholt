// Starting a fight: the main game uses the classic combat screen; the beta
// puts the same fight on the hex battlefield.
import { config } from '../config.js';
import { crewSize } from '../data/mercs.js';
import { startCombat } from '../rules/combat.js';
import { startBattle, DEFAULT_FIELD } from '../rules/battlefield.js';

export const fightScreen = state => (state.combat?.grid ? 'battle' : 'combat');

export function beginFight(ctx, monsterId, crew = {}) {
  const result = ctx.mutate(s => {
    const r = config.beta
      ? startBattle(s, monsterId, crew, s.settings.battle ?? DEFAULT_FIELD)
      : startCombat(s, monsterId, crew);
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
