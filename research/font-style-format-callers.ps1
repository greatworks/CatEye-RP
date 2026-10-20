param([int[]]$Tokens=@(100691356,100717756,100717757),[string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop';$s=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($s)
try{$md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $matches=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);if($m.RelativeVirtualAddress -eq 0){continue};$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes()
  $calls=@(for($i=0;$i -lt $il.Length-4;$i++){if(($il[$i] -eq 0x28 -or $il[$i] -eq 0x6f) -and [BitConverter]::ToInt32($il,$i+1) -in $Tokens){[pscustomobject]@{offset=$i;token=[BitConverter]::ToInt32($il,$i+1)}}})
  if($calls.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);ilLength=$il.Length;calls=$calls}}
 }
 [pscustomobject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static call-byte candidate scan only; full decode required';methods=@($matches)}|ConvertTo-Json -Depth 7
}finally{$pe.Dispose();$s.Dispose()}
