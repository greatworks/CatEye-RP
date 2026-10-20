import { createDocument, createWidget } from '../../src/model/document';
import { createTree, createTreeNode, layoutTree } from '../../src/model/tree-widget';
import type { Action, Interaction, Widget } from '../../src/model/types';
let sequence=0;
const branch=(actions:Omit<Action,'id'>[],event:Interaction['event']='click'):Interaction=>({id:`tw-case-${++sequence}`,name:event,event,enabled:true,conditionMode:'all',conditions:[],actions:actions.map(action=>({...action,id:`tw-action-${++sequence}`}))});
function node(id:string,text:string,children:Widget[]=[]):Widget {
  const result=createTreeNode(text);result.id=id;result.name=text;result.height=32;
  Object.assign(result.treeNode!.label,{id:`${id}-label`,name:`${text} label`,width:188,height:32});
  Object.assign(result.treeNode!.label.style,{fontSize:14,color:'#263348',textPadding:[6,8,6,4]});
  result.treeNode!.label.selectedStyle={fill:'#e0e7ff',color:'#3730a3'};
  result.treeNode!.children=children;
  result.interactions=[branch([{type:'setText',targetId:'tree-status',value:`Opened ${text}`}])];
  return result;
}
export function treeWidgetFixture(){
  sequence=0;const doc=createDocument();doc.id='tree-widget-doc';doc.name='Tree widgets · hierarchy and interactions';doc.caseSelection='never';
  const page=doc.pages[0];Object.assign(page,{id:'tree-widget-page',name:'Trees',width:1120,height:1180,background:'#f7f8fc'});
  const text=(id:string,value:string,x:number,y:number,width=1000,size=14,height=34)=>{const w=createWidget('text',x,y);Object.assign(w,{id,name:id,text:value,width,height});Object.assign(w.style,{fontSize:size,fontWeight:size>20?700:400,color:'#263348'});return w;};
  let tree=createTree(44,150);tree.id='tree-main';tree.name='Project browser';
  tree.tree!.nodes=[node('tree-workspace','Workspace',[node('tree-pages','Pages',[node('tree-home','Home page'),node('tree-settings','Settings page')]),node('tree-assets','Assets'),node('tree-guides','Guides')]),node('tree-archive','Archive')];
  tree=layoutTree(tree);
  const status=text('tree-status','Ready — choose a node or use an expand icon.',400,150,650,16,200);status.style.fill='#eeedff';status.style.textPadding=[18,18,18,18];
  const button=(id:string,label:string,x:number,y:number,actions:Omit<Action,'id'>[])=>{const w=createWidget('button',x,y);Object.assign(w,{id,name:label,text:label,width:204,height:40,interactions:[branch(actions)]});return w;};
  const controls=[button('tree-collapse','Collapse Workspace',400,374,[{type:'collapseTreeNode',targetId:'tree-workspace'}]),button('tree-expand','Expand Workspace',628,374,[{type:'expandTreeNode',targetId:'tree-workspace'}]),button('tree-toggle','Toggle Pages',400,432,[{type:'toggleTreeNode',targetId:'tree-pages'}]),button('tree-read','Read all tree text',628,432,[{type:'setText',targetId:'tree-status',value:'[[Widget.tree-workspace.text]]'}])];
  const repeater=createWidget('repeater',44,718);repeater.id='tree-repeater';repeater.name='Independent repeated trees';
  const repeated=createTree(0,0);repeated.id='tree-row';repeated.tree!.nodes=[node('tree-row-parent','[[Item.Name]]',[node('tree-row-child','Details')])];
  repeated.tree!.nodes[0].treeNode!.children[0].interactions=[branch([{type:'setText',targetId:'tree-row-result',value:'Opened [[Item.Name]] details'}])];
  const rowResult=text('tree-row-result','No row action yet',310,0,560);repeater.repeater={columns:['Name'],rows:[{Name:'Alpha'},{Name:'Beta'}],template:[layoutTree(repeated),rowResult],itemWidth:980,itemHeight:100,gap:16,fitToContent:false,layout:'vertical'};repeater.width=980;repeater.height=216;
  page.widgets=[text('tree-heading','A hierarchy with independent node actions',44,30,1000,28,46),text('tree-caption','Click labels to select. Expand icons reveal descendants without running node click actions.',44,90),tree,status,...controls,text('tree-note','Collapse a branch, then read its text: hidden descendants are included.',400,500,630,14,70),text('tree-row-heading','The same tree in two independent data rows',44,650,1000,22),repeater,text('tree-footer','Tree node contents and styling are shared across adaptive views.',44,1000,1000,13)];
  return doc;
}
