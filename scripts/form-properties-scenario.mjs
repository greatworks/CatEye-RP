import {expect} from '@playwright/test';

export function formPropertiesFixture(){
  const style={fill:'#ffffff',stroke:'#a6b0c2',strokeWidth:1,radius:5,color:'#203048',fontSize:16,fontFamily:'Arial',fontWeight:400,textAlign:'left',opacity:1,textPadding:[8,12,8,12]};
  const widget=(id,type,x,y,text='',extra={})=>({id,type,name:id,text,x,y,width:280,height:46,rotation:0,style:{...style},hidden:false,locked:false,disabled:false,notes:'',interactions:[],...extra});
  const interaction=(id,event,actions)=>({id:`${id}-event`,event,name:id,enabled:true,conditionMode:'all',conditions:[],actions:actions.map((a,i)=>({id:`${id}-${i}`,...a}))});
  const log=value=>({type:'setVariable',targetId:'Trace',value:`[[Trace]]${value}`});
  const button=(id,x,y,actions)=>widget(id,'button',x,y,id,{style:{...style,textAlign:'center',fill:'#e8eef9'},interactions:[interaction(id,'click',actions)]});
  const readonly=widget('Read only value','input',40,134,'Keep this text',{readOnly:true});
  const limited=widget('Five characters','input',350,134,'',{maxLength:5});
  const zero=widget('Zero characters','input',660,134,'',{maxLength:0});
  const source=widget('Submit source','input',40,246,'Press Enter',{submitButtonId:'Focus target',interactions:[interaction('source-blur','blur',[log('B')])]});
  const target=widget('Selected target','input',350,246,'Select me',{submitButtonId:'Focus target',focusedStyle:{stroke:'#3e64bf'},interactions:[interaction('target-focus','focus',[log('F')])]});
  const area=widget('Submit message','textarea',40,392,'Message',{height:88,submitButtonId:'Submit count'});
  const readonlyArea=widget('Read only message','textarea',350,392,'View and select\n第二行',{height:88,readOnly:true,submitButtonId:'Submit count'});
  const rowSource=widget('Row source','input',8,8,'[[Item.Name]]',{width:150,submitButtonId:'Row submit'});
  const rowTarget=widget('Row target','input',174,8,'[[Item.Name]] target',{width:190});
  const rowButton=button('Row submit',380,8,[{type:'setFocus',targetId:rowTarget.id,selectText:true}]);rowButton.width=150;
  const rows=widget('Form rows','repeater',40,576,'',{width:550,height:140,repeater:{columns:['Name'],rows:[{Name:'Alpha'},{Name:'Beta'}],template:[rowSource,rowTarget,rowButton],itemHeight:64,gap:6}});
  const label=(id,x,y,text,width=900)=>widget(id,'text',x,y,text,{width,height:38,style:{...style,fill:'transparent',strokeWidth:0,fontSize:14,color:'#68758a'}});
  const widgets=[
    widget('Heading','text',40,28,'Forms, focus and submission',{width:900,height:46,style:{...style,fill:'transparent',strokeWidth:0,fontSize:30,fontWeight:700}}),
    label('Property caption',40,85,'Read only · five-character limit · zero-character limit'),readonly,limited,zero,
    label('Focus caption',40,198,'Enter moves focus and selects text. Focus/Blur actions run before the following action.'),source,target,
    button('Focus target',660,246,[{type:'setFocus',targetId:target.id,selectText:true},log('D')]),
    widget('Focus trace','text',40,303,'[[Trace]]',{width:590,style:{...style,strokeWidth:0,fill:'#eef3fa'}}),
    button('Write long values',660,134,[{type:'setText',targetId:limited.id,value:'Longer than five'},{type:'setText',targetId:readonly.id,value:'Written by action'}]),
    area,readonlyArea,button('Submit count',660,392,[{type:'setVariable',targetId:'Submissions',value:'[[number(Submissions)+1]]'}]),
    widget('Submission result','text',660,450,'Submitted [[Submissions]]',{width:280,style:{...style,strokeWidth:0,fill:'#eef3fa'}}),
    label('Rows caption',40,526,'Enter in the second row focuses that row only.'),rows,
    button('Focus first row',660,576,[{type:'setFocus',targetId:rowTarget.id,selectText:true}]),
  ];
  // The write button has its own row below the entry limits.
  widgets.find(w=>w.id==='Write long values').y=310;
  return{format:'rea-prototype',version:1,id:'form-properties-document',name:'Form properties and focus',caseSelection:'never',pages:[{id:'form-properties-page',name:'Forms',width:990,height:780,background:'#f7f9fc',notes:'',interactions:[],adaptiveViews:[],widgets}],components:[],styles:[],variables:{Trace:'',Submissions:'0'}};
}

export async function exerciseFormProperties(page,scope){
  const widget=name=>scope.locator(`.widget[aria-label="${name}"]`),input=name=>widget(name).locator('input,textarea');
  const readonly=input('Read only value'),limited=input('Five characters'),zero=input('Zero characters');
  await expect(readonly).toHaveJSProperty('readOnly',true);await readonly.click();await readonly.press('ControlOrMeta+A');await readonly.pressSequentially('ignored');await expect(readonly).toHaveValue('Keep this text');
  await expect.poll(()=>readonly.evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual([0,14]);
  await expect(limited).toHaveAttribute('maxlength','5');await limited.click();await limited.pressSequentially('abcdef');await expect(limited).toHaveValue('abcde');
  await zero.click();await zero.pressSequentially('abc');await expect(zero).toHaveValue('');
  await widget('Write long values').click();await expect(limited).toHaveValue('Longer than five');await expect(readonly).toHaveValue('Written by action');
  const source=input('Submit source'),target=input('Selected target');
  await source.click();await source.press('Enter');await expect(target).toBeFocused();await expect(widget('Focus trace')).toHaveText('FBFD');
  await expect.poll(()=>target.evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual([0,9]);
  await target.press('Enter');await expect(widget('Focus trace')).toHaveText('FBFDFFD');await expect(target).toBeFocused();
  await target.pressSequentially('Replacement');await expect(target).toHaveValue('Replacement');
  const area=input('Submit message'),readonlyArea=input('Read only message');
  await area.click();await area.press('End');await page.keyboard.down('Enter');await expect(area).toHaveValue('Message');await expect(widget('Submission result')).toHaveText('Submitted 0');
  await page.keyboard.up('Enter');await expect(widget('Submission result')).toHaveText('Submitted 1');
  await area.press('Shift+Enter');await expect(area).toHaveValue('Message');await expect(widget('Submission result')).toHaveText('Submitted 2');
  await readonlyArea.click();await readonlyArea.press('ControlOrMeta+A');await readonlyArea.pressSequentially('ignored');await expect(readonlyArea).toHaveValue('View and select\n第二行');await readonlyArea.press('Enter');await expect(widget('Submission result')).toHaveText('Submitted 3');
  const rowSources=input('Row source'),rowTargets=input('Row target');await expect(rowSources).toHaveCount(2);
  await rowSources.nth(1).click();await rowSources.nth(1).press('Enter');await expect(rowTargets.nth(1)).toBeFocused();
  await expect.poll(()=>rowTargets.nth(1).evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual([0,11]);await rowTargets.nth(1).pressSequentially('Only second');await expect(rowTargets.nth(0)).toHaveValue('Alpha target');await expect(rowTargets.nth(1)).toHaveValue('Only second');
  await widget('Focus first row').click();await expect(rowTargets.nth(0)).toBeFocused();await expect.poll(()=>rowTargets.nth(0).evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual([0,12]);
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
