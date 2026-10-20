import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recoverStyle,recoverSelection,recoverInteractionStyles,property} from './read-rp-semantics.mjs';
const map=o=>({$map:Object.entries(o)}),prop=(key,value,flags=0xc0000000)=>map({DOAName:key|flags,Value:value});
const zero='0'.repeat(32),def='a'.repeat(32),base='b'.repeat(32),guid=value=>({$guid:value});
const shadow=(override={})=>map({On:true,OffsetX:-2.5,OffsetY:3,BlurRadius:7,Color:1073741824,Spread:0,...override});
function fixture() {
 const widget={type:'Axure:DiagramObject:VectorShape',properties:map({Selected:false,SelectedStyleGroup:'',Disabled:false,Error:false})},ix=map({}),local=[prop(0,guid(base)),prop(21,ix)];
 const style={id:'c'.repeat(32),properties:map({MatchInfo:map({Id:guid(base),LibraryId:guid(zero)}),PropList:local})};
 const cache=(id,Props)=>map({Info:map({Id:guid(id),LibraryId:guid(zero)}),Props}),defaults=[];
 const root={properties:map({StyleCache:map({Styles:[cache(def,defaults),cache(base,[])]})})};
 const targets=new Map(),state=(name,props)=>{const id=(targets.size+1).toString(16).padStart(32,'d');targets.set(id,{id,type:'Axure:Style',properties:map({All:false,PropList:props})});ix.$map.push([name,{$reference:id,referenceTag:3}]);};
 const args=[widget,style,root,def,ref=>targets.get(ref?.$reference),{type:'box'}];
 return {local,defaults,state,base:()=>recoverStyle(...args,false),selection:()=>recoverSelection(...args),states:()=>recoverInteractionStyles(...args)};
}
test('native PName and six property accessors bind shadow fields independently',()=>{
 const metadata=JSON.parse(fs.readFileSync(new URL('../samples/metadata-PName.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 for(const [name,key] of [['OUTER_SHADOW',72],['INNER_SHADOW',73],['TEXT_SHADOW',74]])assert.equal(Buffer.from(metadata.Types[0].Fields.find(f=>f.Name===name).Constant,'hex').readInt32LE(),key);
 const source=JSON.parse(fs.readFileSync(new URL('../shadow-format-serialization-cil.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 assert.equal(source.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
 const writer=source.Types[0].Methods.find(m=>m.Name==='u590');assert.equal(writer.Token,100718384);
 for(const method of ['c5yl','s5yv','p5yA','W5vB','z5vj','J5vr'])assert.ok(writer.Instructions.some(i=>i.Resolved?.endsWith('::'+method)));
});
test('base native shadows preserve signed offsets, alpha, spread, explicit off and immutable source',()=>{
 const f=fixture();f.local.push(prop(72,shadow()),prop(73,shadow({Spread:4})),prop(74,shadow({On:false})));
 const before=JSON.stringify(f.local),r=f.base();
 assert.deepEqual(r.style.outerShadow,{on:true,offsetX:-2.5,offsetY:3,blurRadius:7,color:'#00000040'});
 assert.deepEqual(r.style.innerShadow,{...r.style.outerShadow,spread:4});assert.deepEqual(r.style.textShadow,{...r.style.outerShadow,on:false});assert.equal(JSON.stringify(f.local),before);
 assert.equal(r.boundsRecovery.outerShadowAbsent,false);
});
test('effective cache values may be determined-only while local inactive snapshots do not activate',()=>{
 const cached=fixture();cached.defaults.push(prop(72,shadow({On:false}),0x80000000));assert.equal(cached.base().style.outerShadow.on,false);
 for(const flags of [0,0x40000000,0x80000000]){const f=fixture();f.local.push(prop(72,shadow(),flags));assert.equal(f.base().style.outerShadow,undefined);}
});
test('selection and named states preserve full atomic off values independently',()=>{
 const f=fixture();f.local.push(prop(72,shadow()));f.state('Selected',[prop(72,shadow({On:false}))]);f.state('MouseOver',[prop(73,shadow({Spread:2}))]);f.state('MouseDown',[prop(74,shadow())]);
 assert.deepEqual(f.selection().selectedStyle,{outerShadow:{on:false,offsetX:-2.5,offsetY:3,blurRadius:7,color:'#00000040'}});
 assert.equal(f.states().states.mouseover.style.innerShadow.spread,2);assert.equal(f.states().states.mousedown.style.textShadow.on,true);
});
for(const [name,change] of [
 ['unknown key',v=>v.$map.push(['Angle',45])],['duplicate key',v=>v.$map.push(['On',true])],['missing key',v=>v.$map.pop()],['bad boolean',v=>v.$map[0][1]=1],['nonfinite',v=>v.$map[1][1]=NaN],['offset limit',v=>v.$map[1][1]=1000.01],['negative blur',v=>v.$map[3][1]=-.1],['blur limit',v=>v.$map[3][1]=1001],['string color',v=>v.$map[4][1]='#000000'],['negative spread',v=>v.$map[5][1]=-1],['spread limit',v=>v.$map[5][1]=1001],
])test('malformed shadow rejected without partial state: '+name,()=>{
 const f=fixture(),v=shadow();change(v);f.local.push(prop(73,v));f.state('Selected',[prop(73,v),prop(6,-16777216)]);f.state('Focused',[prop(73,v),prop(6,-16777216)]);
 assert.equal(f.base().style.innerShadow,undefined);assert.equal(f.selection().status,'unsupported-selection');assert.equal(f.states().states.focused.status,'unsupported-state-style');
});
test('nonzero outer/text spread is unknown, zero/positive inner spread supported; inactive unknown states stay inactive',()=>{
 for(const key of [72,74]){const f=fixture();f.state('Selected',[prop(key,shadow({Spread:1}))]);assert.equal(f.selection().status,'unsupported-selection');}
 const f=fixture();f.state('Selected',[prop(72,shadow({Angle:45}),0x80000000)]);assert.deepEqual(f.selection().selectedStyle,{});
});
test('real observed direct and state positives use only outer shadows; no active inner/text claim',()=>{
 const census=JSON.parse(fs.readFileSync(new URL('../shadow-format-census.json',import.meta.url),'utf8'));
 const serialized=JSON.stringify(census);assert.ok(serialized.includes('430721ebd9e042c7a3bdc69f0a5a7cd3'));assert.ok(serialized.includes('3751bc9a238f4b2ba46edea6cf17d6c2'));
 const f=fixture();f.local.push(prop(72,shadow({OffsetX:0,OffsetY:2,BlurRadius:3,Color:1493172224})));
 assert.deepEqual(f.base().style.outerShadow,{on:true,offsetX:0,offsetY:2,blurRadius:3,color:'#00000059'});
});
