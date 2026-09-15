/**
 * Генерация иконок из resources/icon-src.png:
 *  - resources/icon.ico (мультиразмер, Windows)
 *  - resources/icon.png (512)
 *  - src/renderer/assets/img/icon-*.png
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const src = path.join(root, 'resources', 'icon-src.png');

function convert(args) {
  try { execFileSync('magick', args, { stdio: 'inherit' }); }
  catch (e) { execFileSync('convert', args, { stdio: 'inherit' }); }
}
if (!fs.existsSync(src)) { console.error('Нет resources/icon-src.png'); process.exit(1); }

const sizes = [16, 24, 32, 48, 64, 128, 256];
const tmp = sizes.map((s) => path.join(root, 'resources', `tmp-${s}.png`));
sizes.forEach((s, i) => convert([src, '-resize', `${s}x${s}`, tmp[i]]));
convert([...tmp, path.join(root, 'resources', 'icon.ico')]);
convert([src, '-resize', '512x512', path.join(root, 'resources', 'icon.png')]);
tmp.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));

[32, 64, 128, 256].forEach((s) =>
  convert([src, '-resize', `${s}x${s}`, path.join(root, 'src/renderer/assets/img', `icon-${s}.png`)]));
convert([src, '-resize', '22x22', path.join(root, 'src/renderer/assets/img/icon-mini.png')]);
console.log('✓ иконки готовы');
