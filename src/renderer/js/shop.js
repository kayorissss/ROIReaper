/* ============ shop.js — магазин плюшек ============ */
(function () {
  'use strict';
  const { el } = U;

  // Каталог
  const THEMES = [
    { id: 'amber', name: 'Янтарь Жнеца', swatch: '#f5b53c', price: 0 },
    { id: 'crimson', name: 'Алое жало', swatch: '#f0524a', price: 1500 },
    { id: 'ice', name: 'Ледяной рой', swatch: '#54c8f0', price: 1500 },
    { id: 'violet', name: 'Маточное желе', swatch: '#a07bff', price: 2500 },
    { id: 'toxic', name: 'Токсичный нектар', swatch: '#9be73d', price: 2500 }
  ];
  const SKINS = [
    { id: 'reaper', name: 'Оса-жнец', ico: '🐝', price: 0, desc: 'Классика с косой.' },
    { id: 'golden', name: 'Золотая матка', ico: '👑', price: 3000, cur: 'honey', desc: '+5% к силе клика.' },
    { id: 'cyber',  name: 'Кибер-оса', ico: '🤖', price: 5000, cur: 'honey', desc: '+10% к автодоходу.' },
    { id: 'ghost',  name: 'Оса-фантом', ico: '👻', price: 25, cur: 'jelly', desc: '+25% к royal-желе при престиже.' }
  ];
  const BACKS = [
    { id: 'honey', name: 'Медовые соты', grad: 'linear-gradient(135deg,#f5b53c,#a35d00)', price: 0 },
    { id: 'night', name: 'Ночь улья', grad: 'linear-gradient(135deg,#2b2b3a,#0b0b10)', price: 800 },
    { id: 'ember', name: 'Жало-огонь', grad: 'linear-gradient(135deg,#ff5a3c,#7a0d00)', price: 1200 },
    { id: 'royal', name: 'Пурпур матки', grad: 'linear-gradient(135deg,#a07bff,#3a1480)', price: 2000 }
  ];
  const BOOST = { id: 'pollen', name: 'Золотая пыльца', icon: '✨', basePrice: 600, growth: 1.85, max: 10,
    desc: 'Каждый уровень: +6% ко ВСЕМ наградам в мини-играх и кейсах.' };
  const GOODS = [
    { id: 'ticket3', name: '3 билета на кейсы', ico: '🎟️', price: 450, give: { tickets: 3 } },
    { id: 'ticket10', name: '10 билетов (выгодно)', ico: '🎫', price: 1200, give: { tickets: 10 } },
    { id: 'horseshoe', name: 'Подкова удачи', ico: '🧲', price: 900, give: { luck: 1 },
      desc: 'Расходуется при открытии кейса: ×2 к шансу редкого дропа.' },
    { id: 'horseshoe5', name: '5 подков удачи', ico: '🌟', price: 3800, give: { luck: 5 } }
  ];

  function boostLevel() { return Store.state.shop.owned[BOOST.id] || 0; }
  function rewardMult() { return 1 + boostLevel() * 0.06; }
  function boostPrice() {
    const l = boostLevel();
    return Math.floor(BOOST.basePrice * Math.pow(BOOST.growth, l));
  }

  function owned(id) { return !!Store.state.shop.owned[id]; }
  function own(id) {
    Store.state.shop.owned[id] = true; Store.save();
  }

  function buy(cur, price, onYes) {
    const pay = cur === 'jelly' ? Store.spendJelly.bind(Store) : Store.spendHoney.bind(Store);
    if (!pay(price)) { Snd.play('deny'); UI.toast('Недостаточно средств', 'bad'); return false; }
    Snd.play('buy'); onYes && onYes(); Store.save(); return true;
  }

  /* ----- рендер разделов ----- */
  function section(title, sub) {
    return el('div', { class: 'shop-section anim-item' },
      el('div', { class: 'page-head', style: { marginBottom: '12px' } },
        el('div', {}, el('h1', { style: { fontSize: '18px' }, text: title }), sub ? el('p', { text: sub }) : null)));
  }

  function tile(item, body, cta) {
    const t = el('div', { class: 'card shop-tile' }, body, cta);
    return t;
  }

  function priceTag(price, cur) {
    const icon = cur === 'jelly' ? '👑' : '🍯';
    return el('span', { class: 'price-tag', html: `${icon} ${U.fmt(price)}` });
  }

  function mount(v) {
    const s = Store.state;

    v.append(el('div', { class: 'page-head anim-item' },
      el('div', {},
        el('h1', { text: '🛒 Магазин' }),
        el('p', { text: 'Покупки навсегда остаются в сохранении. Зарабатывай мёд в играх и желе — престижем в «Жатве Роя».' })),
      el('div', { class: 'ph-side flex gap8' },
        el('div', { class: 'currency' }, el('span', { text: '🍯' }), el('b', { text: U.fmt(s.honey) })),
        el('div', { class: 'currency currency-royal' }, el('span', { text: '👑' }), el('b', { text: U.fmt(s.jelly) })))
    ));

    /* --- Темы --- */
    const secThemes = section('Оформление', 'Акцентная палитра интерфейса. Светлая/тёмная тема переключается в Настройках.');
    const themeGrid = el('div', { class: 'grid grid-4' });
    THEMES.forEach((t) => {
      const isCur = s.settings.accent === t.id;
      themeGrid.appendChild(tile(t,
        el('div', { class: 'swatch', style: { background: t.swatch } }),
        el('div', { class: 'shop-name', text: t.name }),
        el('div', { class: 'shop-foot' },
          t.price === 0 || owned('theme-' + t.id)
            ? el('button', {
                class: 'btn btn-sm ' + (isCur ? 'btn-primary' : ''),
                text: isCur ? 'Выбрано' : (t.price === 0 ? 'Выбрать' : 'Выбрать'),
                onclick: () => {
                  s.settings.accent = t.id; Store.save(); AppCore.applySettings(); Snd.play('tab'); mountRef();
                }
              })
            : el('button', {
                class: 'btn btn-sm btn-primary',
                html: `Купить · 🍯${U.fmt(t.price)}`,
                onclick: () => buy('honey', t.price, () => { own('theme-' + t.id); s.settings.accent = t.id; AppCore.applySettings(); UI.toast('Палитра «' + t.name + '» куплена и включена', 'good'); mountRef(); })
              })
        )
      ));
    });
    secThemes.appendChild(themeGrid);
    v.append(secThemes);

    /* --- Усиление --- */
    const secBoost = section('Усилители', 'Постоянные бонусы, работают во всех режимах.');
    const lvl = boostLevel();
    secBoost.appendChild(el('div', { class: 'grid grid-2' },
      tile(BOOST,
        el('div', { class: 'flex gap12', style: { alignItems: 'center', marginBottom: '10px' } },
          el('div', { class: 'big-ico', text: BOOST.icon }),
          el('div', {}, el('div', { class: 'shop-name', text: BOOST.name }),
            el('div', { class: 'muted', style: { fontSize: '11px' }, text: `Уровень ${lvl} из ${BOOST.max} · бонус сейчас: +${lvl * 6}%` }))),
        el('div', { class: 'bar big' }, el('div', { style: { width: (100 * lvl / BOOST.max) + '%' } })),
        el('div', { class: 'shop-foot', style: { marginTop: '12px' } },
          lvl >= BOOST.max
            ? el('b', { style: { color: 'var(--good)' }, text: 'Максимальный уровень 🏅' })
            : el('button', { class: 'btn btn-primary btn-sm', html: `Улучшить · 🍯${U.fmt(boostPrice())}`, onclick: () =>
                buy('honey', boostPrice(), () => { s.shop.owned[BOOST.id] = lvl + 1; UI.toast(`${BOOST.name}: уровень ${lvl + 1}!`, 'good'); mountRef(); }) })
        )
      ),
      tile({},
        el('div', { class: 'flex gap12', style: { alignItems: 'center', marginBottom: '10px' } },
          el('div', { class: 'big-ico', text: '🎟️' }),
          el('div', {}, el('div', { class: 'shop-name', text: 'Билеты кейсов' }),
            el('div', { class: 'muted', style: { fontSize: '11px' }, text: `Сейчас: ${s.cases.tickets} шт. Один бесплатный каждые 20 минут.` }))),
        el('div', { class: 'shop-foot' },
          el('button', { class: 'btn btn-sm', html: '3 шт · 🍯450', onclick: () => buy('honey', 450, () => { s.cases.tickets += 3; UI.toast('+3 билета', 'good'); mountRef(); }) }),
          el('button', { class: 'btn btn-sm btn-primary', html: '10 шт · 🍯1 200', onclick: () => buy('honey', 1200, () => { s.cases.tickets += 10; UI.toast('+10 билетов', 'good'); mountRef(); }) })
        )
      )
    ));
    v.append(secBoost);

    /* --- Скины кликера --- */
    const secSkins = section('Скины жнеца', 'Меняют главного героя в «Жатве Роя» и дают пассивные бонусы.');
    const gSkins = el('div', { class: 'grid grid-4' });
    SKINS.forEach((sk) => {
      const isCur = s.shop.skin === sk.id;
      const isOwned = sk.price === 0 || owned('skin-' + sk.id);
      gSkins.appendChild(tile(sk,
        el('div', { class: 'skin-ico' }, el('span', { text: sk.ico })),
        el('div', { class: 'shop-name center', text: sk.name }),
        el('div', { class: 'muted center', style: { fontSize: '10.5px', minHeight: '30px' }, text: sk.desc }),
        el('div', { class: 'shop-foot center' },
          isOwned
            ? el('button', { class: 'btn btn-sm ' + (isCur ? 'btn-primary' : ''), text: isCur ? 'Надет' : 'Надеть',
                onclick: () => { s.shop.skin = sk.id; Store.save(); Snd.play('tab'); mountRef(); } })
            : el('button', { class: 'btn btn-sm btn-primary',
                html: sk.cur === 'jelly' ? `👑${U.fmt(sk.price)}` : `🍯${U.fmt(sk.price)}`,
                onclick: () => buy(sk.cur || 'honey', sk.price, () => {
                  own('skin-' + sk.id); s.shop.skin = sk.id; UI.toast('Скин «' + sk.name + '» надет', 'good'); mountRef();
                }) })
        )
      ));
    });
    secSkins.appendChild(gSkins);
    v.append(secSkins);

    /* --- Рубашки карт --- */
    const secBacks = section('Рубашки карт', 'Используются в Блэкджеке и Дураке.');
    const gBacks = el('div', { class: 'grid grid-4' });
    BACKS.forEach((b) => {
      const isCur = s.shop.cardsBack === b.id;
      const isOwned = b.price === 0 || owned('back-' + b.id);
      gBacks.appendChild(tile(b,
        el('div', { class: 'card-back-preview', style: { background: b.grad } }),
        el('div', { class: 'shop-name center', text: b.name }),
        el('div', { class: 'shop-foot center' },
          isOwned
            ? el('button', { class: 'btn btn-sm ' + (isCur ? 'btn-primary' : ''), text: isCur ? 'Выбрана' : 'Выбрать',
              onclick: () => { s.shop.cardsBack = b.id; Store.save(); Snd.play('tab'); mountRef(); } })
            : el('button', { class: 'btn btn-sm btn-primary', html: `🍯${U.fmt(b.price)}`,
              onclick: () => buy('honey', b.price, () => { own('back-' + b.id); s.shop.cardsBack = b.id; mountRef(); }) })
        )
      ));
    });
    secBacks.appendChild(gBacks);
    v.append(secBacks);

    /* --- Расходники --- */
    const secGoods = section('Расходники', 'Число подков удачи: ' + s.shop.consumables.luck);
    const gGoods = el('div', { class: 'grid grid-4' });
    GOODS.forEach((g) => {
      gGoods.appendChild(tile(g,
        el('div', { class: 'skin-ico' }, el('span', { text: g.ico })),
        el('div', { class: 'shop-name center', text: g.name }),
        g.desc ? el('div', { class: 'muted center', style: { fontSize: '10.5px' }, text: g.desc }) : null,
        el('div', { class: 'shop-foot center' },
          el('button', { class: 'btn btn-sm btn-primary', html: `🍯${U.fmt(g.price)}`,
            onclick: () => buy('honey', g.price, () => {
              if (g.give.tickets) s.cases.tickets += g.give.tickets;
              if (g.give.luck) s.shop.consumables.luck += g.give.luck;
              UI.toast('Куплено: ' + g.name, 'good'); mountRef();
            }) })
        )
      ));
    });
    secGoods.appendChild(gGoods);
    v.append(secGoods);
  }

  function mountRef(v) {
    const node = document.getElementById('view-shop');
    if (node && node.classList.contains('active')) Pages['shop'].mount(node);
  }

  Pages['shop'] = { mount };

  window.ShopItems = { THEMES, SKINS, BACKS, boostLevel, rewardMult };
})();
