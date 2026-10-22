param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop';$s=[IO.File]::OpenRead($AssemblyPath);$p=[System.Reflection.PortableExecutable.PEReader]::new($s)
try {$m=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($p)
 $rows=foreach($th in $m.TypeDefinitions){$t=$m.GetTypeDefinition($th);$name=$m.GetString($t.Name);if($name -notin @('EFqs','wjkD','IjWz','obNM','s95L','J1Nt')){continue}
  foreach($mh in $t.GetMethods()){$method=$m.GetMethodDefinition($mh);$sig=[Convert]::ToHexString($m.GetBlobBytes($method.Signature));$mn=$m.GetString($method.Name)
   if($sig -match 'A240' -or $mn -in @('FI8B','PI8N','bI8J')){[pscustomobject]@{type=$m.GetString($t.Namespace)+'.'+$name;name=$mn;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=$sig;attributes=$method.Attributes.ToString()}}
  }
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='PEReader selected-type signature scan, no target load';records=@($rows)}|ConvertTo-Json -Depth 6
}finally{$p.Dispose();$s.Dispose()}
