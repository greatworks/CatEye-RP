import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { richTextPlainText } from '../src/model/rich-text';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import type { Action, Document, Interaction, Widget } from '../src/model/types';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Text', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
function fixture() {
  const doc = createDocument(), widget = createWidget('text'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget];
  widget.style.fontStyle = 'normal'; widget.style.fontSize = 18;
  widget.richText = { paragraphs: [{ textAlign: 'left', lineHeightPx: 28, runs: [{ text: 'Normal ', style: { fontStyle: 'normal', fontSize: 22 } }, { text: 'Italic', style: { fontStyle: 'italic', fontWeight: 700 } }] }] }; widget.text = richTextPlainText(widget.richText);
  return { doc, widget };
}
function make(doc: Document, serialized: boolean) { const session: OfflineRuntime = serialized ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc); sessions.push(session); return session; }
const styles = (w: Widget) => w.richText!.paragraphs[0].runs.map(r => r.style?.fontStyle);
for (const serialized of [false, true]) describe(`${serialized ? 'serialized' : 'module'} mixed text runtime`, () => {
  it('composes explicit adaptive/action/effect properties over runs without applying the complete outer style', async () => {
    const { doc, widget } = fixture(), before = serializeDocument(doc), session = make(doc, serialized);
    expect(styles(session.widget(widget))).toEqual(['normal', 'italic']); expect(session.widget(widget).richText!.paragraphs[0].runs[0].style?.fontSize).toBe(22);
    expect(styles(session.widget(widget, [], false, { fontStyle: 'normal' }))).toEqual(['normal', 'normal']);
    await session.execute(event({ type: 'setStyle', targetId: widget.id, style: { fontStyle: 'italic' } }));
    expect(styles(session.widget(widget, [], false, { fontStyle: 'normal' }))).toEqual(['italic', 'italic']);
    widget.mouseOverStyle = { fontStyle: 'normal' }; widget.mouseDownStyle = { fontWeight: 900 }; widget.focusedStyle = { color: 'red' };
    session.setInteractionState(widget.id, { mouseOver: true, mouseDown: true }); expect(styles(session.widget(widget))).toEqual(['normal', 'normal']);
    session.setInteractionState(widget.id, { focused: true }); expect(styles(session.widget(widget))).toEqual(['italic', 'italic']);
    expect(session.widget(widget).richText!.paragraphs[0].runs[1].style).toMatchObject({ fontWeight: 700, color: 'red' });
    session.setInteractionState(widget.id, { focused: false, mouseOver: false, mouseDown: false });
    delete widget.mouseOverStyle; delete widget.mouseDownStyle; delete widget.focusedStyle; expect(serializeDocument(doc)).toBe(before);
  });
  it('temporarily flattens selected/error/disabled typography then restores the original mixed runs', async () => {
    const { doc, widget } = fixture(); widget.selectedStyle = { fontStyle: 'normal' }; widget.errorStyle = { fontStyle: 'italic' }; widget.disabledStyle = { fontStyle: 'normal' };
    const session = make(doc, serialized); await session.select(widget.id, true); expect(styles(session.widget(widget))).toEqual(['normal', 'normal']);
    await session.setError(widget.id, true); expect(styles(session.widget(widget))).toEqual(['italic', 'italic']);
    await session.execute(event({ type: 'disable', targetId: widget.id })); expect(styles(session.widget(widget))).toEqual(['normal', 'normal']);
    await session.execute(event({ type: 'enable', targetId: widget.id })); await session.setError(widget.id, false); await session.select(widget.id, false); expect(styles(session.widget(widget))).toEqual(['normal', 'italic']);
  });
  it('plain Set Text preserves first run and first paragraph formatting, literal markup and empty lines', async () => {
    const { doc, widget } = fixture(); widget.mouseOverStyle = { fontStyle: 'italic' }; const session = make(doc, serialized);
    session.setInteractionState(widget.id, { mouseOver: true });
    await session.execute(event({ type: 'setText', targetId: widget.id, value: '<b>literal</b>\n\nLast' }));
    let current = session.widget(widget); expect(current.text).toBe('<b>literal</b>\n\nLast'); expect(current.richText!.paragraphs).toHaveLength(3);
    expect(current.richText!.paragraphs[1]).toMatchObject({ lineHeightPx: 28, runs: [{ text: '', style: { fontStyle: 'italic', fontSize: 22 } }] });
    session.setInteractionState(widget.id, { mouseOver: false }); current = session.widget(widget);
    expect(current.richText!.paragraphs[2].runs[0].style).toMatchObject({ fontStyle: 'normal', fontSize: 22 }); expect(session.controlValue(widget.id)).toBe(current.text);
  });
  it('resolves cross-run expressions with one combined budget while keeping literal source and returned tokens literal', () => {
    const { doc, widget } = fixture(); doc.variables.Name = '[[Again]]';
    widget.richText = { paragraphs: [{ runs: [{ text: 'Hi [[Na', style: { fontStyle: 'italic' } }, { text: 'me]]!', style: { fontWeight: 700 } }] }] }; widget.text = richTextPlainText(widget.richText);
    const session = make(doc, serialized), rich = session.richText(session.widget(widget))!;
    expect(richTextPlainText(rich)).toBe('Hi [[Again]]!'); expect(rich.paragraphs[0].runs[1].style?.fontStyle).toBe('italic'); expect(session.controlValue(widget.id)).toBe('Hi [[Again]]!');
    widget.richText.expressionMode = 'literal'; expect(richTextPlainText(session.richText(session.widget(widget))!)).toBe(widget.text); expect(session.controlValue(widget.id)).toBe(widget.text);
  });
  it('isolates row text and style mutations and resolves tokens across runs in each row', async () => {
    const { doc, widget } = fixture(), repeater = createWidget('repeater');
    widget.richText!.paragraphs[0].runs = [{ text: '[[Item.', style: { fontStyle: 'italic' } }, { text: 'Name]]' }]; widget.text = richTextPlainText(widget.richText!);
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [widget], itemHeight: 50, gap: 0 }; doc.pages[0].widgets = [repeater];
    const session = make(doc, serialized); await session.start(); const rows = session.rows(repeater);
    expect(rows.map(row => richTextPlainText(session.richText(session.widget(widget, row.context), row.data, row.context)!))).toEqual(['Alpha', 'Beta']);
    await session.execute(event({ type: 'setStyle', targetId: widget.id, style: { fontStyle: 'normal' } }, { type: 'setText', targetId: widget.id, value: 'Changed' }), rows[1].data, rows[1].context);
    expect(styles(session.widget(widget, rows[0].context))[0]).toBe('italic'); expect(session.widget(widget, rows[1].context).text).toBe('Changed'); expect(styles(session.widget(widget, rows[1].context))).toEqual(['normal']);
  });
  it('rolls back rich content and explicit style metadata after a later action fails', async () => {
    const { doc, widget } = fixture(), session = make(doc, serialized); const before = structuredClone(session.state());
    await expect(session.execute(event({ type: 'setStyle', targetId: widget.id, style: { fontStyle: 'normal' } }, { type: 'setText', targetId: widget.id, value: 'Changed' }, { type: 'setSelected', targetId: widget.id, value: 'invalid' }))).rejects.toThrow();
    expect(session.state()).toEqual(before); expect(styles(session.widget(widget))).toEqual(['normal', 'italic']);
  });
});
