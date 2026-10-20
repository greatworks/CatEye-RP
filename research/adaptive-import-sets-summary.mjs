import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const record=file=>({file,sha256:sha(file)});
const census=JSON.parse(fs.readFileSync('research/adaptive-import-sets-census.json','utf8'));
const sources=[
 'research/scripts/read-rp-adaptive.mjs','research/scripts/read-rp-adaptive.test.mjs',
 'research/scripts/read-rp-objects.mjs','research/scripts/read-rp-container.mjs',
 'research/adaptive-hierarchy-format-view-cil.json','research/adaptive-hierarchy-format-set-cil.json',
 'research/adaptive-hierarchy-format-generator-cil.json','research/adaptive-hierarchy-format-literals.json',
 'research/gradient-angle-version-cil.json',
 'research/adaptive-behavior-format-document-cil.json','research/adaptive-behavior-format-set-lookup-cil.json',
 'research/adaptive-behavior-format-set-predicate-cil.json','research/adaptive-behavior-format-page-cil.json',
 'research/adaptive-behavior-format-scope-set-cil.json','research/adaptive-behavior-format-page-type-cil.json',
 'research/adaptive-behavior-format-master-type-cil.json','research/adaptive-behavior-format-census.json',
 'research/adaptive-hierarchy-format-census.json'
];
const method=(file,token)=>JSON.parse(fs.readFileSync(file,'utf8')).Types.flatMap(t=>t.Methods??[]).find(m=>m.Token===token);
const bridgeFile='research/adaptive-import-sets-bridge.json';
fs.writeFileSync(bridgeFile,JSON.stringify({
 method:'Exact retained CIL/decoded-literal selection, without target execution.',
 sources:sources.filter(file=>file.endsWith('-cil.json')||file.endsWith('-literals.json')).map(record),
 cursor:{enum:JSON.parse(fs.readFileSync('research/adaptive-import-sets-metadata.json','utf8')),getter:method('research/adaptive-hierarchy-format-view-cil.json',100715604),writer:{token:100694304,literal:{il:384,text:'cursor'},instructions:method('research/adaptive-hierarchy-format-generator-cil.json',100694304).Instructions.filter(i=>i.Offset>=384&&i.Offset<=396)}},
 modernVersionBranch:{token:100715631,threshold:'cbzf = 9.0.0.0 (existing version-initializer evidence)',instructions:method('research/adaptive-hierarchy-format-view-cil.json',100715631).Instructions.filter(i=>(i.Offset>=522&&i.Offset<=575)||(i.Offset>=670&&i.Offset<=686))}
},null,2)+'\n');
const evidenceFile='research/adaptive-import-sets-evidence.json';
fs.writeFileSync(evidenceFile,JSON.stringify({
 target:{version:'Axure RP 11.0.0.4150',sha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'},
 method:'Pure self-written decoded package reader; retained static CIL/metadata and original-byte corpus inspection. No target DLL/app, original GUI, or generated original page execution.',
 schema:1,entryPoint:'recoverAdaptiveSets({packages})',
 identities:{base:'19e82109f102476f933582835c373474',auto:'982030d673df45868f11149ca2b8b02f',sourceId:'native object identity',id:'stored Id Guid'},
 completeSetRequirements:['unique DesignDocument declaration','package-local typed reference resolution','exact tagged Guid/reference carriers','unique set/named identities','Base sentinel self-parent','view back-reference to declaring set object','complete same-set parent graph','finite nonnegative dimensions','known Cursor enum','required modern fields and no unknown definition properties'],
 pageAssignment:{authority:'Page.AdaptiveViewSetId, resolved by stored set ID within the unique DesignDocument',directReference:'retained; nonzero is diagnosed but cannot supersede the Page getter',zero:'unassigned',unresolved:'unsupported-assignment; no view inference from match/style caches'},
 cursor:{Desktop:0,Touch:1,retained:true,productBoundary:'Independent player shell cursor behavior is not implemented by this reader; consumer must retain source metadata and report its omission.'},
 oldReportCorrection:'Frozen adaptive-hierarchy-format-evidence.md incorrectly summarized all three Base sizes as zero. Its original census and current byte-verified reader show Starter Base 1366x1000; Default/Flow are 0x0. Old evidence files remain unchanged.',
 totals:census.totals,
 bases:census.samples.flatMap(s=>s.result.sets.filter(v=>v.status==='supported-adaptive-set').map(v=>({file:s.file,sha256:s.sha256,packageId:v.packageId,sourceId:v.sourceId,id:v.id,base:v.base,provenance:v.provenance}))),
 tests:{focused:41,passed:41,failed:0,synthetic:38,originalSample:3,log:'.build/adaptive-import-sets-green.log',red:'.build/adaptive-import-sets-red.log'},
 limits:{namedViewsPerSet:50,sets:100,dimensions:[0,100000],packages:10000,objects:200000,diagnostics:12000,meaning:'Independent parser/product bounds, not claims about native UI limits.'},
 unknowns:['No complete named-view corpus witness; all nontrivial hierarchies are explicitly synthetic tests.','Master direct-set ownership and diagram-specific overrides are outside this module.','No inferred generation ordinal IDs, global useViews setting, widget styles, actions or events.','No claim that every file at an accepted object version is compatible; only the complete supported serialized graph is admitted.'],
 sources:sources.map(record),samples:census.samples.map(s=>({file:s.file,sha256:s.sha256,counts:s.counts}))
},null,2)+'\n');
const files=['research/adaptive-import-sets-metadata.ps1','research/adaptive-import-sets-metadata.json','research/adaptive-import-sets-census.mjs','research/adaptive-import-sets-census.json','research/adaptive-import-sets-fixture.mjs',bridgeFile,evidenceFile,'research/adaptive-import-sets-evidence.md','research/adaptive-import-sets-summary.mjs','.build/adaptive-import-sets-red.log','.build/adaptive-import-sets-green.log'];
const manifest={method:'SHA256 of final isolated reader scope and evidence; no historical files rewritten.',sources:sources.map(record),files:files.map(record),samples:census.samples.map(s=>({file:s.file,sha256:s.sha256}))};
for(const entry of [...manifest.sources,...manifest.files,...manifest.samples])if(sha(entry.file)!==entry.sha256)throw Error(`Hash mismatch ${entry.file}`);
const output='research/adaptive-import-sets-manifest.json';fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({manifest:output,sha256:sha(output),verified:manifest.sources.length+manifest.files.length+manifest.samples.length,totals:census.totals},null,2));
