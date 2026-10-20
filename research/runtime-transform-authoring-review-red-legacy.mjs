import fs from 'node:fs';import path from 'node:path';import{stripTypeScriptTypes}from'node:module';import{createHash}from'node:crypto';
const modules=new Map();function url(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(url(path.resolve(path.dirname(file),r.endsWith('.ts')?r:r+'.ts')))}`),u='data:text/javascript;base64,'+Buffer.from(code).toString('base64');modules.set(file,u);return u;}
const {createDocument,createWidget,parseDocument,serializeDocument}=await import(url('src/model/document.ts'));
const {createOfflineRuntime}=await import(url('src/runtime/export-runtime.ts'));
const {evaluateExpression}=await import(url('src/runtime/expressions.ts'));
const files=['src/components/Inspector.tsx','src/components/MotionActionEditor.tsx','src/model/document.ts','src/runtime/export-runtime.ts','src/runtime/expressions.ts'];
const pin=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});const before=files.map(pin),results=[];
for(const [name,type,targetType,connected,x,y]of[
 ['explicit ordinary target','move','box',true,123,234],
 ['missing target formerly inert','move','box',false,123,234],
 ['legacy line size','resize','line',true,240,120],
]){
 const doc=createDocument(),owner=createWidget('button',50,60),target=createWidget(targetType,300,400);Object.assign(target,{width:100,height:30});doc.pages[0].widgets=[owner,target];
 const action={id:'act',type,...(connected?{targetId:target.id}:{}),x,y};
 const interaction={id:'evt',name,event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[action]};owner.interactions=[interaction];
 const converted=structuredClone(doc),a=converted.pages[0].widgets[0].interactions[0].actions[0];
 // Exact values produced by the current Inspector explicit conversion handler.
 delete a.targetId;delete a.x;delete a.y;
 const dest=action.targetId?{kind:'widget',id:action.targetId}:{kind:'this'};
 if(type==='move')a.move={targets:[{target:dest,mode:'location',x:{text:String(x)},y:{text:String(y)},trajectory:'straight',easing:'none',duration:500}]};
 else a.resize={targets:[{target:dest,width:{text:String(x)},height:{text:String(y)},anchor:'top left',easing:'none',duration:500}]};
 async function run(input){const r=createOfflineRuntime(parseDocument(serializeDocument(input)),undefined,evaluateExpression,undefined,{});try{await r.trigger(owner.id,'click');const rect=w=>{const v=r.widget(w);return{x:v.x,y:v.y,width:v.width,height:v.height}};return{owner:rect(owner),target:rect(target)};}finally{r.dispose();}}
 const legacy=await run(doc),structured=await run(converted);results.push({name,legacy,structured,equivalent:JSON.stringify(legacy)===JSON.stringify(structured)});
}
const after=files.map(pin);const report={method:'Actual current runtime/model modules; exact Inspector conversion values reproduced, no browser or native execution',results,sourceBefore:before,sourceAfter:after,sourceStableDuringProbe:JSON.stringify(before)===JSON.stringify(after)};
fs.writeFileSync('research/runtime-transform-authoring-review-legacy.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.results,null,2));
