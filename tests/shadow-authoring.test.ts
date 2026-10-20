import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, parseWidgetStylePatch, serializeDocument } from '../src/model/document';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';
import { newShadow, SHADOW_FIELDS, ShadowEditor, ShadowOverrides, shadowFieldsFor } from '../src/components/ShadowEditor';
import type { Interaction } from '../src/model/types';
const noop=()=>{};

describe('shadow author controls',()=>{
  it('does not add optional fields to a legacy document merely by rendering its Inspector',()=>{
    const document=createDocument(),widget=createWidget('box');document.pages[0].widgets=[widget];const before=serializeDocument(document);
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));
    for(const [,label] of SHADOW_FIELDS)expect(html).toContain(`aria-label="${label} enabled"`);
    expect(html).not.toContain('aria-label="Outer shadow Offset X"');expect(serializeDocument(document)).toBe(before);
    for(const [field]of SHADOW_FIELDS)expect(widget.style).not.toHaveProperty(field);
  });
  it('creates complete independently owned objects accepted by the shared style boundary',()=>{
    for(const[field]of SHADOW_FIELDS){const a=newShadow(field),b=newShadow(field);expect(a).not.toBe(b);expect(parseWidgetStylePatch({[field]:a})).toEqual({[field]:a});expect(Object.keys(a).sort()).toEqual(['on','offsetX','offsetY','blurRadius','color',...(field==='innerShadow'?['spread']:[])].sort());a.offsetX=99;expect(b.offsetX).toBe(0)}
  });
  it('edits inner spread only, with finite bounded inputs and no raw CSS property editor',()=>{
    for(const[field,label]of SHADOW_FIELDS){const html=renderToStaticMarkup(createElement(ShadowEditor,{field,label,value:{...newShadow(field),offsetX:-2.5,offsetY:3.5,blurRadius:4},onChange:noop}));expect(html).toContain(`aria-label="${label} Offset X"`);expect(html).toContain('min="-1000"');expect(html).toContain('max="1000"');expect(html).toContain('value="-2.5"');expect(html.includes(`aria-label="${label} Spread"`)).toBe(field==='innerShadow');expect(html).not.toContain('<textarea')}
  });
  it('keeps explicit off distinct from absent state/action overrides without mutating unrelated style properties',()=>{
    const document=createDocument(),widget=createWidget('box');document.pages[0].widgets=[widget];const off={...newShadow('outerShadow'),on:false};const patch={fill:'#123456',outerShadow:off};const before=JSON.stringify(patch);
    const html=renderToStaticMarkup(createElement(ShadowOverrides,{patch,base:widget.style,prefix:'MouseOver',onChange:noop}));
    expect(html).toContain('aria-label="Override MouseOver Outer shadow" checked=""');expect(html).toContain('aria-label="MouseOver Outer shadow enabled"');expect(html).not.toContain('aria-label="MouseOver Outer shadow enabled" checked');expect(html).not.toContain('aria-label="MouseOver Inner shadow enabled"');expect(JSON.stringify(patch)).toBe(before);
    const interaction:Interaction={id:'shadow-case',name:'Change shadow',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'shadow-action',type:'setStyle',targetId:widget.id,style:patch}]};
    const action=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget,interactions:[interaction],onChange:noop}));expect(action).toContain('Override Action 1 Outer shadow');expect(action).toContain('Action 1 Outer shadow enabled');expect(action).toContain('Apply style');expect(interaction.actions[0].style).toEqual(patch);
  });
  it('offers only rendered surfaces and preserves unsupported saved settings with an explanation',()=>{
    expect(shadowFieldsFor({type:'image'})).toEqual(['outerShadow']);expect(shadowFieldsFor({type:'line'})).toEqual(['outerShadow']);expect(shadowFieldsFor({type:'panel'})).toEqual(['outerShadow']);expect(shadowFieldsFor({type:'inlineFrame'})).toEqual([]);expect(shadowFieldsFor({type:'hotspot'})).toEqual([]);
    const patch={innerShadow:{...newShadow('innerShadow'),spread:4},textShadow:newShadow('textShadow')},before=JSON.stringify(patch);
    const html=renderToStaticMarkup(createElement(ShadowOverrides,{patch,fields:shadowFieldsFor({type:'image'}),prefix:'MouseOver',onChange:noop}));expect(html).toContain('Override MouseOver Outer shadow');expect(html).not.toContain('Override MouseOver Inner shadow');expect(html).not.toContain('Override MouseOver Text shadow');expect(html).toContain('Existing settings are kept');expect(JSON.stringify(patch)).toBe(before);
    for(const type of ['table','treeNode'] as const){const document=createDocument(),widget=createWidget(type);widget.style.outerShadow=newShadow('outerShadow');document.pages[0].widgets=[widget];const stored=JSON.stringify(widget);const inspector=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));expect(inspector).toContain('Container shadow settings are read-only here');expect(inspector).not.toContain('aria-label="Outer shadow enabled"');expect(JSON.stringify(widget)).toBe(stored)}
  });
  it('offers panel outer shadow only in base and action controls while retaining unsupported saved effects',()=>{
    const document=createDocument(),widget=createWidget('panel');document.pages[0].widgets=[widget];
    const retained={innerShadow:{...newShadow('innerShadow'),spread:4},textShadow:newShadow('textShadow')};Object.assign(widget.style,retained);
    const before=serializeDocument(document),fields=shadowFieldsFor(widget);
    const base=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop}));
    expect(base).toContain('aria-label="Outer shadow enabled"');expect(base).not.toContain('aria-label="Inner shadow enabled"');expect(base).not.toContain('aria-label="Text shadow enabled"');expect(base).toContain('Existing settings are kept');
    const effect=renderToStaticMarkup(createElement(ShadowOverrides,{patch:retained,fields,prefix:'MouseOver',onChange:noop}));expect(effect).toContain('Override MouseOver Outer shadow');expect(effect).not.toContain('Override MouseOver Inner shadow');expect(effect).not.toContain('Override MouseOver Text shadow');
    const interaction:Interaction={id:'panel-shadow-case',name:'Panel shadow',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'panel-shadow-action',type:'setStyle',targetId:widget.id,style:retained}]};
    const action=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget,interactions:[interaction],onChange:noop}));expect(action).toContain('Override Action 1 Outer shadow');expect(action).not.toContain('Override Action 1 Inner shadow');expect(action).not.toContain('Override Action 1 Text shadow');
    expect(serializeDocument(document)).toBe(before);expect(interaction.actions[0].style).toEqual(retained);
  });
});
