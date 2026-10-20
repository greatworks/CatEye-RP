// Compose the frozen controller CIL interpreter with the independent numeric CIL
// interpreter. No product solver or native assembly executes in this oracle.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as numeric from './layer-resize-numeric-replay.mjs';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFile='research/layer-resize-controller-probe.mjs';
const source=fs.readFileSync(sourceFile,'utf8');
const marker='for(let mask=0;mask<16;mask++)';
if(source.indexOf(marker)<0)throw Error('Frozen controller adapter boundary changed');
const prefix=source.slice(0,source.indexOf(marker))
  .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
const adapter=`
export function oracle(input,numeric) {
  context={calls:[],effects:[],commits:[],geometryWrites:[],keys:input.keys??0,results:{}};
  const nr=r=>numeric.makeRect(r.x,r.y,r.width,r.height);
  const pr=r=>rect(r.x,r.y,r.width,r.height);
  const bounds=(r,a)=>pr(numeric.sizingBounds(nr(r),a));
  const combine=rows=>{
    assert(rows.length && rows.every(r=>r.width>0&&r.height>0),'Positive nonempty union source scope');
    const x=Math.min(...rows.map(r=>r.x)),y=Math.min(...rows.map(r=>r.y));
    return rect(x,y,Math.max(...rows.map(r=>r.x+r.width))-x,Math.max(...rows.map(r=>r.y+r.height))-y);
  };
  const build=spec=>{
    const style={pinHorizontal:spec.h??0,pinVertical:spec.v??0,fixedWidth:!!spec.fixedWidth,fixedHeight:!!spec.fixedHeight};
    const extra={style,[67123780]:!!spec.locked,currentLayer:spec.id===input.currentLayerId,background:!!spec.background,
      angle:spec.angle??0,autoFitWidth:!!spec.autoFitWidth,autoFitHeight:!!spec.autoFitHeight};
    if(spec.children){
      const children=spec.children.map(build);
      const w=group(spec.id,combine(children.map(c=>c.aabb)),children,extra);w.angle=0;w.aabb=w.rect;return w;
    }
    const w=widget(spec.id,spec.kind??'VectorShape',pr(spec.rect),extra);
    w.aabb=bounds(w.rect,w.angle);return w;
  };
  const root=build(input.root),c=controller([root],input.freedom??3);
  c[67119114]=input.handle;c[67119111]=!!input.preserveAspect;
  const all=[],walk=w=>{all.push(w);for(const n of w.children??[])walk(n);};walk(root);
  c.snapshot.angles=new Map(all.map(w=>[w,w.angle]));
  const np=p=>p?numeric.makePin(p[67127403],p[67127404],!!p[67127405],!!p[67127406],nr(p[67127407]),nr(p[67127408])):null;
  bind(100703557,10,args=>{
    const [w,oldRect,oldAabb,delta,parentRect,handle,freedom,scaling,orientation,pin]=args.map(copy);
    const answer=numeric.runINw2(nr(oldRect),nr(oldAabb),numeric.makeVector(delta.x,delta.y),nr(parentRect),handle,freedom,!!scaling,orientation,np(pin),w.angle).value;
    context.calls.push({method:'INw2',id:w.id,oldRect,oldAabb,delta,parentRect,handle,freedom,scaling:!!scaling,orientation,pin:pinData(pin),answer});
    return pr(answer);
  });
  bind(100703559,4,([p,oldRect,newRect,handle])=>{
    const answer=numeric.runPin(np(p),nr(oldRect),nr(newRect),handle).value;
    context.calls.push({method:'mNwa',pin:pinData(p),oldRect,newRect,handle,answer});return pr(answer);
  });
  bind(100686251,8,args=>{
    context.calls.push({method:'ubNp',ids:args[3].map(n=>n[67119104].id),oldParent:args[1],newParent:args[2]});
    return execute(100686251,args);
  });
  bind(167775841,0,()=>[]);bind(167775869,2,([a,v])=>{a.push(v);return VOID;});
  bind(100722226,2,([r,a])=>({bounds:bounds(r,a)}));
  // H5px positive, finite, nonempty branch; exact source retained in planner-union CIL.
  bind(100720526,2,([rows,ignoreEmpty])=>{assert(ignoreEmpty===1);return combine(rows);});
  execute(100686249,[c,c.nodes[0],!!input.overrideLocked,root.rect,input.delta.x,input.delta.y,input.orientation??3,false,c.freedom,null,null]);
  return {
    rootFrame:root.rect,
    commits:context.commits.map(c=>({id:c.id,rect:c.rect})),
    effects:context.effects,
    calls:context.calls,
    finalFit:all.filter(w=>w.kind==='VectorShape').map(w=>({id:w.id,autoFitWidth:w.autoFitWidth,autoFitHeight:w.autoFitHeight})),
    scalingRestored:c[67119111]===!!input.preserveAspect,
  };
}
`;
const {oracle}=await import('data:text/javascript;base64,'+Buffer.from(prefix+adapter).toString('base64'));
const cases=[];
const box=(id,x,y,width,height,more={})=>({id,rect:{x,y,width,height},...more});
const group=(id,children,more={})=>({id,children,...more});
function add(name,input) {
  const expected=oracle(input,numeric);
  if(!expected.scalingRestored)throw Error('Temporary scaling flag leaked');
  if(expected.commits.some(c=>Object.values(c.rect).some(n=>typeof n==='number'&&!Number.isFinite(n))))throw Error('Unbounded oracle input');
  cases.push({name,input,expected});
}
add('UI east resize two boxes',{
  root:group('g',[box('a',100,100,100,100),box('b',200,100,100,100)]),
  handle:4,delta:{x:100,y:0},
});
add('UI south resize two boxes',{
  root:group('g',[box('a',100,100,100,100),box('b',200,100,100,100)]),
  handle:8,delta:{x:0,y:50},
});
for(const handle of [1,2,3,4,6,8,9,12]){
  for(const freedom of [1,2,3]){
    add('ordered two-pass '+handle+'/'+freedom,{
      root:group('g',[box('inner',40,60,20,20),box('edgeA',10,20,20,100),box('edgeB',90,20,20,100)]),
      handle,freedom,delta:{x:20,y:10},
    });
  }
}
for(const h of [0,1,4,5,256])for(const v of [0,2,8,10,512]){
  add('pins candidate '+h+'/'+v,{
    root:group('g',[box('inner',30,40,20,20,{h,v}),box('edgeA',0,0,20,100,{h:1,v:10,fixedWidth:true}),box('edgeB',80,0,20,100,{h:4,v:10,fixedWidth:true})]),
    handle:12,delta:{x:60,y:40},
  });
}
for(const angle of [0,1,37,90,180,270,-90,360]){
  add('rotated leaf '+angle,{
    root:group('g',[box('a',100,50,80,40,{angle}),box('b',230,100,60,60,{h:4,v:8})]),
    handle:12,delta:{x:80,y:40},
  });
}
for(const keys of [0,393216,458752]) {
  add('nested shared origin modifiers '+keys,{
    root:group('g',[group('nested',[box('a',30,50,50,30,{h:1,v:2,fixedWidth:true,autoFitWidth:true,autoFitHeight:true}),box('b',90,80,40,40)],{h:4,v:8}),box('c',150,30,40,100)]),
    handle:12,delta:{x:90,y:50},keys,
  });
}
for(const [h,v] of [[1,2],[4,8],[256,512],[5,10]]) {
  add('nested candidate origin correction '+h+'/'+v,{
    root:group('g',[
      group('nested',[box('fixed-child',20,30,100,100,{fixedWidth:true,fixedHeight:true})],{h,v}),
      box('far',200,30,100,100),
    ]),
    handle:12,delta:{x:280,y:100},
  });
}
for(const currentLayerId of [undefined,'g'])for(const overrideLocked of [false,true]){
  add('locks context '+(currentLayerId??'outside')+'/'+overrideLocked,{
    root:group('g',[box('a',0,0,50,100,{locked:true}),box('b',50,0,50,100)]),
    handle:12,delta:{x:50,y:20},currentLayerId,overrideLocked,
  });
}
for(const preserveAspect of [false,true])for(const orientation of [0,1,2,3]){
  add('aspect scope '+preserveAspect+'/'+orientation,{
    root:group('g',[box('a',20,30,30,80,{autoFitWidth:true,autoFitHeight:true}),box('b',80,30,40,80,{h:4,v:2})]),
    handle:12,delta:{x:30,y:15},preserveAspect,orientation,
  });
}
const sources=[
 sourceFile,'research/layer-resize-numeric-replay.mjs',
 'research/layer-resize-numeric-evidence.json','research/layer-resize-numeric-manifest.json',
 'research/layer-resize-controller-manifest.json',
 'research/layer-resize-controller-planner-union-cil.json',
 'research/layer-resize-controller-planner-union-fold-cil.json',
 'research/layer-resize-controller-planner-union-pair-cil.json',
];
const output={schemaVersion:1,originalDllExecuted:false,originalGuiCompared:false,productSolverUsed:false,
 description:'Frozen controller CIL composed with independent numeric CIL interpreter. Product solver is not loaded.',
 sinks:['Style/capability/lock/current-Layer facts are fixture inputs','Native notification/history and final setter side effects are captured','H5px finite positive nonempty union branch is expressed as min/max; zero/empty candidates are excluded here'],
 summary:{total:cases.length,passed:cases.length,failed:0},
 sources:sources.map(file=>({file,sha256:sha(file)})),cases};
fs.writeFileSync('research/layer-resize-controller-planner-fixtures.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.summary));
