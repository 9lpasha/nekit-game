// Фишки-отсылки (считает хост):
//  • The Last of Us — шум и слепые зомби: глухие проплывают мимо, услышав шум — нападают;
//  • God of War — бросок ракетки с возвратом (как топор Левиафан) и режим ярости;
//  • PUBG — аирдропы: самолёт сбрасывает ящик с лучшим лутом в стороне от курса.
import { BOAT, WORLD_W, WORLD_H, NITRO_MAX, MAX_CARD_LEVEL, ELIXIR_MAX, dist } from './const.js';

const rand = (a, b) => a + Math.random() * (b - a);

export const THROW = { range: 9, speed: 17, back: 19, dmg: 2, cd: 3 };
export const RAGE_TIME = 8;
// Насколько хорошо слышит каждый вид: щелкуны-плевуны — лучше всех, громилы почти глухие
const HEAR = { zombie: 1, spitter: 1.8, brute: 0.55 };

export function initExtras(s) {
  Object.assign(s, {
    noise: 0,
    fullSpeed: false,
    rage: { h: 0, g: 0 },
    rageT: { h: 0, g: 0 },
    throws: {},
    throwCd: { h: 0, g: 0 },
    plane: null,
    airdrop: null,
    dropTimer: rand(35, 50),
  });
}

export function addNoise(s, n) {
  if (s.noise != null) s.noise = Math.min(100, s.noise + n);
}

export function addRage(s, key, n) {
  if (key && s.rage?.[key] != null && s.rageT[key] <= 0) s.rage[key] = Math.min(100, s.rage[key] + n);
}

export const raging = (s, key) => !!(key && s.rageT?.[key] > 0);

// ---------- Ярость ----------
export function requestRage(s, key, emit) {
  const p = s.players[key];
  if (s.phase !== 'play' || !p || s.rage[key] < 100 || s.rageT[key] > 0) return;
  s.rage[key] = 0;
  s.rageT[key] = RAGE_TIME;
  addNoise(s, 20);
  emit('rage', { key, x: p.x, y: p.y });
}

// ---------- Бросок ракетки ----------
// dx = dy = 0 — автоприцел в ближайшего врага
export function requestThrow(s, key, dx, dy, emit) {
  const p = s.players[key];
  if (s.phase !== 'play' || !p || s.throws[key]) return;
  if (s.throwCd[key] > 0 && !raging(s, key)) return;
  if (!dx && !dy) {
    let best = null, bd = 12;
    for (const e of s.enemies) {
      if (e.under) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { dx = best.x - p.x; dy = best.y - p.y; } else { dx = p.fx; dy = p.fy; }
  }
  const l = Math.hypot(dx, dy) || 1;
  s.throws[key] = { x: p.x, y: p.y, dx: dx / l, dy: dy / l, phase: 'out', d: 0, hit: new Set() };
  s.throwCd[key] = THROW.cd;
  p.fx = dx / l; p.fy = dy / l;
  addNoise(s, 5);
  emit('rthrow', { key, x: p.x, y: p.y });
}

// ---------- Слепые зомби: решаем, услышал ли ----------
export function spawnsAlert(s) {
  return Math.random() < (s.D.hunt ?? 0.25) + Math.min(s.wave, 10) * 0.03; // часть сразу выходит на охоту
}

// Возвращает 'alert' — услышал/заметил, 'gone' — проплыл мимо, иначе null
export function listen(s, e, dt) {
  e.y += Math.max(0.6, (s.speed || 1) * 0.75) * dt; // течение несёт мимо лодки
  e.x += Math.sin(s.t * 0.8 + e.id) * 0.25 * dt;
  if (e.flash < 0.3) return 'alert'; // в него попали
  const edge = Math.max(BOAT.x - e.x, e.x - (BOAT.x + BOAT.w), 0);
  const besideBoat = e.y > BOAT.y && e.y < BOAT.y + BOAT.h;
  if (besideBoat && edge < 1.1 && Math.random() < 0.5 * dt) return 'alert'; // наткнулся вплотную
  const hear = (s.noise / 100) * (HEAR[e.kind] || 1) * (s.D.hear || 1) * 1.3 * dt;
  if (Math.random() < hear) return 'alert';
  if (e.y > WORLD_H + 1.2) return 'gone';
  return null;
}

// ---------- Аирдроп ----------
const LOOT = [
  { title: 'Ярость до краёв', apply: (s) => { for (const k of ['h', 'g']) if (s.players[k]) s.rage[k] = 100; } },
  { title: '+2 нитро', apply: (s) => { s.nitro = Math.min(NITRO_MAX, s.nitro + 2); } },
  { title: 'Все дыры залатаны', apply: (s) => { s.patches.push(...s.holes); s.holes = []; s.water = Math.max(0, s.water - 40); } },
  {
    title: 'Эликсир и ★ карте',
    apply: (s) => {
      s.elixir = ELIXIR_MAX;
      const ids = Object.keys(s.levels).filter((id) => s.levels[id] < MAX_CARD_LEVEL);
      if (ids.length) s.levels[ids[Math.floor(Math.random() * ids.length)]]++;
    },
  },
  { title: '+6 досок', apply: (s) => { s.planks += 6; } },
];

export function collectDrop(s, key, emit) {
  const a = s.airdrop;
  if (!a) return;
  const pool = [...LOOT].sort(() => Math.random() - 0.5).slice(0, 2);
  pool.forEach((l) => l.apply(s));
  s.score += 100;
  emit('droploot', { x: 6 + (a.wx - s.boatX), y: a.y, key, title: pool.map((l) => l.title).join(' + ') });
  s.airdrop = null;
  s.dropTimer = rand(45, 60);
}

const screenX = (s, wx) => BOAT.x + BOAT.w / 2 + (wx - s.boatX);

// hooks: { emit, damage(e, dmg, key), collectDebris(d, key), block(shot) }
export function updateExtras(s, dt, hooks) {
  const { emit } = hooks;
  // Шум затихает, нитро и полный ход шумят постоянно
  s.noise = Math.max(0, s.noise - 14 * dt);
  if (s.nitroT > 0) addNoise(s, 40 * dt);
  if (s.fullSpeed) addNoise(s, 18 * dt);

  for (const k of ['h', 'g']) {
    s.rageT[k] = Math.max(0, s.rageT[k] - dt);
    s.throwCd[k] = Math.max(0, s.throwCd[k] - dt);
  }

  // Летящие ракетки
  for (const key of Object.keys(s.throws)) {
    const th = s.throws[key];
    const p = s.players[key];
    if (!p) { delete s.throws[key]; continue; }
    if (th.phase === 'out') {
      const st = THROW.speed * dt;
      th.x += th.dx * st; th.y += th.dy * st; th.d += st;
      if (th.d >= THROW.range || th.x < -1 || th.x > WORLD_W + 1 || th.y < -1 || th.y > WORLD_H + 1) { th.phase = 'back'; th.hit = new Set(); }
    } else {
      const d = dist(th.x, th.y, p.x, p.y);
      if (d < 0.6) { delete s.throws[key]; emit('rcatch', { key, x: p.x, y: p.y }); continue; }
      const st = Math.min(d, THROW.back * dt);
      th.x += ((p.x - th.x) / d) * st; th.y += ((p.y - th.y) / d) * st;
    }
    const mult = raging(s, key) ? 2 : 1;
    for (const e of s.enemies) {
      if (e.under || e.hp <= 0 || th.hit.has(e.id)) continue;
      if (dist(e.x, e.y, th.x, th.y) > 0.85 + (e.size || 0) * 0.5) continue;
      th.hit.add(e.id);
      hooks.damage(e, (th.phase === 'out' ? THROW.dmg : 1) * mult, key);
      addRage(s, key, 8);
      emit('rhit', { x: th.x, y: th.y });
    }
    for (const sh of s.shots) {
      if (sh.owner === 'e' && !sh.gone && dist(sh.x, sh.y, th.x, th.y) < 0.7) { sh.gone = true; emit('block', { x: sh.x, y: sh.y }); }
    }
    for (const d of s.debris) if (!d.got && dist(d.x, d.y, th.x, th.y) < 0.8) hooks.collectDebris(d, key);
    const a = s.airdrop;
    if (a && a.phase === 'float' && dist(screenX(s, a.wx), a.y, th.x, th.y) < 1.1) collectDrop(s, key, emit);
  }
  s.shots = s.shots.filter((sh) => !sh.gone);
  s.debris = s.debris.filter((d) => !d.got);

  // Самолёт и ящик
  if (!s.plane && !s.airdrop && !s.boss && !s.chase) {
    s.dropTimer -= dt;
    if (s.dropTimer <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      s.plane = { x: dir > 0 ? -3 : WORLD_W + 3, dir, dropAt: rand(3, WORLD_W - 3), dropped: false };
      emit('plane', {});
    }
  }
  if (s.plane) {
    const pl = s.plane;
    pl.x += pl.dir * 6 * dt;
    addNoise(s, 6 * dt);
    if (!pl.dropped && (pl.dir > 0 ? pl.x >= pl.dropAt : pl.x <= pl.dropAt)) {
      pl.dropped = true;
      const side = Math.random() < 0.5 ? -1 : 1; // ящик падает в стороне от курса — придётся подрулить
      s.airdrop = { id: s.nextId++, wx: s.boatX + side * rand(4.6, 6.2), y: 1.6, z: 7, phase: 'fall' };
      addNoise(s, 25);
      s.banner = 'АИРДРОП!';
      s.bannerT = 1.6;
      emit('drop', { x: pl.x, y: 1.6 });
    }
    if (pl.x < -4 || pl.x > WORLD_W + 4) s.plane = null;
  }
  const a = s.airdrop;
  if (a) {
    if (a.phase === 'fall') {
      a.z -= 2.6 * dt;
      a.y += (s.speed || 0) * 0.5 * dt;
      if (a.z <= 0) { a.z = 0; a.phase = 'float'; emit('splash', { x: screenX(s, a.wx), y: a.y }); }
    } else {
      a.y += (s.speed || 0) * dt;
      const sx = screenX(s, a.wx);
      if (sx > BOAT.x - 0.6 && sx < BOAT.x + BOAT.w + 0.6 && a.y > BOAT.y + 1 && a.y < BOAT.y + BOAT.h) collectDrop(s, null, emit);
      else if (a.y > WORLD_H + 1) {
        s.airdrop = null;
        s.dropTimer = rand(40, 55);
        emit('droplost', { x: Math.max(1, Math.min(WORLD_W - 1, sx)), y: WORLD_H - 2 });
      }
    }
  }
}

// Ловля ящика ракеткой — вызывается из обработки замаха
export function swingDrop(s, key, p, reach, emit) {
  const a = s.airdrop;
  if (a && a.phase === 'float' && dist(screenX(s, a.wx), a.y, p.x, p.y) < reach + 0.5) collectDrop(s, key, emit);
}

export function snapshotExtras(s) {
  const a = s.airdrop;
  return {
    no: s.noise,
    fs: s.fullSpeed ? 1 : 0,
    TH: Object.entries(s.throws).map(([k, th]) => [k, th.x, th.y, th.phase === 'out' ? 1 : 0]),
    AD: a ? [screenX(s, a.wx), a.y, a.z, a.phase === 'float' ? 1 : 0] : null,
    PL: s.plane ? [s.plane.x, s.plane.dir] : null,
  };
}
