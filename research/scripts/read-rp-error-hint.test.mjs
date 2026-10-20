import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { inspectRpSemantics, recoverRpSemantics, property as p } from './read-rp-semantics.mjs';

const sample = name => fileURLToPath(new URL(`../samples/${name}`,import.meta.url));
const replace = (map,key,value) => { const row=map.$map.find(([k])=>k===key);if(row)row[1]=value;else map.$map.push([key,value]); };
const source=inspectRpObjects(sample('Prototype Starter.rp'));
function fixture() {
  const data=structuredClone(source), pack=data.packages.find(p=>p.packageId==='68ae2bed587e49b48376490f15b1b086');
  const widget=pack.objects.find(o=>o.id==='cd0ff15f5ea94e349f87cb9f56fc69c0'), style=pack.objects.find(o=>o.id===p(widget.properties,'MyStyle').$reference);
  const ix=p(style.properties,'PropList').find(e=>(p(e,'DOAName')&0xfffffff)===21), hint=pack.objects.find(o=>o.id===p(p(ix,'Value'),'Hint').$reference);
  return {data,pack,widget,style,ix,hint};
}
const recovered = f => recoverRpSemantics(f.data).diagrams.find(d=>d.packageId===f.pack.packageId).widgets.find(w=>w.id===f.widget.id);
const basics=inspectRpObjects(sample('Prototyping Basics.rp'));
function namedFixture(){
  const data=structuredClone(basics);for(const pack of data.packages){const hint=pack.objects?.find(o=>o.id==='266994d70d6847858a7ce2638f4fd028');if(!hint)continue;
    const style=pack.objects.find(o=>(p(o.properties,'PropList')??[]).some(e=>(p(e,'DOAName')&0xfffffff)===21&&p(p(e,'Value'),'Hint')?.$reference===hint.id));
    const widget=pack.objects.find(o=>p(o.properties,'MyStyle')?.$reference===style.id),root=pack.objects.find(o=>o.id===pack.rootId);
    return{data,pack,hint,widget,style,root};
  }throw new Error('Pinned named hint fixture missing');
}

test('official Starter retains hint text independently from empty value and its explicit hint color',()=>{
  const f=fixture(), before=JSON.stringify(f.data), r=recovered(f);
  assert.deepEqual(r.errorHintRecovery.inputHint,{hintText:'Search...',hintHideOn:'typing',sourceFields:['PlaceholderText','HideHintOnFocus']});
  assert.equal(r.text.text,'');assert.equal(r.errorHintRecovery.error,false);
  assert.deepEqual(r.errorHintRecovery.styles.states.hint.style,{color:'#bdbdbd'});
  assert.equal(JSON.stringify(f.data),before);
});
test('true hide-on-focus maps literally while missing/invalid/expression hints remain explicit failures',()=>{
  const f=fixture();replace(f.widget.properties,'HideHintOnFocus',true);assert.equal(recovered(f).errorHintRecovery.inputHint.hintHideOn,'focus');
  for(const [key,value] of [['HideHintOnFocus',null],['PlaceholderText',false],['PlaceholderText','x'.repeat(100001)],['PlaceholderText','[[This.text]]'],['Error','false']]){
    const bad=fixture();replace(bad.widget.properties,key,value);assert.equal(recovered(bad).errorHintRecovery.status,'unsupported-error-hint');
  }
});
test('initial error boolean and unmerged normal appearance are retained without inventing startup events',()=>{
  const f=fixture();replace(f.widget.properties,'Error',true);replace(p(f.ix,'Value'),'Error',{$reference:f.hint.id,referenceTag:3});
  const r=recovered(f);assert.equal(r.storedFlags.Error,true);assert.equal(r.errorHintRecovery.error,true);
  assert.notEqual(r.errorHintRecovery.normalStyleRecovery.style.color,'#bdbdbd');
  assert.deepEqual(r.errorHintRecovery.styles.states.error.style,{color:'#bdbdbd'});
});
test('unique exact cached Form Hint recovers #999999 with original named-style provenance',()=>{
  const f=namedFixture(), r=recovered(f).errorHintRecovery.styles.states.hint;
  assert.equal(r.status,'supported-state-style');assert.deepEqual(r.style,{color:'#999999'});
  assert.deepEqual(r.sourceProperties,[6]);assert.deepEqual(r.namedStyleMatch,{styleId:'4889d666e8ad4c5e81e59863039a5cc0',libraryId:'53f4a189168b474893d409a1b736ad03',localProperties:[0]});
  assert.deepEqual(r.provenance.color.namedStyleMatch,r.namedStyleMatch);
});
test('wrong named-cache library and duplicate matches fail that state without a default-color guess',()=>{
  for(const mutation of ['wrong-library','duplicate','no-match','wrong-base']){
    const f=namedFixture(), caches=p(p(f.root.properties,'StyleCache'),'Styles');
    const match=caches.find(c=>p(p(c,'Info'),'Id')?.$guid==='4889d666e8ad4c5e81e59863039a5cc0');
    if(mutation==='wrong-library')replace(p(match,'Info'),'LibraryId',{$guid:'a'.repeat(32)});
    if(mutation==='duplicate')caches.push(structuredClone(match));
    if(mutation==='no-match')caches.splice(caches.indexOf(match),1);
    if(mutation==='wrong-base')replace(p(f.hint.properties,'PropList')[0],'Value',{$guid:'f'.repeat(32)});
    assert.equal(recovered(f).errorHintRecovery.styles.states.hint.status,'unsupported-state-style',mutation);
  }
});
test('named cache accepts local color resets but rejects unknown properties and unsafe fill carriers atomically',()=>{
  const f=namedFixture();p(f.hint.properties,'PropList').push({$map:[['DOAName',6|0xc0000000],['Value',{$map:[['fill-type','solid'],['fill-color',-1]]}]]});
  assert.deepEqual(recovered(f).errorHintRecovery.styles.states.hint.style,{color:'#ffffff'});
  for(const entry of [{$map:[['DOAName',72|0xc0000000],['Value',0]]},{$map:[['DOAName',6|0xc0000000],['Value',{$map:[['fill-type','image'],['fill-color',-1]]}]]}]){
    const bad=namedFixture();p(bad.hint.properties,'PropList').push(entry);assert.equal(recovered(bad).errorHintRecovery.styles.states.hint.status,'unsupported-state-style');
  }
});
test('explicit TextArea hints no longer invalidate an otherwise supported textarea type',()=>{
  const f=fixture();f.widget.type='Axure:DiagramObject:TextArea';replace(f.widget.properties,'Type',0);replace(f.widget.properties,'WordWrap',true);replace(f.widget.properties,'SubmitButton',{$reference:'0'.repeat(32),referenceTag:3});
  const r=recovered(f);assert.equal(r.typeCandidate.type,'textarea');assert.equal(r.errorHintRecovery.inputHint.hintText,'Search...');
});

const tab=inspectRpObjects(sample('the-basics-tab-menu.rp'));
function errorActionFixture(){
  const data=structuredClone(tab),pack=data.packages.find(p=>p.packageId==='216580735aa64e1db9043586ecd32d66');
  for(const o of pack.objects){if(o.type==='Axure:InterationActionSetFunction')replace(o.properties,'SetFunction','SetErrorState');if(o.type==='Axure:Expr:FCall'&&p(o.properties,'function-name')==='SetCheckState')replace(o.properties,'function-name','SetErrorState');}
  const widget=pack.objects.find(o=>o.id==='2f76607a24f242f6ba9db84b579676c9');return{data,pack,widget};
}
test('SetErrorState preserves original action ordering and resolves This through the known path sentinel',()=>{
  const f=errorActionFixture(),r=recovered(f).interactionRecovery;
  const event=r.events[0];assert.equal(event.status,'supported-event');assert.deepEqual(event.cases[0].actions.map(a=>a.type),['setState','setError']);
  assert.equal(event.cases[0].actions[1].targetSourceId,f.widget.id);assert.equal(event.cases[0].actions[1].value,'true');
});
test('native error events 55 and 56 remain distinct and use strict event metadata',()=>{
  for(const [code,name] of [[55,'errorSet'],[56,'errorRemoved']]){const f=errorActionFixture();for(const o of f.pack.objects.filter(o=>o.type==='Axure:InteractionEvent'))replace(o.properties,'event-type',code);assert.equal(recovered(f).interactionRecovery.events[0].event,name);}
});
test('SetErrorState rejects unknown values, mixed call names, compound targets and disabled actions atomically',()=>{
  for(const mutation of ['value','call','path','disabled']){
    const f=errorActionFixture();const call=f.pack.objects.find(o=>o.type==='Axure:Expr:FCall'&&p(o.properties,'function-name')==='SetErrorState');
    if(mutation==='value'){const literal=f.pack.objects.find(o=>o.id===p(call.properties,'args')[1].$reference);replace(literal.properties,'value','[[Other]]');}
    if(mutation==='call')replace(call.properties,'function-name','SetCheckState');
    if(mutation==='path'){const literal=f.pack.objects.find(o=>o.id===p(call.properties,'args')[0].$reference),path=f.pack.objects.find(o=>o.id===p(literal.properties,'value').$reference);replace(path.properties,'rdo-path',[{$reference:'f'.repeat(32),referenceTag:3}]);}
    if(mutation==='disabled')for(const o of f.pack.objects.filter(o=>o.type==='Axure:InterationActionSetFunction'))replace(o.properties,'Disabled',true);
    const r=recovered(f).interactionRecovery;assert.ok(r.events.some(e=>e.status==='unsupported-event'),mutation);assert.ok(r.events.filter(e=>e.status==='unsupported-event').every(e=>e.cases===undefined));
  }
});
test('SetErrorState may name a local DynamicPanel, leaving complete descendant proof to the importer',()=>{
  const f=errorActionFixture(),panel=f.pack.objects.find(o=>o.type==='Axure:DiagramObject:DynamicPanel');
  for(const o of f.pack.objects.filter(o=>o.type==='Axure:DiagramObjectPath'))if(p(o.properties,'object-id')?.$reference==='0'.repeat(32))replace(o.properties,'object-id',{$reference:panel.id,referenceTag:22});
  assert.equal(recovered(f).interactionRecovery.events[0].cases[0].actions[1].targetSourceId,panel.id);
});
test('all pinned real Starter hint records are reachable and independent from its existing press-style recovery',()=>{
  const s=inspectRpSemantics(sample('Prototype Starter.rp')),widgets=s.diagrams.flatMap(d=>d.widgets);
  assert.equal(widgets.filter(w=>w.errorHintRecovery?.inputHint?.hintText).length,2);
  assert.equal(widgets.filter(w=>w.errorHintRecovery?.styles?.states?.hint?.status==='supported-state-style').length,2);
  assert.equal(widgets.filter(w=>w.interactionStyleRecovery?.states?.mousedown?.status==='supported-state-style').length,3);
});
