import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

// Independent recovery-protocol fixtures. They are not native GUI/export proof.
const guid = (n: number) => n.toString(16).padStart(32, '0');
const ZERO = guid(0), BASE = '19e82109f102476f933582835c373474', AUTO = '982030d673df45868f11149ca2b8b02f';
const sha = 'a'.repeat(64), pkg = guid(100), pageSource = guid(101), widgetSource = guid(102), setId = guid(201), setSource = guid(202), docPkg = guid(200), namedId = guid(205);
const provenance = { version:[11,0,0,0], sourcePartSha256:sha };
function sourceWidget(sourceId = widgetSource): any {
  return { status:'stored-fields-recovered', id:sourceId, type:'Axure:DiagramObject:VectorShape', typeCandidate:{ type:'box' }, label:'Action',
    storedGeometry:{ location:{ determined:true, overridden:true, value:{ X:10, Y:20 } }, size:{ determined:true, overridden:true, value:{ Width:120, Height:30 } }, rotation:null, transform:null, adaptiveStyleCount:0, isComputedLayout:false },
    storedFlags:{ AutoFitWidth:false, AutoFitHeight:false, 'fit-to-content':false, 'is-fixed':false, 'is-percent-width':false, IsContained:false, IsLocked:false, Disabled:false, VisibleFromSettings:true },
    text:{ status:'stored-rich-text-as-plain', text:'Action' } };
}
function interaction(adaptiveView: unknown, nativeEventType = 16): any {
  return { status:'decoded-interaction-tree', events:[{ status:'supported-event', id:guid(400), nativeEventType, event:nativeEventType === 338 ? 'adaptiveViewChange' : nativeEventType === 320 ? 'load' : 'click', cases:[{
    id:guid(401), name:'Choose', enabled:true, isNewIfGroup:true, conditionMode:'all', conditions:[], actions:[{ sourceId:guid(402), type:'setAdaptiveView', adaptiveView }],
  }] }] };
}
function fixture(): any {
  return { status:'partial-read-only-recovery', recoveryVersion:1, fileSha256:sha, packageFailures:[], semanticFailures:[],
    documentSettingsRecovery:{ variables:{status:'supported',variables:[]}, caseSelection:{status:'supported',sourceValue:'DisplayMultipleTargetsOnly',value:'auto'} },
    diagrams:[{rootType:'Axure:Page',rootId:pageSource,sourcePartSha256:sha,packageId:pkg,name:'Page',widgets:[sourceWidget()]}],
    adaptiveRecovery:{schema:1,status:'decoded-adaptive-sets',baseViewId:BASE,diagnostics:[],sets:[{
      status:'supported-adaptive-set',packageId:docPkg,sourceId:setSource,id:setId,name:'Devices',provenance:{...provenance,documentSourceId:guid(203)},
      base:{sourceId:guid(204),id:BASE,name:'Base',width:0,height:0,cursor:1,baseViewId:BASE,baseViewName:'Base'},
      views:[{sourceId:guid(206),id:namedId,name:'Phone',width:390,height:600,cursor:1,baseViewId:BASE,baseViewName:'Base'}],
    }],pages:[{packageId:pkg,sourceId:pageSource,status:'assigned',setId,directSetSourceId:ZERO,setSourceId:setSource,setPackageId:docPkg,provenance}]},
  };
}
const result = (f: any) => importRpSemantics(f);
const widget = (r: ReturnType<typeof result>) => r.document.pages[0].widgets[0];

describe('native adaptive set import boundary', () => {
  it('preserves shared definitions, zero Base thresholds, order and hierarchy without changing canvas geometry', () => {
    const f=fixture(),set=f.adaptiveRecovery.sets[0];
    set.views.unshift({...set.views[0],id:guid(207),sourceId:guid(208),name:'Nested',width:768,baseViewId:namedId,baseViewName:'Phone'});
    const before=structuredClone(f),r=result(f);
    expect(r.document.adaptiveViewSets).toEqual([{id:`rp-avs-${setId}`,name:'Devices',baseSize:{width:0,height:0},views:[{id:`rp-av-${guid(207)}`,name:'Nested',width:768,height:600,baseViewId:`rp-av-${namedId}`},{id:`rp-av-${namedId}`,name:'Phone',width:390,height:600}]}]);
    expect(r.document.pages[0]).toMatchObject({width:1200,height:900,adaptiveViews:[],adaptiveViewSetId:`rp-avs-${setId}`});
    expect(widget(r)).toMatchObject({x:10,y:20,width:120,height:30});
    expect(r.report.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'adaptive-device-shell-unmapped',details:expect.objectContaining({base:expect.objectContaining({cursor:1})})}),expect.objectContaining({code:'adaptive-page-canvas-fallback'})]));
    expect(f).toEqual(before);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('retains positive native Base dimensions as selection metadata, not invented Page dimensions',()=>{
    const f=fixture();Object.assign(f.adaptiveRecovery.sets[0].base,{width:1366,height:1000});const r=result(f);
    expect(r.document.adaptiveViewSets![0].baseSize).toEqual({width:1366,height:1000});expect(r.document.pages[0].width).toBe(1200);
  });
  it('assigns one complete project set to two pages without copying definitions',()=>{
    const f=fixture();f.diagrams.push({...f.diagrams[0],packageId:guid(110),rootId:guid(111),name:'Second',widgets:[]});f.adaptiveRecovery.pages.push({...f.adaptiveRecovery.pages[0],packageId:guid(110),sourceId:guid(111)});
    const r=result(f);expect(r.document.adaptiveViewSets).toHaveLength(1);expect(r.document.pages.map(p=>p.adaptiveViewSetId)).toEqual([`rp-avs-${setId}`,`rp-avs-${setId}`]);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('does not invent a set from unassigned/orphan/missing recovery records',()=>{
    for(const mode of ['missing','unassigned','orphan']){const f=fixture();if(mode==='missing')delete f.adaptiveRecovery;else if(mode==='unassigned'){Object.assign(f.adaptiveRecovery.pages[0],{status:'unassigned',setId:ZERO});delete f.adaptiveRecovery.pages[0].setSourceId;delete f.adaptiveRecovery.pages[0].setPackageId;}else{Object.assign(f.adaptiveRecovery.pages[0],{status:'unsupported-assignment',setId:guid(999),reason:'Unresolved'});delete f.adaptiveRecovery.pages[0].setSourceId;delete f.adaptiveRecovery.pages[0].setPackageId;}
      expect(result(f).document.pages[0].adaptiveViewSetId).toBeUndefined();}
  });
  for(const [name,mutate] of [
    ['unknown protocol field',(f:any)=>{f.adaptiveRecovery.surprise=true;}],['wrong schema',(f:any)=>{f.adaptiveRecovery.schema=2;}],
    ['wrong Base sentinel',(f:any)=>{f.adaptiveRecovery.sets[0].base.id=ZERO;}],['invalid cursor',(f:any)=>{f.adaptiveRecovery.sets[0].views[0].cursor=2;}],
    ['negative size',(f:any)=>{f.adaptiveRecovery.sets[0].base.width=-1;}],['nonfinite size',(f:any)=>{f.adaptiveRecovery.sets[0].views[0].height=Infinity;}],
    ['missing name',(f:any)=>{delete f.adaptiveRecovery.sets[0].views[0].name;}],['unknown view field',(f:any)=>{f.adaptiveRecovery.sets[0].views[0].Condition=2;}],
    ['missing parent',(f:any)=>{f.adaptiveRecovery.sets[0].views[0].baseViewId=guid(999);}],['cycle',(f:any)=>{f.adaptiveRecovery.sets[0].views[0].baseViewId=namedId;}],
    ['unsupported version',(f:any)=>{f.adaptiveRecovery.sets[0].provenance.version=[11,0,1,0];}],['bad package hash',(f:any)=>{f.adaptiveRecovery.sets[0].provenance.sourcePartSha256='bad';}],
    ['duplicate set',(f:any)=>{f.adaptiveRecovery.sets.push(structuredClone(f.adaptiveRecovery.sets[0]));}],['duplicate named identity',(f:any)=>{f.adaptiveRecovery.sets[0].views.push({...f.adaptiveRecovery.sets[0].views[0],sourceId:guid(900)});}],
  ] as const)it(`rejects ${name} without losing the ordinary page`,()=>{const f=fixture();mutate(f);const r=result(f);expect(r.document.adaptiveViewSets??[]).toEqual([]);expect(r.document.pages[0].adaptiveViewSetId).toBeUndefined();expect(widget(r)).toBeDefined();expect(r.report.issues.some(i=>i.code.startsWith('adaptive-')&&i.code.includes('omitted'))).toBe(true);});
  it('validates page source identity, assignment provenance and native set linkage again',()=>{
    for(const [key,value] of [['sourceId',guid(999)],['setSourceId',setId],['setPackageId',pkg],['setId',guid(999)],['provenance',{...provenance,sourcePartSha256:'b'.repeat(64)}],['extra',true]]){const f=fixture();f.adaptiveRecovery.pages[0][key as string]=value;expect(result(f).document.pages[0].adaptiveViewSetId).toBeUndefined();}
  });
});

describe('native adaptive action and event binding',()=>{
  for(const [name,target,expected] of [['Auto',{kind:'auto'},{kind:'auto'}],['Base',{kind:'base'},{kind:'base'}],['named',{kind:'nativeGuid',guid:namedId},{kind:'view',viewId:`rp-av-${namedId}`}]] as const)it(`imports ${name} targets and Page event338 with deterministic identities`,()=>{
    const f=fixture();f.diagrams[0].widgets[0].interactionRecovery=interaction(target);f.diagrams[0].interactionRecovery=interaction(target,338);
    const r=result(f);expect(widget(r).interactions[0].actions[0]).toMatchObject({type:'setAdaptiveView',adaptiveView:expected});expect(r.document.pages[0].interactions[0]).toMatchObject({event:'adaptiveViewChange',actions:[expect.objectContaining({adaptiveView:expected})]});expect(r.report).toMatchObject({eventsImported:2,actionsImported:2,eventsSkipped:0});expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('rejects unknown/zero/Auto-sentinel named targets as entire events, retaining independent Loaded',()=>{
    for(const targetGuid of [ZERO,AUTO,'f'.repeat(32)]){const f=fixture();const bad=interaction({kind:'nativeGuid',guid:targetGuid});bad.events[0].cases[0].actions.unshift({sourceId:guid(405),type:'show',targetSourceId:widgetSource});f.diagrams[0].widgets[0].interactionRecovery=bad;f.diagrams[0].interactionRecovery=interaction({kind:'base'},320);const r=result(f);expect(widget(r).interactions).toEqual([]);expect(r.document.pages[0].interactions).toHaveLength(1);expect(r.report.eventsSkipped).toBe(1);}
  });
  it('rejects fabricated product view targets, malformed native payloads and event338 on widgets',()=>{
    for(const target of [{kind:'view',viewId:`rp-av-${namedId}`},{kind:'auto',guid:namedId},{kind:'nativeGuid',guid:namedId,extra:true},{kind:'nativeGuid',guid:namedId.toUpperCase()},null]){const f=fixture();f.diagrams[0].widgets[0].interactionRecovery=interaction(target);expect(widget(result(f)).interactions).toEqual([]);}
    const f=fixture();f.diagrams[0].widgets[0].interactionRecovery=interaction({kind:'base'},338);expect(widget(result(f)).interactions).toEqual([]);
  });
  it('binds actions in nested PanelState packages to the owning Page set',()=>{
    const f=fixture(),statePkg=guid(500),panel=f.diagrams[0].widgets[0];Object.assign(panel,{type:'Axure:DiagramObject:DynamicPanel',typeCandidate:{type:'panel'},text:{status:'no-observed-text-field'},panelStatePackages:[{$reference:statePkg,referenceTag:19,name:'Axure:PanelState'}]});
    const child=sourceWidget(guid(501));child.interactionRecovery=interaction({kind:'nativeGuid',guid:namedId});f.diagrams.push({rootType:'Axure:PanelState',rootId:guid(502),sourcePartSha256:sha,packageId:statePkg,name:'State',widgets:[child]});
    const r=result(f);expect(widget(r).states![0].widgets[0].interactions[0].actions[0].adaptiveView).toEqual({kind:'view',viewId:`rp-av-${namedId}`});
    const other={...f.diagrams[0],packageId:guid(510),rootId:guid(511),widgets:[structuredClone(panel)]};f.diagrams.push(other);expect(result(f).document.pages.flatMap(p=>p.widgets.flatMap(w=>w.states?.flatMap(s=>s.widgets)??[])).every(w=>w.interactions.length===0)).toBe(true);
  });
});

const rawMap = (pairs: [string,unknown][]) => ({$map:pairs});
const rawProp = (key: number,value:unknown,flags=0xc0000000) => ({rawDoaName:key|flags,value});
const rawSolid = (color: number) => rawMap([['fill-type','solid'],['fill-color',color]]);
function local(f:any,patch:unknown,properties:unknown[],viewId=namedId) {
  const widget=f.diagrams[0].widgets[0];widget.storedGeometry.adaptiveStyleCount=2;
  widget.adaptiveStyleRecovery={schema:1,status:'decoded-adaptive-styles',sourceId:widget.id,entries:[{viewId,styleId:guid(700),status:'supported-local-adaptive-style',patch,source:{kind:'native-local-adaptive-style',packageVersion:[11,0,0,0],properties,stateStyleSources:[]}}]};
  return widget.adaptiveStyleRecovery.entries[0];
}
describe('local native adaptive declarations',()=>{
  it('imports only eligible geometry/paint/visibility, preserving zero, false and an inactive view map',()=>{
    const f=fixture(),patch={x:0,y:-2,width:80,height:25,hidden:true,style:{fill:'#ff0000',opacity:0,underline:false,fontSize:24,textPadding:[2,3,4,1]}};
    local(f,patch,[rawProp(101,rawMap([['X',0],['Y',-2]])),rawProp(105,rawMap([['Width',80],['Height',25]])),rawProp(110,false),rawProp(7,rawSolid(-65536)),rawProp(70,0),rawProp(5,false),rawProp(2,18),...[11,12,13,14].map((key,i)=>rawProp(key,i+1))],guid(999));
    const before=structuredClone(f),r=result(f);expect(r.report.widgetsSkipped).toBe(0);expect(r.document.pages[0].adaptiveOverrides).toEqual({[`rp-av-${guid(999)}`]:{[widget(r).id]:patch}});expect(r.document.adaptiveViewSets![0].views).toHaveLength(1);expect(f).toEqual(before);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('keeps ordinary empty patches separate from eligible empty P21 barriers',()=>{
    const f=fixture();local(f,{},[rawProp(7,rawSolid(-65536),0x80000000),rawProp(105,rawMap([['Width',8],['Height',3]]),0x40000000),rawProp(9999,17,0)]);
    let r=result(f);expect(r.document.pages[0].adaptiveOverrides).toEqual({[`rp-av-${namedId}`]:{[widget(r).id]:{}}});
    local(f,{stateStyles:{}},[rawProp(21,rawMap([]))]);r=result(f);expect(r.document.pages[0].adaptiveOverrides![`rp-av-${namedId}`][widget(r).id]).toEqual({stateStyles:{}});
  });
  it('retains empty state targets, omits zero refs and verifies independent state source paint',()=>{
    const f=fixture(),selected=guid(710),hover=guid(711),entry=local(f,{stateStyles:{selected:{},mouseOver:{fill:'#ff0000'}}},[rawProp(21,rawMap([['Selected',{$reference:selected,referenceTag:3}],['MouseOver',{$reference:hover,referenceTag:3}],['Disabled',{$reference:ZERO,referenceTag:3}]]))]);
    entry.source.stateStyleSources=[{state:'selected',sourceId:selected,properties:[]},{state:'mouseOver',sourceId:hover,properties:[rawProp(7,rawSolid(-65536))]}];
    const r=result(f);expect(r.document.pages[0].adaptiveOverrides![`rp-av-${namedId}`][widget(r).id]).toEqual(entry.patch);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
  it('preserves atomic gradients/shadows/line ends by recomputing their native value carriers',()=>{
    const f=fixture(),gradient=rawMap([['fill-type','linear-gradient'],['fill-center-point',rawMap([['X',0],['Y',0]])],['fill-axis1',rawMap([['X',1],['Y',1]])],['fill-angle',37],['fill-offsets',[0,.5,.5,1]],['fill-colors',[-65536,-16711936,-16776961,-16777216]]]);
    const patch={style:{strokeGradient:{type:'linear',start:{x:0,y:0},end:{x:1,y:1},stops:[{offset:0,color:'#ff0000'},{offset:.5,color:'#00ff00'},{offset:.5,color:'#0000ff'},{offset:1,color:'#000000'}]},outerShadow:{on:false,offsetX:1,offsetY:2,blurRadius:3,color:'#000000'},lineEnds:{start:'filled-triangle',end:'none'}}};
    local(f,patch,[rawProp(8,gradient),rawProp(72,rawMap([['On',false],['OffsetX',1],['OffsetY',2],['BlurRadius',3],['Color',-16777216],['Spread',0]])),rawProp(17,rawMap([['Start',3],['End',1]]))]);
    const r=result(f);expect(r.document.pages[0].adaptiveOverrides![`rp-av-${namedId}`][widget(r).id]).toEqual(patch);
  });
  for(const [name,mutate] of [
    ['no protocol',(f:any)=>{delete f.diagrams[0].widgets[0].adaptiveStyleRecovery;}],
    ['wrong source',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.sourceId=guid(999);}],
    ['unknown protocol',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.extra=1;}],
    ['wrong count',(f:any)=>{f.diagrams[0].widgets[0].storedGeometry.adaptiveStyleCount=4;}],
    ['base view key',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].viewId=BASE;}],
    ['missing style target',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].styleId=ZERO;}],
    ['forged projection',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].patch.style.fill='#0000ff';}],
    ['snapshot promoted',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.properties[0].rawDoaName=7|0x80000000;}],
    ['duplicate property',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.properties.push(rawProp(7,rawSolid(-1)));}],
    ['unsupported active property',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.properties.push(rawProp(111,true));}],
    ['unproven rotation',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.properties.push(rawProp(50,0));}],
    ['partial padding',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.properties.push(rawProp(11,0));}],
    ['unsupported version',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.packageVersion=[12,0,0,0];}],
    ['injected state',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].patch.stateStyles={};}],
    ['extra state source',(f:any)=>{f.diagrams[0].widgets[0].adaptiveStyleRecovery.entries[0].source.stateStyleSources=[{state:'selected',sourceId:guid(900),properties:[]}];}],
  ] as const)it(`local import rejects ${name} atomically`,()=>{const f=fixture();local(f,{style:{fill:'#ff0000'}},[rawProp(7,rawSolid(-65536))]);mutate(f);const r=result(f);expect(r.document.pages[0].widgets).toEqual([]);expect(r.document.pages[0].adaptiveOverrides).toBeUndefined();expect(r.report.widgetsSkipped).toBe(1);});
  it('keeps only admitted owner IDs when another native candidate is rejected',()=>{
    const f=fixture(),broken=sourceWidget(guid(720));broken.typeCandidate=null;f.diagrams[0].widgets.push(broken);local(f,{},[]);
    const r=result(f),keys=Object.values(r.document.pages[0].adaptiveOverrides??{}).flatMap(m=>Object.keys(m));expect(keys).toEqual([widget(r).id]);expect(r.report.widgetsSkipped).toBe(1);expect(parseDocument(serializeDocument(r.document))).toEqual(r.document);
  });
});

describe('adaptive reader diagnostics stay inert',()=>{
  it('accepts the real standalone-value-parts counter without discarding assignments',()=>{
    const f=fixture();f.adaptiveRecovery.diagnostics=[{scope:'package',code:'standalone-value-parts',reason:'Skipped non-object value parts',count:3}];
    const r=result(f);expect(r.document.pages[0].adaptiveViewSetId).toBe(`rp-avs-${setId}`);expect(r.report.issues.some(i=>i.code==='adaptive-recovery-omitted')).toBe(false);
    expect(r.report.issues.find(i=>i.code==='adaptive-source-diagnostics')?.details).toEqual(f.adaptiveRecovery.diagnostics);
  });
  it.each([-1,1.5,Infinity,'3'])('rejects malformed diagnostic count %s',count=>{
    const f=fixture();f.adaptiveRecovery.diagnostics=[{scope:'package',code:'standalone-value-parts',reason:'Skipped non-object value parts',count}];
    const r=result(f);expect(r.document.pages[0].adaptiveViewSetId).toBeUndefined();expect(r.report.issues.some(i=>i.code==='adaptive-recovery-omitted')).toBe(true);
  });
});
