param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Read-only metadata discovery; does not load or execute the target assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $matches=foreach($h in $md.MethodDefinitions){
  $m=$md.GetMethodDefinition($h); $name=$md.GetString($m.Name)
  $t=$md.GetTypeDefinition($m.GetDeclaringType()); $typeName=$md.GetString($t.Name)
  $parentName=$null
  if(!$t.GetDeclaringType().IsNil){$parent=$md.GetTypeDefinition($t.GetDeclaringType());$parentName=$md.GetString($parent.Name)}
  if($name -match 'Json.*Style|Style.*Json|IxStyle|InteractionStyle' -or $typeName -eq 'wJe6' -or $parentName -eq 'wJe6') {
   [PSCustomObject]@{type=$typeName;parent=$parentName;namespace=$md.GetString($t.Namespace);method=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
  }
 }
 [PSCustomObject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static ECMA-335 metadata only';methods=@($matches)}|ConvertTo-Json -Depth 7
}finally{$pe.Dispose();$stream.Dispose()}
