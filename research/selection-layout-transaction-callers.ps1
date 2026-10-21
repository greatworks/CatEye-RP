param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static candidate byte references, validated against selected complete CIL later.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@(67126835,67126836,100702374,100702375)
 $records=foreach($h in $md.MethodDefinitions) {
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++) {
   if($il[$i] -in @(0x28,0x6f,0x73,0x7b,0x7c,0x7d)) {
    $token=[BitConverter]::ToInt32($il,$i+1)
    if($token -in $targets){[pscustomobject]@{offset=$i;token=$token;opcode=$il[$i]}}
   }
  })
  if($calls.Count) {
   $t=$md.GetTypeDefinition($m.GetDeclaringType())
   [pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);
    token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}
  }
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();
  method='Candidate byte references only; complete selected CIL validates instruction sites';targets=$targets;records=@($records)}|ConvertTo-Json -Depth 10
}finally{$pe.Dispose();$stream.Dispose()}
