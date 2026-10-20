import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {recoverAdaptiveSets} from './scripts/read-rp-adaptive.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const input='research/adaptive-behavior-format-census.json';
const report={method:'Current independent adaptive reader against original sample bytes; no DLL/app execution or original GUI comparison.',samples:[]};
for(const sample of JSON.parse(fs.readFileSync(input,'utf8')).samples){
 assert.equal(sha(sample.file),sample.sha256);
 const decoded=inspectRpObjects(sample.file),result=recoverAdaptiveSets({packages:decoded.packages});
 const supported=result.sets.filter(set=>set.status==='supported-adaptive-set');
 report.samples.push({file:sample.file,sha256:sample.sha256,counts:{supportedSets:supported.length,namedViews:supported.reduce((n,set)=>n+set.views.length,0),unsupportedSets:result.sets.length-supported.length,pages:result.pages.length,assigned:result.pages.filter(page=>page.status==='assigned').length,unassigned:result.pages.filter(page=>page.status==='unassigned').length,unsupportedAssignments:result.pages.filter(page=>page.status==='unsupported-assignment').length,diagnostics:result.diagnostics.length},result});
}
report.totals=Object.fromEntries(Object.keys(report.samples[0].counts).map(key=>[key,report.samples.reduce((sum,sample)=>sum+sample.counts[key],0)]));
report.sources=[input,'research/adaptive-import-sets-census.mjs','research/scripts/read-rp-adaptive.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-container.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/adaptive-import-sets-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.samples.map(sample=>({file:path.basename(sample.file),...sample.counts})),totals:report.totals},null,2));
