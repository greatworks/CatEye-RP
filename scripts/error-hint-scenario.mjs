import {expect} from '@playwright/test';

export function errorHintFixture(){
  const style={fill:'#ffffff',stroke:'#a6b0c2',strokeWidth:1,radius:5,color:'#203048',fontSize:16,fontFamily:'Arial',fontWeight:400,textAlign:'left',opacity:1,textPadding:[8,12,8,12]};
  const widget=(id,type,x,y,text='',extra={})=>({id,type,name:id,text,x,y,width:300,height:48,rotation:0,style:{...style},hidden:false,locked:false,disabled:false,notes:'',interactions:[],...extra});
  const interaction=(id,event,actions)=>({id:`${id}-event`,event,name:id,enabled:true,conditionMode:'all',conditions:[],actions:actions.map((a,i)=>({id:`${id}-${i}`,...a}))});
  const button=(id,x,y,actions)=>widget(id,'button',x,y,id,{width:180,style:{...style,textAlign:'center',fill:'#e8eef9'},interactions:[interaction(id,'click',actions)]});
  const field=widget('Typing hint','input',40,130,'',{hintText:'Email [[literal]]',hintStyle:{color:'#65758b'},focusedStyle:{stroke:'#3e64bf'},errorStyle:{stroke:'#dc2638',fontWeight:700},interactions:[
    interaction('changed','change',[{type:'setVariable',targetId:'Changes',value:'[[number(Changes)+1]]'},{type:'setVariable',targetId:'LastText',value:'[[This.text]]'},{type:'setVariable',targetId:'Trace',value:"[[concat(Trace,'<',This.text,'>')]]"}]),
    interaction('error-set','errorSet',[{type:'setVariable',targetId:'Errors',value:'[[number(Errors)+1]]'}]),
    interaction('error-remove','errorRemoved',[{type:'setVariable',targetId:'Removals',value:'[[number(Removals)+1]]'}]),
  ]});
  const focus=widget('Focus hint','input',400,130,'',{hintText:'Search people',hintHideOn:'focus',hintStyle:{color:'#92714f'},focusedStyle:{stroke:'#3e64bf'}});
  const password=widget('Password hint','input',40,290,'',{inputType:'password',hintText:'Choose a password',hintStyle:{color:'#65758b'}});
  const area=widget('Message hint','textarea',400,290,'',{height:90,hintText:'First line\n第二行提示',hintHideOn:'focus',hintStyle:{color:'#65758b'}});
  const row=widget('Row input','input',8,8,'',{width:250,hintText:'Row hint',errorStyle:{stroke:'#dc2638'},interactions:[interaction('row-change','change',[{type:'setError',targetId:'Row input',value:'true'}])]});
  const rows=widget('Hint rows','repeater',40,510,'',{width:300,height:145,repeater:{columns:['Name'],rows:[{Name:'A'},{Name:'B'}],template:[row],itemHeight:64,gap:6}});
  const widgets=[
    widget('Heading','text',40,28,'Error states & input hints',{width:810,height:48,style:{...style,fill:'transparent',strokeWidth:0,fontSize:30,fontWeight:700}}),
    widget('Caption','text',40,80,'Independent prototype editor · literal hints, logical text and row-local state',{width:810,height:34,style:{...style,fill:'transparent',strokeWidth:0,fontSize:14,color:'#68758a'}}),
    field,focus,password,area,rows,
    button('Set error',40,196,[{type:'setError',targetId:field.id,value:'true'}]),
    button('Remove error',238,196,[{type:'setError',targetId:field.id,value:'false'}]),
    button('Clear focused field',438,196,[{type:'setText',targetId:focus.id,value:''}]),
    button('Disable field',40,402,[{type:'disable',targetId:field.id}]),
    button('Enable field',238,402,[{type:'enable',targetId:field.id}]),
    widget('Counters','text',400,505,'Set: [[Errors]] / Removed: [[Removals]] / Changes: [[Changes]]',{width:460,height:42,style:{...style,strokeWidth:0,fill:'#eef3fa'}}),
    widget('Logical text','text',400,560,'Logical text: «[[LastText]]»',{width:460,height:48,style:{...style,strokeWidth:0,fill:'#eef3fa'}}),
    widget('Change trace','text',400,615,'[[Trace]]',{width:460,height:42,style:{...style,strokeWidth:0,fill:'#eef3fa',fontSize:12}}),
    widget('Footnote','text',40,685,'Hint text is presentation state. Saving preserves the authored empty values.',{width:810,height:40,style:{...style,fill:'transparent',strokeWidth:0,fontSize:14,color:'#68758a'}}),
  ];
  return {format:'rea-prototype',version:1,id:'error-hint-document',name:'Error and Hint',caseSelection:'never',pages:[{id:'error-hint-page',name:'Forms and validation',width:940,height:780,background:'#f7f9fc',notes:'',interactions:[],adaptiveViews:[],widgets}],components:[],styles:[],variables:{Changes:'0',Errors:'0',Removals:'0',LastText:'',Trace:''}};
}

export async function exerciseErrorHint(page,scope){
  const widget=name=>scope.locator(`.widget[aria-label="${name}"]`),input=name=>widget(name).locator('input,textarea');
  const typing=input('Typing hint'),focus=input('Focus hint'),password=input('Password hint'),area=input('Message hint');
  await expect(typing).toHaveValue('Email [[literal]]');await expect(typing).not.toHaveAttribute('placeholder');await expect(typing).toHaveCSS('color','rgb(101, 117, 139)');
  await expect(focus).toHaveValue('Search people');await expect(password).toHaveValue('Choose a password');await expect(password).toHaveAttribute('type','text');
  await expect(area).toHaveValue('First line\n第二行提示');
  await typing.click();await expect(typing).toHaveValue('Email [[literal]]');
  await typing.press('ArrowLeft');await expect(typing).toHaveValue('');await expect(widget('Counters')).toHaveText('Set: 0 / Removed: 0 / Changes: 1');await expect(widget('Logical text')).toHaveText('Logical text: «»');
  await typing.pressSequentially('test');await expect(typing).toHaveValue('test');await expect(widget('Logical text')).toHaveText('Logical text: «test»');await expect(widget('Change trace')).toHaveText('<><t><te><tes><test>');
  await typing.press('ControlOrMeta+A');await typing.press('Backspace');await expect(typing).toHaveValue('Email [[literal]]');await expect(typing).toBeFocused();await expect(widget('Logical text')).toHaveText('Logical text: «»');
  await widget('Set error').click();await widget('Set error').click();await expect(widget('Counters')).toContainText('Set: 1 / Removed: 0');
  await expect(widget('Typing hint')).toHaveCSS('border-top-color','rgb(220, 38, 56)');await expect(typing).toHaveCSS('font-weight','700');await expect(typing).toHaveCSS('color','rgb(101, 117, 139)');
  await widget('Disable field').click();await widget('Remove error').click();await expect(typing).toBeDisabled();await expect(widget('Counters')).toContainText('Set: 1 / Removed: 0');
  await widget('Enable field').click();await widget('Remove error').click();await widget('Remove error').click();await expect(widget('Counters')).toContainText('Set: 1 / Removed: 1');
  await focus.click();await expect(focus).toHaveValue('');await focus.pressSequentially('find');await expect(focus).toHaveValue('find');
  await focus.press('ControlOrMeta+A');await focus.press('Backspace');await expect(focus).toHaveValue('');await typing.click();await expect(focus).toHaveValue('Search people');
  await password.click();await expect(password).toHaveAttribute('type','text');await password.pressSequentially('s3cret');await expect(password).toHaveValue('s3cret');await expect(password).toHaveAttribute('type','password');
  await password.press('ControlOrMeta+A');await password.press('Backspace');await expect(password).toHaveValue('Choose a password');await expect(password).toHaveAttribute('type','text');
  await area.click();await expect(area).toHaveValue('');await area.fill('Hello\n世界');await expect(area).toHaveValue('Hello\n世界');await area.fill('');await typing.click();await expect(area).toHaveValue('First line\n第二行提示');
  const rows=input('Row input');await expect(rows).toHaveCount(2);await rows.nth(0).click();await rows.nth(0).pressSequentially('A');await expect(rows.nth(0)).toHaveValue('A');await expect(rows.nth(1)).toHaveValue('Row hint');
  await expect(widget('Row input').nth(0)).toHaveCSS('border-top-color','rgb(220, 38, 56)');await expect(widget('Row input').nth(1)).toHaveCSS('border-top-color','rgb(166, 176, 194)');
  await widget('Set error').click();await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
