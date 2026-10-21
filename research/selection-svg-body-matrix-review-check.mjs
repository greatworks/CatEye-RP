// Read-only audit of retained probe trees and the reviewed renderer snapshot.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const paintPath='research/selection-svg-body-paint-probes-eighth.json';
const paint=read(paintPath), oldManifest=read('research/selection-svg-body-matrix-manifest.json');
for(const item of oldManifest.files)assert.equal(sha(item.path),item.sha256,item.path);
for(const item of paint.sources)assert.equal(sha(item.path),item.sha256,item.path);
const I=[1,0,0,1,0,0],parse=value=>value===undefined?I:value.match(/^matrix\((.*)\)$/)[1].trim().split(/\s+/).map(Number);
const multiply=([a,b,c,d,e,f],[A,B,C,D,E,F])=>[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f].map(n=>Object.is(n,-0)?0:n);
const cases=[];
for(const result of paint.results){
 const nonzero=result.input.origin.some(Boolean), root=result.root, wrapper=result.rootWrapper;
 assert.equal(root.tag,'svg');assert.equal(root.children.length,nonzero?1:3);
 if(nonzero){assert.equal(wrapper.tag,'g');assert.deepEqual(root.children,[wrapper]);}
 else assert.equal(wrapper,null);
 const children=wrapper?.children??root.children;assert.equal(children.length,3);assert.deepEqual(children,result.elements);
 const outer=parse(wrapper?.attrs.transform);assert.deepEqual(outer,result.matrix.outer);
 for(const path of children){assert.equal(path.tag,'path');const inner=parse(path.attrs.transform);assert.deepEqual(inner,result.matrix.path);assert.deepEqual(multiply(outer,inner),I);}
 const reached=new Set(result.trace.map(r=>r.token));
 for(const token of [100720708,100723769,100723480,100723485,100723472])assert(reached.has(token),'Missing native writer method '+token);
 if(nonzero)for(const token of [100723772,100723481,100723538])assert(reached.has(token),'Missing native transform method '+token);
 cases.push({input:result.input,tree:nonzero?'svg > g(T(-O)) > 3 path(T(+O))':'svg > 3 path; identity transforms omitted',net:I,passed:true});
}
const validation=read('.build/selection-svg-body-validation-green.json');
assert.equal(validation.numTotalTests,496);assert.equal(validation.numPassedTests,496);assert.equal(validation.numFailedTests,0);
const renderer='src/model/selection-indicator.ts';
const output='research/selection-svg-body-matrix-review-checks.json';
const sources=[paintPath,'research/selection-svg-body-paint-probe-eighth.mjs','research/selection-svg-body-matrix-manifest.json',renderer,'.build/selection-adaptive-final-snapshot/src/model/selection-indicator.ts','.build/selection-svg-body-validation-green.json','tests/selection-svg-body.test.ts','research/selection-svg-body-matrix-review-check.mjs'];
fs.writeFileSync(output,JSON.stringify({mode:'Read-only source/evidence audit; no product test suite rerun or vendor execution',reviewedRendererSha256:sha(renderer),sourceIdentityChecks:paint.sources.length,previousManifestChecks:oldManifest.files.length,caseCount:cases.length,pathCount:cases.length*3,cases,reportedParentValidation:{readOnly:true,total:validation.numTotalTests,passed:validation.numPassedTests,failed:validation.numFailedTests},sources:sources.map(path=>({path,sha256:sha(path)}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,cases:cases.length,paths:cases.length*3,previousManifest:oldManifest.files.length,sha256:sha(output)}));
