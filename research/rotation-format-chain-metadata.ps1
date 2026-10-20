param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){$t=$md.GetTypeDefinition($h);if($md.GetString($t.Name) -notin @('jtoq','WtTU','e5jG')){continue}
  $properties=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$a=$p.GetAccessors();[pscustomobject]@{name=$md.GetString($p.Name);getter=if(!$a.Getter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}else{$null};setter=if(!$a.Setter.IsNil){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}else{$null}}})
  [pscustomobject]@{type=$md.GetString($t.Namespace)+'.'+$md.GetString($t.Name);baseToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);baseSignature=if($t.BaseType.Kind.ToString() -eq 'TypeSpecification'){[Convert]::ToHexString($md.GetBlobBytes($md.GetTypeSpecification([System.Reflection.Metadata.TypeSpecificationHandle]$t.BaseType).Signature))}else{$null};properties=$properties}
 }
 [pscustomobject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
