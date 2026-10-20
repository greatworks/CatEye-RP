import fs from 'node:fs';
import crypto from 'node:crypto';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/';
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const record=path=>({path,sha256:hash(path)});
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const sources=[root+'AxureRP11.dll',root+'DefaultSettings/Training/UX Prototyping.rp',root+'DefaultSettings/Prototype_Files/resources/scripts/axure/style.js'].map(record);
if(sources[0].sha256!=='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7')throw Error('Target DLL identity changed');
const own=fs.readdirSync('research').filter(name=>name.startsWith('font-size-runtime-')&&!['font-size-runtime-evidence.json'].includes(name)).map(name=>'research/'+name);
const references=[
 'research/rich-text-format-html-style-cil.json',
 'research/rich-text-format-html-inline-cil.json',
 'research/font-style-format-run-base-cil.json',
 'research/font-style-format-conversion-cil.json',
 'research/gradient-angle-static-flow.mjs',
 'research/gradient-angle-flow-init-cil.json',
 'research/gradient-angle-version-cil.json',
 'research/shadow-format-form-cil.json',
 'research/font-size-format-owners.json',
 'research/font-size-format-axrun-reader-cil.json',
 'research/font-size-format-double-reader-cil.json',
 'research/font-size-format-evidence.md',
 'research/font-size-browser-probe.json',
];
const size=read('research/font-size-runtime-replay.json'),fit=read('research/font-size-runtime-autofit-replay.json');
for(const probe of [size,fit])for(const entry of probe.sources)if(hash(entry.path)!==entry.sha256)throw Error('Stale probe source '+entry.path);
const manifest={
 timestamp:new Date().toISOString(),
 target:'Axure RP 11.0.0.4150',
 extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
 method:'Static PEReader metadata/CIL plus bounded CIL interpretation with explicit sinks; original DLL not loaded or executed; no original GUI/page generation',
 sources,evidence:[...new Set([...own,...references])].sort().map(record),implementation:[],
 tests:[record('research/font-size-runtime-replay.mjs'),record('research/font-size-runtime-autofit-replay.mjs')],
 results:[{name:'HTML size and rich-run provider static CIL replay',passed:size.results.length,total:17},{name:'AutoFit text-panel static CIL control-flow replay with injected graphics',passed:fit.results.length,total:2}],
 findings:[
  'HTML run size formatter computes size*96/72 then rounds3; run21 produces numeric CSS operand28.',
  'Named base15 does not replace raw run21 in ValueAsObject(P2); equal sizes omit the inline property.',
  'Initial vector text CSS path recomputes an independent TextPanel rectangle before writing it.',
  'AutoFitWidth uses graphics measuring width10000; constrained branch retains supplied width; results round0 AwayFromZero.',
  'Text rectangle x/width are adjusted for horizontal padding before CSS rectangle emission; this does not prove owner bounds expand.',
 ],
 boundaries:[
  'Encrypted CSS literals remain symbolic; no complete original HTML or pixel comparison.',
  'Injected graphics132.25x38.75 is a control-flow probe value, not original font measurement.',
  'Original owner overflow and complete wrapper/layout behavior remain unknown.',
  'No evidence justifies changing /.75 to make20px fit saved bounds; complete original generation may include other unproven synchronization.',
  'Product source, source designs and old research reports unchanged.',
 ],
};
fs.writeFileSync('research/font-size-runtime-evidence.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sources:sources.length,evidence:manifest.evidence.length,staticCases:size.results.length+fit.results.length,sha256:hash('research/font-size-runtime-evidence.json')}));
