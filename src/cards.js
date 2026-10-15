// Карты, эликсир и сундуки (как в Clash Royale, но колода общая на двоих).
// Считает только хост; гость присылает «сыграл карту i» и «выбрал награду k».
import {
  BOAT, CARDS, START_DECK, ELIXIR_MAX, ELIXIR_RATE, START_ELIXIR, HAND_SIZE, MAX_CARD_LEVEL, dist,
} from './const.js';

const rand = (a, b) => a + Math.random() * (b - a);
const CHEST_TIME = 10;
const TURRET_SPOTS = [
  { x: BOAT.x + 0.55, y: BOAT.y + 4.3 },
  { x: BOAT.x + BOAT.w - 0.55, y: BOAT.y + 4.3 },
  { x: BOAT.x + 0.55, y: BOAT.y + 7.8 },
  { x: BOAT.x + BOAT.w - 0.55, y: BOAT.y + 7.8 },
];

export function initCards(s) {
  Object.assign(s, {
    elixir: START_ELIXIR,
    levels: Object.fromEntries(START_DECK.map((id) => [id, 1])),
    queue: shuffle([...START_DECK]), // первые HAND_SIZE — рука, дальше — очередь
    turrets: [],
    shieldT: 0,
    freezeT: 0,
    chest: null,
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// hooks: { emit, patchHole(), addPlanks(n), addWater(n) }
export function updateCards(s, dt, hooks) {
  s.elixir = Math.min(ELIXIR_MAX, s.elixir + ELIXIR_RATE * dt);
  s.shieldT = Math.max(0, s.shieldT - dt);
  s.freezeT = Math.max(0, s.freezeT - dt);

  for (const t of s.turrets) {
    t.t -= dt;
    t.cd -= dt;
    if (t.cd > 0) continue;
    let target = null, bd = 9;
    for (const e of s.enemies) {
      const d = dist(t.x, t.y, e.x, e.y);
      if (d < bd) { bd = d; target = e; }
    }
    if (!target) continue;
    t.cd = 1.25 - 0.15 * t.lvl;
    s.shots.push(friendlyShot(s, t.x, t.y - 0.5, target, { kind: 'turret', dmg: 1, speed: 9, arc: 0.4 }));
    hooks.emit('tshot', { x: t.x, y: t.y });
  }
  s.turrets = s.turrets.filter((t) => t.t > 0);
}

// Снаряд «союзника» (башенки или бомбы): летит в цель, игроки его не отбивают.
function friendlyShot(s, x, y, target, { kind, dmg, speed, arc, smash = false }) {
  return {
    id: s.nextId++, owner: 't', kind, charge: 1, dmg, smash,
    x0: x, y0: y, tx: target.x, ty: target.y, x, y, z: 0,
    t: 0, dur: Math.max(0.25, dist(x, y, target.x, target.y) / speed), arc,
    targetId: target.id ?? null,
  };
}

export function playCard(s, key, i, id, hooks) {
  if (s.phase !== 'play' || s.chest) return false;
  if (i < 0 || i >= HAND_SIZE || s.queue[i] !== id) return false;
  const card = CARDS[id];
  if (s.elixir < card.cost) return false;
  const lvl = s.levels[id];
  const p = s.players[key] || { x: BOAT.x + BOAT.w / 2, y: BOAT.y + 6 };

  switch (id) {
    case 'turret': {
      const free = TURRET_SPOTS.find((sp) => !s.turrets.some((t) => t.x === sp.x && t.y === sp.y));
      const dur = 10 + 5 * lvl;
      if (free) s.turrets.push({ id: s.nextId++, ...free, t: dur, max: dur, cd: 0.5, lvl });
      else { const old = s.turrets.reduce((a, b) => (a.t < b.t ? a : b)); old.t = old.max = dur; old.lvl = lvl; }
      break;
    }
    case 'shield': s.shieldT = 3 + 2 * lvl; break;
    case 'freeze': s.freezeT = 2 + 1.5 * lvl; break;
    case 'bomb': {
      // Цель — враг, у которого больше всего соседей в радиусе взрыва
      let best = null, bn = -1;
      for (const e of s.enemies) {
        const n = s.enemies.filter((o) => dist(o.x, o.y, e.x, e.y) < 2.3).length;
        if (n > bn) { bn = n; best = e; }
      }
      if (!best) return false; // некого взрывать — карту не тратим
      s.shots.push(friendlyShot(s, BOAT.x + BOAT.w / 2, BOAT.y + 5, best, { kind: 'bomb', dmg: 2 + lvl, speed: 7, arc: 3, smash: true }));
      break;
    }
    case 'repair':
      for (let n = 0; n < lvl + 1; n++) hooks.patchHole();
      hooks.addWater(-10 * lvl);
      break;
    case 'gull':
      hooks.addPlanks(1 + lvl);
      break;
  }

  s.elixir -= card.cost;
  s.queue.splice(i, 1);
  s.queue.push(id); // сыгранная карта уходит в конец очереди
  hooks.emit('card', { id, key, x: p.x, y: p.y, lvl });
  return true;
}

// ---------- Сундук после волны ----------
export function openChest(s) {
  const pool = [];
  for (const id of Object.keys(CARDS)) {
    if (!(id in s.levels)) pool.push({ type: 'new', id });
    else if (s.levels[id] < MAX_CARD_LEVEL) pool.push({ type: 'up', id });
  }
  shuffle(pool);
  const options = pool.slice(0, 2);
  options.push(Math.random() < 0.5 ? { type: 'planks', n: 3 } : { type: 'elixir' });
  shuffle(options);
  s.chest = { options, t: CHEST_TIME };
}

export function pickChest(s, k, key, hooks) {
  if (!s.chest) return;
  const o = s.chest.options[k] || s.chest.options[0];
  const title = optionText(s, o).title; // до применения: уровень улучшения считается от текущего
  if (o.type === 'new') {
    s.levels[o.id] = 1;
    s.queue.splice(HAND_SIZE, 0, o.id); // новая карта — следующей в руку
  } else if (o.type === 'up') s.levels[o.id]++;
  else if (o.type === 'planks') hooks.addPlanks(o.n);
  else if (o.type === 'elixir') s.elixir = ELIXIR_MAX;
  s.chest = null;
  hooks.emit('chest', { title, key });
}

function optionText(s, o) {
  if (o.type === 'new') return { icon: CARDS[o.id].icon, title: 'Новая карта: ' + CARDS[o.id].name, desc: CARDS[o.id].desc(1) };
  if (o.type === 'up') {
    const l = s.levels[o.id] + (s.chest ? 1 : 0);
    return { icon: CARDS[o.id].icon, title: `${CARDS[o.id].name} ${'★'.repeat(l)}`, desc: CARDS[o.id].desc(l) };
  }
  if (o.type === 'planks') return { icon: '🪵', title: `+${o.n} доски`, desc: 'Сразу в запас' };
  return { icon: '💧', title: 'Полный эликсир', desc: 'Шкала эликсира до краёв' };
}

export function snapshotCards(s) {
  return {
    el: s.elixir,
    hand: s.queue.slice(0, HAND_SIZE).map((id) => [id, s.levels[id]]),
    nx: s.queue[HAND_SIZE] || '',
    shT: s.shieldT,
    frT: s.freezeT,
    T: s.turrets.map((t) => [t.id, t.x, t.y, t.t, t.max]),
    ch: s.chest ? { t: s.chest.t, o: s.chest.options.map((o) => optionText(s, o)) } : null,
  };
}
