// Placeholder until Phase 6: text-only mode.
import { h, show, button } from '../ui/dom.js';
export function playTextOnly() {
  return new Promise((resolve) => show(h('section', { class: 'panel' }, h('h2', {}, 'Text-only mode'), h('p', {}, 'Text-only rounds arrive in a later build.'), button('Continue', resolve))));
}
