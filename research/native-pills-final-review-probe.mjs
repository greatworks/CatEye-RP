// Independent current-product review. No browser, native DLL or vendor GUI execution.
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import {createLineStyleRenderer} from '../src/model/line-style.ts';
import {recoverRectanglePath,property} from './scripts/read-rp-semantics.mjs';

const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind=p=>({path:p,sha256:hash(p)});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const clone=structuredClone;
const normalize=x=>JSON.parse(JSON.stringify(x??null));
const sources=[
 'src/model/line-style.ts','research/scripts/read-rp-semantics.mjs',
 '.build/before-native-pills/src/model/line-style.ts',
 '.build/before-native-pills/research/scripts/read-rp-semantics.mjs',
 'research/native-pills-format-inventory.json',
 'research/native-pills-evidence.md','research/native-pills-evidence.json',
 'research/native-pills-evidence-probes.json',
 'research/native-pills-final-review-probe.mjs',
].map(bind);
const oldFactory=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync(sources[2].path,'utf8')).replace('export function','function')+';createLineStyleRenderer');
const old=oldFactory(),current=createLineStyleRenderer(),portable=vm.runInNewContext(`(${createLineStyleRenderer.toString()})()`);
const oldReaderSource=fs.readFileSync(sources[3].path,'utf8');
const oldReaderFrom=oldReaderSource.indexOf('export function recoverRectanglePath('),oldReaderTo=oldReaderSource.indexOf('\n/**',oldReaderFrom);
if(oldReaderFrom<0||oldReaderTo<0)throw Error('Old reader slice not found');
const oldReader=Function('property',`return (${oldReaderSource.slice(oldReaderFrom,oldReaderTo).replace('export function','function')})`)(property);
const inventory=read('research/native-pills-format-inventory.json'),pills=inventory.owners.filter(o=>o.shape===0&&o.observed.vertexCounts.length===1&&o.observed.vertexCounts[0]===6&&o.effective['81']?.value===15);
const results=[],owners=[];
function check(name,observed,expected){observed=normalize(observed);expected=normalize(expected);results.push({name,pass:isDeepStrictEqual(observed,expected),observed,expected});}
const widget=o=>({type:'box',width:o.size.Width,height:o.size.Height,vectorPath:clone(o.vectorPath),style:{radius:o.effective['71'].value,cornerVisibility:[true,true,true,true],strokeWidth:1}});
const set=(map,key,value)=>{const pair=map.$map.find(x=>x[0]===key);if(!pair)throw Error(`Missing ${key}`);pair[1]=value;};
check('exact-original-evidence-frozen-pass-count',read('research/native-pills-evidence-probes.json').summary,{passed:58,failed:0});
check('real-full-mask-six-point-corpus',pills.length,28);
for(const o of pills){
 const w=widget(o),r=Math.min(o.size.Width,o.size.Height)/2,expected={cornerRadii:[r,r,r,r],evidence:'Stored Shape=0, perimeter vertices and observed cubic corner handles; dimensions from stored SIZE'};
 check(`reader-six-point-${o.sourceId}`,recoverRectanglePath(o.rawControlPoints,w.width,w.height),expected);
 check(`baseline-reader-six-point-reject-${o.sourceId}`,oldReader(o.rawControlPoints,w.width,w.height),null);
 let cycles=0;for(let shift=0;shift<6;shift++){const raw=clone(o.rawControlPoints);raw[0]=[...raw[0].slice(shift),...raw[0].slice(0,shift)];if(isDeepStrictEqual(recoverRectanglePath(raw,w.width,w.height),expected))cycles++;}
 check(`reader-all-cyclic-starts-${o.sourceId}`,cycles,6);
 for(const [mode,renderer]of [['module',current],['serialized',portable]]){
  check(`${mode}-corners-and-sides-${o.sourceId}`,[renderer.supportsCorners(w),renderer.supportsSides(w)], [true,true]);
  const resized={...w,width:81,height:247};
  check(`${mode}-resized-family-${o.sourceId}`,[renderer.supportsCorners(resized),renderer.supportsSides(resized),Boolean(renderer.vectorRectangle(resized))],[true,true,true]);
  check(`${mode}-legacy-no-mask-path-retained-${o.sourceId}`,renderer.vectorRectangle({...w,style:{radius:0,strokeWidth:1}}),null);
 }
 // Default public strict validator remains byte-for-byte equivalent in behavior;
 // only the internal allowLarge family qualification may gain acceptance.
 check(`default-public-validator-unchanged-${o.sourceId}`,current.rectangleRadii(w.vectorPath,w.width,w.height),old.rectangleRadii(w.vectorPath,w.width,w.height));
 const rawRejects=[];
 for(let i=0;i<6;i++){
  for(const field of ['Path','LowerHandle','HigherHandle'])for(const axis of ['X','Y']){
   const raw=clone(o.rawControlPoints),point=property(raw[0][i],field),before=property(point,axis);
   set(point,axis,Number.isFinite(before)?before+.01:.12345);
   rawRejects.push({mutation:`${i}.${field}.${axis}`,rejected:recoverRectanglePath(raw,w.width,w.height)===null});
  }
  const raw=clone(o.rawControlPoints);set(raw[0][i],'HigherSegmentExists',false);rawRejects.push({mutation:`${i}.false-segment`,rejected:recoverRectanglePath(raw,w.width,w.height)===null});
 }
 const extra=clone(o.rawControlPoints);extra.push(clone(extra[0]));rawRejects.push({mutation:'second-contour',rejected:recoverRectanglePath(extra,w.width,w.height)===null});
 const reversed=clone(o.rawControlPoints);reversed[0].reverse();for(const p of reversed[0]){const lower=property(p,'LowerHandle');set(p,'LowerHandle',property(p,'HigherHandle'));set(p,'HigherHandle',lower);}rawRejects.push({mutation:'counterclockwise-reversed-handles',rejected:recoverRectanglePath(reversed,w.width,w.height)===null});
 check(`reader-anchor-handle-segment-and-contour-rejections-${o.sourceId}`,{count:rawRejects.length,failures:rawRejects.filter(x=>!x.rejected)},{count:44,failures:[]});
 const pathRejects=[];
 for(let i=0;i<w.vectorPath.commands.length;i++)for(const key of ['x','y','x1','y1','x2','y2'])if(Number.isFinite(w.vectorPath.commands[i][key])){
  const changed=clone(w);changed.vectorPath.commands[i][key]+=.001;
  pathRejects.push({mutation:`${i}.${key}`,rejected:!current.supportsCorners(changed)&&!portable.supportsCorners(changed)});
 }
 const open=clone(w);open.vectorPath.commands=open.vectorPath.commands.filter(c=>c.op!=='Z');pathRejects.push({mutation:'remove-Z',rejected:!current.supportsCorners(open)&&!portable.supportsCorners(open)});
 const multi=clone(w);multi.vectorPath.commands.push({op:'M',x:.2,y:.2},{op:'Z'});pathRejects.push({mutation:'extra-closed-contour',rejected:!current.supportsCorners(multi)&&!portable.supportsCorners(multi)});
 const zeroC=clone(w),p=zeroC.vectorPath.commands[0];zeroC.vectorPath.commands.splice(1,0,{op:'C',x:p.x,y:p.y,x1:p.x,y1:p.y,x2:p.x,y2:p.y});pathRejects.push({mutation:'extra-zero-cubic-not-discarded',rejected:!current.supportsCorners(zeroC)&&!portable.supportsCorners(zeroC)});
 check(`product-geometric-boundary-rejections-${o.sourceId}`,pathRejects.filter(x=>!x.rejected),[]);
 check(`saved-native-and-product-paths-unchanged-${o.sourceId}`,w.vectorPath,o.vectorPath);
 owners.push({sample:o.sample,sourceSha256:o.sha256,packageId:o.packageId,sourcePartSha256:o.sourcePartSha256,sourceId:o.sourceId,size:o.size,requestedRadius:o.effective['71'].value,recoveredRadius:r,readerBefore:false,readerAfter:true,normalizedFamilyBefore:old.supportsCorners(w),normalizedFamilyAfter:current.supportsCorners(w),rawMutationCount:rawRejects.length,pathMutationCount:pathRejects.length});
}

// Other inventory records include nine noncircular-at-current-SIZE eight-point
// paths and four dedicated tree labels. Compare recovery, do not repurpose them.
const nonPills=inventory.owners.filter(o=>!pills.includes(o));
for(const o of nonPills){
 const width=o.size?.Width,height=o.size?.Height;
 check(`non-pill-reader-unchanged-${o.sourceId}`,recoverRectanglePath(o.rawControlPoints,width,height),oldReader(o.rawControlPoints,width,height));
 if(Number.isFinite(width)&&Number.isFinite(height))check(`non-pill-public-validator-unchanged-${o.sourceId}`,current.rectangleRadii(o.vectorPath,width,height),old.rectangleRadii(o.vectorPath,width,height));
}

// Independent strict expected eight-point encoding: the new merge branch must
// leave the previously accepted encoding and partial-corner rectangle unchanged.
const nan=()=>({$number:'NaN',numberTag:6}),rawPoint=(x,y)=>({$map:[['X',x],['Y',y]]});
function rawRectangle(width,height,r){
 const points=[],add=(xy,lower,higher)=>points.push({$map:[['Path',rawPoint(xy[0]/width,xy[1]/height)],['LowerHandle',lower?rawPoint(lower[0]/width,lower[1]/height):rawPoint(nan(),nan())],['HigherHandle',higher?rawPoint(higher[0]/width,higher[1]/height):rawPoint(nan(),nan())],['HigherSegmentExists',true]]});
 const [tl,tr,br,bl]=r;
 if(tl){add([0,tl],null,[0,.44*tl]);add([tl,0],[.44*tl,0]);}else add([0,0]);
 if(tr){add([width-tr,0],null,[width-.44*tr,0]);add([width,tr],[width,.44*tr]);}else add([width,0]);
 if(br){add([width,height-br],null,[width,height-.44*br]);add([width-br,height],[width-.44*br,height]);}else add([width,height]);
 if(bl){add([bl,height],null,[.44*bl,height]);add([0,height-bl],[0,height-.44*bl]);}else add([0,height]);
 return[points];
}
for(const [name,width,height,r]of [['eight-normal',100,40,[10,10,10,10]],['eight-at-half',100,40,[20,20,20,20]],['six-partial-corners',100,40,[10,0,10,0]],['square-zero',40,40,[0,0,0,0]]]){
 const raw=rawRectangle(width,height,r),expected={cornerRadii:r,evidence:'Stored Shape=0, perimeter vertices and observed cubic corner handles; dimensions from stored SIZE'};
 check(`prior-encoding-${name}`,recoverRectanglePath(raw,width,height),expected);
 check(`prior-encoding-baseline-${name}`,recoverRectanglePath(raw,width,height),oldReader(raw,width,height));
}
for(const [mode,renderer]of [['module',current],['serialized',portable]]){
 const w=widget(pills.find(x=>x.size.Width===67));
 check(`${mode}-no-mask-does-not-grant-corner-capability`,renderer.supportsCorners({...w,style:{radius:16,strokeWidth:1}}),false);
 check(`${mode}-non-box-does-not-grant-native-family`,['ellipse','image','text','line'].map(type=>renderer.supportsCorners({...w,type})),[false,false,false,false]);
 const bad=clone(w);bad.vectorPath.commands=[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:.5,y:1},{op:'Z'}];
 check(`${mode}-triangle-rejected`,[renderer.supportsCorners(bad),renderer.supportsSides(bad),Boolean(renderer.vectorRectangle(bad))],[false,false,false]);
 const original=old.geometry(w),actual=renderer.geometry(w);
 check(`${mode}-generic-vector-path-painter-unchanged`,actual,original);
 for(const width of [0,1,10])for(const linePattern of ['solid','none'])check(`${mode}-dynamic-rectangle-painter-unchanged-${width}-${linePattern}`,renderer.rectangle({...w.style,strokeWidth:width,linePattern},w.width,w.height),old.rectangle({...w.style,strokeWidth:width,linePattern},w.width,w.height));
}
const summary={passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,realPills:pills.length,newReaderAdmissions:owners.filter(x=>!x.readerBefore&&x.readerAfter).length,newNormalizedQualifications:owners.filter(x=>!x.normalizedFamilyBefore&&x.normalizedFamilyAfter).length,rawMutationChecks:owners.reduce((s,x)=>s+x.rawMutationCount,0),pathMutationChecks:owners.reduce((s,x)=>s+x.pathMutationCount,0)};
const report={schema:'native-pills-final-review/v1',capturedAt:new Date().toISOString(),method:'Current and retained pre-stage JavaScript/TypeScript functions run under Node; isolated VM serialization of the product factory. No target DLL execution, original GUI, browser, full suite or import regeneration.',sources,summary,owners,results,limitations:['The importer reachability/gate count is outside this geometry probe; 28 raw candidates are not a claim of 28 admitted widgets.','Current managed-initial versus JavaScript-dynamic painter differences, zero-stroke/none no-rebuild source gate, and author node-overlay mismatch remain unchanged.','The reader keeps its prior physical 1e-6 point tolerance; product normalized family uses existing 1e-7 tolerance. Neither is advertised as the native normalized 1e-5 coalescing threshold.','Four-point fully rounded square native coalescing and alternate zero-handle encodings are not newly admitted by this six-point-only reader patch.']};
fs.writeFileSync('research/native-pills-final-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
if(summary.failed){console.log(JSON.stringify(results.filter(x=>!x.pass),null,2));process.exitCode=1;}
