param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static metadata only, no target assembly load or invocation.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 function T([System.Reflection.Metadata.EntityHandle]$h){if($h.IsNil){return $null}; switch($h.Kind.ToString()){
  'TypeDefinition' {$v=$md.GetTypeDefinition($h);return $md.GetString($v.Namespace)+'.'+$md.GetString($v.Name)}
  'TypeReference' {$v=$md.GetTypeReference($h);return $md.GetString($v.Namespace)+'.'+$md.GetString($v.Name)}
  'MethodDefinition' {$v=$md.GetMethodDefinition($h);return (T $v.GetDeclaringType())+'::'+$md.GetString($v.Name)}
  'MemberReference' {$v=$md.GetMemberReference($h);return (T $v.Parent)+'::'+$md.GetString($v.Name)}
  default {return $h.Kind.ToString()+':'+[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($h)}
 }}
 $types=foreach($th in $md.TypeDefinitions){$t=$md.GetTypeDefinition($th);$name=$md.GetString($t.Name)
  if($name -notin @('AjIh','XbbP','hbbp','XbJ5','Ljg2','tjVR','IjWz','wjkD','FjVF','GScr')){continue}
  $methods=foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);[pscustomobject]@{
   name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);attributes=$m.Attributes.ToString();signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));parameters=@(foreach($ph in $m.GetParameters()){$p=$md.GetParameter($ph);[pscustomobject]@{name=$md.GetString($p.Name);sequence=$p.SequenceNumber}})
  }}
  $impl=foreach($ih in $t.GetMethodImplementations()){$i=$md.GetMethodImplementation($ih);[pscustomobject]@{declaration=T $i.MethodDeclaration;body=T $i.MethodBody}}
  [pscustomobject]@{name=T $th;base=T $t.BaseType;declaring=T $t.GetDeclaringType();methods=@($methods);implementations=@($impl)}
 }
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static selected type/dispatch/parameter metadata';types=@($types)} | ConvertTo-Json -Depth 12
}finally{$pe.Dispose();$stream.Dispose()}
