// Read-only extraction of the shipped Default library, not target execution.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { property, inspectRpSemantics } from './scripts/read-rp-semantics.mjs';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const oracleFile='research/selection-layout-import-origin-checked.json';
const oracle=JSON.parse(fs.readFileSync(oracleFile,'utf8'));
const sample=oracle.samples.find(s=>s.file.endsWith('Default.rplib'));
assert.equal(hash(sample.file),sample.sha256);
const raw=inspectRpObjects(sample.file), semantic=inspectRpSemantics(sample.file);
const properties=map=>Object.fromEntries(map?.$map??[]);
const styleEntries=arr=>(arr??[]).map(p=>({key:property(p,'DOAName')&0x3fffffff,rawDoaName:property(p,'DOAName'),value:property(p,'Value')}));
const records=[];
const doc=raw.packages.find(p=>p.path==='DesignDocument');
const docObjects=new Map(doc.objects.map(o=>[o.id,o]));
const docRoot=docObjects.get(doc.rootId),sheet=docObjects.get(property(docRoot.properties,'StyleSheet').$reference);
const defaultStyle=docObjects.get(property(sheet.properties,'DefaultStyle').$reference);
const defaultInfo={id:property(defaultStyle.properties,'Id').$guid,libraryId:property(defaultStyle.properties,'LibraryId').$guid};
for(const pack of raw.packages){
 const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),root=objects.get(pack.rootId);
 for(const widget of pack.objects??[]){
  if(!['Axure:DiagramObject:Checkbox','Axure:DiagramObject:RadioButton'].includes(widget.type))continue;
  const style=objects.get(property(widget.properties,'MyStyle').$reference);
  const local=styleEntries(property(style.properties,'PropList'));
  const match=properties(property(style.properties,'MatchInfo'));
  const caches=property(property(root.properties,'StyleCache'),'Styles');
  const matchId=match.Id.$guid,matchLibraryId=match.LibraryId.$guid;
  const candidates=(caches??[]).map(c=>({info:properties(property(c,'Info')),props:styleEntries(property(c,'Props'))}));
  const def=candidates.filter(c=>c.info.Id.$guid===defaultInfo.id&&c.info.LibraryId.$guid===defaultInfo.libraryId);
  const base=candidates.filter(c=>c.info.Id.$guid===matchId&&c.info.LibraryId.$guid===matchLibraryId);
  assert.equal(def.length,1);assert.equal(base.length,1);
  const chain=[{kind:'cached-document-default',info:def[0].info,props:def[0].props},{kind:'cached-matched-base',info:base[0].info,props:base[0].props},{kind:'local-object-style',objectId:style.id,props:local}];
  const effective=new Map();
  for(const source of chain)for(const prop of source.props){
   if((prop.rawDoaName&0xc0000000)!==(0xc0000000|0))continue;
   effective.set(prop.key,{...prop,source:{...source,props:undefined}});
  }
  records.push({packageId:pack.packageId,packagePath:pack.path,packageSha256:pack.sha256,rootId:pack.rootId,rootType:root.type,
   rootFields:properties(root.properties),widget,style,defaultInfo,chain,effective:[...effective.values()],
   warning:'Stored template snapshot. Placement and font-layout work after insertion are not established by the stored rectangle.'});
 }
}
assert.equal(records.length,2);
const output={createdAt:new Date().toISOString(),scope:'Actual shipped Default.rplib raw objects and complete style-cache provenance, contrasted with prior admitted document',originalDllExecuted:false,originalGuiCompared:false,
 sources:[sample.file,oracleFile,'research/scripts/read-rp-container.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs',import.meta.filename].map(file=>({file,sha256:hash(file)})),
 defaultInfo,records,semantic,previousImportedDocument:sample.document};
fs.writeFileSync('research/selection-creation-template-evidence.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
assert.equal(hash(sample.file),sample.sha256);
console.log(JSON.stringify({records:records.length,sourceSha256:sample.sha256,outputSha256:hash('research/selection-creation-template-evidence.json'),widgets:records.map(r=>({id:r.widget.id,type:r.widget.type,packageId:r.packageId,props:properties(r.widget.properties)}))},null,2));
