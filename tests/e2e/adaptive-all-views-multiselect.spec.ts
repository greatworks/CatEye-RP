import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createDocument,createWidget,parseDocument,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';

function fixture():Document {
  const doc=createDocument();doc.name='Independent padding in a mixed selection';
  const widgets=[createWidget('box',40,80),createWidget('box',340,300),createWidget('box',560,120)];
  widgets.forEach((widget,index)=>{widget.id=`multi-pad-${index}`;widget.name=widget.text=`Padding target ${index+1}`;widget.width=180;widget.height=100;widget.style.textPadding=([1,2,3,4].map(value=>value+index*50) as [number,number,number,number]);});
  doc.pages[0].widgets=widgets;doc.pages[0].adaptiveViews=[];
  doc.adaptiveViewSets=[{id:'multi-pad-set',name:'Padding set',baseSize:{width:1200,height:0},views:[{id:'phone',name:'Phone',width:390}]}];
  doc.pages[0].adaptiveViewSetId='multi-pad-set';delete doc.pages[0].adaptiveSelection;delete doc.pages[0].adaptiveBaseSize;
  doc.pages[0].adaptiveOverrides={phone:{},inactive:{}};
  for(const[index,widget]of widgets.entries()){
    doc.pages[0].adaptiveOverrides.phone[widget.id]={style:{textPadding:[11+index*50,index===2?40:12+index*50,13+index*50,14+index*50],color:'#123456'}};
    doc.pages[0].adaptiveOverrides.inactive[widget.id]={x:77+index,style:{textPadding:[21+index*50,22+index*50,23+index*50,24+index*50]},stateStyles:{}};
  }
  return parseDocument(serializeDocument(doc));
}
async function open(page:Page,doc:Document){
  const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();
  await(await pending).setFiles({name:'multi-padding.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page:Page,info:TestInfo,suffix:string){
  const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${suffix}.rea.json`);
  await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));
}

for(const allViews of [false,true])test(`mixed selection edits only the requested padding side, preserving equal targets; all views ${allViews}`,async({page},info)=>{
  const source=fixture();page.on('dialog',dialog=>dialog.accept());await page.goto('/');await open(page,source);
  await page.getByLabel('Adaptive view',{exact:true}).selectOption('phone');
  for(let index=0;index<3;index++)await page.locator('.canvas-surface .editor-widget.box').filter({hasText:`Padding target ${index+1}`}).click(index?{modifiers:['Shift']}:{});
  await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);
  const padding=page.getByRole('complementary',{name:'Properties inspector'}).getByLabel('Padding right',{exact:true});await padding.fill('40');await padding.press('Tab');
  const expected=structuredClone(source),model=expected.pages[0];
  for(const widget of model.widgets.slice(0,2)){
    if(allViews)widget.style.textPadding![1]=40;
    for(const [viewId,map]of Object.entries(model.adaptiveOverrides!)){
      if(!allViews&&viewId!=='phone')continue;
      const patch=map[widget.id],tuple=patch.style!.textPadding!;delete patch.style!.textPadding;
      if(!Object.keys(patch.style!).length)delete patch.style;
      patch.textPaddingSides={top:tuple[0],bottom:tuple[2],left:tuple[3],...(!allViews?{right:40}:{})};
    }
  }
  expect(await save(page,info,'changed')).toEqual(expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redo')).toEqual(expected);
  await open(page,expected);expect(await save(page,info,'reopened')).toEqual(expected);
});
