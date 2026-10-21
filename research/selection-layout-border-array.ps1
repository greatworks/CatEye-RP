param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static FieldRVA data only; no target assembly or methods loaded.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $token=67136911
 $field=$md.GetFieldDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::FieldDefinitionHandle($token -band 0xffffff))
 $rva=$field.GetRelativeVirtualAddress()
 [byte[]]$bytes=$pe.GetSectionData($rva).GetContent(0,80)
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();fieldToken=$token;rva=$rva;name=$md.GetString($field.Name);bytes=[Convert]::ToHexString($bytes);int32=@(for($i=0;$i -lt 80;$i+=4){[BitConverter]::ToInt32($bytes,$i)})}|ConvertTo-Json -Depth 4
} finally {$pe.Dispose();$stream.Dispose()}
