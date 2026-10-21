import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime, type RowContext } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Document, Interaction, Widget } from '../src/model/types';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of sessions.splice(0)) runtime.dispose(); });
const event = (...actions: Omit<Action,'id'>[]): Interaction => ({
  id:uid(), name:'Selection text', event:'click', enabled:true, conditions:[], conditionMode:'all',
  actions:actions.map(action => ({...action,id:uid()})),
});
const text = (widget:Widget,value='A longer label'): Omit<Action,'id'> => ({type:'setText',targetId:widget.id,value});
function fixture(type:'checkbox'|'radio') {
  const doc=createDocument(),widget=createWidget(type,100,200);
  Object.assign(widget,{width:100,height:20,text:'Before',selectionText:{autoFitWidth:true,autoFitHeight:false,alignRight:false}});
  Object.assign(widget.style,{selectionButtonSize:18,textAlign:'right',verticalAlign:'bottom',textPadding:[2,7,3,5]});
  doc.pages[0].widgets=[widget];doc.caseSelection='never';
  return {doc,widget};
}
function runtimeFor(doc:Document,portable:boolean): OfflineRuntime {
  const runtime=portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout})(doc,undefined,evaluateExpression)
    : createOfflineRuntime(doc,undefined,evaluateExpression);
  sessions.push(runtime);return runtime;
}
function host(runtime:OfflineRuntime,widget:Widget,width=135) {
  const calls:{kind:string;context?:RowContext;text?:string}[]=[];
  const result={width,calls};
  runtime.bindControls({
    flush:()=>calls.push({kind:'flush',text:runtime.widget(widget).text}),focus:()=>{},selectText:()=>{},
    measureSelectionText:(id,context)=>{
      expect(id).toBe(widget.id);calls.push({kind:'measure',context:structuredClone(context)});
      const current=runtime.widget(widget,context);
      return {width:result.width,height:NaN,rect:{x:current.x,y:current.y,width:current.width,height:current.height},
        textAlign:current.style.textAlign,verticalAlign:current.style.verticalAlign};
    },
  });
  return result;
}

for(const portable of [false,true]) describe(`${portable?'serialized':'module'} selection runtime text`,()=>{
  for(const type of ['checkbox','radio'] as const) {
    it(`${type}: keeps owner size and emits Move without Resize for the measured width candidate`,async()=>{
      const {doc,widget}=fixture(type);
      widget.interactions=[
        {...event({type:'setVariable',targetId:'Resized',value:'yes'}),event:'resize'},
        {...event({type:'setVariable',targetId:'Moved',value:'[[This.x]]|[[This.width]]'}),event:'move'},
      ];
      const saved=serializeDocument(doc);
      const runtime=runtimeFor(doc,portable),measurement=host(runtime,widget);
      await runtime.execute(event(text(widget)));
      expect(runtime.widget(widget)).toMatchObject({x:65,y:200,width:100,height:20,text:'A longer label'});
      expect(runtime.renderSize(widget)).toEqual({width:100,height:20});
      expect(runtime.hasOverride(widget.id,'width')).toBe(false);
      expect(runtime.state().variables.Resized).toBeUndefined();
      expect(runtime.state().variables.Moved).toBe('65|100');
      expect(measurement.calls.map(call=>call.kind)).toEqual(['flush','measure']);
      expect(runtime.nativeTextSet(widget.id)).toBe(true);
      // No P94 reservation is added to the already measured runtime candidate.
      expect(widget.x).toBe(100);expect(widget.width).toBe(100);
      expect(serializeDocument(doc)).toBe(saved);
    });
    it(`${type}: repeats alignment from the unchanged owner width when registered text is remeasured`,async()=>{
      const {doc,widget}=fixture(type),runtime=runtimeFor(doc,portable),measurement=host(runtime,widget);
      await runtime.updateAutoFitted();expect(measurement.calls).toEqual([]);
      await runtime.execute(event(text(widget)));
      await runtime.updateAutoFitted();
      expect(runtime.widget(widget)).toMatchObject({x:30,width:100,height:20});
      measurement.width=80;await runtime.updateAutoFitted();
      expect(runtime.widget(widget)).toMatchObject({x:50,width:100,height:20});
    });
  }
  it.each([['left',100],['center',82.5],['right',65]] as const)('uses %s alignment with fractional deltas',async(align,x)=>{
    const {doc,widget}=fixture('checkbox');widget.style.textAlign=align;
    const runtime=runtimeFor(doc,portable);host(runtime,widget);
    await runtime.execute(event(text(widget)));expect(runtime.widget(widget).x).toBe(x);
  });
  it('changes text without invented measurements when no selection host is installed',async()=>{
    const {doc,widget}=fixture('checkbox'),runtime=runtimeFor(doc,portable);
    await runtime.execute(event(text(widget,'One\nTwo')));
    expect(runtime.widget(widget)).toMatchObject({x:100,y:200,width:100,height:20,text:'One\nTwo'});
    expect(runtime.widget(widget).richText?.paragraphs).toEqual([{runs:[{text:'One\nTwo',style:{}}]}]);
  });
  it('keeps a single linked run and raw newline formatting through the native setter',async()=>{
    const {doc,widget}=fixture('radio');
    widget.richText={paragraphs:[{runs:[{text:'Old',style:{fontWeight:700},linkId:'link'}]}],links:[{id:'link',name:'Link',interactions:[]}]};
    const runtime=runtimeFor(doc,portable);host(runtime,widget,12);
    await runtime.execute(event(text(widget,'New')));
    expect(runtime.widget(widget).richText?.paragraphs[0].runs[0].linkId).toBe('link');
    await runtime.execute(event(text(widget,'One\n\nTwo')));
    expect(runtime.widget(widget).richText).toEqual({paragraphs:[{runs:[{text:'One\n\nTwo',style:{fontWeight:700}}]}]});
  });
  it('rejects the unsupported native height-fit branch without committing nonfinite geometry',async()=>{
    const {doc,widget}=fixture('checkbox');widget.selectionText!.autoFitHeight=true;
    const runtime=runtimeFor(doc,portable);host(runtime,widget);
    const before=structuredClone(runtime.state());
    await expect(runtime.execute(event(text(widget)))).rejects.toThrow(/selection.*height/i);
    expect(runtime.state()).toEqual(before);
    expect(runtime.nativeTextSet(widget.id)).toBe(false);
  });
  it('does not remeasure or register when both fit flags are false',async()=>{
    const {doc,widget}=fixture('checkbox');widget.selectionText!.autoFitWidth=false;
    const runtime=runtimeFor(doc,portable),measurement=host(runtime,widget);
    await runtime.execute(event(text(widget)));await runtime.updateAutoFitted();
    expect(measurement.calls).toEqual([]);
    expect(runtime.widget(widget)).toMatchObject({x:100,width:100,height:20});
  });
  it('leaves legacy selection controls on their existing text path',async()=>{
    const {doc,widget}=fixture('radio');delete widget.selectionText;
    const runtime=runtimeFor(doc,portable),measurement=host(runtime,widget);
    await runtime.execute(event(text(widget)));await runtime.updateAutoFitted();
    expect(measurement.calls).toEqual([]);
    expect(runtime.nativeTextSet(widget.id)).toBe(false);
  });
  it('preserves the control host receiver when calling its measurement method',async()=>{
    const {doc,widget}=fixture('checkbox'),runtime=runtimeFor(doc,portable);
    let flushes=0;
    runtime.bindControls({
      flush(){flushes++},focus(){},selectText(){},
      measureSelectionText(){
        this.flush();
        return {width:135,height:20,rect:{x:100,y:200,width:100,height:20},textAlign:'right',verticalAlign:'top'};
      },
    });
    await runtime.execute(event(text(widget)));
    expect(flushes).toBe(2);expect(runtime.widget(widget).x).toBe(65);
  });
  it('rejects a nonfinite measured width and preserves the transaction',async()=>{
    const {doc,widget}=fixture('checkbox'),runtime=runtimeFor(doc,portable);
    host(runtime,widget,Infinity);const before=structuredClone(runtime.state());
    await expect(runtime.execute(event(text(widget)))).rejects.toThrow(/measurement/);
    expect(runtime.state()).toEqual(before);
  });
  it('rejects repeated finite candidates when alignment would overflow the position',async()=>{
    const {doc,widget}=fixture('checkbox'),runtime=runtimeFor(doc,portable);
    host(runtime,widget,Number.MAX_VALUE);
    await runtime.execute(event(text(widget)));
    expect(Number.isFinite(runtime.widget(widget).x)).toBe(true);
    await expect(runtime.updateAutoFitted()).rejects.toThrow(/alignment movement/);
    expect(Number.isFinite(runtime.widget(widget).x)).toBe(true);
  });
  it('rolls text, position and registration back if a later synchronous action fails',async()=>{
    const {doc,widget}=fixture('radio'),runtime=runtimeFor(doc,portable),measurement=host(runtime,widget);
    const before=structuredClone(runtime.state());
    await expect(runtime.execute(event(text(widget),{type:'setSelected',targetId:widget.id,value:'invalid'}))).rejects.toThrow();
    expect(runtime.state()).toEqual(before);expect(runtime.nativeTextSet(widget.id)).toBe(false);
    const count=measurement.calls.length;await runtime.updateAutoFitted();expect(measurement.calls).toHaveLength(count);
  });
});
