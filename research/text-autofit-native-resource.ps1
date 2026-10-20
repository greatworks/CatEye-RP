param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# Reads the single embedded literal resource named by retained sIho CIL. No Assembly.Load.
$ErrorActionPreference='Stop'
$s=[IO.File]::OpenRead($AssemblyPath);$pe=[System.Reflection.PortableExecutable.PEReader]::new($s)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $name='hULtVIBFeFhT1bNiXx.Bg3ExKVhJ7GsK7IETg'
 $found=@($md.ManifestResources|ForEach-Object {$r=$md.GetManifestResource($_);if($md.GetString($r.Name)-eq $name){$r}})
 if($found.Count-ne1-or !$found[0].Implementation.IsNil){throw 'Resource identity mismatch'}
 $rva=$pe.PEHeaders.CorHeader.ResourcesDirectory.RelativeVirtualAddress+[int]$found[0].Offset
 [byte[]]$raw=$pe.GetSectionData($rva).GetContent()
 $size=[BitConverter]::ToInt32($raw,0)
 if($size-lt0-or$size-gt4000000){throw 'Unexpected resource size'}
 $bytes=$raw[4..($size+3)]
 $out=Join-Path (Get-Location) 'research/text-autofit-native-literals.bin'
 [IO.File]::WriteAllBytes($out,$bytes)
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();resource=$name;rva=$rva;size=$size;file='research/text-autofit-native-literals.bin';resourceSHA256=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()}|ConvertTo-Json
}finally{$pe.Dispose();$s.Dispose()}
