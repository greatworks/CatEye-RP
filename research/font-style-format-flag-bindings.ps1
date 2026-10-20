param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop';$s=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($s)
try{$md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $matches=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);$sig=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));$at=@();$len=0
  if($m.RelativeVirtualAddress -gt 0){$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes();$len=$il.Length;if($len -le 500){$at=@(for($i=0;$i -lt $len-4;$i++){if($il[$i] -eq 0x20 -and [BitConverter]::ToInt32($il,$i+1) -eq 1073741824){$i}})}}
  if($sig.Contains('A254') -or $at.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[pscustomobject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);signature=$sig;ilLength=$len;overrideImmediateCandidateOffsets=$at}}
 }
 [pscustomobject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static signature and immediate candidate scan; not decoded conclusions';methods=@($matches)}|ConvertTo-Json -Depth 7
}finally{$pe.Dispose();$s.Dispose()}
