import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, serializeDocument } from '../src/model/document';
import { FillEditor, FillOverrideEditor, gradientDraft, inheritFillProperties, moveGradientStop, newFillGradient, parseGradientDraft, replaceFillProperties } from '../src/components/FillEditor';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';
import type { GradientFill, Interaction } from '../src/model/types';

const noop=()=>{};
const gradient:GradientFill={type:'linear',start:{x:-.25,y:.125},end:{x:1.5,y:.875},stops:[{offset:0,color:'#12345680'},{offset:.4,color:'red'},{offset:.4,color:'blue'},{offset:1,color:'transparent'}]};

describe('gradient authoring drafts and complete fill commands',()=>{
  it('round-trips original rotated/outside points and duplicate-offset source order without mutation',()=>{
    const values:GradientFill[]=[gradient,{type:'radial',center:{x:-.175,y:.625},axis1:{x:.75,y:1.25},axis2:{x:1.125,y:-.0625},stops:gradient.stops}];
    for(const value of values){const before=JSON.stringify(value),draft=gradientDraft(value);expect(parseGradientDraft(draft)).toEqual(value);expect(JSON.stringify(value)).toBe(before);draft.stops[1].color='#ffffff';expect(JSON.stringify(value)).toBe(before)}
  });
  it('rejects incomplete/unsorted/invalid drafts instead of silently sorting or saving a previous value',()=>{
    for(const modify of [(d:ReturnType<typeof gradientDraft>)=>{d.points.start.x=''},(d:ReturnType<typeof gradientDraft>)=>{d.points.start.x='1001'},(d:ReturnType<typeof gradientDraft>)=>{d.stops[0].offset='.9'},(d:ReturnType<typeof gradientDraft>)=>{d.stops[1].color='notacolor'},(d:ReturnType<typeof gradientDraft>)=>{d.stops[1].color='url(https://example.test/a)'},(d:ReturnType<typeof gradientDraft>)=>{d.stops=[d.stops[0]]}]){const draft=gradientDraft(gradient);modify(draft);expect(()=>parseGradientDraft(draft)).toThrow()}
  });
  it('moves colors between ordered positions, including same-offset hard edges, without rewriting geometry',()=>{
    const draft=gradientDraft(gradient),moved=moveGradientStop(draft,1,1),parsed=parseGradientDraft(moved);
    expect(parsed.stops).toEqual([gradient.stops[0],gradient.stops[2],gradient.stops[1],gradient.stops[3]]);expect(parsed).toMatchObject({start:gradient.start,end:gradient.end});expect(draft).toEqual(gradientDraft(gradient));expect(moveGradientStop(draft,0,-1)).toBe(draft);
  });
  it('distinguishes same-color Solid from inherited fill, while preserving unrelated state/action properties',()=>{
    const patch={fill:'#ffffff',fillGradient:gradient,opacity:.6,color:'#ff0000'},before=JSON.stringify(patch);
    expect(replaceFillProperties(patch,{fill:'#ffffff'})).toEqual({fill:'#ffffff',opacity:.6,color:'#ff0000'});
    expect(inheritFillProperties(patch)).toEqual({opacity:.6,color:'#ff0000'});
    expect(replaceFillProperties(patch,{fillGradient:newFillGradient('radial','#000000')})).toMatchObject({fill:'#ffffff',opacity:.6,color:'#ff0000',fillGradient:{type:'radial'}});expect(JSON.stringify(patch)).toBe(before);
  });
  it('does not create defaults or modify legacy documents merely by opening the Inspector',()=>{
    const document=createDocument(),widget=createWidget('box');document.pages[0].widgets=[widget];const before=serializeDocument(document);
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));
    expect(html).toContain('aria-label="Fill type"');expect(html).toContain('aria-label="Fill"');expect(html).not.toContain('gradient editor');expect(serializeDocument(document)).toBe(before);
    const a=newFillGradient('linear','#ff0000'),b=newFillGradient('linear','#ff0000');a.stops[0].color='blue';expect(b.stops[0].color).toBe('#ff0000');
  });
  it('makes base/state/action gradient controls available and preserves the legacy Selected fill shortcut',()=>{
    const document=createDocument(),widget=createWidget('box');document.pages[0].widgets=[widget];widget.style.fillGradient=gradient;widget.selectedStyle={};
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));expect(html).toContain('Edit Fill gradient');expect(html).toContain('Selected fill type');
    delete widget.style.fillGradient;
    const legacy=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));expect(legacy).toContain('aria-label="Selected fill"');
    const effect=renderToStaticMarkup(createElement(FillOverrideEditor,{label:'MouseOver fill',base:widget.style,patch:{fillGradient:gradient},onChange:noop}));expect(effect).toContain('Override MouseOver fill');expect(effect).toContain('Edit MouseOver fill gradient');
    const interaction:Interaction={id:'fill-case',event:'click',name:'Fill',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'fill-action',type:'setStyle',targetId:widget.id,style:{fillGradient:gradient}}]};
    const action=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget,interactions:[interaction],onChange:noop}));expect(action).toContain('Edit Action 1 fill gradient');expect(action).toContain('Override Action 1 fill');
  });
  it('does not offer unsupported gradients as working controls or discard their saved data',()=>{
    const value={fill:'#ffffff',fillGradient:gradient},before=JSON.stringify(value);
    for(const widgetType of ['image','line','hotspot','inlineFrame']){const html=renderToStaticMarkup(createElement(FillEditor,{value,widgetType,onChange:noop}));expect(html).toContain('value="radial" disabled=""');expect(html).toContain('saved gradient is retained')}
    expect(JSON.stringify(value)).toBe(before);
  });
});
