/* ============ checkers.js — русские шашки против ИИ ============ */
(function () {
  'use strict';
  const { el } = U;
  const N = 8;
  // 0 пусто; 1 белая простая; 2 белая дамка; -1 чёрная простая; -2 чёрная дамка

  let board, turn, selected, legalForSel, chain, busy, depth = 3, view, mustCaptureCount, capturedAnim = [];
  let history = [], stats = { p: 0, ai: 0 };

  function init() {
    board = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if ((x + y) % 2 === 1) {
        if (y < 3) board[y][x] = -1;
        else if (y > 4) board[y][x] = 1;
      }
    }
    turn = 1; selected = null; legalForSel = []; chain = null; busy = false;
  }

  function inB(x, y) { return x >= 0 && x < N && y >= 0 && y < N; }
  function sideOf(v) { return v === 0 ? 0 : v > 0 ? 1 : -1; }
  const isKing = (v) => Math.abs(v) === 2;

  const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Поиск всех цепочек взятий (рекурсивно)
  function captureSeq(b, x, y, side, captured, path) {
    const v = b[y][x];
    const king = isKing(v);
    const results = [];
    const dirs = king ? DIRS : DIRS; // простые в русских шашках бьют во все стороны
    for (const [dx, dy] of dirs) {
      if (king) {
        // скользим по диагонали до первой шашки
        let cx = x + dx, cy = y + dy;
        while (inB(cx, cy) && b[cy][cx] === 0) { cx += dx; cy += dy; }
        if (!inB(cx, cy)) continue;
        if (sideOf(b[cy][cx]) !== -side) continue;
        if (captured.includes(cx + ',' + cy)) continue;
        const ex = cx, ey = cy;
        // все свободные поля за побитой
        let lx = ex + dx, ly = ey + dy;
        while (inB(lx, ly) && b[ly][lx] === 0) {
          const nb = b.map((r) => r.slice());
          nb[ey][ex] = 0; nb[y][x] = 0;
          const promoted = Math.abs(v) === 1 && (ly === 0 || ly === N - 1) ? 2 : v;
          nb[ly][lx] = promoted;
          const more = captureSeq(nb, lx, ly, side, [...captured, ex + ',' + ey], [...path, [lx, ly, ex, ey, promoted]]);
          if (more.length) results.push(...more);
          else results.push({ path: [...path, [lx, ly, ex, ey, promoted]], captured: [...captured, ex + ',' + ey] });
          lx += dx; ly += dy;
        }
      } else {
        const ex = x + dx, ey = y + dy, lx = x + 2 * dx, ly = y + 2 * dy;
        if (!inB(lx, ly)) continue;
        if (b[ey] && inB(ex, ey) && sideOf(b[ey][ex]) === -side && b[ly][lx] === 0 &&
            !captured.includes(ex + ',' + ey)) {
          const nb = b.map((r) => r.slice());
          nb[ey][ex] = 0; nb[y][x] = 0;
          const promoted = (ly === 0 || ly === N - 1) ? 2 : v;
          nb[ly][lx] = promoted;
          const more = promoted === 2
            ? [] // дамка в процессе боя продолжает как дамка — пересчёт с новой позиции не нужен, т.к. ниже captureSeq сам определит king
            : captureSeq(nb, lx, ly, side, [...captured, ex + ',' + ey], [...path, [lx, ly, ex, ey, promoted]]);
          const moreKing = promoted === 2 ? captureSeq(nb, lx, ly, side, [...captured, ex + ',' + ey], [...path, [lx, ly, ex, ey, promoted]]) : more;
          if (moreKing.length) results.push(...moreKing);
          else results.push({ path: [...path, [lx, ly, ex, ey, promoted]], captured: [...captured, ex + ',' + ey] });
        }
      }
    }
    return results;
  }

  function legalMoves(b, side) {
    const caps = [];
    const quiet = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (sideOf(b[y][x]) !== side) continue;
      const v = b[y][x]; const king = isKing(v);
      const seqs = captureSeq(b, x, y, side, [], []);
      seqs.forEach((s) => caps.push({ from: [x, y], path: s.path, captured: s.captured, take: s.captured.length }));
      if (king) {
        for (const [dx, dy] of DIRS) {
          let nx = x + dx, ny = y + dy;
          while (inB(nx, ny) && b[ny][nx] === 0) {
            quiet.push({ from: [x, y], to: [nx, ny], path: [[nx, ny]], take: 0 });
            nx += dx; ny += dy;
          }
        }
      } else {
        const fwd = side === 1 ? -1 : 1;
        for (const dx of [-1, 1]) {
          const nx = x + dx, ny = y + fwd;
          if (inB(nx, ny) && b[ny][nx] === 0) quiet.push({ from: [x, y], to: [nx, ny], path: [[nx, ny]], take: 0 });
        }
      }
    }
    if (caps.length) {
      const max = Math.max(...caps.map((c) => c.take));
      return caps.filter((c) => c.take === max);
    }
    return quiet;
  }

  function applyMove(b, m) {
    const nb = b.map((r) => r.slice());
    const [fx, fy] = m.from;
    let v = nb[fy][fx]; nb[fy][fx] = 0;
    let lx = fx, ly = fy;
    m.path.forEach((step) => {
      const [tx, ty, ex, ey, promoted] = step;
      if (ex != null) nb[ey][ex] = 0;
      nb[ty][tx] = 0;
      lx = tx; ly = ty;
      v = promoted || v;
      nb[ly][lx] = v;
    });
    return nb;
  }

  /* ---------- ИИ ---------- */
  function evaluate(b) {
    let score = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = b[y][x]; if (!v) continue;
      const me = -1; // точка зрения чёрных
      const mine = sideOf(v) === me;
      let val = isKing(v) ? 5 : 3;
      if (!isKing(v)) val += (mine ? (7 - y) : y) * 0.15; // продвижение
      if (!isKing(v) && x > 0 && x < 7 && y > 0 && y < 7) val += 0.3;
      score += (mine ? 1 : -1) * val;
    }
    return score;
  }

  function minimax(b, side, depthLeft, alpha, beta) {
    const moves = legalMoves(b, side);
    if (!moves.length) return { score: side === -1 ? -1000 : 1000 };
    if (depthLeft === 0) return { score: evaluate(b) };
    let best = side === -1 ? -Infinity : Infinity, bestMove = null;
    for (const m of moves) {
      const nb = applyMove(b, m);
      const r = minimax(nb, -side, depthLeft - 1, alpha, beta);
      if (side === -1) {
        if (r.score > best) { best = r.score; bestMove = m; }
        alpha = Math.max(alpha, best);
      } else {
        if (r.score < best) { best = r.score; bestMove = m; }
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  }

  function aiMove() {
    busy = true;
    setTimeout(() => {
      const r = minimax(board, -1, depth, -Infinity, Infinity);
      if (!r.move) return endGame(1);
      animateMove(r.move, -1, () => {
        board = applyMove(board, r.move);
        busy = false; turn = 1;
        afterTurn();
      });
    }, 350);
  }

  /* ---------- интерфейс ---------- */
  function mount(v) {
    view = v;
    init();
    const head = el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '⚫ Шашки' }),
        el('p', { text: 'Русские шашки: обязательные взятия, бить можно назад, простая становится дамкой и продолжает бой как дамка. Дамки ходят по всей диагонали.' })));
    const seg = el('div', { class: 'seg', id: 'chDiff' });
    [['2', 'Легко'], ['3', 'Классика'], ['4', 'Маэстро']].forEach(([d, label]) => {
      const b = el('button', { class: +d === depth ? 'on' : '', text: label });
      b.addEventListener('click', () => {
        depth = +d;
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on'); Snd.play('tab'); restart();
      });
      seg.appendChild(b);
    });
    head.appendChild(el('div', { class: 'ph-side' }, seg));
    v.appendChild(head);

    const wrap = el('div', { class: 'check-wrap' });
    const boardEl = el('div', { class: 'check-board' });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dark = (x + y) % 2 === 1;
      const cell = el('div', { class: 'ck-cell ' + (dark ? 'dark' : 'light'), dataset: { x, y } });
      cell.addEventListener('click', () => clickCell(x, y));
      boardEl.appendChild(cell);
    }
    const side = el('div', { class: 'panel ck-panel' },
      el('div', { class: 'panel-title', text: 'Партия' }),
      el('div', { class: 'ck-turn' }, statusLine()),
      el('div', { class: 'ck-captured' },
        el('div', { class: 'ck-cap-row', id: 'capAI' }, el('span', { text: 'Взято ИИ:' })),
        el('div', { class: 'ck-cap-row', id: 'capP' }, el('span', { text: 'Взято тобой:' }))
      ),
      el('div', { class: 'flex gap8', style: { flexDirection: 'column' } },
        el('button', { class: 'btn btn-primary btn-block', text: '↺ Новая партия', onclick: restart }),
        el('button', { class: 'btn btn-block', text: '↶ Отменить ход', onclick: undo }),
        el('a', { class: 'btn btn-block', href: '#', onclick: (e) => { e.preventDefault(); Go('home'); }, text: 'Выйти' })
      ),
      el('div', { class: 'ck-rules muted' },
        el('div', { class: 'panel-title', style: { marginTop: '14px' }, text: 'Факты' }),
        el('p', { text: '• Если есть взятие — бить обязательно.' }),
        el('p', { text: '• Из нескольких боёв выбирай самый длинный.' }),
        el('p', { text: '• Дамка летает по всей диагонали.' }),
        el('p', { text: '• Победа: съесть все шашки или запереть их.' }))
    );
    wrap.append(boardEl, side);
    v.appendChild(wrap);
    paint();
  }

  function statusLine() {
    const t = el('div');
    return t;
  }

  function paint() {
    const cells = view.querySelectorAll('.ck-cell');
    cells.forEach((c) => {
      c.replaceChildren();
      c.classList.remove('sel', 'move', 'cap-hint');
      const x = +c.dataset.x, y = +c.dataset.y;
      const v = board[y][x];
      if (v !== 0) {
        const piece = el('div', { class: 'ck-piece ' + (v > 0 ? 'white' : 'black') + (isKing(v) ? ' king' : '') + ' popIn' },
          isKing(v) ? el('span', { class: 'ck-crown', text: '♛' }) : null);
        c.appendChild(piece);
      }
    });
    if (selected) {
      const [sx, sy] = selected;
      const c = view.querySelector(`.ck-cell[data-x="${sx}"][data-y="${sy}"]`);
      c && c.classList.add('sel');
      legalForSel.forEach((m) => {
        const steps = chain ? m.path : m.path;
        const [tx, ty] = steps[steps.length - 1];
        const tc = view.querySelector(`.ck-cell[data-x="${tx}"][data-y="${ty}"]`);
        if (tc) tc.classList.add(m.take ? 'cap-hint' : 'move');
      });
    }
    const st = view.querySelector('.ck-turn');
    if (st) st.replaceChildren(
      el('div', { class: 'ck-status ' + (turn === 1 ? 'your' : 'ai') },
        busy ? '🤖 ИИ думает…' : turn === 1 ? 'Твой ход ⚪' : 'Ход ИИ ⚫')
    );
  }

  function clickCell(x, y) {
    if (busy || turn !== 1) return;
    const v = board[y][x];
    if (selected) {
      const m = legalForSel.find((mm) => {
        const [tx, ty] = mm.path[mm.path.length - 1];
        return tx === x && ty === y;
      });
      if (m) return doPlayer(m);
    }
    if (sideOf(v) === 1) {
      const all = legalMoves(board, 1);
      const mine = all.filter((mm) => mm.from[0] === x && mm.from[1] === y);
      if (!mine.length) {
        if (all.some((mm) => mm.take > 0)) { UI.toast('Есть обязательное взятие другой шашкой!', 'bad'); Snd.play('deny'); }
        return;
      }
      selected = [x, y];
      legalForSel = mine; chain = null;
      Snd.play('tab'); paint();
    }
  }

  function doPlayer(m) {
    history.push(board.map((r) => r.slice()));
    animateMove(m, 1, () => {
      board = applyMove(board, m);
      Snd.play(m.take ? 'hit' : 'card');
      selected = null; legalForSel = []; chain = null;
      turn = -1;
      paint(); afterTurn();
    });
  }

  function afterTurn() {
    paint(); updateCaptured();
    const w = winner();
    if (w !== 0) return endGame(w);
    if (turn === -1) aiMove();
  }

  function winner() {
    const wMoves = legalMoves(board, 1), bMoves = legalMoves(board, -1);
    const wCount = countPieces(1), bCount = countPieces(-1);
    if (!bMoves.length || bCount === 0) return 1;
    if (!wMoves.length || wCount === 0) return -1;
    return 0;
  }
  function countPieces(s) {
    let n = 0; board.forEach((r) => r.forEach((v) => { if (sideOf(v) === s) n++; })); return n;
  }

  function endGame(w) {
    busy = true;
    if (w === 1) { stats.p++; Store.state.stats.checkersWins++; Store.save(); Snd.play('bigwin'); }
    else { stats.ai++; Snd.play('lose'); }
    UI.modalOpen(w === 1 ? '🏆 Победа!' : 'Поражение', el('div', { style: { textAlign: 'center' } },
      el('div', { style: { fontSize: '44px', margin: '8px 0 14px' }, text: w === 1 ? '👑' : '🫡' }),
      el('p', { style: { fontSize: '13px' }, text: w === 1 ? 'ИИ повержен. Рой гордится тобой.' : 'ИИ оказался хитрее. Реванш?' }),
      el('div', { class: 'flex gap8', style: { justifyContent: 'center', marginTop: '16px' } },
        el('button', { class: 'btn', text: 'Закрыть', onclick: UI.modalClose }),
        el('button', { class: 'btn btn-primary', text: 'Новая партия', onclick: () => { UI.modalClose(); restart(); } }))
    ));
    busy = false; turn = 1;
    paint();
  }

  function updateCaptured() {
    const ai = view.querySelector('#capAI'), p = view.querySelector('#capP');
    const aiTaken = 12 - countPieces(-1), pTaken = 12 - countPieces(1);
    ai.replaceChildren(el('span', { text: 'Взято ИИ:' }), ...Array(Math.max(0, aiTaken)).fill('⚪'));
    p.replaceChildren(el('span', { text: 'Взято тобой:' }), ...Array(Math.max(0, pTaken)).fill('⚫'));
  }

  function animateMove(m, side, done) {
    // пошаговая анимация по path через перекладку фишки
    const [fx, fy] = m.from;
    const boardEl = view.querySelector('.check-board');
    boardEl.classList.add('busy');
    const fromCell = boardEl.querySelector(`.ck-cell[data-x="${fx}"][data-y="${fy}"]`);
    let piece = fromCell && fromCell.querySelector('.ck-piece');
    let i = 0;
    function step() {
      if (i >= m.path.length) { boardEl.classList.remove('busy'); done && done(); return; }
      const [tx, ty, ex, ey] = m.path[i];
      const toCell = boardEl.querySelector(`.ck-cell[data-x="${tx}"][data-y="${ty}"]`);
      if (!piece) { i++; return step(); }
      if (ex != null) {
        piece.classList.add('jumping');
        const enemyCell = boardEl.querySelector(`.ck-cell[data-x="${ex}"][data-y="${ey}"]`);
        setTimeout(() => enemyCell && enemyCell.replaceChildren(), 180);
      } else piece.classList.add('sliding');
      setTimeout(() => {
        toCell.appendChild(piece);
        piece.classList.remove('jumping', 'sliding');
        i++;
        setTimeout(step, 90);
      }, ex != null ? 230 : 120);
    }
    step();
  }

  function undo() {
    if (busy || !history.length) return;
    board = history.pop();
    turn = 1; selected = null; chain = null; legalForSel = [];
    busy = false; paint(); updateCaptured();
    Snd.play('tab');
  }
  function restart() {
    init(); history = []; paint(); updateCaptured();
  }

  Pages['game-checkers'] = { mount, unmount() {} };
})();
