import { Script } from 'node:vm';
import { describe,expect,it } from 'vitest';
import { createGradientRenderer } from '../src/model/gradient';
import { createWidget,parseDocument,serializeDocument,uid } from '../src/model/document';
import { widgetStyle } from '../src/components/WidgetView';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { exportPrototype } from '../src/runtime/export';
import { gradientBorderFixture } from './fixtures/gradient-borders';
import type { GradientFill } from '../src/model/types';
const linear:GradientFill={type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'#ff000080'},{offset:1,color:'#0000ff'}]};
for(const portable of [false,true])describe(`${portable?'serialized':'module'} gradient borders`,()=>{
  const render:ReturnType<typeof createGradientRenderer>=portable?new Script(`(${createGradientRenderer.toString()})()`).runInNewContext():createGradientRenderer();
  it('has independent fill and border defaults and invalidates only the solid-painted channel',()=>{
    const fill=render.paintSession(linear),border=render.paintSession(linear),changed={...linear,stops:[{offset:.2,color:'green'},{offset:.8,color:'white'}]};
    expect(fill(changed)?.stops[0].offset).toBe(0);expect(border(changed)?.stops[0].offset).toBe(0);border(undefined);expect(border(changed)?.stops[0].offset).toBe(.2);expect(fill(changed)?.stops[0].offset).toBe(0);
  });
  it('creates full-bounds independent fill and border layers with transparent interiors',()=>{
    const w=createWidget('box');Object.assign(w.style,{fillGradient:linear,strokeGradient:linear,borderWidths:[8,20,15,5],cornerRadii:[28,8,38,16]});
    const image=decodeURIComponent(render.backgrounds(w.style,w.type,200,100));expect(image).toContain('viewBox="0 0 200 100"');expect(image).toContain('id="s"');expect(image).toContain('id="g"');expect(image).toContain('fill-rule="evenodd"');expect(image).toContain('#ff000080');expect(image).not.toContain('<script');
    expect(render.border(w.style,0,100)).toBe('none');expect(render.id('row/1/stroke')).not.toBe(render.id('row/1/fill'));
  });
  it('keeps image first-stop alpha and radial transparent fallback distinct from general stroke',()=>{
    expect(render.strokeMode('image')).toBe('imageFallback');expect(render.strokeMode('line')).toBe('gradient');expect(render.strokeMode('inlineFrame')).toBe('none');expect(render.supportsStroke('hotspot')).toBe(false);
    expect(render.strokeColor({stroke:'white',strokeGradient:linear},'image')).toBe('#ff000080');expect(render.strokeColor({stroke:'white',strokeGradient:{type:'radial',center:{x:.5,y:.5},axis1:{x:1,y:.5},axis2:{x:.5,y:1},stops:linear.stops}},'image')).toBe('transparent');
  });
  it('resolves border currentColor against the actual inherited color and escapes image XML',()=>{
    const w=createWidget('box');w.style.color='currentColor';w.style.strokeGradient={...linear,stops:linear.stops.map(stop=>({...stop,color:' currentcolor '}))};expect(render.needsComputedColor(w.style)).toBe(true);expect(decodeURIComponent(render.backgrounds(w.style,'box',100,100,'rgb(1, 2, 3)'))).toContain('stop-color="rgb(1, 2, 3)"');
  });
  it('isolates row stroke changes, rolls back failed action segments and restores on refresh',async()=>{
    const doc=gradientBorderFixture(),repeater=doc.pages[0].widgets.find(w=>w.id==='border-repeater')!,row=repeater.repeater!.template[0],before=serializeDocument(doc);
    const create:typeof createOfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout}):createOfflineRuntime;
    const runtime=create(doc);await runtime.start();const rows=runtime.rows(repeater);
    row.interactions.push({id:uid(),name:'Clear only stroke',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:uid(),type:'setStyle',targetId:row.id,style:{stroke:'#123456'}}]});
    await runtime.trigger(row.id,'click',rows[0].data,rows[0].context);expect(runtime.widget(row,rows[0].context).style.strokeGradient).toBeUndefined();expect(runtime.widget(row,rows[1].context).style.strokeGradient).toEqual(row.style.strokeGradient);
    const snapshot=structuredClone(runtime.state());await expect(runtime.execute({id:uid(),name:'Rollback',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:uid(),type:'setStyle',targetId:row.id,style:{strokeGradient:linear}},{id:uid(),type:'addRow',targetId:repeater.id,value:'invalid'}]})).rejects.toThrow();expect(runtime.state()).toEqual(snapshot);runtime.dispose();row.interactions.pop();expect(serializeDocument(doc)).toBe(before);
  });
});
it('retains layout borders while the gradient ring owns the actual color',()=>{
  const w=createWidget('box');w.style.strokeGradient=linear;w.style.borderWidths=[8,20,15,5];expect(widgetStyle(w)).toMatchObject({borderWidth:'8px 20px 15px 5px',borderColor:'transparent',backgroundOrigin:'border-box'});
  expect(widgetStyle({...w,type:'line'}).borderWidth).toBe(0);
});
it('roundtrips the demonstration and exports one portable helper with separate stroke paint identifiers',()=>{
  const doc=gradientBorderFixture();expect(parseDocument(serializeDocument(doc))).toEqual(doc);const html=exportPrototype(doc);expect(html).toContain('strokeGradient');expect(html).toContain('strokeMode');expect(html).not.toContain('innerHTML');expect(html.match(/data:font\/woff2;base64,/g)?.length??0).toBeLessThanOrEqual(12);
});
