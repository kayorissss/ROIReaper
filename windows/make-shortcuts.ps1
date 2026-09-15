# ============================================================
#  ROIReaper — создание ярлыков (рабочий стол, меню Пуск)
# ============================================================
$dst = Split-Path -Parent $MyInvocation.MyCommand.Definition
$wsh = New-Object -ComObject WScript.Shell

$appVer = "1.0.0"
$verFile = Join-Path $dst "version.txt"
if (Test-Path $verFile) { $appVer = (Get-Content $verFile -TotalCount 1).Trim() }

$desktop   = [Environment]::GetFolderPath("Desktop")
$startMenu = [Environment]::GetFolderPath("Programs")
$rrMenu    = Join-Path $startMenu "ROIReaper"
New-Item -ItemType Directory -Force -Path $rrMenu | Out-Null

$icon = Join-Path $dst "icon.ico"
if (-not (Test-Path $icon)) { $icon = Join-Path $dst "app\assets\img\icon-mini.png" }

function New-Lnk([string]$path, [string]$target, [string]$args, [string]$workDir, [string]$ico) {
  $lnk = $wsh.CreateShortcut($path)
  $lnk.TargetPath = $target
  $lnk.Arguments = $args
  $lnk.WorkingDirectory = $workDir
  if ($ico) { $lnk.IconLocation = "$ico,0" }
  $lnk.Description = "ROIReaper — Жнец Роя"
  $lnk.Save()
}

$vbs = Join-Path $dst "start.vbs"
$wscript = Join-Path $env:WINDIR "System32\wscript.exe"

# запуск через wscript (скрытая консоль), своя иконка
New-Lnk (Join-Path $desktop "ROIReaper.lnk")   $wscript "`"$vbs`"" $dst $icon
New-Lnk (Join-Path $rrMenu "ROIReaper.lnk")    $wscript "`"$vbs`"" $dst $icon
New-Lnk (Join-Path $rrMenu "Папка программы.lnk") $env:WINDIR\explorer.exe "`"$dst`"" $dst $icon

# удаление
$unLnk = Join-Path $rrMenu "Удалить ROIReaper.lnk"
$unCmd = Join-Path $dst "uninstall.cmd"
New-Lnk $unLnk $env:WINDIR\System32\cmd.exe "/c `"`"$unCmd`"`"" $dst $icon

# ярлык в списке установленных программ (для поиска в Пуске и «Программ и компонентов»)
$uninstKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ROIReaper"
New-Item -Path $uninstKey -Force | Out-Null
Set-ItemProperty $uninstKey -Name DisplayName     -Value "ROIReaper — Жнец Роя"
Set-ItemProperty $uninstKey -Name DisplayIcon     -Value "$icon,0"
Set-ItemProperty $uninstKey -Name DisplayVersion  -Value $appVer
Set-ItemProperty $uninstKey -Name Publisher       -Value "kayorissss"
Set-ItemProperty $uninstKey -Name InstallLocation -Value $dst
Set-ItemProperty $uninstKey -Name UninstallString -Value "cmd /c `"$unCmd`""
Set-ItemProperty $uninstKey -Name NoModify -Value 1 -Type DWord
Set-ItemProperty $uninstKey -Name NoRepair -Value 1 -Type DWord
