$dll=(Get-Content research/table-format-metadata.json -Raw|ConvertFrom-Json).assembly
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName RPFormatConverter -MethodNames @('iJcb') > research/table-format-cell-drawing-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName FNiU -MethodNames @('vNPI') > research/table-format-text-cell-html-cil.json
