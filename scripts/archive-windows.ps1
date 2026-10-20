$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = (Resolve-Path -LiteralPath (Join-Path $taskRoot 'release')).Path
$version = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') { throw 'Unsafe package version for archive name' }
$bundlePath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot 'REA Prototype Studio-win32-x64'))
$pendingPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "REA-Prototype-Studio-$version-win64.pending.zip"))
$finalPath = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "REA-Prototype-Studio-$version-win64.zip"))
foreach ($candidatePath in @($bundlePath, $pendingPath, $finalPath)) {
  if (-not $candidatePath.StartsWith($releaseRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Archive target outside release directory: $candidatePath"
  }
}
Compress-Archive -LiteralPath $bundlePath -DestinationPath $pendingPath -CompressionLevel Optimal -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipArchive = [System.IO.Compression.ZipFile]::OpenRead($pendingPath)
try {
  $archiveEntries = $zipArchive.Entries.Count
  $checkedHashes = @{}
  foreach ($relativeFile in @('resources/app.asar', 'REA Prototype Studio.exe', 'THIRD_PARTY_NOTICES.txt')) {
    $expectedEntry = 'REA Prototype Studio-win32-x64/' + $relativeFile
    $matchedEntries = @($zipArchive.Entries | Where-Object { $_.FullName.Replace('\', '/') -eq $expectedEntry })
    if ($matchedEntries.Count -ne 1) { throw "Expected unique archive entry: $expectedEntry" }
    $entryStream = $matchedEntries[0].Open()
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    try { $entryHash = [System.BitConverter]::ToString($hasher.ComputeHash($entryStream)).Replace('-', '').ToLowerInvariant() }
    finally { $entryStream.Dispose(); $hasher.Dispose() }
    $diskHash = (Get-FileHash -LiteralPath (Join-Path $bundlePath $relativeFile) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($entryHash -ne $diskHash) { throw "ZIP content differs from tested bundle: $relativeFile" }
    $checkedHashes[$relativeFile] = $entryHash
  }
} finally { $zipArchive.Dispose() }
Move-Item -LiteralPath $pendingPath -Destination $finalPath -Force
$result = [ordered]@{
  verifiedAt = (Get-Date).ToString('o')
  archive = $finalPath
  bytes = (Get-Item -LiteralPath $finalPath).Length
  sha256 = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
  archiveEntries = $archiveEntries
  appAsarSha256 = $checkedHashes['resources/app.asar']
  executableSha256 = $checkedHashes['REA Prototype Studio.exe']
  thirdPartyNoticesSha256 = $checkedHashes['THIRD_PARTY_NOTICES.txt']
  archivedAsarMatchesTestedBundle = $true
  archivedExecutableMatchesTestedBundle = $true
  archivedThirdPartyNoticesMatchTestedBundle = $true
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskRoot '.build/archive-audit.json') -Encoding utf8
$result | ConvertTo-Json -Depth 6
