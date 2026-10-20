import fs from 'node:fs';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const baseline=readJson('research/rich-hyperlink-format-census.json');
const samples=[];
for(const sample of baseline.samples){const d=inspectRpObjects(sample.file);if(d.fileSha256!==sample.sha256)throw Error('Sample changed');const matches=[];let objects=0,packages=0;const actionTypes={};for(const p of d.packages){if(!p.objects)continue;packages++;for(const o of p.objects){objects++;if(/Interaction.*Action/.test(o.type))actionTypes[o.type]=(actionTypes[o.type]??0)+1;if(/Rotate/i.test(o.type))matches.push({packagePath:p.path,packageSha256:p.sha256,version:p.version,sourceId:o.id,type:o.type,properties:o.properties});}}samples.push({file:sample.file,sha256:sample.sha256,packages,objects,matches,actionTypes});}
const report={scope:'All successfully decoded object records in the retained 11 real RP/RPLIB corpus; exact object type contains Rotate; no target execution or import claim.',sources:[{file:'research/scripts/read-rp-objects.mjs',sha256:sha256('research/scripts/read-rp-objects.mjs')},{file:'research/rich-hyperlink-format-census.json',sha256:sha256('research/rich-hyperlink-format-census.json')}],samples,totals:{samples:samples.length,objects:samples.reduce((s,x)=>s+x.objects,0),rotateObjects:samples.reduce((s,x)=>s+x.matches.length,0)}};
fs.writeFileSync('research/runtime-rotate-format-census.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.totals));
