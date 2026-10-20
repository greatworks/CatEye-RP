import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {exerciseAdaptiveImport} from './adaptive-import-scenario.mjs';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv[2])throw Error('Pass the exact candidate executable');
const executablePath=path.resolve(process.argv[2]),directory=path.resolve(root,'.build/adaptive-import-fixture'),sourceFile=path.join(directory,'SYNTHETIC-adaptive.raw.rp');
const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'))),expected=JSON.parse(await fs.readFile(path.join(directory,'imported.rea.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-adaptive-import-')),asar=path.join(path.dirname(executablePath),'resources/app.asar');
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,source:{path:sourceFile,sha256:await sha(sourceFile)},appAsarSha256:await sha(asar),checks:{},saves:[],exports:[],screenshots:[],errors:[],consoleErrors:[],failedRequests:[],network:[],fixtureKind:'Independently encoded SYNTHETIC RP; not an Axure-produced positive file',originalAxureGuiCompared:false};
expect(audit.source.sha256).toBe(manifest.rawSha256);let app;
try{
  app=await electron.launch({executablePath,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observed=new WeakSet(),observe=page=>{if(observed.has(page))return;observed.add(page);page.on('pageerror',e=>audit.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')audit.consoleErrors.push(m.text());});page.on('requestfailed',r=>audit.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));};
  app.on('window',observe);app.windows().forEach(observe);await app.context().route(/^https?:\/\//,r=>{audit.network.push(r.request().url());return r.abort();});
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1800,1100);w.webContents.setBackgroundThrottling(false);return w.id;});
  const openPicker=file=>app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  const savePicker=file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  const menu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();};
  audit.activeStage='raw-import';await openPicker(sourceFile);await menu('Import Axure .rp (experimental)…');
  const report=page.getByRole('dialog',{name:'RP import report',exact:true});await expect(report).toContainText('1 page(s), 6 recovered widget(s), 0 skipped item(s).');
  await expect(report).toContainText('4 recovered event(s), 0 skipped event(s), 4 case(s), 3 action(s).');await expect(report).toContainText(manifest.rawSha256);audit.importReportText=await report.innerText();await report.getByRole('button',{name:'Close report',exact:true}).click();
  const save=async suffix=>{const file=path.join(userData,`adaptive-import-${suffix}.rea.json`);await savePicker(file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);const bytes=await fs.readFile(file),actual=JSON.parse(bytes);expect(actual.name).toBe(path.basename(sourceFile).replace(/\.rp$/i,''));const normalized={...actual,name:expected.name};expect(normalized).toEqual(expected);audit.saves.push({path:file,sha256:hash(bytes),unchangedDocumentExceptNativeFilename:true});return file;};
  const saved=await save('initial');await openPicker(saved);await menu('Open… Ctrl+O');await expect(page.locator('.statusbar')).toContainText('Document opened');await save('reopened');
  const click=async(locator,id)=>{await locator.scrollIntoViewIfNeeded();await app.evaluate(async({BrowserWindow},id)=>{await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true});},id);await locator.click();};
  const hover=async(locator,id)=>{await locator.scrollIntoViewIfNeeded();await app.evaluate(async({BrowserWindow},id)=>{await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true});},id);await locator.hover();};
  const capture=async(suffix,id,player)=>{await player.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);const file=path.join(root,`artifacts/adaptive-import-${suffix}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});};
  audit.activeStage='preview';await page.getByTitle('Preview (F5)',{exact:true}).click();const scope=page.locator('.preview-overlay');
  try{audit.checks.preview=await exerciseAdaptiveImport(scope,{selection:scope.getByRole('combobox',{name:'Adaptive view',exact:true}),click:l=>click(l,mainId),hover:l=>hover(l,mainId),mobile:()=>click(scope.getByTitle('Mobile',{exact:true}),mainId),capture:suffix=>capture(`preview-${suffix}`,mainId,page)},manifest.ids);}
  finally{await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  await save('after-preview');const output=path.join(root,'artifacts/adaptive-import.html');await savePicker(output);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:output,sha256:await sha(output)});
  await app.context().setOffline(true);let offline;
  try{const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const w=new BrowserWindow({show:false,width:1200,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});w.setContentSize(1200,1000);void w.loadURL('about:blank');return w.id;});offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(output).href});audit.activeStage='offline';
    audit.checks.offline=await exerciseAdaptiveImport(offline.locator('main').first(),{selection:offline.getByRole('combobox',{name:'Adaptive view',exact:true}),click:l=>click(l,id),hover:l=>hover(l,id),mobile:async()=>{await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).setContentSize(390,1000),id);await expect.poll(()=>offline.evaluate(()=>innerWidth)).toBe(390);},capture:suffix=>capture(`offline-${suffix}`,id,offline)},manifest.ids);
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(w=>!w.isVisible()))).toBe(true);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  await save('after-offline');expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);for(const key of ['errors','consoleErrors','failedRequests','network'])expect(audit[key]).toEqual([]);
  audit.checks.nativeRawPickerWorker=true;audit.checks.saveReopen=true;audit.checks.runtimeDoesNotMutateDesign=true;delete audit.activeStage;audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1;}
finally{if(app)try{await app.close();}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1;}audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/adaptive-import-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}
