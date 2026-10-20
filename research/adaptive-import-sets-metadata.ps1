param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $handle=[System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeDefinitionHandle(33558193 -band 0xffffff)
 $type=$md.GetTypeDefinition($handle)
 $fields=@(foreach($fh in $type.GetFields()){
  $f=$md.GetFieldDefinition($fh);$value=$null
  if(!$f.GetDefaultValue().IsNil){$constant=$md.GetConstant($f.GetDefaultValue());$value=[Convert]::ToHexString($md.GetBlobBytes($constant.Value))}
  [pscustomobject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);constant=$value}
 })
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static ECMA metadata only; exact TypeDef token from ft7h signature';type=$md.GetString($type.Namespace)+'.'+$md.GetString($type.Name);token=33558193;fields=$fields}|ConvertTo-Json -Depth 7
} finally {$pe.Dispose();$stream.Dispose()}
