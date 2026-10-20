import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultStyle, parseDocument, serializeDocument } from '../src/model/document';
import { importRpSemantics } from '../src/model/import-rp';

const script = fileURLToPath(new URL('../research/scripts/read-rp-semantics.mjs', import.meta.url));
const read = (name: string) => JSON.parse(execFileSync(process.execPath, [script, fileURLToPath(new URL(`../research/samples/${name}`, import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const samples = new Map(['Default.rplib', 'Quick Win.rp', 'UX Prototyping.rp'].map(name => [name, read(name)]));
type Recovery = ReturnType<typeof read>;
function single(pageName: string) {
  const source = structuredClone(samples.get('Default.rplib'));
  source.diagrams = [source.diagrams.find((page: Recovery) => page.name === pageName)];
  expect(source.diagrams[0].widgets).toHaveLength(1);
  return source;
}
const item = (source: Recovery) => source.diagrams[0].widgets[0];
function skipped(source: Recovery, message?: RegExp) {
  const result = importRpSemantics(source);
  expect(result.report).toMatchObject({ widgetsImported: 0, widgetsSkipped: 1 });
  expect(result.document.pages[0].widgets).toEqual([]);
  const issue = result.report.issues.find(issue => issue.code === 'widget-skipped');
  expect(issue).toMatchObject({ packageId: source.diagrams[0].packageId, sourceId: item(source).id, severity: 'skipped' });
  if (message) expect(issue?.message).toMatch(message);
}

describe('strict RP ellipse and textarea conversion from actual sample recovery', () => {
  it.each([
    ['Circle marker', 'ellipse', 30, 30],
    ['Ellipse', 'ellipse', 170, 170],
    ['Text area', 'textarea', 300, 170],
  ] as const)('preserves the real Default.rplib %s bounds and empty text, with honest style provenance', (name, type, width, height) => {
    const source = single(name), before = JSON.stringify(source), recovered = item(source);
    expect(recovered.typeCandidate.type).toBe(type);
    expect(recovered.storedGeometry.location.value).toEqual({ X: 100, Y: 100 });
    expect(recovered.storedGeometry.size.value).toEqual({ Width: width, Height: height });
    expect(recovered.styleRecovery.cacheChainComplete).toBe(true);
    expect(recovered.styleRecovery.style).toMatchObject({ fontFamily: 'Arial', fontSize: 13, textPadding: [2, 2, 2, 2], verticalAlign: type === 'textarea' ? 'top' : 'middle' });
    const { document, report } = importRpSemantics(source), widget = document.pages[0].widgets[0];
    expect(report).toMatchObject({ widgetsImported: 1, widgetsSkipped: 0 });
    expect(widget).toMatchObject({ type, x: 100, y: 100, width, height, text: '', hidden: false, disabled: false, locked: false });
    expect(widget.style).toEqual({ ...defaultStyle(), ...recovered.styleRecovery.style });
    expect(widget).not.toHaveProperty('inputType');
    expect(report.issues.find(issue => issue.code === 'partial-style-recovery')).toMatchObject({ sourceId: recovered.id, details: recovered.styleRecovery });
    if (type === 'ellipse') {
      expect(recovered.typeCandidate).toMatchObject({ mapping: 'native-control-points-to-svg', storedControlGeometryPreserved: true });
      expect(widget.vectorPath).toEqual(recovered.typeCandidate.vectorPath);
      expect(report.issues.find(issue => issue.code === 'vector-path-recovery')).toMatchObject({ sourceId: recovered.id, details: recovered.typeCandidate });
      expect(report.issues.find(issue => issue.code === 'omitted-empty-shape-text')).toMatchObject({ sourceId: recovered.id, details: { status: 'stored-empty-rich-text', source: 'native-omitted-empty-rich-text', text: '' } });
    }
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([
    ['Default.rplib', 11, 29, 27, 13], ['Quick Win.rp', 31, 11, 35, 7], ['UX Prototyping.rp', 98, 55, 129, 24],
  ] as const)('adds only the witnessed new objects in %s and preserves all previously accepted widgets', (name, oldImported, oldSkipped, imported, omitted) => {
    const source = structuredClone(samples.get(name));
    // Isolate the earlier shape/form boundary. Native lists now have their own
    // end-to-end import contract in import-rp-dropdown.test.ts.
    // Later select/table/menu/tree/inlineFrame recovery has independent end-to-end native audits.
    for (const page of source.diagrams) for (const widget of page.widgets) if (['select','table','menu','tree','inlineFrame'].includes(widget.typeCandidate?.type)) widget.typeCandidate = null;
    const before = JSON.stringify(source), legacyProtocol = structuredClone(source);
    // Reconstruct the previous acceptance boundary, not a substitute successful fixture.
    for (const page of legacyProtocol.diagrams) for (const widget of page.widgets) {
      if (['ellipse', 'textarea', 'path'].includes(widget.typeCandidate?.type)) widget.typeCandidate = null;
      if (widget.text?.status === 'stored-empty-rich-text') widget.text = { status: 'no-observed-text-field' };
    }
    const legacy = importRpSemantics(legacyProtocol), current = importRpSemantics(source);
    expect(legacy.report).toMatchObject({ widgetsImported: oldImported, widgetsSkipped: oldSkipped });
    expect(current.report).toMatchObject({ widgetsImported: imported, widgetsSkipped: omitted });
    expect(current.report.nestedWidgetsImported).toBe(legacy.report.nestedWidgetsImported);
    expect(current.report.nestedWidgetsSkipped).toBe(legacy.report.nestedWidgetsSkipped);
    let added = 0;
    for (const page of current.document.pages) {
      const previous = legacy.document.pages.find(p => p.id === page.id)!;
      expect(page.widgets.filter(w => previous.widgets.some(old => old.id === w.id))).toEqual(previous.widgets);
      for (const widget of page.widgets.filter(w => !previous.widgets.some(old => old.id === w.id))) {
        added++;
        const originalPage = source.diagrams.find((p: Recovery) => `rp-p-${p.packageId}` === page.id);
        const recovered = originalPage.widgets.find((w: Recovery) => `rp-w-${originalPage.packageId}-${w.id}` === widget.id);
        expect(['ellipse', 'textarea', 'path'].includes(widget.type) || (widget.type === 'box' && recovered.text.status === 'stored-empty-rich-text')).toBe(true);
        expect(widget.text).toBe('');
        expect(widget.rotation).toBe(recovered.rotationRecovery?.rotation ?? 0);
        const style = recovered.selectionRecovery?.status === 'supported-selection' ? recovered.selectionRecovery.baseStyleRecovery.style : recovered.styleRecovery.style;
        expect(widget.style).toMatchObject(style);
      }
    }
    expect(added).toBe(imported - oldImported);
    expect(parseDocument(serializeDocument(current.document))).toEqual(current.document);
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([
    ['Text area', 'Axure:DiagramObject:TextBox'], ['Text area', 'Axure:DiagramObject:Unknown'],
    ['Ellipse', 'Axure:DiagramObject:TextArea'], ['Ellipse', 'Axure:DiagramObject:ImageBox'],
  ])('rejects a %s candidate paired with native type %s', (name, sourceType) => {
    const source = single(name); item(source).type = sourceType; skipped(source, /类型候选与源类型不一致/);
  });

  it('does not promote a textarea to input or an unknown candidate type', () => {
    for (const type of ['input', 'select', 'TextArea', 'unknown']) {
      const source = single('Text area'); item(source).typeCandidate.type = type; skipped(source, /类型/);
    }
  });

  it('rejects an inputType attached to the plain textarea protocol', () => {
    for (const inputType of ['text', 'password', 'unknown', 0]) {
      const source = single('Text area'); item(source).typeCandidate.inputType = inputType; skipped(source);
    }
  });

  it('requires explicit stored-control geometry provenance for an ellipse', () => {
    for (const patch of [{ mapping: undefined }, { mapping: 'exact-path' }, { storedControlGeometryPreserved: undefined }, { storedControlGeometryPreserved: false }]) {
      const source = single('Ellipse'); Object.assign(item(source).typeCandidate, patch); skipped(source, /矢量路径映射或存储几何边界/);
    }
  });

  it.each([['Ellipse', 0], ['Box 1', 15]])('rejects a recovered %s paired with the wrong native Shape enum', (name, shape) => {
    const source = single(name as string); item(source).typeCandidate.sourceShape = shape;
    skipped(source, /原生形状标识不一致/);
  });

  it.each(['Box 1', 'Ellipse'])('requires explicit boolean AutoFit flags on %s without rejecting a known frozen snapshot', name => {
    for (const key of ['AutoFitWidth', 'AutoFitHeight']) for (const value of [undefined, null, 'false', 0]) {
      const source = single(name); item(source).storedFlags[key] = value; skipped(source, /自动尺寸状态未知/);
    }
    const source = single(name); item(source).storedFlags.AutoFitWidth = true;
    const { document, report } = importRpSemantics(source);
    expect(report).toMatchObject({ widgetsImported: 1, widgetsSkipped: 0 });
    expect(document.pages[0].widgets[0].width).toBe(item(source).storedGeometry.size.value.Width);
    expect(report.issues.find(issue => issue.code === 'stored-autofit-snapshot')).toMatchObject({ details: { AutoFitWidth: true, AutoFitHeight: false } });
  });

  it('accepts omitted empty rich text only with explicit shape provenance and rejects generic missing text', () => {
    for (const text of [
      { status: 'no-observed-text-field' },
      { status: 'stored-empty-rich-text', text: '' },
      { status: 'stored-empty-rich-text', text: 'unexpected', source: 'native-omitted-empty-rich-text' },
      { status: 'stored-empty-rich-text', text: '', source: 'unverified-default' },
    ]) {
      const source = single('Ellipse'); item(source).text = text; skipped(source);
    }
    const source = single('Text area'); item(source).text = item(single('Ellipse')).text; skipped(source);
  });

  it('normalizes textarea CRLF and CR to LF, preserves trailing lines and literal markup, and reports the change', () => {
    const source = single('Text area'), original = '第一行\r\n\r第二行\n<b>x</b> & "quote"\n';
    item(source).text.text = original;
    const { document, report } = importRpSemantics(source);
    expect(document.pages[0].widgets[0].text).toBe('第一行\n\n第二行\n<b>x</b> & "quote"\n');
    expect(item(source).text.text).toBe(original);
    expect(report.issues.find(issue => issue.code === 'textarea-line-endings')).toMatchObject({ sourceId: item(source).id, details: { text: original } });
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    item(source).text.text = 'Already LF\n';
    expect(importRpSemantics(source).report.issues.some(issue => issue.code === 'textarea-line-endings')).toBe(false);
  });

  it('rejects textarea expression delimiters and non-plain recovery without evaluating source text', () => {
    for (const value of ['[[OnLoadVariable]]', 'literal [[', 'literal ]]']) {
      const source = single('Text area'); item(source).text.text = value; skipped(source, /表达式/);
    }
    for (const status of ['stored-rich-text-as-plain', 'unsupported-plain-text', 'no-observed-text-field']) {
      const source = single('Text area'); item(source).text.status = status; skipped(source);
    }
  });

  it('maps a proven GetWidgetText condition to the retained textarea ID', () => {
    const source = read('complex-interactions-required-fields.rp'), page = source.diagrams[0];
    const password = page.widgets.find((w: Recovery) => w.label === 'Password Field');
    // Protocol-boundary composition: retain the tutorial's real condition and identity,
    // replace only its input recovery with the official library's witnessed textarea.
    Object.assign(password, item(single('Text area')), { id: password.id, label: 'Password Field' });
    password.adaptiveStyleRecovery.sourceId = password.id;
    const { document, report } = importRpSemantics(source), form = document.pages[0].widgets;
    const textarea = form.find(w => w.type === 'textarea')!, button = form.find(w => w.text === 'Sign Up')!;
    expect(textarea).toBeDefined(); expect(report.eventsSkipped).toBe(0);
    expect(button.interactions[0].conditions).toContainEqual({ source: 'widgetText', key: textarea.id, operator: 'notEquals', value: '', comparisonMode: 'axure' });
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
});
