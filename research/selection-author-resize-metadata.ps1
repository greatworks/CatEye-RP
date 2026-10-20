$dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll'
$stream=[IO.File]::OpenRead($dll)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $records=foreach($h in $md.TypeDefinitions) {
    $t=$md.GetTypeDefinition($h); $name=$md.GetString($t.Name)
    if($name -notin @('SelectionButton','Checkbox','RadioButton','TextRectObject','RichTextObject')) {continue}
    $methods=@(foreach($mh in $t.GetMethods()) {
      $m=$md.GetMethodDefinition($mh)
      [pscustomobject]@{name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);attributes=$m.Attributes.ToString();signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
    })
    [pscustomobject]@{type=$md.GetString($t.Namespace)+'.'+$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);baseToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);methods=$methods}
  }
  [pscustomobject]@{assembly=$dll;sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static metadata only; no target execution';records=@($records)} | ConvertTo-Json -Depth 8
} finally {$pe.Dispose();$stream.Dispose()}
