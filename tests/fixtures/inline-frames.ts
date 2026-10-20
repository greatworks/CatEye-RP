import { createDocument, createPage, createWidget } from '../../src/model/document';
import type { Action, Interaction, Widget } from '../../src/model/types';
let sequence = 0;
const branch = (actions: Omit<Action,'id'>[], event: Interaction['event'] = 'click'): Interaction => ({ id:`frame-case-${++sequence}`, name:event, event, enabled:true, conditionMode:'all', conditions:[], actions:actions.map(a=>({...a,id:`frame-action-${++sequence}`})) });
function label(id:string,text:string,x:number,y:number,width:number,height=34,size=14):Widget {
  const w=createWidget('text',x,y); Object.assign(w,{id,name:id,text,width,height});
  Object.assign(w.style,{fontSize:size,fontWeight:size>20?700:400,color:'#23354b'}); return w;
}
function button(id:string,text:string,x:number,y:number,width:number,actions:Omit<Action,'id'>[]):Widget {
  const w=createWidget('button',x,y); Object.assign(w,{id,name:text,text,width,height:42,interactions:[branch(actions)]}); return w;
}
export function inlineFrameFixture() {
  sequence=0; const doc=createDocument(); doc.id='inline-frame-demo'; doc.name='Inline frames · independent embedded pages'; doc.caseSelection='never'; doc.variables={FrameCount:'0'};
  const home=doc.pages[0]; Object.assign(home,{id:'frame-home',name:'Workspace',width:1120,height:850,background:'#f4f7fb'});
  const catalog=createPage('Embedded workspace'); Object.assign(catalog,{id:'frame-catalog',width:490,height:360,background:'#ffffff'});
  const detail=createPage('Embedded detail'); Object.assign(detail,{id:'frame-detail',width:490,height:360,background:'#f0f4ff'});
  const destination=createPage('Parent destination'); Object.assign(destination,{id:'frame-parent-destination',width:1120,height:700,background:'#f4f7fb'});
  const frame=(id:string,x:number)=>{const w=createWidget('inlineFrame',x,202);Object.assign(w,{id,name:id,width:492,height:364});w.inlineFrame!.target={kind:'page',pageId:catalog.id};w.inlineFrame!.hideBorders=true;return w;};
  home.widgets=[
    label('frame-heading','Two frames. Two independent workspaces.',48,36,1020,48,28),
    label('frame-description','Each embedded page has its own interactions and variables. Try the controls inside either frame.',48,98,1010,50,15),
    label('frame-left-heading','LEFT WORKSPACE',48,165,450,30,12),label('frame-right-heading','RIGHT WORKSPACE',580,165,450,30,12),
    frame('frame-left',48),frame('frame-right',580),
    button('frame-show-detail','Show detail in left frame',48,610,252,[{type:'openLinkInFrame',frameScope:'widget',targetId:'frame-left',frameTarget:{kind:'page',pageId:detail.id}}]),
    button('frame-reload','Reload left workspace',320,610,232,[{type:'openLinkInFrame',frameScope:'widget',targetId:'frame-left',frameTarget:{kind:'page',pageId:catalog.id}}]),
    button('frame-sibling-update','Update outer text',580,610,226,[{type:'setText',targetId:'frame-outer-status',value:'Outer text updated; both embedded pages keep their state.'}]),
    label('frame-outer-status','Outer page is ready.',48,691,1000,44,16),
    label('frame-footnote','Editor preview images are authoring aids; embedded pages are loaded only during playback.',48,770,1020,48,13),
  ];
  catalog.interactions=[branch([{type:'setVariable',targetId:'FrameCount',value:'[[FrameCount + 1]]'},{type:'setText',targetId:'frame-child-count',value:'Count: [[FrameCount]]'}],'load')];
  catalog.widgets=[
    label('frame-child-heading','Embedded workspace',26,24,435,38,22),
    label('frame-child-description','This is a real embedded prototype page.',26,76,435,34,14),
    label('frame-child-count','Count: 0',26,124,260,36,20),
    button('frame-child-increment','Add one',26,178,140,[{type:'setVariable',targetId:'FrameCount',value:'[[FrameCount + 1]]'},{type:'setText',targetId:'frame-child-count',value:'Count: [[FrameCount]]'}]),
    button('frame-child-detail','Open detail here',184,178,230,[{type:'openPage',targetId:detail.id}]),
    button('frame-child-parent','Navigate parent frame',26,240,388,[{type:'openLinkInFrame',frameScope:'parent',frameTarget:{kind:'page',pageId:destination.id}}]),
    label('frame-child-note','Navigation here leaves the other workspace unchanged.',26,304,435,40,12),
  ];
  detail.widgets=[label('frame-detail-heading','Detail page',26,28,435,42,26),label('frame-detail-copy','Only this embedded page has navigated.',26,98,430,58,16),button('frame-detail-back','Back to workspace',26,190,270,[{type:'openPage',targetId:catalog.id}])];
  destination.widgets=[label('frame-parent-heading','Parent frame navigation worked',48,50,1010,52,30),label('frame-parent-description','The containing prototype navigated. The editor document remains unchanged.',48,138,1000,60,17),button('frame-parent-back','Return to both workspaces',48,240,300,[{type:'openPage',targetId:home.id}])];
  doc.pages.push(catalog,detail,destination); return doc;
}
