// Placeholder until Phase 5: the Earth Jukebox globe intro.
import { dialogue } from '../ui/dom.js';
export async function globeIntro() {
  await dialogue({ text: 'Echo is flying down to Dhaka. (The globe time-lapse arrives in the next build.)', options: [{ label: 'Next', value: true }] });
}
