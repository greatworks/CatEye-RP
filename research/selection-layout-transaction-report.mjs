// Freeze the new transaction report only. Never rewrites earlier stage evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=file=>({file,sha256:sha(file)});
const prefix='research/selection-layout-transaction-';
const probe=read(prefix+'probes.json');
assert.equal(probe.summary.total,199);assert.equal(probe.summary.failed,0);
for(const item of probe.sources)assert.equal(sha(item.file),item.sha256,item.file);
const old=read('research/selection-author-resize-manifest.json');
const dll=old.sources.find(x=>x.file.endsWith('/AxureRP11.dll'));
assert(dll);assert.equal(sha(dll.file),dll.sha256);
const oldFiles=['research/selection-author-resize-evidence.md','research/selection-author-resize-evidence.json',
 'research/selection-author-resize-census.json','research/selection-author-resize-probes.json',
 'research/selection-author-resize-manifest.json'];
const priorRefs=[...(old.sources??[]),...(old.files??[])];
const frozenChecks=[];
for(const file of oldFiles){
 const before=priorRefs.find(x=>(x.file??x.path)===file);
 if(before){assert.equal(sha(file),before.sha256,file);frozenChecks.push({...ref(file),sameAsPriorManifest:true});}
 else frozenChecks.push({...ref(file),sameAsPriorManifest:null});
}
const extra=[
 'research/native-layers-format-extract.ps1','research/samples/metadata-PName.json',
 'research/selection-layout-transaction-callers.ps1','research/selection-layout-transaction-callers.json',
 'research/selection-layout-transaction-metadata.ps1','research/selection-layout-transaction-metadata.json',
 'research/selection-layout-transaction-notifications-cil.json',
 ...oldFiles,
];
const inputs=[...new Set([dll.file,...probe.sources.map(x=>x.file),...extra])].map(ref);
const exceptions=read(prefix+'metadata.json').records.find(x=>x.token===100702374).exceptions;
assert(exceptions.some(x=>x.kind==='Finally'&&x.tryOffset===117&&x.tryLength===1432&&x.handlerOffset===1549&&x.handlerLength===61));
const pm=read('research/samples/metadata-PName.json').Types.flatMap(t=>t.Fields).find(x=>x.Constant==='65000000');
assert.equal(pm.Name,'LOCATION');
const tokens=[...new Set(probe.cases.flatMap(c=>Object.keys(c.actual.methods??{})))].map(Number).sort((a,b)=>a-b);
const summary={
 scope:'Read-only SelectionButton OI8Z source-control-flow transaction; no product implementation',
 originalAssemblyExecuted:false,originalGuiCompared:false,nativeFontMeasurementPerformed:false,
 sources:inputs,proof:{summary:probe.summary,transactions:probe.cases.length,sentinelCases:probe.sentinel.length,
  interpretedMethodCount:tokens.length,interpretedMethods:tokens,probe:ref(prefix+'probes.json'),exceptionMetadata:exceptions},
 contract:{
  entries:{layout:{token:100702374,argument:'false=PNZ8 directly; true=fit/reference/alignment/YJ0S then PNZ8'},
   size:{token:100695365,sequence:'minimum/NIuy KNZn -> equality -> write -> EIuw OI8Z(true) -> base notification'},
   widthFlag:{token:100702343,field:67126826,changedOnly:true},
   heightFlag:{token:100702367,field:67126834,changedOnly:true}},
  inputs:['effective current owner rectangle','prior local text-panel rectangle','effective fit getters plus raw shared flags',
   'text empty/editing status','text and vertical alignment','padding TRBL','effective P94','AlignRight',
   'guard state','optional temporary style-editor KNYS rectangle','graphics/provider/notification services'],
  outputs:['owner rectangle','local text-panel rectangle','raw fit flags','ordered writes/notifications','error with guard released'],
  guard:{field:67126836,helper:100688766,setter:100702409,finally:true,rollback:false},
  cache:{field:67126835,sentinel:'all four NaN',predicate:100722087,
   writers:[100677936,100677937],notDragBaseline:true},
  align:{leftTop:'unchanged',rightBottom:'old-new',centerMiddle:'floor(old/2)-floor(new/2)',equalTolerance:1e-5},
  rounding:{panelSize:'0 digits AwayFromZero',panelLocation:'0 digits ToEven'},
  callbacks:{fontMeasurement:{token:100715354,synthetic:true},
   graphicsSizeConversion:{token:100720541,sourceSpace:2,targetSpace:0,synthetic:true},
   rtfEditorHeight:{token:100712280,synthetic:true},
   minimumAndEffectiveProviderWrites:{tokens:[100695441,100695366,100695350],synthetic:true},
   notificationSubscribers:{tokens:[100695409,100701900,100695356,100695346],loggedOnly:true}},
  modelPolicy:'A future pure adapter may atomically commit accumulated output, explicitly different from native partial writes on exception',
 },
 supportedScope:probe.scope,
 remaining:['Original graphics font/shaping metrics','General Transform and owner/text rotation',
  'Noncoincident Location versus LocationInDiagram contexts','Full external update-reason graph',
  'Ancestor refit/subscribers and inline-link synchronization','Original GUI/history comparison'],
 historicalCoverage:{nativeCarriers:39,previouslyImportedRadios:17,previouslyImportedCheckboxes:0,
  actualAdmissionRecomputed:false,census:ref('research/selection-author-resize-census.json')},
 frozenPriorChecks:frozenChecks,
 report:ref(prefix+'evidence.md'),
};
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(summary,null,2)+'\n');
const files=fs.readdirSync('research').filter(f=>f.startsWith('selection-layout-transaction-'))
 .filter(f=>!f.endsWith('manifest.json')).map(f=>'research/'+f).sort().map(ref);
const manifest={originalGuiCompared:false,originalAssemblyExecuted:false,sources:inputs,files,
 proof:probe.summary,frozenPriorChecks:frozenChecks};
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const item of [...manifest.sources,...manifest.files])assert.equal(sha(item.file),item.sha256,item.file);
console.log(JSON.stringify({summary:probe.summary,sourceRefs:inputs.length,files:files.length,
 md:ref(prefix+'evidence.md'),json:ref(prefix+'evidence.json'),manifest:ref(prefix+'manifest.json')},null,2));
