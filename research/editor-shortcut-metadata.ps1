param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll',[int[]]$TypeTokens=@())
# Read PE/CLI metadata only. Never loads or executes a vendor assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $types=@(foreach($th in $md.TypeDefinitions){
    $t=$md.GetTypeDefinition($th);$name=$md.GetString($t.Namespace)+'.'+$md.GetString($t.Name)
    $methods=@(foreach($mh in $t.GetMethods()){
      $m=$md.GetMethodDefinition($mh);$methodName=$md.GetString($m.Name)
      if($TypeTokens.Count -gt 0 -or $methodName -match 'Shortcut|KeyCommand|PasteStyle|GenerateHtml|PreviewOptions|AlignCenter|ConvertToDynamicPanel|GenerateHTML|Copy|Paste|Duplicate'){
        [pscustomobject]@{name=$methodName;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
      }
    })
    $token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$th)
    if(($TypeTokens.Count -eq 0 -and ($name -match 'Shortcut|KeyCommand|KeyBinding|HotKey' -or $methods.Count -gt 0)) -or $token -in $TypeTokens){
      $parent=$t.GetDeclaringType()
      [pscustomobject]@{name=$name;token=$token;parentToken=if($parent.IsNil){$null}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$parent)};methods=$methods}
    }
  })
  [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='Static metadata name search, not runtime or proof of binding';types=$types}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
