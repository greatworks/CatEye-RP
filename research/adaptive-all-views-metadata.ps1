param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Read ECMA metadata only. Does not load or execute the target DLL.
$ErrorActionPreference='Stop'
$hash=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'){throw 'Unexpected assembly'}
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  if($name -notin @('KJm7','ituB','WtTU','e5jG','O5FO','XcY','EFqs','ttf7')){continue}
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$a=$p.GetAccessors();[pscustomobject]@{name=$md.GetString($p.Name);signature=[Convert]::ToHexString($md.GetBlobBytes($p.Signature));getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}})
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);$mn=$md.GetString($m.Name);[pscustomobject]@{name=$mn;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));parameters=@(foreach($pa in $m.GetParameters()){$p=$md.GetParameter($pa);[pscustomobject]@{sequence=$p.SequenceNumber;name=$md.GetString($p.Name)}})}})
  [pscustomobject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);properties=$properties;methods=$methods}
 }
 $specs=foreach($token in @(0x1B000CC4,0x1B000CC5,0x1B000328)){$h=[System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeSpecificationHandle($token -band 0xffffff);$s=$md.GetTypeSpecification($h);[pscustomobject]@{token=$token;signature=[Convert]::ToHexString($md.GetBlobBytes($s.Signature))}}
 [pscustomobject]@{assembly=$AssemblyPath;sha256=$hash;method='Static metadata only';records=@($records);typeSpecifications=@($specs)}|ConvertTo-Json -Depth 10
} finally {$pe.Dispose();$stream.Dispose()}
