/* ============ durak.js — подкидной дурак против ИИ ============ */
(function () {
  'use strict';
  const { el } = U;
  const SUITS = Casino.SUITS;
  const RANK_V = { '6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

  let view, deck, trump, discard, hands, table, attacker, defender, turn, phase, selected, busy, over;
  // table: [{ under: card, over: card|null }]

  function card(c) { return { rank: c.rank, suit: c.suit.id || c.suit, v: RANK_V[c.rank] }; }
  function norm(c) { return { rank: c.rank, suit: typeof c.suit === 'object' ? c.suit.id : c.suit }; }
  function isTrump(c) { return (typeof c.suit === 'object' ? c.suit.id : c.suit) === trump; }
  function beats(a, b) {
    const ta = isTrump(a), tb = isTrump(b);
    if (ta && !tb) return true;
    if (ta !== tb) return false;
    return a.suit === b.suit && a.v > b.v;
  }
  function sortHand(h) {
    return h.sort((a, b) => {
      const ta = isTrump(a), tb = isTrump(b);
      if (ta !== tb) return ta ? 1 : -1;
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return a.v - b.v;
    });
  }
  function ranksOnTable() {
    const s = new Set();
    table.forEach((p) => { s.add(p.under.rank); if (p.over) s.add(p.over.rank); });
    return s;
  }
  function tableCount() { return table.length; }
  function uncovered() { return table.filter((p) => !p.over); }

  function newDeal() {
    const raw = Casino.deck36(true);
    deck = raw.map(norm).map((c) => ({ rank: c.rank, suit: c.suit, v: RANK_V[c.rank] }));
    trump = deck[deck.length - 1].suit;
    hands = { p: deck.splice(0, 6), ai: deck.splice(0, 6) };
    sortHand(hands.p); sortHand(hands.ai);
    discard = []; table = []; selected = null; busy = false; over = false;
    // у кого младший козырь — тот атакует
    const lowP = hands.p.filter(isTrump).sort((a, b) => a.v - b.v)[0];
    const lowA = hands.ai.filter(isTrump).sort((a, b) => a.v - b.v)[0];
    if (!lowP && lowA) attacker = 'ai';
    else if (!lowA && lowP) attacker = 'p';
    else if (!lowP && !lowA) attacker = 'p';
    else attacker = lowP.v <= lowA.v ? 'p' : 'ai';
    defender = attacker === 'p' ? 'ai' : 'p';
    phase = attacker === 'p' ? 'attack' : 'aiAttack';
    setMsg(attacker === 'p' ? 'Твой заход — кликни карту' : 'ИИ заходит…');
    if (attacker === 'ai') setTimeout(aiAttack, 900);
  }

  function drawCards(whoFirst) {
    const order = whoFirst === 'p' ? ['p', 'ai'] : ['ai', 'p'];
    order.forEach((w) => {
      while (hands[w].length < 6 && deck.length) hands[w].push(deck.shift());
    });
    sortHand(hands.p); sortHand(hands.ai);
  }

  function setMsg(t, kind) {
    const m = view && view.querySelector('.dk-msg');
    if (m) { m.textContent = t; m.className = 'dk-msg' + (kind ? ' ' + kind : ''); }
  }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🃏 Дурак' }),
        el('p', { text: 'Подкидной дурак, колода 36. Атакуй, отбивайся или бери карты; можно подкидывать по мастям стола (до 6).' })),
      el('div', { class: 'ph-side' },
        el('button', { class: 'btn btn-sm btn-primary', text: 'Новая раздача', onclick: () => { newDeal(); paint(); } }))
    ));

    const tableHost = el('div', { class: 'panel dk-tablepanel' },
      el('div', { class: 'dk-aidk' },
        el('div', { class: 'dk-ai-hand', id: 'dkAI' }),
        el('div', { class: 'dk-deck' },
          el('div', { class: 'dk-talon', id: 'dkTalon' }),
          el('div', { class: 'dk-trump', id: 'dkTrump' }))
      ),
      el('div', { class: 'dk-table', id: 'dkTable' }),
      el('div', { class: 'dk-msg', id: 'dkMsg' }),
      el('div', { class: 'dk-actions' },
        el('button', { class: 'btn btn-primary dk-bito', text: '✅ Бито' }),
        el('button', { class: 'btn btn-danger dk-take', text: '📥 Беру' }))
    );
    const handHost = el('div', { class: 'panel dk-handpanel' },
      el('div', { class: 'dk-hand', id: 'dkHand' }));
    v.append(tableHost, handHost);

    v.querySelector('.dk-bito').addEventListener('click', callBito);
    v.querySelector('.dk-take').addEventListener('click', playerTake);

    newDeal();
    paint();
  }

  function paint() {
    // ИИ рука (рубашкой)
    const aiH = view.querySelector('#dkAI');
    aiH.replaceChildren(...hands.ai.map(() => {
      const c = el('div', { class: 'dk-card-mini back', style: { background: Casino.cardsBack() } }, el('span', { text: '🐝' }));
      return c;
    }));
    if (!hands.ai.length) aiH.appendChild(el('span', { class: 'muted', style: { fontSize: '11px' }, text: 'карт нет' }));

    // колода и козырь
    const talon = view.querySelector('#dkTalon');
    talon.replaceChildren(el('div', { class: 'dk-deck-card', style: { background: Casino.cardsBack() } }, el('span', { text: '🐝' })),
      el('div', { class: 'dk-deck-count mono', text: deck.length }));
    const trumpCard = view.querySelector('#dkTrump');
    trumpCard.replaceChildren();
    if (deck.length || true) {
      const ts = SUITS.find((s) => s.id === trump);
      const tc = Casino.cardNode({ rank: deck[deck.length - 1]?.rank || '6', suit: ts }, { small: true });
      if (!deck.length) tc.classList.add('dim');
      trumpCard.appendChild(tc);
      trumpCard.appendChild(el('div', { class: 'dk-trump-label', html: 'козырь <b style="color:' + ts.color + '">' + ts.sym + '</b>' }));
    }

    // стол
    const t = view.querySelector('#dkTable');
    t.replaceChildren();
    table.forEach((pair, i) => {
      const slot = el('div', { class: 'dk-pair' });
      const u = Casino.cardNode(pair.under, { small: false, dealt: true });
      u.classList.add('dk-on-table');
      slot.appendChild(u);
      if (pair.over) {
        const o = Casino.cardNode(pair.over, { dealt: true });
        o.classList.add('dk-on-table', 'dk-cover');
        slot.appendChild(o);
      } else {
        u.classList.add('dk-uncovered');
        slot.addEventListener('click', () => uncoveredTarget(i));
      }
      t.appendChild(slot);
    });

    // рука игрока
    const h = view.querySelector('#dkHand');
    h.replaceChildren();
    hands.p.forEach((c) => {
      const node = Casino.cardNode(c);
      node.classList.add('dk-hand-card');
      if (isTrump(c)) node.classList.add('trump-card');
      if (selected === c) node.classList.add('selected');
      node.addEventListener('click', () => handClick(c, node));
      h.appendChild(node);
    });

    // кнопки
    const isAtt = attacker === 'p';
    const canBito = isAtt && table.length > 0 && uncovered().length === 0;
    view.querySelector('.dk-bito').disabled = !canBito;
    view.querySelector('.dk-take').disabled = isAtt || uncovered().length === 0;
  }

  function handClick(c) {
    if (busy || over) return;
    const isAtt = attacker === 'p';
    if (isAtt) {
      // заход/подкид
      if (!canThrow('p', c)) { Snd.play('deny'); setMsg('Эту карту нельзя подкидывать', 'bad'); return; }
      placeAttack('p', c);
    } else {
      // защита: сначала выбрать карту, потом непокрытую пару
      const targets = uncovered();
      if (!targets.length) return;
      // если карта бьёт хотя бы одну — выберем её; клик по паре подтверждает
      const beatable = targets.find((p2) => beats(c, p2.under));
      if (!beatable) { Snd.play('deny'); setMsg('Эта карта не отбивает ни одну атаку', 'bad'); return; }
      if (selected === c) selected = null; else selected = c;
      Snd.play('tab'); paint();
      if (targets.length === 1 && beatable) coverCard(table.indexOf(beatable), c);
    }
  }
  function uncoveredTarget(i) {
    if (busy || attacker !== 'p' || !selected) return;
    const pair = table[i];
    if (pair.over) return;
    if (!beats(selected, pair.under)) { Snd.play('deny'); setMsg('Карта не бьёт эту атаку', 'bad'); return; }
    coverCard(i, selected);
  }
  function coverCard(i, c) {
    table[i].over = c;
    hands.p.splice(hands.p.indexOf(c), 1);
    selected = null;
    Snd.play('card');
    paint();
    // после защиты ИИ может подкинуть ещё
    setTimeout(afterPlayerDefense, 700);
  }

  function canThrow(who, c) {
    const h = hands[who];
    if (!h.includes(c)) return false;
    if (!table.length) return true; // первый заход — любая
    const ranks = ranksOnTable();
    if (!ranks.has(c.rank)) return false;
    // лимит стола — 6 карт
    if (tableCount() >= 6) return false;
    return true;
  }

  function placeAttack(who, c) {
    hands[who].splice(hands[who].indexOf(c), 1);
    table.push({ under: c, over: null });
    Snd.play('card');
    paint();
    if (who === 'p') {
      setMsg('ИИ думает, отбиваться ли…');
      setTimeout(aiDefense, 750);
    }
  }

  /* ---------- ИИ ---------- */
  function cheapestBeater(h, target) {
    const opts = h.filter((c) => beats(c, target)).sort((a, b) => {
      const ta = isTrump(a), tb = isTrump(b);
      if (ta !== tb) return ta ? 1 : -1;
      return a.v - b.v;
    });
    return opts[0] || null;
  }

  function aiDefense() {
    busy = true;
    const targets = uncovered();
    if (!targets.length) { busy = false; return; }
    const need = [];
    for (const t of targets) {
      const beater = cheapestBeater(hands.ai, t.under);
      if (!beater) { // берёт
        return aiTakes();
      }
      need.push([t, beater]);
    }
    // отбивается по одной с задержкой
    let i = 0;
    function next() {
      if (i >= need.length) {
        busy = false;
        // теперь ход игрока подкидывать или бито
        setMsg('Отбито! Подкинь ещё карту или жми «Бито»');
        paint();
        return;
      }
      const [t, beater] = need[i];
      const idx = table.indexOf(t);
      hands.ai.splice(hands.ai.indexOf(beater), 1);
      table[idx].over = beater;
      Snd.play('card');
      paint();
      i++;
      setTimeout(next, 650);
    }
    next();
  }

  function aiTakes() {
    const all = table.flatMap((p) => p.over ? [p.under, p.over] : [p.under]);
    hands.ai.push(...all);
    sortHand(hands.ai);
    table = [];
    Snd.play('lose');
    setMsg('ИИ берёт карты. Заход остаётся за тобой.', 'bad');
    busy = false;
    finishRound('aiTook');
  }

  function aiAttack() {
    if (over) return;
    busy = true;
    // выбирает карту для захода: самая слабая не-козырная, либо минимальный козырь
    function pick() {
      if (!table.length) {
        const non = hands.ai.filter((c) => !isTrump(c)).sort((a, b) => a.v - b.v);
        return non[0] || hands.ai.slice().sort((a, b) => a.v - b.v)[0];
      }
      // подкиды: по рангам, уважая лимит 6 и размер руки игрока
      const ranks = ranksOnTable();
      const max = Math.min(6, 6);
      if (tableCount() >= max) return null;
      if (tableCount() >= hands.p.length + table.filter((p) => p.over).length) return null;
      const opts = hands.ai
        .filter((c) => ranks.has(c.rank))
        .filter((c) => !isTrump(c) || table.length > 2)
        .sort((a, b) => a.v - b.v);
      // не подкидывает козыри без нужды
      return opts[0] || null;
    }
    const c = pick();
    if (!c) {
      // бито со стороны ИИ
      busy = false;
      return callBitoAI();
    }
    placeAttack('ai', c);
    setMsg('Тебя атакуют — выбери карту и кликни по карте на столе');
    busy = false;
  }

  function afterPlayerDefense() {
    if (uncovered().length) return; // игрок ещё не всё покрыл (подкиды были раньше)
    if (attacker === 'ai') {
      // ИИ решает подкинуть ещё
      const ranks = ranksOnTable();
      if (tableCount() < 6 && hands.p.length > 0) {
        const opts = hands.ai
          .filter((c) => ranks.has(c.rank))
          .filter((c) => !isTrump(c) || table.length > 2)
          .sort((a, b) => a.v - b.v);
        // ИИ подкидывает с вероятностью ~65%, если не в конце игры
        const c = opts[0];
        if (c && Math.random() < .7) {
          hands.ai.splice(hands.ai.indexOf(c), 1);
          table.push({ under: c, over: null });
          Snd.play('card'); paint();
          setMsg('ИИ подкидывает ' + c.rank + '!');
          return;
        }
      }
      setMsg('ИИ больше не подкидывает. Отбивайся или жми «Беру»…');
      // ничего — ждём решения игрока (бито недоступно защите)
      paint();
    }
  }

  function playerTake() {
    if (busy || attacker === 'p' || !uncovered().length) return;
    const all = table.flatMap((p) => p.over ? [p.under, p.over] : [p.under]);
    hands.p.push(...all);
    sortHand(hands.p);
    table = [];
    Snd.play('lose');
    selected = null;
    setMsg('Ты берёшь карты. ИИ заходит снова.');
    finishRound('pTook');
  }

  function callBito() {
    if (attacker !== 'p' || !table.length || uncovered().length) return;
    doBito();
  }
  function callBitoAI() {
    if (attacker !== 'ai' || !table.length || uncovered().length) return;
    setMsg('ИИ говорит «бито»');
    doBito();
  }
  function doBito() {
    busy = true;
    discard.push(...table.flatMap((p) => p.over ? [p.under, p.over] : [p.under]));
    table = [];
    Snd.play('win');
    // добор: атакующий первым, затем защитник
    drawCards(attacker);
    const nextAttacker = defender; // при бито защищавшийся заходит следующим
    attacker = nextAttacker;
    defender = attacker === 'p' ? 'ai' : 'p';
    paint();
    if (checkEnd()) { busy = false; return; }
    setMsg(attacker === 'p' ? 'Бито! Твой заход.' : 'Бито! ИИ заходит…');
    busy = false;
    phase = attacker === 'p' ? 'attack' : 'aiAttack';
    if (attacker === 'ai') setTimeout(aiAttack, 1000);
  }

  function finishRound(taker) {
    // карты уже у взявшего
    drawCards(attacker); // атаковавший первым добирает
    // взявший — защищался; в следующем раунде он опять защищается, атакует тот же
    paint();
    if (checkEnd()) { busy = false; return; }
    if (taker === 'aiTook') { attacker = 'p'; defender = 'ai'; setMsg('Твой заход.'); phase = 'attack'; }
    else { attacker = 'ai'; defender = 'p'; setMsg('ИИ заходит…'); phase = 'aiAttack'; setTimeout(aiAttack, 1000); }
    busy = false;
  }

  function checkEnd() {
    const aiEmpty = hands.ai.length === 0 && deck.length === 0;
    const pEmpty = hands.p.length === 0 && deck.length === 0;
    if (aiEmpty || pEmpty) {
      over = true;
      if (aiEmpty && pEmpty) return endGame('draw');
      return endGame(aiEmpty ? 'p' : 'ai');
    }
    // случай: колода кончилась, но у одного ещё карты — играем
    return false;
  }

  function endGame(w) {
    busy = true;
    const win = w === 'p';
    if (win) {
      Store.addHoney(150); Store.state.stats.durakWins++; Store.save(); Snd.play('bigwin');
    } else Snd.play('lose');
    UI.modalOpen(w === 'draw' ? 'Ничья!' : win ? '🏆 Ты не дурак!' : '🤡 Ты дурак!', el('div', { style: { textAlign: 'center' } },
      el('div', { style: { fontSize: '44px', margin: '6px 0 12px' }, text: win ? '👑' : w === 'draw' ? '🤝' : '🃏' }),
      el('p', { style: { fontSize: '13px' },
        text: win ? 'ИИ остался в дураках. +🍯150 за победу.' : w === 'draw' ? 'Оба вышли из игры одновременно.' : 'Карты кончились, а ты — нет. Реванш?' }),
      el('button', { class: 'btn btn-primary btn-block', style: { marginTop: '14px' }, text: 'Новая раздача',
        onclick: () => { UI.modalClose(); newDeal(); paint(); } })
    ));
    return true;
  }

  Pages['game-durak'] = { mount(v) { mount(v); } };
})();
