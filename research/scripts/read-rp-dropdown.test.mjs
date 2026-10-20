import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {property as p,recoverSelectProperties,recoverRpSemantics} from './read-rp-semantics.mjs';
import {recoverInteractionMap} from './read-rp-interactions.mjs';

const manifest=JSON.parse(fs.readFileSync(new URL('../rp-form-candidates-evidence.json',import.meta.url),'utf8')).samples;
const form=inspectRpObjects(manifest.find(s=>s.file.endsWith('Sample form patterns.rplib')).file);
const defaults=inspectRpObjects(fileURLToPath(new URL('../samples/Default.rplib',import.meta.url)));
const required=inspectRpObjects(fileURLToPath(new URL('../samples/complex-interactions-required-fields.rp',import.meta.url)));
const countryId='d8fa7295bba34065956efd90f1c4b300',stateId='89ea7c71f7b54eed986cd4e8569b14e5';
const ref=(id,referenceTag=3)=>({$reference:id,referenceTag});
const set=(object,key,value)=>{const pair=object.properties.$map.find(([k])=>k===key);if(pair)pair[1]=value;else object.properties.$map.push([key,value]);};
function fixture(id=countryId,data=form){const source=data.packages.find(p=>p.objects?.some(o=>o.id===id)),pack=structuredClone(source),objects=new Map(pack.objects.map(o=>[o.id,o]));return {pack,objects,widget:objects.get(id)};}
const read=f=>recoverSelectProperties(f.widget,f.objects);
const option=f=>f.objects.get(p(f.widget.properties,'list-options')[0].$reference);
const rejected=f=>{const r=read(f);assert.equal(r.status,'unsupported-select-properties');assert.equal(r.options,undefined);};

test('pinned original corpus contains 27 dropdowns and one listbox with 2108 ordered options',()=>{
 assert.equal(form.fileSha256,'1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
 assert.equal(defaults.fileSha256,'9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
 const controls=[form,defaults].flatMap(d=>d.packages.flatMap(pack=>{const objects=new Map((pack.objects??[]).map(o=>[o.id,o]));return [...objects.values()].filter(o=>/:(ComboBox|ListBox)$/.test(o.type)).map(widget=>recoverSelectProperties(widget,objects));}));
 assert.equal(controls.length,28);assert.ok(controls.every(c=>c.status==='decoded-select-properties'));
 assert.equal(controls.filter(c=>c.selectMode==='dropdown').length,27);assert.equal(controls.filter(c=>c.selectMode==='listbox').length,1);
 assert.equal(controls.reduce((n,c)=>n+c.options.length,0),2108);assert.ok(controls.every(c=>c.multiple===false));
});
test('personal Country preserves first selected single-space label and all 197 values',()=>{
 const r=read(fixture());assert.equal(r.options.length,197);assert.deepEqual(r.storedSelectedIndices,[0]);
 assert.deepEqual(r.options[0],{sourceId:'e0d6df0c0db747b68c2511d757ea6f52',value:' ',selected:true});
 assert.equal(r.options[1].value,'Afghanistan');assert.equal(r.options.at(-1).value,'Zimbabwe');assert.equal(r.effectiveSelectedIndices,undefined);
});
test('personal State has 52 items but no stored selection; do not invent selected=true',()=>{
 const r=read(fixture(stateId));assert.equal(r.options.length,52);assert.deepEqual(r.storedSelectedIndices,[]);
 assert.equal(r.options[0].value,' ');assert.equal(r.options[1].value,'AK');assert.equal(r.options.at(-1).value,'WY');assert.ok(r.options.every(o=>o.selected===false));
});
test('semantic output adds select candidates only with complete native option recovery',()=>{
 const result=recoverRpSemantics(form),controls=result.diagrams.flatMap(d=>d.widgets).filter(w=>w.selectRecovery);
 assert.equal(controls.length,26);assert.ok(controls.every(w=>w.typeCandidate?.type==='select'&&w.typeCandidate.mapping==='native-select-options'));
 assert.equal(controls.find(w=>w.id===countryId).typeCandidate.selectMode,'dropdown');
});
test('empty Default dropdown and listbox retain exact empty arrays and mode identity',()=>{
 const results=recoverRpSemantics(defaults).diagrams.flatMap(d=>d.widgets).filter(w=>w.selectRecovery);
 assert.equal(results.length,2);assert.deepEqual(results.map(w=>w.selectRecovery.selectMode).sort(),['dropdown','listbox']);
 for(const w of results){assert.deepEqual(w.selectRecovery.options,[]);assert.deepEqual(w.selectRecovery.storedSelectedIndices,[]);}
});
test('duplicate literal labels, markup, expressions, linebreaks and whitespace remain inert unchanged strings',()=>{
 const f=fixture();p(f.widget.properties,'list-options').splice(4);const values=['  A\nB  ','  A\nB  ','</option><script>bad()</script>','[[Item.Name]]'];
 p(f.widget.properties,'list-options').forEach((r,i)=>set(f.objects.get(r.$reference),'object',values[i]));
 assert.deepEqual(read(f).options.map(o=>o.value),values);
});
test('listbox multi flag and every stored selected index survive; single listbox raw flags also remain raw',()=>{
 const f=fixture();f.widget.type='Axure:DiagramObject:ListBox';set(f.widget,'multiple',true);set(f.objects.get(p(f.widget.properties,'list-options')[1].$reference),'selected',true);
 assert.deepEqual(read(f).storedSelectedIndices,[0,1]);assert.equal(read(f).multiple,true);set(f.widget,'multiple',false);assert.deepEqual(read(f).storedSelectedIndices,[0,1]);
});
test('unsupported dropdown multi, unknown and duplicate native fields reject the whole control',()=>{
 for(const change of [f=>set(f.widget,'multiple',true),f=>set(f.widget,'NewSelectionMode',1),f=>f.widget.properties.$map.push(['multiple',false])]){const f=fixture();change(f);rejected(f);}
});
test('option flags are explicit boolean and values are strings; expression objects are never coerced',()=>{
 for(const [key,value] of [['selected','true'],['selected',undefined],['object',42],['object',{$map:[['expr','A']]}],['object',undefined]]){const f=fixture();set(option(f),key,value);rejected(f);}
});
test('unknown disabled option and duplicate option properties reject atomically',()=>{
 for(const change of [o=>set(o,'disabled',true),o=>o.properties.$map.push(['object','Other']),o=>o.properties.$map.push(['selected',false])]){const f=fixture();change(option(f));rejected(f);}
});
test('same option source repeated and cross-package or wrong-type references reject',()=>{
 for(const change of [f=>p(f.widget.properties,'list-options').push(p(f.widget.properties,'list-options')[0]),f=>f.objects.delete(option(f).id),f=>{option(f).type='Axure:Expr:StringLiteral';},f=>{option(f).id='f'.repeat(32);}]){const f=fixture();change(f);rejected(f);}
});
test('reference tags, malformed IDs and reference extras are not silently tolerated',()=>{
 for(const value of [ref('f'.repeat(32),19),ref('not-a-guid'),{...ref('e0d6df0c0db747b68c2511d757ea6f52'),name:'other'},null]){const f=fixture();p(f.widget.properties,'list-options')[0]=value;rejected(f);}
});
test('option count and text length boundaries align with document bounds',()=>{
 const f=fixture();set(option(f),'object','x'.repeat(2000));assert.equal(read(f).status,'decoded-select-properties');set(option(f),'object','x'.repeat(2001));rejected(f);
 const g=fixture();set(g.widget,'list-options',Array.from({length:501},()=>ref('f'.repeat(32))));rejected(g);
});
test('nondefault inherited input fields and nonzero submit cannot disappear during conversion',()=>{
 for(const [key,value] of [['Type',1],['WordWrap',false],['ReadOnly',true],['PlaceholderText','hint'],['HideHintOnFocus',true],['SubmitButton',ref('f'.repeat(32))],['TextBlock',{$map:[['text','initial']]}]]){const f=fixture();set(f.widget,key,value);rejected(f);}
});
test('reader requires local exact owner and leaves original decoded records unchanged',()=>{
 const f=fixture(),before=JSON.stringify(f.pack);read(f);assert.equal(JSON.stringify(f.pack),before);f.objects.delete(f.widget.id);rejected(f);
});

function conditionFixture(){
 const pack=structuredClone(required.packages.find(p=>p.objects?.some(o=>o.id==='cb0cc5841b274fdfb0698f9e05198f77'))),objects=new Map(pack.objects.map(o=>[o.id,o])),owner=objects.get('cb0cc5841b274fdfb0698f9e05198f77');
 const binary=objects.get('952cc9cfe4d24a85821876d2db090c8e');
 const leaf=objects.get(p(binary.properties,'left-expr').$reference),call=objects.get(p(leaf.properties,'left-expr').$reference),literal=objects.get(p(call.properties,'args')[0].$reference),path=objects.get(p(literal.properties,'value').$reference),target=objects.get(p(path.properties,'object-id').$reference);
 set(call,'function-name','GetSelectedOption');target.type='Axure:DiagramObject:ComboBox';
 return {objects,owner,packageId:pack.packageId,call,path,target};
}
test('witnessed GetSelectedOption carrier emits a distinct scalar selection condition',()=>{
 const f=conditionFixture(),e=recoverInteractionMap(f).events[0];assert.equal(e.status,'supported-event');assert.equal(e.cases[0].conditions[0].source,'selectedOption');assert.equal(e.cases[0].conditions[0].targetSourceId,f.target.id);assert.equal(e.cases[0].conditions[1].source,'widgetText');
 f.target.type='Axure:DiagramObject:ListBox';assert.equal(recoverInteractionMap(f).events[0].status,'supported-event');
});
test('GetSelectedOption refuses nonselect, compound and absent targets atomically',()=>{
 for(const change of [f=>{f.target.type='Axure:DiagramObject:TextBox';},f=>set(f.path,'rdo-path',[ref('f'.repeat(32))]),f=>set(f.path,'object-id',ref('f'.repeat(32),22)),f=>set(f.call,'args',[])]){const f=conditionFixture();change(f);const r=recoverInteractionMap(f).events[0];assert.equal(r.status,'unsupported-event');assert.equal(r.cases,undefined);}
});
test('SetFocus accepts dropdown/listbox with explicit select-text and a single local path',()=>{
 for(const type of ['ComboBox','ListBox']){const f=conditionFixture(),r=recoverInteractionMap(f),a=f.objects.get(r.events[0].cases[0].actions[0].sourceId);a.type='Axure:InteractionSetFocusOnWidgetAction';a.properties={$map:[['Disabled',false],['panelobjectpaths',[ref(f.path.id)]],['SelectTextOnFocus',true]]};f.target.type=`Axure:DiagramObject:${type}`;const action=recoverInteractionMap(f).events[0].cases[0].actions[0];assert.deepEqual(action,{sourceId:a.id,type:'setFocus',targetSourceId:f.target.id,selectText:true});}
});

function subjectFixture(){
 const pack=structuredClone(form.packages.find(p=>p.packageId==='e75bf1b9234d40d9bb3c2f8a4ece4689')),objects=new Map(pack.objects.map(o=>[o.id,o])),owner=objects.get('c6d7e16a852f411ba0fc0a11b769ba6f');
 const map=objects.get(p(owner.properties,'InteractionMap').$reference),table=p(map.properties,'node-table'),removed=new Set();
 // Isolate real stored conditions by dropping action nodes from this test copy.
 // The original complete event remains unsupported; no executable partial import.
 for(const [nodeRef,memberRef] of table.$map){const member=objects.get(memberRef.$reference);if(member.type==='Axure:InteractionCase'){
   const node=objects.get(nodeRef.$reference);for(const r of p(node.properties,'children'))removed.add(r.$reference);set(node,'children',[]);
 }}
 table.$map=table.$map.filter(([nodeRef])=>!removed.has(nodeRef.$reference));
 return {objects,owner,packageId:pack.packageId};
}
test('four actual Subject conditions resolve This and OptionLiteral copied text including trailing space',()=>{
 const f=subjectFixture(),r=recoverInteractionMap(f).events[0];assert.equal(r.status,'supported-event');assert.equal(r.nativeEventType,51);
 assert.deepEqual(r.cases.map(c=>c.conditions[0].value),['Suggestion','Compliment ',"Something's broken",'I have a question']);
 assert.ok(r.cases.every(c=>c.conditions[0].source==='selectedOption'&&c.conditions[0].targetSourceId===f.owner.id&&c.actions.length===0));
});
test('OptionLiteral rejects object-valued text, wrong-tag/unknown option fields and nonselect This',()=>{
 for(const change of [f=>set(f.objects.get('af2a380bcd7a42f0bc670fff4f10b58c'),'object',{$map:[]}),f=>set(f.objects.get('07c087cb369c45cbb911f9189934adfd'),'Option',ref('af2a380bcd7a42f0bc670fff4f10b58c',22)),f=>set(f.objects.get('af2a380bcd7a42f0bc670fff4f10b58c'),'disabled',true),f=>{f.owner.type='Axure:DiagramObject:TextBox';}]){const f=subjectFixture();change(f);assert.equal(recoverInteractionMap(f).events[0].status,'unsupported-event');}
});
test('real Subject complete event stays atomically unsupported until every native action can be represented',()=>{
 const f=fixture('c6d7e16a852f411ba0fc0a11b769ba6f'),r=recoverInteractionMap({objects:f.objects,owner:f.widget,packageId:f.pack.packageId}).events[0];assert.equal(r.status,'unsupported-event');assert.match(r.reason,/SetWidgetRichText/);assert.equal(r.cases,undefined);
});
