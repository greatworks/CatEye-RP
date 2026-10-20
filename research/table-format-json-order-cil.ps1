$dll=(Get-Content research/table-format-metadata.json -Raw|ConvertFrom-Json).assembly
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName wJe6 -MethodNames @('jJeK','FJem') > research/table-format-json-dispatch-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName Bbib -MethodNames @('Sb73') > research/table-format-sequence-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName DiagramObjectContainer -MethodNames @('get_DiagramObjects','get_SubObjects','NIwY','oIw4') > research/table-format-container-cil.json
$stream=[IO.File]::OpenRead($dll);$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try{
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $spec=$md.GetTypeSpecification([System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeSpecificationHandle(1646))
 $type=$md.GetTypeReference([System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeReferenceHandle(52))
 [PSCustomObject]@{sha256=(Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant();typeSpecToken='1B00066E';signature=[Convert]::ToHexString($md.GetBlobBytes($spec.Signature));genericTypeToken='01000034';genericType=$md.GetString($type.Namespace)+'.'+$md.GetString($type.Name);note='151280D1011E00 = GenericInst Class TypeDefOrRef coded index 209 (TypeRef 52), one MVAR 0'}|ConvertTo-Json > research/table-format-sequence-type.json
}finally{$pe.Dispose();$stream.Dispose()}
