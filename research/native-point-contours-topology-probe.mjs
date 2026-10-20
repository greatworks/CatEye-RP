// Retained CIL replay only: never loads or executes Axure assemblies or UI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const files=fs.readdirSync('research').filter(x=>/^native-point-(?:commit-evidence|contours-topology)-.*-cil\.json$/.test(x)).map(x=>`research/${x}`);
files.push('research/native-point-editing-evidence-shape-cil.json','research/native-point-editing-evidence-mode-cil.json');
const methods=new Map(files.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods.map(m=>[m.Token,{...m,file}]))));
const visited=new Set(),staticValues=new Map(),branches=[];
const val=x=>x?.ref?x.ref[x.key]:x;
const set=(r,v)=>{assert(r?.ref);r.ref[r.key]=v};
const h=(n,fn,ret=true)=>({n,fn,ret});
const p=(x,y)=>({x,y}),r=(x,y,width,height)=>({x,y,width,height});
const add=(a,b)=>p(a.x+b.x,a.y+b.y),sub=(a,b)=>p(a.x-b.x,a.y-b.y),mul=(a,k)=>p(a.x*k,a.y*k);
const center=a=>p(a.x+a.width/2,a.y+a.height/2);
const rotateSC=(point,c,s,cosa)=>{const d=sub(point,c);return add(c,p(d.x*cosa-d.y*s,d.x*s+d.y*cosa))};
const nan=()=>p(NaN,NaN);
const cp=(x,y,active=true,lower=nan(),higher=nan())=>({g5Eq:p(x,y),E5Ed:lower,a5EO:higher,W5EU:active});
function methodToken(i){
 if(methods.has(i.Operand))return i.Operand;
 const name=i.Resolved?.split('::')[1]?.replace(/<generic>$/,'');
 const matches=[...methods.values()].filter(x=>x.Name===name);
 assert.equal(matches.length,1,`ambiguous method ${i.Resolved}`);return matches[0].Token;
}
function run(token,args,calls={}){
 const m=methods.get(token);assert(m,`missing method ${token}`);visited.add(token);
 const code=m.Instructions,at=new Map(code.map((x,i)=>[x.Offset,i])),s=[],l=[];let pc=0,ticks=0;
 while(pc<code.length){assert(++ticks<100000,`loop ${token}`);const i=code[pc++],o=i.Op,j=()=>{assert(at.has(i.Operand));pc=at.get(i.Operand)};
  if(/^(br|br\.s|leave|leave\.s)$/.test(o)){j();continue}
  if(/^ldarg\.[0-3]$/.test(o)){s.push(args[+o.slice(6)]);continue}
  if(o==='ldarg.s'){s.push(args[i.Operand]);continue}if(o==='ldarga.s'){s.push({ref:args,key:i.Operand});continue}
  if(o==='starg.s'){args[i.Operand]=s.pop();continue}
  if(/^ldloc\.[0-3]$/.test(o)){s.push(l[+o.slice(6)]);continue}
  if(o==='ldloc.s'){s.push(l[i.Operand]);continue}if(o==='ldloca.s'){s.push({ref:l,key:i.Operand});continue}
  if(o.startsWith('stloc.')){l[o==='stloc.s'?i.Operand:+o.slice(6)]=s.pop();continue}
  if(o.startsWith('ldc.i4')){s.push(o==='ldc.i4'||o==='ldc.i4.s'?i.Operand:o==='ldc.i4.m1'?-1:+o.slice(7));continue}
  if(o==='ldc.r8'){s.push(i.Operand);continue}if(o==='ldnull'){s.push(null);continue}
  if(o==='ldsfld'){
   if(i.Resolved.includes('<Module>'))s.push({module:true});
   else if(i.Resolved==='hHBO.fHBd::QHVg')s.push({width:0,height:0});
   else if(i.Resolved==='h5uH.j5u5::O5sD')s.push(r(0,0,0,0));
   else if(i.Resolved==='m5wr.f5wV::m5wA')s.push(nan());
   else s.push(staticValues.get(i.Operand)??(i.Resolved.endsWith('::<>9')?{}:null));continue;
  }
  if(o==='stsfld'){staticValues.set(i.Operand,s.pop());continue}
  if(o==='ldftn'){s.push(methodToken(i));continue}
  if(o==='ldfld'){const x=val(s.pop());if(x?.module){assert(fields.has(i.Operand));s.push(fields.get(i.Operand).value)}else s.push(x[i.Resolved.split('::')[1]]);continue}
  if(o==='ldflda'){s.push({ref:val(s.pop()),key:i.Resolved.split('::')[1]});continue}
  if(o==='stfld'){const v=s.pop(),x=val(s.pop());x[i.Resolved.split('::')[1]]=v;continue}
  if(o==='ldobj'||o==='ldind.ref'){s.push(val(s.pop()));continue}
  if(o==='stobj'||o==='stind.ref'){const v=s.pop();set(s.pop(),v);continue}
  if(o==='initobj'){set(s.pop(),p(0,0));continue}
  if(/^br(true|false)(\.s)?$/.test(o)){if(!!s.pop()===o.startsWith('brtrue'))j();continue}
  if(/^(beq|bne.un|bge|ble|bgt|blt)(\.un)?$/.test(o)){const b=s.pop(),a=s.pop(),u=Number.isNaN(a)||Number.isNaN(b);let yes=o==='bne.un'?a!==b:({beq:a===b,bge:a>=b,ble:a<=b,bgt:a>b,blt:a<b})[o.replace(/\.un$/,'')];if(o.endsWith('.un')&&u)yes=true;if(yes)j();continue}
  if(['add','sub','mul','div','ceq','cgt','cgt.un','clt','or','and'].includes(o)){const b=s.pop(),a=s.pop();s.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,ceq:()=>a===b,cgt:()=>a>b,'cgt.un':()=>a>b||Number.isNaN(a)||Number.isNaN(b),clt:()=>a<b,or:()=>a|b,and:()=>a&b})[o]());continue}
  if(o==='neg'){s.push(-s.pop());continue}if(o==='dup'){s.push(s.at(-1));continue}if(o==='pop'){s.pop();continue}
  if(['box','nop','constrained.','castclass'].includes(o))continue;
  if(['call','callvirt','newobj'].includes(o)){
   const c=calls[i.Operand]??calls[i.Resolved]??common[i.Operand]??common[i.Resolved]??collectionSink(i,o);
   assert(c,`unmodelled ${token}/${i.Offset.toString(16)} ${i.Operand} ${i.Resolved}`);
   const a=s.splice(s.length-c.n,c.n),v=c.fn(...a);if(c.ret!==false)s.push(v);continue;
  }
  if(o==='ret')return s.pop();throw Error(`unsupported ${token}/${i.Offset.toString(16)} ${o}`);
 }throw Error(`no ret ${token}`);
}
const enumerator=xs=>({values:xs,index:-1});
const invoke=(d,x)=>run(d.token,d.target===null?[x]:[d.target,x]);
function collectionSink(i,op){
 const name=i.Resolved;
 if(name==='tIaS.UIaN::DkYN')return h(0,()=>{},false);
 if(name==='System.IDisposable::Dispose')return h(1,()=>{},false);
 if(name==='System.Object::.ctor'||name==='N5lc.N5lk::.ctor')return h(1,()=>{},false);
 if(name.endsWith('::Select<generic>'))return h(2,(xs,d)=>xs.map(x=>invoke(d,x)));
 if(name.endsWith('::lbiN<generic>'))return h(2,(xs,d)=>xs.filter(x=>invoke(d,x)));
 if(name.endsWith('::xbio<generic>'))return h(3,(xs,d,ignoreNull)=>xs.flatMap(x=>{const v=invoke(d,x);return ignoreNull&&v===null?[]:v}));
 if(name.endsWith('::Sb73<generic>'))return h(1,x=>[...x]);
 if(name.endsWith('::tb7R<generic>'))return h(1,x=>x?[...x]:[]);
 if(name.endsWith('::nbPd<generic>'))return h(1,x=>x.length>0);
 if(name.endsWith('::IsEmpty<generic>'))return h(1,x=>x.length===0);
 if(name.endsWith('::First<generic>'))return h(1,x=>{if(!x.length)throw Error('InvalidOperationException: empty First');return x[0]});
 if(name.endsWith('::Last<generic>'))return h(1,x=>{if(!x.length)throw Error('InvalidOperationException: empty Last');return x.at(-1)});
 if(name.endsWith('::GetEnumerator'))return h(1,enumerator);
 if(name.endsWith('::get_Current'))return h(1,e=>val(e).values[val(e).index]);
 if(name.endsWith('::MoveNext'))return h(1,e=>++val(e).index<val(e).values.length);
 if(name.endsWith('::get_Count'))return h(1,x=>x.length);
 if(name.endsWith('::get_Item'))return h(2,(x,n)=>x[n]);
 if(name.endsWith('::Add'))return h(2,(x,v)=>x.push(v),false);
 if(name.endsWith('::Remove'))return h(2,(x,v)=>{const n=x.indexOf(v);if(n<0)return false;x.splice(n,1);return true});
 if(name==='TypeSpecification:1B0001EA::Invoke')return h(2,invoke);
 if(op==='newobj'&&name.startsWith('.<>c__DisplayClass'))return h(0,()=>({}));
 if(op==='newobj'&&name.startsWith('TypeSpecification:')){
  const delegates=['1B000F32','1B0008D1','1B000F31','1B000BA8','1B0001E9','1B0001EA','1B001393','1B000F41','1B000F57'];
  if(delegates.some(t=>name.includes(t)))return h(2,(target,token)=>({target,token}));
  assert(['1B0008A7','1B000F3F','1B0001E6'].some(t=>name.includes(t)),`unknown ctor ${name}`);return h(0,()=>[]);
 }
}
const common={
 'System.Math::Floor':h(1,Math.floor),'System.Math::Ceiling':h(1,Math.ceil),'System.Math::Abs':h(1,Math.abs),'System.Math::Max':h(2,Math.max),
 100721934:h(1,a=>val(a).x),100721936:h(1,a=>val(a).y),100721939:h(1,a=>Number.isNaN(val(a).x)||Number.isNaN(val(a).y)),
 100721941:h(2,p),100721944:h(2,add),100721945:h(2,sub),100721952:h(2,mul),100721953:h(2,(a,k)=>mul(a,1/k)),
 100688812:h(3,(a,b,e)=>Math.abs(a-b)<e),100688813:h(2,(a,e)=>run(100688813,[a,e])),100688814:h(2,(a,e)=>run(100688814,[a,e])),100688828:h(1,a=>run(100688828,[a])),100688829:h(1,a=>run(100688829,[a])),
 100722090:h(4,r),100722092:h(3,(a,w,h)=>r(a.x,a.y,w,h)),
 100721995:h(2,(m,point)=>m(point)),100722000:h(3,(c,s,k)=>point=>rotateSC(point,c,s,k)),
 'kJm2.KJm7::GJOu':h(1,o=>o.stroke),
 'Axure.DocumentModel.Objects.VectorShape::YN4e':h(3,(o,exact,expanded)=>{o.bounds={exact,expanded}},false),
 'Axure.DocumentModel.Objects.VectorShape::set__CachedInternalSizingRect':h(2,(o,v)=>{o.cache=v},false),
 'kJm2.KJm7::get_SizingRect':h(1,o=>o.frame),
 'O5ut.K5u9::uIuQ':h(1,x=>x.angle),
 'O5ut.K5u9::l3bC':h(1,center),
 'O5ut.K5u9::V3bh':h(1,x=>Math.sin(x.angle*Math.PI/180)),
 'O5ut.K5u9::J3ba':h(1,x=>Math.cos(x.angle*Math.PI/180)),
 100720598:h(4,(point,c,s,k)=>rotateSC(point,c,s,k)),
};
for(const [token,key] of [[100722047,'x'],[100722049,'y'],[100722051,'width'],[100722053,'height'],[100722055,'x'],[100722056,'y']])common[token]=h(1,a=>val(a)[key]);
common[100722057]=h(1,a=>val(a).x+val(a).width);common[100722058]=h(1,a=>val(a).y+val(a).height);
common[100722014]=h(1,a=>p(val(a).x,val(a).y));common[100722017]=h(1,a=>p(val(a).x+val(a).width,val(a).y+val(a).height));
common[100722078]=h(1,a=>({width:val(a).width,height:val(a).height}));
// Exact retained method dispatch; generic names resolve to the unique actual body.
const exact=[100723170,100723171,100723166,100723167,100723168,100723169,100722289,100722265,100722267,100720164,100720531,100721991,100719020,100719036,100702830,100702831,100702832,100702833,100702834,100723281,100723286,100723291,100702693,100722119,100702688,100702690,100702689,100703448,100703449,100703450];
const arities={100723170:1,100723171:1,100723166:1,100723167:1,100723168:1,100723169:1,100722289:2,100722265:2,100722267:2,100720164:2,100720531:3,100721991:1,100719020:1,100719036:2,100702830:2,100702831:2,100702832:2,100702833:2,100702834:2,100723281:2,100723286:2,100723291:2,100702693:2,100722119:2,100702688:3,100702690:4,100702689:4,100703448:2,100703449:2,100703450:2};
for(const token of exact){const m=methods.get(token);if(!m)continue;common[token]=h(arities[token],(...args)=>run(token,args),![100723168,100723169,100722289,100722265,100722267].includes(token))}
for(const name of ['wHrl','uHry','MHr4','KHr8','XHrT','cHru','Link','D5l0','V5la','K3ju','b5p7','z5wa','o5Eh','v5ED','KN4C','Y5uk','PN4L','iN4x']){
 const m=[...methods.values()].find(m=>m.Name===name);assert(m,`body ${name}`);
 const ins=[...methods.values()].flatMap(m=>m.Instructions).filter(i=>i.Resolved?.endsWith(`::${name}`)||i.Resolved?.endsWith(`::${name}<generic>`));
 for(const i of ins)common[i.Resolved]=common[m.Token];
}
common[100720124]=h(3,(a,b,index)=>{const curve={};run(100720124,[curve,a,b,index]);return curve});
common[100720125]=h(6,(...args)=>run(100720125,args),false);
common['F5Ek.z5EE::.ctor']=h(4,(anchor,lower,higher,flag)=>({g5Eq:anchor,E5Ed:lower,a5EO:higher,W5EU:flag}));
// Numeric curve-bounds sink: independent cubic extrema; no native solver parity claim here.
function curveBounds(c){
 const bounds=axis=>{const q=[c.O5lO,c.w5au,c.e5aw,c.x5ld].map(x=>x[axis]);const a=-q[0]+3*q[1]-3*q[2]+q[3],b=3*q[0]-6*q[1]+3*q[2],d=-3*q[0]+3*q[1],ts=[0,1];
  if(a===0){if(b!==0)ts.push(-d/(2*b))}else{const disc=4*b*b-12*a*d;if(disc>=0)ts.push((-2*b+Math.sqrt(disc))/(6*a),(-2*b-Math.sqrt(disc))/(6*a))}
  const vs=ts.filter(t=>t>=0&&t<=1).map(t=>q[0]+t*(d+t*(b+t*a)));return [Math.min(...vs),Math.max(...vs)];};
 const x=bounds('x'),y=bounds('y');return r(x[0],y[0],x[1]-x[0],y[1]-y[0]);
}
common['N5lc.N5lk::h3jv']=h(1,curveBounds);
common['Q5hy.I5hl::h3jv']=h(1,curveBounds);
function union(rects){if(!rects.length)return r(0,0,0,0);const l=Math.min(...rects.map(a=>a.x)),t=Math.min(...rects.map(a=>a.y));return r(l,t,Math.max(...rects.map(a=>a.x+a.width))-l,Math.max(...rects.map(a=>a.y+a.height))-t)}
common['T5pS.d5pN::k5pM']=h(2,(xs,ignore)=>{assert.equal(!!ignore,false);return union(xs)});
common[100722093]=h(3,(address,point,size)=>set(address,r(point.x,point.y,size.width,size.height)),false);
common['h5uH.j5u5::Q3bM']=h(1,a=>center(val(a)));
common['h5uH.j5u5::n3bc']=h(1,a=>p(val(a).x,val(a).y));
common['h5uH.j5u5::G3bW']=h(1,a=>p(val(a).x+val(a).width,val(a).y));
common['h5uH.j5u5::u3bD']=h(1,a=>p(val(a).x+val(a).width,val(a).y+val(a).height));
common[100720576]=h(4,rotateSC);
common[100722251]=h(4,(point,horizontal,vertical,origin)=>{const q=sub(point,origin),det=horizontal.x*vertical.y-horizontal.y*vertical.x;assert(Math.abs(det)>1e-12);return p((q.x*vertical.y-q.y*vertical.x)/det,(horizontal.x*q.y-horizontal.y*q.x)/det)});
const results=[];
function check(name,fn){try{results.push({name,passed:true,observed:fn()})}catch(e){console.error(name);throw e}}
const curveRecord=c=>({index:c.i5lY,start:c.O5lO,end:c.x5ld,control1:c.w5au,control2:c.e5aw,line:!!c.I5l4,active:!!c.Y5XV,previous:c.z5lU?.i5lY,next:c.M5lZ?.i5lY});
function contours(raw){return run(100723170,[raw])}
function selected(cs,rotated){return cs.flatMap(c=>run(rotated?100702830:100702832,[{},c]))}
function normalize(raw,stroke=1){const owner={stroke},out={};const bounds=run(100702690,[owner,raw,false,{ref:out,key:'points'}]);return {bounds,points:out.points,...owner.bounds};}
function normalizeRotated(raw,frame,stroke=1){const owner={stroke,frame},out={};const bounds=run(100702689,[owner,raw,false,{ref:out,key:'points'}]);return {bounds,points:out.points,...owner.bounds};}
const curve=(start,end,c1=start,c2=end,line=true,active=true)=>({O5lO:start,x5ld:end,w5au:c1,e5aw:c2,I5l4:line,Y5XV:active,i5lY:-1});
const degenerate=c=>!!run(100720164,[c,.001]);
const expectedDegenerate=c=>{const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<.001;return near(c.x5ld,c.O5lO)&&(c.I5l4||near(c.x5ld,c.e5aw)&&near(c.O5lO,c.w5au))};
for(const xy of [[.0004,.0004],[.0005,.0005],[.0006,.0006],[.000999,0],[.001,0],[.001001,0]])for(const line of [true,false])check(`strict Manhattan endpoint ${xy}/${line}`,()=>{const c=curve(p(0,0),p(...xy),p(0,0),p(...xy),line),got=degenerate(c);assert.equal(got,expectedDegenerate(c));return {curve:curveRecord(c),degenerate:got}});
for(const side of ['start','end'])for(const amount of [.000999,.001,.001001,10])check(`handle ${side} threshold ${amount}`,()=>{const c=curve(p(0,0),p(0,0),side==='start'?p(amount,0):p(0,0),side==='end'?p(0,amount):p(0,0),false);const got=degenerate(c);assert.equal(got,amount<.001);return {curve:curveRecord(c),degenerate:got}});
for(const distance of [.0005,.5,.999999,1,1.000001,10])check(`isolated surviving curve endpoint distance ${distance}`,()=>{const c=curve(p(0,0),p(distance,0),p(0,10),p(distance,10),false),holder={cs:[[c]]},count=run(100723166,[{ref:holder,key:'cs'}]);assert.equal(count,distance<1?1:0);return {remaining:holder.cs.map(xs=>xs.map(curveRecord)),count}});
for(const closed of [false,true])check(`two anchors closing flag ${closed}`,()=>{const raw=[[cp(10,20,true),cp(30,40,closed)]],cs=contours(raw);assert.equal(cs[0].length,2);assert.deepEqual(cs[0].map(x=>!!x.Y5XV),[closed,true]);assert.equal(selected(cs,false).length,closed?2:1);assert.equal(selected(cs,true).length,2);return {curves:cs.map(xs=>xs.map(curveRecord)),unrotatedBounds:union(selected(cs,false)),rotatedLocalBounds:union(selected(cs,true))}});
check('removed segments reindex globally and relink only within each surviving contour',()=>{const raw=[[cp(5,5,false)],[cp(0,0),cp(10,0,false)],[cp(30,30),cp(30,30),cp(40,40,false)]],cs=contours(raw);assert.equal(cs.length,2);assert.deepEqual(cs.flat().map(x=>x.i5lY),[0,1,2,3]);assert.deepEqual(cs.flat().map(x=>[x.z5lU.i5lY,x.M5lZ.i5lY]),[[1,1],[0,0],[3,3],[2,2]]);return cs.map(xs=>xs.map(curveRecord))});
check('M-only fallback uses exact first raw anchor and retains the point',()=>{const raw=[[cp(12.25,30.75,false)]],out=normalize(raw,4);assert.deepEqual(out.exact,r(12.25,30.75,0,0));assert.deepEqual(out.bounds,r(10,28,4,4));assert.deepEqual(out.points[0][0].g5Eq,p(.5625,.6875));assert.equal(out.points[0][0].W5EU,false);return out});
check('multiple isolated contours use first raw anchor only and keep all output points',()=>{const raw=[[cp(12.25,30.75,false)],[cp(100,200,false)]],out=normalize(raw,4);assert.deepEqual(out.exact,r(12.25,30.75,0,0));assert.equal(out.points.length,2);assert.deepEqual(out.points[1][0].g5Eq,p(22.5,43));return out});
check('isolated contour beside valid contour is omitted only from bounds',()=>{const raw=[[cp(-50,-60,false)],[cp(10,20),cp(30,40,false)]],out=normalize(raw);assert.deepEqual(out.exact,r(10,20,20,20));assert.equal(out.points.length,2);assert.deepEqual(out.points[0][0].g5Eq,p(-3,-4));return out});
check('nondegenerate inactive self-loop avoids anchor fallback and yields zero unrotated bounds',()=>{const raw=[[cp(50,60,false,p(60,70),p(40,70))]],cs=contours(raw),out=normalize(raw);assert.equal(cs.length,1);assert.equal(selected(cs,false).length,0);assert.deepEqual(out.exact,r(0,0,0,0));assert.deepEqual(out.bounds,r(-1,-1,1,1));assert.equal(out.points[0][0].W5EU,false);return {curves:cs.map(xs=>xs.map(curveRecord)),rotatedLocalBounds:union(selected(cs,true)),...out}});
check('empty outer list has zero union fallback and empty output',()=>{const out=normalize([]);assert.deepEqual(out.exact,r(0,0,0,0));assert.deepEqual(out.points,[]);assert.deepEqual(out.bounds,r(-1,-1,1,1));return out});
check('empty inner contour throws before normalization fallback',()=>{assert.throws(()=>normalize([[]]),/empty Last/);return {throws:'InvalidOperationException: empty Last',scope:'uHry Last(rawContour), not a product or GUI assertion'}});
check('open contour closing controls affect rotated selector but not unrotated selector',()=>{const raw=[[cp(0,0,true,p(-100,100),nan()),cp(10,0,false,nan(),p(110,100))]],cs=contours(raw);const a=union(selected(cs,false)),b=union(selected(cs,true));assert.deepEqual(a,r(0,0,10,0));assert.equal(b.height,75);assert(b.width>10);return {curves:cs.map(xs=>xs.map(curveRecord)),unrotated:a,rotatedLocal:b}});
check('every raw flag and both handles survive normalization even when its temporary curve was pruned',()=>{const raw=[[cp(10,20,true,p(10,20),p(10,20)),cp(10,20,true,p(10,20),p(30,40)),cp(30,40,false)]],out=normalize(raw);assert.equal(out.points[0].length,3);assert.deepEqual(out.points[0].map(x=>x.W5EU),[true,true,false]);assert.deepEqual(out.points[0][0].E5Ed,p(0,0));assert.deepEqual(out.points[0][1].a5EO,p(1,1));return out});
check('rotated all-curves-pruned uses zero union transformed around old center, not first point',()=>{const frame={...r(100,80,100,60),angle:90},out=normalizeRotated([[cp(125,96,false)]],frame,4);assert.deepEqual(out.exact,r(260,-40,0,0));assert.deepEqual(out.bounds,r(258,-42,4,4));assert(Math.abs(out.points[0][0].g5Eq.x-34.5)<1e-10);assert(Math.abs(out.points[0][0].g5Eq.y-34.25)<1e-10);return {frame,...out}});
check('rotated empty outer input follows same zero union geometry and preserves empty output',()=>{const frame={...r(100,80,100,60),angle:90},out=normalizeRotated([],frame,4);assert.deepEqual(out.exact,r(260,-40,0,0));assert.deepEqual(out.points,[]);return {frame,...out}});
for(const count of [0,1,3])check(`ordinary Kj3n node grouping count=${count}`,()=>{
 const nodes=Array.from({length:count},(_,i)=>({hbJJ:i===2?'second':'first',nbJF:cp(i*10,i*20,false)})),calls=[];
 run(100685481,[{Jjg1:{}},true],{
  'HjIa.AjIh::jj3z':h(1,()=>false),'HjIa.AjIh::XjgV':h(1,()=>nodes),'HjIa.AjIh::tj3j':h(1,()=>false),
  'TypeSpecification:1B0008C6::.ctor':h(0,()=>new Map()),'TypeSpecification:1B000800::.ctor':h(0,()=>[]),
  'TypeSpecification:1B0008C6::ContainsKey':h(2,(m,k)=>m.has(k)),'TypeSpecification:1B0008C6::get_Item':h(2,(m,k)=>m.get(k)),
  'TypeSpecification:1B0008C6::set_Item':h(3,(m,k,v)=>m.set(k,v),false),'TypeSpecification:1B0008C6::get_Values':h(1,m=>[...m.values()]),
  'CbiJ.Bbib::nbPd<generic>':h(1,m=>m.size>0),'Axure.DocumentModel.Objects.VectorShape::TN46':h(3,(_o,raw,flag)=>calls.push({raw,flag}),false),
 });assert.equal(calls.length,count?1:0);if(count){assert.equal(calls[0].flag,0);assert(calls[0].raw.every(c=>c.length));assert.equal(calls[0].raw.flat().length,count)}return {count,calls};
});
// Explicit product-adapter convention; this is NOT a claim about an unobserved native SVG importer.
function authoredCarriers(commands,frame){const result=[];let contour;
 const world=q=>rotateSC(p(frame.x+q.x*frame.width,frame.y+q.y*frame.height),center(frame),Math.sin(frame.angle*Math.PI/180),Math.cos(frame.angle*Math.PI/180));
 for(const c of commands){if(c.op==='M'){contour=[];result.push(contour);const a=world(c);contour.push(cp(a.x,a.y,false));continue}
  assert(contour);if(c.op==='Z'){contour.at(-1).W5EU=true;continue}
  const prior=contour.at(-1);prior.W5EU=true;const a=world(c),next=cp(a.x,a.y,false);
  if(c.op==='C'){prior.a5EO=world(p(c.x1,c.y1));next.E5Ed=world(p(c.x2,c.y2))}else assert.equal(c.op,'L');contour.push(next);
 }return result;
}
const authoredFixtures=[];
function fixture(name,frame,commands,stroke,expected){const raw=authoredCarriers(commands,frame),out=normalizeRotated(raw,frame,stroke);assert.deepEqual(out.bounds,expected);const value={name,adapter:'explicit M/L/C/Z convention; missing inactive handles are NaN; commands preserved',frame,stroke,commands,raw,expectedOwner:expected,expectedPoints:out.points};authoredFixtures.push(value);return value;}
check('authored main rectangle plus distant sub-threshold line preserves both contours',()=>fixture('main-and-tiny-line',{...r(100,80,200,100),angle:0},[{op:'M',x:-.25,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'},{op:'M',x:2,y:2},{op:'L',x:2.0000025,y:2}],1,r(50,80,250,100)));
check('authored only tiny line falls back to first anchor while retaining its other endpoint',()=>fixture('only-tiny-line',{...r(100,80,200,100),angle:0},[{op:'M',x:2,y:2},{op:'L',x:2.0000025,y:2}],4,r(498,278,4,4)));
check('authored M-only uses first point fallback',()=>fixture('only-move',{...r(100,80,200,100),angle:0},[{op:'M',x:.25,y:.25}],4,r(148,103,4,4)));
check('authored duplicate endpoint plus Z keeps output point count',()=>{const f=fixture('duplicate-endpoint-close',{...r(100,80,200,100),angle:0},[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'L',x:0,y:0},{op:'Z'}],1,r(100,80,200,100));assert.equal(f.expectedPoints[0].length,5);return f});
check('authored equal-endpoint cubic with distant handles remains a participating loop',()=>fixture('loop-cubic',{...r(100,80,200,100),angle:0},[{op:'M',x:0,y:0},{op:'C',x1:0,y1:1,x2:1,y2:1,x:0,y:0}],1,r(100,80,89,75)));
function oracleContours(raw){let index=0;return raw.map(points=>{
 if(!points.length)throw Error('empty contour');
 const cs=points.map((b,n)=>{const a=points[(n+points.length-1)%points.length],absent=q=>Number.isNaN(q.x)||Number.isNaN(q.y);return curve(a.g5Eq,b.g5Eq,absent(a.a5EO)?a.g5Eq:a.a5EO,absent(b.E5Ed)?b.g5Eq:b.E5Ed,absent(a.a5EO)&&absent(b.E5Ed),a.W5EU)}).filter(c=>!expectedDegenerate(c));
 if(cs.length===1&&Math.abs(cs[0].x5ld.x-cs[0].O5lO.x)+Math.abs(cs[0].x5ld.y-cs[0].O5lO.y)>=1)return [];
 for(const c of cs)c.i5lY=index++;
 for(let n=0;n<cs.length;n++){cs[n].z5lU=cs[(n+cs.length-1)%cs.length];cs[n].M5lZ=cs[(n+1)%cs.length]}
 return cs;
 }).filter(cs=>cs.length)}
for(let mask=0;mask<16;mask++)check(`independent topology oracle active-mask=${mask}`,()=>{
 const raw=[[cp(0,0,!!(mask&1)),cp(.0004,.0004,!!(mask&2)),cp(10,0,!!(mask&4),p(9,4),p(10,5)),cp(10,10,!!(mask&8))],[cp(50,50,false)]];
 const actual=contours(raw),expected=oracleContours(raw);assert.deepEqual(actual.map(cs=>cs.map(curveRecord)),expected.map(cs=>cs.map(curveRecord)));return {mask,curves:actual.map(cs=>cs.map(curveRecord))};
});
for(const [angle,delta] of [[45,.0007],[37,.00062]])check(`Manhattan pruning happens after inverse old-center rotation angle=${angle}`,()=>{
 const raw=[[cp(200,200,true),cp(200+delta,200+delta,false)]],frame={...r(0,0,100,100),angle},c=center(frame),s=Math.sin(angle*Math.PI/180),co=Math.cos(angle*Math.PI/180);
 const local=raw.map(cs=>cs.map(q=>{const anchor=rotateSC(q.g5Eq,c,-s,co);return cp(anchor.x,anchor.y,q.W5EU)}));
 assert.equal(contours(raw).flat().length,2);assert.equal(contours(local).flat().length,0);
 const out=normalizeRotated(raw,frame,1),empty=normalizeRotated([],frame,1);assert.deepEqual(out.bounds,empty.bounds);return {frame,world:raw,local,worldRetained:2,localRetained:0,...out};
});
const usedFiles=[...new Set([...visited].map(token=>methods.get(token).file))];
const staticEvidence=['research/native-point-contours-topology-rect-static-cil.json','research/native-point-contours-topology-size-static-cil.json','research/native-point-contours-topology-collections-cil.json','research/native-point-contours-topology-where-cil.json','research/native-point-contours-topology-selectmany-cil.json','research/native-point-commit-evidence-primitives-cil.json','research/native-point-commit-evidence-bounds-cil.json','research/native-point-commit-evidence-probes.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'];
const report={kind:'bounded-static-CIL-topology-replay',generatedAt:new Date().toISOString(),originalAssemblyExecuted:false,originalGuiCompared:false,assembly:{path:readJson(files[0]).AssemblyPath,sha256:readJson(files[0]).SHA256},sources:[...new Set([...usedFiles,...staticEvidence])].map(path=>({path,sha256:sha256(path)})),probe:{path:'research/native-point-contours-topology-probe.mjs',sha256:sha256('research/native-point-contours-topology-probe.mjs')},methodsReplayed:[...visited].sort((a,b)=>a-b).map(token=>({token,name:methods.get(token).Name,file:methods.get(token).file})),checks:{total:results.length,passed:results.length},authoredFixtures,results,limits:['No target DLL, native GUI, font renderer or original generated HTML execution.','Collection iteration/delegates, primitive storage, constructors for structs/closures, matrix arithmetic, cubic extrema and rectangle union are explicit JavaScript sinks. Source-backed CIL controls topology, pruning, indexing, selectors and hN4K/iN4x normalization orchestration.','Numeric curve-bounds sink uses independent polynomial extrema; native tiny-polynomial solver edge parity belongs to frozen prior evidence, not this probe.','Empty outer input is a geometry-function behavior; ordinary Kj3n with jj3z=false and no input nodes does not call TN46. Empty inner contour reaches native Last(empty) exception.','Authored M/L/C/Z carrier adapter is an explicit independent representation choice: unavailable inactive handles are NaN, not a claim about a native SVG importer.','Full editor lifecycle, native history, special jj3z/tj3j gesture states and generic affine transforms are outside these bounded cases.']};
export {normalizeRotated as replayNativeCommit,authoredCarriers,contours,curveRecord,report};
if(process.argv[1]?.replaceAll('\\','/').endsWith('/native-point-contours-topology-probe.mjs')){
 fs.writeFileSync('research/native-point-contours-topology-probes.json',JSON.stringify(report,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2)+'\n');
 console.log(JSON.stringify({cases:results.length,methods:visited.size,status:'pass'}));
}
