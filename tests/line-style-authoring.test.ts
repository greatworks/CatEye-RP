import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, mergeWidgetStyle, parseDocument, serializeDocument } from '../src/model/document';
import { ARROW_STYLES, LINE_PATTERNS, type GradientFill, type Interaction } from '../src/model/types';
import { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { changeBorderVisibility, changeLineEnd, filterLineStylePatch, inheritLineStyleProperty, LineStyleEditor, LineStyleOverrides, lineStyleFieldsFor } from '../src/components/LineStyleEditor';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';

const noop=()=>{};
const gradient:GradientFill={type:'linear',start:{x:0,y:0},end:{x:1,y:1},stops:[{offset:0,color:'red'},{offset:1,color:'blue'}]};
describe('line-style authoring',()=>{
  it('offers all nine native patterns and all 29 concrete end styles, with no mixed sentinel or invented cap selector',()=>{
    const w=createWidget('line'),html=renderToStaticMarkup(createElement(LineStyleEditor,{widget:w,style:w.style,onChange:noop}));
    for(const value of LINE_PATTERNS)expect(html).toContain(`value="${value}"`);
    for(const value of ARROW_STYLES)expect(html).toContain(`value="${value}"`);
    expect(html.match(/aria-label="Start arrow"/g)).toHaveLength(1);expect(html).toContain('aria-label="End arrow"');
    expect(html).not.toContain('Indeterminate');expect(html).not.toContain('Line cap');expect(html).not.toContain('Line join');
  });
  it('changes one endpoint atomically while retaining its inherited partner and leaves its input untouched',()=>{
    const inherited={start:'hollow-circle' as const,end:'large-filled-diamond' as const};
    expect(changeLineEnd(inherited,'start','crow')).toEqual({start:'crow',end:'large-filled-diamond'});
    expect(changeLineEnd(undefined,'end','filled-triangle')).toEqual({start:'none',end:'filled-triangle'});
    expect(inherited).toEqual({start:'hollow-circle',end:'large-filled-diamond'});
  });
  it('edits a side in top/right/bottom/left order without changing its other slots or widths',()=>{
    const original=[false,true,false,true] as [boolean,boolean,boolean,boolean];
    expect(changeBorderVisibility(original,3,false)).toEqual([false,true,false,false]);
    expect(changeBorderVisibility(undefined,1,false)).toEqual([true,false,true,true]);
    expect(original).toEqual([false,true,false,true]);
  });
  it('removing an override differs from explicit reset and preserves unrelated effect and paint properties',()=>{
    const patch={linePattern:'dot' as const,lineEnds:{start:'crow' as const,end:'filled-circle' as const},borderVisibility:[false,true,false,true] as [boolean,boolean,boolean,boolean],strokeGradient:gradient,strokeWidth:5,color:'red'};
    const without=inheritLineStyleProperty(patch,'lineEnds');expect(Object.hasOwn(without,'lineEnds')).toBe(false);
    expect(without).toEqual({linePattern:'dot',borderVisibility:patch.borderVisibility,strokeGradient:gradient,strokeWidth:5,color:'red'});
    const style=mergeWidgetStyle(createWidget('line').style,patch);
    for(const command of [{linePattern:'solid' as const},{lineEnds:{start:'none' as const,end:'none' as const}},{borderVisibility:[true,true,true,true] as [boolean,boolean,boolean,boolean]},{strokeWidth:8},{stroke:'#123456'}]){
      const next=mergeWidgetStyle(style,command);expect(next.fill).toBe(style.fill);
      if(!('stroke' in command))expect(next.strokeGradient).toEqual(gradient);
      if(!('lineEnds' in command))expect(next.lineEnds).toEqual(style.lineEnds);
      if(!('borderVisibility' in command))expect(next.borderVisibility).toEqual(style.borderVisibility);
    }
  });
  it('uses geometry gates for mixed selection and retains saved unsupported data for roundtrip',()=>{
    const line=createWidget('line'),box=createWidget('box'),input=createWidget('input');
    const patch={lineEnds:{start:'crow' as const,end:'none' as const},borderVisibility:[true,false,true,false] as [boolean,boolean,boolean,boolean],linePattern:'dot' as const,strokeGradient:gradient};
    expect(filterLineStylePatch(line,patch)).toEqual({lineEnds:patch.lineEnds,linePattern:'dot',strokeGradient:gradient});
    expect(filterLineStylePatch(input,patch)).toEqual({borderVisibility:patch.borderVisibility,linePattern:'dot',strokeGradient:gradient});
    expect(lineStyleFieldsFor(box)).toEqual(['linePattern','borderVisibility']);
    box.style.lineEnds=patch.lineEnds;
    const html=renderToStaticMarkup(createElement(LineStyleEditor,{widget:box,style:box.style,onChange:noop}));expect(html).not.toContain('aria-label="Start arrow"');expect(html).toContain('Saved line ends settings are kept');
    const doc=createDocument();doc.pages[0].widgets=[box];expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('uses the shared geometry gate for open compound contours and strict rectangular vectors',()=>{
    const w=createWidget('box');w.width=200;w.height=100;
    w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};
    expect(lineStyleFieldsFor(w)).toEqual(['linePattern','borderVisibility']);
    const rectangle=structuredClone(w.vectorPath);
    w.vectorPath.commands.push({op:'M',x:.2,y:.5},{op:'C',x1:.4,y1:0,x2:.6,y2:1,x:.8,y:.5});
    expect(lineStyleFieldsFor(w)).toEqual(['linePattern','lineEnds']);
    w.vectorPath=rectangle;w.vectorPath.commands[1]={op:'L',x:.9,y:.1};
    expect(lineStyleFieldsFor(w)).toEqual(['linePattern']);
    w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0}]};
    expect(lineStyleFieldsFor(w)).toEqual(['linePattern']);
  });
  it('base, Selected and Set style expose the shared controls while legacy rendering alone writes no defaults',()=>{
    const doc=createDocument(),w=createWidget('line');w.selectedStyle={};doc.pages[0].widgets=[w];const before=serializeDocument(doc);
    const html=renderToStaticMarkup(createElement(Inspector,{document:doc,page:doc.pages[0],widget:w,onWidgetChange:noop,onPageChange:noop}));
    for(const name of ['Line pattern','Start arrow','End arrow','Override Selected line pattern','Override Selected line ends'])expect(html).toContain(`aria-label="${name}"`);
    const cases:Interaction[]=[{id:'case',event:'click',name:'Update line',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'action',type:'setStyle',targetId:w.id,style:{linePattern:'none',lineEnds:{start:'none',end:'none'}}}]}];
    const action=renderToStaticMarkup(createElement(InteractionsEditor,{document:doc,page:doc.pages[0],widget:w,interactions:cases,onChange:noop}));expect(action).toContain('aria-label="Action 1 start arrow"');expect(action).toContain('aria-label="Action 1 line pattern"');
    expect(serializeDocument(doc)).toBe(before);
  });
  it('effect override editors inherit full endpoints and sides only after explicit activation',()=>{
    const w=createWidget('box');w.style.borderVisibility=[false,true,false,true];
    const empty=renderToStaticMarkup(createElement(LineStyleOverrides,{widget:w,patch:{},base:w.style,prefix:'MouseOver',onChange:noop}));expect(empty).toContain('Override MouseOver border visibility');expect(empty).not.toContain('MouseOver border top visible');
    const active=renderToStaticMarkup(createElement(LineStyleOverrides,{widget:w,patch:{borderVisibility:[true,true,true,true]},base:w.style,prefix:'MouseOver',onChange:noop}));expect(active).toContain('MouseOver border top visible');expect(active.match(/checked=""/g)).toHaveLength(5);
  });
  it('adaptive reset stores default values without changing Base or unrelated paint and later geometry edits retain them',()=>{
    const doc=createDocument(),w=createWidget('line');w.style.linePattern='dot';w.style.lineEnds={start:'crow',end:'filled-triangle'};w.style.strokeGradient=gradient;doc.pages[0].widgets=[w];doc.pages[0].adaptiveViews=[{id:'phone',name:'Phone',width:600,overrides:{}}];
    const page=doc.pages[0],edits=structuredClone(resolveAdaptiveWidgets(page,'phone'));edits[0].style.linePattern=undefined;edits[0].style.lineEnds=undefined;
    const edited=applyAdaptiveWidgetEdits(page,'phone',edits);expect(edited.widgets).toEqual(page.widgets);
    expect(edited.adaptiveViews[0].overrides[w.id]).toEqual({style:{linePattern:'solid',lineEnds:{start:'none',end:'none'}}});
    const moved=structuredClone(resolveAdaptiveWidgets(edited,'phone'));moved[0].x+=20;
    expect(applyAdaptiveWidgetEdits(edited,'phone',moved).adaptiveViews[0].overrides[w.id]).toEqual({x:w.x+20,style:{linePattern:'solid',lineEnds:{start:'none',end:'none'}}});
  });
});
