param([string]$AssemblyPath = 'C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Research-only metadata/CIL scan; target assembly is never loaded or executed.
$ErrorActionPreference = 'Stop'
$stream = [IO.File]::OpenRead($AssemblyPath)
$reader = [System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $metadata = [System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($reader)
  $opcodes = @{}
  foreach ($field in [System.Reflection.Emit.OpCodes].GetFields()) {
    if ($field.FieldType -eq [System.Reflection.Emit.OpCode]) {
      $op = $field.GetValue($null); $opcodes[([int]$op.Value -band 65535)] = $op
    }
  }
  $targets = @{}
  foreach ($handle in $metadata.TypeDefinitions) {
    $type = $metadata.GetTypeDefinition($handle)
    if ($metadata.GetString($type.Name) -ne 'Repeater') { continue }
    foreach ($mh in $type.GetMethods()) {
      $method = $metadata.GetMethodDefinition($mh); $name = $metadata.GetString($method.Name)
      if ($name -match '^get_(BorderWidth|BorderStyle|PaddingLeft|PaddingTop|PaddingRight|PaddingBottom)$') {
        $targets[[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh)] = $name
      }
    }
  }
  $matches = foreach ($handle in $metadata.TypeDefinitions) {
    $type = $metadata.GetTypeDefinition($handle)
    foreach ($mh in $type.GetMethods()) {
      $method = $metadata.GetMethodDefinition($mh)
      if ($method.RelativeVirtualAddress -eq 0) { continue }
      $body = [System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($reader,$method.RelativeVirtualAddress)
      $il = $body.GetILBytes(); $p = 0; $hits = @()
      while ($p -lt $il.Length) {
        $offset = $p; $code = [int]$il[$p++]; if ($code -eq 254) { $code = 0xfe00 -bor $il[$p++] }
        $op = $opcodes[$code]
        switch ($op.OperandType.ToString()) {
          'InlineNone' {}
          {$_ -in 'ShortInlineI','ShortInlineVar','ShortInlineBrTarget'} { $p += 1 }
          'InlineVar' { $p += 2 }
          {$_ -in 'InlineI','ShortInlineR','InlineBrTarget'} { $p += 4 }
          {$_ -in 'InlineI8','InlineR'} { $p += 8 }
          'InlineSwitch' { $count = [BitConverter]::ToInt32($il,$p); $p += 4+4*$count }
          default {
            $token = [BitConverter]::ToInt32($il,$p); $p += 4
            if ($targets.ContainsKey($token)) { $hits += [PSCustomObject]@{Offset=$offset;Op=$op.Name;Target=$targets[$token];Token=$token} }
          }
        }
      }
      if ($hits.Count) {
        [PSCustomObject]@{Type=$metadata.GetString($type.Name);Namespace=$metadata.GetString($type.Namespace);Method=$metadata.GetString($method.Name);Token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh);ILBytes=$il.Length;Hits=$hits}
      }
    }
  }
  [PSCustomObject]@{AssemblyPath=$AssemblyPath;SHA256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();Inspection='static-metadata-and-cil-only';Callers=@($matches)} | ConvertTo-Json -Depth 10
} finally { $reader.Dispose(); $stream.Dispose() }
