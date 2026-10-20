import {describe,expect,it} from 'vitest';
import {commitVectorGeometry} from '../src/model/vector-commit';
import {applyAdaptivePointEdit,resolveAdaptiveWidgets} from '../src/model/adaptive';
import {parseDocument,serializeDocument} from '../src/model/document';
import {deleteVectorAnchor,moveVectorAnchor,vectorAnchors} from '../src/model/vector-editing';
import {parseVectorPath} from '../src/model/vector';
import type {VectorCommand,VectorPath} from '../src/model/types';
import {nativePointContoursFixture,expectedDetachedContourCommit} from './fixtures/native-point-contours';
import rotationFixtures from '../research/native-point-contours-rotation-fixtures.json';

const path=(commands:VectorCommand[]):VectorPath=>({fillRule:'nonzero',commands});
const M=(x:number,y:number):VectorCommand=>({op:'M',x,y});
const L=(x:number,y:number):VectorCommand=>({op:'L',x,y});
const C=(x1:number,y1:number,x2:number,y2:number,x:number,y:number):VectorCommand=>({op:'C',x1,y1,x2,y2,x,y});
const frame={x:0,y:0,width:1,height:1,rotation:0,style:{strokeWidth:1}};
function close(actual:unknown,expected:unknown){
  if(typeof expected==='number'){expect(actual).toBeTypeOf('number');expect(Math.abs((actual as number)-expected)).toBeLessThanOrEqual(1e-9);return;}
  if(Array.isArray(expected)){expect(Array.isArray(actual)).toBe(true);expect((actual as unknown[]).length).toBe(expected.length);expected.forEach((v,i)=>close((actual as unknown[])[i],v));return;}
  if(expected&&typeof expected==='object'){expect(Object.keys(actual as object).sort()).toEqual(Object.keys(expected).sort());for(const [k,v]of Object.entries(expected))close((actual as Record<string,unknown>)[k],v);return;}
  expect(actual).toEqual(expected);
}
const points=(p:VectorPath)=>p.commands.flatMap(c=>c.op==='Z'?[]:c.op==='C'?[{x:c.x1,y:c.y1},{x:c.x2,y:c.y2},{x:c.x,y:c.y}]:[{x:c.x,y:c.y}]);

describe('native contour measurement without rewriting stored topology',()=>{
  it('drops the remote tiny contour only from bounds and preserves all seven commands',()=>{
    const doc=nativePointContoursFixture(),widget=doc.pages[0].widgets[0],before=structuredClone(doc);
    const requested=moveVectorAnchor(widget.vectorPath!,0,{x:-.25,y:0}),result=commitVectorGeometry(widget,requested);
    close(result,expectedDetachedContourCommit());expect(doc).toEqual(before);expect(result.vectorPath.commands.map(c=>c.op)).toEqual(requested.commands.map(c=>c.op));
  });
  for(const closed of [false,true])it(`commits a single anchor with global fallback; closed=${closed}`,()=>{
    const p=path([M(12.25,30.75),...(closed?[{op:'Z'} as const]:[])]),before=structuredClone(p);
    close(commitVectorGeometry({...frame,style:{strokeWidth:4}},p),{bounds:{x:10,y:28,width:4,height:4},vectorPath:path([M(.5625,.6875),...(closed?[{op:'Z'} as const]:[])])});expect(p).toEqual(before);
  });
  it('uses the first raw anchor only if every temporary contour was pruned',()=>{
    const result=commitVectorGeometry({...frame,style:{strokeWidth:4}},path([M(12.25,30.75),M(100,200)]));
    close(result,{bounds:{x:10,y:28,width:4,height:4},vectorPath:path([M(.5625,.6875),M(22.5,43)])});
  });
  it('skips outward rounding for fractional first-anchor fallback before the one-pixel minimum',()=>{
    // iN4x IL0056..0077 jumps over Y5uk for this exact first-point branch.
    close(commitVectorGeometry(frame,path([M(12.25,30.75)])),{bounds:{x:11,y:30,width:1,height:1},vectorPath:path([M(1.25,.75)])});
  });
  it('does not include isolated anchors in bounds when another contour survives',()=>{
    close(commitVectorGeometry(frame,path([M(-50,-60),M(10,20),L(30,40)])),{bounds:{x:10,y:20,width:20,height:20},vectorPath:path([M(-3,-4),M(0,0),L(1,1)])});
  });
  for(const [dx,dy,removed]of [[.0004,.0004,true],[.0005,.0005,false],[.0006,.0006,false],[.000999,0,true],[.001,0,false],[.001001,0,false]] as const)it(`uses strict world Manhattan threshold ${dx},${dy}`,()=>{
    const p=path([M(10,20),L(30,40),M(0,0),L(dx,dy)]),result=commitVectorGeometry(frame,p);
    expect(result.bounds).toEqual(removed?{x:10,y:20,width:20,height:20}:{x:0,y:0,width:30,height:40});expect(result.vectorPath.commands.length).toBe(4);
  });
  for(const amount of [.000999,.001,.001001,10])it(`requires a cubic handle to be near too: ${amount}`,()=>{
    const p=path([M(10,20),L(30,40),M(0,0),C(amount,0,0,0,0,0)]),result=commitVectorGeometry(frame,p);
    expect(result.bounds).toEqual(amount<.001?{x:10,y:20,width:20,height:20}:{x:0,y:0,width:30,height:40});expect(result.vectorPath.commands[3].op).toBe('C');
  });
  for(const closed of [false,true])it(`distinguishes surviving inactive closure from no curves; closed=${closed}`,()=>{
    const p=path([M(50,60),L(50.0004,60),L(50.0008,60),L(50.0012,60),...(closed?[{op:'Z'}as const]:[])]),result=commitVectorGeometry(frame,p);
    expect(result.bounds).toEqual(closed?{x:50,y:59,width:1,height:1}:{x:-1,y:-1,width:1,height:1});expect(result.vectorPath.commands.map(c=>c.op)).toEqual(p.commands.map(c=>c.op));
  });
  it('removes a lone remaining closure of length >=1 then uses the global first point',()=>{
    const p=path([M(50,60),...Array.from({length:2001},(_,i)=>L(50+(i+1)*.0005,60))]),result=commitVectorGeometry(frame,p);
    expect(result.bounds).toEqual({x:49,y:59,width:1,height:1});expect(result.vectorPath.commands.length).toBe(p.commands.length);
  });
  it('rotated all-pruned contours use zero union transformed around the old center',()=>{
    const owner={x:100,y:80,width:100,height:60,rotation:90,style:{strokeWidth:4}};
    // This normalized anchor maps to the source-replay world point (125,96).
    close(commitVectorGeometry(owner,path([M(.36,55/60)])),{bounds:{x:258,y:-42,width:4,height:4},vectorPath:path([M(34.5,34.25)])});
  });
  it('retains the empty-array schema boundary rather than inventing an empty widget',()=>{
    expect(()=>parseVectorPath(path([]))).toThrow('1..4096');expect(()=>commitVectorGeometry(frame,path([]))).toThrow('1..4096');
  });
  it('keeps M-only current-view geometry, shared path, fit flags and inactive declarations atomic',()=>{
    const doc=nativePointContoursFixture(),page=doc.pages[0],widget=page.widgets[0];widget.vectorPath=path([M(0,0),L(1,1)]);
    page.adaptiveViews=[{id:'contour-phone',name:'Phone',width:390,overrides:{[widget.id]:{x:400,y:300,width:400,height:200,style:{fill:'#abcdef'}}}},{id:'contour-other',name:'Other',width:768,overrides:{[widget.id]:{x:700,width:300}}},{id:'contour-inactive',name:'Inactive',width:800,overrides:{[widget.id]:{x:999,width:777}}}];
    const before=structuredClone(page),requested=deleteVectorAnchor(widget.vectorPath,1),changed=applyAdaptivePointEdit(page,'contour-phone',widget.id,requested),effective=resolveAdaptiveWidgets(changed,'contour-phone')[0];
    expect([effective.x,effective.y,effective.width,effective.height]).toEqual([399,299,1,1]);expect(effective.vectorPath).toEqual(path([M(1,1)]));expect(effective.shapeText).toEqual(widget.shapeText);expect(changed.widgets[0].x).toBe(widget.x);expect(changed.adaptiveViews.slice(1)).toEqual(page.adaptiveViews.slice(1));expect(page).toEqual(before);
    expect(parseDocument(serializeDocument({...doc,pages:[changed]})).pages[0]).toEqual(changed);expect(vectorAnchors(effective.vectorPath!).length).toBe(1);
    expect(()=>applyAdaptivePointEdit(page,'contour-phone',widget.id,path([M(10000,10000)]))).toThrow();expect(page).toEqual(before);
  });
});

describe('source-derived sizing-frame and rotation fixtures',()=>{
  for(const sample of rotationFixtures.fixtures)it(sample.name,()=>{
    const p=sample.name.startsWith('polygon')?path([M(-.25,0),L(1,0),L(1,1),L(0,1),{op:'Z'}]):path([M(0,0),C(0,-1,1,0,1,1)]);
    const owner={...sample.input.owner,rotation:sample.input.effectiveRotation,style:{strokeWidth:sample.input.strokeWidth}},before=structuredClone(owner),result=commitVectorGeometry(owner,p);
    close(result.bounds,sample.expected.owner);close(points(result.vectorPath),sample.expected.normalizedPoints);expect(owner).toEqual(before);expect(result.vectorPath.commands.map(c=>c.op)).toEqual(p.commands.map(c=>c.op));
  });
});
