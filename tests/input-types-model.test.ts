import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Inspector } from '../src/components/Inspector';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, parseDocument, resolveInteractionStyle, resolveSelectedStyle, serializeDocument } from '../src/model/document';
import { INPUT_TYPES, type InputType, type Widget, type WidgetType } from '../src/model/types';

const supported: InputType[] = ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'file', 'date', 'month', 'time'];
const authoredText = 'Keep this text\n无效数字 / 2026-99-99 😺';
function fixture(inputType?: InputType) {
  const doc = createDocument(), input = createWidget('input'); input.text = authoredText;
  if (inputType !== undefined) input.inputType = inputType;
  doc.pages[0].widgets = [input]; return { doc, input };
}
const config = { readOnly: true, maxLength: 0, submitButtonId: 'button-not-yet-created', hintText: 'Preserved hint', hintHideOn: 'focus' as const, hintStyle: { color: '#fedcba' } };

describe('supported text-field input types', () => {
  it('shares exactly the eleven supported HTML input values, with Phone represented as tel', () => {
    expect(INPUT_TYPES).toEqual(supported); expect(new Set(INPUT_TYPES).size).toBe(11);
  });

  it('keeps old inputType omission and explicit text/password unchanged', () => {
    for (const type of [undefined, 'text', 'password'] as const) {
      const { doc } = fixture(type); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      if (type === undefined) expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0]).not.toHaveProperty('inputType');
    }
  });

  it.each(supported)('round-trips %s without normalizing incompatible authored text or removing shared form settings', inputType => {
    const { doc, input } = fixture(inputType); Object.assign(input, config);
    const saved = parseDocument(serializeDocument(doc)); expect(saved).toEqual(doc);
    expect(saved.pages[0].widgets[0].text).toBe(authoredText); expect(saved.pages[0].widgets[0]).toMatchObject(config);
  });

  it('rejects unknown types, native enum values outside the supported chooser, and non-string values', () => {
    for (const type of ['phone', 'Text', 'FILE', 'datetime', 'datetime-local', 'week', 'color', 'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'hidden', 'image', '', ' text ', null, 12, false, {}, []]) {
      const { doc, input } = fixture(); Object.assign(input, { inputType: type });
      expect(() => parseDocument(JSON.stringify(doc)), String(type)).toThrow('inputType');
    }
  });

  it('rejects an inputType field on every non-input widget, including textarea and other native form controls', () => {
    const others: WidgetType[] = ['box', 'ellipse', 'path', 'text', 'button', 'image', 'placeholder', 'line', 'textarea', 'checkbox', 'radio', 'select', 'hotspot', 'panel', 'repeater'];
    for (const type of others) {
      const doc = createDocument(); doc.pages[0].widgets = [{ ...createWidget(type), inputType: 'email' }];
      expect(() => parseDocument(JSON.stringify(doc)), type).toThrow('inputType is only supported on input widgets');
    }
  });

  it('does not relax readOnly or maximum length validation for File and numeric/temporal types', () => {
    for (const type of ['file', 'number', 'date', 'month', 'time'] as const) {
      for (const patch of [{ maxLength: -1 }, { maxLength: 1.5 }, { maxLength: 2147483648 }, { readOnly: 'true' }]) {
        const { doc, input } = fixture(type); Object.assign(input, patch); expect(() => parseDocument(JSON.stringify(doc))).toThrow();
      }
    }
  });

  it('clones all input types and their stored settings independently, including File text and ignored hint', () => {
    const widgets = supported.map(inputType => { const input = createWidget('input'); Object.assign(input, { inputType, text: authoredText, ...structuredClone(config) }); return input; });
    const clones = cloneWidgets(widgets, 0);
    for (let index = 0; index < widgets.length; index++) {
      expect(clones[index]).toEqual({ ...widgets[index], id: clones[index].id }); expect(clones[index].id).not.toBe(widgets[index].id);
      clones[index].hintStyle!.color = '#abcdef'; expect(widgets[index].hintStyle!.color).toBe('#fedcba');
    }
  });

  it('propagates type-only component edits without clearing text or hint settings and can switch back', () => {
    const { input } = fixture('email'); Object.assign(input, config);
    const component = createComponent([input]), a = createComponentInstance(component), b = createComponentInstance(component, 500, 100), doc = createDocument(); doc.components = [component]; doc.pages[0].widgets = [a, b];
    const edited = a.states![0].widgets[0]; edited.inputType = 'file';
    const next = applyComponentInstanceChanges(doc, a.id);
    for (const widget of [next.components[0].widgets[0], ...next.pages[0].widgets.map(instance => instance.states![0].widgets[0])]) expect(widget).toMatchObject({ ...config, inputType: 'file', text: authoredText });
    next.pages[0].widgets[0].states![0].widgets[0].inputType = 'email'; const restored = applyComponentInstanceChanges(next, a.id);
    expect(restored.pages[0].widgets[1].states![0].widgets[0]).toMatchObject({ ...config, inputType: 'email', text: authoredText }); expect(parseDocument(serializeDocument(restored))).toEqual(restored);
  });

  it('shares type edits across adaptive views while preserving base geometry and stored text', () => {
    const { doc, input } = fixture('text'); let page = createAdaptiveView(doc.pages[0]); const visible = structuredClone(page.widgets); visible[0].inputType = 'number'; visible[0].width += 50;
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, visible);
    expect(page.widgets[0]).toMatchObject({ inputType: 'number', text: authoredText, width: input.width }); expect(page.adaptiveViews[0].overrides[input.id]).toEqual({ width: input.width + 50 });
  });

  it('ignores File hint styles even for an explicitly requested transient hint, without mutating saved data', () => {
    const { input } = fixture('file'); input.text = ''; Object.assign(input, config); const before = structuredClone(input);
    expect(resolveInteractionStyle(input, { hint: true })).toEqual(input.style); expect(resolveSelectedStyle(input)).toEqual(input.style); expect(input).toEqual(before);
    input.inputType = 'text'; expect(resolveSelectedStyle(input).color).toBe(config.hintStyle.color); expect(input.hintText).toBe(config.hintText);
  });

  it('offers all eleven authoring choices and gives accurate browser-applicability notes', () => {
    const render = (widget: Widget) => { const doc = createDocument(); doc.pages[0].widgets = [widget]; return renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget, onWidgetChange() {}, onPageChange() {} })); };
    for (const inputType of supported) {
      const { input } = fixture(inputType), html = render(input), select = html.match(/<select aria-label="Input type"[\s\S]*?<\/select>/)![0];
      for (const value of supported) expect(select).toContain(`value="${value}"`);
      expect(select).toContain('>Phone</option>'); expect(select).toContain('>URL</option>'); expect(html).toContain('Changing type keeps the stored text');
      if (['file', 'number', 'date', 'month', 'time'].includes(inputType)) expect(html).toContain('Maximum length is stored but does not limit this input type');
      else expect(html).toContain('Zero prevents typing');
      if (inputType === 'file') { expect(html).toContain('Files are not uploaded or saved with the project'); expect(html).toContain('Read only does not apply to File inputs'); }
    }
  });
});
