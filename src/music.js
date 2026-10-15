// Фоновая музыка: один плеер, выбранный трек играет по кругу.
// Браузеры разрешают звук только после касания экрана — поэтому start() вызывается из нажатия кнопки.
export const TRACKS = [
  { title: 'Noisestorm — Crab Rave', file: 'Noisestorm_-_Crab_Rave_(musmore.org).mp3' },
  { title: 'Нурминский — Валим', file: 'Нурминский - Валим.mp3' },
  { title: 'DJ EBAN — ЕБАН', file: 'DJ EBAN — ЕБАН (www.lightaudio.ru).mp3' },
];

const url = (t) => 'src/music/' + encodeURIComponent(t.file);

export function createMusic() {
  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0.45;
  audio.preload = 'none';
  let track = -1, muted = false, started = false, broken = false;
  audio.addEventListener('error', () => { broken = true; }); // файла нет — просто тишина

  const sync = () => {
    if (!started || broken) return;
    if (muted) audio.pause();
    else audio.play().catch(() => {});
  };

  return {
    // Первое касание пользователя — можно включать звук
    start() { if (!started) { started = true; sync(); } },
    // Применить состояние (вызывается каждый кадр — лишнего не делает)
    apply(t, m) {
      if (t !== track) {
        track = t;
        broken = false;
        audio.src = url(TRACKS[(t % TRACKS.length + TRACKS.length) % TRACKS.length]);
        sync();
      }
      if (m !== muted) { muted = m; sync(); }
    },
    get title() { return TRACKS[track]?.title || ''; },
    get playing() { return !audio.paused; },
    get error() { return broken; },
  };
}
