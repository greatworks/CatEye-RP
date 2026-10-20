import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverRpSemantics, property as get } from './read-rp-semantics.mjs';

const original=inspectRpObjects(fileURLToPath(new URL('../samples/the-basics-tab-menu.rp',import.meta.url)));
const map=pairs=>({$map:pairs}),ref=id=>({$reference:id,referenceTag:3}),guid=id=>({$guid:id});
const replace=(m,k,v)=>{const p=m.$map.find(([name])=>name===k);if(p)p[1]=v;else m.$map.push([k,v]);};
const prop=(k,v,flags=0xc0000000)=>map([['DOAName',k|flags],['Value',v]]);
const solid=c=>map([['fill-type','solid'],['fill-color',c]]);
const widgetId='2f76607a24f242f6ba9db84b579676c9',viewId='c'.repeat(32);
function fixture(props=[]){
  const decoded=structuredClone(original),pack=decoded.packages.find(p=>p.packageId==='216580735aa64e1db9043586ecd32d66');
  const widget=pack.objects.find(o=>o.id===widgetId),style={id:'d'.repeat(32),type:'Axure:Style',properties:map([['All',false],['PropList',props]])};
  pack.objects.push(style);replace(widget.properties,'AdaptiveStyles',[guid(viewId),ref(style.id)]);
  return {decoded,pack,widget,style};
}
const read=f=>recoverRpSemantics(f.decoded).diagrams.find(d=>d.packageId===f.pack.packageId).widgets.find(w=>w.id===widgetId).adaptiveStyleRecovery;
function addState(f,name,props){const id=(f.pack.objects.length.toString(16)).padStart(32,'e');f.pack.objects.push({id,type:'Axure:Style',properties:map([['All',false],['PropList',props]])});return [name,ref(id)];}

test('empty local record retains orphan view identity without creating a state-style barrier',()=>{
  const f=fixture(),before=JSON.stringify(f.decoded),r=read(f);assert.equal(r.status,'decoded-adaptive-styles');
  assert.equal(r.schema,1);assert.equal(r.sourceId,widgetId);assert.equal(r.entries.length,1);
  assert.deepEqual(r.entries[0].patch,{});assert.equal(r.entries[0].viewId,viewId);assert.equal(r.entries[0].styleId,f.style.id);
  assert.deepEqual(r.entries[0].source.properties,[]);assert.deepEqual(r.entries[0].source.stateStyleSources,[]);assert.equal(JSON.stringify(f.decoded),before);
});
test('explicit local coordinates, dimensions, appearance, zero and false remain independent declarations',()=>{
  const f=fixture([prop(101,map([['X',0],['Y',-10]])),prop(105,map([['Width',123],['Height',45]])),prop(7,solid(-65536)),prop(70,0),prop(5,false),prop(2,18)]);
  assert.deepEqual(read(f).entries[0].patch,{x:0,y:-10,width:123,height:45,style:{fill:'#ff0000',opacity:0,underline:false,fontSize:24}});
});
test('non-overridden and indeterminate snapshots survive as source but do not become declarations',()=>{
  const f=fixture([prop(7,solid(-65536),0x80000000),prop(105,map([['Width',5],['Height',10]]),0x40000000),prop(9999,17,0)]),r=read(f);
  assert.deepEqual(r.entries[0].patch,{});assert.equal(r.entries[0].source.properties.length,3);
});
test('eligible explicit empty P21 blocks inherited effects; absent P21 does not',()=>{
  assert.deepEqual(read(fixture([prop(21,map([]))])).entries[0].patch,{stateStyles:{}});
  assert.deepEqual(read(fixture([prop(21,map([]),0x80000000)])).entries[0].patch,{});
});
test('state map retains empty target entries, skips zero refs and converts concrete local paints',()=>{
  const f=fixture(),pairs=[addState(f,'Selected',[]),addState(f,'MouseOver',[prop(7,solid(-65536))]),['Disabled',ref('0'.repeat(32))]];
  replace(f.style.properties,'PropList',[prop(21,map(pairs))]);const r=read(f);
  assert.deepEqual(r.entries[0].patch,{stateStyles:{selected:{},mouseOver:{fill:'#ff0000'}}});assert.equal(r.entries[0].source.stateStyleSources.length,2);
});
for(const mutation of ['odd','bad-guid','zero-guid','base-guid','auto-guid','duplicate','bad-ref','zero-ref','missing-target','wrong-type','all','metadata','missing-props','duplicate-prop','bad-prop-shape','unknown-active','partial-size','partial-padding','state-unknown','state-ref','state-target'])test(`rejects malformed or unrepresentable adaptive declaration atomically: ${mutation}`,()=>{
  const f=fixture([prop(7,solid(-65536))]),a=get(f.widget.properties,'AdaptiveStyles');
  if(mutation==='odd')a.pop();if(mutation==='bad-guid')a[0]={$guid:viewId,extra:1};if(mutation==='zero-guid')a[0]=guid('0'.repeat(32));
  if(mutation==='base-guid')a[0]=guid('19e82109f102476f933582835c373474');if(mutation==='auto-guid')a[0]=guid('982030d673df45868f11149ca2b8b02f');
  if(mutation==='duplicate')a.push(...structuredClone(a));if(mutation==='bad-ref')a[1].referenceTag=19;if(mutation==='zero-ref')a[1]=ref('0'.repeat(32));
  if(mutation==='missing-target')a[1]=ref('f'.repeat(32));if(mutation==='wrong-type')f.style.type='Axure:Page';
  if(mutation==='all')replace(f.style.properties,'All',true);if(mutation==='metadata')replace(f.style.properties,'MatchInfo',map([]));
  if(mutation==='missing-props')f.style.properties.$map.pop();if(mutation==='duplicate-prop')get(f.style.properties,'PropList').push(prop(7,solid(-1)));
  if(mutation==='bad-prop-shape')get(f.style.properties,'PropList')[0].$map.push(['Extra',0]);if(mutation==='unknown-active')get(f.style.properties,'PropList').push(prop(9999,17));
  if(mutation==='partial-size')get(f.style.properties,'PropList').push(prop(105,map([['Width',100]])));if(mutation==='partial-padding')get(f.style.properties,'PropList').push(prop(11,4));
  if(mutation==='state-unknown')get(f.style.properties,'PropList').push(prop(21,map([['MouseOverSelected',ref('0'.repeat(32))]])));
  if(mutation==='state-ref')get(f.style.properties,'PropList').push(prop(21,map([['Selected',{$reference:'0'.repeat(32),referenceTag:19}]])));
  if(mutation==='state-target')get(f.style.properties,'PropList').push(prop(21,map([['Selected',ref('f'.repeat(32))]])));
  const r=read(f);assert.equal(r.status,'unsupported-adaptive-styles');assert.equal(r.entries,undefined);assert.ok(r.reason);
});
test('shadow, complete padding and atomic line endpoints reuse the verified native visual conversion',()=>{
  const f=fixture([prop(72,map([['On',false],['OffsetX',1],['OffsetY',2],['BlurRadius',3],['Color',-16777216],['Spread',0]])),prop(17,map([['Start',3],['End',1]])),...[11,12,13,14].map((k,i)=>prop(k,i+1))]);
  assert.deepEqual(read(f).entries[0].patch,{style:{outerShadow:{on:false,offsetX:1,offsetY:2,blurRadius:3,color:'#000000'},lineEnds:{start:'filled-triangle',end:'none'},textPadding:[2,3,4,1]}});
});
test('local visibility preserves explicit true and false without using placement as visibility',()=>{
  assert.deepEqual(read(fixture([prop(110,false)])).entries[0].patch,{hidden:true});
  assert.deepEqual(read(fixture([prop(110,true)])).entries[0].patch,{hidden:false});
  assert.equal(read(fixture([prop(111,false)])).status,'unsupported-adaptive-styles');
  // P111 is BoolOverride, whose eligible IGNORE=0 writes limbo:true in rJeU.
  // This numeric carrier is now evidenced; it must not enter the unknown list.
  assert.deepEqual(read(fixture([prop(111,0)])).entries[0].patch,{placed:false});
});
test('geometry matches saveable model bounds without clamping or splitting native pairs',()=>{
  for(const size of [0,.5,100001,Infinity])assert.equal(read(fixture([prop(105,map([['Width',size],['Height',10]]))])).status,'unsupported-adaptive-styles');
  assert.deepEqual(read(fixture([prop(105,map([['Width',1],['Height',100000]]))])).entries[0].patch,{width:1,height:100000});
});
test('unknown active transforms and extra paint fields never disappear from an accepted patch',()=>{
  for(const key of [0,50,51,1401,1402])assert.equal(read(fixture([prop(key,0)])).status,'unsupported-adaptive-styles');
  assert.equal(read(fixture([prop(7,map([['fill-type','solid'],['fill-color',-1],['unknown',true]]))])).status,'unsupported-adaptive-styles');
});
test('verified native rectangle P71/P81 zero values project independently instead of being discarded',()=>{
  // SYNTHETIC local overrides on the real Tab Menu base/cache/path carrier.
  // Only the independent radius/mask properties leave the old unknown list.
  assert.deepEqual(read(fixture([prop(71,0)])).entries[0].patch,{style:{radius:0}});
  assert.deepEqual(read(fixture([prop(81,0)])).entries[0].patch,{style:{cornerVisibility:[false,false,false,false]}});
  assert.equal(read(fixture([prop(71,-1)])).status,'unsupported-adaptive-styles');
  assert.equal(read(fixture([prop(81,16)])).status,'unsupported-adaptive-styles');
});
test('page adaptive appearance gets a separate diagnostic, never a widget-style mapping',()=>{
  const f=fixture(),root=f.pack.objects.find(o=>o.id===f.pack.rootId);replace(root.properties,'AdaptiveStyles',[guid(viewId),ref(f.style.id)]);
  const r=recoverRpSemantics(f.decoded);assert.ok(r.adaptiveRecovery.diagnostics.some(d=>d.code==='unsupported-page-adaptive-styles'&&d.sourceId===root.id));
});
