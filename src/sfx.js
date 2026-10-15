// Простые 8-битные звуки на WebAudio — без файлов.
let ac = null;
let noiseBuf = null;

function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.08) {
  if (!ac) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.value = 1200;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch {} };

export const sfx = {
  init() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      ac.resume?.();
    } catch {}
  },
  nope() { tone(160, 0.12, 'square', 0.04, 0.8); },
  swing() { tone(260, 0.07, 'triangle', 0.025, 2.2); },
  event(ev) {
    switch (ev.type) {
      case 'hit':
        if (ev.perfect) { tone(1046, 0.09, 'square', 0.06); tone(1568, 0.1, 'square', 0.04, 0, 0.05); }
        else tone(620 + ev.charge * 90, 0.08, 'square', 0.06);
        break;
      case 'boat':
        if (ev.drop) { noise(0.25, 0.06); break; }
        tone(120, 0.25, 'sawtooth', 0.09, 0.5); noise(0.3, 0.08); vibrate(ev.big ? 140 : 80);
        break;
      case 'patch': [330, 392, 494].forEach((f, i) => tone(f, 0.06, 'square', 0.04, 0, i * 0.06)); break;
      case 'loot': tone(784, 0.07, 'square', 0.04); tone(1046, 0.09, 'square', 0.04, 0, 0.07); break;
      case 'splash': noise(0.25, 0.05); break;
      case 'card': tone(523, 0.08, 'square', 0.05); tone(784, 0.12, 'square', 0.05, 0, 0.07); break;
      case 'block': tone(1200, 0.1, 'triangle', 0.05, 0.6); break;
      case 'tshot': tone(900, 0.04, 'square', 0.015, 0.6); break;
      case 'chest': [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.1, 'square', 0.045, 0, i * 0.07)); break;
      case 'rock': tone(70, 0.35, 'sawtooth', 0.12, 0.5); noise(0.35, 0.1); vibrate(160); break;
      case 'bolt': noise(0.6, 0.14); tone(60, 0.5, 'square', 0.08, 0.4); vibrate(120); break;
      case 'whirl': tone(300, 0.6, 'sine', 0.05, 0.4); break;
      case 'stormnear': tone(110, 0.4, 'triangle', 0.06, 0.8); tone(98, 0.5, 'triangle', 0.06, 0.8, 0.35); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'square', 0.05, 0, i * 0.13)); break;
      case 'ehit': tone(300, 0.06, 'square', 0.04, 0.7); break;
      case 'kill': tone(520, 0.12, 'square', 0.05, 1.8); break;
      case 'smash': tone(90, 0.5, 'sawtooth', 0.12, 0.3); noise(0.4, 0.1); vibrate(150); break;
      case 'throw': tone(180, 0.06, 'triangle', 0.02, 1.5); break;
      case 'wave': tone(392, 0.12, 'square', 0.04); tone(523, 0.18, 'square', 0.04, 0, 0.12); break;
      case 'clear': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.04, 0, i * 0.09)); break;
      case 'over': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, 0, i * 0.18)); vibrate(300); break;
    }
  },
};
