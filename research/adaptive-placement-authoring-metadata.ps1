param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static ECMA metadata only. Never loads or executes the target assembly.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $names='Placed|Unplaced|Limbo|Unlimbo|AllViews|Affect|ClearPlaced|DeleteFrom|CurrentInAndUnplaced'
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$pn=$md.GetString($p.Name);if($pn -match $names -or $name -in @('KJm7','EFqs','XcY','AjIh','BoolOverride')){$a=$p.GetAccessors();[pscustomobject]@{name=$pn;getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}}})
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);$mn=$md.GetString($m.Name);$mt=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);if($mn -match $names -or $mt -in $properties.getter -or $mt -in $properties.setter){[pscustomobject]@{name=$mn;token=$mt;signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}}})
  if($methods.Count -or $properties.Count -or $name -eq 'BoolOverride'){
   $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);$v=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$v=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};[pscustomobject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);constant=$v}})
   [pscustomobject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);fields=$fields;properties=$properties;methods=$methods}
  }
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only';records=@($records)}|ConvertTo-Json -Depth 8
} finally {$pe.Dispose();$stream.Dispose()}
