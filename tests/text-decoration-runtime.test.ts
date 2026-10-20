import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import { richTextPlainText, textDecorationLine } from '../src/model/rich-text';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { getRuntimeWidget } from '../src/runtime/engine';
import type { Action, Document, Interaction, Widget, WidgetStyle } from '../src/model/types';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Decoration', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
function fixture() {
  const doc = createDocument(), widget = createWidget('text'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget];
  widget.style.underline = true;
  widget.richText = { paragraphs: [{ runs: [
    { text: 'None ', style: { underline: false, strikethrough: false } },
    { text: 'Under ', style: { underline: true, strikethrough: false } },
    { text: 'Strike ', style: { underline: false, strikethrough: true } },
    { text: 'Both', style: { underline: true, strikethrough: true } },
  ] }] }; widget.text = richTextPlainText(widget.richText);
  return { doc, widget };
}
const original = ['none', 'underline', 'line-through', 'underline line-through'];
const decorated = (w: Widget) => w.richText!.paragraphs[0].runs.map(r => textDecorationLine({ underline: r.style?.underline ?? w.style.underline, strikethrough: r.style?.strikethrough ?? w.style.strikethrough }));
function make(doc: Document, serialized: boolean) {
  const session: OfflineRuntime = serialized ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
  sessions.push(session); return session;
}
// Expected values come from retained original style.js probes, not CSS normalization.
const matrix: [string, Partial<WidgetStyle>, string[]][] = [
  ['absent', {}, original], ['underline false', { underline: false }, Array(4).fill('none')],
  ['underline true', { underline: true }, Array(4).fill('underline')],
  ['strike false', { strikethrough: false }, Array(4).fill('none')],
  ['strike true', { strikethrough: true }, Array(4).fill('line-through')],
  ['both false', { underline: false, strikethrough: false }, Array(4).fill('none')],
  ['invalid false true', { underline: false, strikethrough: true }, original],
  ['true false', { underline: true, strikethrough: false }, Array(4).fill('underline')],
  ['both true', { underline: true, strikethrough: true }, Array(4).fill('underline line-through')],
];

for (const serialized of [false, true]) describe(`${serialized ? 'serialized' : 'module'} native text-decoration projection`, () => {
  it.each(matrix)('matches original active-state matrix: %s', (_name, patch, expected) => {
    const { doc, widget } = fixture(); widget.mouseOverStyle = patch;
    const before = serializeDocument(doc), session = make(doc, serialized);
    expect(decorated(session.widget(widget))).toEqual(original);
    session.setInteractionState(widget.id, { mouseOver: true }); expect(decorated(session.widget(widget))).toEqual(expected);
    session.setInteractionState(widget.id, { mouseOver: false }); expect(decorated(session.widget(widget))).toEqual(original);
    expect(serializeDocument(doc)).toBe(before);
  });

  it('combines adaptive and selected flags once; invalid CSS restores original runs, not prior adaptive or hover paint', async () => {
    const { doc, widget } = fixture(); widget.mouseOverStyle = { strikethrough: true }; widget.selectedStyle = { underline: false };
    const session = make(doc, serialized);
    session.setInteractionState(widget.id, { mouseOver: true }); expect(decorated(session.widget(widget))).toEqual(Array(4).fill('line-through'));
    await session.select(widget.id, true); expect(decorated(session.widget(widget))).toEqual(original);
    session.setInteractionState(widget.id, { mouseOver: false }); await session.select(widget.id, false);
    widget.selectedStyle = { strikethrough: true };
    expect(decorated(session.widget(widget, [], false, { underline: false }))).toEqual(Array(4).fill('none'));
    await session.select(widget.id, true);
    expect(decorated(session.widget(widget, [], false, { underline: false }))).toEqual(original);
    expect(decorated(session.widget(widget, [], false, { underline: true }))).toEqual(Array(4).fill('underline line-through'));
  });

  it('uses the same compound override for plain text and snapshot style projection', async () => {
    const { doc, widget } = fixture(); delete widget.richText; widget.text = 'Plain'; widget.selectedStyle = { strikethrough: true };
    const session = make(doc, serialized); await session.select(widget.id, true);
    expect(textDecorationLine(session.widget(widget).style)).toBe('line-through');
    expect(textDecorationLine(resolveInteractionStyle({ ...widget, selected: true }))).toBe('line-through');
    expect(textDecorationLine(session.widget({ ...widget, style: { ...widget.style, underline: false } }, [], false, { underline: false }).style)).toBe('underline');
  });

  it('plain Set Text keeps the first original run decoration and state removal restores it', async () => {
    const { doc, widget } = fixture(); widget.richText!.paragraphs[0].runs[0].style = { underline: true, strikethrough: true };
    widget.mouseOverStyle = { strikethrough: true }; const session = make(doc, serialized);
    session.setInteractionState(widget.id, { mouseOver: true });
    await session.execute(event({ type: 'setText', targetId: widget.id, value: 'Replacement\nSecond' }));
    expect(session.widget(widget).richText!.paragraphs).toHaveLength(2);
    expect(decorated(session.widget(widget))).toEqual(['line-through']);
    session.setInteractionState(widget.id, { mouseOver: false }); expect(decorated(session.widget(widget))).toEqual(['underline line-through']);
  });

  it.each([
    [{ strikethrough: true }, 'line-through'],
    [{ underline: false, strikethrough: true }, 'underline'],
    [{ underline: true }, 'underline'],
  ] as const)('Set Style treats equivalent plain and rich text consistently for %j', async (style, expected) => {
    const { doc, widget } = fixture();
    widget.richText!.paragraphs[0].runs = [{ text: 'Under', style: { underline: true, strikethrough: false } }]; widget.text = 'Under';
    const plain = createWidget('text'); plain.text = widget.text; plain.style.underline = true; doc.pages[0].widgets.push(plain);
    const session = make(doc, serialized);
    await session.execute(event({ type: 'setStyle', targetId: widget.id, style }, { type: 'setStyle', targetId: plain.id, style }));
    expect(decorated(session.widget(widget))).toEqual([expected]); expect(textDecorationLine(session.widget(plain).style)).toBe(expected);
    expect(decorated(getRuntimeWidget(widget, session.state()))).toEqual([expected]); expect(textDecorationLine(getRuntimeWidget(plain, session.state()).style)).toBe(expected);
    expect(session.state().widgetOverrides[widget.id].richText!.paragraphs[0].runs[0].style).toMatchObject({ underline: true, strikethrough: false });
  });
});
