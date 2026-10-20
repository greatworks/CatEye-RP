param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static ECMA metadata only; never loads or executes the original assembly.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$pn=$md.GetString($p.Name);if($name -match 'Friendly|BorderVisibility|ShapeType' -or $pn -match 'Friendly|BorderVisibility|ShapeType'){$a=$p.GetAccessors();[pscustomobject]@{name=$pn;signature=[Convert]::ToHexString($md.GetBlobBytes($p.Signature));getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}}})
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);$mn=$md.GetString($m.Name);$mt=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);if($name -match 'Friendly|BorderVisibility|ShapeType' -or $name -match 'Friendly|BorderVisibility|ShapeType' -or $mn -match 'Friendly|BorderVisibility|ShapeType' -or $mt -in $properties.getter -or $mt -in $properties.setter){
   [PSCustomObject]@{name=$mn;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
  }})
  if($name -match 'Friendly|BorderVisibility|ShapeType' -or $methods.Count -or $properties.Count){
   $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);$v=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$v=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};[PSCustomObject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature));constant=$v}})
   [PSCustomObject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);fields=$fields;properties=$properties;methods=$methods}
  }
 }
 [PSCustomObject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only';records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}





