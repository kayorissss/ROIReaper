/* ============ slots.js — видеослот «Мёд удачи» ============ */
(function () {
  'use strict';
  const { el } = U;

  const SYMS = [
    { id: 'wild',  ico: '🐝', weight: 6,   pay: { 3: 10, 4: 50, 5: 300 } },
    { id: 'honey', ico: '🍯', weight: 12,  pay: { 3: 5, 4: 25, 5: 150 } },
    { id: 'star',  ico: '⭐', weight: 16,  pay: { 3: 4, 4: 20, 5: 100 } },
    { id: 'bell',  ico: '🔔', weight: 20,  pay: { 3: 3, 4: 15, 5: 60 } },
    { id: 'flower',ico: '🌸', weight: 24,  pay: { 3: 2, 4: 10, 5: 40 } },
    { id: 'soda',  ico: '🥤', weight: 26,  pay: { 3: 1, 4: 5, 5: 20 } },
    { id: 'tea',   ico: '🍵', weight: 28,  pay: { 3: 1, 4: 4, 5: 15 } }
  ];
  const SCATTER = '👑';
  const BY_ID = Object.fromEntries(SYMS.map((s) => [s.id, s]));
  const LINES = (() => {
    // 20 линий на сетке 3 ряда (паттерны смещений по барабанам)
    const L = [];
    const patterns = [
      [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],
      [0,1,2,1,0],[2,1,0,1,2],[1,0,0,0,1],[1,2,2,2,1],
      [0,0,1,0,0],[2,2,1,2,2],[1,0,1,0,1],[1,2,1,2,1],
      [0,1,0,1,0],[2,1,2,1,2],[1,1,0,1,1],[1,1,2,1,1],
      [0,1,1,1,0],[2,1,1,1,2],[0,2,0,2,0],[2,0,2,0,2],[1,0,2,0,1]
    ];
    patterns.forEach((p) => L.push(p));
    return L;
  })();

  function randSym() {
    const s = U.weighted(SYMS.map((x) => ({ item: x, w: x.weight }))).item;
    return s.id;
  }
  function isScatter(id) { return id === 'scatter'; }

  function spinResult() {
    // сетка 5x3
    const grid = [];
    for (let r = 0; r < 5; r++) {
      const reel = [];
      for (let row = 0; row < 3; row++) {
        reel.push(Math.random() < 0.03 ? 'scatter' : randSym());
      }
      grid.push(reel);
    }
    return grid;
  }

  function evaluate(grid, lineBet, mult = 1) {
    const wins = [];
    LINES.forEach((line, li) => {
      const seq = line.map((row, ri) => grid[ri][row]);
      // вайлд-замена: первый не-вайлд символ; скаттер не в линию
      let first = seq.find((s) => s !== 'wild' && s !== 'scatter');
      if (!first) first = 'wild';
      let count = 0;
      const cells = [];
      for (let ri = 0; ri < 5; ri++) {
        const s = seq[ri];
        if (s === first || s === 'wild') { count++; cells.push([ri, line[ri]]); }
        else break;
      }
      const def = BY_ID[first];
      if (count >= 3 && def && def.pay[count]) {
        wins.push({ line: li, count, sym: first, cells: cells.slice(0, count), amount: Math.round(def.pay[count] * lineBet * mult) });
      }
    });
    // скаттеры
    const scat = [];
    grid.forEach((reel, ri) => reel.forEach((s, row) => { if (s === 'scatter') scat.push([ri, row]); }));
    let scatterWin = 0, trigger = 0;
    if (scat.length >= 3) {
      const totalBet = lineBet * LINES.length;
      scatterWin = { 3: 2, 4: 10, 5: 50 }[Math.min(5, scat.length)] * totalBet * mult;
      trigger = scat.length >= 3 ? 10 : 0;
    }
    return { wins, scat, scatterWin, trigger, total: wins.reduce((a, w) => a + w.amount, 0) + scatterWin };
  }

  let view, state;

  function mount(v) {
    view = v;
    state = {
      bet: state?.bet || 20, spinning: false, auto: 0, free: 0, mult: 1,
      lastWin: 0, totalWin: 0, grid: spinResult(), reSpinsLeft: 0
    };

    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🎰 Слоты «Мёд удачи»' }),
        el('p', { text: '20 линий, вайлд 🐝 заменяет символы, три 👑 дают 10 фриспинов с множителем ×3.' }))));
    v.appendChild(Casino.bonusBadge());

    const machine = el('div', { class: 'panel slot-machine anim-item' });
    const reelsWrap = el('div', { class: 'slot-reels' });
    const reels = [];
    for (let ri = 0; ri < 5; ri++) {
      const reel = el('div', { class: 'slot-reel' });
      const viewport = el('div', { class: 'slot-reel-vp' });
      const strip = el('div', { class: 'slot-strip' });
      viewport.appendChild(strip);
      reel.appendChild(viewport);
      reelsWrap.appendChild(reel);
      reels.push({ reel, strip, vp: viewport });
    }
    // указатель центральной линии
    machine.appendChild(el('div', { class: 'slot-frame' }));
    machine.appendChild(reelsWrap);

    const info = el('div', { class: 'slot-info' },
      cell('Баланс', '🍯 ', 'slot-balance'),
      cell('Ставка', '🍯 ', 'slot-bet-val'),
      cell('Выигрыш', '🍯 ', 'slot-win-val'),
      cell('Фриспины', '', 'slot-free-val')
    );

    const controls = el('div', { class: 'slot-controls' },
      Casino.betControl(() => state.bet, (x) => { state.bet = snapBet(x); sync(); }, { min: 20 }),
      el('div', { class: 'flex gap8 slot-actions' },
        el('button', { class: 'btn btn-lg btn-primary slot-spin', text: 'КРУТИТЬ' }),
        el('button', { class: 'btn btn-lg slot-auto', text: 'АВТО ×10' }),
        el('button', { class: 'btn btn-ghost btn-sm slot-paybtn', text: 'Таблица' })
      )
    );
    machine.append(info, controls);
    v.appendChild(machine);

    v.appendChild(paytablePanel());

    function cell(label, icon, cls) {
      return el('div', { class: 'slot-cell' },
        el('div', { class: 'slot-cell-v mono ' + cls, html: icon + '0' }),
        el('div', { class: 'slot-cell-k muted', text: label }));
    }

    function snapBet(x) { return Math.max(20, Math.round(x / 20) * 20); }

    const spinBtn = machine.querySelector('.slot-spin');
    const autoBtn = machine.querySelector('.slot-auto');
    spinBtn.addEventListener('click', () => doSpin());
    autoBtn.addEventListener('click', () => {
      if (state.auto > 0) { state.auto = 0; sync(); return; }
      state.auto = 10; sync(); doSpin();
    });
    machine.querySelector('.slot-paybtn').addEventListener('click', showPaytable);

    function sync() {
      machine.querySelector('.slot-balance').textContent = U.fmt(Store.state.honey);
      machine.querySelector('.slot-bet-val').textContent = U.fmt(state.bet);
      machine.querySelector('.slot-win-val').textContent = U.fmt(state.lastWin);
      machine.querySelector('.slot-free-val').textContent = state.free > 0 ? state.free + ' ×' + state.mult : '—';
      spinBtn.disabled = state.spinning || (Store.state.honey < state.bet && state.free === 0);
      spinBtn.textContent = state.free > 0 ? `ФРИСПИН ${state.free}` : 'КРУТИТЬ';
      autoBtn.textContent = state.auto > 0 ? 'СТОП ×' + state.auto : 'АВТО ×10';
    }

    function paintGrid(grid, instant) {
      reels.forEach((r, ri) => {
        // длинная лента: случайные символы + в конце финальные 3
        r.strip.style.transition = 'none';
        r.strip.style.transform = 'translateY(0)';
        r.strip.replaceChildren();
        const fillerCount = 24;
        for (let i = 0; i < fillerCount; i++) {
          r.strip.appendChild(symCell(Math.random() < 0.03 ? 'scatter' : randSym(), []));
        }
        grid[ri].forEach((s) => r.strip.appendChild(symCell(s, [ri])));
        r._final = fillerCount;
        if (instant) {
          const h = r.vp.clientHeight || 240;
          r.strip.style.transform = `translateY(-${fillerCount * 80}px)`;
        }
      });
    }

    function symCell(id, reelIdx) {
      const isScat = id === 'scatter';
      const ico = isScat ? SCATTER : (BY_ID[id]?.ico || '🍯');
      const cell = el('div', { class: 'slot-sym' + (isScat ? ' scatter' : id === 'wild' ? ' wild' : '') }, ico);
      return cell;
    }

    function highlight(cellsArr, scat) {
      reels.forEach((r, ri) => Array.from(r.strip.children).forEach((c) => c.classList.remove('lit', 'scatlit')));
      // подсветить финальные ячейки
      const cells = new Set(cellsArr.map(([ri, row]) => ri + ':' + row));
      reels.forEach((r, ri) => {
        for (let row = 0; row < 3; row++) {
          const node = r.strip.children[r._final + row];
          if (cells.has(ri + ':' + row)) node.classList.add('lit');
        }
      });
      scat.forEach(([ri, row]) => reels[ri].strip.children[reels[ri]._final + row].classList.add('scatlit'));
    }

    async function doSpin() {
      if (state.spinning) return;
      const isFree = state.free > 0;
      if (!isFree) {
        if (!Casino.takeBet(state.bet)) { state.auto = 0; sync(); return; }
      }
      state.spinning = true;
      state.lastWin = 0; sync();

      const grid = spinResult();
      paintGrid(grid);
      reelsWrap.classList.add('rolling');
      Snd.play('caseSpin');

      // анимация барабанов с последовательной остановкой
      const stops = [];
      reels.forEach((r, ri) => {
        requestAnimationFrame(() => {
          const dist = r._final * 80;
          const dur = 0.9 + ri * 0.32;
          r.strip.style.transition = `transform ${dur}s cubic-bezier(.12,.62,.16,1.04)`;
          r.strip.style.transform = `translateY(-${dist}px)`;
        });
        stops.push(0.9 + ri * 0.32);
      });
      // тики
      let tickInt = setInterval(() => Snd.play('reel'), 90);
      await U.sleep(Math.max(...stops) * 1000 + 200);
      clearInterval(tickInt);
      reelsWrap.classList.remove('rolling');

      const lineBet = state.bet / LINES.length;
      const res = evaluate(grid, lineBet, isFree ? 3 : 1);
      state.grid = grid;
      highlight(res.wins.flatMap((w) => w.cells), res.scat);

      if (res.total > 0) {
        Casino.payWin(res.total);
        state.lastWin = res.total; state.totalWin += res.total;
        animateCounter(machine.querySelector('.slot-win-val'), res.total);
        if (res.total >= state.bet * 15) { Snd.play('bigwin'); bigWinOverlay(res.total); }
        else if (res.scatterWin > 0) Snd.play('rare');
        else Snd.play('win');
      } else {
        Casino.countLoss();
        Snd.play('lose');
      }

      // фриспины
      if (res.trigger) UI.toast('👑 Фриспины! +' + res.trigger + ' с множителем ×3', 'good', '🎰');
      if (isFree) state.free = state.free - 1 + res.trigger;
      else if (res.trigger) state.free = res.trigger;
      state.mult = state.free > 0 ? 3 : 1;

      state.spinning = false; sync();

      if (state.auto > 0) {
        state.auto--;
        setTimeout(() => { if (state.auto >= 0 && (Store.state.honey >= state.bet || state.free > 0)) doSpin(); else { state.auto = 0; sync(); } }, 700);
      } else if (state.free > 0) {
        setTimeout(doSpin, 700);
      }
    }

    function animateCounter(node, total) {
      U.tweenNumber(0, total, 700, (v) => { node.textContent = U.fmt(v); });
    }

    function bigWinOverlay(amount) {
      const o = el('div', { class: 'bigwin-overlay' },
        el('div', { class: 'bigwin-card' },
          el('div', { class: 'bigwin-ico', text: '🎉' }),
          el('div', { class: 'bigwin-label', text: 'КРУПНЫЙ ВЫИГРЫШ' }),
          el('div', { class: 'bigwin-amount gold-text mono', text: '🍯 ' + U.fmt(amount) }),
          el('button', { class: 'btn btn-primary', text: 'Забрать', onclick: () => o.remove() })));
      document.body.appendChild(o);
      setTimeout(() => o.classList.add('show'), 10);
      setTimeout(() => o.remove(), 4200);
    }

    function showPaytable() {
      const rows = SYMS.map((s) => el('div', { class: 'pay-row' },
        el('span', { style: { fontSize: '24px' }, text: s.ico }),
        el('span', { text: '×3 🍯' + s.pay[3] }),
        el('span', { text: '×4 🍯' + s.pay[4] }),
        el('span', { text: '×5 🍯' + U.fmt(s.pay[5]) })));
      UI.modalOpen('Таблица выплат', el('div', {},
        el('p', { class: 'muted', style: { fontSize: '11.5px', marginBottom: '10px' }, text: 'Выплаты с линии (line bet). Вайлд 🐝 заменяет обычные символы. Скаттер 👑 платит в любой позиции: ×2/×10/×50 от общей ставки и даёт фриспины.' }),
        el('div', { class: 'pay-table' }, rows),
        el('p', { class: 'muted', style: { fontSize: '11px', marginTop: '10px' }, text: '20 линий · фриспины: ×3 ко всем выигрышам · RTP ≈ 95%' })
      ));
    }

    paintGrid(state.grid, true);
    sync();
  }

  function paytablePanel() {
    return el('div', { class: 'panel anim-item' },
      el('div', { class: 'panel-title', text: 'Символы' }),
      el('div', { class: 'pay-symbols' },
        ...SYMS.map((s) => el('div', { class: 'pay-sym' },
          el('div', { class: 'pay-sym-ico ' + s.id, text: s.ico }),
          el('div', { class: 'muted', style: { fontSize: '10px', marginTop: '4px' }, text: s.id === 'wild' ? 'вайлд' : `${s.pay[3]}/${s.pay[4]}/${U.fmt(s.pay[5])}` })
        )),
        el('div', { class: 'pay-sym' },
          el('div', { class: 'pay-sym-ico scatter', text: SCATTER }),
          el('div', { class: 'muted', style: { fontSize: '10px', marginTop: '4px' }, text: 'фриспины' }))
      ));
  }

  function onKey(e) {
    if (e.code === 'Space') {
      const b = view && view.querySelector('.slot-spin');
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  }

  Pages['game-slots'] = { mount, onKey };
})();
