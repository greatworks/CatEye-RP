// Execute retained instruction records only; never load the target assembly.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fields} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['research/selection-creation-entry-cil.json','research/selection-creation-initialize-cil.json','research/selection-author-resize-storage-cil.json','research/selection-creation-update-context-cil.json','research/selection-creation-library-drop-cil.json','research/selection-layout-transaction-dependencies-cil.json'];
const methods=new Map(files.flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8')).Types.flatMap(t=>t.Methods.map(m=>[m.Token,{...m,file:f}]))));
const VOID=Symbol('void'),calls=new Map();let events,visited;
const bind=(token,count,run)=>calls.set(token,{count,run});
function run(token,args){
 const m=methods.get(token);assert(m,`missing ${token}`);const instructions=m.Instructions,offsets=new Map(instructions.map((i,n)=>[i.Offset,n]));
 const stack=[],locals=[];let pc=0,steps=0;const pop=()=>{assert(stack.length,`underflow ${token}`);return stack.pop();};
 const idx=(op,base,value)=>op===base||op===base+'.s'?value:Number(op.slice(base.length+1));
 const jump=off=>{assert(offsets.has(off));pc=offsets.get(off);};
 while(++steps<10000){const i=instructions[pc++];assert(i,`EOF ${token}`);const op=i.Op,v=i.Operand;visited.push({token,il:i.Offset});
  if(['nop','box','castclass','unbox.any'].includes(op)){}
  else if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
  else if(op==='ldc.r8')stack.push(v);
  else if(op.startsWith('ldarg'))stack.push(args[idx(op,'ldarg',v)]);
  else if(op.startsWith('ldloc'))stack.push(locals[idx(op,'ldloc',v)]??0);
  else if(op.startsWith('stloc'))locals[idx(op,'stloc',v)]=pop();
  else if(op==='ldnull')stack.push(null);
  else if(op==='dup')stack.push(stack.at(-1));
  else if(op==='pop')pop();
  else if(op==='ldsfld'){assert.equal(v,67142340);stack.push({module:true});}
  else if(op==='ldfld'){const obj=pop();if(obj.module){assert(fields.has(v));stack.push(fields.get(v).value);}else stack.push(obj[v]??0);}
  else if(op==='stfld'){const value=pop(),obj=pop();obj[v]=value;}
  else if(['add','sub','mul','xor','and','or','ceq'].includes(op)){const b=pop(),a=pop();stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='mul'?Math.imul(a,b):op==='xor'?a^b:op==='and'?a&b:op==='or'?a|b:a===b?1:0);}
  else if(op==='switch'){const n=pop();if(n>=0&&n<v.length)jump(v[n]);}
  else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')jump(v);
  else if(op==='endfinally'){}
  else if(op==='brtrue'||op==='brtrue.s'){if(pop())jump(v);}
  else if(op==='brfalse'||op==='brfalse.s'){if(!pop())jump(v);}
  else if(['beq','bne.un','bgt','blt','bge','ble'].includes(op)){const b=pop(),a=pop();if({beq:a===b,'bne.un':a!==b,bgt:a>b,blt:a<b,bge:a>=b,ble:a<=b}[op])jump(v);}
  else if(['call','callvirt','newobj'].includes(op)){const spec=calls.get(v);assert(spec,`missing facade ${token} IL${i.Offset}: ${v} ${i.Resolved}`);assert(stack.length>=spec.count);const result=spec.run(stack.splice(stack.length-spec.count,spec.count),{token,il:i.Offset});if(result!==VOID)stack.push(result);}
  else if(op==='ret'){assert(stack.length<=1);return stack.length?pop():VOID;}
  else throw Error(`unsupported ${token} ${op}`);
 }
 throw Error('step limit');
}
bind(100732128,1,([offset])=>decodeLiteral(offset)); // confirmed below by resolved-name dispatch
for(const m of methods.values())for(const i of m.Instructions)if(i.Resolved==='wIhA.zIhQ::sIho')bind(i.Operand,1,([offset])=>decodeLiteral(offset));
bind(167772183,2,([a,b])=>a===b?1:0);
bind(167775256,2,([s,index])=>s.charCodeAt(index));
bind(167772537,1,([s])=>s.length);
bind(100685194,1,([self],site)=>{const widget={kind:self.type,67126826:0};events.push({...site,name:'construct',type:self.type});return widget;});
bind(100685180,1,([self])=>'Axure:DiagramObject:'+self.type);
bind(100695349,5,([widget,point,allViews,notify,arg],site)=>{events.push({...site,name:'xJ0B',point,allViews,notify,arg});widget.point=point;return VOID;});
bind(100695371,3,([widget,rect,allViews],site)=>{events.push({...site,name:'YJ0S',rect,allViews});widget.rect=rect;return VOID;});
bind(100702343,2,args=>run(100702343,args));
bind(100702326,2,([widget,force],site)=>{events.push({...site,name:'OI8Z',force});return VOID;});
bind(100695510,1,([widget])=>({widget}));
bind(100717839,2,args=>run(100717839,args));
bind(167777123,3,([style,key,value],site)=>{events.push({...site,name:'style-property',key,value});return VOID;});
bind(100685198,4,([self,widget,a,b],site)=>{events.push({...site,name:'kj1L',argA:a,argB:b});return VOID;});
bind(100695401,1,([widget],site)=>{events.push({...site,name:'zIsb'});return {bounds:true};});
bind(100732116,0,()=>VOID); // Anti-tamper initialization excluded, never executed.
bind(167772266,1,()=>VOID); // System.Object constructor facade.
bind(100715417,2,args=>run(100715417,args));
bind(100715420,8,args=>{const obj={};run(100715420,[obj,...args]);return obj;});
bind(100695521,2,args=>run(100695521,args));
bind(100715424,1,args=>run(100715424,args));
bind(100695262,1,()=>[]);
bind(167783393,1,([items])=>({items,index:-1}));
bind(167772305,1,([it])=>++it.index<it.items.length?1:0);
bind(167783394,1,([it])=>it.items[it.index]);
bind(167772304,1,()=>VOID);
bind(100695522,2,([widget,ctx],site)=>{events.push({...site,name:'base-Update'});return VOID;});
bind(100702327,1,([widget])=>widget);
bind(100701874,1,([widget],site)=>{events.push({...site,name:'CNOH'});return VOID;});
const results=[];
try{
 for(const type of ['Checkbox','RadioButton'])for(const [token,kind,arg]of [[100685199,'point',{x:211,y:307}],[100685203,'rect',{x:211,y:307,width:180,height:24}]]){
  events=[];visited=[];const output=run(token,[{type},{canvas:true},arg]);
  assert.equal(output.kind,type);assert.equal(events.find(e=>e.name==='style-property')?.key,94);assert.equal(events.find(e=>e.name==='style-property')?.value,13);
  assert.equal(events.filter(e=>e.name==='OI8Z').length,kind==='point'?1:0);
  assert.equal(output[67126826],kind==='point'?1:0);
  results.push({type,kind,token,input:arg,output,events,visited});
 }
 for(const priorDirtyValue of ['same-view','different-view']){
  events=[];visited=[];const context=run(100715422,[{view:'destination'}]);
  assert.equal(context[67132122],0,'Force update context disables same-view short circuit');
  assert.equal(run(100695521,[{67123786:priorDirtyValue},context]),0);
  run(100702380,[{67123786:priorDirtyValue},context]);
  assert.equal(context[67132115],1,'Paste context Eti2 is true');
  assert.equal(run(100715424,[context]),0,'Paste context suppresses the text layout branch');
  assert.equal(events.filter(e=>e.name==='OI8Z').length,0);
  results.push({kind:'paste-update-context',priorDirtyValue,context,events,visited});
 }
 const report={createdAt:new Date().toISOString(),originalDllExecuted:false,originalGuiCompared:false,scope:'Source-record branching for direct built-in SelectionButton point/rectangle creation and paste-end TextRectObject.Update. This does not execute the complete Default library clone/import/style notification lifecycle.',facades:['Widget constructors create plain carriers; ktiR constructor is interpreted','Location/rectangle assignments record sink events','OI8Z records request only; no text measurement','Style dictionary writes record key/value only','kj1L style/default application is a visible sink','zIsb bounds is a sink','TextRectObject inline-link list is empty, as in these library templates; base Update is an explicit sink','String/constant and branch instructions execute from retained CIL'],sources:[...files,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs','research/text-autofit-native-literals.bin',import.meta.filename].map(file=>({file,sha256:hash(file)})),checks:results.length,results};
 fs.writeFileSync('research/selection-creation-entry-probes.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({passed:results.length,events:results.map(r=>({type:r.type,kind:r.kind,events:r.events}))},null,2));
}catch(error){let n=1;while(fs.existsSync(`research/selection-creation-entry-failure-${n}.json`))n++;fs.writeFileSync(`research/selection-creation-entry-failure-${n}.json`,JSON.stringify({message:error.stack,events,visited,probeSha256:hash(import.meta.filename)},null,2)+'\n',{flag:'wx'});throw error;}
