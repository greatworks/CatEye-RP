$dll=(Get-Content research/table-format-metadata.json -Raw|ConvertFrom-Json).assembly
$stream=[IO.File]::OpenRead($dll);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe);$targets=@{}
 foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);$t=$md.GetTypeDefinition($m.GetDeclaringType());$type=$md.GetString($t.Name);$name=$md.GetString($m.Name)
  if(($type -in @('DiagramObjectContainer','DiagramObject','Table','Diagram') -and $name -match 'SubObjects|DiagramObjects|Objects') -or ($type -eq 'KJm7' -and $name -eq 'GJOu') -or $name -eq 'get_SubObjects'){$targets[[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)]=$type+'::'+$name}
 }
 $targets[33557580]="Table type"; $matches=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue};$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -eq 0x28 -or $il[$i] -eq 0x6f -or $il[$i] -eq 0x75 -or $il[$i] -eq 0x74){$token=[BitConverter]::ToInt32($il,$i+1);if($targets.ContainsKey($token)){[PSCustomObject]@{offset=$i;token=$token;target=$targets[$token]}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[PSCustomObject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 [PSCustomObject]@{sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant();method='Candidate call scan only; decoded CIL needed';targets=@($targets.GetEnumerator()|ForEach-Object{[PSCustomObject]@{token=$_.Key;name=$_.Value}});calls=@($matches)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}



