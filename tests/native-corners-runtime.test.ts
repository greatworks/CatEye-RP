import {Script} from 'node:vm';
import {afterEach,describe,expect,it} from 'vitest';
import {createOfflineRuntime,type OfflineRuntime} from '../src/runtime/export-runtime';
import {resolveInteractionStyle,parseDocument,serializeDocument} from '../src/model/document';
import {nativeCornersFixture,cornerMask} from './fixtures/native-corners';
const runtimes:OfflineRuntime[]=[];afterEach(()=>runtimes.splice(0).forEach(r=>r.dispose()));
for(const portable of [false,true])describe(`${portable?'serialized':'module'} native corner state and actions`,()=>{
  const make=(doc:ReturnType<typeof nativeCornersFixture>)=>{const factory:typeof createOfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout}):createOfflineRuntime;const runtime=factory(doc);runtimes.push(runtime);return runtime;};
  it('composes hover radius, selected corner mask and action edits independently',async()=>{
    const doc=nativeCornersFixture(),page=doc.pages[0],target=page.widgets.find(w=>w.id==='corners-target')!,runtime=make(doc);await runtime.start();
    await runtime.trigger('corners-mask','click');expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(1));expect(runtime.widget(target).style.radius).toBe(20);
    await runtime.trigger('corners-radius','click');expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(1));expect(runtime.widget(target).style.radius).toBe(12);
    await runtime.trigger('corners-select','click');const resolved=resolveInteractionStyle(runtime.widget(target),{mouseOver:true});expect(resolved.radius).toBe(36);expect(resolved.cornerVisibility).toEqual(cornerMask(5));
    expect(target.style.radius).toBe(20);expect(target.style.cornerVisibility).toEqual(cornerMask(15));
  });
  it('keeps parent radius and child mask through view changes, then restores authored values after action reset',async()=>{
    const doc=nativeCornersFixture(),page=doc.pages[0],target=page.widgets.find(w=>w.id==='corners-target')!;page.adaptiveSelection='native-size';page.adaptiveBaseSize={width:1200,height:0};
    page.adaptiveViews=[{id:'tablet',name:'Tablet',width:700,overrides:{[target.id]:{style:{radius:40}}}},{id:'phone',name:'Phone',width:390,baseViewId:'tablet',overrides:{[target.id]:{style:{cornerVisibility:cornerMask(0)}}}}];
    const runtime=make(doc);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'phone'});expect(runtime.widget(target).style.radius).toBe(40);expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(0));
    await runtime.trigger('corners-radius','click');expect(runtime.widget(target).style.radius).toBe(12);expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(0));
    await runtime.setAdaptiveView({kind:'base'});expect(runtime.widget(target).style.radius).toBe(20);expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(15));
    await runtime.setAdaptiveView({kind:'view',viewId:'phone'});expect(runtime.widget(target).style.radius).toBe(40);expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(0));
  });
  it('rolls back failed action batches without losing the mask or legacy radii',async()=>{
    const doc=nativeCornersFixture(),target=doc.pages[0].widgets.find(w=>w.id==='corners-target')!,runtime=make(doc);target.style.cornerRadii=[1,2,3,4];await runtime.start();const before=structuredClone(runtime.state());
    await expect(runtime.execute({id:'bad',name:'bad',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:'radius',type:'setStyle',targetId:target.id,style:{radius:50,cornerVisibility:cornerMask(0)}},{id:'rows',type:'addRow',targetId:'corners-repeater',value:'invalid'}]})).rejects.toThrow();
    expect(runtime.state()).toEqual(before);expect(runtime.widget(target).style.cornerRadii).toEqual([1,2,3,4]);expect(runtime.widget(target).style.cornerVisibility).toEqual(cornerMask(15));
  });
});
it('saves all independent corner carriers without adding parameters to legacy styles',()=>{
  const doc=nativeCornersFixture(),before=structuredClone(doc);expect(parseDocument(serializeDocument(doc))).toEqual(before);
});
