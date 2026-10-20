import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { importAdaptiveStyles } from '../src/model/import-rp-adaptive';
import { createLineStyleRenderer } from '../src/model/line-style';
import type { Widget, WidgetStyle } from '../src/model/types';

const guid=(n:number)=>n.toString(16).padStart(32,'0'),map=(entries:[string,unknown][])=>({$map:entries}),property=(key:number,value:unknown,flags=0xc0000000)=>({rawDoaName:key|flags,value});
function carrier(patch:unknown,properties:unknown[]){return{schema:1,status:'decoded-adaptive-styles',sourceId:guid(1),entries:[{viewId:guid(2),styleId:guid(3),status:'supported-local-adaptive-style',patch,source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],properties,stateStyleSources:[] as any[]}}]};}
const surface=(style:Partial<WidgetStyle>,widget:Widget)=>{if(style.borderVisibility&&widget.type==='box'&&(!widget.vectorPath||!createLineStyleRenderer().rectangleRadii(widget.vectorPath,widget.width,widget.height)))throw Error('Missing native rectangular contour');};
const read=(value:unknown,widget=createWidget('box'))=>[...importAdaptiveStyles(value,2,guid(1),widget,surface).values()][0];

describe('native adaptive style second boundary',()=>{
  it('accepts P20 only with already validated all-normal rich paragraph evidence',()=>{
    const w=createWidget('box'),value=carrier({style:{lineHeight:'normal'}},[property(20,0)]);
    expect(()=>read(value,w)).toThrow(/LineSpacing/);
    w.richText={paragraphs:[{runs:[{text:'First'}],lineHeightPx:'normal'},{runs:[{text:''}],lineHeightPx:'normal'}]};
    expect(read(value,w)).toEqual({style:{lineHeight:'normal'}});
    w.richText.paragraphs[1].lineHeightPx=28;expect(()=>read(value,w)).toThrow(/LineSpacing/);
  });
  it('requires a verified rectangle for shape side visibility, while forms retain their supported surface',()=>{
    const value=carrier({style:{borderVisibility:[true,false,true,false]}},[property(80,10)]),w=createWidget('box');
    expect(()=>read(value,w)).toThrow(/contour/);
    w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};
    expect(read(value,w)).toEqual(value.entries[0].patch);expect(read(value,createWidget('input'))).toEqual(value.entries[0].patch);
    expect(()=>read(value,createWidget('ellipse'))).toThrow(/四边/);
  });
  it.each(['table','menu','tree'] as const)('permits only hidden, placed or empty on shared %s roots',type=>{
    const w=createWidget(type);expect(read(carrier({hidden:false},[property(110,true)]),w)).toEqual({hidden:false});expect(read(carrier({},[]),w)).toEqual({});
    expect(read(carrier({placed:false},[property(111,2)]),w)).toEqual({placed:false});
    expect(()=>read(carrier({width:80,height:30},[property(105,map([['Width',80],['Height',30]]))]),w)).toThrow(/共享/);
    expect(()=>read(carrier({stateStyles:{}},[property(21,map([]))]),w)).toThrow(/共享/);
  });
  it('rejects any nonempty table-cell override rather than storing inert properties',()=>{
    const cell=createWidget('table').table!.cells[0];expect(read(carrier({},[]),cell)).toEqual({});expect(()=>read(carrier({hidden:true},[property(110,false)]),cell)).toThrow(/共享/);
  });
  it('keeps inactive unsupported fields inert but rejects eligible unknown fields and duplicate masked identities',()=>{
    // P111 is now known to carry BoolOverride, not Boolean. Keep the original
    // inactive-property assertion with a valid enum; malformed carriers reject.
    expect(read(carrier({},[property(111,2,0x40000000),property(5000,'source-only',0)]))).toEqual({});
    expect(()=>read(carrier({},[property(111,true)]))).toThrow(/111/);
    expect(()=>read(carrier({},[property(7,null,0),property(7,null,0x80000000)]))).toThrow(/重复/);
  });
  it('distinguishes empty whole-map, explicit empty entry and forbidden injected state metadata',()=>{
    const value=carrier({stateStyles:{focused:{}}},[property(21,map([['Focused',{$reference:guid(4),referenceTag:3}]]))]);value.entries[0].source.stateStyleSources=[{state:'focused',sourceId:guid(4),properties:[]}];
    expect(read(value)).toEqual({stateStyles:{focused:{}}});
    value.entries[0].source.stateStyleSources[0].state='Focused';expect(()=>read(value)).toThrow(/顺序/);
    value.entries[0].source.stateStyleSources[0].state='focused';value.entries[0].source.stateStyleSources[0].properties=[property(101,map([['X',1],['Y',2]]))];expect(()=>read(value)).toThrow(/101/);
  });
  it('revalidates all numeric/color bounds and complete atomic geometry',()=>{
    for(const value of [
      carrier({width:0,height:2},[property(105,map([['Width',0],['Height',2]]))]),
      carrier({x:1},[property(101,map([['X',1]]))]),
      carrier({style:{fill:'#ffffffff'}},[property(7,map([['fill-type','solid'],['fill-color',4294967296]]))]),
    ])expect(()=>read(value)).toThrow();
  });
  it('does not accept unsupported adaptive rotation or transforms, even zero',()=>{
    for(const key of [50,1401,1402])expect(()=>read(carrier({},[property(key,0)]))).toThrow(new RegExp(String(key)));
  });
  it('does not silently discard newly supported P71/P81 from an empty projection',()=>{
    // Zero is valid for each native corner parameter, but a worker report must
    // still contain its exact projection. The complete-base guard is tested
    // separately in import-rp-native-corners.test.ts.
    for(const key of [71,81])expect(()=>read(carrier({},[property(key,0)]))).toThrow(/投影与原生属性记录不一致/);
  });
});
