// Research only: SHA-pinned vendor function slices, explicit synthetic ASTs and DOM sinks.
// This does not execute the Axure app, compiler, full module, or original prototype.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'repeater.js': 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'doc.js': '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'variables.js': '91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
};
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const sources = {};
const files = Object.entries(pins).map(([file, hash]) => {
  const sourcePath = path.join(base, file), bytes = fs.readFileSync(sourcePath);
  assert.equal(sha(bytes), hash, file); sources[file] = bytes.toString('utf8').split(/\r?\n/);
  return { file, sourcePath, sha256: hash, bytes: bytes.length };
});
const slice = (file, first, last) => sources[file].slice(first - 1, last).join('\n');
const spans = [
  ['expr.js', 100, 115, 'boolean-and-path-targets'], ['expr.js', 127, 184, 'fcall-per-target-evaluation'],
  ['expr.js', 204, 244, 'per-match-failure-boundary'], ['expr.js', 285, 300, 'variable-and-form-setters'],
  ['expr.js', 316, 330, 'rich-text-scalar-conversion'], ['expr.js', 753, 764, 'evaluateExpr-no-global-catch'],
  ['sto.js', 90, 161, 'literal-variable-column-metadata-access'], ['sto.js', 216, 234, 'casts'],
  ['variables.js', 33, 85, 'source-item-fallback'], ['doc.js', 221, 244, 'actual-target-list'],
  ['doc.js', 328, 347, 'item-info'], ['repeater.js', 605, 625, 'display-properties'],
  ['repeater.js', 1291, 1316, 'data-read-and-schema-check'], ['repeater.js', 1332, 1362, 'delete-map-and-add-row'],
  ['repeater.js', 1483, 1490, 'create-instance-id'], ['repeater.js', 1503, 1519, 'parse-instance-id'],
  ['action.js', 370, 378, 'set-function-expression'], ['action.js', 1793, 1808, 'add-row-action-entry'],
];
const excerpts = spans.map(([file, startLine, endLine, purpose]) => ({ file, startLine, endLine, purpose, text: slice(file, startLine, endLine) }));
const setup = `
var _exprHandlers={},_exprFunctions={},_globalVariableProvider={},_globalVariableValues={good:'OK'},funcs={};
var _repeaterManager={},repeaterInfoCache={},repeaterToCurrentDataSet={},repeaterToLocalDataSet={},repeaterToActiveDataSet={},repeaterToPageInfo={};
var sinks=[],values={},placeholders=[],_getParentElement=id=>id;
var _getWidgetInfo=id=>({elementId:id,datacount:(repeaterToCurrentDataSet[id]||[]).length});
var $jobj=id=>({length:1,val:function(value){if(arguments.length)values[id]=value;return values[id];}});
var $ax={expr:{},repeater:_repeaterManager,globalVariableProvider:_globalVariableProvider,document:{globalVariables:{}},
 getWidgetInfo:_getWidgetInfo,getParentRepeaterFromScriptId:id=>({r:'r',rw:'r',t:'t',tw:'t',s:'s',sw:'s'})[id],
 getItemIdsForRepeater:id=>(repeaterToActiveDataSet[id]||[]).map(row=>row.index),
 placeholderManager:{isActive:()=>false,updatePlaceholder:(id,blank)=>placeholders.push({id,blank})},
 event:{HasTextChanged:()=>false},getObjectFromElementId:id=>({id})};
_repeaterManager.isEditItem=()=>false;
_repeaterManager.applySuffixToElementId=(id,suffix)=>id+suffix;
_globalVariableProvider.setVariableValue=(key,value)=>{_globalVariableValues[key.toLowerCase()]=value;sinks.push({kind:'variable',key,value});};
function reset(){
 sinks=[];values={};placeholders=[];
 for(var [id,rows,props] of [['r',[],['Name']],['t',[{Name:'Alpha'},{Name:'Beta'}],['Name','Empty']],['s',[{Name:'Source',OnlySource:'SourceOnly'}],['Name','OnlySource','Empty']]]){
   var data=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,{type:'text',text:value}])));
   data.props=props;repeaterToCurrentDataSet[id]=data;repeaterToLocalDataSet[id]=data;
   repeaterToActiveDataSet[id]=data.map((row,index)=>({index:index+1}));repeaterToPageInfo[id]={noLimit:true};
 }
}
reset();
`;
const executionSpans = [
  ['repeater.js',605,625],['repeater.js',1291,1316],['repeater.js',1332,1362],['repeater.js',1483,1490],['repeater.js',1503,1519],
  ['doc.js',221,244],['doc.js',328,347],['variables.js',33,85],['sto.js',90,161],['sto.js',216,234],
  ['expr.js',100,115],['expr.js',127,184],['expr.js',204,244],['expr.js',285,300],['expr.js',753,764],
];
const helpers = `
$ax.getElementIdsFromPath=(path,event)=>$ax.getElementIdsFromEventAndScriptId(event,path[0]);
// The original rich-text DOM mutation is deliberately replaced by a sink. Argument evaluation remains original.
_exprFunctions.SetWidgetRichText=(ids,value,plain,event)=>sinks.push({kind:'richText',ids,value,restoredTarget:event.targetElement??null});
function leaf(variable,property){return {sto:'propCall',thisSTO:{sto:'var',name:variable},prop:property};}
function column(name,isTarget=false){return {sto:'item',name,isTarget};}
function str(value,stos,localVariables={}){return {exprType:'stringLiteral',value,stos,localVariables};}
function lit(value){return str(value,[]);}
function checkEvent(kind){return kind==='absent'?{srcElement:'outside'}:kind==='row'?{srcElement:'sw-1',item:$ax.getItemInfo('sw-1')}:{srcElement:'r',item:$ax.getItemInfo('r')};}
function fieldString(){return str('G=[[Good]]|V=[[Item.valid]]|I=[[Item.index]]|N=[[Item.Name]]|M=[[Item.Missing]]|TV=[[TargetItem.valid]]|TI=[[TargetItem.index]]|TN=[[TargetItem.Name]]|TM=[[TargetItem.Missing]]|Z=[[Good]]',[
 {sto:'var',name:'Good'},leaf('Item','valid'),leaf('Item','index'),column('Name'),column('Missing'),leaf('TargetItem','valid'),leaf('TargetItem','index'),column('Name',true),column('Missing',true),{sto:'var',name:'Good'}]);}
function setText(event,target,expression,form=false){return $ax.expr.evaluateExpr({exprType:'fcall',functionName:form?'SetWidgetFormText':'SetWidgetRichText',arguments:[{exprType:'pathLiteral',value:[target]},expression,...(form?[]:[{exprType:'booleanLiteral',value:true}])]},event);}
function setVariable(event,expression){return $ax.expr.evaluateExpr({exprType:'fcall',functionName:'SetGlobalVariableValue',arguments:[{exprType:'globalVariableLiteral',variableName:'Out'},expression]},event);}
function capture(fn){try{return {ok:true,value:fn()};}catch(error){return {ok:false,error:error.name};}}
`;
const context = vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup + executionSpans.map(s=>slice(...s)).join('\n') + helpers, context, {timeout:1000});
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})())`,context,{timeout:1000}));
const experiments=[];
function verify(name,code,expected){const actual=run(code);assert.deepEqual(actual,expected,name);experiments.push({name,pass:true,actual});}
const ordinary='G=OK|V=false|I=undefined|N=[[Item.Name]]|M=[[Item.Missing]]|TV=false|TI=undefined|TN=[[TargetItem.Name]]|TM=[[TargetItem.Missing]]|Z=OK';
const absent='G=OK|V=[[Item.valid]]|I=[[Item.index]]|N=[[Item.Name]]|M=[[Item.Missing]]|TV=[[TargetItem.valid]]|TI=[[TargetItem.index]]|TN=[[TargetItem.Name]]|TM=[[TargetItem.Missing]]|Z=OK';
const rowText=(index,name)=>`G=OK|V=true|I=${index}|N=${name}|M=|TV=true|TI=${index}|TN=${name}|TM=|Z=OK`;
for(const kind of ['invalid','absent']){
 verify(`${kind}-Item-setText-ordinary-target`, `reset();var event=checkEvent('${kind}');setText(event,'outside',fieldString());return {sinks,target:event.targetElement??null};`,{sinks:[{kind:'richText',ids:['outside'],value:ordinary,restoredTarget:null}],target:null});
 verify(`${kind}-Item-setText-other-repeater-rows`, `reset();var event=checkEvent('${kind}');setText(event,'tw',fieldString());return {sinks,target:event.targetElement??null};`,{sinks:[{kind:'richText',ids:['tw-2'],value:rowText(2,'Beta'),restoredTarget:null},{kind:'richText',ids:['tw-1'],value:rowText(1,'Alpha'),restoredTarget:null}],target:null});
 verify(`${kind}-Item-setVariable-no-target`, `reset();var event=checkEvent('${kind}');setVariable(event,fieldString());return sinks;`,[{kind:'variable',key:'Out',value:absent}]);
 verify(`${kind}-Item-addRow-container-target`, `reset();var event=checkEvent('${kind}');event.targetElement='tw-2';_repeaterManager.addItem('t',{Name:{type:'literal',literal:fieldString()}},event);return {row:repeaterToLocalDataSet.t.at(-1),target:event.targetElement,data:event.data};`,{row:{Name:{type:'text',text:ordinary}},target:'tw-2',data:false});
}
verify('actual-form-setter-gets-identical-string', `reset();setText(checkEvent('invalid'),'outside',fieldString(),true);return values;`,{outside_input:ordinary});
verify('setVariable-retains-inherited-target-it-does-not-clear-it',`reset();var event=checkEvent('invalid');event.targetElement='tw-2';setVariable(event,fieldString());return {sinks,target:event.targetElement};`,{sinks:[{kind:'variable',key:'Out',value:rowText(2,'Beta')}],target:'tw-2'});
verify('ordinary-setText-does-not-leak-target-to-next-setVariable',`reset();var event=checkEvent('invalid');setText(event,'outside',fieldString());setVariable(event,fieldString());return sinks;`,[{kind:'richText',ids:['outside'],value:ordinary,restoredTarget:null},{kind:'variable',key:'Out',value:absent}]);
verify('row-target-setText-restores-old-target-before-next-setVariable',`reset();var event=checkEvent('invalid');event.targetElement='outside';setText(event,'tw',fieldString());setVariable(event,fieldString());return {sinks,target:event.targetElement};`,{sinks:[{kind:'richText',ids:['tw-2'],value:rowText(2,'Beta'),restoredTarget:'outside'},{kind:'richText',ids:['tw-1'],value:rowText(1,'Alpha'),restoredTarget:'outside'},{kind:'variable',key:'Out',value:ordinary}],target:'outside'});
verify('one-match-failure-preserves-only-that-match',`var event=checkEvent('invalid');return $ax.expr.evaluateExpr(str('[[Good]]:[[Item.index]]:[[Good]]',[{sto:'var',name:'Good'},leaf('Item','index'),{sto:'var',name:'Good'}]),event);`,'OK:[[Item.index]]:OK');
verify('synthetic-error-STO-preserves-only-its-match',`return $ax.expr.evaluateExpr(str('[[Good]]:[[broken]]:[[Good]]',[{sto:'var',name:'Good'},{sto:'error'},{sto:'var',name:'Good'}]),checkEvent('invalid'));`,'OK:[[broken]]:OK');
verify('replacement-is-not-recursively-interpolated',`return $ax.expr.evaluateExpr(str('[[X]]/[[Good]]',[{sto:'literal',value:'[[Item.index]]'},{sto:'var',name:'Good'}]),checkEvent('invalid'));`,'[[Item.index]]/OK');
verify('missing-leaf-is-undefined-missing-parent-throws',`var event=checkEvent('invalid');event.targetElement='outside';return $ax.expr.evaluateExpr(str('I=[[Item.index]]/R=[[Item.Repeater.dataCount]]',[leaf('Item','index'),{sto:'propCall',thisSTO:leaf('Item','repeater'),prop:'datacount'}]),event);`,'I=undefined/R=[[Item.Repeater.dataCount]]');
verify('valid-row-missing-cell-empty-and-column-fallback',`reset();var event=checkEvent('row');event.targetElement='tw-1';return $ax.expr.evaluateExpr(str('[[Item.Name]]/[[Item.Empty]]/[[Item.Missing]]/[[TargetItem.Name]]/[[TargetItem.Missing]]',[column('Name'),column('Empty'),column('Missing'),column('Name',true),column('Missing',true)]),event);`,'Source///Alpha/');
verify('existing-source-column-wins-even-if-source-row-no-longer-exists',`reset();var event=checkEvent('row');repeaterToCurrentDataSet.s.length=0;event.targetElement='tw-1';return $ax.expr.evaluateExpr(str('[[Good]]/[[Item.Name]]/[[Item.Missing]]/[[TargetItem.Name]]',[{sto:'var',name:'Good'},column('Name'),column('Missing'),column('Name',true)]),event);`,'OK/[[Item.Name]]//Alpha');
verify('valid-source-addRow-columns-source-not-target',`reset();var event=checkEvent('row');_repeaterManager.addItem('t',{Name:{type:'literal',literal:str('[[Item.Name]]/[[TargetItem.Name]]',[column('Name'),column('Name',true)])}},event);return repeaterToLocalDataSet.t.at(-1);`,{Name:{type:'text',text:'Source/[[TargetItem.Name]]'}});
verify('data-context-missing-cell-is-empty-text-object-not-scalar',`reset();var event=checkEvent('row');_repeaterManager.addItem('t',{Missing:{type:'literal',literal:str('[[Item.Empty]]',[column('Empty')])}},event);return repeaterToLocalDataSet.t.at(-1);`,{Missing:{text:''}});
verify('synthetic-missing-STO-is-outside-per-match-catch',`return capture(()=>$ax.expr.evaluateExpr(str('[[Good]]/[[missing]]',[{sto:'var',name:'Good'}]),checkEvent('invalid')));`,{ok:false,error:'TypeError'});
verify('synthetic-local-expression-error-is-outside-per-match-catch',`return capture(()=>$ax.expr.evaluateExpr(str('[[Good]]',[{sto:'var',name:'Good'}],{L:{exprType:'UNSUPPORTED_SYNTHETIC'}}),checkEvent('invalid')));`,{ok:false,error:'TypeError'});
verify('synthetic-cast-sensitivity-is-not-compiler-output-evidence',`var event=checkEvent('invalid');event.targetElement='outside';return [undefined,'string','bool','int'].map(type=>{var sto=leaf('Item','index');if(type)sto.computedType=type;return $ax.expr.evaluateExpr(str('[[Item.index]]',[sto]),event);});`,['undefined','undefined','false','NaN']);
verify('typed-cast-does-not-rescue-absent-parent-property-access',`return ['string','bool','int'].map(type=>$ax.expr.evaluateExpr(str('[[Item.index]]',[{...leaf('Item','index'),computedType:type}]),checkEvent('invalid')));`,['[[Item.index]]','[[Item.index]]','[[Item.index]]']);
verify('empty-target-repeater-enumerates-no-row-instances',`reset();return $ax.getElementIdsFromEventAndScriptId(checkEvent('invalid'),'rw');`,[]);
const evidence={version:1,target:'Axure RP 11.0.0.4150',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',files,excerpts,executionSpans,engine:{node:process.version},method:'Only exact SHA-pinned original function slices run in isolated VM; scalar AST shapes are explicitly synthesized without compiler type metadata except named cast sensitivity experiment. Not generated original compiler output.',mocks:['Rich text setter is a recording sink; original fcall and actual form/variable setters are run.','Target/script parent map, row IDs, datasets and visibility are fixture bridges; getItemInfo/setDisplayProps/getData/hasData/target enumeration are original.','getWidgetInfo returns only a deterministic element ID and data count; no full DOM or component/nested repeater resolution.','No original AST compiler, rich-text HTML escaping, native app, browser or complete dispatcher is executed.'],experiments};
const output=JSON.stringify(evidence,null,2)+'\n';
fs.writeFileSync(new URL('../repeater-empty-string-evidence.json',import.meta.url),output);
console.log(JSON.stringify({pass:true,experiments:experiments.length,files:files.length,excerpts:excerpts.length,sha256:sha(output)}));
