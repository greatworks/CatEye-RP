import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {checkNativeCornersPlayer} from './native-corners-scenario.mjs';
const root=path.resolve(import.meta.dirname,'..');
if(!process.argv[2])throw Error('Pass the exact candidate executable');
const executablePath=path.resolve(process.argv[2]),asar=path.join(path.dirname(executablePath),'resources/app.asar'),sourceFile=path.join(root,'artifacts/native-corners-source.rea.json');
const source=JSON.parse(await fs.readFile(sourceFile,'utf8')),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-native-corners-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,source:{path:sourceFile,sha256:await sha(sourceFile)},appAsarSha256:await sha(asar),checks:{},saves:[],exports:[],screenshots:[],errors:[],consoleErrors:[],failedRequests:[],network:[],originalAxureGuiCompared:false};
let app;
try{
  app=await electron.launch({executablePath,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
  const observed=new WeakSet(),observe=page=>{if(observed.has(page))return;observed.add(page);page.on('pageerror',error=>audit.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')audit.consoleErrors.push(message.text());});page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));};
  app.on('window',observe);app.windows().forEach(observe);await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort();});
  const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
  const mainId=await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1800,1100);window.webContents.setBackgroundThrottling(false);return window.id;});
  const open=async doc=>{const file=path.join(userData,'open.rea.json');await fs.writeFile(file,JSON.stringify(doc));await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await expect(page.locator('.titlebar')).toContainText(doc.name);};
  const savePicker=file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
  const save=async suffix=>{const file=path.join(userData,`corners-${suffix}.rea.json`);await savePicker(file);await page.getByTitle('Save',{exact:true}).click();await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);const bytes=await fs.readFile(file);audit.saves.push({path:file,sha256:hash(bytes)});return JSON.parse(bytes);};
  const capture=async(name,id,player)=>{await player.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');expect(bytes.length).toBeGreaterThan(1000);const file=path.join(root,`artifacts/native-corners-${name}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});};
  const samplePixel=(id,player)=>async(widget,x,y)=>{const box=await widget.boundingBox();expect(box).not.toBeNull();const png=await app.evaluate(async({BrowserWindow},{id,rect})=>(await BrowserWindow.fromId(id).webContents.capturePage(rect,{stayHidden:true})).toPNG().toString('base64'),{id,rect:{x:Math.round(box.x+x),y:Math.round(box.y+y),width:1,height:1}});return player.evaluate(async base64=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return Array.from(ctx.getImageData(0,0,1,1).data);},png);};
  await open(source);expect(await save('initial')).toEqual(source);audit.activeStage='authoring';
  await page.locator('.canvas-surface .editor-widget.box').filter({hasText:/^0$/}).click();const inspector=page.getByRole('complementary',{name:'Properties inspector'});
  const radius=inspector.getByLabel('Radius',{exact:true});await radius.fill('18');await radius.press('Tab');await inspector.getByLabel('Corner top left rounded',{exact:true}).check();
  const expected=structuredClone(source),gallery=expected.pages[0].widgets.find(w=>w.id==='corner-mask-0');gallery.style.radius=18;gallery.style.cornerVisibility=[true,false,false,false];
  expect(await save('edited')).toEqual(expected);await capture('authoring',mainId,page);
  await page.getByTitle('Undo',{exact:true}).click();await page.getByTitle('Undo',{exact:true}).click();expect(await save('undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();await page.getByTitle('Redo',{exact:true}).click();expect(await save('redo')).toEqual(expected);await open(expected);expect(await save('reopened')).toEqual(expected);audit.checks.authoring={independentParameters:true,undoRedo:true,nativeOpenSave:true};
  await open(source);audit.activeStage='preview';await page.getByTitle('Preview (F5)',{exact:true}).click();
  audit.checks.preview=await checkNativeCornersPlayer(page.locator('.preview-overlay'),page,{capture:()=>capture('preview',mainId,page),samplePixel:samplePixel(mainId,page)});await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save('after-preview')).toEqual(source);
  const html=path.join(root,'artifacts/native-corners.html');await savePicker(html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:html,sha256:await sha(html)});
  audit.activeStage='offline';await app.context().setOffline(true);let offline;
  try{const pending=app.waitForEvent('window'),id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1200,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1200,1000);void window.loadURL('about:blank');return window.id;});offline=await pending;observe(offline);await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(html).href});audit.checks.offline=await checkNativeCornersPlayer(offline.locator('main').first(),offline,{capture:()=>capture('offline',id,offline),samplePixel:samplePixel(id,offline)});
    await offline.getByRole('button',{name:'Embedded corners',exact:true}).click();const frame=offline.frameLocator('[data-inline-frame="corners-frame"]');await frame.locator('[data-widget-id="corners-mask"]').click();await frame.locator('[data-widget-id="corners-radius"]').click();await expect(frame.locator('[data-widget-id="corners-target"] [data-shadow-fill]')).toHaveAttribute('d',/ 12 0/);audit.checks.nestedFrame=true;
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(window=>!window.isVisible()))).toBe(true);
  }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false);}
  expect(await save('after-offline')).toEqual(source);audit.checks.runtimeDoesNotMutateDesign=true;
  const demo=path.join(root,'artifacts/native-corners-demo.rea.json');await fs.writeFile(demo,JSON.stringify(source,null,2)+'\n');audit.demo={path:demo,sha256:await sha(demo)};
  expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);for(const key of ['errors','consoleErrors','failedRequests','network'])expect(audit[key]).toEqual([]);delete audit.activeStage;audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1;}
finally{if(app)try{await app.close();}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1;}audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/native-corners-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}
