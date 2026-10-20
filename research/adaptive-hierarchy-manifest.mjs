import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const entry=p=>({path:p,sha256:sha(p)});
const probe=read('research/adaptive-hierarchy-probe.json');
assert.equal(probe.passed,83);assert.equal(probe.results.length,83);assert.ok(probe.results.every(r=>r.status==='pass'));
for(const s of probe.sources)assert.equal(sha(s.path),s.sha256);
const sources=[...probe.sources,entry(path.join(path.dirname(probe.sources[0].path),'init.temp.js'))];
const evidence=['research/adaptive-hierarchy-evidence.md','research/adaptive-hierarchy-probe.mjs','research/adaptive-hierarchy-probe.json','research/adaptive-hierarchy-manifest.mjs'].map(entry);
const retainedEvidence=['research/adaptive-transition-evidence.md','research/adaptive-transition-evidence.json','research/adaptive-hierarchy-format-generator-cil.json'].map(entry);
const out={schema:'adaptive-hierarchy-evidence-v1',capturedAt:new Date().toISOString(),artifact:probe.artifact,sources,evidence,retainedEvidence,
validation:{exactSourceNodeVmCases:83,actualBrowserCases:0,sourceHashesVerified:true,originalGuiRun:false,productChanged:false},
contract:{selection:'largest eligible width; height tie-break; default-backed upper fallback',baseSize:'independent from canvas size',inheritance:'named baseViewId ancestors first, leaf last',perViewEnabledFieldObserved:false,globalEnable:'document.configuration.useViews',conditionComparatorObserved:false},
limitations:['DOM/style and terminal interaction sinks, not original GUI pixels','Generated default identity omission is static CIL evidence from the parallel format investigation','Generator CSS selectors and master storage not newly recovered','Malformed dimensions/cycles observed only in synthetic bounded probes']};
const file='research/adaptive-hierarchy-evidence.json';fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({path:file,sha256:sha(file),cases:83}));
