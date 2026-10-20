import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
const root=path.resolve(import.meta.dirname,'..'),executablePath=process.argv[2]?path.resolve(process.argv[2]):undefined;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=path.join(root,'artifacts/inline-frame-demo.rea.json'),sourceBytes=await fs.readFile(source),authored=JSON.parse(sourceBytes),userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-inline-frames-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,source,sourceSha256:sha(sourceBytes),errors:[],consoleErrors:[],failedRequests:[],unexpectedNetwork:[],screenshots:[],pickerResponsesMocked:true,originalAxureGuiCompared:false};let app;
const externalHtml='<!doctype html><meta charset="utf-8"><h1>Real frame document</h1><button id="add" onclick="this.textContent=String(Number(this.textContent)+1)">0</button>';
const server=http.createServer((request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(externalHtml);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
try{
  if(executablePath)audit.appAsarSha256=sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')));
  app=await electron.launch({...executablePath?{executablePath}:{args:[root]},env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observed=new WeakSet();
  const observe=page=>{if(observed.has(page))return;observed.add(page);page.on('pageerror',error=>audit.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')audit.consoleErrors.push(message.text());});page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),failure:request.failure()?.errorText}));};
  app.on('window',observe);
  await app.context().route(/^https?:\/\//,route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();audit.unexpectedNetwork.push(route.request().url());return route.abort();});
  const page=await app.firstWindow();observe(page);page.setDefaultTimeout(15000);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1550,1050);w.webContents.setBackgroundThrottling(false);return w.id;});
  const fileMenu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();};
  const open=async file=>{await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await fileMenu('Open… Ctrl+O');await expect(page.locator('.statusbar')).toContainText('Document opened');};
  const save=async file=>{await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);return JSON.parse(await fs.readFile(file,'utf8'));};
  const capture=async(file,id,target)=>{await target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);await fs.writeFile(path.join(root,file),bytes);audit.screenshots.push({file,sha256:sha(bytes)});};
  // Hidden Chromium may hit the iframe owner before a new OOPIF surface is
  // composited. Capturing the owning window synchronizes paint without showing
  // it; the following click remains a real pointer click with no retries.
  const frameClick=async locator=>{await locator.scrollIntoViewIfNeeded();const window=await app.browserWindow(locator.page());try{expect(await window.evaluate(async window=>(await window.webContents.capturePage(undefined,{stayHidden:true})).toPNG().length)).toBeGreaterThan(1000);}finally{await window.dispose();}await locator.click();};
  await open(source);expect(await save(path.join(userData,'before.rea.json'))).toEqual(authored);await expect(page.locator('iframe')).toHaveCount(0);
  await page.locator('.editor-widget.inlineFrame').first().dblclick();const dialog=page.getByRole('dialog',{name:'Frame target',exact:true});
  await dialog.getByLabel('Frame target type').selectOption('url');await dialog.getByLabel('Frame URL').fill(origin+'/embedded');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(await save(path.join(userData,'cancel.rea.json'))).toEqual(authored);
  await page.locator('.editor-widget.inlineFrame').first().dblclick();await dialog.getByLabel('Frame page').selectOption('frame-detail');await dialog.getByRole('button',{name:'Apply',exact:true}).click();
  const edited=await save(path.join(userData,'edited.rea.json'));expect(edited.pages[0].widgets.find(w=>w.id==='frame-left').inlineFrame.target).toEqual({kind:'page',pageId:'frame-detail'});
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(path.join(userData,'undo.rea.json'))).toEqual(authored);await open(path.join(userData,'edited.rea.json'));expect(await save(path.join(userData,'reopened.rea.json'))).toEqual(edited);await open(source);
  await page.locator('.editor-widget.inlineFrame').first().click();await capture('artifacts/inline-frame-editor.png',mainId,page);
  audit.authoring={passiveCanvas:true,cancelUnchanged:true,applyTarget:true,oneStepUndo:true,saveReopen:true};
  const inspect=async scope=>{
    const widget=id=>scope.locator(`[data-widget-id="${id}"]`),left=scope.frameLocator('iframe[data-inline-frame="frame-left"]'),right=scope.frameLocator('iframe[data-inline-frame="frame-right"]');
    const lc=left.locator('[data-widget-id="frame-child-count"]'),rc=right.locator('[data-widget-id="frame-child-count"]');
    await expect(lc).toHaveText('Count: 1');await expect(rc).toHaveText('Count: 1');
    await expect(scope.locator('iframe[data-inline-frame="frame-left"]')).toHaveAttribute('frameborder','0');await expect(scope.locator('iframe[data-inline-frame="frame-left"]')).toHaveAttribute('scrolling','auto');
    const isolation=await lc.evaluate(()=>{let parentBlocked=false;try{void parent.document.body;}catch{parentBlocked=true;}return {desktop:typeof window.desktop,require:typeof window.require,parentBlocked};});expect(isolation).toEqual({desktop:'undefined',require:'undefined',parentBlocked:true});
    await frameClick(left.locator('[data-widget-id="frame-child-increment"]'));await expect(lc).toHaveText('Count: 2');await expect(rc).toHaveText('Count: 1');
    await frameClick(widget('frame-sibling-update'));await expect(widget('frame-outer-status')).toContainText('Outer text updated');await expect(lc).toHaveText('Count: 2');
    await frameClick(left.locator('[data-widget-id="frame-child-detail"]'));await expect(left.locator('[data-widget-id="frame-detail-heading"]')).toHaveText('Detail page');await expect(rc).toHaveText('Count: 1');
    await frameClick(widget('frame-reload'));await expect(lc).toHaveText('Count: 1');
    await frameClick(left.locator('[data-widget-id="frame-child-increment"]'));await expect(lc).toHaveText('Count: 2');await frameClick(widget('frame-reload'));await expect(lc).toHaveText('Count: 1');
    await frameClick(widget('frame-show-detail'));await expect(left.locator('[data-widget-id="frame-detail-heading"]')).toHaveText('Detail page');await expect(rc).toHaveText('Count: 1');
    await frameClick(widget('frame-reload'));await expect(lc).toHaveText('Count: 1');await frameClick(left.locator('[data-widget-id="frame-child-parent"]'));
    await expect(widget('frame-parent-heading')).toHaveText('Parent frame navigation worked');await expect(scope.locator('iframe')).toHaveCount(0);
    await frameClick(widget('frame-parent-back'));await expect(lc).toHaveText('Count: 1');await expect(rc).toHaveText('Count: 1');
    await frameClick(left.locator('[data-widget-id="frame-child-increment"]'));
    return {realEmbeddedPages:true,independentVariables:true,siblingUpdatesKeepState:true,childNavigation:true,sameTargetReload:true,targetedNavigation:true,parentNavigation:true,bridgeIsolated:true,borderAndScroll:true};
  };
  await page.getByTitle('Preview (F5)',{exact:true}).click();const preview=page.locator('.preview-overlay');audit.preview=await inspect(preview);await capture('artifacts/inline-frame-preview.png',mainId,page);await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  const html=path.join(root,'artifacts/inline-frame-demo.html');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);const pending=app.waitForEvent('window'),offlineId=await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({show:false,width:1550,height:1050,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});void w.loadURL('about:blank');return w.id;}),offline=await pending;
  try{await app.evaluate(({BrowserWindow},data)=>BrowserWindow.fromId(data.id).loadURL(data.url),{id:offlineId,url:pathToFileURL(html).href});audit.offline=await inspect(offline.locator('main').first());await capture('artifacts/inline-frame-offline.png',offlineId,offline);}finally{await offline.close();await app.context().setOffline(false);}
  expect(await save(path.join(userData,'after.rea.json'))).toEqual(authored);
  const nestedDoc=structuredClone(authored),nestedCatalog=nestedDoc.pages.find(p=>p.id==='frame-catalog'),nestedDetail=nestedDoc.pages.find(p=>p.id==='frame-detail');
  const nestedWidget=structuredClone(nestedDoc.pages[0].widgets.find(w=>w.id==='frame-left'));Object.assign(nestedWidget,{id:'frame-nested',name:'Nested frame',x:18,y:85,width:450,height:250});nestedWidget.inlineFrame.target={kind:'page',pageId:'frame-detail'};
  nestedCatalog.interactions=[];nestedCatalog.widgets=[nestedCatalog.widgets.find(w=>w.id==='frame-child-heading'),nestedWidget];
  const nestedButton=nestedDetail.widgets.find(w=>w.id==='frame-detail-back');nestedButton.interactions[0].actions=[{id:'frame-nested-parent-action',type:'openLinkInFrame',frameScope:'parent',frameTarget:{kind:'page',pageId:'frame-parent-destination'}}];
  const nestedSource=path.join(userData,'nested.rea.json');await fs.writeFile(nestedSource,JSON.stringify(nestedDoc));await open(nestedSource);await page.getByTitle('Preview (F5)',{exact:true}).click();
  const nestedLeft=preview.frameLocator('iframe[data-inline-frame="frame-left"]'),nestedRight=preview.frameLocator('iframe[data-inline-frame="frame-right"]'),nestedInner=nestedLeft.frameLocator('iframe[data-inline-frame="frame-nested"]');
  await expect(nestedInner.locator('[data-widget-id="frame-detail-heading"]')).toHaveText('Detail page');
  const nestedIsolation=await nestedInner.locator('body').evaluate(()=>{let blocked=false;try{void parent.document.body;}catch{blocked=true;}return {desktop:typeof window.desktop,require:typeof window.require,blocked};});expect(nestedIsolation).toEqual({desktop:'undefined',require:'undefined',blocked:true});
  await frameClick(nestedInner.locator('[data-widget-id="frame-detail-back"]'));await expect(nestedLeft.locator('[data-widget-id="frame-parent-heading"]')).toHaveText('Parent frame navigation worked');await expect(nestedRight.locator('[data-widget-id="frame-child-heading"]')).toHaveText('Embedded workspace');await expect(preview.locator('[data-widget-id="frame-heading"]')).toHaveText('Two frames. Two independent workspaces.');
  audit.nested={actualNestedPages:true,immediateParentNavigation:true,bridgeIsolated:true};await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  const externalDoc=structuredClone(authored),externalFrame=externalDoc.pages[0].widgets.find(w=>w.id==='frame-left');externalFrame.inlineFrame.target={kind:'url',url:origin+'/embedded'};
  const externalSource=path.join(userData,'external.rea.json');await fs.writeFile(externalSource,JSON.stringify(externalDoc));await open(externalSource);await expect(page.locator('iframe')).toHaveCount(0);await page.getByTitle('Preview (F5)',{exact:true}).click();
  const external=preview.frameLocator('iframe[data-inline-frame="frame-left"]');await expect(external.locator('h1')).toHaveText('Real frame document');await frameClick(external.locator('#add'));await expect(external.locator('#add')).toHaveText('1');
  const externalIsolation=await external.locator('h1').evaluate(()=>{let blocked=false;try{void parent.document.body;}catch{blocked=true;}return {desktop:typeof window.desktop,require:typeof window.require,blocked};});expect(externalIsolation).toEqual({desktop:'undefined',require:'undefined',blocked:true});audit.external={actualLoopbackHttp:true,interactive:true,bridgeIsolated:true};await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  const localPath=path.join(userData,'embedded.html');await fs.writeFile(localPath,externalHtml);
  externalFrame.inlineFrame.target={kind:'file',path:localPath};externalFrame.inlineFrame.hideBorders=false;externalFrame.inlineFrame.scrolling='yes';
  const localSource=path.join(userData,'local.rea.json');await fs.writeFile(localSource,JSON.stringify(externalDoc));await open(localSource);await page.getByTitle('Preview (F5)',{exact:true}).click();
  const local=preview.frameLocator('iframe[data-inline-frame="frame-left"]');await expect(local.locator('h1')).toHaveText('Real frame document');await frameClick(local.locator('#add'));await expect(local.locator('#add')).toHaveText('1');
  await expect(preview.locator('iframe[data-inline-frame="frame-left"]')).toHaveAttribute('frameborder','1');await expect(preview.locator('iframe[data-inline-frame="frame-left"]')).toHaveAttribute('scrolling','yes');
  await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  externalFrame.inlineFrame.target={kind:'file',path:'embedded.html'};await fs.writeFile(localSource,JSON.stringify(externalDoc));await open(localSource);
  const localExport=path.join(userData,'local-export.html');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},localExport);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);const localPending=app.waitForEvent('window'),localWindowId=await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});void w.loadURL('about:blank');return w.id;}),localWindow=await localPending;
  try{await app.evaluate(({BrowserWindow},data)=>BrowserWindow.fromId(data.id).loadURL(data.url),{id:localWindowId,url:pathToFileURL(localExport).href});const embedded=localWindow.frameLocator('iframe[data-inline-frame="frame-left"]');await expect(embedded.locator('h1')).toHaveText('Real frame document');await frameClick(embedded.locator('#add'));await expect(embedded.locator('#add')).toHaveText('1');audit.localFiles={absoluteFilePreview:true,relativeFileExport:true,interactive:true,borderAndScroll:true};}finally{await localWindow.close();await app.context().setOffline(false);}
  await open(source);expect(await save(path.join(userData,'final.rea.json'))).toEqual(authored);expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256);expect(audit.errors).toEqual([]);expect(audit.consoleErrors).toEqual([]);expect(audit.failedRequests).toEqual([]);expect(audit.unexpectedNetwork).toEqual([]);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()))).toBe(true);
  if(executablePath)expect(sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit,{ok:true,sourceUnchanged:true,designUnchanged:true,hiddenWindows:true});
}catch(error){audit.failure=error.stack??String(error);throw error;}
finally{try{if(app)await app.close();}finally{await new Promise(resolve=>server.close(resolve));audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/inline-frame-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}}
