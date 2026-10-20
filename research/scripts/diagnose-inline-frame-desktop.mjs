import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),exe=process.argv[2]??path.join(root,'release/REA Prototype Studio-win32-x64/REA Prototype Studio.exe');
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-frame-diagnostic-'));
const result={startedAt:new Date().toISOString(),executable:exe,asarSha256:createHash('sha256').update(await fs.readFile(path.join(path.dirname(exe),'resources/app.asar'))).digest('hex'),console:[],requestFailures:[],errors:[],requests:[],frames:[]};
const app=await electron.launch({executablePath:exe,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
try{
 const page=await app.firstWindow();page.on('console',m=>result.console.push({type:m.type(),text:m.text().slice(0,2500),location:m.location()}));page.on('pageerror',e=>result.errors.push(e.message));page.on('requestfailed',r=>result.requestFailures.push({url:r.url(),failure:r.failure()}));page.on('request',r=>{if(r.url().includes('frame-player'))result.requests.push({url:r.url(),type:r.resourceType()})});
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false)});
 await page.locator('.application').waitFor();await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},path.join(root,'artifacts/inline-frame-demo.rea.json'));
 await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await page.locator('.statusbar').filter({hasText:'Document opened'}).waitFor();
 await page.getByTitle('Preview (F5)',{exact:true}).click();
 try{await page.frameLocator('[data-inline-frame="frame-left"]').locator('[data-widget-id="frame-child-count"]').waitFor({timeout:6500});result.counterVisible=true}catch(error){result.counterVisible=false;result.waitError=error.message}
 result.iframeElements=await page.locator('iframe').evaluateAll(items=>items.map(element=>({src:element.src,srcdoc:element.srcdoc.slice(0,200),attrs:Array.from(element.attributes,a=>[a.name,a.value])})));
 for(const frame of page.frames()){try{result.frames.push({url:frame.url(),content:await frame.evaluate(()=>({href:location.href,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),text:document.body.innerText.slice(0,1200),scripts:Array.from(document.scripts,s=>({src:s.src,type:s.type})),desktop:typeof window.desktop,require:typeof window.require,origin:location.origin}))})}catch(error){result.frames.push({url:frame.url(),error:String(error)})}}
 result.hidden=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()));
}finally{await app.close();result.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/inline-frame-desktop-diagnostic.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2))}
