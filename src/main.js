import { PLAYER_SPEED, SWING_CD, START_POS, REACH, WATER_SLOWDOWN, HELM, CARDS, PERKS, SKINS, DIFFICULTY, clampToDeck, shotPos } from './const.js';
import { createState, resetState, step, swing, snapshot, newPlayer, hostPlayCard, hostPickChest, requestNitro, applyPerks, skipCut, hostThrow, hostRage } from './sim.js';
import { cutCues, skipButton, SKIP_HOLD } from './cutscene.js';
import { loadProgress, saveProgress, shellsFor, perkCost, buyPerk, pickSkin, skinColor, mergePerks } from './progress.js';
import { computeCamera, screenToWorld, createFx, applyEvent, render, cardLayout, nitroButton, rageButton } from './render.js';
import { createInput } from './input.js';
import { connect } from './net.js';
import { sfx } from './sfx.js';

const params = new URLSearchParams(location.search);
const NET_MODE = params.get('net') === 'local' ? 'local' : 'p2p';
const SIM_STEP = 1 / 60;
const SEND_EVERY = 33; // мс, ~30 пакетов в секунду
const ISLAND = Number(params.get('island')) || undefined; // ?island=60 — короткий путь для отладки

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const fx = createFx();

let cam;
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  cam = computeCamera(innerWidth, innerHeight);
  cam.dpr = dpr;
}
addEventListener('resize', resize);
resize();

// Тап по карте внизу экрана не должен превращаться в джойстик или удар.
input.setHitTest((x, y) => {
  if (G.role && G.view?.cut) {
    // Во время кат-сцены работает только кнопка пропуска (её надо удерживать)
    const b = skipButton(cam);
    return Math.hypot(x - b.x, y - b.y) < b.r + 12 ? 'skip' : 'cut';
  }
  if (!G.role || !G.view?.hand) return -1;
  const nb = nitroButton(cam);
  if ((G.view.ni > 0 || G.view.nT > 0) && Math.hypot(x - nb.x, y - nb.y) < nb.r + 8) return 'nitro';
  const rb = rageButton(cam);
  const mine = G.view.P?.[G.myKey];
  // кнопка ярости ловит касание, только когда шкала полная — иначе там работает джойстик
  if (mine && mine[11] >= 100 && !(mine[12] > 0) && Math.hypot(x - rb.x, y - rb.y) < rb.r + 8) return 'rage';
  return cardLayout(cam).cards.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 6 && y <= r.y + r.h + 6);
});

// Прогресс этого телефона: ракушки, улучшения, раскраска ракетки
const P = loadProgress();
try { P.best = Math.max(P.best, Number(localStorage.getItem('lodka-best') || 0)); } catch {}

// iOS Safari игнорирует user-scalable=no, поэтому глушим зум жестами вручную.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault();
}, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { // двойной тап
  const now = Date.now();
  if (now - lastTouchEnd < 350 && e.target.tagName !== 'INPUT') e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// ---------- Состояние сессии ----------
const G = {
  role: null, // 'host' | 'guest' | 'solo'
  waitingAs: null,
  myKey: 'h',
  room: null,
  code: '',
  peerId: null,
  actions: null,
  state: null, // только у хоста
  view: null,
  viewAt: 0,
  outEvents: [],
  lastSend: 0,
  lastResets: 0,
  ping: null,
  hint: 0,
  overShown: false,
  me: null,
};

if (NET_MODE === 'local') window.__G = G; // для отладки в dev.html

function resetMe() {
  const p = START_POS[G.myKey];
  G.me = { key: G.myKey, x: p.x, y: p.y, fx: 0, fy: -1, swingAge: 9, sdx: 0, sdy: -1, lastSwing: -9, steer: 0, skin: skinColor(P) };
}

// ---------- Экраны ----------
const screens = ['menu', 'wait', 'overlay', 'shop', 'settings'];
function show(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
}

function genCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}

function goMobile() {
  sfx.init();
  if (matchMedia('(pointer: coarse)').matches) {
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    screen.orientation?.lock?.('portrait').catch(() => {});
  }
  navigator.wakeLock?.request('screen').catch(() => {});
}

function setupActions(room) {
  const a = {
    start: room.action('start'),
    state: room.action('st'),
    input: room.action('in'),
    swing: room.action('sw'),
    cmd: room.action('cmd'),
  };
  a.start.on((d, id) => {
    if (G.waitingAs !== 'guest' || G.role) return;
    G.peerId = id;
    startGame('guest');
  });
  a.state.on((snap, id) => {
    if (G.role !== 'guest' || id !== G.peerId) return;
    G.view = snap;
    G.viewAt = performance.now();
    for (const ev of snap.ev || []) onEvent(ev);
  });
  a.input.on((d, id) => {
    const g = G.state?.players.g;
    if (G.role !== 'host' || id !== G.peerId || !g) return;
    [g.x, g.y, g.fx, g.fy, g.steer = 0] = d;
    g.full = !!d[5];
  });
  a.swing.on((d, id) => {
    if (G.role !== 'host' || id !== G.peerId || !G.state.players.g) return;
    swing(G.state, 'g', d[0], d[1], 0.08); // небольшая фора на задержку сети
  });
  a.cmd.on((d, id) => {
    if (G.role !== 'host' || id !== G.peerId) return;
    if (d.c === 'restart' && G.state.phase !== 'play') restart();
    else if (d.c === 'card') hostPlayCard(G.state, 'g', d.i, d.id);
    else if (d.c === 'pick') hostPickChest(G.state, d.k, 'g');
    else if (d.c === 'nitro') requestNitro(G.state, 'g');
    else if (d.c === 'skip') skipCut(G.state);
    else if (d.c === 'throw') hostThrow(G.state, 'g', d.dx || 0, d.dy || 0);
    else if (d.c === 'rage') hostRage(G.state, 'g');
    else if (d.c === 'perks') {
      // Улучшения и раскраска гостя: берём лучшее из двух
      G.guestPerks = d.perks || {};
      G.guestSkin = d.skin || '';
      if (G.state.players.g) G.state.players.g.skin = G.guestSkin;
      Object.assign(G.state.opts, gameOpts());
      if (G.state.t < 10) applyPerks(G.state, G.state.opts.perks);
    }
  });
  return a;
}

async function openRoom(code, as) {
  goMobile();
  G.code = code;
  G.waitingAs = as;
  $('wait-code').textContent = code;
  $('wait-title').textContent = as === 'host' ? 'Код комнаты' : 'Входим в комнату';
  $('wait-hint').textContent = as === 'host'
    ? 'Скажи код напарнику или отправь ему ссылку'
    : 'Ждём, пока напарник создаст комнату с этим кодом';
  $('btn-share').classList.toggle('hidden', as !== 'host');
  $('btn-wait-solo').classList.toggle('hidden', as !== 'host');
  setStatus('Подключаемся к сети…');
  show('wait');
  history.replaceState(null, '', '#' + code);

  let room;
  try {
    room = await connect(code, NET_MODE);
  } catch (err) {
    console.error(err);
    setStatus('Не удалось загрузить сетевой модуль. Проверь интернет.');
    return;
  }
  if (G.waitingAs !== as || G.code !== code) { room.leave(); return; } // пока грузились, нажали «Назад»
  G.room = room;
  G.actions = setupActions(room);
  setStatus(as === 'host' ? 'Ждём напарника…' : 'Ищем комнату…');
  const slow = setTimeout(() => {
    if (!G.role) setStatus('Долго… Проверьте, что код совпадает и у обоих есть интернет.');
  }, 15000);

  room.onJoin((id) => {
    clearTimeout(slow);
    if (G.peerId && G.peerId !== id) return; // третий лишний
    if (as === 'host' && G.role !== 'guest') {
      G.peerId = id;
      G.actions.start.send({ v: 1 }, id);
      if (G.role === 'solo' || G.role === 'host') addGuest();
      else startGame('host');
    } else if (as === 'guest') {
      setStatus('Нашли напарника, начинаем…');
    }
  });
  room.onLeave((id) => { if (id === G.peerId) peerLost(); });
}

function setStatus(text) { $('wait-status').textContent = text; }

// Настройки забега для хоста: улучшения (лучшее из двух игроков) и раскраски ракеток.
function gameOpts() {
  const duo = G.role === 'host';
  return {
    island: ISLAND,
    difficulty: P.difficulty, // сложность всегда хоста
    perks: duo ? mergePerks(P.perks, G.guestPerks) : P.perks,
    skins: { h: skinColor(P), g: duo ? G.guestSkin : '' },
  };
}

function startGame(role) {
  G.role = role;
  G.waitingAs = null;
  G.myKey = role === 'guest' ? 'g' : 'h';
  G.overShown = false;
  G.hint = 5;
  resetMe();
  if (role !== 'guest') {
    G.state = createState(role === 'solo', gameOpts());
    G.view = snapshot(G.state);
  } else {
    G.view = null;
    G.viewAt = performance.now();
    G.actions.cmd.send({ c: 'perks', perks: P.perks, skin: skinColor(P) }, G.peerId);
  }
  show(null);
}

// Хост играл один и дождался напарника — добавляем его прямо в текущую игру.
function addGuest() {
  G.role = 'host';
  G.state.solo = false;
  G.state.players.g = newPlayer('g', G.guestSkin);
  G.state.banner = 'Напарник на борту!';
  G.state.bannerT = 2;
  show(G.state.phase === 'over' ? 'overlay' : null);
}

function restart() {
  Object.assign(G.state.opts, gameOpts());
  resetState(G.state);
  G.outEvents = [];
  resetMe();
  G.overShown = false;
  show(null);
}

function peerLost() {
  G.peerId = null;
  if (G.role === 'host') {
    G.state.players.g = null;
    G.state.solo = true;
    G.role = 'solo';
    showOverlay('Напарник отключился', 'Можно продолжить одному или вернуться в меню.', 'Играть одному', () => show(null));
  } else if (G.role === 'guest') {
    G.role = null;
    showOverlay('Хост отключился', 'Связь с напарником потеряна.', null);
  }
}

function showOverlay(title, textHtml, btnText, onBtn) {
  $('ov-title').textContent = title;
  $('ov-text').innerHTML = textHtml;
  const btn = $('ov-btn');
  btn.classList.toggle('hidden', !btnText);
  btn.textContent = btnText || '';
  btn.onclick = onBtn || null;
  show('overlay');
}

function toMenu() {
  G.room?.leave();
  Object.assign(G, { role: null, waitingAs: null, room: null, peerId: null, state: null, view: null, code: '', ping: null });
  history.replaceState(null, '', location.pathname + location.search);
  show('menu');
}

function gameOver(view) {
  G.overShown = true;
  const gained = shellsFor(view);
  P.shells += gained;
  P.best = Math.max(P.best, view.sc);
  saveProgress(P);
  updateShopButton();
  const best = P.best;
  const win = view.ph === 'win';
  const title = win ? 'ОСТРОВ!' : 'Лодка затонула';
  const text = (win ? 'Остров, остров — ужин готов! 🍗<br><br>' : `Проплыли <b>${Math.round((view.di / view.isl) * 100)}%</b> пути, волна <b>${view.w}</b><br>`)
    + `Очки: <b>${view.sc}</b> · Рекорд: <b>${best}</b><br>`
    + `Боссов: <b>${view.bk || 0}</b>${view.rk ? ' · рейдеры потоплены' : ''}<br>Сложность: <b>${DIFFICULTY[view.df]?.name || '—'}</b>`
    + `<br><br>+<b>${gained}</b> 🐚 (всего ${P.shells})`;
  const again = G.role === 'guest' ? () => G.actions.cmd.send({ c: 'restart' }, G.peerId) : restart;
  showOverlay(title, text, win ? 'Плыть снова' : 'Ещё раз', again);
}

// ---------- Кат-сцены: звуки по таймлайну и пропуск удержанием кнопки ----------
G.skipHold = 0;
G.cutPrev = null;
function handleCut(view, age, dt) {
  if (!view.cut) { G.cutPrev = null; G.skipHold = 0; return; }
  const [id, t0] = view.cut;
  const t = t0 + age;
  const prev = G.cutPrev && G.cutPrev.id === id ? G.cutPrev.t : -1;
  for (const type of cutCues(id, prev, t)) sfx.event({ type });
  G.cutPrev = { id, t };
  if (input.skipHeld()) {
    G.skipHold += dt;
    if (G.skipHold >= SKIP_HOLD) {
      G.skipHold = 0;
      if (G.role === 'guest') G.actions.cmd.send({ c: 'skip' }, G.peerId);
      else skipCut(G.state);
    }
  } else G.skipHold = 0;
}

// ---------- Карты и сундук ----------
function handleCards(view) {
  for (const i of input.takeCards()) {
    if (i === 'rage') {
      if (view.ph === 'play') {
        if (G.role === 'guest') G.actions.cmd.send({ c: 'rage' }, G.peerId);
        else hostRage(G.state, 'h');
      }
      continue;
    }
    if (i === 'nitro') {
      if (view.ni > 0 && view.ph === 'play') {
        if (G.role === 'guest') G.actions.cmd.send({ c: 'nitro' }, G.peerId);
        else requestNitro(G.state, 'h');
      }
      continue;
    }
    const card = view.hand?.[i];
    if (!card || view.ph !== 'play' || view.ch) continue;
    const [id] = card;
    G.pressed = { i, until: performance.now() + 150 };
    if (view.el < CARDS[id].cost) {
      sfx.nope();
      applyEvent(fx, { type: 'nope', x: G.me.x, y: G.me.y });
      continue;
    }
    if (G.role === 'guest') G.actions.cmd.send({ c: 'card', i, id }, G.peerId);
    else hostPlayCard(G.state, 'h', i, id);
  }
}

let chestKey = '';
function updateChest(view) {
  const box = $('chest');
  const ch = view && view.ph === 'play' && G.role ? view.ch : null;
  if (!ch) {
    if (!box.classList.contains('hidden')) box.classList.add('hidden');
    chestKey = '';
    return;
  }
  const key = ch.o.map((o) => o.title).join('|');
  if (key !== chestKey) {
    chestKey = key;
    const list = $('chest-options');
    list.innerHTML = '';
    ch.o.forEach((o, k) => {
      const b = document.createElement('button');
      b.className = 'chest-opt';
      b.innerHTML = `<span class="ico"></span><span><div class="t"></div><div class="d"></div></span>`;
      b.querySelector('.ico').textContent = o.icon;
      b.querySelector('.t').textContent = o.title;
      b.querySelector('.d').textContent = o.desc;
      b.onclick = () => {
        if (G.role === 'guest') G.actions.cmd.send({ c: 'pick', k }, G.peerId);
        else hostPickChest(G.state, k, 'h');
      };
      list.appendChild(b);
    });
    box.classList.remove('hidden');
  }
  $('chest-timer').textContent = `Автовыбор через ${Math.max(0, Math.ceil(ch.t))} с`;
}

function onEvent(ev) {
  applyEvent(fx, ev);
  sfx.event(ev);
}

// ---------- Управление своим игроком ----------
function nearestThreat(view, age) {
  let best = null, bd = Infinity;
  for (const s of view.S) {
    const [, owner, , , x0, y0, tx, ty, t, dur, arc, passTo] = s;
    if (owner !== 'e' && passTo !== G.myKey) continue;
    const p = shotPos({ x0, y0, tx, ty, dur, arc }, t + age);
    const d = Math.hypot(p.x - G.me.x, p.y - G.me.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) return best;
  // Снарядов нет — тянемся к ближайшей доске в воде
  for (const [, x, y] of view.D || []) {
    const d = Math.hypot(x - G.me.x, y - G.me.y);
    if (d < REACH + 0.6 && d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

function updateMe(dt, now, view, age) {
  const me = G.me;
  const v = input.moveVec();
  const speed = PLAYER_SPEED * (1 - WATER_SLOWDOWN * (view.wa || 0) / 100); // по колено в воде бегать тяжелее
  // У штурвала джойстик влево-вправо рулит лодкой; вниз — отойти от штурвала.
  const atHelm = Math.hypot(me.x - HELM.x, me.y - HELM.y) < HELM.r && v.y < 0.5;
  if (atHelm) {
    me.steer = Math.abs(v.x) > 0.15 ? v.x : 0;
    me.full = v.y < -0.5; // джойстик вверх — полный ход (быстрее, но громко)
    me.x += (HELM.x - me.x) * Math.min(1, dt * 12);
    me.y += Math.max(0, v.y) * speed * dt;
    if (me.swingAge > 0.25) { me.fx = 0; me.fy = -1; }
  } else {
    me.steer = 0;
    me.full = false;
    me.x += v.x * speed * dt;
    me.y += v.y * speed * dt;
  }
  me.atHelm = atHelm;
  clampToDeck(me);
  me.swingAge += dt;
  if (!atHelm && Math.hypot(v.x, v.y) > 0.2 && me.swingAge > 0.25) {
    const l = Math.hypot(v.x, v.y);
    me.fx = v.x / l; me.fy = v.y / l;
  }

  const mine = view.P?.[G.myKey];
  const thrown = !!mine?.[13];
  const rageOn = (mine?.[12] || 0) > 0;
  for (const sw of input.takeSwings()) {
    if (view.ph !== 'play') continue;
    if (sw.type === 'throw' || sw.type === 'throwPoint') {
      // Бросок ракетки: к курсору или автоприцел в ближайшего врага (dx = dy = 0)
      let tx = 0, ty = 0;
      if (sw.type === 'throwPoint') { const w = screenToWorld(cam, sw.sx, sw.sy); tx = w.x - me.x; ty = w.y - me.y; }
      if (G.role === 'guest') G.actions.cmd.send({ c: 'throw', dx: tx, dy: ty }, G.peerId);
      else hostThrow(G.state, 'h', tx, ty);
      continue;
    }
    if (thrown || now / 1000 - me.lastSwing < SWING_CD * (rageOn ? 0.5 : 1)) continue;
    let dx, dy;
    if (sw.type === 'dir') { dx = sw.dx; dy = sw.dy; }
    else if (sw.type === 'point') {
      const w = screenToWorld(cam, sw.sx, sw.sy);
      dx = w.x - me.x; dy = w.y - me.y;
    } else {
      const t = nearestThreat(view, age);
      if (t) { dx = t.x - me.x; dy = t.y - me.y; } else { dx = me.fx; dy = me.fy; }
    }
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    me.lastSwing = now / 1000;
    me.swingAge = 0;
    me.sdx = dx; me.sdy = dy;
    me.fx = dx; me.fy = dy;
    if (G.role === 'guest') G.actions.swing.send([dx, dy], G.peerId);
    else swing(G.state, 'h', dx, dy);
    sfx.swing();
  }
}

// ---------- Главный цикл ----------
let last = performance.now();
let acc = 0;
let time = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  let view = G.view;
  let age = 0;

  if (G.role === 'host' || G.role === 'solo') {
    const s = G.state;
    if (view.cut) input.clear(); else updateMe(dt, now, view, 0);
    const p = s.players.h;
    p.x = G.me.x; p.y = G.me.y; p.fx = G.me.fx; p.fy = G.me.fy; p.steer = G.me.steer; p.full = G.me.full;
    acc += dt;
    while (acc >= SIM_STEP) { step(s, SIM_STEP); acc -= SIM_STEP; }
    for (const ev of s.events) {
      onEvent(ev);
      if (G.peerId) G.outEvents.push(ev);
    }
    s.events.length = 0;
    view = G.view = snapshot(s);
    if (G.peerId && now - G.lastSend >= SEND_EVERY) {
      G.lastSend = now;
      G.actions.state.send({ ...view, ev: G.outEvents }, G.peerId);
      G.outEvents = [];
    }
  } else if (G.role === 'guest') {
    age = (now - G.viewAt) / 1000;
    if (!view) {
      if (age > 20) peerLost();
    } else {
      if (view.rs !== G.lastResets) {
        G.lastResets = view.rs;
        resetMe();
        G.overShown = false;
        show(null);
      }
      if (view.cut) input.clear(); else updateMe(dt, now, view, age);
      if (now - G.lastSend >= SEND_EVERY) {
        G.lastSend = now;
        const r = (n) => Math.round(n * 1000) / 1000;
        G.actions.input.send([r(G.me.x), r(G.me.y), r(G.me.fx), r(G.me.fy), r(G.me.steer), G.me.full ? 1 : 0], G.peerId);
      }
      // Настоящий разрыв ловит room.onLeave; тут только предупреждаем о задержке (хост свернул игру и т.п.)
      if (age > 1.5) view = { ...view, ban: 'Связь прерывается…' };
    }
  }

  if (view && G.role) handleCut(view, age, dt);
  if (view && G.role && !view.cut) handleCards(view);
  updateChest(view);
  if (view && (view.ph === 'over' || view.ph === 'win') && !G.overShown && G.role) gameOver(view);
  if (G.role) G.hint = Math.max(0, G.hint - dt);

  const hud = {
    status: (G.role === 'solo' ? (G.code ? `Комната ${G.code} · ждём напарника` : 'Тренировка')
      : G.code ? `Комната ${G.code}${G.ping != null ? ' · ' + Math.round(G.ping) + ' мс' : ''}` : '')
      + (view && DIFFICULTY[view.df] ? ` · ${DIFFICULTY[view.df].name}` : ''),
    hint: G.hint,
    pressed: G.pressed && performance.now() < G.pressed.until ? G.pressed.i : -1,
    myKey: G.myKey,
    skip: G.skipHold / SKIP_HOLD,
  };
  render(ctx, cam, view || idleView, age, G.role && view ? G.me : null, fx, time, dt, hud,
    G.role ? input.joystick() : null);
}

// Пустое море на фоне меню
const idleView = { el: 0, hand: null, ph: 'menu', w: 1, sc: 0, wa: 0, pl: 0, H: [], PT: [], D: [], R: [], WP: [], bx: 0, di: 0, st: -30, isl: 450, P: { h: null, g: null }, E: [], S: [], ban: null };

setInterval(async () => {
  if (!G.room || !G.peerId || NET_MODE === 'local') return;
  try { G.ping = await G.room.ping(G.peerId); } catch {}
}, 2000);

// ---------- Кнопки меню ----------
$('btn-create').onclick = () => openRoom(genCode(), 'host');
$('btn-join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length !== 4) { $('code').focus(); $('code').classList.add('shake'); setTimeout(() => $('code').classList.remove('shake'), 400); return; }
  openRoom(code, 'guest');
};
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('btn-solo').onclick = () => { goMobile(); G.code = ''; startGame('solo'); };

// ---------- Магазин ----------
function updateShopButton() { $('btn-shop').textContent = `Магазин · ${P.shells} 🐚`; }

function renderShop() {
  $('shop-shells').textContent = `${P.shells} 🐚`;
  const list = $('shop-list');
  list.innerHTML = '';
  const row = (icon, title, desc, price, onBuy, state) => {
    const b = document.createElement('button');
    b.className = 'chest-opt shop-item' + (state === 'done' ? ' done' : '');
    b.innerHTML = '<span class="ico"></span><span class="txt"><div class="t"></div><div class="d"></div></span><span class="price"></span>';
    b.querySelector('.ico').textContent = icon;
    b.querySelector('.t').textContent = title;
    b.querySelector('.d').textContent = desc;
    b.querySelector('.price').textContent = price;
    b.onclick = () => { if (onBuy()) { sfx.event({ type: 'chest' }); renderShop(); updateShopButton(); } else sfx.nope(); };
    list.appendChild(b);
  };
  const head = (text) => { const h = document.createElement('p'); h.className = 'label'; h.textContent = text; list.appendChild(h); };
  head('Улучшения');
  for (const [id, perk] of Object.entries(PERKS)) {
    const lvl = P.perks[id] || 0;
    const cost = perkCost(P, id);
    row(perk.icon, `${perk.name} ${'★'.repeat(lvl)}${'☆'.repeat(perk.max - lvl)}`, perk.desc(Math.min(perk.max, lvl + (cost == null ? 0 : 1))),
      cost == null ? 'макс' : `${cost} 🐚`, () => buyPerk(P, id), cost == null ? 'done' : '');
  }
  head('Ракетка');
  SKINS.forEach((skin, i) => {
    const owned = P.owned.includes(i);
    row('🏓', skin.name, P.skin === i ? 'Выбрана' : owned ? 'Нажми, чтобы выбрать' : 'Новая раскраска',
      P.skin === i ? '✓' : owned ? '' : `${skin.cost} 🐚`, () => pickSkin(P, i), P.skin === i ? 'done' : '');
  });
}
$('btn-shop').onclick = () => { sfx.init(); renderShop(); show('shop'); };

// ---------- Настройки: уровень сложности ----------
function updateSettingsButton() { $('btn-settings').textContent = `Настройки · ${DIFFICULTY[P.difficulty].name}`; }

function renderSettings() {
  const list = $('difficulty-list');
  list.innerHTML = '';
  for (const [id, d] of Object.entries(DIFFICULTY)) {
    const b = document.createElement('button');
    b.className = 'chest-opt shop-item' + (P.difficulty === id ? ' selected' : '');
    b.innerHTML = '<span class="ico"></span><span class="txt"><div class="t"></div><div class="d"></div></span><span class="price"></span>';
    b.querySelector('.ico').textContent = d.icon;
    b.querySelector('.t').textContent = d.name;
    b.querySelector('.d').textContent = d.desc;
    b.querySelector('.price').textContent = P.difficulty === id ? '✓' : '';
    b.onclick = () => {
      P.difficulty = id;
      saveProgress(P);
      sfx.event({ type: 'card' });
      renderSettings();
      updateSettingsButton();
    };
    list.appendChild(b);
  }
}
$('btn-settings').onclick = () => { sfx.init(); renderSettings(); show('settings'); };
$('settings-back').onclick = () => show('menu');
updateSettingsButton();
$('shop-back').onclick = () => show('menu');
updateShopButton();
$('btn-cancel').onclick = toMenu;
$('ov-menu').onclick = toMenu;
$('btn-wait-solo').onclick = () => startGame('solo'); // комната остаётся открытой, напарник может зайти позже
$('btn-share').onclick = async () => {
  const url = location.origin + location.pathname + location.search + '#' + G.code;
  try {
    if (navigator.share) await navigator.share({ title: 'Двое в лодке', text: `Плывём! Код комнаты: ${G.code}`, url });
    else { await navigator.clipboard.writeText(url); $('btn-share').textContent = 'Ссылка скопирована ✓'; }
  } catch {}
};

// Ссылка вида …/#ABCD — подставляем код
const hashCode = location.hash.slice(1).toUpperCase();
if (/^[A-Z0-9]{4}$/.test(hashCode)) {
  $('code').value = hashCode;
  $('btn-join').classList.add('pulse');
}

// Автостарт для отладки: ?auto=host|guest|solo&code=XXXX
const auto = params.get('auto');
if (auto === 'host') openRoom(params.get('code') || genCode(), 'host');
else if (auto === 'guest') openRoom(params.get('code'), 'guest');
else if (auto === 'solo') startGame('solo');

document.fonts?.load('16px "Press Start 2P"').catch(() => {});
requestAnimationFrame(frame);
window.__booted = true;
