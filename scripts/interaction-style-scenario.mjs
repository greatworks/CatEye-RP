import {expect} from '@playwright/test';

export function interactionStyleFixture(){
  const style={fill:'#ffffff',stroke:'#777777',strokeWidth:1,radius:5,color:'#263348',fontSize:16,fontFamily:'Arial',fontWeight:400,textAlign:'center',opacity:1};
  const widget=(id,type,x,y,text=id,extra={})=>({id,type,name:id,text,x,y,width:210,height:44,rotation:0,style:{...style},hidden:false,locked:false,disabled:false,notes:'',interactions:[],...extra});
  const action=(id,actions)=>[{id:`${id}-event`,event:'click',name:id,enabled:true,conditions:[],conditionMode:'all',actions:actions.map((action,index)=>({id:`${id}-${index}`,...action}))}];
  const stateful=widget('Stateful button','button',32,90,'Hover, press, select, disable',{mouseOverStyle:{fill:'#dcecff',color:'#173866'},mouseDownStyle:{fill:'#ffcc66',strokeWidth:3},selectedStyle:{fill:'#7545cc',color:'#ffffff'},disabledStyle:{fill:'#dde1e8',opacity:.4}});
  const input=widget('Focused field','input',32,245,'Edit me',{mouseOverStyle:{fill:'#dcecff'},mouseDownStyle:{fill:'#ffcc66'},focusedStyle:{stroke:'#b53d7e',strokeWidth:3,color:'#b53d7e'}});
  const hoverInput=widget('Hover field without focus effect','input',290,245,'Focus retains hover',{mouseOverStyle:{fill:'#dcfce7'}});
  const vector=widget('Vector effect','path',580,245,'Vector',{width:180,height:70,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:.05,y:.05},{op:'L',x:.95,y:.05},{op:'L',x:.5,y:.95},{op:'Z'}]},mouseOverStyle:{fill:'#35b88a',stroke:'#173866',strokeWidth:4}});
  const plainDisabled=widget('Disabled without effect','button',580,90,'No automatic opacity',{disabled:true,style:{...style,fill:'#e9f2ff',opacity:.8}});
  const row=widget('Row effect','button',0,0,'[[Item.Name]]',{width:180,height:40,mouseOverStyle:{fill:'#fb7185'},mouseDownStyle:{strokeWidth:4}});
  const repeater=widget('Effect rows','repeater',32,425,'',{width:210,height:120,repeater:{columns:['Name'],rows:[{Name:'First row'},{Name:'Second row'}],template:[row],itemHeight:55,gap:5}});
  const child=widget('Disabled descendant','button',12,12,'Inherited disable',{disabledStyle:{fill:'#cbd5e1',opacity:.65}});
  const panel=widget('Disabled panel','panel',580,420,'',{disabled:true,width:240,height:90,states:[{id:'disabled-panel-state',name:'State 1',widgets:[child]}],activeStateId:'disabled-panel-state'});
  return {format:'rea-prototype',version:1,id:'style-effects-document',name:'Interaction styles',caseSelection:'never',pages:[{id:'style-page',name:'Effects',width:960,height:720,background:'#f7f8fc',notes:'',interactions:[],adaptiveViews:[],widgets:[
    widget('Heading','text',32,20,'Interaction styles',{width:870,style:{...style,fill:'transparent',strokeWidth:0,fontSize:28,fontWeight:600,textAlign:'left'}}),stateful,input,hoverInput,vector,plainDisabled,repeater,panel,
    widget('Toggle selected','button',290,90,'Toggle selection',{interactions:action('toggle',[{type:'setSelected',targetId:stateful.id,value:'toggle'}])}),
    widget('Disable target','button',290,145,'Disable button',{interactions:action('disable',[{type:'disable',targetId:stateful.id}])}),
    widget('Enable target','button',580,145,'Enable button',{interactions:action('enable',[{type:'enable',targetId:stateful.id}])}),
  ]}],components:[],variables:{},styles:[]};
}

export async function exerciseInteractionStyles(page,scope){
  // The Windows host uses a physical scale of 1.5. Independently ask the
  // browser how literal CSS borders quantize, while retaining exact inline checks.
  const borders=await page.evaluate(()=>Object.fromEntries([1,3].map(width=>{const element=document.createElement('div');Object.assign(element.style,{position:'fixed',visibility:'hidden',width:'20px',height:'20px',border:`${width}px solid black`});document.body.append(element);const value=getComputedStyle(element).borderTopWidth;element.remove();return [width,value]})));
  const border=async(element,width)=>{await expect(element).toHaveCSS('border-top-width',borders[width]);expect(await element.evaluate(node=>node.style.borderTopWidth)).toBe(`${width}px`)};
  const widget=name=>scope.locator(`.widget[aria-label="${name}"]`);
  const button=widget('Stateful button');
  const outside=async()=>{const box=await scope.locator('.preview-page, main').boundingBox();await page.mouse.move(box.x+860,box.y+650)};
  await outside();await expect(button).toHaveCSS('background-color','rgb(255, 255, 255)');
  await button.hover();await expect(button).toHaveCSS('background-color','rgb(220, 236, 255)');
  await page.mouse.down();await expect(button).toHaveCSS('background-color','rgb(255, 204, 102)');await border(button,3);
  await outside();await expect(button).toHaveCSS('background-color','rgb(255, 204, 102)');
  await page.mouse.up();await expect(button).toHaveCSS('background-color','rgb(255, 255, 255)');await border(button,1);
  await button.hover();await page.mouse.down({button:'right'});await expect(button).toHaveCSS('background-color','rgb(255, 204, 102)');await outside();await page.mouse.up({button:'right'});await expect(button).toHaveCSS('background-color','rgb(255, 255, 255)');
  await widget('Toggle selected').click();await button.hover();await page.mouse.down();
  await expect(button).toHaveCSS('background-color','rgb(117, 69, 204)');await expect(button).toHaveCSS('color','rgb(255, 255, 255)');await border(button,3);
  await page.mouse.up();await widget('Disable target').click();
  await expect(button).toHaveCSS('background-color','rgb(221, 225, 232)');await expect(button).toHaveCSS('color','rgb(255, 255, 255)');await expect(button).toHaveCSS('opacity','0.4');
  await button.hover();await expect(button).toHaveCSS('background-color','rgb(221, 225, 232)');
  await widget('Enable target').click();await expect(button).toHaveCSS('background-color','rgb(117, 69, 204)');await expect(button).toHaveCSS('opacity','1');
  await widget('Toggle selected').click();await expect(button).toHaveCSS('background-color','rgb(255, 255, 255)');
  const focused=widget('Focused field');await focused.hover();await expect(focused).toHaveCSS('background-color','rgb(220, 236, 255)');
  await focused.locator('input').click();await expect(focused).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(focused).toHaveCSS('border-top-color','rgb(181, 61, 126)');
  await focused.locator('input').fill('Typing preserves focus');await expect(focused.locator('input')).toBeFocused();await border(focused,3);
  const hover=widget('Hover field without focus effect');await hover.locator('input').click();await expect(hover).toHaveCSS('background-color','rgb(220, 252, 231)');await border(focused,1);
  await outside();await expect(hover).toHaveCSS('background-color','rgb(255, 255, 255)');
  await widget('Vector effect').hover();await expect(widget('Vector effect').locator('[data-shadow-fill]')).toHaveAttribute('fill','#35b88a');await expect(widget('Vector effect').locator('[data-shadow-stroke]')).toHaveAttribute('stroke-width','4');
  await outside();await expect(widget('Vector effect').locator('[data-shadow-fill]')).toHaveAttribute('fill','#ffffff');
  const rows=widget('Row effect');await expect(rows).toHaveCount(2);await rows.nth(0).hover();await expect(rows.nth(0)).toHaveCSS('background-color','rgb(251, 113, 133)');await expect(rows.nth(1)).toHaveCSS('background-color','rgb(255, 255, 255)');
  await rows.nth(1).hover();await expect(rows.nth(0)).toHaveCSS('background-color','rgb(255, 255, 255)');await expect(rows.nth(1)).toHaveCSS('background-color','rgb(251, 113, 133)');
  await expect(widget('Disabled without effect')).toHaveCSS('opacity','0.8');await expect(widget('Disabled descendant')).toHaveCSS('background-color','rgb(203, 213, 225)');await expect(widget('Disabled descendant')).toHaveCSS('opacity','0.65');
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
  await outside();
}

export async function presentInteractionStyles(scope){
  await scope.locator('.widget[aria-label="Focused field"] input').focus();
  await scope.locator('.widget[aria-label="Stateful button"]').hover();
  await expect(scope.locator('.widget[aria-label="Focused field"]')).toHaveCSS('border-top-color','rgb(181, 61, 126)');
  await expect(scope.locator('.widget[aria-label="Stateful button"]')).toHaveCSS('background-color','rgb(220, 236, 255)');
}
