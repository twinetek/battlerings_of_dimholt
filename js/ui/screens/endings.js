import { MONSTER_BY_ID } from '../../data/monsters.js';
import { button, esc } from '../format.js';

export const dead = {
  render(ctx) {
    const s = ctx.state;
    const c = s.character;
    const name = s.combat ? MONSTER_BY_ID[s.combat.monsterId].name : null;
    const article = n => `${/^[AEIOU]/.test(n) ? 'an' : 'a'} ${n}`;
    const killer = name ? article(name) : 'the arena';
    const poisoner = c.poisonSource ? article(MONSTER_BY_ID[c.poisonSource].name) : null;
    return `
      <section class="panel narrow center">
        <div class="portrait big" aria-hidden="true">🪦</div>
        <h2>Here lies ${esc(c.name)}</h2>
        <p>Level ${c.level} gladiator, ${s.combat?.cause === 'poison'
          ? `who succumbed to poison${poisoner ? ` from ${esc(poisoner)}` : ''}`
          : s.combat?.cause === 'drain' ? `drained of life by ${esc(killer)}` : `slain by ${esc(killer)}`} on day ${s.day}.</p>
        <p class="muted">The crowd has already forgotten. Perhaps a saved game remembers you.</p>
        <div class="row center">
          ${button('Load a saved game', 'go', { to: 'saves' }, { cls: 'primary' })}
          ${button('New gladiator', 'go', { to: 'create' })}
        </div>
      </section>`;
  },
};

export const captain = {
  render(ctx) {
    const c = ctx.state.character;
    return `
      <section class="panel narrow center">
        <div class="portrait big" aria-hidden="true">🏆</div>
        <h2>Captain of the Guard</h2>
        <p>No one had bested the Battlerings' mightiest creature in 24 seasons. Today ${esc(c.name)} did,
          on day ${ctx.state.day}, at level ${c.level}.</p>
        <p>The city keeps its promise. You are named one of the Captains of the Guard of Dimholt,
          and your father's name is spoken with honor again.</p>
        <p class="muted">You can keep fighting in the arena as long as you like.</p>
        <div class="row center">${button('Return to town', 'done', {}, { cls: 'primary' })}</div>
      </section>`;
  },
  actions: {
    done(ctx) {
      ctx.mutate(s => { s.flags.captainSeen = true; });
      ctx.go('town');
    },
  },
};
