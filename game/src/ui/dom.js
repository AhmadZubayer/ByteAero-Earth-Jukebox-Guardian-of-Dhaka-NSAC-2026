// Tiny DOM helpers for HTML screens over the canvas.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ui = () => document.getElementById('ui');

// Replace the overlay content and move focus to the new heading for keyboard and screen-reader users.
export function show(...nodes) {
  const root = ui();
  root.replaceChildren(...nodes);
  document.body.classList.toggle('has-panel', !!root.querySelector('.panel'));
  const target = root.querySelector('[data-autofocus]') || root.querySelector('h1, h2');
  if (target) {
    if (!target.hasAttribute('tabindex') && /^H\d$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => target.focus({ preventScroll: false }));
  }
  return root;
}

export function clear() { ui().replaceChildren(); document.body.classList.remove('has-panel'); }

export function button(label, onClick, cls = '', attrs = {}) {
  return h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick: onClick, ...attrs }, label);
}

// Show one line of dialogue; resolves with the chosen option's value.
export function dialogue({ who = 'Echo', text, options = [{ label: 'Next', value: true }], person = false, region = null }) {
  return new Promise((resolve) => {
    const root = region || ui();
    const box = h('section', { class: 'dialogue', role: 'dialog', 'aria-modal': 'false', 'aria-label': `${who} says` },
      h('div', { class: `who${person ? ' person' : ''}`, 'aria-hidden': 'true' }),
      h('div', { class: 'name' }, who),
      h('p', {}, text),
      h('div', { class: 'row end' }, options.map((o, i) => button(o.label, () => { box.remove(); resolve(o.value); }, i === 0 ? '' : 'secondary', i === 0 ? { 'data-autofocus': true } : {}))),
    );
    root.querySelectorAll('.dialogue').forEach((d) => d.remove());
    root.append(box);
    requestAnimationFrame(() => box.querySelector('[data-autofocus]')?.focus());
  });
}

export function stars(n, max = 3) {
  return h('div', { class: 'stars', role: 'img', 'aria-label': `${n} of ${max} stars` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? '' : 'off', 'aria-hidden': 'true' }, '★')));
}
