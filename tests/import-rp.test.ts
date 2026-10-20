import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

const sourceId = 'a'.repeat(32), packageId = 'b'.repeat(32), hash = 'c'.repeat(64);
// Independent recovery-protocol fixture; no Axure code is required or executed.
function fixture() {
  return {
    status: 'partial-read-only-recovery', recoveryVersion: 1, fileSha256: hash,
    packageFailures: [], semanticFailures: [], diagrams: [{
      rootType: 'Axure:Page', packageId, name: 'Recovered page', widgets: [{
        status: 'stored-fields-recovered', id: sourceId, type: 'Axure:DiagramObject:VectorShape',
        typeCandidate: { type: 'box', evidence: 'observed unit rectangle' }, label: 'Label',
        storedGeometry: {
          location: { rawDoaName: -1073741723, determined: true, overridden: true, value: { X: -50, Y: 100 } },
          size: { rawDoaName: -1073741719, determined: true, overridden: true, value: { Width: 140, Height: 40 } },
          rotation: null, transform: null, adaptiveStyleCount: 0, isComputedLayout: false,
        },
        storedFlags: { AutoFitWidth: false, AutoFitHeight: false, 'fit-to-content': false, 'is-fixed': false, 'is-percent-width': false, IsContained: false, IsLocked: true, Disabled: true, VisibleFromSettings: false },
        text: { status: 'stored-rich-text-as-plain', text: '</script><img src=x onerror=alert(1)>\n字面文字' },
      }],
    }],
  };
}

describe('experimental read-only RP conversion', () => {
  it('preserves explicit rectangles, literal Unicode text and state flags without mutating input', () => {
    const data = fixture(), before = JSON.stringify(data);
    const { document, report } = importRpSemantics(data, 'Example');
    expect(JSON.stringify(data)).toBe(before);
    expect(document.pages[0].widgets[0]).toMatchObject({ x: -50, y: 100, width: 140, height: 40, hidden: true, disabled: true, locked: true, text: data.diagrams[0].widgets[0].text.text, interactions: [] });
    expect(report).toMatchObject({ pagesImported: 1, widgetsImported: 1, widgetsSkipped: 0, sourceSha256: hash });
    expect(document.variables).toEqual({}); expect(document.components).toEqual([]);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it('creates deterministic IDs and records appearance and behavior loss', () => {
    const a = importRpSemantics(fixture()), b = importRpSemantics(fixture());
    expect(a).toEqual(b);
    expect(a.document.pages[0].widgets[0].id).toBe(`rp-w-${packageId}-${sourceId}`);
    expect(a.report.issues.map(i => i.code)).toContain('appearance-defaults');
    expect(a.report.issues.find(i => i.sourceId === sourceId)?.message).toMatch(/交互恢复结果单独列出/);
  });

  it.each(['fit-to-content', 'is-fixed', 'is-percent-width', 'IsContained'] as const)('skips %s instead of inventing a computed rectangle', key => {
    const data = fixture(); data.diagrams[0].widgets[0].storedFlags[key] = true;
    const result = importRpSemantics(data);
    expect(result.document.pages[0].widgets).toEqual([]);
    expect(result.report.widgetsSkipped).toBe(1);
    expect(result.report.issues.some(issue => issue.code === 'no-supported-widgets')).toBe(true);
  });
  it('freezes explicit saved label bounds and reports AutoFit instead of pretending to recompute text metrics', () => {
    const data = fixture(); data.diagrams[0].widgets[0].storedFlags.AutoFitWidth = true;
    const result = importRpSemantics(data);
    expect(result.document.pages[0].widgets[0]).toMatchObject({ x: -50, y: 100, width: 140, height: 40 });
    expect(result.report.issues.find(i => i.code === 'stored-autofit-snapshot')).toMatchObject({ sourceId, details: { AutoFitWidth: true, AutoFitHeight: false } });
  });

  it('does not infer inherited, missing, zero, infinite or excessive dimensions', () => {
    const cases = [
      (d: ReturnType<typeof fixture>) => { d.diagrams[0].widgets[0].storedGeometry.location.overridden = false; },
      (d: ReturnType<typeof fixture>) => { d.diagrams[0].widgets[0].storedGeometry.size.value.Width = 0; },
      (d: ReturnType<typeof fixture>) => { d.diagrams[0].widgets[0].storedGeometry.location.value.X = Infinity; },
      (d: ReturnType<typeof fixture>) => { d.diagrams[0].widgets[0].storedGeometry.size.value.Height = 100001; },
      (d: ReturnType<typeof fixture>) => { d.diagrams[0].widgets[0].storedGeometry.adaptiveStyleCount = 1; },
    ];
    for (const mutate of cases) { const data = fixture(); mutate(data); expect(importRpSemantics(data).report.widgetsSkipped).toBe(1); }
    const data = fixture(); const json = JSON.parse(JSON.stringify(data)); delete json.diagrams[0].widgets[0].storedGeometry.location;
    expect(importRpSemantics(json).report.widgetsSkipped).toBe(1);
  });

  it('rejects unsupported type candidates, rich text, rotations and transforms with source-linked reports', () => {
    for (const [property, value] of [['typeCandidate', null], ['text', { status: 'unsupported-rich-text-inline' }], ['text', { status: 'no-observed-text-field' }]] as const) {
      const data = JSON.parse(JSON.stringify(fixture())); data.diagrams[0].widgets[0][property] = value;
      const result = importRpSemantics(data);
      expect(result.report.issues.find(i => i.severity === 'skipped')).toMatchObject({ packageId, sourceId });
    }
    for (const [key, value] of [['rotation', { value: 25 }], ['transform', { value: {} }]] as const) {
      const data = JSON.parse(JSON.stringify(fixture())); data.diagrams[0].widgets[0].storedGeometry[key] = value;
      expect(importRpSemantics(data).report.widgetsSkipped).toBe(1);
    }
  });

  it('rejects malformed identities, unknown protocol and oversized collections', () => {
    expect(() => importRpSemantics({})).toThrow(/版本/);
    expect(() => importRpSemantics({ ...fixture(), recoveryVersion: 2 })).toThrow(/版本/);
    expect(() => importRpSemantics({ ...fixture(), fileSha256: '__proto__' })).toThrow(/散列/);
    const data = fixture(); data.diagrams[0].packageId = '../escape';
    expect(() => importRpSemantics(data)).toThrow(/标识/);
    expect(() => importRpSemantics({ ...fixture(), diagrams: Array(10001).fill(null) })).toThrow(/上限/);
    expect(() => importRpSemantics({ ...fixture(), diagrams: [] })).toThrow(/没有/);
  });

  it('preserves recovery failure visibility and never treats panel states as pages', () => {
    const data = fixture(); const json = JSON.parse(JSON.stringify(data));
    json.packageFailures = [{ path: 'broken/package', reason: 'Unsupported tag' }];
    json.diagrams.push({ ...json.diagrams[0], packageId: 'd'.repeat(32), rootType: 'Axure:PanelState' });
    const result = importRpSemantics(json);
    expect(result.document.pages).toHaveLength(1);
    expect(result.report.widgetsImported).toBe(1);
    expect(result.report.issues.map(i => i.code)).toEqual(expect.arrayContaining(['source-recovery-failure', 'non-page-diagrams-omitted']));
  });

  function panelFixture() {
    const data = JSON.parse(JSON.stringify(fixture()));
    const child = structuredClone(data.diagrams[0].widgets[0]); child.id = 'e'.repeat(32);
    const panel = data.diagrams[0].widgets[0]; panel.type = 'Axure:DiagramObject:DynamicPanel'; panel.typeCandidate.type = 'panel';
    panel.text = { status: 'no-observed-text-field' };
    panel.panelStatePackages = [{ $reference: 'd'.repeat(32), referenceTag: 19, name: 'Axure:PanelState' }, { $reference: 'f'.repeat(32), referenceTag: 19, name: 'Axure:PanelState' }];
    data.diagrams.push({ packageId: 'd'.repeat(32), rootType: 'Axure:PanelState', name: 'State A', widgets: [child] });
    data.diagrams.push({ packageId: 'f'.repeat(32), rootType: 'Axure:PanelState', name: 'State B', widgets: [] });
    return data;
  }

  it('preserves explicit fixed panel bounds, ordered states and child-local rectangles', () => {
    const result = importRpSemantics(panelFixture());
    expect(result.report).toMatchObject({ widgetsImported: 1, panelStatesImported: 2, nestedWidgetsImported: 1, nestedWidgetsSkipped: 0 });
    const p = result.document.pages[0].widgets[0];
    expect(p).toMatchObject({ type: 'panel', x: -50, y: 100, width: 140, height: 40 });
    expect(p.states?.map(s => s.name)).toEqual(['State A', 'State B']);
    expect(p.activeStateId).toBe(p.states?.[0].id);
    expect(p.states?.[0].widgets[0]).toMatchObject({ x: -50, y: 100, width: 140, height: 40 });
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });

  it('reports missing and cyclic state references without fabricating state contents', () => {
    const missing = panelFixture(); missing.diagrams.pop();
    expect(importRpSemantics(missing).report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1, nestedWidgetsImported: 0 });
    const cycle = panelFixture();
    cycle.diagrams[1].widgets[0] = structuredClone(cycle.diagrams[0].widgets[0]);
    cycle.diagrams[1].widgets[0].id = 'e'.repeat(32);
    cycle.diagrams[1].widgets[0].panelStatePackages = [{ $reference: 'd'.repeat(32), referenceTag: 19, name: 'Axure:PanelState' }];
    const result = importRpSemantics(cycle);
    expect(result.report.nestedWidgetsSkipped).toBe(1);
    expect(result.document.pages[0].widgets[0].states?.[0].widgets).toEqual([]);
    expect(result.report.issues.some(i => i.message.includes('循环'))).toBe(true);
  });
  it('aborts an over-deep panel graph rather than returning misleading partial counters', () => {
    const data = panelFixture(), template = structuredClone(data.diagrams[0].widgets[0]);
    data.diagrams = [data.diagrams[0]];
    const stateId = (n: number) => n.toString(16).padStart(32, '0');
    data.diagrams[0].widgets[0].panelStatePackages = [{ $reference: stateId(1), referenceTag: 19, name: 'Axure:PanelState' }];
    for (let n = 1; n <= 14; n++) {
      const child = structuredClone(template);child.id = (100 + n).toString(16).padStart(32, '0');
      child.panelStatePackages = [{ $reference: stateId(n + 1), referenceTag: 19, name: 'Axure:PanelState' }];
      data.diagrams.push({ packageId: stateId(n), rootType: 'Axure:PanelState', name: `State ${n}`, widgets: n === 14 ? [] : [child] });
    }
    expect(() => importRpSemantics(data)).toThrow(/嵌套超过上限/);
  });

  it('rejects executable CSS and malformed radii while retaining unmapped style provenance', () => {
    const data = JSON.parse(JSON.stringify(fixture()));
    data.diagrams[0].widgets[0].styleRecovery = { style: { fill: '#10203080', fontSize: 20, cornerRadii: [1,2,3,4] }, visible: true, provenance: { fill: { kind: 'local-object-style' } }, unknown: [{ property: 'SHADOW', value: { On: true } }] };
    const r = importRpSemantics(data);
    expect(r.document.pages[0].widgets[0].style).toMatchObject({ fill: '#10203080', fontSize: 20, cornerRadii: [1,2,3,4] });
    expect(r.report.issues.find(i => i.code === 'partial-style-recovery')?.details).toEqual(data.diagrams[0].widgets[0].styleRecovery);
    for (const patch of [{ fill: 'url(https://example.invalid)' }, { cornerRadii: [1,2,3] }, { fontFamily: 'x; background:url(x)' }]) {
      data.diagrams[0].widgets[0].styleRecovery.style = patch;
      expect(importRpSemantics(data).report.widgetsSkipped).toBe(1);
    }
  });

  it('runs the official library fixed panel through parsing, state linkage and model validation', () => {
    const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
    const sample = fileURLToPath(new URL('../research/samples/Default.rplib', import.meta.url));
    const recovered = JSON.parse(execFileSync(process.execPath, [script, sample], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
    const result = importRpSemantics(recovered);
    const p = result.document.pages.find(p => p.name === 'Dynamic panel')!.widgets[0];
    expect(p).toMatchObject({ type: 'panel', x: 100, y: 100, width: 300, height: 170 });
    expect(p.states).toHaveLength(1);expect(result.report.panelStatesImported).toBe(1);
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
  });

  it.each([
    ['the-basics-tab-menu.rp', 1, 3, 0],
    ['complex-interactions-required-fields.rp', 2, 7, 0],
  ] as const)('runs our actual binary parser on %s, then validates the converted document', (name, pagesImported, widgetsImported, widgetsSkipped) => {
    const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
    const sample = fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url));
    const recovered = JSON.parse(execFileSync(process.execPath, [script, sample], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
    const result = importRpSemantics(recovered, name);
    expect(result.report).toMatchObject({ pagesImported, widgetsImported, widgetsSkipped });
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
    if (name.includes('required')) {
      expect(result.document.pages[0].widgets.find(w => w.type === 'input')).toMatchObject({ name: 'Email Field', x: 50, y: 75, width: 300, height: 25, text: '' });
      // Native P71/P81 remain independent parameters; the prior four-radius
      // snapshot was derived from ControlPoints, not four native declarations.
      const signupStyle = result.document.pages[0].widgets.find(w => w.text === 'Sign Up')?.style;
      expect(signupStyle).toMatchObject({ fill: '#169bd5', strokeWidth: 0, fontSize: 13, color: '#ffffff', radius: 5, cornerVisibility: [true,true,true,true] });
      expect(signupStyle?.cornerRadii).toBeUndefined();
      expect(result.document.pages[0].widgets.find(w => w.name === 'Error Message')).toMatchObject({ hidden: true, style: { color: '#d9001b', fontSize: 18, fontWeight: 700 } });
      expect(result.document.pages[1].widgets[0].style).toMatchObject({ fill: '#ffffff00', fontSize: 32, fontWeight: 700 });
    } else {
      expect(result.document.pages[0].widgets.slice(0,2).map(w => [w.text, w.style.fill, w.selected, w.selectedStyle, w.style.radius, w.style.cornerVisibility, w.style.cornerRadii])).toEqual([['Tab 1','#ffffff',true,{fill:'#81d3f8'},5,[true,true,false,false],undefined],['Tab 2','#ffffff',false,{fill:'#81d3f8'},5,[true,true,false,false],undefined]]);
      expect(result.document.pages[0].widgets[2]).toMatchObject({type:'panel',fitToContent:true,states:[{widgets:[{text:'Tab 1 Content',x:0,y:0}]},{widgets:[{text:'Tab 2 Content',x:0,y:0}]}]});
    }
  });

  function readOfficial(name: string) {
    const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
    const sample = fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url));
    return JSON.parse(execFileSync(process.execPath, [script, sample], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  }
  it.each([
    ['Quick Win.rp', 35, 7], ['UX Prototyping.rp', 129, 24],
  ] as const)('recovers two explicit embedded images from %s and validates real project readback', (name, widgetsImported, widgetsSkipped) => {
    const source = readOfficial(name), before = JSON.stringify(source), result = importRpSemantics(source, name);
    expect(result.report).toMatchObject({ widgetsImported, widgetsSkipped });
    const images = result.document.pages.flatMap(p => p.widgets).filter(w => w.type === 'image');
    expect(images).toHaveLength(2);
    expect(result.document.pages.flatMap(p => p.widgets).filter(w => w.rotation === 89.13596303062127)).toHaveLength(name === 'Quick Win.rp' ? 2 : 3);
    expect(images[0].imageSrc).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    expect(images[0].style.strokeWidth).toBe(0);
    expect(result.report.issues.filter(i => i.code === 'embedded-image-recovery')).toHaveLength(2);
    expect(result.report.issues.find(i => i.code === 'embedded-image-recovery')?.details).not.toHaveProperty('dataUrl');
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('rejects image URLs, SVG, invalid carriers, metadata mismatches and per-image overlimits', () => {
    const source = readOfficial('Quick Win.rp'), first = source.diagrams[0].widgets.find((w: { imageRecovery?: { status: string } }) => w.imageRecovery?.status === 'validated-embedded-png');
    const imageOnly = { ...source, diagrams: [{ ...source.diagrams[0], widgets: [first] }] };
    for (const patch of [
      { dataUrl: 'https://example.invalid/image.png' }, { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { mime: 'image/svg+xml' }, { dataUrl: 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024) },
      { sha256: 'a'.repeat(64) }, { width: 1201 }, { dataUrl: 'data:image/png;base64,@@@@' },
      { status: 'unsupported-image', reason: 'unknown crop' },
    ]) {
      const data = structuredClone(imageOnly);Object.assign(data.diagrams[0].widgets[0].imageRecovery, patch);
      const result = importRpSemantics(data);
      expect(result.report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1 });
      expect(result.document.pages[0].widgets).toEqual([]);
    }
  });
  it('aborts repeated embedded images beyond the aggregate budget without returning a partial project', () => {
    const source = readOfficial('Quick Win.rp'), first = source.diagrams[0].widgets.find((w: { imageRecovery?: { status: string } }) => w.imageRecovery?.status === 'validated-embedded-png');
    source.diagrams = [{ ...source.diagrams[0], widgets: Array.from({ length: 500 }, (_, n) => ({ ...first, id: n.toString(16).padStart(32, '0') })) }];
    expect(() => importRpSemantics(source)).toThrow(/图片累计 data URL/);
  });
});
