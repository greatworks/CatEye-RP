param([string]$AssemblyPath = 'C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Static ECMA-335 metadata only. Never loads or executes the target assembly.
$ErrorActionPreference = 'Stop'
$hash = (Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7') { throw 'Unexpected target assembly' }
$stream = [IO.File]::OpenRead($AssemblyPath)
$pe = [System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md = [System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $out = foreach ($handle in $md.TypeDefinitions) {
    $type = $md.GetTypeDefinition($handle)
    $fields = @(foreach ($fieldHandle in $type.GetFields()) {
      $field = $md.GetFieldDefinition($fieldHandle); $name = $md.GetString($field.Name)
      if ($name -cin @('MouseOver','MouseDown','Focused','Disabled','Selected','IX_STYLES') -and !$field.GetDefaultValue().IsNil) {
        [PSCustomObject]@{ name=$name; token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fieldHandle); constant=[Convert]::ToHexString($md.GetBlobBytes($md.GetConstant($field.GetDefaultValue()).Value)) }
      }
    })
    $methods = @(foreach ($methodHandle in $type.GetMethods()) {
      $method = $md.GetMethodDefinition($methodHandle); $name = $md.GetString($method.Name)
      if ($name -match 'IxStyle|StyleState|InteractionStyle') {
        [PSCustomObject]@{ name=$name; token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$methodHandle); signature=[Convert]::ToHexString($md.GetBlobBytes($method.Signature)) }
      }
    })
    if ($fields.Count -or $methods.Count) {
      [PSCustomObject]@{ name=$md.GetString($type.Name); namespace=$md.GetString($type.Namespace); token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$handle); fields=$fields; methods=$methods }
    }
  }
  [PSCustomObject]@{ targetSha256=$hash; method='Static metadata only; target assembly not loaded'; types=@($out) } | ConvertTo-Json -Depth 8
} finally { $pe.Dispose(); $stream.Dispose() }
