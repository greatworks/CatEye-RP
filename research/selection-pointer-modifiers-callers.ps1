param([int[]]$Targets=@(100686115,100686116,100686118,100686119,100686244,100710378),[string[]]$Names=@('g3GS'),[string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# PEReader byte candidates only; selected methods must be verified by full decoding.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);$name=$md.GetString($m.Name)
  $calls=@()
  if($m.RelativeVirtualAddress -gt 0){
   $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
   $calls=@(for($i=0;$i -lt $il.Length-4;$i++){
    if($il[$i] -in @(0x28,0x6f,0x73,0x7b,0x7c,0x7d,0x74,0x75)){$token=[BitConverter]::ToInt32($il,$i+1);if($token -in $Targets){[pscustomobject]@{offset=$i;token=$token;candidateKind='one-byte opcode'}}}
    if($i -lt $il.Length-5 -and $il[$i] -eq 0xfe -and $il[$i+1] -in @(0x06,0x07)){$token=[BitConverter]::ToInt32($il,$i+2);if($token -in $Targets){[pscustomobject]@{offset=$i;token=$token;candidateKind='ldftn/ldvirtftn'}}}
   })
  }
  if($calls.Count -or $name -in $Names){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));calls=$calls}}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Byte candidates only; full opcode validation required';targets=$Targets;names=$Names;records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
