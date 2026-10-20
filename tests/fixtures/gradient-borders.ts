import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { GradientFill, Widget, WidgetType } from '../../src/model/types';

/** Independent authored example; these colors and dimensions are not vendor defaults. */
export function gradientBorderFixture() {
  const doc=createDocument();doc.name='Gradient borders — independent paints';doc.caseSelection='never';
  const page=doc.pages[0];page.id='border-page';page.name='Border studio';page.width=1160;page.height=1050;page.background='#f5f7fc';
  const linear:GradientFill={type:'linear',start:{x:0,y:.5},end:{x:1,y:.5},stops:[{offset:0,color:'#195edc'},{offset:.5,color:'#9554c9'},{offset:1,color:'#ef775e'}]};
  const radial:GradientFill={type:'radial',center:{x:.45,y:.35},axis1:{x:.9,y:.65},axis2:{x:.25,y:.8},stops:[{offset:0,color:'#efcf69'},{offset:.65,color:'#cd5a94'},{offset:1,color:'#2751a0'}]};
  const make=(id:string,type:WidgetType,text:string,x:number,y:number,width:number,height:number):Widget=>Object.assign(createWidget(type,x,y),{id,name:text,text,width,height});
  const title=make('border-title','text','Gradient borders',40,24,1000,48);Object.assign(title.style,{fontSize:30,fontWeight:700,color:'#172744',strokeWidth:0});
  const subtitle=make('border-subtitle','text','Independent fill and stroke · rounded corners · repeated instances',40,79,1050,36);Object.assign(subtitle.style,{fontSize:17,color:'#536785',strokeWidth:0});
  const box=make('border-linear','box','Linear / solid fill',45,145,315,140);Object.assign(box.style,{fill:'#ffffff',strokeWidth:12,strokeGradient:linear,radius:24,fontSize:22});
  const ellipse=make('border-radial','ellipse','Radial axes',405,145,310,140);Object.assign(ellipse.style,{fill:'#ffffff',strokeGradient:radial,borderWidths:[10,18,24,6],fontSize:21});
  const corners=make('border-corners','box','Four widths + corners',765,145,345,140);Object.assign(corners.style,{fill:'#ffffff',strokeGradient:linear,borderWidths:[8,20,15,5],cornerRadii:[28,8,38,16],fontSize:20});
  const vector=make('border-vector','path','Independent fill / stroke',55,335,300,150);vector.vectorPath={fillRule:'evenodd',commands:[{op:'M',x:.08,y:.05},{op:'L',x:.95,y:.05},{op:'L',x:.8,y:.95},{op:'L',x:.02,y:.95},{op:'Z'}]};
  Object.assign(vector.style,{fillGradient:radial,strokeGradient:linear,strokeWidth:10,color:'#ffffff',fontSize:17,outerShadow:{on:true,offsetX:4,offsetY:5,blurRadius:4,color:'#24395850'},innerShadow:{on:true,offsetX:2,offsetY:3,blurRadius:2,spread:0,color:'#00000040'}});
  const line=make('border-line','line','Gradient line',410,350,310,50);Object.assign(line.style,{strokeGradient:linear,strokeWidth:12,fill:'transparent'});
  const input=make('border-input','input','Editable text',410,427,310,62);input.text='Type here';Object.assign(input.style,{strokeGradient:radial,strokeWidth:7,radius:14,fill:'#ffffff',textPadding:[8,12,8,12]});
  const hard=make('border-hard','box','Hard stops / alpha',765,340,345,145);Object.assign(hard.style,{fill:'#ffffff',radius:20,strokeWidth:16,strokeGradient:{type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'#11778300'},{offset:.5,color:'#11778300'},{offset:.5,color:'#117783'},{offset:1,color:'#117783'}]} satisfies GradientFill});
  const panel=make('border-parent','panel','Nested border',45,555,315,155);Object.assign(panel.style,{fill:'#e5edf8',radius:20,strokeWidth:8,strokeGradient:linear});
  const child=make('border-child','box','Separate child',25,33,250,75);Object.assign(child.style,{fill:'#ffffff',radius:13,strokeWidth:6,strokeGradient:radial});panel.states![0].widgets=[child];
  const row=make('border-row','path','Row [[Item.Name]]',8,4,294,58);row.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:.05,y:.1},{op:'L',x:.95,y:.1},{op:'L',x:.95,y:.9},{op:'L',x:.05,y:.9},{op:'Z'}]};Object.assign(row.style,{fill:'#ffffff',strokeWidth:6,strokeGradient:linear});row.mouseOverStyle={strokeGradient:{...linear,stops:linear.stops.map(stop=>({...stop,color:'#2b9569'}))}};
  const repeater=make('border-repeater','repeater','Independent rows',405,555,310,150);repeater.repeater={columns:['Name'],rows:[{Name:'A'},{Name:'B'}],template:[row],itemWidth:310,itemHeight:68,layout:'vertical',gap:7,fitToContent:false};Object.assign(repeater.style,{fill:'transparent',strokeWidth:0});
  const image=make('border-image','image','Image first-stop border',770,557,154,146);image.imageSrc='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';Object.assign(image.style,{fill:'#ffffff',strokeGradient:linear,strokeWidth:12,radius:12});
  const radialImage=make('border-image-radial','image','Image radial transparent',950,557,154,146);radialImage.imageSrc=image.imageSrc;Object.assign(radialImage.style,{fill:'#ffffff',strokeGradient:radial,strokeWidth:12,radius:12});
  const subjects=[box,ellipse,corners,vector,line,input,hard,panel,child,row,image,radialImage];
  const control=(id:string,text:string,x:number,restore:boolean)=>{const w=make(id,'button',text,x,775,290,48);w.interactions=[{id:uid(),name:text,event:'click',enabled:true,conditionMode:'all',conditions:[],actions:subjects.map(subject=>({id:uid(),type:'setStyle' as const,targetId:subject.id,style:restore?{strokeGradient:structuredClone(subject.style.strokeGradient!)}:{stroke:'#485c78'}}))}];return w;};
  const note=make('border-note','text','The controls replace only the border. Vector fills and shadows remain independent. Image borders preserve the observed first-stop / transparent fallback.',45,856,1060,105);Object.assign(note.style,{fontSize:19,color:'#536785',strokeWidth:0,textAlign:'left'});
  page.widgets=[title,subtitle,box,ellipse,corners,vector,line,input,hard,panel,repeater,image,radialImage,control('border-solid','Use solid borders',45,false),control('border-restore','Restore gradient borders',405,true),note];
  const embedded=createPage('Embedded borders');embedded.id='border-frame-page';embedded.width=1220;embedded.height=1130;const frame=make('border-frame','inlineFrame','Embedded border studio',15,15,1190,1090);frame.text='';frame.inlineFrame!.target={kind:'page',pageId:page.id};embedded.widgets=[frame];doc.pages.push(embedded);
  return doc;
}
