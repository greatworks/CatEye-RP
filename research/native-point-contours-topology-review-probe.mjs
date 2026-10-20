// Independent read-only product comparison with the frozen CIL topology oracle.
import fs from 'node:fs';
import path from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {replayNativeCommit,authoredCarriers,report as sourceReport} from './native-point-contours-topology-probe.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const red=process.argv.includes('--red'),moduleRoot=red?'.build/native-point-contours-before-fallback-fix/src/model':'src/model';
const sourcePaths=[`${moduleRoot}/vector-commit.ts`,`${moduleRoot}/vector-contours.ts`,`${moduleRoot}/vector.ts`,'src/model/adaptive.ts','src/components/CanvasVectorTools.tsx','src/App.tsx','src/components/Inspector.tsx','research/native-point-contours-topology-probe.mjs','research/native-point-contours-topology-probes.json','research/native-point-contours-topology-manifest.json','research/native-point-contours-rotation-evidence.json'];
const before=sourcePaths.map(path=>({path,sha256:sha256(path)}));
const urls=new Map();function moduleUrl(file){file=path.resolve(file);if(urls.has(file))return urls.get(file);const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_m,_q,relative)=>`from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file),relative.endsWith('.ts')?relative:relative+'.ts')))}`);const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;urls.set(file,url);return url}
const {commitVectorGeometry}=await import(moduleUrl(`${moduleRoot}/vector-commit.ts`));
const {vectorMeasurementContours}=await import(moduleUrl(`${moduleRoot}/vector-contours.ts`));
const results=[],blockingFindings=[];
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
const nearValue=(a,b)=>typeof b==='number'?near(a,b):Array.isArray(b)?Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>nearValue(a[i],v)):b&&typeof b==='object'?a&&Object.keys(a).sort().join('|')===Object.keys(b).sort().join('|')&&Object.entries(b).every(([k,v])=>nearValue(a[k],v)):a===b;
const M=(x,y)=>({op:'M',x,y}),L=(x,y)=>({op:'L',x,y}),C=(x1,y1,x2,y2,x,y)=>({op:'C',x1,y1,x2,y2,x,y}),Z={op:'Z'};
function project(commands,normalized){let ci=-1,index=-1;return commands.map(c=>{if(c.op==='Z')return{op:'Z'};if(c.op==='M'){ci++;index=0}else index++;const raw=normalized[ci][index];if(c.op!=='C')return{op:c.op,...raw.g5Eq};const previous=normalized[ci][index-1];return{op:'C',x1:previous.a5EO.x,y1:previous.a5EO.y,x2:raw.E5Ed.x,y2:raw.E5Ed.y,...raw.g5Eq}})}
function compare(name,frame,commands,stroke=1){const widget={x:frame.x,y:frame.y,width:frame.width,height:frame.height,rotation:frame.angle,style:{strokeWidth:stroke}},value={fillRule:'nonzero',commands},snapshot=JSON.stringify({widget,value});
 const native=replayNativeCommit(authoredCarriers(commands,frame),frame,stroke),expected={bounds:native.bounds,vectorPath:{fillRule:'nonzero',commands:project(commands,native.points)}};
 let actual,error;try{actual=commitVectorGeometry(widget,value)}catch(e){error=e.message}
 const immutable=JSON.stringify({widget,value})===snapshot,passed=!error&&nearValue(actual,expected)&&immutable;
 const row={name,passed,frame,stroke,commands,expected,actual,error,immutable};results.push(row);if(!passed)blockingFindings.push({name,expected,actual,error});
}
for(const item of sourceReport.authoredFixtures)compare(item.name,item.frame,item.commands,item.stroke);
for(const x of [.25,.75])for(const stroke of [0,1,1.25,2,3,4])for(const closed of [false,true])compare(`fractional-all-pruned x=${x} stroke=${stroke} closed=${closed}`,{x:0,y:0,width:1,height:1,angle:0},[M(12+x,30.75),...(closed?[Z]:[])],stroke);
for(const angle of [0,37,45,90])for(const commands of [[M(12.25,30.75)],[M(-50,-60),M(10,20),L(30,40)],[M(0,0),C(0,1,1,1,0,0)],[M(0,0),C(0,1,1,1,0,0),Z],[M(0,0),L(1,0),L(1,1),L(0,1),Z],[M(0,0),L(1,0),L(1,1),L(0,1),L(0,0),Z]])compare(`mixed topology angle=${angle} ops=${commands.map(c=>c.op).join('')}`,{x:100,y:80,width:100,height:60,angle},commands,1);
for(const [angle,delta]of [[37,.00062],[45,.0007]]){
 const frame={x:0,y:0,width:100,height:100,angle},t=angle*Math.PI/180,s=Math.sin(t),c=Math.cos(t);
 const inverse=(x,y)=>M((50+(x-50)*c+(y-50)*s)/100,(50-(x-50)*s+(y-50)*c)/100),a=inverse(200,200),b=inverse(200+delta,200+delta);
 compare(`world-vs-local filtering ${angle}`,frame,[a,{...b,op:'L'}],1);
}
for(const dx of [.000999,.001,.001001])compare(`strict endpoint Manhattan ${dx}`,{x:0,y:0,width:1,height:1,angle:0},[M(10,20),L(30,40),M(0,0),L(dx,0)],1);
for(const amount of [.000999,.001,.001001,10])compare(`strict cubic handle ${amount}`,{x:0,y:0,width:1,height:1,angle:0},[M(10,20),L(30,40),M(0,0),C(amount,0,0,0,0,0)],1);
for(const closed of [false,true])compare(`lone inactive closing survives closed=${closed}`,{x:0,y:0,width:1,height:1,angle:0},[M(50,60),L(50.0004,60),L(50.0008,60),L(50.0012,60),...(closed?[Z]:[])],1);
compare('single surviving curve distance >= 1 removed',{x:0,y:0,width:1,height:1,angle:0},[M(50,60),...Array.from({length:2001},(_,i)=>L(50+(i+1)*.0005,60))],1);
// These explicit expectations use the independently frozen sizing-frame identity
// trigonometric branch, avoiding this topology oracle's general Math.sin sink.
for(const angle of [0,1e-5-1e-12,-1e-5+1e-12,360,-360]){
 const name=`M-only native factory angle ${angle}`,owner={x:100,y:80,width:200,height:100,rotation:angle,style:{strokeWidth:1}},value={fillRule:'nonzero',commands:[M(.25,.25)]};
 const unrotated=Math.abs(angle)<1e-5,expected={bounds:unrotated?{x:149,y:104,width:1,height:1}:{x:-1,y:-1,width:1,height:1},vectorPath:{fillRule:'nonzero',commands:[unrotated?M(1,1):M(151,106)]}},actual=commitVectorGeometry(owner,value),passed=nearValue(actual,expected);
 results.push({name,passed,owner,value,expected,actual,source:'native sizing-frame factory and identity sin/cos preserve rotated dispatch at +/-360; topology empty-union contract'});if(!passed)blockingFindings.push({name,expected,actual});
}
// Product adapter must expose inactive closure and preserve separate contour order.
const measured=vectorMeasurementContours({fillRule:'nonzero',commands:[M(0,0),L(10,0),M(20,0),L(30,0),Z]},x=>x);
const topologyPass=measured.contours.length===2&&measured.contours[0][0].active===false&&measured.contours[1][0].active===true;
results.push({name:'temporary measurement contours retain separate closure activity',passed:topologyPass,actual:measured});if(!topologyPass)blockingFindings.push({name:'temporary measurement contour closure activity'});
const after=sourcePaths.map(path=>({path,sha256:sha256(path)})),sourceStableDuringProbe=JSON.stringify(before)===JSON.stringify(after);
if(!sourceStableDuringProbe)blockingFindings.push({name:'source changed during probe'});
const out={kind:'independent-native-point-contours-topology-product-review',generatedAt:new Date().toISOString(),originalAssemblyExecuted:false,originalGuiCompared:false,sourceStableDuringProbe,checks:{total:results.length,passed:results.filter(x=>x.passed).length},blockingFindings,results,sources:before,probe:{path:'research/native-point-contours-topology-review-probe.mjs',sha256:sha256('research/native-point-contours-topology-review-probe.mjs')},oracle:readJson('research/native-point-contours-topology-manifest.json').checks,limits:['Read-only TS module comparison via stripped in-memory modules; no product build or browser.','Native bounded CIL oracle uses explicit numeric/collection sinks; native GUI not compared.','Inactive native endpoint handles absent from M/L/C/Z cannot be reconstructed by either adapter.']};
const label=red?'red':'probe';fs.writeFileSync(`research/native-point-contours-topology-review-${label}.json`,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:out.checks,blocking:out.blockingFindings.length,sourceStableDuringProbe,path:`research/native-point-contours-topology-review-${label}.json`}));
