import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
const census=read('research/selection-author-resize-census.json');
const probes=read('research/selection-author-resize-probes.json');
const oraclePath='research/layer-resize-native-import-oracle.json';
const oracle=read(oraclePath), imported=[];
for(const sample of oracle.samples) {
  const original=census.samples.find(s=>s.file===sample.file);
  assert(original&&original.sha256===sample.sha256);
  const walk=value=>{
    if(!value||typeof value!=='object')return;
    if(['radio','checkbox'].includes(value.type)) {
      const raw=census.widgets.filter(w=>w.sourceFile===sample.file&&value.id===`rp-w-${w.packageId}-${w.sourceId}`);
      assert.equal(raw.length,1);
      imported.push({file:sample.file,sha256:sample.sha256,sourceId:raw[0].sourceId,packageId:raw[0].packageId,
        id:value.id,type:value.type,fitCarrierPresent:Object.hasOwn(value,'shapeText')});
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
  };
  walk(sample.document);
}
assert.equal(imported.length,17);
assert(imported.every(w=>w.type==='radio'&&!w.fitCarrierPresent));
assert.equal(census.summary.total,39);
assert.equal(census.widgets.filter(w=>w.layerAncestors.length).length,16);
assert.equal(probes.summary.passed,76);
const sources=[...new Set([
  'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll',
  ...probes.sources.map(s=>s.file),...census.sources.map(s=>s.file),oraclePath,
  'research/native-layers-format-extract.ps1','research/layer-resize-controller-planner-metadata.json',
  'research/layer-resize-capability-evidence.md','research/layer-resize-capability-evidence.json',
  'research/runtime-text-autofit-bridge-evidence.md','research/runtime-text-autofit-bridge-replay.json',
  'research/font-size-runtime-evidence.md','research/adaptive-all-views-size-cil.json',
  'research/adaptive-all-views-position-cil.json',
  'src/model/author-layer-resize.ts','src/model/types.ts','src/model/document.ts',
  'src/model/import-rp.ts','src/components/WidgetView.tsx','research/scripts/read-rp-semantics.mjs',
  ...fs.readdirSync('research').filter(f=>f.startsWith('selection-author-resize-')
    &&!['selection-author-resize-evidence.json','selection-author-resize-manifest.json'].includes(f)).map(f=>'research/'+f)
])].map(ref);
for(const r of [...probes.sources,...census.sources])assert.equal(hash(r.file),r.sha256,r.file);
const output={
  scope:'Read-only next-stage source/format preparation; no release implementation or acceptance claim',
  target:{version:'11.0.0.4150',source:sources[0]},
  targetDllExecuted:false,originalGuiCompared:false,productModified:false,
  rawCensus:census.summary,
  importedReadback:{oracle:ref(oraclePath),method:'ID join of retained full imported documents; importer not rerun',
    radios:17,checkboxes:0,widgets:imported},
  checks:probes.summary,
  contract:{
    sharedFlags:{width:{getter:100702342,setter:100702343,field:'GNZZ'},
      height:{getter:100702366,setter:100702367,field:'mNYN'},
      adaptivePName:false,missingWidth:'retains previous backing-field value; factory default not established'},
    capabilities:{fixedWidth:true,fixedHeight:false,normalPinInputForcesFixedHeight:true,
      exception:'two-edge pins supersede fixed-height in numerical solver; modifier branch separately applies'},
    controller:{method:100686253,flag:'AutoFitWidth',
      gate:'already true AND horizontal freedom; setter value = abs(dx) < 0.00001; fixedWidth not tested'},
    indicator:{pName:94,sizes:{12:4,13:8,14:10,16:5,18:12},localCount:35,defaultCacheFallbackCount:4,
      alignRight:'all39 explicit False string; shared field qNUe',
      getter:100702026,dependency:'effective style P94, active transform ScaleX'},
    sizeValidation:{entry:100695365,virtualOverride:100702369,method:100702371,
      behavior:'Nonempty+widthFit uses measured text width + left/right padding + indicator; heightFit similarly uses text height + top/bottom'},
    layout:{measureEntry:100702375,position:100702035,invalidate:100702374,
      behavior:'measure before selection-specific positioning and uJ0j(current view, notify)'},
  },
  nextMinimalSlice:[
    'Preserve explicit shared selection fit/alignment and independently inherited indicator style with provenance.',
    'Resolve native Checkbox versus current CheckBox admission mismatch in its own strict reader/import tests.',
    'Compose a measured SelectionButton setter adapter before widening author resize type admission.'
  ],
  unresolved:[
    'OI8Z100702374 complete reentry/cache/notification and alignment-driven geometry transaction is retained but not compositionally replayed.',
    'Native font measurement and graphics indicator offsets are injected sinks, not original pixel evidence.',
    'Factory defaults, missing-flag old packages, general transforms, and right-aligned real examples not established.',
    'No complete native GUI resize/history comparison and no new product behavior implemented.'
  ],
  sources,
  samples:census.samples.map(s=>({file:s.file,sha256:s.sha256})),
  sourceStableDuringReport:sources.every(r=>hash(r.file)===r.sha256),
};
assert(output.sourceStableDuringReport);
fs.writeFileSync('research/selection-author-resize-evidence.json',JSON.stringify(output,null,2)+'\n');
const manifest={scope:output.scope,originalGuiCompared:false,sources,
  samples:output.samples,files:[ref('research/selection-author-resize-evidence.json')]};
fs.writeFileSync('research/selection-author-resize-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({checks:output.checks,sourceRefs:sources.length,
  report:ref('research/selection-author-resize-evidence.json'),manifest:ref('research/selection-author-resize-manifest.json')}));
