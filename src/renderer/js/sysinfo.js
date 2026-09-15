/* ============ sysinfo.js — информация о компьютере ============ */
(function () {
  'use strict';
  const { el } = U;

  function bar(label, used, total, unit, colorVar) {
    const pct = Math.min(100, Math.round(100 * used / total));
    return el('div', { class: 'sys-bar' },
      el('div', { class: 'flex', style: { justifyContent: 'space-between', marginBottom: '6px' } },
        el('b', { style: { fontSize: '12px' }, text: label }),
        el('span', { class: 'muted mono', style: { fontSize: '11px' },
          text: `${used.toFixed(1)} / ${total.toFixed(1)} ${unit} · ${pct}%` })),
      el('div', { class: 'bar big' }, el('div', { style: { width: pct + '%', background: colorVar ? `var(--${colorVar})` : undefined } }))
    );
  }

  function group(icon, title, rows) {
    const p = el('div', { class: 'panel anim-item sys-panel' });
    p.append(el('div', { class: 'panel-title', html: `${icon} ${title}` }));
    rows.forEach(([k, v, hint]) => {
      p.append(el('div', { class: 'stat-row' },
        el('span', { class: 'k', text: k }),
        el('span', { class: 'v sys-val', title: hint || '', html: v || '<span class="muted">—</span>' })));
    });
    return p;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function wmiPage(d) {
    const os = d.os || {};
    const cs = d.computer || {};
    const cpus = d.cpus || [];
    const gpus = d.gpus || [];
    const disks = d.disks || [];
    const ram = d.ram || {};
    const bios = d.bios || {};
    const sec = d.security || {};

    const totalRam = ram.totalGB || 0;
    const freeRam = ram.freeGB || 0;

    const frag = document.createDocumentFragment();
    frag.append(el('div', { class: 'page-head anim-item' },
      el('div', {},
        el('h1', { text: '🖥 О компьютере' }),
        el('p', { text: 'Данные собраны встроенным лаунчером через WMI (только чтение). Ничего не отправляется в сеть.' })),
      el('div', { class: 'ph-side' },
        el('button', { class: 'btn btn-sm', text: '🔄 Обновить', onclick: () => location.reload() }),
        el('button', { class: 'btn btn-sm btn-primary', text: '📋 Копировать отчёт', onclick: () => {
          const txt = JSON.stringify(d, null, 2);
          navigator.clipboard.writeText(txt).then(() => UI.toast('Отчёт скопирован', 'good'));
        } }))
    ));

    // большая карточка ОС
    const isWin11 = (os.buildNumber || 0) >= 22000;
    const osCard = el('div', { class: 'panel anim-item os-card' },
      el('div', { class: 'os-emblem' }, el('span', { text: isWin11 ? '🪟' : '💻' })),
      el('div', { class: 'grow' },
        el('div', { class: 'os-name', html: esc(os.caption || 'Windows') + (isWin11 ? ' <span class="os-tag">Windows 11-дизайн</span>' : '') }),
        el('div', { class: 'muted', style: { fontSize: '11.5px' },
          html: `Сборка <b>${esc(os.buildNumber)}</b> · версия ${esc(os.version || '?')} · ${esc(os.osArchitecture || '?')} · канал: ${esc(os.channel || 'розничный')}` }),
        el('div', { class: 'flex gap8', style: { marginTop: '10px', flexWrap: 'wrap' } },
          tag(sec.firewall ? '🛡 Брандмауэр активен' : '⚠ Брандмауэр выключен', sec.firewall ? 'good' : 'bad'),
          tag(sec.antivirus ? '✅ Антивирус: ' + sec.antivirus : '⚠ Антивирус не обнаружен', sec.antivirus ? 'good' : 'warn'),
          tag(os.serialMasked ? '🔑 Лицензия: ****-' + os.serialMasked : '', 'info'),
          tag(cs.partOfDomain ? '🌐 В домене: ' + cs.domain : '🏠 Рабочая группа: ' + (cs.workgroup || 'WORKGROUP'), 'info')
        )
      )
    );
    frag.append(osCard);

    // живые полосы
    const bars = el('div', { class: 'panel anim-item' },
      el('div', { class: 'panel-title', text: 'Загрузка' }),
      bar('Оперативная память', Math.max(0, totalRam - freeRam), totalRam, 'ГБ', 'accent'),
      el('div', { style: { height: '14px' } }),
      ...disks.filter((x) => x.sizeGB > 0).map((dk) => bar('Диск ' + dk.id + ' — ' + esc(dk.volumeName || 'локальный'), dk.sizeGB - dk.freeGB, dk.sizeGB, 'ГБ', 'violet'))
    );
    frag.append(bars);

    const grids = el('div', { class: 'grid grid-2' });
    grids.append(
      group('🧠', 'Процессор', [
        ['Модель', esc(cpus[0] ? cpus[0].name : '—')],
        ['Ядер / потоков', cpus.length ? `${cs.numberOfProcessors || cpus[0].cores} ядр. · ${cpus.reduce((a, c) => a + (c.logical || 1), 0)} поток.` : '—'],
        ['Базовая частота', cpus[0] ? `${(cpus[0].maxClock / 1000).toFixed(2)} ГГц` : '—'],
        ['Архитектура', esc(os.osArchitecture || '—')]
      ]),
      group('🎮', 'Видеокарта',
        (gpus.length ? gpus : [{ name: 'Не обнаружена', ram: 0, driver: '' }]).map((g) =>
          ['Видеоадаптер', esc(g.name), g.driver])) ,
      group('💾', 'Память', [
        ['Всего ОЗУ', totalRam ? totalRam.toFixed(1) + ' ГБ' : '—'],
        ['Свободно', freeRam ? freeRam.toFixed(1) + ' ГБ' : '—'],
        ['Модули', ram.modules && ram.modules.length ? ram.modules.map((m) => `${m.capGB} ГБ ${m.speedMT ? '@ ' + m.speedMT + ' МТ/с' : ''}`).join(', ') : '—', '']
      ]),
      group('💿', 'Накопители',
        disks.map((dk) => [`Диск ${dk.id}`, `${dk.sizeGB.toFixed(0)} ГБ · ${dk.fileSystem} · свободно ${dk.freeGB.toFixed(0)} ГБ`, dk.volumeName])),
      group('🏷', 'Система', [
        ['Имя ПК', esc(cs.model ? '' : cs.name) || esc(cs.name)],
        ['Пользователь', esc(d.user)],
        ['Производитель', esc((cs.manufacturer || '') + ' ' + (cs.model || ''))],
        ['Время на ПК', esc(os.localTime)],
        ['Часовой пояс', esc(os.timezone)]
      ]),
      group('🔧', 'BIOS и безопасность', [
        ['BIOS', esc((bios.manufacturer || '') + ' ' + (bios.smbiosVersion || bios.version || ''))],
        ['Версия / дата', esc((bios.version || '') + ' · ' + (bios.date || ''))],
        ['Secure Boot', sec.secureBoot == null ? '—' : sec.secureBoot ? 'Включён' : 'Выключен'],
        ['Брандмауэр', sec.firewall ? 'Активен' : 'Выключен'],
        ['Антивирус', esc(sec.antivirus || 'Стандартный Defender')],
        ['Сетевых адаптеров', (d.net || []).length + '']
      ])
    );
    frag.append(grids);

    // сеть
    const net = group('🌐', 'Сеть',
      (d.net || []).map((n) => [esc(n.desc || n.name || 'Адаптер'),
        (n.ip ? '<span class="mono">' + esc(n.ip) + '</span>' : 'без IP') + (n.mac ? ` <span class="muted mono">${esc(n.mac)}</span>` : ''),
        n.name]));
    frag.append(net);

    // движок
    const eng = group('⚡', 'Среда запуска ROIReaper', [
      ['Движок', esc(navigator.appVersion.match(/Chrome\/([\d.]+)/) ? 'Chromium ' + navigator.appVersion.match(/Chrome\/([\d.]+)/)[1] : navigator.appName)],
      ['Платформа браузера', esc(navigator.platform || '—')],
      ['Язык системы', esc(navigator.language)],
      ['Экран', `${screen.width}×${screen.height} · ${window.devicePixelRatio || 1}x DPR`],
      ['Онлайн', navigator.onLine ? 'Да' : 'Нет']
    ]);
    frag.append(eng);
    return frag;
  }

  function tag(text, kind) {
    if (!text) return el('span');
    return el('span', { class: 'os-tag tag-' + kind, text });
  }

  function fallbackPage() {
    const frag = document.createDocumentFragment();
    frag.append(el('div', { class: 'page-head anim-item' },
      el('div', {}, el('h1', { text: '🖥 О компьютере' }),
        el('p', { text: 'Сейчас приложение открыто в обычном браузере (режим предпросмотра), поэтому доступна только информация о среде. На Windows запусти ROIReaper через ярлык — лаунчер соберёт полный отчёт об ОС, железе и безопасности через WMI.' }))));
    const g = el('div', { class: 'grid grid-2' });
    g.append(
      group('⚡', 'Среда запуска', [
        ['Браузер', esc(navigator.userAgent.match(/(Edg|Chrome|Firefox)\/[\d.]+/)?.[0] || navigator.appName)],
        ['Движок', esc(navigator.appVersion)],
        ['Платформа', esc(navigator.platform)],
        ['Язык', esc(navigator.language)],
        ['Cookie/хранилище', navigator.cookieEnabled ? 'доступно' : 'ограничено'],
        ['Онлайн', navigator.onLine ? 'да' : 'нет']
      ]),
      group('🖥', 'Дисплей', [
        ['Разрешение', `${screen.width}×${screen.height}`],
        ['Доступная область', `${window.innerWidth}×${window.innerHeight}`],
        ['Масштаб (DPR)', String(window.devicePixelRatio)],
        ['Цветовая глубина', screen.colorDepth + ' бит'],
        ['Тема ОС', matchMedia('(prefers-color-scheme: dark)').matches ? 'тёмная' : 'светлая']
      ])
    );
    frag.append(g);
    frag.append(el('div', { class: 'panel anim-item' },
      el('div', { class: 'panel-title', text: 'Что покажет версия для Windows' }),
      ['Версия Windows (например Windows 11 Pro 23H2) и номер сборки',
       'Модель процессора, число ядер и потоков, частоту',
       'Объём и занятость ОЗУ, модули памяти',
       'Видеокарту, видеопамять и версию драйвера',
       'Диски, файловые системы и свободное место',
       'Имя ПК, пользователя, рабочую группу/домен',
       'BIOS/UEFI, Secure Boot, брандмауэр и антивирус',
       'Сетевые адаптеры, IP и MAC-адреса'].map((t) =>
        el('div', { class: 'check-row' }, el('span', { text: '✓' }), el('span', { text: t })))));
    return frag;
  }

  Pages['sysinfo'] = {
    mount(v) {
      v.replaceChildren();
      if (window.SYSINFO && window.SYSINFO.os) v.append(wmiPage(window.SYSINFO));
      else v.append(fallbackPage());
    }
  };
})();
