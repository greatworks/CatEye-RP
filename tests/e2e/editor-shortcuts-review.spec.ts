import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createDocument,createWidget,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';
import {nativePointEditingFixture} from '../fixtures/native-point-editing';

async function open(page:Page,doc:Document){
  await page.addInitScript(text=>localStorage.setItem('rea-prototype-document-v1',text),serializeDocument(doc));
  await page.goto('/');await expect(page.locator('.canvas-surface')).toBeVisible();
}
async function save(page:Page,info:TestInfo,name:string){
  const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();
  const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'));
}
test('modified Delete and Escape do not fall through to vector anchor commands',async({page},info)=>{
  await open(page,nativePointEditingFixture());await page.locator('.editor-widget').click();
  await page.keyboard.press('Control+Alt+p');
  const overlay=page.locator('.vector-canvas-overlay[data-vector-mode="points"]');
  const anchors=overlay.locator('[data-vector-anchor]:not([data-vector-handle])');
  await anchors.first().click();const count=await anchors.count();const before=await save(page,info,'before');
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Shift+Delete');
  expect(await save(page,info,'shift-delete')).toEqual(before);await expect(anchors).toHaveCount(count);
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Shift+Escape');await expect(overlay).toBeVisible();
  await page.keyboard.press('Control+Shift+Alt+p');await expect(overlay).toBeVisible();
  await page.keyboard.press('Delete');await expect(anchors).toHaveCount(count-1);
  await page.keyboard.press('Control+z');expect(await save(page,info,'undo')).toEqual(before);
});
test('quick actions and variables shield the canvas even when a modal button has focus',async({page},info)=>{
  const doc=createDocument();doc.pages[0].widgets=[createWidget('box',80,80),createWidget('box',300,200)];
  await open(page,doc);await page.locator('.editor-widget').first().click();await page.keyboard.press('Control+a');
  const before=await save(page,info,'before');
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+/');
  await page.locator('.quick-dialog section button').first().focus();
  await page.keyboard.press('Control+Alt+c');await page.keyboard.press('Delete');
  await expect(page.locator('.editor-widget')).toHaveCount(2);await expect(page.locator('.editor-widget').first()).toHaveCSS('left','80px');
  await page.keyboard.press('Escape');await expect(page.locator('.quick-dialog')).toHaveCount(0);
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(2);
  expect(await save(page,info,'after-quick')).toEqual(before);
  await page.locator('.menubar').getByRole('button',{name:'Project',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('button',{name:'Global variables',exact:true}).click();
  await page.locator('.variables-dialog').getByRole('button',{name:'Add variable',exact:true}).focus();
  await page.keyboard.press('Control+Alt+c');await page.keyboard.press('Delete');
  await expect(page.locator('.editor-widget')).toHaveCount(2);await expect(page.locator('.editor-widget').first()).toHaveCSS('left','80px');
  await page.keyboard.press('Escape');await expect(page.locator('.variables-dialog')).toHaveCount(0);
  expect(await save(page,info,'after-variables')).toEqual(before);
});
