import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, parseDocument, parseRichText, parseWidgetStylePatch, serializeDocument } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyRichTextStyle, formatRichTextRange, insertRichTextSoftBreak, replaceRichTextRange, richTextPlainText } from '../src/model/rich-text';
import type { RichText } from '../src/model/types';

function mixed(): RichText {
  return { paragraphs: [{ lineHeightPx: 28, runs: [
    { text: 'Under', style: { underline: true, strikethrough: false, color: '#663399' } },
    { text: 'Strike', style: { underline: false, strikethrough: true } },
  ] }, { textAlign: 'right', runs: [{ text: 'Both', style: { underline: true, strikethrough: true } }] }] };
}

describe('text decorations and inline editing model', () => {
  it('round-trips independent decorations and explicit false across rich runs, styles and view patches', () => {
    const doc = createDocument(), widget = createWidget('text');
    widget.richText = mixed(); widget.text = richTextPlainText(widget.richText);
    widget.style.underline = true; widget.style.strikethrough = false;
    widget.selectedStyle = { underline: false, strikethrough: true };
    doc.pages[0].widgets = [widget];
    doc.pages[0] = createAdaptiveView(doc.pages[0]);
    doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: { underline: false } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const old = createDocument(); expect(parseDocument(serializeDocument(old))).toEqual(old);
    expect(serializeDocument(old)).not.toContain('underline');
  });

  it.each(['true', 'false', 0, 1, null, [], {}])('rejects non-boolean decoration %j in all style carriers', value => {
    for (const key of ['underline', 'strikethrough']) {
      expect(() => parseWidgetStylePatch({ [key]: value })).toThrow();
      expect(() => parseRichText({ paragraphs: [{ runs: [{ text: 'x', style: { [key]: value } }] }] })).toThrow();
    }
  });

  it('formats the exact range and clears only the requested decoration in authoring', () => {
    const rich = mixed(), changed = formatRichTextRange(rich, 3, 13, { underline: false });
    expect(richTextPlainText(changed)).toBe(richTextPlainText(rich));
    expect(changed.paragraphs[0].runs[0]).toMatchObject({ text: 'Und', style: { underline: true, color: '#663399' } });
    expect(changed.paragraphs[0].runs[1]).toMatchObject({ text: 'er', style: { underline: false, strikethrough: false } });
    expect(changed.paragraphs[1].runs[0]).toMatchObject({ text: 'B', style: { underline: false, strikethrough: true } });
    expect(changed.paragraphs[1].runs[1]).toMatchObject({ text: 'oth', style: { underline: true, strikethrough: true } });
    expect(applyRichTextStyle(rich, { underline: undefined }).paragraphs[0].runs[0].style).not.toHaveProperty('underline');
    expect(rich.paragraphs[0].runs[0].style?.underline).toBe(true);
  });

  it('applies caret typing marks to inserted text while retaining both neighbouring styles', () => {
    const rich = mixed(), changed = replaceRichTextRange(rich, 3, 3, '你好🙂', { underline: false, strikethrough: true, fontWeight: 700 });
    expect(changed.paragraphs[0].runs).toEqual([
      { text: 'Und', style: { underline: true, strikethrough: false, color: '#663399' } },
      { text: '你好🙂', style: { underline: false, strikethrough: true, color: '#663399', fontWeight: 700 } },
      { text: 'er', style: { underline: true, strikethrough: false, color: '#663399' } },
      rich.paragraphs[0].runs[1],
    ]);
    expect(parseRichText(changed)).toEqual(changed);
  });

  it('keeps Shift+Enter within a paragraph but Enter splits paragraphs with inherited typing marks', () => {
    const rich = mixed(), soft = insertRichTextSoftBreak(rich, 2, 2, { underline: false });
    expect(soft.paragraphs).toHaveLength(2); expect(soft.paragraphs[0].lineHeightPx).toBe(28);
    expect(soft.paragraphs[0].runs[1]).toEqual({ text: '\n', style: { underline: false, strikethrough: false, color: '#663399' } });
    const hard = replaceRichTextRange(rich, 2, 2, '\n', { underline: false });
    expect(hard.paragraphs).toHaveLength(3);
    expect(richTextPlainText(soft)).toBe(richTextPlainText(hard));
    expect(parseRichText(soft)).toEqual(soft);
  });

  it('sustained typing reuses matching runs instead of exhausting the run budget per keystroke', () => {
    let rich: RichText = { paragraphs: [{ runs: [{ text: 'Start', style: { underline: true } }] }] };
    for (let i = 0; i < 1000; i++) rich = replaceRichTextRange(rich, 5 + i, 5 + i, 'a');
    expect(richTextPlainText(rich)).toBe('Start' + 'a'.repeat(1000));
    expect(rich.paragraphs[0].runs).toEqual([{ text: 'Start' + 'a'.repeat(1000), style: { underline: true } }]);
    expect(parseRichText(rich)).toEqual(rich);
  });

  it('replaces a cross-paragraph selection with a soft break without losing the suffix format', () => {
    const rich = mixed(), changed = insertRichTextSoftBreak(rich, 4, 14);
    expect(changed.paragraphs).toHaveLength(1);
    expect(richTextPlainText(changed)).toBe('Unde\nth');
    expect(changed.paragraphs[0]).toMatchObject({ lineHeightPx: 28 });
    expect(changed.paragraphs[0].runs.at(-1)).toEqual({ text: 'th', style: { underline: true, strikethrough: true } });
  });

  it('retains adaptive false resets through movement without changing shared rich content', () => {
    const doc = createDocument(), widget = createWidget('text');
    widget.richText = mixed(); widget.text = richTextPlainText(widget.richText); widget.style.underline = true;
    doc.pages[0].widgets = [widget]; let page = createAdaptiveView(doc.pages[0]);
    const view = page.adaptiveViews[0]; view.overrides[widget.id] = { style: { underline: false, strikethrough: false } };
    page = applyAdaptiveWidgetEdits(page, view.id, resolveAdaptiveWidgets(page, view.id).map(w => ({ ...w, x: w.x + 10 })));
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ underline: false, strikethrough: false });
    expect(page.widgets[0]).toEqual(widget);
  });
});
