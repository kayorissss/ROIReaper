/* ============ roulette.js — европейская рулетка ============ */
(function () {
  'use strict';
  const { el } = U;

  const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  // позиции номеров на сетке стола (рулеточная раскладка 12 столбцов x 3 ряда)
  const colorOf = (n) => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';

  let view, ctx, raf = null, spinning = false;
  let bets = [];            // {spot, amount}
  let chipVal = 10;
  let history = [];
  let lastResult = null;
  let stats = { red: 0, black: 0, green: 0 };

  function payout(spot, n) {
    if (spot.t === 'n') return spot.v === n ? 36 : 0;
    if (spot.t === 'color') return colorOf(n) === spot.v ? 2 : 0;
    if (spot.t === 'parity') return n !== 0 && ((n % 2 === 0) === (spot.v === 'even')) ? 2 : 0;
    if (spot.t === 'range') {
      if (n === 0) return 0;
      if (spot.v === 'low') return n <= 18 ? 2 : 0;
      return n >= 19 ? 2 : 0;
    }
    if (spot.t === 'dozen') {
      if (n === 0) return 0;
      return Math.ceil(n / 12) === spot.v ? 3 : 0;
    }
    if (spot.t === 'col') {
      if (n === 0) return 0;
      const col = n % 3 === 0 ? 3 : n % 3; // колонка 1: 1,4,7..
      return col === spot.v ? 3 : 0;
    }
    return 0;
  }

  function spotKey(s) { return s.t + ':' + s.v; }
  function addBet(spot) {
    if (spinning) return;
    if (Store.state.honey < chipVal) { Snd.play('deny'); UI.toast('Не хватает мёда', 'bad'); return; }
    if (!Casino.takeBet(chipVal)) return;
    const k = spotKey(spot);
    const b = bets.find((x) => spotKey(x.spot) === k);
    if (b) b.amount += chipVal; else bets.push({ spot, amount: chipVal });
    Snd.play('coin'); paintBets(); sync();
  }

  function paintBets() {
    view.querySelectorAll('[data-spot]').forEach((node) => {
      const cur = node.querySelector('.spot-chip');
      if (cur) cur.remove();
      const [t, v] = node.dataset.spot.split(':');
      const b = bets.find((x) => spotKey(x.spot) === t + ':' + (isNaN(+v) ? v : +v));
      if (b) {
        const c = el('div', { class: 'spot-chip mono', text: b.amount >= 1000 ? U.fmt(b.amount) : b.amount });
        node.appendChild(c);
      }
      node.classList.remove('spot-win', 'spot-lose');
    });
  }
  function markBets(n) {
    let totalRet = 0;
    view.querySelectorAll('[data-spot]').forEach((node) => {
      const [t, raw] = node.dataset.spot.split(':');
      const spot = { t, v: isNaN(+raw) ? raw : +raw };
      const p = payout(spot, n);
      if (p > 0) {
        node.classList.add('spot-win');
        const b = bets.find((x) => spotKey(x.spot) === spotKey(spot));
        if (b) totalRet += b.amount * p;
      } else if (bets.some((b) => spotKey(b.spot) === spotKey(spot))) node.classList.add('spot-lose');
    });
    return totalRet;
  }

  /* ---------- колесо ---------- */
  function drawWheel(angle, ballAngle, ballRadius) {
    const c = ctx.canvas;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) / 2 - 8;
    ctx.clearRect(0, 0, W, H);
    const N = 37;

    // внешний кант
    ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7); ctx.fillStyle = '#1d1d24'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7);
    const grad = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R);
    grad.addColorStop(0, '#2a2517'); grad.addColorStop(1, '#3a2f12');
    ctx.fillStyle = grad; ctx.fill();

    for (let i = 0; i < N; i++) {
      const a0 = angle + (i / N) * Math.PI * 2;
      const a1 = angle + ((i + 1) / N) * Math.PI * 2;
      const num = WHEEL[i];
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
      ctx.fillStyle = colorOf(num) === 'red' ? '#7e1c1c' : colorOf(num) === 'green' ? '#1d6b38' : '#15151a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,181,60,.55)'; ctx.lineWidth = 1; ctx.stroke();

      // номер
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((a0 + a1) / 2);
      ctx.fillStyle = '#f4e7c8';
      ctx.font = 'bold 11px Unbounded, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(num, R - 12, 0);
      ctx.restore();
    }
    // спицы
    ctx.beginPath(); ctx.arc(cx, cy, R * .62, 0, 7);
    ctx.fillStyle = '#241e10'; ctx.fill();
    ctx.strokeStyle = 'rgba(245,181,60,.5)'; ctx.lineWidth = 2; ctx.stroke();

    // центр с лого
    ctx.beginPath(); ctx.arc(cx, cy, R * .34, 0, 7);
    const g2 = ctx.createRadialGradient(cx, cy, 4, cx, cy, R * .34);
    g2.addColorStop(0, '#f5b53c'); g2.addColorStop(1, '#5c3d05');
    ctx.fillStyle = g2; ctx.fill();
    ctx.fillStyle = '#1a1305'; ctx.font = 'bold 22px Unbounded, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🐝', cx, cy);

    // шарик
    if (ballAngle != null) {
      const bx = cx + Math.cos(ballAngle) * ballRadius;
      const by = cy + Math.sin(ballAngle) * ballRadius;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7);
      ctx.fillStyle = '#f6f6f8'; ctx.fill();
      ctx.beginPath(); ctx.arc(bx - 2, by - 2, 2.5, 0, 7); ctx.fillStyle = '#c9c9d4'; ctx.fill();
    }
  }

  function spin() {
    if (spinning) return;
    if (!bets.length) { Snd.play('deny'); UI.toast('Сделай хотя бы одну ставку', 'bad'); return; }
    spinning = true;
    lastResult = null;
    sync();
    const n = U.randInt(0, 36);
    history.unshift(n); history = history.slice(0, 30);
    stats[colorOf(n)]++;

    const idx = WHEEL.indexOf(n);
    const sectorAngle = (idx + 0.5) / 37 * Math.PI * 2;
    // начальные углы
    let wheelA = Math.random() * 6.28;
    const startBall = -Math.PI / 2;
    const wheelTurns = U.randInt(5, 7);
    // целевой поворот: центр сектора номера должен встать наверх (-π/2)
    const finalBase = -Math.PI / 2 - sectorAngle;
    const finalWheel = finalBase + Math.PI * 2 * (wheelTurns + 6);
    // целевой угол шарика (сектор выбранного номера оказывается сверху)
    const ballFinal = -Math.PI / 2;
    const ballTurns = Math.PI * 2 * 10;
    const dur = 5200, t0 = performance.now();
    Snd.play('caseSpin');

    function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const wheel = wheelA + (finalWheel - wheelA) * e;
      // шарик: сначала быстрый бег, потом торможение и «прыжки» в конце
      const ballRaw = startBall + ballTurns * (1 - Math.pow(1 - t, 2.2));
      const ball = ballRaw;
      const R = ctx.canvas.width / 2 - 8;
      let br = R - 26;
      if (t > .72) {
        const rest = (t - .72) / .28;
        br = R - 26 - Math.abs(Math.sin(rest * 14)) * (1 - rest) * 26 - rest * 12;
        br = Math.max(R * .62 + 10, br);
        if (Math.random() < .08) Snd.play('tick');
      }
      drawWheel(wheel, ball, br);
      if (t < 1) raf = requestAnimationFrame(frame);
      else finish(n, finalWheel);
    }
    raf = requestAnimationFrame(frame);
  }

  function finish(n, wheelAngle) {
    // сектор выигравшего номера к этому моменту стоит ровно наверху (-π/2), там же шарик
    drawWheel(wheelAngle, -Math.PI / 2, ctx.canvas.width / 2 - 8 - 38);
    const ret = markBets(n);
    const wagered = bets.reduce((a, b) => a + b.amount, 0);
    if (ret > 0) {
      Casino.payWin(ret);
      Snd.play('bigwin');
      result(true, n, ret - wagered, wagered);
    } else {
      Casino.countLoss();
      Snd.play('lose');
      result(false, n, -wagered, wagered);
    }
    lastResult = n;
    spinning = false;
    paintHistory(); sync();
    lastBets = bets.map((b) => ({ ...b }));
    bets = [];
  }
  let lastBets = [];

  function result(win, n, net, wagered) {
    const res = view.querySelector('.roul-result');
    const col = colorOf(n);
    res.replaceChildren(el('div', { class: `roul-result-card ${col} popIn` },
      el('div', { class: 'rr-num', text: n }),
      el('div', {},
        el('div', { style: { fontWeight: 800, fontSize: '15px' },
          text: win ? 'Выигрыш!' : 'Мимо' }),
        el('div', { class: 'muted', style: { fontSize: '11.5px' },
          html: `Ставка: 🍯${U.fmt(wagered)} · итог: <b style="color:${win ? 'var(--good)' : 'var(--bad)'}">${net >= 0 ? '+' : ''}🍯${U.fmt(net)}</b>` })
      )
    ));
  }

  function paintHistory() {
    const h = view.querySelector('.roul-history');
    if (!h) return;
    h.replaceChildren(...history.slice(0, 14).map((n) =>
      el('span', { class: 'hist-num ' + colorOf(n), text: n })));
  }

  function sync() {
    const total = bets.reduce((a, b) => a + b.amount, 0);
    view.querySelector('.roul-total').textContent = U.fmt(total);
    view.querySelector('.roul-balance').textContent = U.fmt(Store.state.honey);
    view.querySelector('.spin-roul').disabled = spinning || total === 0;
    view.querySelector('.clear-roul').disabled = spinning || total === 0;
    view.querySelectorAll('.chip-select').forEach((c) =>
      c.classList.toggle('on', +c.dataset.val === chipVal));
  }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🎡 Европейская рулетка' }),
        el('p', { text: 'Одно зеро, 37 номеров. Выбери фишку и кликай по полю. Выплаты: номер ×36, цвета/чёт ×2, дюжины/колонки ×3.' }))));

    const wrap = el('div', { class: 'roulette-wrap' });

    // колесо + история + контролы
    const left = el('div', { class: 'panel roul-left' },
      el('canvas', { id: 'roulCanvas', width: '380', height: '380', class: 'roul-canvas' }),
      el('div', { class: 'roul-history' }),
      el('div', { class: 'roul-result' }),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' } },
        el('div', { class: 'currency' }, el('span', { text: '🍯' }), el('b', { class: 'roul-balance mono' })),
        el('div', { class: 'currency' }, el('span', { text: '🎯' }), el('b', { class: 'roul-total mono', text: '0' })),
      ),
      el('div', { class: 'chip-row', style: { justifyContent: 'center' } },
        ...Casino.CHIPS.map((c) => el('button', {
          class: 'chip chip-' + c + ' chip-select', dataset: { val: c },
          text: c >= 1000 ? U.fmt(c) : c,
          onclick: () => { chipVal = c; Snd.play('tick'); sync(); }
        }))),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', marginTop: '8px' } },
        el('button', { class: 'btn btn-primary spin-roul', text: 'Крутить колесо' }),
        el('button', { class: 'btn clear-roul', text: 'Очистить' }),
        el('button', { class: 'btn repeat-roul', text: 'Повторить' })
      )
    );

    // стол
    const table = el('div', { class: 'roul-table' });
    const grid = el('div', { class: 'roul-grid' });

    // ряд: зеро + 12 колонок
    const head = el('div', { class: 'roul-row roul-row-num' });
    const zero = el('button', { class: 'rt-num rt-zero', dataset: { spot: 'n:0' }, text: '0' });
    zero.addEventListener('click', () => addBet({ t: 'n', v: 0 }));
    const nums = el('div', { class: 'rt-numbers' });
    for (let row = 0; row < 3; row++) {
      const rline = el('div', { class: 'rt-line' });
      for (let col = 0; col < 12; col++) {
        const n = col * 3 + (3 - row); // верхняя строка — 3,6,9...
        const b = el('button', { class: 'rt-num rt-' + colorOf(n), dataset: { spot: 'n:' + n }, text: n });
        b.addEventListener('click', () => addBet({ t: 'n', v: n }));
        rline.appendChild(b);
      }
      nums.appendChild(rline);
    }
    head.append(zero, nums);
    grid.appendChild(head);

    // дюжины
    const doz = el('div', { class: 'rt-outside rt-dozens' });
    [['1-я дюжина', 1], ['2-я дюжина', 2], ['3-я дюжина', 3]].forEach(([label, d]) => {
      const b = el('button', { class: 'rt-out', dataset: { spot: 'dozen:' + d }, text: label });
      b.addEventListener('click', () => addBet({ t: 'dozen', v: d }));
      doz.appendChild(b);
    });
    grid.appendChild(doz);

    // равные шансы
    const even = el('div', { class: 'rt-outside rt-even' });
    [
      ['1-18', 'range:low', ''], ['ЧЁТ', 'parity:even', ''], ['⛁', 'col:1', ''],
      ['КРАС', 'color:red', 'red'], ['ЧЁРН', 'color:black', 'black'],
      ['⛁', 'col:2', ''], ['НЕЧ', 'parity:odd', ''], ['19-36', 'range:high', '']
    ].forEach(([label, spot, extra]) => {
      const b = el('button', { class: 'rt-out' + (extra ? ' rt-' + extra : ''), dataset: { spot } });
      if (label === 'КРАС') b.style.color = '#ff8a8a';
      if (label === 'ЧЁРН') b.style.color = '#bfc3d4';
      b.textContent = label === '⛁' ? '2:1' : label;
      const [t, rv] = spot.split(':');
      b.addEventListener('click', () => addBet({ t, v: isNaN(+rv) ? rv : +rv }));
      even.appendChild(b);
    });
    // три колонки 2:1 по правому краю — добавляем вертикально внутри номеров справа
    const colBtns = el('div', { class: 'rt-cols' });
    [3, 2, 1].forEach((c) => {
      const b = el('button', { class: 'rt-out rt-col', dataset: { spot: 'col:' + c }, text: '2:1' });
      b.addEventListener('click', () => addBet({ t: 'col', v: c }));
      colBtns.appendChild(b);
    });
    const numsWrap = el('div', { class: 'rt-numbers-wrap' }, nums, colBtns);
    head.replaceChildren(zero, numsWrap);

    grid.appendChild(even);
    table.appendChild(grid);

    wrap.append(left, el('div', { class: 'panel table-panel' }, table,
      el('p', { class: 'muted', style: { fontSize: '10.5px', marginTop: '10px', textAlign: 'center' },
        text: 'Фишки складываются в одну ставку на клетке. Зеро проигрывает все равные шансы. RTP европейской рулетки ≈ 97,3%.' })
    ));
    v.appendChild(wrap);

    v.querySelector('.spin-roul').addEventListener('click', spin);
    v.querySelector('.clear-roul').addEventListener('click', () => {
      if (spinning) return;
      const total = bets.reduce((a, b) => a + b.amount, 0);
      Store.addHoney(total); // возврат ставок при очистке
      Store.state.stats.wagered -= total;
      bets = []; paintBets(); sync();
    });
    v.querySelector('.repeat-roul').addEventListener('click', () => {
      if (spinning || !lastBets.length) return;
      const total = lastBets.reduce((a, b) => a + b.amount, 0);
      if (Store.state.honey < total) { UI.toast('Не хватает мёда повторить ставки', 'bad'); return; }
      lastBets.forEach((b) => Casino.takeBet(b.amount) && bets.push({ ...b }));
      paintBets(); sync(); Snd.play('coin');
    });

    ctx = v.querySelector('#roulCanvas').getContext('2d');
    drawWheel(0, null, 0);
    paintHistory(); sync();
  }

  function unmount() { if (raf) cancelAnimationFrame(raf); spinning = false; }
  Pages['game-roulette'] = { mount, unmount };
})();
