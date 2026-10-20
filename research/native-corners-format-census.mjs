import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p, recoverRectanglePath} from './scripts/read-rp-semantics.mjs';

// Research-only inventory. No source bytes are changed and no target code runs.
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const plain=v=>Array.isArray(v?.$map)?Object.fromEntries(v.$map.map(([k,c])=>[k,plain(c)])):Array.isArray(v)?v.map(plain):v;
const props=list=>new Map((list??[]).map(prop=>{const raw=p(prop,'DOAName');return [raw&0x0fffffff,{raw,determined:!!(raw&0x80000000),overridden:!!(raw&0x40000000),value:plain(p(prop,'Value'))}];}));
const identity=decoded=>{const pack=decoded.packages.find(x=>x.path==='DesignDocument'),objects=new Map((pack?.objects??[]).map(o=>[o.id,o]));const doc=objects.get(pack?.rootId),sheet=objects.get(p(doc?.properties,'StyleSheet')?.$reference),style=objects.get(p(sheet?.properties,'DefaultStyle')?.$reference);return {id:p(style?.properties,'Id')?.$guid,libraryId:p(style?.properties,'LibraryId')?.$guid,source:{packageId:pack?.packageId,styleObjectId:style?.id,properties:Object.fromEntries([...props(p(style?.properties,'PropList'))].filter(([k])=>[71,81].includes(k)))}};};
// Mirrors the existing reader's exact cache identity selection, not a claim to
// reimplement all native effective-provider semantics.
function chain(style,root,defaultId){
 const result=new Map(),sources=[];const merge=(list,source)=>{for(const [key,value]of props(list))result.set(key,{...value,source});sources.push(source);};
 const caches=p(p(root?.properties,'StyleCache'),'Styles'),match=p(style?.properties,'MatchInfo'),matchId=p(match,'Id')?.$guid,libraryId=p(match,'LibraryId')?.$guid,base=props(p(style?.properties,'PropList')).get(0)?.value?.$guid;
 let complete=false;
 if(Array.isArray(caches)&&defaultId.id&&defaultId.libraryId&&matchId&&libraryId&&base===matchId){
  const lookup=(id,lib)=>caches.filter(c=>p(p(c,'Info'),'Id')?.$guid===id&&p(p(c,'Info'),'LibraryId')?.$guid===lib);
  const d=lookup(defaultId.id,defaultId.libraryId),b=lookup(matchId,libraryId);
  if(d.length===1&&b.length===1){merge(p(d[0],'Props'),{kind:'cached-document-default',...defaultId});merge(p(b[0],'Props'),{kind:'cached-matched-base',id:matchId,libraryId});complete=true;}
 }
 merge(p(style?.properties,'PropList'),{kind:'local-object-style',id:style?.id});
 return {result,complete,sources};
}
const report={capturedAt:new Date().toISOString(),method:'Read-only native object inventory; current-reader cache identity policy is labelled separately from native provider evidence.',samples:[],occurrences:[],widgets:[],totals:{properties:{71:{},81:{}},carrierKinds:{},shapeTypes:{},shape0:0,recognizedRectangles:0,rectangleComparisons:{},activeStateCornerProperties:0,adaptiveCornerProperties:0}};
const sourceList='research/rotation-import-audit.json';
for(const sample of read(sourceList).samples){
 if(sha(sample.file)!==sample.sha256)throw Error('Native sample hash mismatch: '+sample.file);
 const decoded=inspectRpObjects(sample.file),defaultId=identity(decoded),summary={file:sample.file,sha256:sample.sha256,defaultStyle:defaultId,properties:{71:{},81:{}},shape0:0,recognizedRectangles:0};
 for(const pack of decoded.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),root=objects.get(pack.rootId),directOwners=new Map(),states=new Map(),adaptive=new Map();
  const append=(m,id,v)=>{if(id)m.set(id,[...(m.get(id)??[]),v]);};
  for(const o of objects.values()){
   append(directOwners,p(o.properties,'MyStyle')?.$reference,{id:o.id,type:o.type,name:p(p(o.properties,'name-block'),'text')??null});
   if(o.type==='Axure:Style')for(const [key,entry]of props(p(o.properties,'PropList')))if(key===21)for(const [state,ref]of Object.entries(entry.value??{}))append(states,ref?.$reference,{styleId:o.id,state});
   for(const field of ['AdaptiveStyles','AdaptiveRepeaterStyles']){const raw=p(o.properties,field);if(Array.isArray(raw))for(let i=0;i<raw.length;i+=2)append(adaptive,raw[i+1]?.$reference,{ownerId:o.id,ownerType:o.type,field,viewId:raw[i]?.$guid});}
  }
  for(const o of objects.values()){
   const walk=(v,where)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v.$map)){
    const raw=p(v,'DOAName'),key=Number.isInteger(raw)?raw&0x0fffffff:null;
    if(key===71||key===81){const value=plain(p(v,'Value')),encoded=JSON.stringify(value),own=directOwners.get(o.id)??[],state=states.get(o.id)??[],ad=adaptive.get(o.id)??[];
     const kind=where.includes('.StyleCache.')?'cache':own.length?'direct-MyStyle':ad.length?'adaptive-local':state.length?'interaction-state':o.type==='Axure:Style'?'other-style':'other';
     const r={sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,version:pack.version,objectId:o.id,objectType:o.type,where,key,raw,determined:!!(raw&0x80000000),overridden:!!(raw&0x40000000),value,kind,owners:own,states:state,adaptive:ad};
     report.occurrences.push(r);report.totals.properties[key][encoded]=(report.totals.properties[key][encoded]??0)+1;summary.properties[key][encoded]=(summary.properties[key][encoded]??0)+1;report.totals.carrierKinds[kind]=(report.totals.carrierKinds[kind]??0)+1;
     if(state.length&&r.determined&&r.overridden)report.totals.activeStateCornerProperties++;
     if(ad.length)report.totals.adaptiveCornerProperties++;
    }
    for(const [k,c]of v.$map)walk(c,where+'.'+k);
   }else if(Array.isArray(v))v.forEach((c,i)=>walk(c,where+'['+i+']'));};walk(o.properties,'properties');
   if(!o.type.startsWith('Axure:DiagramObject:'))continue;
   const style=objects.get(p(o.properties,'MyStyle')?.$reference),direct=props(p(style?.properties,'PropList')),eff=chain(style,root,defaultId),e=eff.result;
   const shape=p(o.properties,'Shape'),paths=p(o.properties,'ControlPoints'),size=e.get(105)?.value;
   if(shape!==undefined)report.totals.shapeTypes[shape]=(report.totals.shapeTypes[shape]??0)+1;
   let rect=null;if(shape===0){report.totals.shape0++;summary.shape0++;rect=recoverRectanglePath(paths,size?.Width,size?.Height);if(rect){report.totals.recognizedRectangles++;summary.recognizedRectangles++;}}
   if(!e.has(71)&&!e.has(81)&&shape!==0)continue;
   const r={sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,version:pack.version,id:o.id,type:o.type,name:p(p(o.properties,'name-block'),'text')??null,shape,styleId:style?.id,cacheChainComplete:eff.complete,local:{},effective:{},size,location:e.get(101)?.value,pathContours:paths?.length,vertices:paths?.map(c=>c.length),pathDerivedCornerRadii:rect?.cornerRadii??null};
   for(const key of [71,81,80,15]){if(direct.has(key))r.local[key]=direct.get(key);if(e.has(key))r.effective[key]=e.get(key);}
   if(rect){
    const radius=e.get(71)?.value,mask=e.get(81)?.value;
    // Comparison only: mask*uniform and simple half-size clamp are not asserted
    // to reproduce native stroke/fill eligibility or radius ceiling rules.
    if(typeof radius==='number'&&Number.isFinite(radius)&&Number.isInteger(mask)&&mask>=0&&mask<=15){
     const expected=[1,2,4,8].map(bit=>mask&bit?radius:0),halfClamped=expected.map(v=>Math.min(v,Math.min(size.Width,size.Height)/2)),same=a=>a.every((v,i)=>Math.abs(v-rect.cornerRadii[i])<1e-6);
     r.comparison={rawUniformMask:expected,naiveHalfClamped:halfClamped,classification:same(expected)?'same-raw-uniform-mask':same(halfClamped)?'same-naive-half-clamp':'different-from-both'};
     const k=r.comparison.classification;report.totals.rectangleComparisons[k]=(report.totals.rectangleComparisons[k]??0)+1;
    }else report.totals.rectangleComparisons.unresolved=(report.totals.rectangleComparisons.unresolved??0)+1;
   }
   report.widgets.push(r);
  }
 }
 report.samples.push(summary);
}
report.sources=[sourceList,'research/native-corners-format-census.mjs','research/scripts/read-rp-container.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/native-corners-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(({file,properties,shape0,recognizedRectangles})=>({file:path.basename(file),properties,shape0,recognizedRectangles})),partialMaskOwners:report.widgets.filter(w=>w.effective[81]?.value!==15&&w.effective[81]!==undefined).map(w=>({sample:w.sample,id:w.id,shape:w.shape,mask:w.effective[81],radius:w.effective[71],pathRadii:w.pathDerivedCornerRadii})),mismatches:report.widgets.filter(w=>w.comparison?.classification==='different-from-both').map(({sample,id,shape,effective,pathDerivedCornerRadii,size,comparison})=>({sample,id,shape,effective,pathDerivedCornerRadii,size,comparison}))},null,2));
