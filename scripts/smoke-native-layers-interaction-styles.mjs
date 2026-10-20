import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {interactionStyleFixture,exerciseInteractionStyles,presentInteractionStyles} from './interaction-style-scenario.mjs';
const root=path.resolve(import.meta.dirname,'..'),executablePath=process.argv[2]?path.resolve(process.argv[2]):undefined;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-style-effects-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,errors:[],network:[],screenshots:[],pickerResponsesMocked:true,originalAxureGuiCompared:false};
const doc=interactionStyleFixture(),source=path.join(userData,'effects.rea.json');await fs.writeFile(source,JSON.stringify(doc));let app;
try{
  if(executablePath)audit.appAsarSha256=sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')));
  app=await electron.launch({...(executablePath?{executablePath}:{args:[root]}),env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observe=page=>page.on('pageerror',error=>audit.errors.push(error.message));app.on('window',observe);await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort()});
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  const menu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click()};
  const open=async file=>{await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);await menu('Open… Ctrl+O');await expect(page.locator('.statusbar')).toContainText('Document opened')};
  const save=async file=>{await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);return JSON.parse(await fs.readFile(file,'utf8'))};
  await open(source);const saved=path.join(userData,'saved.rea.json');expect(await save(saved)).toEqual(doc);await open(saved);
  await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseInteractionStyles(page,page.locator('.preview-overlay'));await presentInteractionStyles(page.locator('.preview-overlay'));
  const capture=async(name,id,renderPage=page)=>{await renderPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');const file=path.join(root,'artifacts',name);await fs.writeFile(file,bytes);audit.screenshots.push({file,sha256:sha(bytes)})};
  const mainId=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].id);await capture('interaction-style-desktop.png',mainId);
  await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save(path.join(userData,'after-preview.rea.json'))).toEqual(doc);
  const html=path.join(userData,'effects.html');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');
  const pending=app.waitForEvent('window');const offlineId=await app.evaluate(({BrowserWindow},url)=>{const window=new BrowserWindow({show:false,width:1600,height:1100,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});void window.loadURL(url);return window.id},pathToFileURL(html).href);const offline=await pending;
  await exerciseInteractionStyles(offline,offline);await presentInteractionStyles(offline);await capture('interaction-style-desktop-offline.png',offlineId,offline);await offline.close();expect(await save(path.join(userData,'after-export.rea.json'))).toEqual(doc);
  expect(audit.errors).toEqual([]);expect(audit.network).toEqual([]);await fs.copyFile(saved,path.join(root,'artifacts/interaction-style-demo.rea.json'));await fs.copyFile(html,path.join(root,'artifacts/interaction-style-demo.html'));
  const nativeFile=path.join(root,'research/samples/Prototyping Basics.rp'),nativeBefore=sha(await fs.readFile(nativeFile));
  expect(nativeBefore).toBe('26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},nativeFile);await menu('Import Axure .rp (experimental)…');
  const report=page.getByRole('dialog',{name:'RP import report',exact:true});await expect(report).toContainText('171 recovered widget(s), 25 skipped item(s).');await report.getByRole('button',{name:'Close report',exact:true}).click();
  const recovered=await save(path.join(userData,'native-effects.rea.json')),nativeWidgets=recovered.pages.flatMap(page=>flattenLayers(page.widgets));
  function flattenLayers(widgets){return widgets.flatMap(widget=>[widget,...flattenLayers(widget.layer?.widgets??[])])}
  const hoverId='rp-w-8165e87159f34c58a974459d9e910e34-6916f399031443218a91b11e4e423a30',disabledId='rp-w-8165e87159f34c58a974459d9e910e34-3471e28ded924670841f3dfd061d33a0';
  expect(nativeWidgets.find(widget=>widget.id===hoverId)?.mouseOverStyle).toEqual({fill:'#f3f3f3'});expect(nativeWidgets.find(widget=>widget.id===disabledId)?.disabledStyle).toEqual({fill:'#9e9e9e'});
  await page.getByTitle('Preview (F5)',{exact:true}).click();const nativeHover=page.locator(`.preview-page [data-widget-id="${hoverId}"]`);
  // The real sample's separate Share glyph overlays this path's center. Use its exposed top edge.
  await nativeHover.hover({position:{x:80,y:20}});await expect(nativeHover.locator('svg [data-shadow-fill]')).toHaveAttribute('fill','#f3f3f3');
  await capture('rp-interaction-style-desktop.png',mainId);await page.getByRole('button',{name:'Close preview',exact:true}).click();
  expect(sha(await fs.readFile(nativeFile))).toBe(nativeBefore);expect(audit.errors).toEqual([]);expect(audit.network).toEqual([]);
  audit.nativeRp={file:'Prototyping Basics.rp',sourceSha256:nativeBefore,sourceUnchanged:true,widgets:171,skipped:25,explicitPatches:{[hoverId]:{mouseOverStyle:{fill:'#f3f3f3'}},[disabledId]:{disabledStyle:{fill:'#9e9e9e'}}},realHoverVerified:true};
  Object.assign(audit,{ok:true,nativeSaveReopen:true,designUnchanged:true,previewAndOffline:true,realMouseButtons:true,rowIsolation:true,focusStyleGating:true,selectedDisabledComposition:true,projectSha256:sha(await fs.readFile(saved)),htmlSha256:sha(await fs.readFile(html))});
}catch(error){audit.failure=error.stack??String(error);throw error}finally{if(app)await app.close();audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/interaction-styles-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2))}
