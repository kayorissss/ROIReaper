/* ============ g2048.js — 2048 ============ */
(function () {
  'use strict';
  const { el } = U;
  const SIZE = 4;
  let grid, score, best, moved, won, over, keepGoing, view, tileLayer, startedNewGame = false;

  function empty() {
    const a = [];
    grid.forEach((r, y) => r.forEach((t, x) => { if (!t) a.push([x, y]); }));
    return a;
  }
  function addRandom() {
    const cells = empty(); if (!cells.length) return;
    const [x, y] = U.pick(cells);
    grid[y][x] = { v: Math.random() < 0.9 ? 2 : 4, id: Math.random().toString(36).slice(2), isNew: true };
  }
  function newGame() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0; won = false; over = false; keepGoing = false;
    addRandom(); addRandom();
    render(true);
  }

  function move(dir) {
    if (over) return;
    // dir: 0 up,1 right,2 down,3 left
    const traces = traverseOrder(dir);
    let gained = 0, didMove = false;
    const mergedThis = [];
    // сброс флагов
    grid.forEach((r) => r.forEach((t) => { if (t) { t.isNew = false; t.merged = false; } }));

    const vec = [[0,-1],[1,0],[0,1],[-1,0]][dir];
    traces.forEach(([x, y]) => {
      const t = grid[y][x]; if (!t) return;
      let nx = x, ny = y;
      while (true) {
        const tx = nx + vec[0], ty = ny + vec[1];
        if (tx < 0 || ty < 0 || tx >= SIZE || ty >= SIZE) break;
        if (!grid[ty][tx]) { nx = tx; ny = ty; } else break;
      }
      // следующая для слияния
      const mx = nx + vec[0], my = ny + vec[1];
      if (mx >= 0 && my >= 0 && mx < SIZE && my < SIZE) {
        const other = grid[my][mx];
        if (other && other.v === t.v && !other.merged && !mergedThis.includes(mx + ',' + my)) {
          const nv = t.v * 2;
          grid[my][mx] = { v: nv, id: other.id + 'm', merged: true };
          grid[y][x] = null;
          mergedThis.push(mx + ',' + my);
          gained += nv; didMove = true;
          if (nv === 2048 && !won) { won = true; }
          return;
        }
      }
      if (nx !== x || ny !== y) {
        grid[ny][nx] = t; grid[y][x] = null; didMove = true;
      }
    });

    if (didMove) {
      score += gained;
      best = Store.state.games.g2048;
      if (score > (best || 0)) { Store.state.games.g2048.best = score; Store.state.games.g2048.score = score; }
      addRandom();
      Snd.play(gained > 200 ? 'coin' : 'tick');
      render(false);
      if (won && !keepGoing) {
        Snd.play('bigwin');
        const reward = 300;
        if (!Store.state.games.g2048.awarded2048) {
          Store.addHoney(reward);
          Store.state.games.g2048.awarded2048 = true; Store.save();
          UI.toast('🏆 Плитка 2048! Награда 🍯' + reward, 'good');
        }
      }
      if (!canMove()) { over = true; renderEnd(false); }
    }
  }

  function traverseOrder(dir) {
    const a = [];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) a.push([x, y]);
    if (dir === 1) a.reverse();
    if (dir === 2) a.sort((p, q) => q[1] - p[1]);
    if (dir === 0) a.sort((p, q) => p[1] - q[1]);
    return a;
  }

  function canMove() {
    if (empty().length) return true;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const t = grid[y][x];
      for (const [dx, dy] of [[1,0],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < SIZE && ny < SIZE && grid[ny][nx] && grid[ny][nx].v === t.v) return true;
      }
    }
    return false;
  }

  function renderEnd(w) {
    const ov = view.querySelector('.g2048-over');
    ov.classList.add('show');
    ov.replaceChildren(el('div', { class: 'g2048-card popIn' },
      el('div', { style: { fontSize: '30px', marginBottom: '8px' }, text: w ? '🏆' : '🧱' }),
      el('b', { style: { fontSize: '18px' }, text: w ? 'Победа!' : 'Ходов больше нет' }),
      el('p', { class: 'muted', style: { fontSize: '12px', margin: '6px 0 12px' }, text: 'Счёт: ' + score + ' · рекорд: ' + (Store.state.games.g2048.best || 0) }),
      el('button', { class: 'btn btn-primary btn-block', text: 'Новая игра', onclick: () => { ov.classList.remove('show'); newGame(); } }),
      !w && won ? null : el('button', { class: 'btn btn-block', style: { marginTop: '8px' }, text: 'Продолжить', onclick: () => { keepGoing = true; ov.classList.remove('show'); } })
    ));
  }

  function posStyle(x, y) {
    return { left: `calc(${x} * (var(--cell) + var(--gap)) + var(--gap))`, top: `calc(${y} * (var(--cell) + var(--gap)) + var(--gap))` };
  }

  function render(full) {
    tileLayer.replaceChildren();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const t = grid[y][x]; if (!t) continue;
      const node = el('div', {
        class: `g-tile tile-${t.v}` + (t.merged ? ' tile-merged' : '') + (t.isNew ? ' tile-new' : '')
      }, el('span', { text: t.v }));
      Object.assign(node.style, posStyle(x, y));
      tileLayer.appendChild(node);
    }
    view.querySelector('.g-score').textContent = score;
    view.querySelector('.g-best').textContent = Store.state.games.g2048.best || 0;
  }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🔢 2048' }),
        el('p', { text: 'Сдвигай плитки стрелками или WASD. На свайп тоже реагирует. Собери 2048 и получи награду, потом бей рекорд дальше.' })),
      el('div', { class: 'ph-side flex gap8' },
        el('div', { class: 'g-score-box' }, el('span', { class: 'muted', text: 'СЧЁТ' }), el('b', { class: 'g-score mono', text: '0' })),
        el('div', { class: 'g-score-box' }, el('span', { class: 'muted', text: 'РЕКОРД' }), el('b', { class: 'g-best mono', text: '0' })),
        el('button', { class: 'btn btn-sm btn-primary', text: 'Новая игра', onclick: newGame }))
    ));

    const boardWrap = el('div', { class: 'g2048-wrap' });
    const board = el('div', { class: 'g-board' });
    for (let i = 0; i < SIZE * SIZE; i++) board.appendChild(el('div', { class: 'g-cell' }));
    tileLayer = el('div', { class: 'g-tiles' });
    board.appendChild(tileLayer);
    const over = el('div', { class: 'g2048-over' });
    board.appendChild(over);
    boardWrap.appendChild(board);
    v.appendChild(boardWrap);

    // свайпы
    let sx = 0, sy = 0;
    board.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    board.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.hypot(dx, dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3); else move(dy > 0 ? 2 : 0);
    }, { passive: true });

    newGame();
  }

  function onKey(e) {
    const map = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
    if (e.code in map) { e.preventDefault(); move(map[e.code]); }
  }

  Pages['game-2048'] = { mount, onKey };
})();
