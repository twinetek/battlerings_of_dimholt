// Save slots in this browser, plus export/import to a file.

import { listSlots, writeSlot, readSlot, deleteSlot, exportToFile, importFromFile, storageAvailable } from '../../engine/save.js';
import { routeFor } from '../app.js';
import { button, esc } from '../format.js';

const slotName = slot => (slot === 'auto' ? 'Autosave' : `Slot ${slot}`);

function when(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

export function render(ctx) {
  const s = ctx.state;
  const canSave = !!s?.character && !s.combat && !s.character.dead;
  const rows = listSlots().map(({ slot, save }) => `
    <tr>
      <th scope="row">${slotName(slot)}</th>
      <td>${save ? `${esc(save.summary)}<br><span class="muted small">${when(save.savedAt)}</span>` : '<span class="muted">Empty</span>'}</td>
      <td class="act">
        ${slot !== 'auto' ? button('Save here', 'save', { slot }, { disabled: !canSave }) : ''}
        ${button('Load', 'load', { slot }, { disabled: !save })}
        ${slot !== 'auto' && save ? button('Delete', 'remove', { slot }, { cls: 'ghost' }) : ''}
      </td>
    </tr>`).join('');
  return `
    <section>
      <h2>💾 Save / Load</h2>
      <p class="muted">Games are saved in this browser only. The autosave updates after every action.
        To keep a backup or move to another device, export your game to a file.</p>
      ${storageAvailable() ? '' : '<p class="flash err">Local storage is blocked in this browser, so slots won\'t work. Use export and import instead.</p>'}
      <div class="panel">
        <div class="table-wrap"><table class="slots"><tbody>${rows}</tbody></table></div>
      </div>
      <div class="panel">
        <h3>Backup file</h3>
        <div class="row">
          ${button('Export game to file', 'export', {}, { disabled: !s?.character })}
          <label class="button-like">Import from file<input type="file" id="import-file" accept=".json,application/json" hidden></label>
        </div>
      </div>
      <div class="row">${s?.character ? button('← Back to town', 'back', {}, { cls: 'ghost' }) : button('← Back', 'go', { to: 'title' }, { cls: 'ghost' })}</div>
    </section>`;
}

export const actions = {
  save(ctx, d) {
    const ok = writeSlot(d.slot, ctx.state);
    ctx.flash(ok ? `Saved to ${slotName(d.slot)}.` : 'Saving failed. Your browser may be blocking storage.', ok ? 'ok' : 'err');
    ctx.render();
  },
  load(ctx, d) {
    const save = readSlot(d.slot);
    if (!save) return;
    if (ctx.state?.character && d.slot !== 'auto' && !window.confirm(`Load ${slotName(d.slot)}? Progress since your last save will be lost.`)) return;
    ctx.start(save.state);
    ctx.flash(`Loaded ${slotName(d.slot)}.`);
    ctx.render();
  },
  remove(ctx, d) {
    if (!window.confirm(`Delete the game in ${slotName(d.slot)}?`)) return;
    deleteSlot(d.slot);
    ctx.render();
  },
  export(ctx) {
    exportToFile(ctx.state);
  },
  back(ctx) {
    ctx.go(routeFor(ctx.state));
  },
};

export function mount(ctx, root) {
  root.querySelector('#import-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const state = await importFromFile(file);
      ctx.start(state);
      ctx.flash(`Imported ${state.character.name}.`);
    } catch (err) {
      ctx.flash(err.message, 'err');
    }
    ctx.render();
  });
}
