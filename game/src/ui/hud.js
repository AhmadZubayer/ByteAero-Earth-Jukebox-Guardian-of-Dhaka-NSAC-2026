// Round HUD: year, phase, timer, coins, fix toolbar, district readout, compass.
import { h } from './dom.js';
import { FIX_LIST } from '../game/heat.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.fixButtons = {};
    const bar = $('hud-fixes');
    bar.replaceChildren();
    for (const f of FIX_LIST) {
      const b = h('button', { type: 'button', class: 'fix-btn', 'aria-pressed': 'false', 'data-fix': f.key, title: `${f.label}: ${f.what}. Costs ${f.cost}. Key ${f.hotkey}.` },
        h('span', { class: 'fix-long' }, `${f.hotkey} ${f.label}`), h('span', { class: 'fix-short', 'aria-hidden': 'true' }, f.key === 'centre' ? 'Centre' : f.key === 'roof' ? 'Roof' : f.label), h('small', {}, `${f.cost} coin${f.cost > 1 ? 's' : ''}`));
      b.addEventListener('click', () => this.onPick?.(f.key));
      bar.append(b);
      this.fixButtons[f.key] = b;
    }
    $('hud-menu').onclick = () => this.onMenu?.();
    $('hud-wave').onclick = () => this.onWave?.();
  }

  show(v) { this.root.hidden = !v; }

  set({ year, imagined, phase, time, coins, found, spots, relaxed }) {
    if (year != null) $('hud-year').textContent = `${year}${imagined ? ' · imagined' : ' · NASA data'}`;
    if (phase != null) $('hud-phase').textContent = phase;
    if (time != null) {
      const t = $('hud-timer');
      if (relaxed) { t.textContent = 'No timer'; t.classList.remove('low'); }
      else { t.textContent = `⏱ ${Math.max(0, Math.ceil(time))} s`; t.classList.toggle('low', time < 15); }
    }
    if (coins != null) {
      $('hud-coins').textContent = `🪙 ${coins} coins`;
      for (const f of FIX_LIST) this.fixButtons[f.key].disabled = f.cost > coins;
    }
    if (found != null) $('hud-protect').textContent = `Heat found ${found}/${spots}`;
  }

  select(key) {
    for (const [k, b] of Object.entries(this.fixButtons)) b.setAttribute('aria-pressed', String(k === key));
  }

  district(text) { $('hud-district').textContent = text || ''; }

  compass(angle, visible) {
    const c = $('hud-compass');
    c.hidden = !visible;
    if (visible) c.firstElementChild.style.transform = `rotate(${angle}rad)`;
  }
}
