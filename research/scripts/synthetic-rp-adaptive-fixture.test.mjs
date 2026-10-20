import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {makeSyntheticAdaptiveRp,writeSyntheticAdaptiveRp,IDS,SOURCE_SHA256} from '../../scripts/synthetic-rp-adaptive-fixture.mjs';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {NATIVE_BASE_VIEW_ID} from './read-rp-adaptive.mjs';

const folder=fs.mkdtempSync(path.join(tmpdir(),'rea-SYNTHETIC-adaptive-'));
const fixture=writeSyntheticAdaptiveRp(folder),sem=fixture.semantics;
const page=sem.diagrams.find(d=>d.packageId===IDS.pagePackage);
test.after(()=>fs.rmSync(folder,{recursive:true,force:true}));

test('SYNTHETIC raw RP traverses real readers with five modern graph packages and its referenced HTML config',()=>{
  const decoded=inspectRpObjects(fixture.file);
  assert.equal(decoded.packages.length,6);assert(decoded.packages.every(p=>p.status==='decoded-observed-object-structure'));
  assert.equal(decoded.packages.filter(p=>p.version.join('.')==='11.0.0.0').length,5);
  const config=decoded.packages.find(p=>p.packageId==='22fe5073c9244703bde508d7a1134dd5');
  assert.deepEqual(config.version,[9,0,1,0]);assert.equal(config.objects.find(o=>o.id===config.rootId).type,'Axure:HtmlPrototypeGeneratorConfiguration');
  assert.deepEqual(sem.packageFailures,[]);assert.deepEqual(sem.semanticFailures,[]);
  assert.equal(fixture.manifest.synthetic,true);assert.match(fixture.manifest.description,/not native write-back/);
  assert.equal(fixture.manifest.retainedParts.length,6);assert.equal(fixture.manifest.omittedParts.length,3);
  assert(fixture.manifest.retainedParts.every(p=>typeof p.reason==='string'&&p.reason.length));
  assert(fixture.manifest.omittedParts.every(p=>typeof p.reason==='string'&&p.reason.length));
  assert.equal(fixture.manifest.source.sha256,SOURCE_SHA256);assert.equal(page.name,'SYNTHETIC Adaptive Import');
  assert.deepEqual(sem.diagrams.map(d=>d.rootType),['Axure:PanelState','Axure:PanelState','Axure:Page']);
  assert.equal(page.widgets.length,6);assert(page.widgets.every(w=>w.typeCandidate));
});

test('default HTML configuration dependency restores supported Auto case-selection policy',()=>{
  const config=sem.documentSettingsRecovery.caseSelection;
  assert.equal(config.status,'supported',config.reason);assert.equal(config.value,'auto');
  assert.equal(config.sourceValue,'DisplayMultipleTargetsOnly');assert.equal(config.sourcePackageId,'22fe5073c9244703bde508d7a1134dd5');
  assert.equal(config.sourcePartSha256.length,64);
});

test('SYNTHETIC complete set retains literal Base and parent identities and assigns its Page',()=>{
  const recovery=sem.adaptiveRecovery;assert.equal(recovery.status,'decoded-adaptive-sets');assert.equal(recovery.sets.length,1);
  const set=recovery.sets[0];assert.equal(set.status,'supported-adaptive-set');assert.equal(set.sourceId,IDS.setObject);assert.equal(set.id,IDS.set);
  assert.deepEqual([set.base.width,set.base.height,set.base.cursor,set.base.id],[1200,0,0,NATIVE_BASE_VIEW_ID]);
  assert.deepEqual(set.views.map(v=>[v.id,v.width,v.height,v.cursor,v.baseViewId]),[[IDS.tablet,768,0,0,NATIVE_BASE_VIEW_ID],[IDS.phone,390,0,0,IDS.tablet]]);
  assert.deepEqual(recovery.pages.map(p=>[p.sourceId,p.status,p.setId]),[[IDS.page,'assigned',IDS.set]]);
  assert.equal(recovery.diagnostics.length,0);
});

test('SYNTHETIC eligible local paints/geometry and whole state-map barrier survive bytes exactly',()=>{
  const owner=page.widgets.find(w=>w.id===IDS.target),r=owner.adaptiveStyleRecovery;
  assert.equal(owner.selectionRecovery.status,'supported-selection');assert.equal(owner.selectionRecovery.selected,true);
  assert.deepEqual(owner.selectionRecovery.selectedStyle,{fill:'#81d3f8'});assert.equal(owner.selectionRecovery.baseStyleRecovery.style.fill,'#ffffff');
  assert.equal(owner.interactionRecovery.events.length,0,'Target has no residual Tab click actions');
  assert.equal(r.status,'decoded-adaptive-styles');assert.deepEqual(r.entries.map(e=>e.viewId),[IDS.tablet,IDS.phone]);
  assert.deepEqual(r.entries[0].patch,fixture.manifest.expected.tablet);assert.deepEqual(r.entries[1].patch,fixture.manifest.expected.phone);
  assert.equal(r.entries[0].source.stateStyleSources.length,2);assert.equal(r.entries[1].source.stateStyleSources.length,0);
  assert(!Object.hasOwn(r.entries[1].patch,'width'),'Phone width must inherit instead of materializing Tablet width');
  const orphan=page.widgets.find(w=>w.id===IDS.orphan).adaptiveStyleRecovery;
  assert.deepEqual(orphan.entries.map(e=>[e.viewId,e.patch]),[[IDS.inactive,{}]]);
  assert(!Object.hasOwn(orphan.entries[0].patch,'stateStyles'),'Empty orphan declaration must not become an explicit state-map barrier');
});

test('SYNTHETIC native interaction trees decode named Phone, Base, Auto plus Page event338',()=>{
  const expected=[{kind:'nativeGuid',guid:IDS.phone},{kind:'base'},{kind:'auto'}];
  for(let i=0;i<fixture.manifest.buttons.length;i++){
    const button=fixture.manifest.buttons[i],widget=page.widgets.find(w=>w.id===button.id),tree=widget.interactionRecovery;
    assert.equal(widget.text.text,button.label);assert.equal(tree.status,'decoded-interaction-tree');assert.equal(tree.events.length,1);
    const e=tree.events[0];assert.equal(e.status,'supported-event');assert.equal(e.event,'click');assert.equal(e.cases.length,1);
    assert.deepEqual(e.cases[0].actions,[{sourceId:fixture.manifest.events[i].actionSourceId,type:'setAdaptiveView',adaptiveView:expected[i]}]);
    assert.equal(e.cases[0].enabled,true);assert.equal(e.cases[0].isNewIfGroup,true);
  }
  const e=page.interactionRecovery.events[0];assert.equal(e.status,'supported-event');assert.equal(e.nativeEventType,338);assert.equal(e.event,'adaptiveViewChange');assert.equal(e.cases.length,1);assert.deepEqual(e.cases[0].actions,[]);
});

test('fixture bytes are deterministic and the pinned original sample remains unchanged',()=>{
  const first=makeSyntheticAdaptiveRp(),second=makeSyntheticAdaptiveRp();assert.deepEqual(first.bytes,second.bytes);
  assert.equal(createHash('sha256').update(fs.readFileSync(first.manifest.source.file)).digest('hex'),SOURCE_SHA256);
  assert.equal(createHash('sha256').update(first.bytes).digest('hex'),fixture.manifest.rawSha256);
});
