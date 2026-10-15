// Симуляция игры. Её считает только хост; гость получает снимки (snapshot).
import {
  BOAT, WORLD_W, WORLD_H, REACH, SWING_ACTIVE, PERFECT_WINDOW, SMASH_CHARGE,
  START_POS, LEAK_PER_HOLE, BAIL_RATE, REPAIR_TIME, START_PLANKS, BUCKET, DEBRIS_LANES,
  NITRO_MAX, NITRO_TIME, NITRO_SYNC, HAND_SIZE, CUT_TIME, DIFFICULTY,
  pointInBoat, tileAt, shotPos, dist,
} from './const.js';
import { initVoyage, updateVoyage, snapshotVoyage } from './voyage.js';
import { initCards, updateCards, playCard, openChest, pickChest, snapshotCards } from './cards.js';
import { initBoss, updateBoss, snapshotBoss, BOSS_KINDS } from './boss.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const KINDS = {
  zombie:  { hp: 2, cd: [3.0, 4.5], dur: 1.7, dmg: 1, score: 10, arc: 2.2, speed: 1.6 },
  spitter: { hp: 1, cd: [2.0, 3.0], dur: 1.3, dmg: 1, score: 15, arc: 1.4, speed: 2.0 },
  brute:   { hp: 5, cd: [4.0, 5.5], dur: 2.0, dmg: 2, score: 40, arc: 3.0, speed: 1.1 },
};

export function createState(solo, opts = {}) {
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  const s = {
    opts,
    diff,
    D: DIFFICULTY[diff],
    t: 0,
    phase: 'play',
    solo,
    wave: 0,
    score: 0,
    water: 0, // 0–100 %
    holes: [], // { col, row }
    patches: [], // залатанные места — только для красоты
    planks: START_PLANKS + DIFFICULTY[diff].planks,
    debris: [], // плывущие доски { id, x, y, lane }
    debrisTimer: 2,
    resets: 0,
    players: {
      h: newPlayer('h', opts.skins?.h),
      g: solo ? null : newPlayer('g', opts.skins?.g),
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
  initVoyage(s, opts);
  initCards(s);
  initBoss(s);
  Object.assign(s, { nitro: 0, nitroT: 0, nitroReq: {}, leakMul: 1, perks: {}, arrived: false });
  s.cut = opts.noIntro ? null : { id: 'intro', t: 0 }; // вступительная кат-сцена
  applyPerks(s, opts.perks || {});
  return s;
}

export function newPlayer(key, skin) {
  return { ...START_POS[key], fx: 0, fy: -1, repair: 0, bail: false, steer: 0, skin: skin || '' };
}

// Постоянные улучшения за ракушки. Можно вызывать повторно (гость прислал свои позже) —
// добавится только разница.
export function applyPerks(s, perks) {
  for (const [k, lvl] of Object.entries(perks)) {
    const add = lvl - (s.perks[k] || 0);
    if (add <= 0) continue;
    s.perks[k] = lvl;
    if (k === 'planks') s.planks += add;
    if (k === 'elixir') s.elixir = Math.min(10, s.elixir + add);
    if (k === 'nitro') s.nitro = Math.min(NITRO_MAX, s.nitro + add);
    if (k === 'hull') s.leakMul = 1 - 0.15 * lvl;
    if (k === 'freeze' && !s.levels.freeze) { s.levels.freeze = 1; s.queue.splice(HAND_SIZE, 0, 'freeze'); }
  }
}

// «Мы — семья»: нитро срабатывает, только если все игроки нажали почти одновременно.
export function requestNitro(s, key) {
  if (s.phase !== 'play' || s.chest || s.boss || s.nitroT > 0 || s.nitro <= 0) return;
  s.nitroReq[key] = s.t;
  const keys = ['h', 'g'].filter((k) => s.players[k]);
  if (keys.every((k) => s.t - (s.nitroReq[k] ?? -99) <= NITRO_SYNC)) {
    s.nitroT = NITRO_TIME;
    s.nitro--;
    s.nitroReq = {};
    emit(s, 'nitro', {});
  } else emit(s, 'nitrowait', { key });
}

export function resetState(s) {
  s.opts.noIntro = true; // при «Ещё раз» вступление не показываем
  const fresh = createState(s.solo, s.opts);
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
  s.spawnQueue = Math.max(1, Math.round((2 + s.wave) * s.D.count));
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
  const e = { id: s.nextId++, kind, hp: k.hp, maxHp: k.hp, flash: 9, cd: rand(1.2, 2.2) * s.D.fire, throwT: 9 };
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
    x0: e.x, y0: e.y, tx, ty, t: 0, dur: (k.dur / speedUp) * s.D.shot, arc: k.arc, dmg: k.dmg,
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
    if (e.under) continue; // нырнувшего змея не видно
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
    if (!pointInBoat(shot.tx, shot.ty)) { emit(s, 'splash', { x: shot.tx, y: shot.ty }); return; }
    if (shot.passTo) {
      // Уроненный мяч не пробивает дно, но плещет воду.
      addWater(s, 5);
      emit(s, 'boat', { x: shot.tx, y: shot.ty, drop: true });
      return;
    }
    if (s.shieldT > 0) { emit(s, 'block', { x: shot.tx, y: shot.ty }); return; }
    const { col, row } = tileAt(shot.tx, shot.ty);
    const fresh = punchHole(s, col, row, 6 * shot.dmg);
    if (fresh && shot.dmg > 1) addWater(s, 8);
    emit(s, 'boat', { x: shot.tx, y: shot.ty, hole: fresh, big: shot.dmg > 1 });
    return;
  }
  // Удар игрока долетел: урон врагам рядом с точкой попадания.
  const r = shot.smash ? 2.3 : 0.95;
  let hitAny = false;
  for (const e of s.enemies) {
    if (e.under || dist(e.x, e.y, shot.tx, shot.ty) > r + (e.size || 0) * 0.6) continue;
    hitAny = true;
    e.hp -= shot.dmg;
    e.flash = 0;
    emit(s, 'ehit', { x: e.x, y: e.y, dmg: shot.dmg });
    if (e.hp <= 0) {
      const pts = Math.round((KINDS[e.kind] || BOSS_KINDS[e.kind]).score * (1 + (shot.charge - 1) * 0.5) * (shot.perfect ? 1.5 : 1));
      s.score += pts;
      emit(s, 'kill', { x: e.x, y: e.y, pts, kind: e.kind });
    }
  }
  for (const e of s.enemies) if (e.hp <= 0 && !e.boss && Math.random() < 0.4) dropDebris(s, e.x, e.y);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  if (shot.smash) emit(s, 'smash', { x: shot.tx, y: shot.ty, r });
  else if (!hitAny) emit(s, 'splash', { x: shot.tx, y: shot.ty });
}

function addWater(s, amount) {
  s.water = Math.min(100, s.water + amount);
}

// Пробивает дыру в клетке палубы. Если дыра там уже есть — просто заливает водой.
function punchHole(s, col, row, waterIfExists) {
  if (s.holes.some((h) => h.col === col && h.row === row)) { addWater(s, waterIfExists); return false; }
  s.holes.push({ col, row });
  s.patches = s.patches.filter((p) => p.col !== col || p.row !== row);
  return true;
}

// Доска выплывает сверху вдоль борта или падает с разбитого плота и дрейфует к борту.
function dropDebris(s, x, y) {
  const lane = x < BOAT.x + BOAT.w / 2 ? 0 : 1;
  s.debris.push({ id: s.nextId++, x, y, lane });
}

function updateDebris(s, dt) {
  s.debrisTimer -= dt;
  if (s.debrisTimer <= 0) {
    // Чем больше дыр и меньше досок, тем чаще приплывают новые.
    const need = s.holes.length > s.planks ? 0.6 : 1;
    s.debrisTimer = rand(4, 6.5) * need;
    const lane = Math.random() < 0.5 ? 0 : 1;
    const nitro = s.nitro < NITRO_MAX && Math.random() < 0.08; // иногда вместо доски — баллон нитро
    s.debris.push({ id: s.nextId++, x: DEBRIS_LANES[lane], y: -1, lane, kind: nitro ? 'nitro' : 'plank' });
  }
  for (const d of s.debris) {
    const lx = DEBRIS_LANES[d.lane];
    d.x += Math.sign(lx - d.x) * Math.min(Math.abs(lx - d.x), 1.5 * dt);
    d.y += 1.3 * dt;
  }
  s.debris = s.debris.filter((d) => d.y < WORLD_H + 1);
}

// Ремонт и ведро — по тому, где стоят игроки.
function updateCrew(s, dt) {
  for (const key of ['h', 'g']) {
    const p = s.players[key];
    if (!p) continue;
    p.bail = dist(p.x, p.y, BUCKET.x, BUCKET.y) < BUCKET.r;
    if (p.bail && s.water > 0) s.water = Math.max(0, s.water - BAIL_RATE * dt);

    const { col, row } = tileAt(p.x, p.y);
    const hi = s.holes.findIndex((h) => h.col === col && h.row === row);
    if (hi < 0 || s.planks <= 0) { p.repair = 0; continue; }
    p.repair += dt / REPAIR_TIME;
    if (p.repair >= 1) {
      p.repair = 0;
      s.holes.splice(hi, 1);
      s.patches.push({ col, row });
      s.planks--;
      s.score += 5;
      emit(s, 'patch', { x: BOAT.x + col + 0.5, y: BOAT.y + row + 0.5, key });
    }
  }
}

function cardHooks(s) {
  return {
    emit: (type, data) => emit(s, type, data),
    addWater: (n) => { s.water = Math.max(0, Math.min(100, s.water + n)); },
    addPlanks: (n) => { s.planks += n; },
    patchHole: () => {
      const h = s.holes.splice(Math.floor(Math.random() * s.holes.length), 1)[0];
      if (!h) return;
      s.patches.push(h);
      emit(s, 'patch', { x: BOAT.x + h.col + 0.5, y: BOAT.y + h.row + 0.5 });
    },
  };
}

// ---------- Кат-сцены (игра на паузе) ----------
function startCut(s, id) {
  s.cut = { id, t: 0 };
  emit(s, 'cut', { id });
}

function endCut(s) {
  const id = s.cut.id;
  s.cut = null;
  if (id === 'outro') {
    s.phase = 'win';
    emit(s, 'win', { score: s.score, wave: s.wave });
  }
}

export function skipCut(s) {
  if (s.cut) s.cut.t = CUT_TIME[s.cut.id];
}

export function hostPlayCard(s, key, i, id) { return playCard(s, key, i, id, cardHooks(s)); }
export function hostPickChest(s, k, key) { pickChest(s, k, key, cardHooks(s)); }

export function step(s, dt) {
  s.t += dt;
  if (s.bannerT > 0) s.bannerT -= dt;
  if (s.phase !== 'play') return;

  if (s.cut) {
    s.cut.t += dt;
    if (s.cut.t >= CUT_TIME[s.cut.id]) endCut(s);
    return;
  }

  // Пока открыт сундук — игра на паузе
  if (s.chest) {
    s.chest.t -= dt;
    if (s.chest.t <= 0) pickChest(s, Math.floor(Math.random() * 3), null, cardHooks(s));
    return;
  }
  updateCards(s, dt, cardHooks(s));
  s.nitroT = Math.max(0, s.nitroT - dt);
  updateBoss(s, dt, {
    emit: (type, data) => emit(s, type, data),
    banner: (text, t) => { s.banner = text; s.bannerT = t; },
    punchHole: (col, row, water) => {
      if (s.shieldT > 0) { emit(s, 'block', { x: BOAT.x + col + 0.5, y: BOAT.y + row + 0.5 }); return false; }
      return punchHole(s, col, row, water);
    },
    addWater: (n) => addWater(s, n),
    openChest: () => openChest(s),
    startCut: (id) => startCut(s, id),
  });

  updateDebris(s, dt);
  updateCrew(s, dt);
  updateVoyage(s, dt, {
    emit: (type, data) => emit(s, type, data),
    punchHole: (col, row, water) => {
      if (s.shieldT > 0) { emit(s, 'block', { x: BOAT.x + col + 0.5, y: BOAT.y + row + 0.5 }); return false; }
      return punchHole(s, col, row, water);
    },
    addWater: (amount) => addWater(s, amount),
    banner: (text, t) => { s.banner = text; s.bannerT = t; },
    arrive: () => { if (!s.arrived) { s.arrived = true; startCut(s, 'outro'); } },
  });
  if (s.phase !== 'play' || s.cut) return;
  addWater(s, s.holes.length * LEAK_PER_HOLE * s.leakMul * s.D.leak * dt);
  if (s.water >= 100) {
    s.phase = 'over';
    emit(s, 'over', { score: s.score, wave: s.wave });
    return;
  }

  // Волны (во время боя с боссом и финальной погони новые не начинаются)
  if (s.boss || s.chase) {
    // ждём
  } else if (s.breakTimer > 0) {
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
    s.breakTimer = 2.5;
    emit(s, 'clear', { bonus });
    openChest(s);
  }

  // Враги
  const speedUp = 1 + Math.min(s.wave - 1, 8) * 0.07;
  for (const e of s.enemies) {
    if (e.boss) continue; // боссами управляет boss.js
    const k = KINDS[e.kind];
    e.flash += dt;
    e.throwT += dt;
    if (s.freezeT > 0) continue; // заморожены: не плывут и не бросают
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
        e.cd = (rand(k.cd[0], k.cd[1]) / speedUp) * s.D.fire;
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
    // Ловим доски ракеткой
    for (const d of s.debris) {
      if (d.got || dist(d.x, d.y, p.x, p.y) > reach + 0.15) continue;
      d.got = true;
      if (d.kind === 'nitro') s.nitro = Math.min(NITRO_MAX, s.nitro + 1);
      else s.planks++;
      emit(s, 'loot', { x: d.x, y: d.y, key, nitro: d.kind === 'nitro' });
    }
    s.debris = s.debris.filter((d) => !d.got);
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
    return [p.x, p.y, p.fx, p.fy, sw ? s.t - sw.t0 : 9, sw ? sw.dx : 0, sw ? sw.dy : -1, p.repair, p.bail ? 1 : 0, p.steer || 0, p.skin || ''];
  };
  return {
    t: s.t,
    ph: s.phase,
    w: s.wave,
    sc: s.score,
    wa: s.water,
    pl: s.planks,
    H: s.holes.map((h) => [h.col, h.row]),
    PT: s.patches.map((h) => [h.col, h.row]),
    D: s.debris.map((d) => [d.id, d.x, d.y, d.kind === 'nitro' ? 1 : 0]),
    ni: s.nitro,
    nT: s.nitroT,
    nr: Object.entries(s.nitroReq).filter(([, t]) => s.t - t <= NITRO_SYNC).map(([k]) => k),
    rs: s.resets,
    df: s.diff,
    cut: s.cut ? [s.cut.id, s.cut.t] : null,
    ...snapshotVoyage(s),
    ...snapshotCards(s),
    ...snapshotBoss(s),
    ban: s.bannerT > 0 ? s.banner : null,
    P: { h: pl('h'), g: pl('g') },
    E: s.enemies.map((e) => [e.id, e.kind, e.x, e.y, e.hp, e.maxHp, e.flash, e.throwT, e.under ? 1 : 0]),
    S: s.shots.map((sh) => [sh.id, sh.owner, sh.kind || '', sh.charge, sh.x0, sh.y0, sh.tx, sh.ty, sh.t, sh.dur, sh.arc, sh.passTo || '', sh.smash ? 1 : 0]),
  };
}
