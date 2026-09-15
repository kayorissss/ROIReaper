/* ============ util.js — утилиты ============ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, ...children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      n.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return n;
  }

  // Компактные числа: 1.2K / 3.4M / 5.6B ...
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (n == null || isNaN(n)) return '0';
    const neg = n < 0; n = Math.abs(n);
    if (n < 1000) return (neg ? '-' : '') + (Number.isInteger(n) ? n : n.toFixed(1));
    let tier = Math.floor(Math.log10(n) / 3);
    tier = Math.min(tier, SUFFIX.length - 1);
    let v = n / Math.pow(1000, tier);
    let s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    s = s.replace(/\.0+$|(?<=\.\d)0+$/, '');
    return (neg ? '-' : '') + s + SUFFIX[tier];
  }
  function fmtFull(n) { return Math.floor(n).toLocaleString('ru-RU'); }
  function fmtMoney(n) { return '🍯 ' + fmt(n); }

  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1)); // включительно
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutCubic = ease;
  function easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Взвешенный случайный выбор: [{item, w}]
  function weighted(items, weightKey = 'w') {
    let total = 0;
    for (const it of items) total += it[weightKey];
    let r = Math.random() * total;
    for (const it of items) { r -= it[weightKey]; if (r <= 0) return it; }
    return items[items.length - 1];
  }

  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // Плавная анимация числа
  function tweenNumber(from, to, ms, onStep, onDone) {
    const t0 = performance.now();
    return new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - t0) / ms);
        onStep(lerp(from, to, ease(t)));
        if (t < 1) requestAnimationFrame(frame);
        else { onStep(to); onDone && onDone(); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  function download(filename, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function readFile(accept = '.json') {
    return new Promise((resolve) => {
      const inp = el('input', { type: 'file', accept });
      inp.addEventListener('change', () => {
        const f = inp.files[0]; if (!f) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, text: r.result });
        r.readAsText(f);
      });
      inp.click();
    });
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }

  const todayKey = () => new Date().toISOString().slice(0, 10);

  window.U = {
    $, $$, el, fmt, fmtFull, fmtMoney, rand, randInt, pick, chance, clamp, lerp, ease,
    easeOutBack, shuffle, weighted, sleep, tweenNumber, download, readFile, hslToRgb, todayKey
  };
})();
