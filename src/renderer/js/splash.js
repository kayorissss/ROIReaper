/* ============ splash.js — заставка ============ */
(function () {
  'use strict';
  const { $ } = U;
  const splash = $('#splash'), fill = $('#splashFill'), status = $('#splashStatus');

  const PHASES = [
    [12, 'Поднимаем улей…'],
    [28, 'Будим рабочих ос…'],
    [46, 'Затачиваем косу…'],
    [64, 'Пакуем кейсы и фишки…'],
    [82, 'Полируем трон Империи…'],
    [96, 'Почти готово…'],
    [100, 'Добро пожаловать в Рой!']
  ];

  let i = 0, done = false;
  const s = Store.state.settings;

  function finish() {
    if (done) return; done = true;
    fill.style.width = '100%';
    setTimeout(() => {
      splash.classList.add('done');
      document.body.style.overflow = '';
      window.bootApp && window.bootApp();
    }, 350);
  }

  function step() {
    if (i >= PHASES.length) { finish(); return; }
    const [pct, text] = PHASES[i++];
    status.textContent = text;
    fill.style.width = pct + '%';
    setTimeout(step, pct >= 100 ? 200 : 240 + Math.random() * 260);
  }

  function start() {
    if (!s.splash) { splash.remove(); window.bootApp && window.bootApp(); return; }
    setTimeout(step, 350);
    setTimeout(finish, 3600); // авто-завершение
  }

  $('#splashSkip').addEventListener('click', () => { Snd.play('ui'); finish(); });
  splash.addEventListener('click', (e) => { if (e.target === splash) finish(); });
  document.addEventListener('keydown', function h(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { finish(); document.removeEventListener('keydown', h); }
  });

  document.fonts && document.fonts.ready.then(() => {});
  window.addEventListener('DOMContentLoaded', start);
  if (document.readyState !== 'loading') start();
})();
