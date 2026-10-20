import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, cloneWidgets, parseDocument, parseRichText, serializeDocument } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { applyRichTextStyle, formatRichTextRange, patchWidgetTextStyle, replaceRichTextRange, replaceWidgetText, resolveRichText, richTextFromPlainText, richTextPlainText } from '../src/model/rich-text';
import type { RichText } from '../src/model/types';

const mixed = (): RichText => ({ paragraphs: [
  { textAlign: 'left', lineHeightPx: 28, runs: [{ text: 'Plain ', style: { fontFamily: 'Arial', fontSize: 22, fontWeight: 400, fontStyle: 'normal', color: '#111111' } }, { text: 'italic', style: { fontStyle: 'italic', color: '#663399' } }] },
  { runs: [{ text: '' }] },
  { textAlign: 'right', lineHeightPx: 'normal', runs: [{ text: 'Bold', style: { fontWeight: 700 } }] },
] });
function fixture() { const doc = createDocument(), widget = createWidget('text'); widget.richText = mixed(); widget.text = richTextPlainText(widget.richText); doc.pages[0].widgets = [widget]; return { doc, widget }; }
describe('structured rich text', () => {
  it('round-trips mixed runs, empty paragraphs and absolute line heights without modifying old documents', () => {
    const { doc } = fixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const old = createDocument(); expect(parseDocument(serializeDocument(old))).toEqual(old); expect(serializeDocument(old)).not.toContain('richText');
  });
  it('rejects stale text instead of silently discarding formatting', () => {
    const { doc, widget } = fixture(); widget.text += '!'; expect(() => parseDocument(JSON.stringify(doc))).toThrow('must match');
  });
  it.each(['input', 'textarea', 'select', 'repeater', 'panel', 'hotspot', 'line', 'image'] as const)('rejects unsupported %s text carriers', type => {
    const { doc, widget } = fixture(); doc.pages[0].widgets = [{ ...createWidget(type), text: widget.text, richText: widget.richText }]; expect(() => parseDocument(JSON.stringify(doc))).toThrow('rich text is not supported');
  });
  it('rejects HTML/CSS payloads, unknown style fields, invalid arrays and excessive aggregate text', () => {
    const invalid: unknown[] = [
      { paragraphs: [] }, { paragraphs: [{ runs: [] }] }, { paragraphs: [{ runs: [{ text: 'x', html: '<b>x</b>' }] }] },
      { paragraphs: [{ runs: [{ text: 'x', style: { fontFamily: 'url(https://invalid)' } }] }] },
      { paragraphs: [{ runs: [{ text: 'x', style: { fontStyle: 'oblique' } }] }] },
      { paragraphs: [{ runs: [{ text: 'x', style: { fill: 'red' } }] }] },
      { paragraphs: [{ runs: [{ text: 'x' }], lineHeightPx: 0 }] },
      { paragraphs: [{ runs: [{ text: 'x' }], lineHeightPx: '28px' }] },
      { paragraphs: [{ runs: [{ text: 'x\ry' }] }] },
      { paragraphs: [{ runs: [{ text: 'a'.repeat(60000) }, { text: 'b'.repeat(60000) }] }] },
      { ...mixed(), expressionMode: 'html' },
    ];
    for (const value of invalid) expect(() => parseRichText(value)).toThrow();
  });
  it('formats an exact selection across paragraph boundaries and retains unselected formatting', () => {
    const rich = mixed(), result = formatRichTextRange(rich, 4, 15, { fontStyle: 'normal', fontWeight: 900 });
    expect(richTextPlainText(result)).toBe(richTextPlainText(rich));
    expect(result.paragraphs[0].runs[0].text).toBe('Plai');
    expect(result.paragraphs[0].runs[2]).toMatchObject({ text: 'italic', style: { fontStyle: 'normal', fontWeight: 900, color: '#663399' } });
    expect(result.paragraphs[2].runs.at(-1)).toMatchObject({ text: 'old', style: { fontWeight: 700 } });
    expect(rich.paragraphs[0].runs[1].style?.fontStyle).toBe('italic');
  });
  it('replaces every possible cross-paragraph range with the same plain-text result while retaining suffix styles', () => {
    const rich = mixed(), text = richTextPlainText(rich);
    for (let start = 0; start <= text.length; start++) for (let end = start; end <= text.length; end++) {
      const result = replaceRichTextRange(rich, start, end, '中文\n\n🙂');
      expect(richTextPlainText(result), `${start}:${end}`).toBe(text.slice(0, start) + '中文\n\n🙂' + text.slice(end));
      expect(() => parseRichText(result)).not.toThrow();
    }
    const result = replaceRichTextRange(rich, 3, 8, 'new'); expect(result.paragraphs[0].runs.at(-1)).toMatchObject({ text: 'alic', style: { fontStyle: 'italic' } });
  });
  it('applies explicit normal even when outer base is normal and does not flatten unrelated styles', () => {
    const { widget } = fixture(); widget.style.fontStyle = 'normal';
    const result = patchWidgetTextStyle(widget, { fontStyle: 'normal' });
    expect(result.richText!.paragraphs[0].runs.map(r => r.style?.fontStyle)).toEqual(['normal', 'normal']);
    expect(result.richText!.paragraphs[0].runs[1].style?.color).toBe('#663399');
    expect(applyRichTextStyle(result.richText!, { fontStyle: undefined }).paragraphs[0].runs[1].style).not.toHaveProperty('fontStyle');
  });
  it('replaces plain text with first-run formatting while retaining paragraph geometry and literal mode', () => {
    const { widget } = fixture(); widget.richText!.expressionMode = 'literal';
    const result = replaceWidgetText(widget, '<b>safe</b>\r\n\r\n[[literal]]');
    expect(result.text).toBe('<b>safe</b>\n\n[[literal]]'); expect(result.richText?.expressionMode).toBe('literal');
    for (const p of result.richText!.paragraphs) { expect(p.lineHeightPx).toBe(28); expect(p.runs[0].style).toEqual(widget.richText!.paragraphs[0].runs[0].style); }
  });
  it('resolves expressions split across runs once with the starting style and respects literal native text', () => {
    const rich: RichText = { paragraphs: [{ runs: [{ text: 'Name [[It', style: { fontStyle: 'italic' } }, { text: 'em.Name]]!', style: { fontWeight: 700 } }] }] };
    const calls: string[] = [], result = resolveRichText(rich, token => { calls.push(token); return '[[literal]]\nSecond'; });
    expect(calls).toEqual(['[[Item.Name]]']); expect(richTextPlainText(result)).toBe('Name [[literal]]\nSecond!');
    expect(result.paragraphs[1].runs[0].style?.fontStyle).toBe('italic'); expect(result.paragraphs[1].runs.at(-1)?.style?.fontWeight).toBe(700);
    const literal = { ...rich, expressionMode: 'literal' as const }; expect(resolveRichText(literal, () => { throw Error('must not evaluate'); })).toBe(literal);
  });
  it('remaps cloned widget references across run boundaries but preserves native literal references', () => {
    const { widget } = fixture(), ref = createWidget('text');
    ref.richText = { paragraphs: [{ runs: [{ text: `[[Widget.${widget.id.slice(0, 10)}` }, { text: `${widget.id.slice(10)}.text]]` }] }] }; ref.text = richTextPlainText(ref.richText);
    const [copy, reference] = cloneWidgets([widget, ref]); expect(reference.text).toBe(`[[Widget.${copy.id}.text]]`); expect(richTextPlainText(reference.richText!)).toBe(reference.text);
    ref.richText.expressionMode = 'literal'; expect(cloneWidgets([widget, ref])[1].text).toBe(ref.text);
  });
  it('preserves explicit equal-to-base adaptive overrides through layout edits without changing run baselines', () => {
    const { doc, widget } = fixture(); widget.style.fontStyle = 'normal'; let page = createAdaptiveView(doc.pages[0]); const view = page.adaptiveViews[0];
    view.overrides[widget.id] = { style: { fontStyle: 'normal', textAlign: widget.style.textAlign } };
    const edited = resolveAdaptiveWidgets(page, view.id).map(w => ({ ...w, x: w.x + 30 })); page = applyAdaptiveWidgetEdits(page, view.id, edited);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual(view.overrides[widget.id].style);
    expect(page.widgets[0].richText).toEqual(widget.richText); expect(page.widgets[0].x).toBe(widget.x);
  });
  it('keeps rich text and projected text synchronized through component publish and instance edits', () => {
    const { widget } = fixture(); const component = createComponent([widget], 'Rich component'); const instance = createComponentInstance(component, 0, 0);
    const doc = createDocument(); doc.components = [component]; doc.pages[0].widgets = [instance];
    const child = instance.states![0].widgets[0]; Object.assign(child, replaceWidgetText(child, 'Changed\ncontent'));
    const result = applyComponentInstanceChanges(doc, instance.id);
    expect(parseDocument(serializeDocument(result))).toEqual(result);
    expect(result.components[0].widgets[0].text).toBe('Changed\ncontent');
    expect(result.components[0].widgets[0].richText!.paragraphs[0].runs[0].style?.fontSize).toBe(22);
  });
});
