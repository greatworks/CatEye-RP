// Static CIL instruction replay only. Does not load or execute the vendor assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const files=fs.readdirSync('research').filter(x=>/^native-point-commit-evidence-.*-cil\.json$/.test(x)).map(x=>`research/${x}`);
files.push('research/native-point-editing-evidence-mode-cil.json','research/native-point-editing-evidence-shape-cil.json','research/native-point-editing-evidence-edit-cil.json');
files.push('research/native-point-editing-evidence-mode-transition-cil.json','research/native-point-editing-evidence-mode-exit-cil.json');
const methods=new Map(files.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods.map(m=>[m.Token,{...m,file}]))));
const visited=new Set(),trace=[];
const val=x=>x?.ref?x.ref[x.key]:x;
const set=(r,v)=>{assert(r?.ref);r.ref[r.key]=v};
const clone=x=>x===undefined?undefined:structuredClone(x);
const h=(n,fn,ret=true)=>({n,fn,ret});
function run(token,args,calls={}){
 const m=methods.get(token);assert(m,`missing ${token}`);visited.add(token);
 const code=m.Instructions,at=new Map(code.map((x,i)=>[x.Offset,i])),s=[],l=[];let pc=0,ticks=0;
 while(pc<code.length){assert(++ticks<20000,`loop ${token}`);const i=code[pc++],o=i.Op,j=()=>{assert(at.has(i.Operand));pc=at.get(i.Operand)};
  if(/^(br|br\.s|leave|leave\.s)$/.test(o)){j();continue}
  if(/^ldarg\.[0-3]$/.test(o)){s.push(args[+o.slice(6)]);continue}
  if(o==='ldarg.s'){s.push(args[i.Operand]);continue}if(o==='ldarga.s'){s.push({ref:args,key:i.Operand});continue}
  if(o==='starg.s'){args[i.Operand]=s.pop();continue}
  if(/^ldloc\.[0-3]$/.test(o)){s.push(l[+o.slice(6)]);continue}
  if(o==='ldloc.s'){s.push(l[i.Operand]);continue}if(o==='ldloca.s'){s.push({ref:l,key:i.Operand});continue}
  if(o.startsWith('stloc.')){l[o==='stloc.s'?i.Operand:+o.slice(6)]=s.pop();continue}
  if(o.startsWith('ldc.i4')){s.push(o==='ldc.i4'||o==='ldc.i4.s'?i.Operand:o==='ldc.i4.m1'?-1:+o.slice(7));continue}
  if(o==='ldc.r8'){s.push(i.Operand);continue}if(o==='ldnull'){s.push(null);continue}
  if(o==='ldsfld'){s.push({module:true});continue}
  if(o==='ldftn'){s.push(i.Operand);continue}
  if(o==='ldfld'){const x=val(s.pop());if(x?.module){assert(fields.has(i.Operand));s.push(fields.get(i.Operand).value)}else s.push(x[i.Resolved.split('::')[1]]);continue}
  if(o==='ldflda'){s.push({ref:val(s.pop()),key:i.Resolved.split('::')[1]});continue}
  if(o==='stfld'){const v=s.pop(),x=val(s.pop());x[i.Resolved.split('::')[1]]=v;continue}
  if(o==='ldobj'||o==='ldind.ref'){s.push(val(s.pop()));continue}
  if(o==='stobj'||o==='stind.ref'){const v=s.pop();set(s.pop(),v);continue}
  if(o==='initobj'){set(s.pop(),{x:0,y:0});continue}
  if(o==='brtrue'||o==='brfalse'){if(!!s.pop()===(o==='brtrue'))j();continue}
  if(/^(beq|bne.un|bge|ble|bgt|blt)(\.un)?$/.test(o)){const b=s.pop(),a=s.pop(),u=o.endsWith('.un')&&(Number.isNaN(a)||Number.isNaN(b));if(({beq:a===b,'bne.un':a!==b,bge:a>=b,ble:a<=b,bgt:a>b,blt:a<b})[o.replace(/\.un$/,'') ]||o==='bne.un'&&a!==b||u)j();continue}
  if(['add','sub','mul','div','ceq','cgt','cgt.un','clt','or','and'].includes(o)){const b=s.pop(),a=s.pop();s.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,ceq:()=>a===b,cgt:()=>a>b,'cgt.un':()=>a>b||Number.isNaN(a)||Number.isNaN(b),clt:()=>a<b,or:()=>a|b,and:()=>a&b})[o]());continue}
  if(o==='neg'){s.push(-s.pop());continue}if(o==='dup'){s.push(s.at(-1));continue}if(o==='pop'){s.pop();continue}
  if(['box','nop','constrained.'].includes(o))continue;
  if(o==='newarr'){s.push(new Array(s.pop()));continue}
  if(o.startsWith('stelem.')){const v=s.pop(),n=s.pop();s.pop()[n]=v;continue}
  if(['call','callvirt','newobj'].includes(o)){const c=calls[i.Operand]??calls[i.Resolved]??common[i.Operand]??common[i.Resolved];assert(c,`unmodelled ${token}/${i.Offset.toString(16)} ${i.Resolved}`);const a=s.splice(s.length-c.n,c.n),v=c.fn(...a);trace.push({token,il:i.Offset,call:i.Operand});if(c.ret!==false)s.push(v);continue}
  if(o==='ret')return s.pop();throw Error(`unsupported ${token}/${i.Offset.toString(16)} ${o}`);
 }throw Error(`no ret ${token}`);
}
const point=(x,y)=>({x,y}),add=(a,b)=>point(a.x+b.x,a.y+b.y),sub=(a,b)=>point(a.x-b.x,a.y-b.y),mul=(a,b)=>point(a.x*b,a.y*b);
const rect=(x,y,width,height)=>({x,y,width,height});
const center=r=>point(r.x+r.width/2,r.y+r.height/2);
const rotate=(p,c,a)=>{const q=sub(p,c),t=a*Math.PI/180;return add(c,point(q.x*Math.cos(t)-q.y*Math.sin(t),q.x*Math.sin(t)+q.y*Math.cos(t)))};
function rotated(r,a){const c=center(r);return {...r,a,tl:rotate(point(r.x,r.y),c,a),tr:rotate(point(r.x+r.width,r.y),c,a),bl:rotate(point(r.x,r.y+r.height),c,a),br:rotate(point(r.x+r.width,r.y+r.height),c,a)}}
const common={
 'System.Math::Floor':h(1,Math.floor),'System.Math::Ceiling':h(1,Math.ceil),'System.Math::Abs':h(1,Math.abs),'System.Math::Sqrt':h(1,Math.sqrt),'System.Math::Max':h(2,Math.max),
 100688813:h(2,(a,b)=>run(100688813,[a,b])),100688814:h(2,(a,b)=>run(100688814,[a,b])),100688812:h(3,(a,b,e)=>Math.abs(a-b)<e),
 100688828:h(1,a=>run(100688828,[a])),100688829:h(1,a=>run(100688829,[a])),
 100721934:h(1,p=>val(p).x),100721936:h(1,p=>val(p).y),100721935:h(2,(p,v)=>{val(p).x=v},false),100721937:h(2,(p,v)=>{val(p).y=v},false),
 100721941:h(2,point),100721944:h(2,add),100721945:h(2,sub),100721952:h(2,mul),100721953:h(2,(p,v)=>mul(p,1/v)),
 100721995:h(2,(m,p)=>m(p)),100722000:h(3,(c,s,k)=>p=>{const q=sub(p,c);return add(c,point(q.x*k-q.y*s,q.x*s+q.y*k))}),
 100722090:h(4,rect),100722092:h(3,(p,w,h)=>rect(p.x,p.y,w,h)),
 100722188:h(1,r=>r.tl),100722190:h(1,r=>r.tr),100722192:h(1,r=>r.bl),100722194:h(1,r=>r.br),
 100722014:h(1,r=>r.tl),100722017:h(1,r=>r.br),100722207:h(1,r=>Math.sin(r.a*Math.PI/180)),100722209:h(1,r=>Math.cos(r.a*Math.PI/180)),
 100722204:h(1,r=>r.width),100722205:h(1,r=>r.height),
 100722034:h(2,(r,v)=>{const c=Math.cos(r.a*Math.PI/180),s=Math.sin(r.a*Math.PI/180);return point((v.x*c+v.y*s)/r.width,(-v.x*s+v.y*c)/r.height)}),
 100722259:h(3,(r,a,b)=>run(100722259,[r,a,b])),
};
for(const [token,key] of [[100722047,'x'],[100722049,'y'],[100722051,'width'],[100722053,'height'],[100722055,'x'],[100722056,'y']])common[token]=h(1,r=>val(r)[key]);
common[100722057]=h(1,r=>val(r).x+val(r).width);common[100722058]=h(1,r=>val(r).y+val(r).height);
const results=[];function check(name,fn){results.push({name,observed:fn()})}
const near=(a,b,e=1e-9)=>{assert(Number.isFinite(a)&&Math.abs(a-b)<e,`${a} vs ${b}`)};
const nearPoint=(a,b)=>{near(a.x,b.x);near(a.y,b.y)};
const nearRect=(a,b)=>{for(const k of ['x','y','width','height'])near(a[k],b[k])};
function coefficients(p){return run(100720122,[null,...p])}
function roots(c){const o={zbMa:c[2],ubMX:c[1],QbMm:c[0],bbMU:false,roots:[]};run(100688988,[o],{100688933:h(3,(q,v,m)=>q.roots.push({value:v,multiplicity:m}),false)});return o.roots.filter(x=>x.value>=0&&x.value<=1).map(x=>x.value)}
function axisBounds(p){const c=coefficients(p),derivative=[c[1],2*c[2],3*c[3]],ts=roots(derivative);const values=[p[0],p[3],...ts.map(t=>c[0]+t*(c[1]+t*(c[2]+t*c[3])))];return {min:Math.min(...values),max:Math.max(...values),roots:ts,coefficients:c}}
function curveBounds(ps){const x=axisBounds(ps.map(p=>p.x)),y=axisBounds(ps.map(p=>p.y));return {...rect(x.min,y.min,x.max-x.min,y.max-y.min),extrema:{x:x.roots,y:y.roots}}}
function retainedCurveBounds(ps){
 const xs=coefficients(ps.map(p=>p.x)),ys=coefficients(ps.map(p=>p.y));
 const q={O5lO:ps[0],w5au:ps[1],e5aw:ps[2],x5ld:ps[3],f5lq:null};
 const evaluate=(c,t)=>c[0]+t*(c[1]+t*(c[2]+t*c[3]));
 return run(100720182,[q],{
  100722087:h(1,r=>val(r)===null),100721939:h(1,p=>Number.isNaN(val(p).x)||Number.isNaN(val(p).y)),
  100720112:h(1,()=>roots([xs[1],2*xs[2],3*xs[3]])),100720113:h(1,()=>roots([ys[1],2*ys[2],3*ys[3]])),
  100688930:h(1,x=>x),
  'TypeSpecification:1B000902::.ctor':h(2,(_owner,token)=>t=>evaluate(token===100720187?xs:ys,t)),
  721424314:h(2,(xs,f)=>xs.map(f)),721423822:h(1,x=>x),
  'TypeSpecification:1B0005EF::Add':h(2,(xs,v)=>xs.push(v),false),
  100689177:h(1,x=>Math.min(...x)),100689183:h(1,x=>Math.max(...x)),
 });
}
function rounded(r){return run(100722119,[r,false])}
function expanded(r,min){return run(100702693,[r,min])}
function normalized(p,r){return run(100702688,[null,p,r])}
function commitOracle(old,controls,stroke=1,preserveMinimum=false){
 const centerOld=center(old),local=controls.map(p=>rotate(p,centerOld,-old.a));
 const exact=curveBounds(local);let raw;
 if(old.a){const tl=rotate(point(exact.x,exact.y),centerOld,old.a),br=rotate(point(exact.x+exact.width,exact.y+exact.height),centerOld,old.a);const c=mul(add(tl,br),.5);const p=rotate(tl,c,-old.a);raw=rect(p.x,p.y,exact.width,exact.height)}else raw=exact;
 const r=rounded(raw),owner=expanded(r,Math.max(stroke,1));
 const normalizationRect=preserveMinimum?r:owner,c=center(normalizationRect),n=controls.map(p=>{const q=rotate(p,c,-old.a);return normalized(q,normalizationRect)});
 return {entry:preserveMinimum?'RN4I normalization branch':'TN46 normalization branch',exact,rounded:r,owner,normalizationRect,normalized:n};
}
for(const p of [[0,0,1,1],[0,-1,-1,1],[0,2,-2,0],[2,2,2,2],[0,1,2,3],[-10,20,-30,40]])check(`cubic extrema ${p}`,()=>{const b=axisBounds(p);for(let i=0;i<=1000;i++){const t=i/1000,q=(1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3];assert(q>=b.min-1e-9&&q<=b.max+1e-9)}return b});
for(const [a,b,c] of [[.000009,-1,.5],[.00001,-1,.5],[0,.000009,-.5],[0,.00001,-.5],[0,0,1],[.000001,-.000001,0],[1,-1,.25000001],[1,-1,.24999999],[1,-1,.24999975]])check(`quadratic solver threshold ${a}/${b}/${c}`,()=>{
 const q={zbMa:a,ubMX:b,QbMm:c,bbMU:false,roots:[]};run(100688988,[q],{100688933:h(3,(o,value,multiplicity)=>o.roots.push({value:Number.isFinite(value)?value:String(value),multiplicity}),false)});if(a===.000001)assert.deepEqual(q.roots,[{value:.5,multiplicity:2}]);return {a,b,c,discriminant:b*b-4*a*c,roots:q.roots};
});
for(const ys of [[0,-100,-100,100],[0,-100,0,100],[0,100,-100,0],[2,2,2,2]])check(`retained I5hl.h3jv selects extrema ${ys}`,()=>{const ps=ys.map((y,i)=>point([0,0,100,100][i],y)),observed=retainedCurveBounds(ps),expected=curveBounds(ps);nearRect(observed,expected);return {controls:ps,observed}});
check('curve extrema are not the control hull',()=>{const b=curveBounds([point(0,0),point(0,-100),point(100,-100),point(100,100)]);near(b.y,500-400*Math.SQRT2);assert(b.y>-100);return b});
for(const x of [-2.000001,-2,-1.999999,-1.3,0,.3,.999999,1.000001,8.8])check(`outward rounding ${x}`,()=>{const r=rect(x,x+.25,10.1,8.1),out=rounded(r);assert(out.x<=r.x+1e-9&&out.y<=r.y+1e-9&&out.x+out.width>=r.x+r.width-1e-9);return {input:r,output:out}});
for(const size of [0,.2,1,4])for(const width of [0,1,5])check(`minimum dimension ${size}/${width}`,()=>{const r=rect(12.25,-8.3,size,size),min=Math.max(width,1),out=expanded(r,min);near(out.width,Math.max(min,size));near(out.height,Math.max(min,size));if(size<min)near(out.x,Math.floor(r.x+(size-min)/2));return {input:r,strokeWidth:width,output:out}});
for(const width of [0,1e-6,1e-5,1,100])check(`normalized zero-width guard ${width}`,()=>{const r=rect(10,20,width,0),p=point(40,50),out=normalized(p,r);near(out.x,width<1e-5?.5:30/width);near(out.y,.5);return {r,p,out}});
for(const a of [0,30,90,180,-90])for(const target of [rect(80,50,150,70),rect(110,90,50,20),rect(100,80,100,60)])check(`rotated resize delta ${a}/${target.width}`,()=>{const old=rotated(rect(100,80,100,60),a),next=rotated(target,a),x={},y={};run(100722249,[old,next,{ref:x,key:'v'},{ref:y,key:'v'}]);const out=run(100722259,[old,x.v,y.v]);nearRect(out,target);return {old,target,a,topLeft:x.v,bottomRight:y.v,output:out}});
for(const a of [0,30,90,180])for(const scale of [1,50,100])check(`commit cubic rotation=${a},scale=${scale}`,()=>{const old={...rect(100,80,scale,scale),a},c=center(old);const ps=[point(100,80),point(100,80-scale),point(100+scale,80-scale),point(100+scale,80+scale)].map(p=>rotate(p,c,a));const out=commitOracle(old,ps);for(let i=0;i<ps.length;i++){const p=out.normalized[i],v=rotate(point(out.owner.x+p.x*out.owner.width,out.owner.y+p.y*out.owner.height),center(out.owner),a);nearPoint(v,ps[i])}return {old,controls:ps,...out}});
check('point input minimum owner with half-normalized coordinates',()=>{const old={...rect(100,80,100,60),a:0},out=commitOracle(old,Array(4).fill(point(125,96)),4);assert.deepEqual(out.normalized,Array(4).fill(point(.5,.5)));nearRect(out.owner,rect(123,94,4,4));return out});
check('parent browser fixture M0,0 C0,-1 1,0 1,1 at 100,100 200x100',()=>{const old={...rect(100,100,200,100),a:0},ps=[point(100,100),point(100,0),point(300,100),point(300,200)],out=commitOracle(old,ps);near(out.exact.y,100+(1-Math.SQRT2)*100);nearRect(out.owner,rect(100,58,200,142));for(const [i,y] of [42,-58,42,142].entries())near(out.normalized[i].y,y/142);return {old,controls:ps,...out}});
check('parent 90-degree polygon first-anchor x=-.25',()=>{const old={...rect(100,100,200,100),a:90},unrotated=[point(50,100),point(300,100),point(300,200),point(100,200)],ps=unrotated.map(p=>rotate(p,center(old),90));const local=rect(50,100,250,100),tl=rotate(point(local.x,local.y),center(old),90),br=rotate(point(local.x+local.width,local.y+local.height),center(old),90),c=mul(add(tl,br),.5),origin=rotate(tl,c,-90),r=rounded(rect(origin.x,origin.y,local.width,local.height));nearRect(r,rect(75,75,250,100));const normalizedPoints=ps.map(p=>normalized(rotate(p,center(r),-90),r));return {old,worldPoints:ps,localBounds:local,owner:r,normalizedPoints,rotation:90}});
for(const distance of [.000999,.001,1])check(`curve reindex Manhattan threshold ${distance}`,()=>{const q={x5ld:point(distance,0),O5lO:point(0,0),I5l4:true};const result=run(100720164,[q,.001],{100720531:h(3,(a,b,e)=>run(100720531,[a,b,e],{100721991:h(1,p=>run(100721991,[p]))}))});assert.equal(!!result,distance<.001);return {distance,result}});
for(const preserve of [false,true])check(`TN46 false versus RN4I true tiny-axis normalization ${preserve}`,()=>{const old={...rect(100,80,100,60),a:0},out=commitOracle(old,Array(4).fill(point(125.25,96.75)),4,preserve);nearRect(out.owner,rect(123,94,4,4));near(out.normalized[0].x,preserve?.25:.5625);near(out.normalized[0].y,preserve?.75:.6875);return {entry:preserve?'RN4I':'TN46',...out}});
check('point mode Kj3n routes edited controls to TN46 false',()=>{
 const mode={Jjg1:{kind:'owner'}},nodes=[{hbJJ:'contour1',nbJF:{kind:'point0'}},{hbJJ:'contour1',nbJF:{kind:'point1'}}],calls=[];
 const enumerator=xs=>({xs,index:-1});
 run(100685481,[mode,true],{
  'HjIa.AjIh::jj3z':h(1,()=>false),'TypeSpecification:1B0008C6::.ctor':h(0,()=>new Map()),
  'HjIa.AjIh::XjgV':h(1,()=>nodes),'TypeSpecification:1B0008BA::GetEnumerator':h(1,enumerator),
  'System.Collections.IEnumerator::MoveNext':h(1,e=>++e.index<e.xs.length),'TypeSpecification:1B0008BB::get_Current':h(1,e=>e.xs[e.index]),
  'TypeSpecification:1B0008C6::ContainsKey':h(2,(m,k)=>m.has(k)),'TypeSpecification:1B000800::.ctor':h(0,()=>[]),
  'TypeSpecification:1B0008C6::set_Item':h(3,(m,k,v)=>m.set(k,v),false),'TypeSpecification:1B0008C6::get_Item':h(2,(m,k)=>m.get(k)),
  'TypeSpecification:1B000800::Add':h(2,(xs,v)=>xs.push(v),false),
  'CbiJ.Bbib::nbPd<generic>':h(1,m=>m.size>0),'HjIa.AjIh::tj3j':h(1,()=>false),
  'TypeSpecification:1B0008C6::get_Values':h(1,m=>[...m.values()]),'CbiJ.Bbib::Sb73<generic>':h(1,x=>x),
  'Axure.DocumentModel.Objects.VectorShape::TN46':h(3,(owner,points,flag)=>calls.push({owner,points,flag}),false),
 });assert.equal(calls.length,1);assert.equal(calls[0].flag,0);assert.deepEqual(calls[0].points,[[nodes[0].nbJF,nodes[1].nbJF]]);return {calls,source:'Kj3n100685481 IL0238; caller Cj34100685480'};
});
check('TN46 calls hN4K with false then writes location size points',()=>{
 const owner={},points={kind:'world-points'},normal={kind:'normalized-points'},events=[],r=rect(75,75,250,100);
 run(100702684,[owner,points,false],{
  'Axure.DocumentModel.Objects.VectorShape::hN4K':h(4,(o,p,flag,out)=>{assert.equal(flag,0);assert.equal(p,points);set(out,normal);events.push('bounds:false');return r}),
  100722076:h(1,x=>point(val(x).x,val(x).y)),100722078:h(1,x=>({width:val(x).width,height:val(x).height})),
  'kJm2.KJm7::xJ0B':h(5,(_o,location,a,b,c)=>events.push({location,a,b,c}),false),
  'kJm2.KJm7::uJ0j':h(4,(_o,size,a,b)=>events.push({size,a,b}),false),
  'Axure.DocumentModel.Objects.VectorShape::DN4W':h(2,(_o,p)=>events.push({points:p}),false),
 });assert.deepEqual(events,['bounds:false',{location:point(75,75),a:false,b:1,c:null},{size:{width:250,height:100},a:false,b:1},{points:normal}]);return {events};
});
check('Cj34 commits Kj3n true before redraw callbacks',()=>{
 const mode={},events=[];run(100685480,[mode],{
  'HjIa.AjIh::Kj3n':h(2,(_o,flag)=>events.push({commitFlag:flag}),false),
  'NjVj.FjVF::mjVb':h(1,()=>events.push('mjVb'),false),'NjVj.FjVF::HjVJ':h(1,()=>({})),
  'rjV8.BjVn::njVl':h(1,()=>events.push('njVl'),false),'NjVj.FjVF::Update':h(1,()=>events.push('Update'),false),
 });assert.deepEqual(events,[{commitFlag:1},'mjVb','njVl','Update']);return {events};
});
for(const edited of [false,true])for(const lineLike of [false,true])check(`mode exit Tj3H Shape300 edited=${edited} lineLike=${lineLike}`,()=>{
 const owner={shape:300},state={},events=[],mode={Jjg1:owner,tjgR:edited,Njg3:{kind:'active-overlay'}};
 run(100685437,[mode],{
  'HjIa.AjIh::Ij3N':h(2,(_o,flag)=>events.push({cancelPending:flag}),false),
  'kJm2.KJm7::GJdZ':h(1,()=>false),'HjIa.AjIh::Lj3b':h(1,()=>false),
  'Axure.DocumentModel.Objects.VectorShape::tNnb':h(1,()=>lineLike),'Axure.DocumentModel.Objects.VectorShape::get_Shape':h(1,o=>o.shape),
  'GSqK.cSqL::DSO4':h(1,s=>s===300),'NjVj.FjVF::HjVJ':h(1,()=>state),
  'sj6G.IjWz::AI81':h(2,()=>events.push('overlay-end'),false),
 });assert(events.some(e=>e==='overlay-end'));return {events,clearedHistorySlot:state.ijkv===null};
});
for(const key of [35,36,37])for(const hasMode of [false,true])check(`point keyboard code=${key} activeMode=${hasMode}`,()=>{
 const events=[],mode=hasMode?{}:null;
 const handled=run(100685668,[{}, {},key],{
  'xjgh.Ljg2::mjgs':h(1,()=>mode),
  'HjIa.AjIh::SharpenSelectedPoints':h(2,(_mode,flag)=>events.push({operation:'sharp',flag}),false),
  'HjIa.AjIh::RoundSelectedPoints':h(3,(_mode,flag,kind)=>events.push({operation:'round',flag,kind}),false),
  'hjcD.Tjc6::FI8B':h(3,()=>{events.push('base-handler');return false}),
 });if(key===35)assert.deepEqual(events,hasMode?[{operation:'sharp',flag:0}]:[]);else if(key===36)assert.deepEqual(events,hasMode?[{operation:'round',flag:0,kind:3}]:[]);else assert.deepEqual(events,['base-handler']);return {handled,events};
});
check('tiny derivative collapsed-root changes minimum-owner origin',()=>{
 const C=(.4-1/3)*1e-6,ys=[0,C/3,-.4e-6/3+2*C/3,0],ps=ys.map((y,i)=>point([0,0,1,1][i],y));
 const bounds=retainedCurveBounds(ps),out=commitOracle({...rect(0,0,1,1),a:0},ps,2);
 near(bounds.y,-1.6e-8,1e-18);nearRect(out.owner,rect(-1,-2,2,2));return {controls:ps,retainedCurveBounds:bounds,...out};
});
// lN47 is replayed against exact G3bq, with matrix point operations explicit sinks.
for(const d of [point(0,0),point(-300,0),point(0,-300)])check(`maximum dimensions ${d.x}/${d.y}`,()=>{const old=rotated(rect(10,20,100,80),0),end=point(300,400),initial=run(100722259,[old,d,end]),holder={r:initial};run(100702697,[null,{ref:holder,key:'r'},old,d,end]);assert(holder.r.width<initial.width&&holder.r.height<initial.height);return {delta:d,initial,output:holder.r}});
const report={kind:'bounded-static-CIL-replay-and-independent-composition',generatedAt:new Date().toISOString(),assembly:{path:readJson(files[0]).AssemblyPath,sha256:readJson(files[0]).SHA256},sources:files.map(path=>({path,sha256:sha256(path)})).concat([{path:'research/gradient-angle-static-flow.mjs',sha256:sha256('research/gradient-angle-static-flow.mjs')},{path:'research/gradient-angle-flow-init-cil.json',sha256:sha256('research/gradient-angle-flow-init-cil.json')}]),probe:{path:'research/native-point-commit-evidence-probe.mjs',sha256:sha256('research/native-point-commit-evidence-probe.mjs')},methodsReplayed:[...visited].sort((a,b)=>a-b),caseCount:results.length,results,limits:['No vendor assembly execution or original GUI observation.','hN4K numeric orchestration is independently composed from retained instructions; primitives named in methodsReplayed execute retained instruction arrays. Default composition uses TN46 false, while RN4I true and its delta/cap behavior are separate comparison cases.','System arithmetic, point/rect storage, collections, rotation matrices, editor callbacks and method dispatch are explicit JavaScript sinks.','Contour construction/reindex filtering, full platform transform matrices, empty input and malformed nonfinite point lists are not replayed end-to-end.','Exit wrapper cases use Shape300 and explicit line-like/edited flag sinks; native special line reclassification and history manager internals are not executed.']};
fs.writeFileSync('research/native-point-commit-evidence-probes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:results.length,methods:report.methodsReplayed.length,status:'pass'}));
