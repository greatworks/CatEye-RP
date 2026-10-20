param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Narrow candidate token search. Matches must be verified against decoded CIL.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@(100695335,100717691,100717752,100718041)
 $records=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -in @(0x28,0x6f,0x73)){$token=[BitConverter]::ToInt32($il,$i+1);if($token -in $targets){[pscustomobject]@{offset=$i;token=$token}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 $handle=[System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeDefinitionHandle(2196)
 $enum=$md.GetTypeDefinition($handle)
 $fields=@(foreach($h in $enum.GetFields()){$f=$md.GetFieldDefinition($h);$value=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$value=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);value=$value}})
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath).Hash.ToLowerInvariant();method='Static ECMA-335 only; opcode-byte candidates require full CIL verification';targets=$targets;records=@($records);valueType=@{name=$md.GetString($enum.Name);namespace=$md.GetString($enum.Namespace);token=33556628;fields=$fields}} | ConvertTo-Json -Depth 9
} finally {$pe.Dispose();$stream.Dispose()}
