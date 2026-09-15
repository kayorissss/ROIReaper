/* ============ coin.js — Орёл и Решка ============ */
(function () {
  'use strict';
  const { el } = U;

  const PAYOUT = 1.96;
  let view, bet = 50, side = 'heads', flipping = false, streak = 0, best = 0, history = [];

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🪙 Орёл и Решка' }),
        el('p', { text: 'Угадай сторону. Выплата ×1.96. Серия растёт — чем дольше рискуешь, тем громче победа (но монетка не прощает).' }))));

    const panel = el('div', { class: 'panel coin-panel anim-item' });
    const coin = el('div', { class: 'coin3d' },
      el('div', { class: 'coin-face coin-heads' },
        el('div', { class: 'coin-inner' }, el('div', { class: 'coin-big', text: '🐝' }), el('div', { text: 'ОРЁЛ' }))),
      el('div', { class: 'coin-face coin-tails' },
        el('div', { class: 'coin-inner' }, el('div', { class: 'coin-big', text: '🍯' }), el('div', { text: 'РЕШКА' })))
    );
    const streakEl = el('div', { class: 'coin-streak muted', text: 'Серия: 0 · рекорд: 0' });
    const result = el('div', { class: 'coin-result muted', text: 'Выбери сторону и подбрось' });
    panel.append(coin, streakEl, result);

    const ctl = el('div', { class: 'panel anim-item' },
      Casino.betControl(() => bet, (x) => bet = x, { min: 10 }),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' } },
        el('button', { class: 'btn btn-lg coin-side btn-primary', 'data-side': 'heads', text: '🐝 Орёл' }),
        el('button', { class: 'btn btn-lg btn-primary coin-flip', text: 'ПОДБРОСИТЬ' }),
        el('button', { class: 'btn btn-lg coin-side', 'data-side': 'tails', text: '🍯 Решка' })),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', marginTop: '10px' } },
        el('div', { class: 'currency' }, el('span', { text: '🍯' }), el('b', { class: 'coin-bal mono' })),
        el('div', { class: 'currency' }, el('span', { text: 'Выплата' }), el('b', { class: 'mono', text: '×' + PAYOUT })))
    );
    const hist = el('div', { class: 'panel anim-item coin-history-panel' },
      el('div', { class: 'panel-title', text: 'История бросков' }),
      el('div', { class: 'coin-history', text: '— пока пусто —' }));

    v.append(Casino.bonusBadge(), panel, ctl, hist);

    const sides = ctl.querySelectorAll('.coin-side');
    function syncSides() {
      sides.forEach((b) => b.classList.toggle('btn-primary', b.dataset.side === side));
      ctl.querySelector('.coin-bal').textContent = U.fmt(Store.state.honey);
    }
    sides.forEach((b) => b.addEventListener('click', () => {
      side = b.dataset.side; Snd.play('tab'); syncSides();
    }));

    function paintHistory() {
      const h = hist.querySelector('.coin-history');
      if (!history.length) return;
      h.replaceChildren(...history.slice(0, 24).map((x) =>
        el('span', { class: 'coin-dot ' + (x.win ? 'win' : 'lose'), title: x.res === 'heads' ? 'Орёл' : 'Решка',
          text: x.res === 'heads' ? '🐝' : '🍯' })));
    }

    async function flip() {
      if (flipping) return;
      if (!Casino.takeBet(bet)) return;
      flipping = true;
      result.className = 'coin-result muted'; result.textContent = 'Монетка в воздухе…';
      Snd.play('caseSpin');

      const res = Math.random() < 0.5 ? 'heads' : 'tails';
      // анимация: много оборотов + финальная сторона
      const base = res === 'heads' ? 0 : 180;
      const extra = 360 * U.randInt(6, 9);
      coin.style.transform = `rotateX(${base + extra}deg)`;
      await U.sleep(2600);

      const win = res === side;
      history.unshift({ res, win });
      if (win) {
        const pay = Math.floor(bet * PAYOUT);
        Casino.payWin(pay);
        streak++; best = Math.max(best, streak);
        result.innerHTML = `<b style="color:var(--good)">Победа! +🍯${U.fmt(pay - bet)} · серия ${streak}</b>`;
        Snd.play(streak >= 3 ? 'bigwin' : 'win');
      } else {
        Casino.countLoss();
        streak = 0;
        result.innerHTML = `<b style="color:var(--bad)">Мимо. Выпала ${res === 'heads' ? '🐝 Орёл' : '🍯 Решка'}</b>`;
        Snd.play('lose');
      }
      streakEl.textContent = `Серия: ${streak} · рекорд: ${best}`;
      paintHistory();
      flipping = false; syncSides();
    }
    ctl.querySelector('.coin-flip').addEventListener('click', flip);
    syncSides();
  }

  function onKey(e) {
    if (e.code === 'Space') { const b = view && view.querySelector('.coin-flip'); if (b && !flipping) { e.preventDefault(); b.click(); } }
  }
  Pages['game-coin'] = { mount, onKey };
})();
