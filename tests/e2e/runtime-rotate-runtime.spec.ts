import {expect,test,type Page,type Locator,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {serializeDocument} from '../../src/model/document';
import {runtimeRotateFixture} from '../fixtures/runtime-rotate';

async function open(page:Page){const doc=runtimeRotateFixture();await writeFile('artifacts/runtime-rotate-source.rea.json',serializeDocument(doc));await page.goto('/');const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'runtime-rotate.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);return doc;}
const widget=(scope:Page|Locator,id:string)=>scope.locator(`[data-widget-id="${id}"]`);
const geometry=(target:Locator)=>target.evaluate(node=>{const css=getComputedStyle(node),matrix=new DOMMatrixReadOnly(css.transform);return{x:parseFloat(css.left),y:parseFloat(css.top),a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d};});
async function finalAngle(target:Locator,degrees:number){const angle=degrees*Math.PI/180;await expect.poll(async()=>{const m=await geometry(target);return Math.abs(m.a-Math.cos(angle))+Math.abs(m.b-Math.sin(angle));}).toBeLessThan(.00001);}
async function exercise(scope:Page|Locator){
 const target=widget(scope,'rotate-shape');await widget(scope,'rotate-by').click();await finalAngle(target,90);await expect(widget(scope,'rotate-events')).toContainText('Rotated events: 1');
 await widget(scope,'rotate-to').click();await finalAngle(target,0);await expect(widget(scope,'rotate-events')).toContainText('Rotated events: 2');
 await widget(scope,'rotate-pivot').click();
 await expect.poll(async()=>{const m=await geometry(target);return m.b>.05&&m.b<.95;},{intervals:[15,20,25]}).toBe(true);
 await finalAngle(target,90);await expect.poll(async()=>{const m=await geometry(target);return Math.abs(m.x-80)+Math.abs(m.y-245);}).toBeLessThan(.05);
 const input=widget(scope,'rotate-input');await widget(scope,'rotate-input-orbit').click();await expect.poll(async()=>{const m=await geometry(input);return Math.abs(m.x-480)+Math.abs(m.y-245);}).toBeLessThan(.05);await finalAngle(input,0);await expect(input.locator('input')).toHaveValue('Editable input');
 const rows=widget(scope,'rotate-row-shape'),buttons=widget(scope,'rotate-row-button');await expect(rows).toHaveCount(2);await buttons.first().click();await finalAngle(rows.first(),180);await finalAngle(rows.nth(1),0);await buttons.nth(1).click();await finalAngle(rows.nth(1),180);
 const frame=widget(scope,'rotate-frame').locator('iframe').contentFrame();const inner=frame.locator('[data-widget-id="rotate-child-shape"]');await frame.locator('[data-widget-id="rotate-child-button"]').click();await finalAngle(inner,180);
}

test('preview rotates over time, preserves local pivots, and isolates rows and embedded frames',async({page},info)=>{
 const original=await open(page);await page.getByTitle('Preview (F5)',{exact:true}).click();const preview=page.locator('.preview-overlay');await exercise(preview);await preview.screenshot({path:info.outputPath('preview.png')});await page.getByRole('button',{name:'Close preview',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath('after-preview.rea.json');await(await pending).saveAs(file);expect(JSON.parse(await readFile(file,'utf8'))).toEqual(original);
});

test('portable offline HTML executes the same motion and frame behavior without network',async({page,browser},info)=>{
 const original=await open(page),pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('rotation.html');await(await pending).saveAs(file);
 const context=await browser.newContext({offline:true}),offline=await context.newPage(),errors:string[]=[],requests:string[]=[];offline.on('pageerror',error=>errors.push(error.message));context.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
 try{await offline.goto(pathToFileURL(file).href);await exercise(offline);await offline.screenshot({path:info.outputPath('offline.png')});expect(errors).toEqual([]);expect(requests).toEqual([]);}finally{await context.close();}
 await writeFile(info.outputPath('source.rea.json'),serializeDocument(original));
});
