// Bounded comparison of operation ordering only. No vendor DLL or browser.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceFiles=['src/model/vector-commit.ts','src/model/vector-contours.ts','src/model/vector.ts'];
const sourceHashes=sourceFiles.map(path=>({path,sha256:hash(path)}));
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 let js=stripTypeScriptTypes(fs.readFileSync(file,'utf8'),{mode:'transform'});
 const exports=[...js.matchAll(/export (?:function|const|let|class) (\w+)/g)].map(x=>x[1]);
 js=js.replace(/import \{([^}]+)\} from ['"]([^'"]+)['"];?/g,(_m,names,specifier)=>`const {${names}}=require(${JSON.stringify(specifier)});`).replace(/export (?=(?:function|const|let|class) )/g,'');
 js+=`\nObject.assign(module.exports,{${exports.join(',')}});`;
 vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:file})(name=>{assert(name.startsWith('.'));return load(path.resolve(path.dirname(file),`${name}.ts`))},module,module.exports);
 return module.exports;
}
const {commitVectorGeometry}=load('src/model/vector-commit.ts');
const retained=fs.readFileSync('research/native-point-contours-rotation-probe.mjs','utf8').split('const results=[];')[0].replace(/^import .*;\r?$/gm,'');
assert(!/\bfs\.writeFileSync\s*\(/.test(retained));
const ctx={fs,vm,assert,fields,readJson,sha256,structuredClone};
vm.runInNewContext(retained+'\nglobalThis.compare={compose,point,rect};',ctx);
const {compose,point,rect}=ctx.compare;
const results=[],differences=[];
const angles=[1e-5,-1e-5,17,33,45,89.999995,90,180,270,360,-359.999995];
const frames=[rect(0,0,1,1),rect(100,100,1,1),rect(100.25,80.75,1,1),rect(-.25,-.25,1,1),rect(100,100,200,100),rect(0,0,100,1),rect(0,0,1,100)];
const paths=[
 [point(0,0),point(1,0),point(1,1),point(0,1)],
 [point(-.25,0),point(1,0),point(1,1),point(0,1)],
 [point(.25,0),point(1,0),point(1,1),point(.25,1)],
];
for(const frame of frames)for(const angle of angles)for(let shape=0;shape<paths.length;shape++){
 const points=paths[shape],value={fillRule:'nonzero',commands:[...points.map((p,i)=>({op:i?'L':'M',...p})),{op:'Z'}]},widget={...frame,rotation:angle,style:{strokeWidth:1}};
 const expected=compose(frame,angle,points),actual=commitVectorGeometry(widget,value);
 const delta=Math.max(...['x','y','width','height'].map(k=>Math.abs(expected.owner[k]-actual.bounds[k])));
 const row={frame,angle,shape,maximumOwnerDelta:delta};results.push(row);
 if(delta>1e-9)differences.push({...row,input:value,sourceComposed:expected,actual});
}
const report={schema:1,kind:'bounded product operation-order review, retained mapping instructions plus independent numeric composition',sourceHashes,probe:{path:'research/native-point-contours-order-review-probe.mjs',sha256:hash('research/native-point-contours-order-review-probe.mjs')},evidence:[{path:'research/native-point-contours-rotation-probe.mjs',sha256:hash('research/native-point-contours-rotation-probe.mjs')}],checks:{total:results.length,within1e9:results.filter(r=>r.maximumOwnerDelta<=1e-9).length,differences:differences.length},results,differences,sourceStableDuringRun:sourceHashes.every(x=>hash(x.path)===x.sha256),limits:['No original DLL execution: differences can identify product versus retained-world-map composition, not prove exact original CLR rounding.','Numeric fixture rectangles are nondegenerate; no random or unbounded input generation.','Product TypeScript is stripped in memory using Node builtin stripTypeScriptTypes with a narrow import/export adapter; product files are not modified.']};
fs.writeFileSync('research/native-point-contours-order-review-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks,firstDifference:differences[0],sourceStableDuringRun:report.sourceStableDuringRun}));
