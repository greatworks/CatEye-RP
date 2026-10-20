import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {inspectRpSemantics,property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const prior=JSON.parse(fs.readFileSync('research/font-style-format-verification.json','utf8'));
const plain=value=>value?.$map?Object.fromEntries(value.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(value)?value.map(plain):value;
const report={method:'Read-only original object/semantic census, no vendor DLL execution',samples:[],owners:[],values:{block:{},attributedString:{},paragraph:{},run:{}},keys:{block:[],attributedString:[],paragraph:[],run:[]}};
const tally=(kind,value,skip=[])=>{
  for(const [key,v]of Object.entries(value??{})) {
    if(!report.keys[kind].includes(key))report.keys[kind].push(key);
    if(skip.includes(key))continue;
    const encoded=JSON.stringify(v);report.values[kind][key]??={};report.values[kind][key][encoded]=(report.values[kind][key][encoded]??0)+1;
  }
};
for(const sample of prior.samples) {
  if(!sample.italicOwners.length)continue;
  if(sha(sample.file)!==sample.sha256)throw Error('Source changed');
  const decoded=inspectRpObjects(sample.file),semantics=inspectRpSemantics(sample.file);
  report.samples.push({file:sample.file,sha256:sample.sha256});
  for(const owner of sample.italicOwners) {
    const pack=decoded.packages.find(p=>p.packageId===owner.packageId),objects=new Map(pack.objects.map(o=>[o.id,o])),object=objects.get(owner.objectId),properties=object.properties;
    const diagram=semantics.diagrams.find(d=>d.packageId===owner.packageId),recovered=diagram?.widgets.find(w=>w.id===owner.objectId);
    const block=plain(p(properties,'RichTextBlock')),text=block?.['attributed-string'];
    tally('block',block,['attributed-string']);tally('attributedString',text,['Paragraphs']);
    const paragraphs=text?.Paragraphs??[];
    for(const paragraph of paragraphs) {tally('paragraph',paragraph,['Inlines']);for(const run of paragraph.Inlines??[])tally('run',run,['Text']);}
    const myStyle=objects.get(p(properties,'MyStyle')?.$reference),root=objects.get(pack.rootId);
    const nativeRunText=paragraphs.map(p=>p.Inlines.map(r=>r.Text).join(''));
    report.owners.push({...owner,file:path.basename(sample.file),sourceSha256:sample.sha256,sourcePartSha256:pack.sha256,label:recovered?.label,
      block,paragraphCount:paragraphs.length,runCount:paragraphs.reduce((n,p)=>n+p.Inlines.length,0),nativeRunText,
      textControlCounts:nativeRunText.reduce((r,t)=>{for(const [name,re]of Object.entries({CR:/\r/g,LF:/\n/g,TAB:/\t/g}))r[name]=(r[name]??0)+(t.match(re)?.length??0);return r;},{}),
      nativeStyle:myStyle,styleCache:p(root?.properties,'StyleCache'),recovery:recovered?{text:recovered.text,style:recovered.styleRecovery,selection:recovered.selectionRecovery}:null});
  }
}
report.summary={owners:report.owners.length,imported:report.owners.filter(o=>o.imported).length,paragraphs:report.owners.reduce((n,o)=>n+o.paragraphCount,0),runs:report.owners.reduce((n,o)=>n+o.runCount,0),multipleParagraphOwners:report.owners.filter(o=>o.paragraphCount>1).length,inlineTextControlOwners:report.owners.filter(o=>Object.values(o.textControlCounts).some(n=>n>0)).map(o=>({id:o.objectId,counts:o.textControlCounts})),keys:report.keys,values:report.values};
report.sources=['research/rich-text-format-census.mjs','research/font-style-format-verification.json','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/rich-text-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({owners:report.summary.owners,imported:report.summary.imported,paragraphs:report.summary.paragraphs,runs:report.summary.runs,keys:report.keys},null,2));
