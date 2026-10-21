param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata and candidate references; never loads the target assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $names=@('SelectionButton','Checkbox','RadioButton','TextRectObject','RichTextObject','PlainTextObject','KJm7','j5u5','U13T','s5ZY')
 $types=@(foreach($h in $md.TypeDefinitions) {
  $t=$md.GetTypeDefinition($h);if(($md.GetString($t.Name) -notin $names) -and ([System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h) -ne 33557444)){continue}
  $methods=@(foreach($mh in $t.GetMethods()) {
   $m=$md.GetMethodDefinition($mh);$n=$md.GetString($m.Name)
   if($n -match 'MinWidth|MinHeight|f3j3|ctor|AlignRight|AutoFit|LocationInDiagram|GJdZ|nJdY|r1gE|e1g2') {
    [pscustomobject]@{name=$n;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);attributes=$m.Attributes.ToString();signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
   }
  })
  [pscustomobject]@{name=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);base=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);methods=$methods}
 })
 $targets=@(100695468,67123777)
 $refs=@(foreach($h in $md.MethodDefinitions) {
  $m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue}
  $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $hits=@(for($i=0;$i -lt $il.Length-4;$i++) {
   if($il[$i] -in @(0x28,0x6f,0x7d)) {
    $token=[BitConverter]::ToInt32($il,$i+1)
    if($token -in $targets){[pscustomobject]@{offset=$i;token=$token;opcode=$il[$i]}}
   }
  })
  if($hits.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);hits=$hits}}
 })
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='Static PE metadata; reference candidates require full CIL confirmation';types=$types;references=$refs}|ConvertTo-Json -Depth 12
}finally{$pe.Dispose();$stream.Dispose()}
