import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';
import type { Widget } from '../src/model/types';

const packageId = 'b'.repeat(32), sourceId = 'a'.repeat(32), styleId = 'd'.repeat(32);
const names = { mouseover: 'MouseOver', mousedown: 'MouseDown', focused: 'Focused', disabled: 'Disabled' } as const;
type State = Record<string, unknown>;
function state(sourceState: string, sourceProperties: number[], style: Record<string, unknown>): State {
  return { sourceState, sourceProperties, style, sourceStyleId: styleId, status: 'supported-state-style', provenance: { source: 'independent synthetic protocol fixture' } };
}
function fixture() {
  const states: Record<string, State> = {
    mouseover: state('MouseOver',[7],{fill:'#ffffff'}), mousedown: state('MouseDown',[7],{fill:'#11223380'}),
    focused: state('Focused',[8,15],{stroke:'#ff0000',strokeWidth:2}), disabled: state('Disabled',[6],{color:'#808080'}),
  };
  return {
    status: 'partial-read-only-recovery', recoveryVersion: 1, fileSha256: 'c'.repeat(64), packageFailures: [], semanticFailures: [],
    diagrams: [{rootType:'Axure:Page',packageId,name:'Explicit styles',widgets:[{
      status:'stored-fields-recovered',id:sourceId,type:'Axure:DiagramObject:VectorShape',typeCandidate:{type:'box'},label:'Button',
      storedGeometry:{location:{determined:true,overridden:true,value:{X:20,Y:30}},size:{determined:true,overridden:true,value:{Width:160,Height:40}},rotation:null,transform:null,adaptiveStyleCount:0,isComputedLayout:false},
      storedFlags:{AutoFitWidth:false,AutoFitHeight:false,'fit-to-content':false,'is-fixed':false,'is-percent-width':false,IsContained:false,IsLocked:false,Disabled:false,VisibleFromSettings:true},
      text:{status:'stored-plain-text',text:'Explicit reset white'},styleRecovery:{style:{fill:'#81d3f8'},visible:true},
      selectionRecovery:{status:'supported-selection',selected:true,selectionGroup:'',selectedStyle:{fill:'#81d3f8'},baseStyleRecovery:{style:{fill:'#ffffff'},visible:true}},
      interactionStyleRecovery:{status:'recovered-interaction-styles',cacheChainComplete:true,states,baseStyleRecovery:{style:{fill:'#ffffff'}},unhandledStates:[] as string[]},
    }]}],
  };
}
const object = (data: ReturnType<typeof fixture>) => data.diagrams[0].widgets[0];
const first = (data: unknown) => importRpSemantics(data).document.pages[0].widgets[0];

describe('native RP interaction appearance protocol', () => {
  it('keeps four independent explicit patches including a reset equal to base, selected state and source provenance', () => {
    const data = fixture(), before = JSON.stringify(data), result = importRpSemantics(data), widget = result.document.pages[0].widgets[0];
    expect(widget).toMatchObject({selected:true,style:{fill:'#ffffff'},selectedStyle:{fill:'#81d3f8'},mouseOverStyle:{fill:'#ffffff'},mouseDownStyle:{fill:'#11223380'},focusedStyle:{stroke:'#ff0000',strokeWidth:2},disabledStyle:{color:'#808080'}});
    expect(Object.keys(widget.mouseOverStyle!)).toEqual(['fill']);
    expect(result.report).toMatchObject({widgetsImported:1,widgetsSkipped:0});
    expect(result.report.issues.filter(i => i.code === 'interaction-style-recovery')).toHaveLength(4);
    expect(result.report.issues.find(i => i.code === 'interaction-style-recovery')).toMatchObject({sourceId,packageId,details:{state:'mouseover',recovery:{sourceStyleId:styleId,provenance:{source:'independent synthetic protocol fixture'}}}});
    expect(JSON.stringify(data)).toBe(before);
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });

  it('omits an unsupported state atomically and leaves other states and the widget available', () => {
    const data = fixture(); object(data).interactionStyleRecovery.states.mouseover = {sourceState:'MouseOver',status:'unsupported-state-style',reason:'Native shadow has no mapping'};
    const result = importRpSemantics(data), widget = result.document.pages[0].widgets[0];
    expect(widget.mouseOverStyle).toBeUndefined(); expect(widget.mouseDownStyle).toEqual({fill:'#11223380'});
    expect(result.report).toMatchObject({widgetsImported:1,widgetsSkipped:0});
    expect(result.report.issues.find(i => i.code === 'interaction-style-omitted')).toMatchObject({sourceId,packageId,details:{state:'mouseover',recovery:{reason:'Native shadow has no mapping'}}});
  });

  it.each([
    ['wrong source state', {sourceState:'Selected'}], ['zero reference',{sourceStyleId:'0'.repeat(32)}],
    ['unsafe fill',{style:{fill:'url(javascript:alert(1))'}}], ['unknown field',{style:{fill:'#ffffff',radius:5}}],
    ['unknown property',{sourceProperties:[7,72]}], ['duplicate property',{sourceProperties:[7,7]}],
    ['missing explicit property',{style:{}}], ['unexplained output',{sourceProperties:[]}],
    ['unknown state metadata',{cacheFallback:true}], ['numeric excess',{sourceProperties:[2],style:{fontSize:513}}],
    ['partial padding',{sourceProperties:[11],style:{textPadding:[1,1,1,1]}}],
    ['unsafe font',{sourceProperties:[1],style:{fontFamily:'Arial; url(x)'}}],
  ])('rechecks %s without rejecting the whole widget', (_name, mutation) => {
    const data = fixture(); Object.assign(object(data).interactionStyleRecovery.states.mouseover,mutation);
    const result = importRpSemantics(data); expect(result.document.pages[0].widgets[0].mouseOverStyle).toBeUndefined();
    expect(result.document.pages[0].widgets[0].disabledStyle).toEqual({color:'#808080'}); expect(result.report.widgetsSkipped).toBe(0);
  });

  it('does not inherit style keys from prototype objects', () => {
    const data = fixture(); object(data).interactionStyleRecovery.states.mouseover.style = Object.assign(Object.create({stroke:'#ff0000'}),{fill:'#ffffff'});
    expect(first(data).mouseOverStyle).toBeUndefined();
  });

  it('permits independently proven local colors with unresolved inheritance without replacing normal appearance', () => {
    const data = fixture(), recovery = object(data).interactionStyleRecovery;
    recovery.cacheChainComplete = false; recovery.baseStyleRecovery.style.fill = '#000000';
    recovery.states.mouseover.independentOfInheritedBase = true;
    expect(first(data).mouseOverStyle).toEqual({fill:'#ffffff'}); expect(first(data).style.fill).toBe('#ffffff');
    expect(first(data).focusedStyle).toBeUndefined();
    recovery.states.focused.independentOfInheritedBase = true;
    expect(first(data).focusedStyle).toBeUndefined(); // border width is not independent when the base visibility is unresolved.
  });

  it('retains absence and explicit empty state distinctly, and validates the complete state identity set', () => {
    const data = fixture(), recovery = object(data).interactionStyleRecovery;
    recovery.states.mouseover = {sourceState:'MouseOver',status:'no-state-style'};
    recovery.states.mousedown = state('MouseDown',[],{});
    expect(first(data).mouseOverStyle).toBeUndefined(); expect(first(data).mouseDownStyle).toEqual({});
    recovery.states.hover = recovery.states.mouseover; delete recovery.states.mouseover;
    expect(first(data).mouseDownStyle).toBeUndefined(); expect(first(data).disabledStyle).toBeUndefined();
  });

  it('keeps legacy appearance/selection constraints and missing-protocol results unchanged', () => {
    const data = fixture(); object(data).storedFlags.Disabled = true;
    // This pre-existing unsupported selection behavior keeps its initial native appearance.
    Object.assign(object(data).selectionRecovery,{status:'unsupported-selection'});
    expect(first(data)).toMatchObject({disabled:true,style:{fill:'#81d3f8'},disabledStyle:{color:'#808080'}});
    const legacy = JSON.parse(JSON.stringify(data)); delete legacy.diagrams[0].widgets[0].interactionStyleRecovery;
    const result = importRpSemantics(legacy); expect(result.report.issues.some(i => i.code.startsWith('interaction-style-'))).toBe(false);
    expect(result.report).toMatchObject({widgetsImported:1,widgetsSkipped:0}); expect(result.document.pages[0].widgets[0].style).toEqual(first(data).style);
  });

  it('keeps same source object IDs scoped to packages, and reports unsupported native states', () => {
    const data = fixture(), other = structuredClone(data.diagrams[0]); other.packageId = 'e'.repeat(32); other.widgets[0].interactionStyleRecovery.states.mouseover.style = {fill:'#000000'}; data.diagrams.push(other);
    object(data).interactionStyleRecovery.unhandledStates = ['Error','Hint'];
    const result = importRpSemantics(data); expect(result.document.pages[0].widgets[0].mouseOverStyle).toEqual({fill:'#ffffff'}); expect(result.document.pages[1].widgets[0].mouseOverStyle).toEqual({fill:'#000000'});
    expect(result.report.issues.some(i => i.code === 'interaction-style-omitted' && i.sourceId === sourceId)).toBe(true);
  });
});

describe('official sample appearance through actual reader and importer', () => {
  const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs',import.meta.url));
  const read = (name: string) => JSON.parse(execFileSync(process.execPath,[script,fileURLToPath(new URL(`../research/samples/${name}`,import.meta.url))],{encoding:'utf8',maxBuffer:20*1024*1024}));
  const all = (widgets: Widget[]): Widget[] => widgets.flatMap(widget => [widget,...(widget.states ?? []).flatMap(state => all(state.widgets)),...(widget.layer ? all(widget.layer.widgets) : [])]);
  it.each(['Prototyping Basics.rp','Prototype Starter.rp'])('recovers source-linked states from %s and preserves old import coverage', name => {
    const source = read(name), legacy = structuredClone(source);
    for (const diagram of legacy.diagrams) for (const widget of diagram.widgets) delete widget.interactionStyleRecovery;
    const result = importRpSemantics(source), old = importRpSemantics(legacy), widgets = result.document.pages.flatMap(page => all(page.widgets));
    for (const field of ['pagesImported','widgetsImported','widgetsSkipped','nestedWidgetsImported','nestedWidgetsSkipped','eventsImported','eventsSkipped','casesImported','actionsImported'] as const) expect(result.report[field]).toBe(old.report[field]);
    const actual = widgets.flatMap(w => Object.entries(names).flatMap(([name]) => {
      const field = ({mouseover:'mouseOverStyle',mousedown:'mouseDownStyle',focused:'focusedStyle',disabled:'disabledStyle'} as const)[name as keyof typeof names];
      return w[field] ? [{sourceId:w.id.slice(-32),state:name,style:w[field]}] : [];
    }));
    if (name === 'Prototyping Basics.rp') {
      // One native Layer wraps three previously admitted leaves. The newly
      // recovered Checkbox adds one ordinary widget without changing states.
      expect(result.report).toMatchObject({widgetsImported:172,widgetsSkipped:24,nestedWidgetsImported:55});
      expect(widgets.filter(w=>w.type==='layer')).toHaveLength(1);
      expect(widgets.find(w => w.id.endsWith('4f4e187b657a4108aa50438dd7d0fca8'))?.richText?.links).toHaveLength(1);
      expect(actual).toEqual([{sourceId:'6916f399031443218a91b11e4e423a30',state:'mouseover',style:{fill:'#f3f3f3'}},{sourceId:'3471e28ded924670841f3dfd061d33a0',state:'disabled',style:{fill:'#9e9e9e'}}]);
    } else expect(actual).toEqual(['a20c6e08f6a14d48a082a77db645e210','b2da27f43c2940cca3f8d99719efea6a','3b8e4964c21a49c8b94d4bf35530b219'].map(sourceId => ({sourceId,state:'mousedown',style:{fill:'#c2c2c2'}})));
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });
});
