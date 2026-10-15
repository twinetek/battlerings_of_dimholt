// Small HTML helpers shared by the screens.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, ch => ESC[ch]);

export const signed = n => (n > 0 ? `+${n}` : `${n}`);
export const gp = n => `${n.toLocaleString()} gp`;

export function bar(cur, max, cls = '') {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((100 * cur) / max))) : 0;
  const tone = pct > 50 ? 'good' : pct > 20 ? 'warn' : 'bad';
  return `<div class="bar ${tone} ${cls}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${cur}"><span style="width:${pct}%"></span></div>`;
}

// A button that triggers a screen action. data-* attributes become params.
export function button(label, action, data = {}, opts = {}) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const dis = opts.disabled ? ' disabled' : '';
  const title = opts.title ? ` title="${esc(opts.title)}"` : '';
  return `<button type="button" data-action="${action}"${attrs}${cls}${dis}${title}>${label}</button>`;
}

export const backToTown = () => button('← Back to town', 'go', { to: 'town' }, { cls: 'ghost' });

// Chance (0-100) of rolling at least `need` on a d20, with natural 1 and 20.
export function d20Chance(need) {
  const n = Math.min(20, Math.max(2, need));
  return Math.round(((21 - n) / 20) * 100);
}
