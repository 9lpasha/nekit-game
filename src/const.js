// Общие константы мира. Все координаты — в «блоках» (1 блок = 1 доска лодки).
export const WORLD_W = 12;
export const WORLD_H = 20;

// Лодка: 6×10 блоков, нос смотрит вверх.
export const BOAT = { x: 3, y: 7, w: 6, h: 10 };

export const PLAYER_R = 0.38;
export const PLAYER_SPEED = 4.2;

export const REACH = 1.35; // дальность удара ракеткой
export const SWING_ACTIVE = 0.16; // сколько секунд ракетка «бьёт» после свайпа
export const SWING_CD = 0.28;
export const PERFECT_WINDOW = 0.07;

export const MAX_HP = 10;
export const SMASH_CHARGE = 5; // пятое касание в розыгрыше — смэш

export const TEAM_COLORS = { h: '#ff8a3d', g: '#3db4ff' };
export const CHARGE_COLORS = ['#9aa0a6', '#4da6ff', '#4dffd2', '#ffe14d', '#ff9a3d', '#ff3d5a'];

export const START_POS = { h: { x: 4.6, y: 13.5 }, g: { x: 7.4, y: 13.5 } };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// Строки 0–1 — сужающийся нос лодки.
export function isBoatTile(col, row) {
  if (col < 0 || col >= BOAT.w || row < 0 || row >= BOAT.h) return false;
  if (row === 0) return col === 2 || col === 3;
  if (row === 1) return col >= 1 && col <= 4;
  return true;
}

export function pointInBoat(x, y) {
  return isBoatTile(Math.floor(x - BOAT.x), Math.floor(y - BOAT.y));
}

// Где игрок может стоять (без носа, с отступом от бортов).
export function clampToDeck(p) {
  const m = PLAYER_R + 0.12;
  p.x = clamp(p.x, BOAT.x + m, BOAT.x + BOAT.w - m);
  p.y = clamp(p.y, BOAT.y + 2 + m, BOAT.y + BOAT.h - m);
}

// Положение снаряда в момент t: прямая от (x0,y0) к (tx,ty) + высота дуги.
export function shotPos(s, t) {
  const p = s.dur > 0 ? clamp(t / s.dur, 0, 1) : 1;
  return {
    x: lerp(s.x0, s.tx, p),
    y: lerp(s.y0, s.ty, p),
    z: s.arc * 4 * p * (1 - p),
    p,
  };
}
