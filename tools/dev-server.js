/* Простой статик-сервер для предпросмотра в обычном браузере.
   Запуск: npm start  ->  http://localhost:8848/index.html
   В этом режиме страница "О компьютере" показывает данные браузера;
   полный WMI-отчёт доступен только в Windows-сборке через лаунчер. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'renderer');
const PORT = process.env.PORT || 8848;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/sysinfo.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end('window.SYSINFO=null;'); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log('ROIReaper dev: http://localhost:' + PORT + '/index.html');
});
