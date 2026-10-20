import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { inspectRpSemantics, property as p } from './scripts/read-rp-semantics.mjs';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const count = (map,key) => { map[key] = (map[key] ?? 0) + 1; };
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip = file => stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts'));
const docModule=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(docModule)).replace("'./page-tree-core'",JSON.stringify(tree))));
const {parseDocument,serializeDocument}=await import(docModule);
const flatten=widgets=>widgets.flatMap(w=>[w,...(w.states??[]).flatMap(s=>flatten(s.widgets))]);
const inputs = JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const nativeRoot = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/';
const sourceFiles = ['research/rp-form-candidates-evidence.json','research/rp-interaction-PlainTextObject-cil.json','research/rp-error-hint-cil-excerpts.json','research/rp-interaction-IxEventType-cil.json','research/rp-interaction-styles-enum.json','research/rp-error-hint-audit.mjs','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','research/scripts/read-rp-error-hint.test.mjs','tests/import-rp-error-hint.test.ts','src/model/import-rp.ts','src/model/document.ts',...['events.js','style.js','expr.js','flyout.js','axQuery.std.js'].map(n=>nativeRoot+n)];
const report = { method:'Read-only original sample decoding and static retained metadata; no native assembly or GUI execution',sourceFiles:sourceFiles.map(file=>({file,sha256:sha(file)})),samples:[],inputs:[],stateStyles:[],setErrorCalls:[],errorEvents:[],initialErrors:[],totals:{inputs:0,nonemptyHints:0,hideOnFocusTrue:0,initialErrorTrue:0,setErrorCalls:0,errorEvents:0,stateStyles:{},statePropertySets:{},setErrorValueTrees:{}} };
for(const input of inputs) {
  const decoded=inspectRpObjects(input.file); if(decoded.fileSha256!==input.sha256)throw new Error('Source SHA changed');
  const semantic=inspectRpSemantics(input.file);
  const summary={file:path.basename(input.file),sha256:input.sha256,inputs:0,nonemptyHints:0,hideOnFocusTrue:0,initialErrorTrue:0,setErrorCalls:0,errorEvents:0,stateStyles:{}};
  report.samples.push(summary);
  summary.semanticJsonBytes=Buffer.byteLength(JSON.stringify(semantic));
  summary.recovered={hintText:0,hintStyle:0,errorStyle:0,namedHintStyle:0,errorActions:0};
  for(const diagram of semantic.diagrams)for(const widget of diagram.widgets){
    const r=widget.errorHintRecovery;if(r?.inputHint?.hintText)summary.recovered.hintText++;
    for(const state of ['error','hint'])if(r?.styles?.states?.[state]?.status==='supported-state-style'){summary.recovered[state+'Style']++;if(state==='hint'&&r.styles.states[state].namedStyleMatch)summary.recovered.namedHintStyle++;}
    for(const event of widget.interactionRecovery?.events??[])if(event.status==='supported-event')for(const c of event.cases)for(const a of c.actions)if(a.type==='setError')summary.recovered.errorActions++;
  }
  try {
    const result=importRpSemantics(semantic,input.file);parseDocument(serializeDocument(result.document));
    const all=result.document.pages.flatMap(page=>flatten(page.widgets));
    summary.import={widgets:result.report.widgetsImported,skipped:result.report.widgetsSkipped,nestedWidgets:result.report.nestedWidgetsImported,nestedSkipped:result.report.nestedWidgetsSkipped,hintText:all.filter(w=>w.hintText).length,hintStyle:all.filter(w=>w.hintStyle).length,errorStyle:all.filter(w=>w.errorStyle).length,records:all.filter(w=>w.hintText||w.errorStyle).map(w=>({id:w.id,name:w.name,type:w.type,hintText:w.hintText,hintHideOn:w.hintHideOn,hintStyle:w.hintStyle,errorStyle:w.errorStyle}))};
  } catch(error){summary.import={rejected:error.message};}
  for(const pack of decoded.packages) {
    const objects=new Map((pack.objects??[]).map(o=>[o.id,o]));
    const diagram=semantic.diagrams.find(d=>d.packageId===pack.packageId), members=new Map((diagram?.widgets??[]).map(w=>[w.id,w]));
    const identity=o=>({sample:summary.file,sampleSha256:input.sha256,packageId:pack.packageId,packageSha256:pack.sha256,diagram:diagram?.name??null,id:o.id,type:o.type});
    const resolve=ref=>ref?.referenceTag===3?objects.get(ref.$reference):undefined;
    const expand=(ref,depth=0,seen=new Set())=>{
      const o=resolve(ref); if(!o)return {unresolved:ref}; if(depth>6||seen.has(o.id))return{id:o.id,type:o.type,truncated:true};
      const next=new Set([...seen,o.id]);
      const properties=Object.fromEntries(o.properties.$map.map(([key,value])=>[key,value?.referenceTag===3?expand(value,depth+1,next):Array.isArray(value)?value.map(v=>v?.referenceTag===3?expand(v,depth+1,next):v):value]));
      return{id:o.id,type:o.type,properties};
    };
    for(const o of objects.values()) {
      if(o.type.startsWith('Axure:DiagramObject')&&p(o.properties,'Error')===true){summary.initialErrorTrue++;report.totals.initialErrorTrue++;report.initialErrors.push(identity(o));}
      if(/:(TextBox|TextArea)$/.test(o.type)) {
        summary.inputs++;report.totals.inputs++;
        const hint=p(o.properties,'PlaceholderText'),hide=p(o.properties,'HideHintOnFocus');
        if(hint){summary.nonemptyHints++;report.totals.nonemptyHints++;} if(hide===true){summary.hideOnFocusTrue++;report.totals.hideOnFocusTrue++;}
        const fields=Object.fromEntries(['PlaceholderText','HideHintOnFocus','ReadOnly','WordWrap','Type','Error','Selected','Disabled','SubmitButton'].map(k=>[k,p(o.properties,k)??null]));
        report.inputs.push({...identity(o),fields,text:p(p(o.properties,'TextBlock'),'text')??null,currentTypeCandidate:members.get(o.id)?.typeCandidate??null,directMember:members.has(o.id)});
      }
      if(o.type==='Axure:Expr:FCall'&&p(o.properties,'function-name')==='SetErrorState') {
        summary.setErrorCalls++;report.totals.setErrorCalls++;
        const args=(p(o.properties,'args')??[]).map(ref=>expand(ref));
        const blocks=[...objects.values()].filter(b=>b.type==='Axure:Expr:Block'&&(p(b.properties,'subexpressions')??[]).some(ref=>ref.$reference===o.id));
        report.setErrorCalls.push({...identity(o),args,carriers:[...objects.values()].filter(c=>c.type==='Axure:InterationActionSetFunction'&&blocks.some(b=>b.id===p(c.properties,'action')?.$reference)).map(c=>({id:c.id,properties:c.properties}))});
        const value=args[1];const compact=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(compact):Object.fromEntries(Object.entries(x).filter(([k])=>k!=='id').map(([k,v])=>[k,compact(v)])):x;
        count(report.totals.setErrorValueTrees,JSON.stringify(compact(value)));
      }
      if(o.type==='Axure:InteractionEvent'&&[55,56].includes(p(o.properties,'event-type'))){summary.errorEvents++;report.totals.errorEvents++;report.errorEvents.push({...identity(o),properties:o.properties});}
      if(!o.type.startsWith('Axure:DiagramObject'))continue;
      const style=resolve(p(o.properties,'MyStyle'));const ix=(p(style?.properties,'PropList')??[]).find(e=>(p(e,'DOAName')&0x0fffffff)===21);
      for(const state of ['Error','Hint']) {
        const ref=p(p(ix,'Value'),state);if(!ref)continue;const target=resolve(ref);const props=p(target?.properties,'PropList');
        const entries=Array.isArray(props)?props.map(e=>({key:p(e,'DOAName')&0x0fffffff,rawDoaName:p(e,'DOAName'),value:p(e,'Value')})):null;
        const fields=entries?.map(e=>e.key).sort((a,b)=>a-b);const key=state+':'+JSON.stringify(fields);
        count(summary.stateStyles,state);count(report.totals.stateStyles,state);count(report.totals.statePropertySets,key);
        const match=p(target?.properties,'MatchInfo'),root=objects.get(pack.rootId),caches=p(p(root?.properties,'StyleCache'),'Styles');
        const namedCache=match&&Array.isArray(caches)?caches.filter(c=>p(p(c,'Info'),'Id')?.$guid===p(match,'Id')?.$guid&&p(p(c,'Info'),'LibraryId')?.$guid===p(match,'LibraryId')?.$guid):[];
        report.stateStyles.push({...identity(o),state,reference:ref,directMember:members.has(o.id),currentTypeCandidate:members.get(o.id)?.typeCandidate??null,cacheChainComplete:members.get(o.id)?.styleRecovery?.cacheChainComplete??false,sourceStyleMetadata:target?.properties.$map.filter(([k])=>k!=='PropList')??null,entries,namedCache,recovery:members.get(o.id)?.errorHintRecovery?.styles?.states?.[state.toLowerCase()]??null});
      }
    }
  }
}
fs.writeFileSync('research/rp-error-hint-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples},null,2));
