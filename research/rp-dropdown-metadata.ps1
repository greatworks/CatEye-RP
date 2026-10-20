param([string]$AssemblyPath = 'C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata and raw call-byte candidates; never load/execute target code.
$ErrorActionPreference = 'Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@{}
 foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);$t=$md.GetTypeDefinition($m.GetDeclaringType());$name=$md.GetString($m.Name);$type=$md.GetString($t.Name)
  if(($type -eq 'ListObject' -and $name -in @('get_Options','get_Multiple','get_SelectedObjects')) -or ($type -eq 'Wtfr' -and $name -in @('Ptfb','TtfS','ltft'))){
   $targets[[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)]=$md.GetString($t.Namespace)+'.'+$type+'::'+$name
  }
 }
 $matches=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -eq 0x28 -or $il[$i] -eq 0x6f){$token=[BitConverter]::ToInt32($il,$i+1);if($targets.ContainsKey($token)){[PSCustomObject]@{offset=$i;token=$token;target=$targets[$token]}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[PSCustomObject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 [PSCustomObject]@{targetSha256=$hash;method='Static candidate call-byte scan; named conclusions require full opcode decoding';targets=@($targets.GetEnumerator()|ForEach-Object{[PSCustomObject]@{token=$_.Key;name=$_.Value}});calls=@($matches)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
