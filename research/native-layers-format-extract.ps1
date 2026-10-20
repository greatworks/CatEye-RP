param(
  [Parameter(Mandatory=$true)][string]$AssemblyPath,
  [string]$TypeName = 'G1GC',
  [string[]]$MethodNames = @(), [int[]]$MethodTokens = @()
)
# Static ECMA-335 metadata/CIL reading only. Never loads or executes the target assembly.
$ErrorActionPreference = 'Stop'
$stream = [IO.File]::OpenRead((Resolve-Path -LiteralPath $AssemblyPath).Path)
$reader = [System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $metadata = [System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($reader)
  $opcodes = @{}
  foreach ($field in [System.Reflection.Emit.OpCodes].GetFields()) {
    if ($field.FieldType -eq [System.Reflection.Emit.OpCode]) {
      $op = $field.GetValue($null); $opcodes[([int]$op.Value -band 65535)] = $op
    }
  }
  function Resolve-Token([int]$token) {
    if (($token -band 0xff000000) -eq 0x70000000) {
      return $metadata.GetUserString([System.Reflection.Metadata.Ecma335.MetadataTokens]::UserStringHandle($token -band 0xffffff))
    }
    $handle = [System.Reflection.Metadata.Ecma335.MetadataTokens]::EntityHandle($token)
    switch ($handle.Kind.ToString()) {
      'TypeReference' { $v = $metadata.GetTypeReference([System.Reflection.Metadata.TypeReferenceHandle]$handle); return $metadata.GetString($v.Namespace)+'.'+$metadata.GetString($v.Name) }
      'TypeDefinition' { $v = $metadata.GetTypeDefinition([System.Reflection.Metadata.TypeDefinitionHandle]$handle); return $metadata.GetString($v.Namespace)+'.'+$metadata.GetString($v.Name) }
      'MemberReference' { $v = $metadata.GetMemberReference([System.Reflection.Metadata.MemberReferenceHandle]$handle); return (Resolve-Token ([System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$v.Parent)))+'::'+$metadata.GetString($v.Name) }
      'MethodDefinition' { $v = $metadata.GetMethodDefinition([System.Reflection.Metadata.MethodDefinitionHandle]$handle); return (Resolve-Token ([System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$v.GetDeclaringType())))+'::'+$metadata.GetString($v.Name) }
      'FieldDefinition' { $v = $metadata.GetFieldDefinition([System.Reflection.Metadata.FieldDefinitionHandle]$handle); return (Resolve-Token ([System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$v.GetDeclaringType())))+'::'+$metadata.GetString($v.Name) }
      'MethodSpecification' { $v = $metadata.GetMethodSpecification([System.Reflection.Metadata.MethodSpecificationHandle]$handle); return (Resolve-Token ([System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$v.Method)))+'<generic>' }
      default { return $handle.Kind.ToString()+':'+$token.ToString('X8') }
    }
  }
  $types = foreach ($typeHandle in $metadata.TypeDefinitions) {
    $type = $metadata.GetTypeDefinition($typeHandle)
    if ($TypeName -ne "*" -and $metadata.GetString($type.Name) -ne $TypeName) { continue }
    $fields = foreach ($fieldHandle in $(if ($MethodTokens.Count -eq 0) { $type.GetFields() })) {
      $field = $metadata.GetFieldDefinition($fieldHandle); $value = $null
      if (!$field.GetDefaultValue().IsNil) { $constant = $metadata.GetConstant($field.GetDefaultValue()); $value = [Convert]::ToHexString($metadata.GetBlobBytes($constant.Value)) }
      [PSCustomObject]@{Name=$metadata.GetString($field.Name);Token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fieldHandle);Signature=[Convert]::ToHexString($metadata.GetBlobBytes($field.Signature));Constant=$value}
    }
    $methods = foreach ($methodHandle in $type.GetMethods()) {
      $method = $metadata.GetMethodDefinition($methodHandle); $name = $metadata.GetString($method.Name)
      if ($MethodNames.Count -gt 0 -and $name -notin $MethodNames) { continue }; if ($MethodTokens.Count -gt 0 -and [System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$methodHandle) -notin $MethodTokens) { continue }
      $instructions = @(); $length = 0
      if ($method.RelativeVirtualAddress -gt 0) {
        $body = [System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($reader, $method.RelativeVirtualAddress)
        $il = $body.GetILBytes(); $length = $il.Length; $p = 0
        $instructions = while ($p -lt $il.Length) {
          $start = $p; $code = [int]$il[$p++]; if ($code -eq 254) { $code = 0xfe00 -bor $il[$p++] }
          if (!$opcodes.ContainsKey($code)) { throw "Unknown opcode at $p" }
          $op = $opcodes[$code]; $operand = $null; $resolved = $null
          switch ($op.OperandType.ToString()) {
            'InlineNone' {}
            'ShortInlineI' { $operand = [int]$il[$p++]; if ($operand -gt 127) { $operand -= 256 } }
            'ShortInlineVar' { $operand = [int]$il[$p++] }
            'InlineVar' { $operand = [BitConverter]::ToUInt16($il,$p); $p += 2 }
            'InlineI' { $operand = [BitConverter]::ToInt32($il,$p); $p += 4 }
            'InlineI8' { $operand = [BitConverter]::ToInt64($il,$p); $p += 8 }
            'ShortInlineR' { $operand = [BitConverter]::ToSingle($il,$p); $p += 4 }
            'InlineR' { $operand = [BitConverter]::ToDouble($il,$p); $p += 8 }
            'ShortInlineBrTarget' { $jump = [int]$il[$p++]; if ($jump -gt 127) { $jump -= 256 }; $operand = $p + $jump }
            'InlineBrTarget' { $jump = [BitConverter]::ToInt32($il,$p); $p += 4; $operand = $p + $jump }
            'InlineSwitch' { $count = [BitConverter]::ToInt32($il,$p); $p += 4; $end = $p + 4*$count; $operand = @(for($i=0;$i -lt $count;$i++){ $end+[BitConverter]::ToInt32($il,$p);$p+=4 }) }
            default { $operand = [BitConverter]::ToInt32($il,$p); $p += 4; $resolved = Resolve-Token $operand }
          }
          [PSCustomObject]@{Offset=$start;Op=$op.Name;Operand=$operand;Resolved=$resolved}
        }
      }
      [PSCustomObject]@{Name=$name;Token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$methodHandle);Rva=$method.RelativeVirtualAddress;Signature=[Convert]::ToHexString($metadata.GetBlobBytes($method.Signature));ILBytes=$length;Instructions=@($instructions)}
    }
    if ($MethodTokens.Count -gt 0 -and @($methods).Count -eq 0) { continue }; [PSCustomObject]@{Name=$metadata.GetString($type.Name);Namespace=$metadata.GetString($type.Namespace);Token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$typeHandle);Fields=@($fields);Methods=@($methods)}
  }
  [PSCustomObject]@{AssemblyPath=(Resolve-Path -LiteralPath $AssemblyPath).Path;SHA256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();Inspection='static-metadata-and-cil-only';Types=@($types)} | ConvertTo-Json -Depth 10
} finally { $reader.Dispose(); $stream.Dispose() }

