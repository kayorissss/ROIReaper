@echo off
rem ============================================================
rem  ROIReaper - uninstaller (shortcuts + program folder)
rem ============================================================
set DST=%LOCALAPPDATA%\ROIReaper

echo Removing ROIReaper...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$wsh=New-Object -ComObject WScript.Shell;" ^
  "$d=[Environment]::GetFolderPath('Desktop');" ^
  "$sm=[Environment]::GetFolderPath('Programs');" ^
  "Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $d 'ROIReaper.lnk');" ^
  "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $sm 'ROIReaper');" ^
  "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ROIReaper'"

rem self-deleting script
set KILL=%TEMP%\roireaper-uninstall.cmd
> "%KILL%" echo @echo off
>> "%KILL%" echo timeout /t 1 /nobreak ^>nul
>> "%KILL%" echo rd /s /q "%DST%"
>> "%KILL%" echo del "%KILL%"
start "" /min cmd /c "%KILL%"
exit /b 0
