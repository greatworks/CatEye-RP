import {describe,expect,it} from 'vitest';
import {createLayer,createWidget} from '../src/model/document';
import {fitLayerTree,layerAuthoringBounds} from '../src/model/layer-geometry';
import type {Widget} from '../src/model/types';

const leaf=(rotation:number):Widget=>({...createWidget('box',20,10),width:50,height:30,rotation});

describe('author Layer frame and native sizing snapshot agree',()=>{
  // g5s7.get_BoundingRect 100722239 -> pbxZ 100688814 checks |angle - 1| < 1e-5.
  it.each([1,1-0.000009,1+0.000009])('retains the original rectangle at %s degrees',rotation=>{
    expect(layerAuthoringBounds([leaf(rotation)])).toEqual({x:20,y:10,width:50,height:30});
  });
  it('uses rotated bounds outside the near-one-degree branch',()=>{
    const bounds=layerAuthoringBounds([leaf(1.00001)]);
    expect(bounds.x).toBeCloseTo(19.742018983086695,10);
    expect(bounds.y).toBeCloseTo(9.565970094753997,10);
    expect(bounds.width).toBeCloseTo(50.51596203382661,10);
    expect(bounds.height).toBeCloseTo(30.86805981049201,10);
  });
  it('flattens nested Layers without reapplying their rotation or omitting hidden members',()=>{
    const first=leaf(1);first.hidden=true;
    const second={...leaf(90),x:100,y:100,width:40,height:20};
    const nested={...createLayer([first,second]),rotation:37};
    const outer=createLayer([nested]);
    const [fit]=fitLayerTree([outer]);
    expect({x:fit.x,y:fit.y,width:fit.width,height:fit.height}).toEqual({x:20,y:10,width:110,height:120});
    expect(fit.layer!.widgets[0].rotation).toBe(37);
    expect(first).toMatchObject({x:20,y:10,width:50,height:30,rotation:1,hidden:true});
  });
});
