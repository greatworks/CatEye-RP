param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll',[int[]]$TypeTokens=@())
# Static PE metadata only. Never loads or invokes vendor assemblies.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $types=@(foreach($th in $md.TypeDefinitions){
    $t=$md.GetTypeDefinition($th);$name=$md.GetString($t.Namespace)+'.'+$md.GetString($t.Name)
    $token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$th)
    if($TypeTokens.Count -gt 0 -and $token -notin $TypeTokens){continue}
    $methods=@(foreach($mh in $t.GetMethods()){
      $m=$md.GetMethodDefinition($mh);$methodName=$md.GetString($m.Name)
      if($TypeTokens.Count -gt 0 -or $methodName -match 'NextPage|PreviousPage|NextTab|PreviousTab|ClosePage|CloseTab|ActiveTab|ActivePage|Accessed|RecentPage|PageHistory|TabHistory|TabOrder|OpenPages|OpenedPages|SelectTab|PageTab'){
        [pscustomobject]@{name=$methodName;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
      }
    })
    if($TypeTokens.Count -gt 0 -or $name -match 'TabManager|PageTab|AccessedPage|OpenPage|TabHistory' -or $methods.Count -gt 0){
      $parent=$t.GetDeclaringType()
      [pscustomobject]@{name=$name;token=$token;parentToken=if($parent.IsNil){$null}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$parent)};methods=$methods}
    }
  })
  [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='Static metadata name search, not runtime';types=$types}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
