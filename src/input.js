// Управление.
// Телефон: левая половина экрана — джойстик, правая — свайп (удар в сторону свайпа) или тап (автоудар).
// Компьютер: WASD/стрелки — бег, клик мышью — удар в сторону курсора, пробел — автоудар.
const JOY_R = 55;
const SWIPE_MIN = 22;

export function createInput(canvas) {
  const keys = new Set();
  const swings = [];
  const cards = []; // индексы карт, по которым тапнули
  let hitTest = null; // (x, y) -> индекс карты или -1
  const touches = new Map(); // pointerId -> { zone, x0, y0, x, y, fired }
  let joy = null;
  let skipId = null; // палец, который держит кнопку пропуска кат-сцены

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {} // захват пальца может не поддерживаться
    const card = hitTest ? hitTest(e.clientX, e.clientY) : -1;
    if (card === 'skip') { skipId = e.pointerId; return; }
    if (card === 'cut') return; // во время кат-сцены остальные касания ничего не делают
    if (card !== -1 && card != null) { cards.push(card); return; } // номер карты или 'nitro'
    if (e.pointerType === 'mouse') {
      swings.push({ type: 'point', sx: e.clientX, sy: e.clientY });
      return;
    }
    const zone = e.clientX < innerWidth / 2 ? 'joy' : 'swipe';
    if (zone === 'joy' && joy) return; // второй палец слева игнорируем
    const t = { zone, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, fired: false };
    touches.set(e.pointerId, t);
    if (zone === 'joy') joy = t;
  });

  canvas.addEventListener('pointermove', (e) => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX; t.y = e.clientY;
    if (t.zone === 'swipe' && !t.fired) {
      const dx = t.x - t.x0, dy = t.y - t.y0;
      if (Math.hypot(dx, dy) > SWIPE_MIN) {
        t.fired = true;
        swings.push({ type: 'dir', dx, dy });
      }
    }
  });

  const end = (e) => {
    if (e.pointerId === skipId) skipId = null;
    const t = touches.get(e.pointerId);
    if (!t) return;
    touches.delete(e.pointerId);
    if (t === joy) joy = null;
    if (t.zone === 'swipe' && !t.fired) swings.push({ type: 'auto' });
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.code);
    if (e.code === 'Space' && !e.repeat) { swings.push({ type: 'auto' }); e.preventDefault(); }
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (digit >= 0 && !e.repeat) cards.push(digit);
    if (e.code === 'KeyN' && !e.repeat) cards.push('nitro');
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  return {
    moveVec() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (joy) {
        const dx = joy.x - joy.x0, dy = joy.y - joy.y0;
        x += dx / JOY_R; y += dy / JOY_R;
      }
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      return { x, y };
    },
    takeSwings() { return swings.splice(0); },
    takeCards() { return cards.splice(0); },
    setHitTest(fn) { hitTest = fn; },
    skipHeld() { return skipId !== null || keys.has('Escape'); },
    joystick() { return joy ? { x0: joy.x0, y0: joy.y0, x: joy.x, y: joy.y, r: JOY_R } : null; },
    clear() { swings.length = 0; cards.length = 0; },
  };
}
