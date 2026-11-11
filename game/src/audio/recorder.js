// Render the Earth Record offline (same instruments, same schedule) and encode it as a WAV file.
import { buildGraph } from './engine.js';
import { composeRecord } from './sonify.js';

export async function renderRecord(rounds, sampleRate = 44100) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  // First pass to learn the length: a throwaway context of one second just to run the composer.
  const probe = new OAC(2, sampleRate, sampleRate);
  const dur = composeRecord(probe, buildGraph(probe), 0, rounds);
  const ctx = new OAC(2, Math.ceil(dur * sampleRate), sampleRate);
  const bus = buildGraph(ctx);
  bus.master.gain.value = 0.9;
  composeRecord(ctx, bus, 0.05, rounds);
  return ctx.startRendering();
}

export function wavBlob(buffer) {
  const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data], { type: 'audio/wav' });
}
