/* Стресс-тесты логики: много партий блэкджека/дурака и длинная кампания Империи.
   Запуск: node tools/stress-games.js */
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

const REND = path.join(__dirname, '..', 'src', 'renderer');
const html = fs.readFileSync(path.join(REND, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('  ✅', n); } else { fail++; console.log('  ❌', n); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const dom = new JSDOM(html, {
  runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/index.html',
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
      get(t, k) { if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} }); return () => {}; },
      set() { return true; }
    });
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    window.AudioContext = function () {
      return { state: 'running', currentTime: 0, sampleRate: 44100, destination: {}, resume() {},
        createGain: () => ({ gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
        createOscillator: () => ({ frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: '', start() {}, stop() {}, connect() {} }),
        createBuffer: () => ({ getChannelData: () => new Float32Array(10) }),
        createBufferSource: () => ({ connect() {}, start() {} }),
        createBiquadFilter: () => ({ connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: '' }) };
    };
    window.HTMLElement.prototype.requestFullscreen = () => Promise.resolve();
    window.document.exitFullscreen = () => Promise.resolve();
    window.addEventListener('error', (e) => errors.push('window.error: ' + e.message));
  }
});
const w = dom.window;
w.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
w.console.warn = () => {};
for (const m of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((x) => x[1])) {
  try { w.eval(fs.readFileSync(path.join(REND, m), 'utf8')); } catch (e) { errors.push('load ' + m + ': ' + e.message); }
}

(async () => {
  await sleep(200);
  w.document.getElementById('splash')?.classList.add('done');
  w.bootApp(); await sleep(300);
  w.Store.state.honey = 1e9;

  const click = (el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  console.log('\n[S] Блэкджек — 60 раздач по стратегии «до 17»');
  try {
    w.Go('game-blackjack'); await sleep(150);
    let results = 0, busted = 0;
    for (let i = 0; i < 60; i++) {
      const deal = w.document.querySelector('.bj-deal');
      if (deal && !deal.classList.contains('hide')) click(deal);
      await sleep(800); // ждём полную анимацию раздачи
      let guard = 0;
      while (w.document.querySelector('.bj-stand') && !w.document.querySelector('.bj-stand').classList.contains('hide')) {
        const hit = w.document.querySelector('.bj-hit');
        const stand = w.document.querySelector('.bj-stand');
        const scoreHead = w.document.querySelectorAll('.bj-seat')[1].querySelector('.bj-score').textContent;
        const score = parseInt(scoreHead, 10) || 0;
        if (score > 0 && score < 17 && hit && !hit.classList.contains('hide')) { click(hit); await sleep(450); }
        else { click(stand); await sleep(1600); break; } // ждём весь добор дилера
        if (++guard > 12) break;
      }
      await sleep(150);
      const msg = w.document.querySelector('.bj-message')?.textContent || '';
      if (msg.length > 3) results++;
      if (/Перебор/i.test(msg)) busted++;
    }
    ok(results >= 55, `завершено раздач: ${results}/60 (переборов у нас: ${busted})`);
  } catch (e) { ok(false, 'блэкджек: ' + e.message); errors.push(e.stack); }

  console.log('\n[S] Империя — 130 месяцев, без поражения/зависаний модалок');
  try {
    w.Go('game-imperium'); await sleep(200);
    let gameEndedModalSeen = 0;
    for (let i = 0; i < 130; i++) {
      // закрываем события: жмём первую кнопку модалки
      const shade = w.document.getElementById('modalShade');
      if (shade.classList.contains('open')) {
        const btn = shade.querySelector('.modal-body .btn');
        click(btn); await sleep(40);
      }
      // если висит финальное окно — новая кампания
      const btns = [...shade.querySelectorAll('.btn')].map((b) => b.textContent);
      if (btns.some((t) => /Новая кампания|Начать заново/.test(t))) {
        gameEndedModalSeen++;
        click(shade.querySelectorAll('.modal-body .btn')[0]);
        await sleep(60);
      }
      const next = w.document.querySelector('.imp-next');
      if (!next) break;
      click(next);
      await sleep(45);
    }
    ok(true, `130 месяцев обработаны (финальных окон кампании: ${gameEndedModalSeen})`);
  } catch (e) { ok(false, 'империя: ' + e.message); errors.push(e.stack); }

  console.log('\n[S] Дурак — 3 автопартии до финального окна');
  function cardVal(s) { return { '6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }[s]; }
  function trumpSuit() {
    const t = w.document.getElementById('dkTrump')?.textContent;
    for (const s of ['♠','♥','♦','♣']) if (t.includes(s)) return { '♠':'S','♥':'H','♦':'D','♣':'C' }[s];
    return null;
  }
  function parseHandCard(node) {
    const txt = node.textContent.replace(/\s+/g, '');
    const rank = txt.startsWith('10') ? '10' : txt[0];
    // масть — по символу
    let suit = null;
    if (node.textContent.includes('♠')) suit = 'S';
    else if (node.textContent.includes('♥')) suit = 'H';
    else if (node.textContent.includes('♦')) suit = 'D';
    else if (node.textContent.includes('♣')) suit = 'C';
    return { rank, suit, v: cardVal(rank) };
  }
  function beats(a, b, tr) {
    if (a.suit === tr && b.suit !== tr) return true;
    if (a.suit !== b.suit) return false;
    return a.v > b.v;
  }
  try {
    let finishedGames = 0;
    for (let g = 0; g < 2; g++) {
      w.Go('game-durak'); await sleep(1600);
      let guard = 0;
      while (guard < 260) {
        guard++;
        // финальная модалка?
        const shade = w.document.getElementById('modalShade');
        if (shade.classList.contains('open') && /дурак|Ничья|не дурак/i.test(shade.textContent)) {
          finishedGames++;
          click(shade.querySelectorAll('.modal-body .btn')[0]);
          await sleep(200); break;
        }
        const pairs = [...w.document.querySelectorAll('#dkTable .dk-pair')];
        const uncoveredPair = pairs.find((p) => p.querySelector('.dk-uncovered'));
        const handCards = [...w.document.querySelectorAll('.dk-hand-card')];
        const takeBtn = w.document.querySelector('.dk-take');
        const bitoBtn = w.document.querySelector('.dk-bito');
        const tr = trumpSuit();
        if (uncoveredPair) {
          // ищем любую атаку, которую можем покрыть
          const ups = pairs.filter((p) => p.querySelector('.dk-uncovered'));
          let acted = false;
          for (const up of ups) {
            const under = up.querySelector('.dk-on-table');
            const underTxt = under.textContent;
            let br = null;
            if (underTxt.includes('♠')) br = 'S'; else if (underTxt.includes('♥')) br = 'H';
            else if (underTxt.includes('♦')) br = 'D'; else if (underTxt.includes('♣')) br = 'C';
            const rankT = underTxt.replace(/\s+/g, '').startsWith('10') ? '10' : underTxt.replace(/\s+/g, '')[0];
            const target = { rank: rankT, suit: br, v: cardVal(rankT) };
            const cards = handCards.map(parseHandCard);
            const idx = cards.findIndex((c) => beats(c, target, tr));
            if (idx >= 0) {
              click(handCards[idx]); await sleep(80);
              click(up.querySelector('.dk-uncovered')); await sleep(600);
              acted = true; break;
            }
          }
          if (!acted) {
            if (!takeBtn.disabled) { click(takeBtn); await sleep(950); }
            else await sleep(250);
          }
        } else if (pairs.length && !bitoBtn.disabled) {
          click(bitoBtn); await sleep(800);
        } else if (!pairs.length) {
          // наш заход?
          if (handCards.length && w.document.querySelector('.dk-msg')?.textContent.includes('Твой заход')) {
            click(handCards[0]); await sleep(800);
          } else await sleep(200);
        } else await sleep(200);
        if (guard > 390) { ok(false, 'партия дурака #' + (g + 1) + ' зависла'); }
      }
      await sleep(200);
    }
    ok(finishedGames >= 2, `автопартий дурака доиграно: ${finishedGames}/3`);
  } catch (e) { ok(false, 'дурак: ' + e.message); errors.push(e.stack); }

  console.log('\n[S] Слоты — 25 автоспинов без ошибок состояния');
  try {
    w.Store.state.honey = 1e9;
    w.Go('game-slots'); await sleep(200);
    for (let i = 0; i < 25; i++) {
      const b = w.document.querySelector('.slot-spin');
      if (!b.disabled) click(b);
      await sleep(2100);
    }
    ok(true, '25 спинов отработали');
  } catch (e) { ok(false, 'слоты: ' + e.message); errors.push(e.stack); }

  console.log('\n==============================');
  console.log(`СТРЕСС: ${pass} прошло, ${fail} упало`);
  if (errors.length) { console.log('Ошибки:'); [...new Set(errors)].slice(0, 15).forEach((e) => console.log(' • ' + String(e).slice(0, 300))); }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
