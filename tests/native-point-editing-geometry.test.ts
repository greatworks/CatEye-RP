import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createWidget} from '../src/model/document';
import {resolveVectorEditPath,vectorEditPathUnsupportedReason} from '../src/model/vector-authoring';
import {parseVectorPath} from '../src/model/vector';
import type {VectorCommand,VectorPath,Widget} from '../src/model/types';

const saved:VectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'L',x:0,y:0},{op:'Z'}]};
const make=()=>{const w=createWidget('box');Object.assign(w,{width:240,height:60,vectorPath:structuredClone(saved)});Object.assign(w.style,{radius:18,cornerVisibility:[true,true,true,true]});return w;};
type RawPoint=[number,number,number|'NaN',number|'NaN',number|'NaN',number|'NaN',boolean];
function fromRetainedPoints(points:RawPoint[]):VectorPath {
  const commands:VectorCommand[]=[{op:'M',x:points[0][0],y:points[0][1]}];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];
    if(a[4]==='NaN'&&b[2]==='NaN')commands.push({op:'L',x:b[0],y:b[1]});
    else commands.push({op:'C',x1:a[4]==='NaN'?a[0]:a[4],y1:a[5]==='NaN'?a[1]:a[5],x2:b[2]==='NaN'?b[0]:b[2],y2:b[3]==='NaN'?b[1]:b[3],x:b[0],y:b[1]});
  }commands.push({op:'Z'});return{fillRule:'nonzero',commands};
}
function close(actual:VectorPath,expected:VectorPath,label:string){
  expect(actual.commands.length,label).toBe(expected.commands.length);
  for(let i=0;i<expected.commands.length;i++){expect(actual.commands[i].op,label).toBe(expected.commands[i].op);
    for(const [key,value]of Object.entries(expected.commands[i]))if(typeof value==='number')expect((actual.commands[i] as any)[key],label).toBeCloseTo(value,12);}
}

describe('native point-editing source geometry',()=>{
  it('resolves the effective un-inset normal outline without mutating stored geometry or style',()=>{
    const w=make(),before=structuredClone(w),path=resolveVectorEditPath(w)!;
    expect(path).not.toBe(w.vectorPath);expect(path.commands[0]).toEqual({op:'M',x:0,y:.3});
    expect(path.commands[1]).toEqual({op:'C',x1:0,y1:.132,x2:.033,y2:0,x:.075,y:0});
    expect(w).toEqual(before);expect(parseVectorPath(path)).toEqual(path);
  });
  it('matches all 384 retained-CIL cases including mask0, merged pills, square and tiny-radius coalescing',()=>{
    const evidence=JSON.parse(readFileSync('research/native-point-editing-evidence-geometry.json','utf8'));
    expect(evidence.cases).toHaveLength(384);
    for(const entry of evidence.cases){const w=make();Object.assign(w,entry.input);Object.assign(w.style,{radius:entry.input.radius,strokeWidth:2*entry.input.offset,cornerVisibility:[1,2,4,8].map(bit=>Boolean(entry.input.cornerMask&bit))});
      close(resolveVectorEditPath(w)!,fromRetainedPoints(entry.points),entry.name);}
  });
  it('uses the effective dimensions and normal radius after a stored path was created at another size',()=>{
    const w=make();w.vectorPath=resolveVectorEditPath(w);w.width=80;w.height=180;w.style.radius=40;
    const result=resolveVectorEditPath(w)!;expect(result.commands[0]).toEqual({op:'M',x:0,y:40/180});expect(result.commands.filter(c=>c.op==='C')).toHaveLength(4);
    expect(result.commands.filter(c=>c.op==='L')).toHaveLength(2);
  });
  it('does not make editing geometry depend on stroke width, pattern, gradient or shadow paint',()=>{
    const w=make(),expected=resolveVectorEditPath(w);w.style.strokeWidth=16;w.style.linePattern='none';
    w.style.outerShadow={on:true,offsetX:15,offsetY:15,blurRadius:5,color:'#ff0000'};
    w.style.strokeGradient={type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'blue'},{offset:1,color:'red'}]};
    expect(resolveVectorEditPath(w)).toEqual(expected);
  });
  it('keeps custom, legacy, partial-border, independent-radius and malformed-family paths exact',()=>{
    const cases:Widget[]=[];let w=make();w.type='path';cases.push(w);w=make();delete w.style.cornerVisibility;cases.push(w);
    w=make();w.style.borderVisibility=[true,false,true,true];cases.push(w);w=make();w.style.cornerRadii=[1,2,3,4];cases.push(w);
    w=make();w.vectorPath!.commands[1]={op:'L',x:.9,y:0};cases.push(w);w=make();w.vectorPath!.commands.pop();cases.push(w);
    w=make();w.vectorPath!.commands.push({op:'M',x:0,y:0},{op:'Z'});cases.push(w);
    w=make();w.vectorPath=resolveVectorEditPath(w);(w.vectorPath!.commands[1] as Extract<VectorCommand,{op:'C'}>).x1=.01;cases.push(w);
    for(const entry of cases)expect(resolveVectorEditPath(entry)).toBe(entry.vectorPath);
    w=make();delete w.vectorPath;expect(resolveVectorEditPath(w)).toBeUndefined();
  });
  it('blocks parameterized displays whose edit contour is not yet proved, including legacy hidden-side reconstruction',()=>{
    const w=make();expect(vectorEditPathUnsupportedReason(w)).toBeUndefined();
    w.style.borderVisibility=[true,false,true,true];expect(vectorEditPathUnsupportedReason(w)).toBe('partial-border');
    delete w.style.cornerVisibility;expect(vectorEditPathUnsupportedReason(w)).toBe('partial-border');
    w.style.borderVisibility=[true,true,true,true];expect(vectorEditPathUnsupportedReason(w)).toBeUndefined();
    w.style.cornerRadii=[1,2,3,4];expect(vectorEditPathUnsupportedReason(w)).toBeUndefined();
    w.style.cornerVisibility=[true,true,true,true];expect(vectorEditPathUnsupportedReason(w)).toBe('independent-corners');
    w.type='path';expect(vectorEditPathUnsupportedReason(w)).toBeUndefined();
    w.type='box';w.vectorPath!.commands[1]={op:'L',x:.9,y:0};expect(vectorEditPathUnsupportedReason(w)).toBeUndefined();
  });
});
