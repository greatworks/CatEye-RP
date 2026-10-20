import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createShadowRenderer } from '../src/model/shadow';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { getRuntimeWidget } from '../src/runtime/engine';
import type { Action, Document, Interaction, ShadowStyle } from '../src/model/types';
import { exportPrototype } from '../src/runtime/export';

const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(session => session.dispose()));
const shadow = (on = true): ShadowStyle => ({ on, offsetX: -3.5, offsetY: 4, blurRadius: 6, color: 'rgba(17,34,51,0.4)' });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Shadows', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
const make = (doc: Document, portable: boolean) => { const session: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc); sessions.push(session); return session; };
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} shadow rendering`, () => {
  const render: ReturnType<typeof createShadowRenderer> = portable ? new Script(`(${createShadowRenderer.toString()})()`).runInNewContext() : createShadowRenderer();
  it('uses different box, vector, image and text shadow paths with explicit off clearing', () => {
    const style = { outerShadow: shadow(), innerShadow: { ...shadow(), spread: 2 }, textShadow: shadow() };
    expect(render.css(style).boxShadow).toBe('-3.5px 4px 6px 0px rgba(17,34,51,0.4), inset -3.5px 4px 6px 2px rgba(17,34,51,0.4)');
    expect(render.css(style,'vector')).toEqual({ boxShadow:'none',filter:'drop-shadow(-3.5px 4px 6px rgba(17,34,51,0.4))',textShadow:'-3.5px 4px 6px rgba(17,34,51,0.4)' });
    expect(render.css(style,'image').boxShadow).not.toContain('inset');
    expect(render.css(style,'image').textShadow).toBe('none');
    expect(render.css(style,render.mode('panel'))).toEqual(render.css(style,'image'));
    expect(render.css({ outerShadow:shadow(false),innerShadow:{ ...shadow(false),spread:2 },textShadow:shadow(false) })).toEqual({boxShadow:'none',filter:'none',textShadow:'none'});
    expect(render.css({})).toEqual({boxShadow:'none',filter:'none',textShadow:'none'});
  });
  it('builds the original inner primitive order with stroke spread and half blur; unique inert IDs do not interpolate markup', () => {
    const nodes=render.inner({ innerShadow:{ ...shadow(),spread:2 },strokeWidth:3 });
    expect(nodes.map(node=>node.tag)).toEqual(['feOffset','feMorphology','feGaussianBlur','feComposite','feFlood','feComposite','feComposite']);
    expect(nodes[1].attrs.radius).toBe('5');expect(nodes[2].attrs.stdDeviation).toBe('3');
    const id=render.filterId('page/row1/<script>😀');expect(id).toMatch(/^rea-shadow-[a-f0-9-]+$/);expect(id).not.toBe(render.filterId('page/row2/<script>😀'));
    expect(render.inner({ innerShadow:{ ...shadow(false),spread:2 },strokeWidth:3 })).toEqual([]);
  });
  it('composes whole state shadows and restores authored values without changing geometry or child text style', async () => {
    const doc=createDocument(), w=createWidget('box');doc.pages[0].widgets=[w];w.style.outerShadow=shadow();w.style.textShadow=shadow();
    w.mouseOverStyle={outerShadow:{...shadow(),offsetX:25}};w.selectedStyle={outerShadow:shadow(false)};
    const before=serializeDocument(doc),session=make(doc,portable),geometry={x:w.x,y:w.y,width:w.width,height:w.height};
    session.setInteractionState(w.id,{mouseOver:true});expect(session.widget(w).style.outerShadow?.offsetX).toBe(25);
    await session.select(w.id,true);expect(session.widget(w).style.outerShadow?.on).toBe(false);
    await session.select(w.id,false);session.setInteractionState(w.id,{mouseOver:false});
    expect(session.widget(w)).toMatchObject({...geometry,style:{outerShadow:shadow()}});expect(serializeDocument(doc)).toBe(before);
    const child=createWidget('text');expect(render.css(child.style).textShadow).toBe('none');
  });
  it('SetStyle and SetText preserve rich runs and restore transaction state after a failed action', async () => {
    const doc=createDocument(),w=createWidget('text'),repeater=createWidget('repeater');doc.pages[0].widgets=[w,repeater];w.style.textShadow=shadow();w.richText={paragraphs:[{runs:[{text:'A',style:{fontWeight:700}},{text:'B',style:{fontStyle:'italic'}}]}]};w.text='AB';
    const session=make(doc,portable);await session.execute(event({type:'setStyle',targetId:w.id,style:{textShadow:shadow(false)}}));
    expect(session.widget(w).richText).toEqual(w.richText);expect(getRuntimeWidget(w,session.state()).style.textShadow?.on).toBe(false);
    await session.execute(event({type:'setText',targetId:w.id,value:'Replacement'}));expect(session.widget(w).style.textShadow?.on).toBe(false);
    const state=structuredClone(session.state());await expect(session.execute(event({type:'setStyle',targetId:w.id,style:{textShadow:shadow()}},{type:'addRow',targetId:repeater.id,value:'{invalid'}))).rejects.toThrow();
    expect(session.state()).toEqual(state);expect(session.widget(w).style.textShadow?.on).toBe(false);
  });
  it('row style overrides affect only that row and refresh clears temporary shadows', async () => {
    const doc=createDocument(),r=createWidget('repeater'),w=createWidget('box');r.repeater!.rows=[{Name:'A'},{Name:'B'}];r.repeater!.columns=['Name'];r.repeater!.template=[w];w.style.outerShadow=shadow();doc.pages[0].widgets=[r];
    w.interactions=[event({type:'setStyle',targetId:w.id,style:{outerShadow:shadow(false)}})];const session=make(doc,portable);await session.start();const rows=session.rows(r);
    await session.trigger(w.id,'click',rows[0].data,rows[0].context);expect(session.widget(w,rows[0].context).style.outerShadow?.on).toBe(false);expect(session.widget(w,rows[1].context).style.outerShadow?.on).toBe(true);
    await session.execute(event({type:'addRow',targetId:r.id,value:'{"Name":"C"}'}));expect(session.widget(w,session.rows(r)[0].context).style.outerShadow?.on).toBe(true);
  });
});
it('offline and embedded bootstrap carry the same closed-over shadow factory with no executable document markup', () => {
  const doc=createDocument(),w=createWidget('box');w.style.outerShadow=shadow();doc.pages[0].widgets=[w];const html=exportPrototype(doc);
  expect(html).toContain('shadows:(');expect(html).toContain('feMorphology');expect(html).not.toContain('innerHTML');
});
