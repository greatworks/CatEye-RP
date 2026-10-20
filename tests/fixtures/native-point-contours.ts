import {createDocument,createWidget} from '../../src/model/document';
import type {VectorPath} from '../../src/model/types';

export const CONTOUR_TARGET_ID='contours-target';
export const contourRectangle:VectorPath={fillRule:'nonzero',commands:[
  {op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'},
]};

/** Synthetic source-derived boundary case, not a recovered native document.
 * The detached line is .0005 world units long at the initial width of 200.
 * Native temporary-curve reindex drops it from bounds, not stored points. */
export function detachedContourPath():VectorPath{return {fillRule:'nonzero',commands:[
  ...structuredClone(contourRectangle.commands),{op:'M',x:3,y:0},{op:'L',x:3.0000025,y:0},
]};}

export function nativePointContoursFixture(){
  const doc=createDocument();doc.id='point-contours-document';doc.name='Point contour geometry';doc.caseSelection='never';
  const page=doc.pages[0];page.id='point-contours-page';page.name='Contour editing';page.width=1000;page.height=700;page.background='#ffffff';page.widgets=[];
  const widget=createWidget('path',100,100);Object.assign(widget,{id:CONTOUR_TARGET_ID,name:'Editable compound path',text:'',width:200,height:100,rotation:0,vectorPath:detachedContourPath(),shapeText:{autoFitWidth:true,autoFitHeight:true},interactions:[]});
  Object.assign(widget.style,{fill:'#dbe7ff',stroke:'#234a88',strokeWidth:1,radius:0});page.widgets.push(widget);return doc;
}

/** Independent arithmetic for moving the first main anchor to X=-25%.
 * Main world bounds become [50,100]..[300,200]; detached points remain at
 * X700 and X700.0005 and are normalized against that same new owner. */
export function expectedDetachedContourCommit(){return {
  bounds:{x:50,y:100,width:250,height:100},
  vectorPath:{fillRule:'nonzero',commands:[
    {op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:.2,y:1},{op:'Z'},
    {op:'M',x:2.6,y:0},{op:'L',x:2.600002,y:0},
  ]} satisfies VectorPath,
};}
