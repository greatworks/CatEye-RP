import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {recoverRpSemantics,recoverStyle,property as p} from './read-rp-semantics.mjs';
const sample=JSON.parse(fs.readFileSync(new URL('../rp-form-candidates-evidence.json',import.meta.url))).samples.find(s=>s.file.endsWith('Sample form patterns.rplib'));
const original=inspectRpObjects(sample.file);
const PAGE='784fffad1a36482594f6f965760990d6',LABEL='521d7ce3a85d4cf0a40f3934f8677b75',DEFAULT='627587b6038d43cca051c114ac41ad32',LIBRARY='61e3924b25c44f18a45c876a031974fd';
const source={...original,packages:original.packages.filter(p=>p.path==='DesignDocument'||p.packageId===PAGE)};
const set=(map,key,value)=>{const pair=map.$map.find(([k])=>k===key);if(pair)pair[1]=value;else map.$map.push([key,value]);};
const remove=(map,key)=>{map.$map=map.$map.filter(([k])=>k!==key);};
function fixture(){
 const data=structuredClone(source),document=data.packages.find(p=>p.path==='DesignDocument'),pack=data.packages.find(p=>p.packageId===PAGE);
 const docs=new Map(document.objects.map(o=>[o.id,o])),objects=new Map(pack.objects.map(o=>[o.id,o]));
 const doc=docs.get(document.rootId),sheet=docs.get(p(doc.properties,'StyleSheet').$reference),def=docs.get(p(sheet.properties,'DefaultStyle').$reference);
 const root=objects.get(pack.rootId),widget=objects.get(LABEL),style=objects.get(p(widget.properties,'MyStyle').$reference),caches=p(p(root.properties,'StyleCache'),'Styles');
 return{data,document,pack,doc,sheet,def,root,widget,style,caches,defaultCache:caches.find(c=>p(p(c,'Info'),'Id').$guid===DEFAULT),baseCache:caches.find(c=>p(p(c,'Info'),'Id').$guid===p(p(style.properties,'MatchInfo'),'Id').$guid),objects};
}
const recover=f=>recoverRpSemantics(f.data).diagrams.find(d=>d.packageId===PAGE).widgets.find(w=>w.id===LABEL);
const localOnly=f=>{const w=recover(f);assert.equal(w.status,'stored-fields-recovered');assert.equal(w.styleRecovery.cacheChainComplete,false);assert.equal(w.styleRecovery.style.fontFamily,'Roboto');assert.equal(w.styleRecovery.style.color,'#00000089');assert.equal(w.styleRecovery.style.textPadding,undefined);assert.equal(w.styleRecovery.style.lineHeight,undefined);assert.equal(w.styleRecovery.resolvedGeometry,null);return w;};

test('real library captions recover their own default identity without changing stored geometry or local font/color',()=>{
 assert.equal(original.fileSha256,'1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
 const f=fixture(),before=JSON.stringify(f.data),semantic=recoverRpSemantics(f.data),page=semantic.diagrams.find(d=>d.packageId===PAGE);
 assert.equal(semantic.defaultStyleIdentityRecovery.provenance.styleObjectId,f.def.id);
 const captions=[['521d7ce3a85d4cf0a40f3934f8677b75','First name*',20,20,78],['dd95d9e7839f43bb811c83f46238249a','Last name*',330,20,76],['0f045efac5b24769857e5ac8f794f50a','Email address*',20,125,101],['c1b87b64b81c4dcab59309167dc6b268','Phone number',20,230,97],['c2a9b16835bd4d008aaf88e0b6b5ee2f','Date of birth',20,335,83]];
 for(const[id,text,x,y,width]of captions){const w=page.widgets.find(w=>w.id===id),r=w.styleRecovery;
  assert.equal(w.text.text,text);assert.deepEqual(w.storedGeometry.location.value,{X:x,Y:y});assert.deepEqual(w.storedGeometry.size.value,{Width:width,Height:16});assert.equal(w.storedGeometry.isComputedLayout,false);
  assert.equal(r.cacheChainComplete,true);assert.equal(r.defaultStyleId,DEFAULT);assert.equal(r.defaultStyleLibraryId,LIBRARY);
  assert.deepEqual(r.style.textPadding,[0,0,0,0]);assert.equal(r.style.verticalAlign,'top');assert.equal(r.style.lineHeight,'normal');assert.equal(r.style.fill,'#ffffff00');assert.equal(r.style.strokeWidth,0);
  assert.equal(r.style.fontFamily,'Roboto');assert.equal(r.style.fontSize,14);assert.equal(r.style.color,'#00000089');assert.equal(r.provenance.fontFamily.kind,'local-object-style');assert.equal(r.provenance.color.kind,'local-object-style');
  assert.equal(r.provenance.lineHeight.nativeFontMetricsVerified,false);assert.equal(r.provenance.stroke.libraryId,LIBRARY);assert.equal(r.provenance.stroke.identitySource,undefined);
 }
 assert.equal(JSON.stringify(f.data),before);
});

for(const key of ['Id','LibraryId'])test(`missing native DefaultStyle.${key} never falls back to zero-library matching`,()=>{const f=fixture();remove(f.def.properties,key);const w=localOnly(f);assert.equal(w.styleRecovery.defaultStyleId,null);assert.match(recoverRpSemantics(f.data).semanticFailures[0].reason,/explicit GUID/);});
test('invalid or wrong-carrier native default GUID fields cannot masquerade as identity',()=>{for(const key of ['Id','LibraryId'])for(const value of [null,'00000000000000000000000000000000',{$guid:'bad'},{$reference:LIBRARY,referenceTag:3},{$guid:LIBRARY,referenceTag:3}]){const f=fixture();set(f.def.properties,key,value);localOnly(f);}});
test('StyleSheet and DefaultStyle links require exact local reference tags and target types',()=>{for(const ownerKey of ['sheet','default'])for(const mutation of ['missing','tag','zero','guid-carrier','extra','wrong-type']){
 const f=fixture(),owner=ownerKey==='sheet'?f.doc:f.sheet,key=ownerKey==='sheet'?'StyleSheet':'DefaultStyle',ref=p(owner.properties,key);
 if(mutation==='missing')remove(owner.properties,key);else if(mutation==='tag')ref.referenceTag=19;else if(mutation==='zero')ref.$reference='0'.repeat(32);else if(mutation==='guid-carrier')set(owner.properties,key,{$guid:ref.$reference});else if(mutation==='extra')ref.name='Axure:Style';else(ownerKey==='sheet'?f.sheet:f.def).type='Axure:Unknown';localOnly(f);
}});
test('duplicate document objects cannot pick an arbitrary default identity',()=>{for(const object of ['doc','sheet','def']){const f=fixture();f.document.objects.push(structuredClone(f[object]));localOnly(f);}});
test('duplicate DesignDocument packages cannot pick an arbitrary default identity',()=>{const f=fixture();f.data.packages.push(structuredClone(f.document));localOnly(f);});
test('duplicate native identity properties fail closed while preserving local appearance',()=>{for(const key of ['Id','LibraryId']){const f=fixture();f.def.properties.$map.push([key,structuredClone(p(f.def.properties,key))]);localOnly(f);}});
test('missing default cache cannot turn a matched named cache into a flattened complete chain',()=>{const f=fixture();f.caches.splice(f.caches.indexOf(f.defaultCache),1);localOnly(f);});
test('duplicate exact default and matched-base cache identities are independently ambiguous',()=>{for(const key of ['defaultCache','baseCache']){const f=fixture();f.caches.push(structuredClone(f[key]));localOnly(f);}});
test('same default style Id under another LibraryId does not match the native document identity',()=>{for(const library of ['0'.repeat(32),'f'.repeat(32)]){const f=fixture();set(p(f.defaultCache,'Info'),'LibraryId',{$guid:library});localOnly(f);}});
test('wrong-library duplicate cache is ignored only when one exact identity remains',()=>{const f=fixture(),wrong=structuredClone(f.defaultCache);set(p(wrong,'Info'),'LibraryId',{$guid:'0'.repeat(32)});f.caches.push(wrong);assert.equal(recover(f).styleRecovery.cacheChainComplete,true);});
test('matched base retains exact library and explicit base-Id agreement requirements',()=>{for(const mutation of ['library','base-id','missing-match','missing-base','wrong-cache-guid']){const f=fixture();if(mutation==='library')set(p(f.baseCache,'Info'),'LibraryId',{$guid:'0'.repeat(32)});else if(mutation==='base-id')set(p(f.style.properties,'PropList').find(v=>(p(v,'DOAName')&0x0fffffff)===0),'Value',{$guid:'f'.repeat(32)});else if(mutation==='missing-match')remove(f.style.properties,'MatchInfo');else if(mutation==='missing-base')f.caches.splice(f.caches.indexOf(f.baseCache),1);else set(p(f.baseCache,'Info'),'Id',{$guid:p(p(f.baseCache,'Info'),'Id').$guid,referenceTag:3});localOnly(f);}});
test('named base then local precedence stays explicit with nonzero-library defaults',()=>{const f=fixture(),prop=p(f.style.properties,'PropList');prop.push({$map:[['DOAName',15|0xc0000000],['Value',3]]});const r=recover(f).styleRecovery;assert.equal(r.style.strokeWidth,3);assert.equal(r.provenance.strokeWidth.kind,'local-object-style');assert.deepEqual(r.style.textPadding,[0,0,0,0]);assert.equal(r.provenance.textPadding.sides[0].kind,'cached-matched-base');});
test('public helper string identity keeps zero-library compatibility but object identity never supplies a missing library',()=>{const f=fixture();set(p(f.defaultCache,'Info'),'LibraryId',{$guid:'0'.repeat(32)});const args=[f.widget,f.style,f.root],tail=[ref=>f.objects.get(ref?.$reference),{type:'box'}];assert.equal(recoverStyle(...args,DEFAULT,...tail).cacheChainComplete,true);assert.equal(recoverStyle(...args,{id:DEFAULT},...tail).cacheChainComplete,false);assert.equal(recoverStyle(...args,{id:DEFAULT,libraryId:LIBRARY},...tail).cacheChainComplete,false);});
