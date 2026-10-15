// Симуляция игры. Её считает только хост; гость получает снимки (snapshot).
import {
  BOAT, WORLD_W, MAX_HP, REACH, SWING_ACTIVE, PERFECT_WINDOW, SMASH_CHARGE,
  START_POS, pointInBoat, shotPos, dist,
} from './const.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const KINDS = {
  zombie:  { hp: 2, cd: [3.0, 4.5], dur: 1.7, dmg: 1, score: 10, arc: 2.2, speed: 1.6 },
  spitter: { hp: 1, cd: [2.0, 3.0], dur: 1.3, dmg: 1, score: 15, arc: 1.4, speed: 2.0 },
  brute:   { hp: 5, cd: [4.0, 5.5], dur: 2.0, dmg: 2, score: 40, arc: 3.0, speed: 1.1 },
};

export function createState(solo) {
  return {
    t: 0,
    phase: 'play',
    solo,
    wave: 0,
    score: 0,
    hp: MAX_HP,
    resets: 0,
    players: {
      h: { ...START_POS.h, fx: 0, fy: -1 },
      g: solo ? null : { ...START_POS.g, fx: 0, fy: -1 },
    },
    swings: {},
    enemies: [],
    shots: [],
    events: [],
    nextId: 1,
    spawnQueue: 0,
    spawnTimer: 0,
    breakTimer: 1.5,
    banner: 'Приготовьтесь!',
    bannerT: 1.5,
  };
}

export function resetState(s) {
  const fresh = createState(s.solo);
  fresh.resets = s.resets + 1;
  Object.assign(s, fresh);
}

export function swing(s, key, dx, dy, lagBonus = 0) {
  const len = Math.hypot(dx, dy) || 1;
  s.swings[key] = { t0: s.t, dx: dx / len, dy: dy / len, window: SWING_ACTIVE + lagBonus, hit: new Set() };
  const p = s.players[key];
  if (p) { p.fx = dx / len; p.fy = dy / len; }
}

function emit(s, type, data) { s.events.push({ type, ...data }); }

function startWave(s) {
  s.wave++;
  s.spawnQueue = 2 + s.wave;
  s.spawnTimer = 0.3;
  s.banner = `Волна ${s.wave}`;
  s.bannerT = 1.6;
  emit(s, 'wave', { n: s.wave });
}

function spawnEnemy(s) {
  const kinds = ['zombie'];
  if (s.wave >= 2) kinds.push('spitter');
  if (s.wave >= 4 && Math.random() < 0.35) kinds.push('brute');
  const kind = pick(kinds);
  const k = KINDS[kind];
  const e = { id: s.nextId++, kind, hp: k.hp, maxHp: k.hp, flash: 9, cd: rand(1.2, 2.2), throwT: 9 };
  placeEnemy(e, true);
  s.enemies.push(e);
}

// Выбираем точку в воде вокруг лодки. При спавне враг выплывает из-за края экрана.
function placeEnemy(e, spawn) {
  const side = pick(['left', 'right', 'top', 'top']);
  if (side === 'left') {
    e.ax = rand(0.8, 1.9); e.ay = rand(3.5, 15.5);
    if (spawn) { e.x = -1.5; e.y = e.ay; }
  } else if (side === 'right') {
    e.ax = rand(WORLD_W - 1.9, WORLD_W - 0.8); e.ay = rand(3.5, 15.5);
    if (spawn) { e.x = WORLD_W + 1.5; e.y = e.ay; }
  } else {
    e.ax = rand(1.2, WORLD_W - 1.2); e.ay = rand(1.2, 5.2);
    if (spawn) { e.x = e.ax; e.y = -1.5; }
  }
}

function throwShot(s, e) {
  const k = KINDS[e.kind];
  // Целимся в случайного игрока (с разбросом) или просто в палубу.
  const ps = Object.values(s.players).filter(Boolean);
  let tx, ty;
  if (ps.length && Math.random() < 0.75) {
    const p = pick(ps);
    tx = p.x + rand(-0.9, 0.9); ty = p.y + rand(-0.9, 0.9);
  } else {
    tx = rand(BOAT.x + 0.5, BOAT.x + BOAT.w - 0.5); ty = rand(BOAT.y + 2.5, BOAT.y + BOAT.h - 0.5);
  }
  tx = Math.min(Math.max(tx, BOAT.x + 0.4), BOAT.x + BOAT.w - 0.4);
  ty = Math.min(Math.max(ty, BOAT.y + 2.4), BOAT.y + BOAT.h - 0.4);
  const speedUp = 1 + Math.min(s.wave - 1, 8) * 0.06;
  s.shots.push({
    id: s.nextId++, owner: 'e', kind: e.kind, charge: 0,
    x0: e.x, y0: e.y, tx, ty, t: 0, dur: k.dur / speedUp, arc: k.arc, dmg: k.dmg,
    x: e.x, y: e.y, z: 0,
  });
  e.throwT = 0;
  emit(s, 'throw', { x: e.x, y: e.y });
}

// Угол между направлением удара и направлением на цель.
function angleTo(px, py, dx, dy, tx, ty) {
  const vx = tx - px, vy = ty - py;
  const len = Math.hypot(vx, vy) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy) / len)));
}

function canHit(shot, key) {
  if (shot.owner === 'e') return true;
  return shot.passTo === key; // пас от напарника
}

function reflect(s, shot, key, sw) {
  const p = s.players[key];
  const mateKey = key === 'h' ? 'g' : 'h';
  const mate = s.players[mateKey];
  const perfect = s.t - sw.t0 <= PERFECT_WINDOW + (sw.window - SWING_ACTIVE);
  const charge = shot.owner === 'e' ? 1 : shot.charge + 1;

  // Автоприцел: ближайший по углу враг или напарник в конусе удара.
  let target = null, best = charge >= SMASH_CHARGE ? 1.1 : 0.56;
  for (const e of s.enemies) {
    const a = angleTo(shot.x, shot.y, sw.dx, sw.dy, e.x, e.y);
    if (a < best) { best = a; target = e; }
  }
  let passTo = null;
  if (mate && charge < SMASH_CHARGE) {
    const a = angleTo(shot.x, shot.y, sw.dx, sw.dy, mate.x, mate.y);
    if (a < 0.66 && a < best && dist(p.x, p.y, mate.x, mate.y) > 1.2) { passTo = mateKey; target = null; }
  }

  shot.owner = key;
  shot.charge = charge;
  shot.x0 = shot.x; shot.y0 = shot.y; shot.t = 0;
  shot.perfect = perfect;
  shot.passTo = passTo;
  shot.targetId = target ? target.id : null;
  shot.smash = !passTo && charge >= SMASH_CHARGE;
  shot.dmg = 1 + Math.floor(charge / 2) + (perfect ? 1 : 0) + (shot.smash ? 2 : 0);

  let tx, ty, speed;
  if (passTo) { tx = mate.x; ty = mate.y; speed = 5 + charge * 0.4; shot.arc = 1.0; }
  else if (target) { tx = target.x; ty = target.y; speed = 10 + charge * 1.2 + (perfect ? 3 : 0); shot.arc = 0.5; }
  else { tx = shot.x + sw.dx * 10; ty = shot.y + sw.dy * 10; speed = 10; shot.arc = 0.3; }
  shot.tx = tx; shot.ty = ty;
  shot.dur = Math.max(0.15, dist(shot.x, shot.y, tx, ty) / speed);
  sw.hit.add(shot.id);
  emit(s, 'hit', { x: shot.x, y: shot.y, key, perfect, charge, pass: !!passTo });
}

function arrive(s, shot) {
  if (shot.owner === 'e' || shot.passTo) {
    // Не отбили — снаряд падает на палубу.
    if (pointInBoat(shot.tx, shot.ty)) {
      const dmg = shot.owner === 'e' ? shot.dmg : 1;
      s.hp = Math.max(0, s.hp - dmg);
      emit(s, 'boat', { x: shot.tx, y: shot.ty, dmg, drop: !!shot.passTo });
      if (s.hp <= 0 && s.phase === 'play') {
        s.phase = 'over';
        emit(s, 'over', { score: s.score, wave: s.wave });
      }
    } else {
      emit(s, 'splash', { x: shot.tx, y: shot.ty });
    }
    return;
  }
  // Удар игрока долетел: урон врагам рядом с точкой попадания.
  const r = shot.smash ? 2.3 : 0.95;
  let hitAny = false;
  for (const e of s.enemies) {
    if (dist(e.x, e.y, shot.tx, shot.ty) > r) continue;
    hitAny = true;
    e.hp -= shot.dmg;
    e.flash = 0;
    emit(s, 'ehit', { x: e.x, y: e.y, dmg: shot.dmg });
    if (e.hp <= 0) {
      const pts = Math.round(KINDS[e.kind].score * (1 + (shot.charge - 1) * 0.5) * (shot.perfect ? 1.5 : 1));
      s.score += pts;
      emit(s, 'kill', { x: e.x, y: e.y, pts, kind: e.kind });
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  if (shot.smash) emit(s, 'smash', { x: shot.tx, y: shot.ty, r });
  else if (!hitAny) emit(s, 'splash', { x: shot.tx, y: shot.ty });
}

export function step(s, dt) {
  s.t += dt;
  if (s.bannerT > 0) s.bannerT -= dt;
  if (s.phase !== 'play') return;

  // Волны
  if (s.breakTimer > 0) {
    s.breakTimer -= dt;
    if (s.breakTimer <= 0) startWave(s);
  } else if (s.spawnQueue > 0) {
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) { spawnEnemy(s); s.spawnQueue--; s.spawnTimer = rand(0.9, 1.6); }
  } else if (s.enemies.length === 0 && !s.shots.some((sh) => sh.owner === 'e')) {
    const bonus = 50 * s.wave;
    s.score += bonus;
    s.banner = 'Волна отбита!';
    s.bannerT = 2;
    s.breakTimer = 3;
    emit(s, 'clear', { bonus });
  }

  // Враги
  const speedUp = 1 + Math.min(s.wave - 1, 8) * 0.07;
  for (const e of s.enemies) {
    const k = KINDS[e.kind];
    e.flash += dt;
    e.throwT += dt;
    const d = dist(e.x, e.y, e.ax, e.ay);
    if (d > 0.05) {
      const v = Math.min(d, k.speed * dt);
      e.x += ((e.ax - e.x) / d) * v;
      e.y += ((e.ay - e.y) / d) * v;
    }
    if (d < 1.5) {
      e.cd -= dt;
      if (e.cd <= 0) {
        throwShot(s, e);
        e.cd = rand(k.cd[0], k.cd[1]) / speedUp;
        if (Math.random() < 0.25) placeEnemy(e, false); // иногда меняет позицию
      }
    }
  }

  // Снаряды
  for (const sh of s.shots) {
    sh.t += dt;
    // Самонаведение на цель (врага или напарника при пасе).
    if (sh.targetId) {
      const e = s.enemies.find((en) => en.id === sh.targetId);
      if (e) { sh.tx = e.x; sh.ty = e.y; }
    } else if (sh.passTo && s.players[sh.passTo]) {
      const m = s.players[sh.passTo];
      sh.tx = m.x; sh.ty = m.y;
    }
    const pos = shotPos(sh, sh.t);
    sh.x = pos.x; sh.y = pos.y; sh.z = pos.z;
  }

  // Удары ракеткой
  for (const key of ['h', 'g']) {
    const sw = s.swings[key];
    const p = s.players[key];
    if (!sw || !p || s.t - sw.t0 > sw.window) continue;
    const reach = REACH + (sw.window - SWING_ACTIVE) * 2;
    for (const sh of s.shots) {
      if (sw.hit.has(sh.id) || !canHit(sh, key) || sh.t >= sh.dur) continue;
      const vx = sh.x - p.x, vy = sh.y - p.y;
      const d = Math.hypot(vx, vy);
      if (d > reach) continue;
      if (d > 0.4 && (vx * sw.dx + vy * sw.dy) / d < -0.35) continue; // мяч за спиной
      reflect(s, sh, key, sw);
    }
  }

  const done = s.shots.filter((sh) => sh.t >= sh.dur);
  s.shots = s.shots.filter((sh) => sh.t < sh.dur);
  for (const sh of done) arrive(s, sh);
}

// Компактный снимок состояния для отправки гостю и для отрисовки.
export function snapshot(s) {
  const pl = (key) => {
    const p = s.players[key];
    if (!p) return null;
    const sw = s.swings[key];
    return [p.x, p.y, p.fx, p.fy, sw ? s.t - sw.t0 : 9, sw ? sw.dx : 0, sw ? sw.dy : -1];
  };
  return {
    t: s.t,
    ph: s.phase,
    w: s.wave,
    sc: s.score,
    hp: s.hp,
    rs: s.resets,
    ban: s.bannerT > 0 ? s.banner : null,
    P: { h: pl('h'), g: pl('g') },
    E: s.enemies.map((e) => [e.id, e.kind, e.x, e.y, e.hp, e.maxHp, e.flash, e.throwT]),
    S: s.shots.map((sh) => [sh.id, sh.owner, sh.kind || '', sh.charge, sh.x0, sh.y0, sh.tx, sh.ty, sh.t, sh.dur, sh.arc, sh.passTo || '', sh.smash ? 1 : 0]),
  };
}
