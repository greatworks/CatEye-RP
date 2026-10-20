param([string]$AssemblyPath = 'C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Metadata and FieldRVA bytes only; never loads or executes the target assembly.
$ErrorActionPreference = 'Stop'
$expectedHash = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'
$actualHash = (Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) { throw 'Unexpected target assembly hash' }
$readerPath = Join-Path $PSScriptRoot 'scripts/inspect-rp-serialization.ps1'
$methods = @('get_IsInnerRepeater','YNdr','get_SupportedIxEventTypes','get_PrimaryInteractionEventTypes','.cctor','eNdk','sNq8')
$cilPath = Join-Path $PSScriptRoot 'repeater-empty-Repeater-cil.json'
& $readerPath -AssemblyPath $AssemblyPath -TypeName 'Repeater' -MethodNames $methods | Set-Content -LiteralPath $cilPath -Encoding utf8
$stream = [IO.File]::OpenRead($AssemblyPath)
$pe = [System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
    $metadata = [System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
    $fieldToken = 67129117
    $field = $metadata.GetFieldDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::FieldDefinitionHandle($fieldToken -band 0xffffff))
    $rva = $field.GetRelativeVirtualAddress()
    [byte[]]$bytes = $pe.GetSectionData($rva).GetContent(0,24)
    $values = @(for($i=0;$i -lt $bytes.Length;$i+=4){[BitConverter]::ToInt32($bytes,$i)})
    if (($values -join ',') -ne '288,289,290,276,277,275') { throw 'Unexpected repeater event array' }
    $result = [PSCustomObject]@{
        AssemblyPath=$AssemblyPath; SHA256=$actualHash; Inspection='static-metadata-and-field-rva-only'
        CilFile='repeater-empty-Repeater-cil.json'; CilSHA256=(Get-FileHash -LiteralPath $cilPath -Algorithm SHA256).Hash.ToLowerInvariant()
        FieldToken=('0x{0:X8}' -f $fieldToken); FieldName=$metadata.GetString($field.Name); RVA=$rva
        BytesHex=[Convert]::ToHexString($bytes); IxEventTypeValues=$values; OnBeforeItemLoad291Present=($values -contains 291)
        MappingEvidence='rp-interaction-IxEventType-cil.json'
        Limits=@('A static supported-event list is not a GUI interaction test.','IsInnerRepeater property and branch are retained; its complete obfuscated parent-discovery semantics are not claimed.','Array bytes are read from the FieldRVA referenced by Repeater .cctor, not recovered by executing its static initializer.')
    }
    $result | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'repeater-empty-native-events.json') -Encoding utf8
    $result | Select-Object SHA256,FieldToken,RVA,IxEventTypeValues,OnBeforeItemLoad291Present | ConvertTo-Json -Compress
} finally { $pe.Dispose(); $stream.Dispose() }
