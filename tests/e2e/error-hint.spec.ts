import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {errorHintFixture,exerciseErrorHint} from '../../scripts/error-hint-scenario.mjs';
async function menu(page:Page,name:string){await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click()}
async function save(page:Page,file:string){const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await download).saveAs(file);return JSON.parse(await readFile(file,'utf8'))}
for(const mode of ['preview','offline'] as const)test(`${mode}: Error and Hint support actual keyboard edits, clear, blur, password and independent rows`,async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const doc=errorHintFixture();await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'error-hint.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await expect(page.locator('.titlebar')).toContainText(doc.name);expect(await save(page,info.outputPath('before.rea.json'))).toEqual(doc);await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseErrorHint(page,page.locator('.preview-overlay'));await page.screenshot({path:'artifacts/error-hint-preview.png'});
    await writeFile('artifacts/error-hint-demo.rea.json',JSON.stringify(doc,null,2));await page.getByRole('button',{name:'Close preview',exact:true}).click();
  }else{
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('error-hint.html');await(await download).saveAs(html);
    const context=await browser.newContext({offline:true,viewport:{width:1600,height:1100}});
    try{const offline=await context.newPage(),network:string[]=[];offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url())});
      await offline.goto(pathToFileURL(html).href);await exerciseErrorHint(offline,offline);await offline.screenshot({path:'artifacts/error-hint-offline.png',fullPage:true});expect(network).toEqual([]);await writeFile('artifacts/error-hint-demo.html',await readFile(html));
    }finally{await context.close()}
  }
  expect(await save(page,info.outputPath('after.rea.json'))).toEqual(doc);expect(errors).toEqual([]);
});

for(const mode of ['preview','offline'] as const)test(`${mode}: focus-mode Set Text can restore a hint while focused; pre-edit events clear typing hints`,async({page,browser},info)=>{
  const doc=errorHintFixture(),target=doc.pages[0].widgets.find(w=>w.id==='Focus hint')!;
  const expressionField=doc.pages[0].widgets.find(w=>w.id==='Typing hint')!;expressionField.text='[[Initial]]';doc.variables.Initial='A';doc.variables.InitialDone='0';
  expressionField.interactions.push({id:'same-initial-event',event:'focus',name:'Same initial text',enabled:true,conditions:[{source:'variable',key:'InitialDone',operator:'equals',value:'0'}],conditionMode:'all',actions:[{id:'same-initial-set',type:'setText',targetId:expressionField.id,value:'A'},{id:'initial-done',type:'setVariable',targetId:'InitialDone',value:'1'}]});
  target.interactions=[{id:'focus-restore-event',event:'focus',name:'Restore while focused',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'focus-wait',type:'wait',duration:20},{id:'focus-write',type:'setText',targetId:target.id,value:'actual'},{id:'focus-clear',type:'setText',targetId:target.id,value:''}]},
    {id:'focus-read-event',event:'change',name:'Read logical text',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'focus-read',type:'setVariable',targetId:'LastText',value:'[[This.text]]'}]}];
  await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'hint-corner.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);
  const verify=async(player:Page,scope:Page|ReturnType<Page['locator']>)=>{
    const typing=scope.locator('.widget[aria-label="Typing hint"] input'),focus=scope.locator('.widget[aria-label="Focus hint"] input');
    await expect(typing).toHaveValue('A');await typing.click();await expect(scope.locator('.widget[aria-label="Counters"]')).toContainText('Changes: 0');await typing.fill('');
    await typing.pressSequentially('Z');await expect(scope.locator('.widget[aria-label="Change trace"]')).toHaveText('<><><Z>');await typing.fill('');
    await typing.click();await typing.dispatchEvent('beforeinput',{inputType:'insertText',data:'X'});await expect(typing).toHaveValue('');
    await focus.click();await expect(focus).toHaveValue('Search people');await expect(focus).toBeFocused();
    await focus.pressSequentially('X');await expect(focus).toHaveValue(/X/);await expect(focus).toHaveValue(/Search people/);await expect(scope.locator('.widget[aria-label="Logical text"]')).toHaveText('Logical text: «»');
    await typing.click();await expect(typing).toHaveValue('Email [[literal]]');await typing.dispatchEvent('paste');await expect(typing).toHaveValue('');await typing.pressSequentially('paste next');await expect(typing).toHaveValue('paste next');
    await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
  };
  if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await verify(page,page.locator('.preview-overlay'))}
  else{const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('corner.html');await(await download).saveAs(html);const context=await browser.newContext({offline:true});try{const offline=await context.newPage();await offline.goto(pathToFileURL(html).href);await verify(offline,offline)}finally{await context.close()}}
});
