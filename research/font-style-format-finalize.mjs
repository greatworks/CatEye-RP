// Append-only stage verification. Does not rewrite the original census or prior reports.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const initial=JSON.parse(fs.readFileSync('research/font-style-format-evidence.json','utf8'));
const audit=JSON.parse(fs.readFileSync('research/font-style-import-audit.json','utf8'));
const samples=[];
for(const sample of initial.samples) {
  if(sha(sample.file)!==sample.sha256) throw Error('Source changed');
  const decoded=inspectRpObjects(sample.file),styles={},orders=new Map(),italicOwners=[];let count=0,ownerStyles=[];
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.$map)&&p(value,'Type')==='Axure:AttributedString:AxRun') {
      count++;const key=JSON.stringify(p(value,'Style'))??'absent';styles[key]=(styles[key]??0)+1;
      ownerStyles.push(p(value,'Style'));
      const keys=value.$map.map(([key])=>key),order=JSON.stringify(keys);orders.set(order,(orders.get(order)??0)+1);
    }
    for(const child of Object.values(value)) if(child&&typeof child==='object') {
      if(Array.isArray(child)) child.forEach(visit); else visit(child);
    }
  };
  for(const pack of decoded.packages)for(const object of pack.objects??[]) {
    ownerStyles=[];visit(object.properties);
    if(ownerStyles.includes(1)) {
      const member=audit.samples.find(s=>s.sha256===sample.sha256)?.members?.find(w=>w.id===`rp-w-${pack.packageId}-${object.id}`);
      italicOwners.push({packageId:pack.packageId,objectId:object.id,type:object.type,styles:ownerStyles,uniform:ownerStyles.every(v=>v===1),imported:!!member,importedFontStyle:member?.fontStyle??null,...(member?{importedName:member.name}:{})});
    }
  }
  samples.push({file:sample.file,sha256:sample.sha256,count,styles,italicOwners,orders:[...orders].map(([keys,count])=>({keys:JSON.parse(keys),count}))});
}
const targets=initial.targets.map(target=>{
  const props=p(target.selectedStyle.properties,'PropList');
  return {id:target.id,packageId:target.packageId,sourceSha256:target.sourceSha256,label:target.label,selectedStyleId:target.selectedStyle.id,
    count:props.length,overridden:props.filter(v=>p(v,'DOAName')&0x40000000).map(v=>({property:p(v,'DOAName')&0x0fffffff,value:p(v,'Value')})),
    fontStyle:props.filter(v=>(p(v,'DOAName')&0x0fffffff)===1002).map(v=>({raw:p(v,'DOAName'),determined:!!(p(v,'DOAName')&0x80000000),overridden:!!(p(v,'DOAName')&0x40000000),value:p(v,'Value')}))};
});
const files=[
  'research/font-style-format-finalize.mjs',
  'research/font-style-format-evidence.json','research/font-style-format-census.mjs',
  'research/font-style-format-metadata.json','research/font-style-format-property-cil.json','research/font-style-format-conversion-cil.json',
  'research/font-style-format-run-base-cil.json','research/font-style-format-css-cil.json','research/font-style-format-css-lower-cil.json',
  'research/font-style-format-flags-cil.json','research/font-style-format-flag-caller-1.json','research/font-style-format-property-base-cil.json',
  'research/font-style-format-style-full-cil.json','research/font-style-format-native-state-0-cil.json','research/font-style-format-rich-literal-cil.json',
  'research/font-style-runtime-evidence.json','research/font-style-import-audit.json',
  'research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/scripts/read-rp-font-style.test.mjs','tests/import-rp-font-style.test.ts',
];
const result={method:'Static metadata/CIL plus original-file object census. No native DLL or original GUI execution. No complete rich-text recovery.',
  originalAssemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',
  enum:{type:'Axure.Platform.AxFontStyle',typeToken:33558145,signature:'11BA04',values:{None:-1,Normal:0,Italic:1,Oblique:2},productSupported:{0:'normal',1:'italic'}},
  runCarrier:{type:'aSXQ.iSXv',writerToken:100707862,writerMethod:'eIwT',styleCallOffset:306,getter:'OIQV',getterToken:100707827,getterSignature:'200011BA04',field:'NSmW',fieldSignature:'0611BA04',mapping:'Sixth dictionary entry from typed Platform getter, matching all observed twelve-key AxRun maps. Obfuscated literal key was not decrypted; no graphics-enum conversion occurs in this map writer.'},
  samples,targets,
  summary:{property1002Count:initial.summary.fontStyleEntries,property1002Values:initial.summary.fontStyleValues,runCount:samples.reduce((n,s)=>n+s.count,0),runValues:samples.reduce((r,s)=>{for(const [v,n]of Object.entries(s.styles))r[v]=(r[v]??0)+n;return r;},{}),italicOwners:samples.reduce((n,s)=>n+s.italicOwners.length,0),uniformItalicOwners:samples.reduce((n,s)=>n+s.italicOwners.filter(o=>o.uniform).length,0),setWidgetRichTextCalls:initial.summary.functions.SetWidgetRichText,getWidgetRichTextCalls:initial.summary.functions.GetWidgetRichText??0,selectedStyleOverriddenFilteringProvedForIX_STYLES:false},
  validation:{newNodeTests:8,newImporterTests:15,targetedNodePass:39,targetedVitestPass:36,typecheck:'tsc --noEmit passed',fullSuite:'Parent-owned; not run by this evidence agent'},
  importerAuditReference:{file:'research/font-style-import-audit.json',sha256:sha('research/font-style-import-audit.json'),addedWidgets:audit.addedWidgets,addedEvents:audit.addedEvents},
  sources:files.map(file=>({file,sha256:sha(file)})),
};
fs.writeFileSync('research/font-style-format-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({summary:result.summary,targets,rows:samples.map(s=>({file:path.basename(s.file),count:s.count,styles:s.styles})),audit:result.importerAuditReference},null,2));
