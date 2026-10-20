param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Candidate call-byte search only. Selected sites are verified using the full CIL decoder.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@(100717378,100717384,100717386,100717388,100717390,100717392,100717428,100695582,100695585)
 $records=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -in @(0x28,0x6f,0x73,0x7b,0x7c,0x7d,0x74,0x75)){$token=[BitConverter]::ToInt32($il,$i+1);if($token -in $targets){[pscustomobject]@{offset=$i;token=$token}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Call-byte candidates; not semantic proof until full opcode inspection';targets=$targets;records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}









