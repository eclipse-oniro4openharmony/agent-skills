[CmdletBinding()]
param(
  [string]$PackageName,
  [Alias('Pid')]
  [string]$ProcessId,
  [string]$Device,
  [string]$Tag,
  [string]$Level,
  [int]$DurationSeconds = 600,
  [string]$OutputDirectory = '.\incident-bundles',
  [switch]$Redact
)

$ErrorActionPreference = 'Stop'
$collectorVersion = '0.3.0'
$started = [DateTime]::UtcNow
$stamp = $started.ToString('yyyyMMdd-HHmmss')
if (-not (Test-Path $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}
$bundle = Join-Path (Resolve-Path $OutputDirectory) "incident-$stamp"
New-Item -ItemType Directory -Path $bundle, (Join-Path $bundle 'logs'), (Join-Path $bundle 'device') | Out-Null
$records = [System.Collections.Generic.List[object]]::new()
$archivePath = $null
$archiveStatus = 'pending'
$redactionStatus = if ($Redact) { 'requested' } else { 'not-requested' }

function Test-CollectorOutputFailure {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 'output file was not created' }
  $content = Get-Content -Raw -LiteralPath $Path -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($content)) { return $null }
  $patterns = @(
    '(?im)^\s*(?:ls|cat|cp|find|stat):.*permission denied\s*$',
    '(?im)too many arguments', '(?im)unknown option', '(?im)invalid option',
    '(?im)command not found', '(?im)^\s*(error|failed|failure)\b'
  )
  foreach ($pattern in $patterns) {
    $match = [regex]::Match($content, $pattern)
    if ($match.Success) { return $match.Value.Trim() }
  }
  return $null
}

function Invoke-CollectorCommand {
  param([string]$Name, [string[]]$Arguments, [string]$OutputFile, [string]$Executable = 'hdc', [bool]$InspectOutput = $true)
  $target = Join-Path $bundle $OutputFile
  $stderrFile = "$OutputFile.stderr.txt"
  $stderrTarget = Join-Path $bundle $stderrFile
  $record = [ordered]@{ name = $Name; command = ($Executable + ' ' + ($Arguments -join ' ')); status = 'failed'; output = $OutputFile; stderr = $stderrFile; exitCode = $null; error = $null }
  try {
    & $Executable @Arguments 1> $target 2> $stderrTarget
    $record.exitCode = $LASTEXITCODE
    $contentError = if ($InspectOutput) { Test-CollectorOutputFailure $target } else { $null }
    $stderrError = if ($InspectOutput) { Test-CollectorOutputFailure $stderrTarget } else { $null }
    if (($LASTEXITCODE -eq 0) -and -not $contentError -and -not $stderrError) {
      $record.status = 'success'
    } else {
      if ($LASTEXITCODE -ne 0) { $record.error = "$Executable exited with code $LASTEXITCODE" }
      elseif ($contentError) { $record.error = "collector output indicates failure: $contentError" }
      elseif ($stderrError) { $record.error = "collector stderr indicates failure: $stderrError" }
    }
  } catch { $record.error = $_.Exception.Message }
  if ((Test-Path -LiteralPath $stderrTarget) -and ((Get-Item -LiteralPath $stderrTarget).Length -eq 0)) {
    Remove-Item -LiteralPath $stderrTarget -Force
    $record.stderr = $null
  }
  $records.Add([pscustomobject]$record) | Out-Null
  return [pscustomobject]$record
}

if (-not (Get-Command hdc -ErrorAction SilentlyContinue)) {
  throw 'hdc was not found on PATH. Install or configure the HarmonyOS device toolchain first.'
}
Invoke-CollectorCommand 'list-targets' @('list', 'targets') 'device/targets.txt'
$shellPrefix = @('shell')
if ($Device) { $shellPrefix = @('-t', $Device, 'shell') }
$deviceArgs = @('shell', 'param', 'get', 'const.product.name')
if ($Device) { $deviceArgs = @('-t', $Device, 'shell', 'param', 'get', 'const.product.name') }
Invoke-CollectorCommand 'device-name' $deviceArgs 'device/device-info.txt'
Invoke-CollectorCommand 'process-list' ($shellPrefix + @('ps', '-ef')) 'device/process-list.txt'
Invoke-CollectorCommand 'memory' ($shellPrefix + @('hidumper', '--mem')) 'device/memory.txt'
Invoke-CollectorCommand 'threads' ($shellPrefix + @('hidumper', '-p')) 'device/threads.txt'
Invoke-CollectorCommand 'hidumper' ($shellPrefix + @('hidumper', '-s', 'AbilityManagerService')) 'device/hidumper.txt'
$logArgs = $shellPrefix + @('hilog', '-x')
$hilogRecord = Invoke-CollectorCommand 'hilog-snapshot' $logArgs 'logs/hilog.txt'
if ($hilogRecord.status -ne 'success' -and (Get-Command devecocli -ErrorAction SilentlyContinue)) {
  $fallbackArgs = @('log', '--from', "${DurationSeconds}s", '--tail', '1000')
  if ($PackageName) { $fallbackArgs = @('log', '--bundle-name', $PackageName, '--from', "${DurationSeconds}s", '--tail', '1000') }
  Invoke-CollectorCommand 'hilog-devecocli-fallback' $fallbackArgs 'logs/hilog-fallback.txt' 'devecocli' $false
}
$faultArgs = $shellPrefix + @('hidumper', '-e', '--list', '-n', '20')
if ($PackageName) { $faultArgs = $shellPrefix + @('hidumper', '-e', '--print', $PackageName, '-n', '5') }
Invoke-CollectorCommand 'faultlog' $faultArgs 'logs/faultlog.txt' 'hdc' $false
if (Get-Command devecocli -ErrorAction SilentlyContinue) {
  $crashArgs = @('log', '--crash')
  if ($PackageName) { $crashArgs += @('--bundle-name', $PackageName) }
  if ($Device) { $crashArgs += @('--device', $Device) }
  Invoke-CollectorCommand 'devecocli-crash-log' $crashArgs 'logs/crashlog.txt' 'devecocli' $false
} else {
  $records.Add([pscustomobject]@{ name = 'devecocli-crash-log'; command = 'devecocli log --crash'; status = 'unavailable'; output = $null; stderr = $null; exitCode = $null; error = 'devecocli was not found on PATH' }) | Out-Null
}
if ($Tag -or $Level) {
  $hilogPath = Join-Path $bundle 'logs/hilog.txt'
  if (Test-Path $hilogPath) {
    $filtered = Get-Content $hilogPath | Where-Object {
      ((-not $Tag) -or ($_ -match [regex]::Escape($Tag))) -and ((-not $Level) -or ($_ -match [regex]::Escape($Level)))
    }
    Set-Content -Encoding UTF8 $hilogPath $filtered
  }
}

$ended = [DateTime]::UtcNow
$manifest = [ordered]@{
  schemaVersion = '1.0'; collectorVersion = $collectorVersion
  collectionStartUtc = $started.ToString('o'); collectionEndUtc = $ended.ToString('o')
  host = [ordered]@{ os = 'Windows'; powershell = $PSVersionTable.PSVersion.ToString() }
  target = $Device; packageName = $PackageName; pid = $ProcessId
  filters = [ordered]@{ tag = $Tag; level = $Level; durationSeconds = $DurationSeconds }
  redactionRequested = [bool]$Redact; redactionStatus = $redactionStatus
  archiveStatus = [ordered]@{ status = $archiveStatus; path = $archivePath }
  commands = $records
  notes = @('The collector is read-only on the target device.', 'Command availability varies by device image and privilege level.')
}
$manifestPath = Join-Path $bundle 'manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath
Set-Content -Encoding UTF8 (Join-Path $bundle 'notes.txt') "Add reproduction steps and precise event timestamps here.`r`n"
$archiveSource = $bundle
if ($Redact) {
  $redacted = "$bundle-redacted"
  $redactor = Join-Path $PSScriptRoot 'redact_logs.py'
  & python $redactor --input $bundle --output $redacted
  if ($LASTEXITCODE -ne 0) { throw "redactor exited with code $LASTEXITCODE" }
  $redactionStatus = 'success'
  $archiveSource = $redacted
}
$archivePath = "$archiveSource.zip"
Compress-Archive -Path (Join-Path $archiveSource '*') -DestinationPath $archivePath -Force
$manifest.redactionStatus = $redactionStatus
$manifest.archiveStatus = [ordered]@{ status = 'success'; path = [IO.Path]::GetFileName($archivePath) }
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath
if ($Redact) {
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $redacted 'manifest.json')
  Compress-Archive -Path (Join-Path $redacted '*') -DestinationPath $archivePath -Force
}
Write-Output $bundle
