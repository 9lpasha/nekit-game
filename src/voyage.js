// Плавание: штурвал, скалы, водовороты, шторм за кормой и остров впереди.
// Лодка всегда в центре экрана, поэтому «движение» — это смещение мира навстречу.
// Скалы и водовороты живут в мировых координатах (wx), на экран переводятся через boatX.
import {
  BOAT, HELM, BOAT_SPEED, STEER_SPEED, ISLAND_DIST, STORM_START_GAP, WORLD_W, dist,
} from './const.js';

const rand = (a, b) => a + Math.random() * (b - a);
const CENTER = BOAT.x + BOAT.w / 2;

export function initVoyage(s, opts) {
  Object.assign(s, {
    island: opts.island || ISLAND_DIST,
    dist: 0,
    storm: -STORM_START_GAP,
    boatX: 0,
    boatVx: 0,
    speed: BOAT_SPEED,
    helm: null,
    rocks: [],
    whirls: [],
    rockTimer: 25,
    whirlTimer: 40,
    boltTimer: 3,
    stormWarned: false,
    inStorm: false,
  });
}

const screenX = (s, wx) => CENTER + (wx - s.boatX);

// hooks: { emit, punchHole(col, row, water), addWater(amount), banner(text, t) }
export function updateVoyage(s, dt, hooks) {
  // Кто у штурвала: держит тот, кто уже держал, иначе первый подошедший.
  const near = (k) => s.players[k] && dist(s.players[k].x, s.players[k].y, HELM.x, HELM.y) < HELM.r + 0.15;
  if (!s.helm || !near(s.helm)) s.helm = ['h', 'g'].find(near) || null;
  const steer = s.helm ? s.players[s.helm].steer || 0 : 0;
  s.boatVx += (steer * STEER_SPEED - s.boatVx) * Math.min(1, dt * 4);

  // Скорость: вода утяжеляет лодку, водоворот тормозит и тянет к центру.
  let speed = BOAT_SPEED * (1 - 0.45 * s.water / 100);
  for (const w of s.whirls) {
    const dx = screenX(s, w.wx) - CENTER, dy = w.y - (BOAT.y + BOAT.h / 2);
    if (Math.abs(dx) < w.r + BOAT.w / 2 && Math.abs(dy) < w.r + BOAT.h / 2) {
      speed *= 0.5;
      s.boatVx += Math.sign(dx) * 2.5 * dt; // засасывает к центру воронки
      if (!w.warned) { w.warned = true; hooks.emit('whirl', { x: screenX(s, w.wx), y: w.y }); }
    }
  }
  s.speed = speed;
  s.boatX += s.boatVx * dt;
  s.dist += speed * dt;

  // Шторм ускоряется со временем, но далеко вперёд лодки не уходит.
  const stormSpeed = 1.1 + 0.001 * s.t;
  s.storm = Math.min(s.storm + stormSpeed * dt, s.dist + 4);
  const gap = s.dist - s.storm;
  if (gap < 10 && !s.stormWarned) { s.stormWarned = true; hooks.banner('Шторм догоняет!', 1.8); hooks.emit('stormnear', {}); }
  if (gap > 14) s.stormWarned = false;
  if (gap < 0 && !s.inStorm) { s.inStorm = true; hooks.banner('Мы в шторме!', 1.8); }
  if (gap > 1) s.inStorm = false;
  if (s.inStorm) {
    hooks.addWater(3 * dt);
    s.boltTimer -= dt;
    if (s.boltTimer <= 0) {
      s.boltTimer = rand(2.5, 4.5);
      const col = Math.floor(rand(0, BOAT.w)), row = Math.floor(rand(2, BOAT.h));
      hooks.punchHole(col, row, 3);
      hooks.emit('bolt', { x: BOAT.x + col + 0.5, y: BOAT.y + row + 0.5 });
    }
  }

  const remaining = s.island - s.dist;

  // Скалы: часть специально по курсу лодки — без рулевого в них врежешься.
  s.rockTimer -= dt;
  if (s.rockTimer <= 0 && remaining > 30) {
    s.rockTimer = rand(6, 9) / (1 + Math.min(s.wave, 10) * 0.05);
    const onCourse = Math.random() < 0.35;
    s.rocks.push({
      id: s.nextId++,
      wx: s.boatX + (onCourse ? rand(-2, 2) : (Math.random() < 0.5 ? -1 : 1) * rand(4.3, 7)), // остальные — мимо борта
      y: -1.5,
      r: rand(0.55, 0.95),
    });
  }
  s.whirlTimer -= dt;
  if (s.whirlTimer <= 0 && remaining > 30) {
    s.whirlTimer = rand(18, 30);
    s.whirls.push({ id: s.nextId++, wx: s.boatX + rand(-3, 3), y: -3, r: 1.6 });
  }

  for (const r of s.rocks) {
    r.y += speed * dt;
    const sx = screenX(s, r.wx);
    const hitX = sx > BOAT.x - r.r * 0.6 && sx < BOAT.x + BOAT.w + r.r * 0.6;
    const hitY = r.y + r.r > BOAT.y + 1 && r.y - r.r < BOAT.y + BOAT.h;
    if (!r.hit && hitX && hitY) {
      r.hit = true;
      const col = Math.max(0, Math.min(BOAT.w - 1, Math.floor(sx - BOAT.x)));
      const row = Math.max(2, Math.min(BOAT.h - 1, Math.floor(r.y + r.r - BOAT.y)));
      hooks.punchHole(col, row, 6);
      s.boatVx += sx < CENTER ? 2.5 : -2.5; // отбрасывает в сторону
      hooks.emit('rock', { x: Math.max(BOAT.x, Math.min(BOAT.x + BOAT.w, sx)), y: BOAT.y + row + 0.5 });
    }
  }
  for (const w of s.whirls) w.y += speed * dt;
  s.rocks = s.rocks.filter((r) => !r.hit && r.y < 22);
  s.whirls = s.whirls.filter((w) => w.y < 24);

  if (remaining <= 0) {
    s.phase = 'win';
    hooks.emit('win', { score: s.score, wave: s.wave });
  }
}

export function snapshotVoyage(s) {
  const vis = (wx, y, r) => Math.abs(screenX(s, wx) - WORLD_W / 2) < WORLD_W / 2 + r + 1;
  return {
    bx: s.boatX,
    bv: s.boatVx,
    di: s.dist,
    st: s.storm,
    isl: s.island,
    hm: s.helm || '',
    R: s.rocks.filter((r) => vis(r.wx, r.y, r.r)).map((r) => [r.id, screenX(s, r.wx), r.y, r.r]),
    WP: s.whirls.filter((w) => vis(w.wx, w.y, w.r)).map((w) => [w.id, screenX(s, w.wx), w.y, w.r]),
  };
}
