$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$packagePath = Join-Path $projectRoot 'docs/.tools/libreoffice.msi'
$targetPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'docs/.tools/libreoffice'))
if (-not $targetPath.StartsWith(($projectRoot + [System.IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Converter extraction must stay inside the workspace.' }
$actualHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne 'c6298b10cfa1748bcbedad94c62ce771e240e5021bfd6d7a967cd571b04b5312') { throw 'Downloaded converter hash does not match its official published SHA-256.' }
Write-Output 'Official converter checksum verified.'
$logPath = Join-Path $projectRoot 'docs/.tools/converter-extraction.log'
$extractProcess = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/a',('"' + $packagePath + '"'),'/qn',('TARGETDIR="' + $targetPath + '"'),'/L*v',('"' + $logPath + '"')) -WindowStyle Hidden -PassThru
$extractProcess.WaitForExit()
if ($extractProcess.ExitCode -ne 0) { throw ('Administrative file extraction failed: ' + $extractProcess.ExitCode) }
Write-Output 'Converter files extracted into ignored workspace tooling directory; no normal installation requested.'
Get-ChildItem -LiteralPath $targetPath -Filter soffice.exe -Recurse | Select-Object FullName
