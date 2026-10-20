import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDocument, serializeDocument } from '../src/model/document';
import { importRpSemantics } from '../src/model/import-rp';
import { vectorPathData } from '../src/model/vector';
import type { Widget } from '../src/model/types';

const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
const read = (name: string) => JSON.parse(execFileSync(process.execPath, [script, fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url))], { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 }));
const sources = new Map(['Default.rplib', 'Flow.rplib', 'Prototype Starter.rp'].map(name => [name, read(name)]));
const walk = (widgets: Widget[]): Widget[] => widgets.flatMap(w => [w, ...walk((w.states ?? []).flatMap(s => s.widgets)), ...walk(w.layer?.widgets ?? [])]);
const single = () => { const source = structuredClone(sources.get('Default.rplib')); source.diagrams = [source.diagrams.find((d: { name: string }) => d.name === 'Placeholder')]; return source; };
const flowInactiveViews = ['301a102265704a1ba43362cd46da1b72', '72fc7bbc6b7d473a97b018b97e0dedf4', '474c9046534549a6be43b10e8734f6a5'];

describe('stored native vector path import', () => {
  it.each([
    // Starter's 12 native Layer nodes reclassify existing leaves as nested.
    ['Default.rplib', 34, 6, 25], ['Flow.rplib', 30, 7, 0], ['Prototype Starter.rp', 46, 18, 52],
  ] as const)('retains exact recovered commands through document persistence for %s', (name, widgetsImported, widgetsSkipped, nestedWidgetsImported) => {
    const source = sources.get(name), before = JSON.stringify(source), { document, report } = importRpSemantics(source);
    expect(report).toMatchObject({ widgetsImported, widgetsSkipped, nestedWidgetsImported });
    const widgets = walk(document.pages.flatMap(page => page.widgets));
    for (const widget of widgets.filter(w => w.vectorPath)) {
      const native = source.diagrams.flatMap((d: any) => d.widgets.map((w: any) => ({ key: `rp-w-${d.packageId}-${w.id}`, value: w }))).find((w: any) => w.key === widget.id).value;
      expect(widget.vectorPath).toEqual(native.typeCandidate.vectorPath);
      expect(widget.rotation).toBe(native.rotationRecovery?.rotation ?? 0);
      expect(report.issues.find(i => i.sourceId === native.id && i.packageId === widget.id.slice(5, 37) && i.code === 'vector-path-recovery')).toBeDefined();
    }
    expect(widgets.filter(w => w.type === 'path').length).toBeGreaterThan(0);
    if (name === 'Flow.rplib') {
      const addedPages = document.pages.filter(page => page.adaptiveOverrides);
      expect(addedPages.map(page => page.name)).toEqual(['Delay', 'Document', 'Manual input', 'Stored data', 'Offline storage', 'Sort', 'Magnetic tape', 'Punched tape', 'Keying']);
      expect(document.adaptiveViewSets).toHaveLength(1);
      expect(document.adaptiveViewSets![0].views).toEqual([]);
      for (const page of addedPages) {
        expect(page.widgets).toHaveLength(1);
        expect(page.adaptiveViews).toEqual([]);
        expect(page.adaptiveViewSetId).toBeUndefined();
        const native = source.diagrams.find((d: any) => `rp-p-${d.packageId}` === page.id).widgets[0];
        expect(page.widgets[0].id).toBe(`rp-w-${page.id.slice(5)}-${native.id}`);
        expect(native.storedGeometry.adaptiveStyleCount).toBe(6);
        expect(native.adaptiveStyleRecovery.entries.map((entry: any) => ({ viewId: entry.viewId, patch: entry.patch, properties: entry.source.properties, stateSources: entry.source.stateStyleSources }))).toEqual(flowInactiveViews.map(viewId => ({ viewId, patch: {}, properties: [], stateSources: [] })));
        expect(page.adaptiveOverrides).toEqual(Object.fromEntries(flowInactiveViews.map(id => [`rp-av-${id}`, { [page.widgets[0].id]: {} }])));
      }
      expect(addedPages.reduce((count, page) => count + Object.values(page.adaptiveOverrides!).reduce((n, map) => n + Object.keys(map).length, 0), 0)).toBe(27);
    }
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('preserves closed and open contours together, without drawing a closing stroke on diagonals', () => {
    const { document } = importRpSemantics(single()), widget = document.pages[0].widgets[0];
    expect(widget.type).toBe('path');
    expect(widget.vectorPath?.fillRule).toBe('nonzero');
    expect(widget.vectorPath?.commands.filter(c => c.op === 'M')).toHaveLength(3);
    expect(widget.vectorPath?.commands.filter(c => c.op === 'Z')).toHaveLength(1);
    expect(widget.vectorPath?.commands.at(-1)?.op).toBe('L');
  });

  it('retains actual Flow Delay single-handle geometry and its three inactive empty adaptive declarations', () => {
    const source = sources.get('Flow.rplib'), { document, report } = importRpSemantics(source);
    const native = source.diagrams.find((d: any) => d.packageId === 'a54b78fa63b74288806a69616ceff901').widgets[0];
    const page = document.pages.find(p => p.name === 'Delay')!;
    expect(page.widgets).toHaveLength(1);
    const widget = page.widgets[0];
    expect(widget).toMatchObject({ id: 'rp-w-a54b78fa63b74288806a69616ceff901-faf5956c4dad4ea5aa21fe383b24a645', type: 'path', x: 100, y: 100, width: 100, height: 59.80392156862745, rotation: 0 });
    expect(widget.vectorPath).toEqual(native.typeCandidate.vectorPath);
    expect(page.adaptiveOverrides).toEqual(Object.fromEntries(flowInactiveViews.map(id => [`rp-av-${id}`, { [widget.id]: {} }])));
    expect(page.adaptiveViewSetId).toBeUndefined(); expect(page.adaptiveViews).toEqual([]);
    expect(report.issues.some(i => i.sourceId === native.id && i.code === 'widget-skipped')).toBe(false);
    const path = native.typeCandidate.vectorPath, curves = path.commands.filter((c: any) => c.op === 'C');
    expect(curves).toHaveLength(2);
    expect(curves[0]).toMatchObject({ x1: .53921568627451, y1: .9844771241830065 });
    expect(curves[1].x2).toBe(curves[1].x); expect(curves[1].y2).toBe(curves[1].y);
    expect(curves.some((c: any) => c.y1 > 1 || c.y2 > 1)).toBe(true);
    expect(curves.some((c: any) => c.y1 < 0 || c.y2 < 0)).toBe(true);
    const before = structuredClone(path), first = vectorPathData(path, 100, 60);
    expect(vectorPathData(path, 200, 180)).not.toBe(first);
    expect(path).toEqual(before);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it('imports actual Shape=300 compound geometry from a nested panel state', () => {
    const { document } = importRpSemantics(sources.get('Prototype Starter.rp'));
    const widget = walk(document.pages.flatMap(page => page.widgets)).find(w => w.id === 'rp-w-90fd4ed4c9744465add63a878e1da5f1-9400519e576846fba77e7f7b43374366')!;
    expect(widget).toBeDefined();
    expect(widget.vectorPath?.commands.filter(c => c.op === 'M')).toHaveLength(2);
    expect(widget.vectorPath?.commands.filter(c => c.op === 'Z')).toHaveLength(2);
  });

  it.each(['missing', 'unknown-op', 'unknown-field', 'nonfinite', 'bad-fill', 'no-segment', 'bad-map', 'no-provenance', 'native-type'] as const)('rejects %s vector data as one widget without altering the input', mutation => {
    const source = single(), candidate = source.diagrams[0].widgets[0].typeCandidate;
    if (mutation === 'missing') delete candidate.vectorPath;
    if (mutation === 'unknown-op') candidate.vectorPath.commands[1].op = 'A';
    if (mutation === 'unknown-field') candidate.vectorPath.commands[0].onclick = 'execute';
    if (mutation === 'nonfinite') candidate.vectorPath.commands[0].x = Infinity;
    if (mutation === 'bad-fill') candidate.vectorPath.fillRule = 'evenodd';
    if (mutation === 'no-segment') candidate.vectorPath.commands = [{ op: 'M', x: 0, y: 0 }];
    if (mutation === 'bad-map') candidate.mapping = 'guessed';
    if (mutation === 'no-provenance') delete candidate.storedControlGeometryPreserved;
    if (mutation === 'native-type') source.diagrams[0].widgets[0].type = 'Axure:DiagramObject:ImageBox';
    const before = structuredClone(source), { document, report } = importRpSemantics(source);
    expect(report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1 });
    expect(document.pages[0].widgets).toEqual([]);
    expect(source).toEqual(before);
  });
});
