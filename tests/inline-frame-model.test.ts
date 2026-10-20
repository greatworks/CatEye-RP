import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, cloneWidgets, parseDocument, serializeDocument, parseFrameTarget, parseLocalFramePath, uid } from '../src/model/document';
import { frameFileUrl } from '../src/model/inline-frame';
import { createAdaptiveView, applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance } from '../src/model/components';
import { deletePageNode } from '../src/model/page-tree';
import type { Action, FrameTarget, Widget } from '../src/model/types';

const frameDocument = () => { const doc = createDocument(); doc.pages[0].widgets.push(createWidget('inlineFrame')); return doc; };
const cases = (action: Action) => [{ id: uid(), name: 'Navigate frame', event: 'click' as const, enabled: true, conditions: [], conditionMode: 'all' as const, actions: [action] }];
const action = (frame: Widget): Action => ({ id: uid(), type: 'openLinkInFrame', frameScope: 'widget', targetId: frame.id, frameTarget: { kind: 'page', pageId: 'destination-page' } });

describe('inline frame document contract', () => {
  it('saves an independent, empty frame with witnessed default geometry and browser properties', () => {
    const doc = frameDocument(), frame = doc.pages[0].widgets[0];
    expect([frame.width,frame.height]).toEqual([300,170]);
    expect(frame.inlineFrame).toEqual({hideBorders:false,scrolling:'auto',preview:{kind:'none'}});
    expect(frame.text).toBe(''); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it.each<FrameTarget>([{kind:'page',pageId:'missing-page'},{kind:'url',url:'https://example.test/view?q=1#content'},{kind:'file',path:'media/example page.html'}])('retains a literal $kind destination', target => {
    const doc = frameDocument(); doc.pages[0].widgets[0].inlineFrame!.target = target;
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(parseFrameTarget(target)).toEqual(target);
  });
  it('keeps an embedded custom preview distinct from the actual URL and permits an empty custom draft', () => {
    const doc=frameDocument(), frame=doc.pages[0].widgets[0];
    frame.inlineFrame!.target={kind:'url',url:'https://example.test/content'};
    frame.inlineFrame!.preview={kind:'custom',imageSrc:'data:image/png;base64,iVBORw0KGgo='};
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    delete frame.inlineFrame!.preview.imageSrc; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it.each(['none','video','map'] as const)('does not attach custom bytes to a %s preview', kind => {
    const doc=frameDocument(); doc.pages[0].widgets[0].inlineFrame!.preview={kind,imageSrc:'data:image/png;base64,AAAA'};
    expect(()=>parseDocument(JSON.stringify(doc))).toThrow('custom frame previews');
  });
  it.each(['https://example.test/image.png','data:image/svg+xml;base64,PHN2Zz4=','data:text/html;base64,AAAA'])('rejects executable or remote author-preview images %s', imageSrc => {
    const doc=frameDocument(); doc.pages[0].widgets[0].inlineFrame!.preview={kind:'custom',imageSrc};
    expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
  });
  it('rejects structural/caption fields and frame data on other widgets', () => {
    const doc=frameDocument(), frame=doc.pages[0].widgets[0];
    frame.text='not a caption'; expect(()=>parseDocument(JSON.stringify(doc))).toThrow('no caption'); frame.text='';
    frame.states=[]; expect(()=>parseDocument(JSON.stringify(doc))).toThrow(); delete frame.states;
    frame.type='box'; expect(()=>parseDocument(JSON.stringify(doc))).toThrow('frame settings');
    frame.type='inlineFrame'; delete frame.inlineFrame; expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
  });
  it.each([{kind:'page',pageId:'page',url:'https://example.test'}, {kind:'url',url:'https://example.test',path:'file'}, {kind:'file',path:'x.html',pageId:'page'}, {kind:'html',html:'<script>'}, {kind:'page',pageId:'constructor'}])('rejects malformed or mixed destinations', target => {
    expect(()=>parseFrameTarget(target)).toThrow();
  });
  it.each(['javascript:alert(1)','data:text/html,hello','file:///C:/x.html','https://name:password@example.test/',' https://example.test/','https://example.test/[[Secret]]'])('rejects a nonliteral HTTP frame URL %s', url => {
    expect(()=>parseFrameTarget({kind:'url',url})).toThrow();
  });
  it('validates frame actions on widgets, pages and rich links, preserving dangling references', () => {
    const doc=frameDocument(), frame=doc.pages[0].widgets[0], a=action(frame);
    frame.interactions=cases(a); doc.pages[0].interactions=cases({...a,id:uid(),frameScope:'parent',targetId:undefined});
    expect(parseDocument(serializeDocument(doc))).toEqual(JSON.parse(JSON.stringify(doc)));
    a.targetId='removed-frame'; expect(()=>parseDocument(serializeDocument(doc))).not.toThrow();
    const box=createWidget('box'); doc.pages[0].widgets.push(box); a.targetId=box.id;
    expect(()=>parseDocument(JSON.stringify(doc))).toThrow('inlineFrame target');
  });
  it.each(['no-target','parent-with-target','no-destination','wrong-action','value'] as const)('rejects incomplete or contradictory action %s', kind => {
    const doc=frameDocument(), frame=doc.pages[0].widgets[0], a=action(frame); frame.interactions=cases(a);
    if(kind==='no-target') delete a.targetId;
    if(kind==='parent-with-target') a.frameScope='parent';
    if(kind==='no-destination') delete a.frameTarget;
    if(kind==='wrong-action') a.type='show';
    if(kind==='value') a.value='https://example.test';
    expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
  });
  it('remaps copied frame identities and navigation targets without remapping page identities', () => {
    const frame=createWidget('inlineFrame'); frame.inlineFrame!.target={kind:'page',pageId:frame.id};
    frame.interactions=cases({...action(frame),frameTarget:{kind:'page',pageId:frame.id}});
    const [copy]=cloneWidgets([frame]); expect(copy.id).not.toBe(frame.id);
    expect(copy.interactions[0].actions[0].targetId).toBe(copy.id);
    expect(copy.interactions[0].actions[0].frameTarget).toEqual({kind:'page',pageId:frame.id});
    expect(copy.inlineFrame!.target).toEqual(frame.inlineFrame!.target);
  });
  it('shares frame content across adaptive views while retaining local position and dimensions', () => {
    const doc=frameDocument(), frame=doc.pages[0].widgets[0], page=createAdaptiveView(doc.pages[0]), viewId=page.adaptiveViews[0].id;
    const edited=structuredClone(frame); edited.x=9; edited.width=180; edited.inlineFrame!.hideBorders=true; edited.inlineFrame!.target={kind:'page',pageId:'destination'};
    const result=applyAdaptiveWidgetEdits(page,viewId,[edited]);
    expect(result.widgets[0].x).toBe(100); expect(result.widgets[0].width).toBe(300);
    expect(result.widgets[0].inlineFrame).toEqual(edited.inlineFrame);
    expect(resolveAdaptiveWidgets(result,viewId)[0]).toEqual(edited);
    doc.pages[0]=result; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('materializes live component frames with correctly local navigation and stable page targets', () => {
    const frame=createWidget('inlineFrame'); frame.interactions=cases(action(frame));
    const component=createComponent([frame],'Frame component'), instance=createComponentInstance(component);
    const inner=instance.states![0].widgets[0];
    expect(inner.interactions[0].actions[0].targetId).toBe(inner.id);
    expect(inner.interactions[0].actions[0].frameTarget).toEqual(frame.interactions[0].actions[0].frameTarget);
    const doc=createDocument(); doc.components=[component]; doc.pages[0].widgets=[instance]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('keeps a missing page target visible to authoring after deleting the destination', () => {
    const doc=frameDocument(), target=createDocument().pages[0]; doc.pages.push(target);
    doc.pages[0].widgets[0].inlineFrame!.target={kind:'page',pageId:target.id};
    const result=deletePageNode(doc,target.id); expect(result.pages[0].widgets[0].inlineFrame!.target).toEqual({kind:'page',pageId:target.id});
    expect(parseDocument(serializeDocument(result))).toEqual(result);
  });
});

describe('literal local frame paths', () => {
  it.each(['media/demo.html','..\\help page.html','D:\\Samples\\页面.html','file:///D:/Samples/help.html#chapter'])('retains %s without reading the file', path => expect(parseLocalFramePath(path)).toBe(path));
  it.each(['', '//server/share','\\\\server\\share','file://server/share/a.html','https://example.test','javascript:alert(1)','data:text/html,a','C:relative.html','../a\n.html','[[Secret]].html'])('rejects %s', path => expect(()=>parseLocalFramePath(path)).toThrow());
  it('resolves local paths relative to the exported HTML and safely encodes literal filenames', () => {
    expect(frameFileUrl('../a b#c?.html','file:///D:/site/output/demo.html')).toBe('file:///D:/site/a%20b%23c%3F.html');
    expect(frameFileUrl('C:\\My site\\页面.html','file:///D:/demo.html')).toBe('file:///C:/My%20site/%E9%A1%B5%E9%9D%A2.html');
    expect(frameFileUrl('file:///D:/help.html#section','file:///D:/demo.html')).toBe('file:///D:/help.html#section');
  });
  it('refuses local paths from hosted preview, including absolute file URLs', () => {
    for(const path of ['x.html','C:\\x.html','file:///C:/x.html']) expect(()=>frameFileUrl(path,'https://example.test/preview')).toThrow('file-based');
  });
});
