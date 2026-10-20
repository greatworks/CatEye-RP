// Freeze this new source-contract bundle only; never rewrites previous milestones.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const prefix='research/native-point-contours-topology-',probe=readJson(`${prefix}probes.json`);
for(const source of probe.sources)assert.equal(sha256(source.path),source.sha256,source.path);
assert.equal(sha256(probe.probe.path),probe.probe.sha256);
assert.equal(sha256(probe.assembly.path),probe.assembly.sha256);
assert.equal(probe.checks.total,65);assert.equal(probe.checks.passed,65);
const evidence={kind:'native-point-contours-topology-source-contract',generatedAt:new Date().toISOString(),originalAssemblyExecuted:false,originalGuiCompared:false,assembly:probe.assembly,checks:probe.checks,methodsReplayed:probe.methodsReplayed.length,
 conclusions:{entry:'Kj3n -> TN46(points,false) -> hN4K; not RN4I',temporaryEdges:'cyclic Last->First then consecutive, independent of outgoing flag',degenerate:'strict Manhattan endpoint < .001 and line flag or both corresponding handle distances < .001',singleton:'after pruning retain one curve only when endpoint Manhattan < 1',relink:'dense global indexes; cyclic previous/next pointers only inside each contour; no outgoing-bit rewrite',unrotated:'bounds include retained Y5XV=true curves; if all temporary contours pruned use first raw anchor; if curves remain but selected bounds empty use zero rectangle',rotated:'inverse old-center transform before filtering; bounds include all retained curves, including Y5XV=false; empty union zero then forward-center/round/minimum; no first-anchor fallback',output:'normalize every original raw point/handle and preserve outgoing flags; do not normalize filtered curve lists',emptyOrdinaryEntry:'Kj3n ordinary jj3z=false with zero nodes does not call TN46; direct geometry empty-list behavior is not GUI commit permission'},
 representationBoundary:{authoredAdapter:'M/L/C/Z only; absent inactive endpoint handles represented as NaN; explicit duplicate command endpoints retained',nativeImporter:'No production change; native raw contours shorter than two points/interior false outgoing flags still rejected; painted snapshot is not a lossless inverse carrier'},
 evidence:[{path:`${prefix}evidence.md`,sha256:sha256(`${prefix}evidence.md`)},{path:`${prefix}probes.json`,sha256:sha256(`${prefix}probes.json`)},probe.probe],sources:probe.sources,limits:probe.limits};
fs.writeFileSync(`${prefix}evidence.json`,JSON.stringify(evidence,null,2)+'\n');
const files=fs.readdirSync('research').filter(n=>n.startsWith('native-point-contours-topology-')&&!n.includes('-review-')&&!n.endsWith('-manifest.json')).map(n=>({path:`research/${n}`,sha256:sha256(`research/${n}`)}));
const manifest={kind:'native-point-contours-topology-manifest',generatedAt:new Date().toISOString(),originalAssemblyExecuted:false,originalGuiCompared:false,assembly:probe.assembly,checks:probe.checks,methodsReplayed:probe.methodsReplayed.length,files,sources:probe.sources};
fs.writeFileSync(`${prefix}manifest.json`,JSON.stringify(manifest,null,2)+'\n');
for(const item of [...files,...probe.sources])assert.equal(sha256(item.path),item.sha256,item.path);
console.log(JSON.stringify({checks:probe.checks,methods:probe.methodsReplayed.length,files:files.length,sources:probe.sources.length,manifestSha256:sha256(`${prefix}manifest.json`),evidenceSha256:sha256(`${prefix}evidence.json`)}));
