import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),executablePath=process.argv[2]?path.resolve(process.argv[2]):undefined;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=path.join(root,'artifacts/table-demo.rea.json'),sourceBytes=await fs.readFile(source),authored=JSON.parse(sourceBytes),userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-tables-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,source,sourceSha256:sha(sourceBytes),errors:[],unexpectedNetwork:[],screenshots:[],pickerResponsesMocked:true,originalAxureGuiCompared:false};let app;
try{
  if(executablePath)audit.appAsarSha256=sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')));
  app=await electron.launch({...executablePath?{executablePath}:{args:[root]},env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  app.on('window',page=>page.on('pageerror',error=>audit.errors.push(error.message)));
  await app.context().route(/^https?:\/\//,route=>{audit.unexpectedNetwork.push(route.request().url());return route.abort();});
  const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>audit.errors.push(error.message));await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1550,1050);w.webContents.setBackgroundThrottling(false);return w.id;});
  const menu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();};
  const open=async file=>{await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await menu('Open… Ctrl+O');await expect(page.locator('.statusbar')).toContainText('Document opened');};
  const save=async file=>{await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);return JSON.parse(await fs.readFile(file,'utf8'));};
  const capture=async(file,id,target)=>{await target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);await fs.writeFile(path.join(root,file),bytes);audit.screenshots.push({file,sha256:sha(bytes)});};
  await open(source);expect(await save(path.join(userData,'before.rea.json'))).toEqual(authored);
  const inspector=page.getByRole('complementary',{name:'Properties inspector'});await page.locator('[data-table-cell-id="table-cell-0"]').click();await inspector.getByRole('button',{name:'Insert row below',exact:true}).click();
  const edited=await save(path.join(userData,'edited.rea.json')),table=edited.pages[0].widgets.find(w=>w.id==='table-main');expect(table.table.cells).toHaveLength(12);expect(table.table.rowHeights).toEqual([55,55,55,55]);expect(new Set(table.table.cells.map(c=>c.id)).size).toBe(12);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(path.join(userData,'undo.rea.json'))).toEqual(authored);
  await open(path.join(userData,'edited.rea.json'));expect(await save(path.join(userData,'reopened.rea.json'))).toEqual(edited);await open(source);await page.locator('[data-table-cell-id="table-cell-0"]').click();await capture('artifacts/table-editor.png',mainId,page);
  audit.authoring={independentCellSelection:true,trackInsertion:true,geometryAndIds:true,oneStepUndo:true,saveReopen:true};await open(source);
  const inspect=async(target,scope)=>{
    const grid=scope.locator('[data-widget-id="table-main"]'),cell=n=>scope.locator(`[data-widget-id="table-cell-${n}"]`),status=scope.locator('[data-widget-id="table-status"]');
    await expect(grid.locator('.tableCell')).toHaveCount(9);await expect(grid).toHaveCSS('width','560px');await cell(0).click();await expect(cell(6)).toHaveText('Updated independently');await expect(cell(0)).toHaveCSS('background-color','rgb(209, 250, 229)');await expect(status).toHaveText('Only this cell handled the click');
    await cell(2).click();await expect(status).toHaveText('Only this cell handled the click');await cell(1).click();await expect(status).toHaveText('Table fallback handled');await cell(4).click();await target.getByRole('menuitem',{name:'Second cell choice',exact:true}).click();await expect(status).toHaveText('Second cell choice');
    await cell(5).getByRole('link').click();await expect(status).toHaveText('Cell hyperlink handled');await scope.locator('[data-widget-id="table-noops"]').click();await expect(grid).toHaveCSS('width','560px');await expect(cell(0)).toHaveCSS('width','180px');await cell(0).click();await expect(status).toHaveText('Only this cell handled the click');
    await scope.locator('[data-widget-id="table-hide-cell"]').click();await expect(cell(7)).toHaveCount(0);await expect(cell(8)).toHaveCSS('left','360px');await scope.locator('[data-widget-id="table-hide-cell"]').click();await expect(cell(7)).toBeVisible();
    await scope.locator('[data-widget-id="table-move"]').click();await expect(cell(8)).toHaveCSS('left','350px');await expect(cell(8)).toHaveCSS('top','98px');await expect(grid).toHaveCSS('height','165px');
    const actions=scope.locator('[data-widget-id="table-row-cell-0"]'),outputs=scope.locator('[data-widget-id="table-row-cell-1"]');await actions.nth(1).click();await expect(outputs.nth(1)).toHaveText('Clicked Beta');await expect(outputs.nth(0)).toHaveText('Awaiting row action');
    return{independentCells:true,selectedStyle:true,handledFallbackAndMenu:true,cellHyperlink:true,unsupportedSettersNoop:true,hideWithoutReflow:true,localMove:true,repeaterInstances:true};
  };
  await page.getByTitle('Preview (F5)',{exact:true}).click();const preview=page.locator('.preview-overlay');audit.preview=await inspect(page,preview);await capture('artifacts/table-preview.png',mainId,page);await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  const html=path.join(root,'artifacts/table-demo.html');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);const pending=app.waitForEvent('window'),offlineId=await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({show:false,width:1550,height:1050,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});void w.loadURL('about:blank');return w.id;}),offline=await pending;
  try{await app.evaluate(({BrowserWindow},data)=>BrowserWindow.fromId(data.id).loadURL(data.url),{id:offlineId,url:pathToFileURL(html).href});audit.offline=await inspect(offline,offline.locator('main'));await capture('artifacts/table-offline.png',offlineId,offline);}finally{await offline.close();await app.context().setOffline(false);}
  expect(await save(path.join(userData,'after-playback.rea.json'))).toEqual(authored);expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256);expect(audit.errors).toEqual([]);expect(audit.unexpectedNetwork).toEqual([]);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()))).toBe(true);
  if(executablePath)expect(sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit,{ok:true,sourceUnchanged:true,designUnchanged:true,hiddenWindows:true});
}catch(error){audit.failure=error.stack??String(error);throw error;}finally{try{if(app)await app.close();}finally{audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/table-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}}
