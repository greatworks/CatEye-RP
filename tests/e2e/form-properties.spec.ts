import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {formPropertiesFixture,exerciseFormProperties} from '../../scripts/form-properties-scenario.mjs';
async function menu(page:Page,name:string){await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click()}
async function save(page:Page,file:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'))}
for(const mode of ['preview','offline'] as const)test(`${mode}: form properties, Enter submission and synchronous focus actions`,async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());const doc=formPropertiesFixture();
  await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'forms.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect(await save(page,info.outputPath('before.rea.json'))).toEqual(doc);await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseFormProperties(page,page.locator('.preview-overlay'));await page.screenshot({path:'artifacts/form-properties-preview.png'});await writeFile('artifacts/form-properties-demo.rea.json',JSON.stringify(doc,null,2));await page.getByRole('button',{name:'Close preview',exact:true}).click();
  }else{
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('forms.html');await(await pending).saveAs(file);
    const context=await browser.newContext({offline:true,viewport:{width:1600,height:1100}});
    try{const offline=await context.newPage(),network:string[]=[];offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url())});await offline.goto(pathToFileURL(file).href);await exerciseFormProperties(offline,offline);await offline.screenshot({path:'artifacts/form-properties-offline.png',fullPage:true});expect(network).toEqual([]);await writeFile('artifacts/form-properties-demo.html',await readFile(file));}finally{await context.close()}
  }
  expect(await save(page,info.outputPath('after.rea.json'))).toEqual(doc);expect(errors).toEqual([]);
});
