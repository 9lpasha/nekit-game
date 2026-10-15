import { PLAYER_SPEED, SWING_CD, START_POS, REACH, WATER_SLOWDOWN, HELM, clampToDeck, shotPos } from './const.js';
import { createState, resetState, step, swing, snapshot, newPlayer } from './sim.js';
import { computeCamera, screenToWorld, createFx, applyEvent, render } from './render.js';
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
  G.me = { key: G.myKey, x: p.x, y: p.y, fx: 0, fy: -1, swingAge: 9, sdx: 0, sdy: -1, lastSwing: -9, steer: 0 };
}

// ---------- Экраны ----------
const screens = ['menu', 'wait', 'overlay'];
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
  });
  a.swing.on((d, id) => {
    if (G.role !== 'host' || id !== G.peerId || !G.state.players.g) return;
    swing(G.state, 'g', d[0], d[1], 0.08); // небольшая фора на задержку сети
  });
  a.cmd.on((d) => {
    if (G.role === 'host' && d.c === 'restart' && G.state.phase === 'over') restart();
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

function startGame(role) {
  G.role = role;
  G.waitingAs = null;
  G.myKey = role === 'guest' ? 'g' : 'h';
  G.overShown = false;
  G.hint = 5;
  resetMe();
  if (role !== 'guest') {
    G.state = createState(role === 'solo', { island: ISLAND });
    G.view = snapshot(G.state);
  } else {
    G.view = null;
    G.viewAt = performance.now();
  }
  show(null);
}

// Хост играл один и дождался напарника — добавляем его прямо в текущую игру.
function addGuest() {
  G.role = 'host';
  G.state.solo = false;
  G.state.players.g = newPlayer('g');
  G.state.banner = 'Напарник на борту!';
  G.state.bannerT = 2;
  show(G.state.phase === 'over' ? 'overlay' : null);
}

function restart() {
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
  let best = 0;
  try {
    best = Number(localStorage.getItem('lodka-best') || 0);
    if (view.sc > best) { best = view.sc; localStorage.setItem('lodka-best', String(best)); }
  } catch {}
  const win = view.ph === 'win';
  const title = win ? 'ОСТРОВ!' : 'Лодка затонула';
  const text = (win ? 'Остров, остров — ужин готов! 🍗<br><br>' : `Проплыли <b>${Math.round((view.di / view.isl) * 100)}%</b> пути, волна <b>${view.w}</b><br>`)
    + `Очки: <b>${view.sc}</b> · Рекорд: <b>${best}</b>`;
  const again = G.role === 'guest' ? () => G.actions.cmd.send({ c: 'restart' }, G.peerId) : restart;
  showOverlay(title, text, win ? 'Плыть снова' : 'Ещё раз', again);
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
    me.x += (HELM.x - me.x) * Math.min(1, dt * 12);
    me.y += Math.max(0, v.y) * speed * dt;
    if (me.swingAge > 0.25) { me.fx = 0; me.fy = -1; }
  } else {
    me.steer = 0;
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

  for (const sw of input.takeSwings()) {
    if (now / 1000 - me.lastSwing < SWING_CD || view.ph !== 'play') continue;
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
    updateMe(dt, now, view, 0);
    const p = s.players.h;
    p.x = G.me.x; p.y = G.me.y; p.fx = G.me.fx; p.fy = G.me.fy; p.steer = G.me.steer;
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
      updateMe(dt, now, view, age);
      if (now - G.lastSend >= SEND_EVERY) {
        G.lastSend = now;
        const r = (n) => Math.round(n * 1000) / 1000;
        G.actions.input.send([r(G.me.x), r(G.me.y), r(G.me.fx), r(G.me.fy), r(G.me.steer)], G.peerId);
      }
      // Настоящий разрыв ловит room.onLeave; тут только предупреждаем о задержке (хост свернул игру и т.п.)
      if (age > 1.5) view = { ...view, ban: 'Связь прерывается…' };
    }
  }

  if (view && (view.ph === 'over' || view.ph === 'win') && !G.overShown && G.role) gameOver(view);
  if (G.role) G.hint = Math.max(0, G.hint - dt);

  const hud = {
    status: G.role === 'solo' ? (G.code ? `Комната ${G.code} · ждём напарника` : 'Тренировка')
      : G.code ? `Комната ${G.code}${G.ping != null ? ' · ' + Math.round(G.ping) + ' мс' : ''}` : '',
    hint: G.hint,
  };
  render(ctx, cam, view || idleView, age, G.role && view ? G.me : null, fx, time, dt, hud,
    G.role ? input.joystick() : null);
}

// Пустое море на фоне меню
const idleView = { ph: 'menu', w: 1, sc: 0, wa: 0, pl: 0, H: [], PT: [], D: [], R: [], WP: [], bx: 0, di: 0, st: -30, isl: 450, P: { h: null, g: null }, E: [], S: [], ban: null };

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
