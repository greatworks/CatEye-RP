import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
import {parseBoundExpression,evaluateBoundAst,controlledContext,geometryFixture} from './runtime-transform-bindings-expression-probe.mjs';
const files=['research/runtime-transform-format-move-info-cil.json','research/runtime-transform-bindings-flatten-cil.json','research/runtime-transform-bindings-flatten-recursive-cil.json'];
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const deref=r=>r?.ref?r.ref[r.key]:r;
function replay(token,args){
 const m=methods.get(token),code=m.Instructions,at=new Map(code.map((x,i)=>[x.Offset,i])),s=[],l=[];let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,'stack underflow');return s.pop();},take=n=>s.splice(s.length-n),jump=n=>{assert.ok(at.has(n));pc=at.get(n);};
 while(pc<code.length){assert.ok(++steps<50000,'bounded steps');const i=code[pc++],o=i.Op,v=i.Operand,n=i.Resolved;
  if(['nop','constrained.'].includes(o))continue;
  if(o.startsWith('ldc.i4')){s.push(o==='ldc.i4'||o==='ldc.i4.s'?v:o==='ldc.i4.m1'?-1:Number(o.slice(7)));continue;}
  if(o==='ldnull'){s.push(null);continue;}if(o==='ldstr'){s.push(n??'');continue;}
  if(o.startsWith('ldarga')){s.push({ref:args,key:v});continue;}if(o.startsWith('ldarg.')){s.push(args[o==='ldarg.s'?v:Number(o.slice(6))]);continue;}
  if(o.startsWith('ldloca')){s.push({ref:l,key:v});continue;}if(o.startsWith('ldloc.')){s.push(l[o==='ldloc.s'?v:Number(o.slice(6))]);continue;}if(o.startsWith('stloc.')){l[o==='stloc.s'?v:Number(o.slice(6))]=pop();continue;}
  if(o==='ldsfld'){s.push(n.startsWith('.<Module>')?{module:true}:{nativeStatic:n});continue;}
  if(o==='ldfld'){const a=pop();s.push(a?.module?fields.get(v).value:a[n.split('::')[1]]);continue;}
  if(o==='dup'){s.push(s.at(-1));continue;}if(o==='pop'){pop();continue;}if(o==='box')continue;
  if(o==='isinst'){const a=pop();s.push(n.endsWith('BinaryExpr')&&a?.kind==='binary'?a:null);continue;}
  if(o==='castclass'){const a=pop();assert.ok(a&&(!n.endsWith('BoundaryDirectionLiteral')||a.kind==='direction'));s.push(a);continue;}
  if(o==='newarr'){s.push(Array(pop()).fill(null));continue;}if(o==='stelem.ref'){const val=pop(),index=pop(),arr=pop();arr[index]=val;continue;}
  if(o==='neg'||o==='not'){const a=pop();s.push(o==='neg'?-a|0:~a);continue;}
  if(['add','sub','xor','and','or','mul','shl','shr','shr.un'].includes(o)){const b=pop(),a=pop();s.push(o==='add'?(a+b)|0:o==='sub'?(a-b)|0:o==='xor'?a^b:o==='and'?a&b:o==='or'?a|b:o==='mul'?Math.imul(a,b):o==='shl'?a<<b:o==='shr'?a>>b:a>>>b);continue;}
  if(o==='br'||o==='br.s'||o==='leave'){jump(v);continue;}
  if(o.startsWith('brtrue')||o.startsWith('brfalse')){const yes=Boolean(pop());if(o.startsWith('brtrue')?yes:!yes)jump(v);continue;}
  if(['beq','bne.un','blt','bgt','ble','bge'].includes(o)){const b=pop(),a=pop();if(o==='beq'?a===b:o==='bne.un'?a!==b:o==='blt'?a<b:o==='bgt'?a>b:o==='ble'?a<=b:a>=b)jump(v);continue;}
  if(o==='switch'){const a=pop();const targets=Array.isArray(v)?v:String(v).split(',').map(Number);if(a>=0&&a<targets.length)jump(targets[a]);continue;}
  if(o==='ret')return s.pop();
  if(['call','callvirt','newobj'].includes(o)){
   if(n==='wIhA.zIhQ::sIho'){s.push(decodeLiteral(pop()));continue;}
   if(n==='System.Int32::ToString'){s.push(String(deref(pop())));continue;}
   if(n==='System.String::Concat'){const b=pop(),a=pop();s.push(a+b);continue;}
   if(n==='System.String::op_Equality'||n==='RtnB.ztnG::op_Equality'){const b=pop(),a=pop();s.push(a===b);continue;}
   if(n==='Axure.DocumentModel.Interaction.MoveWidgetInfo::get_BoundaryCondition'){s.push(pop().boundary);continue;}
   if(n==='Axure.DocumentModel.Expressions.BinaryExpr::get_Operation'){s.push(pop().operation);continue;}
   if(n==='Axure.DocumentModel.Expressions.BinaryExpr::get_LeftExpr'){s.push(pop().left);continue;}
   if(n==='Axure.DocumentModel.Expressions.BinaryExpr::get_RightExpr'){s.push(pop().right);continue;}
   if(n==='Axure.DocumentModel.Expressions.BoundaryDirectionLiteral::get_DirectionString'){s.push(pop().direction);continue;}
   if(n==='Axure.DocumentModel.Expressions.ExprFunctions::RS57'||n==='Axure.DocumentModel.Expressions.ExprFunctions::QS5P'||n==='Axure.DocumentModel.Interaction.MoveWidgetInfo::DNQQ'){const argc=n.endsWith('DNQQ')?3:n.endsWith('QS5P')?2:1;s.push(replay(v,take(argc)));if(n.endsWith('QS5P'))s.pop();continue;}
   if(n==='CbiJ.Bbib::Fbav'){const a=pop();s.push(a==null||a.length===0);continue;} // Controlled empty-collection sink.
   if(n==='VJs7.cJsP::lJsh'){pop().length=0;continue;}
   if(n==='VJs7.cJsP::qJs2'){const val=pop(),scope=pop();scope.push(val);continue;}
   if(n==='BJsK.uJsL::.ctor'){const expr=pop(),name=pop();s.push({name,expr});continue;}
   if(n==='BJsK.uJsL::oIYX'){s.push(pop().name);continue;}
   if(n==='QIVg.zIV3::.ctor'){const a=take(3);s.push({kind:'variable',name:a[2]});continue;}
   if(n==='pIVP.DIVi::.ctor'){const a=take(4);s.push({kind:'member',name:a[0]});continue;}
   if(n==='fIV8.cIVn::.ctor'){const a=take(5);s.push({kind:'property',object:a[3],member:a[4]});continue;}
   if(n==='dIVv.dIVy::.ctor'){const a=take(5);s.push({kind:'arithmetic',operator:a[0],left:a[3],right:a[4]});continue;}
   if(n==='gIVX.QIVa::.ctor'){const a=take(6);s.push({kind:'call',object:a[3],member:a[4],args:a[5]});continue;}
   if(n==='rIVB.cIVG::.ctor'){const a=take(2);s.push({kind:'constant',value:a[1]});continue;}
   if(n==='TypeSpecification:1B00004B::.ctor'){s.push([]);continue;}
   if(n==='TypeSpecification:1B000FC7::.ctor'){s.push({});continue;}
   if(n==='TypeSpecification:1B00004B::Add'){const val=pop(),arr=pop();arr.push(val);continue;}
   if(n==='TypeSpecification:1B000FC7::Add'){const val=pop(),key=pop(),obj=pop();obj[key]=val;continue;}
   if(n==='TypeSpecification:1B00004B::GetEnumerator'){s.push({array:pop(),index:-1});continue;}
   if(n==='TypeSpecification:1B0004FA::get_Current'){const e=deref(pop());s.push(e.array[e.index]);continue;}
   if(n==='TypeSpecification:1B0004FA::MoveNext'){const e=deref(pop());s.push(++e.index<e.array.length);continue;}
   if(n==='System.IDisposable::Dispose'){pop();continue;}
   throw Error('Unhandled '+n+' at '+token+':'+i.Offset);
  }
  throw Error('Unhandled op '+o+' at '+token+':'+i.Offset);
 }
 throw Error('No return '+token);
}
const raw=value=>({kind:'raw',value}),dir=(direction,value)=>({kind:'direction',direction,value}),leaf=(direction,operation,value)=>({kind:'binary',operation,left:dir(direction,40),right:raw(value)}),and=(left,right)=>({kind:'binary',operation:1,left,right});
const results=[],examples=[];const check=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});}};
function evaluate(node,scope,geometry){if(node===null)return null;if(node.kind==='constant'||node.kind==='raw'||node.kind==='direction')return node.value;if(node.kind==='variable'){if(node.name==='Target')return geometry;return evaluate(scope.find(x=>x.name===node.name).expr,scope,geometry);}if(node.kind==='property')return evaluate(node.object,scope,geometry)[node.member.name];if(node.kind==='arithmetic'){const a=evaluate(node.left,scope,geometry),b=evaluate(node.right,scope,geometry);return node.operator==='-'?a-b:a+b;}if(node.kind==='call'){assert.equal(node.object.name,'Math');return Math[node.member.name](...node.args.map(a=>evaluate(a,scope,geometry)));}throw Error('Unknown AST node');}
for(const op of [5,6,7,8])for(const [a,b]of [[40,10],[40,90],[40,40],[40,40.25]])check('comparison op'+op+' '+a+','+b,()=>{const ast=replay(100704660,[op,raw(a),raw(b)]),expected=op===5?Math.max(a,b+1):op===6?Math.min(a,b-1):op===7?Math.max(a,b):Math.min(a,b);assert.equal(evaluate(ast,[],{}),expected);examples.push({kind:'comparison',op,a,b,ast,result:expected});});
for(const direction of ['left','right','top','bottom'])for(const op of [5,6,7,8])check('direction '+direction+' op'+op,()=>{const self={boundary:leaf(direction,op,100),UNAF:[{name:'stale',expr:raw(99)}]},ast=replay(100704659,[self]),size={width:12,height:8},shift=direction==='right'?12:direction==='bottom'?8:0,expected=op===5?Math.max(40-shift,101-shift):op===6?Math.min(40-shift,99-shift):op===7?Math.max(40-shift,100-shift):Math.min(40-shift,100-shift);assert.equal(evaluate(ast[direction==='left'||direction==='right'?'xSto':'ySto'],self.UNAF,size),expected);assert.ok(!self.UNAF.some(x=>x.name==='stale'));examples.push({kind:'direction',direction,op,ast,scope:self.UNAF,result:expected});});
check('ordered AND clamp combines lower and upper bounds with one original direction seed',()=>{const b=and(leaf('left',7,20),leaf('right',8,50)),self={boundary:b,UNAF:[]},ast=replay(100704659,[self]);assert.equal(evaluate(ast.xSto,self.UNAF,{width:12,height:8}),38);assert.equal(ast.ySto,null);assert.deepEqual(self.UNAF.map(x=>x.name),['valueVar0','direcVal0','valueVar1']);examples.push({kind:'AND',ast,scope:self.UNAF,result:38});});
check('OR flatten retains source-order leaves in STO projection; original boolean expression is a separate writer',()=>{const a=leaf('left',7,20),b=leaf('right',8,50);assert.deepEqual(replay(100706255,[{kind:'binary',operation:2,left:a,right:b}]),[a,b]);});
check('null boundary clears scratch scope and returns null',()=>{const self={boundary:null,UNAF:[{name:'stale',expr:raw(1)}]};assert.equal(replay(100704659,[self]),null);assert.deepEqual(self.UNAF,[]);});
check('empty unsupported comparison op has no synthesized clamp',()=>assert.equal(replay(100704660,[3,raw(1),raw(2)]),null));
const actual=readJson('research/runtime-transform-bindings-case-census.json').boundaries,realExamples=[];
const intervals={
 '4226f9cb45574a16a38a50433bdc7b32':[10,198], '1d2102635a504d47b43b54a363fc32ab':[10,198],
 'bf846a0bd17340ed8c2bd393ae791e1b':[10,148], '3d41af2a3a514d1d973362627f59923d':[10,148],
 'c2a12f3a7d2d4e2b8ce090ce1b4cb868':[30,148], '94d32a1108634fae9bc2f59dfad5b5f7':[30,148],
 '42b2880636f94e66a2931ca1a186265a':[40,198], 'f8f956d3797d4cba86c6ba377299807c':[40,198],
 '3fac2a311beb4943837fb5aaa505d2e2':[0,208], '3136c95feee5414ebfcf26b003ade398':[0,208],
};
function nativeNode(n,context){if(n.type==='Axure:Expr:BinaryExpr')return {kind:'binary',operation:n.operation,left:nativeNode(n.left,context),right:nativeNode(n.right,context)};const value=String(evaluateBoundAst(parseBoundExpression(n.text,n.bindings.map(b=>b.name)),context));return n.direction?dir(n.direction,value):raw(value);}
function booleanTree(n){if(n.operation===1)return booleanTree(n.left)&&booleanTree(n.right);if(n.operation===2)return booleanTree(n.left)||booleanTree(n.right);const a=Number(n.left.value),b=Number(n.right.value);return n.operation===5?a>b:n.operation===6?a<b:n.operation===7?a>=b:a<=b;}
for(const b of actual)for(const candidate of [-100,0,.5,65,300])check('actual boundary '+b.infoId+' candidate '+candidate,()=>{
 const interval=intervals[b.infoId],isHorizontal=Boolean(interval);assert.ok(isHorizontal||['8e887b58ddc243eebb242d0221ceeed8','987245fe6cbb4ebba4e13cf7e83ec813'].includes(b.infoId));
 const context={...controlledContext,target:isHorizontal?geometryFixture(candidate-5,70,12,8):geometryFixture(60,candidate,12,8)};
 const node=nativeNode(b.ast,context),self={boundary:node,UNAF:[]},projection=replay(100704659,[self]),conditionPassed=booleanTree(node),axis=isHorizontal?'xSto':'ySto';
 const selectedCoordinate=conditionPassed?candidate:evaluate(projection[axis],self.UNAF,context.target);
 const expectedCondition=isHorizontal?candidate>=interval[0]&&candidate<=interval[1]:candidate>0;
 const expected=isHorizontal?Math.min(Math.max(candidate,interval[0]),interval[1]):candidate>0?candidate:1;
 assert.equal(conditionPassed,expectedCondition);assert.equal(Number(selectedCoordinate),expected);assert.equal(projection[isHorizontal?'ySto':'xSto'],null);
 realExamples.push({packageId:b.packageId,actionId:b.actionId,infoId:b.infoId,candidate,axis,conditionPassed,selectedCoordinate:Number(selectedCoordinate),scopeKeys:self.UNAF.map(x=>x.name),projection});
});
const report={method:'Bounded original-CIL control flow replay, never original DLL execution. Native STO constructors are AST-building sinks preserving operator/member/argument data; collections/empty checks and expression values are controlled. The 12 real ASTs use explicitly controlled geometry, independent numeric intervals, and the shipped action.js false-condition gate; no JS generator/browser execution or actual rendered geometry claim.',originalAxureGuiCompared:false,originalDllExecuted:false,sources:[...files,'research/runtime-transform-bindings-boundary-probe.mjs','research/runtime-transform-bindings-expression-probe.mjs','research/runtime-transform-bindings-case-census.json','research/runtime-transform-format-boundary-cil.json','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs'].map(file=>({file,sha256:sha256(file)})),checks:{total:results.length,passed:results.filter(x=>x.passed).length,syntheticCases:36,realBoundaryContexts:60,realBoundaryObjects:12},results,examples,realExamples};
fs.writeFileSync('research/runtime-transform-bindings-boundary-probes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.checks));if(results.some(x=>!x.passed)){console.log(results.filter(x=>!x.passed));process.exitCode=1;}
