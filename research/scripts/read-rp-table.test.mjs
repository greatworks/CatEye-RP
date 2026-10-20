import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {recoverRpSemantics,property as p} from './read-rp-semantics.mjs';
const evidence=JSON.parse(fs.readFileSync(new URL('../table-format-census.json',import.meta.url),'utf8'));
const sample=evidence.samples.find(s=>s.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
assert.equal(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex'),sample.sha256);
const original=inspectRpObjects(sample.file),packageId='556a42319a0a476c8e81f2d6da0ada41',tableId='36a2bbf16b624eb9869e340c7b663c36';
const set=(o,k,v)=>{const pair=o.$map.find(pair=>pair[0]===k);if(pair)pair[1]=v;else o.$map.push([k,v]);};
const ref=id=>({$reference:id,referenceTag:3});
function fixture(){const data=structuredClone(original);data.packages=data.packages.filter(p=>p.path==='DesignDocument'||p.packageId===packageId);const pack=data.packages.find(p=>p.packageId===packageId),objects=new Map(pack.objects.map(o=>[o.id,o])),root=objects.get(pack.rootId),table=objects.get(tableId),cells=p(table.properties,'cells').map(r=>objects.get(r.$reference));return {data,pack,objects,root,table,cells,style:objects.get(p(cells[0].properties,'MyStyle').$reference),diagram:objects.get(p(root.properties,'diagram').$reference)};}
const read=f=>recoverRpSemantics(f.data).diagrams.find(d=>d.packageId===packageId).widgets[0];
test('actual table preserves row-major matrix, native column-major object order and inherited first position',()=>{
 const f=fixture(),before=JSON.stringify(f.data),r=read(f);assert.equal(r.tableRecovery.status,'supported-table');assert.equal(r.typeCandidate.type,'table');
 const t=r.tableRecovery;assert.deepEqual(t.columnWidths,[100,100,100]);assert.deepEqual(t.rowHeights,[30,30,30]);assert.equal(t.cells.length,9);
 assert.notDeepEqual(t.source.cellIds,t.source.diagramObjectIds);assert.deepEqual(t.source.diagramObjectIds.map(id=>t.source.cellIds.indexOf(id)),[0,3,6,1,4,7,2,5,8]);
 assert.equal(t.cells[0].storedGeometry.location,null);assert.deepEqual(t.cells[0].styleRecovery.resolvedGeometry.location.value,{X:0,Y:0});assert.equal(t.cells[0].styleRecovery.resolvedGeometry.location.source.kind,'cached-document-default');
 assert.deepEqual(t.cells.map(c=>c.text.text),['Column 1','Column 2','Column 3','','','','','','']);assert.equal(t.cells.filter(c=>c.richTextRecovery.status==='supported-rich-text').length,3);
 assert.deepEqual(t.cells[0].borderRecovery.widths,[1,1,1,1]);assert.equal(t.cells[0].borderRecovery.color,'#797979');assert.equal(JSON.stringify(f.data),before);
});
test('both classic menus retain MenuObject identity and are never flattened tables',()=>{const s=recoverRpSemantics(original);for(const d of s.diagrams.filter(d=>d.name?.startsWith('Classic menu'))){assert.equal(d.widgets[0].type,'Axure:DiagramObject:MenuObject');assert.equal(d.widgets[0].typeCandidate?.type,'menu');assert.equal(d.widgets[0].tableRecovery,undefined);assert.equal(d.widgets[0].menuRecovery.status,'supported-menu');}});
for(const kind of ['rows zero','columns fractional','axis limit','cell budget','negative track','sum mismatch','count mismatch','duplicate cells','wrong reference tag','different ownership set','unknown root field','unknown cell field','autofit cell','different cell border colors','missing cache','wrong cell size','old omitted text','cell transform','cell rotation','duplicate owner','menu owner','unsupported rich text'])test(`strict native table rejects ${kind}`,()=>{
 const f=fixture(),tp=f.table.properties,cp=f.cells[0].properties,props=p(f.style.properties,'PropList');
 if(kind==='rows zero')set(tp,'rows',0);if(kind==='columns fractional')set(tp,'columns',2.5);if(kind==='axis limit')set(tp,'rows',1001);if(kind==='cell budget'){set(tp,'rows',1000);set(tp,'columns',1000);}
 if(kind==='negative track')p(tp,'column-widths')[0]=-1;if(kind==='sum mismatch')p(tp,'row-heights')[0]=31;if(kind==='count mismatch')p(tp,'cells').pop();if(kind==='duplicate cells')p(tp,'cells')[1]=p(tp,'cells')[0];if(kind==='wrong reference tag')p(tp,'cells')[0].referenceTag=19;
 if(kind==='different ownership set')p(tp,'diagram-objects')[0]=ref('f'.repeat(32));if(kind==='unknown root field')set(tp,'MergedCells',true);if(kind==='unknown cell field')set(cp,'LegacyText','lost');if(kind==='autofit cell')set(cp,'AutoFitWidth',true);if(kind==='different cell border colors')set(cp,'top-border-color',-1);
 if(kind==='missing cache')set(p(f.root.properties,'StyleCache'),'Styles',[]);
 if(kind==='wrong cell size'){const entry=props.find(e=>(p(e,'DOAName')&0xfffffff)===105);set(p(entry,'Value'),'Width',99);}
 if(kind==='old omitted text')f.pack.version=[10,0,0,0];
 if(kind==='cell rotation')props.push({$map:[['DOAName',-1073741774],['Value',30]]});
 if(kind==='cell transform')props.push({$map:[['DOAName',-1073740423],['Value',{$map:[['ScaleX',2],['ScaleY',1],['TranslateX',0],['TranslateY',0],['Rotate',0]]}]]});
 if(kind==='duplicate owner')p(f.diagram.properties,'diagram-objects').push(ref(f.cells[0].id));
 if(kind==='menu owner')f.pack.objects.push({id:'e'.repeat(32),type:'Axure:DiagramObject:MenuObject',properties:{$map:[['diagram-objects',[ref(tableId)]]]}});
 if(kind==='unsupported rich text'){const paras=p(p(p(cp,'RichTextBlock'),'attributed-string'),'Paragraphs');set(paras[0],'Bullet',true);}
 const r=read(f);assert.ok(r.typeCandidate===null||r.status==='unsupported-widget-fields',JSON.stringify(r.tableRecovery));
});
test('orphan direct TableCell is rejected rather than a free shape',()=>{const f=fixture();set(f.diagram.properties,'diagram-objects',[ref(f.cells[0].id)]);assert.equal(read(f).status,'unsupported-widget-fields');});
