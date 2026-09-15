/* ============ cases.js — Кейсы ============ */
(function () {
  'use strict';
  const { el } = U;

  const RAR = {
    common:    { name: 'Обычный',     color: '#9aa3b2', weight: .66 },
    rare:      { name: 'Редкий',      color: '#4aa3ff', weight: .23 },
    epic:      { name: 'Эпический',   color: '#b061ff', weight: .085 },
    legendary: { name: 'Легендарный', color: '#f5b53c', weight: .022 },
    relic:     { name: 'Реликт',      color: '#ff4d5e', weight: .003 }
  };
  const ORDER = ['common', 'rare', 'epic', 'legendary', 'relic'];

  // Пул названий по редкости
  const POOL = {
    common: [
      ['🥤', 'Просроченный энергетик'], ['🧾', 'Чек из столовки'], ['📝', 'Шпаргалка по матану'],
      ['🏷️', 'Стикер осы'], ['🍵', 'Пакетик чая №14'], ['🧮', 'Калькулятор МК-52'],
      ['🎧', 'Китайские наушники'], ['🧂', 'Просыпалась соль'], ['🍞', 'Корка хлеба'],
      ['🖊️', 'Ручка, которая не пишет']
    ],
    rare: [
      ['🍬', 'Медовая конфета'], ['☕', 'Термос с рафом'], ['🎫', 'Талон на стипуху'],
      ['🧃', 'Сок с трубочкой'], ['🍕', 'Купон на пиццу'], ['🔋', 'Павербанк на 1%'],
      ['🕹️', 'Джойстик от денди'], ['🧶', 'Шарф декана']
    ],
    epic: [
      ['📒', 'Золотая зачётка'], ['🔪', 'Коса из нержавейки'], ['💾', 'Флешка со шпорами'],
      ['💎', 'Кристальный нектар'], ['🛸', 'НЛО-доставщик'], ['🎹', 'Синтезатор роя']
    ],
    legendary: [
      ['👑', 'Корона матки'], ['📜', 'Диплом без долгов'], ['🌟', 'Звезда деканата'],
      ['🏆', 'Кубок Жнеца'], ['💼', 'Дипломат с мёдом'], ['🧲', 'Магнит на пятёрки']
    ],
    relic: [
      ['🌙', 'Серп самого Жнеца'], ['🌌', 'Ядро Левиафана'], ['🔱', 'Трезубец королевы'],
      ['🪬', 'Амулет вечной сессии'], ['☄️', 'Осколок кометы']
    ]
  };

  const CASES = [
    { id: 'student', name: 'Студенческий паёк', ico: '🎒', cost: 1, ticket: true,
      grad: 'linear-gradient(150deg,#3b3d4a,#1b1c22)', vMul: 1,
      vRange: { common: [15, 60], rare: [90, 260], epic: [450, 900], legendary: [2200, 4200], relic: [15000, 30000] } },
    { id: 'honey', name: 'Медовая капсула', ico: '🍯', cost: 300,
      grad: 'linear-gradient(150deg,#b97410,#4a2b02)', vMul: 1.15,
      vRange: { common: [30, 110], rare: [160, 450], epic: [800, 1600], legendary: [4000, 8000], relic: [25000, 50000] } },
    { id: 'amber', name: 'Янтарный сейф', ico: '🟠', cost: 750,
      grad: 'linear-gradient(150deg,#d6751e,#5a2503)', vMul: 1.35,
      vRange: { common: [60, 200], rare: [320, 800], epic: [1500, 3200], legendary: [7500, 15000], relic: [45000, 90000] } },
    { id: 'royal', name: 'Королевский улей', ico: '👑', cost: 1800,
      grad: 'linear-gradient(150deg,#7a4fd1,#241245)', vMul: 1.7,
      weights: { common: .52, rare: .28, epic: .14, legendary: .052, relic: .008 },
      vRange: { common: [120, 380], rare: [600, 1400], epic: [2800, 5500], legendary: [14000, 30000], relic: [80000, 160000] } },
    { id: 'reactor', name: 'Квантовый реактор', ico: '⚛️', cost: 4500,
      grad: 'linear-gradient(150deg,#0f8aa8,#062d3a)', vMul: 2.2,
      weights: { common: .42, rare: .30, epic: .18, legendary: .085, relic: .015 },
      vRange: { common: [260, 700], rare: [1200, 3000], epic: [6000, 12000], legendary: [30000, 65000], relic: [170000, 320000] } },
    { id: 'reaper', name: 'Жатва Роя', ico: '🌌', cost: 12000,
      grad: 'linear-gradient(150deg,#3a3a44,#0c0c10)', vMul: 3,
      weights: { common: .30, rare: .30, epic: .24, legendary: .13, relic: .03 },
      vRange: { common: [500, 1200], rare: [2200, 5500], epic: [11000, 24000], legendary: [60000, 130000], relic: [350000, 999999] } }
  ];

  function rarityPick(c) {
    const w = c.weights || { common: RAR.common.weight, rare: RAR.rare.weight, epic: RAR.epic.weight, legendary: RAR.legendary.weight, relic: RAR.relic.weight };
    let horseshoe = Store.state.shop.consumables.luck > 0;
    const items = ORDER.map((r) => {
      let weight = w[r];
      if (horseshoe && r !== 'common') weight *= 2; // подкова удваивает шанс не-обычного
      return { r, w: weight };
    });
    return U.weighted(items).r;
  }

  function rollItem(c) {
    const r = rarityPick(c);
    const [ico, name] = U.pick(POOL[r]);
    const [lo, hi] = c.vRange[r];
    const value = Math.round(U.rand(lo, hi) * c.vMul * ShopItems.rewardMult());
    return { r, ico, name: c.id === 'student' ? name : name, value };
  }

  function freeTicketReady() {
    const last = Store.state.cases.lastFree || 0;
    return Date.now() - last >= 20 * 60 * 1000;
  }
  function freeInMs() { return Math.max(0, 20 * 60 * 1000 - (Date.now() - (Store.state.cases.lastFree || 0))); }

  let view, spinState = null, freeTimer = null;

  function caseCard(c) {
    const canTicket = c.ticket && Store.state.cases.tickets > 0;
    const canHoney = !c.ticket && Store.state.honey >= c.cost;
    const free = c.id === 'student' && freeTicketReady();
    const btnLabel = free ? '🎁 Бесплатно!' : c.ticket
      ? `🎟 Билет (${Store.state.cases.tickets})` : `🍯 ${U.fmt(c.cost)}`;
    const card = el('div', { class: 'card case-card anim-item', style: { background: c.grad } },
      el('div', { class: 'case-shine' }),
      el('div', { class: 'case-ico' }, c.ico),
      el('h3', { class: 'case-name', text: c.name }),
      el('div', { class: 'case-rarities' },
        ORDER.slice(1).map((r) => el('span', { class: 'rar-dot', style: { background: RAR[r].color }, title: RAR[r].name }))),
      el('button', {
        class: 'btn btn-sm ' + (free || canTicket || canHoney ? 'btn-primary' : '') + ' btn-block case-open',
        text: btnLabel, disabled: !(free || canTicket || canHoney),
        onclick: () => openCase(c, free ? 'free' : c.ticket ? 'ticket' : 'honey')
      })
    );
    return card;
  }

  function inventoryPanel() {
    const inv = Store.state.cases.inventory;
    const p = el('div', { class: 'panel anim-item' },
      el('div', { class: 'panel-title flex', style: { display: 'flex' } },
        el('span', { class: 'grow', text: '🏆 Трофейный зал (эпик и выше)' }),
        el('button', { class: 'btn btn-sm', text: 'Продать всё за 10%', onclick: sellAll })));
    const grid = el('div', { class: 'inv-grid' });
    const epics = inv.filter((i) => i.r !== 'common' && i.r !== 'rare');
    if (!epics.length) grid.appendChild(el('div', { class: 'empty-note', text: 'Пока пусто. Эпические предметы и выше появляются здесь.' }));
    epics.slice(-40).reverse().forEach((it, idx) => {
      grid.appendChild(el('div', { class: 'inv-item', style: { borderColor: RAR[it.r].color, boxShadow: `0 0 18px -8px ${RAR[it.r].color}` } },
        el('div', { class: 'inv-ico', text: it.ico }),
        el('div', { class: 'inv-name', text: it.name }),
        el('div', { class: 'inv-rar', style: { color: RAR[it.r].color }, text: RAR[it.r].name }),
        el('button', { class: 'btn btn-sm', style: { marginTop: '6px' }, html: 'Продать 🍯' + U.fmt(Math.round(it.value * .1)),
          onclick: () => {
            const real = inv.indexOf(it);
            if (real >= 0) inv.splice(real, 1);
            Store.addHoney(Math.round(it.value * .1));
            Snd.play('coin'); renderInv();
          } })
      ));
    });
    p.appendChild(grid);
    return p;
  }
  function renderInv() {
    const old = view.querySelector('.panel.anim-item .inv-grid');
    const host = view.querySelector('.inv-host');
    if (host) { host.replaceChildren(); host.appendChild(inventoryPanel()); }
  }
  function sellAll() {
    const inv = Store.state.cases.inventory;
    const sell = inv.filter((i) => i.r !== 'common' && i.r !== 'rare');
    if (!sell.length) return UI.toast('Нечего продавать', 'info');
    const sum = sell.reduce((a, i) => a + Math.round(i.value * .1), 0);
    Store.state.cases.inventory = inv.filter((i) => i.r === 'common' || i.r === 'rare');
    Store.addHoney(sum); Snd.play('buy');
    UI.toast('Продано трофеев: ' + sell.length + ', получено 🍯' + U.fmt(sum), 'good');
    renderInv();
  }

  /* ----------- Анимация открытия ----------- */
  function openCase(c, mode) {
    if (spinState) return;
    // оплата
    if (mode === 'free') {
      Store.state.cases.lastFree = Date.now();
    } else if (mode === 'ticket') {
      if (Store.state.cases.tickets <= 0) return deny();
      Store.state.cases.tickets--;
    } else {
      if (!Store.spendHoney(c.cost)) return deny();
    }
    function deny() { Snd.play('deny'); UI.toast('Не хватает средств/билетов', 'bad'); mountRef(); }

    const horseshoe = Store.state.shop.consumables.luck > 0;
    if (horseshoe) Store.state.shop.consumables.luck--;

    const winner = rollItem(c);
    const N = 52, WIN = 44;
    const strip = [];
    for (let i = 0; i < N; i++) strip.push(i === WIN ? winner : rollItem(c));

    const ITEM_W = 168, GAP = 12, STEP = ITEM_W + GAP;
    const overlay = el('div', { class: 'case-overlay' });
    const box = el('div', { class: 'case-box', style: { background: c.grad } });
    box.append(
      el('div', { class: 'case-box-title' }, c.ico + ' ' + c.name),
      el('div', { class: 'reel-window' },
        el('div', { class: 'reel-pointer' }),
        el('div', { class: 'reel-glow' }),
        (() => {
          const rail = el('div', { class: 'reel-rail' });
          strip.forEach((it) => {
            rail.appendChild(el('div', { class: 'reel-item', dataset: { rar: it.r },
              style: { width: ITEM_W + 'px', borderColor: RAR[it.r].color, background: `linear-gradient(180deg, ${RAR[it.r].color}22, var(--panel))` } },
              el('div', { class: 'reel-ico', text: it.ico }),
              el('div', { class: 'reel-name', text: it.name }),
              el('div', { class: 'reel-val', style: { color: RAR[it.r].color }, html: '🍯 ' + U.fmt(it.value) })));
          });
          return rail;
        })()
      ),
      el('div', { class: 'case-status muted', text: 'Крутим…' }),
      el('button', { class: 'btn btn-sm btn-ghost hide close-ov', text: 'Забрать' })
    );
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay && spinState && spinState.canClose) closeOverlay(); });
    document.body.appendChild(overlay);
    Snd.play('caseSpin');

    const rail = box.querySelector('.reel-rail');
    const winW = box.querySelector('.reel-window').clientWidth || 600;
    const jitter = U.rand(-STEP * 0.32, STEP * 0.32);
    const target = -(WIN * STEP - (winW / 2 - ITEM_W / 2)) + jitter;

    spinState = { canClose: false };
    const dur = 6200, t0 = performance.now();
    let crossed = 0, lastTickIndex = 0;

    function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3.4); // замедление
      const x = STEP * 4 + (target - STEP * 4) * e;
      rail.style.transform = `translateX(${x}px)`;
      const idx = Math.floor((-x + winW / 2) / STEP);
      if (idx !== lastTickIndex && t < 0.93) {
        lastTickIndex = idx;
        Snd.play('reel');
        crossed++;
      }
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    requestAnimationFrame(frame);

    function finish() {
      spinState.canClose = true;
      const winEl = rail.children[WIN];
      winEl.classList.add('winner');
      const meta = RAR[winner.r];
      box.querySelector('.case-status').innerHTML =
        `<span style="color:${meta.color};font-weight:800">${meta.name}</span> · ${winner.ico} ${winner.name}`;
      Store.addHoney(winner.value);
      Store.state.stats.casesOpened++;
      Store.state.cases.opened++;
      Store.state.cases.inventory.push({ caseId: c.id, ...winner });
      if (Store.state.cases.inventory.length > 200) Store.state.cases.inventory.splice(0, Store.state.cases.inventory.length - 200);
      Store.save();

      const big = winner.r === 'legendary' || winner.r === 'relic';
      if (big) {
        box.classList.add('case-big');
        confetti(box, winner.r === 'relic' ? '#ff4d5e' : '#f5b53c');
        Snd.play('relic' === winner.r ? 'explode' : 'rare');
        Snd.play('bigwin');
        UI.toast(`${winner.ico} ${winner.name} — ${meta.name}! +🍯${U.fmt(winner.value)}`, 'good', winner.ico);
      } else if (winner.r === 'epic') {
        Snd.play('rare'); UI.toast(`Эпик: ${winner.name}! +🍯${U.fmt(winner.value)}`, 'good', winner.ico);
      } else {
        Snd.play('win');
      }
      const closeBtn = box.querySelector('.close-ov');
      closeBtn.classList.remove('hide');
      closeBtn.textContent = `Забрать 🍯${U.fmt(winner.value)}`;
      closeBtn.onclick = closeOverlay;
      renderInv();
      mountRef();
    }
  }

  function closeOverlay() {
    const o = document.querySelector('.case-overlay');
    if (o) { o.classList.add('closing'); setTimeout(() => o.remove(), 250); }
    spinState = null;
  }

  function confetti(parent, color) {
    for (let i = 0; i < 60; i++) {
      const p = el('div', { class: 'confetti' });
      const left = U.rand(0, 100);
      Object.assign(p.style, {
        left: left + '%', background: Math.random() < .5 ? color : '#fff',
        animationDelay: U.rand(0, 0.5) + 's', animationDuration: U.rand(1.2, 2.4) + 's'
      });
      parent.appendChild(p);
      setTimeout(() => p.remove(), 3000);
    }
  }

  function mountRef() {
    const node = document.getElementById('view-game-cases');
    if (node && node.classList.contains('active')) Pages['game-cases'].mount(node);
  }

  function mount(v) {
    view = v;
    const c = Store.state.cases;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {},
        el('h1', { text: '📦 Кейсы' }),
        el('p', { text: 'Прокрутка с замедлением, пять редкостей, реликты с шансом 0,3–3%. Студенческий паёк можно открывать бесплатно каждые 20 минут — и за билеты.' })),
      el('div', { class: 'ph-side flex gap8' },
        el('div', { class: 'currency' }, el('span', { text: '🎟️' }), el('b', { text: c.tickets })),
        freeTicketReady()
          ? el('div', { class: 'currency', style: { borderColor: 'var(--good)', color: 'var(--good)' }, text: '🎁 Бесплатный готов!' })
          : el('div', { class: 'currency', id: 'freeTimer', text: '⏳ ' + fmtTime(freeInMs()) }))
    ));

    v.appendChild(el('div', { class: 'grid grid-3 case-grid' }, ...CASES.map(caseCard)));

    const invHost = el('div', { class: 'inv-host' }, inventoryPanel());
    v.appendChild(invHost);

    v.appendChild(el('div', { class: 'panel anim-item' },
      el('div', { class: 'panel-title', text: 'Статистка кейсов' }),
      el('div', { class: 'grid grid-4' },
        kpi('Кейсов открыто', c.opened),
        kpi('Трофеев в зале', c.inventory.filter((i) => ['epic', 'legendary', 'relic'].includes(i.r)).length),
        kpi('Подков удачи', Store.state.shop.consumables.luck),
        kpi('Билетов', c.tickets)
      )));

    clearInterval(freeTimer);
    freeTimer = setInterval(() => {
      const t = v.querySelector('#freeTimer');
      if (freeTicketReady()) { clearInterval(freeTimer); mountRef(); return; }
      if (t) t.textContent = '⏳ ' + fmtTime(freeInMs());
    }, 1000);
  }

  function kpi(k, val) {
    return el('div', { class: 'kpi' }, el('div', { class: 'kpi-v mono', text: U.fmt(val) }), el('div', { class: 'kpi-k muted', text: k }));
  }
  function fmtTime(ms) {
    const m = Math.ceil(ms / 1000);
    return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  }

  function unmount() { clearInterval(freeTimer); Store.flush(); }

  Pages['game-cases'] = { mount, unmount };
})();
