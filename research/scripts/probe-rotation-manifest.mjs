import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11';
const scriptRoot=root+'/DefaultSettings/Prototype_Files/resources/scripts/axure/';
const record=path=>({path,sha256:hash(path)});
const sourceFiles=[root+'/AxureRP11.dll',...['math.js','move.js','axQuery.std.js','action.js','visibility.js'].map(p=>scriptRoot+p)];
const evidenceFiles=[
 'research/rotation-runtime-evidence.md','research/rotation-runtime-probes.json',
 ...fs.readdirSync('research').filter(p=>p.startsWith('rotation-runtime-')&&(p.endsWith('-cil.json')||p.endsWith('-metadata.json')||p.endsWith('-metadata.ps1'))).map(p=>'research/'+p),
 'research/rotation-format-census.json','research/rotation-format-properties-cil.json','research/rotation-format-object-cil.json','research/rotation-format-transform-cil.json','research/rotation-format-style-chain-cil.json',
 'research/repeater-box-model-css-writer-cil.json','research/table-format-text-cell-html-cil.json','research/line-style-json-friendly-cil.json',
];
const tests=['research/scripts/probe-rotation-runtime.mjs','research/scripts/probe-rotation-manifest.mjs'];
const probes=JSON.parse(fs.readFileSync('research/rotation-runtime-probes.json','utf8'));
const out={capturedAt:new Date().toISOString(),version:'Axure RP 11.0.0.4150',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',method:'Read-only static ECMA-335 CIL and exact source JavaScript slices in NodeVM with mock sinks; no vendor GUI or assembly execution by this stage',sources:sourceFiles.map(record),evidence:evidenceFiles.map(record),tests:tests.map(record),validation:{originalFunctionProbes:probes.results.length,passed:probes.results.filter(x=>x.pass).length},conclusions:{pureRotation:'degrees clockwise in screen coordinates about unrotated layout center; AABB is separate',fit:'visible eligible children use rotated AABB right/bottom',generalTransform:'field formatting order known; opaque CSS tokens and exact general composition not established',noProductFilesEdited:true}};
fs.writeFileSync('research/rotation-runtime-evidence.json',JSON.stringify(out,null,2)+'\n');
for(const group of ['sources','evidence','tests'])for(const item of out[group])if(hash(item.path)!==item.sha256)throw Error('Changed: '+item.path);
console.log(JSON.stringify({records:out.sources.length+out.evidence.length+out.tests.length,probes:out.validation,manifestSha256:hash('research/rotation-runtime-evidence.json')}));
