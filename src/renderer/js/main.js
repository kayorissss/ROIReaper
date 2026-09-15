/* ============ main.js — загрузка, роутинг, горячие клавиши ============ */
(function () {
  'use strict';
  const { $, $$, el } = U;

  const Pages = window.Pages = {};
  let current = null;
  let currentName = '';

  const TITLES = {
    home: ['Главная', 'Центральный улей'],
    shop: ['Магазин', 'Плюшки за мёд и желе'],
    sysinfo: ['О компьютере', 'Системная информация'],
    settings: ['Настройки', 'Параметры и обновления'],
    'game-clicker': ['Жатва Роя', 'Кликер'],
    'game-cases': ['Кейсы', 'Открытие лут-кейсов'],
    'game-slots': ['Казино · Слоты', 'Крути барабаны'],
    'game-roulette': ['Казино · Рулетка', 'Европейская рулетка'],
    'game-blackjack': ['Казино · Блэкджек', '21 очко'],
    'game-dice': ['Казино · Кости', 'Больше / меньше'],
    'game-coin': ['Казино · Орёл и Решка', 'Монетка удачи'],
    'game-imperium': ['Империя Роя', 'Глобальная стратегия'],
    'game-dodge': ['Уклонение', 'Переживи босса'],
    'game-checkers': ['Шашки', 'Против ИИ'],
    'game-durak': ['Дурак', 'Подкидной против ИИ'],
    'game-2048': ['2048', 'Собери плитку 2048']
  };

  function applySettings() {
    const s = Store.state.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.accent = s.accent;
    document.body.classList.toggle('no-anim', s.animations === false);
    try { Snd.setVolume(s.volume); if (Snd.enabled !== !!s.sound) Snd.setEnabled(!!s.sound); } catch (e) {}
    $('#soundBtn').textContent = s.sound ? '🔊' : '🔇';
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = s.theme;
  }

  function go(name) {
    if (!Pages[name]) { console.warn('Нет страницы', name); return; }
    const viewId = 'view-' + name;
    const view = document.getElementById(viewId);
    if (!view) return;

    // уходим со старой
    if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }

    $$('.view').forEach((v) => v.classList.remove('active'));
    view.classList.add('active');
    view.scrollTop = 0;
    view.replaceChildren();
    current = Pages[name]; currentName = name;
    try { current.mount(view); } catch (e) { console.error(e); view.appendChild(el('div', { class: 'panel', html: '<h3>Ошибка режима</h3><pre style="white-space:pre-wrap;color:var(--bad)">' + (e.stack || e.message) + '</pre>' })); }

    // подсветка меню
    $$('.nav-item[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
    const t = TITLES[name] || [name, ''];
    $('#crumb').innerHTML = t[1] ? `${t[0]} <small>— ${t[1]}</small>` : t[0];

    // открыть группу «Казино»
    const casinoParent = $('.nav-parent');
    if (name.startsWith('game-slots') || name.startsWith('game-roulette') || name.startsWith('game-blackjack') ||
        name.startsWith('game-dice') || name.startsWith('game-coin')) casinoParent.classList.add('open');

    if (window.innerWidth <= 860) $('#app').querySelector('.sidebar').classList.remove('open');
    location.hash = name;
  }
  window.Go = go;

  /* ---------- Навигация ---------- */
  $('#nav').addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    if (item.classList.contains('nav-parent')) { item.classList.toggle('open'); return; }
    if (item.dataset.nav) go(item.dataset.nav);
  });
  $('.brand').addEventListener('click', () => go('home'));
  $('#menuBtn').addEventListener('click', () => $('.sidebar').classList.toggle('open'));

  /* ---------- Звук / фуллскрин ---------- */
  $('#soundBtn').addEventListener('click', () => {
    Snd.setEnabled(!Snd.enabled);
    Store.state.settings.sound = Snd.enabled; Store.save();
  });
  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  $('#fsBtn').addEventListener('click', toggleFs);

  /* ---------- Горячие клавиши ---------- */
  document.addEventListener('keydown', (e) => {
    // F11 — полноэкранный режим
    if (e.key === 'F11') { e.preventDefault(); toggleFs(); return; }
    if (e.key === 'F5') { e.preventDefault(); location.reload(); return; }
    if (e.key === 'm' || e.key === 'м' || e.key === 'M' || e.key === 'М') {
      if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      Snd.setEnabled(!Snd.enabled); return;
    }
    if (e.key === 'Escape') { if ($('#modalShade').classList.contains('open')) UI.modalClose(); }

    // цифры 1..9 — быстрый переход к играм в порядке меню
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey &&
        !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
      const order = ['home', 'shop', 'game-clicker', 'game-cases', 'game-slots', 'game-imperium', 'game-dodge', 'game-checkers', 'game-2048'];
      const p = order[+e.key - 1];
      if (p) go(p);
    }
    // глобальный обработчик внутри активной страницы
    if (current && current.onKey) current.onKey(e);
  });

  // предупреждение о фокусе на канвасе и т.п.
  window.addEventListener('resize', () => { if (current && current.onResize) current.onResize(); });

  /* ---------- Ежедневная награда ---------- */
  function dailyReward() {
    const s = Store.state;
    const today = U.todayKey();
    if (s.daily.date === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.daily.streak = s.daily.date === yesterday ? s.daily.streak + 1 : 1;
    s.daily.date = today;
    const reward = 200 + Math.min(s.daily.streak, 14) * 75;
    Store.addHoney(reward);
    setTimeout(() => {
      UI.toast(`Ежедневная награда (день ${s.daily.streak}): 🍯 ${U.fmt(reward)}`, 'good', '🎁');
      Snd.play('win');
    }, 1400);
    Store.save();
  }

  /* ---------- Уведомление об обновлении ---------- */
  window.showUpdateNotification = null; // заполняется в updates.js

  /* ---------- Старт ---------- */
  window.bootApp = function () {
    applySettings();
    $('#app').classList.remove('app-hidden');
    versionChip: {
      $('#versionChip').textContent = 'v' + Store.VERSION + ' · ' + (Store.state.settings.theme === 'dark' ? 'тёмная' : 'светлая');
    }
    UI.renderCurrency(false);
    const start = (location.hash || '#home').slice(1);
    go(Pages[start] ? start : 'home');
    dailyReward();
    setTimeout(() => window.UpdateChecker && UpdateChecker.autoCheck(), 5000);
    // игровое время
    setInterval(() => { Store.state.stats.playTime++; }, 60000);
  };

  window.AppCore = { go, applySettings };
})();
