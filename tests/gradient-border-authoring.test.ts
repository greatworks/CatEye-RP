import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, mergeWidgetStyle, parseDocument, serializeDocument } from '../src/model/document';
import { FillEditor, FillOverrideEditor, StrokeEditor, StrokeOverrideEditor, gradientDraft, inheritStrokeProperties, parseGradientDraft, replaceStrokeProperties } from '../src/components/FillEditor';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';
import type { GradientFill, Interaction } from '../src/model/types';

const noop = () => {};
const gradient: GradientFill = { type:'linear',start:{x:-.25,y:.125},end:{x:1.5,y:.875},stops:[{offset:0,color:'#12345680'},{offset:.4,color:'red'},{offset:.4,color:'blue'},{offset:1,color:'transparent'}] };

describe('gradient border authoring and independent paint channels', () => {
  it('same-color Solid removes only the stroke gradient and keeps fill and geometry', () => {
    const source={fill:'#ffffff',fillGradient:gradient,stroke:'#123456',strokeGradient:gradient,strokeWidth:4,borderWidths:[1,2,3,4] as [number,number,number,number],opacity:.7};
    const before=structuredClone(source),next=replaceStrokeProperties(source,{stroke:'#123456'});
    expect(next).toEqual({...source,strokeGradient:undefined}); expect(Object.hasOwn(next,'strokeGradient')).toBe(false); expect(source).toEqual(before);
    expect(mergeWidgetStyle(createWidget('box').style,source)).toMatchObject(source);
  });
  it('inherit removes both stroke keys without dropping other effect/action overrides', () => {
    const source={stroke:'#123456',strokeGradient:gradient,fillGradient:gradient,color:'red',strokeWidth:7};
    expect(inheritStrokeProperties(source)).toEqual({fillGradient:gradient,color:'red',strokeWidth:7});
    expect(source).toHaveProperty('strokeGradient');
  });
  it('gradient-only changes preserve the solid fallback and shared editor coordinates/stops exactly', () => {
    const radial:GradientFill={type:'radial',center:{x:-.175,y:.625},axis1:{x:.75,y:1.25},axis2:{x:1.125,y:-.0625},stops:gradient.stops};
    const parsed=parseGradientDraft(gradientDraft(radial));expect(parsed).toEqual(radial);
    expect(replaceStrokeProperties({stroke:'#123456',fillGradient:gradient},{strokeGradient:parsed})).toEqual({stroke:'#123456',fillGradient:gradient,strokeGradient:radial});
  });
  it('does not convert a border width or radius command into a paint reset', () => {
    const base={...createWidget('box').style,strokeGradient:gradient,fillGradient:gradient};
    for(const patch of [{strokeWidth:12},{borderWidths:[1,2,3,4] as [number,number,number,number]},{radius:30},{opacity:.5}]) {
      expect(mergeWidgetStyle(base,patch).strokeGradient).toEqual(gradient);expect(mergeWidgetStyle(base,patch).fillGradient).toEqual(gradient);
    }
  });
  it('preserves old Fill labels and old Border/Selected border text inputs', () => {
    const document=createDocument(),widget=createWidget('box');widget.selectedStyle={};document.pages[0].widgets=[widget];const before=serializeDocument(document);
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));
    for(const label of ['Fill','Fill type','Border','Border type','Selected border','Selected border type'])expect(html).toContain(`aria-label="${label}"`);
    expect(serializeDocument(document)).toBe(before);
    expect(renderToStaticMarkup(createElement(FillEditor,{value:widget.style,onChange:noop}))).toContain('aria-label="Fill type"');
    expect(renderToStaticMarkup(createElement(FillOverrideEditor,{label:'MouseOver fill',base:widget.style,patch:{},onChange:noop}))).toContain('Override MouseOver fill');
  });
  it('exposes base, selected, other-state and Set style gradient border controls without merging channels', () => {
    const document=createDocument(),widget=createWidget('box');widget.style.strokeGradient=gradient;widget.selectedStyle={strokeGradient:gradient};document.pages[0].widgets=[widget];
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));expect(html).toContain('Edit Border gradient');expect(html).toContain('Edit Selected border gradient');
    const state=renderToStaticMarkup(createElement(StrokeOverrideEditor,{label:'MouseOver border',base:widget.style,patch:{strokeGradient:gradient},onChange:noop}));expect(state).toContain('Override MouseOver border');expect(state).toContain('MouseOver border gradient preview');expect(state).toContain('stroke-width="12"');
    const interaction:Interaction={id:'border-case',event:'click',name:'Border',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'border-action',type:'setStyle',targetId:widget.id,style:{strokeGradient:gradient}}]};
    const action=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget,interactions:[interaction],onChange:noop}));expect(action).toContain('Edit Action 1 border gradient');expect(action).toContain('Override Action 1 fill');
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
  it('uses the stroke capability matrix independently of fill, including line strokes', () => {
    const value={stroke:'#123456',strokeGradient:gradient};
    const line=renderToStaticMarkup(createElement(StrokeEditor,{value,widgetType:'line',onChange:noop}));expect(line.match(/<option value="linear"[^>]*>/)?.[0]).toBe('<option value="linear" selected="">');expect(line).not.toContain('saved gradient is retained');
    const image=renderToStaticMarkup(createElement(StrokeEditor,{value,widgetType:'image',onChange:noop}));expect(image).toContain('Image borders use only the first stop');expect(image).toContain('Radial image borders are transparent');
    for(const widgetType of ['hotspot','inlineFrame']){const html=renderToStaticMarkup(createElement(StrokeEditor,{value,widgetType,onChange:noop}));expect(html).toContain('value="linear" disabled=""');expect(html).toContain('saved gradient is retained')}
  });
  it('rejects malformed shared gradient drafts instead of rewriting an invalid border', () => {
    for(const modify of [(d:ReturnType<typeof gradientDraft>)=>{d.stops[0].offset='.9'},(d:ReturnType<typeof gradientDraft>)=>{d.stops[1].color='url(https://example.test/x)'},(d:ReturnType<typeof gradientDraft>)=>{d.points.start.x=''},(d:ReturnType<typeof gradientDraft>)=>{d.points.end.y='1001'}]){
      const draft=gradientDraft(gradient);modify(draft);expect(()=>parseGradientDraft(draft)).toThrow();
    }
  });
});
