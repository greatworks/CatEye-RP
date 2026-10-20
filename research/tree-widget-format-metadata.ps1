param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static ECMA-335 inventory only. Does not load or execute the target assembly.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  if($name -notmatch 'TreeNodeObject|TreeNode|Tree.*Icon|Tree.*Expand'){continue}
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);[PSCustomObject]@{name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}})
  $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);$value=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$value=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};[PSCustomObject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature));constant=$value}})
  [PSCustomObject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);extends=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);fields=$fields;methods=$methods}
 }
 [PSCustomObject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only, Tree-widget named type filter';records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}



