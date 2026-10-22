// Research only: interpret retained CIL; never load the Axure assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const moduleFrom=code=>import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const original=fs.readFileSync('research/selection-svg-bounds-probe-corrected-3.mjs','utf8');
const boundsSetup=original.slice(original.indexOf("import fs from"),original.indexOf('let domCode='));
const pad=await moduleFrom(boundsSetup+'\nexport {pad};').then(m=>m.pad);
const cssSetup=fs.readFileSync('research/selection-layout-indicator-css-probe.mjs','utf8').split("process.on('uncaughtException'")[0];
let cssCode=(await moduleFrom(cssSetup+'\nexport const engineCode=code;')).engineCode;
cssCode=cssCode
 .replace("const methods=new Map(sources", "sources.push('research/selection-svg-body-view-css-rect-writer-cil.json');\nconst methods=new Map(sources")
 .replace("if(op==='beq')", "if(op==='ceq'){const b=pop(),a=pop();s.push(a===b);continue}\nif(op==='bne.un'){const b=pop(),a=pop();if(a!==b)jump();continue}\nif(op==='beq')")
 .replace("['add','sub','div','xor','shl','shr']", "['add','sub','div','xor','shl','shr','and']")
 .replace("op==='shl'?a<<b:a>>b", "op==='shl'?a<<b:op==='and'?a&b:a>>b")
 .replace("TypeSpecification:1B0000B0::.ctor','.mSiO::.ctor", "TypeSpecification:1B0000B0::.ctor','.mSiO::.ctor")
 .replace("const value=pop();assert.equal(value,'','Only empty suffix is in scope');s.push(false)", "const value=pop();s.push(typeof value==='string'&&value.length>0)")
 .replace("const count=i.Offset===92?3:2", "const count=n===167772398?3:i.Offset===92?3:2")
 .replace("const callee=i.Resolved;output.calls.push", String.raw`const callee=i.Resolved;
   if(callee==='sJeD.wJe6::YJeA'){const state=pop();assert.ok(state===0||state===1);s.push(state===0?'':'mouseOver');continue}
   if(callee==='DtXM.mtXe::Normal'){s.push(pop()===0);continue}
   if(callee==='CbiJ.Bbib::Hbak<generic>'){const fallback=pop(),key=pop(),dict=pop();s.push(dict[key]??fallback);continue}
   if(callee==='uNL7.JNLP::LNKe'){replay('LNKe',s.splice(s.length-3,3),output);continue}
   if(callee==='System.String::Contains'){const part=pop();s.push(pop().includes(part));continue}
   if(['uNL7.JNLP::GNLf','uNL7.JNLP::INLw','uNL7.JNLP::tNLT'].includes(callee)){const prior=pop(),value=pop();pop();assert.equal(prior,null);assert.equal(value,null);continue}
   output.calls.push`);
const css=await moduleFrom(cssCode);
const results=[];
for(const b of [14,18])for(const strokeWidth of [0,1,3])for(const alignRight of [false,true]){
 const input={view:'a_phone',b,strokeWidth,alignRight,indicatorRect:{x:alignRight?200-b:100,y:72,width:b,height:b}};
 const projected=pad.projection(input);
 const output=css.replay('VNL2',[{TNKT:{}},'u_img',projected.cssRect,0,1,input.view,0,null,null,null,null]);
 const p=strokeWidth>1?strokeWidth/2:0,extra=strokeWidth>1?strokeWidth+1:1;
 const expected={left:((alignRight?100-b:0)-p)+'px',top:(2-p)+'px',width:(b+extra)+'px',height:(b+extra)+'px'};
 assert.equal(output.rules.length,1);assert.equal(output.rules[0].selector,'#u_img.a_phone');
 for(const [key,value]of Object.entries(expected))assert.equal(output.rules[0].style[key],value);
 results.push({name:`named-b${b}-stroke${strokeWidth}-${alignRight?'right':'left'}`,input,projected,css:output.rules,trace:output.trace,passed:true});
}
const sources=[...new Set([...pad.boundsSources,...css.sourceFiles,'research/selection-svg-bounds-probe-corrected-3.mjs','research/selection-layout-border-probe.mjs','research/layer-resize-controller-probe.mjs','research/text-autofit-style-css-replay.mjs','research/selection-layout-indicator-css-probe.mjs',import.meta.filename])];
const report={method:'Retained aNP5/jNPH/UJ0a crop and VNL2/LNKe/TNKD/hNKx CSS instructions; explicit current provider geometry and CSS sinks. No DLL execution or GUI.',fullAxureParity:false,originalGuiCompared:false,published:false,summary:{total:results.length,passed:results.length,failed:0},boundaries:['Current-view provider and mNU6 measured graphic rectangle are explicit inputs. Outer per-view Update chain is separately verified statically, not executed by this numeric probe.','Normal state only, finite unrotated BoxModel0 and no shadow/gradient/master.','CSS cache starts empty; selector/state-name facade is limited to normal plus unused mouseOver lookup.','No file/image asset writer is executed; original aNP5 rNP4 is an explicit asset sink.'],sources:sources.map(path=>({path,sha256:sha(path)})),results};
fs.writeFileSync('research/selection-svg-body-view-css-probes.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report.summary));
