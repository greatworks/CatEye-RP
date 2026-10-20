param([string]$AssemblyPath='C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll')
$ErrorActionPreference='Stop'
$stream=[IO.File]::OpenRead($AssemblyPath)
$pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
try {
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $records=foreach($th in $md.TypeDefinitions){
    $t=$md.GetTypeDefinition($th);$tn=$md.GetString($t.Name)
    $fields=@(foreach($fh in $t.GetFields()){
      $f=$md.GetFieldDefinition($fh);$name=$md.GetString($f.Name)
      if($name -notmatch 'LIMBO|UNPLAC|^IS_CONTAINED$|^VISIBLE$|^VISIBILITY$' -and !($tn -eq 'PName' -and $name -match 'VIEW|EXIST|PLACE')){continue}
      $v=$null;if(!$f.GetDefaultValue().IsNil){$c=$md.GetConstant($f.GetDefaultValue());$v=[Convert]::ToHexString($md.GetBlobBytes($c.Value))}
      @{name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$fh);constant=$v}
    })
    $methods=@(foreach($mh in $t.GetMethods()){
      $m=$md.GetMethodDefinition($mh);$name=$md.GetString($m.Name)
      if($name -notmatch '(?i)limbo|unplaced|iscontained|isplaced' -and !($tn -in @('KJm7','jtoq','ituB','WtTU') -and $name -match '(?i)view|place|exist|visible')){continue}
      @{name=$name;token=[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$mh)}
    })
    $props=@(foreach($ph in $t.GetProperties()){
      $p=$md.GetPropertyDefinition($ph);$name=$md.GetString($p.Name)
      if($name -notmatch '(?i)limbo|unplaced|iscontained|isplaced' -and !($tn -in @('KJm7','jtoq','ituB','WtTU') -and $name -match '(?i)view|place|exist|visible')){continue}
      $a=$p.GetAccessors()
      @{name=$name;getterName=if($a.Getter.IsNil){$null}else{$md.GetString($md.GetMethodDefinition($a.Getter).Name)};getter=if($a.Getter.IsNil){$null}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Getter)};setter=if($a.Setter.IsNil){$null}else{[System.Reflection.Metadata.Ecma335.MetadataTokens]::GetToken([System.Reflection.Metadata.EntityHandle]$a.Setter)}}
    })
    if($fields.Count -or $methods.Count -or $props.Count){@{type=$tn;namespace=$md.GetString($t.Namespace);fields=$fields;methods=$methods;properties=$props}}
  }
  @{kind='Static ECMA-335 metadata only; target DLL not loaded or executed';path=$AssemblyPath;sha256=(Get-FileHash -LiteralPath $AssemblyPath).Hash.ToLowerInvariant();records=@($records)} | ConvertTo-Json -Depth 9
} finally {$pe.Dispose();$stream.Dispose()}
