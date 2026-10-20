import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { createComponent, createComponentInstance, syncComponentInstances } from '../src/model/components';
import { parseVectorPath, vectorPathData, VECTOR_LIMITS } from '../src/model/vector';
import { WidgetContent, widgetStyle } from '../src/components/WidgetView';
import { VectorPathEditor } from '../src/components/Inspector';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import type { VectorPath } from '../src/model/types';

const curve: VectorPath = { fillRule: 'evenodd', commands: [
  { op: 'M', x: -.1, y: .25 }, { op: 'C', x1: .1, y1: -.2, x2: 1.2, y2: .75, x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' },
  { op: 'M', x: .25, y: .25 }, { op: 'L', x: .5, y: .5 },
] };
const withPath = (path: unknown) => { const doc = createDocument(), widget = createWidget('path'); widget.vectorPath = path as VectorPath; doc.pages[0].widgets = [widget]; return doc; };

describe('bounded vector path model', () => {
  it('creates an independent triangle and leaves legacy box/ellipse geometry untouched', () => {
    const a = createWidget('path'), b = createWidget('path');
    expect(a.vectorPath).toEqual({ fillRule: 'nonzero', commands: [{ op: 'M', x: .5, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] });
    a.vectorPath!.commands.pop(); expect(b.vectorPath!.commands).toHaveLength(4);
    for (const type of ['box','ellipse'] as const) {
      const doc = createDocument(); doc.pages[0].widgets = [createWidget(type)];
      expect(doc.pages[0].widgets[0]).not.toHaveProperty('vectorPath');
      expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });
  it.each(['box','ellipse','path'] as const)('preserves %s open/closed subpaths, control points outside bounds and fill rule', type => {
    const doc = withPath(curve); doc.pages[0].widgets[0].type = type;
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const parsed = parseVectorPath(curve); expect(parsed).toEqual(curve); expect(parsed).not.toBe(curve); expect(parsed.commands[0]).not.toBe(curve.commands[0]);
  });
  it('requires path geometry and forbids it on unrelated widget types', () => {
    const doc = withPath(curve); delete doc.pages[0].widgets[0].vectorPath;
    expect(() => parseDocument(JSON.stringify(doc))).toThrow(/require vectorPath/);
    for (const type of ['button','input','text','repeater'] as const) {
      const doc = createDocument(), widget = createWidget(type); widget.vectorPath = curve; doc.pages[0].widgets = [widget];
      expect(() => parseDocument(JSON.stringify(doc))).toThrow(/only supported on box, ellipse and path/);
    }
  });
  it.each([
    null, '<svg onload="alert(1)">', { fillRule: 'inherit', commands: [{op:'M',x:0,y:0}] },
    { fillRule: 'nonzero', commands: [] }, { fillRule: 'nonzero', commands: [{op:'L',x:0,y:0}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0},{op:'Z'},{op:'L',x:1,y:1}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0},{op:'Z'},{op:'Z'}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0},{op:'Q',x:1,y:1}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:'0',y:0}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0},{op:'C',x1:0,y1:0,x:1,y:1}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0},{op:'Z',x:1}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0,onload:'alert(1)'}] },
    { fillRule: 'nonzero', commands: [{op:'M',x:0,y:0}], stroke: 'url(https://invalid)' },
  ])('rejects malformed or executable path input %#', value => {
    expect(() => parseVectorPath(value)).toThrow(/vectorPath/);
    expect(() => parseDocument(JSON.stringify(withPath(value)))).toThrow();
  });
  it('rejects nonfinite/out-of-budget coordinates, dangerous keys and excessive commands', () => {
    for (const x of [NaN, Infinity, -Infinity, 10000.1, -10000.1]) expect(() => parseVectorPath({ fillRule: 'nonzero', commands: [{op:'M',x,y:0}] })).toThrow(/finite coordinate/);
    for (const key of ['__proto__','constructor','prototype']) {
      const path = JSON.parse(`{"fillRule":"nonzero","commands":[{"op":"M","x":0,"y":0,"${key}":{}}]}`);
      expect(() => parseVectorPath(path)).toThrow(/unknown property/);
    }
    const path = { fillRule: 'nonzero', commands: Array.from({length:VECTOR_LIMITS.commands},()=>({op:'M',x:10000,y:-10000})) };
    expect(parseVectorPath(path).commands).toHaveLength(4096);
    path.commands.push({op:'M',x:0,y:0}); expect(() => parseVectorPath(path)).toThrow(/4096/);
  });
  it('copies normalized geometry without moving its nodes and synchronizes component copies independently', () => {
    const doc = withPath(curve), original = doc.pages[0].widgets[0], copy = cloneWidgets([original])[0];
    expect(copy.id).not.toBe(original.id); expect(copy.x).toBe(original.x+20); expect(copy.vectorPath).toEqual(curve);
    expect(copy.vectorPath).not.toBe(original.vectorPath); expect(copy.vectorPath!.commands[0]).not.toBe(original.vectorPath!.commands[0]);
    const component = createComponent([original]), first = createComponentInstance(component,20,30), second = createComponentInstance(component,400,500);
    doc.components=[component]; doc.pages[0].widgets=[first,second];
    component.widgets[0].vectorPath!.commands[1]={op:'L',x:.8,y:.7};
    const next=syncComponentInstances(doc,component.id);
    expect(next.pages[0].widgets.map(w=>[w.x,w.y])).toEqual([[20,30],[400,500]]);
    const children=next.pages[0].widgets.map(w=>w.states![0].widgets[0]);
    expect(children[0].id).not.toBe(children[1].id); expect(children[0].vectorPath).toEqual(children[1].vectorPath);
    expect(children[0].vectorPath!.commands[1]).toEqual({op:'L',x:.8,y:.7});
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

describe('vector drawing and authoring', () => {
  const portable = runInNewContext(`(${vectorPathData.toString()})`) as typeof vectorPathData;
  it.each([['module',vectorPathData],['portable',portable]] as const)('%s renderer maps every axis without clamping or approximating cubics', (_name,draw) => {
    expect(draw(curve,200,100)).toBe('M -20 25 C 20 -20 240 75 200 100 L 0 100 Z M 50 25 L 100 50');
    expect(draw(curve,100,200)).toBe('M -10 50 C 10 -40 120 150 100 200 L 0 200 Z M 25 50 L 50 100');
    expect(draw(curve,0,0)).toBe('M 0 0 C 0 0 0 0 0 0 L 0 0 Z M 0 0 L 0 0');
    expect(()=>draw(curve,Infinity,100)).toThrow(/dimensions/);
  });
  it('renders SVG fill/stroke and selected text without CSS shape geometry', () => {
    const widget=createWidget('path');widget.vectorPath=curve;widget.text='<literal>';widget.selected=true;
    Object.assign(widget.style,{strokeWidth:3,borderWidths:[9,8,7,6],radius:60});widget.selectedStyle={fill:'#abcdef',stroke:'#123456',strokeWidth:5,color:'#ff0000'};
    expect(widgetStyle(widget)).toMatchObject({backgroundColor:'transparent',backgroundImage:'none',borderWidth:0,borderRadius:0,overflow:'visible',color:'#ff0000'});
    const html=renderToStaticMarkup(createElement(WidgetContent,{widget}));
    expect(html).toContain('fill-rule="evenodd"');expect(html).toContain('stroke-width="5"');expect(html).toContain('fill="#abcdef"');expect(html).toContain('stroke="#123456"');expect(html).toContain('vector-effect="non-scaling-stroke"');expect(html).toContain('&lt;literal&gt;');
  });
  it('keeps runtime resize, movement and selected styles independent from normalized path data', async () => {
    const doc=withPath(curve), widget=doc.pages[0].widgets[0];widget.selectedStyle={fill:'#abcdef',strokeWidth:7};const runtime=createOfflineRuntime(doc);
    try {
      await runtime.execute({id:'vector-resize',event:'click',name:'Resize and select',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'move-vector',type:'move',targetId:widget.id,x:350,y:80},{id:'resize-vector',type:'resize',targetId:widget.id,x:240,y:75},{id:'select-vector',type:'setSelected',targetId:widget.id,value:'true'}]});
      const result=runtime.widget(widget);expect(result).toMatchObject({x:350,y:80,width:240,height:75,vectorPath:curve,style:{fill:'#abcdef',strokeWidth:7}});
      expect(vectorPathData(result.vectorPath!,result.width,result.height)).toContain('C 24 -15 288 56.25 240 75');
      expect(widget.vectorPath).toEqual(curve);expect(widget.width).toBe(180);
    } finally {runtime.dispose();}
  });
  it('presents visual nodes, fill rules and ordinary editing controls instead of raw JSON', () => {
    const warnings=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      const html=renderToStaticMarkup(createElement(VectorPathEditor,{path:curve,onChange:()=>{}}));
      expect(warnings).not.toHaveBeenCalled();
      expect(html).toContain('<title>Node 1</title>');
      expect(html).toContain('Path node preview');expect(html).toContain('Path fill rule');expect(html).toContain('Node X %');expect(html).toContain('Add curve node');expect(html).toContain('New subpath');expect(html).not.toContain('<textarea');
    } finally {warnings.mockRestore();}
  });
});
