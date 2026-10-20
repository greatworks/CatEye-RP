param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $types=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h); $name=$md.GetString($t.Name)
  if($name -notin 'c5b1','FtXa','e5jG','ituB','WtTU'){continue}
  $base=$t.BaseType; $blob=$null; $baseName=$null
  if($base.Kind.ToString() -eq 'TypeSpecification'){$blob=[Convert]::ToHexString($md.GetBlobBytes($md.GetTypeSpecification([System.Reflection.Metadata.TypeSpecificationHandle]$base).Signature))}
  if($base.Kind.ToString() -eq 'TypeDefinition'){$v=$md.GetTypeDefinition([System.Reflection.Metadata.TypeDefinitionHandle]$base);$baseName=$md.GetString($v.Namespace)+'.'+$md.GetString($v.Name)}
  [PSCustomObject]@{name=$name;namespace=$md.GetString($t.Namespace);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);baseToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($base);baseName=$baseName;baseSignature=$blob}
 }
 $spec=foreach($token in 0x1B00048E){$h=[System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeSpecificationHandle($token-band0xffffff);[PSCustomObject]@{token=$token;signature=[Convert]::ToHexString($md.GetBlobBytes($md.GetTypeSpecification($h).Signature))}}
 [PSCustomObject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static metadata only';types=@($types);typeSpecifications=@($spec)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
