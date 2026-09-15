/* ============ home.js — главная ============ */
(function () {
  'use strict';
  const { el } = U;

  const GAMES = [
    { id: 'game-clicker', ico: '🐝', name: 'Жатва Роя', desc: 'Кликай, нанимай дронов, улучшай жало и делай престиж.', tag: 'кликер' },
    { id: 'game-cases', ico: '📦', name: 'Кейсы', desc: '6 кейсов: прокрутка, редкости, инвентарь и крупные заносы.', tag: 'лут' },
    { id: 'game-slots', ico: '🎰', name: 'Слоты «Мёд удачи»', desc: '5×3 барабана, фриспины, вайлды и бонусы.', tag: 'казино', casino: true },
    { id: 'game-roulette', ico: '🎡', name: 'Рулетка', desc: 'Европейская, одно зеро, полный стол ставок.', tag: 'казино', casino: true },
    { id: 'game-blackjack', ico: '🃏', name: 'Блэкджек', desc: 'Колода 52 карты, удвоение, дилер по правилам.', tag: 'казино', casino: true },
    { id: 'game-dice', ico: '🎲', name: 'Кости', desc: 'Двигай порог, лови множитель до x98.', tag: 'казино', casino: true },
    { id: 'game-coin', ico: '🪙', name: 'Орёл и Решка', desc: 'Серии побед, страховка и азарт.', tag: 'казино', casino: true },
    { id: 'game-imperium', ico: '👑', name: 'Империя Роя', desc: 'Захватывай провинции, развивай экономику, победи 3 улья.', tag: 'стратегия' },
    { id: 'game-dodge', ico: '🥷', name: 'Уклонение', desc: 'Босс швыряет еду. WASD / стрелки + рывок.', tag: 'аркада' },
    { id: 'game-checkers', ico: '⚫', name: 'Шашки', desc: 'Русские шашки против ИИ, дамки и обязательные взятия.', tag: 'настолка' },
    { id: 'game-durak', ico: '🂠', name: 'Дурак', desc: 'Подкидной, 36 карт, колода и козырь.', tag: 'карты' },
    { id: 'game-2048', ico: '🔢', name: '2048', desc: 'Классика для пар. Стрелки / WASD.', tag: 'головоломка' }
  ];

  function gameCard(g) {
    return el('div', {
      class: 'card card-game anim-item',
      onclick: () => { Snd.play('ui'); Go(g.id); }
    },
      g.tag ? el('div', { class: 'card-badge', text: g.tag }) : null,
      el('span', { class: 'card-ico', text: g.ico }),
      el('h3', { text: g.name }),
      el('p', { text: g.desc }),
      el('span', { class: 'card-go', text: '→' })
    );
  }

  function statCard(icon, label, value, sub) {
    return el('div', { class: 'card anim-item stat-card' },
      el('div', { class: 'stat-ico', text: icon }),
      el('div', {},
        el('div', { class: 'stat-label', text: label }),
        el('div', { class: 'stat-value', text: value }),
        sub ? el('div', { class: 'stat-sub', text: sub }) : null
      )
    );
  }

  function playtime(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? `${h} ч ${m} мин` : `${m} мин`;
  }

  Pages['home'] = {
    mount(v) {
      const s = Store.state;
      const winRate = (s.stats.casinoWins + s.stats.casinoLosses)
        ? Math.round(100 * s.stats.casinoWins / (s.stats.casinoWins + s.stats.casinoLosses)) : 0;

      v.append(
        el('div', { class: 'hero anim-item' },
          el('div', { class: 'hero-glow' }),
          el('img', { src: 'assets/img/icon-128.png', class: 'hero-mark', alt: '' }),
          el('div', { class: 'hero-text' },
            el('div', { class: 'hero-eyebrow', text: `ОФИЦИАЛЬНАЯ СБОРКА · v${Store.VERSION}` }),
            el('h1', { html: 'ROIReaper — <span class="gold-text">Жнец Роя</span>' }),
            el('p', { text: 'Двенадцать режимов в одном улье: кликай, вскрывай кейсы, ставь, завоевывай и уворачивайся. Весь прогресс сохраняется автоматически.' }),
            el('div', { class: 'flex gap12 hero-btns' },
              el('button', { class: 'btn btn-primary btn-lg', onclick: () => Go('game-clicker'), text: '🐝 Жать урожай' }),
              el('button', { class: 'btn btn-lg', onclick: () => Go('game-cases'), text: '📦 Открыть кейс' }),
              el('button', { class: 'btn btn-lg', onclick: () => Go('game-dodge'), text: '🥷 Быстрая аркада' })
            )
          )
        )
      );

      // полоса статов
      v.append(
        el('div', { class: 'stat-strip' },
          statCard('🍯', 'Мёд в банке', U.fmt(s.honey), 'основная валюта'),
          statCard('👑', 'Желе королевы', U.fmt(s.jelly), 'престиж-валюта'),
          statCard('🔥', 'Серия дней', s.daily.streak + '', s.daily.streak ? 'заходи каждый день' : 'начни серию!'),
          statCard('🏆', 'Рекорд уклонения', s.games.dodge.best + '', 'пойманной еды'),
          statCard('📦', 'Кейсов открыто', s.stats.casesOpened + '', ''),
          statCard('⏱', 'В игре', playtime(s.stats.playTime), winRate ? `винрейт казино ${winRate}%` : '')
        )
      );

      v.append(
        el('div', { class: 'page-head' },
          el('div', {}, el('h1', { text: 'Режимы' }), el('p', { text: 'Клавиши 1–9 — быстрый переход, F11 — полный экран, M — звук. В большинстве аркад работают и мышка, и WASD/стрелки.' }))
        ),
        el('div', { class: 'grid grid-3 game-grid' }, ...GAMES.map(gameCard))
      );

      v.append(
        el('div', { class: 'grid grid-2 home-bottom' },
          el('div', { class: 'panel anim-item' },
            el('div', { class: 'panel-title', text: 'Как заработать мёд' }),
          [['🐝', 'Кликер', 'Пассивный доход с дронами — главный поставщик мёда.'],
           ['📦', 'Кейсы', 'Билеты копятся: один бесплатный кейс каждые 20 минут.'],
           ['🥷', 'Уклонение', 'Чем дольше живёшь — тем больше награда за заход.'],
           ['👑', 'Империя', 'Победа над ИИ-ульями приносит желе и мёд.'],
           ['🎰', 'Казино', 'Только на свой страх и риск! Дом всегда имеет edge.']
          ].map(([i, t, d]) => el('div', { class: 'tip-row' }, el('span', { text: i }), el('div', {}, el('b', { text: t }), el('p', { text: d }))))
          ),
          el('div', { class: 'panel anim-item' },
            el('div', { class: 'panel-title', text: 'Состояние' }),
            UI.statRow('Всего заработано мёда', '🍯 ' + U.fmt(s.stats.earned)),
            UI.statRow('Всего кликов', U.fmtFull(s.stats.clicks)),
            UI.statRow('Побед в казино', U.fmtFull(s.stats.casinoWins)),
            UI.statRow('Поражений в казино', U.fmtFull(s.stats.casinoLosses)),
            UI.statRow('Побед в шашки', U.fmtFull(s.stats.checkersWins)),
            UI.statRow('Побед в дурака', U.fmtFull(s.stats.durakWins)),
            UI.statRow('Рекорд в 2048', U.fmt(s.games.g2048.best)),
            el('div', { class: 'flex gap8', style: { marginTop: '14px' } },
              el('button', { class: 'btn btn-sm grow', onclick: () => Go('settings'), text: '⚙ Настройки' }),
              el('button', { class: 'btn btn-sm grow', onclick: () => Go('shop'), text: '🛒 В магазин' })
            )
          )
        )
      );
    }
  };
})();
