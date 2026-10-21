// Bind current evidence bytes. Does not run the vendor or regenerate older reports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const bind=path=>({path,sha256:sha(path)});
const prefix='selection-author-services-';
const dll='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
assert.equal(sha(dll),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const probe=read('research/selection-author-services-probes.json');
assert.equal(probe.passed,73);assert.equal(probe.failed,0);
for(const source of probe.sources)assert.equal(sha(source.path),source.sha256,source.path);
const metadata=read('research/selection-author-services-metadata.json');
const chain=[33557392,33557577,33557598,33557597,33557444,33557056];
for(let n=0;n<chain.length-1;n++) {
 const t=metadata.types.find(t=>t.token===chain[n]);assert(t);
 assert.equal(t.base,chain[n+1]);assert(!t.methods.some(m=>/^get_Min(Width|Height)$/.test(m.name)));
}
assert.equal(metadata.types.find(t=>t.name==='RadioButton').base,33557577);
const rectStatic=read('research/native-point-contours-topology-rect-static-cil.json').Types.flatMap(t=>t.Methods).find(m=>m.Token===100722161).Instructions;
assert.deepEqual(rectStatic.filter(i=>[33,42,51,60].includes(i.Offset)).map(i=>[i.Op,i.Operand]),Array.from({length:4},()=>['ldc.r8',0]));
assert(rectStatic.some(i=>i.Offset===74&&i.Op==='stsfld'&&i.Operand===67134732));
const oldEvidence=[
 'research/selection-layout-transaction-evidence.md','research/selection-layout-transaction-evidence.json',
 'research/selection-layout-transaction-manifest.json','research/selection-layout-transaction-probes.json',
 'research/selection-layout-border-evidence.md','research/selection-layout-border-evidence.json',
 'research/selection-layout-border-manifest.json','research/selection-author-resize-evidence.md',
 'research/selection-author-resize-census.json','research/selection-author-resize-defaults-cil.json',
 'research/native-layers-format-extract.ps1'];
const currentFiles=fs.readdirSync('research').filter(n=>n.startsWith(prefix)&&!['selection-author-services-evidence.json','selection-author-services-manifest.json'].includes(n)).map(n=>'research/'+n);
const claims=[
 {id:'SAS-01',claim:'Inherited minimum getters are1/1; xJdR applies active Transform scales with exact-zero fallback1.',tokens:[100695442,100695443,100695441],kind:'retained-CIL+metadata+bounded replay'},
 {id:'SAS-02',claim:'H5px excludes near-zero sentinel/NaN then optional any-near-zero-axis; finite union preserves min/max operation order.',tokens:[100720524,100722161,100722129,100722133,100722085,100722088,100688812,100688813],kind:'retained-CIL+bounded replay'},
 {id:'SAS-03',claim:'N5pp2→0 uses point-pair transform. Identity matrix context yields2×2; UI zoom/DPI-to-context binding is not recovered.',tokens:[100720541,100720540,100721064,100727484,100727399,100727401,100723592],kind:'retained control replay with explicit matrix facade'},
 {id:'SAS-04',claim:'Fit setters changed-only OI8Z(true); AlignRight changed-only WIyL then VJm0(false,null); P94 preliminary expansion then gated OI8Z(false).',tokens:[100702343,100702367,100702032,100702033,100702383],kind:'retained-CIL event-sink replay'},
 {id:'SAS-05',claim:'LocationInDiagram only adds direct KJm7-parent chain. Nested diagram construction/default creation remains bounded.',tokens:[100695389,100695467,100695468,100700290,100700291,100695101],kind:'retained metadata/CIL plus two explicit-parent replay cases'}
];
const report={
 stage:'selection-author-services',sourceVersion:'Axure RP11.0.0.4150',
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0',
 extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 sourceDll:bind(dll),execution:{vendorDll:false,vendorGui:false,browser:false,kind:'Static PE extraction and retained CIL-record interpreter with documented facades',checks:73,passed:73,failed:0},
 claims,
 implementationContract:{
  minimum:{scope:'ordinary no general Transform',width:1,height:1},
  union:{finiteNonnegative:true,epsilon:1e-5,comparison:'strict less than',ignoreEmptyPredicate:'abs(width)<epsilon OR abs(height)<epsilon',sentinel:'all four near zero, independent of ignoreEmpty',twoEmptyOrder:'return B when A is excluded'},
  inset:{sourceSpace:2,destinationSpace:0,identityMatrixResult:{width:2,height:2},browserCSSIdentity:'independent explicitly selected unit context',nativeZoom1Equivalence:false},
  entry:{fit:'changed flag then OI8Z(true)',alignRight:'changed flag then WIyL then VJm0(false,null)',p94:'preliminary width expansion then TextRect.MIue gates then OI8Z(false)'},
  initialP94Default:null,toolboxFitDefaultsProven:false,nestedScopeProven:false
 },
 retainedFailures:currentFiles.filter(p=>/failure-\d+\.json$/.test(p)).map(bind),
 boundaries:[
  'KIf5 font measurement and original Windows rendering remain unexecuted.',
  'Graphics matrix inversion and point conversion are explicit facades; integer and power-of-two cases exercise retained control flow.',
  'No complete DPI/zoom-to-matrix initialization or arbitrary nested scope mapping is claimed.',
  'Nonfinite/negative geometry admission is a separate product safety policy.',
  'P94 ordered author notification is recovered evidence; parent implementation currently stages it separately from Size/Fit/AlignRight.',
  'Creation defaults are not inferred from39 real sample values or raw field zero initialization.',
  'No product, old report, original sample, browser/test artifact or release was changed.'
 ],
 sources:[bind(dll),...probe.sources],
 evidence:[...new Set([...oldEvidence,...currentFiles])].map(bind)
};
fs.writeFileSync('research/selection-author-services-evidence.json',JSON.stringify(report,null,2)+'\n');
const paths=[...new Set([dll,...probe.sources.map(s=>s.path),...oldEvidence,...currentFiles,'research/selection-author-services-evidence.json'])].sort();
const manifest={stage:'selection-author-services',kind:'Final frozen source/evidence byte manifest; no parity claim',checks:73,files:paths.map(bind)};
fs.writeFileSync('research/selection-author-services-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({checks:73,files:paths.length,evidence:bind('research/selection-author-services-evidence.json'),manifest:bind('research/selection-author-services-manifest.json')},null,2));
