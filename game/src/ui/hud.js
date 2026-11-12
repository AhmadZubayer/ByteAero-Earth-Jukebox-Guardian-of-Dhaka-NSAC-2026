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
    // Mission card: the goals, the one next thing to do, where to go, and what you just learned.
    $('hud').querySelector('.mission')?.remove();
    this.steps = {};
    const stepList = h('ol', { class: 'mission-steps' }, ['find', 'protect', 'wave'].map((k) => (this.steps[k] = h('li', { 'data-state': 'todo' }))));
    this.nextEl = h('p', { class: 'mission-next', 'aria-live': 'polite' });
    this.whereEl = h('p', { class: 'mission-where', 'aria-hidden': 'true' });
    this.hereEl = h('p', { class: 'mission-here', 'aria-hidden': 'true' });
    this.tipEl = h('div', { class: 'mission-tip', hidden: true });
    this.kicker = h('p', { class: 'mission-kicker' });
    this.mission = h('section', { class: 'mission', 'aria-label': 'Your mission' }, this.kicker, stepList, this.nextEl, this.whereEl, this.hereEl, this.tipEl);
    $('hud').append(this.mission);
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

  district(text) { this.hereEl.textContent = text ? `📍 ${text}` : ''; }

  // steps: { find: [label, state], protect: [...], wave: [...] } with state 'todo' | 'now' | 'done'
  setSteps(year, steps) {
    this.kicker.textContent = `Your mission · ${year}`;
    for (const [k, [label, st]] of Object.entries(steps)) {
      const li = this.steps[k];
      if (li.textContent !== label) li.textContent = label;
      li.dataset.state = st;
    }
  }

  next(text) { if (this.nextEl.textContent !== text) this.nextEl.textContent = text; }
  where(text) { this.whereEl.textContent = text || ''; }

  tip(fact) {
    this.tipEl.hidden = false;
    this.tipEl.replaceChildren(h('span', { class: 'tip-icon', 'aria-hidden': 'true' }, fact.icon), h('div', {}, h('strong', {}, `Did you know? ${fact.title}`), h('p', {}, fact.text)));
    this.tipEl.classList.remove('pop'); void this.tipEl.offsetWidth; this.tipEl.classList.add('pop');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => { this.tipEl.hidden = true; }, 14000);
  }

  compass(angle, visible) {
    const c = $('hud-compass');
    c.hidden = !visible;
    if (visible) c.firstElementChild.style.transform = `rotate(${angle}rad)`;
  }
}
