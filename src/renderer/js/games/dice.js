/* ============ dice.js — кости «больше/меньше» ============ */
(function () {
  'use strict';
  const { el } = U;

  let view, bet = 50, target = 50, over = false, rolling = false, history = [];

  function chance() { return over ? (100 - target) : target; }
  function mult() { return Math.max(1.01, (99 / chance()) * 0.99); }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🎲 Кости' }),
        el('p', { text: 'Двигай порог и выбирай направление. Бросок 0.00–100.00. Множитель зависит от шанса, edge всего 1%.' }))));

    const panel = el('div', { class: 'panel dice-panel anim-item' });

    const rollOut = el('div', { class: 'dice-roll mono', text: '50.00' });
    const hist = el('div', { class: 'dice-history' });

    // слайдер с двумя зонами
    const track = el('div', { class: 'dice-track' });
    const fillWin = el('div', { class: 'dice-fill-win' });
    const fillLose = el('div', { class: 'dice-fill-lose' });
    const handle = el('div', { class: 'dice-handle' });
    const marker = el('div', { class: 'dice-marker hide' });
    track.append(fillWin, fillLose, handle, marker);

    const info = el('div', { class: 'grid grid-3 dice-info' });
    function infoCell(k, val, cls) {
      return el('div', { class: 'dice-cell' }, el('div', { class: 'dice-cell-v mono ' + (cls || '') }, val), el('div', { class: 'dice-cell-k muted', text: k }));
    }
    function paintInfo() {
      info.replaceChildren(
        infoCell('Шанс', chance().toFixed(2) + '%'),
        infoCell('Множитель', '×' + mult().toFixed(2), 'gold-text'),
        infoCell('Выплата', '🍯 ' + U.fmt(Math.floor(bet * mult())))
      );
    }

    function paintTrack() {
      handle.style.left = target + '%';
      marker.style.left = target + '%';
      if (over) {
        fillWin.style.left = target + '%'; fillWin.style.right = '0'; fillWin.style.background = 'linear-gradient(90deg,transparent,var(--good))';
        fillLose.style.left = '0'; fillLose.style.right = (100 - target) + '%';
      } else {
        fillWin.style.left = '0'; fillWin.style.right = (100 - target) + '%'; fillWin.style.background = 'linear-gradient(90deg,var(--good),transparent)';
        fillLose.style.left = target + '%'; fillLose.style.right = '0';
      }
      paintInfo();
    }

    // перетаскивание мышью
    let dragging = false;
    function setFromEvent(e) {
      const r = track.getBoundingClientRect();
      const x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width * 100;
      target = Math.round(U.clamp(x, 2, 98));
      paintTrack();
    }
    track.addEventListener('mousedown', (e) => { dragging = true; setFromEvent(e); });
    window.addEventListener('mousemove', (e) => dragging && setFromEvent(e));
    window.addEventListener('mouseup', () => dragging = false);
    track.addEventListener('click', setFromEvent);

    panel.append(rollOut, hist, track, info);

    const ctl = el('div', { class: 'panel anim-item' },
      Casino.betControl(() => bet, (x) => { bet = x; paintInfo(); }, { min: 10 }),
      el('div', { class: 'flex gap8', style: { flexWrap: 'wrap', justifyContent: 'center', marginTop: '12px' } },
        el('button', { class: 'btn btn-lg dice-dir', text: '⬇ Меньше ' }),
        el('button', { class: 'btn btn-lg btn-primary dice-go', text: 'БРОСОК' }),
        el('button', { class: 'btn btn-lg dice-dir', text: '⬆ Больше' }),
        el('div', { class: 'currency' }, el('span', { text: '🍯' }), el('b', { class: 'dice-bal mono' }))
      ),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' } },
        ...[5, 25, 50, 75, 95].map((p) => el('button', {
          class: 'btn btn-sm', text: p + '%', onclick: () => { target = p; paintTrack(); Snd.play('tick'); }
        })),
        el('button', { class: 'btn btn-sm', text: '↔ Сменить', onclick: () => { over = !over; sync(); paintTrack(); } })
      )
    );

    v.append(Casino.bonusBadge(), panel, ctl);

    const dirBtns = ctl.querySelectorAll('.dice-dir');
    dirBtns[0].addEventListener('click', () => { over = false; sync(); });
    dirBtns[1].addEventListener('click', () => { over = true; sync(); });

    function sync() {
      dirBtns[0].classList.toggle('btn-primary', !over);
      dirBtns[1].classList.toggle('btn-primary', over);
      ctl.querySelector('.dice-bal').textContent = U.fmt(Store.state.honey);
    }
    sync(); paintTrack();

    async function roll() {
      if (rolling) return;
      if (!Casino.takeBet(bet)) return;
      rolling = true;
      Snd.play('caseSpin');
      marker.classList.add('hide');
      rollOut.classList.remove('win', 'lose');
      const result = Math.round(Math.random() * 10000) / 100;
      // анимация чисел
      const t0 = performance.now(), dur = 900;
      await new Promise((res) => {
        function f(now) {
          const t = Math.min(1, (now - t0) / dur);
          const fake = Math.random() * 100;
          rollOut.textContent = fake.toFixed(2);
          if (t < 1) requestAnimationFrame(f); else res();
        }
        requestAnimationFrame(f);
      });
      rollOut.textContent = result.toFixed(2);
      marker.classList.remove('hide');
      marker.style.left = result + '%';

      const win = over ? result > target : result < target;
      if (win) {
        const pay = Math.floor(bet * mult());
        Casino.payWin(pay);
        rollOut.classList.add('win');
        Snd.play('win'); UI.flyGain(rollOut, '+' + U.fmt(pay), 'var(--good)');
        if (mult() >= 10) Snd.play('bigwin');
      } else {
        Casino.countLoss();
        rollOut.classList.add('lose');
        Snd.play('lose');
      }
      history.unshift({ n: result, win }); history = history.slice(0, 20);
      hist.replaceChildren(...history.map((h) => el('span', { class: 'dice-chip ' + (h.win ? 'win' : 'lose'), text: h.n.toFixed(1) })));
      rolling = false;
      sync();
    }
    ctl.querySelector('.dice-go').addEventListener('click', roll);
  }

  function onKey(e) {
    if (e.code === 'Space') { const b = view && view.querySelector('.dice-go'); if (b && !rolling) { e.preventDefault(); b.click(); } }
  }
  Pages['game-dice'] = { mount, onKey };
})();
