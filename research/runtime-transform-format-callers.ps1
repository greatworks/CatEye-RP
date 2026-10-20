param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Candidate call-byte search only. Selected sites are verified using the full CIL decoder.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@(100704634,100704642,100704644,100704646,100704648,100704651,100704655,100704657,100705580,100705586,100705589,100705592,100705594,100705596,100694546,100694569,100694547,100694570,100694361,100694367,100694363,100694360,100694362,100694366)
 $records=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -in @(0x28,0x6f,0x73,0x7b,0x7d)){$token=[BitConverter]::ToInt32($il,$i+1);if($token -in $targets){[pscustomobject]@{offset=$i;token=$token}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Call-byte candidates; not semantic proof until full opcode inspection';targets=$targets;records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}





