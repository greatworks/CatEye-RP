param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata only; no Assembly.Load or vendor method invocation.
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $records=@(foreach($th in $md.TypeDefinitions) {
    $t=$md.GetTypeDefinition($th)
    if($md.GetString($t.Name) -notin @('KJm7','jtoq','m5k3','N95X')) { continue }
    foreach($ph in $t.GetProperties()) {
      $p=$md.GetPropertyDefinition($ph);$a=$p.GetAccessors()
      $getter=if($a.Getter.IsNil){0}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)}
      $setter=if($a.Setter.IsNil){0}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}
      if($getter -in @(100695304,100695308,100717782,100719347,100719349) -or $setter -in @(100695305,100695309)) {
        [pscustomobject]@{type=$md.GetString($t.Name);property=$md.GetString($p.Name);getter=$getter;setter=$setter}
      }
    }
  })
  [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='static PE property accessors';records=$records}|ConvertTo-Json -Depth 6
} finally {$pe.Dispose();$stream.Dispose()}
