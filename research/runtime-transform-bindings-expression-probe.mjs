/** Research-only bounded arithmetic prototype. Not native parser execution or product code. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const geometry=new Set(['x','y','width','height','left','right','top','bottom']);
export function parseBoundExpression(text,bindingNames=[]){
 assert.equal(typeof text,'string');assert.ok(text.length<=4096);
 const names=new Map();for(const name of bindingNames){assert.match(name,/^[A-Za-z][A-Za-z0-9_]*$/);const n=name.toLowerCase();assert.ok(!names.has(n),'case-fold collision');assert.ok(!['this','target','window','dragx','dragy','constructor','prototype'].includes(n),'reserved alias');names.set(n,name);}
 let source=text.trim();if(source==='true'||source==='false')return {kind:'literal',value:source==='true'};
 if(!source.startsWith('[[')){assert.match(source,/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/);return {kind:'literal',value:Number(source)};}
 assert.ok(source.endsWith(']]'),'whole expression required');source=source.slice(2,-2).trim();
 const tokens=[],re=/\s*(?:(\d+(?:\.\d*)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|([()+\-*/.,]))/y;let at=0;
 while(at<source.length){re.lastIndex=at;const m=re.exec(source);assert.ok(m,'unsupported token at '+at);tokens.push(m[1]?{kind:'number',value:Number(m[1])}:m[2]?{kind:'name',value:m[2]}:{kind:'symbol',value:m[3]});at=re.lastIndex;assert.ok(tokens.length<=256);}
 let index=0;const take=v=>{assert.equal(tokens[index++]?.value,v);},has=v=>tokens[index]?.value===v;
 function atom(depth){assert.ok(depth<=32);let n,t=tokens[index++];assert.ok(t);
  if(t.kind==='number')n={kind:'literal',value:t.value};
  else if(t.value==='+'||t.value==='-')n={kind:'unary',operator:t.value,operand:atom(depth+1)};
  else if(t.value==='('){n=expr(0,depth+1);take(')');}
  else {assert.equal(t.kind,'name');const name=t.value.toLowerCase();assert.ok(['this','target','window','dragx','dragy'].includes(name)||names.has(name),'unbound root '+name);n={kind:names.has(name)?'binding':'builtin',name};}
  while(has('.')){take('.');const prop=tokens[index++];assert.equal(prop?.kind,'name');if(prop.value==='toFixed'){take('(');const digits=tokens[index++];assert.equal(digits?.kind,'number');assert.ok(Number.isInteger(digits.value)&&digits.value>=0&&digits.value<=100);take(')');n={kind:'toFixed',input:n,digits:digits.value};}
   else {assert.ok(['builtin','binding'].includes(n.kind),'property owner must be typed geometry');assert.ok(geometry.has(prop.value),'unsupported property');if(n.name==='window')assert.ok(['width','height'].includes(prop.value));assert.ok(!['dragx','dragy'].includes(n.name));n={kind:'property',object:n,property:prop.value};}}
  return n;
 }
 const precedence={'+':1,'-':1,'*':2,'/':2};function expr(min,depth){let n=atom(depth);while(precedence[tokens[index]?.value]>=min){const op=tokens[index++].value;n={kind:'binary',operator:op,left:n,right:expr(precedence[op]+1,depth+1)};}return n;}
 const ast=expr(0,0);assert.equal(index,tokens.length,'trailing tokens');return ast;
}
export function evaluateBoundAst(ast,context){
 const n=ast,ev=x=>evaluateBoundAst(x,context);let value;
 if(n.kind==='literal')return n.value;
 if(n.kind==='builtin'||n.kind==='binding'){assert.ok(Object.hasOwn(context,n.name),'missing context '+n.name);return context[n.name];}
 if(n.kind==='property')value=ev(n.object)[n.property];
 else if(n.kind==='unary')value=n.operator==='-'?-ev(n.operand):+ev(n.operand);
 else if(n.kind==='binary'){const a=Number(ev(n.left)),b=Number(ev(n.right));value=n.operator==='+'?a+b:n.operator==='-'?a-b:n.operator==='*'?a*b:a/b;}
 else if(n.kind==='toFixed'){const x=ev(n.input);assert.equal(typeof x,'number');assert.ok(Number.isFinite(x));return Number.prototype.toFixed.call(x,n.digits);}
 else throw Error('unknown AST');assert.equal(typeof value,'number');assert.ok(Number.isFinite(value),'finite research fixture required');return value;
}
export const geometryFixture=(x,y,width,height)=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
export const controlledContext={this:geometryFixture(40,30,20,10),target:geometryFixture(60,70,12,8),track:geometryFixture(10,20,200,6),maxthumb:geometryFixture(160,20,20,10),minthumb:geometryFixture(20,20,20,10),minrange:geometryFixture(30,20,100,6),contentpanel:geometryFixture(100,200,300,400),header1:geometryFixture(20,40,100,30),header2:geometryFixture(25,60,110,35),window:{width:800,height:600},dragx:5,dragy:-3};
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const census=readJson('research/runtime-transform-bindings-case-census.json'),results=[],rows=[];
 const check=(name,fn)=>{try{fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.stack});}};
 // Independent, explicit scalar expectations for every observed expression text; no native AST used as oracle.
 const expected=new Map([
 ['0',0],['-6',-6],['6',6],['8',8],['true',true],['-65',-65],['65',65],
 ['[[Target.left + DragX]]',65],['[[Track.left]]',10],['[[Target.right + DragX]]',77],['[[Track.right]]',210],
 ['[[ ((this.left - track.left) / (track.width - this.width) * 100).toFixed(0) ]]','17'],
 ['[[ ((this.left - track.left) / (track.width - this.width) * 1000).toFixed(0) ]]','167'],
 ['[[(this.x - track.x)+2]]',32],['[[Target.height]]',8],['[[track.left]]',10],['[[Target.y]]',70],['[[track.right - Target.width]]',198],['[[maxThumb.left]]',160],['[[(maxThumb.x-this.x)]]',120],['[[minRange.x]]',30],['[[maxThumb.x]]',160],['[[minThumb.right]]',40],['[[(this.x - minThumb.x)]]',20],['[[This.left]]',40],['[[This.bottom - 1]]',39],['[[contentPanel.left]]',100],['[[contentPanel.bottom - 1]]',599],['[[header2.left]]',25],['[[header2.bottom - 1]]',94],['[[header1.left]]',20],['[[header1.bottom - 1]]',69],['[[Track.left - 10]]',0],['[[Track.right + 10]]',220],['[[This.x + This.width/2 - Target.width/2]]',44],['[[This.y - (This.y - Target.y)]]',70],['[[Target.width]]',12],['[[Window.height-Target.y]]',530]
 ]);
 const baselineGrammar='.build/before-runtime-transform/src/runtime/expressions.ts';
 assert.equal(sha256(baselineGrammar),'976ecdd306aedb50e29dde60dc274d84e75433cd7379ffd7a8f55b0d0edf10cc');
 const {evaluateExpression}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(fs.readFileSync(baselineGrammar,'utf8'))).toString('base64'));
 for(const e of census.literals)check('native literal '+e.packageId+':'+e.sourceId,()=>{
  assert.ok(expected.has(e.text),'missing independent oracle '+e.text);const ast=parseBoundExpression(e.text,e.bindings.map(b=>b.name)),value=evaluateBoundAst(ast,controlledContext);assert.equal(value,expected.get(e.text));
  let currentGrammar;try{const source=e.text.startsWith('[[')?e.text.slice(2,-2):e.text;currentGrammar={accepted:true,value:evaluateExpression(source,name=>{const [root,prop]=name.toLowerCase().split('.');const v=prop?controlledContext[root]?.[prop]:controlledContext[root];return typeof v==='number'?String(v):undefined;})};}catch(error){currentGrammar={accepted:false,error:error.message};}
  rows.push({packageId:e.packageId,sourceId:e.sourceId,text:e.text,bindings:e.bindings.map(b=>({name:b.name,targetId:b.value.args[0].path.objectId})),ast,controlledInternalValue:value,nativeStringLiteralResult:String(value),frozenBaselineGrammar:currentGrammar});
 });
 for(const [text,names]of [['[[track.x]]',[]],['[[this.constructor]]',[]],['[[Window.location]]',[]],['[[track.x]]',['track','Track']],['[[Target.width.toFixed(0).constructor]]',[]],['[[eval(1)]]',[]],['[[Target.width[0]]]',[]],['[[Target.width]]',['Target']]])check('reject unsafe/ambiguous '+text+' '+names.join(','),()=>assert.throws(()=>parseBoundExpression(text,names)));
 check('A source expression reads its local snapshot consistently; another evaluation can use a fresh snapshot',()=>{const ast=parseBoundExpression('[[track.x + track.width]]',['track']);assert.equal(evaluateBoundAst(ast,{track:geometryFixture(10,0,20,1)}),30);assert.equal(evaluateBoundAst(ast,{track:geometryFixture(15,0,30,1)}),45);});
 const out={method:'Independent bounded typed-arithmetic proposal over real source text/scopes; all geometry values are explicit controlled sinks, not actual native layout. Internal primitives are not the native StringLiteral return type: the separate nativeStringLiteralResult records replace-to-string behavior for these scalar fixtures. Frozen previous-release product grammar is measured separately and is not changed. Number.toFixed finite-number sink follows shipped sto.js fCall semantics. Not an execution of D1dV or the original DLL.',originalDllExecuted:false,originalAxureGuiCompared:false,sources:['research/runtime-transform-bindings-expression-probe.mjs','research/runtime-transform-bindings-case-census.json',baselineGrammar].map(file=>({file,sha256:sha256(file)})),controlledContext,counts:{realExpressionObjects:rows.length,uniqueTexts:new Set(rows.map(x=>x.text)).size,baselineGrammarAccepted:rows.filter(x=>x.frozenBaselineGrammar.accepted).length,baselineGrammarRejected:rows.filter(x=>!x.frozenBaselineGrammar.accepted).length},checks:{total:results.length,passed:results.filter(x=>x.passed).length},results,rows};
 fs.writeFileSync('research/runtime-transform-bindings-expression-probes.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({checks:out.checks,counts:out.counts}));if(results.some(r=>!r.passed)){console.log(results.filter(r=>!r.passed));process.exitCode=1;}
}
