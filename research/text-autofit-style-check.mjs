// Research-only composed CIL replay. Never invokes or loads the original assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
import {replay} from './text-autofit-style-full-arguments.mjs';
import {replay as cssReplay} from './text-autofit-style-css-replay.mjs';
import {run as classReplay} from './text-autofit-style-class-replay.mjs';
const get=(file,token)=>readJson(file).Types.flatMap(t=>t.Methods).find(m=>m.Token===token);
const sources=[
 'research/text-autofit-dom-shape-dispatch-cil.json','research/text-autofit-native-text-callers-cil.json',
 'research/shadow-format-form-cil.json','research/font-size-runtime-layout-writer-cil.json',
 'research/font-size-runtime-rect-css-cil.json','research/font-size-runtime-rect-values-cil.json',
 'research/text-autofit-style-rect-guard-cil.json','research/text-autofit-style-modes-cil.json',
 'research/text-autofit-style-constructor-cil.json','research/text-autofit-style-context-cil.json',
 'research/text-autofit-style-generation-callers.json','research/text-autofit-style-repeater-cil.json',
 'research/text-autofit-style-literals.json','research/font-size-format-owners.json',
 'research/gradient-angle-zero-cil.json','research/text-autofit-style-full-arguments.mjs',
 'research/text-autofit-style-css-replay.mjs','research/text-autofit-style-class-replay.mjs',
 'research/text-autofit-style-rect-sentinel-cil.json'];
const checks=[];
function check(name,f){f();checks.push({name,passed:true})}
check('Ordinary VectorShape dispatch passes true into fNPD',()=>{
 const m=get(sources[0],100699653),ix=m.Instructions.findIndex(i=>i.Offset===1342);
 assert.equal(m.Instructions[ix].Resolved,'fNiZ.FNiU::fNPD');assert.equal(m.Instructions[ix-1].Op,'ldc.i4.1');
});
check('fNPD forwards its third argument as rNPL sixth argument',()=>{
 const m=get(sources[1],100699662),ix=m.Instructions.findIndex(i=>i.Offset===446);
 assert.equal(m.Instructions[ix].Resolved,'fNiZ.FNiU::rNPL');
 assert.deepEqual(m.Instructions.filter(i=>i.Offset>=418&&i.Offset<=446).map(i=>[i.Op,i.Operand]),[
 ['ldloc.s',3],['ldarg.1',null],['callvirt',100699349],['ldloc.s',0],['ldloc.s',1],['ldloc.s',2],['ldarg.2',null],['ldarg.1',null],['callvirt',100699378],['call',100717081],['ldloc.s',4],['call',100699663]
 ]);
});
check('rNPL true flag selects NaN rect; padding correction belongs to SelectionButton',()=>{
 const a=get(sources[2],100699663).Instructions,at=n=>a.find(i=>i.Offset===n);
 assert.equal(at(640).Op,'ldarg.s');assert.equal(at(640).Operand,5);assert.equal(at(642).Operand,393);
 assert.equal(at(393).Resolved,'h5uH.j5u5::D5sx');
 assert.equal(at(1601).Resolved,'Axure.DocumentModel.Objects.SelectionButton');assert.equal(at(1606).Operand,1021);
});
check('SNLp NaN guard bypasses TNKD; its independent item-mode guard is false by default',()=>{
 const a=get(sources[3],100699217).Instructions;
 assert.equal(a.find(i=>i.Offset===327).Resolved,'h5uH.j5u5::Y5s3');
 assert.equal(a.find(i=>i.Offset===332).Operand,379);assert.equal(a.find(i=>i.Offset===374).Resolved,'uNL7.JNLP::TNKD');
 const constructors=readJson(sources[8]).Types.flatMap(t=>t.Methods);
 assert.ok(constructors.every(m=>!m.Instructions.some(i=>i.Op==='stfld'&&[67125472,67125474].includes(i.Operand))));
});
check('D5sx is four NaNs, not zero or minus-one dimensions',()=>{
 const m=get('research/text-autofit-style-rect-sentinel-cil.json',100722161),ix=m.Instructions.findIndex(i=>i.Resolved==='h5uH.j5u5::D5sx');
 assert.equal(m.Instructions[ix].Op,'stsfld');assert.deepEqual(m.Instructions.slice(ix-5,ix-1).map(i=>[i.Op,i.Operand]),Array.from({length:4},()=>['ldc.r8','NaN']));
});
check('Generated default/named style rule has no omitted layout declaration',()=>{
 const records=readJson('research/text-autofit-style-literals.json').records;
 assert.equal(records.find(r=>r.method==='gbDQ').text,'ax_');
 assert.equal(records.find(r=>r.method==='eNxL').text,'textarea, select, input, button, div, svg { outline: none; }');
 assert.equal(records.find(r=>r.method==='ENKH').text,'text-decoration');
 const keys=records.filter(r=>['RNxS','CNxN'].includes(r.method)).map(r=>r.text);
 for(const unsupported of ['height','width','overflow','overflow-x','overflow-y','white-space','position','display'])assert.ok(!keys.includes(unsupported));
});
const cases=[];
for(const autoFitWidth of [true,false])for(const align of [0,1,2])for(const padding of [[0,0,0,0],[2,4,6,8]]){
 const result=replay(autoFitWidth,false,{ordinaryShape:true,align,padding});
 assert.ok(Object.values(result.output.rectangle).every(Number.isNaN));
 assert.equal(result.output.allArguments.length,13);
 assert.deepEqual(result.output.allArguments.slice(3),[0,1,null,autoFitWidth?{'white-space':'nowrap'}:{'word-wrap':'break-word'},null,0,0,0,0,0]);
 assert.deepEqual(result.output.css,[{selector:'#u1_text',style:{'border-width':'0px',...(autoFitWidth?{'white-space':'nowrap'}:{'word-wrap':'break-word'})}}]);
 assert.ok(!result.output.cssCalls.some(c=>c.callee==='uNL7.JNLP::TNKD'));
 assert.ok(result.calls.some(c=>c.callee.endsWith('::PNZ8'))); // Measurement happens but its rect is intentionally discarded for emitted CSS.
 assert.ok(!result.calls.some(c=>c.callee==='kJm2.KJm7::SJOQ'));
 const child=cssReplay('nNLd',[{},'u1',{type:'vector',padding,align:['near','center','far'][align]},false]);
 assert.deepEqual(child.rules,[{selector:'#u1 .text',style:{position:'absolute','align-self':['flex-start','center','flex-end'][align],'box-sizing':'border-box',padding:padding.map(x=>`${x}px`).join(' '),width:'100%'}}]);
 cases.push({name:'ordinary-shape-full-chain',autoFitWidth,align,padding,...result,childRule:child.rules});
}
for(const autoFitWidth of [true,false]){
 const result=replay(autoFitWidth,false,{ordinaryShape:false,padding:[2,4,6,8],align:1});
 assert.equal(result.output.rectangle.height,-1);assert.equal(result.output.rectangle.x,8);assert.equal(result.output.rectangle.y,-8);
 assert.ok(result.output.cssCalls.some(c=>c.callee==='uNL7.JNLP::TNKD'));
 assert.equal(result.output.css[0].style.left,'8px');assert.equal(result.output.css[0].style.top,'-8px');
 assert.equal(result.output.css[0].style.height,undefined);
 cases.push({name:'diagnostic-false-flag-not-ordinary-VectorShape',autoFitWidth,...result});
}
const owners=readJson('research/font-size-format-owners.json').owners;
for(const native of owners){
 assert.equal(native.rawObject.AutoFitWidth,true);assert.equal(native.rawObject.AutoFitHeight,true);
 const base=native.matchingBase[0];assert.equal(base.info.Name,'T Heading');
 assert.equal(native.myStyle.entries.find(p=>p.property===0).value.$guid,base.info.Id.$guid);
 const shape={id:'u1',contained:false,visible:true,unplaced:false,defaultStyle:{id:'default'},localStyle:{baseStyle:{id:base.info.Id.$guid}}};
 const context={classNames:{default:'ax_default',[base.info.Id.$guid]:'t_heading'},css:{idClasses:false}};
 const classes=classReplay('wNxE',[context,shape,false,false,false,[]]);
 assert.equal(classes.value,'ax_default t_heading');
 const result=replay(true,false,{ordinaryShape:true,width:native.review.width});
 cases.push({name:'real-UX-owner-source-and-normal-class-branch',packageId:native.packageId,sourceId:native.sourceId,text:native.review.text,stored:{width:native.review.width,height:native.review.height},classRuleIdentity:{default:'ax_default',baseName:base.info.Name,normalizedCandidate:'t_heading',collisionSuffixNotEnumerated:true},classTrace:classes.out,css:result.output.css,allArguments:result.output.allArguments});
}
const ordinaryResult=cases.find(c=>c.name==='ordinary-shape-full-chain');
const bypass=cssReplay('SNLp',[{TNKT:{},WNKf:true},...ordinaryResult.output.allArguments.slice(1)]);
assert.equal(bypass.rules,undefined);cases.push({name:'item-mode-true-is-separate-early-return',...bypass});
const report={method:'Composed retained-CIL control-flow replay; true flag is anchored in actual ordinary VectorShape dispatch. No original DLL/GUI, browser cascade or native font measurement executes.',corrections:['Earlier native replay hard-coded rNPL argument5=false. Its finite text rectangle was a counterfactual for this ordinary VectorShape caller, not the default generated shape CSS.','SelectionButton-only horizontal padding adjustment is not performed for VectorShape.'],sources:sources.map(file=>({file,sha256:sha256(file)})),checks,cases,boundaries:['Injected text measurement 132x39 is synthetic and discarded from ordinary output geometry.','WIyL diagnostic branch uses Shape0/no rotation; LNOE rounds position to even, no native graphics API executes.','Class identity branch uses the source-proven T Heading base and already-resolved class map. Full sheet collision suffix assignment is not enumerated; suffix cannot add CSS declarations.','Complete original generated HTML/page cascade and real native font metrics are unavailable.','Script does not model run-to-HTML newline encoding.']};
fs.writeFileSync('research/text-autofit-style-replay.json',JSON.stringify(report,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?{$number:String(v)}:v,2)+'\n');
console.log(`${checks.length} source checks and ${cases.length} composed CIL cases passed`);

