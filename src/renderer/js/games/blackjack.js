/* ============ blackjack.js — Блэкджек 21 ============ */
(function () {
  'use strict';
  const { el } = U;

  let view, shoe, player, dealer, bet = 50, phase = 'bet', busy = false, hideCard = true;

  function newShoe() {
    shoe = [];
    for (let d = 0; d < 4; d++) Casino.deck52(false).forEach((c) => shoe.push(c));
    shoe = U.shuffle(shoe);
  }
  function draw() {
    if (shoe.length < 20) newShoe();
    return shoe.pop();
  }
  function handScore(h) { return Casino.bjScore(h); }

  function seat(label) {
    return el('div', { class: 'bj-seat' },
      el('div', { class: 'bj-seat-head' },
        el('b', { text: label }),
        el('span', { class: 'bj-score muted mono' })),
      el('div', { class: 'bj-cards' }));
  }
  function renderHand(seatEl, hand, hideSecond) {
    const cards = seatEl.querySelector('.bj-cards');
    cards.replaceChildren();
    hand.forEach((c, i) => {
      const node = Casino.cardNode(hideSecond && i === 1 ? { rank: '?', suit: { sym: '', color: '#000' } } : c,
        { hidden: hideSecond && i === 1, dealt: true });
      cards.appendChild(node);
    });
    seatEl.querySelector('.bj-score').textContent = hideSecond ? handScore([hand[0]]) + ' + ?' : handScore(hand);
  }

  function mount(v) {
    view = v;
    newShoe();
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🃏 Блэкджек' }),
        el('p', { text: 'Цель — 21. Карты 2–9 по номиналу, картинки 10, туз 1 или 11. Блэкджек платит 3 к 2, дилер останавливается на 17.' }))));

    const table = el('div', { class: 'panel bj-table anim-item' });
    const dealerSeat = seat('Дилер');
    const playerSeat = seat('Ты');
    const message = el('div', { class: 'bj-message muted', text: 'Сделай ставку и нажми «Раздать»' });

    table.append(
      dealerSeat,
      el('div', { class: 'bj-felt' }, message),
      playerSeat
    );
    v.appendChild(table);

    const controls = el('div', { class: 'panel bj-controls anim-item' });
    controls.append(
      Casino.betControl(() => bet, (x) => bet = x, { min: 10 }),
      el('div', { class: 'flex gap8', style: { flexWrap: 'wrap', justifyContent: 'center' } },
        el('button', { class: 'btn btn-primary btn-lg bj-deal', text: '🃏 Раздать' }),
        el('button', { class: 'btn btn-lg bj-hit hide', text: 'Ещё' }),
        el('button', { class: 'btn btn-lg bj-stand hide', text: 'Хватит' }),
        el('button', { class: 'btn btn-lg bj-double hide', text: 'Удвоить' }),
        el('div', { class: 'currency' }, el('span', { text: '🍯' }), el('b', { class: 'bj-balance mono' }))
      )
    );
    v.appendChild(controls);

    const dealBtn = controls.querySelector('.bj-deal');
    const hitBtn = controls.querySelector('.bj-hit');
    const standBtn = controls.querySelector('.bj-stand');
    const doubleBtn = controls.querySelector('.bj-double');

    function syncBalance() { controls.querySelector('.bj-balance').textContent = U.fmt(Store.state.honey); }
    syncBalance();
    Store.on('honey', syncBalance);

    function setButtons(p) {
      dealBtn.classList.toggle('hide', p !== 'bet');
      [hitBtn, standBtn, doubleBtn].forEach((b) => b.classList.toggle('hide', p === 'bet'));
      doubleBtn.disabled = true;
    }
    setButtons('bet');

    async function dealCard(seatEl, hand, card, hidden) {
      hand.push(card);
      const node = Casino.cardNode(hidden ? { rank: '?', suit: { sym: '', color: '#000' } } : card, { hidden, dealt: false });
      seatEl.querySelector('.bj-cards').appendChild(node);
      requestAnimationFrame(() => node.classList.add('dealt'));
      Snd.play('card');
      await U.sleep(160);
      const hideSecond = hidden === undefined ? false : hidden;
      renderHand(seatEl, hand, seatEl === dealerSeat && hideCard);
    }

    async function deal() {
      if (busy) return;
      if (!Casino.takeBet(bet)) return;
      busy = true; phase = 'play';
      message.textContent = 'Раздаём…'; message.className = 'bj-message muted';
      player = []; dealer = []; hideCard = true;
      renderHand(playerSeat, [], false); renderHand(dealerSeat, [], false);
      setButtons('play');
      await dealCard(playerSeat, player, draw());
      await dealCard(dealerSeat, dealer, draw());
      await dealCard(playerSeat, player, draw());
      await dealCard(dealerSeat, dealer, draw(), true);
      renderHand(playerSeat, player);
      renderHand(dealerSeat, dealer, true);

      const pBJ = handScore(player) === 21 && player.length === 2;
      const dBJ = handScore([dealer[0], dealer[1]]) === 21;
      if (pBJ || dBJ) {
        await reveal();
        if (pBJ && dBJ) return settle('push', 'У обоих блэкджек — возврат');
        if (pBJ) return settle('bj', 'БЛЭКДЖЕК! Оплата 3:2 🎉');
        return settle('lose', 'У дилера блэкджек');
      }
      doubleBtn.disabled = Store.state.honey < bet;
      busy = false;
      message.textContent = 'Ещё карту или хватит?';
    }

    async function reveal() {
      hideCard = false;
      renderHand(dealerSeat, dealer, false);
      Snd.play('card');
      await U.sleep(350);
    }

    async function hit() {
      if (busy || phase !== 'play') return;
      busy = true; doubleBtn.disabled = true;
      player.push(draw());
      Snd.play('card');
      renderHand(playerSeat, player);
      await U.sleep(280);
      const sc = handScore(player);
      if (sc > 21) { await reveal(); return settle('lose', 'Перебор! ' + sc + ' очков'); }
      if (sc === 21) return stand(true);
      busy = false;
    }

    async function double() {
      if (busy || phase !== 'play' || player.length !== 2) return;
      if (!Casino.takeBet(bet)) return;
      bet *= 2;
      busy = true; doubleBtn.disabled = true;
      player.push(draw()); Snd.play('card');
      renderHand(playerSeat, player);
      message.textContent = 'Удвоено!';
      await U.sleep(350);
      if (handScore(player) > 21) { await reveal(); const b = bet; bet /= 2; return settle('lose', 'Перебор после удвоения · −🍯' + U.fmt(b)); }
      await stand(true);
      bet /= 2;
    }

    async function stand(force) {
      if (phase !== 'play' && !force) return;
      busy = true; phase = 'dealer';
      doubleBtn.disabled = true;
      await reveal();
      // дилер тянет до 17 (S17)
      while (handScore(dealer) < 17) {
        dealer.push(draw()); Snd.play('card');
        renderHand(dealerSeat, dealer);
        message.textContent = `Дилер берёт карту… ${handScore(dealer)}`;
        await U.sleep(550);
      }
      const ps = handScore(player), ds = handScore(dealer);
      renderHand(dealerSeat, dealer);
      if (ds > 21) return settle('win', `Дилер перебрал (${ds})! Ты: ${ps}`);
      if (ps > ds) return settle('win', `${ps} против ${ds} — ты победил!`);
      if (ps < ds) return settle('lose', `${ps} против ${ds} — дилер сильнее`);
      return settle('push', 'Ничья: ' + ps);
    }

    function settle(kind, text) {
      let ret = 0;
      if (kind === 'bj') ret = Math.floor(bet * 2.5);
      else if (kind === 'win') ret = bet * 2;
      else if (kind === 'push') ret = bet;
      if (ret > 0) {
        Casino.payWin(ret);
        message.innerHTML = `<span style="color:var(--good);font-weight:800">${text}</span>`;
        Snd.play(kind === 'bj' ? 'bigwin' : 'win');
        if (kind !== 'push') UI.flyGain(table, '+' + (ret - bet), 'var(--good)');
      } else {
        Casino.countLoss();
        message.innerHTML = `<span style="color:var(--bad);font-weight:800">${text} · −🍯${U.fmt(bet)}</span>`;
        Snd.play('lose');
      }
      phase = 'bet'; busy = false;
      setButtons('bet'); syncBalance();
    }

    dealBtn.addEventListener('click', deal);
    hitBtn.addEventListener('click', hit);
    standBtn.addEventListener('click', () => stand());
    doubleBtn.addEventListener('click', double);
    setButtons('bet');
  }

  Pages['game-blackjack'] = { mount };
})();
