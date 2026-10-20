// Independent read-only review fixtures; only writes this research result.
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { Script } from 'node:vm';
import crypto from 'node:crypto';
const dataURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const vectorURL=dataURL(stripTypeScriptTypes(fs.readFileSync('src/model/vector.ts','utf8')));
const load=async p=>import(dataURL(stripTypeScriptTypes(fs.readFileSync(p,'utf8')).replace(/(['"])(?:\.\/|\.\.\/model\/)vector\1/g,JSON.stringify(vectorURL))));
const {createDocument,createWidget,uid}=await load('src/model/document.ts');
const {createOfflineRuntime}=await load('src/runtime/export-runtime.ts');
const {evaluateExpression}=await load('src/runtime/expressions.ts');
const event=(actions,trigger='click')=>({id:uid(),name:trigger,event:trigger,enabled:true,conditions:[],conditionMode:'all',actions:actions.map(a=>({...a,id:uid()}))});
const list=(template,height=100)=>{const w=createWidget('repeater');w.x=w.y=0;w.width=100;w.style.strokeWidth=0;w.repeater={columns:['Name'],rows:[{Name:'A'}],template,itemWidth:100,itemHeight:height,gap:0,layout:'vertical',fitToContent:true};return w;};
const make=(doc,portable)=>portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout})(doc,undefined,evaluateExpression):createOfflineRuntime(doc,undefined,evaluateExpression);
const outcomes=[];
for(const portable of [false,true]){
  {
    const doc=createDocument(), panel=createWidget('panel'), child=createWidget('button'), extent=createWidget('text');
    child.x=child.y=0;child.width=child.height=10;extent.x=extent.y=0;extent.width=extent.height=100;
    panel.x=panel.y=0;panel.fitToContent=true;panel.states[0].widgets=[extent,child];
    const outer=list([panel]);doc.pages[0].widgets=[outer];doc.caseSelection='never';
    const runtime=make(doc,portable);await runtime.start();const row=runtime.rows(outer)[0];
    const fire=async actions=>{child.interactions=[event(actions)];await runtime.trigger(child.id,'click',row.data,row.context);};
    await fire([{type:'resizeItem',targetId:outer.id,x:200,y:200}]);
    const before={rowHeight:runtime.rows(outer)[0].height,panelHeight:runtime.widget(panel,row.context).height};
    await fire([{type:'move',targetId:child.id,x:20,y:20}]);
    const after={rowHeight:runtime.rows(outer)[0].height,panelHeight:runtime.widget(panel,row.context).height};
    outcomes.push({portable,case:'child-move-within-unchanged-fitted-panel',before,after,expectedRowHeight:200});runtime.dispose();
  }
  {
    const doc=createDocument(), panel=createWidget('panel'), child=createWidget('button');
    child.x=child.y=0;child.width=child.height=100;panel.x=panel.y=0;panel.fitToContent=true;panel.states[0].widgets=[child];
    const outer=list([panel]);doc.pages[0].widgets=[outer];doc.caseSelection='never';
    const runtime=make(doc,portable);await runtime.start();const row=runtime.rows(outer)[0];
    child.interactions=[event([{type:'resizeItem',targetId:outer.id,x:200,y:200},{type:'setState',targetId:panel.id,value:panel.activeStateId}])];
    await runtime.trigger(child.id,'click',row.data,row.context);
    outcomes.push({portable,case:'set-panel-already-current-state',rowHeight:runtime.rows(outer)[0].height,expectedRowHeight:200});runtime.dispose();
  }
  {
    const doc=createDocument(),child=createWidget('button');child.x=child.y=0;child.width=100;child.height=20;
    const inner=list([child],20),outer=list([inner],20);doc.pages[0].widgets=[outer];doc.caseSelection='never';
    const runtime=make(doc,portable);await runtime.start();const parent=runtime.rows(outer)[0],row=runtime.rows(inner,parent.context)[0];
    child.interactions=[event([{type:'addRow',targetId:inner.id,value:'{"Name":"B"}'}])];
    await runtime.trigger(child.id,'click',row.data,row.context);
    outcomes.push({portable,case:'nested-repeater-data-refresh-parent-fit',innerHeight:runtime.widget(inner,parent.context).height,outerRowHeight:runtime.rows(outer)[0].height,expectedOuterRowHeight:40});runtime.dispose();
  }
}
const bytes=fs.readFileSync('src/runtime/export-runtime.ts'),out={reviewedRuntimeSha256:crypto.createHash('sha256').update(bytes).digest('hex'),outcomes};
fs.writeFileSync('research/item-layout-review-results.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
