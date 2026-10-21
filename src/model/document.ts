import type {
  Action, ActionType, AdaptiveView, AdaptiveViewSet, AdaptiveViewDefinition, AdaptiveWidgetOverride, Component, Condition, Document, EventType,
  Interaction, InteractionStyleState, Page, PageFolder, PanelState, RepeaterData, RepeaterRowSelector, RepeaterFilterSpec, RepeaterSortSpec, RepeaterRuleRemoval, Widget, WidgetStyle, WidgetType, RichText, RichTextLink, FrameTarget,
  MotionExpression, MotionBoundary, MoveActionSpec, ResizeActionSpec, MoveTarget, ResizeTarget,
} from './types';
import { INPUT_TYPES, LINE_PATTERNS, ARROW_STYLES, ROTATION_ANCHORS, ROTATION_EASINGS, MOVE_MODES, MOVE_TRAJECTORIES, PIN_HORIZONTAL_VALUES, PIN_VERTICAL_VALUES } from './types';
import { isShadowColor } from './shadow-color';

import { parseVectorPath } from './vector';
import { normalizePageTree } from './page-tree-core';
import { layoutTable, TABLE_LIMITS } from './table';
import { createMenu, menuData, menuSharedDescendantIds } from './menu';
import { createTree, createTreeNode, treeSharedDescendantIds } from './tree-widget';
import { frameFileUrl } from './inline-frame';
import { mapWidgetChildren, widgetChildCollections, translateWidget } from './widget-structure';
import { fitLayerBounds, fitLayerTree } from './layer-geometry';
import { RICH_TEXT_STYLE_KEYS, RICH_TEXT_WIDGET_TYPES, richTextPlainText, mapRichTextMatches, projectTextStyleOverride } from './rich-text';

export const DOCUMENT_LIMITS = {
  characters: 20 * 1024 * 1024, pages: 200, pageFolders: 200, widgets: 10_000, depth: 12,
  rows: 10_000, actions: 200, text: 100_000, image: 8 * 1024 * 1024,
} as const;

const WIDGET_TYPES: WidgetType[] = ['box', 'ellipse', 'path', 'text', 'button', 'image', 'placeholder', 'line', 'input', 'textarea', 'checkbox', 'radio', 'select', 'hotspot', 'panel', 'repeater', 'table', 'tableCell', 'menu', 'tree', 'treeNode'];
const ACTION_TYPES: ActionType[] = ['openUrl', 'openPage', 'show', 'hide', 'toggle', 'setText', 'setSelectedOption', 'setFocus', 'setState', 'nextState', 'previousState', 'setVariable', 'move', 'resize', 'resizeItem', 'setStyle', 'enable', 'disable', 'wait', 'addRow', 'deleteRow', 'sortRows', 'filterRows', 'updateRow', 'setSelected', 'setError', 'markRows', 'unmarkRows', 'setRepeaterPage', 'setItemsPerPage', 'addFilter', 'removeFilter', 'addSort', 'removeSort', 'expandTreeNode', 'collapseTreeNode', 'toggleTreeNode'];
const NAMED_REPEATER_ACTIONS = ['addFilter', 'removeFilter', 'addSort', 'removeSort'];
const EVENTS: EventType[] = ['click', 'doubleClick', 'mouseEnter', 'mouseLeave', 'change', 'focus', 'blur', 'load', 'itemLoad', 'itemResize', 'resize', 'move', 'selectedChange', 'select', 'unselect', 'errorSet', 'errorRemoved', 'show', 'hide'];
const STYLE_KEYS = ['fill', 'fillGradient', 'stroke', 'strokeGradient', 'linePattern', 'lineEnds', 'borderVisibility', 'strokeWidth', 'borderWidths', 'radius', 'cornerRadii', 'cornerVisibility', 'textPadding', 'verticalAlign', 'lineHeight', 'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'underline', 'strikethrough', 'textAlign', 'opacity', 'outerShadow', 'innerShadow', 'textShadow', 'selectionButtonSize'];
const AUTHOR_STYLE_KEYS = ['pinHorizontal', 'pinVertical', 'fixedWidth', 'fixedHeight'];
const WIDGET_KEYS = ['id', 'type', 'name', 'text', 'x', 'y', 'width', 'height', 'rotation', 'style', 'placed', 'hidden', 'locked', 'disabled', 'notes', 'interactions', 'groupId', 'imageSrc', 'options', 'selectMode', 'multiple', 'selectedIndices', 'checked', 'selected', 'selectionGroup', 'radioGroup', 'selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'disabledStyle', 'error', 'errorStyle', 'hintText', 'hintHideOn', 'hintStyle', 'inputType', 'readOnly', 'maxLength', 'submitButtonId', 'states', 'activeStateId', 'repeater', 'fitToContent', 'componentId', 'componentInstance', 'vectorPath'];
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
WIDGET_KEYS.push('richText', 'table', 'menu', 'tree', 'treeNode');
WIDGET_TYPES.push('inlineFrame', 'layer');
ACTION_TYPES.push('openLinkInFrame', 'setAdaptiveView', 'rotate');
EVENTS.push('adaptiveViewChange', 'rotate');
EVENTS.push('dragStart', 'drag', 'dragDrop', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown');
WIDGET_KEYS.push('inlineFrame', 'shapeText', 'selectionText', 'layer');

export function uid(): string {
  return globalThis.crypto.randomUUID();
}

export function defaultStyle(): WidgetStyle {
  return { fill: '#ffffff', stroke: '#b8bdc7', strokeWidth: 1, radius: 0, color: '#263348', fontSize: 14, fontFamily: 'Arial', fontWeight: 400, textAlign: 'center', opacity: 1 };
}

/** Explicit solid fill/common radius/stroke values replace their richer paint unless supplied together. */
export function mergeWidgetStyle(base: WidgetStyle, patch?: Partial<WidgetStyle>): WidgetStyle {
  const next = { ...base, ...patch };
  if (patch && Object.hasOwn(patch, 'fill') && !Object.hasOwn(patch, 'fillGradient')) delete next.fillGradient;
  if (patch && Object.hasOwn(patch, 'stroke') && !Object.hasOwn(patch, 'strokeGradient')) delete next.strokeGradient;
  if (patch && Object.hasOwn(patch, 'radius') && !Object.hasOwn(patch, 'cornerRadii')) delete next.cornerRadii;
  if (patch && Object.hasOwn(patch, 'strokeWidth') && !Object.hasOwn(patch, 'borderWidths')) delete next.borderWidths;
  return next;
}

/**
 * Compose once from the base (including adaptive/action edits), never from a
 * previously resolved style. State patches inherit unspecified base properties.
 */
export function resolveInteractionStylePatch(widget: Widget, state: InteractionStyleState = {}): Partial<WidgetStyle> {
  let result = {} as WidgetStyle;
  const apply = (patch?: Partial<WidgetStyle>) => { if (patch) result = mergeWidgetStyle(result, patch); };
  if (!widget.disabled) {
    // DOM focus alone does not suppress mouse states when no focus effect exists.
    if (state.focused && widget.focusedStyle && Object.keys(widget.focusedStyle).length) apply(widget.focusedStyle);
    else {
      if (state.mouseOver) apply(widget.mouseOverStyle);
      if (state.mouseDown) apply(widget.mouseDownStyle);
    }
  }
  // Live checkable controls may deliberately have distinct checked/style states.
  const selected = widget.type === 'checkbox' || widget.type === 'radio' ? widget.selected ?? widget.checked : widget.selected;
  if (selected) apply(widget.selectedStyle);
  if (widget.error) apply(widget.errorStyle);
  if (state.hint && widget.hintText && (widget.type === 'textarea' || widget.type === 'input' && widget.inputType !== 'file')) apply({ color: '#999999', ...widget.hintStyle });
  if (widget.disabled) apply(widget.disabledStyle);
  return result;
}

export function resolveInteractionStyle(widget: Widget, state: InteractionStyleState = {}): WidgetStyle {
  const patch = projectTextStyleOverride(resolveInteractionStylePatch(widget, state));
  return Object.keys(patch).length ? mergeWidgetStyle(widget.style, patch) : widget.style;
}

/** Static editor projection; live runtimes supply an already resolved visual style. */
export function resolveSelectedStyle(widget: Widget): WidgetStyle {
  return resolveInteractionStyle(widget, { hint: (widget.type === 'input' || widget.type === 'textarea') && Boolean(widget.hintText) && widget.text === '' });
}

/** Saved option identity takes precedence over text; legacy text is an exact first match. */
export function getSelectedOptionIndices(widget: Widget, resolvedText = widget.text): number[] {
  if (widget.type !== 'select') return [];
  if (widget.selectedIndices !== undefined) return [...widget.selectedIndices];
  const index = (widget.options ?? []).indexOf(resolvedText);
  return index < 0 ? [] : [index];
}

export function createWidget(type: WidgetType, x = 100, y = 100): Widget {
  if (!WIDGET_TYPES.includes(type)) throw new Error(`Unknown widget type: ${type}`);
  const widget: Widget = {
    id: uid(), type, name: type.charAt(0).toUpperCase() + type.slice(1),
    text: '', x, y, width: 180, height: 90, rotation: 0, style: defaultStyle(),
    hidden: false, locked: false, disabled: false, notes: '', interactions: [],
  };
  switch (type) {
    case 'layer': Object.assign(widget, { name: 'Group', x: 0, y: 0, width: 0, height: 0, layer: { widgets: [] }, style: { ...widget.style, fill: 'transparent', strokeWidth: 0 } }); break;
    case 'menu': return createMenu('horizontal', x, y);
    case 'tree': return createTree(x, y);
    case 'treeNode': return { ...createTreeNode(), x, y };
    case 'inlineFrame': Object.assign(widget, { name: 'Inline frame', width: 300, height: 170, style: { ...widget.style, fill: 'transparent', strokeWidth: 0 }, inlineFrame: { hideBorders: false, scrolling: 'auto', preview: { kind: 'none' } } }); break;
    case 'tableCell': Object.assign(widget, { width: 100, height: 30, style: { ...widget.style, stroke: '#797979', color: '#333333', fontSize: 13 } }); break;
    case 'table': {
      widget.style = { ...widget.style, fill: 'transparent', strokeWidth: 0 };
      widget.table = { columnWidths: [100,100,100], rowHeights: [30,30,30], cells: Array.from({ length: 9 }, (_, index) => ({ ...createWidget('tableCell',0,0), name: `Cell ${Math.floor(index/3)+1},${index%3+1}`, text: index < 3 ? `Column ${index+1}` : '' })) };
      return layoutTable(widget);
    }
    case 'text': Object.assign(widget, { text: 'Text', width: 220, height: 32, style: { ...widget.style, fill: 'transparent', strokeWidth: 0, textAlign: 'left' } }); break;
    case 'button': Object.assign(widget, { text: 'Button', width: 140, height: 40, style: { ...widget.style, fill: '#5b5ce2', stroke: '#5b5ce2', color: '#ffffff', radius: 5, fontWeight: 600 } }); break;
    case 'ellipse': Object.assign(widget, { width: 100, height: 100 }); break;
    case 'path': widget.vectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: .5, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] }; break;
    case 'line': Object.assign(widget, { width: 180, height: 2, style: { ...widget.style, fill: '#b8bdc7' } }); break;
    case 'input': Object.assign(widget, { text: '', width: 220, height: 38, style: { ...widget.style, textAlign: 'left', radius: 4 } }); break;
    case 'textarea': Object.assign(widget, { width: 260, height: 100, style: { ...widget.style, textAlign: 'left', radius: 4 } }); break;
    case 'checkbox': Object.assign(widget, { text: 'Checkbox', checked: false, width: 180, height: 26, style: { ...widget.style, fill: 'transparent', strokeWidth: 0, textAlign: 'left' } }); break;
    case 'radio': Object.assign(widget, { text: 'Radio button', checked: false, width: 180, height: 26, style: { ...widget.style, fill: 'transparent', strokeWidth: 0, textAlign: 'left' } }); break;
    case 'select': Object.assign(widget, { text: 'Option 1', options: ['Option 1', 'Option 2', 'Option 3'], selectedIndices: [0], width: 220, height: 38, style: { ...widget.style, textAlign: 'left', radius: 4 } }); break;
    case 'image': Object.assign(widget, { width: 240, height: 160 }); break;
    case 'placeholder': Object.assign(widget, { text: 'Image', width: 240, height: 160, style: { ...widget.style, fill: '#f1f3f6' } }); break;
    case 'hotspot': Object.assign(widget, { width: 180, height: 90, style: { ...widget.style, fill: 'transparent', strokeWidth: 0 } }); break;
    case 'panel': {
      const stateId = uid();
      Object.assign(widget, { width: 320, height: 180, states: [{ id: stateId, name: 'State 1', widgets: [] }], activeStateId: stateId, style: { ...widget.style, fill: 'transparent', strokeWidth: 0 } });
      break;
    }
    case 'repeater': {
      const label = createWidget('text', 16, 9);
      label.text = '[[Item.Name]]'; label.width = 248;
      const itemWidth = label.x + label.width, itemHeight = label.y + label.height;
      Object.assign(widget, { width: itemWidth, height: itemHeight * 3, style: { ...widget.style, fill: 'transparent', strokeWidth: 0 }, repeater: { columns: ['Name'], rows: [{ Name: 'Item 1' }, { Name: 'Item 2' }, { Name: 'Item 3' }], template: [label], layout: 'vertical', itemWidth, itemHeight, gap: 0, fitToContent: true } });
      break;
    }
  }
  return widget;
}

export function createPage(name = 'Page 1'): Page {
  return { id: uid(), name, width: 1200, height: 900, background: '#ffffff', widgets: [], notes: '', interactions: [], adaptiveViews: [], adaptiveSelection: 'native-size', adaptiveBaseSize: { width: 0, height: 0 } };
}

export function createDocument(): Document {
  return { format: 'rea-prototype', version: 1, id: uid(), name: 'Untitled', caseSelection: 'auto', pages: [createPage()], components: [], variables: {}, styles: [] };
}

function interaction(name: string, actions: Omit<Action, 'id'>[], event: EventType = 'click'): Interaction {
  return { id: uid(), event, name, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}

export function createDemoDocument(): Document {
  const doc = createDocument();
  doc.name = 'Product workspace';
  doc.variables = { UserName: 'Alex', ProjectCount: '3' };
  const page = doc.pages[0]; page.name = 'Dashboard'; page.width = 1100; page.height = 840; page.background = '#f7f8fc';
  const details = createPage('Project details'); details.width = 1100; details.height = 840;
  doc.pages.push(details);
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width: number, height: number, style: Partial<WidgetStyle> = {}) => {
    const w = createWidget(type, x, y); Object.assign(w, { name, text, width, height, style: { ...w.style, ...style } }); return w;
  };
  const nav = make('box', 'Navigation background', '', 0, 0, 1100, 74, { fill: '#ffffff', stroke: '#e5e7ee' });
  const logo = make('text', 'Brand', '◈  Horizon', 36, 21, 180, 32, { fontSize: 23, fontWeight: 700, color: '#4245b8' });
  const navItems = make('text', 'Navigation', 'Overview      Projects      Team', 266, 26, 400, 26, { color: '#68728a', fontSize: 14 });
  const avatar = make('ellipse', 'Avatar', 'AL', 1006, 18, 38, 38, { fill: '#ebeaff', strokeWidth: 0, color: '#595be0', fontWeight: 600 });
  const eyebrow = make('text', 'Eyebrow', 'WORKSPACE OVERVIEW', 44, 109, 380, 22, { fontSize: 11, fontWeight: 700, color: '#858da4' });
  const title = make('text', 'Page title', 'Good morning, [[UserName]]', 44, 137, 580, 48, { fontSize: 30, fontWeight: 700, color: '#252b42' });
  const subtitle = make('text', 'Page subtitle', 'Here’s what’s happening with your projects today.', 44, 191, 660, 27, { color: '#81889b', fontSize: 14 });
  const newProject = make('button', 'New project', '+  New project', 866, 151, 190, 42);
  const metrics = [
    ['Active projects', '12', '+ 2 this month'], ['Tasks completed', '84', '↑ 18% this month'], ['Team members', '08', 'Across 3 projects'],
  ].flatMap(([label, value, detail], index) => {
    const x = 44 + index * 346;
    return [
      make('box', `${label} card`, '', x, 253, 320, 128, { fill: '#ffffff', stroke: '#e5e7ef', radius: 8 }),
      make('text', `${label} label`, label, x + 22, 273, 276, 22, { color: '#798298', fontSize: 13 }),
      make('text', `${label} value`, value, x + 22, 305, 90, 45, { fontSize: 30, fontWeight: 700 }),
      make('text', `${label} trend`, detail, x + 138, 324, 166, 20, { fontSize: 11, color: '#469676' }),
    ];
  });
  const section = make('text', 'Section title', 'Recent projects', 44, 415, 360, 34, { fontSize: 20, fontWeight: 700 });
  const repeater = make('repeater', 'Project list', '', 44, 467, 630, 235, { fill: '#ffffff', stroke: '#e5e7ef', radius: 8 });
  const rowTitle = make('text', 'Project name', '[[Item.Name]]', 20, 16, 330, 23, { fontWeight: 600 });
  const rowStatus = make('text', 'Project status', '[[Item.Status]]', 410, 17, 176, 22, { fontSize: 12, color: '#7d86a0', textAlign: 'right' });
  rowTitle.interactions = [interaction('Open project details', [{ type: 'openPage', targetId: details.id }])];
  repeater.repeater = { columns: ['Name', 'Status'], rows: [{ Name: 'Website redesign', Status: 'In progress' }, { Name: 'Mobile experience', Status: 'In review' }, { Name: 'Design system', Status: 'Planning' }], template: [rowTitle, rowStatus], itemHeight: 65, gap: 8 };
  const panel = make('panel', 'Welcome panel', '', 698, 467, 358, 235, { fill: '#eeedff', strokeWidth: 0, radius: 8 });
  const next = make('button', 'Panel next', 'See what’s new →', 25, 167, 180, 36, { fill: '#ffffff', color: '#5b5ce2', strokeWidth: 0 });
  next.interactions = [interaction('Next welcome state', [{ type: 'nextState', targetId: panel.id }])];
  const first = { id: uid(), name: 'Welcome', widgets: [make('text', 'Welcome title', 'Make something great.', 25, 28, 310, 38, { fontSize: 23, fontWeight: 700, color: '#4447a1' }), make('text', 'Welcome text', 'Your next idea starts here.\nTurn a sketch into an experience.', 25, 78, 304, 62, { color: '#72749c', fontSize: 14 }), next] };
  const back = make('button', 'Panel back', 'Back to welcome', 25, 167, 180, 36, { fill: '#ffffff', color: '#5b5ce2', strokeWidth: 0 });
  back.interactions = [interaction('Previous welcome state', [{ type: 'previousState', targetId: panel.id }])];
  const second = { id: uid(), name: 'What’s new', widgets: [make('text', 'News title', 'A little more dynamic.', 25, 28, 310, 38, { fontSize: 23, fontWeight: 700, color: '#4447a1' }), make('text', 'News body', 'This panel has two states.\nButtons change the active state.', 25, 78, 304, 62, { color: '#72749c', fontSize: 14 }), back] };
  panel.states = [first, second]; panel.activeStateId = first.id;
  const footer = make('text', 'Footer', 'Horizon workspace  /  Interactive prototype', 44, 767, 750, 22, { fontSize: 11, color: '#a3aabb' });
  newProject.interactions = [interaction('Create a project', [{ type: 'openPage', targetId: details.id }])];
  page.widgets = [nav, logo, navItems, avatar, eyebrow, title, subtitle, newProject, ...metrics, section, repeater, panel, footer];
  const backPage = make('button', 'Back to dashboard', '← Dashboard', 44, 32, 160, 40, { fill: '#ffffff', color: '#5b5ce2' });
  backPage.interactions = [interaction('Back', [{ type: 'openPage', targetId: page.id }])];
  const heading = make('text', 'Details title', 'Create a new project', 44, 123, 650, 50, { fontSize: 30, fontWeight: 700 });
  const label = make('text', 'Name label', 'Project name', 44, 209, 400, 30, { fontWeight: 600 });
  const input = make('input', 'Project name input', '', 44, 249, 470, 44);
  const desc = make('textarea', 'Description', '', 44, 331, 470, 104);
  const descLabel = make('text', 'Description label', 'Description', 44, 294, 400, 30, { fontWeight: 600 });
  const checked = make('checkbox', 'Notify team', 'Notify the team when this project is ready', 44, 459, 470, 28);
  const save = make('button', 'Save project', 'Create project', 44, 525, 190, 44);
  const status = make('text', 'Form feedback', 'Your project is ready!', 44, 598, 650, 32, { color: '#2c9c78', fontWeight: 600 }); status.hidden = true;
  save.interactions = [{ ...interaction('Validate and create', [
    { type: 'setVariable', targetId: 'LastProject', value: `[[Widget.${input.id}.text]]` },
    { type: 'setText', targetId: status.id, value: 'Created “[[LastProject]]”. Your team can start collaborating.' },
    { type: 'show', targetId: status.id },
  ]), conditions: [{ source: 'widgetText', key: input.id, operator: 'notEquals', value: '' }] }];
  details.widgets = [backPage, heading, label, input, descLabel, desc, checked, save, status];
  page.notes = 'Demo: preview to follow New project, change the two-state welcome panel, or open a repeated project row.';
  details.notes = 'Demo: enter a project name and press Create project. A condition prevents an empty submission.';
  return doc;
}

export function mapWidgets(widgets: Widget[], visitor: (widget: Widget) => Widget): Widget[] {
  return widgets.map(widget => visitor(mapWidgetChildren(widget, children => mapWidgets(children, visitor))));
}

export function findWidget(page: Pick<Page, 'widgets'>, id: string): Widget | undefined {
  for (const widget of page.widgets) {
    if (widget.id === id) return widget;
    for (const children of widgetChildCollections(widget)) {
      const found = findWidget(children, id); if (found) return found;
    }
  }
  return undefined;
}

export function updateWidgetTree(widgets: Widget[], id: string, patch: Partial<Widget> | ((widget: Widget) => Partial<Widget>)): Widget[] {
  return fitLayerTree(mapWidgets(widgets, widget => widget.id === id ? { ...widget, ...(typeof patch === 'function' ? patch(widget) : patch) } : widget));
}

export function deleteWidgetTree(widgets: Widget[], ids: Iterable<string>): Widget[] {
  const deleted = new Set(ids);
  for (const id of treeSharedDescendantIds(widgets)) if (deleted.has(id)) throw new Error('Use tree node controls to delete tree contents');
  for (const id of menuSharedDescendantIds(widgets)) if (deleted.has(id)) throw new Error('Use menu item and submenu controls to delete menu contents');
  mapWidgets(widgets, widget => { if (widget.type === 'tableCell' && deleted.has(widget.id)) throw new Error('Delete table rows or columns instead of individual cells'); return widget; });
  return fitLayerTree(widgets.filter(widget => !deleted.has(widget.id)).map(widget => ({
    ...widget,
    ...(widget.layer ? { layer: { ...widget.layer, widgets: deleteWidgetTree(widget.layer.widgets, deleted) } } : {}),
    ...(widget.states ? { states: widget.states.map(state => ({ ...state, widgets: deleteWidgetTree(state.widgets, deleted) })) } : {}),
    ...(widget.repeater ? { repeater: { ...widget.repeater, template: deleteWidgetTree(widget.repeater.template, deleted) } } : {}),
  })));
}

export type WidgetIdentifierKind = 'widget' | 'state' | 'interaction' | 'action' | 'group' | 'link';
export function collectWidgetIdentifiers(widgets: Widget[]): Map<string, WidgetIdentifierKind> {
  const ids = new Map<string, WidgetIdentifierKind>();
  const add = (id: string, kind: WidgetIdentifierKind) => {
    const previous = ids.get(id);
    if (previous && !(previous === 'group' && kind === 'group')) throw new Error(`Duplicate widget-tree identifier: ${id}`);
    ids.set(id, kind);
  };
  const walk = (list: Widget[]) => { for (const widget of list) {
    add(widget.id, 'widget'); if (widget.groupId) add(widget.groupId, 'group');
    for (const link of widget.richText?.links ?? []) {
      add(link.id, 'link');
      for (const item of link.interactions) { add(item.id, 'interaction'); for (const action of item.actions) add(action.id, 'action'); }
    }
    for (const interaction of widget.interactions) {
      add(interaction.id, 'interaction'); for (const action of interaction.actions) add(action.id, 'action');
    }
    for (const children of widgetChildCollections(widget)) {
      if (children.stateId) add(children.stateId, 'state');
      walk(children.widgets);
    }
  } };
  walk(widgets);
  return ids;
}

/** Only rewrite actual variable tokens, never quoted text or partial property paths. */
function remapFilterExpression(expression: string, ids: ReadonlyMap<string, string>): string {
  if (!expression.startsWith('[[') || !expression.endsWith(']]')) return expression;
  const source = expression.slice(2, -2);
  let result = '', offset = 0;
  while (offset < source.length) {
    const start = offset, char = source[offset];
    if (char === '"' || char === "'") {
      offset++;
      while (offset < source.length) {
        const next = source[offset++];
        if (next === '\\') offset = Math.min(offset + 1, source.length);
        else if (next === char) break;
      }
      result += source.slice(start, offset); continue;
    }
    const boundary = offset === 0 || !/[\p{L}\p{N}_$.]/u.test(source[offset - 1]);
    const token = boundary ? /^Widget\.([a-zA-Z0-9_-]+)\.text(?![\p{L}\p{N}_$.])/u.exec(source.slice(offset)) : null;
    if (token) {
      result += ids.has(token[1]) ? `Widget.${ids.get(token[1])}.text` : token[0]; offset += token[0].length;
    } else { result += char; offset++; }
  }
  return `[[${result}]]`;
}

/** Remaps identifiers and references in one pass; targets outside the supplied map are retained. */
export function remapWidgetIds(widgets: Widget[], ids: ReadonlyMap<string, string>, offset = 0): Widget[] {
  const clones = structuredClone(widgets);
  const remapText = (text: string) => text.replace(/\[\[Widget\.([^\]]+)\.text\]\]/g, (token, id: string) => ids.has(id) ? `[[Widget.${ids.get(id)}.text]]` : token);
  const remapActionValue = (action: Action): string => {
    const value = action.value!;
    if (action.type === 'openUrl') return value;
    if (action.type === 'setError') return remapFilterExpression(value, ids);
    // These JSON names/columns are data, even when they resemble interpolation tokens.
    if (NAMED_REPEATER_ACTIONS.includes(action.type)) {
      if (action.type !== 'addFilter') return value;
      try {
        const spec = parseRepeaterFilterSpec(JSON.parse(value));
        const expression = remapFilterExpression(spec.expression, ids);
        return expression === spec.expression ? value : JSON.stringify({ ...spec, expression });
      } catch { return value; } // Preserve incomplete authoring drafts.
    }
    return action.type === 'setState' ? ids.get(value) ?? remapText(value) : remapText(value);
  };
  const remap = (list: Widget[], root: boolean): Widget[] => list.map(w => {
    w.id = ids.get(w.id) ?? w.id;
    if (root) { w.x += offset; w.y += offset; }
    if (w.groupId) w.groupId = ids.get(w.groupId) ?? w.groupId;
    if (w.activeStateId) w.activeStateId = ids.get(w.activeStateId) ?? w.activeStateId;
    if (w.submitButtonId) w.submitButtonId = ids.get(w.submitButtonId) ?? w.submitButtonId;
    if (w.componentInstance) w.componentInstance = { sourceIds: Object.fromEntries(Object.entries(w.componentInstance.sourceIds).map(([source, local]) => [source, ids.get(local) ?? local])) };
    if (w.richText && w.richText.expressionMode !== 'literal') {
      w.richText = mapRichTextMatches(w.richText, /\[\[Widget\.([^\]]+)\.text\]\]/g, match => ids.has(match[1]) ? `[[Widget.${ids.get(match[1])}.text]]` : match[0]);
      w.text = richTextPlainText(w.richText);
    } else if (!w.richText) w.text = remapText(w.text);
    const remapMotionExpression = (input: MotionExpression): MotionExpression => ({
      text: input.text.replace(/\[\[[^\[\]]+\]\]/g, expression => remapFilterExpression(expression, ids)),
      ...(input.bindings ? { bindings: Object.fromEntries(Object.entries(input.bindings).map(([name, binding]) => [name, { ...binding, targetId: ids.get(binding.targetId) ?? binding.targetId }])) } : {}),
    });
    const remapBoundary = (boundary: MotionBoundary): MotionBoundary => boundary.kind === 'compare'
      ? { ...boundary, left: remapMotionExpression(boundary.left), right: remapMotionExpression(boundary.right) }
      : { ...boundary, left: remapBoundary(boundary.left), right: remapBoundary(boundary.right) };
    const remapMotionTarget = <T extends MoveTarget | ResizeTarget>(target: T): T => target.kind === 'widget' ? { ...target, id: ids.get(target.id) ?? target.id } : { ...target };
    const remapInteractions = (items: Interaction[]) => items.map(i => ({ ...i, id: ids.get(i.id) ?? i.id,
      conditions: i.conditions.map(c => ({ ...c, key: c.source === 'widgetText' || c.source === 'selectedOption' ? ids.get(c.key) ?? c.key : c.key, value: remapText(c.value) })),
      actions: i.actions.map(a => ({ ...a, id: ids.get(a.id) ?? a.id,
        ...(a.targetId && a.type !== 'setVariable' && a.type !== 'openPage' ? { targetId: ids.get(a.targetId) ?? a.targetId } : {}),
        ...(a.value !== undefined ? { value: remapActionValue(a) } : {}),
        ...(a.rotate ? { rotate: { ...a.rotate, ...Object.fromEntries((['degrees','offsetX','offsetY'] as const).map(field => [field, a.rotate![field].replace(/\[\[[^\[\]]+\]\]/g, expression => remapFilterExpression(expression, ids))])) } } : {}),
        ...(a.move ? { move: { targets: a.move.targets.map(entry => ({ ...entry, target: remapMotionTarget(entry.target), x: remapMotionExpression(entry.x), y: remapMotionExpression(entry.y), ...(entry.boundary ? { boundary: remapBoundary(entry.boundary) } : {}) })) } } : {}),
        ...(a.resize ? { resize: { targets: a.resize.targets.map(entry => ({ ...entry, target: remapMotionTarget(entry.target), width: remapMotionExpression(entry.width), height: remapMotionExpression(entry.height) })) } } : {}),
      })),
    }));
    w.interactions = remapInteractions(w.interactions);
    if (w.richText?.links) {
      w.richText.links = w.richText.links.map(link => ({ ...link, id: ids.get(link.id) ?? link.id, interactions: remapInteractions(link.interactions) }));
      for (const paragraph of w.richText.paragraphs) for (const run of paragraph.runs) if (run.linkId) run.linkId = ids.get(run.linkId) ?? run.linkId;
    }
    if (w.layer) w.layer.widgets = remap(w.layer.widgets, root);
    if (w.states) w.states = w.states.map(s => ({ ...s, id: ids.get(s.id) ?? s.id, widgets: remap(s.widgets, false) }));
    if (w.repeater) w.repeater.template = remap(w.repeater.template, false);
    if (w.table) { w.table.cells = remap(w.table.cells, false); if (w.table.cellOrder) w.table.cellOrder = w.table.cellOrder.map(id=>ids.get(id)??id); }
    if (w.menu) { w.menu.table = remap([w.menu.table], false)[0]; w.menu.submenus = remap(w.menu.submenus, false); if (w.menu.parentCellId) w.menu.parentCellId = ids.get(w.menu.parentCellId) ?? w.menu.parentCellId; }
    if (w.tree) w.tree.nodes = remap(w.tree.nodes, false);
    if (w.treeNode) { w.treeNode.label = remap([w.treeNode.label], false)[0]; w.treeNode.children = remap(w.treeNode.children, false); }
    return w;
  });
  return fitLayerTree(remap(clones, true));
}

export function cloneWidgets(widgets: Widget[], offset = 20): Widget[] {
  // Allocate every ID first so forward references and cross-sibling targets work.
  const ids = new Map([...collectWidgetIdentifiers(widgets).keys()].map(id => [id, uid()]));
  // Deleted controls still have a pending source mapping; copied instances must not share those IDs.
  mapWidgets(widgets, widget => {
    for (const local of Object.values(widget.componentInstance?.sourceIds ?? {})) if (!ids.has(local)) ids.set(local, uid());
    return widget;
  });
  return remapWidgetIds(widgets, ids, offset);
}

export function groupWidgets(widgets: Widget[], ids: Iterable<string>): Widget[] {
  const selected = new Set(ids), groupId = uid();
  return widgets.map(w => selected.has(w.id) && !w.locked ? { ...w, groupId } : w);
}

export function ungroupWidgets(widgets: Widget[], ids: Iterable<string>): Widget[] {
  const selected = new Set(ids);
  const groups = new Set(widgets.filter(w => selected.has(w.id)).map(w => w.groupId).filter(Boolean));
  return widgets.map(w => { if (!w.groupId || !groups.has(w.groupId) || w.locked) return w; const next = { ...w }; delete next.groupId; return next; });
}

/** Independent group identity with ordered members in their existing coordinate
 * scope. Legacy flat groupId documents remain readable and independently editable. */
export function createLayer(widgets: Widget[], name = 'Group'): Widget {
  return fitLayerBounds({ ...createWidget('layer'), name, layer: { widgets: structuredClone(widgets), propagate: false } });
}

export function groupIntoLayer(widgets: Widget[], ids: Iterable<string>): { widgets: Widget[]; layer?: Widget } {
  const selected = new Set(ids), members = widgets.filter(widget => selected.has(widget.id) && !widget.locked && widget.placed !== false);
  if (members.length < 2) return { widgets };
  const membersSet = new Set(members.map(widget => widget.id)), layer = createLayer(members);
  // Group members become one contiguous drawing unit at the topmost selected
  // position. This is the editor's stacking policy, independent of native UI.
  let last = -1;
  widgets.forEach((widget, index) => { if (membersSet.has(widget.id)) last = index; });
  return { layer, widgets: widgets.flatMap((widget, index) => index === last ? [layer] : membersSet.has(widget.id) ? [] : [widget]) };
}

export function ungroupLayers(widgets: Widget[], ids: Iterable<string>): { widgets: Widget[]; selected: string[] } {
  const selected = new Set(ids), members: string[] = []; let changed = false;
  const result = widgets.flatMap(widget => {
    if (!selected.has(widget.id) || !widget.layer || widget.locked) return [widget];
    changed = true;
    members.push(...widget.layer.widgets.map(child => child.id));
    return widget.layer.widgets;
  });
  return { widgets: changed ? result : widgets, selected: members };
}

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export function alignWidgets(widgets: Widget[], ids: Iterable<string>, alignment: Alignment): Widget[] {
  const selected = new Set(ids), targets = widgets.filter(w => selected.has(w.id));
  if (targets.length < 2) return widgets;
  const left = Math.min(...targets.map(w => w.x)), right = Math.max(...targets.map(w => w.x + w.width));
  const top = Math.min(...targets.map(w => w.y)), bottom = Math.max(...targets.map(w => w.y + w.height));
  return widgets.map(w => !selected.has(w.id) || w.locked ? w : translateWidget(w,
    (alignment === 'left' ? left : alignment === 'right' ? right - w.width : alignment === 'center' ? (left + right - w.width) / 2 : w.x) - w.x,
    (alignment === 'top' ? top : alignment === 'bottom' ? bottom - w.height : alignment === 'middle' ? (top + bottom - w.height) / 2 : w.y) - w.y));
}

export function distributeWidgets(widgets: Widget[], ids: Iterable<string>, axis: 'horizontal' | 'vertical'): Widget[] {
  const selected = new Set(ids), pos = axis === 'horizontal' ? 'x' : 'y', size = axis === 'horizontal' ? 'width' : 'height';
  const ordered = widgets.filter(w => selected.has(w.id) && !w.locked).sort((a, b) => a[pos] - b[pos]);
  if (ordered.length < 3) return widgets;
  const first = ordered[0], last = ordered[ordered.length - 1];
  const gap = (last[pos] + last[size] - first[pos] - ordered.reduce((sum, w) => sum + w[size], 0)) / (ordered.length - 1);
  const positions = new Map<string, number>(); let cursor = first[pos];
  for (const w of ordered) { positions.set(w.id, cursor); cursor += w[size] + gap; }
  return widgets.map(w => positions.has(w.id) ? translateWidget(w, pos === 'x' ? positions.get(w.id)! - w.x : 0, pos === 'y' ? positions.get(w.id)! - w.y : 0) : w);
}

function fail(path: string, message: string): never { throw new Error(`Invalid project at ${path}: ${message}`); }
function object(value: unknown, path: string, allowed?: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) fail(path, `unsafe key ${key}`);
    if (allowed && !allowed.includes(key)) fail(path, `unknown field ${key}`);
  }
  return obj;
}
function array(value: unknown, path: string, max: number = DOCUMENT_LIMITS.widgets): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `expected an array of at most ${max} entries`);
  return value;
}
function str(value: unknown, path: string, max: number = DOCUMENT_LIMITS.text): string {
  if (typeof value !== 'string' || value.length > max) fail(path, `expected a string of at most ${max} characters`);
  return value;
}
function num(value: unknown, path: string, min = -100_000, max = 100_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `expected a finite number between ${min} and ${max}`);
  return value;
}
function bool(value: unknown, path: string): boolean { if (typeof value !== 'boolean') fail(path, 'expected a boolean'); return value; }
function choice<T extends string>(value: unknown, path: string, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) fail(path, `expected one of ${choices.join(', ')}`);
  return value as T;
}
function key(value: unknown, path: string): string {
  const text = str(value, path, 256);
  if (!text.trim() || UNSAFE_KEYS.has(text) || /[\u0000-\u001f\u007f]/.test(text)) fail(path, 'invalid identifier');
  return text;
}
function color(value: unknown, path: string): string {
  const text = str(value, path, 100);
  if (!/^(?:#[0-9a-f]{3,8}|[a-z]{1,24}|(?:rgb|hsl)a?\([\d\s.,%+\-/]+\))$/i.test(text)) fail(path, 'expected a color, not a CSS expression or URL');
  return text;
}
export function isSafeImageSource(value: string): boolean {
  if (value === '') return true;
  if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(value)) return value.length <= DOCUMENT_LIMITS.image;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && value.length <= 4096; } catch { return false; }
}
function style(value: unknown, path: string, partial = false, author = false): WidgetStyle | Partial<WidgetStyle> {
  const keys = author ? [...STYLE_KEYS, ...AUTHOR_STYLE_KEYS] : STYLE_KEYS;
  const obj = object(value, path, keys), result: Partial<WidgetStyle> = {};
  for (const name of keys) {
    if (AUTHOR_STYLE_KEYS.includes(name) && obj[name] === undefined) continue;
    if (['fillGradient', 'strokeGradient', 'linePattern', 'lineEnds', 'borderVisibility', 'borderWidths', 'cornerRadii', 'cornerVisibility', 'textPadding', 'verticalAlign', 'lineHeight', 'fontStyle', 'underline', 'strikethrough', 'outerShadow', 'innerShadow', 'textShadow', 'selectionButtonSize'].includes(name) && obj[name] === undefined) continue;
    if (partial && obj[name] === undefined) continue;
    const field = `${path}.${name}`;
    switch (name) {
      case 'pinHorizontal': result.pinHorizontal = choice(obj[name], field, PIN_HORIZONTAL_VALUES); break;
      case 'pinVertical': result.pinVertical = choice(obj[name], field, PIN_VERTICAL_VALUES); break;
      case 'fixedWidth': case 'fixedHeight': result[name] = bool(obj[name], field); break;
      // Independent product storage bound, not a claimed native P94 legal range.
      case 'selectionButtonSize': result.selectionButtonSize = num(obj[name], field, 0, 100_000); break;
      case 'linePattern': result.linePattern = choice(obj[name], field, LINE_PATTERNS); break;
      case 'lineEnds': {
        const ends = object(obj[name], field, ['start', 'end']);
        result.lineEnds = { start: choice(ends.start, `${field}.start`, ARROW_STYLES), end: choice(ends.end, `${field}.end`, ARROW_STYLES) };
        break;
      }
      case 'borderVisibility': {
        const sides = array(obj[name], field, 4);
        if (sides.length !== 4) fail(field, 'expected exactly four border visibility values');
        result.borderVisibility = sides.map((value, index) => bool(value, `${field}[${index}]`)) as [boolean, boolean, boolean, boolean];
        break;
      }
      case 'fillGradient': case 'strokeGradient': {
        const raw = object(obj[name], field);
        const type = choice(raw.type, `${field}.type`, ['linear', 'radial'] as const);
        object(raw, field, ['type', 'stops', ...(type === 'linear' ? ['start', 'end'] : ['center', 'axis1', 'axis2'])]);
        const point = (name: string) => {
          const p = `${field}.${name}`, value = object(raw[name], p, ['x', 'y']);
          return { x: num(value.x, `${p}.x`, -1000, 1000), y: num(value.y, `${p}.y`, -1000, 1000) };
        };
        const values = array(raw.stops, `${field}.stops`, 100);
        if (values.length < 2) fail(`${field}.stops`, 'expected at least two color stops');
        let previous = -1;
        const stops = values.map((entry, index) => {
          const p = `${field}.stops[${index}]`, value = object(entry, p, ['offset', 'color']);
          const offset = num(value.offset, `${p}.offset`, 0, 1);
          if (offset < previous) fail(`${p}.offset`, 'color stops must be in nondecreasing order');
          previous = offset;
          const text = str(value.color, `${p}.color`, 100);
          if (!isShadowColor(text)) fail(`${p}.color`, 'expected a named, hex, RGB or HSL color');
          return { offset, color: text };
        });
        result[name] = type === 'linear' ? { type, start: point('start'), end: point('end'), stops } : { type, center: point('center'), axis1: point('axis1'), axis2: point('axis2'), stops };
        break;
      }
      case 'outerShadow': case 'innerShadow': case 'textShadow': {
        const shadow = object(obj[name], field, ['on', 'offsetX', 'offsetY', 'blurRadius', 'color', ...(name === 'innerShadow' ? ['spread'] : [])]);
        const shadowColor = str(shadow.color, `${field}.color`, 100);
        if (!isShadowColor(shadowColor)) fail(`${field}.color`, 'expected a named, hex, RGB or HSL color');
        const parsed = { on: bool(shadow.on, `${field}.on`), offsetX: num(shadow.offsetX, `${field}.offsetX`, -1000, 1000), offsetY: num(shadow.offsetY, `${field}.offsetY`, -1000, 1000), blurRadius: num(shadow.blurRadius, `${field}.blurRadius`, 0, 1000), color: shadowColor };
        if (name === 'innerShadow') result.innerShadow = { ...parsed, spread: num(shadow.spread, `${field}.spread`, 0, 1000) };
        else result[name] = parsed;
        break;
      }
      case 'fill': case 'stroke': case 'color': result[name] = color(obj[name], field); break;
      case 'fontFamily': {
        const family = str(obj[name], field, 200);
        if (!/^[\p{L}\p{N}\s,'"_-]+$/u.test(family)) fail(field, 'invalid font family');
        result.fontFamily = family; break;
      }
      case 'textAlign': result.textAlign = choice<WidgetStyle['textAlign']>(obj[name], field, ['left', 'center', 'right']); break;
      case 'verticalAlign': result.verticalAlign = choice<NonNullable<WidgetStyle['verticalAlign']>>(obj[name], field, ['top', 'middle', 'bottom']); break;
      case 'lineHeight': result.lineHeight = obj[name] === 'normal' ? 'normal' : num(obj[name], field, 0.1, 10); break;
      case 'textPadding': {
        const insets = array(obj[name], field, 4);
        if (insets.length !== 4) fail(field, 'expected exactly four text padding values');
        result.textPadding = insets.map((value, index) => num(value, `${field}[${index}]`, 0, 1000)) as [number, number, number, number];
        break;
      }
      case 'opacity': result.opacity = num(obj[name], field, 0, 1); break;
      case 'fontWeight': result.fontWeight = num(obj[name], field, 100, 1000); break;
      case 'fontStyle': result.fontStyle = choice<NonNullable<WidgetStyle['fontStyle']>>(obj[name], field, ['normal', 'italic']); break;
      case 'underline': case 'strikethrough': result[name] = bool(obj[name], field); break;
      case 'fontSize': result.fontSize = num(obj[name], field, 1, 512); break;
      case 'strokeWidth': result.strokeWidth = num(obj[name], field, 0, 100); break;
      case 'borderWidths': {
        const widths = array(obj[name], field, 4);
        if (widths.length !== 4) fail(field, 'expected exactly four border widths');
        result.borderWidths = widths.map((value, index) => num(value, `${field}[${index}]`, 0, 100)) as [number, number, number, number];
        break;
      }
      case 'radius': result.radius = num(obj[name], field, 0, 10_000); break;
      case 'cornerVisibility': {
        const corners = array(obj[name], field, 4);
        if (corners.length !== 4) fail(field, 'expected exactly four corner visibility flags');
        result.cornerVisibility = corners.map((value, index) => bool(value, `${field}[${index}]`)) as [boolean, boolean, boolean, boolean];
        break;
      }
      case 'cornerRadii': {
        const corners = array(obj[name], field, 4);
        if (corners.length !== 4) fail(field, 'expected exactly four corner radii');
        result.cornerRadii = corners.map((value, index) => num(value, `${field}[${index}]`, 0, 1000)) as [number, number, number, number];
        break;
      }
    }
  }
  return result;
}
/** Shared strict boundary for visual patches, including effects and SetStyle actions. */
export function parseWidgetStylePatch(value: unknown): Partial<WidgetStyle> { return style(value, 'style', true); }
/** Normal author style boundary. Pins are independent from visual effect/action patches. */
export function parseAuthorStylePatch(value: unknown): Partial<WidgetStyle> { return style(value, 'style', true, true); }
/** Strict structured-text boundary, also shared by native import and authoring. */
export function parseRichText(value: unknown, path = 'richText', ctx: ValidationContext = { ids: new Set(), widgets: 0 }): RichText {
  const root = object(value, path, ['paragraphs', 'expressionMode', 'links']);
  const links: RichTextLink[] | undefined = root.links === undefined ? undefined : array(root.links, `${path}.links`, 1000).map((raw, index) => {
    const p = `${path}.links[${index}]`, link = object(raw, p, ['id','name','interactions','mouseOverStyle','mouseDownStyle']);
    const result: RichTextLink = { id: identity(link.id, `${p}.id`, ctx), name: str(link.name, `${p}.name`, 500), interactions: array(link.interactions, `${p}.interactions`, 100).map((item,i) => validateInteraction(item, `${p}.interactions[${i}]`, ctx)) };
    if (result.interactions.some(item => item.event !== 'click')) fail(`${p}.interactions`, 'hyperlinks currently support click cases');
    for (const field of ['mouseOverStyle','mouseDownStyle'] as const) if (link[field] !== undefined) result[field] = style(object(link[field], `${p}.${field}`, RICH_TEXT_STYLE_KEYS), `${p}.${field}`, true);
    return result;
  });
  const linkIds = new Set(links?.map(link => link.id)), usedLinks = new Set<string>();
  let count = 0, characters = 0;
  const paragraphs = array(root.paragraphs, `${path}.paragraphs`, 10_000).map((raw, index) => {
    const p = `${path}.paragraphs[${index}]`, paragraph = object(raw, p, ['runs', 'textAlign', 'lineHeightPx']);
    const runs = array(paragraph.runs, `${p}.runs`, 10_000).map((rawRun, i) => {
      if (++count > 20_000) fail(path, 'too many rich text runs');
      const r = `${p}.runs[${i}]`, run = object(rawRun, r, ['text', 'style', 'linkId']), text = str(run.text, `${r}.text`);
      if (/\r/.test(text)) fail(`${r}.text`, 'use LF, not CR, for line breaks');
      characters += text.length;
      const runStyle = run.style === undefined ? undefined : style(object(run.style, `${r}.style`, RICH_TEXT_STYLE_KEYS), `${r}.style`, true);
      const linkId = run.linkId === undefined ? undefined : key(run.linkId, `${r}.linkId`);
      if (linkId !== undefined) { if (!linkIds.has(linkId)) fail(`${r}.linkId`, 'unknown hyperlink'); usedLinks.add(linkId); }
      return { text, ...(runStyle ? { style: runStyle } : {}), ...(linkId !== undefined ? { linkId } : {}) };
    });
    if (!runs.length) fail(p, 'a paragraph requires at least one run');
    return { runs,
      ...(paragraph.textAlign !== undefined ? { textAlign: choice<WidgetStyle['textAlign']>(paragraph.textAlign, `${p}.textAlign`, ['left', 'center', 'right']) } : {}),
      ...(paragraph.lineHeightPx !== undefined ? { lineHeightPx: paragraph.lineHeightPx === 'normal' ? 'normal' as const : num(paragraph.lineHeightPx, `${p}.lineHeightPx`, 0.1, 10_000) } : {}),
    };
  });
  if (!paragraphs.length) fail(path, 'rich text requires at least one paragraph');
  if (characters + paragraphs.length - 1 > DOCUMENT_LIMITS.text) fail(path, 'rich text exceeds the text limit');
  if (links?.some(link => !usedLinks.has(link.id))) fail(`${path}.links`, 'unreferenced hyperlink');
  return { paragraphs, ...(links ? { links } : {}), ...(root.expressionMode !== undefined ? { expressionMode: choice(root.expressionMode, `${path}.expressionMode`, ['literal'] as const) } : {}) };
}
/** Literal web destinations only; neither model import nor playback evaluates URL code. */
export function parseExternalUrl(value: unknown, path = 'url'): string {
  const text = str(value, path, 4096);
  if (text !== text.trim() || !/^https?:\/\//i.test(text) || /[\u0000-\u0020\u007f\\]/.test(text) || text.includes('[[')) fail(path, 'use a literal HTTP or HTTPS URL');
  let parsed: URL; try { parsed = new URL(text); } catch { return fail(path, 'invalid web URL'); }
  if (!parsed.hostname || parsed.username || parsed.password) fail(path, 'URL must have a host and no credentials');
  return text;
}
export function parseLocalFramePath(value: unknown, path = 'file'): string {
  const text = str(value, path, 4096);
  try { frameFileUrl(text, 'file:///C:/prototype/prototype.html'); } catch (error) { fail(path, error instanceof Error ? error.message : 'invalid local path'); }
  return text;
}
export function parseFrameTarget(value: unknown, path = 'frameTarget'): FrameTarget {
  const target = object(value, path, ['kind', 'pageId', 'url', 'path']);
  const kind = choice(target.kind, `${path}.kind`, ['page', 'url', 'file'] as const);
  const field = kind === 'page' ? 'pageId' : kind === 'url' ? 'url' : 'path';
  for (const name of ['pageId', 'url', 'path']) if (name !== field && target[name] !== undefined) fail(`${path}.${name}`, 'destination field does not match its kind');
  if (kind === 'page') return { kind, pageId: key(target.pageId, `${path}.pageId`) };
  if (kind === 'url') return { kind, url: parseExternalUrl(target.url, `${path}.url`) };
  return { kind, path: parseLocalFramePath(target.path, `${path}.path`) };
}
interface ValidationContext { ids: Set<string>; widgets: number }
function identity(value: unknown, path: string, ctx: ValidationContext): string {
  const id = key(value, path); if (ctx.ids.has(id)) fail(path, `duplicate identifier ${id}`); ctx.ids.add(id); return id;
}
function validateCondition(value: unknown, path: string): Condition {
  const o = object(value, path, ['source', 'key', 'operator', 'value', 'comparisonMode']);
  const result: Condition = { source: choice(o.source, `${path}.source`, ['variable', 'widgetText', 'selectedOption']), key: key(o.key, `${path}.key`), operator: choice(o.operator, `${path}.operator`, ['equals', 'notEquals', 'contains', 'greater', 'less', 'isEmpty']), value: str(o.value, `${path}.value`) };
  if (o.comparisonMode !== undefined) {
    result.comparisonMode = choice(o.comparisonMode, `${path}.comparisonMode`, ['axure'] as const);
    if (!['equals', 'notEquals'].includes(result.operator)) fail(`${path}.comparisonMode`, 'native comparison only supports equals and notEquals');
  }
  return result;
}

/** Strict shared authoring boundary. Mark/unmark deliberately have no marked shortcut. */
export function parseRepeaterRowSelector(value: unknown, allowMarked = false, columns?: readonly string[], path = 'row selector'): RepeaterRowSelector {
  const obj = object(value, path, ['row', 'where']);
  if (Object.hasOwn(obj, 'row') === Object.hasOwn(obj, 'where')) fail(path, 'choose exactly one row selector: row or where');
  if (Object.hasOwn(obj, 'row')) {
    if (typeof obj.row === 'number') {
      if (!Number.isSafeInteger(obj.row) || obj.row < 0) fail(`${path}.row`, 'row index must be a nonnegative safe integer');
      return { row: obj.row };
    }
    return { row: choice<Exclude<RepeaterRowSelector['row'], number | undefined>>(obj.row, `${path}.row`, allowMarked ? ['this', 'all', 'marked'] : ['this', 'all']) };
  }
  const where = object(obj.where, `${path}.where`, ['column', 'operator', 'value']);
  const column = key(where.column, `${path}.where.column`);
  if (columns && !columns.includes(column)) fail(`${path}.where.column`, `unknown or unsupported column: ${column}`);
  return { where: { column, operator: choice(where.operator, `${path}.where.operator`, ['equals', 'notEquals', 'contains', 'greater', 'less', 'isEmpty']), value: str(where.value, `${path}.where.value`) } };
}

function repeaterColumn(value: unknown, path: string, columns?: readonly string[]): string {
  const column = key(value, path);
  if (columns && !columns.includes(column)) fail(path, `unknown or unsupported column: ${column}`);
  return column;
}
/** Named rule payloads are strict; names intentionally retain case, spaces and empty strings. */
export function parseRepeaterFilterSpec(value: unknown, columns?: readonly string[], path = 'filter'): RepeaterFilterSpec {
  const obj = object(value, path, ['name', 'expression', 'column', 'mode', 'removeOthers']);
  const expression = str(obj.expression, `${path}.expression`, 4100);
  const match = expression.match(/^\[\[([^\[\]]+)\]\]$/);
  if (!match?.[1].trim()) fail(`${path}.expression`, 'use one complete nonempty [[expression]] of at most 4096 inner characters');
  return {
    name: str(obj.name, `${path}.name`, 256), expression,
    ...(Object.hasOwn(obj, 'column') ? { column: repeaterColumn(obj.column, `${path}.column`, columns) } : {}),
    mode: choice(obj.mode, `${path}.mode`, ['smart', 'all', 'any']), removeOthers: bool(obj.removeOthers, `${path}.removeOthers`),
  };
}
export function parseRepeaterSortSpec(value: unknown, columns?: readonly string[], path = 'sort'): RepeaterSortSpec {
  const obj = object(value, path, ['name', 'column', 'direction', 'dataType', 'toggle', 'removeOthers']);
  return {
    name: str(obj.name, `${path}.name`, 256), column: repeaterColumn(obj.column, `${path}.column`, columns),
    direction: choice(obj.direction, `${path}.direction`, ['asc', 'desc']),
    dataType: choice(obj.dataType, `${path}.dataType`, ['number', 'text', 'textCase', 'natural', 'dateYMD', 'dateMDY', 'dateDMY']),
    toggle: bool(obj.toggle, `${path}.toggle`), removeOthers: bool(obj.removeOthers, `${path}.removeOthers`),
  };
}
export function parseRepeaterRuleRemoval(value: unknown, path = 'rule removal'): RepeaterRuleRemoval {
  const obj = object(value, path, ['all', 'name']);
  if (Object.hasOwn(obj, 'all') === Object.hasOwn(obj, 'name')) fail(path, 'choose exactly one of all or name');
  if (Object.hasOwn(obj, 'name')) return { name: str(obj.name, `${path}.name`, 256) };
  if (obj.all !== true) fail(`${path}.all`, 'expected true');
  return { all: true };
}
function validateNamedRepeaterAction(action: Action, columns?: readonly string[], path = 'action.value'): void {
  const text = str(action.value, path); let value: unknown;
  try { value = JSON.parse(text); } catch { fail(path, 'named repeater rule must be valid JSON'); }
  if (action.type === 'addFilter') parseRepeaterFilterSpec(value, columns, path);
  else if (action.type === 'addSort') parseRepeaterSortSpec(value, columns, path);
  else parseRepeaterRuleRemoval(value, path);
}
/** Safe native-motion input: local aliases contain identities, never code or objects from the target. */
export function parseMotionExpression(value: unknown, path = 'motion expression'): MotionExpression {
  const input = object(value, path, ['text', 'bindings']);
  const result: MotionExpression = { text: str(input.text, `${path}.text`, 4100) };
  if (input.bindings !== undefined) {
    const bindings = object(input.bindings, `${path}.bindings`);
    if (Object.keys(bindings).length > 128) fail(`${path}.bindings`, 'at most 128 local bindings are supported');
    result.bindings = Object.fromEntries(Object.entries(bindings).map(([alias, value]) => {
      if (!/^[a-z_$][a-z0-9_$]*$/.test(alias) || alias.length > 128) fail(`${path}.bindings`, 'local aliases must be canonical lowercase ASCII names');
      const binding = object(value, `${path}.bindings.${alias}`, ['kind', 'targetId']);
      return [alias, { kind: choice(binding.kind, `${path}.bindings.${alias}.kind`, ['widget'] as const), targetId: key(binding.targetId, `${path}.bindings.${alias}.targetId`) }];
    }));
  }
  return result;
}
export function parseMotionBoundary(value: unknown, path = 'motion boundary'): MotionBoundary {
  let count = 0;
  const visit = (value: unknown, at: string, depth: number): MotionBoundary => {
    if (++count > 127 || depth > 16) fail(at, 'boundary tree exceeds the node or nesting limit');
    const node = object(value, at, ['kind', 'operator', 'direction', 'left', 'right']);
    const kind = choice(node.kind, `${at}.kind`, ['and', 'or', 'compare'] as const);
    if (kind === 'compare') return {
      kind, operator: choice(node.operator, `${at}.operator`, ['>', '<', '>=', '<='] as const),
      direction: choice(node.direction, `${at}.direction`, ['left', 'right', 'top', 'bottom'] as const),
      left: parseMotionExpression(node.left, `${at}.left`), right: parseMotionExpression(node.right, `${at}.right`),
    };
    if (node.operator !== undefined || node.direction !== undefined) fail(at, 'boolean boundary nodes contain only two child conditions');
    return { kind, left: visit(node.left, `${at}.left`, depth + 1), right: visit(node.right, `${at}.right`, depth + 1) };
  };
  return visit(value, path, 0);
}
function parseMotionTarget(value: unknown, path: string, kind: 'move'): MoveTarget;
function parseMotionTarget(value: unknown, path: string, kind: 'resize'): ResizeTarget;
function parseMotionTarget(value: unknown, path: string, action: 'move' | 'resize'): MoveTarget | ResizeTarget {
  const target = object(value, path, ['kind', 'id']);
  const kind = choice(target.kind, `${path}.kind`, action === 'move' ? ['widget', 'this', 'widgetsBelow', 'widgetsRight'] as const : ['widget', 'this', 'thisItem'] as const);
  if (kind === 'widget') return { kind, id: key(target.id, `${path}.id`) };
  if (target.id !== undefined) fail(path, 'context targets have no widget identifier');
  return { kind };
}
export function parseMoveActionSpec(value: unknown, path = 'move'): MoveActionSpec {
  const spec = object(value, path, ['targets']), targets = array(spec.targets, `${path}.targets`, 200);
  if (!targets.length) fail(`${path}.targets`, 'choose at least one target');
  return { targets: targets.map((value, index) => {
    const at = `${path}.targets[${index}]`, entry = object(value, at, ['target', 'mode', 'x', 'y', 'trajectory', 'easing', 'duration', 'boundary']);
    return {
      target: parseMotionTarget(entry.target, `${at}.target`, 'move'), mode: choice(entry.mode, `${at}.mode`, MOVE_MODES),
      x: parseMotionExpression(entry.x, `${at}.x`), y: parseMotionExpression(entry.y, `${at}.y`),
      trajectory: choice(entry.trajectory, `${at}.trajectory`, MOVE_TRAJECTORIES), easing: choice(entry.easing, `${at}.easing`, ROTATION_EASINGS),
      duration: num(entry.duration, `${at}.duration`, 0, 60000), ...(entry.boundary !== undefined ? { boundary: parseMotionBoundary(entry.boundary, `${at}.boundary`) } : {}),
    };
  }) };
}
export function parseResizeActionSpec(value: unknown, path = 'resize'): ResizeActionSpec {
  const spec = object(value, path, ['targets']), targets = array(spec.targets, `${path}.targets`, 200);
  if (!targets.length) fail(`${path}.targets`, 'choose at least one target');
  return { targets: targets.map((value, index) => {
    const at = `${path}.targets[${index}]`, entry = object(value, at, ['target', 'width', 'height', 'anchor', 'easing', 'duration']);
    return {
      target: parseMotionTarget(entry.target, `${at}.target`, 'resize'), width: parseMotionExpression(entry.width, `${at}.width`), height: parseMotionExpression(entry.height, `${at}.height`),
      anchor: choice(entry.anchor, `${at}.anchor`, ROTATION_ANCHORS), easing: choice(entry.easing, `${at}.easing`, ROTATION_EASINGS), duration: num(entry.duration, `${at}.duration`, 0, 60000),
    };
  }) };
}
function validateInteraction(value: unknown, path: string, ctx: ValidationContext): Interaction {
  const o = object(value, path, ['id', 'event', 'name', 'enabled', 'isNewIfGroup', 'conditions', 'conditionMode', 'actions']);
  return {
    id: identity(o.id, `${path}.id`, ctx), event: choice(o.event, `${path}.event`, EVENTS), name: str(o.name, `${path}.name`, 500), enabled: bool(o.enabled, `${path}.enabled`),
    ...(o.isNewIfGroup !== undefined ? { isNewIfGroup: bool(o.isNewIfGroup, `${path}.isNewIfGroup`) } : {}),
    conditions: array(o.conditions, `${path}.conditions`, 100).map((c, i) => validateCondition(c, `${path}.conditions[${i}]`)),
    conditionMode: choice(o.conditionMode, `${path}.conditionMode`, ['all', 'any']),
    actions: array(o.actions, `${path}.actions`, DOCUMENT_LIMITS.actions).map((a, i) => {
      const p = `${path}.actions[${i}]`, action = object(a, p, ['id', 'type', 'targetId', 'value', 'x', 'y', 'duration', 'style', 'selectText', 'windowTarget', 'frameScope', 'frameTarget', 'adaptiveView', 'rotate', 'move', 'resize']);
      const result: Action = { id: identity(action.id, `${p}.id`, ctx), type: choice(action.type, `${p}.type`, ACTION_TYPES) };
      for (const field of ['move', 'resize'] as const) if (action[field] !== undefined) {
        if (result.type !== field) fail(`${p}.${field}`, `motion parameters are only supported on ${field} actions`);
        if (['targetId', 'value', 'x', 'y', 'duration', 'style'].some(key => action[key] !== undefined)) fail(p, 'structured motion parameters cannot be combined with legacy action fields');
        if (field === 'move') result.move = parseMoveActionSpec(action.move, `${p}.move`);
        else result.resize = parseResizeActionSpec(action.resize, `${p}.resize`);
      }
      if (result.type === 'rotate') {
        if (['value','x','y','duration','style'].some(field => action[field] !== undefined)) fail(p, 'Rotate uses its structured motion parameters');
        const q = `${p}.rotate`, rotation = object(action.rotate, q, ['mode','degrees','clockwise','anchor','offsetX','offsetY','easing','duration']);
        result.rotate = {
          mode: choice(rotation.mode, `${q}.mode`, ['by','to']), degrees: str(rotation.degrees, `${q}.degrees`, 4100),
          clockwise: bool(rotation.clockwise, `${q}.clockwise`), anchor: choice(rotation.anchor, `${q}.anchor`, ROTATION_ANCHORS),
          offsetX: str(rotation.offsetX, `${q}.offsetX`, 4100), offsetY: str(rotation.offsetY, `${q}.offsetY`, 4100),
          easing: choice(rotation.easing, `${q}.easing`, ROTATION_EASINGS), duration: num(rotation.duration, `${q}.duration`, 0, 60000),
        };
      } else if (action.rotate !== undefined) fail(`${p}.rotate`, 'rotation parameters are only supported on Rotate actions');
      if (action.targetId !== undefined) result.targetId = key(action.targetId, `${p}.targetId`);
      if (action.selectText !== undefined) {
        if (result.type !== 'setFocus') fail(`${p}.selectText`, 'selectText is only supported on setFocus actions');
        result.selectText = bool(action.selectText, `${p}.selectText`);
      }
      if (result.type === 'setSelected' || result.type === 'setError') {
        const expression = typeof action.value === 'string' ? action.value.match(/^\[\[([^\[\]]+)\]\]$/) : null;
        if (expression?.[1].trim()) result.value = action.value as string;
        else result.value = choice(action.value, `${p}.value`, ['true', 'false', 'toggle']);
      }
      else if (action.value !== undefined) result.value = str(action.value, `${p}.value`);
      if (result.type === 'openUrl') {
        if (action.targetId !== undefined) fail(`${p}.targetId`, 'openUrl uses a URL, not a widget target');
        result.value = parseExternalUrl(action.value, `${p}.value`);
        result.windowTarget = choice(action.windowTarget, `${p}.windowTarget`, ['current','new'] as const);
      } else if (action.windowTarget !== undefined) fail(`${p}.windowTarget`, 'windowTarget is only supported on openUrl');
      if (result.type === 'openLinkInFrame') {
        result.frameScope = choice(action.frameScope, `${p}.frameScope`, ['widget','parent'] as const);
        result.frameTarget = parseFrameTarget(action.frameTarget, `${p}.frameTarget`);
        if (result.frameScope === 'widget' && !result.targetId) fail(`${p}.targetId`, 'choose an inline frame target');
        if (result.frameScope === 'parent' && result.targetId !== undefined) fail(`${p}.targetId`, 'parent frame navigation has no widget target');
        if (action.value !== undefined) fail(`${p}.value`, 'frame navigation uses a structured destination');
      } else if (action.frameScope !== undefined || action.frameTarget !== undefined) fail(p, 'frame destination is only supported on openLinkInFrame');
      if (result.type === 'setAdaptiveView') {
        if (action.targetId !== undefined || action.value !== undefined) fail(p, 'adaptive selection uses a structured destination');
        const target = object(action.adaptiveView, `${p}.adaptiveView`, ['kind', 'viewId']);
        const kind = choice(target.kind, `${p}.adaptiveView.kind`, ['auto', 'base', 'view'] as const);
        if (kind === 'view') result.adaptiveView = { kind, viewId: key(target.viewId, `${p}.adaptiveView.viewId`) };
        else {
          if (target.viewId !== undefined) fail(`${p}.adaptiveView`, 'Auto and Base have no named view identifier');
          result.adaptiveView = { kind };
        }
      } else if (action.adaptiveView !== undefined) fail(`${p}.adaptiveView`, 'adaptive destination is only supported on setAdaptiveView');
      if (result.type === 'markRows' || result.type === 'unmarkRows') {
        const text = str(action.value, `${p}.value`); let selector: unknown;
        try { selector = JSON.parse(text); } catch { fail(`${p}.value`, 'row selector must be valid JSON'); }
        parseRepeaterRowSelector(selector, false, undefined, `${p}.value`);
      }
      if (NAMED_REPEATER_ACTIONS.includes(result.type)) validateNamedRepeaterAction(result, undefined, `${p}.value`);
      if (action.x !== undefined) result.x = num(action.x, `${p}.x`);
      if (action.y !== undefined) result.y = num(action.y, `${p}.y`);
      if (action.duration !== undefined) result.duration = num(action.duration, `${p}.duration`, 0, 60_000);
      if (action.style !== undefined) result.style = style(action.style, `${p}.style`, true);
      return result;
    }),
  };
}
function validateRows(value: unknown, path: string, columns: string[]): Record<string, string>[] {
  return array(value, path, DOCUMENT_LIMITS.rows).map((r, i) => {
    const row = object(r, `${path}[${i}]`, columns);
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, str(v, `${path}[${i}].${k}`, 10_000)]));
  });
}
function validateWidget(value: unknown, path: string, ctx: ValidationContext, depth: number, partial = false, inTable = false, isSubmenu = false, treeRole: 'node' | 'label' | undefined = undefined): Widget | Partial<Widget> {
  if (depth > DOCUMENT_LIMITS.depth || ++ctx.widgets > DOCUMENT_LIMITS.widgets) fail(path, 'widget nesting or total widget limit exceeded');
  const o = object(value, path, WIDGET_KEYS), result: Partial<Widget> = {};
  if (Array.isArray(o.interactions) && o.interactions.some(item => item?.event === 'adaptiveViewChange')) fail(`${path}.interactions`, 'adaptiveViewChange is supported only on a page');
  const required = (name: string) => !partial || o[name] !== undefined;
  if (required('id')) result.id = partial ? key(o.id, `${path}.id`) : identity(o.id, `${path}.id`, ctx);
  if (required('type')) result.type = choice(o.type, `${path}.type`, WIDGET_TYPES);
  if (result.type === 'treeNode' && treeRole !== 'node') fail(path, 'a tree node must belong to a tree');
  if (treeRole === 'node' && result.type !== 'treeNode') fail(path, 'trees contain only tree nodes');
  if (treeRole === 'label' && result.type !== 'text') fail(path, 'a tree label must be a text widget');
  if (result.type === 'tree' || result.type === 'treeNode' || treeRole === 'label') for (const field of ['states','activeStateId','repeater','table','menu','imageSrc','vectorPath','groupId','componentId','componentInstance','options','checked','radioGroup']) if (o[field] !== undefined) fail(`${path}.${field}`, 'tree objects contain only nodes and text labels');
  if (result.type === 'tableCell' && !inTable) fail(path, 'a tableCell must belong to a table');
  if (inTable && result.type !== 'tableCell') fail(path, 'a table can contain only tableCell widgets');
  if (result.type === 'tableCell') for (const field of ['states','activeStateId','repeater','table','menu','imageSrc','vectorPath','groupId','componentId','componentInstance','options','checked','radioGroup']) if (o[field] !== undefined) fail(`${path}.${field}`, 'table cells contain text and interactions only');
  if (result.type === 'table') for (const field of ['states','activeStateId','repeater','menu','imageSrc','vectorPath','componentId','componentInstance']) if (o[field] !== undefined) fail(`${path}.${field}`, 'table structure must be stored in table data');
  if (result.type === 'menu') for (const field of ['states','activeStateId','repeater','table','imageSrc','vectorPath','componentId','componentInstance']) if (o[field] !== undefined) fail(`${path}.${field}`, 'menu structure must be stored in menu data');
  for (const field of ['name', 'text', 'notes'] as const) if (required(field)) result[field] = str(o[field], `${path}.${field}`, field === 'name' ? 500 : DOCUMENT_LIMITS.text);
  if (result.type === 'inlineFrame') {
    if (result.text !== '') fail(`${path}.text`, 'an inline frame has no caption');
    for (const field of ['states','activeStateId','repeater','table','menu','tree','treeNode','imageSrc','vectorPath','options','checked','radioGroup','componentId','componentInstance']) if (o[field] !== undefined) fail(`${path}.${field}`, 'inline frame content uses a destination, not child widgets');
    const p = `${path}.inlineFrame`, frame = object(o.inlineFrame, p, ['target','hideBorders','scrolling','preview']);
    const preview = object(frame.preview, `${p}.preview`, ['kind','imageSrc']);
    const kind = choice(preview.kind, `${p}.preview.kind`, ['none','video','map','custom'] as const);
    result.inlineFrame = { hideBorders: bool(frame.hideBorders, `${p}.hideBorders`), scrolling: choice(frame.scrolling, `${p}.scrolling`, ['auto','yes','no'] as const), preview: { kind } };
    if (frame.target !== undefined) result.inlineFrame.target = parseFrameTarget(frame.target, `${p}.target`);
    if (preview.imageSrc !== undefined) {
      const image = str(preview.imageSrc, `${p}.preview.imageSrc`, DOCUMENT_LIMITS.image);
      if (kind !== 'custom' || !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(image)) fail(`${p}.preview.imageSrc`, 'custom frame previews require an embedded PNG, JPEG, WebP or GIF');
      result.inlineFrame.preview.imageSrc = image;
    }
  } else if (o.inlineFrame !== undefined) fail(`${path}.inlineFrame`, 'frame settings require an inlineFrame widget');
  if (o.richText !== undefined) {
    if (!(RICH_TEXT_WIDGET_TYPES as readonly string[]).includes(result.type!)) fail(`${path}.richText`, 'rich text is not supported by this widget type');
    result.richText = parseRichText(o.richText, `${path}.richText`, ctx);
    if (result.text !== richTextPlainText(result.richText)) fail(`${path}.text`, 'text must match the rich text paragraphs');
  }
  for (const field of ['x', 'y', 'rotation'] as const) if (required(field)) result[field] = num(o[field], `${path}.${field}`);
  for (const field of ['width', 'height'] as const) if (required(field)) result[field] = num(o[field], `${path}.${field}`, result.type === 'layer' ? 0 : 1, 100_000);
  if (o.placed !== undefined) result.placed = bool(o.placed, `${path}.placed`);
  for (const field of ['hidden', 'locked', 'disabled'] as const) if (required(field)) result[field] = bool(o[field], `${path}.${field}`);
  if (required('style')) result.style = style(o.style, `${path}.style`, false, true) as WidgetStyle;
  if (required('interactions')) result.interactions = array(o.interactions, `${path}.interactions`, 100).map((i, n) => validateInteraction(i, `${path}.interactions[${n}]`, ctx));
  if (result.type !== 'repeater' && result.interactions?.some(interaction => interaction.event === 'itemResize')) fail(`${path}.interactions`, 'itemResize is supported only on a repeater');
  for (const field of ['groupId', 'activeStateId', 'componentId'] as const) if (o[field] !== undefined) result[field] = key(o[field], `${path}.${field}`);
  if (o.componentInstance !== undefined) {
    const metadata = object(o.componentInstance, `${path}.componentInstance`, ['sourceIds']);
    const sourceIds = object(metadata.sourceIds, `${path}.componentInstance.sourceIds`);
    if (Object.keys(sourceIds).length > 100_000) fail(path, 'too many component source identifiers');
    result.componentInstance = { sourceIds: Object.fromEntries(Object.entries(sourceIds).map(([source, local]) => [key(source, `${path}.componentInstance source`), key(local, `${path}.componentInstance local`)])) };
  }
  if (o.checked !== undefined) result.checked = bool(o.checked, `${path}.checked`);
  if (o.error !== undefined) result.error = bool(o.error, `${path}.error`);
  for (const field of ['hintText', 'hintHideOn', 'hintStyle'] as const) {
    if (o[field] !== undefined && result.type !== 'input' && result.type !== 'textarea') fail(`${path}.${field}`, `${field} is only supported on input and textarea widgets`);
  }
  if (o.hintText !== undefined) result.hintText = str(o.hintText, `${path}.hintText`, DOCUMENT_LIMITS.text);
  if (o.hintHideOn !== undefined) result.hintHideOn = choice(o.hintHideOn, `${path}.hintHideOn`, ['focus', 'typing'] as const);
  if (o.selected !== undefined) {
    if (result.type === 'checkbox' || result.type === 'radio') fail(`${path}.selected`, 'checkbox and radio widgets use checked instead of selected');
    result.selected = bool(o.selected, `${path}.selected`);
  }
  if (o.selectionGroup !== undefined) {
    if (result.type === 'checkbox' || result.type === 'radio') fail(`${path}.selectionGroup`, 'selectionGroup is only supported on non-checkable widgets');
    result.selectionGroup = key(o.selectionGroup, `${path}.selectionGroup`);
  }
  if (o.radioGroup !== undefined) {
    if (result.type !== 'radio') fail(`${path}.radioGroup`, 'radioGroup is only supported on radio widgets');
    result.radioGroup = key(o.radioGroup, `${path}.radioGroup`);
  }
  for (const field of ['selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'disabledStyle', 'errorStyle', 'hintStyle'] as const) {
    if (o[field] !== undefined) result[field] = style(o[field], `${path}.${field}`, true);
  }
  if (o.vectorPath !== undefined) {
    if (!['box', 'ellipse', 'path'].includes(result.type ?? '')) fail(`${path}.vectorPath`, 'vectorPath is only supported on box, ellipse and path widgets');
    try { result.vectorPath = parseVectorPath(o.vectorPath); } catch (error) { fail(`${path}.vectorPath`, String(error)); }
  } else if (result.type === 'path') fail(`${path}.vectorPath`, 'path widgets require vectorPath');
  if (o.shapeText !== undefined) {
    if (!['box', 'ellipse', 'path'].includes(result.type ?? '')) fail(`${path}.shapeText`, 'shapeText is only supported on box, ellipse and path widgets');
    const p = `${path}.shapeText`, layout = object(o.shapeText, p, ['autoFitWidth', 'autoFitHeight']);
    result.shapeText = { autoFitWidth: bool(layout.autoFitWidth, `${p}.autoFitWidth`), autoFitHeight: bool(layout.autoFitHeight, `${p}.autoFitHeight`) };
  }
  if (o.selectionText !== undefined) {
    if (result.type !== 'checkbox' && result.type !== 'radio') fail(`${path}.selectionText`, 'selectionText is only supported on checkbox and radio widgets');
    const p = `${path}.selectionText`, layout = object(o.selectionText, p, ['autoFitWidth', 'autoFitHeight', 'alignRight']);
    result.selectionText = { autoFitWidth: bool(layout.autoFitWidth, `${p}.autoFitWidth`), autoFitHeight: bool(layout.autoFitHeight, `${p}.autoFitHeight`), alignRight: bool(layout.alignRight, `${p}.alignRight`) };
  }
  if (o.fitToContent !== undefined) {
    if (result.type !== 'panel') fail(`${path}.fitToContent`, 'fitToContent is only supported on panel widgets');
    result.fitToContent = bool(o.fitToContent, `${path}.fitToContent`);
  }
  if (o.inputType !== undefined) {
    if (result.type !== 'input') fail(`${path}.inputType`, 'inputType is only supported on input widgets');
    result.inputType = choice(o.inputType, `${path}.inputType`, INPUT_TYPES);
  }
  for (const field of ['readOnly', 'submitButtonId'] as const) {
    if (o[field] !== undefined && result.type !== 'input' && result.type !== 'textarea') fail(`${path}.${field}`, `${field} is only supported on input and textarea widgets`);
  }
  if (o.readOnly !== undefined) result.readOnly = bool(o.readOnly, `${path}.readOnly`);
  if (o.submitButtonId !== undefined) result.submitButtonId = key(o.submitButtonId, `${path}.submitButtonId`);
  if (o.maxLength !== undefined) {
    if (result.type !== 'input') fail(`${path}.maxLength`, 'maxLength is only supported on input widgets');
    const length = num(o.maxLength, `${path}.maxLength`, 0, 2147483647);
    if (!Number.isInteger(length)) fail(`${path}.maxLength`, 'expected an integer from 0 to 2147483647');
    result.maxLength = length;
  }
  if (o.options !== undefined) result.options = array(o.options, `${path}.options`, 500).map((s, i) => str(s, `${path}.options[${i}]`, 2000));
  for (const field of ['selectMode', 'multiple', 'selectedIndices'] as const) {
    if (o[field] !== undefined && result.type !== 'select') fail(`${path}.${field}`, `${field} is only supported on select widgets`);
  }
  if (o.selectMode !== undefined) result.selectMode = choice(o.selectMode, `${path}.selectMode`, ['dropdown', 'listbox'] as const);
  if (o.multiple !== undefined) result.multiple = bool(o.multiple, `${path}.multiple`);
  if (o.selectedIndices !== undefined) {
    result.selectedIndices = array(o.selectedIndices, `${path}.selectedIndices`, 500).map((value, index) => {
      const selected = num(value, `${path}.selectedIndices[${index}]`, 0, 499);
      if (!Number.isInteger(selected) || selected >= (result.options?.length ?? 0)) fail(`${path}.selectedIndices[${index}]`, 'expected an option index in range');
      return selected;
    });
    if (!result.multiple && result.selectedIndices.length > 1) fail(`${path}.selectedIndices`, 'single selection allows at most one option index');
    if (result.selectedIndices.some((value, index, indices) => index > 0 && value <= indices[index - 1])) fail(`${path}.selectedIndices`, 'option indices must be unique and sorted');
  }
  if (o.imageSrc !== undefined) {
    const source = str(o.imageSrc, `${path}.imageSrc`, DOCUMENT_LIMITS.image);
    if (!isSafeImageSource(source)) fail(`${path}.imageSrc`, 'only HTTP(S) images or inline PNG/JPEG/WebP/GIF are allowed');
    result.imageSrc = source;
  }
  if (result.type === 'layer') {
    if (result.text !== '') fail(`${path}.text`, 'a layer has no text content');
    for (const field of ['states','activeStateId','repeater','table','menu','tree','treeNode','imageSrc','vectorPath','options','checked','radioGroup','componentId','componentInstance','fitToContent'])
      if (o[field] !== undefined) fail(`${path}.${field}`, 'layer contents must be stored in layer.widgets');
    const p = `${path}.layer`, layer = object(o.layer, p, ['widgets','propagate']);
    result.layer = { widgets: array(layer.widgets, `${p}.widgets`).map((child, i) => validateWidget(child, `${p}.widgets[${i}]`, ctx, depth + 1) as Widget) };
    if (layer.propagate !== undefined) result.layer.propagate = bool(layer.propagate, `${p}.propagate`);
  } else if (o.layer !== undefined) fail(`${path}.layer`, 'layer data is supported only on layer widgets');
  if (o.states !== undefined) result.states = array(o.states, `${path}.states`, 100).map((s, i): PanelState => {
    const p = `${path}.states[${i}]`, state = object(s, p, ['id', 'name', 'widgets']);
    return { id: identity(state.id, `${p}.id`, ctx), name: str(state.name, `${p}.name`, 500), widgets: array(state.widgets, `${p}.widgets`).map((w, n) => validateWidget(w, `${p}.widgets[${n}]`, ctx, depth + 1) as Widget) };
  });
  if (o.repeater !== undefined) {
    const p = `${path}.repeater`, repeater = object(o.repeater, p, ['columns', 'rows', 'template', 'itemHeight', 'gap', 'pagination', 'itemWidth', 'layout', 'wrap', 'horizontalGap', 'verticalGap', 'fitToContent', 'padding']);
    const columns = array(repeater.columns, `${p}.columns`, 100).map((c, i) => key(c, `${p}.columns[${i}]`));
    if (!columns.length || new Set(columns).size !== columns.length) fail(`${p}.columns`, 'columns must be nonempty and unique');
    result.repeater = { columns, rows: validateRows(repeater.rows, `${p}.rows`, columns), template: array(repeater.template, `${p}.template`).map((w, i) => validateWidget(w, `${p}.template[${i}]`, ctx, depth + 1) as Widget), itemHeight: num(repeater.itemHeight, `${p}.itemHeight`, 0, 10_000), gap: num(repeater.gap, `${p}.gap`, 0, 10_000) };
    for (const field of ['itemWidth', 'horizontalGap', 'verticalGap'] as const) if (repeater[field] !== undefined) result.repeater[field] = num(repeater[field], `${p}.${field}`, 0, 10_000);
    if (repeater.layout !== undefined) result.repeater.layout = choice(repeater.layout, `${p}.layout`, ['vertical', 'horizontal'] as const);
    if (repeater.fitToContent !== undefined) result.repeater.fitToContent = bool(repeater.fitToContent, `${p}.fitToContent`);
    if (repeater.padding !== undefined) {
      const insets = array(repeater.padding, `${p}.padding`, 4);
      if (insets.length !== 4) fail(`${p}.padding`, 'expected exactly four padding values');
      result.repeater.padding = insets.map((value, index) => num(value, `${p}.padding[${index}]`, 0, 1000)) as [number, number, number, number];
    }
    if (repeater.wrap !== undefined) {
      result.repeater.wrap = num(repeater.wrap, `${p}.wrap`, 1, 10_000);
      if (!Number.isInteger(result.repeater.wrap)) fail(`${p}.wrap`, 'expected an integer number of items');
    }
    if (repeater.pagination !== undefined) {
      const pagination = object(repeater.pagination, `${p}.pagination`, ['itemsPerPage', 'startPage']);
      result.repeater.pagination = { itemsPerPage: num(pagination.itemsPerPage, `${p}.pagination.itemsPerPage`, 1, 10_000), startPage: num(pagination.startPage, `${p}.pagination.startPage`, 1, 10_000) };
    }
  }
  if (result.type === 'panel' && (!result.states?.length || !result.states.some(s => s.id === result.activeStateId))) fail(path, 'a panel requires states and a valid activeStateId');
  if (o.table !== undefined) {
    if (result.type !== 'table') fail(`${path}.table`, 'table data is supported only on table widgets');
    const p = `${path}.table`, source = object(o.table,p,['columnWidths','rowHeights','cells','cellOrder']);
    const columnWidths = array(source.columnWidths,`${p}.columnWidths`,TABLE_LIMITS.columns).map((v,i)=>num(v,`${p}.columnWidths[${i}]`,1,TABLE_LIMITS.size));
    const rowHeights = array(source.rowHeights,`${p}.rowHeights`,TABLE_LIMITS.rows).map((v,i)=>num(v,`${p}.rowHeights[${i}]`,1,TABLE_LIMITS.size));
    if (!columnWidths.length || !rowHeights.length || columnWidths.length*rowHeights.length>TABLE_LIMITS.cells) fail(p,'invalid table dimensions');
    const cells = array(source.cells,`${p}.cells`,TABLE_LIMITS.cells).map((v,i)=>validateWidget(v,`${p}.cells[${i}]`,ctx,depth+1,false,true) as Widget);
    if (cells.length !== columnWidths.length*rowHeights.length) fail(p,'table cells must fill a row-major matrix');
    result.table = { columnWidths,rowHeights,cells };
    if (source.cellOrder !== undefined) result.table.cellOrder = array(source.cellOrder,`${p}.cellOrder`,TABLE_LIMITS.cells).map((v,i)=>key(v,`${p}.cellOrder[${i}]`));
    let expected: Widget;
    try { expected = layoutTable(result as Widget); } catch (error) { fail(p,String(error)); }
    const same = (a:number|undefined,b:number) => a!==undefined && Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b));
    if (!same(result.width,expected!.width)||!same(result.height,expected!.height)) fail(p,'table size must equal its track sums');
    cells.forEach((cell,i)=>{const target=expected!.table!.cells[i];if (cell.rotation!==0||!(['x','y','width','height'] as const).every(key=>same(cell[key],target[key]))) fail(`${p}.cells[${i}]`,'cell geometry must match its row and column');});
  } else if (result.type === 'table') fail(path,'a table requires its row-major grid');
  if (o.menu !== undefined) {
    if (result.type !== 'menu') fail(`${path}.menu`, 'menu data is supported only on menu widgets');
    const p = `${path}.menu`, source = object(o.menu, p, ['orientation', 'table', 'submenus', 'parentCellId', 'padding']);
    const table = validateWidget(source.table, `${p}.table`, ctx, depth + 1) as Widget;
    if (table.type !== 'table') fail(`${p}.table`, 'a menu requires an independently identified table');
    const padding = array(source.padding, `${p}.padding`, 4).map((value, i) => num(value, `${p}.padding[${i}]`, 0, 100000));
    if (padding.length !== 4) fail(`${p}.padding`, 'menu padding requires four sides');
    const submenus = array(source.submenus, `${p}.submenus`, TABLE_LIMITS.cells).map((value, i) => validateWidget(value, `${p}.submenus[${i}]`, ctx, depth + 1, false, false, true) as Widget);
    result.menu = { orientation: choice(source.orientation, `${p}.orientation`, ['horizontal', 'vertical'] as const), table, submenus, padding: padding as [number, number, number, number] };
    if (source.parentCellId !== undefined) result.menu.parentCellId = key(source.parentCellId, `${p}.parentCellId`);
    if (isSubmenu !== Boolean(result.menu.parentCellId)) fail(p, 'only a submenu requires a parentCellId');
    try { menuData(result as Widget); } catch (error) { fail(p, String(error)); }
    const same = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b));
    if (table.rotation !== 0 || !same(table.x, padding[3]) || !same(table.y, padding[0]) || !same(result.width, table.width + padding[1] + padding[3]) || !same(result.height, table.height + padding[0] + padding[2])) fail(p, 'menu bounds and table location must match its padding');
    if (isSubmenu && result.rotation !== 0) fail(p, 'a submenu cannot rotate independently');
  } else if (result.type === 'menu' || isSubmenu) fail(path, 'a menu requires its table and submenu structure');
  if (o.tree !== undefined) {
    if (result.type !== 'tree') fail(`${path}.tree`, 'tree data is supported only by a tree root');
    const p = `${path}.tree`, source = object(o.tree, p, ['nodes','indent','showExpandIcons','iconStyle','showIcons']);
    const nodes = array(source.nodes, `${p}.nodes`, 4999).map((node, i) => validateWidget(node, `${p}.nodes[${i}]`, ctx, depth + 1, false, false, false, 'node') as Widget);
    if (!nodes.length) fail(p, 'a tree must contain at least one node');
    result.tree = { nodes, indent: num(source.indent, `${p}.indent`, 0, 100000), showExpandIcons: bool(source.showExpandIcons, `${p}.showExpandIcons`), showIcons: bool(source.showIcons, `${p}.showIcons`), iconStyle: choice(source.iconStyle, `${p}.iconStyle`, ['triangle','plusMinus'] as const) };
  } else if (result.type === 'tree') fail(path, 'a tree requires its nodes and properties');
  if (o.treeNode !== undefined) {
    if (result.type !== 'treeNode') fail(`${path}.treeNode`, 'tree node data requires a tree node');
    const p = `${path}.treeNode`, source = object(o.treeNode, p, ['label','children','expanded','iconSrc']);
    const label = validateWidget(source.label, `${p}.label`, ctx, depth + 1, false, false, false, 'label') as Widget;
    const children = array(source.children, `${p}.children`, 4999).map((node, i) => validateWidget(node, `${p}.children[${i}]`, ctx, depth + 1, false, false, false, 'node') as Widget);
    result.treeNode = { label, children, expanded: bool(source.expanded, `${p}.expanded`) };
    if (source.iconSrc !== undefined) {
      const image = str(source.iconSrc, `${p}.iconSrc`, DOCUMENT_LIMITS.image);
      if (!isSafeImageSource(image)) fail(`${p}.iconSrc`, 'invalid tree icon image source');
      result.treeNode.iconSrc = image;
    }
  } else if (result.type === 'treeNode') fail(path, 'a tree node requires its label and children');
  if (treeRole && result.rotation !== 0) fail(path, 'a tree node or label cannot rotate independently');
  if (result.type === 'repeater' && !result.repeater) fail(path, 'a repeater requires a dataset and template');
  if (result.componentInstance && (result.type !== 'panel' || !result.componentId || result.states?.length !== 1)) fail(path, 'a live component instance requires a linked, single-state panel');
  if (result.type === 'layer' && result.layer) {
    const fitted = fitLayerBounds(result as Widget);
    for (const field of ['x','y'] as const) num(fitted[field], `${path}.${field}`);
    for (const field of ['width','height'] as const) num(fitted[field], `${path}.${field}`, 0, 100_000);
    return fitted;
  }
  return result;
}
function validatePage(value: unknown, path: string, ctx: ValidationContext): Page {
  const p = object(value, path, ['id', 'name', 'parentId', 'width', 'height', 'background', 'widgets', 'notes', 'interactions', 'adaptiveViews', 'adaptiveSelection', 'adaptiveBaseSize', 'adaptiveViewSetId', 'adaptiveOverrides']);
  if (Array.isArray(p.interactions) && p.interactions.some(interaction => interaction?.event === 'itemResize')) fail(`${path}.interactions`, 'itemResize is supported only on a repeater');
  if (Array.isArray(p.interactions) && p.interactions.some(interaction => interaction?.event === 'resize' || interaction?.event === 'move')) fail(`${path}.interactions`, 'resize and move events require a widget');
  const selection = p.adaptiveSelection === undefined ? undefined : choice(p.adaptiveSelection, `${path}.adaptiveSelection`, ['native-size'] as const);
  const baseSize = p.adaptiveBaseSize === undefined ? undefined : object(p.adaptiveBaseSize, `${path}.adaptiveBaseSize`, ['width', 'height']);
  const page: Page = {
    id: identity(p.id, `${path}.id`, ctx), name: str(p.name, `${path}.name`, 500),
    ...(p.parentId === undefined ? {} : { parentId: key(p.parentId, `${path}.parentId`) }),
    width: num(p.width, `${path}.width`, 1, 100_000), height: num(p.height, `${path}.height`, 1, 100_000), background: color(p.background, `${path}.background`),
    widgets: array(p.widgets, `${path}.widgets`).map((w, i) => validateWidget(w, `${path}.widgets[${i}]`, ctx, 0) as Widget),
    notes: str(p.notes, `${path}.notes`), interactions: array(p.interactions, `${path}.interactions`, 100).map((a, i) => validateInteraction(a, `${path}.interactions[${i}]`, ctx)),
    ...(p.adaptiveViewSetId === undefined ? {} : { adaptiveViewSetId: key(p.adaptiveViewSetId, `${path}.adaptiveViewSetId`) }),
    ...(selection === undefined ? {} : { adaptiveSelection: selection }),
    ...(baseSize === undefined ? {} : { adaptiveBaseSize: { width: num(baseSize.width, `${path}.adaptiveBaseSize.width`, 0, 100_000), height: num(baseSize.height, `${path}.adaptiveBaseSize.height`, 0, 100_000) } }),
    adaptiveViews: array(p.adaptiveViews, `${path}.adaptiveViews`, 50).map((v, i): AdaptiveView => {
      const vp = `${path}.adaptiveViews[${i}]`, view = object(v, vp, ['id', 'name', 'width', 'height', 'baseViewId', 'overrides']);
      const overrides = object(view.overrides, `${vp}.overrides`);
      if (Object.keys(overrides).length > DOCUMENT_LIMITS.widgets) fail(`${vp}.overrides`, 'too many widget overrides');
      return { id: identity(view.id, `${vp}.id`, ctx), name: str(view.name, `${vp}.name`, 500), width: num(view.width, `${vp}.width`, selection === 'native-size' ? 0 : 1, 100_000),
        ...(view.height === undefined ? {} : { height: num(view.height, `${vp}.height`, 0, 100_000) }),
        ...(view.baseViewId === undefined ? {} : { baseViewId: key(view.baseViewId, `${vp}.baseViewId`) }),
        overrides: Object.fromEntries(Object.entries(overrides).map(([k, value]) => [key(k, `${vp}.overrides key`), validateAdaptiveOverride(value, `${vp}.overrides.${k}`)])) };
    }),
  };
  if (page.adaptiveViewSetId !== undefined && (page.adaptiveViews.length || selection !== undefined || baseSize !== undefined)) fail(path, 'a shared adaptive set owns all view definitions and Base metadata');
  if (p.adaptiveOverrides !== undefined) {
    const maps = object(p.adaptiveOverrides, `${path}.adaptiveOverrides`);
    if (Object.keys(maps).length > 1000) fail(`${path}.adaptiveOverrides`, 'too many adaptive view maps');
    page.adaptiveOverrides = Object.fromEntries(Object.entries(maps).map(([viewId, value]) => {
      key(viewId, `${path}.adaptiveOverrides key`);
      return [viewId, validateAdaptiveOverrides(value, `${path}.adaptiveOverrides.${viewId}`)];
    }));
  }
  validateAdaptiveParents(page.adaptiveViews, `${path}.adaptiveViews`);
  return page;
}

function validateAdaptiveParents(items: AdaptiveViewDefinition[], path: string): void {
  const views = new Map(items.map(view => [view.id, view]));
  for (const view of items) {
    const seen = new Set<string>(); let current: AdaptiveViewDefinition | undefined = view;
    while (current) {
      if (seen.has(current.id)) fail(path, 'adaptive parent cycle is not allowed');
      seen.add(current.id);
      if (current.baseViewId === undefined) break;
      const parent = views.get(current.baseViewId);
      if (!parent) fail(path, 'adaptive parent must exist in the same view collection');
      current = parent;
    }
  }
}

function validateAdaptiveOverrides(value: unknown, path: string): Record<string, AdaptiveWidgetOverride> {
  const map = object(value, path);
  if (Object.keys(map).length > DOCUMENT_LIMITS.widgets) fail(path, 'too many widget overrides');
  return Object.fromEntries(Object.entries(map).map(([id, patch]) => [key(id, `${path} key`), validateAdaptiveOverride(patch, `${path}.${id}`)]));
}

function validateAdaptiveViewSet(value: unknown, path: string, ctx: ValidationContext): AdaptiveViewSet {
  const set = object(value, path, ['id', 'name', 'baseSize', 'views']);
  const size = object(set.baseSize, `${path}.baseSize`, ['width', 'height']);
  const result: AdaptiveViewSet = {
    id: identity(set.id, `${path}.id`, ctx), name: str(set.name, `${path}.name`, 500),
    baseSize: { width: num(size.width, `${path}.baseSize.width`, 0, 100_000), height: num(size.height, `${path}.baseSize.height`, 0, 100_000) },
    views: array(set.views, `${path}.views`, 50).map((item, i) => {
      const vp = `${path}.views[${i}]`, view = object(item, vp, ['id', 'name', 'width', 'height', 'baseViewId']);
      return { id: identity(view.id, `${vp}.id`, ctx), name: str(view.name, `${vp}.name`, 500), width: num(view.width, `${vp}.width`, 0, 100_000),
        ...(view.height === undefined ? {} : { height: num(view.height, `${vp}.height`, 0, 100_000) }),
        ...(view.baseViewId === undefined ? {} : { baseViewId: key(view.baseViewId, `${vp}.baseViewId`) }) };
    }),
  };
  validateAdaptiveParents(result.views, `${path}.views`);
  return result;
}

function validateAdaptiveOverride(value: unknown, path: string): AdaptiveWidgetOverride {
  const obj = object(value, path, ['x', 'y', 'width', 'height', 'rotation', 'hidden', 'placed', 'style', 'textPaddingSides', 'stateStyles']);
  const result: AdaptiveWidgetOverride = {};
  for (const field of ['x', 'y', 'rotation'] as const) if (obj[field] !== undefined) result[field] = num(obj[field], `${path}.${field}`);
  for (const field of ['width', 'height'] as const) if (obj[field] !== undefined) result[field] = num(obj[field], `${path}.${field}`, 1, 100_000);
  if (obj.placed !== undefined) result.placed = bool(obj.placed, `${path}.placed`);
  if (obj.hidden !== undefined) result.hidden = bool(obj.hidden, `${path}.hidden`);
  if (obj.style !== undefined) result.style = style(obj.style, `${path}.style`, true, true);
  if (obj.textPaddingSides !== undefined) {
    const sides = object(obj.textPaddingSides, `${path}.textPaddingSides`, ['top', 'right', 'bottom', 'left']);
    result.textPaddingSides = Object.fromEntries(Object.entries(sides).map(([side, value]) => [side, num(value, `${path}.textPaddingSides.${side}`, 0, 1000)]));
  }
  if (obj.stateStyles !== undefined) {
    const map = object(obj.stateStyles, `${path}.stateStyles`, ['mouseOver', 'mouseDown', 'focused', 'selected', 'error', 'hint', 'disabled']);
    result.stateStyles = Object.fromEntries(Object.entries(map).map(([state, value]) => [state, style(value, `${path}.stateStyles.${state}`, true)]));
  }
  return result;
}

/** Import is a trust boundary. Reconstruct approved fields instead of spreading JSON into state. */
export function parseDocument(text: string): Document {
  if (typeof text !== 'string' || text.length > DOCUMENT_LIMITS.characters) throw new Error('Project exceeds the 20 MiB text limit');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Project file is not valid JSON'); }
  const obj = object(parsed, 'document', ['format', 'version', 'id', 'name', 'caseSelection', 'pages', 'pageFolders', 'pageOrder', 'components', 'variables', 'styles', 'adaptiveViewSets']);
  if (obj.format !== 'rea-prototype' || obj.version !== 1) fail('document', 'unsupported format/version; expected rea-prototype version 1');
  const ctx: ValidationContext = { ids: new Set(), widgets: 0 };
  const id = identity(obj.id, 'document.id', ctx);
  const pages = array(obj.pages, 'document.pages', DOCUMENT_LIMITS.pages).map((p, i) => validatePage(p, `document.pages[${i}]`, ctx));
  if (pages.length === 0) fail('document.pages', 'at least one page is required');
  const pageFolders = obj.pageFolders === undefined ? undefined : array(obj.pageFolders, 'document.pageFolders', DOCUMENT_LIMITS.pageFolders).map((value, i): PageFolder => {
    const path = `document.pageFolders[${i}]`, folder = object(value, path, ['id', 'name', 'parentId']);
    return { id: identity(folder.id, `${path}.id`, ctx), name: str(folder.name, `${path}.name`, 500), ...(folder.parentId === undefined ? {} : { parentId: key(folder.parentId, `${path}.parentId`) }) };
  });
  const pageOrder = obj.pageOrder === undefined ? undefined : array(obj.pageOrder, 'document.pageOrder', DOCUMENT_LIMITS.pages + DOCUMENT_LIMITS.pageFolders).map((value, i) => key(value, `document.pageOrder[${i}]`));
  const variables = object(obj.variables, 'document.variables');
  if (Object.keys(variables).length > 1000) fail('document.variables', 'too many variables');
  const document: Document = {
    format: 'rea-prototype', version: 1, id, name: str(obj.name, 'document.name', 500), pages,
    ...(obj.adaptiveViewSets === undefined ? {} : { adaptiveViewSets: array(obj.adaptiveViewSets, 'document.adaptiveViewSets', 100).map((set, i) => validateAdaptiveViewSet(set, `document.adaptiveViewSets[${i}]`, ctx)) }),
    ...(pageFolders === undefined ? {} : { pageFolders }), ...(pageOrder === undefined ? {} : { pageOrder }),
    ...(obj.caseSelection !== undefined ? { caseSelection: choice(obj.caseSelection, 'document.caseSelection', ['auto', 'always', 'never'] as const) } : {}),
    components: array(obj.components, 'document.components', 500).map((c, i): Component => {
      const p = `document.components[${i}]`, component = object(c, p, ['id', 'name', 'widgets', 'width', 'height']);
      return { id: identity(component.id, `${p}.id`, ctx), name: str(component.name, `${p}.name`, 500), width: num(component.width, `${p}.width`, 1, 100_000), height: num(component.height, `${p}.height`, 1, 100_000), widgets: array(component.widgets, `${p}.widgets`).map((w, n) => validateWidget(w, `${p}.widgets[${n}]`, ctx, 0) as Widget) };
    }),
    variables: Object.fromEntries(Object.entries(variables).map(([k, v]) => [key(k, 'document.variables key'), str(v, `document.variables.${k}`)])),
    styles: array(obj.styles, 'document.styles', 500).map((s, i) => {
      const p = `document.styles[${i}]`, item = object(s, p, ['id', 'name', 'style']);
      return { id: identity(item.id, `${p}.id`, ctx), name: str(item.name, `${p}.name`, 500), style: style(item.style, `${p}.style`, false, true) as WidgetStyle };
    }),
  };
  for (const page of pages) {
    if (page.adaptiveViewSetId && !document.adaptiveViewSets?.some(set => set.id === page.adaptiveViewSetId)) fail('document.pages.adaptiveViewSetId', 'referenced adaptive view set does not exist');
    if (page.adaptiveOverrides) {
      const localIds = new Set<string>(); mapWidgets(page.widgets, widget => { localIds.add(widget.id); return widget; });
      for (const map of Object.values(page.adaptiveOverrides)) for (const widgetId of Object.keys(map)) {
        if (!localIds.has(widgetId)) fail('document.pages.adaptiveOverrides', 'adaptive override widget must exist on the same page');
      }
    }
  }
  const ordered = normalizePageTree(document);
  validateComponentReferences(ordered, ctx);
  validateSelectionTargets(ordered);
  return ordered;
}

function validateSelectionTargets(document: Document): void {
  const widgets = new Map<string, Widget>();
  const actions: { action: Action; path: string }[] = [];
  const conditions: { condition: Condition; path: string }[] = [];
  const visitCases = (cases: Interaction[], path: string) => cases.forEach((item, index) => {
    item.conditions.forEach((condition, conditionIndex) => { if (condition.source === 'selectedOption') conditions.push({ condition, path: `${path}[${index}].conditions[${conditionIndex}]` }); });
    item.actions.forEach((action, actionIndex) => {
      if (action.type === 'openLinkInFrame' || action.type === 'setSelected' || action.type === 'setSelectedOption' || action.type === 'resizeItem' || ['expandTreeNode','collapseTreeNode','toggleTreeNode'].includes(action.type) || NAMED_REPEATER_ACTIONS.includes(action.type)) actions.push({ action, path: `${path}[${index}].actions[${actionIndex}]` });
    });
  });
  const visitWidgets = (items: Widget[], path: string) => items.forEach((widget, index) => {
    const location = `${path}[${index}]`; widgets.set(widget.id, widget); visitCases(widget.interactions, `${location}.interactions`);
    widget.richText?.links?.forEach((link,i) => visitCases(link.interactions, `${location}.richText.links[${i}].interactions`));
    if (widget.layer) visitWidgets(widget.layer.widgets, `${location}.layer.widgets`);
    widget.states?.forEach((state, stateIndex) => visitWidgets(state.widgets, `${location}.states[${stateIndex}].widgets`));
    if (widget.repeater) visitWidgets(widget.repeater.template, `${location}.repeater.template`);
    if (widget.table) visitWidgets(widget.table.cells, `${location}.table.cells`);
    if (widget.menu) visitWidgets([widget.menu.table, ...widget.menu.submenus], `${location}.menu.children`);
    if (widget.tree) visitWidgets(widget.tree.nodes, `${location}.tree.nodes`);
    if (widget.treeNode) visitWidgets([widget.treeNode.label, ...widget.treeNode.children], `${location}.treeNode.contents`);
  });
  document.pages.forEach((page, index) => { visitCases(page.interactions, `document.pages[${index}].interactions`); visitWidgets(page.widgets, `document.pages[${index}].widgets`); });
  document.components.forEach((component, index) => visitWidgets(component.widgets, `document.components[${index}].widgets`));
  const menuContents = menuSharedDescendantIds(document.pages.flatMap(page => page.widgets));
  const treeContents = treeSharedDescendantIds(document.pages.flatMap(page => page.widgets));
  for (const page of document.pages) for (const overrides of [...page.adaptiveViews.map(view => view.overrides), ...Object.values(page.adaptiveOverrides ?? {})]) for (const [id, override] of Object.entries(overrides)) {
    const type = widgets.get(id)?.type;
    if (treeContents.has(id) && Object.keys(override).length || type === 'tree' && Object.keys(override).some(key => key !== 'hidden' && key !== 'placed')) fail('document.pages.adaptiveViews', 'tree content and layout are shared across adaptive views');
    if (menuContents.has(id) && Object.keys(override).length || type === 'menu' && Object.keys(override).some(key => key !== 'hidden' && key !== 'placed')) fail('document.pages.adaptiveViews', 'menu content and layout are shared across adaptive views');
    if (type === 'tableCell' && Object.keys(override).length || type === 'table' && Object.keys(override).some(key=>key!=='hidden'&&key!=='placed')) fail('document.pages.adaptiveViews', 'table geometry and cell properties are shared across adaptive views');
    if (type === 'layer' && ['x','y','width','height'].some(key => Object.hasOwn(override, key))) fail('document.pages.adaptiveViews', 'layer bounds are derived from member geometry; override the members instead');
  }
  for (const { action, path } of actions) {
    const target = action.targetId ? widgets.get(action.targetId) : undefined;
    if (action.type === 'openLinkInFrame') {
      if (target && target.type !== 'inlineFrame') fail(`${path}.targetId`, 'frame navigation requires an inlineFrame target');
    } else if (['expandTreeNode','collapseTreeNode','toggleTreeNode'].includes(action.type)) {
      if (target && target.type !== 'treeNode') fail(`${path}.targetId`, 'tree expansion requires a tree node target');
    } else if (action.type === 'setSelected') {
      if (target?.type === 'panel' || target?.type === 'repeater') fail(`${path}.targetId`, 'setSelected does not support panel or repeater targets');
    } else if (action.type === 'setSelectedOption') {
      if (target && target.type !== 'select') fail(`${path}.targetId`, 'setSelectedOption requires a select target');
    } else if (action.type === 'resizeItem') {
      if (target && target.type !== 'repeater') fail(`${path}.targetId`, 'resizeItem requires a repeater target');
    } else if (target) {
      if (target.type !== 'repeater') fail(`${path}.targetId`, 'named filter and sort actions require a repeater target');
      validateNamedRepeaterAction(action, target.repeater!.columns, `${path}.value`);
    }
  }
  for (const { condition, path } of conditions) {
    const target = widgets.get(condition.key);
    if (target && target.type !== 'select') fail(`${path}.key`, 'selectedOption requires a select target');
  }
}

function validateComponentReferences(document: Document, ctx: ValidationContext): void {
  const definitions = new Map(document.components.map(component => [component.id, component]));
  const sourceIdentifiers = new Map(document.components.map(component => [component.id, collectWidgetIdentifiers(component.widgets)]));
  const knownIds = new Set(ctx.ids), claimedLocals = new Map<string, string>();
  for (const page of document.pages) for (const id of collectWidgetIdentifiers(page.widgets).keys()) knownIds.add(id);
  for (const identifiers of sourceIdentifiers.values()) for (const id of identifiers.keys()) knownIds.add(id);
  for (const component of document.components) mapWidgets(component.widgets, widget => {
    if (widget.componentInstance) fail('document.components', 'linked components inside component definitions are not supported; detach the nested instance first');
    return widget;
  });
  for (const page of document.pages) mapWidgets(page.widgets, widget => {
    if (!widget.componentInstance) return widget; // Legacy componentId-only templates remain readable.
    const definition = definitions.get(widget.componentId!);
    if (!definition) fail('document.pages', 'component instance references a missing definition');
    const sources = sourceIdentifiers.get(definition.id)!, locals = collectWidgetIdentifiers(widget.states![0].widgets);
    const values = new Set<string>();
    if (Object.keys(widget.componentInstance.sourceIds).length !== sources.size) fail('document.pages', 'component source map must include every definition identifier');
    for (const [source, local] of Object.entries(widget.componentInstance.sourceIds)) {
      if (!sources.has(source)) fail('document.pages', 'component instance references an unknown source identifier');
      if (values.has(local)) fail('document.pages', 'component source map must be one-to-one');
      values.add(local);
      if (claimedLocals.has(local) && claimedLocals.get(local) !== widget.id) fail('document.pages', 'component instances cannot share mapped local identifiers');
      claimedLocals.set(local, widget.id);
      // Missing local IDs represent edits pending publication. Existing IDs may never escape the instance.
      if (!locals.has(local) && knownIds.has(local)) fail('document.pages', 'component source map points outside its instance');
      if (locals.has(local) && locals.get(local) !== sources.get(source)) fail('document.pages', 'component source map identifier kind does not match');
    }
    return widget;
  });
}

export function serializeDocument(doc: Document): string {
  return JSON.stringify(parseDocument(JSON.stringify(doc)), null, 2);
}
