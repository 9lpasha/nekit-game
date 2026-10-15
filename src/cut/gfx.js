// Пиксельная графика для кат-сцен.
// Всё рисуется в буфер низкого разрешения (PPU пикселей на единицу сцены) и потом растягивается
// без сглаживания — получается честный пиксель-арт. Камера (наезд, сдвиг, тряска) применяется
// к координатам до привязки к пиксельной сетке, поэтому картинка остаётся чёткой при любом зуме.

export const PPU = 2;
export const PX = 1 / PPU;

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
export const easeOut = (v) => 1 - (1 - clamp01(v)) ** 3;
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const snap = (v) => Math.round(v * PPU) / PPU;
// Выскакивание с пружинкой: 0 → 1 с небольшим перелётом
export const pop = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : easeOut(k) * (1 + Math.sin(k * Math.PI) * 0.18));

// ---------- Цвет ----------
function parse(col) {
  if (col[0] === '#') { const n = parseInt(col.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = col.match(/[\d.]+/g);
  return m ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}
export function mix(a, b, k) {
  const A = parse(a), B = parse(b);
  return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`;
}
export const shade = (col, k) => (k >= 0 ? mix(col, '#ffffff', k) : mix(col, '#000000', -k));
export function gradAt(stops, k) {
  for (let i = 1; i < stops.length; i++) {
    if (k <= stops[i][0]) {
      const [p0, c0] = stops[i - 1], [p1, c1] = stops[i];
      return mix(c0, c1, (k - p0) / (p1 - p0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}

// Тонировка (ночь): применяется ко всему, кроме того, что светится само.
let TINT = null;
const tintCache = new Map();
export function setTint(fn) { TINT = fn; tintCache.clear(); }
export function noTint(fn) { const prev = TINT; TINT = null; fn(); TINT = prev; }
function paint(c, col) {
  if (TINT && col[0] !== 'h' && col[3] !== 'a') {
    let v = tintCache.get(col);
    if (!v) { v = TINT(col); tintCache.set(col, v); }
    c.fillStyle = v;
  } else c.fillStyle = col;
}

// ---------- Буфер и камера ----------
let BW = 100, BH = 150;
export function setBuffer(w, h) { BW = w; BH = h; }
export const bufferWidth = () => BW;

const CAM = { z: 1, fx: 0, fy: 0, cx: 0, cy: 0 };
// Точка сцены (fx, fy) попадает в центр кадра, z — увеличение, shake — дрожь.
export function setCam(S, z, fx, fy, shake = 0) {
  CAM.z = z; CAM.fx = fx; CAM.fy = fy;
  CAM.cx = S.X0 + 50 + (shake ? (Math.random() - 0.5) * shake : 0);
  CAM.cy = S.H * 0.5 + (shake ? (Math.random() - 0.5) * shake : 0);
}
export const camZoom = () => CAM.z;
export const TX = (x) => (x - CAM.fx) * CAM.z + CAM.cx;
export const TY = (y) => (y - CAM.fy) * CAM.z + CAM.cy;

// ---------- Примитивы (координаты сцены) ----------
export function R(c, x, y, w, h, col) {
  if (!(w > 0 && h > 0)) return;
  const x0 = snap(TX(x)), y0 = snap(TY(y));
  const x1 = Math.max(snap(TX(x + w)), x0 + PX), y1 = Math.max(snap(TY(y + h)), y0 + PX);
  if (x1 < 0 || y1 < 0 || x0 > BW || y0 > BH) return;
  paint(c, col);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// Один пиксель буфера — для звёзд, искр, брызг
export function P(c, x, y, col) {
  paint(c, col);
  c.fillRect(snap(TX(x)), snap(TY(y)), PX, PX);
}

// Полоса на всю ширину буфера (небо, море)
export function row(c, y, h, col) {
  const y0 = snap(TY(y)), y1 = Math.max(snap(TY(y + h)), y0 + PX);
  paint(c, col);
  c.fillRect(0, y0, BW, y1 - y0);
}

// Овал построчно — пиксельные края. half: -1 верхняя половина, 1 нижняя.
export function oval(c, cx, cy, rx, ry, col, half = 0) {
  const X = TX(cx), Y = TY(cy), RX = rx * CAM.z, RY = ry * CAM.z;
  if (RX <= 0 || RY <= 0) return;
  paint(c, col);
  for (let yy = snap(Y - RY); yy < Y + RY; yy += PX) {
    const mid = yy + PX / 2;
    if (half < 0 && mid > Y) break;
    if (half > 0 && mid < Y) continue;
    const d = (mid - Y) / RY;
    if (d < -1 || d > 1) continue;
    const hw = RX * Math.sqrt(1 - d * d);
    const x0 = snap(X - hw), x1 = snap(X + hw);
    if (x1 > x0) c.fillRect(x0, yy, x1 - x0, PX);
  }
}
export const disc = (c, x, y, r, col, half) => oval(c, x, y, r, r, col, half);

// Мягкое свечение из нескольких полупрозрачных кругов
export function glow(c, x, y, r, col, a) {
  const ga = c.globalAlpha;
  for (let i = 0; i < 4; i++) { c.globalAlpha = ga * a * 0.22; disc(c, x, y, r * (1 - i * 0.2), col); }
  c.globalAlpha = ga;
}

// Пиксельная линия (th — толщина в единицах сцены)
export function line(c, x0, y0, x1, y1, col, th = 0) {
  const X0 = TX(x0), Y0 = TY(y0), X1 = TX(x1), Y1 = TY(y1);
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) / PX));
  const s = th > 0 ? Math.max(PX, snap(th * CAM.z)) : PX;
  paint(c, col);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    c.fillRect(snap(lerp(X0, X1, k) - s / 2 + PX / 2), snap(lerp(Y0, Y1, k) - s / 2 + PX / 2), s, s);
  }
}

// Фигура по строкам: prof(y) → [левый x, правый x]. col может быть функцией от y.
export function spans(c, y0, y1, prof, col) {
  const fn = typeof col === 'function';
  if (!fn) paint(c, col);
  for (let yy = snap(TY(y0)); yy < TY(y1); yy += PX) {
    const sy = (yy + PX / 2 - CAM.cy) / CAM.z + CAM.fy;
    const pr = prof(sy);
    if (!pr) continue;
    const x0 = snap(TX(pr[0])), x1 = snap(TX(pr[1]));
    if (x1 <= x0) continue;
    if (fn) paint(c, col(sy));
    c.fillRect(x0, yy, x1 - x0, PX);
  }
}

// Ломаная обычной обводкой canvas (молнии, лучи) — с переводом через камеру
export function strokePts(c, pts, col, w, a) {
  const ga = c.globalAlpha;
  c.globalAlpha = ga * a;
  c.strokeStyle = col;
  c.lineWidth = w * CAM.z;
  c.lineJoin = 'miter';
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(TX(x), TY(y)) : c.moveTo(TX(x), TY(y))));
  c.stroke();
  c.globalAlpha = ga;
}

export function fillPoly(c, pts, col, a = 1) {
  const ga = c.globalAlpha;
  c.globalAlpha = ga * a;
  paint(c, col);
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(TX(x), TY(y)) : c.moveTo(TX(x), TY(y))));
  c.closePath();
  c.fill();
  c.globalAlpha = ga;
}

export function clipRect(c, x, y, w, h) {
  c.beginPath();
  c.rect(TX(x), TY(y), w * CAM.z, h * CAM.z);
  c.clip();
}
export function clipAbove(c, y) {
  c.beginPath();
  c.rect(0, 0, BW, snap(TY(y)));
  c.clip();
}

// Спрайт из прямоугольников в «пикселях» q: сначала обводка всех частей, потом заливка.
export function sprite(c, x, y, q, parts, ol, flip = false) {
  const fx = (px, pw) => (flip ? -(px + pw) : px);
  if (ol) for (const [px, py, pw, ph] of parts) R(c, x + (fx(px, pw) - 1) * q, y + (py - 1) * q, (pw + 2) * q, (ph + 2) * q, ol);
  for (const [px, py, pw, ph, col] of parts) R(c, x + fx(px, pw) * q, y + py * q, pw * q, ph * q, col);
}

// Блок с обводкой, бликом сверху и тенью снизу/справа
export function box(c, x, y, w, h, base, light, dark, ol) {
  if (ol) R(c, x - PX, y - PX, w + 2 * PX, h + 2 * PX, ol);
  R(c, x, y, w, h, base);
  if (light) R(c, x, y, w, PX * 2, light);
  if (dark) { R(c, x, y + h - PX * 2, w, PX * 2, dark); R(c, x + w - PX, y, PX, h, dark); }
}

// ---------- Небо и море ----------
export function sky(S, stops) {
  const { c, hor } = S;
  const bands = 16;
  row(c, -S.H * 2, S.H * 2 + PX, stops[0][1]);
  for (let i = 0; i < bands; i++) row(c, (hor * i) / bands, hor / bands + PX, gradAt(stops, (i + 0.5) / bands));
  // Дизеринг на стыках полос — ретро-переход вместо ступенек
  for (let i = 1; i < bands; i++) {
    const y0 = snap(TY((hor * i) / bands)) - PX;
    paint(c, gradAt(stops, (i + 0.5) / bands));
    for (let x = (i % 2) * PX; x < BW; x += 2 * PX) c.fillRect(x, y0, PX, PX);
  }
}

export function sea(S, far, near, crest, trough, speed = 1, xr = [-70, 270]) {
  const { c, hor, H, t } = S;
  const bands = 12, depth = H - hor + 60;
  for (let i = 0; i < bands; i++) {
    const k0 = i / bands, k1 = (i + 1) / bands;
    row(c, hor + depth * k0 * k0, depth * (k1 * k1 - k0 * k0) + PX, mix(far, near, (i + 0.5) / bands));
  }
  row(c, hor, PX, crest);
  // Гребни волн: дальше — мельче и медленнее (перспектива)
  for (let r = 0; r < 24; r++) {
    const k = (r + 0.5) / 24;
    const y = hor + 1 + k * k * (H - hor + 10);
    const len = 1.2 + k * 9, gap = 5 + k * 15, th = k > 0.55 ? 2 * PX : PX;
    const scroll = t * speed * (1.5 + k * 12) + hash(r) * 40;
    const i0 = Math.floor((xr[0] - scroll) / gap) - 1, i1 = Math.floor((xr[1] - scroll) / gap) + 1;
    for (let i = i0; i <= i1; i++) {
      const x = i * gap + scroll + (hash(r * 31 + i * 7) - 0.5) * gap * 0.5;
      R(c, x, y, len, th, crest);
      R(c, x + len * 0.25, y + th, len * 0.75, PX, trough);
    }
  }
}

// Дорожка света на воде от солнца или луны
export function reflection(S, x, col, width, a) {
  const { c, hor, H, t } = S;
  const ga = c.globalAlpha;
  for (let r = 0; r < 28; r++) {
    const k = r / 28;
    const y = hor + 0.5 + k * k * (H - hor) * 0.85;
    const w = width * (0.25 + k * 1.3) * (0.55 + 0.45 * Math.sin(t * 5 + r * 1.9));
    c.globalAlpha = ga * a * (1 - k * 0.7);
    R(c, x - w / 2 + Math.sin(t * 2.3 + r) * (0.5 + k), y, w, k > 0.5 ? 2 * PX : PX, col);
  }
  c.globalAlpha = ga;
}

export function sunDisc(S, x, y, r, core, rim, rays = 0) {
  const { c, t } = S;
  noTint(() => {
    glow(c, x, y, r * 3.2, rim, 0.55);
    if (rays > 0) {
      const ga = c.globalAlpha;
      c.globalAlpha = ga * rays;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 0.15;
        const l = r * (2 + 0.4 * Math.sin(t * 2 + i));
        line(c, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, x + Math.cos(a) * l, y + Math.sin(a) * l, core);
      }
      c.globalAlpha = ga;
    }
    disc(c, x, y, r, rim);
    disc(c, x - r * 0.12, y - r * 0.12, r * 0.82, core);
  });
}

export function moon(S, x, y, r) {
  const { c } = S;
  noTint(() => {
    glow(c, x, y, r * 3, '#9fb0ff', 0.45);
    disc(c, x, y, r, '#d8d4b8');
    disc(c, x - r * 0.12, y - r * 0.1, r * 0.86, '#f6f3dc');
    disc(c, x - r * 0.35, y + r * 0.2, r * 0.2, '#d8d4b8');
    disc(c, x + r * 0.25, y - r * 0.3, r * 0.14, '#d8d4b8');
    disc(c, x + r * 0.15, y + r * 0.42, r * 0.1, '#d8d4b8');
  });
}

export function stars(S, a, par = 0) {
  if (a <= 0) return;
  const { c, hor, t } = S;
  noTint(() => {
    const ga = c.globalAlpha;
    for (let i = 0; i < 110; i++) {
      const x = -60 + hash(i) * 330 + par, y = -10 + hash(i + 99) * (hor * 0.92 + 10);
      c.globalAlpha = ga * a * (0.45 + 0.55 * Math.sin(t * (1.5 + hash(i + 7) * 3) + i));
      P(c, x, y, '#ffffff');
      if (hash(i + 3) > 0.9) {
        P(c, x - PX, y, '#9fb8ff'); P(c, x + PX, y, '#9fb8ff'); P(c, x, y - PX, '#9fb8ff'); P(c, x, y + PX, '#9fb8ff');
      }
    }
    c.globalAlpha = ga;
  });
}

export function cloud(S, x, y, w, base, light, dark) {
  const { c } = S;
  const puffs = [[0.14, 0.02, 0.15], [0.33, -0.1, 0.2], [0.55, -0.05, 0.22], [0.77, 0.03, 0.15], [0.45, 0.04, 0.2]];
  for (const [px, py, r] of puffs) oval(c, x + px * w, y + py * w + w * 0.035, r * w, r * w * 0.75, dark);
  for (const [px, py, r] of puffs) oval(c, x + px * w, y + py * w, r * w, r * w * 0.75, base);
  for (const [px, py, r] of puffs) oval(c, x + px * w - r * w * 0.22, y + py * w - r * w * 0.3, r * w * 0.5, r * w * 0.3, light);
}

export function cloudLayer(S, n, y0, y1, wMin, wMax, speed, pal, seed, par = 0) {
  const span = 360;
  for (let i = 0; i < n; i++) {
    const w = lerp(wMin, wMax, hash(seed + i));
    const x = -90 + ((hash(seed + i + 20) * span + S.t * speed) % span) + par;
    cloud(S, x, lerp(y0, y1, hash(seed + i + 40)), w, pal[0], pal[1], pal[2]);
  }
}

export function rain(S, n, wind, a) {
  const { c, H, t } = S;
  const ga = c.globalAlpha;
  c.globalAlpha = ga * a;
  const x0 = S.xmin - 20, span = S.xmax - S.xmin + 40;
  for (let i = 0; i < n; i++) {
    const sp = 80 + hash(i + 5) * 50;
    const y = ((hash(i + 50) * (H + 30) + t * sp) % (H + 30)) - 15;
    const x = x0 + ((hash(i) * span + t * sp * wind + y * wind) % span);
    for (let j = 0; j < 4; j++) P(c, x + j * wind * PX, y + j * PX * 2, '#9fb8d8');
  }
  c.globalAlpha = ga;
}

// Ветвистая молния со свечением
export function bolt(S, x0, y0, x1, y1, seed, a) {
  if (a <= 0) return;
  const { c } = S;
  const n = 10, pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push([lerp(x0, x1, k) + (i > 0 && i < n ? (hash(seed + i) - 0.5) * 10 : 0), lerp(y0, y1, k)]);
  }
  strokePts(c, pts, '#6fa8ff', 4, a * 0.25);
  strokePts(c, pts, '#bcd8ff', 1.8, a * 0.7);
  strokePts(c, pts, '#ffffff', 0.7, a);
  for (const b of [3, 5, 7]) {
    const [bx, by] = pts[b];
    strokePts(c, [[bx, by], [bx + (hash(seed + b * 7) - 0.5) * 12, by + 5], [bx + (hash(seed + b * 9) - 0.5) * 18, by + 10]], '#bcd8ff', 0.8, a * 0.75);
  }
}

export function gull(S, x, y, s, phase) {
  const { c, t } = S;
  const up = Math.sin(t * 9 + phase * 2.1) > 0;
  const q = PX * s;
  R(c, x - q, y, q * 2, q, '#f4f4ee');
  for (let i = 1; i <= 3; i++) {
    const dy = up ? -i * q * 0.8 : (i - 1) * q * 0.6;
    const col = i === 3 ? '#3a3e46' : '#f4f4ee';
    R(c, x - q - i * q, y + dy, q, q, col);
    R(c, x + q + (i - 1) * q, y + dy, q, q, col);
  }
}

export function bubbles(S, x, y, a, spread = 16) {
  if (a <= 0) return;
  const { c, t } = S;
  const ga = c.globalAlpha;
  for (let i = 0; i < 16; i++) {
    const f = (t * 1.6 + hash(i)) % 1;
    c.globalAlpha = ga * a * (1 - f);
    const bx = x + (hash(i + 5) - 0.5) * spread * 2, by = y - f * 6;
    R(c, bx, by, 1, 1, '#cfeaff');
    P(c, bx, by, '#ffffff');
  }
  c.globalAlpha = ga;
}

// Клубы пара поднимаются и тают
export function steam(S, x, y, spread, amount, rise = 40, col = '#ececec') {
  if (amount <= 0) return;
  const { c, t } = S;
  const ga = c.globalAlpha;
  for (let i = 0; i < 20; i++) {
    const f = (t * 0.55 + hash(i * 3 + 1)) % 1;
    const px = x + (hash(i + 7) - 0.5) * spread * 2 + Math.sin(t * 1.3 + i) * 2;
    const py = y - f * rise;
    const r = 2.5 + f * 7;
    c.globalAlpha = ga * Math.min(0.42, amount * 0.42) * (1 - f) * Math.min(1, f * 5);
    disc(c, px, py, r, col);
    disc(c, px - 1, py - 1.2, r * 0.55, '#ffffff');
  }
  c.globalAlpha = ga;
}

// Вспышки: возвращает силу вспышки (0..1), если t попало в одно из окон
export function flashAt(t, times, dur) {
  let a = 0;
  for (const tt of times) if (t > tt && t < tt + dur) a = Math.max(a, 1 - (t - tt) / dur);
  return a;
}
