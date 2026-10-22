import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createDocument,createPage,createWidget,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';

function fixture(){
  const doc=createDocument();doc.name='Page navigation fixture';
  doc.pages=['Alpha','Beta','Gamma'].map(name=>{const page=createPage(name);page.id=name.toLowerCase();
    page.widgets=[{...createWidget('box',80,80),id:'marker-'+page.id,name:name+' marker',text:name+' content',width:160,height:80}];return page});
  doc.pageOrder=doc.pages.map(page=>page.id);return doc;
}
const tabs=(page:Page)=>page.getByRole('tablist',{name:'Open pages',exact:true});
const tab=(page:Page,name:string)=>tabs(page).getByRole('tab',{name,exact:true});
const treePage=(page:Page,name:string)=>page.getByRole('tree',{name:'Pages',exact:true}).getByRole('button',{name,exact:true});
async function open(page:Page,doc=fixture()){
  await page.addInitScript(text=>localStorage.setItem('rea-prototype-document-v1',text),serializeDocument(doc));
  await page.goto('/');await expect(tab(page,'Alpha')).toHaveAttribute('aria-selected','true');
}
async function openAll(page:Page){for(const name of ['Beta','Gamma'])await treePage(page,name).dblclick();await expect(tabs(page).getByRole('tab')).toHaveText(['Alpha','Beta','Gamma'])}
async function active(page:Page,name:string){await expect(tab(page,name)).toHaveAttribute('aria-selected','true');await expect(page.locator('.editor-widget')).toHaveText(name+' content')}
async function chord(page:Page,key:string){await page.locator('.canvas-surface').focus();await page.keyboard.press(key)}
async function save(page:Page,info:TestInfo,name:string):Promise<Document>{const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(name+'.rea.json');await(await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8'))}

test('visual next and previous follow reordered tabs and wrap without changing page data',async({page},info)=>{
  await open(page);await openAll(page);const before=await save(page,info,'before');
  await tab(page,'Gamma').dragTo(tab(page,'Alpha'),{targetPosition:{x:2,y:12}});
  await expect(tabs(page).getByRole('tab')).toHaveText(['Gamma','Alpha','Beta']);
  await tab(page,'Beta').click();await chord(page,'Control+Alt+ArrowRight');await active(page,'Gamma');
  await chord(page,'Control+Alt+ArrowRight');await active(page,'Alpha');
  await chord(page,'Control+Alt+ArrowLeft');await active(page,'Gamma');
  await chord(page,'Control+Alt+Shift+ArrowRight');await active(page,'Gamma');
  expect(await save(page,info,'after')).toEqual(before);
});

test('close and close-all keyboard commands affect tabs, preserve pages and leave Gallery usable',async({page},info)=>{
  await open(page);await openAll(page);const before=await save(page,info,'before');
  await chord(page,'Control+w');await expect(tab(page,'Gamma')).toHaveCount(0);await expect(tabs(page).getByRole('tab')).toHaveCount(2);
  await chord(page,'Control+Shift+w');await expect(tabs(page).getByRole('tab')).toHaveCount(0);await expect(page.locator('.gallery')).toBeVisible();
  expect(await save(page,info,'closed')).toEqual(before);
  await treePage(page,'Beta').dblclick();await active(page,'Beta');await expect(tabs(page).getByRole('tab')).toHaveCount(1);
  await chord(page,'Control+Alt+ArrowRight');await active(page,'Beta');
  await chord(page,'Control+w');await expect(page.locator('.gallery')).toBeVisible();
  expect(await save(page,info,'last-closed')).toEqual(before);
});

test('tab navigation reaches focused page tree and tab buttons without reordering the page tree',async({page},info)=>{
  await open(page);await openAll(page);const before=await save(page,info,'before');
  await treePage(page,'Alpha').focus();await page.keyboard.press('Control+Alt+ArrowLeft');await active(page,'Beta');
  await tab(page,'Beta').focus();await page.keyboard.press('Control+Alt+ArrowRight');await active(page,'Gamma');
  await page.getByTitle('Close Gamma',{exact:true}).focus();await page.keyboard.press('Control+w');await expect(tab(page,'Gamma')).toHaveCount(0);
  expect(await save(page,info,'after')).toEqual(before);
});

test('a focused numeric draft commits to the outgoing page before keyboard navigation',async({page},info)=>{
  await open(page);await openAll(page);await tab(page,'Alpha').click();await page.locator('.editor-widget').click();
  const width=page.getByRole('complementary',{name:'Properties inspector'}).getByLabel('W',{exact:true});
  await width.fill('240');await width.press('Control+Alt+ArrowRight');await active(page,'Beta');
  const saved=await save(page,info,'edited');expect(saved.pages[0].widgets[0].width).toBe(240);expect(saved.pages[1].widgets[0].width).toBe(160);
  await chord(page,'Control+z');const undone=await save(page,info,'undo');expect(undone.pages[0].widgets[0].width).toBe(160);
});

test('access history goes backward and forward without wrap, preserves revisits and replaces a forward branch',async({page},info)=>{
  await open(page);await openAll(page);const before=await save(page,info,'before');
  await tab(page,'Alpha').click(); // A B C A, not an MRU list
  for(const name of ['Gamma','Beta','Alpha','Alpha']){await chord(page,'Control+Shift+Tab');await active(page,name)}
  await chord(page,'Control+Tab');await active(page,'Beta');
  await tab(page,'Beta').click(); // activating the same page preserves forward history
  await chord(page,'Control+Tab');await active(page,'Gamma');
  await chord(page,'Control+Tab');await active(page,'Alpha');
  await chord(page,'Control+Tab');await active(page,'Alpha');
  await chord(page,'Control+Shift+Tab');await active(page,'Gamma');
  await tab(page,'Beta').click(); // A B C B, forward A is gone
  await chord(page,'Control+Tab');await active(page,'Beta');
  await treePage(page,'Alpha').focus();await page.keyboard.press('Control+Shift+Tab');await active(page,'Gamma');
  await chord(page,'Control+Tab');await active(page,'Beta');
  expect(await save(page,info,'after')).toEqual(before);
  await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
});

test('closing an active tab uses the adjusted visit cursor, removes every old visit and reopening starts a new visit',async({page},info)=>{
  await open(page);await openAll(page);await tab(page,'Alpha').click();await tab(page,'Gamma').click(); // A B C A C
  const before=await save(page,info,'before');
  await chord(page,'Control+w');await active(page,'Alpha'); // visual neighbor would have been Beta
  await chord(page,'Control+Shift+Tab');await active(page,'Beta');
  await chord(page,'Control+w');await active(page,'Alpha');
  await chord(page,'Control+Tab');await active(page,'Alpha');
  await treePage(page,'Gamma').dblclick();await active(page,'Gamma');
  await chord(page,'Control+Shift+Tab');await active(page,'Alpha');
  await chord(page,'Control+Tab');await active(page,'Gamma');
  expect(await save(page,info,'after')).toEqual(before);
});

test('modal and tab menus consume navigation while unsupported modified tree/tab arrows cannot mutate pages',async({page},info)=>{
  await open(page);await openAll(page);const before=await save(page,info,'before');
  await chord(page,'Control+/');await expect(page.locator('.quick-dialog')).toBeVisible();
  await page.keyboard.press('Control+Alt+ArrowLeft');await page.keyboard.press('Control+Shift+w');await active(page,'Gamma');
  await page.keyboard.press('Escape');await expect(page.locator('.quick-dialog')).toHaveCount(0);
  await tab(page,'Beta').click({button:'right'});await expect(page.getByRole('menu',{name:'Tab actions'})).toBeVisible();
  await page.keyboard.press('Control+w');await active(page,'Gamma');await expect(tabs(page).getByRole('tab')).toHaveCount(3);
  await page.getByRole('menu',{name:'Tab actions'}).getByRole('menuitem',{name:'Close tab',exact:true}).focus();await page.keyboard.press('Escape');
  await treePage(page,'Beta').focus();await page.keyboard.press('Control+Alt+Shift+ArrowLeft');await page.keyboard.press('Control+Alt+Tab');
  await tab(page,'Gamma').focus();await page.keyboard.press('Control+Alt+Shift+ArrowLeft');await active(page,'Gamma');
  expect(await save(page,info,'after')).toEqual(before);
});

test('closing an intervening page does not trap the cursor on adjacent repeat visits',async({page})=>{
  await open(page);await openAll(page);await tab(page,'Beta').click();await tab(page,'Alpha').click(); // A B C B A
  await page.getByTitle('Close Gamma',{exact:true}).click(); // A B B A
  for(const name of ['Beta','Beta','Alpha']){await chord(page,'Control+Shift+Tab');await active(page,name)}
  await chord(page,'Control+Tab');await active(page,'Beta');await chord(page,'Control+Tab');await active(page,'Beta');await chord(page,'Control+Tab');await active(page,'Alpha');
});

test('closing the last retained visit seeds the first still-open tab as the fallback history',async({page})=>{
  const doc=fixture(),delta=createPage('Delta');delta.id='delta';delta.widgets=[{...createWidget('box',80,80),text:'Delta content'}];doc.pages.push(delta);doc.pageOrder!.push(delta.id);
  await open(page,doc);await openAll(page);
  await chord(page,'Control+Shift+Tab');await chord(page,'Control+Shift+Tab');await active(page,'Alpha');
  await treePage(page,'Delta').dblclick();await active(page,'Delta'); // history A D; B,C still open
  await page.getByTitle('Close Alpha',{exact:true}).click();await chord(page,'Control+w');await active(page,'Beta');
  await chord(page,'Control+Alt+ArrowRight');await active(page,'Gamma');await chord(page,'Control+Shift+Tab');await active(page,'Beta');
});

type FontGate = Window & { navigationFonts: { calls:number; release():Promise<void>; restore():void } };
async function gateFonts(page:Page,fail=false){
  await page.evaluate(async fail=>{
    await document.fonts.ready;
    const originalLoad=document.fonts.load,originalRect=Range.prototype.getBoundingClientRect;
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});const outstanding:Promise<FontFace[]>[]=[];
    const probe={calls:0,async release(){release();await Promise.allSettled(outstanding);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))},restore(){document.fonts.load=originalLoad;Range.prototype.getBoundingClientRect=originalRect}};
    document.fonts.load=function(font,text){probe.calls++;const work=gate.then(()=>originalLoad.call(this,font,text));outstanding.push(work);return work};
    Range.prototype.getBoundingClientRect=function(){const node=this.commonAncestorContainer,element=node instanceof Element?node:node.parentElement;if(fail&&element?.closest('[data-selection-author-measure]'))throw Error('Intentional navigation measurement failure');return originalRect.call(this)};
    (window as unknown as FontGate).navigationFonts=probe;
  },fail);
}
async function editSelectionText(page:Page,fit=true){
  const doc=fixture(),widget=createWidget('checkbox',80,80);
  Object.assign(widget,{id:'selection-draft',name:'Draft check',text:'Original draft',width:160,height:40,selectionText:{autoFitWidth:fit,autoFitHeight:false,alignRight:false}});
  Object.assign(widget.style,{fontFamily:'monospace',fontSize:16,textPadding:[0,0,0,0],verticalAlign:'top',selectionButtonSize:14,radius:0});doc.pages[0].widgets=[widget];
  await open(page,doc);await openAll(page);await tab(page,'Alpha').click();
  await page.locator('.editor-widget.checkbox').click({position:{x:25,y:15}});
  await expect(page.locator('.editor-widget.checkbox label')).toHaveAttribute('data-selection-fonts','ready');
  await page.getByRole('button',{name:'Edit formatted text',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Formatted text content',exact:true});
  await editor.click();await page.keyboard.press('Control+a');await page.keyboard.insertText('Keep this measured draft');return {doc,editor};
}

test('keyboard navigation waits for a rich draft measurement then switches and undo restores only the edit',async({page},info)=>{
  const {doc,editor}=await editSelectionText(page);await gateFonts(page);
  await editor.press('Control+Alt+ArrowRight');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as FontGate).navigationFonts.calls)).toBeGreaterThan(0);
  await expect(tab(page,'Alpha')).toHaveAttribute('aria-selected','true');await expect(editor).toHaveAttribute('aria-readonly','true');
  await page.evaluate(()=>(window as unknown as FontGate).navigationFonts.release());await active(page,'Beta');await expect(editor).toHaveCount(0);
  const changed=await save(page,info,'rich-committed');expect(changed.pages[0].widgets[0].text).toBe('Keep this measured draft');expect(changed.pages[1]).toEqual(doc.pages[1]);
  await chord(page,'Control+z');expect(await save(page,info,'rich-undo')).toEqual(doc);await active(page,'Beta');
});

test('failed rich measurement retains its draft and Cancel prevents deferred keyboard navigation',async({page},info)=>{
  const {doc,editor}=await editSelectionText(page);await gateFonts(page,true);
  await editor.press('Control+w');await expect(editor).toHaveAttribute('aria-readonly','true');
  await page.evaluate(()=>(window as unknown as FontGate).navigationFonts.release());await expect(editor).toHaveAttribute('aria-readonly','false');
  await expect(tab(page,'Alpha')).toHaveAttribute('aria-selected','true');await expect(editor).toContainText('Keep this measured draft');
  await expect(page.getByText('Text could not be applied. Your draft is still available; retry or cancel.',{exact:true})).toBeVisible();
  await page.evaluate(()=>(window as unknown as FontGate).navigationFonts.restore());await gateFonts(page);
  await editor.press('Control+Alt+ArrowRight');await expect(editor).toHaveAttribute('aria-readonly','true');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(editor).toHaveCount(0);
  await page.evaluate(()=>(window as unknown as FontGate).navigationFonts.release());await expect(tab(page,'Alpha')).toHaveAttribute('aria-selected','true');
  expect(await save(page,info,'cancelled')).toEqual(doc);await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
});

test('a pending numeric layout blocks navigation until it completes and a fresh chord can proceed',async({page},info)=>{
  const {doc}=await editSelectionText(page,false);await page.getByRole('button',{name:'Cancel',exact:true}).click();await gateFonts(page);
  const width=page.getByRole('complementary',{name:'Properties inspector'}).getByLabel('W',{exact:true});
  await width.fill('240');await width.press('Control+Alt+ArrowRight');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as FontGate).navigationFonts.calls)).toBeGreaterThan(0);
  await expect(tab(page,'Alpha')).toHaveAttribute('aria-selected','true');await expect(page.locator('.statusbar')).toContainText('Wait for the selection layout update');
  await page.evaluate(()=>(window as unknown as FontGate).navigationFonts.release());await expect(width).toHaveValue('240');
  await chord(page,'Control+Alt+ArrowRight');await active(page,'Beta');
  expect((await save(page,info,'layout-accepted')).pages[0].widgets[0].width).toBe(240);
  await chord(page,'Control+z');expect(await save(page,info,'layout-undo')).toEqual(doc);
});

test('page navigation cancels an in-flight canvas gesture without creating an undo entry',async({page},info)=>{
  await open(page);await openAll(page);await tab(page,'Alpha').click();const before=await save(page,info,'before');
  const box=await page.locator('.editor-widget').boundingBox();expect(box).not.toBeNull();
  await page.mouse.move(box!.x+30,box!.y+20);await page.mouse.down();await page.mouse.move(box!.x+90,box!.y+50,{steps:4});
  await page.keyboard.press('Control+Alt+ArrowRight');await page.mouse.up();await active(page,'Beta');
  expect(await save(page,info,'cancelled-gesture')).toEqual(before);await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
});
