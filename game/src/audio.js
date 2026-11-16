// Procedural WebAudio SFX — no audio files.
let ctx = null, master = null;
export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
}
function env(gain, t0, a, d, peak) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function noiseBuffer(len) {
  const b = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * len) | 0), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
export function sfx(name, opt = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (opt.delay || 0);
  const vol = opt.vol ?? 1;
  if (name === 'shot' || name === 'shotFar') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.18);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = name === 'shotFar' ? 900 : 2600;
    const g = ctx.createGain(); env(g, t0, 0.002, 0.16, 0.5 * vol);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 0.2);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(name === 'shotFar' ? 160 : 220, t0);
    o.frequency.exponentialRampToValueAtTime(60, t0 + 0.09);
    const g2 = ctx.createGain(); env(g2, t0, 0.001, 0.09, 0.25 * vol);
    o.connect(g2); g2.connect(master); o.start(t0); o.stop(t0 + 0.1);
  } else if (name === 'reload') {
    [0, 0.12, 0.3].forEach((d, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 500 + i * 260;
      const g = ctx.createGain(); env(g, t0 + d, 0.002, 0.05, 0.12 * vol);
      o.connect(g); g.connect(master); o.start(t0 + d); o.stop(t0 + d + 0.06);
    });
  } else if (name === 'hit') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(880, t0);
    o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.05);
    const g = ctx.createGain(); env(g, t0, 0.001, 0.07, 0.22 * vol);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.08);
  } else if (name === 'kill') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(1040, t0 + 0.09);
    const g = ctx.createGain(); env(g, t0, 0.002, 0.14, 0.3 * vol);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.16);
  } else if (name === 'hurt') {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.18);
    const g = ctx.createGain(); env(g, t0, 0.004, 0.2, 0.3 * vol);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.22);
  } else if (name === 'boom') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.9);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t0);
    f.frequency.exponentialRampToValueAtTime(60, t0 + 0.8);
    const g = ctx.createGain(); env(g, t0, 0.004, 0.85, 0.9 * vol);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 0.95);
  } else if (name === 'flash') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.5);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000;
    const g = ctx.createGain(); env(g, t0, 0.001, 0.45, 0.5 * vol);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 0.5);
  } else if (name === 'plant' || name === 'defuse' || name === 'beep') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = name === 'beep' ? 1200 : 700;
    const g = ctx.createGain(); env(g, t0, 0.001, 0.09, 0.2 * vol);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.1);
  } else if (name === 'buy') {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(660, t0);
    o.frequency.setValueAtTime(990, t0 + 0.07);
    const g = ctx.createGain(); env(g, t0, 0.002, 0.12, 0.2 * vol);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.15);
  } else if (name === 'step') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.05);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); env(g, t0, 0.001, 0.045, 0.07 * vol);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + 0.06);
  } else if (name === 'roundwin') {
    [523, 659, 784, 1046].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const g = ctx.createGain(); env(g, t0 + i * 0.09, 0.003, 0.16, 0.22 * vol);
      o.connect(g); g.connect(master); o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.2);
    });
  } else if (name === 'roundlose') {
    [392, 330, 262, 196].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const g = ctx.createGain(); env(g, t0 + i * 0.1, 0.003, 0.18, 0.2 * vol);
      o.connect(g); g.connect(master); o.start(t0 + i * 0.1); o.stop(t0 + i * 0.1 + 0.22);
    });
  }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
