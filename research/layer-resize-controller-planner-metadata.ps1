$dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll'
$source='research/layer-resize-capability-metadata.json'
$types=(Get-Content -LiteralPath $source -Raw | ConvertFrom-Json).records.token
$stream=[IO.File]::OpenRead($dll)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $records=foreach($h in $md.TypeDefinitions) {
    $token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)
    if($token -notin $types) {continue}
    $t=$md.GetTypeDefinition($h)
    $methods=@(foreach($mh in $t.GetMethods()) {
      $m=$md.GetMethodDefinition($mh);$name=$md.GetString($m.Name)
      if($name -notin @('YJ0S','uJ0j','xJ0B','get_UnroundedRect','get_Rect','get_SizingRect','uIuQ','get_Location','set_Location','get_Size','set_Size')) {continue}
      [pscustomobject]@{name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);attributes=$m.Attributes.ToString();signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
    })
    [pscustomobject]@{type=$md.GetString($t.Namespace)+'.'+$md.GetString($t.Name);token=$token;baseToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);methods=$methods}
  }
  [pscustomobject]@{assembly=$dll;sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static metadata only, no target code execution';typeInventorySource=@{file=$source;sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()};records=@($records)} | ConvertTo-Json -Depth 8
} finally {$pe.Dispose();$stream.Dispose()}
