param([string]$AssemblyPath='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll')
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $targets=@(100695457,100695931)
 $records=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -le 0){continue};$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes();$calls=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -in @(0x28,0x6f,0x73,0x7b,0x7c,0x7d,0x74,0x75)){$token=[BitConverter]::ToInt32($il,$i+1);if($token -in $targets){[pscustomobject]@{offset=$i;token=$token}}}});if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);calls=$calls}}}
 $named=foreach($h in $md.TypeDefinitions){$t=$md.GetTypeDefinition($h);$name=$md.GetString($t.Name);$props=@(foreach($ph in $t.GetProperties()){$p=$md.GetPropertyDefinition($ph);$n=$md.GetString($p.Name);if($n -match 'Pin|FixedWidth|FixedHeight'){$a=$p.GetAccessors();[pscustomobject]@{name=$n;getter=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter);setter=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter);signature=[Convert]::ToHexString($md.GetBlobBytes($p.Signature))}}});if($props.Count -or $name -match 'Pin|Resize'){[pscustomobject]@{type=$md.GetString($t.Namespace)+'.'+$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);properties=$props}}}
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='static metadata and bounded target call-byte candidates; selected sites require full opcode inspection';targets=$targets;records=@($records);named=@($named)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}


