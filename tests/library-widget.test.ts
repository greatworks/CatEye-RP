import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { createLibraryWidget } from '../src/model/library-widget';
import type { Document, Widget } from '../src/model/types';

const templateBytes = readFileSync('research/selection-layout-import-origin-checked.json');
const stateBytes = readFileSync('research/selection-creation-state-evidence.json');
const templates = (JSON.parse(templateBytes.toString()) as { samples: { document: Document }[] }).samples[0].document.pages.flatMap(page => page.widgets);
const states = (JSON.parse(stateBytes.toString()) as { states: { widgetType: string; derivedOverlay: Partial<Widget['style']> }[] }).states;
it('pins independent stored templates and separately resolved disabled state evidence', () => {
  expect(createHash('sha256').update(templateBytes).digest('hex')).toBe('a93dfcdf59b98296aef4df7baa96164ca6fdcfaecb1787cbf64fecbad9a55af6');
  expect(createHash('sha256').update(stateBytes).digest('hex')).toBe('f0b16f5dc1e7b2f19646c31fefb7f45f3d84d50b8c29fd308e1014305dd8a886');
});
describe.each(['checkbox', 'radio'] as const)('%s library template', type => {
  it('matches stored functional declarations with independent identity and placement', () => {
    const source = templates.find(widget => widget.type === type)!;
    const overlay = states.find(state => state.widgetType.endsWith(type === 'checkbox' ? ':Checkbox' : ':RadioButton'))!.derivedOverlay;
    const widget = createLibraryWidget(type, 47.25, -3);
    const expected = { ...source, id: widget.id, name: widget.name, notes: '', x: 47.25, y: -3, disabledStyle: overlay };
    expect(widget).toEqual(expected);
    expect(widget.id).not.toBe(source.id); expect(widget.id).not.toMatch(/^rp-/);
    expect(widget.name).toBe(type === 'checkbox' ? 'Checkbox' : 'Radio');
    expect(widget.radioGroup).toBeUndefined();
  });
  it('owns nested style, text and state data separately for every insertion', () => {
    const first = createLibraryWidget(type), second = createLibraryWidget(type);
    expect(first.id).not.toBe(second.id);
    first.style.textPadding![1] = 99;
    first.style.innerShadow!.on = true;
    first.richText!.paragraphs[0].runs[0].text = 'Changed';
    first.disabledStyle!.fill = '#ff0000';
    first.selectionText!.autoFitWidth = false;
    expect(second.style.textPadding).toEqual([0, 2, 0, 2]);
    expect(second.style.innerShadow!.on).toBe(false);
    expect(second.richText!.paragraphs[0].runs[0].text).toBe(second.text);
    expect(second.disabledStyle).toEqual({ fill: '#f0f0f0' });
    expect(second.selectionText!.autoFitWidth).toBe(true);
  });
  it('round-trips new declarations while keeping existing legacy objects unchanged', () => {
    const doc = createDocument(), legacy = createWidget(type), fresh = createLibraryWidget(type);
    doc.pages[0].widgets = [legacy, fresh];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(legacy.selectionText).toBeUndefined();
    expect(legacy.style.selectionButtonSize).toBeUndefined();
    expect(legacy.disabledStyle).toBeUndefined();
  });
});
