import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertNativeTextMetadataOnly } from './native-text-baseline.mjs';
import { loadTs } from '../.build/load-ts.mjs';
const root=path.resolve(import.meta.dirname,'..'),exe=process.argv[2]?path.resolve(process.argv[2]):undefined;
const {openSansFaces,openSansNestedTargets}=await loadTs(path.join(root,'tests/fixtures/open-sans.ts'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=path.join(root,'artifacts/open-sans-demo.rea.json'),sourceBytes=await fs.readFile(source),doc=JSON.parse(sourceBytes);
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-open-sans-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath:exe,userData,sourceSha256:sha(sourceBytes),errors:[],network:[],screenshots:[],observed:[],originalAxureGuiCompared:false};
let app;
try{
  if(exe)audit.appAsarSha256=sha(await fs.readFile(path.join(path.dirname(exe),'resources/app.asar')));
  app=await electron.launch({...(exe?{executablePath:exe}:{args:[root]}),env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort()});
  const observe=page=>page.on('pageerror',error=>audit.errors.push(error.message)); app.on('window',observe);
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1600,1100);w.webContents.setBackgroundThrottling(false);return w.id});
  const menu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click()};
  const open=async file=>{await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);await menu('Open… Ctrl+O');await expect(page.locator('.statusbar')).toContainText('Document opened')};
  const save=async name=>{const file=path.join(userData,name);await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);return JSON.parse(await fs.readFile(file,'utf8'))};
  const capture=async(file,id=mainId,target=page)=>{
    await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).webContents.invalidate(),id);
    await target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');
    await fs.writeFile(path.join(root,file),bytes);audit.screenshots.push({file,sha256:sha(bytes)});
  };
  const fonts=async(target,prefix,entries=openSansFaces)=>{
    await target.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
    const cdp=await app.context().newCDPSession(target);
    try{
      await cdp.send('DOM.enable');await cdp.send('CSS.enable');const{root:dom}=await cdp.send('DOM.getDocument');const records=[];
      for(const[index,entry]of entries.entries()){
        const selector=prefix==='.canvas-surface'?`${prefix} > .editor-widget:nth-of-type(${index+1}) > .widget-text`:`${prefix} [data-widget-id="${entry.id}"] > .widget-text`;
        let{nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector});expect(nodeId,selector).toBeGreaterThan(0);
        const rich=await cdp.send('DOM.querySelector',{nodeId,selector:'[data-rich-run]'});if(rich.nodeId)nodeId=rich.nodeId;
        const{fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});expect(fonts.length).toBeGreaterThan(0);expect(fonts.every(f=>f.isCustomFont&&f.postScriptName===entry.postScriptName),entry.id).toBe(true);
        records.push({id:entry.id,fonts});
      }
      return records;
    }finally{await cdp.detach()}
  };
  await open(source);expect(await save('initial.rea.json')).toEqual(doc);
  audit.observed.push({stage:'editor',faces:await fonts(page,'.canvas-surface')});await capture('artifacts/open-sans-editor.png');
  await page.locator('.canvas-surface > .editor-widget').first().click();
  await expect(page.locator('.style-toolbar').getByLabel('Font family',{exact:true})).toHaveValue('Open Sans');
  await page.locator('.style-toolbar').getByLabel('Font family',{exact:true}).selectOption('Roboto');expect((await save('font-changed.rea.json')).pages[0].widgets[0].style.fontFamily).toBe('Roboto');
  await page.getByTitle('Undo',{exact:true}).click();expect(await save('undo.rea.json')).toEqual(doc);
  await page.getByTitle('Preview (F5)',{exact:true}).click();
  audit.observed.push({stage:'preview',faces:await fonts(page,'.preview-page')});await capture('artifacts/open-sans-preview.png');
  await page.locator('.preview-page [data-widget-id="open-sans-change"]').click();audit.observed.push({stage:'preview-style-action',faces:await fonts(page,'.preview-page',[{id:'open-sans-action-target',postScriptName:'OpenSans-ExtraBoldItalic'}])});
  await page.locator('.preview-overlay [data-page-id="open-sans-nested"]').click();audit.observed.push({stage:'preview-nested',faces:await fonts(page,'.preview-page',openSansNestedTargets)});await capture('artifacts/open-sans-nested.png');
  await page.locator('.preview-overlay [data-page-id="open-sans-framed"]').click();
  const previewFrame=page.locator('iframe[data-inline-frame="open-sans-frame"]');await expect(previewFrame.contentFrame().locator('[data-widget-id="open-sans-rich"]')).toBeVisible();
  audit.observed.push({stage:'preview-iframe',faces:await fonts(await(await previewFrame.elementHandle()).contentFrame(),'main',openSansNestedTargets)});
  await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save('after-preview.rea.json')).toEqual(doc);
  const exported=path.join(root,'artifacts/open-sans-demo.html');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},exported);
  await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');
  const html=await fs.readFile(exported,'utf8');expect((html.match(/data:font\/ttf;base64,/g)??[]).length).toBe(10);expect(html).toContain('Google Corporation');expect(html).toContain('Apache License');
  await app.context().setOffline(true);const pending=app.waitForEvent('window');
  const offlineId=await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({show:false,width:1600,height:1100,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});w.setContentSize(1600,1100);void w.loadURL('about:blank');return w.id});
  const offline=await pending;
  try{
    await app.evaluate(({BrowserWindow},data)=>BrowserWindow.fromId(data.id).loadURL(data.url),{id:offlineId,url:pathToFileURL(exported).href});
    audit.observed.push({stage:'offline',faces:await fonts(offline,'main')});await capture('artifacts/open-sans-offline.png',offlineId,offline);
    await offline.locator('[data-widget-id="open-sans-change"]').click();audit.observed.push({stage:'offline-style-action',faces:await fonts(offline,'main',[{id:'open-sans-action-target',postScriptName:'OpenSans-ExtraBoldItalic'}])});
    await offline.locator('nav').getByRole('button',{name:'Nested typography',exact:true}).click();audit.observed.push({stage:'offline-nested',faces:await fonts(offline,'main',openSansNestedTargets)});
    await offline.locator('nav').getByRole('button',{name:'Embedded typography',exact:true}).click();
    const iframe=offline.locator('iframe[data-inline-frame="open-sans-frame"]');await expect(iframe.contentFrame().locator('[data-widget-id="open-sans-rich"]')).toBeVisible();
    audit.observed.push({stage:'offline-iframe',faces:await fonts(await(await iframe.elementHandle()).contentFrame(),'main',openSansNestedTargets)});
  }finally{await offline.close();await app.context().setOffline(false)}
  expect(await save('after-offline.rea.json')).toEqual(doc);
  const nativeFile=path.join(root,'research/samples/UX Prototyping.rp');const nativeBefore=sha(await fs.readFile(nativeFile));
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},nativeFile);await menu('Import Axure .rp (experimental)…');
  const report=page.getByRole('dialog',{name:'RP import report',exact:true});await expect(report).toContainText('129 recovered widget(s)');await report.getByRole('button',{name:'Close report',exact:true}).click();
  const native=await save('native.rea.json');const nativeMetadataCount=await assertNativeTextMetadataOnly(native,JSON.parse(await fs.readFile(path.join(root,'research/font-size-imported-before.rea.json'),'utf8')),nativeBefore);
  const owners=native.pages.filter(p=>['Problems and ideas','Sample problems and ideas'].includes(p.name));
  await page.getByTitle('Preview (F5)',{exact:true}).click();
  for(const owner of owners){
    await page.locator(`.preview-overlay [data-page-id="${owner.id}"]`).click();const entries=owner.widgets.filter(w=>['Problems','Ideas'].includes(w.text)).map(w=>({id:w.id,postScriptName:'OpenSans-Bold'}));expect(entries).toHaveLength(2);
    audit.observed.push({stage:`native-${owner.name}`,faces:await fonts(page,'.preview-page',entries)});
  }
  await capture('artifacts/open-sans-native-ux.png');await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save('native-after.rea.json')).toEqual(native);
  audit.native={file:nativeFile,sha256:nativeBefore,completePriorFieldsUnchanged:true,nativeMetadataCount,headingsUseOpenSansBold:true,initialShapeTextLayoutImplemented:true,runtimeOwnerAutoFitImplemented:false};expect(sha(await fs.readFile(nativeFile))).toBe(nativeBefore);
  await open(source);expect(await save('final.rea.json')).toEqual(doc);expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256);
  expect(audit.errors).toEqual([]);expect(audit.network).toEqual([]);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()))).toBe(true);
  if(exe)expect(sha(await fs.readFile(path.join(path.dirname(exe),'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit,{ok:true,sourceUnchanged:true,designUnchanged:true,hiddenWindows:true});
}catch(error){audit.failure=error.message;process.exitCode=1}
finally{if(app)await app.close();audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/open-sans-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2))}
