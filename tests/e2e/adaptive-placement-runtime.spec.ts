import {expect,test} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {importRpSemantics} from '../../src/model/import-rp';
import {parseDocument,serializeDocument} from '../../src/model/document';
// @ts-expect-error Independent raw test encoder, not Axure-produced output.
import {makeSyntheticPlacementRp} from '../../scripts/synthetic-rp-placement-fixture.mjs';
// @ts-expect-error Real bounded native reader.
import {inspectRpSemantics} from '../../research/scripts/read-rp-semantics.mjs';
// @ts-expect-error Shared production browser and exact desktop test scenario.
import {exerciseAdaptivePlacement} from '../../scripts/adaptive-placement-scenario.mjs';

for(const mode of ['preview','offline'] as const)test(`${mode}: native placement inheritance and reset survive raw RP recovery and save/reopen`,async({page,browser},info)=>{
  const {bytes,manifest}=makeSyntheticPlacementRp(),raw=info.outputPath('SYNTHETIC-placement.raw.rp');await writeFile(raw,bytes);
  const result=importRpSemantics(inspectRpSemantics(raw),'SYNTHETIC placement'),doc=parseDocument(serializeDocument(result.document));
  expect(result.report.widgetsImported).toBe(6);expect(result.report.widgetsSkipped).toBe(0);
  const source=serializeDocument(doc),errors:string[]=[],network:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('/');
  const open=async(data:string)=>{const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'SYNTHETIC-placement.rea.json',mimeType:'application/json',buffer:Buffer.from(data)});await expect(page.locator('.titlebar')).toContainText(doc.name);};
  const save=async(suffix:string)=>{const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`placement-${suffix}.rea.json`);await(await pending).saveAs(file);const data=await readFile(file,'utf8');expect(JSON.parse(data)).toEqual(doc);return data;};
  await open(source);await open(await save('initial'));await save('reopened');
  const context=mode==='offline'?await browser.newContext({offline:true,viewport:{width:1200,height:1000}}):undefined;let player=page,scope=page.locator('.preview-overlay');
  if(context){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('placement.html');await(await pending).saveAs(html);await context.route(/^https?:\/\//,route=>{network.push(route.request().url());return route.abort();});player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(pathToFileURL(html).href);scope=player.locator('main').first();}
  else await page.getByTitle('Preview (F5)',{exact:true}).click();
  try{const checks=await exerciseAdaptivePlacement(scope,{selection:(mode==='preview'?scope:player).getByRole('combobox',{name:'Adaptive view',exact:true}),mobile:()=>mode==='preview'?scope.getByTitle('Mobile',{exact:true}).click():player.setViewportSize({width:390,height:1000}),capture:(suffix:string)=>player.screenshot({path:info.outputPath(`placement-${mode}-${suffix}.png`),fullPage:true})},manifest.ids);await writeFile(info.outputPath('checks.json'),JSON.stringify({checks,rawSha256:manifest.rawSha256,report:result.report},null,2));}
  finally{if(context)await context.close();else await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  await save('after-runtime');expect(errors).toEqual([]);expect(network).toEqual([]);
});
