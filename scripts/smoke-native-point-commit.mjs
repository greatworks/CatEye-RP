import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv[2])throw Error('Pass the exact candidate executable');
const executablePath=path.resolve(process.argv[2]),asar=path.join(path.dirname(executablePath),'resources/app.asar'),sourceFile=path.join(root,'artifacts/native-point-commit-source.rea.json');
const source=JSON.parse(await fs.readFile(sourceFile,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-native-point-commit-'));
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
  const capture=async(name,id,player)=>{await player.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);const file=path.join(root,`artifacts/native-point-commit-${name}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});};
  audit.activeStage='point-commit';await open(source);expect(await save('initial')).toEqual(source);
  await page.locator('.canvas-surface .editor-widget').click();const inspector=page.getByRole('complementary',{name:'Properties inspector'});
  const field=inspector.getByLabel('Node X %',{exact:true});await field.fill('-25');await field.press('Tab');
  const changed=await save('changed'),w=changed.pages[0].widgets[0];
  expect([w.x,w.y,w.width,w.height,w.rotation]).toEqual([50,100,250,100,0]);expect(w.shapeText).toEqual({autoFitWidth:true,autoFitHeight:true});
  expect(w.vectorPath).toEqual({fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:.2,y:1},{op:'Z'}]});
  await expect(field).toHaveValue('0');
  const expected=structuredClone(source);Object.assign(expected.pages[0].widgets[0],{x:50,width:250,shapeText:{autoFitWidth:true,autoFitHeight:true},vectorPath:w.vectorPath});expect(changed).toEqual(expected);
  await capture('authoring',mainId,page);await page.getByTitle('Undo',{exact:true}).click();expect(await save('undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save('redo')).toEqual(changed);
  await open(source);await open(changed);expect(await save('reopened')).toEqual(changed);
  audit.checks.commit={normalizedFrame:true,absolutePointsPreserved:true,autoFitPreserved:true,numericInspectorSynchronized:true,unrelatedDataPreserved:true,singleUndo:true,redo:true,reopenedFromDifferentState:true};
  const d='M 0 0 L 250 0 L 250 100 L 50 100 Z';
  const check=async owner=>{await expect(owner.locator('[data-shadow-fill]')).toHaveAttribute('d',d);await expect(owner).toHaveCSS('left','50px');await expect(owner).toHaveCSS('top','100px');await expect(owner).toHaveCSS('width','250px');await expect(owner).toHaveCSS('height','100px');};
  audit.activeStage='preview';await page.getByTitle('Preview (F5)',{exact:true}).click();await check(page.locator('.preview-overlay [data-widget-id="point-target"]'));await capture('preview',mainId,page);await page.getByRole('button',{name:'Close preview',exact:true}).click();
  const html=path.join(root,'artifacts/native-point-commit.html');await savePicker(html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:html,sha256:await sha(html)});
  audit.activeStage='offline';await app.context().setOffline(true);let offline;
  try{const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1100,800);void window.loadURL('about:blank');return window.id;});offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(html).href});await check(offline.locator('[data-widget-id="point-target"]'));await capture('offline',id,offline);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(window=>!window.isVisible()))).toBe(true);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  expect(await save('after-players')).toEqual(changed);audit.checks.players={preview:true,offline:true,geometryAndPositionPreserved:true,designUnchanged:true};
  const demo=path.join(root,'artifacts/native-point-commit-demo.rea.json');await fs.writeFile(demo,JSON.stringify(changed,null,2)+'\n');audit.demo={path:demo,sha256:await sha(demo)};
  expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);for(const key of ['errors','consoleErrors','failedRequests','network'])expect(audit[key]).toEqual([]);delete audit.activeStage;audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1;}
finally{if(app)try{await app.close();}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1;}audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/native-point-commit-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}
