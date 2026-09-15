# ============================================================
#  ROIReaper — сбор безопасной системной информации (только чтение)
#  Используется локальным лаунчером; ничего никуда не отправляется.
# ============================================================

function Get-ROISystemInfo {
  $os   = Get-CimInstance Win32_OperatingSystem
  $cs   = Get-CimInstance Win32_ComputerSystem
  $bios = Get-CimInstance Win32_BIOS

  # --- Процессоры ---
  $cpus = @()
  foreach ($c in @(Get-CimInstance Win32_Processor)) {
    $cpus += [ordered]@{
      name    = "$($c.Name.Trim())"
      cores   = [int]$c.NumberOfCores
      logical = [int]$c.NumberOfLogicalProcessors
      maxClock = [int]$c.MaxClockSpeed
    }
  }

  # --- Видеокарты ---
  $gpus = @()
  foreach ($g in @(Get-CimInstance Win32_VideoController)) {
    $vramMB = $null
    if ($g.AdapterRAM) { $vramMB = [math]::Round($g.AdapterRAM / 1MB) }
    $gpus += [ordered]@{
      name   = "$($g.Name.Trim())"
      ramMB  = $vramMB
      driver = "$($g.DriverVersion)"
      resH   = [int]$g.CurrentHorizontalResolution
      resV   = [int]$g.CurrentVerticalResolution
    }
  }

  # --- Диски ---
  $disks = @()
  foreach ($d in @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3")) {
    $disks += [ordered]@{
      id         = "$($d.DeviceID)"
      sizeGB     = [math]::Round($d.Size / 1GB, 1)
      freeGB     = [math]::Round($d.FreeSpace / 1GB, 1)
      volumeName = "$($d.VolumeName)"
      fileSystem = "$($d.FileSystem)"
    }
  }

  # --- Память ---
  $modules = @()
  try {
    foreach ($m in @(Get-CimInstance Win32_PhysicalMemory)) {
      $modules += [ordered]@{
        capGB   = [math]::Round($m.Capacity / 1GB, 1)
        speedMT = [int]$m.SpeedMemory
        maker   = "$($m.Manufacturer)".Trim()
      }
    }
  } catch {}
  $ram = [ordered]@{
    totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    freeGB  = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
    modules = $modules
  }

  # --- Безопасность ---
  $firewall = $false
  try { $firewall = ((Get-NetFirewallProfile -ErrorAction Stop | Where-Object { $_.Enabled -eq $true } | Measure-Object).Count -gt 0) } catch {}
  $antivirus = $null
  try {
    $antivirus = (Get-CimInstance -Namespace "root/SecurityCenter2" -ClassName AntiVirusProduct -ErrorAction Stop |
      Select-Object -First 1 -ExpandProperty displayName)
  } catch {}
  $secureBoot = $null
  try { $secureBoot = [bool](Confirm-SecureBootUEFI -ErrorAction Stop) } catch { $secureBoot = $false }

  # --- Сеть ---
  $net = @()
  try {
    foreach ($n in @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=true")) {
      $ips = @()
      if ($n.IPAddress) { $ips = @($n.IPAddress | Where-Object { $_ -notlike "*:*" -or $_ -like "*.*" } | Select-Object -First 2) }
      $net += [ordered]@{
        name = "$($n.DNSHostName)"
        desc = "$($n.Description)"
        ip   = ($ips -join ", ")
        mac  = "$($n.MACAddress)"
      }
    }
  } catch {}

  # --- Даты ---
  $localTime = ""
  try { $localTime = ([Management.ManagementDateTimeConverter]::ToDateTime($os.LocalDateTime)).ToString("dd.MM.yyyy HH:mm") } catch {}
  $biosDate = ""
  try { if ($bios.ReleaseDate) { $biosDate = ([Management.ManagementDateTimeConverter]::ToDateTime($bios.ReleaseDate)).ToString("dd.MM.yyyy") } } catch {}

  $serialMasked = ""
  if ($os.SerialNumber) {
    $clean = "$($os.SerialNumber)".Trim()
    if ($clean.Length -gt 5) { $serialMasked = $clean.Substring($clean.Length - 5) }
  }

  [ordered]@{
    collectedAt = (Get-Date).ToString("o")
    user        = "$($cs.UserName)"
    os = [ordered]@{
      caption        = "$($os.Caption)".Trim()
      version        = "$($os.Version)"
      buildNumber    = [int]$os.BuildNumber
      osArchitecture = "$($os.OSArchitecture)"
      serialMasked   = $serialMasked
      localTime      = $localTime
      timezone       = "$((Get-TimeZone).Id)"
      installDate    = try { ([Management.ManagementDateTimeConverter]::ToDateTime($os.InstallDate)).ToString("dd.MM.yyyy") } catch { "" }
    }
    computer = [ordered]@{
      name                   = "$($cs.Name)"
      manufacturer           = "$($cs.Manufacturer)".Trim()
      model                  = "$($cs.Model)".Trim()
      numberOfProcessors     = [int]$cs.NumberOfProcessors
      numberOfLogicalProcessors = [int]$cs.NumberOfLogicalProcessors
      domain                 = "$($cs.Domain)"
      partOfDomain           = [bool]$cs.PartOfDomain
      workgroup              = if (-not $cs.PartOfDomain) { "$($cs.Domain)" } else { "" }
    }
    cpus     = $cpus
    gpus     = $gpus
    disks    = $disks
    ram      = $ram
    bios = [ordered]@{
      manufacturer   = "$($bios.Manufacturer)".Trim()
      smbiosVersion   = "$($bios.SMBIOSBIOSVersion)"
      version         = "$($bios.Version)"
      date            = $biosDate
    }
    security = [ordered]@{
      firewall  = [bool]$firewall
      antivirus = "$antivirus"
      secureBoot = $secureBoot
    }
    net = $net
  }
}
