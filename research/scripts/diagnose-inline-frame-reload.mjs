import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),exe=process.argv[2]??path.join(root,'release/REA Prototype Studio-win32-x64/REA Prototype Studio.exe');
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'rea-frame-reload-diagnostic-'));
const syncMode=process.env.REA_FRAME_SYNC??'none';
const result={startedAt:new Date().toISOString(),syncMode,executable:exe,asarSha256:createHash('sha256').update(await fs.readFile(path.join(path.dirname(exe),'resources/app.asar'))).digest('hex'),events:[],navigations:[],consoleErrors:[],failedRequests:[],pageErrors:[],steps:[]};
const app=await electron.launch({executablePath:exe,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:path.join(directory,'user-data')}});
try{
 const context=app.context();
 await context.addInitScript(()=>{
  const instance=Math.random().toString(16).slice(2),log=(kind,detail={})=>console.log('REA_RELOAD_DIAG '+JSON.stringify({kind,instance,url:location.href,at:Date.now(),...detail}));
  for(const type of ['pointerover','pointerout','pointerdown','pointerup','mousedown','mouseup','click','focus','blur','load','beforeunload','pagehide'])window.addEventListener(type,event=>{const target=event.target;log(type,{target:target instanceof Element?{tag:target.tagName,widget:target.closest('[data-widget-id]')?.getAttribute('data-widget-id'),frame:target.closest('iframe')?.getAttribute('data-inline-frame'),text:target.textContent?.slice(0,90)}:null,trusted:event.isTrusted,x:event.clientX,y:event.clientY,detail:event.detail})},true);
  window.addEventListener('message',event=>{if(event.data?.channel==='rea-inline-frame'||event.data?.channel==='rea-inline-frame-init')log('message',{channel:event.data.channel,operation:event.data.operation,token:event.data.token})});
  let previous='';const observe=()=>{new MutationObserver(()=>{const count=document.querySelector('[data-widget-id="frame-child-count"]')?.textContent??'';if(count!==previous){previous=count;log('count',{text:count})}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true})};document.documentElement?observe():document.addEventListener('DOMContentLoaded',observe,{once:true});
 });
 const page=await app.firstWindow();page.setDefaultTimeout(12000);
 page.on('console',m=>{if(m.text().startsWith('REA_RELOAD_DIAG '))result.events.push(JSON.parse(m.text().slice(16)));else if(m.type()==='error')result.consoleErrors.push(m.text())});
 page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),failure:r.failure()}));page.on('pageerror',e=>result.pageErrors.push(e.message));
 for(const name of ['frameattached','framenavigated','framedetached'])page.on(name,frame=>result.navigations.push({name,url:frame.url(),at:Date.now()}));
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1550,1050);w.webContents.setBackgroundThrottling(false)});
 await page.reload();await page.locator('.application').waitFor();
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'artifacts/inline-frame-demo.rea.json'));
 await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Document opened');
 await page.getByTitle('Preview (F5)',{exact:true}).click();
 const scope=page.locator('.preview-overlay'),widget=id=>scope.locator(`[data-widget-id="${id}"]`),frame=scope.frameLocator('[data-inline-frame="frame-left"]'),count=frame.locator('[data-widget-id="frame-child-count"]'),increment=frame.locator('[data-widget-id="frame-child-increment"]');
 const step=async(name,fn)=>{const started=Date.now();try{await fn();result.steps.push({name,started,ended:Date.now(),passed:true})}catch(error){result.steps.push({name,started,ended:Date.now(),passed:false,error:String(error)});return false}return true};
 const sync=async()=>{if(syncMode==='capture')result.events.push({kind:'capturePage',at:Date.now(),bytes:await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true})).toPNG().length)});else if(syncMode==='raf')await increment.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
 await step('initial',()=>expect(count).toHaveText('Count: 1'));
 await sync();await step('initial real increment',async()=>{await increment.click();await expect(count).toHaveText('Count: 2')});
 await widget('frame-sibling-update').click();await expect(count).toHaveText('Count: 2');
 for(let n=0;n<3;n++){
  await step(`detail ${n}`,async()=>{await frame.locator('[data-widget-id="frame-child-detail"]').click();await expect(frame.locator('[data-widget-id="frame-detail-heading"]')).toHaveText('Detail page')});
  await step(`reload ${n}`,async()=>{await widget('frame-reload').click();await expect(count).toHaveText('Count: 1')});
  await sync();
  const passed=await step(`real increment after reload ${n}`,async()=>{await increment.click();await expect(count).toHaveText('Count: 2',{timeout:2000})});
  if(!passed){result.failedGeometry={outer:await scope.locator('[data-inline-frame="frame-left"]').boundingBox(),button:await increment.boundingBox(),iframe:await scope.locator('[data-inline-frame="frame-left"]').getAttribute('src'),body:await frame.locator('body').evaluate(()=>({active:document.activeElement?.outerHTML,text:document.body.innerText,ready:document.readyState,visibility:document.visibilityState,focus:document.hasFocus()}))};await step('second real increment after first failure',async()=>{await increment.click();await expect(count).toHaveText('Count: 2',{timeout:2000})});break}
 }
 result.hidden=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()));
}catch(error){result.error=String(error);process.exitCode=1}finally{await app.close();result.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,`.build/inline-frame-reload-diagnostic${syncMode==='none'?'':'-'+syncMode}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({steps:result.steps,errors:result.consoleErrors,at:result.finishedAt,error:result.error},null,2))}
