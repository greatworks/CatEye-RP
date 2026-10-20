import test from 'node:test';
import assert from 'node:assert/strict';
import * as semantic from './read-rp-semantics.mjs';
import * as adaptive from './read-rp-adaptive.mjs';

const id=n=>n.toString(16).padStart(32,'0'),map=value=>({$map:Object.entries(value)}),prop=(value,flags=3)=>map({DOAName:111|(flags<<30),Value:value});
const fixture=(value,flags=3)=>{
  const style={id:id(2),type:'Axure:Style',properties:map({PropList:[map({DOAName:0|0xc0000000,Value:{$guid:id(4)}}),...(value===undefined?[]:[prop(value,flags)])],MatchInfo:map({Id:{$guid:id(4)},LibraryId:{$guid:id(0)}})})};
  const cache=(n,value)=>map({Info:map({Id:{$guid:id(n)},LibraryId:{$guid:id(0)}}),Props:[prop(value)]});
  return {widget:{id:id(1),type:'Axure:DiagramObject:VectorShape',properties:map({IsContained:false})},style,root:{properties:map({StyleCache:map({Styles:[cache(3,1),cache(4,1)]})})},defaultId:id(3),candidate:{type:'box'}};
};
const recover=f=>semantic.recoverPlacement(f.widget,f.style,f.root,f.defaultId,f.candidate,f.descendant,Object.hasOwn(f,'version')?f.version:[11,0,0,0]);
for(const [value,placed]of [[0,false],[1,true],[2,false]])test(`native BoolOverride ${value} retains its exact direct mapping`,()=>{
  const f=fixture(value),r=recover(f);assert.equal(r.status,'supported-direct-placement');assert.equal(r.placed,placed);assert.equal(r.source.value,value);assert.equal(r.source.rawDoaName,111|0xc0000000);assert.equal(r.source.styleId,id(2));assert.equal(r.sourceId,id(1));assert.equal(adaptive.nativePlaced(value),placed);
});
for(const value of [true,false,1.5,3,-1,'1',null])test(`reject non-enum carrier ${JSON.stringify(value)}`,()=>{
  assert.throws(()=>adaptive.nativePlaced(value),/BoolOverride/);assert.equal(recover(fixture(value)).status,'unsupported-placement');
});
for(const flags of [0,1,2])test(`inactive direct P111 flag ${flags} cannot override known true cache`,()=>{
  const r=recover(fixture(2,flags));assert.equal(r.status,'inactive-direct-placement');assert.equal(r.source.value,2);assert.equal(r.source.rawDoaName,111|(flags<<30));assert.equal(r.fallback,'complete-known-true-cache');assert.equal(r.placed,undefined);
});
test('known true default/named caches do not create a new Base declaration',()=>assert.equal(recover(fixture()),undefined));
for(const which of [0,1])test(`nontrue cache ${which} is rejected with source, not mapped as direct placement`,()=>{
  const f=fixture(),styles=f.root.properties.$map[0][1].$map[0][1];styles[which].$map[1][1][0]=prop(2);
  // Ensure no later cache value masks the selected source.
  if(which===0)styles[1].$map[1][1]=[];
  const r=recover(f);assert.equal(r.status,'unsupported-placement');assert.match(r.reason,/cached/);assert.equal(r.source.value,2);assert.equal(r.source.source.kind,which?'cached-matched-base':'cached-document-default');
});
test('direct OD overrides an unsupported inherited value without attributing it to cache',()=>{
  const f=fixture(1);f.root.properties.$map[0][1].$map[0][1][1].$map[1][1][0]=prop(2);assert.equal(recover(f).status,'supported-direct-placement');
});
test('inactive direct declaration requires a complete known true fallback',()=>{
  const f=fixture(2,2);f.root.properties=map({});assert.equal(recover(f).status,'unsupported-placement');
});
for(const kind of ['tableCell','treeNode','contained-label','menu-table'])test(`active independent placement rejects ${kind}`,()=>{
  const f=fixture(2);if(kind==='contained-label')f.widget.properties=map({IsContained:true});else if(kind==='menu-table'){f.candidate={type:'table'};f.descendant=true;}else f.candidate={type:kind};assert.equal(recover(f).status,'unsupported-placement');
});
for(const type of ['table','menu','tree'])test(`root ${type} retains an explicit placement declaration`,()=>{
  const f=fixture(2);f.candidate={type};assert.equal(recover(f).status,'supported-direct-placement');
});
test('duplicate local property identity is rejected before projection',()=>{
  const f=fixture(2);f.style.properties.$map[0][1].push(prop(1));assert.equal(recover(f).status,'unsupported-placement');
});
for(const version of [undefined,[9,0,0,0],[10,0,4,0],[12,0,0,0],[11,0,0]])test(`direct P111 requires explicit evidenced package version ${JSON.stringify(version)}`,()=>{
  const f=fixture(2);f.version=version;assert.equal(recover(f).status,'unsupported-placement');assert.match(recover(f).reason,/RP11 package version/);
});
