import {expect,test,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {interactionStyleFixture,exerciseInteractionStyles,presentInteractionStyles} from '../../scripts/interaction-style-scenario.mjs';

async function menu(page:Page,name:string){await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click()}
async function save(page:Page,file:string){const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await download).saveAs(file);return JSON.parse(await readFile(file,'utf8'))}

for(const mode of ['preview','offline'] as const)test(`${mode}: real pointer and focus states compose, leave and restore without changing the design`,async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const doc=interactionStyleFixture();await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'effects.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await expect(page.locator('.titlebar')).toContainText(doc.name);expect(await save(page,info.outputPath('before.rea.json'))).toEqual(doc);
  await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseInteractionStyles(page,page.locator('.preview-overlay'));await presentInteractionStyles(page.locator('.preview-overlay'));
    await page.screenshot({path:'artifacts/interaction-style-preview.png'});await writeFile('artifacts/interaction-style-demo.rea.json',JSON.stringify(doc,null,2));
    await page.getByRole('button',{name:'Close preview',exact:true}).click();
  }else{
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('effects.html');await(await download).saveAs(html);
    const context=await browser.newContext({offline:true,viewport:{width:1600,height:1100}});
    try{const offline=await context.newPage(),network:string[]=[];offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url())});
      await offline.goto(pathToFileURL(html).href);await exerciseInteractionStyles(offline,offline);await presentInteractionStyles(offline);await offline.screenshot({path:'artifacts/interaction-style-offline.png',fullPage:true});
      expect(network).toEqual([]);await writeFile('artifacts/interaction-style-demo.html',await readFile(html));
    }finally{await context.close()}
  }
  expect(await save(page,info.outputPath('after.rea.json'))).toEqual(doc);expect(errors).toEqual([]);
});

for(const mode of ['preview','offline'] as const)test(`${mode}: hover repaints when an adaptive base differs from an equal-to-default effect`,async({page,browser},info)=>{
  const doc=interactionStyleFixture(),button=doc.pages[0].widgets.find(widget=>widget.name==='Stateful button')!;
  button.mouseOverStyle={fill:button.style.fill};doc.pages[0].adaptiveViews=[{id:'mobile-effect-view',name:'Mobile',width:390,overrides:{[button.id]:{style:{fill:'#00ccdd'}}}}];
  await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'adaptive-effects.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  const check=async(scope:Page|ReturnType<Page['locator']>)=>{const target=scope.locator('.widget[aria-label="Stateful button"]');await expect(target).toHaveCSS('background-color','rgb(0, 204, 221)');await target.hover();await expect(target).toHaveCSS('background-color','rgb(255, 255, 255)')};
  if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await page.getByTitle('Mobile',{exact:true}).click();await check(page.locator('.preview-overlay'))}
  else{const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('adaptive-effects.html');await(await download).saveAs(file);const context=await browser.newContext({offline:true,viewport:{width:390,height:900}});try{const offline=await context.newPage();await offline.goto(pathToFileURL(file).href);await check(offline)}finally{await context.close()}}
});
