// Кино на экране проектора: отсчёт плёнки и бегущий бронированный титан, который проламывает стену.
import { TEAM_COLORS } from '../const.js';
import {
  PX, R, P, oval, disc, glow, line, clipRect, noTint, setCam, hash, lerp, seg, gradAt, TX, TY, camZoom,
} from './gfx.js';

const DIGITS = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
};
export function digit(c, d, x, y, s, col) {
  (DIGITS[d] || []).forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') R(c, x + i * s, y + j * s, s, s, col); });
}

// Отсчёт в начале плёнки: круг, перекрестие, бегущий сектор и цифра
export function leader(S, x, y, w, h, lt) {
  const { c } = S;
  noTint(() => {
    c.save();
    clipRect(c, x, y, w, h);
    R(c, x, y, w, h, '#b9b2a2');
    const cx = x + w / 2, cy = y + h / 2, r = h * 0.42;
    const ang = ((lt % 0.5) / 0.5) * Math.PI * 2 - Math.PI / 2;
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.35;
    c.fillStyle = '#5a5448';
    c.beginPath();
    c.moveTo(TX(cx), TY(cy));
    c.arc(TX(cx), TY(cy), r * camZoom(), -Math.PI / 2, ang);
    c.closePath();
    c.fill();
    c.globalAlpha = ga;
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      P(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, '#2a2620');
      P(c, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, '#2a2620');
    }
    R(c, x, cy, w, PX, '#2a2620');
    R(c, cx, y, PX, h, '#2a2620');
    digit(c, Math.max(1, 3 - Math.floor(lt / 0.5)), cx - 2.4, cy - 4, 1.6, '#141210');
    c.globalAlpha = ga * 0.4;
    for (let i = 0; i < 3; i++) R(c, x + hash(i + Math.floor(lt * 12)) * w, y, PX, h, '#ffffff');
    c.globalAlpha = ga;
    c.restore();
  });
}

function wallSeg(c, wx, top, gy) {
  R(c, wx - PX, top - PX, 9 + 2 * PX, gy - top + PX, '#3a3428');
  R(c, wx, top, 9, gy - top, '#b4ac98');
  for (let yy = top; yy < gy; yy += 1.4) {
    R(c, wx, yy, 9, PX, '#7a7262');
    const off = (Math.round((yy - top) / 1.4) % 2) * 1.5;
    for (let xx = wx + off; xx < wx + 9; xx += 3) R(c, xx, yy, PX, 1.4, '#7a7262');
  }
  for (let i = 0; i < 4; i++) R(c, wx + i * 2.4, top - 1.2, 1.4, 1.2, '#b4ac98');
  R(c, wx, top, 1, gy - top, '#8a8270');
}

function wallDebris(S, x0, y0, dt, gy) {
  const { c } = S;
  for (let i = 0; i < 18; i++) {
    const a = -0.15 - hash(i) * 1.5, v = 7 + hash(i + 1) * 12;
    const px = x0 + Math.cos(a) * v * dt + dt * 3;
    const py = y0 + Math.sin(a) * v * dt + 14 * dt * dt + (hash(i + 2) - 0.5) * 5;
    if (py > gy) continue;
    const sz = 0.6 + hash(i + 3) * 1.4;
    R(c, px - PX, py - PX, sz + 2 * PX, sz + 2 * PX, '#3a3428');
    R(c, px, py, sz, sz, i % 2 ? '#b4ac98' : '#9a9282');
  }
  const ga = c.globalAlpha;
  for (let i = 0; i < 8; i++) {
    c.globalAlpha = ga * 0.5 * Math.max(0, 1 - dt / 1.6);
    disc(c, x0 + (hash(i + 9) - 0.3) * 8 + dt * 3, gy - 1 - hash(i + 5) * 6 - dt * 2, 1.5 + dt * 3, '#d8cdb4');
  }
  c.globalAlpha = ga;
}

// Бронированный титан на бегу (лицом вправо). foot — линия земли, s — масштаб.
function armoredTitan(S, cx, foot, s, phase, charge) {
  const { c } = S;
  const OLT = '#3a2a10', PL = '#e2bf62', PLL = '#f6dc8a', PLD = '#9a7430', HAIR = '#f8e6a0', HAIRD = '#d8c070';
  const bob = Math.abs(Math.sin(phase)) * 0.45 * s;
  const lean = charge ? 0.6 : 0.28;
  const hip = [cx, foot - 7 * s - bob];
  const sh = [hip[0] + Math.sin(lean) * 5 * s, hip[1] - Math.cos(lean) * 5 * s];
  const head = [sh[0] + Math.sin(lean) * 2.6 * s + 0.4 * s, sh[1] - 2.2 * s];
  const limb = (a, b, w, col) => { line(c, a[0], a[1], b[0], b[1], OLT, w + 0.8 * s); line(c, a[0], a[1], b[0], b[1], col, w); };
  const leg = (off, col, colD) => {
    const ang = Math.sin(phase + off) * 0.8;
    const knee = [hip[0] + Math.sin(ang) * 3.4 * s, hip[1] + Math.cos(ang) * 3.4 * s];
    const fa = ang - (Math.sin(phase + off + 1.3) > 0 ? 1.2 : 0.3);
    const ft = [knee[0] + Math.sin(fa) * 3.6 * s, knee[1] + Math.cos(fa) * 3.6 * s];
    limb(hip, knee, 1.6 * s, col);
    limb(knee, ft, 1.3 * s, col);
    disc(c, knee[0], knee[1], 0.9 * s, colD);
    R(c, ft[0] - 0.4 * s, ft[1] - 0.5 * s, 1.8 * s, 0.9 * s, colD);
  };
  const arm = (off, col) => {
    const ang = charge ? 1.3 : -Math.sin(phase + off) * 0.9;
    const el = [sh[0] + Math.sin(ang) * 2.8 * s, sh[1] + Math.cos(ang) * 2.8 * s];
    const ha = ang + 0.9;
    const hd = [el[0] + Math.sin(ha) * 2.6 * s, el[1] + Math.cos(ha) * 2.6 * s];
    limb(sh, el, 1.2 * s, col);
    limb(el, hd, 1.1 * s, col);
    disc(c, hd[0], hd[1], 0.7 * s, col);
  };
  leg(Math.PI, PLD, '#6a5020');
  arm(0, PLD);
  // Туловище в пластинах брони
  limb(hip, sh, 3.4 * s, PL);
  for (let i = 1; i < 5; i++) {
    const k = i / 5;
    R(c, lerp(hip[0], sh[0], k) - 1.5 * s, lerp(hip[1], sh[1], k), 3 * s, PX, PLD);
  }
  disc(c, sh[0] + 0.3 * s, sh[1] + 1.2 * s, 1.5 * s, PLL);
  leg(0, PL, PLD);
  // Голова: бронированное лицо, светлые волосы назад
  for (let i = 0; i < 4; i++) {
    const wv = Math.sin(phase * 0.7 + i) * 0.4 * s;
    line(c, head[0] - 0.6 * s, head[1] - 1.4 * s + i * 0.5 * s, head[0] - 2.8 * s - i * 0.3 * s, head[1] - 1.1 * s + i * 0.6 * s + wv, i % 2 ? HAIRD : HAIR, 0.5 * s);
  }
  R(c, head[0] - 1.4 * s - PX, head[1] - 1.5 * s - PX, 2.8 * s + 2 * PX, 3 * s + 2 * PX, OLT);
  R(c, head[0] - 1.4 * s, head[1] - 1.5 * s, 2.8 * s, 3 * s, PL);
  R(c, head[0] - 1.4 * s, head[1] - 1.5 * s, 2.8 * s, 0.6 * s, HAIR);
  R(c, head[0] + 0.2 * s, head[1] + 0.5 * s, 1.2 * s, PX, PLD);
  R(c, head[0] - 0.6 * s, head[1] - 0.2 * s, PX, 1.4 * s, PLD);
  noTint(() => {
    glow(c, head[0] + 0.7 * s, head[1] - 0.3 * s, 1.2 * s, '#fff6c0', 0.6);
    R(c, head[0] + 0.4 * s, head[1] - 0.5 * s, 0.8 * s, 0.4 * s, '#fffbe0');
  });
  arm(Math.PI, PL);
  // Пар из суставов
  const ga = c.globalAlpha;
  for (let i = 0; i < 3; i++) {
    const f = (phase * 0.15 + i / 3) % 1;
    c.globalAlpha = ga * 0.35 * (1 - f);
    disc(c, sh[0] - f * 3 * s, sh[1] - f * 2 * s, (0.4 + f) * s, '#f0f0f0');
  }
  c.globalAlpha = ga;
}

// Само кино (mt — время фильма). Фон бежит, титан стоит на месте кадра.
export function movie(S, x, y, w, h, mt) {
  const { c } = S;
  noTint(() => {
    c.save();
    clipRect(c, x, y, w, h);
    const hz = y + h * 0.62, gy = y + h * 0.84;
    const sk = [[0, '#f6a868'], [0.6, '#f0c088'], [1, '#f8dcb0']];
    for (let i = 0; i < 6; i++) R(c, x, y + ((hz - y) * i) / 6, w, (hz - y) / 6 + PX, gradAt(sk, (i + 0.5) / 6));
    disc(c, x + w * 0.78, y + h * 0.28, 2, '#fff2c8');
    for (let i = 0; i < w; i += 0.5) {
      const sx = i + mt * 1.2;
      const hh = 2.6 + Math.sin(sx * 0.31) * 1.4 + Math.sin(sx * 0.83) * 0.6;
      R(c, x + i, hz - hh, 0.5, hh, '#b07a80');
    }
    R(c, x, hz, w, h * 0.38, '#7a9a48');
    R(c, x, hz, w, PX, '#a0c060');
    R(c, x, gy, w, h * 0.16, '#6a5a3a');
    for (let i = 0; i < 6; i++) R(c, x + w - ((mt * 14 + i * 5) % (w + 4)), gy + 1.2, 2, PX, '#8a7a5a');
    // Домики проносятся мимо
    for (let j = 0; j < 6; j++) {
      const hx = x + w + 2 - ((mt * 7 + j * 6) % (w + 8));
      const big = j % 3 === 0, bw = big ? 3.4 : 2.6, bh = big ? 3 : 2.2;
      R(c, hx, gy - bh, bw, bh, '#e8dcc4');
      R(c, hx + bw - 0.5, gy - bh, 0.5, bh, '#c4b49a');
      R(c, hx - 0.4, gy - bh - 1, bw + 0.8, 1, '#b4482e');
      R(c, hx, gy - bh - 1.5, bw, 0.6, '#b4482e');
      R(c, hx + 0.6, gy - bh + 0.8, 0.6, 0.6, '#6a8ab0');
      if (big) R(c, hx + 2, gy - bh + 0.8, 0.6, 0.6, '#6a8ab0');
    }
    const tx = x + w * 0.36;
    const shake = mt > 4.2 && mt < 4.8 ? (Math.random() - 0.5) * 0.8 : 0;
    if (mt > 3.0 && mt < 4.2) wallSeg(c, lerp(x + w + 1, tx + 2.2, seg(mt, 3.0, 4.2)), y + h * 0.12, gy);
    // Пыль из-под ног
    const ga = c.globalAlpha;
    for (let i = 0; i < 6; i++) {
      const f = (mt * 2 + i / 6) % 1;
      c.globalAlpha = ga * 0.6 * (1 - f);
      disc(c, tx - 1 - f * 6, gy - 0.4 - f * 1.5, 0.5 + f * 1.2, '#e8d8b8');
    }
    c.globalAlpha = ga;
    armoredTitan(S, tx + shake, gy, h / 21, mt * 9, mt > 3.8 && mt < 4.6);
    if (mt >= 4.2) wallDebris(S, tx + 2.5, gy - 6, mt - 4.2, gy);
    // Зерно плёнки, мерцание, вспышка при ударе
    for (let i = 0; i < 14; i++) {
      c.globalAlpha = ga * 0.3;
      P(c, x + hash(i + Math.floor(mt * 24) * 3) * w, y + hash(i * 7 + Math.floor(mt * 24)) * h, i % 2 ? '#ffffff' : '#000000');
    }
    c.globalAlpha = ga * (0.04 + 0.04 * Math.sin(mt * 37));
    R(c, x, y, w, h, '#000000');
    if (mt >= 4.2 && mt < 4.5) { c.globalAlpha = ga * (1 - (mt - 4.2) / 0.3) * 0.7; R(c, x, y, w, h, '#ffffff'); }
    c.globalAlpha = ga;
    c.restore();
  });
}

// Силуэты зрителей со спины на крупном плане экрана
export function audience(S, a) {
  if (a <= 0) return;
  const { c, H } = S;
  setCam(S, 1, 50, H * 0.5);
  const ga = c.globalAlpha;
  c.globalAlpha = ga * a;
  const keys = S.o.duo ? ['h', 'g'] : ['h'];
  const base = H * 0.885;
  keys.forEach((key, i) => {
    const x = S.o.duo ? 28 + i * 44 : 50;
    oval(c, x, base + 3, 16, 10, '#07080d', -1);
    oval(c, x, base + 2.4, 16, 1.2, TEAM_COLORS[key], -1);
    disc(c, x, base - 10, 7.5, '#07080d');
    if (key === 'h') disc(c, x - 2.5, base - 15.5, 3, '#07080d');
    else R(c, x - 7, base - 15, 14, 3.5, '#07080d');
    noTint(() => {
      for (let k = 0; k < 28; k++) {
        const an = Math.PI * (1.08 + (k / 28) * 0.84);
        P(c, x + Math.cos(an) * 7.6, base - 10 + Math.sin(an) * 7.6, '#f0b878');
      }
    });
  });
  c.globalAlpha = ga;
}
