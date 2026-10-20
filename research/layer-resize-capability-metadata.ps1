param([string]$AssemblyPath='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll')
# Framework PEReader/MetadataReader only. Never load or execute the target assembly.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 function Token($h) { [System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h) }
 function Name($h) {
  $h=[System.Reflection.Metadata.EntityHandle]$h
  switch($h.Kind.ToString()) {
   'TypeDefinition' { $v=$md.GetTypeDefinition([System.Reflection.Metadata.TypeDefinitionHandle]$h);$md.GetString($v.Namespace)+'.'+$md.GetString($v.Name) }
   'TypeReference' { $v=$md.GetTypeReference([System.Reflection.Metadata.TypeReferenceHandle]$h);$md.GetString($v.Namespace)+'.'+$md.GetString($v.Name) }
   default { $h.Kind.ToString()+':'+(Token $h) }
  }
 }
 $all=@{}
 foreach($h in $md.TypeDefinitions) {
  $t=$md.GetTypeDefinition($h);$tok=Token $h
  $all[$tok]=[pscustomobject]@{handle=$h;definition=$t;name=Name $h;baseToken=Token $t.BaseType}
 }
 $records=@(foreach($entry in $all.Values | Sort-Object {Token $_.handle}) {
  $chain=@();$cursor=$entry
  while($cursor -and $cursor.name -notin $chain) { $chain+=,$cursor.name;$cursor=$all[$cursor.baseToken] }
  if('kJm2.KJm7' -notin $chain -and $entry.name -ne 'Axure.Platform.Controls.Capabilities'){continue}
  $t=$entry.definition
  $methods=@(foreach($mh in $t.GetMethods()) {
   $m=$md.GetMethodDefinition($mh);$n=$md.GetString($m.Name)
   if($n -notmatch 'Capabilities|^vJml$'){continue}
   [pscustomobject]@{name=$n;token=Token $mh;attributes=$m.Attributes.ToString();signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));rva=$m.RelativeVirtualAddress}
  })
  $props=@(foreach($ph in $t.GetProperties()) {
   $p=$md.GetPropertyDefinition($ph);$n=$md.GetString($p.Name)
   if($n -notmatch 'Capabilities|FixedWidth|FixedHeight'){continue}
   $a=$p.GetAccessors()
   [pscustomobject]@{name=$n;getter=$(if(!$a.Getter.IsNil){Token $a.Getter});setter=$(if(!$a.Setter.IsNil){Token $a.Setter});signature=[Convert]::ToHexString($md.GetBlobBytes($p.Signature))}
  })
  $impls=@(foreach($ih in $t.GetMethodImplementations()) {
   $i=$md.GetMethodImplementation($ih)
   [pscustomobject]@{declaration=Token $i.MethodDeclaration;body=Token $i.MethodBody}
  })
  $fields=@(if($entry.name -eq 'Axure.Platform.Controls.Capabilities') {foreach($fh in $t.GetFields()) {
   $f=$md.GetFieldDefinition($fh);$c=$f.GetDefaultValue();$v=$null
   if(!$c.IsNil){$v=[Convert]::ToHexString($md.GetBlobBytes($md.GetConstant($c).Value))}
   [pscustomobject]@{name=$md.GetString($f.Name);token=Token $fh;constantLEHex=$v}
  }})
  [pscustomobject]@{name=$entry.name;token=Token $entry.handle;base=Name $t.BaseType;baseToken=$entry.baseToken;attributes=$t.Attributes.ToString();chain=$chain;methods=$methods;properties=$props;methodImplementations=$impls;fields=$fields}
 })
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();inspection='Static ECMA-335 metadata only; no target loading/execution';records=$records}|ConvertTo-Json -Depth 12
} finally {$pe.Dispose();$stream.Dispose()}
