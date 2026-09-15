/* ============ dodge.js — Уклонение от босса ============ */
(function () {
  'use strict';
  const { el } = U;

  const W = 960, H = 600;
  let view, canvas, cx, raf, running = false, paused = false, over = false;
  let keys = {}, mouse = { x: W / 2, y: H - 110, active: false };
  let player, foods, particles, floaters;
  let t0, elapsed, spawnT, patternT, shake, hp, score, dodged, wave, best;
  let dash = { cd: 0, t: 0 };

  const FOODS = [
    { ico: '🍔', r: 22, speed: [150, 230] },
    { ico: '🍕', r: 24, speed: [130, 200] },
    { ico: '🍩', r: 18, speed: [170, 270] },
    { ico: '🥚', r: 14, speed: [200, 320] },
    { ico: '🌭', r: 20, speed: [150, 240] },
    { ico: '🍿', r: 16, speed: [190, 300] }
  ];

  function reset() {
    player = { x: W / 2, y: H - 100, r: 16, vx: 0, vy: 0, inv: 0, face: 1 };
    foods = []; particles = []; floaters = [];
    elapsed = 0; spawnT = 0; patternT = 3; shake = 0; hp = 3; score = 0; dodged = 0; wave = 1;
    dash = { cd: 0, t: 0 };
    over = false; paused = false;
    best = Store.state.games.dodge.best || 0;
  }

  function start() {
    reset();
    running = true; t0 = performance.now();
    syncHud();
    raf = requestAnimationFrame(loop);
    announce('ПРИГОТОВЬСЯ!', 'WASD / стрелки / мышь · Space — рывок');
    Snd.play('buzz');
  }

  function announce(big, small) {
    const a = view.querySelector('.dodge-announce');
    a.innerHTML = `<div class="da-big">${big}</div>${small ? `<div class="da-small">${small}</div>` : ''}`;
    a.classList.add('show');
    clearTimeout(a._t);
    a._t = setTimeout(() => a.classList.remove('show'), 1700);
  }

  function spawnFood(opts = {}) {
    const type = opts.type || U.pick(FOODS);
    const x = opts.x ?? U.rand(30, W - 30);
    const y = opts.y ?? -30;
    let ang = opts.angle;
    if (ang == null) {
      const dx = player.x - x, dy = (player.y - 60) - y;
      ang = Math.atan2(dy, dx) + U.rand(-0.18, 0.18);
    }
    const speed = U.rand(type.speed[0], type.speed[1]) * (1 + elapsed / 90);
    foods.push({
      ico: type.ico, r: type.r, x, y,
      vx: Math.cos(ang) * (opts.speed || speed),
      vy: Math.sin(ang) * (opts.speed || speed),
      rot: U.rand(0, 6.28), vr: U.rand(-4, 4),
      counted: false, spiral: opts.spiral
    });
  }

  function ring(n, type) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + U.rand(0, .3);
      spawnFood({ x: W / 2, y: 110, angle: a, type });
    }
  }
  function spread(n, type) {
    const base = Math.atan2(player.y - 110, player.x - W / 2);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      spawnFood({ x: W / 2, y: 110, angle: a, type });
    }
  }
  function rain(n, type) {
    for (let i = 0; i < n; i++) spawnFood({ x: U.rand(20, W - 20), y: -U.rand(0, 400), angle: Math.PI / 2 + U.rand(-.1, .1), type });
  }

  const PATTERNS = [
    { name: 'ТОЧНЫЙ БРОСОК', fn: () => { spread(1, FOODS[0]); } },
    { name: 'ТРОЙНОЙ ВЕЕР', fn: () => spread(3, FOODS[1]) },
    { name: 'КОЛЬЦО ПОНЧИКОВ', fn: () => ring(12, FOODS[2]) },
    { name: 'БУРГЕРНЫЙ ЛИВЕНЬ', fn: () => rain(14, FOODS[0]) },
    { name: 'ВЕЕР-ХОТДОГ', fn: () => spread(6, FOODS[4]) },
    { name: 'ПОПКОРН-ШКВАЛ', fn: () => rain(18, FOODS[5]) },
    { name: 'ДВОЙНОЕ КОЛЬЦО', fn: () => { ring(10, FOODS[3]); setTimeout(() => running && !paused && ring(14, FOODS[2]), 450); } },
    { name: 'ПИЦЦА-ШТОРМ', fn: () => { spread(5, FOODS[1]); setTimeout(() => running && !paused && rain(8, FOODS[1]), 500); } }
  ];

  function burst(x, y, color, n, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, 6.28), s = U.rand(speed * .3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(.35, .8), color, size: U.rand(2, 5) });
    }
  }

  function hit() {
    if (player.inv > 0 || dash.t > 0) return;
    hp--;
    player.inv = 1.4;
    shake = 16;
    Snd.play('hit');
    burst(player.x, player.y, '#ff5a4a', 22, 320);
    view.querySelector('.dodge-hp').classList.add('hurt');
    setTimeout(() => view.querySelector('.dodge-hp')?.classList.remove('hurt'), 400);
    if (hp <= 0) gameOver();
  }

  function gameOver() {
    over = true; running = false;
    cancelAnimationFrame(raf);
    Snd.play('explode');
    const reward = Math.round(Math.min(600, score * 1.5) * ShopItems.rewardMult());
    if (reward > 0) Store.addHoney(reward);
    const isRecord = score > best;
    if (isRecord) { Store.state.games.dodge.best = score; best = score; Store.save(); }
    Store.state.kills += dodged; Store.save();
    const ov = view.querySelector('.dodge-over');
    ov.innerHTML = '';
    ov.appendChild(el('div', { class: 'dodge-over-card popIn' },
      el('div', { class: 'do-title', text: isRecord ? '🏆 НОВЫЙ РЕКОРД!' : 'Тебя припечатали!' }),
      el('div', { class: 'do-row' }, 'Счёт: ', el('b', { class: 'gold-text mono', text: score })),
      el('div', { class: 'do-row muted' }, `Увёрт: ${dodged} · волна: ${wave} · рекорд: ${best}`),
      el('div', { class: 'do-reward', html: reward ? `Награда: 🍯 ${U.fmt(reward)}` : '' }),
      el('button', { class: 'btn btn-primary btn-lg btn-block', style: { marginTop: '12px' }, text: 'ЕЩЁ РАЗ (Enter)', onclick: () => { ov.classList.remove('show'); start(); } }),
      el('button', { class: 'btn btn-block', style: { marginTop: '8px' }, text: 'В меню', onclick: () => Go('home') })
    ));
    ov.classList.add('show');
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(.033, (now - last) / 1000);
    last = now;
    if (!paused && running) update(dt, now);
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function update(dt, now) {
    elapsed += dt;
    score = Math.floor(elapsed * 10 + dodged * 25);
    wave = 1 + Math.floor(elapsed / 20);

    // движение
    const speed = 280;
    let kx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    let ky = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    const kl = Math.hypot(kx, ky);
    if (kl > 0) { kx /= kl; ky /= kl; mouse.active = false; }
    if (kl > 0) {
      player.x = U.lerp(player.x, player.x + kx * speed * dt, .85);
      player.y = U.lerp(player.y, player.y + ky * speed * dt, .85);
      if (kx) player.face = kx > 0 ? 1 : -1;
    } else if (mouse.active) {
      player.x = U.lerp(player.x, mouse.x, .18);
      player.y = U.lerp(player.y, mouse.y, .18);
    }
    player.x = U.clamp(player.x, 20, W - 20);
    player.y = U.clamp(player.y, 80, H - 26);
    if (player.inv > 0) player.inv -= dt;

    // рывок
    dash.cd = Math.max(0, dash.cd - dt);
    if (dash.t > 0) {
      dash.t -= dt;
      player.x += dash.vx * dt; player.y += dash.vy * dt;
      player.x = U.clamp(player.x, 20, W - 20); player.y = U.clamp(player.y, 80, H - 26);
    }

    // спавн одиночных
    spawnT -= dt;
    const interval = Math.max(.35, 1.1 - elapsed / 90);
    if (spawnT <= 0) { spawnT = interval; spawnFood(); }

    // паттерны
    patternT -= dt;
    if (patternT <= 0) {
      patternT = Math.max(3.2, 7 - elapsed / 25);
      let idx = Math.floor(elapsed / 18);
      let p = PATTERNS[Math.min(PATTERNS.length - 1, idx)];
      if (U.chance(.35)) p = U.pick(PATTERNS.slice(0, Math.min(PATTERNS.length, idx + 3)));
      announce(p.name);
      p.fn();
      Snd.play('buzz');
    }

    // еда летит
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
      // увернулся (пересёк низ/края рядом с игроком)
      if (!f.counted && f.y > H + 40) { f.counted = true; dodged++; }
      if (f.y > H + 80 || f.x < -80 || f.x > W + 80) { foods.splice(i, 1); continue; }
      // столкновение
      const dx = f.x - player.x, dy = f.y - player.y;
      if (Math.hypot(dx, dy) < f.r + player.r - 4) {
        foods.splice(i, 1); hit(); burst(f.x, f.y, '#f5b53c', 12, 220); continue;
      }
      // бонус за near miss
      if (!f.counted && f.y > player.y && f.vy > 0 && Math.abs(dx) < 34 && Math.abs(dy) < 60 && Math.abs(dy) > 26) {
        f.counted = true; score += 10; dodged++;
        floaters.push({ x: player.x, y: player.y - 24, life: .6, text: 'близко! +10' });
      }
    }

    // частицы
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      floaters[i].life -= dt; floaters[i].y -= 30 * dt;
      if (floaters[i].life <= 0) floaters.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 40);
    syncHud();
  }

  function syncHud() {
    if (!view) return;
    view.querySelector('.dodge-score').textContent = score;
    view.querySelector('.dodge-wave').textContent = wave;
    view.querySelector('.dodge-best').textContent = best;
    const hpNode = view.querySelector('.dodge-hp');
    hpNode.textContent = '❤️'.repeat(Math.max(0, hp)) + '🖤'.repeat(3 - Math.max(0, hp));
    const dashBtn = view.querySelector('.dodge-dash');
    if (dashBtn) {
      dashBtn.classList.toggle('ready', dash.cd <= 0);
      dashBtn.textContent = dash.cd <= 0 ? 'РЫВОК' : 'КД ' + dash.cd.toFixed(1);
    }
  }

  function draw() {
    const ctx2 = cx;
    ctx2.save();
    if (shake > 0) ctx2.translate(U.rand(-shake, shake), U.rand(-shake, shake));
    // фон
    const g = ctx2.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1722'); g.addColorStop(1, '#0b0b0e');
    ctx2.fillStyle = g; ctx2.fillRect(-30, -30, W + 60, H + 60);

    // пол
    ctx2.fillStyle = 'rgba(245,181,60,.05)';
    for (let x = 0; x < W; x += 48) ctx2.fillRect(x, H - 40 + ((elapsed * 60) % 48), 24, 4);

    // босс
    drawBoss(ctx2);

    // еда
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    foods.forEach((f) => {
      ctx2.save();
      ctx2.translate(f.x, f.y); ctx2.rotate(f.rot);
      ctx2.font = f.r * 2 + 'px serif';
      ctx2.fillText(f.ico, 0, 0);
      ctx2.restore();
    });

    // частицы
    particles.forEach((p) => {
      ctx2.globalAlpha = Math.max(0, p.life * 1.4);
      ctx2.fillStyle = p.color;
      ctx2.beginPath(); ctx2.arc(p.x, p.y, p.size, 0, 7); ctx2.fill();
    });
    ctx2.globalAlpha = 1;

    // игрок
    drawPlayer(ctx2);

    // floaters
    ctx2.fillStyle = '#f5b53c';
    ctx2.font = 'bold 15px Unbounded, sans-serif';
    floaters.forEach((f) => { ctx2.globalAlpha = Math.max(0, f.life * 1.6); ctx2.fillText(f.text, f.x, f.y); });
    ctx2.globalAlpha = 1;

    // индикатор рывка под игроком
    if (dash.t > 0) {
      ctx2.strokeStyle = 'rgba(84,200,240,.6)';
      ctx2.lineWidth = 3;
      ctx2.beginPath(); ctx2.arc(player.x, player.y, player.r + 8, 0, 7); ctx2.stroke();
    }
    ctx2.restore();

    if (paused) {
      ctx2.fillStyle = 'rgba(0,0,0,.6)'; ctx2.fillRect(0, 0, W, H);
      ctx2.fillStyle = '#fff'; ctx2.font = 'bold 42px Unbounded, sans-serif';
      ctx2.textAlign = 'center'; ctx2.fillText('ПАУЗА', W / 2, H / 2 - 6);
      ctx2.font = '15px Unbounded, sans-serif'; ctx2.fillStyle = '#aaa';
      ctx2.fillText('P — продолжить · R — заново', W / 2, H / 2 + 34);
    }
  }

  function drawBoss(ctx2) {
    const bx = W / 2, by = 36;
    const angry = Math.min(1, elapsed / 120);
    ctx2.save();
    // туша
    ctx2.font = '72px serif'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    const wob = Math.sin(performance.now() / 180) * 6;
    ctx2.fillText('👨‍🍳', bx, by + wob);
    // злость
    if (angry > .35) {
      ctx2.font = '22px serif';
      ctx2.fillText('💢', bx + 54, by - 20 + wob);
    }
    // HP-полоса босса = время до "серьёзности"
    ctx2.fillStyle = 'rgba(255,255,255,.12)';
    ctx2.fillRect(W / 2 - 150, by + 46, 300, 6);
    ctx2.fillStyle = '#f0524a';
    ctx2.fillRect(W / 2 - 150, by + 46, 300 * Math.min(1, .2 + elapsed / 120), 6);
    ctx2.restore();
  }

  function drawPlayer(ctx2) {
    const p = player;
    ctx2.save();
    ctx2.translate(p.x, p.y);
    if (p.inv > 0 && Math.floor(performance.now() / 90) % 2) ctx2.globalAlpha = .35;
    if (dash.t > 0) { ctx2.shadowColor = '#54c8f0'; ctx2.shadowBlur = 24; }
    // тело (человечек)
    ctx2.fillStyle = '#f4f4f6';
    ctx2.beginPath(); ctx2.arc(0, -10, 9, 0, 7); ctx2.fill(); // голова
    ctx2.fillStyle = '#54c8f0';
    ctx2.beginPath();
    ctx2.roundRect ? ctx2.roundRect(-9, 0, 18, 16, 6) : ctx2.rect(-9, 0, 18, 16);
    ctx2.fill();
    // глаза
    ctx2.fillStyle = '#101014';
    ctx2.beginPath(); ctx2.arc(-3 * p.face - 1, -11, 1.5, 0, 7); ctx2.arc(3 * p.face - 1, -11, 1.5, 0, 7); ctx2.fill();
    // ноги в беге
    const run = Math.sin(performance.now() / 70) * 4;
    ctx2.strokeStyle = '#f4f4f6'; ctx2.lineWidth = 3; ctx2.lineCap = 'round';
    ctx2.beginPath();
    ctx2.moveTo(-4, 15); ctx2.lineTo(-5 - run, 26);
    ctx2.moveTo(4, 15); ctx2.lineTo(5 + run, 26);
    ctx2.stroke();
    ctx2.restore();
  }

  function doDash() {
    if (dash.cd > 0 || dash.t > 0) return;
    let dx = (keys['d'] || keys['arrowleft'] ? 0 : 0);
    let x = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    let y = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    if (!x && !y) { // рывок к курсору
      x = Math.sign(mouse.x - player.x); y = Math.sign(mouse.y - player.y);
      if (Math.abs(mouse.x - player.x) < 10) x = player.face;
    }
    const l = Math.hypot(x, y) || 1;
    dash.vx = x / l * 720; dash.vy = y / l * 720;
    dash.t = .18; dash.cd = 1.6;
    burst(player.x, player.y, '#54c8f0', 10, 160);
    Snd.play('dash');
  }

  function mount(v) {
    view = v;
    v.appendChild(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🥷 Уклонение' }),
        el('p', { text: 'Босс-шеф швыряется едой. Продержись как можно дольше: WASD/стрелки, мышь или рывок на Space. Near-miss даёт бонусные очки.' }))));

    const wrap = el('div', { class: 'dodge-wrap panel anim-item' });
    canvas = el('canvas', { id: 'dodgeCanvas', width: W, height: H, class: 'dodge-canvas' });
    const hud = el('div', { class: 'dodge-hud' },
      el('div', { class: 'dh-cell' }, el('b', { class: 'dodge-score mono', text: '0' }), el('span', { class: 'muted', text: 'счёт' })),
      el('div', { class: 'dh-cell' }, el('b', { class: 'dodge-wave mono', text: '1' }), el('span', { class: 'muted', text: 'волна' })),
      el('div', { class: 'dh-cell' }, el('b', { class: 'dodge-best mono', text: (Store.state.games.dodge.best || 0) }), el('span', { class: 'muted', text: 'рекорд' })),
      el('div', { class: 'dh-cell' }, el('b', { class: 'dodge-hp', text: '❤️❤️❤️' }), el('span', { class: 'muted', text: 'жизни' }))
    );
    const announceNode = el('div', { class: 'dodge-announce' });
    const overNode = el('div', { class: 'dodge-over' });
    const bottom = el('div', { class: 'dodge-bottom' },
      el('button', { class: 'btn btn-primary dodge-start', text: '▶ Старт' }),
      el('button', { class: 'btn dodge-dash ready', text: 'РЫВОК' }),
      el('button', { class: 'btn', text: 'Пауза (P)', onclick: () => { if (!running || over) return; paused = !paused; if (!paused) { last = performance.now(); raf = requestAnimationFrame(loop); } } }),
      el('div', { class: 'muted', style: { fontSize: '11px' }, text: 'WASD/стрелки/мышь · Space рывок · P пауза · Enter заново' })
    );
    wrap.append(hud, canvas, announceNode, overNode, bottom);
    v.appendChild(wrap);

    // рисуем стартовый кадр
    cx = canvas.getContext('2d');
    reset(); running = false;
    draw();

    wrap.querySelector('.dodge-start').addEventListener('click', () => { overNode.classList.remove('show'); start(); });
    wrap.querySelector('.dodge-dash').addEventListener('click', doDash);
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width * W;
      mouse.y = (e.clientY - r.top) / r.height * H;
      mouse.active = true;
    });
    canvas.addEventListener('mousedown', doDash);
  }

  const KEYMAP = { KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', ArrowUp: 'arrowup', ArrowDown: 'arrowdown' };
  document.addEventListener('keydown', (e) => {
    if (!view || !view.classList.contains('active')) return;
    const k = KEYMAP[e.code] || e.key.toLowerCase();
    keys[k] = true;
    if (e.code === 'Space' && Pages['game-dodge'] && currentIsDodge()) { e.preventDefault(); if (running && !over) doDash(); }
    if (e.key.toLowerCase() === 'p' && running && !over) {
      paused = !paused;
      if (!paused) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }
    if (e.key === 'Enter' && over) { const b = view.querySelector('.dodge-over .btn-primary'); b && b.click(); }
    if (e.key.toLowerCase() === 'r' && running) { overNodeReset(); }
  });
  document.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code] || e.key.toLowerCase();
    keys[k] = false;
  });
  function currentIsDodge() { return location.hash === '#game-dodge'; }
  function overNodeReset() {
    if (!running) return;
    cancelAnimationFrame(raf);
    view.querySelector('.dodge-over')?.classList.remove('show');
    start();
  }

  function unmount() {
    running = false; over = true;
    cancelAnimationFrame(raf);
    keys = {};
  }

  Pages['game-dodge'] = { mount, unmount };
})();
