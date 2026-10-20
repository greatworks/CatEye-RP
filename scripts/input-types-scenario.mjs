import {expect} from '@playwright/test';

export function inputTypesFixture(){
  const style={fill:'#ffffff',stroke:'#a6b0c2',strokeWidth:1,radius:5,color:'#203048',fontSize:16,fontFamily:'Arial',fontWeight:400,textAlign:'left',opacity:1,textPadding:[8,12,8,12]};
  const widget=(id,type,x,y,text='',extra={})=>({id,type,name:id,text,x,y,width:360,height:44,rotation:0,style:{...style},hidden:false,locked:false,disabled:false,notes:'',interactions:[],...extra});
  const event=(id,type,actions)=>({id:`${id}-event`,event:type,name:id,enabled:true,conditionMode:'all',conditions:[],actions:actions.map((a,i)=>({id:`${id}-${i}`,...a}))});
  const button=(id,x,y,actions)=>widget(id,'button',x,y,id,{style:{...style,textAlign:'center',fill:'#e8eef9'},interactions:[event(id,'click',actions)]});
  const values={text:'A\r\nB',password:'secret',email:' user@example.test ',number:'01',tel:'+86 138-0013-8000',url:' https://example.test/ ',search:'Find a component',file:'not a selected file',date:'2026-10-13',month:'2026-10',time:'12:30:01.100'};
  const widgets=[widget('Heading','text',36,24,'Eleven native input types',{width:900,height:48,style:{...style,fill:'transparent',strokeWidth:0,fontSize:30,fontWeight:700}}),widget('Description','text',36,77,'Browser values · local file selection · shared preview and offline behavior',{width:900,height:40,style:{...style,fill:'transparent',strokeWidth:0,fontSize:15,color:'#68758a'}})];
  Object.entries(values).forEach(([type,text],i)=>{const x=36+i%2*440,y=150+Math.floor(i/2)*88;widgets.push(widget(`Label ${type}`,'text',x,y-26,type==='tel'?'Phone (tel)':type,{width:360,height:24,style:{...style,fill:'transparent',strokeWidth:0,fontSize:13,color:'#68758a'}}));widgets.push(widget(`Field-${type}`,'input',x,y,text,{name:`Field ${type}`,inputType:type,maxLength:5,...(type==='file'?{readOnly:true,hintText:'File hints are ignored'}:{}),...(type==='number'?{hintText:'Enter a number',hintStyle:{color:'#993366'},interactions:[event('number-change','change',[{type:'setVariable',targetId:'Changes',value:'[[number(Changes)+1]]'}])]}:{})}));});
  widgets.push(button('Read values',476,590,[{type:'setVariable',targetId:'Read',value:'number=[['+'Widget.Field-number.text]]; email=[[Widget.Field-email.text]]; file=[[Widget.Field-file.text]]'}]),widget('Readback','text',36,690,'[[Read]]',{width:920,height:52,style:{...style,strokeWidth:0,fill:'#eef3fa',fontSize:14}}),widget('Changes','text',36,650,'Number changes: [[Changes]]',{width:920,height:32,style:{...style,strokeWidth:0,fill:'transparent',fontSize:14}}));
  widgets.push(button('Invalid number and date',36,758,[{type:'setText',targetId:'Field-number',value:'+1'},{type:'setText',targetId:'Field-date',value:'2026-02-29'}]));
  widgets.push(button('Write typed values',476,758,[{type:'setText',targetId:'Field-number',value:'1.e2'},{type:'setText',targetId:'Field-email',value:' new@example.test '},{type:'setText',targetId:'Field-date',value:'2028-02-29'},{type:'setText',targetId:'Field-month',value:'2027-02'},{type:'setText',targetId:'Field-time',value:'23:59:59.1'},{type:'setText',targetId:'Field-text',value:'Longer than five'}]));
  widgets.push(button('Clear file',36,818,[{type:'setText',targetId:'Field-file',value:''}]));
  widgets.push(button('Reject file assignment',476,818,[{type:'setText',targetId:'Field-file',value:'cannot-select-a-file.txt'}]));
  widgets.push(button('Focus and select number',36,878,[{type:'setFocus',targetId:'Field-number',selectText:true}]));
  widgets.push(button('Clear number',476,878,[{type:'setText',targetId:'Field-number',value:''}]));
  return{format:'rea-prototype',version:1,id:'input-types-document',name:'Input types and browser values',caseSelection:'never',pages:[{id:'input-types-page',name:'Input types',width:990,height:960,background:'#f7f9fc',notes:'',interactions:[],adaptiveViews:[],widgets}],components:[],styles:[],variables:{Read:'Click Read values to inspect logical values.',Changes:'0'}};
}

export async function exerciseInputTypes(page,scope){
  const widget=name=>scope.locator(`.widget[aria-label="${name}"]`),input=type=>widget(`Field ${type}`).locator('input');
  const initial={text:'AB',password:'secret',email:'user@example.test',number:'01',tel:'+86 138-0013-8000',url:'https://example.test/',search:'Find a component',file:'',date:'2026-10-13',month:'2026-10',time:'12:30:01.100'};
  for(const [type,value] of Object.entries(initial)){await expect(input(type)).toHaveAttribute('type',type);await expect(input(type)).toHaveValue(value)}
  await input('text').fill('');await input('text').pressSequentially('abcdef');await expect(input('text')).toHaveValue('abcde');
  await input('number').fill('');await expect(input('number')).toHaveValue('');await expect(widget('Changes')).toHaveText('Number changes: 1');await input('number').pressSequentially('123456');await expect(input('number')).toHaveValue('123456');
  const numberChanges=Number((await widget('Changes').textContent()).split(': ')[1]);expect(numberChanges).toBeGreaterThan(0);
  await widget('Invalid number and date').click();await expect(input('number')).toHaveValue('');await expect(input('date')).toHaveValue('');
  await widget('Read values').click();await expect(widget('Readback')).toHaveText('number=; email=user@example.test; file=');
  await widget('Write typed values').click();await expect(input('number')).toHaveValue('1.e2');await expect(input('email')).toHaveValue('new@example.test');await expect(input('text')).toHaveValue('Longer than five');
  await expect(input('date')).toHaveValue('2028-02-29');await expect(input('month')).toHaveValue('2027-02');await expect(input('time')).toHaveValue('23:59:59.1');
  await widget('Focus and select number').click();await expect(input('number')).toBeFocused();expect(await input('number').evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual([null,null]);
  await expect(input('file')).toBeEnabled();await expect(input('file')).toHaveJSProperty('readOnly',true);
  await input('file').setInputFiles({name:'local-proof.txt',mimeType:'text/plain',buffer:Buffer.from('local selection only; no upload')});await expect(input('file')).toHaveValue('C:\\fakepath\\local-proof.txt');
  await widget('Read values').click();await expect(widget('Readback')).toHaveText('number=1.e2; email=new@example.test; file=C:\\fakepath\\local-proof.txt');
  await widget('Reject file assignment').click();await expect(scope.locator('[role="alert"],output').filter({hasText:/File inputs/})).toHaveCount(1);await expect(input('file')).toHaveValue('C:\\fakepath\\local-proof.txt');expect(await input('file').evaluate(e=>e.files.length)).toBe(1);
  await widget('Read values').click();await expect(input('file')).toHaveValue('C:\\fakepath\\local-proof.txt');
  await widget('Clear file').click();await expect(input('file')).toHaveValue('');expect(await input('file').evaluate(e=>e.files.length)).toBe(0);
  await widget('Clear number').click();await expect(input('number')).toHaveValue('');await expect(widget('Field number')).toHaveCSS('color','rgb(153, 51, 102)');
  await widget('Read values').click();await expect(widget('Readback')).toHaveText('number=; email=new@example.test; file=');
  await expect(scope.locator('[role="alert"],output').filter({hasText:/\S/})).toHaveCount(0);
}
