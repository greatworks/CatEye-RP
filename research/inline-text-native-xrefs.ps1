param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll',[string[]]$TypeNames=@('M3m'),[int[]]$TargetTokens=@(100665110))
# Narrow CIL token xrefs; reads metadata/IL bytes only, never executes target code.
$ErrorActionPreference='Stop';$stream=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe);$ops=@{}
 foreach($f in [Reflection.Emit.OpCodes].GetFields()){if($f.FieldType -eq [Reflection.Emit.OpCode]){$op=$f.GetValue($null);$ops[([int]$op.Value-band65535)]=$op}}
 $matches=foreach($th in $md.TypeDefinitions){$t=$md.GetTypeDefinition($th);$name=$md.GetString($t.Name);if($TypeNames.Count -and $name -notin $TypeNames){continue}
  foreach($mh in $t.GetMethods()){$m=$md.GetMethodDefinition($mh);if(!$m.RelativeVirtualAddress){continue};$il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$m.RelativeVirtualAddress).GetILBytes();$p=0;$refs=@()
   while($p -lt $il.Length){$start=$p;$code=[int]$il[$p++];if($code -eq254){$code=0xfe00-bor$il[$p++]};$op=$ops[$code];$size=0
    switch($op.OperandType.ToString()){
     'InlineNone'{} 'ShortInlineI'{$size=1} 'ShortInlineVar'{$size=1} 'ShortInlineBrTarget'{$size=1} 'InlineVar'{$size=2} 'InlineI8'{$size=8} 'InlineR'{$size=8}
     'InlineSwitch'{$size=4+4*[BitConverter]::ToInt32($il,$p)}
     default{$size=4;if($op.OperandType.ToString() -in @('InlineMethod','InlineField','InlineType','InlineTok')){$token=[BitConverter]::ToInt32($il,$p);if($token -in $TargetTokens){$refs += [PSCustomObject]@{offset=$start;op=$op.Name;targetToken=$token}}}}
    };$p+=$size
   }
   if($refs.Count){[PSCustomObject]@{type=$md.GetString($t.Namespace)+'.'+$name;name=$md.GetString($m.Name);token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);refs=$refs}}
  }
 }
 [PSCustomObject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();method='Static selected-type/token CIL xrefs';typeNames=$TypeNames;targetTokens=$TargetTokens;matches=@($matches)}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
