import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createLineStyleRenderer} from '../src/model/line-style';
import {createGradientRenderer} from '../src/model/gradient';
import {createWidget} from '../src/model/document';
import {widgetStyle,WidgetContent} from '../src/components/WidgetView';
import type {VectorPath,WidgetStyle} from '../src/model/types';

const evidence=JSON.parse(readFileSync('research/native-corners-runtime-probes.json','utf8'));
const mask=(n:number)=>[1,2,4,8].map(bit=>Boolean(n&bit)) as [boolean,boolean,boolean,boolean];
const rounded:VectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:.2},{op:'C',x1:0,y1:.088,x2:.088,y2:0,x:.2,y:0},{op:'L',x:.8,y:0},{op:'C',x1:.912,y1:0,x2:1,y2:.088,x:1,y:.2},{op:'L',x:1,y:.8},{op:'C',x1:1,y1:.912,x2:.912,y2:1,x:.8,y:1},{op:'L',x:.2,y:1},{op:'C',x1:.088,y1:1,x2:0,y2:.912,x:0,y:.8},{op:'L',x:0,y:.2},{op:'Z'}]};

// Compare closed geometry independently of which corner starts the contour.
function contour(source:string){
  const tokens=source.match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)??[],segments:number[][]=[];
  let cursor=[0,0],start=cursor;
  for(let i=0;i<tokens.length;){const op=tokens[i++];if(op==='Z'){if(cursor.some((v,j)=>v!==start[j]))segments.push([...cursor,...start]);continue;}
    const count=op==='C'?6:2,values=tokens.slice(i,i+count).map(Number);i+=count;
    if(op==='M'){cursor=values;start=cursor;}else{const end=values.slice(-2);if(op==='C'||cursor.some((v,j)=>v!==end[j]))segments.push([...cursor,...values]);cursor=end;}}
  return segments;
}
function sameClosed(actual:string,expected:string){
  const a=contour(actual),e=contour(expected);expect(a).toHaveLength(e.length);
  expect(a.some((_,shift)=>e.every((segment,i)=>{const next=a[(i+shift)%a.length];return segment.length===next.length&&segment.every((n,j)=>Math.abs(n-next[j])<1e-7);}))).toBe(true);
}

for(const portable of [false,true])describe(`${portable?'serialized':'module'} native corners`,()=>{
  const lines:ReturnType<typeof createLineStyleRenderer>=portable?new Script(`(${createLineStyleRenderer.toString()})()`).runInNewContext():createLineStyleRenderer();
  it('matches all 256 exact-source corner/border masks, including fill between two hidden borders',()=>{
    const cases=evidence.results.filter((r:any)=>r.name.startsWith('mask-'));expect(cases).toHaveLength(256);
    for(const result of cases){const input=result.input,style={...createWidget('box').style,radius:input.radius,strokeWidth:input.borderWidth,cornerVisibility:mask(input.cornerMask),borderVisibility:mask(input.borderMask)};
      const actual=lines.rectangle(style,input.width,input.height);expect(actual.strokeD,result.name).toBe(result.observed.strokeD);sameClosed(actual.fillD,result.observed.fillD);}
  });
  it('matches the independently retained oversized and fractional dynamic SVG cases',()=>{
    const cases=evidence.results.filter((r:any)=>r.input&&r.observed?.fillD!==null&&!r.name.startsWith('mask-')&&r.input.radius>=0&&r.input.friendlyType===undefined&&r.input.divExists===undefined);
    expect(cases.length).toBeGreaterThanOrEqual(8);
    for(const result of cases){const input=result.input,style={...createWidget('box').style,radius:input.radius,strokeWidth:input.borderWidth,cornerVisibility:mask(input.cornerMask),borderVisibility:mask(input.borderMask)};
      const actual=lines.rectangle(style,input.width,input.height);expect(actual.strokeD,result.name).toBe(result.observed.strokeD);sameClosed(actual.fillD,result.observed.fillD);}
  });
  it('retains legacy independent radii while gating each corner without mutating stored values',()=>{
    const style={...createWidget('box').style,radius:50,cornerRadii:[11,12,13,14] as [number,number,number,number],cornerVisibility:mask(5)};const before=structuredClone(style);
    expect(lines.rectangle(style,200,100).radii).toEqual([11,0,13,0]);expect(style).toEqual(before);
  });
  it('rebuilds an explicitly parameterized rectangle after an aspect ratio change, preserving arbitrary vectors',()=>{
    const w=createWidget('box');Object.assign(w,{width:200,height:100,vectorPath:structuredClone(rounded)});Object.assign(w.style,{radius:30,cornerVisibility:mask(1)});
    expect(lines.supportsCorners(w)).toBe(true);expect(lines.vectorRectangle(w)?.radii).toEqual([30,0,0,0]);
    const before=structuredClone(w.vectorPath);w.width=40;w.height=90;expect(lines.vectorRectangle(w)?.radii).toEqual([30,0,0,0]);expect(lines.supportsSides(w)).toBe(true);expect(w.vectorPath).toEqual(before);
    (w.vectorPath!.commands[1] as any).x1=.02;expect(lines.supportsCorners(w)).toBe(false);expect(lines.vectorRectangle(w)).toBeUndefined();
  });
  it('leaves old path snapshots unconverted until native corner parameters are present',()=>{
    const w=createWidget('box');Object.assign(w,{width:100,height:100,vectorPath:rounded});w.style.radius=0;
    expect(lines.vectorRectangle(w)).toBeUndefined();expect(lines.supportsCorners(w)).toBe(false);
  });
  it('uses the same masked outline for gradient borders',()=>{
    const gradients=createGradientRenderer(lines),style={...createWidget('box').style,radius:20,cornerVisibility:mask(1)};
    const svg=decodeURIComponent(gradients.border(style,200,100));expect(svg).toContain('M 20 0 L 200 0 L 200 0 L 200 100 L 200 100 L 0 100 L 0 100 L 0 20 A 20 20 0 0 1 20 0 Z');
  });
});

it('connects HTML corner disable classes independently of SVG radius clamping',()=>{
  const w=createWidget('box');Object.assign(w,{width:200,height:100});Object.assign(w.style,{radius:180,cornerVisibility:mask(1)});
  expect(widgetStyle(w).borderRadius).toBe('180px 0px 0px 0px');
  w.style.borderVisibility=mask(3);expect(widgetStyle(w).borderRadius).toBe('0px 0px 0px 0px');
  w.style.borderVisibility=mask(6);expect(widgetStyle(w).borderRadius).toBe('180px 0px 0px 0px');
});
it('renders new native vector corners but preserves old snapshot markup',()=>{
  const w=createWidget('box');Object.assign(w,{width:100,height:100,vectorPath:rounded});w.style.radius=0;
  expect(renderToStaticMarkup(createElement(WidgetContent,{widget:w}))).toContain('C 0 8.799999999999999 8.799999999999999 0 20 0');
  Object.assign(w.style,{radius:12,cornerVisibility:mask(1)});
  const markup=renderToStaticMarkup(createElement(WidgetContent,{widget:w}));expect(markup).toContain('C 0 5.28 5.28 0 12 0');expect(markup).not.toContain('C 91.2');
});

