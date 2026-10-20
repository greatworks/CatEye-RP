import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {
  applyAuthorResizePins, getAuthorResizeBounds, hasAuthorResizePinEdges,
  hasAuthorResizePins, solveAuthorResize,
  type AuthorResizePinInfo, type AuthorResizeRect, type AuthorResizeOptions,
} from '../src/model/author-resize-solver';

const oracle=JSON.parse(readFileSync('research/layer-resize-numeric-probes.json','utf8'));
const numeric=(value:number|string):number=>typeof value==='number'?value:value==='NaN'?NaN:value==='Infinity'?Infinity:-Infinity;
function close(actual:AuthorResizeRect,expected:Record<string,number|string>,name:string) {
  for(const key of ['x','y','width','height'] as const) {
    const value=numeric(expected[key]);
    if(Number.isFinite(value)) expect(Math.abs(actual[key]-value),`${name}/${key}`).toBeLessThanOrEqual(1e-8*Math.max(1,Math.abs(value)));
    else expect(actual[key],`${name}/${key}`).toBe(value);
  }
}
function pin(value:any):AuthorResizePinInfo {
  return {horizontal:value.h,vertical:value.v,fixedWidth:value.fixedWidth,fixedHeight:value.fixedHeight,
    originalParentRect:value.oldParent,newParentRect:value.newParent};
}
function options(input:any):AuthorResizeOptions {
  return {originalRect:input.original,originalBounds:input.bbox,delta:input.delta,parentRect:input.parent,
    handle:input.anchor,freedom:input.freedom,preserveAspect:input.preserveAspect,orientation:input.orientation,
    pin:input.pin?pin(input.pin):undefined,rotation:input.angle};
}
describe('author resize numeric solver',()=>{
  it('has a source-bound oracle with no failed research comparisons',()=>{
    expect(oracle.summary).toMatchObject({total:5004,passed:5004,failed:0});
    expect(oracle.original.sha256).toBe('dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
  });
  it('matches all 3000 pin combinations including fixed, both, translated, zero and crossed parents',()=>{
    const cases=oracle.results.filter((r:any)=>r.group==='pin');expect(cases).toHaveLength(3000);
    for(const entry of cases)close(applyAuthorResizePins(entry.input.original,entry.input.projected,pin(entry.input.pin),entry.input.anchor),entry.actual,entry.name);
  });
  for(const group of ['evaluator','evaluator-pin','evaluator-edge'])it(`matches retained full evaluator ${group} fixtures`,()=>{
    const cases=oracle.results.filter((r:any)=>r.group===group);expect(cases.length).toBeGreaterThan(100);
    for(const entry of cases) {
      const input=options(entry.input),before=structuredClone(input),actual=solveAuthorResize(input);
      close(actual.rect,entry.actual,entry.name);
      expect(actual.finite,entry.name).toBe(Object.values(entry.actual).every(v=>typeof v==='number'&&Number.isFinite(v)));
      expect(input,entry.name).toEqual(before);
    }
  });
  it('matches degree/cardinal/tiny-angle frame branches, including the retained near-one bounding shortcut',()=>{
    const cases=oracle.results.filter((r:any)=>r.group==='sizing-bounds');expect(cases).toHaveLength(24);
    for(const entry of cases)close(getAuthorResizeBounds(entry.input.original,entry.input.angle),entry.actual,entry.name);
  });
  it('separates any fixed-or-pinned constraint from an actual pin edge',()=>{
    const p:AuthorResizePinInfo={horizontal:0,vertical:0,fixedWidth:false,fixedHeight:false,
      originalParentRect:{x:0,y:0,width:200,height:100},newParentRect:{x:0,y:0,width:300,height:160}};
    expect(hasAuthorResizePins(undefined)).toBe(false);expect(hasAuthorResizePinEdges(undefined)).toBe(false);
    expect(hasAuthorResizePins(p)).toBe(false);
    expect(hasAuthorResizePins({...p,fixedWidth:true})).toBe(true);
    expect(hasAuthorResizePinEdges({...p,fixedWidth:true})).toBe(false);
    expect(hasAuthorResizePins({...p,vertical:512})).toBe(true);
    expect(hasAuthorResizePinEdges({...p,horizontal:256})).toBe(true);
  });
  it('exposes a nonfinite result rather than making zero-parent geometry look valid',()=>{
    const result=solveAuthorResize({originalRect:{x:0,y:0,width:0,height:30},originalBounds:{x:0,y:0,width:0,height:30},
      parentRect:{x:0,y:0,width:0,height:100},delta:{x:100,y:60},handle:12});
    expect(result.finite).toBe(false);expect(result.rect.x).toBeNaN();expect(result.rect.width).toBeNaN();
    expect(result.rect.height).toBe(48);
  });
});
