import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {inspectRpSemantics,recoverStyle,property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const targets=new Set(['81407e7110764806ab119ed3a69a5ace','f5ba5ff93b4d4b5c8467778d88421fc4']);
const report={method:'Original package census and static ECMA-335 evidence; no vendor execution or product changes',samples:[],fontStyleProperties:[],targets:[],functions:[]};
const fontStyles=(value,where,output)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value.$map)&&Number.isInteger(p(value,'DOAName'))&&(p(value,'DOAName')&0x0fffffff)===1002)output.push({where,raw:p(value,'DOAName'),value:p(value,'Value')});for(const [key,child]of Object.entries(value))if(child&&typeof child==='object')fontStyles(child,where+'.'+key,output);};
for(const sample of samples){const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw Error('Original changed');report.samples.push({file:sample.file,sha256:sample.sha256});
 let semantics;
 for(const pack of decoded.packages){const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),resolve=r=>objects.get(r?.$reference);
  for(const object of objects.values()){
   const entries=[];fontStyles(object.properties,'properties',entries);for(const entry of entries)report.fontStyleProperties.push({sample:path.basename(sample.file),packageId:pack.packageId,sourcePartSha256:pack.sha256,objectId:object.id,objectType:object.type,...entry});
   if(targets.has(object.id)){
    semantics??=inspectRpSemantics(sample.file);const diagram=semantics.diagrams.find(d=>d.packageId===pack.packageId),stored=diagram.widgets.find(w=>w.id===object.id),root=objects.get(diagram.rootId),style=resolve(p(object.properties,'MyStyle')),identity={id:stored.styleRecovery.defaultStyleId,libraryId:stored.styleRecovery.defaultStyleLibraryId};
    const base=recoverStyle(object,style,root,identity,resolve,stored.typeCandidate,false),selected=recoverStyle(object,style,root,identity,resolve,stored.typeCandidate,true),selectedStyle=resolve(base.selectedStyleReference);
    report.targets.push({sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,id:object.id,label:stored.label,widget:object,localStyle:style,baseFontStyle:base.unknown.filter(p=>p.property==='PName:1002'),selectedFontStyle:selected.unknown.filter(p=>p.property==='PName:1002'),selectedStyle,baseStyle:base.style,baseProvenance:base.provenance,selectionRecovery:stored.selectionRecovery});
   }
   if(object.type==='Axure:Expr:FCall'&&['GetWidgetRichText','SetWidgetRichText'].includes(p(object.properties,'function-name'))){
    const args=(p(object.properties,'args')??[]).map(resolve),detail=args.map(a=>a?.type==='Axure:Expr:DiagramObjectPathLiteral'?{argument:a,targetPath:resolve(p(a.properties,'value'))}:a?.type==='Axure:Expr:RichTextLiteral'?{argument:a,refs:(a.properties.$map??[]).map(([key,value])=>({key,value,resolved:resolve(value)}))}:{argument:a});
    const block=[...objects.values()].find(o=>o.type==='Axure:Expr:Block'&&(p(o.properties,'subexpressions')??[]).some(r=>r.$reference===object.id));
    const action=block?[...objects.values()].find(o=>p(o.properties,'action')?.$reference===block.id):undefined;
    report.functions.push({sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,call:object,args:detail,block,action});
   }
  }
 }
}
report.summary={fontStyleEntries:report.fontStyleProperties.length,fontStyleValues:report.fontStyleProperties.reduce((a,e)=>(a[JSON.stringify(e.value)]=(a[JSON.stringify(e.value)]??0)+1,a),{}),targets:report.targets.map(t=>({id:t.id,base:t.baseFontStyle,selected:t.selectedFontStyle})),functions:report.functions.reduce((a,e)=>(a[p(e.call.properties,'function-name')]=(a[p(e.call.properties,'function-name')]??0)+1,a),{}),argumentTypes:[...new Set(report.functions.map(e=>e.args.map(a=>a.argument?.type).join(',')))]};
report.sources=['research/font-style-format-census.mjs','research/scripts/read-rp-semantics.mjs','research/font-style-format-metadata.json','research/font-style-format-property-cil.json','research/font-style-format-conversion-cil.json','research/font-style-format-rich-literal-cil.json'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/font-style-format-evidence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
