/* ============ ui.js — тосты, модалки, общие контролы ============ */
(function () {
  'use strict';
  const { $, el } = U;

  /* ---------- Тосты ---------- */
  function toast(text, kind = '', icon = '') {
    const wrap = $('#toasts');
    const t = el('div', { class: 'toast ' + kind },
      el('span', { class: 't-ico', text: icon || (kind === 'good' ? '✅' : kind === 'bad' ? '⛔' : kind === 'info' ? 'ℹ️' : '🐝') }),
      el('span', { text })
    );
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3400);
  }

  /* ---------- Модалки ---------- */
  const shade = $('#modalShade'), modal = $('#modal'), mTitle = $('#modalTitle'), mBody = $('#modalBody');
  let lastFocus = null;
  function modalOpen(title, bodyNode, opts = {}) {
    lastFocus = document.activeElement;
    mTitle.textContent = title || '';
    mBody.replaceChildren(typeof bodyNode === 'string' ? el('div', { html: bodyNode }) : bodyNode);
    shade.classList.add('open');
    if (!opts.wide) modal.style.width = ''; else modal.style.width = 'min(760px, calc(100vw - 40px))';
    Snd.play('ui');
  }
  function modalClose() { shade.classList.remove('open'); if (lastFocus) lastFocus.focus(); }
  $('#modalClose').addEventListener('click', modalClose);
  shade.addEventListener('click', (e) => { if (e.target === shade) modalClose(); });

  function confirm(title, text, yesText = 'Подтвердить', danger = false) {
    return new Promise((resolve) => {
      const body = el('div', {},
        el('p', { style: { fontSize: '13px', color: 'var(--text-2)', marginBottom: '18px', lineHeight: '1.6' }, text }),
        el('div', { class: 'flex gap8', style: { justifyContent: 'flex-end' } },
          el('button', { class: 'btn btn-ghost', onclick: () => { modalClose(); resolve(false); }, text: 'Отмена' }),
          el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => { modalClose(); resolve(true); }, text: yesText })
        )
      );
      modalOpen(title, body);
    });
  }

  /* ---------- Рябь по кнопкам ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.btn, .nav-item, .card-game');
    if (!b || Store.state.settings.animations === false) return;
    const r = el('span', { class: 'ripple' });
    const rect = b.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height);
    Object.assign(r.style, {
      width: d + 'px', height: d + 'px',
      left: (e.clientX - rect.left - d / 2) + 'px', top: (e.clientY - rect.top - d / 2) + 'px'
    });
    b.style.position = b.style.position || 'relative'; b.style.overflow = 'hidden';
    b.appendChild(r); setTimeout(() => r.remove(), 600);
  });

  /* ---------- Шапка с валютой ---------- */
  const honeyEl = $('#curHoney'), jellyEl = $('#curJelly');
  let shownHoney = Store.state.honey, shownJelly = Store.state.jelly;
  function renderCurrency(animate = true) {
    const target = Store.state.honey;
    if (animate && Math.abs(target - shownHoney) > 0) {
      U.tweenNumber(shownHoney, target, Math.min(600, 120 + Math.abs(target - shownHoney) * 0.02), (v) => {
        honeyEl.textContent = U.fmt(v);
      }, () => { shownHoney = target; honeyEl.textContent = U.fmt(target); });
    } else {
      shownHoney = target; honeyEl.textContent = U.fmt(target);
    }
    jellyEl.textContent = U.fmt(Store.state.jelly);
  }
  function bump(which) {
    const node = which === 'jelly' ? jellyEl.parentElement : honeyEl.parentElement;
    node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
  }
  Store.on('honey', (n) => { renderCurrency(); if (n > 0) bump('honey'); });
  Store.on('jelly', () => { renderCurrency(); bump('jelly'); });

  /* ---------- Segmented control ---------- */
  function segmented(values, current, onChange) {
    const seg = el('div', { class: 'seg' });
    values.forEach(([val, label]) => {
      seg.appendChild(el('button', {
        class: val === current ? 'on' : '',
        text: label,
        onclick: (e) => {
          U.$$('button', seg).forEach((b) => b.classList.remove('on'));
          e.target.classList.add('on'); onChange(val); Snd.play('tab');
        }
      }));
    });
    return seg;
  }

  /* ---------- Маленькие карточки статов ---------- */
  function statRow(k, v) {
    return el('div', { class: 'stat-row' }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
  }

  function keyHint(keys, label) {
    return el('span', { class: 'key-hint', html: keys.map((k) => `<kbd>${k}</kbd>`).join(' ') + ` <em>${label}</em>` });
  }

  /* ---------- Анимированный счётчик награды поверх экрана ---------- */
  function flyGain(targetEl, text, color = 'var(--accent)') {
    if (!targetEl || Store.state.settings.animations === false) return;
    const r = targetEl.getBoundingClientRect();
    const f = el('div', { class: 'fly-gain', text }, { });
    Object.assign(f.style, {
      position: 'fixed', left: r.left + r.width / 2 + 'px', top: r.top + r.height / 3 + 'px',
      color, fontWeight: 800, fontSize: '20px', zIndex: 90, pointerEvents: 'none',
      textShadow: '0 2px 12px rgba(0,0,0,.6)', animation: 'floatUp 1s ease-out forwards'
    });
    document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
  }

  window.UI = { toast, modalOpen, modalClose, confirm, renderCurrency, segmented, statRow, keyHint, flyGain, bump };
})();
