// Прогрессия между забегами: ракушки, постоянные улучшения и раскраски ракетки.
// Хранится в localStorage этого телефона; если хранилище недоступно — игра работает без него.
import { PERKS, SKINS, DIFFICULTY } from './const.js';

const KEY = 'lodka-progress-v1';

export function loadProgress() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  return {
    shells: p?.shells || 0,
    perks: p?.perks || {},
    owned: p?.owned || [0],
    skin: p?.skin || 0,
    best: p?.best || 0,
    difficulty: DIFFICULTY[p?.difficulty] ? p.difficulty : 'normal',
    music: { track: p?.music?.track ?? 0, muted: !!p?.music?.muted },
  };
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// Ракушки за забег: очки, боссы, рейдеры и победа.
export function shellsFor(view) {
  const base = Math.floor(view.sc / 40) + (view.bk || 0) * 15 + (view.rk ? 20 : 0) + (view.ph === 'win' ? 40 : 0);
  return Math.round(base * (DIFFICULTY[view.df]?.shells ?? 1));
}

export function perkCost(p, id) {
  const lvl = p.perks[id] || 0;
  return lvl >= PERKS[id].max ? null : PERKS[id].cost[lvl];
}

export function buyPerk(p, id) {
  const cost = perkCost(p, id);
  if (cost == null || p.shells < cost) return false;
  p.shells -= cost;
  p.perks[id] = (p.perks[id] || 0) + 1;
  saveProgress(p);
  return true;
}

// Купить раскраску (если ещё нет) или просто выбрать уже купленную.
export function pickSkin(p, i) {
  if (!p.owned.includes(i)) {
    if (p.shells < SKINS[i].cost) return false;
    p.shells -= SKINS[i].cost;
    p.owned.push(i);
  }
  p.skin = i;
  saveProgress(p);
  return true;
}

export const skinColor = (p) => SKINS[p.skin]?.color || SKINS[0].color;

// В совместной игре — лучший уровень каждого улучшения из двух игроков.
export function mergePerks(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] || 0, v);
  return out;
}
