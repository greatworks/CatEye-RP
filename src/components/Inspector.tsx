import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import type { Action, ActionType, Condition, Document, EventType, Interaction, Page, RepeaterRowSelector, RepeaterFilterSpec, RepeaterSortSpec, RepeaterRuleRemoval, Widget, WidgetStyle, VectorCommand, VectorPath } from '../model/types';
import { INPUT_TYPES, PIN_HORIZONTAL_VALUES, PIN_VERTICAL_VALUES, type InputType, type PinHorizontal, type PinVertical } from '../model/types';
import { resolveResizePins } from '../model/resize-pins';
import { getSelectedOptionIndices, mergeWidgetStyle, parseRepeaterRowSelector, parseRepeaterFilterSpec, parseRepeaterSortSpec, parseRepeaterRuleRemoval, parseWidgetStylePatch } from '../model/document';
import { parseVectorPath, vectorPathData, VECTOR_LIMITS } from '../model/vector';
import { resolveVectorEditPath, vectorEditPathUnsupportedReason } from '../model/vector-authoring';
import { RICH_TEXT_WIDGET_TYPES } from '../model/rich-text';
import './Inspector.css';
import { FrameTargetEditor, InlineFrameProperties, frameTargetLabel } from './FrameTargetEditor';
import { SHADOW_FIELDS, ShadowEditor, ShadowOverrides, RetainedShadows, shadowFieldsFor } from './ShadowEditor';
import { FillEditor, FillOverrideEditor, StrokeEditor, StrokeOverrideEditor } from './FillEditor';
import { LineStyleEditor, LineStyleOverrides } from './LineStyleEditor';
import { TreeStructureControls, type TreeInspectorContext } from './TreeEditor';
import { MenuStructureControls, type MenuInspectorContext } from './MenuEditor';
import { TableStructureControls, type TableInspectorContext } from './TableEditor';
import { cornerStylePatch, type CornerStyleCommand, type WidgetStyleEditIntent } from './widget-style-command';
import { CornerEditor, CornerOverrides, supportsCornerEditing } from './CornerEditor';
import { RotationActionEditor, defaultRotateAction } from './RotationActionEditor';
import { MotionActionEditor, defaultMoveTarget, defaultResizeTarget, supportsAnimatedResize } from './MotionActionEditor';

type Props = {
  page: Page;
  styleContextKey?: string;
  adaptiveEffects?: { local: boolean; onInherit: () => void };
  tableContext?: TableInspectorContext;
  menuContext?: MenuInspectorContext;
  treeContext?: TreeInspectorContext;
  widget?: Widget;
  onWidgetChange: (patch: Partial<Widget>, explicitTextStyle?: Partial<WidgetStyle>, styleIntent?: WidgetStyleEditIntent) => void;
  onPageChange: (patch: Partial<Page>) => void;
  document: Document;
  onStylePreview?: (preview: { widgetId: string; field: InteractionStyleField } | null) => void;
  onEditRichText?: (widgetId: string) => void;
  onEditPoints?: (widgetId: string) => void;
  onEditFrameTarget?: (widgetId: string) => void;
};
export type InteractionStyleField = 'mouseOverStyle' | 'mouseDownStyle' | 'focusedStyle' | 'selectedStyle' | 'errorStyle' | 'hintStyle' | 'disabledStyle';
const effectChoices: [InteractionStyleField, string][] = [['mouseOverStyle', 'MouseOver'], ['mouseDownStyle', 'MouseDown'], ['focusedStyle', 'Focused'], ['selectedStyle', 'Selected'], ['errorStyle', 'Error'], ['hintStyle', 'Hint'], ['disabledStyle', 'Disabled']];
const inputTypeLabels: Record<InputType, string> = { text: 'Text', password: 'Password', email: 'Email', number: 'Number', tel: 'Phone', url: 'URL', search: 'Search', file: 'File', date: 'Date', month: 'Month', time: 'Time' };

const events: [EventType, string][] = [
  ['click', 'Click or tap'], ['doubleClick', 'Double click'], ['mouseEnter', 'Mouse enter'],
  ['mouseLeave', 'Mouse exit'], ['show', 'Shown'], ['hide', 'Hidden'], ['change', 'Value changed'], ['focus', 'Got focus'], ['blur', 'Lost focus'], ['load', 'Loaded'],
  ['resize', 'Resized'], ['move', 'Moved'], ['rotate', 'Rotated'],
  ['dragStart', 'Drag started'], ['drag', 'Dragged'], ['dragDrop', 'Drag dropped'], ['swipeLeft', 'Swiped left'], ['swipeRight', 'Swiped right'], ['swipeUp', 'Swiped up'], ['swipeDown', 'Swiped down'],
  ['adaptiveViewChange', 'Adaptive view changed'],
  ['selectedChange', 'Selected changed'], ['select', 'Selected'], ['unselect', 'Unselected'], ['errorSet', 'Error set'], ['errorRemoved', 'Error removed'],
];
const actionTypes: [ActionType, string][] = [
  ['setAdaptiveView', 'Set adaptive view'],
  ['openLinkInFrame', 'Open link in frame'], ['openPage', 'Open page'], ['openUrl', 'Open URL'], ['show', 'Show'], ['hide', 'Hide'], ['toggle', 'Toggle visibility'],
  ['setText', 'Set text'], ['setSelectedOption', 'Set selected option'], ['setFocus', 'Set focus'], ['setState', 'Set panel state'], ['nextState', 'Next panel state'],
  ['previousState', 'Previous panel state'], ['setVariable', 'Set variable value'],
  ['move', 'Move'], ['rotate', 'Rotate'], ['resize', 'Set size'], ['setStyle', 'Apply style'], ['enable', 'Enable'],
  ['disable', 'Disable'], ['wait', 'Wait'], ['addRow', 'Add repeater row'],
  ['deleteRow', 'Delete repeater row'], ['updateRow', 'Update repeater rows'], ['sortRows', 'Sort repeater rows'], ['filterRows', 'Filter repeater rows'],
  ['expandTreeNode', 'Expand tree node'], ['collapseTreeNode', 'Collapse tree node'], ['toggleTreeNode', 'Toggle tree node'],
  ['setSelected', 'Set selected / checked'], ['setError', 'Set error state'],
  ['markRows', 'Mark repeater rows'], ['unmarkRows', 'Unmark repeater rows'],
  ['setRepeaterPage', 'Set repeater page'], ['setItemsPerPage', 'Set items per page'],
  ['addFilter', 'Add named filter'], ['removeFilter', 'Remove named filter'],
  ['addSort', 'Add named sort'], ['removeSort', 'Remove named sort'],
  ['resizeItem', 'Resize this item'],
];
const operators: [Condition['operator'], string][] = [
  ['equals', 'equals'], ['notEquals', 'does not equal'], ['contains', 'contains'],
  ['greater', 'is greater than'], ['less', 'is less than'], ['isEmpty', 'is empty'],
];
const panelActions: ActionType[] = ['setState', 'nextState', 'previousState'];
const repeaterActions: ActionType[] = ['addRow', 'deleteRow', 'updateRow', 'sortRows', 'filterRows', 'markRows', 'unmarkRows', 'setRepeaterPage', 'setItemsPerPage', 'addFilter', 'removeFilter', 'addSort', 'removeSort'];
const namedRepeaterActions = ['addFilter', 'removeFilter', 'addSort', 'removeSort'];
const id = () => crypto.randomUUID();

function actionDefaults(type: ActionType): Partial<Action> {
  const values: Partial<Record<ActionType, string>> = { setSelectedOption: '', setSelected: 'true', setError: 'true', updateRow: JSON.stringify({ row: 'this', values: {} }), deleteRow: '0', markRows: JSON.stringify({ row: 'this' }), unmarkRows: JSON.stringify({ row: 'this' }), setRepeaterPage: 'next', setItemsPerPage: '20', addFilter: JSON.stringify({ name: 'Filter 1', expression: '[[true]]', mode: 'smart', removeOthers: false }), addSort: JSON.stringify({ name: 'Sort 1', column: '', direction: 'asc', dataType: 'text', toggle: false, removeOthers: false }), removeFilter: '{"name":""}', removeSort: '{"name":""}' };
  return { type, adaptiveView: type === 'setAdaptiveView' ? { kind: 'auto' } : undefined, frameScope:undefined, frameTarget:undefined, targetId: undefined, value: type === 'openUrl' ? '' : values[type], x: undefined, y: undefined, selectText: undefined, windowTarget: type === 'openUrl' ? 'current' : undefined,
    duration: type === 'wait' ? 500 : undefined, rotate: type === 'rotate' ? defaultRotateAction() : undefined,
    move: type === 'move' ? { targets: [defaultMoveTarget()] } : undefined, resize: type === 'resize' ? { targets: [defaultResizeTarget()] } : undefined,
    style: type === 'setStyle' ? { fill: '#2563eb' } : undefined };
}

function collectWidgets(widgets: Widget[], prefix = ''): { widget: Widget; label: string; siblings: Widget[] }[] {
  return widgets.flatMap(widget => {
    const label = `${prefix}${widget.name || widget.type}`;
    return [
      { widget, label, siblings: widgets },
      ...collectWidgets(widget.layer?.widgets ?? [], `${label} / `),
      ...(widget.states ?? []).flatMap(state => collectWidgets(state.widgets, `${label} / ${state.name} / `)),
      ...collectWidgets(widget.repeater?.template ?? [], `${label} / Item / `),
      ...collectWidgets(widget.table?.cells ?? [], `${label} / Cell / `),
      ...collectWidgets(widget.tree?.nodes ?? [], `${label} / Node / `),
      ...(widget.treeNode ? [...collectWidgets([widget.treeNode.label], `${label} / Label / `), ...collectWidgets(widget.treeNode.children, `${label} / Child / `)] : []),
      ...(widget.menu ? [...collectWidgets([widget.menu.table], `${label} / `),...collectWidgets(widget.menu.submenus, `${label} / Submenu / `)] : []),
    ];
  });
}

/** A source may resize its own repeater item or an enclosing repeater item. */
export function getResizeItemTargets(page: Pick<Page, 'widgets'>, source?: Widget): Widget[] {
  if (!source) return [];
  const visit = (widgets: Widget[], owners: Widget[]): Widget[] | undefined => {
    for (const widget of widgets) {
      const scopes = widget.type === 'repeater' ? [...owners, widget] : owners;
      if (widget.id === source.id) return scopes;
      if (widget.layer) { const found = visit(widget.layer.widgets, owners); if (found) return found; }
      for (const state of widget.states ?? []) { const found = visit(state.widgets, owners); if (found) return found; }
      if (widget.repeater) { const found = visit(widget.repeater.template, scopes); if (found) return found; }
      if (widget.table) { const found = visit(widget.table.cells, owners); if (found) return found; }
      if (widget.tree) { const found = visit(widget.tree.nodes, owners); if (found) return found; }
      if (widget.treeNode) { const found = visit([widget.treeNode.label,...widget.treeNode.children], owners); if (found) return found; }
      if (widget.menu) { const found = visit([widget.menu.table,...widget.menu.submenus], owners); if (found) return found; }
    }
    return undefined;
  };
  return visit(page.widgets, []) ?? [];
}

function NumberField({ label, value, onChange, min, max, step = 1, commitUnchanged = false, normalizeOnCommit = false }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; commitUnchanged?: boolean; normalizeOnCommit?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [modified, setModified] = useState(false);
  const focused=useRef(false);
  useEffect(() => { if(!focused.current){setDraft(String(value)); setModified(false);} }, [value]);
  function commit() {
    if(!modified){setDraft(String(value));return;}
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) { setDraft(String(value)); setModified(false); return; }
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    // Point rebounding can return the same canonical percentage as before.
    // Reset the draft even then; a changed canonical value arrives via the effect.
    setDraft(String(normalizeOnCommit ? value : next)); setModified(false);
    if (next !== value || (commitUnchanged && modified)) onChange(next);
  }
  return <label className="inspector-number"><span>{label}</span><input aria-label={label} type="number" value={draft} min={min} max={max} step={step} onFocus={()=>{focused.current=true}} onChange={event => { setDraft(event.target.value); setModified(true); }} onBlur={()=>{focused.current=false;commit()}} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="inspector-section" open={defaultOpen}><summary><ChevronDown size={12} />{title}</summary><div className="inspector-section-body">{children}</div></details>;
}

function TextValue({ label, value, onChange, multiline=false, className }: { label:string; value:string; onChange:(value:string)=>void; multiline?:boolean; className?:string }) {
  const [draft,setDraft]=useState(value),focused=useRef(false);
  // An earlier queued font/layout command may finish while the user is typing
  // the next value. Keep the input draft, while every full-value intent is sent.
  useEffect(()=>{if(!focused.current)setDraft(value)},[value]);
  const props={className,'aria-label':label,value:draft,spellCheck:false,onFocus:()=>{focused.current=true},onBlur:()=>{focused.current=false},onChange:(event:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{setDraft(event.target.value);onChange(event.target.value)}};
  return multiline?<textarea {...props} rows={3}/>:<input {...props}/>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="inspector-color"><span>{label}</span><span className="inspector-swatch" style={{ background: value }} /><TextValue label={label} value={value} onChange={onChange}/></label>;
}

function JsonEditor({ label, value, validate, onApply, hint }: {
  label: string; value: unknown; validate: (data: unknown) => string | null; onApply: (data: unknown) => void; hint?: string;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState('');
  const editorId = useId();
  useEffect(() => { setDraft(serialized); setError(''); }, [serialized]);
  function apply() {
    try {
      const parsed: unknown = JSON.parse(draft);
      const validationError = validate(parsed);
      if (validationError) { setError(validationError); return; }
      onApply(parsed);
      setError('');
    } catch { setError('Enter valid JSON before applying.'); }
  }
  return <div className="inspector-json"><label htmlFor={editorId}>{label}</label><textarea id={editorId} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${editorId}-error` : undefined} />{hint && <p className="inspector-help">{hint}</p>}{error && <p id={`${editorId}-error`} className="inspector-error" role="alert">{error}</p>}<button className="inspector-small-button" onClick={apply}>Apply {label.toLowerCase()}</button></div>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringRecord = (value: unknown): value is Record<string, string> => isRecord(value) && Object.values(value).every(item => typeof item === 'string');
function validateStyle(data: unknown): string | null {
  try { parseWidgetStylePatch(data); return null; } catch (error) { return error instanceof Error ? error.message : String(error); }
}

type UpdateRowSpec = RepeaterRowSelector & { values: Record<string, string> };
export function validateRowSelectorSpec(data: unknown, columns: string[], allowMarked = false): string | null {
  try { parseRepeaterRowSelector(data, allowMarked, columns); return null; } catch (error) { return error instanceof Error ? error.message : String(error); }
}
export function validateUpdateRowSpec(data: unknown, columns: string[]): string | null {
  if (!isRecord(data) || Object.keys(data).some(key => !['row', 'where', 'values'].includes(key))) return 'Use only row or where, and values in an update specification.';
  if (Object.hasOwn(data, 'row') === Object.hasOwn(data, 'where')) return 'Choose exactly one row selector: row or where.';
  if (!isStringRecord(data.values)) return 'Updated columns must be an object with text values.';
  for (const [column, value] of Object.entries(data.values)) {
    if (['__proto__', 'prototype', 'constructor'].includes(column) || !columns.includes(column)) return `Unknown or unsupported column: ${column}`;
    if (value.length > 10_000) return 'Each updated value must contain at most 10000 characters.';
  }
  const { values: _values, ...selector } = data;
  return validateRowSelectorSpec(selector, columns, true);
}

function RowSelectorEditor({ spec, columns, verb, allowMarked = false, onChange }: { spec: RepeaterRowSelector; columns: string[]; verb: 'Update' | 'Delete' | 'Mark' | 'Unmark'; allowMarked?: boolean; onChange: (spec: RepeaterRowSelector) => void }) {
  const mode = spec.where ? 'matching' : typeof spec.row === 'number' ? 'index' : spec.row!;
  return <>
    <label className="inspector-field">Rows to {verb.toLowerCase()}<select aria-label={`Rows to ${verb.toLowerCase()}`} value={mode} onChange={event => {
      const next = event.target.value;
      onChange(next === 'matching' ? { where: { column: columns[0] ?? '', operator: 'equals', value: '' } } : { row: next === 'index' ? 0 : next as RepeaterRowSelector['row'] });
    }}><option value="this">Current row</option><option value="all">All rows</option>{allowMarked && <option value="marked">Marked rows</option>}<option value="index">Row index</option><option value="matching" disabled={!columns.length}>Matching rows</option></select></label>
    {mode === 'this' && <p className="inspector-help">Current row requires an event from a repeater item.</p>}
    {mode === 'all' && verb === 'Update' && <p className="inspector-help">Updates every data row, including rows hidden by a filter.</p>}
    {mode === 'marked' && <p className="inspector-help">Uses the rows currently marked in the running prototype.</p>}
    {mode === 'index' && <NumberField label={verb === 'Delete' ? 'Row index (starts at 0)' : `${verb} row index (starts at 0)`} value={spec.row as number} min={0} max={Number.MAX_SAFE_INTEGER} onChange={row => onChange({ row: Math.floor(row) })}/>}
    {spec.where && <div className="inspector-condition">
      <label className="inspector-field">Match column<select aria-label={`${verb} match column`} value={spec.where.column} onChange={event => onChange({ where: { ...spec.where!, column: event.target.value } })}>{columns.map(column => <option key={column}>{column}</option>)}</select></label>
      <select aria-label={`${verb} match comparison`} value={spec.where.operator} onChange={event => onChange({ where: { ...spec.where!, operator: event.target.value as Condition['operator'] } })}>{operators.map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}</select>
      {spec.where.operator !== 'isEmpty' && <input aria-label={`${verb} match value`} value={spec.where.value} placeholder="Value or [[expression]]" onChange={event => onChange({ where: { ...spec.where!, value: event.target.value } })}/>}
    </div>}
  </>;
}

function UpdateRowsEditor({ value, columns, onChange }: { value?: string; columns: string[]; onChange: (value: string) => void }) {
  const parsed = parseActionJson(value, { row: 'this', values: {} });
  const validation = validateUpdateRowSpec(parsed, columns);
  if (validation) return <><p className="inspector-error" role="alert">{validation}</p><JsonEditor label="Update row specification" value={parsed} validate={data => validateUpdateRowSpec(data, columns)} onApply={data => onChange(JSON.stringify(data))} hint='Use {"row":"marked","values":{"Column":"value"}} or a matching-row selector.'/></>;
  const spec = parsed as UpdateRowSpec;
  const update = (next: UpdateRowSpec) => onChange(JSON.stringify(next));
  return <div className="inspector-update-rows">
    <RowSelectorEditor spec={spec} columns={columns} verb="Update" allowMarked onChange={selector => update({ ...selector, values: spec.values })}/>
    <JsonEditor label="Updated columns" value={spec.values} validate={data => validateUpdateRowSpec({ ...spec, values: data }, columns)} onApply={data => update({ ...spec, values: data as Record<string, string> })} hint="Only listed columns change. Values can contain [[Item.Column]] or expressions; other columns are preserved."/>
    {!Object.keys(spec.values).length && <p className="inspector-help">Add one or more column values above. This action currently changes no columns.</p>}
  </div>;
}

function SelectRowsEditor({ action, columns, onChange }: { action: Action; columns: string[]; onChange: (value: string) => void }) {
  const deleting = action.type === 'deleteRow', verb = deleting ? 'Delete' : action.type === 'markRows' ? 'Mark' : 'Unmark';
  const parsed = deleting && action.value === 'all' ? { row: 'all' } : deleting && /^\d+$/.test(action.value ?? '0') ? { row: Number(action.value ?? '0') } : parseActionJson(action.value, { row: 'this' });
  const validation = validateRowSelectorSpec(parsed, columns, deleting);
  if (validation) return <><p className="inspector-error" role="alert">{validation}</p><JsonEditor label={`${verb} row specification`} value={parsed} validate={data => validateRowSelectorSpec(data, columns, deleting)} onApply={data => onChange(JSON.stringify(data))}/></>;
  const spec = parsed as RepeaterRowSelector;
  const update = (selector: RepeaterRowSelector) => onChange(deleting && (selector.row === 'all' || typeof selector.row === 'number') ? String(selector.row) : JSON.stringify(selector));
  return <><RowSelectorEditor spec={spec} columns={columns} verb={verb} allowMarked={deleting} onChange={update}/>{deleting && <label className="inspector-check"><input type="checkbox" aria-label="Delete all rows" checked={spec.row === 'all'} onChange={event => update({ row: event.target.checked ? 'all' : 0 })}/>Delete all rows</label>}</>;
}

function RepeaterPageActionEditor({ action, onChange }: { action: Action; onChange: (value: string) => void }) {
  const page = action.type === 'setRepeaterPage', keywords = page ? ['next', 'previous', 'first', 'last'] : ['all'];
  const mode = keywords.includes(action.value ?? '') ? action.value : 'value';
  return <><label className="inspector-field">{page ? 'Page' : 'Page size'}<select aria-label={page ? 'Repeater page mode' : 'Items per page mode'} value={mode} onChange={event => onChange(event.target.value === 'value' ? page ? '1' : '20' : event.target.value)}>{keywords.map(key => <option key={key} value={key}>{key === 'all' ? 'All rows (disable pagination)' : `${key[0].toUpperCase()}${key.slice(1)} page`}</option>)}<option value="value">Number or expression</option></select></label>{mode === 'value' && <label className="inspector-field">{page ? 'Page number' : 'Items per page'}<input aria-label={page ? 'Repeater page value' : 'Items per page value'} value={action.value ?? ''} onChange={event => onChange(event.target.value)} placeholder={page ? '1 or [[Page]]' : '20 or [[PageSize]]'}/></label>}<p className="inspector-help">Page numbers start at 1. Expressions can use [[Item.Repeater.pageIndex]] or [[Item.Repeater.pageCount]] inside an item.</p></>;
}

export function RepeaterLayoutEditor({ widget, onChange }: { widget: Widget; onChange: (patch: Partial<Widget>) => void }) {
  const data = widget.repeater!;
  const enabled = ['layout', 'itemWidth', 'wrap', 'horizontalGap', 'verticalGap', 'fitToContent', 'padding'].some(field => Object.hasOwn(data, field));
  const update = (patch: Partial<NonNullable<Widget['repeater']>>) => onChange({ repeater: { ...data, ...patch } });
  return <Section title="Repeater layout">
    <label className="inspector-field">Direction<select aria-label="Repeater layout" value={data.layout ?? (enabled ? 'vertical' : 'legacy')} onChange={event => {
      const repeater = { ...data };
      if (event.target.value === 'legacy') { delete repeater.layout; delete repeater.itemWidth; delete repeater.wrap; delete repeater.horizontalGap; delete repeater.verticalGap; delete repeater.fitToContent; delete repeater.padding; }
      else repeater.layout = event.target.value as 'vertical' | 'horizontal';
      onChange({ repeater });
    }}><option value="legacy">Legacy (stored outer size)</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
    {enabled && <>
      <NumberField label="Item width" value={data.itemWidth ?? widget.width} min={0} max={10000} commitUnchanged onChange={itemWidth => update({ itemWidth })}/>
      <label className="inspector-check"><input type="checkbox" aria-label="Wrap repeater items" checked={data.wrap !== undefined} onChange={event => { const repeater = { ...data }; if (event.target.checked) repeater.wrap = 2; else delete repeater.wrap; onChange({ repeater }); }}/>Wrap after a fixed number of items</label>
      {data.wrap !== undefined && <NumberField label="Items before wrap" value={data.wrap} min={1} max={10000} onChange={wrap => update({ wrap: Math.floor(wrap) })}/>}
      <label className="inspector-check"><input type="checkbox" aria-label="Fit repeater items to content" checked={data.fitToContent ?? false} onChange={event => update({ fitToContent: event.target.checked })}/>Fit item size to content</label>
      <div className="inspector-grid"><NumberField label="Horizontal gap" value={data.horizontalGap ?? data.gap} min={0} max={10000} commitUnchanged onChange={horizontalGap => update({ horizontalGap })}/><NumberField label="Vertical gap" value={data.verticalGap ?? data.gap} min={0} max={10000} commitUnchanged onChange={verticalGap => update({ verticalGap })}/></div>
      <div className="inspector-grid">{(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, index) => <NumberField key={side} label={`Repeater padding ${side.toLowerCase()}`} value={data.padding?.[index] ?? 0} min={0} max={1000} commitUnchanged onChange={value => { const padding = [...(data.padding ?? [0, 0, 0, 0])] as [number, number, number, number]; padding[index] = value; update({ padding }); }}/>)}</div>
      {data.padding && <button className="inspector-add-inline" onClick={() => { const repeater = { ...data }; delete repeater.padding; onChange({ repeater }); }}>Clear repeater padding</button>}
      <button className="inspector-add-inline" onClick={() => { const repeater = { ...data }; delete repeater.itemWidth; delete repeater.horizontalGap; delete repeater.verticalGap; onChange({ repeater }); }}>Use inherited width and gaps</button>
      <p className="inspector-help">Direction enables calculated outer bounds. Wrapping uses a fixed item count. Item width inherits the stored widget width; both gaps inherit Gap until overridden.</p>
    </>}
    {!enabled && <p className="inspector-help">Legacy keeps the existing row layout and stored outer size. Choose a direction to enable item layout.</p>}
  </Section>;
}

function NamedRepeaterActionEditor({ action, columns, onChange }: { action: Action; columns: string[]; onChange: (value: string) => void }) {
  const parsed = parseActionJson(action.value, JSON.parse(actionDefaults(action.type).value!));
  const data = (isRecord(parsed) ? parsed : {}) as unknown as RepeaterFilterSpec & RepeaterSortSpec & RepeaterRuleRemoval;
  const update = (patch: Record<string, unknown>) => onChange(JSON.stringify({ ...data, ...patch }));
  let error: string | undefined;
  try {
    if (action.type === 'addFilter') parseRepeaterFilterSpec(parsed, columns);
    else if (action.type === 'addSort') parseRepeaterSortSpec(parsed, columns);
    else parseRepeaterRuleRemoval(parsed);
  } catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
  const noun = action.type.endsWith('Filter') ? 'filter' : 'sort';
  const adding = action.type.startsWith('add');
  return <>
    {adding ? <label className="inspector-field">Name<input aria-label={`Named ${noun} name`} maxLength={256} value={data.name ?? ''} onChange={event => update({ name: event.target.value })}/></label> : <>
      <label className="inspector-field">Remove<select aria-label={`Remove ${noun} scope`} value={'all' in data ? 'all' : 'name'} onChange={event => onChange(JSON.stringify(event.target.value === 'all' ? { all: true } : { name: '' }))}><option value="name">Exact name</option><option value="all">All {noun}s</option></select></label>
      {!('all' in data) && <label className="inspector-field">Name<input aria-label={`Remove ${noun} name`} maxLength={256} value={data.name ?? ''} onChange={event => onChange(JSON.stringify({ name: event.target.value }))}/></label>}
      <p className="inspector-help">Exact names are case-sensitive and include spaces. Removal deletes every matching name; an empty name removes nothing and refreshes the repeater.</p>
    </>}
    {action.type === 'addFilter' && <>
      <label className="inspector-field">Expression<textarea aria-label="Named filter expression" rows={3} maxLength={4100} value={data.expression ?? ''} placeholder="[[TargetItem.Name == 'Alice']]" onChange={event => update({ expression: event.target.value })}/></label>
      <label className="inspector-field">Column group<select aria-label="Named filter column group" value={data.column ?? ''} onChange={event => { const next = { ...data }; if (event.target.value) next.column = event.target.value; else delete (next as Partial<RepeaterFilterSpec>).column; onChange(JSON.stringify(next)); }}><option value="">No column group (advanced expression)</option>{columns.map(column => <option key={column}>{column}</option>)}</select></label>
      <label className="inspector-field">Combine filters<select aria-label="Named filter combination" value={data.mode ?? 'smart'} onChange={event => update({ mode: event.target.value })}><option value="smart">Smart: OR within columns, AND between columns</option><option value="all">All: AND</option><option value="any">Any: OR</option></select></label>
      <label className="inspector-check"><input type="checkbox" aria-label="Remove other filters" checked={data.removeOthers ?? false} onChange={event => update({ removeOthers: event.target.checked })}/>Remove all other filters before adding</label>
      <p className="inspector-help" title="The last added filter controls how all active filters combine.">Use one complete [[expression]], up to 4096 inner characters. TargetItem refers to the candidate row; Item refers to the triggering row. Smart ORs filters in the same column and ANDs different columns; filters without a column each add an AND condition. All ANDs every filter; Any ORs every filter. The last filter controls the combination. Same-name filters are appended.</p>
    </>}
    {action.type === 'addSort' && <>
      <label className="inspector-field">Column<select aria-label="Named sort column" value={data.column ?? ''} onChange={event => update({ column: event.target.value })}><option value="">Choose a column…</option>{columns.map(column => <option key={column}>{column}</option>)}</select></label>
      <label className="inspector-field">Order<select aria-label="Named sort direction" value={data.direction ?? 'asc'} onChange={event => update({ direction: event.target.value })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
      <label className="inspector-field">Data type<select aria-label="Named sort data type" value={data.dataType ?? 'text'} onChange={event => update({ dataType: event.target.value })}><option value="number">Number</option><option value="text">Text (case-insensitive)</option><option value="textCase">Text (case-sensitive)</option><option value="natural">Natural</option><option value="dateYMD">Date: year/month/day</option><option value="dateMDY">Date: month/day/year</option><option value="dateDMY">Date: day/month/year</option></select></label>
      <label className="inspector-check"><input type="checkbox" aria-label="Toggle existing sort direction" checked={data.toggle ?? false} onChange={event => update({ toggle: event.target.checked })}/>Reverse the existing sort on this column</label>
      <label className="inspector-check"><input type="checkbox" aria-label="Remove other sorts" checked={data.removeOthers ?? false} onChange={event => update({ removeOthers: event.target.checked })}/>Remove all other sorts before adding</label>
      <p className="inspector-help">Adding replaces a sort on the same column and gives the new sort highest priority. A name can be reused on different columns.</p>
    </>}
    {adding && <p className="inspector-help">Names are case-sensitive; empty names and spaces are retained. To configure starting rules, add these actions to a Loaded event.</p>}
    {error && <p className="inspector-error" role="alert">{error}</p>}
  </>;
}

export function SelectOptionsEditor({ widget, onChange }: { widget: Widget; onChange: (patch: Partial<Widget>) => void }) {
  const options = widget.options ?? [], selected = getSelectedOptionIndices(widget);
  function remove(index: number) {
    onChange({ options: options.filter((_, at) => at !== index), selectedIndices: selected.filter(at => at !== index).map(at => at > index ? at - 1 : at) });
  }
  function move(index: number, direction: -1 | 1) {
    const next = index + direction; if (next < 0 || next >= options.length) return;
    const reordered = [...options]; [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    onChange({ options: reordered, selectedIndices: selected.map(at => at === index ? next : at === next ? index : at).sort((a, b) => a - b) });
  }
  return <Section title="List options">
    <label className="inspector-field">Presentation<select aria-label="Select presentation" value={widget.selectMode ?? 'dropdown'} onChange={event => {
      const selectMode = event.target.value as 'dropdown' | 'listbox';
      onChange({ selectMode, ...(selectMode === 'dropdown' && widget.multiple ? { multiple: false, selectedIndices: selected.slice(0, 1) } : {}) });
    }}><option value="dropdown">Dropdown</option><option value="listbox">List box</option></select></label>
    <label className="inspector-check"><input type="checkbox" aria-label="Allow multiple selection" checked={widget.multiple ?? false} onChange={event => onChange({ multiple: event.target.checked, ...(event.target.checked ? { selectMode: 'listbox' as const } : {}), selectedIndices: event.target.checked ? selected : selected.slice(0, 1) })}/>Allow multiple selection</label>
    <p className="inspector-help">Each row is one literal option. Spaces, line breaks, empty text and duplicate options are preserved. Selection follows an option when it moves.</p>
    {options.length === 0 && <p className="inspector-help">No options.</p>}
    {options.map((option, index) => <div className="inspector-action" key={index} role="group" aria-label={`Option ${index + 1}`}>
      <label className="inspector-field">Option {index + 1}<textarea rows={2} maxLength={2000} aria-label={`Option ${index + 1} text`} value={option} onChange={event => onChange({ options: options.map((value, at) => at === index ? event.target.value : value), selectedIndices: selected })}/></label>
      <div className="inspector-row"><label className="inspector-check"><input type="checkbox" aria-label={`Option ${index + 1} selected`} checked={selected.includes(index)} onChange={event => onChange({ selectedIndices: event.target.checked ? widget.multiple ? [...selected, index].sort((a, b) => a - b) : [index] : selected.filter(at => at !== index) })}/>Selected</label>
        <button className="inspector-icon" aria-label={`Move option ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={12}/></button>
        <button className="inspector-icon" aria-label={`Move option ${index + 1} down`} disabled={index === options.length - 1} onClick={() => move(index, 1)}><ArrowDown size={12}/></button>
        <button className="inspector-icon inspector-danger" aria-label={`Remove option ${index + 1}`} onClick={() => remove(index)}><Trash2 size={12}/></button>
      </div>
    </div>)}
    <button className="inspector-add-inline" disabled={options.length >= 500} onClick={() => onChange({ options: [...options, ''], selectedIndices: selected })}><Plus size={12}/>Add option</button>
    <button className="inspector-add-inline" disabled={widget.selectedIndices !== undefined && selected.length === 0} onClick={() => onChange({ selectedIndices: [] })}>Clear option selection</button>
    {widget.multiple && <p className="inspector-help">Turning off multiple selection keeps the first selected option.</p>}
  </Section>;
}

export function BorderWidthEditor({ style, onChange }: { style: WidgetStyle; onChange: (patch: Partial<WidgetStyle>) => void }) {
  return <>
    <NumberField label="Stroke" value={style.strokeWidth} min={0} max={100} commitUnchanged={Boolean(style.borderWidths)} onChange={strokeWidth => onChange({ strokeWidth })}/>
    <label className="inspector-check"><input type="checkbox" aria-label="Independent border widths" checked={Boolean(style.borderWidths)} onChange={event => onChange(event.target.checked ? { borderWidths: [style.strokeWidth, style.strokeWidth, style.strokeWidth, style.strokeWidth] } : { borderWidths: undefined, strokeWidth: style.strokeWidth })}/>Independent border widths</label>
    {style.borderWidths && <div className="inspector-grid">{(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, index) => <NumberField key={side} label={`Border ${side.toLowerCase()}`} value={style.borderWidths![index]} min={0} max={100} onChange={value => { const borderWidths = [...style.borderWidths!] as [number, number, number, number]; borderWidths[index] = value; onChange({ borderWidths }); }}/>)}</div>}
  </>;
}

function ActionEditor({ action, page, document, source, onChange, onRemove, onMove, index, count }: {
  action: Action; page: Page; document: Document; source?: Widget; onChange: (patch: Partial<Action>) => void;
  onRemove: () => void; onMove: (direction: -1 | 1) => void; index: number; count: number;
}) {
  const [editingFrameTarget,setEditingFrameTarget]=useState(false);
  const allWidgets = collectWidgets(page.widgets);
  const rotationGroups = action.type === 'rotate' ? [...new Set(allWidgets.map(({widget})=>widget.groupId).filter((id):id is string=>Boolean(id)))].flatMap(id=>{
    const members=allWidgets.filter(({widget})=>widget.groupId===id);
    // The saved model represents groups within one sibling list. Reused IDs
    // across containers are ambiguous and are not offered as action targets.
    return members.every(member=>member.siblings===members[0].siblings)?[{id,label:`Group · ${members.map(({widget})=>widget.name||widget.type).join(', ')}`}]:[];
  }):[];
  const itemTargets = getResizeItemTargets(page, source);
  const targets = allWidgets.filter(({ widget }) => action.type === 'openLinkInFrame' ? widget.type === 'inlineFrame' : action.type === 'resizeItem' ? itemTargets.some(target => target.id === widget.id) : panelActions.includes(action.type) ? widget.type === 'panel' : repeaterActions.includes(action.type) ? widget.type === 'repeater' : ['expandTreeNode','collapseTreeNode','toggleTreeNode'].includes(action.type) ? widget.type === 'treeNode' : action.type === 'setSelectedOption' ? widget.type === 'select' : action.type === 'setText' ? !['select','menu','table','tree','treeNode','inlineFrame'].includes(widget.type) : action.type === 'setSelected' ? !['panel', 'repeater', 'table', 'menu', 'tree'].includes(widget.type) : ['resize','setError','enable','disable'].includes(action.type) ? !['table','tableCell','menu','tree','treeNode'].includes(widget.type) : true);
  const target = allWidgets.find(item => item.widget.id === action.targetId)?.widget;
  const motionConversionAvailable = Boolean(target && (action.type !== 'resize' || supportsAnimatedResize(target)));
  const usesWidget = !['openPage', 'openUrl', 'setVariable', 'wait', 'setAdaptiveView'].includes(action.type) && !(action.type==='openLinkInFrame'&&action.frameScope==='parent') && !action.move && !action.resize;
  const sortParts = (action.value ?? '').split(':');
  const sortColumn = sortParts[0] ?? '';
  const sortDirection = sortParts[1] === 'desc' ? 'desc' : 'asc';
  return <div className="inspector-action">
    <div className="inspector-row inspector-action-heading"><span className="inspector-step">{index + 1}</span><select aria-label={`Action ${index + 1} type`} value={action.type} onChange={event => { const type = event.target.value as ActionType; onChange({ ...actionDefaults(type), ...(type === 'resizeItem' ? { targetId: itemTargets.at(-1)?.id } : type==='openLinkInFrame'?{frameScope:allWidgets.some(({widget})=>widget.type==='inlineFrame')?'widget':'parent',targetId:allWidgets.find(({widget})=>widget.type==='inlineFrame')?.widget.id,frameTarget:{kind:'page',pageId:document.pages.find(item=>item.id!==page.id)?.id??page.id}}:{}) }); }}>{actionTypes.filter(([value]) => value !== 'resizeItem' || itemTargets.length || action.type === value).map(([value, label]) => <option key={value} value={value} disabled={value === 'resizeItem' && !itemTargets.length}>{label}</option>)}</select><button className="inspector-icon" title="Move action up" aria-label="Move action up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={12} /></button><button className="inspector-icon" title="Move action down" aria-label="Move action down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown size={12} /></button><button className="inspector-icon inspector-danger" title="Remove action" aria-label="Remove action" onClick={onRemove}><Trash2 size={12} /></button></div>
    {action.type==='openLinkInFrame'&&<label className="inspector-field">Open in<select aria-label="Frame action scope" value={action.frameScope??'widget'} onChange={event=>onChange({frameScope:event.target.value as 'widget'|'parent',targetId:event.target.value==='parent'?undefined:allWidgets.find(({widget})=>widget.type==='inlineFrame')?.widget.id})}><option value="widget" disabled={!allWidgets.some(({widget})=>widget.type==='inlineFrame')}>Inline frame widget</option><option value="parent">Parent frame</option></select></label>}
    {usesWidget && <label className="inspector-field">Target<select aria-label={`Action ${index + 1} target`} value={action.targetId ?? ''} onChange={event => {
      const targetId = event.target.value || undefined, patch: Partial<Action> = { targetId };
      if (action.type === 'addSort' || action.type === 'addFilter') {
        const columns = allWidgets.find(item => item.widget.id === targetId)?.widget.repeater?.columns ?? [];
        const spec = parseActionJson(action.value, JSON.parse(actionDefaults(action.type).value!));
        if (isRecord(spec) && (action.type === 'addSort' || Object.hasOwn(spec, 'column')) && !columns.includes(spec.column as string)) {
          const next = { ...spec }; if (action.type === 'addSort') next.column = columns[0] ?? ''; else delete next.column;
          patch.value = JSON.stringify(next);
        }
      }
      onChange(patch);
    }}><option value="" disabled={action.type==='openLinkInFrame'}>Choose a widget…</option>{targets.map(({ widget, label }) => <option key={widget.id} value={widget.id}>{label}</option>)}{rotationGroups.length>0&&<optgroup label="Groups">{rotationGroups.map(group=><option key={group.id} value={group.id}>{group.label}</option>)}</optgroup>}{action.type==='openLinkInFrame'&&action.targetId&&!targets.some(item=>item.widget.id===action.targetId)&&<option value={action.targetId} disabled>Unavailable frame</option>}{action.type === 'resizeItem' && action.targetId && !targets.some(item => item.widget.id === action.targetId) && <option value={action.targetId} disabled>Unavailable item scope</option>}</select></label>}
    {action.type==='openLinkInFrame'&&<div className="inline-frame-action-target"><p className="frame-target-summary">{frameTargetLabel(action.frameTarget,document.pages)}</p><button type="button" onClick={()=>setEditingFrameTarget(true)}>Edit link in frame target</button>{editingFrameTarget&&<FrameTargetEditor title="Link in frame target" value={action.frameTarget} pages={document.pages} onApply={frameTarget=>{if(frameTarget&&JSON.stringify(frameTarget)!==JSON.stringify(action.frameTarget))onChange({frameTarget});setEditingFrameTarget(false)}} onClose={()=>setEditingFrameTarget(false)}/>}</div>}
    {action.type === 'setAdaptiveView' && <><label className="inspector-field">View<select aria-label={`Action ${index + 1} adaptive view`} value={action.adaptiveView?.kind === 'view' ? `view:${action.adaptiveView.viewId}` : action.adaptiveView?.kind ?? 'auto'} onChange={event => onChange({ adaptiveView: event.target.value.startsWith('view:') ? { kind: 'view', viewId: event.target.value.slice(5) } : { kind: event.target.value as 'auto' | 'base' } })}><option value="auto">Auto — follow viewport size</option><option value="base">Base</option>{page.adaptiveViews.map(view => <option key={view.id} value={`view:${view.id}`}>{view.name}</option>)}{action.adaptiveView?.kind === 'view' && !page.adaptiveViews.some(view => action.adaptiveView?.kind === 'view' && view.id === action.adaptiveView.viewId) && <option value={`view:${action.adaptiveView.viewId}`} disabled>Unavailable view</option>}</select></label><p className="inspector-help">Following actions in this case do not run. Auto resumes selection by viewport size.</p></>}
    {action.type === 'openPage' && <label className="inspector-field">Page<select aria-label="Target page" value={action.targetId ?? ''} onChange={event => onChange({ targetId: event.target.value })}><option value="">Choose a page…</option>{document.pages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {action.type === 'openUrl' && <><label className="inspector-field">URL<input aria-label="Action URL" type="url" maxLength={4096} value={action.value ?? ''} placeholder="https://example.com/" onChange={event => onChange({ value: event.target.value })}/></label><label className="inspector-field">Open in<select aria-label="URL target" value={action.windowTarget ?? 'current'} onChange={event => onChange({ windowTarget: event.target.value as 'current' | 'new' })}><option value="current">Current window</option><option value="new">New window</option></select></label><p className="inspector-help">Use a literal HTTP or HTTPS URL. Variables and expressions are not evaluated.</p></>}
    {action.type === 'setVariable' && <label className="inspector-field">Variable<select aria-label="Target variable" value={action.targetId ?? ''} onChange={event => onChange({ targetId: event.target.value })}><option value="">Choose a variable…</option>{Object.keys(document.variables).map(name => <option key={name}>{name}</option>)}</select>{Object.keys(document.variables).length === 0 && <span className="inspector-help">Create a global variable in the Project menu first.</span>}</label>}
    {['setText', 'setVariable', 'setSelectedOption'].includes(action.type) && <label className="inspector-field">Value<textarea aria-label="Action value" rows={2} value={action.value ?? ''} onChange={event => onChange({ value: event.target.value })} placeholder="Text or [[variableName]]" />{action.type === 'setSelectedOption' && <span className="inspector-help">Matches the exact option text, including spaces. For multiple selection, selects every matching option.</span>}</label>}
    {action.type === 'setFocus' && <><label className="inspector-check"><input type="checkbox" aria-label="Select text" checked={action.selectText ?? false} onChange={event => onChange({ selectText: event.target.checked || undefined })}/>Select text</label><p className="inspector-help">Focuses the first matching target. Select text applies to text fields and text areas.</p></>}
    {action.type === 'setSelected' && <><label className="inspector-field">Selection<select aria-label="Selection value" value={['true', 'false', 'toggle'].includes(action.value ?? 'true') ? action.value ?? 'true' : 'expression'} onChange={event => onChange({ value: event.target.value === 'expression' ? '[[Item.isMarked]]' : event.target.value })}><option value="true">Selected / checked</option><option value="false">Unselected / unchecked</option><option value="toggle">Toggle</option><option value="expression">Expression</option></select></label>{action.value !== undefined && !['true', 'false', 'toggle'].includes(action.value) && <label className="inspector-field">Selection expression<input aria-label="Selection expression" value={action.value} placeholder="[[Item.isMarked]]" onChange={event => onChange({ value: event.target.value })}/><span className="inspector-help">Use one complete [[expression]] returning true, false or toggle.</span></label>}</>}
    {action.type === 'setError' && <><label className="inspector-field">Error state<select aria-label="Error state value" value={['true', 'false', 'toggle'].includes(action.value ?? 'true') ? action.value ?? 'true' : 'expression'} onChange={event => onChange({ value: event.target.value === 'expression' ? '[[true]]' : event.target.value })}><option value="true">Set error</option><option value="false">Remove error</option><option value="toggle">Toggle</option><option value="expression">Expression</option></select></label>{action.value !== undefined && !['true', 'false', 'toggle'].includes(action.value) && <label className="inspector-field">Error expression<input aria-label="Error expression" value={action.value} placeholder="[[true]]" onChange={event => onChange({ value: event.target.value })}/><span className="inspector-help">Use one complete [[expression]] returning true, false or toggle.</span></label>}</>}
    {action.type === 'setState' && <label className="inspector-field">State<select aria-label="Target panel state" value={action.value ?? ''} onChange={event => onChange({ value: event.target.value })}><option value="">Choose a state…</option>{(target?.states ?? []).map(state => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label>}
    {['move', 'resize'].includes(action.type) && !action.move && !action.resize && <>
      <div className="inspector-grid"><NumberField label={action.type === 'move' ? 'Target X' : 'Target width'} value={action.x ?? 0} onChange={value => onChange({ x: value })} min={action.type === 'resize' ? 1 : undefined} /><NumberField label={action.type === 'move' ? 'Target Y' : 'Target height'} value={action.y ?? 0} onChange={value => onChange({ y: value })} min={action.type === 'resize' ? 1 : undefined} /></div>
      <button className="inspector-add-inline" disabled={!motionConversionAvailable} onClick={() => {
        if (!action.targetId || !motionConversionAvailable) return;
        const target = { kind: 'widget' as const, id: action.targetId }, first = { text: action.x === undefined ? '' : String(action.x) }, second = { text: action.y === undefined ? '' : String(action.y) };
        onChange({ targetId: undefined, x: undefined, y: undefined, value: undefined, duration: undefined, style: undefined,
          ...(action.type === 'move' ? { move: { targets: [{ ...defaultMoveTarget(), target, x: first, y: second }] } } : { resize: { targets: [{ ...defaultResizeTarget(), target, width: first, height: second }] } }) });
      }}>Add animation and expressions</button>
      {!target ? <p className="inspector-help">Choose a target widget before adding animation.</p> : !motionConversionAvailable ? <p className="inspector-help">Size animation is unavailable for this widget type.</p> : action.type === 'resize' && <p className="inspector-help">Size animations round size changes to whole pixels.</p>}
    </>}
    {action.type === 'move' && action.move && <MotionActionEditor kind="move" value={action.move} choices={allWidgets} onChange={move => onChange({ move: move as NonNullable<Action['move']> })}/>}
    {action.type === 'resize' && action.resize && <MotionActionEditor kind="resize" value={action.resize} choices={allWidgets} onChange={resize => onChange({ resize: resize as NonNullable<Action['resize']> })}/>}
    {action.type === 'resizeItem' && <>
      <label className="inspector-check"><input type="checkbox" aria-label="Resize item width" checked={action.x !== undefined} onChange={event => onChange({ x: event.target.checked ? target?.repeater?.itemWidth ?? target?.width ?? 0 : undefined })}/>Change item width</label>
      {action.x !== undefined && <NumberField label="Item target width" value={action.x} min={-100000} max={100000} onChange={x => onChange({ x })}/>}
      <label className="inspector-check"><input type="checkbox" aria-label="Resize item height" checked={action.y !== undefined} onChange={event => onChange({ y: event.target.checked ? target?.repeater?.itemHeight ?? 0 : undefined })}/>Change item height</label>
      {action.y !== undefined && <NumberField label="Item target height" value={action.y} min={-100000} max={100000} onChange={y => onChange({ y })}/>}
      <p className="inspector-help">Changes this item in its repeater context. Unchecked dimensions stay unchanged; negative sizes become zero in the prototype.</p>
      {!itemTargets.some(item => item.id === action.targetId) && <p className="inspector-error" role="alert">This action has no matching repeater item scope and will do nothing.</p>}
    </>}
    {action.type === 'rotate' && <RotationActionEditor value={action.rotate ?? defaultRotateAction()} onChange={rotate=>onChange({rotate})}/>}
    {action.type === 'wait' && <NumberField label="Wait (ms)" value={action.duration ?? 0} min={0} onChange={value => onChange({ duration: value })} />}
    {action.type === 'setStyle' && <>{target&&<FillOverrideEditor key={`${action.id}/${target.id}`} label={`Action ${index + 1} fill`} widgetType={target.type} patch={action.style??{}} base={target.style} onChange={style=>onChange({style})}/>} {target&&<StrokeOverrideEditor key={`${action.id}/${target.id}/stroke`} label={`Action ${index + 1} border`} widgetType={target.type} patch={action.style??{}} base={target.style} onChange={style=>onChange({style})}/>} {target&&<LineStyleOverrides widget={target} patch={action.style??{}} base={target.style} prefix={`Action ${index + 1}`} onChange={style=>onChange({style})}/>} {!target && <p className="inspector-help">Choose a target to edit its shadow effects.</p>}<ShadowOverrides patch={action.style ?? {}} base={target?.style} fields={shadowFieldsFor(target)} prefix={`Action ${index + 1}`} onChange={style => onChange({ style })}/><>{target&&<CornerOverrides widget={target} patch={action.style??{}} prefix={`Action ${index + 1}`} onChange={style=>onChange({style})}/>}</><JsonEditor label="Style" value={action.style ?? {}} validate={validateStyle} onApply={data => onChange({ style: data as Partial<WidgetStyle> })} hint="WidgetStyle properties, e.g. fill, color, fontSize or opacity (0–1). Shadow controls write complete objects; disabled shadows explicitly clear inherited shadows." /></>}
    {action.type === 'addRow' && <JsonEditor label="New row" value={parseActionJson(action.value, {})} validate={data => isStringRecord(data) ? null : 'Use an object with text values for each column.'} onApply={data => onChange({ value: JSON.stringify(data) })} hint='Example: {"Name":"Alice","Status":"Active"}' />}
    {action.type === 'updateRow' && <UpdateRowsEditor value={action.value} columns={target?.repeater?.columns ?? []} onChange={value => onChange({ value })}/>}
    {['deleteRow', 'markRows', 'unmarkRows'].includes(action.type) && <SelectRowsEditor action={action} columns={target?.repeater?.columns ?? []} onChange={value => onChange({ value })}/>}
    {['setRepeaterPage', 'setItemsPerPage'].includes(action.type) && <RepeaterPageActionEditor action={action} onChange={value => onChange({ value })}/>}
    {namedRepeaterActions.includes(action.type) && <NamedRepeaterActionEditor action={action} columns={target?.repeater?.columns ?? []} onChange={value => onChange({ value })}/>}
    {action.type === 'sortRows' && <><label className="inspector-field">Sort column<select aria-label="Sort column" value={sortColumn} onChange={event => onChange({ value: `${event.target.value}:${sortDirection}` })}><option value="">Choose a column…</option>{(target?.repeater?.columns ?? []).map(column => <option key={column}>{column}</option>)}</select></label><label className="inspector-field">Order<select aria-label="Sort direction" value={sortDirection} onChange={event => onChange({ value: `${sortColumn}:${event.target.value}` })}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></>}
    {action.type === 'filterRows' && <><JsonEditor label="Filter" value={parseActionJson(action.value, { column: target?.repeater?.columns[0] ?? '', operator: 'contains', value: '' })} validate={data => isRecord(data) && typeof data.column === 'string' && typeof data.value === 'string' && operators.some(([operator]) => operator === data.operator) ? null : 'Use column, operator and value. Operators match the condition options.'} onApply={data => onChange({ value: JSON.stringify(data) })} /><button className="inspector-add-inline" onClick={() => onChange({ value: '' })}>Remove filter when triggered</button>{action.value === '' && <p className="inspector-help">This action will remove the filter.</p>}</>}
  </div>;
}

function parseActionJson(value: string | undefined, fallback: unknown): unknown {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return value; }
}

function ConditionEditor({ condition, document, page, onChange, onRemove }: {
  condition: Condition; document: Document; page: Page; onChange: (patch: Partial<Condition>) => void; onRemove: () => void;
}) {
  return <div className="inspector-condition">
    {condition.comparisonMode === 'axure' && <p className="inspector-help" title="Imported Axure comparison: values may be converted before equality is checked.">Native comparison</p>}
    <div className="inspector-row"><select aria-label="Condition source" value={condition.source} onChange={event => onChange({ source: event.target.value as Condition['source'], key: '' })}><option value="variable">Variable value</option><option value="widgetText">Text on widget</option><option value="selectedOption">Selected option</option></select><button className="inspector-icon inspector-danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={12} /></button></div>
    <select aria-label="Condition target" value={condition.key} onChange={event => onChange({ key: event.target.value })}><option value="">Choose {condition.source === 'variable' ? 'variable' : 'widget'}…</option>{condition.source === 'variable' ? Object.keys(document.variables).map(name => <option key={name}>{name}</option>) : collectWidgets(page.widgets).filter(({widget}) => condition.source !== 'selectedOption' || widget.type === 'select').map(({ widget, label }) => <option key={widget.id} value={widget.id}>{label}</option>)}</select>
    {condition.source === 'selectedOption' && <p className="inspector-help">Reads the first selected option. No selection reads as empty text.</p>}
    <select aria-label="Condition comparison" value={condition.operator} onChange={event => onChange({ operator: event.target.value as Condition['operator'] })}>{operators.filter(([value]) => condition.comparisonMode !== 'axure' || ['equals', 'notEquals'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    {condition.operator !== 'isEmpty' && (condition.source === 'selectedOption' ? <textarea aria-label="Condition value" rows={2} value={condition.value} placeholder="Compare with…" onChange={event => onChange({ value: event.target.value })}/> : <input aria-label="Condition value" value={condition.value} placeholder="Compare with…" onChange={event => onChange({ value: event.target.value })} />)}
  </div>;
}

export function InteractionsEditor({ interactions, onChange, document, page, widget, allowedEvents }: {
  interactions: Interaction[]; onChange: (interactions: Interaction[]) => void; document: Document; page: Page; widget?: Widget; allowedEvents?: readonly EventType[];
}) {
  const focusable = Boolean(widget && ['input', 'textarea', 'select', 'checkbox', 'radio'].includes(widget.type));
  const controlEvents = events.filter(([event]) => (!widget || event !== 'adaptiveViewChange') && (focusable || !['focus', 'blur'].includes(event)) && (widget?.type === 'menu' || !['show','hide'].includes(event)) && (widget || !['selectedChange', 'select', 'unselect', 'errorSet', 'errorRemoved', 'resize', 'move', 'rotate', 'dragStart', 'drag', 'dragDrop', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown'].includes(event)));
  const sourceEvents: [EventType, string][] = widget?.type === 'repeater' ? [...controlEvents, ['itemLoad', 'Item loaded'], ['itemResize', 'Item resized']] : controlEvents;
  const availableEvents = allowedEvents ? sourceEvents.filter(([event]) => allowedEvents.includes(event)) : sourceEvents;
  const eventOrder = [...new Set(interactions.map(interaction => interaction.event))];
  const startsGroup = (index: number) => interactions[index].isNewIfGroup !== false || !interactions.slice(0, index).some(item => item.event === interactions[index].event);
  const update = (index: number, patch: Partial<Interaction>) => onChange(interactions.map((item, itemIndex) => itemIndex === index ? { ...item, isNewIfGroup: startsGroup(index), ...patch } : item));
  const insert = (after: number, interaction: Interaction) => onChange([...interactions.slice(0, after + 1), interaction, ...interactions.slice(after + 1)]);
  function add(event: EventType, newGroup: boolean, after?: number) {
    const lastIndex = interactions.map(item => item.event).lastIndexOf(event);
    insert(after ?? (lastIndex < 0 ? interactions.length - 1 : lastIndex), { id: id(), event, name: `Case ${interactions.length + 1}`, enabled: true, isNewIfGroup: lastIndex < 0 || newGroup, conditions: [], conditionMode: 'all', actions: [] });
  }
  function removeOrChangeEvent(index: number, event?: EventType) {
    const current = interactions[index], next = interactions.findIndex((item, itemIndex) => itemIndex > index && item.event === current.event);
    const result = interactions.map((item, itemIndex) => {
      if (itemIndex === index && event !== undefined) return { ...item, event, isNewIfGroup: true };
      if (startsGroup(index) && itemIndex === next && item.isNewIfGroup === false) return { ...item, isNewIfGroup: true };
      return item;
    });
    onChange(event === undefined ? result.filter((_, itemIndex) => itemIndex !== index) : result);
  }
  function move(index: number, target: number) {
    if (target < 0 || target >= interactions.length || interactions[index].event !== interactions[target].event) return;
    const result = [...interactions];
    // Moving case contents keeps the existing group's boundary at each event-relative slot.
    result[index] = { ...interactions[target], isNewIfGroup: startsGroup(index) };
    result[target] = { ...interactions[index], isNewIfGroup: startsGroup(target) };
    onChange(result);
  }
  return <div className="inspector-interactions">
    <button className="inspector-add-primary" onClick={() => add('click', false)}><Plus size={14} /> New interaction</button>
    {interactions.length === 0 && <div className="inspector-empty"><span>No interactions yet</span><p>Add an event, conditions and the actions to run in the prototype.</p></div>}
    {interactions.length > 0 && <p className="inspector-help inspector-case-order-help">Up/down moves cases within an event and keeps the existing IF group boundaries.</p>}
    {eventOrder.map(eventType => {
      const eventLabel = [...events, ['itemLoad', 'Item loaded'], ['itemResize', 'Item resized']].find(([value]) => value === eventType)?.[1] ?? eventType;
      const eventCases = interactions.map((interaction, index) => ({ interaction, index })).filter(({ interaction }) => interaction.event === eventType);
      const selectableCases = !(!widget && eventType === 'load') && !eventCases.some(item => item.interaction.conditions.length) &&
        (document.caseSelection === 'always' || document.caseSelection === 'auto' && eventCases.filter(item => item.interaction.enabled).length >= 2);
      const groups: typeof eventCases[] = [];
      for (const item of eventCases) {
        if (!groups.length || startsGroup(item.index)) groups.push([]);
        groups[groups.length - 1].push(item);
      }
      return <section key={eventType} className="inspector-event" aria-label={`${eventLabel} event cases`}>
        <div className="inspector-event-heading"><h3>{eventLabel}</h3><button className="inspector-add-inline" onClick={() => add(eventType, true)}><Plus size={12} /> New IF</button></div>
        {groups.map((group, groupIndex) => <div key={group[0].interaction.id} className="inspector-case-group" role="group" aria-label={`${eventLabel} IF group ${groupIndex + 1}`}>
          <div className="inspector-group-title">IF group {groupIndex + 1}</div>
          {group.map(({ interaction, index }, branchIndex) => {
            const position = eventCases.findIndex(item => item.index === index), first = position === 0;
            const branchLabel = branchIndex === 0 ? 'IF' : interaction.conditions.length ? 'ELSE IF' : 'ELSE';
            const shadowed = !selectableCases && interaction.enabled && group.slice(0, branchIndex).some(item => item.interaction.enabled && item.interaction.conditions.length === 0);
            return <section key={interaction.id} aria-label={`${interaction.name} case`} className={`inspector-case ${branchIndex > 0 ? 'is-branch' : ''} ${interaction.enabled ? '' : 'is-disabled'}`}>
      <div className="inspector-case-controls"><span className="inspector-branch-label">{branchLabel}</span><span className="inspector-case-position">Case {position + 1}</span><button className="inspector-icon" aria-label="Move case up" title="Move case up" disabled={first} onClick={() => move(index, eventCases[position - 1].index)}><ArrowUp size={12} /></button><button className="inspector-icon" aria-label="Move case down" title="Move case down" disabled={position === eventCases.length - 1} onClick={() => move(index, eventCases[position + 1].index)}><ArrowDown size={12} /></button><button className="inspector-icon" aria-label="Duplicate interaction" title="Duplicate interaction" onClick={() => insert(index, { ...structuredClone(interaction), id: id(), isNewIfGroup: false, name: `${interaction.name} copy`, actions: interaction.actions.map(action => ({ ...structuredClone(action), id: id() })) })}><Copy size={12} /></button><button className="inspector-icon inspector-danger" aria-label="Delete interaction" title="Delete interaction" onClick={() => removeOrChangeEvent(index)}><Trash2 size={12} /></button></div>
      <div className="inspector-row inspector-case-heading"><input type="checkbox" aria-label={`Enable ${interaction.name}`} checked={interaction.enabled} onChange={event => update(index, { enabled: event.target.checked })} /><select aria-label="Interaction event" value={interaction.event} onChange={event => { if (event.target.value !== interaction.event) removeOrChangeEvent(index, event.target.value as EventType); }}>{availableEvents.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{['itemLoad', 'itemResize'].includes(interaction.event) && widget?.type !== 'repeater' && <option value={interaction.event} disabled>{interaction.event === 'itemLoad' ? 'Item loaded' : 'Item resized'} (unsupported target)</option>}{['focus', 'blur'].includes(interaction.event) && !focusable && <option value={interaction.event} disabled>{interaction.event === 'focus' ? 'Got focus' : 'Lost focus'} (unsupported target)</option>}</select></div>
      {['itemLoad', 'itemResize'].includes(interaction.event) && widget?.type !== 'repeater' && <p className="inspector-error" role="alert">{interaction.event === 'itemLoad' ? 'Item loaded' : 'Item resized'} is supported only on a repeater. Choose a different event or move this interaction to a repeater.</p>}
      {['focus', 'blur'].includes(interaction.event) && !focusable && <p className="inspector-error" role="alert">Focus events are supported only on form controls. Choose a different event or move this interaction to a form control.</p>}
      <label className="inspector-field">Branch<select aria-label="Case branch type" value={branchIndex === 0 ? 'if' : 'else'} onChange={event => update(index, { isNewIfGroup: first || event.target.value === 'if' })}><option value="if">IF — start a group</option><option value="else" disabled={first}>{interaction.conditions.length ? 'ELSE IF' : 'ELSE'} — previous group</option></select></label>
      {first && <p className="inspector-help">The first case in an event starts an IF group.</p>}
      {shadowed && <p className="inspector-branch-warning" role="status">An earlier enabled branch has no conditions. This branch will not run until that branch gains a condition or is disabled.</p>}
      <label className="inspector-field">Case name<input aria-label="Case name" value={interaction.name} onChange={event => update(index, { name: event.target.value })} /></label>
      <div className="inspector-case-subhead"><span>CONDITIONS</span><select aria-label="Condition match mode" value={interaction.conditionMode} onChange={event => update(index, { conditionMode: event.target.value as 'all' | 'any' })}><option value="all">Match all</option><option value="any">Match any</option></select></div>
      {!interaction.conditions.length && <p className="inspector-help">{selectableCases ? 'No conditions: available as a menu choice when enabled.' : branchIndex === 0 ? 'No conditions: this IF always matches when enabled.' : 'No conditions: runs only when no earlier branch in this group matches.'}</p>}
      {interaction.conditions.map((condition, conditionIndex) => <ConditionEditor key={conditionIndex} condition={condition} document={document} page={page} onChange={patch => update(index, { conditions: interaction.conditions.map((item, itemIndex) => itemIndex === conditionIndex ? { ...item, ...patch } : item) })} onRemove={() => update(index, { conditions: interaction.conditions.filter((_, itemIndex) => itemIndex !== conditionIndex) })} />)}
      <button className="inspector-add-inline" onClick={() => update(index, { conditions: [...interaction.conditions, { source: 'variable', key: '', operator: 'equals', value: '' }] })}><Plus size={12} /> Add condition</button>
      <div className="inspector-case-subhead"><span>ACTIONS</span><span>{interaction.actions.length}</span></div>
      {interaction.actions.map((action, actionIndex) => <ActionEditor key={action.id} action={action} page={page} document={document} source={widget} index={actionIndex} count={interaction.actions.length} onChange={patch => update(index, { actions: interaction.actions.map((item, itemIndex) => itemIndex === actionIndex ? { ...item, ...patch } : item) })} onRemove={() => update(index, { actions: interaction.actions.filter((_, itemIndex) => itemIndex !== actionIndex) })} onMove={direction => { const actions = [...interaction.actions]; const next = actionIndex + direction; if (next < 0 || next >= actions.length) return; [actions[actionIndex], actions[next]] = [actions[next], actions[actionIndex]]; update(index, { actions }); }} />)}
      <button className="inspector-add-inline" onClick={() => update(index, { actions: [...interaction.actions, { id: id(), type: 'show' }] })}><Plus size={12} /> Add action</button>
    </section>;
          })}
          <button className="inspector-add-inline inspector-add-branch" onClick={() => add(eventType, false, group[group.length - 1].index)}><Plus size={12} /> Add branch</button>
        </div>)}
      </section>;
    })}
  </div>;
}

export function VectorPathEditor({ path, onChange, onStart }: { path: VectorPath; onChange: (path: VectorPath) => void; onStart?: () => void }) {
  const [selected, setSelected] = useState(0), index = Math.min(selected, path.commands.length - 1), command = path.commands[index];
  const commit = (commands: VectorCommand[], next = index) => { onChange(parseVectorPath({ ...path, commands })); setSelected(next); };
  const update = (patch: Record<string, number>) => commit(path.commands.map((command, i) => i === index ? { ...command, ...patch } as VectorCommand : command));
  const previous = [...path.commands.slice(0, index)].reverse().find(command => command.op !== 'Z');
  const lastIndex = path.commands.length - 1, closed = path.commands[lastIndex].op === 'Z';
  const end = [...path.commands].reverse().find(command => command.op !== 'Z')!;
  const remove = () => {
    const commands = path.commands.map(command => ({ ...command })); commands.splice(index, 1);
    if (command.op === 'M' && commands[index]) {
      if (commands[index].op === 'Z') commands.splice(index, 1);
      else if (commands[index].op !== 'M') { const next = commands[index]; commands[index] = { op: 'M', x: next.x, y: next.y }; }
    }
    if (commands.length) commit(commands, Math.max(0, index - 1));
  };
  const append = (op: 'L' | 'C') => {
    const commands = [...path.commands], at = closed ? lastIndex : commands.length;
    const x = Math.min(10000, end.x + .1), y = end.y;
    const command: VectorCommand = op === 'C' ? { op, x1: end.x, y1: end.y - .1, x2: x, y2: y - .1, x, y } : { op, x, y };
    // Keep generated handles inside the same schema budget even near its edge.
    if (command.op === 'C') { command.y1 = Math.max(-10000, command.y1); command.y2 = Math.max(-10000, command.y2); }
    commands.splice(at, 0, command); commit(commands, at);
  };
  return <div onFocusCapture={onStart} onPointerDownCapture={onStart}><Section title="Vector path">
    <svg className="vector-node-preview" viewBox="-16 -12 232 144" role="img" aria-label="Path node preview">
      <rect x="0" y="0" width="200" height="120" fill="none" stroke="#d0d7e5" strokeDasharray="3 3"/>
      <path d={vectorPathData(path, 200, 120)} fill="#dbe7ff" fillRule={path.fillRule} stroke="#4776db" strokeWidth="1.5"/>
      {command.op === 'C' && <><path d={`M ${(previous?.x ?? 0)*200} ${(previous?.y ?? 0)*120} L ${command.x1*200} ${command.y1*120} M ${command.x*200} ${command.y*120} L ${command.x2*200} ${command.y2*120}`} stroke="#c46b23" fill="none" strokeDasharray="3 2"/>{[[command.x1,command.y1],[command.x2,command.y2]].map(([x,y],i)=><rect key={i} x={x*200-3} y={y*120-3} width="6" height="6" fill="#c46b23"/>)}</>}
      {path.commands.map((command, i) => command.op === 'Z' ? null : <circle key={i} cx={command.x*200} cy={command.y*120} r={i===index?4:3} fill={i===index?'#172b58':'#ffffff'} stroke="#4776db" onClick={()=>setSelected(i)}><title>{`Node ${i+1}`}</title></circle>)}
    </svg>
    <label className="inspector-field">Fill rule<select aria-label="Path fill rule" value={path.fillRule} onChange={event=>onChange({...path,fillRule:event.target.value as VectorPath['fillRule']})}><option value="nonzero">Nonzero</option><option value="evenodd">Even-odd</option></select></label>
    <label className="inspector-field">Node<select aria-label="Path node" value={index} onChange={event=>setSelected(Number(event.target.value))}>{path.commands.map((command,i)=><option key={i} value={i}>{i+1} · {command.op==='M'?'Start subpath':command.op==='L'?'Line':command.op==='C'?'Curve':'Close subpath'}</option>)}</select></label>
    {(command.op === 'L' || command.op === 'C') && <label className="inspector-field">Segment<select aria-label="Path segment type" value={command.op} onChange={event=>{
      const next: VectorCommand = event.target.value === 'L' ? {op:'L',x:command.x,y:command.y} : {op:'C',x1:previous?.x??command.x,y1:previous?.y??command.y,x2:command.x,y2:command.y,x:command.x,y:command.y};
      commit(path.commands.map((command,i)=>i===index?next:command));
    }}><option value="L">Straight line</option><option value="C">Cubic curve</option></select></label>}
    {command.op !== 'Z' && <div className="inspector-grid">{(['x','y'] as const).map(axis=><NumberField key={axis} normalizeOnCommit label={`Node ${axis.toUpperCase()} %`} value={Number((command[axis]*100).toFixed(8))} min={-1000000} max={1000000} step={1} onChange={value=>update({[axis]:value/100})}/>)}</div>}
    {command.op === 'C' && <div className="inspector-grid">{(['x1','y1','x2','y2'] as const).map(field=><NumberField key={field} normalizeOnCommit label={`Control ${field[1]} ${field[0].toUpperCase()} %`} value={Number((command[field]*100).toFixed(8))} min={-1000000} max={1000000} step={1} onChange={value=>update({[field]:value/100})}/>)}</div>}
    <div className="vector-node-actions">
      <button disabled={path.commands.length>=VECTOR_LIMITS.commands} onClick={()=>append('L')}>Add line node</button>
      <button disabled={path.commands.length>=VECTOR_LIMITS.commands} onClick={()=>append('C')}>Add curve node</button>
      <button disabled={path.commands.length>=VECTOR_LIMITS.commands} onClick={()=>commit([...path.commands,{op:'M',x:.25,y:.25}],path.commands.length)}>New subpath</button>
      <button disabled={closed||path.commands.length>=VECTOR_LIMITS.commands} onClick={()=>commit([...path.commands,{op:'Z'}],path.commands.length)}>Close subpath</button>
      <button disabled={path.commands.length===1||(path.commands.length===2&&command.op==='M'&&path.commands[1].op==='Z')} onClick={remove}>Delete node</button>
    </div>
    <p className="inspector-help">Coordinates use % of the widget size. Values outside 0–100 stay outside the bounds. Resize the widget to scale the path; stroke width stays in pixels. The first actual node edit converts a box to a custom path and keeps its styles.</p>
  </Section></div>;
}

function FormPropertiesEditor({ widget, page, onChange }: { widget: Widget; page: Page; onChange: Props['onWidgetChange'] }) {
  const inputType = widget.inputType ?? 'text';
  const supportsLength = ['text', 'password', 'email', 'tel', 'url', 'search'].includes(inputType);
  const [lengthDraft, setLengthDraft] = useState(widget.maxLength === undefined ? '' : String(widget.maxLength));
  const [lengthError, setLengthError] = useState(false);
  useEffect(() => { setLengthDraft(widget.maxLength === undefined ? '' : String(widget.maxLength)); setLengthError(false); }, [widget.id, widget.maxLength]);
  const targets = collectWidgets(page.widgets).filter(({ widget: target }) => target.type !== 'panel' && target.type !== 'repeater');
  function commitLength() {
    const maxLength = lengthDraft.trim() === '' ? undefined : Number(lengthDraft);
    if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 0 || maxLength > 2147483647)) { setLengthError(true); return; }
    setLengthError(false); if (maxLength !== widget.maxLength) onChange({ maxLength });
  }
  return <Section title="Form properties">
    {widget.type === 'input' && <><label className="inspector-field">Input type<select aria-label="Input type" value={inputType} onChange={event => onChange({ inputType: event.target.value as InputType })}>{INPUT_TYPES.map(type => <option key={type} value={type}>{inputTypeLabels[type]}</option>)}</select></label><p className="inspector-help">Changing type keeps the stored text. The browser may show an empty value if its format is incompatible.</p>{inputType === 'file' && <p className="inspector-help">Choose a local file in the prototype. Files are not uploaded or saved with the project.</p>}</>}
    <label className="inspector-check"><input type="checkbox" aria-label="Read only" checked={widget.readOnly ?? false} onChange={event => onChange({ readOnly: event.target.checked || undefined })}/>Read only</label>
    {widget.type === 'input' && inputType === 'file' && <p className="inspector-help">Read only does not apply to File inputs.</p>}
    {widget.type === 'input' && <><label className="inspector-field">Maximum length<input aria-label="Maximum length" aria-invalid={lengthError} type="number" min={0} max={2147483647} step={1} placeholder="Unlimited" value={lengthDraft} onChange={event => { setLengthDraft(event.target.value); setLengthError(false); }} onBlur={commitLength} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>{lengthError && <p className="inspector-error" role="alert">Use a whole number from 0 to 2147483647, or leave blank for unlimited.</p>}<p className="inspector-help">{supportsLength ? 'Blank means unlimited. Zero prevents typing; stored text is kept.' : 'Maximum length is stored but does not limit this input type in the browser.'}</p></>}
    <label className="inspector-field">Submit button<select aria-label="Submit button" value={widget.submitButtonId ?? ''} onChange={event => onChange({ submitButtonId: event.target.value || undefined })}><option value="">None</option>{targets.map(({ widget: target, label }) => <option key={target.id} value={target.id}>{label}</option>)}{widget.submitButtonId && !targets.some(({ widget: target }) => target.id === widget.submitButtonId) && <option value={widget.submitButtonId} disabled>Unavailable target</option>}</select></label>
    <p className="inspector-help">Enter triggers the selected widget on this page. Missing targets do nothing.</p>
  </Section>;
}

function WidgetStyleEditor({ widget, page, onChange, onEditRichText, onEditPoints, treeLabel }: { treeLabel?: boolean; widget: Widget; page: Page; onChange: Props['onWidgetChange']; onEditRichText: Props['onEditRichText']; onEditPoints: Props['onEditPoints'] }) {
  const style = widget.style;
  const vectorKey=JSON.stringify({type:widget.type,vectorPath:widget.vectorPath,style:widget.style,width:widget.width,height:widget.height});
  const vectorUnavailable=vectorEditPathUnsupportedReason(widget);
  const editPath=useMemo(()=>!vectorUnavailable?resolveVectorEditPath(widget):undefined,[vectorKey,vectorUnavailable]);
  const updateStyle = (patch: Partial<WidgetStyle>, styleIntent?: WidgetStyleEditIntent) => {
    const next = mergeWidgetStyle(style, patch);
    // The parent applies a style-property diff; an explicit undefined communicates removal.
    if (style.cornerRadii && !next.cornerRadii) next.cornerRadii = undefined;
    if (style.borderWidths && !next.borderWidths) next.borderWidths = undefined;
    if (style.fillGradient && !next.fillGradient) next.fillGradient = undefined;
    if (style.strokeGradient && !next.strokeGradient) next.strokeGradient = undefined;
    onChange({ style: next }, patch, styleIntent);
  };
  const uniformCorners = (): [number, number, number, number] => { const radius = Math.min(1000, Math.max(0, style.radius)); return [radius, radius, radius, radius]; };
  const changeCorners = (command: CornerStyleCommand) => {
    const patch = cornerStylePatch(style, command);
    onChange({ style: mergeWidgetStyle(style, patch) }, patch, { kind: 'corners', command });
  };
  const textControl = ['input', 'textarea', 'select'].includes(widget.type);
  const selectionLayout = (widget.type==='checkbox'||widget.type==='radio')&&Boolean(widget.selectionText);
  const textLayout = textControl || selectionLayout || ['box', 'ellipse', 'path', 'text', 'button', 'tableCell'].includes(widget.type);
  const shadowFields = shadowFieldsFor(widget);
  return <>
    <Section title="Layout"><div className="inspector-grid">{widget.type !== 'tableCell' && <><NumberField label="X" value={widget.x} onChange={x => onChange({ x })} /><NumberField label="Y" value={widget.y} onChange={y => onChange({ y })} /></>}<NumberField label="W" value={widget.width} min={1} onChange={width => onChange({ width })} /><NumberField label="H" value={widget.height} min={1} onChange={height => onChange({ height })} />{widget.type !== 'tableCell' && !treeLabel && <NumberField label="Rotate" value={widget.rotation} step={0.1} onChange={rotation => onChange({ rotation })} />}{widget.type !== 'table' && widget.type !== 'inlineFrame' && !widget.vectorPath && !supportsCornerEditing(widget) && <NumberField label="Radius" value={style.radius} min={0} max={10000} commitUnchanged={Boolean(style.cornerRadii)} onChange={radius => updateStyle({ radius })} />}</div><CornerEditor widget={widget} onCommand={changeCorners}/>{widget.type !== 'table' && widget.type !== 'inlineFrame' && !widget.vectorPath && widget.type !== 'ellipse' && widget.type !== 'line' && <div className="inspector-corners"><label className="inspector-check"><input type="checkbox" aria-label="Independent corner radii" checked={Boolean(style.cornerRadii)} onChange={event => updateStyle(event.target.checked ? { cornerRadii: uniformCorners() } : { cornerRadii: undefined, radius: style.radius })}/>Legacy independent corners</label>{style.cornerRadii && <div className="inspector-grid inspector-corner-grid">{(['Top left', 'Top right', 'Bottom right', 'Bottom left'] as const).map((label, index) => <NumberField key={label} label={label} value={style.cornerRadii![index]} min={0} max={1000} onChange={radius => { const cornerRadii = [...style.cornerRadii!] as [number, number, number, number]; cornerRadii[index] = radius; updateStyle({ cornerRadii }); }}/>)}</div>}</div>}<div className="inspector-checks">{(['hidden', 'disabled', 'locked'] as const).filter(key=>!['table','menu','tree','treeNode','inlineFrame'].includes(widget.type)||key!=='disabled').map(key => <label key={key}><input type="checkbox" checked={widget[key]} onChange={event => onChange({ [key]: event.target.checked })} />{key[0].toUpperCase() + key.slice(1)}</label>)}</div></Section>
    {widget.type === 'table' && <RetainedShadows style={style} fields={[]} readOnly/>}
    {widget.type !== 'table' && <>
    {widget.vectorPath && (vectorUnavailable?<p className="inspector-help">Point editing is unavailable for this border or corner configuration.</p>:<VectorPathEditor key={widget.id} path={editPath!} onStart={()=>onEditPoints?.(widget.id)} onChange={vectorPath=>onChange({vectorPath})}/>)}
    {!['menu','tree','inlineFrame'].includes(widget.type)&&<><Section title="Text">{onEditRichText && RICH_TEXT_WIDGET_TYPES.some(type => type === widget.type) && <button className="inspector-rich-button" onClick={() => onEditRichText(widget.id)}>Edit formatted text</button>}{widget.richText && <p className="inspector-rich-summary">{widget.richText.paragraphs.length} paragraphs · mixed formatting. Edit formatted text to preserve individual runs.</p>}{widget.type !== 'select' && !widget.richText && <TextValue multiline className="inspector-text-content" label="Widget text" value={widget.text} onChange={text=>onChange({text})}/>}<label className="inspector-field">Font<TextValue label="Font family" value={style.fontFamily} onChange={fontFamily=>updateStyle({fontFamily})}/></label><label className="inspector-field">Font style<select aria-label="Font style" value={style.fontStyle ?? ''} onChange={event => updateStyle({ fontStyle: event.target.value ? event.target.value as 'normal' | 'italic' : undefined })}><option value="">Default (normal)</option><option value="normal">Normal</option><option value="italic">Italic</option></select></label><div className="inspector-grid"><NumberField label="Size" value={style.fontSize} min={1} max={512} onChange={fontSize => updateStyle({ fontSize })} /><label className="inspector-field inspector-compact">Weight<select aria-label="Font weight" value={style.fontWeight} onChange={event => updateStyle({ fontWeight: Number(event.target.value) })}>{[100, 200, 300, 400, 500, 600, 700, 800, 900].map(weight => <option key={weight} value={weight}>{weight === 400 ? 'Regular' : weight === 700 ? 'Bold' : weight}</option>)}</select></label></div><div className="inspector-row"><ColorField label="Color" value={style.color} onChange={color => updateStyle({ color })} /><div className="inspector-segment">{([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => <button key={align} aria-label={`Align text ${align}`} aria-pressed={style.textAlign === align} onClick={() => updateStyle({ textAlign: align })}><Icon size={13} /></button>)}</div></div></Section>
    <Section title="Text decoration">{(['underline', 'strikethrough'] as const).map(key => <label key={key} className="inspector-field">{key === 'underline' ? 'Underline' : 'Strikethrough'}<select aria-label={key === 'underline' ? 'Underline' : 'Strikethrough'} value={style[key] === undefined ? '' : String(style[key])} onChange={event => updateStyle({ [key]: event.target.value === '' ? undefined : event.target.value === 'true' })}><option value="">Default (off)</option><option value="true">On</option><option value="false">Off</option></select></label>)}</Section></>}
    {(widget.type === 'checkbox' || widget.type === 'radio') && widget.selectionText && <Section title="Selection text layout">
      {style.selectionButtonSize!==undefined&&<NumberField label="Indicator size" value={style.selectionButtonSize} min={0} max={100000} onChange={selectionButtonSize=>updateStyle({selectionButtonSize})}/>}
      <label className="inspector-check"><input type="checkbox" aria-label="Fit selection width to text" checked={widget.selectionText.autoFitWidth} onChange={event => onChange({ selectionText: { ...widget.selectionText!, autoFitWidth: event.target.checked } })}/>Fit width to text</label>
      <label className="inspector-check"><input type="checkbox" aria-label="Fit selection height to text" checked={widget.selectionText.autoFitHeight} onChange={event => onChange({ selectionText: { ...widget.selectionText!, autoFitHeight: event.target.checked } })}/>Fit height to text</label>
      <label className="inspector-check"><input type="checkbox" aria-label="Selection indicator on right" checked={widget.selectionText.alignRight} onChange={event => onChange({ selectionText: { ...widget.selectionText!, alignRight: event.target.checked } })}/>Indicator on right</label>
    </Section>}
    {textLayout && <Section title="Text layout">
      {!selectionLayout&&<label className="inspector-check"><input type="checkbox" aria-label="Custom text padding" checked={Boolean(style.textPadding)} onChange={event => { const inset = textControl ? 7 : 5; updateStyle({ textPadding: event.target.checked ? [inset, inset, inset, inset] : undefined }); }}/>Custom text padding</label>}
      {style.textPadding && <div className="inspector-grid">{(['top', 'right', 'bottom', 'left'] as const).map((side, index) => <NumberField key={side} label={`Padding ${side}`} value={style.textPadding![index]} min={0} max={1000} onChange={value => { const textPadding = [...style.textPadding!] as [number, number, number, number]; textPadding[index] = value; updateStyle({ textPadding }, { kind: 'textPaddingSide', side, value }); }}/>)}</div>}
      {!textControl && <label className="inspector-field">Vertical alignment<select aria-label="Vertical alignment" value={style.verticalAlign ?? ''} onChange={event => updateStyle({ verticalAlign: (event.target.value || undefined) as WidgetStyle['verticalAlign'] })}>{!selectionLayout&&<option value="">Default</option>}<option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>}
      {!textControl && <><label className="inspector-field">Line height<select aria-label="Line height" value={style.lineHeight === undefined ? '' : style.lineHeight === 'normal' ? 'normal' : 'custom'} onChange={event => updateStyle({ lineHeight: event.target.value === 'custom' ? 1.35 : event.target.value === 'normal' ? 'normal' : undefined })}><option value="">Default</option><option value="normal">Normal</option><option value="custom">Custom</option></select></label>{typeof style.lineHeight === 'number' && <NumberField label="Line height ratio" value={style.lineHeight} min={0.1} max={10} step={0.05} onChange={lineHeight => updateStyle({ lineHeight })}/>}</>}
    </Section>}
    {widget.type!=='inlineFrame'&&<Section title="Fill & border"><FillEditor key={widget.id} widgetType={widget.type} value={style} onChange={updateStyle}/><StrokeEditor key={`${widget.id}/stroke`} widgetType={widget.type} value={style} onChange={updateStyle}/><LineStyleEditor widget={widget} style={style} onChange={updateStyle}/><div className="inspector-grid"><>{widget.vectorPath ? <NumberField label="Stroke" value={style.strokeWidth} min={0} max={100} onChange={strokeWidth=>updateStyle({strokeWidth})}/> : <BorderWidthEditor style={style} onChange={updateStyle}/>}</><NumberField label="Opacity %" value={Math.round(style.opacity * 100)} min={0} max={100} onChange={opacity => updateStyle({ opacity: opacity / 100 })} /></div></Section>}
    {(shadowFields.length > 0 || SHADOW_FIELDS.some(([field]) => style[field] !== undefined)) && <Section title="Shadows">{SHADOW_FIELDS.filter(([field]) => shadowFields.includes(field)).map(([field, label]) => <ShadowEditor key={field} field={field} label={label} value={style[field]} onChange={value => updateStyle({ [field]: value })}/>)}<RetainedShadows style={style} fields={shadowFields}/></Section>}
    {widget.type === 'image' && <Section title="Image"><label className="inspector-field">Source URL or data URL<textarea aria-label="Image source" rows={3} value={widget.imageSrc ?? ''} onChange={event => onChange({ imageSrc: event.target.value })} /></label></Section>}
    {(widget.type === 'input' || widget.type === 'textarea') && <FormPropertiesEditor widget={widget} page={page} onChange={onChange}/>}
    {widget.type === 'select' && <SelectOptionsEditor widget={widget} onChange={onChange}/>}
    {!['menu','tree','inlineFrame'].includes(widget.type)&&<Section title="Selection">
      <label className="inspector-check"><input type="checkbox" aria-label={['checkbox', 'radio'].includes(widget.type) ? 'Checked by default' : 'Selected by default'} checked={(['checkbox', 'radio'].includes(widget.type) ? widget.checked : widget.selected) ?? false} onChange={event => onChange(['checkbox', 'radio'].includes(widget.type) ? { checked: event.target.checked } : { selected: event.target.checked })}/>{['checkbox', 'radio'].includes(widget.type) ? 'Checked by default' : 'Selected by default'}</label>
      {widget.type === 'radio' ? <label className="inspector-field">Radio group<input aria-label="Radio group" maxLength={256} value={widget.radioGroup ?? ''} onChange={event => onChange({ radioGroup: event.target.value || undefined })}/></label> : widget.type !== 'checkbox' && <label className="inspector-field">Selection group<input aria-label="Selection group" maxLength={256} value={widget.selectionGroup ?? ''} onChange={event => onChange({ selectionGroup: event.target.value || undefined })}/></label>}
      <label className="inspector-check"><input type="checkbox" aria-label="Custom selected style" checked={widget.selectedStyle !== undefined} onChange={event => onChange({ selectedStyle: event.target.checked ? {} : undefined })}/>Custom selected style</label>
      {widget.selectedStyle !== undefined && <><FillOverrideEditor key={widget.id} label="Selected fill" showInherited widgetType={widget.type} patch={widget.selectedStyle} base={style} onChange={selectedStyle=>onChange({selectedStyle})}/><ColorField label="Selected text color" value={widget.selectedStyle.color ?? style.color} onChange={color => onChange({ selectedStyle: { ...widget.selectedStyle, color } })}/><StrokeOverrideEditor key={`${widget.id}/stroke`} label="Selected border" showInherited widgetType={widget.type} patch={widget.selectedStyle} base={style} onChange={selectedStyle=>onChange({selectedStyle})}/><LineStyleOverrides widget={widget} patch={widget.selectedStyle} base={style} prefix="Selected" onChange={selectedStyle=>onChange({selectedStyle})}/><JsonEditor label="Selected style" value={widget.selectedStyle} validate={validateStyle} onApply={data => onChange({ selectedStyle: data as Partial<WidgetStyle> })} hint="Only supplied properties override the base style while selected. Clear the checkbox to remove all overrides."/></>}
    </Section>}
    {widget.type === 'panel' && <Section title="Panel states"><label className="inspector-check"><input type="checkbox" aria-label="Fit to content" checked={widget.fitToContent ?? false} onChange={event => onChange({ fitToContent: event.target.checked })}/>Fit to content</label><p className="inspector-help">Preview and exported HTML fit the active state. The editor keeps the stored canvas size.</p><div className="inspector-state-list">{(widget.states ?? []).map(state => <div className={`inspector-state ${widget.activeStateId === state.id ? 'is-active' : ''}`} key={state.id}><input type="radio" name={`panel-state-${widget.id}`} aria-label={`Show ${state.name}`} checked={widget.activeStateId === state.id} onChange={() => onChange({ activeStateId: state.id })} /><input aria-label={`State name ${state.name}`} value={state.name} onChange={event => onChange({ states: widget.states?.map(item => item.id === state.id ? { ...item, name: event.target.value } : item) })} /><span title="Widgets in state">{state.widgets.length}</span><button className="inspector-icon inspector-danger" aria-label={`Delete ${state.name}`} disabled={(widget.states?.length ?? 0) <= 1} onClick={() => { const states = widget.states?.filter(item => item.id !== state.id); onChange({ states, activeStateId: widget.activeStateId === state.id ? states?.[0]?.id : widget.activeStateId }); }}><Trash2 size={12} /></button></div>)}</div><button className="inspector-add-inline" onClick={() => { const next = { id: id(), name: `State ${(widget.states?.length ?? 0) + 1}`, widgets: [] }; onChange({ states: [...(widget.states ?? []), next], activeStateId: next.id }); }}><Plus size={12} /> Add state</button><p className="inspector-help">Select a state to edit its widgets on the canvas.</p></Section>}
    {widget.type === 'repeater' && widget.repeater && <Section title="Repeater dataset"><div className="inspector-grid"><NumberField label="Item height" value={widget.repeater.itemHeight} min={0} max={10000} onChange={itemHeight => onChange({ repeater: { ...widget.repeater!, itemHeight } })} /><NumberField label="Gap" value={widget.repeater.gap} min={0} max={10000} onChange={gap => onChange({ repeater: { ...widget.repeater!, gap } })} /></div><JsonEditor label="Columns" value={widget.repeater.columns} validate={data => Array.isArray(data) && data.length > 0 && data.every(column => typeof column === 'string' && column.trim()) && new Set(data).size === data.length ? null : 'Use a non-empty array of unique column names.'} onApply={data => onChange({ repeater: { ...widget.repeater!, columns: data as string[] } })} /><JsonEditor label="Rows" value={widget.repeater.rows} validate={data => Array.isArray(data) && data.every(isStringRecord) ? null : 'Use an array of objects with text values.'} onApply={data => onChange({ repeater: { ...widget.repeater!, rows: data as Record<string, string>[] } })} hint="Template text can reference [[Item.ColumnName]], [[Item.isMarked]], or [[Item.Repeater.pageIndex]], [[Item.Repeater.pageCount]], [[Item.Repeater.itemCount]], [[Item.Repeater.visibleItemCount]], [[Item.Repeater.dataCount]]." /></Section>}
    {widget.type === 'repeater' && widget.repeater && <RepeaterLayoutEditor widget={widget} onChange={onChange}/>}
    {widget.type === 'repeater' && widget.repeater && <Section title="Repeater pagination"><label className="inspector-check"><input type="checkbox" aria-label="Enable pagination" checked={Boolean(widget.repeater.pagination)} onChange={event => { const repeater = { ...widget.repeater! }; if (event.target.checked) repeater.pagination = { itemsPerPage: 20, startPage: 1 }; else delete repeater.pagination; onChange({ repeater }); }}/>Enable pagination</label>{widget.repeater.pagination && <div className="inspector-grid"><NumberField label="Items per page" value={widget.repeater.pagination.itemsPerPage} min={1} max={10000} step={0.1} onChange={itemsPerPage => onChange({ repeater: { ...widget.repeater!, pagination: { ...widget.repeater!.pagination!, itemsPerPage } } })}/><NumberField label="Starting page" value={widget.repeater.pagination.startPage} min={1} max={10000} step={0.1} onChange={startPage => onChange({ repeater: { ...widget.repeater!, pagination: { ...widget.repeater!.pagination!, startPage } } })}/></div>}<p className="inspector-help">Disabled shows all rows. Values retain decimals; a page requiring fractional row indices reports an error in preview.</p></Section>}
    </>}
  </>;
}

function HintEditor({ widget, onChange }: { widget: Widget; onChange: Props['onWidgetChange'] }) {
  const unsupported = widget.type === 'input' && widget.inputType === 'file';
  return <Section title="Hint text">
    <label className="inspector-field">Hint text<textarea aria-label="Hint text" disabled={unsupported} rows={2} maxLength={100000} value={widget.hintText ?? ''} onChange={event=>onChange({hintText:event.target.value})}/></label>
    <label className="inspector-field">Hide after<select aria-label="Hide hint after" disabled={unsupported} value={widget.hintHideOn ?? 'typing'} onChange={event=>onChange({hintHideOn:event.target.value as Widget['hintHideOn']})}><option value="typing">Typing</option><option value="focus">Focus</option></select></label>
    <p className="inspector-help">{unsupported ? 'File inputs do not support hints. Existing hint settings are kept for switching back to another type.' : 'The hint is shown when the field is empty. It is separate from the entered value.'}</p>
    {(widget.hintText!==undefined||widget.hintHideOn!==undefined||widget.hintStyle!==undefined)&&<button className="inspector-add-inline" disabled={unsupported} onClick={()=>onChange({hintText:undefined,hintHideOn:undefined,hintStyle:undefined})}>Remove hint configuration</button>}
  </Section>;
}

function InteractionStyleEditor({ widget, onChange, onPreview, adaptiveEffects }: { widget: Widget; onChange: Props['onWidgetChange']; onPreview: Props['onStylePreview']; adaptiveEffects?: Props['adaptiveEffects'] }) {
  const [choice,setChoice]=useState<InteractionStyleField>('mouseOverStyle');
  const [active,setActive]=useState<InteractionStyleField|null>(null);
  const effectBlocked=(field:InteractionStyleField)=>field==='hintStyle'&&widget.type==='input'&&widget.inputType==='file';
  const availableEffects=effectChoices.filter(([field])=>field!=='hintStyle'||widget.type==='input'||widget.type==='textarea');
  const patch=active&&!effectBlocked(active)?widget[active]:undefined;
  useEffect(()=>{onPreview?.(active&&patch!==undefined?{widgetId:widget.id,field:active}:null);return()=>onPreview?.(null)},[active,patch!==undefined,widget.id,onPreview]);
  const name=effectChoices.find(([field])=>field===active)?.[1]??'';
  const change=(value:Partial<WidgetStyle>)=>{if(active)onChange({[active]:value})};
  const removeProperty=(key:keyof WidgetStyle)=>{const next={...patch};delete next[key];change(next)};
  const toggle=(key:keyof WidgetStyle,enabled:boolean)=>enabled?change({...patch,[key]:widget.style[key]}):removeProperty(key);
  return <Section title="Style effects">
    {adaptiveEffects && <><p className="inspector-help">{adaptiveEffects.local ? 'Effects local to this view' : 'Effects inherited from parent'}</p><button className="inspector-add-inline" disabled={!adaptiveEffects.local} onClick={() => { adaptiveEffects.onInherit(); setActive(null); }}>Use inherited effects</button></>}
    <label className="inspector-check"><input type="checkbox" aria-label="Error by default" checked={Boolean(widget.error)} onChange={event=>onChange({error:event.target.checked?true:undefined})}/>Error by default</label>
    <div className="inspector-row"><select aria-label="Effect to add" value={choice} onChange={event=>setChoice(event.target.value as InteractionStyleField)}>{availableEffects.map(([field,label])=><option key={field} value={field} disabled={effectBlocked(field)}>{label}</option>)}</select><button className="inspector-add-inline" disabled={widget[choice]!==undefined||effectBlocked(choice)} onClick={()=>{onChange({[choice]:{}});setActive(choice)}}><Plus size={12}/> Add style effect</button></div>
    <div className="effect-list">{availableEffects.filter(([field])=>widget[field]!==undefined).map(([field,label])=><button key={field} disabled={effectBlocked(field)} className={active===field?'active':''} aria-label={`Edit ${label} effect`} aria-expanded={active===field&&!effectBlocked(field)} onClick={()=>setActive(active===field?null:field)}>{label}</button>)}</div>
    {active&&patch!==undefined&&<div className="effect-editor" role="group" aria-label={`${name} style effect`}>
      <p className="inspector-help">Editing {name}. The canvas previews this effect until you close it.</p>
      <label className="inspector-check"><input type="checkbox" aria-label={`Override ${name} font style`} checked={Object.hasOwn(patch,'fontStyle')} onChange={event=>event.target.checked?change({...patch,fontStyle:widget.style.fontStyle??'normal'}):removeProperty('fontStyle')}/>Font style</label>
      {Object.hasOwn(patch,'fontStyle')&&<label className="inspector-field">Font style<select aria-label={`${name} font style`} value={patch.fontStyle??'normal'} onChange={event=>change({...patch,fontStyle:event.target.value as 'normal'|'italic'})}><option value="normal">Normal</option><option value="italic">Italic</option></select></label>}
      {(['underline','strikethrough'] as const).map(key=><div key={key}><label className="inspector-check"><input type="checkbox" aria-label={`Override ${name} ${key}`} checked={Object.hasOwn(patch,key)} onChange={event=>event.target.checked?change({...patch,[key]:widget.style[key]??false}):removeProperty(key)}/>{key==='underline'?'Underline':'Strikethrough'}</label>{Object.hasOwn(patch,key)&&<label className="inspector-check"><input type="checkbox" aria-label={`${name} ${key}`} checked={patch[key]??false} onChange={event=>change({...patch,[key]:event.target.checked})}/>Enabled</label>}</div>)}
      <FillOverrideEditor key={`${widget.id}/${active}`} label={`${name} fill`} widgetType={widget.type} patch={patch} base={widget.style} onChange={change}/><StrokeOverrideEditor key={`${widget.id}/${active}/stroke`} label={`${name} border`} widgetType={widget.type} patch={patch} base={widget.style} onChange={change}/><LineStyleOverrides widget={widget} patch={patch} base={widget.style} prefix={name} onChange={change}/>{(['color'] as const).map(key=>{const label=key==='color'?'text color':'border';return <div key={key}><label className="inspector-check"><input type="checkbox" aria-label={`Override ${name} ${label}`} checked={Object.hasOwn(patch,key)} onChange={event=>toggle(key,event.target.checked)}/>{label[0].toUpperCase()+label.slice(1)}</label>{Object.hasOwn(patch,key)&&<ColorField label={`${name} ${label}`} value={patch[key]!} onChange={value=>change({...patch,[key]:value})}/>}</div>})}
      <CornerOverrides widget={widget} patch={patch} prefix={name} onChange={(value,command)=>{if(active)onChange({[active]:value},undefined,{kind:'corners',command,effect:active})}}/>
      {(['strokeWidth','fontSize','fontWeight','opacity','radius'] as const).filter(key=>key!=='radius'||!supportsCornerEditing(widget)).map(key=>{const labels={strokeWidth:'border width',fontSize:'font size',fontWeight:'font weight',opacity:'opacity %',radius:'radius'},label=labels[key];return <div key={key}><label className="inspector-check"><input type="checkbox" aria-label={`Override ${name} ${label}`} checked={Object.hasOwn(patch,key)} onChange={event=>toggle(key,event.target.checked)}/>{label[0].toUpperCase()+label.slice(1)}</label>{Object.hasOwn(patch,key)&&<NumberField label={`${name} ${label}`} value={key==='opacity'?Math.round(patch[key]!*100):patch[key]!} min={key==='fontSize'?1:0} max={key==='opacity'||key==='strokeWidth'?100:key==='fontSize'?512:1000} step={key==='fontWeight'?100:1} onChange={value=>{const next={...patch,[key]:key==='opacity'?value/100:value};if(key==='strokeWidth')delete next.borderWidths;if(key==='radius')delete next.cornerRadii;change(next)}}/>}</div>})}
      <ShadowOverrides patch={patch} base={widget.style} fields={shadowFieldsFor(widget)} prefix={name} onChange={change}/>
      <JsonEditor label={`${name} more style properties`} value={patch} validate={validateStyle} onApply={value=>change(value as Partial<WidgetStyle>)} hint="Only enabled properties override the base style. Uncheck a property to inherit it again."/>
      <div className="inspector-row"><button onClick={()=>setActive(null)}>Close effect</button><button className="inspector-danger" aria-label={`Remove ${name} effect`} onClick={()=>{onChange({[active]:undefined});setActive(null)}}>Remove effect</button></div>
    </div>}
  </Section>;
}

function LayerProperties({ widget, onChange }: { widget: Widget; onChange: Props['onWidgetChange'] }) {
  return <Section title="Group">
    <div className="inspector-grid">
      <NumberField label="X" value={widget.x} onChange={x => onChange({ x })}/>
      <NumberField label="Y" value={widget.y} onChange={y => onChange({ y })}/>
      <NumberField label="Group width" value={widget.width} min={0} normalizeOnCommit commitUnchanged onChange={width=>onChange({width})}/>
      <NumberField label="Group height" value={widget.height} min={0} normalizeOnCommit commitUnchanged onChange={height=>onChange({height})}/>
    </div>
    <p className="inspector-help">Double-click to edit group members. Resizing updates members in the current view, even when Affect all views is checked.</p>
    <label className="inspector-check"><input type="checkbox" aria-label="Propagate group hover and pressed styles" checked={widget.layer?.propagate ?? false} onChange={event => onChange({ layer: { ...widget.layer!, propagate: event.target.checked } })}/>Propagate hover and pressed styles</label>
    <div className="inspector-checks">{(['hidden','disabled','locked'] as const).map(key => <label key={key}><input type="checkbox" checked={widget[key]} onChange={event => onChange({ [key]: event.target.checked })}/>{key[0].toUpperCase() + key.slice(1)}</label>)}</div>
    <label className="inspector-check"><input type="checkbox" aria-label="Group selected by default" checked={widget.selected ?? false} onChange={event => onChange({ selected: event.target.checked })}/>Selected by default</label>
  </Section>;
}

function ResizePinsEditor({widget,onChange}:{widget:Widget;onChange:Props['onWidgetChange']}){
  const pins=resolveResizePins(widget.style);
  const change=(patch:Partial<WidgetStyle>)=>onChange({style:mergeWidgetStyle(widget.style,patch)},patch);
  return <Section title="Resize pins">
    <div className="inspector-grid">
      <label className="inspector-field">Horizontal pin<select aria-label="Horizontal pin" value={pins.pinHorizontal} onChange={event=>change({pinHorizontal:event.target.value as PinHorizontal})}>{PIN_HORIZONTAL_VALUES.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>
      <label className="inspector-field">Vertical pin<select aria-label="Vertical pin" value={pins.pinVertical} onChange={event=>change({pinVertical:event.target.value as PinVertical})}>{PIN_VERTICAL_VALUES.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label>
    </div>
    <div className="inspector-checks">
      <label><input aria-label="Fixed width" type="checkbox" checked={pins.fixedWidth} onChange={event=>change({fixedWidth:event.target.checked})}/>Fixed width</label>
      <label><input aria-label="Fixed height" type="checkbox" checked={pins.fixedHeight} onChange={event=>change({fixedHeight:event.target.checked})}/>Fixed height</label>
    </div>
    <p className="inspector-help">Stored constraints for group resizing. Some widget types require a fixed dimension regardless of these values.</p>
  </Section>;
}

export function Inspector({ page, widget, onWidgetChange, onPageChange, document, onStylePreview, onEditRichText, onEditPoints, onEditFrameTarget, tableContext, menuContext, treeContext, styleContextKey, adaptiveEffects }: Props) {
  const [tab, setTab] = useState<'style' | 'interactions' | 'notes'>('style');
  const selected = widget ?? page;
  const changeInteractions = (interactions: Interaction[]) => widget ? onWidgetChange({ interactions }) : onPageChange({ interactions });
  return <aside className="inspector" aria-label="Properties inspector">
    <div className="inspector-tabs" role="tablist" aria-label="Inspector panels">{(['style', 'interactions', 'notes'] as const).map(name => <button key={name} role="tab" aria-selected={tab === name} id={`inspector-tab-${name}`} aria-controls={`inspector-panel-${name}`} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</div>
    <div className="inspector-identity"><span className="inspector-type">{widget ? widget.type.toUpperCase() : 'PAGE'}</span><input aria-label={widget ? 'Widget name' : 'Page name'} value={selected.name} onChange={event => widget ? onWidgetChange({ name: event.target.value }) : onPageChange({ name: event.target.value })} /></div>
    <div className="inspector-scroll" role="tabpanel" id={`inspector-panel-${tab}`} aria-labelledby={`inspector-tab-${tab}`} key={`${selected.id}/${styleContextKey ?? ''}`}>
      {tab === 'style' && widget?.type==='inlineFrame' && <InlineFrameProperties widget={widget} pages={document.pages} onChange={onWidgetChange} onEditTarget={()=>onEditFrameTarget?.(widget.id)}/>}
      {tab === 'style' && treeContext && <TreeStructureControls {...treeContext}/>}
      {tab === 'style' && menuContext && <MenuStructureControls {...menuContext}/>}
      {tab === 'style' && tableContext && <TableStructureControls {...tableContext}/>}
      {tab === 'style' && (widget ? widget.type==='layer'?<LayerProperties widget={widget} onChange={onWidgetChange}/>:widget.type==='treeNode'?<><p className="inspector-help">Edit the node label for text, dimensions and styles. Node interactions keep their independent identity.</p><RetainedShadows style={widget.style} fields={[]} readOnly/></>:<WidgetStyleEditor key={widget.id} treeLabel={Boolean(treeContext?.selection?.part==='label')} widget={widget} page={page} onChange={onWidgetChange} onEditRichText={onEditRichText} onEditPoints={onEditPoints} /> : <><Section title="Page dimensions"><div className="inspector-grid"><NumberField label="Width" value={page.width} min={1} onChange={width => onPageChange({ width })} /><NumberField label="Height" value={page.height} min={1} onChange={height => onPageChange({ height })} /></div><ColorField label="Background" value={page.background} onChange={background => onPageChange({ background })} /></Section><div className="inspector-empty"><span>{page.widgets.length} widgets on this page</span><p>Select a widget to edit its position, style and content.</p></div></>)}
      {tab==='style'&&widget&&<ResizePinsEditor widget={widget} onChange={onWidgetChange}/>}
      {tab === 'interactions' && <>{widget&&(widget.type==='input'||widget.type==='textarea')&&<HintEditor widget={widget} onChange={onWidgetChange}/>} {widget&&!['table','menu','tree','treeNode','inlineFrame','layer'].includes(widget.type)&&<InteractionStyleEditor widget={widget} onChange={onWidgetChange} onPreview={onStylePreview} adaptiveEffects={adaptiveEffects}/>}<InteractionsEditor interactions={selected.interactions} onChange={changeInteractions} document={document} page={page} widget={widget} /></>}
      {tab === 'notes' && <Section title={widget ? 'Widget notes' : 'Page overview'}><textarea className="inspector-notes" aria-label={widget ? 'Widget notes' : 'Page notes'} value={selected.notes} onChange={event => widget ? onWidgetChange({ notes: event.target.value }) : onPageChange({ notes: event.target.value })} placeholder="Describe behavior, requirements or implementation details…" /><p className="inspector-help">Notes are saved with the project.</p></Section>}
    </div>
    <div className="inspector-footer">{widget ? `${widget.type} · ${Math.round(widget.width)} × ${Math.round(widget.height)}` : `${page.name} · ${page.width} × ${page.height}`}</div>
  </aside>;
}
