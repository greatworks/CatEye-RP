import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {exerciseAllViewsFill,checkAllViewsFillPlayer,paddingFixture,exerciseAllViewsPadding,checkAllViewsPaddingPlayer} from './adaptive-all-views-scenario.mjs';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv[2]||!process.argv[3])throw Error('Pass the tested executable and the initial all-views document');
const executablePath=path.resolve(process.argv[2]),sourceFile=path.resolve(process.argv[3]);
const source=JSON.parse(await fs.readFile(sourceFile,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-adaptive-all-views-')),asar=path.join(path.dirname(executablePath),'resources/app.asar');
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,source:{path:sourceFile,sha256:await sha(sourceFile)},appAsarSha256:await sha(asar),checks:{},saves:[],exports:[],screenshots:[],errors:[],consoleErrors:[],failedRequests:[],network:[],originalAxureGuiCompared:false};
let app;
try{
  app=await electron.launch({executablePath,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observed=new WeakSet(),observe=page=>{if(observed.has(page))return;observed.add(page);page.on('pageerror',error=>audit.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')audit.consoleErrors.push(message.text());});page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));};
  app.on('window',observe);app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort();});
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1800,1100);window.webContents.setBackgroundThrottling(false);return window.id;});
  const openPicker=file=>app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
  const savePicker=file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  const fileMenu=async name=>{await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();};
  const open=async doc=>{const file=path.join(userData,'open.rea.json');await fs.writeFile(file,JSON.stringify(doc));await openPicker(file);await fileMenu('Open… Ctrl+O');await expect(page.locator('.titlebar')).toContainText(doc.name);};
  const save=async suffix=>{const file=path.join(userData,`all-views-${suffix}.rea.json`);await savePicker(file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);const bytes=await fs.readFile(file);audit.saves.push({path:file,sha256:hash(bytes)});return JSON.parse(bytes);};
  const capture=async(name,id,player)=>{await player.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);const file=path.join(root,`artifacts/adaptive-all-views-${name}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});};
  await open(source);expect(await save('initial')).toEqual(source);audit.activeStage='authoring';
  const result=await exerciseAllViewsFill(page,source,{save,open});audit.checks.authoring=result.checks;await capture('authoring',mainId,page);
  audit.activeStage='preview';await page.getByTitle('Preview (F5)',{exact:true}).click();const scope=page.locator('.preview-overlay');
  try{audit.checks.preview=await checkAllViewsFillPlayer(scope,scope.getByRole('combobox',{name:'Adaptive view',exact:true}));await capture('preview',mainId,page);}
  finally{await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save('after-preview')).toEqual(result.expected);
  const html=path.join(root,'artifacts/adaptive-all-views.html');await savePicker(html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:html,sha256:await sha(html)});
  audit.activeStage='offline';await app.context().setOffline(true);let offline;
  try{
    const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1200,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1200,1000);void window.loadURL('about:blank');return window.id;});
    offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(html).href});
    audit.checks.offline=await checkAllViewsFillPlayer(offline.locator('main').first(),offline.getByRole('combobox',{name:'Adaptive view',exact:true}));await capture('offline',id,offline);
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(window=>!window.isVisible()))).toBe(true);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  expect(await save('after-offline')).toEqual(result.expected);
  audit.activeStage='padding-authoring';const paddingSource=paddingFixture(source);await open(paddingSource);
  const paddingResult=await exerciseAllViewsPadding(page,paddingSource,{save,open});audit.checks.paddingAuthoring=paddingResult.checks;await capture('padding-authoring',mainId,page);
  await page.getByTitle('Preview (F5)',{exact:true}).click();
  try{audit.checks.paddingPreview=await checkAllViewsPaddingPlayer(scope,scope.getByRole('combobox',{name:'Adaptive view',exact:true}));await capture('padding-preview',mainId,page);}
  finally{await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save('padding-after-preview')).toEqual(paddingResult.expected);
  const paddingHtml=path.join(root,'artifacts/adaptive-all-views-padding.html');await savePicker(paddingHtml);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:paddingHtml,sha256:await sha(paddingHtml)});
  audit.activeStage='padding-offline';await app.context().setOffline(true);
  try{
    const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1200,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1200,1000);void window.loadURL('about:blank');return window.id;});
    offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(paddingHtml).href});
    audit.checks.paddingOffline=await checkAllViewsPaddingPlayer(offline.locator('main').first(),offline.getByRole('combobox',{name:'Adaptive view',exact:true}));await capture('padding-offline',id,offline);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  expect(await save('padding-after-offline')).toEqual(paddingResult.expected);
  const demo=path.join(root,'artifacts/adaptive-all-views-demo.rea.json');await fs.writeFile(demo,JSON.stringify(paddingResult.expected,null,2)+'\n');audit.demo={path:demo,sha256:await sha(demo)};
  expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);
  for(const key of ['errors','consoleErrors','failedRequests','network'])expect(audit[key]).toEqual([]);
  audit.checks.nativeOpenSave=true;audit.checks.runtimeDoesNotMutateDesign=true;delete audit.activeStage;audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1;}
finally{if(app)try{await app.close();}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1;}audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/adaptive-all-views-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}
