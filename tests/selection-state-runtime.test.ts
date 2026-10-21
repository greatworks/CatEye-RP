import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { createRuntime, executeInteraction } from '../src/runtime/engine';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Document, EventType, Interaction } from '../src/model/types';

const sessions: OfflineRuntime[]=[];
afterEach(()=>{for(const session of sessions.splice(0)) session.dispose();vi.useRealTimers();});
const event=(type:EventType,...actions:Omit<Action,'id'>[]):Interaction=>({id:uid(),name:type,event:type,enabled:true,conditions:[],conditionMode:'all',actions:actions.map(a=>({...a,id:uid()}))});
function fixture(type:'checkbox'|'radio'='radio') {
  const doc=createDocument(), w=createWidget(type);
  Object.assign(w.style,{selectionButtonSize:14,strokeWidth:1,stroke:'#102030',fill:'#ffffff',radius:0});
  w.checked=false; doc.pages[0].widgets=[w];doc.caseSelection='never';
  return {doc,w};
}
function session(doc:Document,portable:boolean) {
  const runtime:OfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout})(doc,undefined,evaluateExpression):createOfflineRuntime(doc,undefined,evaluateExpression);
  sessions.push(runtime);return runtime;
}

// Expected paint is from the retained _applySvg/state dispatch probes, not the
// new renderer: radio starts fill-only; generic paint adds a stroke, zero width
// retains the last nonzero SVG attribute, while checkbox CSS fixes tick width.
for(const portable of [false,true]) describe(`${portable?'serialized':'module'} selection SVG event ledger`,()=>{
  it('keeps native initial tick arithmetic separate from the original runtime CSS arithmetic',async()=>{
    const {doc,w}=fixture('checkbox');w.style.selectionButtonSize=18;
    const r=session(doc,portable);
    expect(r.selectionIndicatorPaint(w.id)!.markWidth).toBe(18/14*3);
    await r.select(w.id,true);
    // Original style.js1376 explicitly multiplies before dividing.
    expect(r.selectionIndicatorPaint(w.id)!.markWidth).toBe(3*18/14);
  });
  it('keeps an asset on explicit fallback after leaving the verified paint subset',async()=>{
    const {doc,w}=fixture(),r=session(doc,portable);
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:3}}));
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:6,linePattern:'short-dash'}}));
    expect(r.selectionIndicatorPaint(w.id)).toBeUndefined();
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:0,linePattern:'solid'}}));
    // No guessed reconstruction of attributes changed in the unsupported branch.
    expect(r.selectionIndicatorPaint(w.id)).toBeUndefined();
    const fresh=session(doc,portable);expect(fresh.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:1,markStroke:'none'});
  });
  for(const type of ['checkbox','radio'] as const) {
    it(`${type}: retains same-turn nonzero width through zero, none, and restore`,async()=>{
      const {doc,w}=fixture(type), r=session(parseDocument(serializeDocument(doc)),portable);
      const initial=r.selectionIndicatorPaint(w.id)!;
      expect(initial).toMatchObject({assetSize:14,assetStrokeWidth:1,outlineWidth:1,markStroke:type==='radio'?'none':'#102030'});
      await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:3,stroke:'rgba(10,20,30,0.25)'}},{type:'setStyle',targetId:w.id,style:{strokeWidth:0}}));
      expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3,markWidth:3,markStroke:'rgba(10,20,30,0.25)'});
      await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{linePattern:'none'}}));
      expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:0,markWidth:type==='checkbox'?3:0});
      await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{linePattern:'solid'}}));
      expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3,markWidth:3});
      expect(w.style.strokeWidth).toBe(1);
    });
  }
  it('initial selected enabled radio takes the binding paint but ordinary unchecked radio stays fill-only',async()=>{
    const {doc,w}=fixture();w.checked=true;w.selected=true;
    const plain=createWidget('radio');plain.style={...w.style};doc.pages[0].widgets.push(plain);
    const r=session(doc,portable);await r.start();
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'#102030',markWidth:1});
    expect(r.selectionIndicatorPaint(plain.id)).toMatchObject({markStroke:'none'});
  });
  it.each([0,3])('initial radio width %s keeps its separate default mark width on a first zero apply',async(width)=>{
    const {doc,w}=fixture();w.style.strokeWidth=width;w.checked=true;
    w.selectedStyle={strokeWidth:0};
    const r=session(doc,portable);await r.start();
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:width,markWidth:1,markStroke:'#102030'});
  });
  it('error removal paints normal after the error callback',async()=>{
    const {doc,w}=fixture();w.errorStyle={stroke:'#ff0000',strokeWidth:4};
    const r=session(doc,portable);await r.setError(w.id,true);
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({stroke:'#ff0000'});
    await r.setError(w.id,false);
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({stroke:'#102030',outlineWidth:1});
  });
  it('applied SVG action style overrides selection and survives later state paints',async()=>{
    const {doc,w}=fixture();w.selectedStyle={strokeWidth:3,stroke:'#ff0000'};
    const r=session(doc,portable);await r.select(w.id,true);
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:6,stroke:'#00ff00'}}));
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:6,stroke:'#00ff00'});
    await r.check(w.id,true);expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:6,stroke:'#00ff00'});
  });
  it('does not authorize initial line-pattern-none or unsupported assets via its getter',()=>{
    const {doc,w}=fixture();w.style.linePattern='none';
    const r=session(doc,portable);expect(r.selectionIndicatorPaint(w.id)).toBeUndefined();
    expect(r.state().selectionPaintState).toBeUndefined();
  });
  it('disabled no-style public selection changes checked but does not paint or select',async()=>{
    const {doc,w}=fixture();w.disabled=true;
    const r=session(doc,portable);await r.start();await r.select(w.id,true);
    expect(r.widget(w)).toMatchObject({checked:true,selected:false});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'none'});
    await r.execute(event('click',{type:'enable',targetId:w.id}));
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'none'});
    await r.select(w.id,false);
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'#102030',markWidth:1});
  });
  it('applies selected before synchronous callbacks and error after callbacks',async()=>{
    const {doc,w}=fixture();w.selectedStyle={strokeWidth:3};w.disabledStyle={strokeWidth:0};
    w.interactions=[event('selectedChange',{type:'disable',targetId:w.id})];
    const r=session(doc,portable);await r.select(w.id,true);
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3,markWidth:3});
    const second=fixture();second.w.errorStyle={strokeWidth:6};
    second.w.interactions=[event('errorSet',{type:'setSelected',targetId:second.w.id,value:'true'})];
    const s=session(second.doc,portable);await s.setError(second.w.id,true);
    expect(s.selectionIndicatorPaint(second.w.id)).toMatchObject({outlineWidth:6,markWidth:6});
  });
  it('keeps the selected paint before a deferred handler and preserves the later zero-width attribute',async()=>{
    vi.useFakeTimers();const {doc,w}=fixture();w.selectedStyle={strokeWidth:3};w.disabledStyle={strokeWidth:0};
    w.interactions=[event('selectedChange',{type:'wait',duration:20},{type:'disable',targetId:w.id})];
    const r=session(doc,portable), done=r.select(w.id,true);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3});expect(r.widget(w).disabled).not.toBe(true);
    await vi.advanceTimersByTimeAsync(20);await done;
    expect(r.widget(w).disabled).toBe(true);expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3});
  });
  it('mouse-down uses the original forced hover compound state and focus suppresses pointer paint',async()=>{
    const {doc,w}=fixture();w.mouseOverStyle={fill:'#112233'};w.mouseDownStyle={strokeWidth:4};w.focusedStyle={strokeWidth:7};
    const r=session(doc,portable);r.setInteractionState(w.id,{mouseDown:true});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({fill:'#112233',outlineWidth:4});
    await r.focus(w.id,true);expect(r.selectionIndicatorPaint(w.id)).toMatchObject({fill:'#ffffff',outlineWidth:7});
    await r.focus(w.id,false);expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:4});
  });
  it('hover may paint disabled state while down and focus are disabled-gated',async()=>{
    const {doc,w}=fixture();w.disabled=true;w.mouseOverStyle={strokeWidth:4};w.mouseDownStyle={strokeWidth:5};w.focusedStyle={strokeWidth:6};
    const r=session(doc,portable);await r.start();
    r.setInteractionState(w.id,{mouseDown:true,focused:true});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'none'});
    r.setInteractionState(w.id,{mouseOver:true});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:1,markStroke:'#102030',markWidth:1});
  });
  it('base empty states do not paint, but adaptive empty states are eligible and use complete normal style',async()=>{
    const {doc,w}=fixture();w.mouseOverStyle={};
    doc.pages[0].adaptiveViews=[{id:'phone',name:'Phone',width:400,overrides:{[w.id]:{stateStyles:{mouseOver:{}}}}}];
    const r=session(doc,portable);r.setInteractionState(w.id,{mouseOver:true});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'none'});
    await r.setAdaptiveView({kind:'view',viewId:'phone'});
    r.setInteractionState(w.id,{mouseOver:false});r.setInteractionState(w.id,{mouseOver:true});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({markStroke:'#102030',fill:'#ffffff'});
  });
  it('preserves the original asset across P94/adaptive updates, without render-getter mutation',async()=>{
    const {doc,w}=fixture('checkbox');
    doc.pages[0].adaptiveViews=[{id:'phone',name:'Phone',width:400,overrides:{[w.id]:{style:{selectionButtonSize:28,strokeWidth:0,fill:'#aabbcc'}}}}];
    const r=session(doc,portable);
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:4}}));
    await r.setAdaptiveView({kind:'view',viewId:'phone'});
    expect(r.selectionIndicatorPaint(w.id)).toMatchObject({assetSize:14,assetStrokeWidth:1,outlineWidth:4,markWidth:3,fill:'#aabbcc'});
    const snapshot=structuredClone(r.state());r.selectionIndicatorPaint(w.id)!.outlineWidth=99;
    r.widget(w);r.selectionIndicatorPaint(w.id);expect(r.state()).toEqual(snapshot);
  });
  it('rolls back both a new ledger and prior attribute history after a failing action transaction',async()=>{
    const {doc,w}=fixture(),r=session(doc,portable);
    const before=structuredClone(r.state());
    await expect(r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:5}},{type:'setVariable',targetId:'Bad',value:'[[1/0]]'}))).rejects.toThrow();
    expect(r.state()).toEqual(before);
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:3}}));
    const paint=r.selectionIndicatorPaint(w.id);
    await expect(r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:5}},{type:'setVariable',targetId:'Bad',value:'[[1/0]]'}))).rejects.toThrow();
    expect(r.selectionIndicatorPaint(w.id)).toEqual(paint);
  });
  it('isolates row ledgers, resets regenerated rows, clears page and disposal state',async()=>{
    const {doc,w}=fixture(),rep=createWidget('repeater');rep.repeater!.template=[w];doc.pages[0].widgets=[rep];
    const page=createPage('Other');doc.pages.push(page);
    const r=session(doc,portable);await r.start();const rows=r.rows(rep);
    expect(r.selectionIndicatorPaint(w.id)).toBeUndefined();
    await r.execute(event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:4}}),undefined,rows[0].context);
    expect(r.selectionIndicatorPaint(w.id,rows[0].context)).toMatchObject({outlineWidth:4});
    expect(r.selectionIndicatorPaint(w.id,rows[1].context)).toMatchObject({outlineWidth:1,markStroke:'none'});
    await r.execute(event('click',{type:'sortRows',targetId:rep.id,value:rep.repeater!.columns[0]}));
    expect(r.selectionIndicatorPaint(w.id,r.rows(rep)[0].context)).toMatchObject({outlineWidth:1,markStroke:'none'});
    await r.navigate(page.id);expect(r.selectionIndicatorPaint(w.id,rows[0].context)).toBeUndefined();
    expect(r.state().selectionPaintState).toBeUndefined();r.dispose();expect(r.selectionIndicatorPaint(w.id)).toBeUndefined();
  });
});

it('engine snapshot helpers preserve the ledger across separate executions',async()=>{
  const {doc,w}=fixture();
  const first=await executeInteraction(doc,createRuntime(doc),event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:3}}));
  const second=await executeInteraction(doc,first,event('click',{type:'setStyle',targetId:w.id,style:{strokeWidth:0}}));
  const r=session(doc,false);Object.assign(r.state(),structuredClone(second));
  expect(r.selectionIndicatorPaint(w.id)).toMatchObject({outlineWidth:3,markWidth:3});
  expect(first).not.toEqual(second);
});
