import {nativePointEditingFixture} from './native-point-editing';
import type {VectorPath} from '../../src/model/types';

export function nativePointCommitFixture(){
  const doc=nativePointEditingFixture();doc.id='point-commit-document';doc.name='Point commit geometry';
  const page=doc.pages[0],widget=page.widgets[0];page.id='point-commit-page';page.name='Point commit';
  Object.assign(widget,{type:'path',name:'Editable commit path',x:100,y:100,width:200,height:100,rotation:0,text:'Point commit',shapeText:{autoFitWidth:true,autoFitHeight:true}});
  widget.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]} satisfies VectorPath;
  return doc;
}
