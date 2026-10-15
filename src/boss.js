// Боссы (Морской змей, Каменный великан) и финальная погоня за катером рейдеров.
// Босс — это враг в s.enemies с флагом boss: обычные удары, башенки и бомбы бьют его как всех,
// но двигается и атакует он по своему сценарию отсюда.
import { BOAT, BOSS_AT, CHASE_AT, NITRO_MAX, WORLD_W, clamp } from './const.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const BOSS_KINDS = {
  serpent: { name: 'Мировой змей', hp: 30, size: 1.1, score: 300 },
  giant: { name: 'Колосс', hp: 45, size: 1.3, score: 500 },
  raider: { name: 'Катер рейдеров', hp: 25, size: 1.0, score: 400 },
};

export function initBoss(s) {
  Object.assign(s, { boss: null, bossIdx: 0, bossKills: 0, chase: false, raiderAlive: false, raiderKilled: false, marks: [] });
}

// Точка на палубе рядом с игроком — туда целится босс.
function deckPoint(s, spread = 0.9) {
  const ps = Object.values(s.players).filter(Boolean);
  const p = ps.length ? pick(ps) : { x: BOAT.x + BOAT.w / 2, y: BOAT.y + 6 };
  return {
    x: clamp(p.x + rand(-spread, spread), BOAT.x + 0.4, BOAT.x + BOAT.w - 0.4),
    y: clamp(p.y + rand(-spread, spread), BOAT.y + 2.4, BOAT.y + BOAT.h - 0.4),
  };
}

function shoot(s, e, kind, dmg, dur, arc, spread) {
  const t = deckPoint(s, spread);
  s.shots.push({
    id: s.nextId++, owner: 'e', kind, charge: 0, dmg,
    x0: e.x, y0: e.y, tx: t.x, ty: t.y, x: e.x, y: e.y, z: 0, t: 0, dur, arc,
  });
  e.throwT = 0;
}

// Отметить клетки палубы: через time секунд туда прилетит удар (хвост, камни).
function mark(s, cells, time) {
  for (const [col, row] of cells) s.marks.push({ col, row, t: time, max: time });
}

function spawn(s, kind, x, y) {
  const k = BOSS_KINDS[kind];
  const hp = Math.round(k.hp * (s.solo ? 0.7 : 1));
  const e = { id: s.nextId++, kind, boss: true, hp, maxHp: hp, x, y, ax: x, ay: y, size: k.size, flash: 9, throwT: 9, t: 1, cd: 1, state: 'emerge', under: false };
  s.enemies.push(e);
  return e;
}

// hooks: { emit, banner(text, t), punchHole(col, row, water), addWater(n), openChest(), startCut(id) }
export function updateBoss(s, dt, hooks) {
  const prog = s.dist / s.island;
  if (!s.boss && !s.chase && s.bossIdx < BOSS_AT.length && prog >= BOSS_AT[s.bossIdx]) {
    const kind = s.bossIdx === 0 ? 'serpent' : 'giant';
    s.boss = kind;
    s.spawnQueue = 0;
    if (kind === 'serpent') spawn(s, kind, -1.5, 12);
    else spawn(s, kind, WORLD_W / 2, -2);
    hooks.banner('БОСС: ' + BOSS_KINDS[kind].name.toUpperCase() + '!', 2.5);
    hooks.startCut(kind);
    hooks.emit('boss', { kind });
  }
  if (!s.boss && !s.chase && prog >= CHASE_AT) {
    s.chase = true;
    s.raiderAlive = true;
    s.spawnQueue = 0;
    spawn(s, 'raider', WORLD_W / 2, -2).state = 'chase';
    hooks.banner('ФИНАЛЬНАЯ ПОГОНЯ!', 2.5);
    hooks.startCut('raider');
    hooks.emit('chase', {});
  }

  // Отмеченные клетки: время вышло — удар
  for (const m of s.marks) {
    m.t -= dt;
    if (m.t <= 0) {
      hooks.punchHole(m.col, m.row, 4);
      hooks.emit('slam', { x: BOAT.x + m.col + 0.5, y: BOAT.y + m.row + 0.5 });
    }
  }
  s.marks = s.marks.filter((m) => m.t > 0);

  for (const e of s.enemies) {
    if (!e.boss) continue;
    e.flash += dt;
    e.throwT += dt;
    if (s.freezeT > 0) continue;
    AI[e.kind](s, e, dt, hooks);
  }

  if (s.boss && !s.enemies.some((e) => e.boss && e.kind === s.boss)) {
    const kind = s.boss;
    s.boss = null;
    s.bossIdx++;
    s.bossKills++;
    s.marks = [];
    s.nitro = Math.min(NITRO_MAX, s.nitro + 1);
    s.score += BOSS_KINDS[kind].score;
    s.breakTimer = 2.5;
    hooks.banner('Босс повержен!', 2.5);
    hooks.emit('bossdown', { kind });
    hooks.openChest();
  }
  if (s.raiderAlive && !s.enemies.some((e) => e.kind === 'raider')) {
    s.raiderAlive = false;
    s.raiderKilled = true;
    s.nitro = Math.min(NITRO_MAX, s.nitro + 1);
    s.score += BOSS_KINDS.raider.score;
    hooks.banner('Рейдеры потоплены!', 2.5);
    hooks.emit('bossdown', { kind: 'raider' });
  }
}

function moveTo(e, dt, speed) {
  const dx = e.ax - e.x, dy = e.ay - e.y, d = Math.hypot(dx, dy);
  if (d > 0.05) { const v = Math.min(d, speed * dt); e.x += (dx / d) * v; e.y += (dy / d) * v; }
}

const AI = {
  // Змей выныривает то слева, то справа, плюётся веером или бьёт хвостом по палубе, потом ныряет.
  serpent(s, e, dt, hooks) {
    e.t -= dt;
    if (e.state === 'emerge') {
      e.under = false;
      if (e.ax < 0) { e.ax = 1.3; e.ay = rand(9, 15); }
      moveTo(e, dt, 6);
      if (e.t <= 0) { e.state = 'attack'; e.t = 4.5; e.cd = 0.5; e.pattern = pick(['spit', 'spit', 'tail']); e.marked = false; }
    } else if (e.state === 'attack') {
      e.cd -= dt;
      if (e.pattern === 'spit' && e.cd <= 0) {
        e.cd = 1.1;
        for (let i = 0; i < 3; i++) shoot(s, e, 'spitter', 1, 1.25 + i * 0.12, 1.6, 1.6);
        hooks.emit('throw', { x: e.x, y: e.y });
      }
      if (e.pattern === 'tail' && !e.marked) {
        e.marked = true;
        const row = Math.floor(rand(3, BOAT.h));
        const cols = e.x < WORLD_W / 2 ? [0, 1, 2] : [3, 4, 5];
        mark(s, cols.map((c) => [c, row]), 1.5);
        hooks.emit('roar', { x: e.x, y: e.y });
      }
      if (e.t <= 0) { e.state = 'dive'; e.t = 0.6; }
    } else if (e.state === 'dive') {
      if (e.t <= 0) {
        e.state = 'under'; e.under = true; e.t = 1.3;
        const left = e.x > WORLD_W / 2;
        e.ax = left ? 1.3 : WORLD_W - 1.3;
        e.ay = rand(9, 15.5);
        hooks.emit('splash', { x: e.x, y: e.y });
      }
    } else if (e.state === 'under') {
      moveTo(e, dt, 9);
      if (e.t <= 0) { e.state = 'emerge'; e.t = 0.7; hooks.emit('splash', { x: e.x, y: e.y }); }
    }
  },

  // Великан стоит на скале впереди: кидает валуны, вызывает каменный дождь, топает так, что лодку качает.
  giant(s, e, dt, hooks) {
    e.t -= dt;
    if (e.state === 'emerge') {
      e.ax = WORLD_W / 2; e.ay = 4.6; // ниже полосы здоровья, чтобы голову и валун было видно
      moveTo(e, dt, 3);
      if (e.t <= 0 && Math.abs(e.y - e.ay) < 0.1) { e.state = 'idle'; e.t = 1; }
      return;
    }
    moveTo(e, dt, 1.2);
    if (e.state === 'idle' && e.t <= 0) {
      e.ax = rand(3.5, WORLD_W - 3.5);
      const p = pick(['boulder', 'boulder', 'rain', 'stomp']);
      if (p === 'boulder') {
        shoot(s, e, 'boulder', 2, 1.9, 3.5, 0.8);
        hooks.emit('throw', { x: e.x, y: e.y });
        e.t = 1.5;
      } else if (p === 'rain') {
        const cells = [];
        while (cells.length < 5) {
          const c = [Math.floor(rand(0, BOAT.w)), Math.floor(rand(2, BOAT.h))];
          if (!cells.some(([a, b]) => a === c[0] && b === c[1])) cells.push(c);
        }
        mark(s, cells, 1.8);
        hooks.emit('roar', { x: e.x, y: e.y });
        e.t = 2.4;
      } else {
        hooks.addWater(6);
        s.boatVx += pick([-3, 3]);
        hooks.emit('stomp', { x: e.x, y: e.y });
        e.throwT = 0;
        e.t = 1.6;
      }
    }
  },

  // Катер рейдеров петляет впереди и бросает коктейли на палубу.
  raider(s, e, dt, hooks) {
    e.ax = WORLD_W / 2 + Math.sin(s.t * 0.8) * 3.5;
    e.ay = 2.3 + Math.sin(s.t * 1.7) * 0.4;
    moveTo(e, dt, 5);
    e.cd -= dt;
    if (e.cd <= 0 && e.y > 0.5) {
      e.cd = rand(1.3, 1.9);
      shoot(s, e, 'molotov', 1, 1.4, 2, 1.0);
      hooks.emit('throw', { x: e.x, y: e.y });
    }
  },
};

export function snapshotBoss(s) {
  const b = s.enemies.find((e) => e.boss);
  return {
    BM: s.marks.map((m) => [m.col, m.row, m.t, m.max]),
    bs: b ? [b.kind, b.hp, b.maxHp] : null,
    bk: s.bossKills,
    rk: s.raiderKilled ? 1 : 0,
  };
}
