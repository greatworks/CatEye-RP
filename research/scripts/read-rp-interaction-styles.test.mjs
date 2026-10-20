import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { inspectRpSemantics, recoverRpSemantics, property as get } from './read-rp-semantics.mjs';

const sample = name => fileURLToPath(new URL(`../samples/${name}`, import.meta.url));
const source = inspectRpObjects(sample('the-basics-tab-menu.rp'));
const map = pairs => ({ $map: pairs });
const replace = (m,key,value) => { const found = m.$map.find(p => p[0] === key); if (found) found[1] = value; else m.$map.push([key,value]); };
const prop = (key,value) => map([['DOAName',key | 0xc0000000],['Value',value]]);
const solid = color => map([['fill-type','solid'],['fill-color',color]]);
const widgetId = '2f76607a24f242f6ba9db84b579676c9';
function fixture() {
  const decoded = structuredClone(source), pack = decoded.packages.find(p => p.packageId === '216580735aa64e1db9043586ecd32d66');
  const widget = pack.objects.find(o => o.id === widgetId), style = pack.objects.find(o => o.id === get(widget.properties,'MyStyle').$reference);
  const ix = get(style.properties,'PropList').find(p => (get(p,'DOAName') & 0x0fffffff) === 21);
  return { decoded, pack, widget, style, ix };
}
function state(f, name, props) {
  const object = { id: (f.pack.objects.length.toString(16)).padStart(32,'e'), type:'Axure:Style', properties:map([['All',false],['PropList',props]]) };
  f.pack.objects.push(object); replace(get(f.ix,'Value'),name,{$reference:object.id,referenceTag:3}); return object;
}
const recovered = f => recoverRpSemantics(f.decoded).diagrams.find(d => d.packageId === f.pack.packageId).widgets.find(w => w.id === widgetId);

test('state codes come from persistence IxStyleState metadata, not the differently numbered ControlState', () => {
  const metadata = JSON.parse(fs.readFileSync(new URL('../rp-interaction-styles-enum.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
  assert.equal(metadata.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
  const type = metadata.Types.find(t => t.Name === 'IxStyleState' && t.Namespace === 'Axure.Platform.ObjectPersistanceContext');
  for (const [name,code] of Object.entries({MouseOver:1,MouseDown:2,Focused:4,Selected:8,Disabled:64})) assert.equal(Buffer.from(type.Fields.find(f => f.Name === name).Constant,'hex').readInt32LE(),code);
});

test('real RP samples recover three Starter press fills and Basics hover/disabled without changing existing selection recovery', () => {
  const starter = inspectRpSemantics(sample('Prototype Starter.rp')), basics = inspectRpSemantics(sample('Prototyping Basics.rp'));
  const patches = result => result.diagrams.flatMap(d => d.widgets.flatMap(w => Object.entries(w.interactionStyleRecovery?.states ?? {}).filter(([,s]) => s.status === 'supported-state-style').map(([state,s]) => ({id:w.id,state,style:s.style}))));
  assert.deepEqual(patches(starter),['a20c6e08f6a14d48a082a77db645e210','b2da27f43c2940cca3f8d99719efea6a','3b8e4964c21a49c8b94d4bf35530b219'].map(id => ({id,state:'mousedown',style:{fill:'#c2c2c2'}})));
  assert.deepEqual(patches(basics),[{id:'6916f399031443218a91b11e4e423a30',state:'mouseover',style:{fill:'#f3f3f3'}},{id:'3471e28ded924670841f3dfd061d33a0',state:'disabled',style:{fill:'#9e9e9e'}}]);
  const existing = recovered(fixture()); assert.deepEqual(existing.selectionRecovery.selectedStyle,{fill:'#81d3f8'}); assert.equal(existing.selectionRecovery.baseStyleRecovery.style.fill,'#ffffff');
});

test('four independent explicit states preserve equal-base values and color alpha without flattening selected appearance', () => {
  const f = fixture(); state(f,'MouseOver',[prop(7,solid(-1))]); state(f,'MouseDown',[prop(7,solid(0x80010203))]); state(f,'Focused',[prop(8,solid(-65536)),prop(15,2)]); state(f,'Disabled',[prop(6,solid(-8355712))]);
  const r = recovered(f); assert.equal(r.interactionStyleRecovery.baseStyleRecovery.style.fill,'#ffffff');
  assert.deepEqual(Object.fromEntries(Object.entries(r.interactionStyleRecovery.states).map(([name,r]) => [name,r.style])),{mouseover:{fill:'#ffffff'},mousedown:{fill:'#01020380'},focused:{stroke:'#ff0000',strokeWidth:2},disabled:{color:'#808080'}});
  assert.deepEqual(r.selectionRecovery.selectedStyle,{fill:'#81d3f8'}); assert.equal(r.storedFlags.Selected,true);
});

test('an unknown state property rejects that whole patch while another state stays usable', () => {
  const f = fixture(); state(f,'MouseOver',[prop(7,solid(-1)),prop(72,map([['On',true]]))]); state(f,'Focused',[prop(8,solid(-65536))]);
  const r = recovered(f).interactionStyleRecovery;
  assert.equal(r.states.mouseover.status,'unsupported-state-style'); assert.equal(r.states.mouseover.style,undefined);
  assert.deepEqual(r.states.focused.style,{stroke:'#ff0000'});
});

test('unresolved/malformed references and wrong target types never become no-state or empty patches', () => {
  for (const mutation of ['missing','tag','zero-tag','wrong-type','extra-reference']) {
    const f = fixture(), target = state(f,'MouseOver',[prop(7,solid(-1))]), ref = get(get(f.ix,'Value'),'MouseOver');
    if (mutation === 'missing') ref.$reference = 'f'.repeat(32);
    if (mutation === 'tag') ref.referenceTag = 19;
    if (mutation === 'zero-tag') { ref.$reference = '0'.repeat(32); ref.referenceTag = 19; }
    if (mutation === 'wrong-type') target.type = 'Axure:DiagramObject:VectorShape';
    if (mutation === 'extra-reference') ref.external = true;
    assert.equal(recovered(f).interactionStyleRecovery.states.mouseover.status,'unsupported-state-style');
  }
});

test('empty PropList is explicit; absent, malformed, duplicate and inherited values remain unsupported', () => {
  for (const mutation of ['absent','null','duplicate','base','metadata','all']) {
    const f = fixture(), target = state(f,'MouseOver',[prop(7,solid(-1))]);
    if (mutation === 'absent') target.properties.$map = target.properties.$map.filter(([key]) => key !== 'PropList');
    if (mutation === 'null') replace(target.properties,'PropList',null);
    if (mutation === 'duplicate') get(target.properties,'PropList').push(prop(7,solid(-65536)));
    if (mutation === 'base') get(target.properties,'PropList').push(prop(0,{$guid:'a'.repeat(32)}));
    if (mutation === 'metadata') replace(target.properties,'UnknownInheritance',true);
    if (mutation === 'all') replace(target.properties,'All',true);
    assert.equal(recovered(f).interactionStyleRecovery.states.mouseover.status,'unsupported-state-style',mutation);
  }
  const f = fixture(); state(f,'MouseOver',[]); assert.deepEqual(recovered(f).interactionStyleRecovery.states.mouseover.style,{});
  const inactive = fixture(), target = state(inactive,'MouseOver',[prop(7,solid(-1))]);
  replace(get(target.properties,'PropList')[0],'DOAName',7 | 0x40000000);
  assert.deepEqual(recovered(inactive).interactionStyleRecovery.states.mouseover.style,{});
});

test('invalid map codes, duplicate keys, unknown combinations and undetermined map reject the mapping', () => {
  for (const mutation of ['duplicate','combined','numeric','undetermined']) {
    const f = fixture(); state(f,'MouseOver',[prop(7,solid(-1))]); const pairs = get(f.ix,'Value').$map;
    if (mutation === 'duplicate') pairs.push(structuredClone(pairs.find(([key]) => key === 'MouseOver')));
    if (mutation === 'combined') pairs.push(['MouseOverSelected',{$reference:'0'.repeat(32),referenceTag:3}]);
    if (mutation === 'numeric') pairs.push([1,{$reference:'0'.repeat(32),referenceTag:3}]);
    if (mutation === 'undetermined') replace(f.ix,'DOAName',21 | 0x40000000);
    assert.equal(recovered(f).interactionStyleRecovery.status,'unsupported-interaction-styles');
  }
});

test('invalid/executable color carriers, numeric limits and partial padding are rejected atomically', () => {
  const bad = [prop(7,map([['fill-type','url'],['fill-color',-1]])),prop(7,solid('url(javascript:alert(1))')),prop(7,solid(2**32)),prop(15,Infinity),prop(2,999),prop(70,-.01),prop(1,'Arial; background:url(x)'),prop(11,5)];
  for (const value of bad) { const f = fixture(); state(f,'MouseOver',[value]); assert.equal(recovered(f).interactionStyleRecovery.states.mouseover.status,'unsupported-state-style'); }
});

test('unresolved bases permit only independently specified local solid color patches and cannot prove missing states', () => {
  const f = fixture(); state(f,'MouseOver',[prop(7,solid(-1))]); state(f,'Focused',[prop(15,2)]);
  const root = f.pack.objects.find(o => o.id === f.pack.rootId); replace(root.properties,'StyleCache',map([['Styles',[]]]));
  const r = recovered(f).interactionStyleRecovery; assert.equal(r.cacheChainComplete,false);
  assert.equal(r.states.mouseover.independentOfInheritedBase,true); assert.deepEqual(r.states.mouseover.style,{fill:'#ffffff'});
  assert.equal(r.states.mousedown.status,'unsupported-state-style'); assert.equal(r.states.focused.status,'unsupported-state-style');
});

test('complete chain distinguishes absent state, explicit zero reference and unresolved nonzero reference', () => {
  const f = fixture(); replace(get(f.ix,'Value'),'MouseOver',{$reference:'0'.repeat(32),referenceTag:3});
  const r = recovered(f).interactionStyleRecovery; assert.equal(r.states.mouseover.status,'no-state-style'); assert.equal(r.states.focused.status,'no-state-style');
});

test('disabled initial selection remains unsupported and base recovery does not absorb its active fill', () => {
  const f = fixture(); replace(f.widget.properties,'Disabled',true); state(f,'Disabled',[prop(7,solid(-65536))]);
  const r = recovered(f); assert.equal(r.selectionRecovery.status,'unsupported-selection'); assert.equal(r.interactionStyleRecovery.baseStyleRecovery.style.fill,'#ffffff'); assert.deepEqual(r.interactionStyleRecovery.states.disabled.style,{fill:'#ff0000'});
});

test('parser leaves immutable caller objects untouched', () => {
  const f = fixture(); state(f,'MouseOver',[prop(7,solid(-1))]); const before = JSON.stringify(f.decoded); recovered(f); assert.equal(JSON.stringify(f.decoded),before);
});
