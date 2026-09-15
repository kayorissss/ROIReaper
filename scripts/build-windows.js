/**
 * ============================================================
 *  ROIReaper — сборка Windows-дистрибутивов
 *   • ROIReaper-1.0.1-Portable.zip — распаковал и запустил (флешка)
 *   • ROIReaper-Setup-1.0.1.exe    — установщик без UAC (ярлыки, удаление)
 *  Запуск: node scripts/build-windows.js
 * ============================================================
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const ver = pkg.version;
const dist = path.join(root, 'dist');
const stage = path.join(os.tmpdir(), 'roireaper-build-' + process.pid);
const portable = path.join(stage, 'ROIReaper');

const seven = require('7zip-bin').path7za;
try { fs.chmodSync(seven, 0o755); } catch (e) {}
const SFX = path.join(root, 'resources', 'sfx', '7zS.sfx');

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function cp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip && skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}
function run7z(args, cwd) {
  execFileSync(seven, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
}

console.log('• Готовим сцену сборки…');
rmrf(stage); fs.mkdirSync(portable, { recursive: true });
fs.mkdirSync(dist, { recursive: true });

// 1) приложение
copyDir(path.join(root, 'src', 'renderer'), path.join(portable, 'app'));
// 2) лаунчер и сопутствующее
for (const f of fs.readdirSync(path.join(root, 'windows'))) {
  fs.copyFileSync(path.join(root, 'windows', f), path.join(portable, f));
}
// PowerShell 5.1 читает .ps1 без BOM как ANSI — пересохраняем в UTF-8 BOM
function ensureBom(file) {
  const b = fs.readFileSync(file);
  if (!(b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF)) {
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), b]));
  }
}
function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, cb); else cb(p);
  }
}
// 3) иконка
fs.copyFileSync(path.join(root, 'resources', 'icon.ico'), path.join(portable, 'icon.ico'));
// версия сборки (читается установщиком для «Программ и компонентов»)
fs.writeFileSync(path.join(portable, 'version.txt'), ver + '\n', 'ascii');
// 4) документация
fs.copyFileSync(path.join(root, 'README.md'), path.join(portable, 'README.md'));
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(portable, 'LICENSE'));

// PFTT-маркер совместимости
fs.writeFileSync(path.join(portable, 'ROIReaper.exe.manifest'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges>
    <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
  </requestedPrivileges></security></trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application>
    <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
  </application></compatibility>
</assembly>`);

// BOM для всех PowerShell-скриптов
walk(portable, (p) => { if (p.endsWith('.ps1')) ensureBom(p); });

// ---- Портативный ZIP ----
console.log('• Пакуем портативную версию (ZIP)…');
const zipName = `ROIReaper-${ver}-Portable.zip`;
const zipOut = path.join(dist, zipName);
rmrf(zipOut);
run7z(['a', '-tzip', '-mx=7', '-r', '-y', zipOut, 'ROIReaper'], stage);

// ---- Установочный SFX ----
console.log('• Собираем установщик (7z SFX)…');
const setupStage = path.join(stage, 'setup');
rmrf(setupStage); fs.mkdirSync(setupStage, { recursive: true });
copyDir(portable, path.join(setupStage, 'ROIReaper'));
// установщик после распаковки запускает install.cmd
const archive = path.join(stage, 'setup.7z');
run7z(['a', '-t7z', '-mx=9', '-ms=off', '-r', '-y', archive, 'ROIReaper'], setupStage);

const config = `;!@Install@!UTF-8!
Title="ROIReaper — Жнец Роя ${ver}"
BeginPrompt="Установить ROIReaper на этот компьютер?\\nБудут созданы ярлыки на рабочем столе и в меню Пуск. Права администратора не требуются."
RunProgram="ROIReaper\\\\install.cmd"
GUIFlags="8+32+64"
;!@InstallEnd@!
`;
const cfgPath = path.join(stage, 'sfx.cfg');
fs.writeFileSync(cfgPath, Buffer.from('\ufeff' + config, 'utf16le')); // UTF-16 LE BOM, как требует SFX

const setupOut = path.join(dist, `ROIReaper-Setup-${ver}.exe`);
rmrf(setupOut);
const sfx = fs.readFileSync(SFX);
const cfg = fs.readFileSync(cfgPath);
const arc = fs.readFileSync(archive);
fs.writeFileSync(setupOut, Buffer.concat([sfx, cfg, arc]));
// сигнатура PE уже есть в SFX

// ---- отчёт ----
function sizeMB(p) { return (fs.statSync(p).size / 1048576).toFixed(2); }
console.log('\n✓ Сборка завершена:');
console.log('  ' + zipOut + '  (' + sizeMB(zipOut) + ' МБ)');
console.log('  ' + setupOut + '  (' + sizeMB(setupOut) + ' МБ)');
rmrf(stage);
