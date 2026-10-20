import {createDocument,createPage,createWidget} from '../../src/model/document';
import type {Action,Interaction,RotateActionSpec,Widget} from '../../src/model/types';

export const rotationSpec=(patch:Partial<RotateActionSpec>={}):RotateActionSpec=>({mode:'by',degrees:'90',clockwise:true,anchor:'center',offsetX:'0',offsetY:'0',easing:'none',duration:500,...patch});
const interaction=(id:string,actions:Omit<Action,'id'>[],event:Interaction['event']='click'):Interaction=>({id:`${id}-case`,name:event,event,enabled:true,conditions:[],conditionMode:'all',actions:actions.map((action,index)=>({...action,id:`${id}-action-${index}`}))});
const label=(id:string,text:string,x:number,y:number,width:number,height:number,size=14)=>{const w=createWidget('text',x,y);Object.assign(w,{id,name:id,text,width,height});Object.assign(w.style,{fontSize:size,color:'#334155',textAlign:'left'});return w;};
const button=(id:string,text:string,x:number,y:number,actions:Omit<Action,'id'>[]):Widget=>{const w=createWidget('button',x,y);Object.assign(w,{id,name:text,text,width:200,height:38,interactions:[interaction(id,actions)]});return w;};

export function runtimeRotateFixture(){
 const doc=createDocument();Object.assign(doc,{id:'runtime-rotate-demo',name:'Rotate · anchors, motion and instances',caseSelection:'never',variables:{Turns:'0'}});
 const page=doc.pages[0];Object.assign(page,{id:'rotate-home',name:'Rotation lab',width:1120,height:840,background:'#f5f7fb'});
 const target=createWidget('box',200,205);Object.assign(target,{id:'rotate-shape',name:'Rotation target',text:'SHAPE',width:160,height:80});Object.assign(target.style,{fill:'#2563eb',color:'#ffffff',stroke:'#1d4ed8',strokeWidth:2,radius:8,fontWeight:700});
 target.interactions=[interaction('rotate-count',[{type:'setVariable',targetId:'Turns',value:'[[Turns + 1]]'},{type:'setText',targetId:'rotate-events',value:'Rotated events: [[Turns]]'}],'rotate')];
 const input=createWidget('input',600,205);Object.assign(input,{id:'rotate-input',name:'Input orbit target',text:'Editable input',width:160,height:80});
 const child=createPage('Embedded rotation');Object.assign(child,{id:'rotate-child',width:320,height:235});const childTarget=createWidget('box',96,52);Object.assign(childTarget,{id:'rotate-child-shape',name:'Embedded shape',text:'FRAME',width:128,height:64});Object.assign(childTarget.style,{fill:'#0f766e',color:'#fff',stroke:'#115e59'});child.widgets=[childTarget,button('rotate-child-button','Rotate in frame',60,165,[{type:'rotate',targetId:childTarget.id,rotate:rotationSpec({degrees:'180',easing:'linear',duration:600})}])];
 const frame=createWidget('inlineFrame',746,488);Object.assign(frame,{id:'rotate-frame',name:'Independent frame',width:322,height:237});frame.inlineFrame!.target={kind:'page',pageId:child.id};
 const repeater=createWidget('repeater',48,520);Object.assign(repeater,{id:'rotate-repeater',name:'Independent rows',width:620,height:190});
 const rowTarget=createWidget('box',14,12);Object.assign(rowTarget,{id:'rotate-row-shape',name:'Row shape',text:'[[Item.Name]]',width:92,height:48});Object.assign(rowTarget.style,{fill:'#f59e0b',stroke:'#d97706'});
 repeater.repeater={columns:['Name'],rows:[{Name:'First row'},{Name:'Second row'}],itemHeight:92,gap:2,template:[rowTarget,button('rotate-row-button','Rotate this row',154,18,[{type:'rotate',targetId:rowTarget.id,rotate:rotationSpec({degrees:'180',easing:'linear',duration:600})}])]};
 page.widgets=[label('rotate-title','Rotation lab',48,28,1000,48,30),label('rotate-description','Change orientation or orbit around an anchor. Repeated controls stay independent.',48,83,1000,36,15),
  label('rotate-shape-label','SHAPE · ORIENTATION + POSITION',48,145,455,28,12),label('rotate-input-label','INPUT · OFFSET ANCHOR CHANGES POSITION',566,145,505,28,12),target,input,
  button('rotate-by','Rotate by 90°',48,346,[{type:'rotate',targetId:target.id,rotate:rotationSpec()}]),button('rotate-to','Rotate to 0°',268,346,[{type:'rotate',targetId:target.id,rotate:rotationSpec({mode:'to',degrees:'0'})}]),
  button('rotate-pivot','Orbit top left',48,398,[{type:'rotate',targetId:target.id,rotate:rotationSpec({anchor:'top left',easing:'linear',duration:600})}]),button('rotate-input-orbit','Orbit input',566,346,[{type:'rotate',targetId:input.id,rotate:rotationSpec({anchor:'top left',easing:'linear',duration:600})}]),
  label('rotate-events','Rotated events: 0',268,400,270,32,14),label('rotate-row-label','REPEATER · EACH ROW OWNS ITS MOTION',48,477,620,30,12),repeater,frame,
  label('rotate-footnote','Restart the prototype to reset positions, angles and event counts.',48,762,1000,32,13)];
 doc.pages.push(child);return doc;
}
