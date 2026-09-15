/* ============ updates.js — проверка и загрузка обновлений через GitHub ============ */
(function () {
  'use strict';
  const { el } = U;
  const OWNER = 'kayorissss';
  const REPO = 'ROIReaper';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const WEB = `https://github.com/${OWNER}/${REPO}`;
  const RELEASES = WEB + '/releases';
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}`;

  function cmpVersion(a, b) {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; }
    return 0;
  }

  let cache = null, checking = false;

  async function check(manual = false) {
    if (checking) return cache;
    checking = true;
    try {
      const r = await fetch(API + '/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const latest = (d.tag_name || '').replace(/^v/, '');
      let assets = (d.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url, downloads: a.download_count }));
      // фолбэк: файлы версий лежат в самом репозитории (release/)
      if (!assets.length && latest) {
        assets = [
          { name: `ROIReaper-Setup-${latest}.exe`, size: 0, url: `${RAW}/v${latest}/release/ROIReaper-Setup-${latest}.exe`, fallback: true },
          { name: `ROIReaper-${latest}-Portable.zip`, size: 0, url: `${RAW}/v${latest}/release/ROIReaper-${latest}-Portable.zip`, fallback: true }
        ];
      }
      cache = {
        latest, name: d.name || d.tag_name,
        notes: d.body || 'Описание отсутствует.',
        url: d.html_url || RELEASES, assets,
        hasUpdate: cmpVersion(latest, Store.VERSION) > 0,
        date: d.published_at, ok: true
      };
    } catch (e) {
      cache = { ok: false, error: e.message };
      if (manual) UI.toast('Не удалось проверить обновления: ' + e.message, 'bad');
    }
    checking = false;
    return cache;
  }

  function notifyUpdate(info) {
    const n = document.getElementById('notify');
    document.getElementById('notifyTitle').textContent = 'Доступно обновление v' + info.latest;
    document.getElementById('notifyText').textContent = 'Жнец Роя стал лучше — посмотреть, что нового.';
    const btn = document.getElementById('notifyBtn');
    btn.textContent = 'Обновить';
    btn.onclick = () => { n.hidden = true; Go('settings'); };
    document.getElementById('notifyX').onclick = () => { n.hidden = true; Store.state.updates.dismissed = info.latest; Store.save(); };
    n.hidden = false;
    const bar = n.querySelector('.notify-bar');
    bar.style.animation = 'none'; void n.offsetWidth; bar.style.animation = '';
    clearTimeout(n._t); n._t = setTimeout(() => { n.hidden = true; }, 12500);
    Snd.play('rare');
  }

  async function autoCheck() {
    const info = await check(false);
    if (info && info.ok && info.hasUpdate && Store.state.updates.dismissed !== info.latest) notifyUpdate(info);
  }

  /* ---------- загрузка файла прямо в программе с реальным процентом ---------- */
  async function downloadInApp(url, filename, bar, pctEl, stageEl) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = +(res.headers.get('content-length') || 0);
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); received += value.length;
      const p = total ? Math.round(100 * received / total) : 0;
      bar.style.width = (total ? p : 40) + '%';
      pctEl.textContent = total ? p + '%' : 'загрузка…';
      stageEl.textContent = `Загрузка ${filename} — ${(received / 1048576).toFixed(1)} МБ` + (total ? ` / ${(total / 1048576).toFixed(1)} МБ` : '');
      if (!total && Math.random() < .05) Snd.play('tick');
    }
    bar.style.width = '100%'; pctEl.textContent = '100%';
    stageEl.textContent = 'Загрузка завершена — сохраняем файл…';
    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const a = el('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    return blob.size;
  }

  /* ---------- панель в Настройках ---------- */
  function panel() {
    const box = el('div', { class: 'updater-panel' });
    box.append(
      el('div', { class: 'flex gap12', style: { alignItems: 'center', marginBottom: '14px' } },
        el('img', { src: 'assets/img/icon-64.png', style: { width: '48px', height: '48px', borderRadius: '12px' } }),
        el('div', { class: 'grow' },
          el('div', { class: 'panel-title', style: { margin: 0 }, text: 'Обновления' }),
          el('div', { class: 'muted', style: { fontSize: '11.5px' }, html: `Текущая версия: <b style="color:var(--text)">v${Store.VERSION}</b> · канал: стабильный` })
        )
      )
    );
    const status = el('div', { class: 'update-status' });
    const progress = el('div', { class: 'update-progress hide' },
      el('div', { class: 'upd-stages muted' }),
      el('div', { class: 'bar big upd-bar' }, el('div', { style: { width: '0%' } })),
      el('div', { class: 'upd-pct muted', text: '' })
    );
    const actions = el('div', { class: 'flex gap8', style: { flexWrap: 'wrap' } },
      el('button', { class: 'btn btn-primary btn-sm', 'data-upd-open': '', text: '🔄 Проверить обновления' }),
      el('a', { class: 'btn btn-sm', href: RELEASES, target: '_blank', rel: 'noopener', text: '📄 Все релизы' }),
      el('a', { class: 'btn btn-sm', href: WEB, target: '_blank', rel: 'noopener', text: '🐙 GitHub' })
    );
    box.append(status, progress, el('div', { style: { height: '12px' } }), actions);

    const setStatus = (html, kind) => { status.className = 'update-status ' + (kind || ''); status.innerHTML = html; };

    actions.querySelector('[data-upd-open]').addEventListener('click', async () => {
      setStatus('🔄 Проверка сервера GitHub…', 'loading');
      Snd.play('tick');
      const info = await check(true);
      if (!info || !info.ok) { setStatus('⚠️ Сервер обновлений недоступен. Проверь интернет или открой страницу релизов.', 'bad'); return; }
      if (!info.hasUpdate) {
        setStatus(`✅ У тебя последняя версия — <b>v${Store.VERSION}</b>. Новее ничего нет!`, 'good');
        Snd.play('coin'); return;
      }
      Snd.play('rare');
      const notes = info.notes.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      setStatus(
        `<div class="update-avail">
           <div class="ua-flag">НОВАЯ ВЕРСИЯ</div>
           <div class="ua-ver">v${Store.VERSION} → <b class="gold-text">v${info.latest}</b></div>
           <div class="ua-date muted">${new Date(info.date).toLocaleDateString('ru-RU')}</div>
           <div class="ua-notes">${notes}</div>
         </div>`, 'avail');

      const dl = el('div', { class: 'dl-list' });
      info.assets.forEach((a) => {
        const isInstaller = /\.exe$/i.test(a.name);
        const b = el('button', {
          class: 'btn btn-sm ' + (isInstaller ? 'btn-primary' : ''),
          html: `⬇️ ${a.name}` + (a.size ? ` <em>${(a.size / 1048576).toFixed(1)} МБ</em>` : '')
        });
        b.addEventListener('click', async () => {
          progress.classList.remove('hide');
          const barFill = progress.querySelector('.upd-bar > div');
          const pct = progress.querySelector('.upd-pct');
          const stages = progress.querySelector('.upd-stages');
          barFill.style.width = '0%'; pct.textContent = '0%';
          dl.querySelectorAll('button').forEach((x) => (x.disabled = true));
          try {
            stages.textContent = '🌐 Соединяемся с хранилищем…';
            Snd.play('caseSpin');
            const bytes = await downloadInApp(a.url, a.name, barFill, pct, stages);
            stages.innerHTML = `✅ <b>${a.name}</b> сохранён (${(bytes / 1048576).toFixed(1)} МБ). ` +
              (isInstaller ? 'Запусти скачанный файл — данные и прогресс сохранятся.' : 'Распакуй ZIP поверх старой папки (для флешки).');
            Snd.play('bigwin');
          } catch (e) {
            stages.innerHTML = `⚠️ Прямая загрузка не удалась (${e.message}). <a href="${a.url}" target="_blank" rel="noopener">Открыть в браузере</a>`;
            barFill.style.width = '0%'; pctEl_safe(pct);
            Snd.play('deny');
          } finally {
            dl.querySelectorAll('button').forEach((x) => (x.disabled = false));
          }
        });
        dl.appendChild(b);
      });
      dl.appendChild(el('a', { class: 'btn btn-sm', href: info.url, target: '_blank', rel: 'noopener', text: 'Страница релиза' }));
      status.append(dl,
        el('div', { class: 'muted', style: { fontSize: '11px', marginTop: '8px' },
          text: 'Портативную версию достаточно распаковать поверх старой папки — сохранение не пострадает. Установщик обновит ярлыки.' }));
    });

    return box;
  }
  function pctEl_safe(pct) { if (pct) pct.textContent = 'ошибка'; }

  window.UpdateChecker = { check, autoCheck, panel, WEB, RELEASES };
})();
