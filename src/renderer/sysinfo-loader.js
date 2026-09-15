/* Подхватывает window.SYSINFO от локального лаунчера (http://localhost:PORT/sysinfo.js).
   В обычном браузере/с флешки через файл — тихо остаётся null, страница покажет браузерный режим. */
(function () {
  try {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      var x = new XMLHttpRequest();
      x.open('GET', '/sysinfo.js', false); // синхронно, до старта заставки
      x.timeout = 4000;
      x.send();
      if (x.status === 200) { new Function(x.responseText)(); }
    }
  } catch (e) { window.SYSINFO = null; }
})();
