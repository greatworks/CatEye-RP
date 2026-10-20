$dll=(Get-Content research/menu-format-metadata.json -Raw|ConvertFrom-Json).assembly
# Static metadata/CIL only; the original assembly is never loaded or executed.
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName MenuObject -MethodNames @('get_Orientation','set_Orientation','.ctor','get_ContainedTable','set_ContainedTable','get_SubObjects','GN0Y','bN04','get_MenuPadding','set_MenuPadding','get_SubMenuObjects','NIwY','oIw4','hIui','oIwv','hN0n','get_ParentMenu','get_ParentCell','get_IsSubMenu','AddSubmenu','zN0w') > research/menu-format-object-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName FNiU -MethodNames @('JNPM') > research/menu-format-html-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $dll -TypeName wJe6 -MethodNames @('jJeK') > research/menu-format-json-cil.json
