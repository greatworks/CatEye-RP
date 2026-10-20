import {nativePillsFixture} from './native-pills';
import type {VectorPath} from '../../src/model/types';

export function nativePointEditingFixture(){
  const doc=nativePillsFixture();doc.id='point-editing-document';doc.name='Native point editing';
  const page=doc.pages[0],widget=page.widgets.find(w=>w.id==='pills-target')!;
  page.id='point-editing-page';page.name='Point editing';page.width=1000;page.height=700;
  Object.assign(widget,{id:'point-target',name:'Resized native capsule',x:100,y:100,width:240,height:60});
  widget.style.radius=18;widget.style.strokeWidth=2;
  delete widget.mouseOverStyle;delete widget.selectedStyle;
  page.widgets=[widget];return doc;
}

/** Independent expected outer contour: 240 x 60, radius 18, native .44 handles. */
export function expectedPointEditingPath():VectorPath{return {fillRule:'nonzero',commands:[
  {op:'M',x:0,y:18/60},
  {op:'C',x1:0,y1:7.92/60,x2:7.92/240,y2:0,x:18/240,y:0},
  {op:'L',x:222/240,y:0},
  {op:'C',x1:232.08/240,y1:0,x2:1,y2:7.92/60,x:1,y:18/60},
  {op:'L',x:1,y:42/60},
  {op:'C',x1:1,y1:52.08/60,x2:232.08/240,y2:1,x:222/240,y:1},
  {op:'L',x:18/240,y:1},
  {op:'C',x1:7.92/240,y1:1,x2:0,y2:52.08/60,x:0,y:42/60},
  {op:'L',x:0,y:18/60},{op:'Z'},
]};}
