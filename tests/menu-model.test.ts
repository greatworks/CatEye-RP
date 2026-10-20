import { describe, expect, it } from 'vitest';
import { cloneWidgets, collectWidgetIdentifiers, createDocument, createWidget, deleteWidgetTree, findWidget, mapWidgets, parseDocument, serializeDocument, uid } from '../src/model/document';
import { addSubmenu, createMenu, deleteMenuItem, deleteSubmenu, findMenu, insertMenuItem, layoutMenu, menuSharedDescendantIds, moveMenuItem, patchMenuItems, resizeMenu, setMenuOrientation, setMenuPadding, updateMenu } from '../src/model/menu';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance } from '../src/model/components';
import type { Widget } from '../src/model/types';
import { menuFixture } from './fixtures/menus';

const cells = (menu: Widget) => menu.menu!.table.table!.cells;
const roundtrip = (menu: Widget) => { const doc = createDocument(); doc.pages[0].widgets = [menu]; return parseDocument(serializeDocument(doc)).pages[0].widgets[0]; };
function nested() {
  let root = createMenu();
  root = addSubmenu(root, cells(root)[1].id);
  const sub = root.menu!.submenus[0];
  return updateMenu(root, sub.id, menu => addSubmenu(menu, cells(menu)[2].id));
}

describe('classic menu geometry and structure', () => {
  it.each(['horizontal', 'vertical'] as const)('retains independent identities and defaults for %s', orientation => {
    const menu = createMenu(orientation, 12, 34);
    expect(menu.type).toBe('menu'); expect(cells(menu)).toHaveLength(3);
    expect(menu.menu!.submenus).toEqual([]); expect(menu.menu!.padding).toEqual([0, 0, 0, 0]);
    expect([menu.width, menu.height]).toEqual(orientation === 'horizontal' ? [300, 30] : [100, 90]);
    expect(collectWidgetIdentifiers([menu]).size).toBe(5);
    expect(roundtrip(menu)).toEqual(menu);
  });
  it('creates the generic menu widget with the horizontal orientation', () => {
    const menu = createWidget('menu', 2, 3);
    expect(menu.menu!.orientation).toBe('horizontal'); expect([menu.x, menu.y]).toEqual([2, 3]);
  });
  it('starts with the witnessed native menu item appearance rather than an invented hover fill', () => {
    const menu = createMenu();
    for (const cell of cells(menu)) { expect(cell.style).toMatchObject({ fill: '#ffffff00', stroke: '#797979', strokeWidth: 1, borderWidths: [1, 1, 1, 1], color: '#333333', fontSize: 13, fontFamily: 'Arial', fontWeight: 400, textAlign: 'left', verticalAlign: 'middle', textPadding: [2, 2, 2, 2] }); expect(cell.mouseOverStyle).toBeUndefined(); }
  });
  it('positions child and grandchild menus without inflating their parent bounds', () => {
    const root = nested(), sub = root.menu!.submenus[0], deeper = sub.menu!.submenus[0];
    expect([root.width, root.height]).toEqual([300, 30]);
    expect([sub.x, sub.y, sub.width, sub.height]).toEqual([100, 30, 100, 90]);
    expect([deeper.x, deeper.y]).toEqual([100, 60]);
    expect(deeper.menu!.parentCellId).toBe(cells(sub)[2].id);
    expect(roundtrip(root)).toEqual(root);
  });
  it('applies independent padding and resizes tracks inside the outer bounds', () => {
    const root = setMenuPadding(nested(), [4, 8, 12, 16]);
    expect([root.width, root.height, root.menu!.table.x, root.menu!.table.y]).toEqual([324, 46, 16, 4]);
    expect([root.menu!.submenus[0].x, root.menu!.submenus[0].y]).toEqual([116, 34]);
    const resized = resizeMenu(root, 624, 76);
    expect(resized.menu!.table.table!.columnWidths).toEqual([200, 200, 200]);
    expect(resized.menu!.table.table!.rowHeights).toEqual([60]);
    expect(roundtrip(resized)).toEqual(resized);
  });
  it('preserves parent links and identities during insertion, movement and deletion', () => {
    const root = nested(), owner = cells(root)[1].id, subId = root.menu!.submenus[0].id;
    const inserted = insertMenuItem(root, 1);
    expect(cells(inserted)).toHaveLength(4); expect(inserted.menu!.submenus[0].menu!.parentCellId).toBe(owner);
    expect(new Set(cells(inserted).map(cell => cell.id)).size).toBe(4);
    const moved = moveMenuItem(inserted, 2, 0);
    expect(cells(moved)[0].id).toBe(owner); expect(moved.menu!.submenus[0].x).toBe(0);
    expect(findMenu(moved, subId)?.id).toBe(subId);
    const deleted = deleteMenuItem(moved, owner);
    expect(deleted.menu!.submenus).toEqual([]); expect(cells(deleted)).toHaveLength(3);
    expect(roundtrip(deleted)).toEqual(deleted);
  });
  it('edits menu items while preserving the complete grid and rich text invariant', () => {
    const root = nested(), first = cells(root)[0];
    const edited = patchMenuItems(root, [first.id], { text: '项目', width: 150, height: 40 });
    expect(cells(edited)[0].text).toBe('项目'); expect(edited.width).toBe(350); expect(edited.height).toBe(40);
    expect(cells(edited).every(cell => cell.height === 40)).toBe(true); expect(roundtrip(edited)).toEqual(edited);
  });
  it('changes orientation without losing item content or submenu associations', () => {
    const root = nested(), vertical = setMenuOrientation(root, 'vertical');
    expect(cells(vertical).map(cell => cell.id)).toEqual(cells(root).map(cell => cell.id));
    expect([vertical.width, vertical.height]).toEqual([100, 90]);
    expect([vertical.menu!.submenus[0].x, vertical.menu!.submenus[0].y]).toEqual([100, 30]);
    expect(roundtrip(vertical)).toEqual(vertical);
  });
  it('removes a complete submenu subtree while retaining its parent item', () => {
    const root = nested(), result = deleteSubmenu(root, cells(root)[1].id);
    expect(cells(result)).toEqual(cells(root)); expect(result.menu!.submenus).toEqual([]);
  });
  it('rejects invalid authoring edits and an empty menu', () => {
    const root = nested(), owner = cells(root)[1].id;
    expect(() => addSubmenu(root, owner)).toThrow('already'); expect(() => addSubmenu(root, 'missing')).toThrow();
    expect(() => insertMenuItem(root, -1)).toThrow(); expect(() => moveMenuItem(root, 0, 3)).toThrow();
    expect(() => patchMenuItems(root, [owner], { menu: root.menu })).toThrow();
    expect(() => setMenuPadding(root, [-1, 0, 0, 0])).toThrow(); expect(() => resizeMenu(root, Infinity, 30)).toThrow();
    const two = deleteMenuItem(root, cells(root)[0].id), one = deleteMenuItem(two, cells(two)[0].id);
    expect(() => deleteMenuItem(one, cells(one)[0].id)).toThrow(); expect(() => updateMenu(root, 'missing', menu => menu)).toThrow();
  });
});

describe('menu document and component integration', () => {
  it('walks every interior object and remaps submenu ownership and cross-level actions', () => {
    const root = nested(), target = cells(root.menu!.submenus[0].menu!.submenus[0])[1];
    cells(root)[0].interactions = [{ id: uid(), event: 'click', name: 'Update descendant', enabled: true, conditionMode: 'all', conditions: [{ source: 'widgetText', key: target.id, operator: 'isEmpty', value: '' }], actions: [{ id: uid(), type: 'setText', targetId: target.id, value: 'updated' }] }];
    const ids: string[] = []; mapWidgets([root], widget => { ids.push(widget.id); return widget; });
    expect(ids).toHaveLength(15); expect(findWidget({ widgets: [root] }, target.id)).toBe(target);
    const clone = cloneWidgets([root], 20)[0], sub = clone.menu!.submenus[0], deepest = sub.menu!.submenus[0];
    expect(clone.x).toBe(root.x + 20); expect(sub.menu!.parentCellId).toBe(cells(clone)[1].id); expect(deepest.menu!.parentCellId).toBe(cells(sub)[2].id);
    expect(cells(clone)[0].interactions[0].actions[0].targetId).toBe(cells(deepest)[1].id);
    expect(cells(clone)[0].interactions[0].conditions[0].key).toBe(cells(deepest)[1].id);
    expect(roundtrip(clone)).toEqual(clone); expect(deleteWidgetTree([root], [root.id])).toEqual([]);
    expect(() => deleteWidgetTree([root], [root.menu!.table.id])).toThrow('menu');
    expect(() => deleteWidgetTree([root], [target.id])).toThrow('menu');
  });
  it('materializes every menu identity inside a reusable component', () => {
    const root = nested(), component = createComponent([root], 'Navigation'), instance = createComponentInstance(component);
    const doc = createDocument(); doc.components = [component]; doc.pages[0].widgets = [instance];
    expect(Object.keys(instance.componentInstance!.sourceIds)).toHaveLength(15);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('shares menu geometry, padding, item styles and submenu placement across views', () => {
    const root = nested(), doc = createDocument(); doc.pages[0].widgets = [root];
    const page = createAdaptiveView(doc.pages[0]), view = page.adaptiveViews[0];
    let edited = setMenuPadding(root, [10, 20, 30, 40]); edited = patchMenuItems(edited, [cells(root)[0].id], { text: 'Shared' }); edited.hidden = true;
    edited.menu!.submenus[0].hidden = true;
    const next = applyAdaptiveWidgetEdits(page, view.id, [edited]);
    expect(next.widgets[0].menu!.padding).toEqual([10, 20, 30, 40]); expect(cells(next.widgets[0])[0].text).toBe('Shared');
    expect(next.widgets[0].menu!.submenus[0].hidden).toBe(true); expect(next.widgets[0].hidden).toBe(false);
    expect(next.adaptiveViews[0].overrides).toEqual({ [root.id]: { hidden: true } });
    expect(resolveAdaptiveWidgets(next, view.id)[0].hidden).toBe(true); expect(menuSharedDescendantIds([root]).size).toBe(14);
    doc.pages = [next]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    view.overrides[root.menu!.table.id] = { hidden: true }; doc.pages = [page]; expect(() => parseDocument(serializeDocument(doc))).toThrow('menu');
  });
  it.each([
    (root: Widget) => { root.menu!.table.x = 1; },
    (root: Widget) => { root.width++; },
    (root: Widget) => { root.menu!.padding = [1, 0, 0, 0]; },
    (root: Widget) => { root.menu!.orientation = 'vertical'; },
    (root: Widget) => { root.menu!.submenus[0].menu!.parentCellId = 'missing'; },
    (root: Widget) => { delete root.menu!.submenus[0].menu!.parentCellId; },
    (root: Widget) => { root.menu!.parentCellId = cells(root)[0].id; },
    (root: Widget) => { root.menu!.submenus[0].rotation = 10; },
    (root: Widget) => { root.menu!.table.id = root.id; },
    (root: Widget) => { root.menu!.table.menu = structuredClone(root.menu!); },
  ])('rejects malformed menu structures %#', corrupt => {
    const root = nested(); corrupt(root); expect(() => roundtrip(root)).toThrow();
  });
  it('accepts shown/hidden event graphs on menu containers', () => {
    const root = createMenu(); root.interactions = ['show', 'hide'].map(event => ({ id: uid(), event: event as 'show' | 'hide', name: event, enabled: true, conditionMode: 'all', conditions: [], actions: [] }));
    expect(roundtrip(root)).toEqual(root);
  });
  it('round-trips the complete authoring and runtime demonstration', () => {
    const doc = menuFixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('enforces the document nesting limit for recursive submenus', () => {
    let root = createMenu(), current = root.id;
    for (let index = 0; index < 13; index++) { root = updateMenu(root, current, menu => addSubmenu(menu, cells(menu)[0].id)); current = findMenu(root, current)!.menu!.submenus[0].id; }
    expect(() => roundtrip(root)).toThrow('nesting');
  });
});
