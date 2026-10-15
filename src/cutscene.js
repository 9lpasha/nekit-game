// Кат-сцены: вступление, появление боссов и финал на острове.
// Картинка рисуется в пиксельный буфер (см. cut/gfx.js) и растягивается без сглаживания,
// а титры, карточки боссов и кнопка пропуска — поверх, в полном разрешении.
// Время t приходит от хоста, поэтому у обоих игроков всё синхронно.
import { CUT_TIME } from './const.js';
import {
  PPU, PX, R, P, row, oval, glow, spans, setCam, setBuffer, setTint, clipAbove, sky, sea, reflection,
  sunDisc, moon, stars, cloudLayer, rain, bolt, gull, bubbles, steam, flashAt,
  clamp01, ease, easeOut, lerp, seg, hash, mix, pop,
} from './cut/gfx.js';
import { player, crew, boatBack, boatFront, deckY, wake } from './cut/people.js';
import {
  palm, bush, rock, islandFar, beachBits, fireflies, shootingStar, crab, tent, firewood, campfire,
  projector, beam, screenRig, sheet, chair,
} from './cut/props.js';
import {
  drawWorldSerpent, splashCrown, drips, breath, steamBlast, steamRing, drawColossus, raiderBoat, raiderWake,
} from './cut/bosses.js';
import { leader, movie, audience } from './cut/movie.js';

const FONT = '"Press Start 2P", system-ui, monospace';

// Звуки по таймлайну сцены: [время, тип звука для sfx.event]
const CUES = {
  intro: [[0.2, 'cutstart'], [1.4, 'gull'], [3.6, 'gull'], [7.7, 'title']],
  serpent: [[0.2, 'rumble'], [0.65, 'bolt'], [1.35, 'splash'], [1.5, 'rumble'], [3.0, 'roar'], [3.4, 'bolt'], [4.1, 'bosstitle']],
  giant: [[0.1, 'rumble'], [1.0, 'bolt'], [1.15, 'stomp'], [2.2, 'rumble'], [3.3, 'roar'], [4.0, 'stomp'], [4.5, 'bosstitle']],
  raider: [[0.1, 'engine'], [1.45, 'splash'], [2.1, 'drift'], [3.0, 'bosstitle']],
  outro: [[0.3, 'cutstart'], [3.05, 'bump'], [3.4, 'jump'], [6.7, 'pop'], [7.4, 'fire'], [9.3, 'pop'], [9.7, 'pop'],
    [10.3, 'click'], [10.5, 'tick'], [11.0, 'tick'], [11.5, 'tick'], [11.7, 'pop'], [12.05, 'movie'], [12.9, 'shoot'], [15, 'win'], [16.2, 'stomp']],
};

export function cutCues(id, prevT, t) {
  return (CUES[id] || []).filter(([at]) => at > prevT && at <= t).map(([, type]) => type);
}

// ---------- Сцены ----------
const SCENES = {
  // Рассвет. Камера начинает с далёкого острова, отъезжает — в кадр вплывает лодка с игроками.
  intro(S) {
    const { t, hor, H } = S;
    const kc = ease(seg(t, 2.4, 5.8));
    setCam(S, lerp(2.4, 1, kc), lerp(75, 50, kc), lerp(hor - 4, H * 0.5, kc));
    sky(S, [[0, '#2f4fb0'], [0.4, '#8a6ad0'], [0.72, '#ff8aa0'], [1, '#ffc27a']]);
    sunDisc(S, 68, hor - 1 - ease(seg(t, 0, 7)) * 7, 5.5, '#fff6d0', '#ffb35c', 0.4);
    cloudLayer(S, 12, hor * 0.08, hor * 0.72, 16, 34, 1.4, ['#ffd6c8', '#fff3e6', '#c48aac'], 3);
    for (let i = 0; i < 5; i++) {
      gull(S, lerp(-20, 130, (t * 0.07 + hash(i + 70)) % 1), hor * (0.3 + hash(i + 80) * 0.35) + Math.sin(t * 1.5 + i) * 2, 1 + (i % 2), i);
    }
    sea(S, '#6a92d0', '#0f3a6e', '#cfe4ff', '#0a2a50', 0.6);
    reflection(S, 68, '#ffe6a8', 9, 0.75);
    islandFar(S, 76, hor + 0.8, 1);
    const bx = lerp(-48, 40, easeOut(seg(t, 2.6, 6.8))) + seg(t, 6.8, 10) * 5;
    const by = hor + 44 + Math.sin(t * 2) * 0.7;
    wake(S, bx - 17, by, t < 7.2 ? 1 : 0.5);
    boatBack(S, bx, by, 34);
    crew(S, bx + 1, deckY(by, 34), (i) => (t > 5.6 && t < 8.2 ? (i === 0 ? 'point' : 'wave') : 'stand'), 11);
    boatFront(S, bx, by, 34, '#24558f');
  },

  // Гроза, дождь. Из глубины поднимается Мировой змей, ревёт; молния выхватывает его силуэт.
  serpent(S) {
    const { c, t, hor, H } = S;
    const roar = t > 3.0 && t < 4.2;
    setCam(S, 1, 50, H * 0.5, (t > 1.3 && t < 2.4 ? 1.8 : 0) + (roar ? 2.4 : 0));
    const fl = flashAt(t, [0.62, 3.38], 0.24);
    sky(S, [[0, '#04070c'], [0.55, '#0e1a26'], [1, '#203646']]);
    bolt(S, 22, -20, 30, hor - 6, 11, t > 0.62 && t < 0.86 ? 1 - (t - 0.62) / 0.24 : 0);
    bolt(S, 82, -20, 74, hor - 2, 29, t > 3.38 && t < 3.62 ? 1 - (t - 3.38) / 0.24 : 0);
    cloudLayer(S, 12, hor * 0.02, hor * 0.6, 22, 40, 4, ['#1c2a38', '#2e4256', '#0a1118'], 9);
    sea(S, '#25475c', '#04121c', '#7aa0ba', '#020c14', 1.6);
    const x = 56, water = hor + 26;
    if (t < 2) {
      const ga = c.globalAlpha;
      c.globalAlpha = 0.5 * seg(t, 0, 1.3);
      oval(c, x, water + 4, 26 * (0.6 + t * 0.2), 6, '#010a10');
      c.globalAlpha = ga;
    }
    bubbles(S, x, water, t < 2.2 ? 1 : 0, 18);
    const rise = easeOut(seg(t, 1.35, 3.0));
    const jaw = roar ? 0.7 + 0.3 * Math.sin(t * 28) : t > 4.2 ? 0.25 : 0;
    const head = drawWorldSerpent(S, x, water, rise, jaw, fl > 0.3 && t > 3.3);
    if (roar && head) breath(S, head.mx, head.my);
    splashCrown(S, x, water, t - 1.35);
    drips(S, x, water, rise);
    rain(S, 200, 0.5, 0.55);
    const by = hor + 52 + Math.sin(t * 3.2) * 1.4;
    boatBack(S, 18, by, 24);
    crew(S, 18, deckY(by, 24), t > 1.6 ? 'alarm' : 'stand', 8, true);
    boatFront(S, 18, by, 24, '#0e2a3a');
    if (fl > 0) { const ga = c.globalAlpha; c.globalAlpha = fl * 0.55; row(c, -H, H * 3, '#dfe9ff'); c.globalAlpha = ga; }
  },

  // Удар молнии, ослепительная вспышка, взрыв пара — из воды поднимается Колосс.
  giant(S) {
    const { c, t, hor, H } = S;
    setCam(S, 1, 50, H * 0.5, (t < 1 ? 0.8 : 0) + (t > 1.05 && t < 2 ? 2.6 : 0) + (t > 4.0 && t < 4.7 ? 2.6 : 0));
    sky(S, [[0, '#0e0709'], [0.45, '#33141a'], [0.8, '#8a2a1e'], [1, '#d8642c']]);
    sunDisc(S, 26, hor - 5, 10, '#ffc080', '#e0482a', 0);
    cloudLayer(S, 10, hor * 0.06, hor * 0.7, 22, 42, 1.5, ['#3a1c1c', '#5a2c26', '#1a0c0c'], 17);
    if (t < 2.6) for (let i = 0; i < 7; i++) {
      const k = (t * 0.6 + hash(i + 40)) % 1;
      gull(S, lerp(90, -30, k), hor * (0.3 + hash(i + 50) * 0.4) - k * 8, 1, i);
    }
    sea(S, '#6a3a40', '#12080e', '#f0a080', '#0a0408', 0.7);
    reflection(S, 26, '#ff9a5a', 10, 0.55);
    const gx = 56, water = hor + 18;
    const appear = easeOut(seg(t, 1.5, 3.8));
    const k = Math.min(1.12, Math.max(0.72, (water + 24 - (H * 0.09 + 6)) / 98));
    steamBlast(S, gx, water, t - 1.15, '#f0b090');
    c.save();
    clipAbove(c, water);
    drawColossus(S, gx, water + 24 + (1 - appear) * 100 * k, k);
    c.restore();
    steam(S, gx - 18 * k, water - 58 * k * appear, 6, appear * 0.8, 30);
    steam(S, gx + 18 * k, water - 58 * k * appear, 6, appear * 0.8, 30);
    steam(S, gx, water - 92 * k * appear, 8, appear * 0.6, 26);
    steamRing(S, gx, water - 40 * k, t - 4.0);
    if (t > 4.0) {
      const r = (t - 4.0) * 34;
      const ga = c.globalAlpha;
      c.globalAlpha = clamp01(1 - (t - 4.0) / 1.5);
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; P(c, gx + Math.cos(a) * r, water + 3 + Math.sin(a) * r * 0.25, '#e8f4ff'); }
      c.globalAlpha = ga;
    }
    bolt(S, gx + 8, -20, gx - 2, water, 41, t > 1.0 && t < 1.3 ? 1 - (t - 1.0) / 0.3 : 0);
    const push = seg(t, 4.1, 4.8) * 4;
    const by = hor + 52 + Math.sin(t * 2.5) * 1;
    boatBack(S, 14 - push, by, 24);
    crew(S, 14 - push, deckY(by, 24), t > 1.4 ? 'alarm' : 'stand', 8, true);
    boatFront(S, 14 - push, by, 24, '#2a1018');
    const f = t > 1.12 && t < 1.8 ? 1 - (t - 1.12) / 0.68 : 0;
    if (f > 0) { const ga = c.globalAlpha; c.globalAlpha = f; row(c, -H, H * 3, '#fff2c0'); c.globalAlpha = ga; }
  },

  // Закат. Катер рейдеров влетает с полосами скорости, подпрыгивает на волне и тормозит заносом.
  raider(S) {
    const { t, hor, H } = S;
    setCam(S, 1, 50, H * 0.5, t > 2.1 && t < 2.6 ? 1.2 : 0);
    sky(S, [[0, '#24103c'], [0.45, '#7e2852'], [0.8, '#e0583a'], [1, '#ffb04a']]);
    sunDisc(S, 26, hor - 2, 8.5, '#ffe6a8', '#ff8a3a', 0.35);
    cloudLayer(S, 10, hor * 0.12, hor * 0.7, 18, 34, 2, ['#c0506a', '#f08a78', '#6a2448'], 23);
    sea(S, '#b0526a', '#250c2c', '#ffc090', '#160616', 2.2);
    reflection(S, 26, '#ffcf90', 10, 0.75);
    const arrive = easeOut(seg(t, 0, 2.2));
    const x = lerp(150, 62, arrive);
    const hop = t > 0.8 && t < 1.5 ? Math.sin(seg(t, 0.8, 1.5) * Math.PI) * 4 : 0;
    const wl = hor + 30;
    raiderWake(S, x, wl, 1 - seg(t, 1.8, 2.4), seg(t, 2.1, 3.0));
    raiderBoat(S, x, wl - hop, t > 2.9);
    const by = hor + 52 + Math.sin(t * 3) * 1.2;
    boatBack(S, 16, by, 28);
    crew(S, 16, deckY(by, 28), t > 2.3 ? 'alarm' : 'stand', 10);
    boatFront(S, 16, by, 28, '#3a1830');
  },

  // Финал: причаливаем, лагерь, костёр, проектор, стулья, кино под звёздами — и наезд на экран.
  outro(S) {
    const { c, t, hor, H } = S;
    const night = ease(seg(t, 4.5, 11));
    const pan = lerp(0, 44, ease(seg(t, 3.8, 6.6)));
    const zk = ease(seg(t, 13.4, 14.8));
    const gy = hor + 26;
    const scr = { x0: 112, x1: 140, top: gy - 30 };
    setCam(S, lerp(1, 3, zk), lerp(50 + pan, (scr.x0 + scr.x1) / 2, zk), lerp(H * 0.5, scr.top + 8.5, zk), t > 3.0 && t < 3.25 ? 1.2 : 0);
    const nt = (col) => mix(col, '#121838', night * 0.62);

    sky(S, [[0, mix('#3a4aa0', '#05081a', night)], [0.5, mix('#e8708a', '#121a40', night)], [0.85, mix('#ffa060', '#26305e', night)], [1, mix('#ffd08a', '#323c70', night)]]);
    stars(S, seg(t, 7.5, 11), pan * 0.9);
    if (t > 12.6 && t < 13.3) shootingStar(S, seg(t, 12.6, 13.3), 112 + pan * 0.9, 16);
    sunDisc(S, 22 + pan * 0.85, hor - 7 + night * 16, 6.5, mix('#fff0b0', '#ff7040', night), mix('#ffb060', '#c03020', night), 0.2 * (1 - night));
    if (night > 0.45) { const ga = c.globalAlpha; c.globalAlpha = (night - 0.45) / 0.55; moon(S, 80 + pan * 0.9, H * 0.2, 3.6); c.globalAlpha = ga; }
    cloudLayer(S, 12, hor * 0.12, hor * 0.65, 18, 34, 0.8, [mix('#ffb0a0', '#2a3260', night), mix('#ffe0c8', '#3a4478', night), mix('#b06a8a', '#141a3a', night)], 31, pan * 0.7);
    sea(S, mix('#5a86c0', '#0c1a3a', night), mix('#103a6a', '#040a1c', night), mix('#cfe4ff', '#5a6aa0', night), mix('#0a2a50', '#02060f', night), 0.5);
    if (night < 0.7) reflection(S, 22 + pan * 0.85, '#ffd890', 9, 0.6 * (1 - night));
    if (night > 0.5) reflection(S, 80 + pan * 0.9, '#e8ecff', 4, 0.5 * night);

    // Остров: холмы, пляж, мокрый песок, прибой
    setTint(nt);
    for (let xx = 54; xx < 270; xx += 1) {
      const hh = 7 + Math.sin(xx * 0.08) * 3 + Math.sin(xx * 0.21) * 1.5;
      R(c, xx, hor + 10 - hh, 1, hh, '#2e5a3a');
      R(c, xx, hor + 10 - hh, 1, PX, '#4a7a4a');
    }
    const edge = (yy) => lerp(58, 44, clamp01((yy - (hor + 9)) / 44));
    const lap = Math.sin(t * 1.6) * 1.2;
    spans(c, hor + 9, H + 80, (yy) => [edge(yy) + lap - 0.8, edge(yy) + lap + 2.6], '#b8994e');
    spans(c, hor + 9, H + 80, (yy) => [edge(yy) + lap + 2.6, 330], '#e6c879');
    for (let i = 0; i < 110; i++) {
      const sx = 60 + hash(i) * 200, sy = hor + 10 + hash(i + 33) * (H - hor);
      if (sx > edge(sy) + 3) P(c, sx, sy, hash(i + 7) > 0.5 ? '#cdb06a' : '#f4dc9a');
    }
    setTint(null);
    const ga0 = c.globalAlpha;
    c.globalAlpha = 0.85 * (1 - night * 0.5);
    for (let yy = hor + 9; yy < H + 10; yy += 0.5) if (hash(Math.floor(yy * 2) + Math.floor(t * 2)) > 0.25) P(c, edge(yy) + lap - 0.8, yy, '#f4fbff');
    c.globalAlpha = ga0;

    // Задний план и лагерь
    setTint(nt);
    palm(S, 56, gy - 7, 1, 1 + Math.sin(t * 1.1) * 0.25);
    palm(S, 147, gy - 3, 1.15, 1 + Math.sin(t * 1.3 + 1) * 0.25);
    bush(S, 152, gy - 7, 1.3);
    bush(S, 166, gy - 5, 1.2);
    bush(S, 61, gy - 5, 1);
    const unroll = easeOut(seg(t, 9.6, 10.3));
    const sr = screenRig(S, scr.x0, scr.x1, scr.top, gy, unroll);
    rock(S, 50, gy + 10, 1.2);
    rock(S, 142, gy + 11, 0.9);
    tent(S, 64, gy, pop(seg(t, 6.6, 7.2)));
    firewood(S, 51, gy + 1);
    beachBits(S, gy);
    campfire(S, 74, gy + 1, seg(t, 7.3, 7.8));
    projector(S, 84, gy, easeOut(seg(t, 9.2, 9.6)), t > 10.3);
    const chairs = S.o.duo ? [95, 105] : [100];
    const ch = pop(seg(t, 11.7, 12.1));
    chairs.forEach((x) => chair(S, x, gy - 4.5, ch));
    if (t > 8.2 && t < 11.6) crab(S, lerp(124, 90, seg(t, 8.2, 11.6)), gy + 7);

    // Лодка и герои: прыгают на берег, идут к лагерю, садятся смотреть кино
    const bx = lerp(-42, 40, easeOut(seg(t, 0, 3.1)));
    const bump = t > 3.0 && t < 3.3 ? Math.sin((t - 3.0) * 40) * 0.5 : 0;
    const by = gy + 3 + Math.sin(t * 2) * 0.5 * (1 - seg(t, 2.6, 3.1)) + bump;
    const keys = S.o.duo ? ['h', 'g'] : ['h'];
    const people = keys.map((key, i) => {
      const onBoat = { x: bx - 3 + i * 9, y: deckY(by, 30) };
      const shore = { x: 64 + i * 6, y: gy };
      const camp = { x: 93 + i * 12, y: gy };
      const seat = { x: chairs[i], y: gy - 4.5 };
      let x, y, pose = 'stand', item = 'racket';
      if (t < 3.3) { x = onBoat.x; y = onBoat.y; pose = t > 0.4 && t < 2.9 ? 'cheer' : 'stand'; }
      else if (t < 4.4) {
        const kk = seg(t, 3.3 + i * 0.15, 4.2 + i * 0.1);
        x = lerp(onBoat.x, shore.x, kk); y = lerp(onBoat.y, shore.y, kk) - Math.sin(kk * Math.PI) * 9;
        pose = kk > 0 && kk < 1 ? 'jump' : 'stand';
      } else if (t < 6.6) {
        const kk = seg(t, 4.4, 6.6);
        x = lerp(shore.x, camp.x, kk); y = gy; pose = kk < 1 ? 'walk' : 'stand';
      } else if (t < 11.6) { x = camp.x; y = gy; pose = t > 7.6 && t < 8.4 ? 'cheer' : 'stand'; }
      else if (t < 12.4) { x = lerp(camp.x, seat.x, seg(t, 11.6, 12.4)); y = gy; pose = 'walk'; }
      else { x = seat.x; y = seat.y; pose = 'sit'; item = i === 0 ? 'popcorn' : 'cup'; }
      return () => player(S, x, y, key, pose, i * 1.7, item);
    });
    const water = mix('#24558f', '#0a1630', night);
    boatBack(S, bx, by, 30);
    if (t < 3.3) { people.forEach((d) => d()); boatFront(S, bx, by, 30, water); }
    else { boatFront(S, bx, by, 30, water); people.forEach((d) => d()); }
    setTint(null);

    // Экран светится сам: простыня → отсчёт плёнки → кино
    if (sr) {
      if (t < 10.4) sheet(S, sr, night);
      else if (t < 12.0) leader(S, sr.x, sr.y, sr.w, sr.h, t - 10.4);
      else movie(S, sr.x, sr.y, sr.w, sr.h, t - 12.0);
    }
    beam(S, 90.5, gy - 9.3, scr.x0, scr.top, scr.top + 17 * unroll, t > 10.3 ? 1 : 0);
    const fire = seg(t, 7.3, 7.8) * night;
    if (fire > 0) glow(c, 74, gy - 2, 26, '#ff8a2a', 0.32 * fire * (0.9 + 0.1 * Math.sin(t * 11)));
    fireflies(S, 118, 160, gy - 18, gy - 2, seg(t, 9, 11));
    audience(S, (zk - 0.3) / 0.7);
  },
};

// ---------- Наложения поверх картинки ----------
function wrap(c, text, maxW) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function caption(cam, text, alpha, size = 13, y) {
  const c = cam.ctx;
  c.globalAlpha = alpha;
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'center';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * 0.3);
  let lines = wrap(c, text, cam.w - 32);
  while (lines.length > 2 && size > 8) { // длинная фраза — мельче, чтобы влезла в 2 строки
    size -= 1;
    c.font = `${size}px ${FONT}`;
    c.lineWidth = Math.max(3, size * 0.3);
    lines = wrap(c, text, cam.w - 32);
  }
  c.strokeStyle = 'rgba(0,0,0,0.9)';
  lines.forEach((ln, i) => {
    const ly = (y ?? cam.h * 0.93) + (i - (lines.length - 1) / 2) * size * 1.6;
    c.strokeText(ln, cam.w / 2, ly);
    c.fillStyle = '#ffffff';
    c.fillText(ln, cam.w / 2, ly);
  });
  c.globalAlpha = 1;
}

function timedCaption(cam, t, a, b, text, size) {
  if (t < a || t > b) return;
  caption(cam, text, Math.min(1, (t - a) * 3, (b - t) * 3), size);
}

// Название игры: буквы выпрыгивают по одной и покачиваются
function titlePop(cam, text, tt, size, y) {
  const c = cam.ctx;
  c.font = `${size}px ${FONT}`;
  c.textAlign = 'left';
  c.lineJoin = 'round';
  let x = cam.w / 2 - c.measureText(text).width / 2;
  [...text].forEach((ch, i) => {
    const w = c.measureText(ch).width;
    const p = clamp01((tt - i * 0.06) / 0.35);
    if (p > 0 && ch !== ' ') {
      const sc = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.6 : 1;
      const dy = (1 - easeOut(p)) * -30 + Math.sin(tt * 3 + i * 0.5) * 2;
      c.save();
      c.translate(x + w / 2, y + dy);
      c.scale(sc, sc);
      c.lineWidth = Math.max(4, size * 0.35);
      c.strokeStyle = '#b3401a';
      c.strokeText(ch, -w / 2 + 3, 3);
      c.strokeStyle = '#1a0a00';
      c.strokeText(ch, -w / 2, 0);
      c.fillStyle = '#ffd84a';
      c.fillText(ch, -w / 2, 0);
      c.restore();
    }
    x += w;
  });
}

// Карточка босса: лента с бегущими полосами и бликом, имя со свечением
function bossCard(cam, p, name, sub, t) {
  if (p <= 0) return;
  const c = cam.ctx, W = cam.w;
  const y = cam.h * 0.64;
  const band = (dy) => {
    c.beginPath();
    c.moveTo(0, y - 38 + dy); c.lineTo(W, y - 52 + dy); c.lineTo(W, y + 28 + dy); c.lineTo(0, y + 42 + dy);
    c.closePath();
  };
  c.save();
  c.translate(lerp(W * 1.15, 0, easeOut(p)), 0);
  c.fillStyle = 'rgba(0,0,0,0.55)'; band(6); c.fill();
  c.fillStyle = '#9a1220'; band(0); c.fill();
  c.save();
  band(0); c.clip();
  const off = (t * 30) % 24;
  c.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = -4; i < W / 24 + 6; i++) {
    const bx = i * 24 + off;
    c.beginPath(); c.moveTo(bx, y - 60); c.lineTo(bx + 12, y - 60); c.lineTo(bx - 28, y + 50); c.lineTo(bx - 40, y + 50); c.fill();
  }
  const sx = ((t * 0.8) % 1.6) * W * 1.4 - W * 0.2;
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.beginPath(); c.moveTo(sx, y - 60); c.lineTo(sx + 30, y - 60); c.lineTo(sx - 10, y + 50); c.lineTo(sx - 40, y + 50); c.fill();
  c.restore();
  c.strokeStyle = '#ffd84a'; c.lineWidth = 3; band(0); c.stroke();
  c.textAlign = 'center';
  c.fillStyle = '#1a0408';
  c.fillRect(W / 2 - 44, y - 36, 88, 16);
  c.font = `9px ${FONT}`;
  c.fillStyle = '#ffd0d0';
  c.fillText('☠ БОСС ☠', W / 2, y - 24);
  const size = Math.min(22, Math.floor((W - 30) / (name.length * 1.05)));
  c.font = `${size}px ${FONT}`;
  c.shadowColor = '#ff3040'; c.shadowBlur = 14;
  c.lineWidth = 5; c.strokeStyle = '#000'; c.strokeText(name, W / 2, y + 8);
  c.shadowBlur = 0;
  c.fillStyle = '#ffffff'; c.fillText(name, W / 2, y + 8);
  c.font = `9px ${FONT}`;
  c.fillStyle = '#ffd84a';
  c.fillText(sub, W / 2, y + 26);
  c.restore();
}

function vignette(cam, a) {
  const c = cam.ctx;
  const g = c.createRadialGradient(cam.w / 2, cam.h / 2, Math.min(cam.w, cam.h) * 0.3, cam.w / 2, cam.h / 2, Math.hypot(cam.w, cam.h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  c.fillStyle = g;
  c.fillRect(0, 0, cam.w, cam.h);
}

function letterbox(cam) {
  const c = cam.ctx;
  const bar = Math.round(cam.h * 0.09);
  c.fillStyle = '#000';
  c.fillRect(0, 0, cam.w, bar);
  c.fillRect(0, cam.h - bar * 1.3, cam.w, bar * 1.3);
}

// Кнопка пропуска в верхней чёрной полосе: её надо удерживать, кольцо показывает прогресс.
export const SKIP_HOLD = 1.2;
export function skipButton(cam) {
  const bar = Math.round(cam.h * 0.09);
  return { x: cam.w - 34, y: bar / 2, r: Math.min(22, bar / 2 - 4) };
}

function drawSkipButton(ctx, cam, p) {
  const b = skipButton(cam);
  ctx.fillStyle = p > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (p > 0) {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const dx of [-7, 0]) {
    ctx.beginPath(); ctx.moveTo(b.x + dx - 1, b.y - 6); ctx.lineTo(b.x + dx + 7, b.y); ctx.lineTo(b.x + dx - 1, b.y + 6); ctx.closePath(); ctx.fill();
  }
  ctx.font = `7px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.7;
  ctx.fillText(p > 0 ? 'держи…' : 'удерживай — пропустить', b.x - b.r - 6, b.y + 3);
  ctx.globalAlpha = 1;
}

// ---------- Вывод на экран ----------
let buf = null, bctx = null;

// cam — камера игры (размеры экрана), o — { duo, skins: { h, g }, skip: 0..1 прогресс удержания }
export function drawCutscene(ctx, cam, id, t, o) {
  const scene = SCENES[id];
  if (!scene) return;
  const u = Math.min(cam.w / 100, cam.h / 150);
  const W = cam.w / u, H = cam.h / u;
  const bw = Math.ceil(W * PPU), bh = Math.ceil(H * PPU);
  if (!buf) { buf = document.createElement('canvas'); bctx = buf.getContext('2d'); }
  if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
  setBuffer(bw / PPU, bh / PPU);
  bctx.setTransform(PPU, 0, 0, PPU, 0, 0);
  bctx.globalAlpha = 1;
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, bw, bh);
  const X0 = (W - 100) / 2;
  const S = { c: bctx, u, W, H, X0, hor: Math.round(H * 0.43 * PPU) / PPU, t, o, xmin: -X0 - 10, xmax: 110 + X0 };
  setTint(null);
  setCam(S, 1, 50, H * 0.5);
  bctx.save();
  scene(S);
  bctx.restore();
  setTint(null);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, Math.round((bw / PPU) * u * cam.dpr), Math.round((bh / PPU) * u * cam.dpr));
  ctx.restore();

  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  const sc = { ctx, w: cam.w, h: cam.h };
  vignette(sc, id === 'outro' ? 0.45 : 0.6);
  letterbox(sc);
  if (id === 'intro') {
    timedCaption(sc, t, 0.4, 2.6, 'В этот раз не на пенопласте…');
    timedCaption(sc, t, 2.8, 5.4, 'По плану было добраться до острова на самодельной лодке.');
    timedCaption(sc, t, 5.6, 7.6, o.duo ? 'Вас двое. Лодка. И две ракетки.' : 'Ты один. Лодка. И ракетка.');
    if (t > 7.6) titlePop(sc, 'ДВОЕ В ЛОДКЕ', t - 7.6, Math.min(28, Math.floor((cam.w - 40) / 12)), cam.h * 0.3);
  } else if (id === 'serpent') bossCard(sc, seg(t, 4.1, 4.7), 'МИРОВОЙ ЗМЕЙ', 'Проснулся в глубинах', t);
  else if (id === 'giant') bossCard(sc, seg(t, 4.5, 5.1), 'КОЛОСС', 'Великан из пара', t);
  else if (id === 'raider') bossCard(sc, seg(t, 3.0, 3.6), 'КАТЕР РЕЙДЕРОВ', 'Финальная погоня! Остров близко', t);
  else if (id === 'outro') {
    timedCaption(sc, t, 0.4, 2.9, 'Дааа, блять!!!', 16);
    timedCaption(sc, t, 4.4, 7.6, 'Разбиваем лагерь');
    timedCaption(sc, t, 8.8, 11, 'А теперь — кино!');
    timedCaption(sc, t, 14.6, 19.6, 'Остров, остров — ужин готов! 🍗');
    if (t > 18) caption(sc, 'КОНЕЦ', Math.min(1, (t - 18) * 3), 14, cam.h * 0.5 - 17 * u);
  }
  drawSkipButton(ctx, cam, o.skip || 0);
  const fade = Math.max(1 - t * 2.5, 1 - (CUT_TIME[id] - t) * 2.5);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp01(fade)})`; ctx.fillRect(0, 0, cam.w, cam.h); }
}
