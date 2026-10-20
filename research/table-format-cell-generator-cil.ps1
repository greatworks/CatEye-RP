$dll=(Get-Content research/table-format-metadata.json -Raw|ConvertFrom-Json).assembly
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName FNiU -MethodNames @('INPr','CNPv') > research/table-format-cell-html-cil.json
