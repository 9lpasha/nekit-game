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

// Пробоины и вода: лодка тонет, когда воды набирается 100%.
export const LEAK_PER_HOLE = 1.1; // % воды в секунду через одну пробоину
export const BAIL_RATE = 7; // % в секунду, пока стоишь у ведра
export const REPAIR_TIME = 0.7; // секунд стоять на пробоине, чтобы залатать
export const START_PLANKS = 3;
export const WATER_SLOWDOWN = 0.4; // при полной лодке бегаешь на 40% медленнее
export const BUCKET = { x: BOAT.x + BOAT.w / 2, y: BOAT.y + BOAT.h - 0.6, r: 0.75 };
// Доски плывут вдоль бортов — на расстоянии удара ракеткой с палубы.
export const DEBRIS_LANES = [BOAT.x - 0.55, BOAT.x + BOAT.w + 0.55];
// Плавание: штурвал у носа, лодка идёт к острову, сзади догоняет шторм.
export const HELM = { x: BOAT.x + BOAT.w / 2, y: BOAT.y + 2.6, r: 0.6 };
export const BOAT_SPEED = 1.6; // блоков в секунду при пустой лодке
export const STEER_SPEED = 4;
export const ISLAND_DIST = 450; // ~5 минут пути
export const STORM_START_GAP = 26;
// Карты: общий эликсир и общая колода на команду.
export const ELIXIR_MAX = 10;
export const ELIXIR_RATE = 0.5; // в секунду
export const START_ELIXIR = 5;
export const HAND_SIZE = 4;
export const MAX_CARD_LEVEL = 3;
export const START_DECK = ['turret', 'bomb', 'repair', 'gull', 'shield'];
export const CARDS = {
  turret: { name: 'Башенка', icon: '🗼', cost: 3, desc: (l) => `Стреляет по зомби ${10 + 5 * l} с` },
  shield: { name: 'Щит', icon: '🛡️', cost: 4, desc: (l) => `Купол над лодкой ${3 + 2 * l} с` },
  bomb:   { name: 'Бомба', icon: '💣', cost: 5, desc: (l) => `Взрыв по толпе, урон ${2 + l}` },
  freeze: { name: 'Заморозка', icon: '❄️', cost: 3, desc: (l) => `Зомби замирают на ${2 + 1.5 * l} с` },
  repair: { name: 'Ремонт', icon: '🔧', cost: 4, desc: (l) => `Латает ${l + 1} дыры, −${10 * l}% воды` },
  gull:   { name: 'Чайка', icon: '🐦', cost: 2, desc: (l) => `Приносит ${1 + l} доски` },
};
// Боссы, нитро и финальная погоня (доли пути до острова).
export const BOSS_AT = [0.33, 0.66];
export const CHASE_AT = 0.86;
export const NITRO_MAX = 3;
export const NITRO_TIME = 5;
export const NITRO_MULT = 1.8;
export const NITRO_SYNC = 1.0; // секунд: оба должны нажать N₂O почти одновременно

// Постоянные улучшения за ракушки. В совместной игре берётся лучший уровень из двух игроков.
export const PERKS = {
  planks: { name: 'Запас досок', icon: '🪵', max: 3, cost: [20, 40, 70], desc: (l) => `+${l} доски на старте` },
  elixir: { name: 'Полный бак', icon: '💧', max: 3, cost: [20, 40, 70], desc: (l) => `+${l} эликсира на старте` },
  hull: { name: 'Крепкое дно', icon: '🛶', max: 3, cost: [30, 60, 100], desc: (l) => `Течь меньше на ${l * 15}%` },
  nitro: { name: 'Баллон нитро', icon: '🚀', max: 2, cost: [40, 80], desc: (l) => `+${l} нитро на старте` },
  freeze: { name: 'Ледяная карта', icon: '❄️', max: 1, cost: [60], desc: () => 'Заморозка в колоде с начала' },
};
export const SKINS = [
  { name: 'Классика', color: '#d6262f', cost: 0 },
  { name: 'Синяя', color: '#2f6fd6', cost: 25 },
  { name: 'Ядовитая', color: '#5fd62f', cost: 40 },
  { name: 'Золотая', color: '#ffc93d', cost: 100 },
  { name: 'Радужная', color: 'rainbow', cost: 200 },
];
// Уровни сложности. Множители к базовым значениям; в игре вдвоём действует сложность хоста.
// fire — пауза между бросками врагов, shot — время полёта снаряда, count — врагов в волне,
// leak — течь через пробоины, rocks — пауза между скалами, storm — прибавка к скорости шторма,
// bossHp — прочность боссов, planks — доски на старте, elixir — скорость эликсира, shells — ракушки за заплыв.
export const DIFFICULTY = {
  easy: {
    name: 'Лёгкая', icon: '🌤️', desc: 'Меньше зомби, снаряды медленнее, лодка течёт слабее. Ракушек ×0.7',
    fire: 1.4, shot: 1.2, count: 0.7, leak: 0.7, rocks: 1.5, storm: -0.15, bossHp: 0.75, planks: 2, elixir: 1.2, shells: 0.7,
  },
  normal: {
    name: 'Нормальная', icon: '⛵', desc: 'Как задумано',
    fire: 1, shot: 1, count: 1, leak: 1, rocks: 1, storm: 0, bossHp: 1, planks: 0, elixir: 1, shells: 1,
  },
  hard: {
    name: 'Сложная', icon: '🌪️', desc: 'Больше зомби, быстрые снаряды, злой шторм и крепкие боссы. Ракушек ×1.5',
    fire: 0.8, shot: 0.88, count: 1.3, leak: 1.25, rocks: 0.75, storm: 0.1, bossHp: 1.3, planks: 0, elixir: 0.9, shells: 1.5,
  },
};

// Кат-сцены: длительность в секундах (игра на это время на паузе, тап — пропустить).
export const CUT_TIME = { intro: 10, serpent: 6.5, giant: 7, raider: 5.5, outro: 19.5 };
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

export function tileAt(x, y) {
  return { col: Math.floor(x - BOAT.x), row: Math.floor(y - BOAT.y) };
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
