// Placeholder until Phase 5: Earth Record and ticket.
import { h, show, button } from '../ui/dom.js';
export function earthRecord(state) {
  return new Promise((resolve) => show(h('section', { class: 'panel' }, h('h2', {}, 'Earth Record'), h('p', {}, state.results.map((r) => `${r.year}: ${r.pct}%`).join(' · ')), button('Ticket', resolve))));
}
export function ticket(state, badges) {
  return new Promise(() => show(h('section', { class: 'panel' }, h('h2', {}, `Ticket for ${state.name}`), h('p', {}, `Average ${badges.avg}%`), h('p', {}, badges.list.map((b) => b.name).join(', ') || 'No badges yet'))));
}
