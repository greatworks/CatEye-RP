import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { importRpSemantics } from '../src/model/import-rp';
import type { Widget, WidgetType } from '../src/model/types';

type Data = Record<string, any>;
const combinations = [
  { autoFitWidth: false, autoFitHeight: false }, { autoFitWidth: false, autoFitHeight: true },
  { autoFitWidth: true, autoFitHeight: false }, { autoFitWidth: true, autoFitHeight: true },
];
function project(type: WidgetType = 'box') {
  const doc = createDocument(), widget = createWidget(type); doc.pages[0].widgets = [widget];
  return { doc, widget };
}
function roundtrip(widget: Widget) { const doc = createDocument(); doc.pages[0].widgets = [widget]; return parseDocument(serializeDocument(doc)); }
const native: Data = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
import fs from 'node:fs';import{createHash}from'node:crypto';import{inspectRpSemantics}from'./research/scripts/read-rp-semantics.mjs';
const file='research/samples/UX Prototyping.rp';if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!=='1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72')throw Error('Changed native UX sample');
const packages=['52bb046bb95c4e789c35be661e8286b8','cb6927343c814c6d95ba86343baca891'],owners=['e92911c9f26c49e897acf49340a5690e','4d1d194cc1c04131b76a3f6697700dd9'];
const s=inspectRpSemantics(file);delete s.pageTreeRecovery;s.diagrams=s.diagrams.filter(d=>packages.includes(d.packageId));for(const d of s.diagrams)d.widgets=d.widgets.filter(w=>owners.includes(w.id));if(s.diagrams.length!==2||s.diagrams.some(d=>d.widgets.length!==2))throw Error('Missing focused owners');process.stdout.write(JSON.stringify(s));
`], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
const nativeOwners: { packageId: string; sourceId: string }[] = native.diagrams.flatMap((page: Data) => page.widgets.map((widget: Data) => ({ packageId: page.packageId, sourceId: widget.id })));

describe('optional native shape text flags, without changing owner geometry', () => {
  it('leaves existing documents and new widget defaults unchanged', () => {
    const { doc } = project(); doc.pages[0].widgets.push(createWidget('ellipse'), createWidget('path'));
    const before = serializeDocument(doc); expect(before).not.toContain('shapeText');
    expect(parseDocument(before)).toEqual(doc); expect(serializeDocument(parseDocument(before))).toBe(before);
  });

  for (const type of ['box', 'ellipse', 'path'] as const) it.each(combinations)(`${type} roundtrips $autoFitWidth/$autoFitHeight independently of rich content and geometry`, shapeText => {
    const { doc, widget } = project(type); Object.assign(widget, { x: -12.5, y: 3.25, width: 95, height: 27, rotation: 90, shapeText: { ...shapeText } });
    widget.text = 'A\nB'; widget.richText = { expressionMode: 'literal', paragraphs: [{ runs: [{ text: 'A\nB', style: { fontSize: 28, fontFamily: 'Open Sans' } }] }] };
    const before = structuredClone(doc); expect(parseDocument(serializeDocument(doc))).toEqual(before); expect(doc).toEqual(before);
  });

  it('rejects incomplete, nonboolean, extra and unsafe keys rather than filling defaults', () => {
    const invalid = [null, false, [], 1, '', {}, { autoFitWidth: true }, { autoFitHeight: false },
      { autoFitWidth: 1, autoFitHeight: false }, { autoFitWidth: 'true', autoFitHeight: false },
      { autoFitWidth: false, autoFitHeight: null }, { autoFitWidth: false, autoFitHeight: true, overflow: 'visible' },
      JSON.parse('{"autoFitWidth":true,"autoFitHeight":true,"__proto__":{}}')];
    for (const shapeText of invalid) { const { doc, widget } = project(); Object.assign(widget, { shapeText }); expect(() => parseDocument(JSON.stringify(doc))).toThrow(/shapeText|unsafe/i); }
  });

  it('rejects flags on non-shapes, including nested table cells and native-style tree labels', () => {
    for (const type of ['text','button','image','input','textarea','select','checkbox','radio','panel','repeater','table','menu','tree','inlineFrame','line','placeholder','hotspot'] as const) {
      const { doc, widget } = project(type); Object.assign(widget, { shapeText: combinations[0] }); expect(() => parseDocument(JSON.stringify(doc)), type).toThrow('shapeText');
    }
    const table = createWidget('table'); Object.assign(table.table!.cells[0], { shapeText: combinations[0] }); expect(() => roundtrip(table)).toThrow('shapeText');
    const tree = createWidget('tree'); Object.assign(tree.tree!.nodes[0].treeNode!.label, { shapeText: combinations[2] }); expect(() => roundtrip(tree)).toThrow('shapeText');
  });

  it('does not permit shapeText through style, state, action or adaptive style patches', () => {
    for (const carrier of ['base','selected','action','adaptive']) {
      const { doc, widget } = project(), shapeText = combinations[3];
      if (carrier === 'base') Object.assign(widget.style, { shapeText });
      if (carrier === 'selected') widget.selectedStyle = { shapeText } as any;
      if (carrier === 'action') widget.interactions = [{ id: 'font-action-case', name: 'Style', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'font-action', type: 'setStyle', targetId: widget.id, style: { shapeText } as any }] }];
      if (carrier === 'adaptive') { doc.pages[0] = createAdaptiveView(doc.pages[0]); Object.assign(doc.pages[0].adaptiveViews[0].overrides, { [widget.id]: { shapeText } }); }
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('shapeText');
    }
  });

  it('deep-clones flags and propagates component content without changing independent placement or unrelated widgets', () => {
    const { widget } = project('path'); widget.shapeText = { ...combinations[3] };
    const [copy] = cloneWidgets([widget]); expect(copy.shapeText).toEqual(widget.shapeText); copy.shapeText!.autoFitWidth = false; expect(widget.shapeText.autoFitWidth).toBe(true);
    const component = createComponent([widget]), a = createComponentInstance(component, 10, 20), b = createComponentInstance(component, 500, 600), doc = createDocument();
    doc.components = [component]; doc.pages[0].widgets = [a, b, createWidget('text')]; const before = structuredClone(doc);
    a.states![0].widgets[0].shapeText = { ...combinations[0] };
    const next = applyComponentInstanceChanges(doc, a.id);
    expect(next.components[0].widgets[0].shapeText).toEqual(combinations[0]); expect(next.pages[0].widgets[1].states![0].widgets[0].shapeText).toEqual(combinations[0]);
    expect(next.pages[0].widgets[1]).toMatchObject({ x: 500, y: 600 }); expect(next.pages[0].widgets[2]).toEqual(before.pages[0].widgets[2]); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('keeps layout flags shared while adaptive geometry remains local, including explicit removal', () => {
    const { doc, widget } = project(); widget.shapeText = { ...combinations[3] }; let page = createAdaptiveView(doc.pages[0]), view = page.adaptiveViews[0].id;
    let visible = structuredClone(resolveAdaptiveWidgets(page, view)); visible[0].width = 60; visible[0].shapeText = { ...combinations[2] };
    page = applyAdaptiveWidgetEdits(page, view, visible);
    expect(page.widgets[0]).toMatchObject({ width: widget.width, shapeText: combinations[2] }); expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ width: 60 });
    doc.pages[0] = page; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    visible = structuredClone(resolveAdaptiveWidgets(page, view)); delete visible[0].shapeText; page = applyAdaptiveWidgetEdits(page, view, visible);
    expect(page.widgets[0]).not.toHaveProperty('shapeText'); expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ width: 60 });
  });
});

describe('focused genuine UX import of native shape text flags', () => {
  it.each(nativeOwners)('preserves $packageId/$sourceId flags and original geometry/font/path through save', ({ packageId, sourceId }) => {
    const source = structuredClone(native), before = JSON.stringify(source), recovered = source.diagrams.find((d: Data) => d.packageId === packageId).widgets.find((w: Data) => w.id === sourceId);
    const { document, report } = importRpSemantics(source), widget = document.pages.flatMap(page => page.widgets).find(w => w.id === `rp-w-${packageId}-${sourceId}`)!;
    expect(widget).toBeDefined(); expect(recovered.type).toBe('Axure:DiagramObject:VectorShape'); expect(recovered.storedFlags).toMatchObject({ AutoFitWidth: true, AutoFitHeight: true });
    expect(widget.shapeText).toEqual(combinations[3]);
    expect(widget).toMatchObject({ x: recovered.storedGeometry.location.value.X, y: recovered.storedGeometry.location.value.Y, width: sourceId.startsWith('e929') ? 95 : 54, height: 27, rotation: 0, style: { fontSize: 28, fontWeight: 700, fontFamily: 'Open Sans' } });
    expect(widget.vectorPath).toEqual(recovered.typeCandidate.vectorPath); expect(widget.richText).toEqual(recovered.richTextRecovery.richText);
    expect(report.issues.find(issue => issue.code === 'stored-autofit-snapshot' && issue.packageId === packageId && issue.sourceId === sourceId)?.details).toEqual({ AutoFitWidth: true, AutoFitHeight: true });
    expect(parseDocument(serializeDocument(document))).toEqual(document); expect(JSON.stringify(source)).toBe(before);
  });

  it.each(combinations)('preserves each explicit source combination $autoFitWidth/$autoFitHeight with no inference', shapeText => {
    const source = structuredClone(native), item = source.diagrams[0].widgets[0]; source.diagrams = [source.diagrams[0]]; source.diagrams[0].widgets = [item];
    item.storedFlags.AutoFitWidth = shapeText.autoFitWidth; item.storedFlags.AutoFitHeight = shapeText.autoFitHeight;
    const { document, report } = importRpSemantics(source); expect(report).toMatchObject({ widgetsImported: 1, widgetsSkipped: 0 }); expect(document.pages[0].widgets[0].shapeText).toEqual(shapeText);
    expect(document.pages[0].widgets[0]).toMatchObject({ width: item.storedGeometry.size.value.Width, height: item.storedGeometry.size.value.Height });
  });
});
