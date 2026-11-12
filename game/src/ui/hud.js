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
    this.placeBtn = h('button', { type: 'button', class: 'fix-btn place-btn', title: 'Place the chosen fix (key E). You can also click the ground.' }, h('span', { class: 'place-label' }, 'Place'), h('small', {}, 'E · or click the ground'));
    this.placeBtn.addEventListener('click', () => this.onPlace?.());
    bar.append(this.placeBtn);
    // Mission card: the goals, the one next thing to do, where to go, and what you just learned.
    $('hud').querySelector('.mission')?.remove();
    this.steps = {};
    const stepList = h('ol', { class: 'mission-steps' }, ['find', 'protect', 'wave'].map((k) => (this.steps[k] = h('li', { 'data-state': 'todo' }))));
    this.actionEl = h('p', { class: 'mission-action', 'aria-live': 'polite' });
    this.nextEl = h('p', { class: 'mission-next' });
    this.whereEl = h('p', { class: 'mission-where', 'aria-hidden': 'true' });
    this.hereEl = h('p', { class: 'mission-here', 'aria-hidden': 'true' });
    this.tipEl = h('div', { class: 'mission-tip', hidden: true });
    this.kicker = h('p', { class: 'mission-kicker' });
    this.scoreText = h('p', { class: 'score-text' });
    this.scoreFill = h('span', { class: 'score-fill' });
    const marks = [50, 75, 90].map((pc, k) => h('i', { class: 'score-mark', style: `left:${pc}%`, title: `${k + 1} star${k ? 's' : ''}` }, '★'.repeat(k + 1)));
    this.scoreEl = h('div', { class: 'mission-score' }, this.scoreText, h('div', { class: 'score-bar', 'aria-hidden': 'true' }, this.scoreFill, marks));
    this.mission = h('section', { class: 'mission', 'aria-label': 'Your mission' }, this.kicker, stepList, this.scoreEl, this.actionEl, this.whereEl, this.nextEl, this.hereEl, this.tipEl);
    $('hud').querySelector('.block-label')?.remove();
    $('hud').querySelector('.celebrate')?.remove();
    this.labelEl = h('div', { class: 'block-label', 'aria-hidden': 'true', hidden: true });
    this.celebrateEl = h('div', { class: 'celebrate', 'aria-hidden': 'true', hidden: true });
    $('hud').append(this.labelEl, this.celebrateEl);
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

  placeState(ok, label) {
    this.placeBtn.classList.toggle('ready', ok);
    const l = this.placeBtn.querySelector('.place-label');
    if (l.textContent !== label) l.textContent = label;
  }

  // Safe blocks so far, with the 1/2/3-star marks (50 / 75 / 90 % of the city).
  setScore(safe, total) {
    const pct = Math.round((safe / total) * 100);
    const win = Math.ceil(total * 0.5);
    const txt = safe >= win ? `Safe blocks: ${safe} of ${total} (${pct}%) · enough to win ★` : `Safe blocks: ${safe} of ${total} (${pct}%) · ${win - safe} more to win`;
    if (this.scoreText.textContent !== txt) this.scoreText.textContent = txt;
    this.scoreFill.style.width = `${pct}%`;
    this.scoreFill.classList.toggle('win', safe >= win);
  }

  blockLabel(o) {
    if (!o) { this.labelEl.hidden = true; return; }
    this.labelEl.hidden = false;
    this.labelEl.style.transform = `translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -100%)`;
    const html = `<b>${o.name}</b><span class="bl-bar"><span style="width:${Math.round(o.done * 100)}%"></span></span><span class="bl-text">${o.text}</span>`;
    if (this.labelEl._h !== html) { this.labelEl.innerHTML = html; this.labelEl._h = html; }
  }

  celebrate(text) {
    this.celebrateEl.textContent = text;
    this.celebrateEl.hidden = false;
    this.celebrateEl.classList.remove('go'); void this.celebrateEl.offsetWidth; this.celebrateEl.classList.add('go');
    clearTimeout(this.celTimer);
    this.celTimer = setTimeout(() => { this.celebrateEl.hidden = true; }, 2200);
  }

  // The one thing to do now, in a few words, with the key to press shown as a badge.
  action(text, key = null) {
    const k = key ? `<kbd>${key}</kbd> ` : '';
    const html = `<span class="act-arrow" aria-hidden="true">👉</span> ${k}${text}`;
    if (this.actionEl._h !== html) { this.actionEl.innerHTML = html; this.actionEl._h = html; }
  }

  // Make the button to press glow: a fix key, 'place', 'wave' or null.
  highlight(what) {
    if (this._hl === what) return;
    this._hl = what;
    for (const [k, b] of Object.entries(this.fixButtons)) b.classList.toggle('glow', k === what);
    this.placeBtn.classList.toggle('glow', what === 'place');
    document.getElementById('hud-wave').classList.toggle('glow', what === 'wave');
    document.querySelectorAll('#touch [data-action="act"]').forEach((b) => b.classList.toggle('glow', what === 'place'));
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

  compass(angle, visible, text = '', state = '') {
    const c = $('hud-compass');
    c.hidden = !visible;
    if (!visible) return;
    c.dataset.state = state;
    c.firstElementChild.style.transform = `rotate(${angle}rad)`;
    let lab = c.querySelector('b');
    if (!lab) { lab = document.createElement('b'); c.append(lab); }
    if (lab.textContent !== text) lab.textContent = text;
  }
}
