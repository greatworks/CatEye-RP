// Freeze new research and its bounded independent implementation only.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const bind=path=>({path,sha256:hash(path)});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const assembly='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const expected='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
if(hash(assembly)!==expected)throw Error('Unpinned original assembly');
const probes=read('research/native-point-editing-evidence-probes.json'),geometry=read('research/native-point-editing-evidence-geometry.json');
const testFile='.build/native-point-editing-geometry-related-green.json',unit=read(testFile);
if(unit.numFailedTests||probes.results.length!==21||geometry.cases.length!==384)throw Error('Incomplete validation');
const research=fs.readdirSync('research').filter(name=>name.startsWith('native-point-editing-evidence')&&!['native-point-editing-evidence.json'].includes(name)).map(name=>'research/'+name);
const dependencies=[...new Set([...probes.sources,...geometry.sources].map(s=>s.path))];
const report={schema:1,capturedAt:new Date().toISOString(),scope:'Parameter rectangle point-edit source geometry and bounded static conversion/history investigation',method:'Static ECMA-335 metadata/CIL reading and bounded CIL instruction replay; no original DLL or GUI execution',original:{version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},sources:[bind(assembly),...dependencies.map(bind)],evidence:research.map(bind),implementation:['src/model/vector-authoring.ts','src/model/line-style.ts'].map(bind),tests:['tests/native-point-editing-geometry.test.ts','.build/native-point-editing-geometry-red.json','.build/native-point-editing-geometry-green-first.json','.build/native-point-editing-geometry-green.json','.build/native-point-editing-unsupported-red.json','.build/native-point-editing-geometry-final-green.json',testFile].map(bind),summary:{cilControlCases:probes.results.length,cilGeometryCases:geometry.cases.length,focusedTests:unit.numTotalTests,focusedFailures:unit.numFailedTests,typecheck:'npx tsc --noEmit exit0'},limits:['Full GUI Edit Points entry/no-op/cancel/undo dispatch not observed.','Partial-border parametric and independent four-radius displays block editing; genuine explicit paths remain editable.','Normal adaptive author-style context is a bounded product choice, not proven for all native effect-preview modes.','Original commit can re-bound geometry and disable AutoFit; this pure helper does neither.','Shape setter changes a default-style-chain member; no blanket final effective-style invariance claim.','Coordinate comparisons are retained-CIL interpretation, not original GUI or generated-page pixels.']};
fs.writeFileSync('research/native-point-editing-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({path:'research/native-point-editing-evidence.json',sha256:hash('research/native-point-editing-evidence.json'),summary:report.summary}));
