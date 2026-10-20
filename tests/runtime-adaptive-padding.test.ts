import {Script} from 'node:vm';
import {afterEach,describe,expect,it} from 'vitest';
import {createDocument,createWidget} from '../src/model/document';
import type {AdaptiveWidgetOverride,Document,WidgetType} from '../src/model/types';
import {createOfflineRuntime,type OfflineRuntime} from '../src/runtime/export-runtime';
import {evaluateExpression} from '../src/runtime/expressions';

const sessions:OfflineRuntime[]=[];
afterEach(()=>sessions.splice(0).forEach(runtime=>runtime.dispose()));
function fixture(type:WidgetType='box'){
  const doc=createDocument(),page=doc.pages[0],target=createWidget(type);page.widgets=[target];
  page.adaptiveSelection='native-size';page.adaptiveBaseSize={width:1200,height:0};
  page.adaptiveViews=[{id:'parent',name:'Parent',width:768,overrides:{}},{id:'child',name:'Child',width:390,baseViewId:'parent',overrides:{}}];
  return {doc,page,target};
}
function patch(sides:Record<string,number>,style?:AdaptiveWidgetOverride['style']):AdaptiveWidgetOverride{
  return {textPaddingSides:sides,...(style?{style}:{})} as AdaptiveWidgetOverride;
}
function make(doc:Document,portable:boolean){
  const factory:typeof createOfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout}):createOfflineRuntime;
  const runtime=factory(doc,undefined,evaluateExpression,undefined,{width:1200});sessions.push(runtime);return runtime;
}
for(const portable of [false,true])describe(`${portable?'serialized':'module'} independent adaptive padding sides`,()=>{
  it('composes a legacy parent tuple with only the declared child sides and projects no metadata',async()=>{
    const {doc,page,target}=fixture();target.style.textPadding=[1,2,3,4];
    page.adaptiveViews[0].overrides[target.id]={style:{textPadding:[10,20,30,40]}};
    page.adaptiveViews[1].overrides[target.id]=patch({top:0,left:9});const before=structuredClone(doc);
    const runtime=make(doc,portable);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'child'});
    expect(runtime.widget(target).style.textPadding).toEqual([0,20,30,9]);
    expect(runtime.adaptiveWidgetOverride(target.id)?.style?.textPadding).toEqual([0,20,30,9]);
    expect(runtime.widget(target)).not.toHaveProperty('textPaddingSides');expect(runtime.adaptiveWidgetOverride(target.id)).not.toHaveProperty('textPaddingSides');
    expect(doc).toEqual(before);
  });
  it('a nearer legacy tuple replaces all earlier side declarations before later sides apply',async()=>{
    const {doc,page,target}=fixture();target.style.textPadding=[1,2,3,4];
    page.adaptiveViews[0].overrides[target.id]=patch({top:12,left:18});
    page.adaptiveViews[1].overrides[target.id]=patch({right:0},{textPadding:[2,4,6,8]});
    const runtime=make(doc,portable);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'child'});
    expect(runtime.widget(target).style.textPadding).toEqual([2,0,6,8]);
  });
  it.each([['box',5],['input',7],['textarea',7],['select',7]] as const)('%s uses existing defaults only for undeclared sides',async(type,inset)=>{
    const {doc,page,target}=fixture(type);delete target.style.textPadding;page.adaptiveViews[1].overrides[target.id]=patch({right:0});
    const runtime=make(doc,portable);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'child'});
    expect(runtime.widget(target).style.textPadding).toEqual([inset,0,inset,inset]);
    await runtime.setAdaptiveView({kind:'base'});expect(runtime.widget(target).style).not.toHaveProperty('textPadding');
  });
  it('switching views restores authored sides while a same-view selection preserves runtime style',async()=>{
    const {doc,page,target}=fixture();target.style.textPadding=[1,2,3,4];page.adaptiveViews[1].overrides[target.id]=patch({left:50});
    const runtime=make(doc,portable);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'child'});
    await runtime.execute({id:'edit-padding',name:'edit',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:'set-padding',type:'setStyle',targetId:target.id,style:{textPadding:[8,8,8,8]}}]});
    expect(runtime.widget(target).style.textPadding).toEqual([8,8,8,8]);
    await runtime.setAdaptiveView({kind:'view',viewId:'child'});expect(runtime.widget(target).style.textPadding).toEqual([8,8,8,8]);
    await runtime.setAdaptiveView({kind:'base'});expect(runtime.widget(target).style.textPadding).toEqual([1,2,3,4]);
    await runtime.setAdaptiveView({kind:'view',viewId:'child'});expect(runtime.widget(target).style.textPadding).toEqual([1,2,3,50]);
  });
  it('empty side maps preserve omission and do not create synthetic padding values',async()=>{
    const {doc,page,target}=fixture();delete target.style.textPadding;page.adaptiveViews[1].overrides[target.id]=patch({});
    const runtime=make(doc,portable);await runtime.start();await runtime.setAdaptiveView({kind:'view',viewId:'child'});
    expect(runtime.widget(target).style).not.toHaveProperty('textPadding');expect(runtime.widget(target)).not.toHaveProperty('textPaddingSides');
  });
});
