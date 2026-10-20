import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { layoutTable, patchTableCells } from '../src/model/table';
import { richTextPlainText } from '../src/model/rich-text';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { createRuntime, executeInteraction, executeWidgetEvent, getRuntimeWidget } from '../src/runtime/engine';
import type { Action, Document, Interaction, Widget } from '../src/model/types';

// Native runtime expectations: research/table-runtime-evidence.md and 42 exact-original
// function probes. Author-side grid resizing is deliberately not runtime Resize.
const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
const interaction = (actions: Omit<Action, 'id'>[] = [], patch: Partial<Interaction> = {}): Interaction => ({ id: uid(), name: 'Table case', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })), ...patch });
const trace = (value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value });
const geometry = (widget: Widget) => ({ x: widget.x, y: widget.y, width: widget.width, height: widget.height });
function fixture() {
  const doc = createDocument(); doc.caseSelection = 'never'; doc.variables = { Trace: '', Value: 'literal [[Other]]' };
  const table = layoutTable({ ...createWidget('table'), x: 40, y: 60, table: { columnWidths: [80, 120], rowHeights: [30, 50], cells: ['A', 'B', 'C', 'D'].map(text => ({ ...createWidget('tableCell'), text, name: `Cell ${text}` })) } });
  doc.pages[0].widgets = [table]; return { doc, table, cells: table.table!.cells };
}
function make(doc: Document, portable: boolean): OfflineRuntime {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, URL })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(runtime); return runtime;
}
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} table runtime`, () => {
  it('addresses one cell for SetText and text conditions without mutating design or siblings', async () => {
    const { doc, table, cells } = fixture(); cells[0].richText = { paragraphs: [{ runs: [{ text: 'A', style: { fontWeight: 700 } }] }] };
    const source = serializeDocument(doc), runtime = make(doc, portable);
    await runtime.execute(interaction([{ type: 'setText', targetId: cells[0].id, value: '[[Value]]' }, trace(`[[Widget.${cells[0].id}.text]]`)]));
    const changed = runtime.widget(cells[0]); expect(changed.text).toBe('literal [[Other]]'); expect(richTextPlainText(changed.richText!)).toBe(changed.text);
    expect(changed.richText!.paragraphs[0].runs[0].style?.fontWeight).toBe(700); expect(runtime.state().variables.Trace).toBe('literal [[Other]]');
    expect(runtime.matches(interaction([], { conditions: [{ source: 'widgetText', key: cells[0].id, operator: 'contains', value: 'literal' }] }))).toBe(true);
    expect(cells.slice(1).map(cell => runtime.widget(cell).text)).toEqual(['B', 'C', 'D']); expect(geometry(runtime.widget(table))).toEqual(geometry(table)); expect(serializeDocument(doc)).toBe(source);
  });

  it('cell selection changes only that cell and fires change/select once', async () => {
    const { doc, cells } = fixture(); cells[0].selectedStyle = { color: '#ff0000' };
    cells[0].interactions = [interaction([trace('[[Trace]]change|')], { event: 'selectedChange' }), interaction([trace('[[Trace]]select|')], { event: 'select' })];
    const runtime = make(doc, portable); await runtime.execute(interaction([{ type: 'setSelected', targetId: cells[0].id, value: 'true' }, { type: 'setSelected', targetId: cells[0].id, value: 'true' }]));
    expect(runtime.widget(cells[0]).selected).toBe(true); expect(runtime.widget(cells[0]).style.color).toBe('#ff0000'); expect(Boolean(runtime.widget(cells[1]).selected)).toBe(false); expect(runtime.state().variables.Trace).toBe('change|select|');
  });

  it('cell selection group clears peer before selecting the next cell', async () => {
    const { doc, cells } = fixture(); for (const cell of cells.slice(0, 2)) cell.selectionGroup = 'choice';
    cells[0].interactions = [interaction([trace('[[Trace]]A-off|')], { event: 'unselect' })]; cells[1].interactions = [interaction([trace('[[Trace]]B-on|')], { event: 'select' })];
    const runtime = make(doc, portable); await runtime.select(cells[0].id, true); await runtime.select(cells[1].id, true);
    expect(Boolean(runtime.widget(cells[0]).selected)).toBe(false); expect(runtime.widget(cells[1]).selected).toBe(true); expect(runtime.state().variables.Trace).toBe('A-off|B-on|');
  });

  it('selecting a table is a no-op and does not select its children', async () => {
    const { doc, table, cells } = fixture(); table.interactions = [interaction([trace('root-selected')], { event: 'select' })];
    const runtime = make(doc, portable); await runtime.execute(interaction([{ type: 'setSelected', targetId: table.id, value: 'true' }])); await runtime.select(table.id, true);
    expect(Boolean(runtime.widget(table).selected)).toBe(false); expect(cells.every(cell => !runtime.widget(cell).selected)).toBe(true); expect(runtime.state().variables.Trace).toBe('');
  });

  it.each(['table', 'cell'])('Set Error on %s does not set flags or fire error events', async target => {
    const { doc, table, cells } = fixture(); for (const widget of [table, ...cells]) widget.interactions = [interaction([trace('unexpected')], { event: 'errorSet' })];
    const runtime = make(doc, portable); await runtime.execute(interaction([{ type: 'setError', targetId: target === 'table' ? table.id : cells[0].id, value: 'true' }]));
    expect([table, ...cells].every(widget => !runtime.widget(widget).error)).toBe(true); expect(runtime.state().variables.Trace).toBe('');
  });

  it.each(['table', 'cell'])('runtime Resize of %s does not resize tracks or cells and continues the action chain', async target => {
    const { doc, table, cells } = fixture(), runtime = make(doc, portable); const original = [table, ...cells].map(geometry);
    await runtime.execute(interaction([{ type: 'resize', targetId: target === 'table' ? table.id : cells[0].id, x: 333, y: 111 }, trace('continued')]));
    expect([table, ...cells].map(widget => geometry(runtime.widget(widget)))).toEqual(original); expect(runtime.widget(table).table!.columnWidths).toEqual([80, 120]); expect(runtime.widget(table).table!.rowHeights).toEqual([30, 50]); expect(runtime.state().variables.Trace).toBe('continued');
  });

  it('runtime cell Move uses local overrides without reflowing siblings or source tracks', async () => {
    const { doc, table, cells } = fixture(), runtime = make(doc, portable), original = serializeDocument(doc);
    await runtime.execute(interaction([{ type: 'move', targetId: cells[0].id, x: 17, y: 23 }]));
    expect(geometry(runtime.widget(cells[0]))).toEqual({ x: 17, y: 23, width: 80, height: 30 }); expect(cells.slice(1).map(cell => geometry(runtime.widget(cell)))).toEqual(cells.slice(1).map(geometry)); expect(geometry(runtime.widget(table))).toEqual(geometry(table)); expect(serializeDocument(doc)).toBe(original);
  });

  it('moving a table changes only root local coordinates, preserving cell positions', async () => {
    const { doc, table, cells } = fixture(), runtime = make(doc, portable);
    await runtime.execute(interaction([{ type: 'move', targetId: table.id, x: 200, y: 300 }]));
    expect(geometry(runtime.widget(table))).toEqual({ x: 200, y: 300, width: 200, height: 80 }); expect(cells.map(cell => geometry(runtime.widget(cell)))).toEqual(cells.map(geometry));
  });

  it('hiding a cell leaves its grid slot, table bounds and other cells untouched', async () => {
    const { doc, table, cells } = fixture(), runtime = make(doc, portable);
    await runtime.execute(interaction([{ type: 'hide', targetId: cells[0].id }])); expect(runtime.widget(cells[0]).hidden).toBe(true); expect(cells.slice(1).every(cell => !runtime.widget(cell).hidden)).toBe(true);
    expect([table, ...cells].map(widget => geometry(runtime.widget(widget)))).toEqual([table, ...cells].map(geometry));
    await runtime.execute(interaction([{ type: 'show', targetId: cells[0].id }])); expect(runtime.widget(cells[0]).hidden).toBe(false);
  });

  it('table visibility blocks descendant clicks without overwriting their own hidden flags', async () => {
    const { doc, table, cells } = fixture(); cells[1].hidden = true; cells[0].interactions = [interaction([trace('clicked')])];
    const runtime = make(doc, portable); await runtime.execute(interaction([{ type: 'hide', targetId: table.id }])); await runtime.trigger(cells[0].id, 'click'); expect(runtime.state().variables.Trace).toBe('');
    expect(runtime.widget(cells[0]).hidden).toBe(false); expect(runtime.widget(cells[1]).hidden).toBe(true);
    await runtime.execute(interaction([{ type: 'show', targetId: table.id }])); await runtime.trigger(cells[0].id, 'click'); expect(runtime.state().variables.Trace).toBe('clicked'); expect(runtime.widget(cells[1]).hidden).toBe(true);
  });

  it.each(['table', 'cell'])('Enable/Disable action on %s has no effective disabled flag or descendant propagation', async target => {
    const { doc, table, cells } = fixture(); cells[0].interactions = [interaction([trace('cell-click')])]; const runtime = make(doc, portable), targetId = target === 'table' ? table.id : cells[0].id;
    await runtime.execute(interaction([{ type: 'disable', targetId }])); expect([table, ...cells].every(widget => !runtime.widget(widget).disabled)).toBe(true);
    await runtime.trigger(cells[0].id, 'click'); expect(runtime.state().variables.Trace).toBe('cell-click'); await runtime.execute(interaction([{ type: 'enable', targetId }])); expect(runtime.widget(cells[0]).disabled).toBe(false);
  });

  it.each(['matching', 'empty', 'no cases', 'false condition', 'disabled case'])('cell click logical parent fallback: %s', mode => {
    const { doc, table, cells } = fixture(); table.interactions = [interaction([trace('root')])];
    if (mode !== 'no cases') cells[0].interactions = [interaction(mode === 'empty' ? [] : [trace('cell')], { enabled: mode !== 'disabled case', conditions: mode === 'false condition' ? [{ source: 'variable', key: 'Trace', operator: 'equals', value: 'unmatched' }] : [] })];
    const runtime = make(doc, portable);
    return runtime.trigger(cells[0].id, 'click').then(() => expect(runtime.state().variables.Trace).toBe(mode === 'matching' ? 'cell' : mode === 'empty' ? '' : 'root'));
  });

  it.each(['matching', 'empty', 'no cases', 'false condition', 'disabled case'])('cell doubleClick logical parent fallback: %s', async mode => {
    const { doc, table, cells } = fixture(); table.interactions = [interaction([trace('root')], { event: 'doubleClick' })];
    if (mode !== 'no cases') cells[0].interactions = [interaction(mode === 'empty' ? [] : [trace('cell')], { event: 'doubleClick', enabled: mode !== 'disabled case', conditions: mode === 'false condition' ? [{ source: 'variable', key: 'Trace', operator: 'equals', value: 'unmatched' }] : [] })];
    const runtime = make(doc, portable); await runtime.trigger(cells[0].id, 'doubleClick'); expect(runtime.state().variables.Trace).toBe(mode === 'matching' ? 'cell' : mode === 'empty' ? '' : 'root');
  });

  it.each(['click', 'doubleClick'] as const)('an internal disabled cell flag permits %s to fall back to its table', async event => {
    const { doc, table, cells } = fixture(); table.interactions = [interaction([trace('root')], { event })]; cells[0].interactions = [interaction([trace('cell')], { event })];
    const runtime = make(doc, portable);
    // Deliberate runtime flag fixture, equivalent to original _disabledWidgets;
    // the native public Disable action does not set this flag on table cells.
    runtime.state().widgetOverrides[cells[0].id] = { disabled: true };
    await runtime.trigger(cells[0].id, event); expect(runtime.state().variables.Trace).toBe('root');
  });

  it('a cell case menu consumes the click without opening its table menu', async () => {
    const { doc, table, cells } = fixture(); doc.caseSelection = 'always'; table.interactions = [interaction([trace('root')])]; cells[0].interactions = [interaction([trace('cell')])];
    const runtime = make(doc, portable); await runtime.trigger(cells[0].id, 'click'); const menus = runtime.state().caseMenus!;
    expect(menus).toHaveLength(1); expect(menus[0].sourceId).toBe(cells[0].id); expect(runtime.state().variables.Trace).toBe(''); await runtime.selectCase(menus[0].id, menus[0].options[0].id); expect(runtime.state().variables.Trace).toBe('cell');
  });

  it('default authored table loads its root then stored row-major cells once', async () => {
    // Default product storage order; imported native object order may differ and
    // requires the separate explicit order contract rather than this assertion.
    const { doc, table, cells } = fixture(); doc.pages[0].interactions = [interaction([trace('page|')], { event: 'load' })]; table.interactions = [interaction([trace('[[Trace]]table|')], { event: 'load' })];
    for (const cell of cells) cell.interactions = [interaction([trace(`[[Trace]]${cell.text}|`)], { event: 'load' })];
    const runtime = make(doc, portable); await runtime.start(); expect(runtime.state().variables.Trace).toBe('page|table|A|B|C|D|');
  });

  it('explicit cellOrder survives roundtrip and drives Loaded independently from matrix positions', async () => {
    const { doc, table, cells } = fixture(); table.table!.cellOrder = [cells[0].id, cells[2].id, cells[1].id, cells[3].id];
    doc.pages[0].interactions = [interaction([trace('page|')], { event: 'load' })]; table.interactions = [interaction([trace('[[Trace]]table|')], { event: 'load' })];
    for (const cell of cells) cell.interactions = [interaction([trace(`[[Trace]]${cell.text}|`)], { event: 'load' })];
    const restored = parseDocument(serializeDocument(doc)), restoredTable = restored.pages[0].widgets[0];
    expect(restoredTable.table!.cells.map(cell => cell.text)).toEqual(['A', 'B', 'C', 'D']); expect(restoredTable.table!.cellOrder).toEqual(table.table!.cellOrder);
    const runtime = make(restored, portable); await runtime.start(); expect(runtime.state().variables.Trace).toBe('page|table|A|C|B|D|');
    expect(restoredTable.table!.cells.map(cell => geometry(runtime.widget(cell)))).toEqual(cells.map(geometry));
  });

  it('explicit cellOrder is respected within each repeated table instance', async () => {
    const { doc, table, cells } = fixture(), repeater = createWidget('repeater'); table.table!.cellOrder = [cells[1].id, cells[3].id, cells[0].id, cells[2].id];
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'one' }, { Name: 'two' }], template: [table], itemWidth: 240, itemHeight: 160, gap: 0 }; doc.pages[0].widgets = [repeater];
    table.interactions = [interaction([trace('[[Trace]][[Item.Name]]:table|')], { event: 'load' })];
    for (const cell of cells) cell.interactions = [interaction([trace(`[[Trace]][[Item.Name]]:${cell.text}|`)], { event: 'load' })];
    const runtime = make(doc, portable); await runtime.start(); expect(runtime.state().variables.Trace).toBe('one:table|one:B|one:D|one:A|one:C|two:table|two:B|two:D|two:A|two:C|');
  });

  it('whole-table text follows cellOrder and preserves empty-cell separators including hidden cells', async () => {
    const { doc, table, cells } = fixture(); table.table!.cellOrder = [cells[0].id, cells[2].id, cells[1].id, cells[3].id]; cells[0].text = ''; cells[1].text = ''; cells[3].text = ''; cells[2].hidden = true;
    const runtime = make(doc, portable), read = () => runtime.text(`[[Widget.${table.id}.text]]`);
    expect(read()).toBe('\nC\n\n'); await runtime.execute(interaction([{ type: 'hide', targetId: table.id }])); expect(read()).toBe('\nC\n\n');
    await runtime.execute(interaction([{ type: 'setText', targetId: cells[2].id, value: '' }])); expect(read()).toBe('\n\n\n');
  });

  it('whole-table text flattens rich paragraphs and soft breaks with exact LF separation', () => {
    const { doc, table, cells } = fixture(); cells[0].richText = { paragraphs: [{ runs: [{ text: 'first\nsoft' }] }, { runs: [{ text: 'second' }] }] }; cells[0].text = richTextPlainText(cells[0].richText); cells[1].text = '';
    const runtime = make(doc, portable); expect(runtime.text(`[[Widget.${table.id}.text]]`)).toBe('first\nsoft\nsecond\n\nC\nD');
  });

  it('whole-table text reads the current repeater row and current cell text override', async () => {
    const { doc, table, cells } = fixture(), repeater = createWidget('repeater'); cells[0].text = '[[Item.Name]]';
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'one' }, { Name: 'two' }], template: [table], itemWidth: 240, itemHeight: 160, gap: 0 }; doc.pages[0].widgets = [repeater];
    cells[1].interactions = [interaction([{ type: 'setText', targetId: cells[2].id, value: 'changed [[Item.Name]]' }, trace(`[[Widget.${table.id}.text]]`)])];
    const runtime = make(doc, portable); await runtime.start(); const [first, second] = runtime.rows(repeater);
    await runtime.trigger(cells[1].id, 'click', first.data, first.context); expect(runtime.state().variables.Trace).toBe('one\nB\nchanged one\nD');
    await runtime.trigger(cells[1].id, 'click', second.data, second.context); expect(runtime.state().variables.Trace).toBe('two\nB\nchanged two\nD');
  });

  it('unsupported whole-table SetText is safely ignored without rewriting cells', async () => {
    // Deliberate product boundary: native direct SetWidgetRichText(table) throws
    // for its absent rich panel. This safe no-op is not claimed native behavior.
    const { doc, table, cells } = fixture(), runtime = make(doc, portable), before = cells.map(cell => cell.text);
    await runtime.execute(interaction([{ type: 'setText', targetId: table.id, value: 'should not become root text' }, trace('continued')]));
    expect(runtime.widget(table).text).toBe(table.text); expect(cells.map(cell => runtime.widget(cell).text)).toEqual(before); expect(runtime.state().variables.Trace).toBe('continued');
  });

  it('table children inside repeater items keep per-row text and selected overrides', async () => {
    const { doc, table, cells } = fixture(), repeater = createWidget('repeater'); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'first' }, { Name: 'second' }], template: [table], itemWidth: 240, itemHeight: 160, gap: 0 }; doc.pages[0].widgets = [repeater];
    cells[0].interactions = [interaction([{ type: 'setText', targetId: cells[1].id, value: '[[Item.Name]]' }, { type: 'setSelected', targetId: cells[0].id, value: 'true' }])];
    const runtime = make(doc, portable); await runtime.start(); const [first, second] = runtime.rows(repeater); await runtime.trigger(cells[0].id, 'click', first.data, first.context);
    expect(runtime.widget(cells[1], first.context).text).toBe('first'); expect(runtime.widget(cells[1], second.context).text).toBe('B'); expect(runtime.widget(cells[0], first.context).selected).toBe(true); expect(Boolean(runtime.widget(cells[0], second.context).selected)).toBe(false);
  });

  it('failing segments restore cell text, move, selected and visibility together', async () => {
    const { doc, table, cells } = fixture(), runtime = make(doc, portable), before = structuredClone(runtime.state());
    await expect(runtime.execute(interaction([{ type: 'setText', targetId: cells[0].id, value: 'Changed' }, { type: 'move', targetId: cells[0].id, x: 19, y: 21 }, { type: 'hide', targetId: table.id }, { type: 'setSelected', targetId: cells[0].id, value: 'true' }, { type: 'setSelected', targetId: cells[0].id, value: 'invalid' }]))).rejects.toThrow('Invalid selected state');
    expect(runtime.state()).toEqual(before); expect(runtime.widget(cells[0]).text).toBe('A'); expect(runtime.widget(table).hidden).toBe(false);
  });

  it('navigation away and back restores authored cell data and geometry', async () => {
    const { doc, table, cells } = fixture(); const first = doc.pages[0], second = createPage('Other'); doc.pages.push(second); const runtime = make(doc, portable);
    await runtime.execute(interaction([{ type: 'setText', targetId: cells[0].id, value: 'Changed' }, { type: 'move', targetId: cells[0].id, x: 99, y: 88 }]));
    await runtime.execute(interaction([{ type: 'openPage', targetId: second.id }])); await runtime.execute(interaction([{ type: 'openPage', targetId: first.id }]));
    expect(runtime.widget(cells[0]).text).toBe('A'); expect(geometry(runtime.widget(cells[0]))).toEqual(geometry(cells[0])); expect(geometry(runtime.widget(table))).toEqual(geometry(table));
  });
});

describe('table runtime snapshot helpers', () => {
  it('restores cell overrides across snapshot calls while authored track edits remain separate', async () => {
    const { doc, table } = fixture(); const authored = patchTableCells(table, [table.table!.cells[0].id], { width: 90, height: 40 }); doc.pages[0].widgets = [authored]; const cells = authored.table!.cells;
    cells[0].interactions = [interaction([{ type: 'setText', targetId: cells[1].id, value: 'snapshot' }])];
    const initial = createRuntime(doc), changed = await executeWidgetEvent(doc, initial, cells[0].id, 'click');
    const final = await executeInteraction(doc, changed, interaction([{ type: 'resize', targetId: authored.id, x: 600, y: 400 }, { type: 'resize', targetId: cells[0].id, x: 200, y: 100 }]));
    expect(getRuntimeWidget(cells[1], final).text).toBe('snapshot'); expect(getRuntimeWidget(cells[1], initial).text).toBe('B'); expect(geometry(getRuntimeWidget(authored, final))).toEqual(geometry(authored)); expect(geometry(getRuntimeWidget(cells[0], final))).toEqual(geometry(cells[0]));
    expect(authored.table!.columnWidths).toEqual([90, 120]); expect(authored.table!.rowHeights).toEqual([40, 50]);
  });
});
