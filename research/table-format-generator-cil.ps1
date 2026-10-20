$dll=(Get-Content research/table-format-metadata.json -Raw|ConvertFrom-Json).assembly
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName FNiU -MethodNames @('zNPe') > research/table-format-html-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName RPFormatConverter -MethodNames @('oJcj') > research/table-format-drawing-cil.json
