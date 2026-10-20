param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Read-only metadata name search; no target assembly load or execution.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $matches=foreach($th in $md.TypeDefinitions){$t=$md.GetTypeDefinition($th);$name=$md.GetString($t.Namespace)+'.'+$md.GetString($t.Name)
  foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);$mn=$md.GetString($m.Name)
   if($mn -notmatch '(Edit.*Point|Point.*Edit|Convert.*(Vector|Shape|Path)|To.*Bezier|Vector.*Edit|Begin.*Vector|End.*Vector|BreakVector|Flatten)'){continue}
   [pscustomobject]@{type=$name;typeToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$th);name=$mn;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
  }
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static focused metadata name search';matches=@($matches)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
