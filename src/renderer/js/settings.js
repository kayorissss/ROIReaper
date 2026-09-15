/* ============ settings.js ============ */
(function () {
  'use strict';
  const { el } = U;

  function row(title, desc, ctl) {
    return el('div', { class: 'set-row' },
      el('div', { class: 'set-info' }, el('h4', { text: title }), desc ? el('p', { text: desc }) : null),
      el('div', { class: 'set-ctl' }, ctl)
    );
  }
  function switchRow(obj, key, title, desc, onChange) {
    const inp = el('input', { type: 'checkbox' });
    inp.checked = !!obj[key];
    inp.addEventListener('change', () => {
      obj[key] = inp.checked; Store.save();
      onChange && onChange(inp.checked);
      Snd.play('tab');
    });
    return row(title, desc, el('label', { class: 'switch' }, inp, el('span', { class: 'track' })));
  }

  function sliderRow(obj, key, title, desc, onInput) {
    const inp = el('input', { type: 'range', min: '0', max: '1', step: '0.05', style: { width: '150px' } });
    inp.value = obj[key];
    inp.addEventListener('input', () => { obj[key] = parseFloat(inp.value); Store.save(); onInput && onInput(inp.value); });
    return row(title, desc, inp);
  }

  function mount(v) {
    const s = Store.state;

    v.append(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '⚙ Настройки' }),
        el('p', { text: 'Всё сохраняется автоматически. Версия и ссылка на репозиторий — внизу.' }))));

    /* ---------- Внешний вид ---------- */
    const appear = el('div', { class: 'panel anim-item' });
    appear.appendChild(el('div', { class: 'panel-title', text: 'Внешний вид' }));
    appear.append(
      row('Тема', 'Тёмная — фирменная, светлая — для ярких аудиторий.',
        UI.segmented([['dark', '🌙 Тёмная'], ['light', '☀️ Светлая']], s.settings.theme, (val) => {
          s.settings.theme = val; Store.save(); AppCore.applySettings();
        })),
      row('Акцент', 'Цвет кнопок, подсветки и наград.',
        (() => {
          const colors = [['amber', '#f5b53c'], ['crimson', '#f0524a'], ['ice', '#54c8f0'], ['violet', '#a07bff'], ['toxic', '#9be73d']];
          const wrap = el('div', { class: 'flex gap8' });
          colors.forEach(([id, c]) => {
            const dot = el('button', {
              class: 'color-dot' + (s.settings.accent === id ? ' on' : ''),
              style: { background: c }, title: id
            });
            dot.addEventListener('click', () => {
              // платные палитры
              if (id !== 'amber' && !s.shop.owned['theme-' + id]) {
                const t = ShopItems.THEMES.find((x) => x.id === id);
                UI.confirm('Палитра заблокирована', `«${t.name}» можно купить в Магазине за 🍯 ${U.fmt(t.price)}. Открыть магазин?`, 'В магазин')
                  .then((ok) => ok && Go('shop'));
                Snd.play('deny');
                return;
              }
              s.settings.accent = id; Store.save(); AppCore.applySettings(); Snd.play('tab');
              wrap.querySelectorAll('.color-dot').forEach((d) => d.classList.remove('on'));
              dot.classList.add('on');
            });
            wrap.appendChild(dot);
          });
          return wrap;
        })()),
      switchRow(s.settings, 'animations', 'Анимации и эффекты', 'Отключи для максимальной производительности на слабых ПК.',
        (on) => document.body.classList.toggle('no-anim', !on)),
      switchRow(s.settings, 'splash', 'Заставка при запуске', 'Анимированный логотип Жнеца Роя.')
    );
    v.append(appear);

    /* ---------- Звук ---------- */
    const sound = el('div', { class: 'panel anim-item' });
    sound.appendChild(el('div', { class: 'panel-title', text: 'Звук' }));
    sound.append(
      row('Звуковые эффекты', 'Клики, выигрыши, барабаны. Клавиша M — быстро вкл/выкл.',
        (() => {
          const inp = el('input', { type: 'checkbox' }); inp.checked = s.settings.sound;
          inp.addEventListener('change', () => { Snd.setEnabled(inp.checked); s.settings.sound = inp.checked; Store.save(); });
          if (!Snd.enabled) inp.checked = false;
          return el('label', { class: 'switch' }, inp, el('span', { class: 'track' }));
        })()),
      sliderRow(s.settings, 'volume', 'Громкость', 'Общая громкость эффектов.', (val) => Snd.setVolume(val)),
      (() => {
        const inp = el('input', { type: 'checkbox' }); inp.checked = s.settings.music;
        inp.addEventListener('change', () => { Snd.setMusic(inp.checked); s.settings.music = inp.checked; Store.save(); });
        return row('Фоновый эмбиент', 'Лёгкий гул улья на фоне.',
          el('label', { class: 'switch' }, inp, el('span', { class: 'track' })));
      })(),
      el('div', { class: 'set-row' },
        el('div', { class: 'set-info' }, el('h4', { text: 'Проверка звука' }), el('p', { text: 'Проиграть несколько эффектов.' })),
        el('div', { class: 'set-ctl' },
          el('button', { class: 'btn btn-sm', text: '▶ Тест', onclick: () => { ['click', 'coin', 'win', 'bigwin'].forEach((n, i) => setTimeout(() => Snd.play(n), i * 280)); } })))
    );
    v.append(sound);

    /* ---------- Экран ---------- */
    const screen = el('div', { class: 'panel anim-item' });
    screen.appendChild(el('div', { class: 'panel-title', text: 'Экран и управление' }));
    screen.append(
      el('div', { class: 'set-row' },
        el('div', { class: 'set-info' }, el('h4', { text: 'Полноэкранный режим' }),
          el('p', { text: 'Клавиша F11 переключает полный экран в любой момент.' })),
        el('div', { class: 'set-ctl' }, el('button', {
          class: 'btn btn-sm btn-primary', text: document.fullscreenElement ? 'Выйти (F11)' : 'На весь экран (F11)',
          onclick: () => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
          }
        })))
    );
    v.append(screen);

    /* ---------- Обновления ---------- */
    const upd = el('div', { class: 'panel anim-item updater-host' });
    upd.appendChild(UpdateChecker.panel());
    v.append(upd);

    /* ---------- Данные ---------- */
    const data = el('div', { class: 'panel anim-item' });
    data.appendChild(el('div', { class: 'panel-title', text: 'Сохранение и данные' }));
    data.append(
      el('div', { class: 'set-row' },
        el('div', { class: 'set-info' }, el('h4', { text: 'Экспорт сохранения' }),
          el('p', { text: 'Файл с мёдом, желе, покупками и рекордами. Носи с собой на флешке.' })),
        el('div', { class: 'set-ctl' }, el('button', {
          class: 'btn btn-sm', text: '⬇ Экспорт', onclick: () => {
            U.download('ROIReaper-save-' + U.todayKey() + '.txt', Store.exportSave(), 'text/plain');
            UI.toast('Сохранение экспортировано', 'good');
          }
        }))),
      el('div', { class: 'set-row' },
        el('div', { class: 'set-info' }, el('h4', { text: 'Импорт сохранения' }),
          el('p', { text: 'Заменит текущий прогресс содержимым файла.' })),
        el('div', { class: 'set-ctl' }, el('button', {
          class: 'btn btn-sm', text: '⬆ Импорт', onclick: async () => {
            const f = await U.readFile('.txt,.json'); if (!f) return;
            if (Store.importSave(f.text)) UI.toast('Сохранение импортировано', 'good');
            else UI.toast('Файл сохранения повреждён', 'bad');
          }
        }))),
      el('div', { class: 'set-row' },
        el('div', { class: 'set-info' }, el('h4', { style: { color: 'var(--bad)' }, text: 'Полный сброс' }),
          el('p', { text: 'Обнулит весь прогресс, покупки и рекорды. Отменить нельзя.' })),
        el('div', { class: 'set-ctl' }, el('button', {
          class: 'btn btn-sm btn-danger', text: 'Сбросить всё', onclick: async () => {
            const ok = await UI.confirm('Сброс прогресса', 'Точно удалить ВСЕ данные ROIReaper? Это необратимо.', 'Да, сбросить', true);
            if (ok) Store.resetAll();
          }
        })))
    );
    v.append(data);

    /* ---------- О программе ---------- */
    const about = el('div', { class: 'panel anim-item about-panel' },
      el('div', { class: 'flex gap16', style: { alignItems: 'center', marginBottom: '14px' } },
        el('img', { src: 'assets/img/icon-128.png', style: { width: '72px', height: '72px', borderRadius: '18px' } }),
        el('div', {},
          el('div', { style: { fontSize: '20px', fontWeight: 800, letterSpacing: '.04em' }, html: 'ROIReaper <span class="gold-text">Жнец Роя</span>' }),
          el('div', { class: 'muted', style: { fontSize: '11.5px' }, text: 'Версия v' + Store.VERSION + ' (стабильная) · сборка для Windows' }),
          el('div', { class: 'flex gap8', style: { marginTop: '10px' } },
            el('a', { class: 'btn btn-sm', href: UpdateChecker.WEB, target: '_blank', rel: 'noopener', text: '🐙 GitHub' }),
            el('a', { class: 'btn btn-sm', href: UpdateChecker.RELEASES, target: '_blank', rel: 'noopener', text: '📦 Релизы' }),
            el('a', { class: 'btn btn-sm', href: UpdateChecker.WEB + '/issues/new', target: '_blank', rel: 'noopener', text: '🐛 Сообщить об ошибке' })
          )
        )
      ),
      el('div', { class: 'about-grid' },
        UI.statRow('Версия', 'v' + Store.VERSION),
        UI.statRow('Движок интерфейса', 'Chromium App Mode (Edge / Chrome)'),
        UI.statRow('Шрифт', 'Unbounded (Google Fonts)'),
        UI.statRow('Хранение данных', 'локально, офлайн'),
        UI.statRow('Лицензия', 'MIT'),
        UI.statRow('Автор', 'kayorissss')
      ),
      el('p', { class: 'muted', style: { fontSize: '11px', marginTop: '14px' }, text: 'ROIReaper — неофициальный фан-проект. Не требует установки, не собирает персональные данные и работает полностью офлайн. Иконка и название — «Оса-жнец».' })
    );
    v.append(about);
  }

  Pages['settings'] = { mount };
})();
