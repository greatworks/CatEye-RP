import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),executablePath=path.resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Pass the candidate executable');
const run=process.argv[3]??'first';if(!/^[a-z-]+$/.test(run))throw Error('Invalid run');
const artifactRoot=path.join(root,`artifacts/layer-resize-${run}-desktop`);
const auditFile=path.join(root,`.build/layer-resize-${run}-desktop-audit.json`);
if(await fs.stat(auditFile).then(()=>true,()=>false))throw Error('Preserve previous audit');
await fs.mkdir(artifactRoot,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=async file=>hash(await fs.readFile(file));
const sourceFile=path.join(root,'artifacts/layer-resize-source.rea.json'),asar=path.join(path.dirname(executablePath),'resources/app.asar');
const source=JSON.parse(await fs.readFile(sourceFile,'utf8')),userData=await fs.mkdtemp(path.join(os.tmpdir(),'rea-layer-resize-'));
const audit={ok:false,startedAt:new Date().toISOString(),executablePath,userData,appAsarSha256:await sha(asar),
 source:{path:sourceFile,sha256:await sha(sourceFile)},saves:[],exports:[],screenshots:[],checks:{},errors:[],consoleErrors:[],network:[],failedRequests:[],
 originalAxureGuiCompared:false,originalDllExecuted:false,nativePickerResponsesMocked:true};
let app;
try{
 app=await electron.launch({executablePath,env:{...process.env,REA_HEADLESS_TEST:'1',REA_TEST_USER_DATA:userData}});
 const observed=new WeakSet();const observe=page=>{
  if(observed.has(page))return;observed.add(page);
  page.on('pageerror',error=>audit.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')audit.consoleErrors.push(message.text())});
  page.on('requestfailed',request=>audit.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 };
 app.on('window',observe);app.windows().forEach(observe);
 await app.context().route(/^https?:\/\//,route=>{audit.network.push(route.request().url());return route.abort()});
 const page=await app.firstWindow();observe(page);await page.locator('.application').waitFor();
 const mainId=await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1500,1000);window.webContents.setBackgroundThrottling(false);return window.id});
 const open=async doc=>{
  const file=path.join(userData,'open.rea.json');await fs.writeFile(file,JSON.stringify(doc));
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);
  await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();
  await expect(page.locator('.titlebar')).toContainText(doc.name);await expect(page.locator('.statusbar')).toContainText('Document opened');
 };
 const savePicker=file=>app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},file);
 const save=async name=>{
  const file=path.join(artifactRoot,`${name}.rea.json`);await savePicker(file);await page.getByTitle('Save',{exact:true}).click();
  await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
  const bytes=await fs.readFile(file);audit.saves.push({path:file,sha256:hash(bytes)});return JSON.parse(bytes);
 };
 const capture=async(name,id,view)=>{
  await view.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
  const bytes=Buffer.from(await app.evaluate(async({BrowserWindow},id)=>(await BrowserWindow.fromId(id).webContents.capturePage(undefined,{stayHidden:true})).toPNG().toString('base64'),id),'base64');
  expect(bytes.length).toBeGreaterThan(1000);const file=path.join(artifactRoot,`${name}.png`);await fs.writeFile(file,bytes);audit.screenshots.push({path:file,sha256:hash(bytes)});
 };
 await open(source);expect(await save('initial')).toEqual(source);
 await page.locator('.editor-widget.layer').click();await expect(page.locator('.resize-handle')).toHaveCount(8);
 const ui=page.getByRole('complementary',{name:'Properties inspector'}),width=ui.getByLabel('Group width',{exact:true});
 await expect(width).toHaveValue('200');await width.fill('300');await width.press('Enter');
 const changed=await save('resized'),expected=structuredClone(source),group=expected.pages[0].widgets[0];
 group.width=300;group.layer.widgets[1].x=250;group.layer.widgets[1].width=150;
 expect(changed).toEqual(expected);
 await page.getByTitle('Undo',{exact:true}).click();expect(await save('undo')).toEqual(source);
 await page.getByTitle('Redo',{exact:true}).click();expect(await save('redo')).toEqual(changed);
 await open({...source,name:'Reset before reopen'});await open(changed);expect(await save('reopened')).toEqual(changed);
 await page.locator('.editor-widget.layer').click();await expect(width).toHaveValue('300');
 const handle=await page.locator('.resize-handle.se').boundingBox();expect(handle).not.toBeNull();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
 await page.mouse.move(handle.x+handle.width/2+40,handle.y+handle.height/2+20);
 await page.keyboard.press('Escape');await page.mouse.up();expect(await save('cancelled')).toEqual(changed);
 await capture('authoring',mainId,page);
 const geometry=target=>target.evaluate(node=>{const css=getComputedStyle(node);return {x:parseFloat(css.left),y:parseFloat(css.top),width:parseFloat(css.width),height:parseFloat(css.height)}});
 const exercise=async scope=>{
  const fixed=scope.locator('[data-widget-id="resize-fixed"]'),flexible=scope.locator('[data-widget-id="resize-growing"]');
  await expect(fixed).toBeVisible();await expect(flexible).toBeVisible();
  expect(await geometry(fixed)).toEqual({x:100,y:100,width:100,height:80});
  expect(await geometry(flexible)).toEqual({x:250,y:100,width:150,height:80});
 };
 await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page.locator('.preview-overlay'));await capture('preview',mainId,page);
 await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save('after-preview')).toEqual(changed);
 const html=path.join(artifactRoot,'layer-resize.html');await savePicker(html);await page.getByRole('button',{name:'Export HTML',exact:true}).click();
 await expect(page.locator('.statusbar')).toContainText('Exported');audit.exports.push({path:html,sha256:await sha(html)});
 await app.context().setOffline(true);let offline;
 try{
  const pending=app.waitForEvent('window');
  const id=await app.evaluate(({BrowserWindow})=>{const window=new BrowserWindow({show:false,width:1500,height:1000,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});window.setContentSize(1500,1000);void window.loadURL('about:blank');return window.id});
  offline=await pending;observe(offline);
  await app.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id,url:pathToFileURL(html).href});
  await exercise(offline);await capture('offline',id,offline);
  expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().every(window=>!window.isVisible()))).toBe(true);
 }finally{if(offline&&!offline.isClosed())await offline.close();await app.context().setOffline(false)}
 expect(await save('after-offline')).toEqual(changed);
 const demo=path.join(artifactRoot,'layer-resize-demo.rea.json');await fs.writeFile(demo,JSON.stringify(changed,null,2)+'\n');audit.demo={path:demo,sha256:await sha(demo)};
 audit.checks={eightHandles:true,currentNumericResize:true,fixedWidthAndLeftPin:true,unfixedSiblingScaled:true,singleUndo:true,redo:true,saveReopenExact:true,escapeRestoresExact:true,preview:true,offline:true,playbackDoesNotChangeSource:true};
 expect(await sha(sourceFile)).toBe(audit.source.sha256);expect(await sha(asar)).toBe(audit.appAsarSha256);
 for(const field of ['errors','consoleErrors','network','failedRequests'])expect(audit[field]).toEqual([]);
 audit.ok=true;
}catch(error){audit.failure=error.stack??String(error);process.exitCode=1}
finally{
 if(app)try{await app.close()}catch(error){audit.errors.push(String(error));audit.ok=false;process.exitCode=1}
 audit.finishedAt=new Date().toISOString();await fs.writeFile(auditFile,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({auditFile,ok:audit.ok,checks:audit.checks,failure:audit.failure}));
}
