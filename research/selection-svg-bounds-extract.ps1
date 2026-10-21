param([Parameter(Mandatory=$true)][string]$TypeName,[Parameter(Mandatory=$true)][string[]]$MethodNames,[Parameter(Mandatory=$true)][string]$Suffix)
$ErrorActionPreference='Stop'
if($Suffix -notmatch '^[a-z0-9-]+$'){throw 'Unsafe suffix'}
$selectionSvgDll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll'
$selectionSvgExpected='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'
if((Get-FileHash -LiteralPath $selectionSvgDll -Algorithm SHA256).Hash.ToLowerInvariant() -ne $selectionSvgExpected){throw 'Unexpected DLL identity'}
$selectionSvgCil=& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $selectionSvgDll -TypeName $TypeName -MethodNames $MethodNames
$selectionSvgPath=Join-Path (Get-Location) "research/selection-svg-bounds-$Suffix-cil.json"
$selectionSvgStream=[IO.File]::Open($selectionSvgPath,[IO.FileMode]::CreateNew)
try{$selectionSvgBytes=[Text.UTF8Encoding]::new($false).GetBytes(($selectionSvgCil -join [Environment]::NewLine)+[Environment]::NewLine);$selectionSvgStream.Write($selectionSvgBytes)}finally{$selectionSvgStream.Dispose()}
