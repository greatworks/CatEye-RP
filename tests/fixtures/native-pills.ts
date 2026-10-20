import {createDocument,createWidget,parseDocument,serializeDocument} from '../../src/model/document';
import {replaceWidgetText} from '../../src/model/rich-text';
import type {Action,Widget} from '../../src/model/types';
import imported from '../../research/native-pills-imported-widgets.json' with {type:'json'};

/** Original imported geometry and corner parameters; the gallery layout, paint
 * and controls below are an explicitly authored verification demonstration. */
export function nativePillsFixture(){
  const doc=createDocument();doc.name='Editable native capsules';doc.caseSelection='never';
  const page=doc.pages[0];page.id='pills-page';page.name='Capsule studio';page.width=1100;page.height=850;page.background='#ffffff';
  const label=(id:string,text:string,x:number,y:number,width:number,height:number)=>{
    const w=createWidget('text',x,y);Object.assign(w,{id,name:text,text,width,height});Object.assign(w.style,{fill:'transparent',strokeWidth:0,textAlign:'left'});return w;
  };
  const title=label('pills-title','18 imported capsule paths, now editable',40,24,1000,48);title.style.fontSize=28;
  const subtitle=label('pills-subtitle','Original path coordinates and radius values · authored layout and controls',40,78,1000,30);
  const gallery=imported.widgets.map((entry,index)=>{
    const w=replaceWidgetText(structuredClone(entry.widget) as unknown as Widget,'');w.id=`pills-gallery-${index}`;w.name=`Native capsule ${index+1}`;w.x=40+index%4*265;w.y=145+Math.floor(index/4)*32;w.interactions=[];
    Object.assign(w.style,{fill:'#2767c8',stroke:'#173866',strokeWidth:1});return w;
  });
  const entry=imported.widgets.find(item=>item.sourceId==='d515a37dfd114af6877e6c6d4d244032');
  if(!entry)throw Error('Missing original slider capsule');
  const target=structuredClone(entry.widget) as unknown as Widget;Object.assign(target,{id:'pills-target',name:'Editable native capsule',text:'',x:70,y:465});
  Object.assign(target.style,{fill:'#2767c8',stroke:'#173866',strokeWidth:2});
  target.mouseOverStyle={radius:24};target.selectedStyle={cornerVisibility:[true,false,true,false]};target.interactions=[];target.selected=false;
  const instruction=label('pills-instruction','Resize → radius → corner mask → selected and hover styles',40,395,1000,42);instruction.style.fontSize=20;
  const button=(id:string,text:string,x:number,y:number,actions:Omit<Action,'id'>[])=>{
    const w=createWidget('button',x,y);Object.assign(w,{id,name:text,text,width:230,height:42});
    w.interactions=[{id:`${id}-case`,name:text,event:'click',enabled:true,conditionMode:'all',conditions:[],actions:actions.map((action,index)=>({...action,id:`${id}-${index}`}))}];return w;
  };
  page.widgets=[title,subtitle,...gallery,instruction,target,
    button('pills-resize','Resize to 240 × 60',40,580,[{type:'resize',targetId:target.id,x:240,y:60}]),
    button('pills-radius','Set radius to 18',310,580,[{type:'setStyle',targetId:target.id,style:{radius:18}}]),
    button('pills-mask','Round top left only',580,580,[{type:'setStyle',targetId:target.id,style:{cornerVisibility:[true,false,false,false]}}]),
    button('pills-select','Select diagonal corners',40,645,[{type:'setSelected',targetId:target.id,value:'true'}])];
  return parseDocument(serializeDocument(doc));
}
