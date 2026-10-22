param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop'
$s=[IO.File]::OpenRead($AssemblyPath);$p=[System.Reflection.PortableExecutable.PEReader]::new($s)
try {
 $m=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($p)
 function Token($h){[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)}
 function Name($handle){$h=[System.Reflection.Metadata.EntityHandle]$handle;if($h.IsNil){return $null};switch($h.Kind.ToString()){
  TypeDefinition {$d=$m.GetTypeDefinition([System.Reflection.Metadata.TypeDefinitionHandle]$h);return $m.GetString($d.Namespace)+'.'+$m.GetString($d.Name)}
  TypeReference {$d=$m.GetTypeReference([System.Reflection.Metadata.TypeReferenceHandle]$h);return $m.GetString($d.Namespace)+'.'+$m.GetString($d.Name)}
  default {return $h.Kind.ToString()+':'+(Token $h)}
 }}
 $types=foreach($th in $m.TypeDefinitions){$t=$m.GetTypeDefinition($th);if($m.GetString($t.Name) -notin @('I9Sy','x1Jx','xSnT')){continue}
  $interfaces=@(foreach($ih in $t.GetInterfaceImplementations()){$i=$m.GetInterfaceImplementation($ih);@{token=Token $i.Interface;name=Name $i.Interface}})
  $methods=@(foreach($mh in $t.GetMethods()){$d=$m.GetMethodDefinition($mh);$n=$m.GetString($d.Name);if($n -notin @('NIoi','.ctor','.cctor','aS8e')){continue};@{name=$n;token=Token $mh;attributes=$d.Attributes.ToString();signature=[Convert]::ToHexString($m.GetBlobBytes($d.Signature))}})
  [pscustomobject]@{name=Name $th;token=Token $th;base=Name $t.BaseType;attributes=$t.Attributes.ToString();interfaces=$interfaces;methods=$methods}
 }
 [pscustomobject]@{kind='static PE metadata only';assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();types=@($types)}|ConvertTo-Json -Depth 9
}finally{$p.Dispose();$s.Dispose()}
