// Choose which tree to plant. All cost 1 coin and cool the same amount (a game estimate);
// they differ in look and in what they are like in Dhaka.
import { h } from './dom.js';

export const TREES = [
  { key: 'mango', kind: 1, name: 'Mango tree', icon: '🥭', fact: 'Thick, round crown with deep shade. Found in many Dhaka yards.' },
  { key: 'coconut', kind: 0, name: 'Coconut palm', icon: '🌴', fact: 'Tall and slim. Less shade, but grows well near ponds and rivers.' },
  { key: 'neem', kind: 2, name: 'Neem tree', icon: '🌳', fact: 'Hardy and fast-growing. A common shade tree along roads.' },
];

// Resolves with the chosen tree, or null if closed. Keys 1–3 choose, Esc closes.
export function pickTree(current = null) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const close = (val) => {
      document.removeEventListener('keydown', onKey, true);
      wrap.remove();
      prevFocus?.focus?.();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
      const n = +e.key;
      if (n >= 1 && n <= TREES.length) { e.preventDefault(); e.stopPropagation(); close(TREES[n - 1]); }
    };
    const cards = TREES.map((t, i) => h('button', { type: 'button', class: 'tree-option', 'aria-pressed': String(current === t.key), onclick: () => close(t) },
      h('span', { class: 'tree-icon', 'aria-hidden': 'true' }, t.icon),
      h('strong', {}, `${i + 1}. ${t.name}`),
      h('span', {}, t.fact)));
    const wrap = h('div', { class: 'modal-backdrop' },
      h('section', { class: 'panel tree-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tree-h' },
        h('h2', { id: 'tree-h' }, 'Choose a tree'),
        h('p', {}, 'Every tree costs 1 coin and cools its block by the same amount (game estimate). Press 1, 2 or 3, or tap a tree.'),
        h('div', { class: 'tree-grid' }, cards),
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn secondary small', onclick: () => close(null) }, 'Cancel'))));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => (cards[Math.max(0, TREES.findIndex((t) => t.key === current))] || cards[0]).focus());
  });
}
