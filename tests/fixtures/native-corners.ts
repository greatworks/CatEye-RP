import {createDocument,createPage,createWidget} from '../../src/model/document';
import type {VectorPath,Widget} from '../../src/model/types';
export const cornerMask=(n:number)=>[1,2,4,8].map(bit=>Boolean(n&bit)) as [boolean,boolean,boolean,boolean];
export const cornerRectangle:VectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};
export function nativeCornersFixture(){
  const doc=createDocument();doc.name='Native rectangle corners';doc.caseSelection='never';
  const page=doc.pages[0];page.id='corners-page';page.name='Corner studio';page.width=1080;page.height=820;page.background='#ffffff';
  const widget=(id:string,type:Widget['type'],text:string,x:number,y:number,width:number,height:number)=>Object.assign(createWidget(type,x,y),{id,name:text||id,text,width,height});
  const title=widget('corners-title','text','Independent radius and four corner switches',40,20,1000,50);Object.assign(title.style,{fill:'transparent',strokeWidth:0,fontSize:28,textAlign:'left'});
  const gallery=Array.from({length:16},(_,n)=>{const w=widget(`corner-mask-${n}`,'box',String(n),40+n%8*128,100+Math.floor(n/8)*110,90,80);w.vectorPath=structuredClone(cornerRectangle);Object.assign(w.style,{fill:'#2767c8',stroke:'#173866',color:'#ffffff',strokeWidth:2,radius:25,cornerVisibility:cornerMask(n)});return w;});
  const target=widget('corners-target','box','',40,360,200,100);target.vectorPath=structuredClone(cornerRectangle);Object.assign(target.style,{fill:'#00aa44',stroke:'#0033cc',strokeWidth:4,radius:20,cornerVisibility:cornerMask(15)});target.mouseOverStyle={radius:36};target.selectedStyle={cornerVisibility:cornerMask(5)};
  const html=widget('corners-html','box','CSS rectangle',300,360,200,100);Object.assign(html.style,{fill:'#ffe1a6',stroke:'#6b4f22',strokeWidth:4,radius:30,cornerVisibility:cornerMask(9)});
  const row=widget('corners-row','box','Row',10,10,160,80);row.vectorPath=structuredClone(cornerRectangle);Object.assign(row.style,{radius:24,cornerVisibility:cornerMask(15),fill:'#cbdefa'});row.mouseOverStyle={cornerVisibility:cornerMask(1)};
  const repeater=widget('corners-repeater','repeater','Rows',580,350,200,190);repeater.repeater={columns:['Name'],rows:[{Name:'A'},{Name:'B'}],template:[row],itemWidth:180,itemHeight:90,layout:'vertical',gap:0,fitToContent:false};Object.assign(repeater.style,{fill:'transparent',strokeWidth:0});
  const action=(id:string,text:string,x:number,actions:any[])=>{const w=widget(id,'button',text,x,570,230,45);w.interactions=[{id:`${id}-case`,name:text,event:'click',enabled:true,conditionMode:'all',conditions:[],actions:actions.map((a,i)=>({id:`${id}-${i}`,...a}))}];return w;};
  const radius=action('corners-radius','Set radius to 12',40,[{type:'setStyle',targetId:target.id,style:{radius:12}}]);
  const mask=action('corners-mask','Round top left only',300,[{type:'setStyle',targetId:target.id,style:{cornerVisibility:cornerMask(1)}}]);
  const selected=action('corners-select','Select diagonal corners',560,[{type:'setSelected',targetId:target.id,value:'true'}]);
  page.widgets=[title,...gallery,target,html,repeater,radius,mask,selected];
  const framePage=createPage('Embedded corners');framePage.id='corners-frame-page';framePage.width=1120;framePage.height=880;
  const frame=widget('corners-frame','inlineFrame','',10,10,1090,840);frame.name='Embedded corner studio';frame.inlineFrame!.target={kind:'page',pageId:page.id};framePage.widgets=[frame];doc.pages.push(framePage);
  return doc;
}
