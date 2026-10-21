$dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll'
$stream=[IO.File]::OpenRead($dll);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $tokens=@(100702374,100688766,100688769,100677936,100677937)
 $records=foreach($h in $md.MethodDefinitions) {
  $token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)
  if($token -notin $tokens){continue}
  $m=$md.GetMethodDefinition($h);$body=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress)
  [pscustomobject]@{token=$token;name=$md.GetString($m.Name);initLocals=$body.LocalVariablesInitialized;
   localSignatureToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$body.LocalSignature);
   exceptions=@($body.ExceptionRegions|ForEach-Object{[pscustomobject]@{kind=$_.Kind.ToString();tryOffset=$_.TryOffset;tryLength=$_.TryLength;handlerOffset=$_.HandlerOffset;handlerLength=$_.HandlerLength}})}
 }
 [pscustomobject]@{assembly=$dll;sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static PE metadata only';records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
