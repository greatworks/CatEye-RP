param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static ECMA-335 inventory only; never load the target assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$ns=$md.GetString($t.Namespace)
  $methods=@(foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);$mn=$md.GetString($m.Name);if($mn -match 'StringAlignment|Wrapping|Trimming|Baseline|Superscript|FontStretch|ListType'){
   [PSCustomObject]@{name=$mn;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
  }})
  if($name -match 'StringAlignment|Wrapping|Trimming|Baseline|Superscript|FontStretch|ListType' -or $methods.Count){
   $fields=@(foreach($fh in $t.GetFields()){$f=$md.GetFieldDefinition($fh);$value=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$value=[Convert]::ToHexString($md.GetBlobBytes($c.Value))};[PSCustomObject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature));constant=$value}})
   [PSCustomObject]@{type=$ns+'.'+$name;name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);fields=$fields;methods=$methods}
  }
 }
 [PSCustomObject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static metadata only';records=@($records)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}

