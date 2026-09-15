/* ============ imperium.js — Империя Роя (глобальная стратегия) ============ */
(function () {
  'use strict';
  const { el } = U;

  const W = 5, H = 4;
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const FACTIONS = [
    { id: 'p',  name: 'Рой Жнеца',  color: '#f5b53c', dark: '#5c3d05', human: true },
    { id: 'r',  name: 'Багровый улей', color: '#f0524a', dark: '#5a1410', human: false },
    { id: 'i',  name: 'Ледяной рой', color: '#54c8f0', dark: '#123a48', human: false },
    { id: 'v',  name: 'Матки пурпура', color: '#a07bff', dark: '#2c1650', human: false }
  ];
  const TERRAINS = {
    fields: { name: 'Нектарные поля', icon: '🌻', def: 0, inc: 1.2 },
    forest: { name: 'Дремучий лес', icon: '🌲', def: .25, inc: .9 },
    hills:  { name: 'Холмы', icon: '⛰️', def: .4, inc: 1.0 },
    swamp:  { name: 'Топкие камыши', icon: '🌾', def: .55, inc: .75 }
  };
  const PROV_NAMES = [
    'Амбра','Вереск','Соты','Липовица','Камка',
    'Трутнёвка','Жалейка','Медовка','Прополис','Дымка',
    'Янтарь','Квинтэссенция','Бражник','Пасека','Коруна',
    'Остролист','Грозотрут','Чернолес','Златоцвет','Пурпурные топи'
  ];

  let G = null, view, tileNodes = {}, log = [], selected = null, ended = false;

  function idx(x, y) { return y * W + x; }
  function prov(x, y) { return G.provinces[idx(x, y)]; }
  function adjacent(p) {
    const out = [];
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) out.push(prov(nx, ny));
    });
    return out;
  }
  const fac = (id) => G.factions.find((f) => f.id === id);
  const owned = (fid) => G.provinces.filter((p) => p.owner === fid);
  const capOf = (fid) => G.provinces.find((p) => p.owner === fid && p.capital);

  function newGame() {
    G = {
      year: 1512, month: 2,
      factions: FACTIONS.map((f) => ({ ...f, treasury: 250, mil: 0, eco: 0, alive: true, atWarWith: [] })),
      provinces: [],
      nextEvent: 5,
      log: []
    };
    const tkeys = Object.keys(TERRAINS);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      G.provinces.push({
        x, y, name: PROV_NAMES[idx(x, y)],
        terrain: tkeys[(x * 7 + y * 3) % tkeys.length],
        owner: null, dev: 1, fort: 0, army: 0, capital: false
      });
    }
    // стартовые кланы по углам
    const starts = [
      ['p', [[0,3,3,22],[1,3,2,10],[0,2,2,12],[1,2,1,6]]],
      ['r', [[4,3,3,22],[3,3,2,10],[4,2,2,12],[3,2,1,6]]],
      ['i', [[0,0,3,22],[1,0,2,10],[0,1,2,12],[1,1,1,6]]],
      ['v', [[4,0,3,22],[3,0,2,10],[4,1,2,12],[3,1,1,6]]]
    ];
    starts.forEach(([fid, list]) => list.forEach(([x, y, dev, army]) => {
      const p = prov(x, y); p.owner = fid; p.dev = dev; p.army = army;
      if (dev === 3) p.capital = true;
    }));
    pushLog('Королева Роя Жнеца взошла на трон в Амбре. Да начнётся Великая Жатва!');
  }

  function pushLog(text, kind) {
    G.log.unshift({ text, kind, date: dateStr() });
    G.log = G.log.slice(0, 40);
  }
  function dateStr() { return MONTHS[G.month] + ' ' + G.year; }

  function income(fid) {
    const ps = owned(fid);
    let inc = ps.reduce((a, p) => a + p.dev * 3 * TERRAINS[p.terrain].inc, 0);
    inc *= 1 + fac(fid).eco * .2;
    inc -= ps.reduce((a, p) => a + p.army * .12 + p.fort * 0.4, 0);
    return inc;
  }
  function recruitCost(n) { return 25 * n; }
  function cap(p) { return p.dev * 12; }
  function devCost(p) { return Math.floor(60 * Math.pow(1.6, p.dev - 1)); }
  function fortCost(p) { return 200 * (p.fort + 1); }
  function techCost(f, kind) { return 300 * Math.pow(1.8, f[kind]); }

  /* ---------- бой ---------- */
  function attack(att, def, troops, isAI) {
    const fA = fac(att.owner), fD = fac(def.owner);
    const tA = TERRAINS[att.terrain], tD = TERRAINS[def.terrain];
    att.army -= troops;
    const atkPow = troops * (1 + .12 * fA.mil) * U.rand(.85, 1.15);
    const defPow = (def.army || .5) * (1 + .12 * (fD ? fD.mil : 0)) *
      (1 + tD.def + .2 * def.fort) * U.rand(.85, 1.15) * (def.owner ? 1 : .3);

    let win = atkPow > defPow && (def.owner ? true : troops >= 3);
    let survivors, defLeft;
    if (win) {
      survivors = def.owner
        ? Math.max(1, Math.round(troops * Math.min(.9, .45 + .2 * (1 - defPow / Math.max(atkPow, .01)))))
        : troops;
      defLeft = 0;
      const oldOwner = def.owner;
      def.owner = att.owner; def.army = survivors;
      def.fort = Math.max(0, def.fort - 1);
      if (def.capital && oldOwner) {
        fac(oldOwner).alive = false;
        pushLog(`🏛 Столица «${fac(oldOwner).name}» пала под натиском «${fA.name}». Улей уничтожен!`, 'war');
      } else {
        pushLog(`⚔️ «${fA.name}» захватывает провинцию ${def.name}, в строю осталось ${survivors} полков.`, 'war');
      }
      if (!isAI) arrowAnim(att, def, true);
    } else {
      survivors = 0;
      defLeft = def.owner ? Math.max(1, Math.round((def.army || 0) * .6)) : def.army;
      def.army = defLeft;
      pushLog(`🛡️ Атака на ${def.name} отбита! Полегло ${troops} полков нападавших.`, 'war');
      if (!isAI) arrowAnim(att, def, false);
    }
    return win;
  }

  /* ---------- ИИ ---------- */
  function aiTurn() {
    G.factions.filter((f) => !f.human && f.alive).forEach((f) => {
      // экономика: тех / развитие / рекрутинг
      if (f.treasury > techCost(f, 'eco') && f.eco < 5 && U.chance(.4)) { f.treasury -= techCost(f, 'eco'); f.eco++; }
      if (f.treasury > techCost(f, 'mil') && f.mil < 5 && U.chance(.5)) { f.treasury -= techCost(f, 'mil'); f.mil++; }
      const ps = owned(f.id);
      // девелоп столиц
      const cand = ps.filter((p) => p.dev < 5 && f.treasury >= devCost(p));
      if (cand.length && U.chance(.6)) {
        const p = U.pick(cand); f.treasury -= devCost(p); p.dev++;
      }
      // рекрутинг — добираем до капа на границах
      ps.forEach((p) => {
        const want = cap(p);
        const need = Math.max(0, want - p.army);
        const n = Math.min(need, Math.floor(f.treasury / 25), 8);
        if (n > 0) { p.army += n; f.treasury -= recruitCost(n); }
      });
      // до 2 атак
      let acts = 2;
      while (acts-- > 0) {
        const fronts = [];
        ps.forEach((p) => adjacent(p).forEach((q) => {
          if (q.owner !== f.id) fronts.push([p, q]);
        }));
        if (!fronts.length) break;
        // выбираем цель: слабейшие соседские армии
        fronts.sort((a, b) => power(a[1], f.id) - power(b[1], f.id));
        const [at, tg] = fronts[0];
        if (at.army < 6) continue;
        const est = at.army * (1 + .12 * f.mil);
        const def = power(tg, f.id);
        if (est > def * 1.25 || (!tg.owner && at.army >= 3)) {
          attack(at, tg, tg.owner ? at.army : Math.min(at.army, 6), true);
          ps.length; // ps ссылается на старый снимок — добор только в след. ход
          break;
        }
      }
    });
  }
  function power(p, attackerFid) {
    const f = p.owner ? fac(p.owner) : null;
    return (p.army || .5) * (f ? 1 + .12 * f.mil : .3) *
      (1 + TERRAINS[p.terrain].def + .2 * p.fort);
  }

  /* ---------- месяц ---------- */
  function endMonth() {
    if (ended) return;
    G.month++; if (G.month > 11) { G.month = 0; G.year++; }
    G.factions.forEach((f) => {
      if (!f.alive) return;
      const inc = income(f.id);
      f.treasury = Math.max(0, f.treasury + inc);
      // медленный прирост новобранцев
      if (inc > 0) owned(f.id).forEach((p) => {
        if (p.army < cap(p) && U.chance(.35)) p.army += 1;
      });
    });
    if (income('p') < 0 && fac('p').treasury < 30) {
      // дезертирство при банкротстве
      const ps = owned('p');
      const p = ps.find((x) => x.army > 0);
      if (p) { p.army = Math.max(0, p.army - 2); pushLog('💸 Казна пуста: полки дезертируют из ' + p.name, 'bad'); }
    }
    aiTurn();
    // события
    G.nextEvent--;
    if (G.nextEvent <= 0 && fac('p').alive) { G.nextEvent = U.randInt(3, 7); setTimeout(doEvent, 350); }
    checkEnd();
    render();
    Store.state.games.imperium = serialize();
    Store.save();
  }

  const EVENTS = [
    () => ({
      title: '🌼 Благодатное цветение',
      text: 'Поля налились нектаром невиданной силы. Что прикажет королева?',
      opts: [
        ['Собрать всё в казну (+180 💰)', () => { fac('p').treasury += 180; }],
        ['Откормить полки (+8 армии в столице)', () => { capOf('p').army += 8; }]
      ]
    }),
    () => ({
      title: '🦠 Нашествие варроа',
      text: 'Клещи-варроа подтачивают рой. Фумигация стоит 120 монет.',
      opts: [
        ['Оплатить фумигацию (−120 💰)', () => {
          if (fac('p').treasury >= 120) fac('p').treasury -= 120;
          else { const p = U.pick(owned('p')); p.dev = Math.max(1, p.dev - 1); pushLog('Болезнь снизила развитие ' + p.name, 'bad'); }
        }],
        ['Игнорировать (−1 развитие случайной провинции)', () => {
          const p = U.pick(owned('p')); p.dev = Math.max(1, p.dev - 1);
        }]
      ]
    }),
    () => ({
      title: '🐝 Странствующая матка',
      text: 'Матка из разорённого улья просит убежища. Её свита усилит одну из провинций.',
      opts: [
        ['Принять: +6 армии и +50 💰', () => { capOf('p').army += 6; fac('p').treasury += 50; }],
        ['Прогнать (репутация крепости, +1 крепость столицы)', () => {
          const c = capOf('p'); if (c.fort < 3) c.fort++;
        }]
      ]
    }),
    () => ({
      title: '📜 Военный трактат Жнеца',
      text: 'Древний трактат о тактике роя. Изучить?',
      opts: [
        ['Военная наука (скидка на технологию)', () => { fac('p').treasury += Math.round(techCost(fac('p'), 'mil') * .5); }],
        ['Хозяйственная наука (скидка на экономику)', () => { fac('p').treasury += Math.round(techCost(fac('p'), 'eco') * .5); }]
      ]
    })
  ];
  function doEvent() {
    const e = U.pick(EVENTS)();
    const body = el('div', {},
      el('p', { style: { marginBottom: '14px', fontSize: '13px', lineHeight: 1.6 }, text: e.text }),
      el('div', { class: 'flex gap8', style: { flexDirection: 'column' } },
        ...e.opts.map(([label, fn]) => el('button', {
          class: 'btn btn-block', text: label,
          onclick: () => { fn(); UI.modalClose(); pushLog('Событие: ' + e.title); Store.state.games.imperium = serialize(); Store.save(); render(); Snd.play('buy'); }
        })))
    );
    UI.modalOpen(e.title, body, { wide: true });
    Snd.play('rare');
  }

  function checkEnd() {
    const player = fac('p');
    if (!player.alive || owned('p').length === 0) return gameOver(false);
    const enemiesAlive = G.factions.filter((f) => !f.human && f.alive).length;
    const ownedCount = owned('p').length;
    if (enemiesAlive === 0 || ownedCount >= Math.ceil(G.provinces.length * .6)) return gameOver(true);
  }
  function gameOver(win) {
    ended = true;
    const months = (G.year - 1512) * 12 + G.month - 2;
    if (win) {
      const reward = 600 + owned('p').length * 120 + Math.max(0, 240 - months) * 4;
      const jelly = 2;
      Store.addHoney(reward); Store.addJelly(jelly);
      Store.state.stats.imperiumWins++;
      UI.modalOpen('🏆 Империя построена!', el('div', {},
        el('p', { style: { fontSize: '13px', marginBottom: '10px' },
          text: `Ты объединил почти весь Нектарный материк за ${months} месяцев!` }),
        el('div', { class: 'offline-loot', html: `Награда: <span class="gold-text">🍯 ${U.fmt(reward)} · 👑 ${jelly}</span>` }),
        el('button', { class: 'btn btn-primary btn-block', style: { marginTop: '14px' }, text: 'Новая кампания',
          onclick: () => { UI.modalClose(); newGame(); ended = false; Store.state.games.imperium = null; render(); } })));
      Snd.play('bigwin');
    } else {
      UI.modalOpen('💀 Рой уничтожен', el('div', {},
        el('p', { style: { fontSize: '13px', marginBottom: '10px' }, text: 'Улей Жнеца пал. Историю пишут выжившие.' }),
        el('button', { class: 'btn btn-primary btn-block', text: 'Начать заново',
          onclick: () => { UI.modalClose(); newGame(); ended = false; Store.state.games.imperium = null; render(); } })));
      Snd.play('lose');
    }
  }

  function serialize() {
    return {
      year: G.year, month: G.month, nextEvent: G.nextEvent, log: G.log,
      factions: G.factions.map(({ id, treasury, mil, eco, alive }) => ({ id, treasury, mil, eco, alive })),
      provinces: G.provinces.map((p) => ({ x: p.x, y: p.y, owner: p.owner, dev: p.dev, fort: p.fort, army: p.army, terrain: p.terrain, name: p.name, capital: p.capital }))
    };
  }
  function restore(s) {
    newGame();
    G.year = s.year; G.month = s.month; G.nextEvent = s.nextEvent; G.log = s.log || [];
    s.factions.forEach((sf) => { const f = fac(sf.id); Object.assign(f, sf); });
    s.provinces.forEach((sp) => { const p = prov(sp.x, sp.y); Object.assign(p, sp); });
  }

  /* ---------- рендер ---------- */
  function mount(v) {
    view = v;
    if (Store.state.games.imperium) { try { restore(Store.state.games.imperium); } catch (e) { newGame(); } }
    else newGame();

    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '👑 Империя Роя' }),
        el('p', { text: 'Пошаговая стратегия: экономика по месяцам, полки, технологии и три ИИ-улья. Победа — 60% провинций или падение всех столиц.' })),
      el('div', { class: 'ph-side flex gap8' },
        el('button', { class: 'btn btn-sm', text: '📖 Справка', onclick: help }),
        el('button', { class: 'btn btn-sm btn-danger', text: 'Заново', onclick: async () => {
          if (await UI.confirm('Новая кампания', 'Текущая партия будет удалена.', 'Начать заново')) { newGame(); Store.state.games.imperium = null; ended = false; render(); }
        } }))
    ));

    const top = el('div', { class: 'imp-top' },
      statBox('📅', dateStr(), 'месяц'),
      statBox('💰', '', 'казна / доход', 'imp-money'),
      statBox('🪖', '', 'полков всего', 'imp-army'),
      statBox('🔬', '', 'технологии', 'imp-tech'),
      statBox('🗺', '', 'провинций', 'imp-terr'),
      el('button', { class: 'btn btn-primary imp-next', text: 'Следующий месяц ⏵' })
    );
    v.appendChild(top);

    const wrap = el('div', { class: 'imp-wrap' },
      el('div', { class: 'panel imp-map-panel' },
        el('div', { class: 'imp-map', id: 'impMap' })),
      el('div', { class: 'imp-side' },
        el('div', { class: 'panel imp-detail', id: 'impDetail' }),
        el('div', { class: 'panel imp-logpanel' },
          el('div', { class: 'panel-title', text: 'Летопись' }),
          el('div', { class: 'imp-log', id: 'impLog' })))
    );
    v.appendChild(wrap);

    v.querySelector('.imp-next').addEventListener('click', () => { Snd.play('tab'); endMonth(); });
    render();
  }

  function statBox(ico, val, label, id) {
    return el('div', { class: 'imp-stat card' },
      el('span', { class: 'imp-stat-ico', text: ico }),
      el('div', {}, el('b', { class: 'mono', id }, val), el('div', { class: 'muted', style: { fontSize: '9.5px' }, text: label })));
  }

  function render() {
    if (!view) return;
    const map = view.querySelector('#impMap');
    map.replaceChildren();
    tileNodes = {};
    G.provinces.forEach((p) => {
      const f = p.owner ? fac(p.owner) : null;
      const t = TERRAINS[p.terrain];
      const node = el('div', {
        class: 'tile' + (p.owner ? '' : ' neutral') + (selected === p ? ' selected' : ''),
        dataset: { i: idx(p.x, p.y) }
      });
      if (f) {
        node.style.background = `linear-gradient(145deg, color-mix(in srgb, ${f.color} 26%, var(--panel)), color-mix(in srgb, ${f.dark} 55%, var(--panel-2)))`;
        node.style.borderColor = colorMix(f.color, .6);
      }
      node.append(
        el('div', { class: 'tile-terrain', text: t.icon }),
        el('div', { class: 'tile-name', text: p.name }),
        el('div', { class: 'tile-bottom' },
          el('span', { class: 'tile-army mono' + (p.army ? '' : ' empty'), text: p.army ? '🪖' + p.army : '—' }),
          el('span', { class: 'tile-dev' },
          ...Array.from({ length: p.dev }, () => '▮'),
            el('span', { class: 'tile-fort', text: p.fort ? '🏰'.repeat(p.fort) : '' })))
      );
      if (p.capital) node.appendChild(el('div', { class: 'tile-cap', text: '👑' }));
      node.addEventListener('click', () => clickTile(p));
      map.appendChild(node);
      tileNodes[idx(p.x, p.y)] = node;
    });

    // статистика
    const pf = fac('p');
    setText('#imp-money', `${Math.floor(pf.treasury)} 💰 <small style="color:var(--muted)">${income('p') >= 0 ? '+' : ''}${income('p').toFixed(1)}/мес</small>`);
    setText('#imp-army', owned('p').reduce((a, p2) => a + p2.army, 0));
    setText('#imp-tech', `⚔${pf.mil} 🌾${pf.eco}`);
    setText('#imp-terr', `${owned('p').length}/${G.provinces.length}`);

    renderDetail();
    renderLog();
  }

  function setText(sel, text) {
    const n = view && view.querySelector(sel);
    if (n) n.innerHTML = text;
  }
  function colorMix(hex, a) { return hex; } // рамка красим напрямую

  function clickTile(p) {
    Snd.play('tab');
    const me = fac('p');
    if (!selected) { selected = p; render(); return; }
    if (selected === p) { selected = null; render(); return; }
    // соседняя?
    if (selected.owner === 'p' && adjacent(selected).includes(p)) {
      if (p.owner === 'p') transferDialog(selected, p);
      else attackDialog(selected, p);
      return;
    }
    selected = p; render();
  }

  function renderDetail() {
    const d = view.querySelector('#impDetail');
    d.replaceChildren();
    if (!selected) {
      d.appendChild(el('div', { class: 'muted', style: { fontSize: '12px' },
        text: 'Кликни по провинции, чтобы увидеть детали. Своя провинция позволяет нанимать полки, строить и перемещать армии; по соседям — атаковать.' }));
      return;
    }
    const p = selected, f = p.owner ? fac(p.owner) : null;
    const t = TERRAINS[p.terrain];
    d.appendChild(el('div', { class: 'detail-head' },
      el('div', {},
        el('div', { class: 'detail-name', text: t.icon + ' ' + p.name + (p.capital ? ' 👑' : '') }),
        el('div', { class: 'muted', style: { fontSize: '11px' },
          text: (f ? f.name : 'Нейтральные земли') + ' · ' + t.name + (p.fort ? ` · 🏰 ур. ${p.fort}` : '') })),
      el('div', { class: 'detail-army mono', text: '🪖 ' + p.army })
    ));

    const rows = [
      ['Развитие', '▮'.repeat(p.dev) + ' (доход ' + Math.round(p.dev * 3 * t.inc) + '/мес)'],
      ['Гарнизонный лимит', cap(p)],
      ['Оборона местности', '+' + Math.round(t.def * 100) + '%'],
      ['Крепость', p.fort ? 'ур. ' + p.fort + ' (+' + p.fort * 20 + '%)' : 'нет']
    ];
    rows.forEach(([k, v]) => d.appendChild(UI.statRow(k, v)));

    if (p.owner === 'p') {
      const btns = el('div', { class: 'flex gap8', style: { flexWrap: 'wrap', marginTop: '12px' } });
      addAct(btns, `+5 полков 🍯${recruitCost(5)}`, () => recruit(p, 5), p.army + 5 > cap(p) || fac('p').treasury < recruitCost(5));
      addAct(btns, `+10 🍯${recruitCost(10)}`, () => recruit(p, 10), p.army + 10 > cap(p) || fac('p').treasury < recruitCost(10));
      addAct(btns, `Развить 🍯${devCost(p)}`, () => { if (p.dev < 5 && fac('p').treasury >= devCost(p)) { fac('p').treasury -= devCost(p); p.dev++; Snd.play('buy'); after(); } },
        p.dev >= 5 || fac('p').treasury < devCost(p));
      addAct(btns, p.fort < 3 ? `Крепость 🍯${fortCost(p)}` : 'Крепость макс.',
        () => { if (p.fort < 3 && fac('p').treasury >= fortCost(p)) { fac('p').treasury -= fortCost(p); p.fort++; Snd.play('buy'); after(); } },
        p.fort >= 3 || fac('p').treasury < fortCost(p));
      d.appendChild(btns);

      // технологии
      const tech = el('div', { style: { marginTop: '12px', borderTop: '1px solid var(--line-soft)', paddingTop: '10px' } });
      tech.appendChild(UI.statRow('Военная технология (⚔ +12%/ур)', 'ур. ' + fac('p').mil));
      tech.appendChild(el('button', {
        class: 'btn btn-sm btn-block', style: { marginTop: '6px' },
        text: fac('p').mil >= 5 ? 'Макс.' : `Изучить ⚔ 🍯${techCost(fac('p'), 'mil')}`,
        disabled: fac('p').mil >= 5 || fac('p').treasury < techCost(fac('p'), 'mil'),
        onclick: () => { fac('p').treasury -= techCost(fac('p'), 'mil'); fac('p').mil++; Snd.play('buy'); after(); }
      }));
      tech.appendChild(UI.statRow('Хозяйская технология (+20% доход)', 'ур. ' + fac('p').eco));
      tech.appendChild(el('button', {
        class: 'btn btn-sm btn-block', style: { marginTop: '6px' },
        text: fac('p').eco >= 5 ? 'Макс.' : `Изучить 🌾 🍯${techCost(fac('p'), 'eco')}`,
        disabled: fac('p').eco >= 5 || fac('p').treasury < techCost(fac('p'), 'eco'),
        onclick: () => { fac('p').treasury -= techCost(fac('p'), 'eco'); fac('p').eco++; Snd.play('buy'); after(); }
      }));
      d.appendChild(tech);
    } else {
      const enemies = adjacent(p).filter((q) => q.owner === 'p');
      if (enemies.length) {
        d.appendChild(el('div', { class: 'muted', style: { fontSize: '11px', marginTop: '10px' },
          text: 'Выбери свою соседнюю провинцию и кликни по этой, чтобы атаковать. Или нажми:' }));
        enemies.forEach((src) => {
          d.appendChild(el('button', {
            class: 'btn btn-sm btn-danger btn-block', style: { marginTop: '6px' },
            text: `Атаковать из ${src.name} (🪖${src.army})`,
            onclick: () => { selected = src; attackDialog(src, p); }
          }));
        });
      }
    }
    function after() { Store.state.games.imperium = serialize(); Store.save(); render(); }
  }

  function addAct(host, label, fn, dis) {
    host.appendChild(el('button', { class: 'btn btn-sm', text: label, disabled: dis, onclick: fn }));
  }
  function recruit(p, n) {
    if (p.army + n > cap(p) || fac('p').treasury < recruitCost(n)) return Snd.play('deny');
    fac('p').treasury -= recruitCost(n); p.army += n; Snd.play('coin');
    Store.state.games.imperium = serialize(); Store.save(); render();
  }

  function attackDialog(at, tg) {
    const me = fac('p');
    const max = at.army;
    if (max <= 0) { UI.toast('Нет полков для атаки', 'bad'); return; }
    let n = max;
    const body = el('div', {});
    const est = () => Math.round(n * (1 + .12 * me.mil));
    const def = () => Math.round(power(tg, 'p'));
    const info = el('div', { class: 'battle-estimate' });
    function paintInfo() {
      const winP = U.clamp(Math.round(50 + 18 * Math.log2(Math.max(.05, est() / Math.max(def, .1)))), 5, 95);
      info.innerHTML = `
        <div class="be-row"><span>Наши силы</span><b>${est()} ⚔${me.mil}</b></div>
        <div class="be-row"><span>Оборона цели</b></b><b>${def()}${tg.fort ? ' 🏰' : ''} ${TERRAINS[tg.terrain].icon}</b></div>
        <div class="bar big" style="margin:8px 0"><div style="width:${winP}%;background:linear-gradient(90deg,var(--bad),var(--accent),var(--good))"></div></div>
        <div class="muted center" style="font-size:11px">Оценочная вероятность: ~${winP}%</div>`;
    }
    paintInfo();
    const slider = el('input', { type: 'range', min: 1, max, value: max, style: { width: '100%', margin: '10px 0' } });
    slider.addEventListener('input', () => { n = +slider.value; paintInfo(); });
    body.append(
      el('p', { style: { fontSize: '12.5px' }, html: `Атака на <b>${tg.name}</b>${tg.owner ? ' («' + fac(tg.owner).name + '»)' : ' (нейтральная провинция)'} из провинции <b>${at.name}</b>.` }),
      info, slider,
      el('div', { class: 'flex gap8' },
        el('button', { class: 'btn grow', text: '50%', onclick: () => { n = Math.max(1, Math.floor(max / 2)); slider.value = n; paintInfo(); } }),
        el('button', { class: 'btn grow', text: 'Все', onclick: () => { n = max; slider.value = n; paintInfo(); } })),
      el('div', { class: 'flex gap8', style: { marginTop: '12px', justifyContent: 'flex-end' } },
        el('button', { class: 'btn btn-ghost', text: 'Отмена', onclick: UI.modalClose }),
        el('button', {
          class: 'btn btn-danger', text: 'В атаку! ⚔',
          onclick: () => {
            UI.modalClose();
            const win = attack(at, tg, n, false);
            Snd.play(win ? 'bigwin' : 'explode');
            selected = tg.owner === 'p' ? tg : at;
            Store.state.games.imperium = serialize(); Store.save();
            render(); checkEnd();
          }
        }))
    );
    UI.modalOpen('Боевое развёртывание', body);
  }

  function transferDialog(from, to) {
    const max = from.army;
    if (max <= 0) { UI.toast('Некого отправлять', 'info'); return; }
    let n = Math.min(max, Math.max(0, cap(to) - to.army));
    if (n <= 0) n = Math.floor(max / 2);
    n = Math.max(1, Math.min(n, max));
    const body = el('div', {},
      el('p', { style: { fontSize: '12.5px', marginBottom: '10px' }, html: `Переброс полков из <b>${from.name}</b> в <b>${to.name}</b>. Свободный гарнизон цели: ${Math.max(0, cap(to) - to.army)}.` }),
      el('input', { type: 'range', min: 1, max, value: n, style: { width: '100%' }, oninput: (e) => (n = +e.target.value) }),
      el('div', { class: 'flex gap8', style: { marginTop: '12px', justifyContent: 'flex-end' } },
        el('button', { class: 'btn btn-ghost', text: 'Отмена', onclick: UI.modalClose }),
        el('button', { class: 'btn btn-primary', text: 'Марш!',
          onclick: () => {
            const room = cap(to) - to.army;
            const moved = Math.min(n, max, room);
            from.army -= moved; to.army += moved;
            arrowAnim(from, to, true, true);
            Snd.play('card'); UI.modalClose();
            Store.state.games.imperium = serialize(); Store.save(); render();
          } }))
    );
    UI.modalOpen('Передислокация', body);
  }

  function arrowAnim(a, b, ok, transfer) {
    const na = tileNodes[idx(a.x, a.y)], nb = tileNodes[idx(b.x, b.y)];
    if (!na || !nb) return;
    const ra = na.getBoundingClientRect(), rb = nb.getBoundingClientRect();
    const arrow = el('div', { class: 'imp-arrow ' + (transfer ? 'transfer' : ok ? 'win' : 'lose') });
    arrow.style.left = Math.min(ra.left, rb.left) + ra.width / 2 + 'px';
    arrow.style.top = Math.min(ra.top, rb.top) + ra.height / 2 + 'px';
    const dx = rb.left - ra.left, dy = rb.top - ra.top;
    const len = Math.hypot(dx, dy);
    arrow.style.width = len + 'px';
    arrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    document.body.appendChild(arrow);
    [na, nb].forEach((nn) => { nn.classList.add(ok ? 'flash-win' : 'flash-lose'); setTimeout(() => nn.classList.remove('flash-win', 'flash-lose'), 700); });
    setTimeout(() => arrow.remove(), 900);
  }

  function renderLog() {
    const l = view.querySelector('#impLog');
    l.replaceChildren(...G.log.map((e) =>
      el('div', { class: 'log-line ' + (e.kind || '') },
        el('span', { class: 'log-date muted', text: e.date }), el('span', { text: e.text }))));
  }

  function help() {
    UI.modalOpen('Как играть — Империя Роя', el('div', { class: 'help-body' },
      ...[
        '💰 Каждый месяц провинции приносят нектар: развитие (dev) × 3, рельеф даёт модификаторы.',
        '🪖 Полки нанимаются в своих провинциях в пределах гарнизонного лимита (развитие × 12). Содержание армии стоит 0,12 монеты в месяц.',
        '🏰 Крепости добавляют обороне +20% за уровень. Лес +25%, холмы +40%, камыши +55%.',
        '⚔ Чтобы атаковать: выбери свою провинцию и кликни по соседней чужой/нейтральной. Силы считаются с учётом технологий, рельефа и крепости.',
        '🔬 Военная технология даёт +12% к атаке/обороне за уровень, хозяйская — +20% к доходу. Максимум 5 уровней.',
        '👑 Захват столицы уничтожает фракцию. Победа — 12 из 20 провинций или все три вражеских улья пали.',
        '💾 Кампания сохраняется автоматически после каждого месяца. Прогресс можно сбросить кнопкой «Заново».'
      ].map((t) => el('p', { text: t }))
    ));
  }

  function unmount() { Store.state.games.imperium = serialize(); Store.save(); }

  Pages['game-imperium'] = { mount, unmount };
})();
