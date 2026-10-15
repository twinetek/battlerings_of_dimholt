// Plain-language descriptions of what a stat value does.

import { strBonus, dexAc, conHp } from '../rules/tables.js';
import { signed } from './format.js';

// Always returns text, so rows keep the same shape whatever the value.
export function bonusText(key, v) {
  if (key === 'str') {
    const b = strBonus(v);
    return b.hit || b.dmg ? `${signed(b.hit)} hit, ${signed(b.dmg)} damage` : 'No bonus';
  }
  if (key === 'dex') {
    const ac = dexAc(v); // negative is better
    return ac ? `Armor class ${Math.abs(ac)} ${ac < 0 ? 'better' : 'worse'}` : 'No bonus';
  }
  if (key === 'con') return conHp(v) ? `${signed(conHp(v))} hp per level` : 'No bonus';
  return 'No effect yet';
}
