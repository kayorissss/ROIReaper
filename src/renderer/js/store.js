/* ============ store.js — единое сохранение и валюта ============ */
(function () {
  'use strict';

  const KEY = 'roireaper.save.v1';
  const VERSION = '1.0.0';

  function defaults() {
    return {
      v: 1,
      honey: 250,          // 🍯 мёд — основная валюта
      jelly: 0,            // 👑 королевское желе — престиж
      lastSeen: Date.now(),
      stats: {
        earned: 0, spent: 0, clicks: 0, wagered: 0, won: 0,
        casesOpened: 0, casinoWins: 0, casinoLosses: 0,
        kills: 0, dodgesBest: 0, checkersWins: 0, durakWins: 0, g2048Best: 0,
        imperiumWins: 0, playTime: 0
      },
      clicker: {
        totalHoney: 0, clickPower: 1,
        generators: {},   // id -> level
        upgrades: {},     // id -> true
        resets: 0,
        best: 0
      },
      cases: { inventory: [], opened: 0, tickets: 1 },
      casino: { lastBonus: 0 },
      shop: { owned: {}, consumables: { luck: 0 }, skin: 'reaper', theme: null, badge: null, cardsBack: 'honey' },
      games: { dodge: { best: 0 }, imperium: null, g2048: { best: 0, score: 0 } },
      daily: { date: '', streak: 0 },
      updates: { dismissed: '', seen: '' },
      settings: {
        theme: 'dark', accent: 'amber', sound: true, music: false,
        volume: 0.7, animations: true, splash: true
      }
    };
  }

  let state = load();
  const listeners = {};

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      const d = defaults();
      // глубокий мёрж с дефолтами
      return deepMerge(d, parsed);
    } catch (e) { console.warn('Не удалось загрузить сохранение', e); return defaults(); }
  }

  function deepMerge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === 'object') {
        deepMerge(base[k], over[k]);
      } else base[k] = over[k];
    }
    return base;
  }

  let saveTimer = null;
  function save() {
    state.lastSeen = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  }
  function flush() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  setInterval(flush, 15000);
  window.addEventListener('beforeunload', flush);

  function emit(ev, payload) { (listeners[ev] || []).forEach((fn) => fn(payload)); }
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }

  function addHoney(n, silent) {
    state.honey = Math.max(0, state.honey + n);
    if (n > 0) { state.stats.earned += n; }
    if (n < 0) { state.stats.spent += -n; }
    if (!silent) emit('honey', n);
    save();
    return true;
  }
  function spendHoney(n) {
    if (state.honey < n) return false;
    addHoney(-n); return true;
  }
  function addJelly(n) { state.jelly += n; emit('jelly', n); save(); }
  function spendJelly(n) { if (state.jelly < n) return false; state.jelly -= n; emit('jelly', n); save(); return true; }

  function resetAll() {
    localStorage.removeItem(KEY);
    state = defaults();
    save();
    setTimeout(() => location.reload(), 400);
  }

  function exportSave() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
  }
  function importSave(str) {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      state = deepMerge(defaults(), data);
      flush(); location.reload();
      return true;
    } catch (e) { return false; }
  }

  // Ежедневная награда
  function dailyAvailable() {
    return U.todayKey() !== state.daily.date;
  }

  const Store = {
    KEY, VERSION,
    get state() { return state; },
    save, flush, on, emit,
    addHoney, spendHoney, addJelly, spendJelly,
    resetAll, exportSave, importSave, dailyAvailable,
    luckMult() { return state.shop.consumables.luck > 0 ? 1.25 : 1; }
  };
  window.Store = Store;
})();
