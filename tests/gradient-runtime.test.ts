import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createGradientRenderer } from '../src/model/gradient';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { exportPrototype } from '../src/runtime/export';
import type { Action, Document, GradientFill, Interaction } from '../src/model/types';
import { widgetStyle } from '../src/components/WidgetView';

const linear = (): GradientFill => ({ type:'linear',start:{x:0,y:.5},end:{x:1,y:.5},stops:[{offset:0,color:'#ff0000'},{offset:1,color:'#0000ff80'}] });
const radial = (): GradientFill => ({ type:'radial',center:{x:.5,y:.5},axis1:{x:1,y:.5},axis2:{x:.5,y:1},stops:linear().stops });
const event = (...actions: Omit<Action,'id'>[]): Interaction => ({id:uid(),name:'Fill',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:actions.map(action=>({...action,id:uid()}))});
const sessions:OfflineRuntime[]=[];afterEach(()=>sessions.splice(0).forEach(session=>session.dispose()));
const make=(doc:Document,portable:boolean)=>{const session:OfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout})(doc):createOfflineRuntime(doc);sessions.push(session);return session};
for(const portable of [false,true])describe(`${portable?'serialized':'module'} gradient renderer`,()=>{
  const render:ReturnType<typeof createGradientRenderer>=portable?new Script(`(${createGradientRenderer.toString()})()`).runInNewContext():createGradientRenderer();
  it('uses normalized endpoints including outside bounds, retaining ordered duplicate stops',()=>{
    const fill=linear();if(fill.type!=='linear')throw Error();fill.start={x:-.25,y:.25};fill.end={x:1.5,y:.75};fill.stops=[{offset:0,color:'red'},{offset:.5,color:'red'},{offset:.5,color:'blue'},{offset:1,color:'blue'}];
    const definition=render.svg(fill,200,100,'unique');expect(definition.attrs).toEqual({id:'unique',gradientUnits:'userSpaceOnUse',x1:'-50',y1:'25',x2:'300',y2:'75'});expect(definition.stops).toEqual(fill.stops);
  });
  it('matches retained radial physical-axis matrix for non-square and rotated bounds',()=>{
    const fill=radial();if(fill.type!=='radial')throw Error();expect(render.svg(fill,200,100,'g').attrs).toMatchObject({cx:'100',cy:'50',r:'100',gradientTransform:'matrix(1 0 0 0.5 0 25)'});
    fill.axis1={x:.5,y:1.5};fill.axis2={x:.75,y:.5};expect(render.svg(fill,200,100,'g').attrs.gradientTransform).toBe('matrix(0 1 -0.5 0 125 -50)');
    fill.axis2={x:.5,y:1};expect(render.svg(fill,200,100,'g').attrs.gradientTransform).toBe('matrix(0 1 -0.5 0 125 -50)');
  });
  it('keeps zero axes in data and explicitly signals no paint rather than invalid NaN transforms',()=>{
    const fill=radial();if(fill.type!=='radial')throw Error();fill.axis1={...fill.center};const before=JSON.stringify(fill),definition=render.svg(fill,200,100,'g');expect(definition.empty).toBe(true);expect(JSON.stringify(definition)).not.toContain('NaN');expect(render.background({fillGradient:fill,color:'red'},200,100)).toBe('none');expect(JSON.stringify(fill)).toBe(before);
    fill.axis1={x:1,y:.5};fill.axis2={...fill.center};expect(render.svg(fill,200,100,'g').empty).toBe(true);
  });
  it('encodes SVG image data safely and resolves currentColor stops in their widget context',()=>{
    const fill=linear();fill.stops[0].color=' currentcolor ';const css=render.background({fillGradient:fill,color:'#123456'},200,100);
    const xml=decodeURIComponent(css.slice('url("data:image/svg+xml,'.length,-2));expect(xml).toContain('stop-color="#123456"');expect(xml).toContain('stop-color="#0000ff80"');expect(xml).not.toContain('currentcolor');expect(css).not.toContain('<');
    expect(render.needsComputedColor({fillGradient:fill,color:' currentColor '})).toBe(true);expect(decodeURIComponent(render.background({fillGradient:fill,color:'currentColor'},200,100,'rgb(36, 86, 171)'))).toContain('stop-color="rgb(36, 86, 171)"');
    expect(render.id('page/row/<svg>😀')).toMatch(/^rea-gradient-[0-9a-f-]+$/);expect(render.id('row/1')).not.toBe(render.id('row/2'));
  });
  it('retains default SVG offsets only until the first temporary gradient or solid paint',()=>{
    const original=linear(),changed=linear();changed.stops=[{offset:.2,color:'green'},{offset:.8,color:'white'}];const paint=render.paintSession(original);
    expect(paint(changed)?.stops).toEqual([{offset:0,color:'green'},{offset:1,color:'white'}]);expect(paint(radial())?.type).toBe('radial');expect(paint(changed)?.stops).toEqual(changed.stops);
    const other=render.paintSession(original);other(undefined);expect(other(changed)?.stops).toEqual(changed.stops);
    expect(render.paintSession()(changed)?.stops).toEqual(changed.stops);expect(original).toEqual(linear());
  });
  it('a count mismatch ends default reuse, but an independent row keeps its own original stop offsets',()=>{
    const base=linear(),changed=linear();changed.stops[1].offset=.7;const rowA=render.paintSession(base),rowB=render.paintSession(base);
    rowA({...base,stops:[...base.stops,{offset:1,color:'white'}]});expect(rowA(changed)?.stops[1].offset).toBe(.7);expect(rowB(changed)?.stops[1].offset).toBe(1);
  });
  it('solid and gradient SetStyle preserve design, roll back failures and isolate repeated rows',async()=>{
    const doc=createDocument(),repeater=createWidget('repeater'),w=createWidget('box');w.style.fillGradient=linear();w.interactions=[event({type:'setStyle',targetId:w.id,style:{fill:'#123456'}})];repeater.repeater!.rows=[{Name:'A'},{Name:'B'}];repeater.repeater!.columns=['Name'];repeater.repeater!.template=[w];doc.pages[0].widgets=[repeater];const before=serializeDocument(doc),session=make(doc,portable);await session.start();const rows=session.rows(repeater);
    await session.trigger(w.id,'click',rows[0].data,rows[0].context);expect(session.widget(w,rows[0].context).style.fillGradient).toBeUndefined();expect(session.widget(w,rows[1].context).style.fillGradient).toEqual(linear());
    const snapshot=structuredClone(session.state());await expect(session.execute(event({type:'setStyle',targetId:w.id,style:{fillGradient:radial()}},{type:'addRow',targetId:repeater.id,value:'invalid'}))).rejects.toThrow();expect(session.state()).toEqual(snapshot);
    await session.execute(event({type:'addRow',targetId:repeater.id,value:'{"Name":"C"}'}));expect(session.widget(w,session.rows(repeater)[0].context).style.fillGradient).toEqual(linear());expect(serializeDocument(doc)).toBe(before);
  });
});
it('uses actual static repeater layout and caller supplied runtime size for the radial image viewport',()=>{
  const widget=createWidget('repeater');widget.width=60;widget.height=80;widget.style.fillGradient=radial();widget.repeater={columns:['Name'],rows:[{Name:'A'},{Name:'B'}],template:[],itemWidth:180,itemHeight:50,layout:'vertical',gap:0};
  const authored=widgetStyle(widget);expect(authored.width).toBe(180);expect(authored.height).toBe(100);expect(decodeURIComponent(String(authored.backgroundImage))).toContain('viewBox="0 0 180 100"');
  expect(decodeURIComponent(String(widgetStyle(widget,true,{width:240,height:70}).backgroundImage))).toContain('viewBox="0 0 240 70"');
});
it('embeds the same closed gradient factory in the root and child players without dynamic HTML execution',()=>{
  const doc=createDocument(),w=createWidget('path');w.style.fillGradient=linear();doc.pages[0].widgets=[w];const html=exportPrototype(doc);expect(html).toContain('gradients:(');expect(html).toContain('gradientUnits');expect(html).not.toContain('innerHTML');expect(html).not.toMatch(/new Function|eval\(/);
});
