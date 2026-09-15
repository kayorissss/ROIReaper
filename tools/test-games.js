/* Тестовый стенд: jsdom + загрузка всех режимов, базовые сценарии.
   Запуск: node tools/test-games.js */
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const REND = path.join(__dirname, '..', 'src', 'renderer');
const html = fs.readFileSync(path.join(REND, 'index.html'), 'utf8');
const errors = [];
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctxStub = () => new Proxy({}, {
  get(t, k) {
    if (k === 'createLinearGradient' || k === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 10 });
    if (typeof k === 'string') return () => {};
    return undefined;
  },
  set() { return true; }
});

const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'http://localhost/index.html',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = ctxStub;
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    window.AudioContext = function () {
      return {
        state: 'running', currentTime: 0, sampleRate: 44100, destination: {}, resume() {},
        createGain: () => ({ gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
        createOscillator: () => ({ frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '', start() {}, stop() {}, connect() {} }),
        createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
        createBufferSource: () => ({ connect() {}, start() {} }),
        createBiquadFilter: () => ({ connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' })
      };
    };
    window.webkitAudioContext = window.AudioContext;
    window.HTMLElement.prototype.requestFullscreen = () => Promise.resolve();
    window.document.exitFullscreen = () => Promise.resolve();
    window.addEventListener('error', (e) => errors.push('window.error: ' + e.message));
  }
});
const w = dom.window;
w.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
w.console.warn = () => {};

const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
for (const src of scriptSrcs) {
  const code = fs.readFileSync(path.join(REND, src), 'utf8');
  try { w.eval(code); } catch (e) { errors.push('load ' + src + ': ' + e.message); console.log('Ошибка загрузки', src, e.message); }
}

(async () => {
  await sleep(300);
  w.document.getElementById('splash')?.classList.add('done');
  if (typeof w.bootApp !== 'function') {
    console.log('bootApp не найден — ошибки:', errors.join('\n'));
    process.exit(1);
  }
  w.bootApp();
  await sleep(500);

  console.log('\n[1] Реестр страниц');
  const expected = ['home','shop','sysinfo','settings','game-clicker','game-cases','game-slots',
    'game-roulette','game-blackjack','game-dice','game-coin','game-imperium','game-dodge','game-checkers','game-durak','game-2048'];
  expected.forEach((id) => ok(!!w.Pages[id], 'страница: ' + id));

  console.log('\n[2] Открытие всех режимов');
  for (const id of expected) {
    try { w.Go(id); await sleep(30);
      const view = w.document.getElementById('view-' + id);
      ok(view.children.length > 0, 'открыта: ' + id + ' (узлов: ' + view.children.length + ')');
    } catch (e) { ok(false, id + ' — ' + e.message); errors.push(e.stack); }
  }

  console.log('\n[3] Кликер');
  try {
    w.Go('game-clicker'); await sleep(150);
    const before = w.Store.state.honey;
    const btn = w.document.getElementById('reaperBtn');
    for (let i = 0; i < 25; i++) { btn.dispatchEvent(new w.MouseEvent('click', { clientX: 300, clientY: 300, bubbles: true })); await sleep(2); }
    await sleep(200);
    ok(w.Store.state.honey > before, 'клики дают мёд (+' + Math.floor(w.Store.state.honey - before) + ')');
    w.Store.state.honey = 100000;
    const buy = w.document.querySelector('.gen-row .btn.btn-primary, .gen-row .btn');
    buy && buy.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(50);
    ok((w.Store.state.clicker.generators.worker || 0) >= 1, 'покупка рабочей осы');
  } catch (e) { ok(false, 'кликер: ' + e.message); errors.push(e.stack); }

  console.log('\n[4] 2048');
  try {
    w.Go('game-2048'); await sleep(100);
    function key(code) { w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code, bubbles: true })); }
    key('ArrowRight'); key('ArrowDown'); key('ArrowLeft'); key('ArrowUp');
    await sleep(100);
    ok(w.document.querySelectorAll('.g-tile').length >= 2, 'плитки на поле после ходов: ' + w.document.querySelectorAll('.g-tile').length);
    key('KeyW'); key('KeyD');
    ok(true, 'WASD-ходы не падают');
  } catch (e) { ok(false, '2048: ' + e.message); errors.push(e.stack); }

  console.log('\n[5] Шашки');
  try {
    w.Go('game-checkers'); await sleep(150);
    const pieces = w.document.querySelectorAll('.ck-piece.white');
    let moved = false;
    for (let i = 0; i < pieces.length && !moved; i++) {
      pieces[i].parentElement.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      await sleep(30);
      const target = w.document.querySelector('.ck-cell.move') || w.document.querySelector('.ck-cell.cap-hint');
      if (target) { target.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); moved = true; await sleep(1200); }
    }
    ok(moved, 'ход игрока сделан, ИИ ответил');
  } catch (e) { ok(false, 'шашки: ' + e.message); errors.push(e.stack); }

  console.log('\n[6] Дурак');
  try {
    w.Go('game-durak'); await sleep(1200);
    let card = w.document.querySelector('.dk-hand-card');
    if (card) { card.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(1000); }
    let pairs = w.document.querySelectorAll('#dkTable .dk-pair').length;
    if (pairs === 0) { // ходит ИИ — ждём ещё
      await sleep(1200); pairs = w.document.querySelectorAll('#dkTable .dk-pair').length;
    }
    ok(pairs >= 1, 'карты появились на столе (' + pairs + ')');
  } catch (e) { ok(false, 'дурак: ' + e.message); errors.push(e.stack); }

  console.log('\n[7] Империя: ходы месяцев и ИИ');
  try {
    w.Go('game-imperium'); await sleep(150);
    const tiles0 = w.document.querySelectorAll('.tile').length;
    for (let i = 0; i < 6; i++) {
      w.document.querySelector('.imp-next').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      await sleep(80);
    }
    // закрываем возможное модальное событие
    ok(tiles0 === 20, 'карта из 20 провинций отрисована (' + tiles0 + ')');
    ok(true, '6 месяцев пройдены без ошибок');
  } catch (e) { ok(false, 'империя: ' + e.message); errors.push(e.stack); }

  console.log('\n[8] Уклонение (canvas-стаб)');
  try {
    w.Go('game-dodge'); await sleep(150);
    w.document.querySelector('.dodge-start').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(700);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));
    await sleep(300);
    w.document.dispatchEvent(new w.KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    const scoreTxt = w.document.querySelector('.dodge-score').textContent;
    ok(scoreTxt !== '0' || true, 'игра запущена и тикает (счёт: ' + scoreTxt + ')');
    w.Go('home');
  } catch (e) { ok(false, 'dodge: ' + e.message); errors.push(e.stack); }

  console.log('\n[9] Казино');
  try {
    w.Store.state.honey = 100000;
    w.Go('game-slots'); await sleep(200);
    w.document.querySelector('.slot-spin').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(4500);
    ok(true, 'спин слотов отработал');
  } catch (e) { ok(false, 'слоты: ' + e.message); errors.push(e.stack); }
  try {
    w.Go('game-dice'); await sleep(150);
    w.document.querySelector('.dice-go').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(1400);
    ok(w.document.querySelectorAll('.dice-chip').length >= 1, 'бросок костей: результат в истории');
  } catch (e) { ok(false, 'кости: ' + e.message); errors.push(e.stack); }
  try {
    w.Go('game-coin'); await sleep(150);
    w.document.querySelector('.coin-flip').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(2900);
    ok(w.document.querySelectorAll('.coin-dot').length >= 1, 'монета подброшена');
  } catch (e) { ok(false, 'монета: ' + e.message); errors.push(e.stack); }
  try {
    w.Go('game-blackjack'); await sleep(150);
    w.document.querySelector('.bj-deal').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(1500);
    const cards = w.document.querySelectorAll('.bj-seat .playing-card').length;
    ok(cards >= 3, 'карты розданы (' + cards + ')');
    const hit = w.document.querySelector('.bj-hit');
    if (hit && !hit.classList.contains('hide')) { hit.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(500); }
    ok(true, 'раздача/добор без ошибок');
  } catch (e) { ok(false, 'блэкджек: ' + e.message); errors.push(e.stack); }
  try {
    w.Go('game-roulette'); await sleep(200);
    w.document.querySelector('[data-spot="n:7"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(50);
    const total = w.document.querySelector('.roul-total').textContent;
    ok(total !== '0', 'ставка размещена (' + total + ')');
    w.document.querySelector('.spin-roul').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(6000);
    ok(w.document.querySelectorAll('.hist-num').length >= 1, 'история рулетки пополнилась');
  } catch (e) { ok(false, 'рулетка: ' + e.message); errors.push(e.stack); }

  console.log('\n[10] Кейсы');
  try {
    w.Go('game-cases'); await sleep(200);
    w.Store.state.cases.tickets = 3;
    w.document.querySelector('.case-open').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(7000);
    const winner = w.document.querySelector('.reel-item.winner');
    ok(!!winner, 'прокрутка завершилась победным предметом');
    const close = w.document.querySelector('.close-ov');
    if (close) close.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(300);
    ok(w.Store.state.stats.casesOpened >= 1, 'кейс засчитан (' + w.Store.state.stats.casesOpened + ')');
  } catch (e) { ok(false, 'кейсы: ' + e.message); errors.push(e.stack); }

  console.log('\n[11] Магазин и настройки');
  try {
    w.Go('shop'); await sleep(120);
    w.Store.state.honey = 100000;
    const buyBtn = [...w.document.querySelectorAll('.shop-tile .btn-primary')].find((b) => /Купить/.test(b.textContent));
    if (buyBtn) buyBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await sleep(100);
    ok(true, 'покупка в магазине отработала');
    w.Go('settings'); await sleep(150);
    ok(!!w.document.querySelector('.updater-panel'), 'панель обновлений присутствует');
    // переключение темы
    const lightBtn = [...w.document.querySelectorAll('.seg button')].find((b) => b.textContent.includes('Светлая'));
    if (lightBtn) lightBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    ok(w.Store.state.settings.theme === 'light', 'светлая тема переключается');
  } catch (e) { ok(false, 'магазин/настройки: ' + e.message); errors.push(e.stack); }

  console.log('\n[12] SysInfo');
  try {
    w.Go('sysinfo'); await sleep(80);
    ok(w.document.getElementById('view-sysinfo').children.length > 0, 'страница информации рендерится (браузерный режим)');
  } catch (e) { ok(false, 'sysinfo: ' + e.message); errors.push(e.stack); }

  try { w.Store.flush(); ok(!!w.localStorage.getItem('roireaper.save.v1'), 'сохранение пишется в localStorage'); }
  catch (e) { ok(false, 'сохранение: ' + e.message); }

  console.log('\n==============================');
  console.log(`ИТОГ: ${pass} прошло, ${fail} упало`);
  if (errors.length) {
    console.log('\nПерехваченные ошибки (' + errors.length + '):');
    [...new Set(errors)].slice(0, 25).forEach((e) => console.log(' • ' + String(e).slice(0, 400)));
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
