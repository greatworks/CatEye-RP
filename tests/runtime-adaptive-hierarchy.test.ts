import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import type { Action, AdaptiveView, Document, Interaction, Page } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RuntimeViewport } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { adaptiveViewChain, chooseAdaptiveView } from '../src/model/adaptive-selection';
import { resolveAdaptiveWidgets } from '../src/model/adaptive';

const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(runtime => runtime.dispose()));
const view = (id: string, width: number, height = 0, baseViewId?: string): AdaptiveView => ({ id, name: id, width, height, ...(baseViewId ? { baseViewId } : {}), overrides: {} });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Action', enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
function fixture() {
  const doc = createDocument(), page = doc.pages[0], shape = createWidget('box', 12, 34);
  page.adaptiveSelection = 'native-size'; page.adaptiveBaseSize = { width: 0, height: 0 }; page.width = 1200; page.height = 900;
  page.widgets = [shape]; doc.caseSelection = 'never';
  return { doc, page, shape };
}
function make(doc: Document, portable: boolean, policy: RuntimeViewport = {}) {
  const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout }) : createOfflineRuntime;
  const runtime = factory(doc, undefined, evaluateExpression, undefined, policy); sessions.push(runtime); return runtime;
}

// Fixed expected results from retained adaptive.js _getAdaptiveView, independently
// replayed in research/adaptive-hierarchy-probe.json. Canvas size is not Base size.
export const selectionCases: { name: string; base: [number, number]; views: [string, number, number][]; at: [number, number]; expected?: string }[] = [
  ...[0, 389.999, 390, 767.999, 768, 1000].flatMap(width => [0, 900].map(height => ({ name: `native thresholds ${width}/${height}`, base: [0, 0] as [number, number], views: [['phone',390,0],['tablet',768,0]] as [string,number,number][], at: [width,height] as [number,number], expected: width >= 768 ? 'tablet' : width >= 390 ? 'phone' : undefined }))),
  ...[0,399.999,400,899.999,900].map(height => ({ name: `height tie ${height}`, base: [0,0] as [number,number], views: [['tall',768,900],['short',768,0],['medium',768,400]] as [string,number,number][], at: [800,height] as [number,number], expected: height >= 900 ? 'tall' : height >= 400 ? 'medium' : 'short' })),
  { name:'height does not exclude a wider fitting width', base:[0,0], views:[['short',400,300],['tall',500,2000]], at:[600,300], expected:'tall' },
  { name:'all heights above viewport choose smallest', base:[0,0], views:[['h900',500,900],['h300',500,300],['h600',500,600]], at:[600,1], expected:'h300' },
  { name:'upper width fallback', base:[1000,900], views:[['a',600,2000],['b',800,10]], at:[500,1], expected:'a' },
  { name:'upper zero height sentinel', base:[1000,900], views:[['zero',600,0],['h100',600,100],['h50',600,50]], at:[500,1], expected:'h50' },
  { name:'Base exact tie wins', base:[500,300], views:[['same',500,300]], at:[500,300] },
  { name:'named exact tie keeps declaration order', base:[0,0], views:[['first',500,300],['second',500,300]], at:[600,300], expected:'first' },
  { name:'zero named threshold is real lower bound', base:[800,600], views:[['zero',0,0]], at:[1,1], expected:'zero' },
  { name:'Base zero height fits', base:[500,0], views:[['tall',500,300]], at:[600,200] },
];

describe('author selector and independently serialized helpers', () => {
  it.each(selectionCases)('$name', ({base,views,at,expected}) => {
    const {page}=fixture();page.adaptiveBaseSize={width:base[0],height:base[1]};page.adaptiveViews=views.map(([id,width,height])=>view(id,width,height));
    const portable: typeof chooseAdaptiveView=new Script(`(${chooseAdaptiveView.toString()})`).runInNewContext();
    expect(chooseAdaptiveView(page,...at)?.id).toBe(expected);expect(portable(page,...at)?.id).toBe(expected);
  });
  it('rejects invalid dimensions on both selection modes and resolves Base without a synthetic ID', () => {
    const {page}=fixture();
    for(const mode of ['native-size',undefined] as const){page.adaptiveSelection=mode;for(const invalid of [-1,NaN,Infinity]){expect(()=>chooseAdaptiveView(page,invalid)).toThrow(/finite nonnegative/);expect(()=>chooseAdaptiveView(page,0,invalid)).toThrow(/finite nonnegative/);}}
    expect(adaptiveViewChain(page,null)).toEqual([]);expect(adaptiveViewChain(page)).toEqual([]);
  });
  it('orders by graph rather than widths/declaration order and rejects missing/cyclic parents', () => {
    const {page}=fixture();page.adaptiveViews=[view('leaf',700,0,'parent'),view('unrelated',500),view('parent',900,0,'grand'),view('grand',300)];
    const portable:typeof adaptiveViewChain=new Script(`(${adaptiveViewChain.toString()})`).runInNewContext();
    for(const chain of [adaptiveViewChain,portable]){
      expect(chain(page,'leaf').map(view=>view.id)).toEqual(['grand','parent','leaf']);
      expect(()=>chain(page,'missing')).toThrow(/does not exist/);
      page.adaptiveViews[3].baseViewId='leaf';expect(()=>chain(page,'leaf')).toThrow(/cycle/);delete page.adaptiveViews[3].baseViewId;
      page.adaptiveViews[0].baseViewId='leaf';expect(()=>chain(page,'leaf')).toThrow(/cycle/);page.adaptiveViews[0].baseViewId='parent';
    }
  });
});

for (const portable of [false,true]) describe(`${portable?'serialized':'module'} adaptive hierarchy`, () => {
  it.each(selectionCases)('$name', ({base,views,at,expected}) => {
    const {doc,page} = fixture(); page.adaptiveBaseSize={width:base[0],height:base[1]}; page.adaptiveViews=views.map(([id,width,height])=>view(id,width,height));
    expect(make(doc,portable,{width:at[0],height:at[1]}).adaptiveViewId()).toBe(expected);
  });
  it('keeps absent selection legacy max-width and omitted runtime policy manual', () => {
    const {doc,page} = fixture(); delete page.adaptiveSelection; delete page.adaptiveBaseSize; page.adaptiveViews=[view('phone',390),view('tablet',768)];
    expect(make(doc,portable,{width:500,height:999}).adaptiveViewId()).toBe('tablet');
    const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout}) : createOfflineRuntime;
    const manual=factory(doc);sessions.push(manual);expect(manual.adaptiveViewId()).toBeUndefined();
  });
  it('merges an out-of-order ancestry chain with atomic paint resets and a detached readonly declaration', () => {
    const {doc,page,shape}=fixture(); const parent=view('parent',390), child=view('child',768,0,'parent'), grand=view('grand',200);parent.baseViewId='grand';
    const gradient={type:'linear' as const,start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'#000000'},{offset:1,color:'#ffffff'}]};
    grand.overrides[shape.id]={x:80,hidden:true,style:{fillGradient:gradient,strokeGradient:gradient,cornerRadii:[1,2,3,4],borderWidths:[1,2,3,4],fontSize:18}};
    parent.overrides[shape.id]={width:321,style:{fill:'#00ff00',stroke:'#0000ff',radius:7,strokeWidth:6}};
    child.overrides[shape.id]={hidden:false,style:{color:'#123456'}};page.adaptiveViews=[child,parent,grand];
    const runtime=make(doc,portable,{width:800,height:0}), effective=runtime.widget(shape);
    const authored=resolveAdaptiveWidgets(page,'child')[0];expect(effective).toMatchObject(authored);
    expect(effective).toMatchObject({x:80,width:321,hidden:false,style:{fill:'#00ff00',stroke:'#0000ff',radius:7,strokeWidth:6,fontSize:18,color:'#123456'}});
    for(const key of ['fillGradient','strokeGradient','cornerRadii','borderWidths'])expect(effective.style).not.toHaveProperty(key);
    const declaration=runtime.adaptiveWidgetOverride(shape.id)!; declaration.x=999;declaration.style!.color='#ff0000';
    expect(runtime.widget(shape).x).toBe(80);expect(runtime.adaptiveWidgetOverride(shape.id)!.style!.color).toBe('#123456');
  });
  it('reads inherited declarations before hidden and inactive Loaded, and filters shared composite layouts', async () => {
    const {doc,page,shape}=fixture(), panel=createWidget('panel'), table=createWidget('table'), child=createWidget('box');
    panel.states!.push({id:uid(),name:'Inactive',widgets:[child]});page.widgets.push(panel,table);
    child.interactions=[{...event({type:'setVariable',targetId:'Seen',value:'[[This.width]]'}),event:'load'}];shape.hidden=true;
    const parent=view('parent',390),leaf=view('leaf',768,0,'parent');parent.overrides={[child.id]:{width:432},[shape.id]:{hidden:true,width:99},[table.table!.cells[0].id]:{x:999},[table.id]:{x:999,hidden:true}};page.adaptiveViews=[leaf,parent];
    const runtime=make(doc,portable,{width:800,height:0});await runtime.start();
    expect(runtime.state().variables.Seen).toBe('432');expect(runtime.widget(shape).width).toBe(99);
    expect(runtime.adaptiveWidgetOverride(table.table!.cells[0].id)).toBeUndefined();expect(runtime.adaptiveWidgetOverride(table.id)).toEqual({hidden:true});
  });
  it('resolves inherited row declarations in separate full contexts and keeps source rich formatting as the Base cache', async () => {
    const {doc,page,shape}=fixture(),list=createWidget('repeater');
    shape.text='Original';shape.richText={paragraphs:[{runs:[{text:'Original',style:{fontSize:20,color:'#123456'}}]}]};shape.style.underline=true;
    list.repeater!.template=[shape];list.repeater!.rows=[{Name:'A'},{Name:'B'}];page.widgets=[list];
    const parent=view('parent',390),child=view('child',768,0,'parent');parent.overrides[shape.id]={width:222,style:{fontSize:18,color:'#112233',strikethrough:true}};child.overrides[shape.id]={style:{fontStyle:'italic'}};page.adaptiveViews=[child,parent];
    const runtime=make(doc,portable,{width:800,height:0});await runtime.start();const [first,second]=runtime.rows(list);
    expect(runtime.widget(shape,first.context).richText!.paragraphs[0].runs[0].style).toMatchObject({fontSize:18,color:'#112233',fontStyle:'italic',underline:false,strikethrough:true});
    await runtime.execute(event({type:'setText',targetId:shape.id,value:'Row A'}),first.data,first.context);
    expect(runtime.widget(shape,first.context).text).toBe('Row A');expect(runtime.widget(shape,second.context).text).toBe('Original');
    expect(runtime.widget(shape,second.context).width).toBe(222);
    await runtime.setViewport({width:100,height:0});expect(runtime.widget(shape,runtime.rows(list)[0].context).richText!.paragraphs[0].runs[0].style).toMatchObject({fontSize:20,color:'#123456'});
  });
  it('rejects corrupted inheritance rather than returning a silently incomplete declaration', () => {
    const {doc,page,shape}=fixture();page.adaptiveViews=[view('child',390,0,'missing')];const runtime=make(doc,portable,{width:400});
    expect(()=>runtime.widget(shape)).toThrow(/does not exist/);page.adaptiveViews[0].baseViewId='child';expect(()=>runtime.widget(shape)).toThrow(/cycle/);
  });
  it('copies height policy before enqueue, preserves same view state, and selects target before Loaded', async () => {
    const {doc,page,shape}=fixture();page.adaptiveViews=[view('short',390,0),view('tall',390,500)];page.adaptiveViews[1].overrides[shape.id]={width:444};
    const destination=createPage('Destination');destination.adaptiveSelection='native-size';destination.adaptiveBaseSize={width:0,height:0};destination.adaptiveViews=[view('destination-short',390,0),view('destination-tall',390,700)];doc.pages.push(destination);
    const runtime=make(doc,portable,{width:390,height:200});await runtime.execute(event({type:'move',targetId:shape.id,x:999}));
    await runtime.setViewport({width:390,height:499.999});expect(runtime.widget(shape).x).toBe(999);
    const policy={width:390,height:800};const pending=runtime.setViewport(policy);policy.height=1;await pending;
    expect(runtime.adaptiveViewId()).toBe('tall');expect(runtime.widget(shape)).toMatchObject({x:shape.x,width:444});
    await runtime.navigate(destination.id);expect(runtime.adaptiveViewId()).toBe('destination-tall');
    for(const height of [-1,NaN,Infinity,'500'])expect(()=>runtime.setViewport({height} as RuntimeViewport)).toThrow(/height.*finite/i);
  });
  it('uses page dimensions only as missing policy fallback; clamps width but never height', () => {
    const {doc,page}=fixture();page.width=390;page.height=200;page.adaptiveViews=[view('short',390,0),view('tall',390,500)];
    expect(make(doc,portable,{}).adaptiveViewId()).toBe('short');expect(make(doc,portable,{width:900,height:800,clampToPage:true}).adaptiveViewId()).toBe('tall');
  });
  it('rolls back height/view and navigation lifecycle when inherited Item Loaded fails', async () => {
    const {doc,page}=fixture(),list=createWidget('repeater'),destination=createPage('Bad');
    page.widgets=[list];page.adaptiveViews=[view('short',390,0),view('tall',390,500)];doc.pages.push(destination);doc.variables={Armed:'no',Loads:'0',Bad:'invalid'};
    page.interactions=[{...event({type:'setVariable',targetId:'Loads',value:'[[Loads+1]]'}),event:'load'}];
    list.interactions=[{...event({type:'openPage',targetId:destination.id}),event:'itemLoad',conditions:[{source:'variable',key:'Armed',operator:'equals',value:'yes'}]}];
    const target=createWidget('box');destination.widgets=[target];destination.interactions=[{...event({type:'setSelected',targetId:target.id,value:'[[Bad]]'}),event:'load'}];
    const runtime=make(doc,portable,{width:390,height:100});await runtime.start();await runtime.execute(event({type:'setVariable',targetId:'Armed',value:'yes'}));
    await expect(runtime.setViewport({width:390,height:600})).rejects.toThrow(/selected/i);expect(runtime.state().pageId).toBe(page.id);expect(runtime.adaptiveViewId()).toBe('short');
    await runtime.execute(event({type:'setVariable',targetId:'Armed',value:'no'}));expect(runtime.state().variables.Loads).toBe('1');
    await runtime.setViewport({width:390,height:100});expect(runtime.state().variables.Loads).toBe('1');
  });
});
