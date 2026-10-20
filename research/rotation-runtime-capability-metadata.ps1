param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata only; no assembly loading/execution.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name)
  if($name -notin @('VectorShape','TextRectObject','TextPanel','KJm7','DynamicPanel','ImageBox','TextBox','PlainTextObject')){continue}
  $base=$t.BaseType;$baseName=$base.Kind.ToString()
  if($base.Kind.ToString() -eq 'TypeDefinition'){$bt=$md.GetTypeDefinition([System.Reflection.Metadata.TypeDefinitionHandle]$base);$baseName=$md.GetString($bt.Namespace)+'.'+$md.GetString($bt.Name)}
  $props=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);if($md.GetString($p.Name) -match 'Capabilities|Rect|Rotation'){$g=$p.GetAccessors().Getter;$gm=$md.GetMethodDefinition($g);[pscustomobject]@{name=$md.GetString($p.Name);method=$md.GetString($gm.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$g)}}})
  [pscustomobject]@{name=$name;base=$baseName;properties=$props}
 }
 [pscustomobject]@{source=$AssemblyPath;sha256=(Get-FileHash $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='static metadata only';records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
