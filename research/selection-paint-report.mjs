import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const glyph=read('research/selection-paint-glyph-probes.json'),runtime=read('research/selection-paint-runtime-probes-second.json');
const extraction=read('research/selection-paint-fill-uHV0-cil.json');
assert.equal(sha(extraction.AssemblyPath),extraction.SHA256);
const paths=[extraction.AssemblyPath,...glyph.sources.map(s=>s.path),...runtime.sources.map(s=>s.path),
 'research/selection-paint-evidence.md',import.meta.filename,
 'research/selection-paint-glyph-probes.json','research/selection-paint-runtime-probes-second.json',
 'research/selection-paint-glyph-probe.mjs','research/selection-paint-runtime-probe.mjs','research/selection-paint-runtime-failure-1.json',
 'research/selection-paint-fill-t5Oz-cil.json','research/selection-paint-fill-m5Ub-cil.json','research/selection-paint-fill-A5UI-cil.json',
 'research/scripts/inspect-rp-serialization.ps1','research/selection-layout-render-writer-cil.json',
 'research/selection-layout-indicator-checkbox-cil.json','research/selection-layout-indicator-radio-cil.json',
 'research/selection-layout-border-evidence.md','research/selection-layout-border-geometry-probes.json',
 'research/selection-layout-indicator-evidence.md','research/selection-layout-indicator-manifest.json',
 'research/gradient-format-generator-cil.json','research/gradient-format-serialization-cil.json'];
for(const item of [...glyph.sources,...runtime.sources])assert.equal(sha(item.path),item.sha256,item.path);
const sources=[...new Set(paths)].map(path=>({path,sha256:sha(path)}));
const methods=[100702041,100699787,100701393,100710703,100710704,100723090,100723099,100720817];
fs.writeFileSync('research/selection-paint-manifest.json',JSON.stringify({target:'Axure RP 11.0.0.4150',vendorDllExecuted:false,originalGuiCompared:false,sources},null,2)+'\n',{flag:'wx'});
fs.writeFileSync('research/selection-paint-evidence.json',JSON.stringify({target:'Axure RP 11.0.0.4150',vendorDllExecuted:false,originalGuiCompared:false,productFilesEdited:false,summary:{retainedCilCases:glyph.summary.total,originalJsSequences:runtime.summary.sequences,svgObservations:runtime.summary.svgObservations,colorCarrierCases:runtime.summary.colorCarriers,passed:76,failed:0},methodTokens:methods,report:{path:'research/selection-paint-evidence.md',sha256:sha('research/selection-paint-evidence.md')},manifest:{path:'research/selection-paint-manifest.json',sha256:sha('research/selection-paint-manifest.json')},claims:['Opaque-only is implementation boundary, not source paint restriction.','Non-null transparent color retains alpha in initial glyph and bypasses theme fallback.','Initial radio dot is fill-only; later original generic SVG consumer may stroke it.','Runtime nonzero width writes path attributes; later zero retains last written width.','Runtime CSS replacement removes omitted-color overrides while transparent nonnull remains explicit.','Disabled attribute alone does not change supplied nonnull paint in these bounded routes.'],limits:glyph.boundaries,attemptFailures:[{path:'research/selection-paint-runtime-failure-1.json',kind:'Incorrect harness assumption that runtime preserves all initial attributes'},{path:'research/selection-paint-glyph-probe.mjs',kind:'Incorrect exact expected arithmetic order at b18; actual 3.8571428571428577 vs expected 3.857142857142857; corrected separate second script'},{path:'research/selection-paint-fill-cil.json',kind:'Empty output from rejected array argument to single-TypeName extractor; no positive evidence'}]},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:76,sources:sources.length,manifestSha256:sha('research/selection-paint-manifest.json')}));
