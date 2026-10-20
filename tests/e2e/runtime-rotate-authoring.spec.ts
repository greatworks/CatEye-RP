import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createDocument,createWidget,parseDocument,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
async function open(page:Page,doc:Document){await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'rotate.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
function fixture(){const doc=createDocument();doc.name='Rotation authoring';doc.pages[0].widgets=[createWidget('button',40,50),createWidget('box',300,100)];doc.pages[0].widgets[0].text='Turn';doc.pages[0].widgets[1].name='Turn target';return doc;}
async function addRotate(page:Page){await page.locator('.canvas-surface .editor-widget.button').click();await inspector(page).getByRole('tab',{name:'Interactions',exact:true}).click();await inspector(page).getByRole('button',{name:'New interaction',exact:true}).click();await inspector(page).getByRole('button',{name:'Add action',exact:true}).click();await inspector(page).getByLabel('Action 1 type',{exact:true}).selectOption('rotate');}

test('authors full Rotate parameters and preserves them through undo, redo and reopening',async({page},info)=>{
 const doc=fixture();await open(page,doc);await addRotate(page);const ui=inspector(page);
 await ui.getByLabel('Action 1 target',{exact:true}).selectOption(doc.pages[0].widgets[1].id);
 await expect(ui.getByLabel('Rotation mode',{exact:true})).toHaveValue('by');await expect(ui.getByLabel('Rotation degrees',{exact:true})).toHaveValue('0');await expect(ui.getByLabel('Rotation duration',{exact:true})).toBeDisabled();
 await expect(ui.getByLabel('Rotation animation',{exact:true}).locator('option')).toHaveCount(33);
 await ui.getByLabel('Rotation mode',{exact:true}).selectOption('to');await ui.getByLabel('Rotation degrees',{exact:true}).fill('[[Turn + 0.5]]');await ui.getByLabel('Rotation direction',{exact:true}).selectOption('counterclockwise');await ui.getByLabel('Rotation anchor',{exact:true}).selectOption('bottom right');await ui.getByLabel('Rotation offset X',{exact:true}).fill('[[Target.width / 2]]');await ui.getByLabel('Rotation offset Y',{exact:true}).fill('-12.25');await ui.getByLabel('Rotation animation',{exact:true}).selectOption('easeOutElastic');
 const before=await save(page,info,'before-duration');await ui.getByLabel('Rotation duration',{exact:true}).fill('1250');await ui.getByLabel('Rotation duration',{exact:true}).press('Tab');
 const saved=await save(page,info,'rotation');expect(saved.pages[0].widgets[0].interactions[0].actions[0]).toMatchObject({type:'rotate',targetId:doc.pages[0].widgets[1].id,rotate:{mode:'to',degrees:'[[Turn + 0.5]]',clockwise:false,anchor:'bottom right',offsetX:'[[Target.width / 2]]',offsetY:'-12.25',easing:'easeOutElastic',duration:1250}});
 await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(before);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redo')).toEqual(saved);await open(page,saved);expect(await save(page,info,'reopened')).toEqual(saved);
});

test('changing the action kind clears incompatible rotation fields',async({page},info)=>{
 const doc=fixture();await open(page,doc);await addRotate(page);const ui=inspector(page);await ui.getByLabel('Rotation degrees',{exact:true}).fill('45');await ui.getByLabel('Action 1 type',{exact:true}).selectOption('wait');
 const saved=await save(page,info,'wait');expect(saved.pages[0].widgets[0].interactions[0].actions[0]).toEqual(expect.objectContaining({type:'wait',duration:500}));expect(saved.pages[0].widgets[0].interactions[0].actions[0]).not.toHaveProperty('rotate');await expect(ui.getByRole('group',{name:'Rotation action',exact:true})).toHaveCount(0);
});

test('offers an existing sibling group and rotates its members about their shared center',async({page},info)=>{
 const doc=fixture(),first=doc.pages[0].widgets[1],second=createWidget('box',500,100);
 Object.assign(first,{id:'group-first',groupId:'rotation-group',width:100,height:60});
 Object.assign(second,{id:'group-second',groupId:'rotation-group',width:100,height:60,name:'Second member'});
 doc.pages[0].widgets.push(second);await open(page,doc);await addRotate(page);const ui=inspector(page);
 await ui.getByLabel('Action 1 target',{exact:true}).selectOption('rotation-group');await ui.getByLabel('Rotation degrees',{exact:true}).fill('90');
 const saved=await save(page,info,'group');expect(saved.pages[0].widgets[0].interactions[0].actions[0].targetId).toBe('rotation-group');
 await page.getByTitle('Preview (F5)',{exact:true}).click();const preview=page.locator('.preview-overlay');await preview.locator(`[data-widget-id="${doc.pages[0].widgets[0].id}"]`).click();
 for(const[id,top]of [['group-first',0],['group-second',200]] as const){const target=preview.locator(`[data-widget-id="${id}"]`);await expect.poll(()=>target.evaluate(node=>{const s=getComputedStyle(node),m=new DOMMatrixReadOnly(s.transform);return{left:Math.round(parseFloat(s.left)),top:Math.round(parseFloat(s.top)),sine:Math.round(m.b)};})).toEqual({left:400,top,sine:1});}
 await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save(page,info,'after-group-preview')).toEqual(saved);
});
