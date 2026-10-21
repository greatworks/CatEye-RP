import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {replay,snap,inequality,capability,coverage,sourceFiles} from './selection-rotation-controller-replay.mjs';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const cases=[],checks=[];
const check=(name,fn)=>{try{const actual=fn();checks.push({name,passed:true,actual});}catch(e){checks.push({name,passed:false,error:String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<cil>')});}};
const round=v=>Math.sign(v)*Math.floor(Math.abs(v)+.5);
const expectedSnap=(a,shift)=>{const r=round(a/15)*15;return shift||Math.abs(a-r)<=5?r:a;};
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const base={bounds:{x:100,y:100,width:530,height:20},down:{x:630,y:120},widgets:[{id:'check',type:'checkbox',rect:{x:100,y:100,width:240,height:20},autoFitWidth:true},{id:'radio',type:'radio',rect:{x:450,y:100,width:180,height:20},autoFitHeight:true}]};
function deltaFor(angle,input=base){const p={x:input.bounds.x+input.bounds.width/2,y:input.bounds.y+input.bounds.height/2},x=input.down.x-p.x,y=input.down.y-p.y,a=angle*Math.PI/180;return{x:p.x+x*Math.cos(a)-y*Math.sin(a)-input.down.x,y:p.y+x*Math.sin(a)+y*Math.cos(a)-input.down.y};}
function oracle(input,frames){
 const pivot={x:input.bounds.x+input.bounds.width/2,y:input.bounds.y+input.bounds.height/2},offset=input.scopeOffset??{x:0,y:0};
 let current=input.widgets.map((w,i)=>({id:w.id??'selection'+i,rect:{...w.rect},angle:w.angle??0,autoFitWidth:!!w.autoFitWidth,autoFitHeight:!!w.autoFitHeight,panel:w.panel??{x:14,y:0,width:w.rect.width-14,height:20}}));
 for(const [n,f]of input.frames.entries()){
  const a=Math.atan2(input.down.y+f.delta.y-pivot.y,input.down.x+f.delta.x-pivot.x)*180/Math.PI+90;
  const b=Math.atan2(input.down.y-pivot.y,input.down.x-pivot.x)*180/Math.PI+90;
  const angle=expectedSnap(a-b,!!(f.keys&65536)),s=Math.sin(angle*Math.PI/180),c=Math.cos(angle*Math.PI/180);
  const expected=current.map((w,i)=>{
   const initial=input.widgets[i];if(initial.locked)return w;
   const old=initial.rect,x=old.x+old.width/2+offset.x-pivot.x,y=old.y+old.height/2+offset.y-pivot.y;
   const dest={x:old.x+x*c-y*s-x,y:old.y+x*s+y*c-y};
   const unchanged=Math.abs(dest.x-w.rect.x)<1e-5&&Math.abs(dest.y-w.rect.y)<1e-5;
   return {...w,rect:unchanged?w.rect:{...w.rect,...dest},angle:initial.rotationCapable?((round((initial.angle??0)+angle)%360)+360)%360:w.angle};
  });
  assert.equal(frames[n].error,null);near(frames[n].events.find(e=>e.name==='angle.snap').answer,angle);
  for(const [i,w]of expected.entries()){
   for(const key of ['x','y','width','height'])near(frames[n].after[i].rect[key],w.rect[key]);
   assert.equal(frames[n].after[i].angle,w.angle);assert.deepEqual(frames[n].after[i].panel,w.panel);
   assert.equal(frames[n].after[i].autoFitWidth,w.autoFitWidth);assert.equal(frames[n].after[i].autoFitHeight,w.autoFitHeight);
   const events=frames[n].events.filter(e=>e.id===w.id),names=events.map(e=>e.name);
   if(input.widgets[i].locked)assert.equal(events.length,0);
   else {assert(names.indexOf('Rotation.request')<names.indexOf('Location.request'));assert.equal(events.find(e=>e.name==='Location.request').allViews,false);if(!input.widgets[i].rotationCapable)assert(!names.includes('Rotation.write'));}
  }
  if(n)assert.deepEqual(frames[n].before,frames[n-1].after);
  current=expected;
 }
 assert.equal(frames.flatMap(f=>f.events).filter(e=>e.name==='snapshot.capture').length,1);
}
function run(name,input){const actual=replay(input),entry={name,input,actual};cases.push(entry);try{oracle(input,actual);entry.passed=true;}catch(e){entry.passed=false;entry.error=e.message;}}
for(const a of [-720,-360,-359.9,-185,-180,-175,-22.5,-20.000001,-20,-19.999999,-10.000001,-10,-9.999999,-7.5,-5.000001,-5,-4.999999,0,4.999999,5,5.000001,7.5,9.999999,10,10.000001,19.999999,20,20.000001,22.5,175,180,185,359.9,360,720])for(const keys of [0,65536,131072,262144,458752])check(`snap ${a} keys ${keys}`,()=>{const actual=snap(a,keys);near(actual,expectedSnap(a,!!(keys&65536)));return actual;});
for(const d of [0,0.000001,0.000009999,0.00001,0.000010001,-0.00001])for(const axis of ['x','y'])check(`location epsilon ${axis} ${d}`,()=>{const a={x:0,y:0},b={...a,[axis]:d},actual=inequality(a,b);assert.equal(!!actual,Math.abs(d)>=1e-5);return !!actual;});
for(const type of ['checkbox','radio'])check('original capabilities '+type,()=>{const actual=capability(type);assert.equal(actual.rotation,false);return actual;});
for(const angle of [-179,-90,-22.5,-7.5,-5.01,0,5.01,7.5,22.5,90,179,359,360])for(const keys of [0,65536])run(`multi angle ${angle} keys ${keys}`,{...base,frames:[{delta:deltaFor(angle),keys},{delta:{x:0,y:0},keys}]});
for(const locked of [[false,false],[true,false],[false,true],[true,true]])for(const fit of [0,1,2,3])run(`locks ${locked} fit ${fit}`,{...base,widgets:base.widgets.map((w,i)=>({...w,locked:locked[i],autoFitWidth:!!(fit&1),autoFitHeight:!!(fit&2)})),frames:[{delta:deltaFor(7.5),keys:0},{delta:deltaFor(7.5),keys:65536},{delta:deltaFor(7.5),keys:0},{delta:{x:0,y:0},keys:458752}]});
run('concrete quarter-turn', {...base,frames:[{delta:{x:-265,y:255}}]});
run('pointer argument is unused', {...base,frames:[{delta:deltaFor(33),point:{x:0,y:0}},{delta:deltaFor(33),point:{x:1e9,y:-1e9}}]});
run('scope offset applied to original centers', {...base,scopeOffset:{x:37,y:-19},frames:[{delta:deltaFor(33)},{delta:{x:0,y:0}}]});
run('pivot singular point uses BCL atan2 facade', {...base,frames:[{delta:{x:-265,y:-10}}]});
run('capability positive control writes angle before location', {...base,widgets:base.widgets.map(w=>({...w,angle:350,rotationCapable:true})),frames:[{delta:deltaFor(22.5)},{delta:deltaFor(-22.5)},{delta:{x:0,y:0}}]});
const report={kind:'Original retained CIL instruction replay plus independent formula cross-check; no vendor DLL or GUI execution',summary:{sessions:cases.length,frames:cases.reduce((n,c)=>n+c.actual.length,0),numericChecks:checks.length,total:cases.length+checks.length,passed:cases.filter(c=>c.passed).length+checks.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length+checks.filter(c=>!c.passed).length},sources:[...new Set([...sourceFiles,'research/selection-rotation-controller-replay.mjs','research/selection-rotation-controller-probe.mjs'])].map(path=>({path,sha256:sha(path)})),cases,checks};
report.methods=coverage();
fs.writeFileSync('research/selection-rotation-controller-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);for(const c of [...cases,...checks].filter(x=>!x.passed))console.log(c.name,c.error);if(report.summary.failed)process.exitCode=1;
