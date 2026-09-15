/* ============ casino-shared.js — общее для казино ============ */
(function () {
  'use strict';
  const { el } = U;

  const CHIPS = [10, 50, 100, 500, 1000, 5000];

  // Контрол ставки: поле ввода + фишки + ползунок % банка
  function betControl(getBet, setBet, opts = {}) {
    const wrap = el('div', { class: 'bet-ctl' });
    const input = el('input', { type: 'number', min: '1', value: getBet(), class: 'bet-input mono' });
    input.addEventListener('input', () => {
      let v = Math.max(1, Math.floor(+input.value || 0));
      v = Math.min(v, Math.floor(Store.state.honey));
      setBet(v);
    });
    const chips = el('div', { class: 'chips' });
    CHIPS.forEach((c) => {
      chips.appendChild(el('button', {
        class: 'chip chip-' + c, type: 'button',
        text: c >= 1000 ? U.fmt(c) : c,
        onclick: () => {
          let v = getBet() + c;
          v = Math.min(v, Math.floor(Store.state.honey));
          setBet(v); input.value = v; Snd.play('tick');
        }
      }));
    });
    wrap.append(
      el('div', { class: 'flex gap8', style: { alignItems: 'center', flexWrap: 'wrap' } },
        el('label', { class: 'muted', style: { fontSize: '11px' }, text: 'Ставка 🍯' }),
        input,
        el('button', { class: 'btn btn-sm', text: '½', title: 'Половина банка',
          onclick: () => { const v = Math.max(1, Math.floor(Store.state.honey / 2)); setBet(v); input.value = v; } }),
        el('button', { class: 'btn btn-sm', text: 'MAX', title: 'Весь банк',
          onclick: () => { const v = Math.max(1, Math.floor(Store.state.honey)); setBet(v); input.value = v; } }),
        el('button', { class: 'btn btn-sm', text: 'Сброс', onclick: () => { setBet(opts.min || 10); input.value = opts.min || 10; } })
      ),
      chips
    );
    // синхронизация при смене баланса
    Store.on('honey', () => { if (+input.value > Store.state.honey) { const v = Math.max(1, Math.floor(Store.state.honey)); input.value = v; setBet(v); } });
    return wrap;
  }

  function takeBet(n) {
    if (Store.state.honey < n) { Snd.play('deny'); UI.toast('Недостаточно мёда для ставки', 'bad'); return false; }
    Store.addHoney(-n, true);
    Store.state.stats.wagered += n;
    return true;
  }
  function payWin(n) {
    Store.addHoney(n);
    Store.state.stats.won += n;
    Store.state.stats.casinoWins++;
  }
  function countLoss() { Store.state.stats.casinoLosses++; }

  // Карты: колода 52 / 36
  const SUITS = [
    { id: 'S', sym: '♠', name: 'пики', color: '#e8e8ee' },
    { id: 'H', sym: '♥', name: 'черви', color: '#ff5a5a' },
    { id: 'D', sym: '♦', name: 'бубны', color: '#ff5a5a' },
    { id: 'C', sym: '♣', name: 'трефы', color: '#e8e8ee' }
  ];
  const RANKS52 = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  function deck52(shuffled = true) {
    const d = [];
    SUITS.forEach((s) => RANKS52.forEach((r) => d.push({ rank: r, suit: s })));
    return shuffled ? U.shuffle(d) : d;
  }
  function deck36(shuffled = true) {
    const ranks = ['6','7','8','9','10','J','Q','K','A'];
    const d = [];
    SUITS.forEach((s) => ranks.forEach((r) => d.push({ rank: r, suit: s })));
    return shuffled ? U.shuffle(d) : d;
  }
  function bjValue(card) {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return +card.rank;
  }
  function bjScore(hand) {
    let sum = hand.reduce((a, c) => a + bjValue(c), 0);
    let aces = hand.filter((c) => c.rank === 'A').length;
    while (sum > 21 && aces) { sum -= 10; aces--; }
    return sum;
  }

  function cardNode(card, opts = {}) {
    const s = SUITS.find((x) => x.id === (card.suit && card.suit.id) || x.id === card.suit);
    const suit = (card.suit && card.suit.sym) || (s && s.sym) || '';
    const color = (card.suit && card.suit.color) || (s && s.color) || '#fff';
    const n = el('div', { class: 'playing-card' + (opts.hidden ? ' hidden-card' : '') + (opts.small ? ' small' : '') + (opts.dealt ? ' dealt' : '') });
    if (opts.hidden) {
      n.style.background = cardsBack();
      n.append(el('div', { class: 'pc-pattern', text: '🐝' }));
      return n;
    }
    n.append(
      el('div', { class: 'pc-corner pc-tl' }, el('b', { text: card.rank, style: { color } }), el('span', { text: suit, style: { color } })),
      el('div', { class: 'pc-center', text: suit, style: { color } }),
      el('div', { class: 'pc-corner pc-br' }, el('b', { text: card.rank, style: { color } }), el('span', { text: suit, style: { color } }))
    );
    return n;
  }

  function cardsBack() {
    const b = Store.state.shop.cardsBack || 'honey';
    const map = {
      honey: 'linear-gradient(135deg,#f5b53c,#a35d00)',
      night: 'linear-gradient(135deg,#2b2b3a,#0b0b10)',
      ember: 'linear-gradient(135deg,#ff5a3c,#7a0d00)',
      royal: 'linear-gradient(135deg,#a07bff,#3a1480)'
    };
    return map[b] || map.honey;
  }

  // Почасовая халява раз в 20 мин — бонус казино
  function bonusAvailable() { return Date.now() - (Store.state.casino.lastBonus || 0) > 20 * 60 * 1000; }
  function claimBonus() {
    if (!bonusAvailable()) return 0;
    const amt = 100 + U.randInt(0, 200);
    Store.state.casino.lastBonus = Date.now();
    Store.addHoney(amt);
    return amt;
  }

  // результат-зануда: запись в статистику
  function resultBanner(text, kind) {
    return el('div', { class: 'result-banner ' + kind, text });
  }

  window.Casino = {
    betControl, takeBet, payWin, countLoss,
    deck52, deck36, bjScore, bjValue, cardNode, cardsBack, SUITS,
    bonusAvailable, claimBonus, resultBanner, CHIPS
  };
})();
