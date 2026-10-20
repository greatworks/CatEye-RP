import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,expect,it } from 'vitest';
import { createLineStyleRenderer } from '../src/model/line-style';
import { createGradientRenderer } from '../src/model/gradient';
import { createWidget,parseDocument,serializeDocument,uid } from '../src/model/document';
import { ARROW_STYLES,LINE_PATTERNS,type VectorPath } from '../src/model/types';
import { WidgetContent,widgetStyle } from '../src/components/WidgetView';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { lineStyleFixture } from './fixtures/line-styles';
const evidence=JSON.parse(readFileSync('research/line-style-runtime-probes.json','utf8'));
const arrows=JSON.parse(readFileSync('research/line-style-arrow-probes.json','utf8'));
const rounded:VectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:.2},{op:'C',x1:0,y1:.088,x2:.088,y2:0,x:.2,y:0},{op:'L',x:.8,y:0},{op:'C',x1:.912,y1:0,x2:1,y2:.088,x:1,y:.2},{op:'L',x:1,y:.8},{op:'C',x1:1,y1:.912,x2:.912,y2:1,x:.8,y:1},{op:'L',x:.2,y:1},{op:'C',x1:.088,y1:1,x2:0,y2:.912,x:0,y:.8},{op:'L',x:0,y:.2},{op:'Z'}]};
for(const portable of [false,true])describe(`${portable?'portable':'module'} line renderer`,()=>{
  const render:ReturnType<typeof createLineStyleRenderer>=portable?new Script(`(${createLineStyleRenderer.toString()})()`).runInNewContext():createLineStyleRenderer();
  it('matches all 232 retained original CIL dimension results, including composite primitives',()=>{
    for(const result of arrows.results){const d=render.arrowDimensions(ARROW_STYLES[result.style-1],result.width),e=result.dimensions;expect(d,`${result.style}/${result.width}`).toEqual({first:ARROW_STYLES[e.first-1],second:ARROW_STYLES[e.second-1],offset:e.offset,secondOffset:e.secondOffset,cut:e.cut})}
  });
  it('matches exact original polygon coordinates, rather than generic SVG markers',()=>{
    for(const result of arrows.results){if(!result.geometry?.length||result.geometry.some((c:any[])=>c.some(s=>s.kind!=='line')))continue;const d=render.arrow(ARROW_STYLES[result.style-1],result.width).d;
      const contours=d.split(/\s+Z\s*/).filter(Boolean).map(s=>s.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number));
      expect(contours.length).toBe(result.geometry.length);result.geometry.forEach((c:any[],i:number)=>{const coords=c.flatMap(s=>[s.a.x,s.a.y]);expect(contours[i].length).toBe(coords.length);coords.forEach((n:number,j:number)=>expect(contours[i][j]).toBeCloseTo(n,10))});
    }
  });
  it('uses the exporter dash arrays directly multiplied by width',()=>{
    const arrays=[[],[17,8],[9,4],[3,1],[9,4,2,4],[9,4,2,4,2,4],[17,4,5,4],[1,1],[0]];LINE_PATTERNS.forEach((linePattern,i)=>expect(render.pattern({linePattern,strokeWidth:2.5}).dashArray).toBe(arrays[i].map(n=>n*2.5).join(',')));
  });
  it('matches all sixteen exact original rectangle stroke/fill cases',()=>{
    const w=createWidget('box');Object.assign(w.style,{radius:0,strokeWidth:10});const cases=evidence.results.filter((r:any)=>r.name.startsWith('rectangle visible sides '));expect(cases.length).toBe(16);
    cases.forEach((r:any,mask:number)=>{const actual=render.rectangle({...w.style,borderVisibility:[0,1,2,3].map(n=>Boolean(mask&(1<<n))) as [boolean,boolean,boolean,boolean]},200,100);expect(actual.strokeD).toBe(r.observed.stroke.d);expect(actual.fillD).toBe(r.observed.fill.d)});
  });
  it('retains distance/length cubic parameters and start-before-end clipping quirks',()=>{
    const w=createWidget('path');Object.assign(w,{width:100,height:100,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'C',x1:0,y1:0,x2:0,y2:0,x:1,y:0}]}});Object.assign(w.style,{strokeWidth:2,lineEnds:{start:'cross-bar',end:'none'}});const a=render.geometry(w).arrows[0];expect(Number(a.transform.match(/translate\(([^ ]+)/)![1])).toBeCloseTo(.0343,10);
    Object.assign(w,{type:'line',width:5});w.style.lineEnds={start:'filled-triangle',end:'cross-bar'};const short=render.geometry(w);expect(short.arrows.map(a=>a.end)).toEqual(['start']);expect(short.strokeD).toBe('');
  });
  it('never joins a move-only closed contour to a preceding open contour',()=>{
    const w=createWidget('path');Object.assign(w,{width:100,height:100,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'M',x:2,y:2},{op:'Z'}]}});expect(render.geometry(w).strokeD).toBe('M 0 0 L 100 0 L 100 100');
  });
  it('retains native cross-segment cuts and the short connector before compound circles',()=>{
    const w=createWidget('path');Object.assign(w,{width:100,height:20,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:0,y:.5},{op:'L',x:.01,y:.5},{op:'L',x:1,y:.5}]}});Object.assign(w.style,{strokeWidth:2,lineEnds:{start:'filled-triangle',end:'none'}});expect(render.geometry(w).strokeD).toBe('M 1 10 L 100 10');
    Object.assign(w,{type:'line',width:100});w.style.lineEnds={start:'cross-bar-hollow-circle',end:'none'};expect(render.geometry(w).strokeD).toBe('M 0 10 L 8.6 10 M 14.000000000000002 10 L 100 10');
  });
  it('recognizes but does not flatten an old rounded vector whose style radius is zero',()=>{
    const w=createWidget('box');Object.assign(w,{width:100,height:100,vectorPath:rounded});w.style.radius=0;expect(render.rectangleRadii(rounded,100,100)).toEqual([20,20,20,20]);expect(render.vectorRectangle(w)).toBeUndefined();w.style.borderVisibility=[true,false,true,false];expect(render.vectorRectangle(w)?.radii).toEqual([0,0,0,0]);w.style.borderVisibility=[true,true,false,false];expect(render.vectorRectangle(w)?.radii).toEqual([0,20,0,20]);
    const changed=structuredClone(rounded);(changed.commands[1] as any).x1=.01;expect(render.rectangleRadii(changed,100,100)).toBeUndefined();
  });
  it('has no undefined mask references for oversized asymmetric patterned borders',()=>{
    const gradients=createGradientRenderer(render),w=createWidget('box');Object.assign(w.style,{borderWidths:[1,2,3,70],linePattern:'short-dash',borderVisibility:[true,false,false,false]});const svg=decodeURIComponent(gradients.border(w.style,50,40));expect(svg).not.toContain('mask="url(#m)"');expect(svg).toContain('clip-path="url(#side0)"');expect(svg).not.toContain('clip-path="url(#side1)"><path');
  });
  it('cancels endpoint transforms before the radial paint basis without mutating shared paint',()=>{
    const gradients:ReturnType<typeof createGradientRenderer>=portable?new Script(`(${createGradientRenderer.toString()})()`).runInNewContext():createGradientRenderer();
    const paint=gradients.svg({type:'radial',center:{x:.3,y:.4},axis1:{x:.7,y:.8},axis2:{x:.1,y:.9},stops:[{offset:0,color:'blue'},{offset:1,color:'red'}]},200,100,'stroke');
    const original=structuredClone(paint),local=gradients.inTransformedSpace(paint,'rotate(-90) translate(-200 -40)','stroke-end');
    expect(local.attrs.gradientTransform).toBe(`rotate(-90) translate(-200 -40) ${paint.attrs.gradientTransform}`);expect(local.attrs.id).toBe('stroke-end');expect(paint).toEqual(original);
    // Apply B, inverse endpoint, then endpoint to an arbitrary local paint point.
    const values=paint.attrs.gradientTransform.match(/matrix\(([^)]+)\)/)![1].split(' ').map(Number),[a,b,c,d,e,f]=values;
    const p={x:a*17+c*29+e,y:b*17+d*29+f},inverse={x:p.y-40,y:-(p.x-200)},actual={x:200-inverse.y,y:40+inverse.x};expect(actual.x).toBeCloseTo(p.x,12);expect(actual.y).toBeCloseTo(p.y,12);
    const w=createWidget('line');w.width=200;w.height=80;w.style.lineEnds={start:'filled-triangle',end:'filled-triangle'};const ends=render.geometry(w).arrows;expect(ends[1].inverseTransform).toBe('rotate(0) translate(-200 -40)');expect(ends[0].inverseTransform).toBe('rotate(180) translate(0 -40)');
  });
  it('keeps row overrides isolated and rolls back line atomics with failed actions',async()=>{
    const doc=lineStyleFixture(),repeater=doc.pages[0].widgets.find(w=>w.id==='line-repeater')!,row=repeater.repeater!.template[0];const create:typeof createOfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout}):createOfflineRuntime;const runtime=create(doc);await runtime.start();const rows=runtime.rows(repeater);const action={id:uid(),name:'Change',event:'click' as const,enabled:true,conditionMode:'all' as const,conditions:[],actions:[{id:uid(),type:'setStyle' as const,targetId:row.id,style:{linePattern:'dot' as const,lineEnds:{start:'diamond' as const,end:'none' as const}}}]};row.interactions.push(action);await runtime.trigger(row.id,'click',rows[0].data,rows[0].context);expect(runtime.widget(row,rows[0].context).style.linePattern).toBe('dot');expect(runtime.widget(row,rows[1].context).style.linePattern).toBe('short-dash');const before=structuredClone(runtime.state());await expect(runtime.execute({...action,actions:[...action.actions,{id:uid(),type:'addRow',targetId:repeater.id,value:'invalid'}]})).rejects.toThrow();expect(runtime.state()).toEqual(before);runtime.dispose();
  });
});
it('keeps old rounded markup, honors zero line width and connects ordinary fill corner semantics',()=>{
  const w=createWidget('box');Object.assign(w,{width:100,height:100,vectorPath:rounded});w.style.radius=0;expect(renderToStaticMarkup(createElement(WidgetContent,{widget:w}))).toContain('C 0 8.799999999999999 8.799999999999999 0 20 0');
  const line=createWidget('line');line.style.strokeWidth=0;expect(renderToStaticMarkup(createElement(WidgetContent,{widget:line}))).toContain('stroke-width="0"');const box=createWidget('box');Object.assign(box.style,{radius:28,borderVisibility:[true,false,true,false]});expect(widgetStyle(box).borderRadius).toBe('0px 0px 0px 0px');
});
it('roundtrips the complete 29-endpoint fixture without mutating geometry',()=>{const doc=lineStyleFixture();expect(parseDocument(serializeDocument(doc))).toEqual(doc)});
