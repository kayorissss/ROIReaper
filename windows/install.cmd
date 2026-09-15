@echo off
rem ============================================================
rem  ROIReaper — установка в профиль пользователя (без UAC)
rem  Вызывается установочным SFX-пакетом из временной папки.
rem ============================================================
setlocal
set DST=%LOCALAPPDATA%\ROIReaper

echo Installing ROIReaper to %DST% ...
xcopy "%~dp0*" "%DST%\" /E /I /Y /Q >nul

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%DST%\make-shortcuts.ps1"

start "" wscript.exe "%DST%\start.vbs"
exit /b 0
