param(
 [string]$AssemblyPath='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll',
 [string[]]$TypeNames=@('jtoq','QtAY`1','e5jG','WtTU'),
 [int[]]$TypeTokens=@(),
 [int[]]$ReferenceTokens=@(452985640,167777130,167789727,167791469)
)
# Static ECMA-335 records. Never loads the inspected assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $records=@(foreach($h in $md.TypeDefinitions){
  $t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name)
  $token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)
  if($name -notin $TypeNames -and $token -notin $TypeTokens){continue}
  $fields=@(foreach($fh in $t.GetFields()){
   $f=$md.GetFieldDefinition($fh);$constant=$null
   if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$constant=[Convert]::ToHexString($md.GetBlobBytes($c.Value))}
   [pscustomobject]@{name=$md.GetString($f.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);signature=[Convert]::ToHexString($md.GetBlobBytes($f.Signature));constant=$constant}
  })
  $methods=@(foreach($mh in $t.GetMethods()){
   $m=$md.GetMethodDefinition($mh)
   [pscustomobject]@{name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}
  })
  [pscustomobject]@{name=$md.GetString($t.Namespace)+'.'+$name;token=$token;baseToken=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($t.BaseType);baseSignature=if($t.BaseType.Kind.ToString() -eq 'TypeSpecification'){[Convert]::ToHexString($md.GetBlobBytes($md.GetTypeSpecification([System.Reflection.Metadata.TypeSpecificationHandle]$t.BaseType).Signature))}else{$null};fields=$fields;methods=$methods}
 })
 $refs=@(foreach($token in $ReferenceTokens){
  $h=[System.Reflection.Metadata.Ecma335.MetadataTokens]::EntityHandle($token)
  switch($h.Kind.ToString()){
   'TypeSpecification' {$t=$md.GetTypeSpecification([System.Reflection.Metadata.TypeSpecificationHandle]$h);[pscustomobject]@{token=$token;signature=[Convert]::ToHexString($md.GetBlobBytes($t.Signature))}}
   'MemberReference' {$m=$md.GetMemberReference([System.Reflection.Metadata.MemberReferenceHandle]$h);[pscustomobject]@{token=$token;name=$md.GetString($m.Name);parent=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken($m.Parent);signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature))}}
  }
 })
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static metadata only';records=$records;references=$refs}|ConvertTo-Json -Depth 9
} finally {$pe.Dispose();$stream.Dispose()}
