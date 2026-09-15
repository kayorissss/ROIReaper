/* ============ clicker.js — Жатва Роя (кликер) ============ */
(function () {
  'use strict';
  const { el } = U;

  const GENS = [
    { id: 'worker',  name: 'Рабочая оса',        ico: '🐝', base: 15,       cps: 0.1 },
    { id: 'drone',   name: 'Дрон-сборщик',       ico: '🚁', base: 100,      cps: 1 },
    { id: 'plant',   name: 'Нектарный завод',    ico: '🏭', base: 1100,     cps: 8 },
    { id: 'hive',    name: 'Улей-небоскрёб',     ico: '🏙️', base: 12000,    cps: 47 },
    { id: 'fields',  name: 'Захваченные поля',   ico: '🌻', base: 130000,   cps: 260 },
    { id: 'incub',   name: 'Королевский инкубатор', ico: '👑', base: 1.4e6, cps: 1400 },
    { id: 'quantum', name: 'Квантовый пасечник', ico: '⚛️', base: 2.0e7,   cps: 7800 },
    { id: 'leviath', name: 'Жнец-левиафан',      ico: '🌌', base: 3.3e8,    cps: 44000 }
  ];

  const UPGRADES = [
    { id: 'u_click1', name: 'Заточка жала',      desc: 'Сила клика ×2',        cost: 100,    need: () => true, kind: 'click', mult: 2 },
    { id: 'u_click2', name: 'Адамантиновое жало', desc: 'Сила клика ×2',       cost: 5000,   need: () => Store.state.clicker.totalHoney > 2000, kind: 'click', mult: 2 },
    { id: 'u_click3', name: 'Коса Жнеца',         desc: 'Сила клика ×3',       cost: 250000, need: () => Store.state.clicker.totalHoney > 1e5, kind: 'click', mult: 3 },
    { id: 'u_worker1', name: 'Роевые мандибулы',  desc: 'Рабочие осы ×2',      cost: 500,    need: () => lvl('worker') >= 5, kind: 'gen', target: 'worker', mult: 2 },
    { id: 'u_drone1', name: 'Турбины дронов',     desc: 'Дроны ×2',            cost: 6000,   need: () => lvl('drone') >= 5, kind: 'gen', target: 'drone', mult: 2 },
    { id: 'u_plant1', name: 'Конвейер нектара',   desc: 'Заводы ×2',           cost: 60000,  need: () => lvl('plant') >= 5, kind: 'gen', target: 'plant', mult: 2 },
    { id: 'u_hive1', name: 'Соты-мегаполисы',     desc: 'Ульи ×2',             cost: 650000, need: () => lvl('hive') >= 5, kind: 'gen', target: 'hive', mult: 2 },
    { id: 'u_fields1', name: 'Пыльцевые бури',    desc: 'Поля ×2',             cost: 7e6,    need: () => lvl('fields') >= 5, kind: 'gen', target: 'fields', mult: 2 },
    { id: 'u_incub1', name: 'Матки-близнецы',     desc: 'Инкубаторы ×2',       cost: 8e7,    need: () => lvl('incub') >= 5, kind: 'gen', target: 'incub', mult: 2 },
    { id: 'u_crit1', name: 'Токсичный укус',      desc: '15% крит ×10 за клик', cost: 2500,  need: () => Store.state.clicker.totalHoney > 1000, kind: 'crit', chance: .15 },
    { id: 'u_crit2', name: 'Ярость роя',          desc: 'Шанс крита +20%',      cost: 4e5,   need: () => Store.state.clicker.upgrades['u_crit1'], kind: 'crit', chance: .2 },
    { id: 'u_global1', name: 'Феромоны порядка',  desc: 'Всё производство ×2', cost: 2e6,    need: () => Store.state.clicker.totalHoney > 8e5, kind: 'global', mult: 2 },
    { id: 'u_global2', name: 'Великая жатва',     desc: 'Всё производство ×2', cost: 1.5e8,  need: () => Store.state.clicker.totalHoney > 6e7, kind: 'global', mult: 2 }
  ];

  function lvl(id) { return Store.state.clicker.generators[id] || 0; }
  function genCost(g, n) {
    const have = lvl(g.id);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += g.base * Math.pow(1.15, have + i);
    return Math.ceil(sum);
  }
  function clickMult() {
    const c = Store.state.clicker;
    let m = 1;
    UPGRADES.forEach((u) => { if (u.kind === 'click' && c.upgrades[u.id]) m *= u.mult; });
    m *= (1 + c.resets * 0.02);
    if (Store.state.shop.skin === 'golden') m *= 1.05;
    m *= (1 + jellyBonus());
    m *= ShopItems.rewardMult();
    return m;
  }
  function genMult(gid) {
    const c = Store.state.clicker;
    let m = 1;
    UPGRADES.forEach((u) => { if (u.kind === 'gen' && u.target === gid && c.upgrades[u.id]) m *= u.mult; });
    UPGRADES.forEach((u) => { if (u.kind === 'global' && c.upgrades[u.id]) m *= u.mult; });
    m *= (1 + c.resets * 0.02);
    if (Store.state.shop.skin === 'cyber') m *= 1.10;
    m *= (1 + jellyBonus());
    m *= ShopItems.rewardMult();
    return m;
  }
  function critChance() {
    const c = Store.state.clicker; let ch = 0;
    UPGRADES.forEach((u) => { if (u.kind === 'crit' && c.upgrades[u.id]) ch += u.chance; });
    return Math.min(ch, .6);
  }
  function jellyBonus() { return Store.state.jelly * 0.02; }
  function cps() {
    let s = 0;
    GENS.forEach((g) => { s += g.cps * lvl(g.id) * genMult(g.id); });
    return s;
  }
  function clickPower() { return Store.state.clicker.clickPower * clickMult(); }

  function jellyOnReset() {
    const total = Store.state.clicker.totalHoney;
    let n = Math.floor(Math.sqrt(Math.max(0, total - 1e6) / 1e6));
    if (Store.state.shop.skin === 'ghost') n = Math.floor(n * 1.25);
    return Math.max(0, n);
  }

  const SKIN_ICO = { reaper: '🐝', golden: '👑', cyber: '🤖', ghost: '👻' };

  let view, raf, lastTick = performance.now(), golden = null, tab = 'gens';

  function offlineGain() {
    const c = Store.state.clicker;
    const away = Math.min(8 * 3600 * 1000, Date.now() - Store.state.lastSeen);
    const gain = (away / 1000) * cps() * 0.5;
    if (gain >= 1) {
      Store.addHoney(gain);
      c.totalHoney += gain;
      UI.modalOpen('С возвращением в улей!', el('div', {},
        el('p', { style: { fontSize: '13px', marginBottom: '10px' },
          html: `Пока тебя не было (${Math.round(away / 60000)} мин), рой собрал:` }),
        el('div', { class: 'offline-loot gold-text', text: '🍯 ' + U.fmt(gain) }),
        el('p', { class: 'muted', style: { fontSize: '11px', marginTop: '8px' }, text: 'Офлайн-доход составляет 50% от обычного, максимум за 8 часов.' })
      ));
    }
  }

  function floatNumber(x, y, text, big) {
    const n = el('div', { class: 'click-float' + (big ? ' crit' : ''), text });
    Object.assign(n.style, { left: x + 'px', top: y + 'px' });
    view.querySelector('.clicker-stage').appendChild(n);
    setTimeout(() => n.remove(), 1000);
  }

  function spawnGolden() {
    if (golden || !view || !view.isConnected) return;
    const dur = 12000;
    golden = { until: performance.now() + dur };
    const btn = el('div', { class: 'golden-wasp', title: 'Лови дикую осу!' }, '🐝');
    btn.style.left = U.rand(12, 78) + '%';
    btn.style.top = U.rand(14, 70) + '%';
    const reward = () => {
      const fromClicks = clickPower() * 90;
      const fromCps = cps() * 90;
      const base = Math.max(fromClicks, fromCps);
      return Math.ceil(base * U.rand(3, 7));
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = reward();
      Store.addHoney(r);
      Store.state.clicker.totalHoney += r;
      floatNumber(e.clientX, e.clientY, '+🍯 ' + U.fmt(r), true);
      UI.toast('Дикая оса! +🍯 ' + U.fmt(r), 'good', '🌟');
      Snd.play('rare');
      golden = null;
      btn.remove();
      scheduleGolden();
    });
    view.querySelector('.clicker-stage').appendChild(btn);
    golden.node = btn;
    setTimeout(() => { if (golden) { golden = null; btn.remove(); scheduleGolden(); } }, dur);
  }
  let goldenTimer = null;
  function scheduleGolden() {
    clearTimeout(goldenTimer);
    goldenTimer = setTimeout(spawnGolden, U.rand(55000, 130000));
  }

  function renderTop() {
    view.querySelector('.ck-honey').textContent = U.fmt(Store.state.honey);
    view.querySelector('.ck-cps').textContent = U.fmt(cps());
    view.querySelector('.ck-power').textContent = U.fmt(clickPower());
    view.querySelector('.ck-jelly').textContent = U.fmt(Store.state.jelly);
    view.querySelector('.ck-jelly-bonus').textContent = '+' + Math.round(jellyBonus() * 100) + '%';
    view.querySelector('#reaperFace').textContent = SKIN_ICO[Store.state.shop.skin] || '🐝';
  }

  function renderShop() {
    const list = view.querySelector('.ck-shop-list');
    if (!list) return;
    list.replaceChildren();
    if (tab === 'gens') {
      GENS.forEach((g, idx) => {
        const have = lvl(g.id);
        const cost = genCost(g, 1);
        const cost10 = genCost(g, Math.min(10, 10));
        const afford = Store.state.honey >= cost;
        const row = el('div', { class: 'gen-row' + (afford ? '' : ' locked') },
          el('div', { class: 'gen-ico' }, g.ico),
          el('div', { class: 'gen-info' },
            el('div', { class: 'gen-name' }, g.name, el('span', { class: 'gen-owned', text: '×' + have })),
            el('div', { class: 'muted', style: { fontSize: '10.5px' },
              html: `даёт 🍯 ${U.fmt(g.cps * genMult(g.id))}/с за шт.` })),
          el('div', { class: 'gen-buy' },
            el('button', { class: 'btn btn-sm ' + (afford ? 'btn-primary' : ''), disabled: !afford,
              html: '🍯 ' + U.fmt(cost),
              onclick: () => buyGen(g, 1) }),
            el('button', { class: 'btn btn-sm', disabled: Store.state.honey < genCost(g, 10),
              html: '×10 🍯' + U.fmt(genCost(g, 10)),
              onclick: () => buyGen(g, 10) })
          )
        );
        row.style.animationDelay = (idx * 0.03) + 's';
        list.appendChild(row);
      });
    } else if (tab === 'upg') {
      const avail = UPGRADES.filter((u) => !Store.state.clicker.upgrades[u.id] && u.need());
      if (!avail.length) list.appendChild(el('div', { class: 'empty-note', text: 'Все доступные улучшения куплены. Жми осу и развивай рой!' }));
      avail.forEach((u) => {
        const afford = Store.state.honey >= u.cost;
        list.appendChild(el('div', { class: 'gen-row upg-row' + (afford ? '' : ' locked') },
          el('div', { class: 'gen-ico upg-ico' }, '🧪'),
          el('div', { class: 'gen-info' },
            el('div', { class: 'gen-name', text: u.name }),
            el('div', { class: 'muted', style: { fontSize: '10.5px' }, text: u.desc })),
          el('div', { class: 'gen-buy' },
            el('button', { class: 'btn btn-sm ' + (afford ? 'btn-primary' : ''), disabled: !afford,
              html: '🍯 ' + U.fmt(u.cost), onclick: () => buyUp(u) }))
        ));
      });
      const bought = UPGRADES.filter((u) => Store.state.clicker.upgrades[u.id]);
      if (bought.length) list.appendChild(el('div', { class: 'muted', style: { fontSize: '11px', marginTop: '10px' }, text: 'Куплено улучшений: ' + bought.length + ' / ' + UPGRADES.length }));
    } else {
      const gain = jellyOnReset();
      list.appendChild(el('div', { class: 'prestige-box' },
        el('div', { class: 'big-ico', style: { fontSize: '44px', marginBottom: '8px' }, text: '👑' }),
        el('div', { class: 'gen-name', text: 'Новый Рой (престиж)' }),
        el('p', { class: 'muted', style: { fontSize: '11.5px', margin: '8px 0' },
          html: 'Сбрось мёд, генераторы и улучшения, чтобы получить <b>королевское желе</b>. Каждое желе навсегда даёт <b>+2%</b> ко всей добыче и кликам. Скин «Оса-фантом» усиливает награды на +25%.' }),
        el('div', { class: 'gold-text', style: { fontSize: '24px', fontWeight: 800, margin: '6px 0 12px' }, text: 'Получишь: 👑 ' + gain }),
        el('p', { class: 'muted', style: { fontSize: '10.5px', marginBottom: '10px' }, text: 'Первое желе доступно после 1 млн суммарного мёда за забег.' }),
        el('button', { class: 'btn btn-primary btn-block', disabled: gain <= 0,
          text: gain > 0 ? 'Переродить рой' : 'Нужно больше мёда…',
          onclick: async () => {
            const ok = await UI.confirm('Новый Рой', `Начать новый рой и получить ${gain} ед. королевского желе? Мёд и постройки сбросятся.`, 'Переродить');
            if (!ok) return;
            Store.addJelly(gain);
            const c = Store.state.clicker;
            c.generators = {}; c.upgrades = {}; c.clickPower = 1; c.totalHoney = 0; c.resets++;
            Store.state.honey = 50;
            Store.save();
            Snd.play('bigwin'); UI.toast('Рой перерождён! Бонус желе: 👑 ' + gain, 'good');
            renderAll();
          } })
      ));
      list.appendChild(el('div', { class: 'muted center', style: { fontSize: '11px', marginTop: '10px' },
        html: `Перерождений: <b>${Store.state.clicker.resets}</b> · бонус желе сейчас: <b>+${Math.round(jellyBonus() * 100)}%</b>` }));
    }
  }

  function buyGen(g, n) {
    const cost = genCost(g, n);
    if (!Store.spendHoney(cost)) { Snd.play('deny'); return; }
    Store.state.clicker.generators[g.id] = lvl(g.id) + n;
    Snd.play('coin'); Store.save();
    renderAll();
  }
  function buyUp(u) {
    if (!Store.spendHoney(u.cost)) { Snd.play('deny'); return; }
    Store.state.clicker.upgrades[u.id] = true;
    Snd.play('buy'); UI.toast('Улучшение: ' + u.name, 'good');
    Store.save(); renderAll();
  }

  function renderAll() { renderTop(); renderShop(); }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'clicker-wrap' },
      // ЛЕВО: сцена клика
      el('div', { class: 'clicker-stage panel' },
        el('div', { class: 'ck-top' },
          el('div', {},
            el('div', { class: 'ck-honey-wrap' }, el('span', { text: '🍯' }), el('b', { class: 'ck-honey gold-text mono' })),
            el('div', { class: 'muted', style: { fontSize: '11px' } },
              el('span', { text: 'в секунду: ' }), el('b', { class: 'ck-cps mono', text: '0' }))),
          el('div', { class: 'ck-jelly-wrap', title: 'Бонус за желе' },
            el('span', { text: '👑' }), el('b', { class: 'ck-jelly mono' }), el('span', { class: 'ck-jelly-bonus muted' }))
        ),
        el('div', { class: 'reaper-btn-wrap' },
          el('button', { class: 'reaper-btn', id: 'reaperBtn', 'aria-label': 'Жать!' },
            el('div', { class: 'reaper-aura' }),
            el('div', { class: 'reaper-face', id: 'reaperFace', text: '🐝' }),
            el('div', { class: 'reaper-glow' })),
          el('div', { class: 'reaper-hint muted' },
            el('b', { text: 'Кликай / пробел' }),
            el('span', { text: ' сила клика 🍯 ' }), el('b', { class: 'ck-power mono' }))
        ),
        el('div', { class: 'ck-stats' })
      ),
      // ПРАВО: магазин
      el('div', { class: 'clicker-shop panel' },
        el('div', { class: 'ck-tabbar' },
          tabBtn('gens', '🐝 Постройки'),
          tabBtn('upg', '🧪 Улучшения'),
          tabBtn('pres', '👑 Престиж')
        ),
        el('div', { class: 'ck-shop-list' })
      )
    ));

    function tabBtn(id, label) {
      return el('button', { class: 'ck-tab' + (tab === id ? ' on' : ''), text: label,
        onclick: (e) => { tab = id; Snd.play('tab'); v.querySelectorAll('.ck-tab').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); renderShop(); } });
    }

    // статы снизу
    const stats = Store.state.stats;
    v.querySelector('.ck-stats').append(
      miniStat('Кликов всего', U.fmtFull(stats.clicks)),
      miniStat('Собрано за всё', '🍯 ' + U.fmt(Store.state.clicker.totalHoney)),
      miniStat('Шанс крита', Math.round(critChance() * 100) + '%'),
      miniStat('Лучший забег', '🍯 ' + U.fmt(Store.state.clicker.best))
    );
    function miniStat(k, val) {
      return el('div', { class: 'ck-stat' }, el('div', { class: 'ck-stat-v', text: val }), el('div', { class: 'ck-stat-k muted', text: k }));
    }

    const btn = v.querySelector('#reaperBtn');
    function doClick(e) {
      const c = Store.state.clicker;
      stats.clicks++;
      const crit = Math.random() < critChance();
      const gain = clickPower() * (crit ? 10 : 1);
      Store.addHoney(gain, true);
      c.totalHoney += gain;
      c.best = Math.max(c.best, c.totalHoney);
      Store.state.honey; // триггер рисовки
      UI.renderCurrency();
      const r = btn.getBoundingClientRect();
      const x = (e.clientX || r.left + r.width / 2), y = (e.clientY || r.top);
      floatNumber(x, y, '+' + U.fmt(gain), crit);
      btn.classList.remove('reaper-tap'); void btn.offsetWidth; btn.classList.add('reaper-tap');
      Snd.play('click');
      renderTop();
    }
    btn.addEventListener('click', doClick);

    // тик производства
    lastTick = performance.now();
    function tick(now) {
      const dt = Math.min(1, (now - lastTick) / 1000);
      lastTick = now;
      const g = cps() * dt;
      if (g > 0) {
        Store.addHoney(g, true);
        Store.state.clicker.totalHoney += g;
        if (Math.random() < 0.12) UI.renderCurrency();
        renderTop();
      }
      if (golden && golden.until < now && golden.node) { /* таймаут сам уберёт */ }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    scheduleGolden();
    offlineGain();
    renderAll();
  }

  function onKey(e) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      const b = view && view.querySelector('#reaperBtn');
      if (b) b.click();
    }
  }
  function unmount() {
    cancelAnimationFrame(raf);
    clearTimeout(goldenTimer);
    golden = null;
    Store.save(); Store.flush();
  }

  Pages['game-clicker'] = { mount, unmount, onKey };
})();
