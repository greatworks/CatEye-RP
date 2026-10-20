param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata only. Target DLL is read as a PE file, never loaded/executed.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  if($name -notmatch 'Boundary|IxSpecial|SpecialSelectable|SpecialWidgets|BinaryExpr|^IxAction$'){continue}
  $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);$v=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$v=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};[pscustomobject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature));constant=$v}})
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$a=$p.GetAccessors();[pscustomobject]@{name=$md.GetString($p.Name);signature=[Convert]::ToHexString($md.GetBlobBytes($p.Signature));getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}})
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);[pscustomobject]@{name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}})
  [pscustomobject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);fields=$fields;properties=$properties;methods=$methods}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only; type names MoveWidget|ResizeWidget|SizeWidget|SetWidgetSize|MoveBehavior|SizeBehavior|ResizeBehavior|MoveTrajectory|BoundaryCondition|AnimationEasing';records=@($records)}|ConvertTo-Json -Depth 10
}finally{$pe.Dispose();$stream.Dispose()}

