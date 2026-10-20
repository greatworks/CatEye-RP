import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverAuthorResizePins,recoverLocalAdaptiveStyles} from './read-rp-semantics.mjs';
const id=n=>n.toString(16).padStart(32,'0'),map=value=>({$map:Object.entries(value)});
const prop=(key,value,flags=3)=>map({DOAName:key|(flags<<30),Value:value});
function fixture(props=[]){
 const cache=(n,props)=>map({Info:map({Id:{$guid:id(n)},LibraryId:{$guid:id(0)}}),Props:props});
 const style={id:id(2),type:'Axure:Style',properties:map({All:false,PropList:[prop(0,{$guid:id(4)}),...props],MatchInfo:map({Id:{$guid:id(4)},LibraryId:{$guid:id(0)}})})};
 const defaults=[prop(106,0),prop(107,0),prop(108,false),prop(109,false)],caches=[cache(3,defaults),cache(4,[])];
 return {widget:{id:id(1),type:'Axure:DiagramObject:VectorShape',properties:map({IsContained:false,AdaptiveStyles:[]})},style,caches,
  root:{properties:map({StyleCache:map({Styles:caches})})},version:[11,0,0,0]};
}
const read=f=>recoverAuthorResizePins(f.widget,f.style,f.root,id(3),f.version);
const fields=r=>Object.fromEntries(r.fields.map(f=>[f.key,f.value]));
for(const [key,values]of [[106,[0,1,4,5,256]],[107,[0,2,8,10,512]],[108,[false,true]],[109,[false,true]]]){
 for(const value of values)test(`normal author pin P${key}=${value} preserves exact carrier and source`,()=>{
  const f=fixture([prop(key,value)]),before=JSON.stringify(f),r=read(f);
  assert.equal(r.status,'supported-author-resize-pins');assert.equal(fields(r)[key],value);
  assert.deepEqual(r.fields.find(f=>f.key===key).source,{kind:'local-object-style',objectId:id(2)});
  assert.equal(JSON.stringify(f),before);
 });
}
test('ordinary zero/false caches alone do not materialize fields in legacy documents',()=>assert.equal(read(fixture()),undefined));
test('inactive direct pin does not hide a matched-base pin',()=>{
 const f=fixture([prop(106,0,2)]);f.caches[1].$map[1][1].push(prop(106,256));
 const r=read(f);assert.equal(fields(r)[106],256);assert.equal(r.fields[0].source.kind,'cached-matched-base');
 assert.deepEqual(r.inactive,[{key:106,rawDoaName:106|0x80000000,value:0}]);
});
test('native global default fills missing cached fixed-size keys',()=>{
 const f=fixture([prop(106,1)]);f.caches[0].$map[1][1].splice(2,2);
 const r=read(f);assert.equal(fields(r)[108],false);assert.equal(fields(r)[109],false);
 assert.deepEqual(r.fields[2].source,{kind:'native-default-table',methodToken:100717199});
});
test('explicit unlinked direct MyStyle falls back to native defaults without a fictitious cache chain',()=>{
 const f=fixture([prop(106,1),prop(109,true)]);
 f.style.properties=map({All:false,PropList:[prop(106,1),prop(109,true)]});
 const r=read(f);assert.equal(r.status,'supported-author-resize-pins');assert.equal(r.cacheChainComplete,false);
 assert.deepEqual(r.unlinkedStyle,{all:false,matchInfoAbsent:true,basePropertyAbsent:true});
 assert.deepEqual(fields(r),{106:1,107:0,108:false,109:true});
 assert.equal(r.fields[1].source.kind,'native-default-table');
});
test('nonzero matched-base pin can be recovered with no local pin slot',()=>{
 const f=fixture();f.caches[1].$map[1][1].push(prop(107,512));assert.equal(fields(read(f))[107],512);
});
for(const [key,value]of [[106,2],[107,1],[106,257],[107,514],[106,'4'],[106,null],[108,1],[109,'false']])test(`reject invalid pin ${key}/${JSON.stringify(value)}`,()=>{
 assert.equal(read(fixture([prop(key,value)])).status,'unsupported-author-resize-pins');
});
for(const mutation of ['duplicate','indeterminate','reserved-flag','unknown-chain','wrong-library','wrong-version','invalid-cache'])test(`reject unresolved pin carrier: ${mutation}`,()=>{
 const f=fixture([prop(106,4)]);
 if(mutation==='duplicate')f.style.properties.$map[1][1].push(prop(106,1));
 if(mutation==='indeterminate')f.style.properties.$map[1][1][1]=prop(106,4,1);
 if(mutation==='reserved-flag')f.style.properties.$map[1][1][1]=prop(106|0x10000000,4);
 if(mutation==='unknown-chain')f.root.properties=map({});
 if(mutation==='wrong-library')f.caches[1].$map[0][1].$map[1][1]={$guid:id(99)};
 if(mutation==='wrong-version')f.version=[10,0,4,0];
 if(mutation==='invalid-cache')f.caches[0].$map[1][1][1]=prop(107,999);
 assert.equal(read(f).status,'unsupported-author-resize-pins');
});
test('Layer constraints remain in the separately validated membership carrier',()=>{
 const f=fixture([prop(106,4)]);f.widget.type='Axure:DiagramObject:Layer';assert.equal(read(f),undefined);
});
function adaptive(props,asState=false,version=[11,0,0,0]){
 const f=fixture(),local={id:id(8),type:'Axure:Style',properties:map({All:false,PropList:props})};
 const state={id:id(9),type:'Axure:Style',properties:map({All:false,PropList:props})};
 if(asState)local.properties=map({All:false,PropList:[prop(21,map({Selected:{$reference:state.id,referenceTag:3}}))]});
 f.widget.properties.$map[1][1]=[{$guid:id(7)},{$reference:local.id,referenceTag:3}];
 return recoverLocalAdaptiveStyles(f.widget,f.style,f.root,id(3),ref=>ref?.$reference===local.id?local:ref?.$reference===state.id?state:undefined,{type:'box'},version);
}
test('adaptive pin axes, fixed dimensions and paint remain independent sparse properties',()=>{
 const r=adaptive([prop(106,256),prop(108,false),prop(5,true)]);
 assert.equal(r.status,'decoded-adaptive-styles',r.reason);
 assert.deepEqual(r.entries[0].patch,{style:{pinHorizontal:'center',fixedHeight:false,underline:true}});
});
test('explicit None and false survive while inactive pins do not create declarations',()=>{
 assert.deepEqual(adaptive([prop(106,0),prop(109,false),prop(107,512,2)]).entries[0].patch,{style:{pinHorizontal:'none',fixedWidth:false}});
});
test('interaction state cannot smuggle author resize constraints',()=>assert.equal(adaptive([prop(106,1)],true).status,'unsupported-adaptive-styles'));
test('unwitnessed package version cannot acquire adaptive pins',()=>assert.equal(adaptive([prop(106,1)],false,[10,0,4,0]).status,'unsupported-adaptive-styles'));
test('inactive malformed pins and reserved flag bits cannot hide inside an accepted adaptive carrier',()=>{
 for(const p of [prop(106,999,2),prop(109,1,2),prop(106|0x10000000,0),prop(107|0x10000000,0,2)]){
  assert.equal(adaptive([p]).status,'unsupported-adaptive-styles');
 }
});
