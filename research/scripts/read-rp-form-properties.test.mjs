import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {recoverRpSemantics,recoverFormProperties,property as p} from './read-rp-semantics.mjs';
import {recoverInteractionMap} from './read-rp-interactions.mjs';
const source=inspectRpObjects(fileURLToPath(new URL('../samples/complex-interactions-required-fields.rp',import.meta.url)));
const set=(o,k,v)=>{const e=o.properties.$map.find(([key])=>key===k);if(e)e[1]=v;else o.properties.$map.push([k,v]);};
const ref=(id,tag=3)=>({$reference:id,referenceTag:tag});
function fixture(){const data=structuredClone(source),pack=data.packages.find(x=>x.packageId==='1455edf5f56a48e99b2c94ee5d1ea987'),objects=new Map(pack.objects.map(o=>[o.id,o])),owner=objects.get('28de2d860170465c8b28bbe3e69a5e42');return{data,pack,objects,owner,packageId:pack.packageId};}
function focusFixture(){const f=fixture(),r=recoverInteractionMap(f),a=f.objects.get(r.events[0].cases[0].actions[0].sourceId),path=f.objects.get(p(a.properties,'WidgetPaths')[0].$reference);set(path,'object-id',ref(f.owner.id,22));a.type='Axure:InteractionSetFocusOnWidgetAction';a.properties={$map:[['Disabled',false],['panelobjectpaths',[ref(path.id)]],['SelectTextOnFocus',false]]};return{...f,action:a,path};}
test('pinned Required text/password have explicit false readonly, unlimited MaxInt and zero submit',()=>{
 assert.equal(source.fileSha256,'0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c');const f=fixture();
 for(const w of f.pack.objects.filter(o=>o.type==='Axure:DiagramObject:TextBox'))assert.deepEqual(recoverFormProperties(w),{status:'recovered-form-properties',sourceType:'TextBox',readOnly:false,maxLength:2147483647,submitButton:null});
});
test('four actual readonly form records become input candidates with explicit true flags',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../rp-form-candidates-evidence.json',import.meta.url),'utf8')).samples;
 const sample=manifest.find(s=>s.file.endsWith('Sample form patterns.rplib')),d=inspectRpObjects(sample.file);assert.equal(d.fileSha256,'1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
 const all=recoverRpSemantics(d).diagrams.flatMap(d=>d.widgets);assert.equal(all.filter(w=>w.formPropertiesRecovery?.readOnly===true&&w.typeCandidate?.type==='input').length,4);
});
test('explicit readonly and finite maximum preserve zero and upper boundary without mutating decoded graph',()=>{
 for(const n of [0,1,20,2147483646,2147483647]){const f=fixture();set(f.owner,'ReadOnly',true);set(f.owner,'MaxLength',n);const before=JSON.stringify(f.owner);assert.equal(recoverFormProperties(f.owner).maxLength,n);assert.equal(recoverFormProperties(f.owner).readOnly,true);assert.equal(JSON.stringify(f.owner),before);}
});
test('negative fractional excessive and missing MaxLength are rejected; no guessed sentinel',()=>{
 for(const v of [-1,1.5,2147483648,NaN,Infinity,'10',null,undefined]){const f=fixture();set(f.owner,'MaxLength',v);assert.equal(recoverFormProperties(f.owner).status,'unsupported-form-properties');}
});
test('malformed readonly and duplicate fields cannot become editable defaults',()=>{
 for(const v of [null,undefined,0,'false']){const f=fixture();set(f.owner,'ReadOnly',v);assert.equal(recoverFormProperties(f.owner).status,'unsupported-form-properties');}
 const f=fixture();f.owner.properties.$map.push(['ReadOnly',false]);assert.equal(recoverFormProperties(f.owner).status,'unsupported-form-properties');
});
test('nonzero wrong-tag compound and missing SubmitButton are explicit failures',()=>{
 for(const v of [null,undefined,ref('f'.repeat(32)),ref('0'.repeat(32),19),{...ref('0'.repeat(32)),other:true}]){const f=fixture();set(f.owner,'SubmitButton',v);assert.equal(recoverFormProperties(f.owner).status,'unsupported-form-properties');}
});
test('textarea readonly is recoverable but an unwitnessed MaxLength field is not',()=>{
 const f=fixture();f.owner.type='Axure:DiagramObject:TextArea';set(f.owner,'ReadOnly',true);f.owner.properties.$map=f.owner.properties.$map.filter(([k])=>k!=='MaxLength');assert.deepEqual(recoverFormProperties(f.owner),{status:'recovered-form-properties',sourceType:'TextArea',readOnly:true,maxLength:null,submitButton:null});set(f.owner,'MaxLength',3);assert.equal(recoverFormProperties(f.owner).status,'unsupported-form-properties');
});
test('focus action retains strict local target and explicit select-text boolean',()=>{
 const f=focusFixture();set(f.action,'SelectTextOnFocus',true);const a=recoverInteractionMap(f).events[0].cases[0].actions;assert.deepEqual(a,[{sourceId:f.action.id,type:'setFocus',targetSourceId:f.owner.id,selectText:true}]);
});
test('focus This maps only to current local text-input owner and rejects ordinary shapes',()=>{
 const f=focusFixture();set(f.path,'object-id',ref('0'.repeat(32),22));assert.equal(recoverInteractionMap(f).events[0].cases[0].actions[0].targetSourceId,f.owner.id);f.owner.type='Axure:DiagramObject:VectorShape';assert.equal(recoverInteractionMap(f).events[0].status,'unsupported-event');
});
test('focus invalid options and multiple targets reject the complete event',()=>{
 for(const mutation of ['disabled','select-string','select-missing','unknown','multiple','empty']){const f=focusFixture();if(mutation==='disabled')set(f.action,'Disabled',true);if(mutation==='select-string')set(f.action,'SelectTextOnFocus','true');if(mutation==='select-missing')f.action.properties.$map.pop();if(mutation==='unknown')set(f.action,'delay',20);if(mutation==='multiple')set(f.action,'panelobjectpaths',[ref(f.path.id),ref(f.path.id)]);if(mutation==='empty')set(f.action,'panelobjectpaths',[]);const r=recoverInteractionMap(f).events[0];assert.equal(r.status,'unsupported-event',mutation);assert.equal(r.cases,undefined);}
});
test('focus rejects unresolved, compound, wrong-tag and dummy paths atomically',()=>{
 for(const [k,v] of [['object-id',ref('f'.repeat(32),22)],['object-id',ref(fixture().owner.id,3)],['rdo-path',[ref('f'.repeat(32))]],['repeater-path',[ref('f'.repeat(32))]],['is-dummy',true]]){const f=focusFixture();set(f.path,k,v);assert.equal(recoverInteractionMap(f).events[0].status,'unsupported-event',k);}
});
test('unsupported sibling after focus never yields a partially executable event',()=>{
 const f=focusFixture(),map=f.objects.get(p(f.owner.properties,'InteractionMap').$reference),table=p(map.properties,'node-table').$map,nodeEntry=table.find(([,r])=>r.$reference===f.action.id),node=f.objects.get(nodeEntry[0].$reference),parent=f.objects.get(p(node.properties,'parent-node').$reference);
 const extraAction={id:'e'.repeat(32),type:'Axure:UnknownAction',properties:{$map:[['Disabled',false]]}},extraNode={id:'f'.repeat(32),type:'Axure:Node',properties:{$map:[['parent-node',ref(parent.id)],['tree',p(node.properties,'tree')],['children',[]]]}};
 f.objects.set(extraAction.id,extraAction);f.objects.set(extraNode.id,extraNode);table.push([ref(extraNode.id),ref(extraAction.id)]);p(parent.properties,'children').push(ref(extraNode.id));const r=recoverInteractionMap(f).events[0];assert.equal(r.status,'unsupported-event');assert.equal(r.cases,undefined);
});
