param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Read ECMA-335 metadata only. Never load or execute the target assembly.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $names=@('bVk8','FtXa','c5b1','VectorShape','RichTextPanel','RichTextObject','TextRectObject','TextPanel','AxRun','WtTU','ttf7','xrgg','mj1k')
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  $parent=$null;if(!$t.GetDeclaringType().IsNil){$parent=$md.GetString($md.GetTypeDefinition($t.GetDeclaringType()).Name)}
  if($name -notin $names -and $parent -ne 'bVk8'){continue}
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$a=$p.GetAccessors();[pscustomobject]@{name=$md.GetString($p.Name);getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}})
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);[pscustomobject]@{name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}})
  $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);[pscustomobject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature))}})
  [pscustomobject]@{type=$ns+'.'+$name;name=$name;parent=$parent;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);fields=$fields;properties=$properties;methods=$methods}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only; selected type names, not assembly execution';records=@($records)}|ConvertTo-Json -Depth 8
} finally {$pe.Dispose();$stream.Dispose()}

