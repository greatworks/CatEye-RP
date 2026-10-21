import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entry=path=>({path,sha256:sha(path)});
const reports=['research/selection-layout-render-probes.json','research/selection-layout-render-dom-probes.json','research/selection-layout-render-text-css-probes.json','research/selection-layout-render-browser-probes.json'];
const counts=reports.map(path=>({path,...read(path).summary}));
assert.equal(counts.reduce((n,x)=>n+x.total,0),161);
assert(counts.every(x=>x.total===x.passed&&x.failed===0));
const dependencyPaths=new Set(reports.flatMap(p=>read(p).sources.map(x=>x.path??x.file)));
for(const p of reports)for(const s of read(p).sources)assert.equal(sha(s.path??s.file),s.sha256,p+' stale '+(s.path??s.file));
const originals=[
 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll',
 ...['style.js','doc.js'].map(n=>'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/'+n)
];
assert.equal(sha(originals[0]),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const prior=[
 'research/selection-author-resize-evidence.md','research/selection-author-resize-manifest.json','research/selection-author-resize-census.json',
 'research/selection-layout-transaction-evidence.md','research/selection-layout-transaction-evidence.json','research/selection-layout-transaction-manifest.json',
 'research/selected-style-filter-widget-entry.json','research/selected-style-filter-json-entry.json','research/selected-style-filter-generator-IJeq.json',
 'research/rp-selection-layout-radio-name-writer-cil.json','research/selection-author-resize-storage-cil.json',
 'research/font-size-runtime-evidence.md','research/font-size-runtime-evidence.json','research/text-autofit-base-css-evidence.md','research/text-autofit-base-css-evidence.json'
];
const own=fs.readdirSync('research').filter(n=>n.startsWith('selection-layout-render-')&&!['selection-layout-render-evidence.json','selection-layout-render-manifest.json'].includes(n)).map(n=>'research/'+n);
const all=[...new Set([...dependencyPaths,...originals,...prior,...own])];
for(const p of all)assert(fs.existsSync(p),p);
const evidence={
 target:'Axure RP 11.0.0.4150',scope:'SelectionButton indicator/style output, managed geometry, label DOM, text CSS and runtime AutoFit/Resize.',
 originalGuiCompared:false,vendorDllExecuted:false,
 extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
 summary:{total:161,passed:161,failed:0,retainedCil:121,exactJsNodeVm:18,controlledEdge:22},
 reports:counts,
 findings:[
  {id:'SLR-01',claim:'P94 typed effective numeric property and ScaleX-derived ButtonSize; stored native author legal range not closed.',tokens:[100717685,100717838,100702026]},
  {id:'SLR-02',claim:'P94 belongs to HJCk JSON subset: cctor IL0x197 Add94.',tokens:[100694421]},
  {id:'SLR-03',claim:'Normal/adaptive plus recursive IX state JSON uses same subset with OD/Determined filtering.',tokens:[100694305,100694319,100694323]},
  {id:'SLR-04',claim:'ApplyStyleInfo generator invokes EJep(style,HJCk), permitting P94 output.',tokens:[100703340,100694538]},
  {id:'SLR-05',claim:'XNUc graphic indicator positioning uses distinct short/empty owner-location and long panel+diagram-location branches.',tokens:[100702036]},
  {id:'SLR-06',claim:'CNUW local rect positions indicator by panel height and AlignRight; no graphics inset.',tokens:[100702037]},
  {id:'SLR-07',claim:'mNU6 uses XNUc; N5pp converts source2 to World0; graphics conversion remains explicit sink.',tokens:[100702038,100720541,100720540]},
  {id:'SLR-08',claim:'pNPt wraps indicator and text in absolute label, input emitted after label.',tokens:[100699649,100699510,100699511,100699662]},
  {id:'SLR-09',claim:'Label CSS width/height100%,left0.',tokens:[100699215]},
  {id:'SLR-10',claim:'Selection rNPL consumes premeasured panel, adjusts horizontal padding, omits height; nowrap versus break-word.',tokens:[100699663]},
  {id:'SLR-11',claim:'Original query.resize skips checkbox/radioButton after setResizingRect; ordinary CSS geometry path not entered.'},
  {id:'SLR-12',claim:'Runtime AutoFit candidate width is direct span sum plus padding, no indicator; candidate alignment Move can occur despite Resize no-op.'},
  {id:'SLR-13',claim:'Controlled generated-nesting DOM: direct child text-height absent, AFHeight candidate NaN. Product must retain finite geometry or reject that branch.'},
  {id:'SLR-14',claim:'Single-line plain setter may preserve linked span; absent paragraph direct span gives padding-only AutoFit width.'}
 ],
 boundaries:[
  'No original GUI, vendor DLL execution, native font engine or original full project CSS/pixel comparison.',
  'Geometry provider, graphics unit conversion, font measurements and native CSS/image asset outputs use declared sinks.',
  'Controlled browser font and style are fixture inputs, not recovered native defaults.',
  'Source census exactly39 selection objects; AFHeight false39. No positive stored AFHeight sample.',
  'P94 generation admissibility does not prove all dynamic geometry pixels or legal author range.',
  'NaN downstream movement recorded as sink; no claimed end-to-end original invalid geometry rendering.'
 ],
 sources:[...new Set([...originals,...all.filter(p=>p.startsWith('C:'))])].map(entry),
 evidence:all.filter(p=>!p.startsWith('C:')).map(entry),
 implementation:[],tests:reports.map(entry),screenshots:[],
 report:'research/selection-layout-render-evidence.md'
};
fs.writeFileSync('research/selection-layout-render-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const manifest={scope:'selection-layout-render',files:[...all,'research/selection-layout-render-evidence.json'].map(entry)};
fs.writeFileSync('research/selection-layout-render-manifest.json',JSON.stringify(manifest,null,2)+'\n');
for(const s of manifest.files)assert.equal(sha(s.path),s.sha256);
console.log(JSON.stringify({checks:161,files:manifest.files.length,evidenceSha256:sha('research/selection-layout-render-evidence.json'),manifestSha256:sha('research/selection-layout-render-manifest.json')}));
