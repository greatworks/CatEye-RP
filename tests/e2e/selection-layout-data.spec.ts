import {expect,test,type Page,type Locator} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createDocument,createWidget,serializeDocument,uid} from '../../src/model/document';

for(const mode of ['preview','offline'] as const) test(`${mode}: selection layout data survives save and native SetText paints structural breaks`,async({page,browser},info)=>{
  const doc=createDocument();doc.name='Selection layout data';doc.caseSelection='never';
  const targets=(['checkbox','radio'] as const).map((type,index)=>{
    const widget=createWidget(type,60,120+index*90);
    Object.assign(widget,{name:`Layout ${type}`,text:'Before',width:240,height:60,
      selectionText:{autoFitWidth:true,autoFitHeight:false,alignRight:false}});
    Object.assign(widget.style,{selectionButtonSize:13+index*5,textPadding:[2,7,3,5],verticalAlign:'top'});
    return widget;
  });
  const button=createWidget('button',60,40);button.name='Change selection text';button.text=button.name;
  const value='One\n\n<b>Two</b>';
  button.interactions=[{id:uid(),event:'click',name:'Set labels',enabled:true,conditions:[],conditionMode:'all',
    actions:targets.map(widget=>({id:uid(),type:'setText',targetId:widget.id,value}))}];
  doc.pages[0].widgets=[button,...targets];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();
  const chooser=page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();
  await (await chooser).setFiles({name:'selection-layout.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  const saved=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();
  const savedPath=info.outputPath('selection-layout.rea.json');await (await saved).saveAs(savedPath);
  expect(JSON.parse(await readFile(savedPath,'utf8'))).toEqual(doc);
  async function exercise(scope:Page|Locator) {
    await scope.getByRole('button',{name:button.name,exact:true}).click();
    for(const target of targets) {
      const owner=scope.locator(`.widget[data-widget-id="${target.id}"], .widget[data-id="${target.id}"]`);
      await expect(owner).toHaveCount(1);
      await expect(owner.locator('[data-rich-paragraph]')).toHaveCount(1);
      const run=owner.locator('[data-rich-run]');await expect(run).toHaveCount(1);
      expect(await run.evaluate(element=>Array.from(element.childNodes,node=>[node.nodeName,node.textContent]))).toEqual([
        ['SPAN','One'],['BR',''],['BR',''],['SPAN','<b>Two</b>'],
      ]);
      await expect(owner.locator('b')).toHaveCount(0);
      // Native selection Resize is skipped, and these controls align left/top.
      // DOM measurement must still preserve the saved owner geometry.
      expect(await owner.evaluate(element=>{
        const style=(element as HTMLElement).style;
        return {x:parseFloat(style.left),y:parseFloat(style.top),width:parseFloat(style.width),height:parseFloat(style.height)};
      })).toEqual({x:target.x,y:target.y,width:target.width,height:target.height});
    }
    await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
  }
  if(mode==='preview') {
    await page.getByTitle('Preview (F5)',{exact:true}).click();
    await exercise(page.locator('.preview-overlay'));
  } else {
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();
    const html=info.outputPath('selection-layout.html');await (await download).saveAs(html);
    const context=await browser.newContext({offline:true,viewport:{width:1600,height:1000}});
    try {
      const exported=await context.newPage(),requests:string[]=[];
      exported.on('pageerror',error=>errors.push(error.message));
      exported.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())});
      await exported.goto(pathToFileURL(html).href);await exercise(exported);
      expect(requests).toEqual([]);
    } finally {await context.close()}
  }
  expect(errors).toEqual([]);
});
