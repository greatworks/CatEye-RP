import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadTs} from '../.build/load-ts.mjs';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {importRpSemantics}=await loadTs('src/model/import-rp.ts');
const id=n=>n.toString(16).padStart(32,'0');
const sample=JSON.parse(fs.readFileSync('research/table-format-census.json','utf8')).samples.find(s=>s.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
if(hash(sample.file)!==sample.sha256)throw Error('Changed retained source');
const all=inspectRpSemantics(sample.file),base={...all,pageTreeRecovery:undefined,diagrams:all.diagrams.filter(d=>d.packageId==='556a42319a0a476c8e81f2d6da0ada41')};
function button(targetId){return {status:'stored-fields-recovered',id:id(990),type:'Axure:DiagramObject:VectorShape',typeCandidate:{type:'box'},label:'Probe',
storedGeometry:{location:{determined:true,overridden:true,value:{X:10,Y:20}},size:{determined:true,overridden:true,value:{Width:120,Height:30}},rotation:null,transform:null,adaptiveStyleCount:0,isComputedLayout:false},
storedFlags:{AutoFitWidth:false,AutoFitHeight:false,'fit-to-content':false,'is-fixed':false,'is-percent-width':false,IsContained:false,IsLocked:false,Disabled:false,VisibleFromSettings:true},text:{status:'stored-rich-text-as-plain',text:'Probe'},
interactionRecovery:{status:'decoded-interaction-tree',events:[{status:'supported-event',id:id(991),nativeEventType:16,event:'click',cases:[{id:id(992),name:'Show cell',enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:[{sourceId:id(993),type:'show',targetSourceId:targetId}]}]}]}};}
const results=[];
for(const reject of [false,true]){
 const input=structuredClone(base),table=input.diagrams[0].widgets[0],target=table.tableRecovery.cells[0];
 input.diagrams[0].widgets.push(button(target.id));
 if(reject){table.storedGeometry.adaptiveStyleCount=2;table.adaptiveStyleRecovery={schema:1,status:'unsupported-adaptive-styles',sourceId:table.id,reason:'Independent synthetic unsupported local declaration'};}
 const r=importRpSemantics(input),b=r.document.pages[0].widgets.find(w=>w.name==='Probe');
 results.push({name:reject?'rejected parent table':'admitted parent table',expectedButtonEvents:reject?0:1,actualButtonEvents:b?.interactions.length,topWidgets:r.document.pages[0].widgets.map(w=>({id:w.id,type:w.type,name:w.name})),buttonActions:b?.interactions.flatMap(c=>c.actions),counts:{widgets:r.report.widgetsImported,nested:r.report.nestedWidgetsImported,events:r.report.eventsImported,skippedEvents:r.report.eventsSkipped},issues:r.report.issues.filter(x=>x.code==='widget-skipped'||x.code==='interaction-event-skipped')});
}
const out={kind:'Independent product protocol reproduction with a retained native table and synthetic invalid adaptive declaration/action; not native GUI or exported-runtime execution',source:{path:sample.file,sha256:sample.sha256,afterSha256:hash(sample.file)},implementation:['src/model/import-rp.ts','src/model/import-rp-adaptive.ts','research/scripts/read-rp-semantics.mjs'].map(path=>({path,sha256:hash(path)})),results,ok:results.every(r=>r.actualButtonEvents===r.expectedButtonEvents)};
fs.writeFileSync(process.argv[2]??'research/adaptive-import-styles-integration-review-red.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
