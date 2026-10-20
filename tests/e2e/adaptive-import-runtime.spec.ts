import { expect,test } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { importRpSemantics } from '../../src/model/import-rp';
import { parseDocument,serializeDocument } from '../../src/model/document';
// @ts-expect-error Test-only raw carrier, independently encoded rather than Axure output.
import { makeSyntheticAdaptiveRp } from '../../scripts/synthetic-rp-adaptive-fixture.mjs';
// @ts-expect-error The real bounded native container/object/semantic reader.
import { inspectRpSemantics } from '../../research/scripts/read-rp-semantics.mjs';
// @ts-expect-error Executable shared scenario also runs against the exact Windows package.
import { exerciseAdaptiveImport } from '../../scripts/adaptive-import-scenario.mjs';

for(const mode of ['preview','offline'] as const)test(`${mode}: raw RP adaptive definitions, local declarations and native actions survive save/reopen`,async({page,browser},info)=>{
  const {bytes,manifest}=makeSyntheticAdaptiveRp(),rawPath=info.outputPath('SYNTHETIC-adaptive.raw.rp');await writeFile(rawPath,bytes);
  const recovered=inspectRpSemantics(rawPath),result=importRpSemantics(recovered,'SYNTHETIC adaptive import'),doc=parseDocument(serializeDocument(result.document));
  expect(result.report.widgetsImported).toBe(6);expect(result.report.eventsImported).toBe(4);expect(result.report.eventsSkipped).toBe(0);expect(result.report.actionsImported).toBe(3);
  expect(doc.adaptiveViewSets).toHaveLength(1);expect(doc.pages[0].adaptiveViewSetId).toBe(`rp-avs-${manifest.ids.set}`);
  const source=serializeDocument(doc),errors:string[]=[],network:string[]=[];await writeFile(info.outputPath('adaptive-import-source.rea.json'),source);
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('/');
  const open=async(data:string)=>{const choose=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await choose).setFiles({name:'SYNTHETIC-adaptive.rea.json',mimeType:'application/json',buffer:Buffer.from(data)});await expect(page.locator('.titlebar')).toContainText(doc.name);};
  const save=async(suffix:string)=>{const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`adaptive-import-${suffix}.rea.json`);await(await download).saveAs(file);const data=await readFile(file,'utf8');expect(JSON.parse(data)).toEqual(doc);return data;};
  await open(source);await open(await save('initial'));await save('reopened');
  const context=mode==='offline'?await browser.newContext({offline:true,viewport:{width:1200,height:1000}}):undefined;let player=page,scope=page.locator('.preview-overlay');
  if(context){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('adaptive-import.html');await(await pending).saveAs(html);await context.route(/^https?:\/\//,r=>{network.push(r.request().url());return r.abort();});player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(pathToFileURL(html).href);scope=player.locator('main').first();}
  else await page.getByTitle('Preview (F5)',{exact:true}).click();
  try{const checks=await exerciseAdaptiveImport(scope,{selection:(mode==='preview'?scope:player).getByRole('combobox',{name:'Adaptive view',exact:true}),mobile:()=>mode==='preview'?scope.getByTitle('Mobile',{exact:true}).click():player.setViewportSize({width:390,height:1000}),capture:(suffix:string)=>player.screenshot({path:info.outputPath(`adaptive-import-${mode}-${suffix}.png`),fullPage:true})},manifest.ids);await writeFile(info.outputPath('checks.json'),JSON.stringify({checks,rawSha256:manifest.rawSha256,report:result.report},null,2));}
  finally{if(context)await context.close();else await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  await save('after-runtime');expect(errors).toEqual([]);expect(network).toEqual([]);
});
