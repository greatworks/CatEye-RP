import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { inspectRpSemantics, recoverRpSemantics, recoverSelectionGroups, property as get, argbColor, recoverRectanglePath } from './read-rp-semantics.mjs';

const file = name => fileURLToPath(new URL(`../samples/${name}`, import.meta.url));
const tabObjects = inspectRpObjects(file('the-basics-tab-menu.rp'));
const fieldObjects = inspectRpObjects(file('complex-interactions-required-fields.rp'));
const page = r => r.diagrams.find(d => d.name === 'Page 1');
const tabPagePackage = r => r.packages.find(p => p.packageId === '216580735aa64e1db9043586ecd32d66');
const map = entries => ({ $map: entries });
const replace = (m,k,v) => { const p=m.$map.find(p=>p[0]===k); if(p) p[1]=v;else m.$map.push([k,v]); };

test('source font conversion is recorded as get_Size, divide by .75, Run.set_Size', () => {
  const e=JSON.parse(readFileSync(file('font-scale-cil.json')));
  assert.equal(e.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
  const il=e.Types[0].Methods.find(m=>m.Name==='bJcT').Instructions;
  const start=il.findIndex(i=>i.Resolved?.endsWith('::get_Size'));
  assert.equal(il[start+1].Operand,.75);assert.equal(il[start+2].Op,'div');assert.ok(il[start+3].Resolved.endsWith('Run::set_Size'));
});

test('ARGB preserves signed values and transparent/partial alpha', () => {
  assert.equal(argbColor(-1),'#ffffff');assert.equal(argbColor(0x00ffffff),'#ffffff00');
  assert.equal(argbColor(0x80010203),'#01020380');assert.equal(argbColor(-13421773),'#333333');
  for(const x of [NaN,Infinity,1.2,0x100000000,-2147483649,'#ffffff'])assert.equal(argbColor(x),null);
});

test('selected state recovery keeps the white base separate from both independently referenced blue styles', () => {
  const widgets=page(recoverRpSemantics(tabObjects)).widgets;
  for(const [index,w] of widgets.slice(0,2).entries()) {
    assert.equal(w.selectionRecovery.status,'supported-selection');
    assert.equal(w.selectionRecovery.selected,index===0);
    assert.equal(w.selectionRecovery.selectionGroup,'Tab Control Group');
    assert.equal(w.selectionRecovery.baseStyleRecovery.style.fill,'#ffffff');
    assert.deepEqual(w.selectionRecovery.selectedStyle,{fill:'#81d3f8'});
    assert.deepEqual(w.selectionGroups,{status:'known-selection-groups',selectionGroup:'Tab Control Group'});
  }
  assert.notDeepEqual(widgets[0].styleRecovery.selectedStyleReference,widgets[1].styleRecovery.selectedStyleReference);
});

test('missing inherited location is resolved only through the unique complete cache, with provenance', () => {
  const recovered=recoverRpSemantics(tabObjects),state=recovered.diagrams.find(d=>d.rootType==='Axure:PanelState');
  assert.equal(state.widgets[0].storedGeometry.location,null);
  assert.deepEqual(state.widgets[0].styleRecovery.resolvedGeometry.location.value,{X:0,Y:0});
  assert.equal(state.widgets[0].styleRecovery.resolvedGeometry.location.source.kind,'cached-document-default');
  const source=structuredClone(tabObjects),pack=source.packages.find(p=>p.packageId===state.packageId),root=pack.objects.find(o=>o.id===pack.rootId);
  const caches=get(get(root.properties,'StyleCache'),'Styles');caches.push(structuredClone(caches.find(c=>get(get(c,'Info'),'Name')==='Default')));
  assert.equal(recoverRpSemantics(source).diagrams.find(d=>d.packageId===state.packageId).widgets[0].styleRecovery.resolvedGeometry,null);
});

test('selected style unknown properties, missing nonzero refs and combined states are not flattened into live styles', () => {
  for(const mutation of ['property','ref','disabled','undetermined','referenceTag']) {
    const source=structuredClone(tabObjects),pack=tabPagePackage(source),widget=pack.objects.find(o=>o.id==='2f76607a24f242f6ba9db84b579676c9');
    const style=pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference),ix=get(style.properties,'PropList').find(p=>(get(p,'DOAName')&0x0fffffff)===21),ref=get(get(ix,'Value'),'Selected');
    if(mutation==='property')get(pack.objects.find(o=>o.id===ref.$reference).properties,'PropList').push(map([['DOAName',72|0xc0000000],['Value',map([['On',true]])]]));
    if(mutation==='ref')ref.$reference='f'.repeat(32);
    if(mutation==='disabled')replace(widget.properties,'Disabled',true);
    if(mutation==='undetermined')replace(ix,'DOAName',21|0x40000000);
    if(mutation==='referenceTag')ref.referenceTag=19;
    const result=page(recoverRpSemantics(source)).widgets[0];
    assert.equal(result.selectionRecovery.status,'unsupported-selection');
    assert.deepEqual(result.selectionGroups,{status:'known-selection-groups',selectionGroup:'Tab Control Group'});
  }
});

test('Selected Style requires an explicit array; missing and non-array properties cannot imply an empty style', () => {
  for(const index of [0,1]) for(const value of [undefined,null,false,0,'',{},[]]) {
    const source=structuredClone(tabObjects),pack=tabPagePackage(source),id=index?'bcfb632e6e7b4fe288077a145b7330df':'2f76607a24f242f6ba9db84b579676c9';
    const widget=pack.objects.find(o=>o.id===id),style=pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference),ix=get(style.properties,'PropList').find(p=>(get(p,'DOAName')&0x0fffffff)===21);
    const selected=pack.objects.find(o=>o.id===get(get(ix,'Value'),'Selected').$reference);
    if(value===undefined)selected.properties.$map=selected.properties.$map.filter(([key])=>key!=='PropList');else replace(selected.properties,'PropList',value);
    const result=page(recoverRpSemantics(source)).widgets[index];
    assert.equal(result.type,'Axure:DiagramObject:VectorShape');
    assert.deepEqual(result.selectionGroups,{status:'known-selection-groups',selectionGroup:'Tab Control Group'});
    if(Array.isArray(value)) {
      assert.equal(result.status,'stored-fields-recovered');assert.equal(result.selectionRecovery.status,'supported-selection');assert.deepEqual(result.selectionRecovery.selectedStyle,{});
    } else if(index===0) {
      assert.equal(result.status,'unsupported-widget-fields');assert.match(result.reason,/explicit PropList array/);
    } else {
      assert.equal(result.status,'stored-fields-recovered');assert.equal(result.selectionRecovery.status,'unsupported-selection');assert.match(result.selectionRecovery.reason,/explicit PropList array/);
    }
  }
});

test('source group identity survives geometry/style failure and an unsupported type candidate', () => {
  for(const mutation of ['geometry','style','type']) {
    const source=structuredClone(tabObjects),pack=tabPagePackage(source),widget=pack.objects.find(o=>o.id==='2f76607a24f242f6ba9db84b579676c9');
    const style=pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference);
    if(mutation==='geometry')replace(get(get(style.properties,'PropList').find(p=>(get(p,'DOAName')&0x0fffffff)===105),'Value'),'Width',NaN);
    if(mutation==='style')style.type='Axure:UnknownStyle';
    if(mutation==='type')replace(widget.properties,'ControlPoints',[]);
    const result=page(recoverRpSemantics(source)).widgets[0];
    assert.equal(result.type,widget.type);assert.equal(result.id,widget.id);
    assert.deepEqual(result.selectionGroups,{status:'known-selection-groups',selectionGroup:'Tab Control Group'});
    assert.equal(result.panelStatePackages,null);
    if(mutation==='type'){assert.equal(result.status,'stored-fields-recovered');assert.equal(result.typeCandidate,null);}else assert.equal(result.status,'unsupported-widget-fields');
  }
});

test('source group names preserve exact identity and reject missing, oversized, control and ambiguous fields', () => {
  const widget={type:'Axure:DiagramObject:VectorShape',properties:map([['SelectedStyleGroup','']])};
  for(const name of ['', 'Case Sensitive', ' case sensitive ', 'x'.repeat(256)]) {
    replace(widget.properties,'SelectedStyleGroup',name);
    assert.deepEqual(recoverSelectionGroups(widget),{status:'known-selection-groups',selectionGroup:name});
  }
  for(const name of [undefined,null,1,false,'x'.repeat(257),'line\nfeed','null\u0000name','delete\u007f','c1\u0085']) {
    const bad=structuredClone(widget);if(name===undefined)bad.properties=map([]);else replace(bad.properties,'SelectedStyleGroup',name);
    const result=recoverSelectionGroups(bad);assert.equal(result.status,'unknown-selection-groups');assert.ok(result.reason);
  }
  const duplicate=structuredClone(widget);duplicate.properties.$map.push(['SelectedStyleGroup','another']);
  assert.match(recoverSelectionGroups(duplicate).reason,/duplicate/);
  assert.equal(recoverSelectionGroups({...widget,properties:{}}).status,'unknown-selection-groups');
});

test('native RadioButton group metadata does not depend on a supported candidate or readable appearance', () => {
  const original=inspectRpObjects(file('Quick Win.rp'));
  for(const mutation of ['type','style']) {
    const source=structuredClone(original),pack=source.packages.find(p=>p.objects?.some(o=>o.id==='12bd9c9a44d14d2792e50920203cb292'));
    const widget=pack.objects.find(o=>o.id==='12bd9c9a44d14d2792e50920203cb292');
    if(mutation==='type')replace(widget.properties,'align-selection-button-right','True');else pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference).type='Axure:UnknownStyle';
    const result=recoverRpSemantics(source).diagrams.flatMap(d=>d.widgets).find(w=>w.id===widget.id);
    assert.deepEqual(result.selectionGroups,{status:'known-selection-groups',selectionGroup:'',radioGroup:'Duration Radio Group'});
    assert.equal(result.type,'Axure:DiagramObject:RadioButton');
    if(mutation==='type')assert.equal(result.typeCandidate,null);else assert.equal(result.status,'unsupported-widget-fields');
  }
  const radio={type:'Axure:DiagramObject:RadioButton',properties:map([['SelectedStyleGroup',''],['radio-group','']])};
  assert.deepEqual(recoverSelectionGroups(radio),{status:'known-selection-groups',selectionGroup:'',radioGroup:''});
  for(const value of [undefined,null,9,'x'.repeat(257),'bad\tgroup']) {
    const mutated=structuredClone(radio);if(value===undefined)mutated.properties.$map.pop();else replace(mutated.properties,'radio-group',value);
    assert.equal(recoverSelectionGroups(mutated).status,'unknown-selection-groups');
  }
});

test('failed panel geometry retains its source type, group and state links; unreadable links are explicitly marked', () => {
  for(const mutation of ['geometry','links','missing-links','invalid-links']) {
    const source=structuredClone(tabObjects),pack=tabPagePackage(source),widget=pack.objects.find(o=>o.id==='c909f8f46aa742d4a7e1677418cdac66');
    replace(widget.properties,'SelectedStyleGroup','Panel group');const links=structuredClone(get(widget.properties,'panel-diagrams'));
    if(mutation==='geometry')pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference).type='Axure:UnknownStyle';
    else if(mutation==='links')widget.properties.$map.push(['panel-diagrams',[]]);
    else {
      if(mutation==='missing-links')widget.properties.$map=widget.properties.$map.filter(([key])=>key!=='panel-diagrams');
      else replace(widget.properties,'panel-diagrams','not-an-array');
      pack.objects.find(o=>o.id===get(widget.properties,'MyStyle').$reference).type='Axure:UnknownStyle';
    }
    const result=page(recoverRpSemantics(source)).widgets[2];
    assert.equal(result.status,'unsupported-widget-fields');assert.equal(result.type,'Axure:DiagramObject:DynamicPanel');
    assert.deepEqual(result.selectionGroups,{status:'known-selection-groups',selectionGroup:'Panel group'});
    if(mutation==='geometry'){assert.deepEqual(result.panelStatePackages,links);assert.equal(result.panelStatePackagesError,undefined);}
    else{assert.equal(result.panelStatePackages,null);assert.match(result.panelStatePackagesError,/duplicate property panel-diagrams|Missing or invalid panel state references/);}
  }
});

test('Quick Win radio type, checked carrier and radio group are independently recovered from shape groups', () => {
  const source=inspectRpSemantics(file('Quick Win.rp'));
  const radios=source.diagrams.flatMap(d=>d.widgets).filter(w=>w.type==='Axure:DiagramObject:RadioButton');
  assert.equal(radios.length,6);
  assert.ok(radios.every(w=>w.typeCandidate.type==='radio'&&w.selectionRecovery.status==='supported-selection'&&w.selectionRecovery.selectionGroup===''));
  assert.deepEqual(radios.map(w=>[w.selectionRecovery.selected,w.selectionRecovery.radioGroup]),[[true,''],[false,''],[false,'Duration Radio Group'],[true,'Duration Radio Group'],[true,'Duration Moving'],[false,'Duration Moving']]);
});

test('two independent official samples cross-check rounded paths, selected colors and text units', () => {
  const tabs=page(recoverRpSemantics(tabObjects)).widgets;
  assert.deepEqual(tabs[0].typeCandidate.cornerRadii,[5,5,0,0]);assert.deepEqual(tabs[1].typeCandidate.cornerRadii,[5,5,0,0]);
  assert.equal(tabs[0].styleRecovery.style.fill,'#81d3f8');assert.equal(tabs[1].styleRecovery.style.fill,'#ffffff');
  assert.equal(tabs[0].styleRecovery.provenance.fill.kind,'stored-active-state-style');
  assert.equal(tabs[0].styleRecovery.style.fontSize,13);
  const fields=page(recoverRpSemantics(fieldObjects)).widgets;
  assert.equal(fields[0].styleRecovery.style.fontSize,14);assert.equal(fields[0].styleRecovery.style.fill,'#ffffff00');
  assert.deepEqual(fields[4].typeCandidate.cornerRadii,[5,5,5,5]);assert.equal(fields[4].styleRecovery.style.fill,'#169bd5');
  assert.equal(fields[5].styleRecovery.style.color,'#d9001b');assert.equal(fields[5].styleRecovery.visible,false);
  assert.deepEqual(fields[5].styleRecovery.style.textPadding,[0,0,0,0]);assert.equal(fields[5].styleRecovery.style.verticalAlign,'top');
  assert.equal(fields[5].styleRecovery.style.lineHeight,'normal');assert.equal(fields[5].styleRecovery.provenance.lineHeight.nativeFontMetricsVerified,false);
});

test('recovers all four text padding sides in CSS order and omits invalid or undetermined complete padding', () => {
  for(const invalid of [false,true,'undetermined']) {
    const source=structuredClone(tabObjects),p=tabPagePackage(source),w=p.objects.find(o=>o.id==='bcfb632e6e7b4fe288077a145b7330df');
    const s=p.objects.find(o=>o.id===get(w.properties,'MyStyle').$reference),props=get(s.properties,'PropList');
    for(const [key,value] of [[11,1],[12,2],[13,3],[14,invalid===true?-1:4],[10,2]]) {
      const previous=props.findIndex(prop=>(get(prop,'DOAName')&0x0fffffff)===key);
      const entry=map([['DOAName',key|(invalid==='undetermined'&&key===14?0x40000000:0xc0000000)],['Value',value]]);
      if(previous>=0)props[previous]=entry;else props.push(entry);
    }
    const result=page(recoverRpSemantics(source)).widgets[1].styleRecovery;
    if(invalid===false)assert.deepEqual(result.style.textPadding,[2,3,4,1]);else assert.equal(result.style.textPadding,undefined);
    assert.equal(result.style.verticalAlign,'bottom');
  }
});

test('changing a curve handle or adding an arbitrary segment invalidates shape identification', () => {
  const pack=tabPagePackage(tabObjects),widget=pack.objects.find(o=>o.id==='2f76607a24f242f6ba9db84b579676c9');
  const paths=structuredClone(get(widget.properties,'ControlPoints'));
  assert.ok(recoverRectanglePath(paths,140,40));
  replace(get(paths[0][0],'HigherHandle'),'Y',.07);
  assert.equal(recoverRectanglePath(paths,140,40),null);
  const extra=structuredClone(get(widget.properties,'ControlPoints'));extra[0].push(extra[0][0]);
  assert.equal(recoverRectanglePath(extra,140,40),null);
  assert.equal(recoverRectanglePath(get(widget.properties,'ControlPoints'),0,40),null);
});

test('a mismatched cache library or duplicate default never silently supplies inherited colors', () => {
  for(const mutation of ['library','duplicate']) {
    const source=structuredClone(tabObjects),p=tabPagePackage(source),root=p.objects.find(o=>o.id===p.rootId);
    const caches=get(get(root.properties,'StyleCache'),'Styles');
    if(mutation==='duplicate')caches.push(structuredClone(caches.find(c=>get(get(c,'Info'),'Name')==='Default')));
    else replace(get(caches.find(c=>get(get(c,'Info'),'Name')==='Button'),'Info'),'LibraryId',{$guid:'f'.repeat(32)});
    const w=page(recoverRpSemantics(source)).widgets[1];
    assert.equal(w.styleRecovery.cacheChainComplete,false);assert.equal(w.styleRecovery.style.fill,undefined);
    assert.ok(w.styleRecovery.unknown.some(x=>x.reason.includes('No unique')));
  }
});

test('unknown gradient fill retains its original value and origin instead of taking a default solid fill', () => {
  const source=structuredClone(tabObjects),p=tabPagePackage(source),w=p.objects.find(o=>o.id==='bcfb632e6e7b4fe288077a145b7330df');
  const s=p.objects.find(o=>o.id===get(w.properties,'MyStyle').$reference),gradient=map([['fill-type','unrecognized-gradient'],['custom','source-data']]);
  get(s.properties,'PropList').push(map([['DOAName',-1073741817],['Value',gradient]]));
  const result=page(recoverRpSemantics(source)).widgets[1].styleRecovery;
  assert.equal(result.style.fill,undefined);
  assert.deepEqual(result.unknown.find(x=>x.property==='FILL').value,gradient);
  assert.equal(result.unknown.find(x=>x.property==='FILL').source.kind,'local-object-style');
  // An undetermined property must not become a visibility/style instruction.
  const first=p.objects.find(o=>o.id==='2f76607a24f242f6ba9db84b579676c9');
  const firstStyle=p.objects.find(o=>o.id===get(first.properties,'MyStyle').$reference),props=get(firstStyle.properties,'PropList');
  for(const [key,value] of [[80,0],[110,false],[21,map([['Selected',map([])]])]]) {
    const existing=props.find(prop=>(get(prop,'DOAName')&0x0fffffff)===key);
    const unknown=map([['DOAName',key|0x40000000],['Value',value]]);
    if(existing)props[props.indexOf(existing)]=unknown;else props.push(unknown);
  }
  const guarded=page(recoverRpSemantics(source)).widgets[0].styleRecovery;
  assert.equal(guarded.visible,null);assert.notEqual(guarded.style.strokeWidth,0);
  assert.equal(guarded.style.fill,'#ffffff');
  assert.ok(guarded.unknown.some(x=>x.property==='BORDER_VISIBILITY'&&x.value===0));
});

test('mixed run formatting is explicitly unresolved rather than flattened into one claimed font', () => {
  const source=structuredClone(tabObjects),p=tabPagePackage(source),w=p.objects.find(o=>o.id==='bcfb632e6e7b4fe288077a145b7330df');
  const runs=get(get(get(w.properties,'RichTextBlock'),'attributed-string'),'Paragraphs').flatMap(p=>get(p,'Inlines'));
  const second=structuredClone(runs[0]);replace(second,'Size',24);
  get(get(get(get(w.properties,'RichTextBlock'),'attributed-string'),'Paragraphs')[0],'Inlines').push(second);
  const r=page(recoverRpSemantics(source)).widgets[1].styleRecovery;
  assert.equal(r.style.fontSize,undefined);assert.ok(r.unknown.some(x=>x.property==='fontSize'&&x.reason.includes('Mixed')));
});

test('browser normal line height is used only for explicitly automatic object and paragraph spacing', () => {
  for (const variant of ['paragraph', 'object']) {
    const source=structuredClone(fieldObjects),p=source.packages.find(p=>p.packageId==='1455edf5f56a48e99b2c94ee5d1ea987'),w=p.objects.find(o=>o.id==='092e74036220411eafc5eaeafda448ed');
    if(variant==='paragraph')replace(get(get(get(w.properties,'RichTextBlock'),'attributed-string'),'Paragraphs')[0],'LineSpacing',18);
    else {
      const s=p.objects.find(o=>o.id===get(w.properties,'MyStyle').$reference);
      get(s.properties,'PropList').push(map([['DOAName',20|0xc0000000],['Value',18]]));
    }
    assert.equal(page(recoverRpSemantics(source)).widgets[0].styleRecovery.style.lineHeight,undefined);
  }
});

test('official library panel has explicit fixed bounds and an ordered state package reference', () => {
  const result=inspectRpSemantics(file('Default.rplib'));
  const p=result.diagrams.find(d=>d.name==='Dynamic panel').widgets[0];
  assert.equal(p.typeCandidate.type,'panel');assert.equal(p.storedFlags['fit-to-content'],false);
  assert.deepEqual(p.storedGeometry.size.value,{Width:300,Height:170});
  assert.equal(p.panelStatePackages[0].name,'Axure:PanelState');
  assert.ok(result.diagrams.some(d=>d.packageId===p.panelStatePackages[0].$reference&&d.rootType==='Axure:PanelState'));
});
