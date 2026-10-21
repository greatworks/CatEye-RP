import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const previous=read('research/selection-svg-body-matrix-manifest.json'),writer=read('research/selection-svg-body-paint-manifest.json');
for(const f of [...previous.files,...writer.files])assert.equal(sha(f.path),f.sha256,f.path);
const output='research/selection-svg-body-matrix-supplement-manifest.json';
const fileSet=new Set(fs.readdirSync('research').filter(n=>n.startsWith('selection-svg-body-matrix-')&&'research/'+n!==output).map(n=>'research/'+n));
for(const f of [...previous.files,...writer.files])fileSet.add(f.path);
for(const file of ['research/selection-svg-body-matrix-radio-dot-probes.json','research/selection-svg-body-matrix-radio-dot-pixel-probes.json']){
 const d=read(file);for(const f of d.sourceFiles)fileSet.add(f.path);fileSet.add(d.engine.path);
}
for(const file of ['research/selection-svg-body-matrix-zero-scope-probes-second.json','research/selection-svg-body-matrix-review-checks.json','research/selection-svg-body-matrix-final-review-checks-second.json'])for(const f of read(file).sources)fileSet.add(f.path);
fileSet.add('research/selection-svg-body-paint-manifest.json');
const files=[...fileSet].sort().map(path=>({path,sha256:sha(path)}));
const result={date:'2026-10-21',scope:'Supplemental retained-CIL zero-angle scope/radio-dot closure and read-only final renderer/writer audit',sourceDllSha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',previousMatrixManifestVerified:previous.files.length,writerManifestVerified:writer.files.length,evidenceCounts:{mainMatrixCases:18,upstreamZeroScopeCases:4,radioDotPixelFalseCases:2,radioDotPixelTrueCases:2,finalWriterTrees:20,finalWriterPaths:60,finalProductDotProjections:10},reviewedProductSha256:sha('src/model/selection-indicator.ts'),parentValidationReadOnly:{total:536,passed:536,rerun:false},files,limitations:['No target DLL execution or original GUI retry','No full original pixel-equivalence claim','Counts denote different bounded probes; they are not one combined product suite','First zero-scope host failure and first audit-host/tooling failures are retained']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
for(const f of read(output).files)assert.equal(sha(f.path),f.sha256,f.path);
console.log(JSON.stringify({output,verified:files.length,sha256:sha(output)}));
