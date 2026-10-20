param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
# PEReader only. Decode the exact FI8B signature; never load the vendor DLL.
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
 $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
 $method=$md.GetMethodDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::MethodDefinitionHandle(100685668-band 0xffffff))
 $sig=$md.GetBlobReader($method.Signature)
 $convention=$sig.ReadByte();$count=$sig.ReadCompressedInteger();$return=$sig.ReadByte()
 $parameters=@(for($i=0;$i-lt$count;$i++){
  $element=$sig.ReadByte();$coded=$sig.ReadCompressedInteger();$tag=$coded-band 3;$row=$coded-shr 2
  if($tag-ne 0){throw 'Expected exact TypeDef parameter'}
  $type=$md.GetTypeDefinition([System.Reflection.Metadata.Ecma335.MetadataTokens]::TypeDefinitionHandle($row))
  $fields=@(foreach($fh in $type.GetFields()){
   $field=$md.GetFieldDefinition($fh);$constant=$null
   if(!$field.GetDefaultValue().IsNil){$c=$md.GetConstant($field.GetDefaultValue());$bytes=$md.GetBlobBytes($c.Value);if($bytes.Length-eq 4){$constant=[BitConverter]::ToInt32($bytes,0)}}
   [pscustomobject]@{name=$md.GetString($field.Name);constant=$constant}
  })
  [pscustomobject]@{index=$i;element=$element;codedTypeDefOrRef=$coded;typeToken=0x02000000+$row;type=($md.GetString($type.Namespace)+'.'+$md.GetString($type.Name));fields=$fields}
 })
 [pscustomobject]@{assembly=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath -Algorithm SHA256).Hash.ToLowerInvariant();kind='static exact method signature and enum constants';methodToken=100685668;signature=[Convert]::ToHexString($md.GetBlobBytes($method.Signature));callingConvention=$convention;returnElement=$return;parameters=$parameters}|ConvertTo-Json -Depth 8
}finally{$pe.Dispose();$stream.Dispose()}
