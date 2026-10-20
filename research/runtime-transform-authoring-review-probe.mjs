import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

// Independent review only: use the current component/model without changing source.
const files = ['src/model/types.ts','src/model/document.ts','src/components/MotionActionEditor.tsx','src/components/Inspector.tsx','src/runtime/expressions.ts','tests/runtime-transform-model.test.ts','tests/runtime-transform-authoring.test.ts','tests/e2e/runtime-transform-authoring.spec.ts'];
const hash = async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
const before = await Promise.all(files.map(hash)), results = [], errors = [];
function check(name, actual, expected) { let pass=true; try { assert.deepEqual(actual,expected); } catch { pass=false; } results.push({ name, pass, actual, expected }); }
const server = await createServer({ configFile:false, cacheDir:'research/runtime-transform-authoring-review-cache',plugins:[react()], optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','lucide-react']},server:{host:'127.0.0.1',port:0,strictPort:false}, logLevel:'error' });
let browser, completed=false, infrastructureError;
try {
  const componentSource=await readFile('src/components/MotionActionEditor.tsx','utf8');
  const slice=componentSource.slice(componentSource.indexOf('export function defaultMoveTarget'),componentSource.indexOf('function WidgetChoice'));
  const defaults=slice.slice(0,slice.indexOf('const defaultBoundary'));
  const rename=slice.slice(slice.indexOf('export function renameMotionBinding'));
  const editor=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(defaults+rename)).toString('base64'));
  const modules=new Map();function url(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(url(path.resolve(path.dirname(file),r.endsWith('.ts')?r:r+'.ts')))}`),u='data:text/javascript;base64,'+Buffer.from(code).toString('base64');modules.set(file,u);return u;}
  const model = await import(url('src/model/document.ts'));
  for (const [text, alias, expected] of [
    ['[[1e3 + e3.x]]','e3','[[1e3 + rail.x]]'],
    ['[[1e-3 + e.x]]','e','[[1e-3 + rail.x]]'],
    ['plain track [[Track.width + "track.width" + \'track.x\']]','track','plain track [[rail.width + "track.width" + \'track.x\']]'],
  ]) {
    const value={text,bindings:{[alias]:{kind:'widget',targetId:'target-a'}}};
    const renamed=editor.renameMotionBinding(value,alias,'rail');
    check(`alias rename: ${text}`,renamed.text,expected);
    check(`binding identity: ${alias}`,renamed.bindings,{rail:{kind:'widget',targetId:'target-a'}});
    check(`input immutable: ${alias}`,value.text,text);
  }
  const target=model.createWidget('box'); target.id='target-a';
  const owner=model.createWidget('button'); owner.id='owner';
  const exp={text:'[[track.x + Widget.target-a.text + "Widget.target-a.text"]]',bindings:{track:{kind:'widget',targetId:target.id},external:{kind:'widget',targetId:'outside'}}};
  const comparison={kind:'compare',direction:'right',operator:'<',left:exp,right:{text:'1000'}};
  owner.interactions=[{id:'event',name:'Review',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[
    {id:'move',type:'move',move:{targets:[{...editor.defaultMoveTarget(),target:{kind:'widget',id:target.id},x:exp,boundary:{kind:'or',left:comparison,right:comparison}},{...editor.defaultMoveTarget(),target:{kind:'widget',id:target.id}}]}},
    {id:'resize',type:'resize',resize:{targets:[{...editor.defaultResizeTarget(),target:{kind:'widget',id:target.id},width:exp}]}},
  ]}];
  const [copy,copiedTarget]=model.cloneWidgets([owner,target],0);
  const [m,r]=copy.interactions[0].actions;
  check('clone duplicate ordered target identities',m.move.targets.map(x=>x.target),Array(2).fill({kind:'widget',id:copiedTarget.id}));
  check('clone bound and external identities',m.move.targets[0].x.bindings,{track:{kind:'widget',targetId:copiedTarget.id},external:{kind:'widget',targetId:'outside'}});
  check('clone actual reference, preserving quoted literal',m.move.targets[0].x.text,`[[track.x + Widget.${copiedTarget.id}.text + "Widget.target-a.text"]]`);
  check('clone both boolean children',m.move.targets[0].boundary.left.left.bindings,m.move.targets[0].boundary.right.left.bindings);
  check('clone size expression scope',r.resize.targets[0].width.bindings.track.targetId,copiedTarget.id);
  const doc=model.createDocument(); doc.pages[0].widgets=[owner,target];
  check('complete structured document roundtrip',model.parseDocument(model.serializeDocument(doc)),doc);
  owner.interactions[0].actions=[{id:'legacy',type:'move',targetId:target.id,x:23,y:45,duration:123}];
  check('legacy numeric document roundtrip',model.parseDocument(model.serializeDocument(doc)),doc);
  for(const [name,spec,parse] of [
    ['extra expression member',{text:'1',source:'evil'},model.parseMotionExpression],
    ['uppercase alias',{text:'1',bindings:{Track:{kind:'widget',targetId:'target-a'}}},model.parseMotionExpression],
    ['mixed target identity',{targets:[{...editor.defaultMoveTarget(),target:{kind:'this',id:'target-a'}}]},model.parseMoveActionSpec],
    ['extra resize mode',{targets:[{...editor.defaultResizeTarget(),mode:'by'}]},model.parseResizeActionSpec],
  ]) {let rejected=false;try{parse(spec);}catch{rejected=true;}check(`strict rejects ${name}`,rejected,true);}

  console.log('pure checks',results.length);
  {
    const html=`<!doctype html><html><head><title>Independent motion authoring review</title></head><body><div id="root"></div><script type="module">
      import React,{useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {MotionActionEditor,defaultMoveTarget} from '/src/components/MotionActionEditor.tsx';
      import {Inspector} from '/src/components/Inspector.tsx';
      import {createDocument,createWidget} from '/src/model/document.ts';
      function App(){ const [value,setValue]=useState({targets:['a','b'].map(id=>({...defaultMoveTarget(),target:{kind:'widget',id},x:{text:'[[local1.x]]',bindings:{local1:{kind:'widget',targetId:id}}}}))}),[doc,setDoc]=useState();window.reviewValue=value;
       window.reviewLegacyVariant=(variant)=>{const d=createDocument(),owner=createWidget('button'),target=createWidget(variant==='line'?'line':'box');owner.id='legacy-owner';target.id='legacy-target';d.pages[0].widgets=[owner,target];owner.interactions=[{id:'legacy-event',name:'Legacy',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'legacy-action',type:variant==='line'?'resize':'move',...(variant==='missing'?{}:{targetId:target.id}),x:123,y:234,duration:500}]}];setDoc(d);return d;};
       window.reviewDoc=doc;
       return doc?React.createElement(Inspector,{document:doc,page:doc.pages[0],widget:doc.pages[0].widgets[0],onWidgetChange:patch=>setDoc(d=>({...d,pages:d.pages.map((p,i)=>i?p:{...p,widgets:p.widgets.map((w,j)=>j?w:{...w,...patch})})})),onPageChange:()=>{}}):React.createElement(MotionActionEditor,{kind:'move',value,choices:['a','b'].map(id=>({widget:{id,type:'box'},label:id})),onChange:setValue}); }
      createRoot(document.getElementById('root')).render(React.createElement(App));
    </script></body></html>`;
    await writeFile('research/runtime-transform-authoring-review-harness.html',html);
  }
  await server.listen();
  console.log('server listening');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));
  page.setDefaultNavigationTimeout(30000);
  console.log('browser ready');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/research/runtime-transform-authoring-review-harness.html`,{waitUntil:'commit'});
  console.log('page loaded');
  await page.getByText('Move target 1 X local widgets (1)',{exact:true}).click();
  await page.getByText('Move target 2 X local widgets (1)',{exact:true}).click();
  await page.getByLabel('Move target 1 X local name local1',{exact:true}).fill('bad name');
  await page.getByRole('button',{name:'Move Move target 1 down',exact:true}).click();
  check('reorder actual target identity',await page.evaluate(()=>window.reviewValue.targets.map(x=>x.target.id)),['b','a']);
  const drafts=await page.locator('input[aria-label$="local name local1"]').evaluateAll(nodes=>nodes.map(n=>n.value));
  // A discarded invalid draft or one that follows target A are both safe; it must not attach to B.
  check('invalid draft does not attach to target B after reorder',drafts[0]==='local1',true);
  results.at(-1).observedDrafts=drafts;
  const firstDetails=page.locator('.inspector-motion-expression').filter({has:page.getByLabel('Move target 1 X',{exact:true})}).locator('details');
  if(await firstDetails.getAttribute('open')===null)await firstDetails.locator('summary').click();
  await page.getByLabel('Move target 1 X local name local1',{exact:true}).fill('repaired');
  await page.getByLabel('Move target 1 X local name local1',{exact:true}).press('Tab');
  results.push({name:'post-reorder draft correction observed recipient',pass:true,observation:await page.evaluate(()=>window.reviewValue.targets.map(x=>({id:x.target.id,x:x.x})))});
  await page.screenshot({path:'research/runtime-transform-authoring-review-reorder.png',fullPage:true});
  for(const variant of ['missing','line','box']){
    const initial=await page.evaluate(variant=>window.reviewLegacyVariant(variant),variant);
    await page.getByRole('tab',{name:'Interactions',exact:true}).click();
    const convert=page.getByRole('button',{name:'Add animation and expressions',exact:true});
    await convert.waitFor();
    check(`legacy ${variant} conversion availability`,await convert.isEnabled(),variant==='box');
    check(`legacy ${variant} opening inspector preserves document`,await page.evaluate(()=>window.reviewDoc),initial);
    if(variant==='box'){
      await convert.click();
      const saved=await page.evaluate(()=>window.reviewDoc);
      const actual=saved.pages[0].widgets[0].interactions[0].actions[0];
      check('legacy ordinary explicit conversion identity and numbers',actual.move.targets[0],{...editor.defaultMoveTarget(),target:{kind:'widget',id:'legacy-target'},x:{text:'123'},y:{text:'234'}});
      check('legacy converted document parses',model.parseDocument(model.serializeDocument(saved)),JSON.parse(JSON.stringify(saved)));
    }else{
      const note=variant==='missing'?'Choose a target widget before adding animation.':'Size animation is unavailable for this widget type.';
      check(`legacy ${variant} displays conversion boundary`,await page.getByText(note,{exact:true}).isVisible(),true);
    }
  }
  await page.screenshot({path:'research/runtime-transform-authoring-review-conversion.png',fullPage:true});
  completed=true;
} catch(error) {
  infrastructureError=String(error);process.exitCode=1;
} finally {
  await browser?.close();
  const after=await Promise.all(files.map(hash));
  const report={kind:'independent product review; not original Axure execution',generatedAt:new Date().toISOString(),completed,infrastructureError,results,errors,sourceBefore:before,sourceAfter:after,sourceStableDuringProbe:JSON.stringify(before)===JSON.stringify(after),checks:{total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}};
  await writeFile('research/runtime-transform-authoring-review-probe.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({completed,infrastructureError,checks:report.checks,errors,sourceStableDuringProbe:report.sourceStableDuringProbe}));
  await server.close();
}
