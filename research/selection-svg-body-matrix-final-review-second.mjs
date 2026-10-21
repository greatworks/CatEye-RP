// Final read-only matrix tree and radio-subpath audit. No old outputs are written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const paintFile='research/selection-svg-body-paint-probes-final.json', paint=read(paintFile);
const paintManifest=read('research/selection-svg-body-paint-manifest.json');
for(const f of paintManifest.files)assert.equal(sha(f.path),f.sha256,f.path);
const matrixManifest=read('research/selection-svg-body-matrix-manifest.json');
for(const f of matrixManifest.files)assert.equal(sha(f.path),f.sha256,f.path);
const rendererFile='src/model/selection-indicator.ts', rendererText=fs.readFileSync(rendererFile,'utf8');
const compiled=stripTypeScriptTypes(rendererText).replace('export function createSelectionIndicatorRenderer','function createSelectionIndicatorRenderer');
const renderer=new Function(compiled+'\nreturn createSelectionIndicatorRenderer();')();
const I=[1,0,0,1,0,0], parse=value=>value===undefined?I:value.match(/^matrix\((.*)\)$/)[1].trim().split(/\s+/).map(Number);
const mult=([a,b,c,d,e,f],[A,B,C,D,E,F])=>[a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f].map(n=>Object.is(n,-0)?0:n);
const numeric=d=>d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
const matrixCases=[], dotCases=[];
for(const r of paint.results){
 const nonzero=r.input.origin.some(Boolean),wrapper=r.rootWrapper;
 const paths=wrapper?.children??r.root.children;
 assert.deepEqual(paths,r.elements);assert.equal(paths.length,3);
 if(nonzero)assert.deepEqual(r.root.children,[wrapper]);else {assert.equal(wrapper,null);assert.equal(r.root.children.length,3);}
 for(const p of paths)assert.deepEqual(mult(parse(wrapper?.attrs.transform),parse(p.attrs.transform)),I);
 matrixCases.push({input:r.input,passed:true,pathCount:paths.length});
 if(r.input.type!=='radio')continue;
 const b=r.input.b,w=r.input.width;
 const widget={type:'radio',rotation:0,style:{selectionButtonSize:b,strokeWidth:w,radius:0,fill:'#ffffff',stroke:'#123456'}};
 const actual=renderer.geometry(widget).dotPath, expected=r.elements[2].attrs.d;
 assert.deepEqual(actual.match(/[a-df-z]/gi),['M','C','C','C','C']);
 assert.deepEqual(expected.match(/[a-df-z]/gi),['M','C','C','C','C']);
 const a=numeric(actual),e=numeric(expected);assert.equal(a.length,26);assert.equal(e.length,26);
 a.forEach((n,i)=>assert(Math.abs(n-e[i])<1e-12,`native point ${b}/${w}/${i}: ${n} vs ${e[i]}`));
 assert.deepEqual(a.slice(0,2),[b/2,3*b/4]);assert.deepEqual(a.slice(-2),a.slice(0,2));
 const endpoints=[a.slice(6,8),a.slice(12,14),a.slice(18,20),a.slice(24,26)];
 assert.deepEqual(endpoints,[[b/4,b/2],[b/2,b/4],[3*b/4,b/2],[b/2,3*b/4]]);
 dotCases.push({input:r.input,actual,expected,maxAbsDifference:Math.max(...a.map((n,i)=>Math.abs(n-e[i]))),commands:['M','C','C','C','C'],endpoints,explicitClose:false,passed:true});
}
const parent=read('.build/selection-svg-body-dot-green.json');
assert.equal(parent.numTotalTests,536);assert.equal(parent.numPassedTests,536);assert.equal(parent.numFailedTests,0);
const output='research/selection-svg-body-matrix-final-review-checks-second.json';
const sources=[paintFile,'research/selection-svg-body-paint-manifest.json','research/selection-svg-body-matrix-manifest.json',rendererFile,'research/selection-svg-body-matrix-radio-dot-pixel-probes.json','.build/selection-svg-body-dot-green.json','research/selection-svg-body-matrix-final-review-second.mjs'];
fs.writeFileSync(output,JSON.stringify({mode:'Read-only product factory projection against independently frozen native CIL writer oracle; no suite rerun or vendor execution',paintManifestVerified:paintManifest.files.length,matrixManifestVerified:matrixManifest.files.length,nodeTypeStripperVersion:process.version,matrixCases,dotCases,reportedParentValidation:{readOnly:true,total:parent.numTotalTests,passed:parent.numPassedTests,failed:parent.numFailedTests},sources:sources.map(path=>({path,sha256:sha(path)}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,matrices:matrixCases.length,paths:matrixCases.length*3,dots:dotCases.length,paintManifest:paintManifest.files.length,rendererSha256:sha(rendererFile),sha256:sha(output)}));
