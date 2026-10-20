import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage as createNativePage, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RowContext, type RuntimeViewport } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of sessions.splice(0)) runtime.dispose(); vi.useRealTimers(); });
const interaction = (event: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: event, event, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
const actions = (...items: Omit<Action, 'id'>[]) => interaction('click', ...items);
function createPage(name: string) { const page = createNativePage(name); delete page.adaptiveSelection; delete page.adaptiveBaseSize; return page; }
function fixture() {
  const doc = createDocument(), shape = createWidget('box', 10, 20);
  // This suite records the previous max-width policy, including absent fields.
  delete doc.pages[0].adaptiveSelection; delete doc.pages[0].adaptiveBaseSize;
  doc.caseSelection = 'never'; doc.pages[0].width = 1000; doc.pages[0].widgets = [shape];
  doc.pages[0].adaptiveViews = [
    { id: 'tablet', name: 'Tablet', width: 900, overrides: { [shape.id]: { x: 90, width: 300, style: { fill: '#223344' } } } },
    { id: 'phone', name: 'Phone', width: 600, overrides: { [shape.id]: { x: 60, width: 200, style: { fill: '#112233' } } } },
  ];
  return { doc, shape, page: doc.pages[0] };
}
function make(doc: Document, portable: boolean, policy?: RuntimeViewport) {
  const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout }) : createOfflineRuntime;
  const runtime = factory(doc, undefined, evaluateExpression, undefined, policy); sessions.push(runtime); return runtime;
}
function nativeShape() {
  const shape = createWidget('box', 10, 20);
  shape.shapeText = { autoFitWidth: false, autoFitHeight: true };
  Object.assign(shape.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top' }); return shape;
}
function listOf(child: Widget) {
  const list = createWidget('repeater');
  list.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }, { Name: 'C' }], template: [child], itemHeight: 50, gap: 0, pagination: { itemsPerPage: 2, startPage: 1 } };
  return list;
}
function navigationFixture() {
  const { doc, page, shape } = fixture(), destination = createPage('Destination'), target = createWidget('box'), list = listOf(createWidget('text'));
  doc.variables = { Loads: '0', ItemLoads: '0', Go: 'no', Invalid: 'bad', Trace: '' };
  list.repeater!.rows = [{ Name: 'A' }]; page.widgets.push(list); destination.widgets = [target]; doc.pages.push(destination);
  page.interactions = [interaction('load', { type: 'setVariable', targetId: 'Loads', value: '[[Loads + 1]]' })];
  const navigate = interaction('itemLoad', { type: 'openPage', targetId: destination.id });
  navigate.conditions = [{ source: 'variable', key: 'Go', operator: 'equals', value: 'yes' }];
  list.interactions = [interaction('itemLoad', { type: 'setVariable', targetId: 'ItemLoads', value: '[[ItemLoads + 1]]' }), navigate];
  const failure = interaction('load', { type: 'setSelected', targetId: target.id, value: '[[Invalid]]' });
  destination.interactions = [failure];
  return { doc, page, shape, destination, target, failure };
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} runtime-owned adaptive transitions`, () => {
  it('keeps the omitted-policy host contract, but explicit {} selects by page width before rendering', () => {
    const { doc, shape, page } = fixture(); page.width = 500;
    const legacy = make(doc, portable), managed = make(doc, portable, {});
    expect(legacy.adaptiveViewId()).toBeUndefined(); expect(legacy.widget({ ...shape, x: 777 }).x).toBe(777);
    expect(managed.adaptiveViewId()).toBe('phone'); expect(managed.widget({ ...shape, x: 777 }).x).toBe(60);
    expect(managed.widget(shape).style.fill).toBe('#112233');
  });

  it('copies and validates viewport values before queuing, including zero, clamping, and future-page policy', async () => {
    const { doc, shape, page } = fixture(); page.width = 500;
    const policy = { width: 1000 }, runtime = make(doc, portable, policy); policy.width = 0;
    expect(runtime.adaptiveViewId()).toBeUndefined();
    const next = { width: 800 }; const pending = runtime.setViewport(next); next.width = 0; await pending;
    expect(runtime.adaptiveViewId()).toBe('tablet');
    await runtime.setViewport({ width: 1000, clampToPage: true }); expect(runtime.adaptiveViewId()).toBe('phone');
    await runtime.setViewport({ width: 0 }); expect(runtime.widget(shape).x).toBe(60);
    for (const width of [-1, Infinity, NaN, '500']) expect(() => runtime.setViewport({ width } as RuntimeViewport)).toThrow(/finite nonnegative/);
    expect(() => runtime.setViewport({ clampToPage: 1 } as unknown as RuntimeViewport)).toThrow(/boolean/);
    expect(() => make(doc, portable, { width: NaN })).toThrow(/finite nonnegative/);
    expect(runtime.adaptiveViewId()).toBe('phone');
  });

  it('reads initial declarations in hidden and inactive subtrees before their Loaded handlers, without a rendered base', async () => {
    const { doc, page } = fixture(), panel = createWidget('panel'), hidden = createWidget('box'), inactive = createWidget('box');
    hidden.hidden = true;
    hidden.interactions = [interaction('load', { type: 'setVariable', targetId: 'HiddenWidth', value: '[[This.width]]' })];
    inactive.interactions = [interaction('load', { type: 'setVariable', targetId: 'InactiveX', value: '[[This.x]]' })];
    panel.states = [{ id: uid(), name: 'First', widgets: [] }, { id: uid(), name: 'Other', widgets: [inactive] }]; panel.activeStateId = panel.states[0].id;
    page.widgets = [panel, hidden]; page.adaptiveViews[1].overrides = { [hidden.id]: { width: 123, hidden: true }, [inactive.id]: { x: 321 } };
    const runtime = make(doc, portable, { width: 500 }); await runtime.start();
    expect(runtime.state().variables).toMatchObject({ HiddenWidth: '123', InactiveX: '321' });
    expect(runtime.widget(hidden).hidden).toBe(true); expect(runtime.widget(inactive).x).toBe(321);
  });

  it('selects each destination page before Loaded and reapplies its own declarations after returning', async () => {
    const { doc, shape, page } = fixture(), destination = createPage('Second'), target = createWidget('box');
    page.width = 500; destination.width = 800; destination.widgets = [target];
    destination.adaptiveViews = [{ id: 'second-view', name: 'Second view', width: 850, overrides: { [target.id]: { width: 345 } } }];
    target.interactions = [interaction('load', { type: 'setVariable', targetId: 'Width', value: '[[This.width]]' })]; doc.pages.push(destination);
    const runtime = make(doc, portable, {}); await runtime.start(); await runtime.navigate(destination.id);
    expect(runtime.adaptiveViewId()).toBe('second-view'); expect(runtime.state().variables.Width).toBe('345');
    await runtime.execute(actions({ type: 'move', targetId: target.id, x: 888 })); await runtime.navigate(page.id);
    expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.widget(shape).x).toBe(60);
    await runtime.navigate(destination.id); expect(runtime.widget(target).x).toBe(target.x);
  });

  it('updates a same-view policy without resetting live state, and uses the new policy on navigation', async () => {
    const { doc, shape } = fixture(), second = createPage('Second'); second.width = 400;
    second.adaptiveViews = [{ id: 'small', name: 'Small', width: 450, overrides: {} }]; doc.pages.push(second);
    const runtime = make(doc, portable, { width: 500 });
    await runtime.execute(actions({ type: 'hide', targetId: shape.id }, { type: 'move', targetId: shape.id, x: 876 }, { type: 'setStyle', targetId: shape.id, style: { fill: '#ff0000' } }));
    await runtime.setViewport({ width: 550, clampToPage: true });
    expect(runtime.widget(shape)).toMatchObject({ hidden: true, x: 876, style: { fill: '#ff0000' } });
    await runtime.navigate(second.id); expect(runtime.adaptiveViewId()).toBe('small');
  });

  it('restores declared visibility and geometry across all shapes/containers without firing Show/Hide', async () => {
    const { doc, page } = fixture(), types = ['box', 'line', 'path', 'image', 'input', 'panel', 'table', 'menu', 'tree'] as const;
    const items = types.map(type => createWidget(type, 10, 20)); page.widgets = items;
    for (const item of items) {
      item.interactions = [interaction('show', { type: 'setVariable', targetId: 'Visibility', value: 'fired' }), interaction('hide', { type: 'setVariable', targetId: 'Visibility', value: 'fired' })];
      page.adaptiveViews[1].overrides[item.id] = ['table', 'menu', 'tree'].includes(item.type) ? { hidden: true } : { hidden: true, x: 30, width: 222, rotation: 37 };
    }
    const runtime = make(doc, portable, {});
    await runtime.execute(actions(...items.map(item => ({ type: 'move' as const, targetId: item.id, x: 999, y: 888 }))));
    await runtime.setViewport({ width: 500 });
    for (const item of items) expect(runtime.widget(item)).toMatchObject({ hidden: true, x: ['table', 'menu', 'tree'].includes(item.type) ? 10 : 30, y: 20 });
    expect(runtime.state().variables.Visibility).toBeUndefined();
    await runtime.setViewport({ width: 1000 });
    for (const item of items) expect(runtime.widget(item)).toMatchObject({ hidden: false, x: 10, y: 20, width: item.width, rotation: item.rotation });
    expect(runtime.state().variables.Visibility).toBeUndefined();
  });

  it('keeps shared table/menu/tree layouts while reading supported nested panel and repeater overrides', () => {
    const { doc, page } = fixture(), table = createWidget('table'), menu = createWidget('menu'), tree = createWidget('tree'), panel = createWidget('panel'), child = createWidget('box');
    panel.states![0].widgets = [child]; const list = listOf(createWidget('box'));
    page.widgets = [table, menu, tree, panel, list];
    const shared = [table.table!.cells[0], menu.menu!.table, menu.menu!.table.table!.cells[0], tree.tree!.nodes[0], tree.tree!.nodes[0].treeNode!.label];
    for (const item of [table, menu, tree, ...shared, child, list.repeater!.template[0]]) page.adaptiveViews[1].overrides[item.id] = { x: 999, hidden: true, style: { fill: '#ff0000' } };
    const runtime = make(doc, portable, { width: 500 });
    for (const item of shared) expect(runtime.widget(item)).toMatchObject({ x: item.x, hidden: item.hidden, style: { fill: item.style.fill } });
    for (const item of [table, menu, tree]) expect(runtime.widget(item)).toMatchObject({ x: item.x, hidden: true, style: { fill: item.style.fill } });
    expect(runtime.widget(child)).toMatchObject({ x: 999, hidden: true });
    expect(runtime.widget(list.repeater!.template[0], runtime.rows(list)[0].context)).toMatchObject({ x: 999, hidden: true });
  });

  it('removes SetStyle run paint while retaining SetText content, selection/error/disabled, and author bytes', async () => {
    const { doc, shape, page } = fixture(); shape.richText = { paragraphs: [{ runs: [{ text: 'Original', style: { fontSize: 20, color: '#123456' } }] }] }; shape.text = 'Original';
    shape.selectedStyle = { stroke: '#00ff00' }; shape.errorStyle = { fill: '#ffaa00' }; shape.disabledStyle = { opacity: 0.4 };
    page.adaptiveViews[1].overrides[shape.id].style = { fontSize: 18, color: '#112233' };
    const saved = serializeDocument(doc), runtime = make(doc, portable, {});
    await runtime.execute(actions({ type: 'setStyle', targetId: shape.id, style: { fontSize: 40, color: '#ff0000', lineHeight: 2 } }, { type: 'setText', targetId: shape.id, value: 'Runtime content' }, { type: 'setSelected', targetId: shape.id, value: 'true' }, { type: 'setError', targetId: shape.id, value: 'true' }, { type: 'disable', targetId: shape.id }));
    expect(runtime.widget(shape).richText!.paragraphs[0].runs[0].style).toMatchObject({ fontSize: 40, color: '#ff0000' });
    await runtime.setViewport({ width: 500 });
    expect(runtime.widget(shape)).toMatchObject({ text: 'Runtime content', selected: true, error: true, disabled: true, style: { stroke: '#00ff00', opacity: 0.4 } });
    expect(runtime.widget(shape).richText!.paragraphs[0].runs[0]).toMatchObject({ text: 'Runtime content', style: { fontSize: 18, color: '#112233' } });
    await runtime.setViewport({ width: 1000 });
    expect(runtime.widget(shape).richText!.paragraphs[0].runs[0]).toMatchObject({ text: 'Runtime content', style: { fontSize: 20, color: '#123456' } });
    expect(serializeDocument(doc)).toBe(saved);
  });

  it('does not replace the original decoration fallback with adaptive paint', () => {
    const { doc, shape, page } = fixture(); shape.style.underline = true; shape.selected = true; shape.selectedStyle = { strikethrough: true };
    shape.richText = { paragraphs: [{ runs: [{ text: shape.text, style: { underline: true } }] }] };
    page.adaptiveViews[1].overrides[shape.id].style = { underline: false };
    const current = make(doc, portable, { width: 500 }).widget(shape);
    // Native combined false/true is invalid and preserves the original cache.
    expect(current.style.underline).toBe(true); expect(current.style.strikethrough).not.toBe(true);
    expect(current.richText!.paragraphs[0].runs[0].style!.underline).toBe(true);
  });

  it('keeps the original decoration cache when an unrelated SetStyle captures an adaptive base', async () => {
    const { doc, shape, page } = fixture(); shape.style.underline = true; shape.selected = true; shape.selectedStyle = { strikethrough: true };
    page.adaptiveViews[1].overrides[shape.id].style = { underline: false };
    const runtime = make(doc, portable, { width: 500 });
    await runtime.execute(actions({ type: 'setStyle', targetId: shape.id, style: { fill: '#ff0000' } }));
    expect(runtime.widget(shape).style.underline).toBe(true);
    expect(runtime.widget(shape).style.strikethrough).not.toBe(true);
  });

  it('restores raw rich formatting after SetStyle begins in a selected adaptive view', async () => {
    const { doc, shape, page } = fixture(); shape.text = 'Original'; shape.selected = true;
    shape.richText = { paragraphs: [{ runs: [{ text: 'Original', style: { fontSize: 20, color: '#123456' } }] }] };
    shape.selectedStyle = { fontSize: 25 }; page.adaptiveViews[1].overrides[shape.id].style = { fontSize: 18, color: '#112233' };
    const runtime = make(doc, portable, { width: 500 }); expect(runtime.widget(shape).richText!.paragraphs[0].runs[0].style!.fontSize).toBe(25);
    await runtime.execute(actions({ type: 'setStyle', targetId: shape.id, style: { fontSize: 40, color: '#ff0000' } }, { type: 'setText', targetId: shape.id, value: 'New content' }));
    await runtime.setViewport({ width: 1000 }); await runtime.select(shape.id, false);
    expect(runtime.widget(shape).richText!.paragraphs[0].runs[0]).toMatchObject({ text: 'New content', style: { fontSize: 20, color: '#123456' } });
  });

  it('keeps excluded cell/submenu/contained visibility but resets their independent move geometry', async () => {
    const { doc, page } = fixture(), table = createWidget('table'), menu = createWidget('menu'), tree = createWidget('tree'), submenu = createWidget('menu');
    submenu.menu!.parentCellId = menu.menu!.table.table!.cells[0].id; menu.menu!.submenus = [submenu];
    const excluded = [table.table!.cells[0], menu.menu!.table, menu.menu!.table.table!.cells[0], tree.tree!.nodes[0].treeNode!.label];
    page.widgets = [table, menu, tree]; const runtime = make(doc, portable, {});
    await runtime.execute(actions(...excluded.flatMap(item => [{ type: 'hide' as const, targetId: item.id }, { type: 'move' as const, targetId: item.id, x: 777 }]), { type: 'show', targetId: submenu.id }, { type: 'move', targetId: submenu.id, x: 888 }));
    await runtime.setViewport({ width: 500 });
    for (const item of excluded) expect(runtime.widget(item)).toMatchObject({ hidden: true, x: item.x });
    expect(runtime.widget(submenu)).toMatchObject({ hidden: false, x: submenu.x });
  });

  it('preserves ordinary input values and hint state when declarations change', async () => {
    const { doc, page } = fixture(), input = createWidget('input'); input.text = ''; input.hintText = 'Hint'; input.hintHideOn = 'focus'; page.widgets = [input];
    const runtime = make(doc, portable, {}); expect(runtime.hint(input.id)).toBe('Hint'); runtime.hideHint(input.id);
    await runtime.setViewport({ width: 500 }); expect(runtime.hint(input.id)).toBeUndefined();
    runtime.input(input.id, 'Kept'); await runtime.setViewport({ width: 1000 }); expect(runtime.controlValue(input.id)).toBe('Kept');
  });

  it('restores authored tree expansion on a different view while keeping panel state', async () => {
    const { doc, page } = fixture(), tree = createWidget('tree'), panel = createWidget('panel'); page.widgets = [tree, panel];
    const node = tree.tree!.nodes[0], second = { id: uid(), name: 'Second', widgets: [] }; panel.states!.push(second);
    const runtime = make(doc, portable, { width: 500 });
    await runtime.execute(actions({ type: 'collapseTreeNode', targetId: node.id }, { type: 'setState', targetId: panel.id, value: second.id }));
    await runtime.setViewport({ width: 550 }); expect(runtime.treeInfo(node.id)!.expanded).toBe(false);
    await runtime.setViewport({ width: 1000 }); expect(runtime.treeInfo(node.id)!.expanded).toBe(node.treeNode!.expanded);
    expect(runtime.widget(panel).activeStateId).toBe(second.id);
  });

  it('refreshes repeater templates with persist=2, resets paging, and retains data/query/marks and state by row identity', async () => {
    const { doc, page } = fixture(), child = createWidget('box'), list = listOf(child); page.widgets = [list];
    child.selectedStyle = { fill: '#ff0000' }; const runtime = make(doc, portable, {}); await runtime.start();
    const first = runtime.rows(list)[0];
    await runtime.execute(actions({ type: 'setText', targetId: child.id, value: 'Temporary' }, { type: 'setSelected', targetId: child.id, value: 'true' }, { type: 'setError', targetId: child.id, value: 'true' }, { type: 'disable', targetId: child.id }, { type: 'markRows', targetId: list.id, value: '{"row":"this"}' }), first.data, first.context);
    await runtime.execute(actions({ type: 'setRepeaterPage', targetId: list.id, value: '2' }));
    // A normal page-action refresh resets row state; install state on this page.
    const last = runtime.rows(list)[0]; await runtime.select(child.id, true, last.context); await runtime.setError(child.id, true, last.context);
    await runtime.execute(actions({ type: 'setText', targetId: child.id, value: 'Temporary' }, { type: 'disable', targetId: child.id }), last.data, last.context);
    const key = Object.keys(runtime.state().sourceRows)[0], rowIds = [...runtime.state().sourceRowIds[key]];
    await runtime.setViewport({ width: 500 });
    expect(runtime.state().sourceRowIds[key]).toEqual(rowIds); expect(runtime.repeaterInfo(list).pageIndex).toBe(1);
    expect(runtime.state().markedRowIds[key]).toContain(first.id);
    expect(runtime.widget(child, last.context)).toMatchObject({ text: child.text, selected: true, error: true, disabled: true });
    expect(runtime.rows(list).map(row => row.id)).toEqual(rowIds.slice(0, 2));
  });

  it('retains nested dataset identity and isolates same-template state between parent rows', async () => {
    const { doc, page } = fixture(), child = createWidget('box'), inner = listOf(child), outer = listOf(inner); page.widgets = [outer];
    const runtime = make(doc, portable, {}); await runtime.start();
    const parents = runtime.rows(outer), a = runtime.rows(inner, parents[0].context)[0], b = runtime.rows(inner, parents[1].context)[0];
    await runtime.select(child.id, true, b.context);
    await runtime.execute(actions({ type: 'addRow', targetId: inner.id, value: '{"Name":"Added"}' }), b.data, b.context);
    await runtime.select(child.id, true, b.context);
    const ids = runtime.rows(inner, parents[1].context).map(row => row.id);
    await runtime.setViewport({ width: 500 });
    expect(runtime.rows(inner, parents[1].context).map(row => row.id)).toEqual(ids);
    expect(runtime.repeaterInfo(inner, parents[1].context).dataCount).toBe(4); expect(runtime.repeaterInfo(inner, parents[0].context).dataCount).toBe(3);
    expect(runtime.widget(child, a.context).selected).not.toBe(true); expect(runtime.widget(child, b.context).selected).toBe(true);
  });

  it.each(['', 'Template'])('reinitializes placeholder display from %j while preserving the native hint paint dictionary', async text => {
    const { doc, page } = fixture(), input = createWidget('input'), list = listOf(input); input.text = text; input.hintText = 'Hint';
    input.style.color = '#123456'; input.hintStyle = { color: '#aabbcc' }; page.widgets = [list];
    const runtime = make(doc, portable, {}); await runtime.start(); const row = runtime.rows(list)[0];
    if (text) await runtime.execute(actions({ type: 'setText', targetId: input.id, value: '' }), row.data, row.context);
    expect(runtime.hint(input.id, row.context)).toBe('Hint');
    await runtime.setViewport({ width: 500 });
    expect(runtime.controlValue(input.id, row.context)).toBe(text || 'Hint');
    expect(runtime.text(`[[Widget.${input.id}.text]]`, row.data, row.context)).toBe(text);
    expect(runtime.hint(input.id, row.context)).toBe(text ? undefined : 'Hint');
    expect(runtime.widget(input, row.context).style.color).toBe('#aabbcc');
    // Only a real placeholder-state transition refreshes the retained paint.
    if (text) runtime.input(input.id, '', undefined, row.context);
    runtime.input(input.id, 'Typed', undefined, row.context);
    expect(runtime.widget(input, row.context).style.color).toBe('#123456');
    await runtime.execute(actions({ type: 'removeFilter', targetId: list.id, value: '{"all":true}' }));
    expect(runtime.widget(input, row.context).style.color).toBe(text ? '#123456' : '#aabbcc');
  });

  it('remeasures registered native text from the new declaration and rolls policy, caches, and text lineage back on failure', async () => {
    const { doc, page } = fixture(), shape = nativeShape(); page.widgets = [shape]; page.adaptiveViews[1].overrides = { [shape.id]: { x: 45, width: 61.125, style: { fontSize: 18 } } };
    const runtime = make(doc, portable, {}), measured: Widget[] = []; let fail = false;
    runtime.bindControls({ flush() {}, focus() {}, selectText() {}, measureShapeText: () => {
      const current = runtime.widget(shape); measured.push(structuredClone(current)); if (fail) throw new Error('measurement failed');
      return { width: current.width, height: 77, rect: current, textAlign: 'left', verticalAlign: 'top' };
    } });
    await runtime.execute(actions({ type: 'setStyle', targetId: shape.id, style: { fontSize: 40 } }, { type: 'setText', targetId: shape.id, value: 'Kept' }, { type: 'move', targetId: shape.id, x: 333 }));
    const before = structuredClone(runtime.state()); fail = true;
    await expect(runtime.setViewport({ width: 500 })).rejects.toThrow('measurement failed');
    expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.state()).toEqual(before); expect(runtime.nativeTextSet(shape.id)).toBe(true);
    expect(runtime.widget(shape)).toMatchObject({ x: 333, style: { fontSize: 40 } });
    fail = false; await runtime.setViewport({ width: 500 });
    expect(measured.at(-1)).toMatchObject({ x: 45, width: 61.125, text: 'Kept', style: { fontSize: 18 } });
    expect(runtime.widget(shape)).toMatchObject({ width: 61.125, height: 77 });
    await runtime.setViewport({ width: 1000 }); expect(runtime.widget(shape).richText!.paragraphs[0].runs[0].style?.fontSize).not.toBe(40);
  });

  it('rolls back a failing persist refresh and can retry without losing datasets or source view', async () => {
    const { doc, page } = fixture(), child = createWidget('box'), list = listOf(child); page.widgets = [list]; doc.variables.Selected = 'true';
    list.interactions = [interaction('itemLoad', { type: 'setSelected', targetId: child.id, value: '[[Selected]]' })];
    const runtime = make(doc, portable, {}); await runtime.start();
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Selected', value: 'invalid' })); const before = structuredClone(runtime.state());
    await expect(runtime.setViewport({ width: 500 })).rejects.toThrow('Invalid selected state');
    expect(runtime.state()).toEqual(before); expect(runtime.adaptiveViewId()).toBeUndefined();
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Selected', value: 'true' })); await runtime.setViewport({ width: 500 });
    expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.widget(child, runtime.rows(list)[0].context).selected).toBe(true);
  });

  it('rolls back navigation view selection when a later action in the same segment fails', async () => {
    const { doc, shape, page } = fixture(), second = createPage('Second'); second.width = 500;
    second.adaptiveViews = [{ id: 'destination-view', name: 'Destination view', width: 600, overrides: {} }]; doc.pages.push(second);
    const runtime = make(doc, portable, {});
    await expect(runtime.execute(actions({ type: 'openPage', targetId: second.id }, { type: 'setSelected', targetId: shape.id, value: 'invalid' }))).rejects.toThrow('Invalid selected state');
    expect(runtime.state().pageId).toBe(page.id); expect(runtime.adaptiveViewId()).toBeUndefined();
    await runtime.navigate(second.id); expect(runtime.adaptiveViewId()).toBe('destination-view');
  });

  it('navigation transaction restores the committed generation after a destination Loaded failure', async () => {
    const { doc, page } = navigationFixture(), runtime = make(doc, portable, {}), saved = serializeDocument(doc);
    await runtime.start(); await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'yes' }));
    const before = structuredClone(runtime.state());
    await expect(runtime.setViewport({ width: 500 })).rejects.toThrow('Invalid selected state');
    expect(runtime.state()).toEqual(before); expect(runtime.adaptiveViewId()).toBeUndefined();
    // This event must not settle a phantom navigation and replay source Loaded/ItemLoaded.
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'no' }));
    expect(runtime.state().pageId).toBe(page.id);
    expect(runtime.state().variables).toMatchObject({ Loads: '1', ItemLoads: '1', Go: 'no' });
    expect(serializeDocument(doc)).toBe(saved);
  });

  it('navigation transaction retains old Waits and cancels only continuations created by the failed outer transaction', async () => {
    vi.useFakeTimers();
    const { doc, destination, failure } = navigationFixture();
    destination.interactions = [interaction('load', { type: 'wait', duration: 100 }, { type: 'setVariable', targetId: 'Trace', value: 'new-tail' }), failure];
    const runtime = make(doc, portable, {}); await runtime.start();
    let oldFinished = false;
    const old = runtime.execute(actions({ type: 'wait', duration: 100 }, { type: 'setVariable', targetId: 'Trace', value: 'old-tail' })).then(() => { oldFinished = true; });
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'yes' }));
    await expect(runtime.setViewport({ width: 500 })).rejects.toThrow('Invalid selected state');
    expect(oldFinished).toBe(false); expect(vi.getTimerCount()).toBe(1);
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'no' }));
    await vi.advanceTimersByTimeAsync(100); await old;
    expect(runtime.state().variables).toMatchObject({ Trace: 'old-tail', Loads: '1', ItemLoads: '1' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])('navigation transaction restores selectable old menus and removes new menus (old menu: %s)', async oldMenu => {
    const { doc, page, shape, destination, target, failure } = navigationFixture(); doc.caseSelection = 'auto';
    shape.interactions = [actions({ type: 'setVariable', targetId: 'Trace', value: 'old-choice' }), actions({ type: 'setVariable', targetId: 'Trace', value: 'other-old-choice' })];
    const newMenu = createWidget('button');
    newMenu.interactions = [interaction('load', { type: 'setVariable', targetId: 'Trace', value: 'new-choice' }), interaction('load', { type: 'setVariable', targetId: 'Trace', value: 'other-new-choice' })];
    target.interactions = [failure]; destination.interactions = []; destination.widgets = [newMenu, target];
    const runtime = make(doc, portable, {}); await runtime.start();
    if (oldMenu) await runtime.trigger(shape.id, 'click');
    const before = structuredClone(runtime.state().caseMenus), transientMenus: { id: string; option: string }[] = [];
    runtime.subscribe(() => { for (const menu of runtime.state().caseMenus ?? []) if (menu.sourceId === newMenu.id) transientMenus.push({ id: menu.id, option: menu.options[0].id }); });
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'yes' }));
    await expect(runtime.setViewport({ width: 500 })).rejects.toThrow('Invalid selected state');
    expect(transientMenus.length).toBeGreaterThan(0);
    expect(runtime.state().caseMenus).toEqual(before);
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'no' }));
    for (const menu of transientMenus) await runtime.selectCase(menu.id, menu.option);
    expect(runtime.state().variables.Trace).toBe('');
    if (before) {
      await runtime.selectCase(before[0].id, before[0].options[0].id);
      expect(runtime.state().variables.Trace).toBe('old-choice');
    }
    expect(runtime.state().pageId).toBe(page.id); expect(runtime.state().variables.Loads).toBe('1');
    // A stale button from the rejected render must never alias a future menu.
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Invalid', value: 'true' })); await runtime.navigate(destination.id);
    const committed = runtime.state().caseMenus![0];
    expect(transientMenus[0].id).not.toBe(committed.id);
    await runtime.selectCase(transientMenus[0].id, transientMenus[0].option);
    expect(runtime.state().caseMenus![0].id).toBe(committed.id);
  });

  it.each(['viewport', 'ordinary'] as const)('navigation transaction commits %s navigation, cancels old Wait/menu, and retains destination Wait/menu', async mode => {
    vi.useFakeTimers();
    const { doc, shape, destination, target } = navigationFixture(); doc.caseSelection = 'auto';
    shape.interactions = [actions({ type: 'setVariable', targetId: 'Trace', value: 'stale-choice' }), actions()];
    destination.interactions = [interaction('load', { type: 'wait', duration: 100 }, { type: 'setVariable', targetId: 'Trace', value: 'destination-tail' })];
    target.interactions = [interaction('load', { type: 'setVariable', targetId: 'Choice', value: 'destination-choice' }), interaction('load')];
    const runtime = make(doc, portable, {}); await runtime.start(); await runtime.trigger(shape.id, 'click');
    const oldMenu = runtime.state().caseMenus![0]; let oldFinished = false;
    const old = runtime.execute(actions({ type: 'wait', duration: 100 }, { type: 'setVariable', targetId: 'Trace', value: 'stale-tail' })).then(() => { oldFinished = true; });
    await runtime.execute(actions({ type: 'setVariable', targetId: 'Go', value: 'yes' }));
    const transition = mode === 'viewport' ? runtime.setViewport({ width: 500 }) : runtime.navigate(destination.id);
    await runtime.execute(actions()); // Queue barrier, without awaiting the new page's pending Wait.
    await old; expect(oldFinished).toBe(true); expect(vi.getTimerCount()).toBe(1);
    expect(runtime.state().pageId).toBe(destination.id);
    const newMenu = runtime.state().caseMenus![0]; expect(newMenu.sourceId).toBe(target.id);
    await runtime.selectCase(oldMenu.id, oldMenu.options[0].id); expect(runtime.state().variables.Trace).toBe('');
    await runtime.selectCase(newMenu.id, newMenu.options[0].id); expect(runtime.state().variables.Choice).toBe('destination-choice');
    await vi.advanceTimersByTimeAsync(100); await transition;
    expect(runtime.state().variables.Trace).toBe('destination-tail'); expect(vi.getTimerCount()).toBe(0);
  });
});
