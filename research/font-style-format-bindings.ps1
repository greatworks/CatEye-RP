param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Find static signature / immediate candidates; full decoded CIL is required for conclusions.
$ErrorActionPreference='Stop';$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $matches=foreach($h in $md.MethodDefinitions){$m=$md.GetMethodDefinition($h);$signature=[Convert]::ToHexString($md.GetBlobBytes($m.Signature));$at=@()
  if($m.RelativeVirtualAddress -gt 0){$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes();$at=@(for($i=0;$i -lt $il.Length-4;$i++){if($il[$i] -eq 0x20 -and [BitConverter]::ToInt32($il,$i+1) -eq 1002){$i}})}
  if($signature.Contains('BA04') -or $at.Count){$t=$md.GetTypeDefinition($m.GetDeclaringType());[PSCustomObject]@{type=$md.GetString($t.Name);namespace=$md.GetString($t.Namespace);method=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$h);signature=$signature;fontStyleSignature=$signature.Contains('BA04');property1002Candidates=$at}}
 }
 [PSCustomObject]@{sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static signature and immediate candidates only';methods=@($matches)}|ConvertTo-Json -Depth 6
}finally{$pe.Dispose();$stream.Dispose()}
