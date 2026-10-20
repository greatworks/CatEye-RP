import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv[2])throw Error('Pass the exact candidate executable');
const executablePath=path.resolve(process.argv[2]),asar=path.join(path.dirname(executablePath),'resources/app.asar'),sourceFile=path.join(root,'artifacts/native-point-editing-source.rea.json');
const source=JSON.parse(await fs.readFile(sourceFile,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-native-point-editing-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,source:{path:sourceFile,sha256:await sha(sourceFile)},appAsarSha256:await sha(asar),checks:{},saves:[],exports:[],screenshots:[],errors:[],consoleErrors:[],failedRequests:[],network:[],originalAxureGuiCompared:false};
let app;
try{
  app=await electron.launch({executablePath,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observed=new WeakSet(),observe=page=>{if(observed.has(page))return;observed.add(page);page.on('pageerror',error=>audit.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')audit.consoleErrors.push(message.text());});page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));};
  app.on('window',observe);app.windows().forEach(observe);await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort();});
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1500,1000);window.webContents.setBackgroundThrottling(false);return window.id;});
  const open=async doc=>{const file=path.join(userData,'open.rea.json');await fs.writeFile(file,JSON.stringify(doc));await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await expect(page.locator('.titlebar')).toContainText(doc.name);};
  const savePicker=file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  const save=async suffix=>{const file=path.join(userData,`point-${suffix}.rea.json`);await savePicker(file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);const bytes=await fs.readFile(file);audit.saves.push({path:file,sha256:hash(bytes)});return JSON.parse(bytes);};
  const capture=async(name,id,player)=>{await player.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);const file=path.join(root,`artifacts/native-point-editing-${name}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});};
  audit.activeStage='derived-contour';await open(source);expect(await save('initial')).toEqual(source);
  await page.locator('.canvas-surface .editor-widget').click();const inspector=page.getByRole('complementary',{name:'Properties inspector'});
  const number=async(label,value)=>{const field=inspector.getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Tab');};
  await expect(inspector.getByLabel('Node Y %',{exact:true})).toHaveValue('30');await page.getByRole('button',{name:'Edit points',exact:true}).click();
  const first=page.locator('.vector-canvas-overlay [data-vector-anchor="0"]:not([data-vector-handle])');await expect(first).toHaveAttribute('y','14');
  expect(await save('entry')).toEqual(source);await capture('authoring',mainId,page);await page.getByRole('button',{name:'Done editing points',exact:true}).click();
  audit.checks.entry={currentAnchor:{x:0,y:18},storedAnchor:{x:0,y:30},unchanged:true};
  audit.activeStage='conversion';await number('Node X %',10);const converted=await save('converted'),target=converted.pages[0].widgets[0];
  expect(target.type).toBe('path');expect(target.vectorPath.commands[0]).toEqual({op:'M',x:.1,y:.3});expect(target.style).toEqual(source.pages[0].widgets[0].style);
  expect({...target,type:'box',vectorPath:source.pages[0].widgets[0].vectorPath}).toEqual(source.pages[0].widgets[0]);
  await expect(inspector.getByLabel('Radius',{exact:true})).toHaveCount(0);await page.getByTitle('Undo',{exact:true}).click();expect(await save('undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save('redo')).toEqual(converted);
  // Reopen from a distinct document state, so an ignored open cannot pass.
  await open(source);await open(converted);expect(await save('reopened')).toEqual(converted);
  await page.locator('.canvas-surface .editor-widget').click();await number('Node X %',0);const custom=await save('custom');expect(custom.pages[0].widgets[0].type).toBe('path');
  custom.pages[0].widgets[0].style.radius=55;custom.pages[0].widgets[0].selected=true;custom.pages[0].widgets[0].selectedStyle={radius:2,cornerVisibility:[false,false,false,false]};
  await open(custom);expect(await save('retained-style')).toEqual(custom);await page.locator('.canvas-surface .editor-widget').click();await expect(inspector.getByLabel('Radius',{exact:true})).toHaveCount(0);
  const d=await page.locator('.editor-widget [data-shadow-fill]').getAttribute('d');expect(d).toMatch(/^M 0 18 /);
  audit.checks.conversion={customIdentity:true,stylePreserved:true,singleUndo:true,redo:true,reopenedFromDifferentState:true,rectangleDoesNotReparameterize:true};
  audit.activeStage='preview';await page.getByTitle('Preview (F5)',{exact:true}).click();await expect(page.locator('.preview-overlay [data-widget-id="point-target"] [data-shadow-fill]')).toHaveAttribute('d',d);await capture('preview',mainId,page);await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save('after-preview')).toEqual(custom);
  const html=path.join(root,'artifacts/native-point-editing.html');await savePicker(html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:html,sha256:await sha(html)});
  audit.activeStage='offline';await app.context().setOffline(true);let offline;
  try{const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1100,800);void window.loadURL('about:blank');return window.id;});offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(html).href});await expect(offline.locator('[data-widget-id="point-target"] [data-shadow-fill]')).toHaveAttribute('d',d);await capture('offline',id,offline);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(window=>!window.isVisible()))).toBe(true);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  expect(await save('after-offline')).toEqual(custom);audit.checks.players={preview:true,offline:true,customGeometryPreserved:true,designUnchanged:true};
  const demo=path.join(root,'artifacts/native-point-editing-demo.rea.json');await fs.writeFile(demo,JSON.stringify(custom,null,2)+'\n');audit.demo={path:demo,sha256:await sha(demo)};
  expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);for(const key of ['errors','consoleErrors','failedRequests','network'])expect(audit[key]).toEqual([]);delete audit.activeStage;audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1;}
finally{if(app)try{await app.close();}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1;}audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/native-point-editing-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}
