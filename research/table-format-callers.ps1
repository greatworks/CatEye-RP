param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Candidate metadata call scan only. Full opcode-decoded methods confirm any claim.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe);$targets=@{}
 foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);$t=$md.GetTypeDefinition($m.GetDeclaringType());$type=$md.GetString($t.Name);$name=$md.GetString($m.Name)
  if(($type -eq 'Table' -and $name -in @('get_RowHeights','get_ColumnWidths','get_AllTableCells','zNU7')) -or ($type -eq 'TableCell' -and $name -in @('get_LeftBorderWidth','get_RightBorderWidth','get_LeftBorderColor','get_RightBorderColor','get_ContainingTable'))){$targets[[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h)]=$type+'::'+$name}
 }
 $matches=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue};$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -eq 0x28 -or $il[$i] -eq 0x6f){$token=[BitConverter]::ToInt32($il,$i+1);if($targets.ContainsKey($token)){[PSCustomObject]@{offset=$i;token=$token;target=$targets[$token]}}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[PSCustomObject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}
 }
 [PSCustomObject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static candidate call-byte scan; conclusions require full CIL decoding';targets=@($targets.GetEnumerator()|ForEach-Object{[PSCustomObject]@{token=$_.Key;name=$_.Value}});calls=@($matches)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
