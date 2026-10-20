import { Script, createContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import type { Document, Interaction } from '../src/model/types';
import { exportPrototype, inlineFrameBootstrap } from '../src/runtime/export';
import { mountOfflinePrototype, type OfflineRuntime } from '../src/runtime/export-runtime';

function fixture() {
  const doc=createDocument(),page=doc.pages[0],hidden=createWidget('box'),next=createPage('Next'),inactive=createWidget('box'),panel=createWidget('panel');
  const record=(name:string):Interaction=>({id:uid(),name,event:'load',enabled:true,conditionMode:'all',conditions:[],actions:[{id:uid(),type:'setVariable',targetId:name,value:'[[This.width]]'}]});
  doc.caseSelection='never';page.width=390;page.height=100;hidden.hidden=true;hidden.interactions=[record('First')];page.widgets=[hidden];
  page.adaptiveSelection='native-size';page.adaptiveBaseSize={width:0,height:0};
  page.adaptiveViews=[{id:'tall',name:'Tall',width:390,height:500,baseViewId:'short',overrides:{[hidden.id]:{style:{color:'#123456'}}}},{id:'short',name:'Short',width:390,height:0,overrides:{[hidden.id]:{width:111}}}];
  // Height must remain real viewport height, not be clamped to canvas 100.
  page.adaptiveViews[0].overrides[hidden.id].width=222;
  next.width=300;next.height=100;next.adaptiveSelection='native-size';next.adaptiveBaseSize={width:0,height:0};
  panel.states=[{id:uid(),name:'Active',widgets:[]},{id:uid(),name:'Inactive',widgets:[inactive]}];panel.activeStateId=panel.states[0].id;inactive.interactions=[record('Next')];next.widgets=[panel];
  next.adaptiveViews=[{id:'next-tall',name:'Next tall',width:300,height:500,baseViewId:'next-short',overrides:{[inactive.id]:{width:444}}},{id:'next-short',name:'Next short',width:300,height:0,overrides:{[inactive.id]:{width:333}}}];doc.pages.push(next);
  return {doc,next};
}

async function boot(doc:Document,height:number,embedded:boolean) {
  const captured:{runtime?:OfflineRuntime;started?:Promise<void>;initial?:string}={};
  const captureMount=(_doc:Document,runtime:OfflineRuntime)=>{captured.runtime=runtime;captured.initial=runtime.adaptiveViewId();captured.started=runtime.start()};
  const window={innerWidth:900,innerHeight:height,addEventListener(){},removeEventListener(){},parent:{postMessage(){}}};
  const context=createContext({structuredClone,setTimeout,clearTimeout,crypto:webcrypto,window,location:{href:'file:///isolated/hierarchy.html'},document:{getElementById(id:string){return {textContent:id==='prototype-data'?JSON.stringify(doc):''}}},captureMount});
  const mount=`(${mountOfflinePrototype.toString()})`;
  if(embedded){const source=inlineFrameBootstrap();expect(source).toContain(mount);new Script(`(${source.replace(mount,'captureMount')})`).runInContext(context)(structuredClone(doc),{base:'file:///isolated/hierarchy.html',styles:'',bootstrap:''},doc.pages[0].id)}
  else{const source=exportPrototype(doc).match(/<\/script><script>([^]*?)<\/script>/)![1];expect(source).toContain(mount);new Script(source.replace(mount,'captureMount')).runInContext(context)}
  await captured.started;return {runtime:captured.runtime!,initial:captured.initial};
}

for(const embedded of [false,true])describe(`${embedded?'nested child':'offline root'} hierarchy bootstrap`,()=>{
  for(const height of [499,500])it(`passes its real ${height}px height before Loaded and across navigation`,async()=>{
    const {doc,next}=fixture(),before=JSON.stringify(doc);const {runtime,initial}=await boot(doc,height,embedded);
    try{expect(initial).toBe(height===500?'tall':'short');expect(runtime.state().variables.First).toBe(height===500?'222':'111');await runtime.navigate(next.id);expect(runtime.adaptiveViewId()).toBe(height===500?'next-tall':'next-short');expect(runtime.state().variables.Next).toBe(height===500?'444':'333');expect(JSON.stringify(doc)).toBe(before)}finally{runtime.dispose()}
  });
});
