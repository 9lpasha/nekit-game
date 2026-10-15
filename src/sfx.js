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
      // Звуки кат-сцен
      case 'cutstart': [262, 330, 392].forEach((f, i) => tone(f, 0.5, 'triangle', 0.05, 0, i * 0.25)); break;
      case 'title': [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)); break;
      case 'rumble': tone(45, 1.2, 'sawtooth', 0.08, 0.8); noise(1.0, 0.05); break;
      case 'bosstitle': tone(98, 0.25, 'square', 0.08); tone(147, 0.4, 'square', 0.08, 0, 0.2); break;
      case 'stone': tone(70, 0.15, 'square', 0.09, 0.6); noise(0.12, 0.08); break;
      case 'ignite': tone(400, 0.4, 'sawtooth', 0.05, 2); break;
      case 'engine': tone(90, 1.8, 'sawtooth', 0.06, 1.6); break;
      case 'drift': noise(0.6, 0.1); tone(600, 0.4, 'square', 0.03, 0.5); break;
      case 'bump': tone(80, 0.2, 'square', 0.09, 0.6); vibrate(80); break;
      case 'jump': tone(300, 0.15, 'square', 0.04, 2); break;
      case 'pop': tone(500, 0.08, 'square', 0.04, 1.5); break;
      case 'fire': noise(0.8, 0.04); break;
      case 'click': tone(1200, 0.03, 'square', 0.04); tone(900, 0.03, 'square', 0.04, 0, 0.06); break;
      case 'rage': tone(80, 0.6, 'sawtooth', 0.12, 2.5); noise(0.4, 0.1); vibrate(200); break;
      case 'rthrow': noise(0.15, 0.05); tone(500, 0.2, 'triangle', 0.04, 0.4); break;
      case 'rhit': tone(1400, 0.06, 'square', 0.04, 0.6); break;
      case 'rcatch': tone(180, 0.1, 'square', 0.07, 0.5); vibrate(40); break;
      case 'alert': tone(900, 0.05, 'square', 0.04); tone(1200, 0.06, 'square', 0.04, 0, 0.06); break;
      case 'sneak': tone(330, 0.15, 'sine', 0.03); break;
      case 'plane': tone(70, 2.2, 'sawtooth', 0.04, 1.3); break;
      case 'drop': tone(600, 0.3, 'triangle', 0.04, 0.5); break;
      case 'droploot': [523, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.05, 0, i * 0.08)); vibrate(120); break;
      case 'droplost': tone(220, 0.4, 'triangle', 0.05, 0.6); break;
      case 'gull': tone(1300, 0.12, 'triangle', 0.03, 0.7); tone(1500, 0.1, 'triangle', 0.025, 0.7, 0.14); break;
      case 'tick': tone(1000, 0.03, 'square', 0.04); break;
      case 'shoot': tone(2200, 0.4, 'sine', 0.03, 0.3); break;
      case 'movie': [523, 659, 523, 784].forEach((f, i) => tone(f, 0.1, 'triangle', 0.04, 0, i * 0.15)); break;
      case 'boss': [110, 98, 82].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.09, 0.8, i * 0.35)); vibrate(200); break;
      case 'bossdown': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'square', 0.06, 0, i * 0.1)); vibrate(150); break;
      case 'slam': tone(80, 0.3, 'sawtooth', 0.1, 0.5); noise(0.3, 0.09); vibrate(100); break;
      case 'roar': tone(140, 0.6, 'sawtooth', 0.07, 0.5); break;
      case 'stomp': tone(55, 0.6, 'square', 0.12, 0.5); noise(0.5, 0.1); vibrate(250); break;
      case 'nitro': tone(200, 0.6, 'sawtooth', 0.08, 4); noise(0.6, 0.08); vibrate(120); break;
      case 'nitrowait': tone(880, 0.08, 'square', 0.04); break;
      case 'rocksmash': noise(0.3, 0.1); tone(300, 0.15, 'square', 0.05, 0.5); break;
      case 'chase': [523, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'square', 0.05, 0, i * 0.12)); break;
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
