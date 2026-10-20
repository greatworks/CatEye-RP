import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { parseMotionBoundary } from '../model/document';
import { MOVE_MODES, MOVE_TRAJECTORIES, ROTATION_ANCHORS, ROTATION_EASINGS, type MotionBoundary, type MotionExpression, type MoveActionSpec, type MoveTarget, type MoveTargetSpec, type ResizeActionSpec, type ResizeTarget, type ResizeTargetSpec, type Widget } from '../model/types';

type Choice = { widget: Widget; label: string };
export const supportsAnimatedResize = (widget: Widget) => ['box', 'ellipse', 'path', 'text', 'button', 'placeholder', 'panel', 'image', 'hotspot', 'inlineFrame', 'select', 'input', 'textarea'].includes(widget.type);
export function defaultMoveTarget(): MoveTargetSpec {
  return { target: { kind: 'this' }, mode: 'location', x: { text: '' }, y: { text: '' }, trajectory: 'straight', easing: 'none', duration: 500 };
}
export function defaultResizeTarget(): ResizeTargetSpec {
  return { target: { kind: 'this' }, width: { text: '' }, height: { text: '' }, anchor: 'top left', easing: 'none', duration: 500 };
}
const defaultBoundary = (): MotionBoundary => ({ kind: 'compare', direction: 'left', operator: '>=', left: { text: '[[Target.x]]' }, right: { text: '0' } });
const modeLabels: Record<typeof MOVE_MODES[number], string> = { location: 'To', delta: 'By', drag: 'With drag', dragX: 'With drag — horizontal', dragY: 'With drag — vertical', locationBeforeDrag: 'To position before drag', withThis: 'With this widget', sizeDeltaX: 'By width change', sizeDeltaY: 'By height change' };
const title = (value: string) => value.replace(/^./, letter => letter.toUpperCase());
const easingLabel = (value: string) => title(value.replace(/^ease/, 'ease ').replace(/([a-z])([A-Z])/g, '$1 $2'));

/** Rename only identifiers inside expressions; quoted text and other scopes stay literal. */
export function renameMotionBinding(value: MotionExpression, previous: string, next: string): MotionExpression {
  const text = value.text.replace(/\[\[[^\[\]]+\]\]/g, expression => expression.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}\p{N}_$]+)*/gu, token => {
    if (token[0] === '"' || token[0] === "'" || /^[\d.]/.test(token)) return token;
    const root = token.split('.')[0]; return root.toLowerCase() === previous ? next + token.slice(root.length) : token;
  }));
  return { ...value, text, bindings: Object.fromEntries(Object.entries(value.bindings ?? {}).map(([key, binding]) => [key === previous ? next : key, binding])) };
}

function WidgetChoice({ label, value, choices, onChange }: { label: string; value: string; choices: Choice[]; onChange: (id: string) => void }) {
  return <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
    {!choices.some(({ widget }) => widget.id === value) && <option value={value}>Missing widget · {value}</option>}
    {choices.map(({ widget, label }) => <option key={widget.id} value={widget.id}>{label}</option>)}
  </select>;
}
function BindingName({ name, names, label, scope, onRename }: { name: string; names: string[]; label: string; scope: MotionExpression; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name), [error, setError] = useState('');
  // A reordered, removed or externally restored target has a different scope.
  // Discard unsaved name drafts instead of applying them to another expression.
  useEffect(() => { setDraft(name); setError(''); }, [name, scope]);
  const commit = () => {
    const next = draft.trim().toLowerCase();
    if (!/^[a-z_$][a-z0-9_$]*$/.test(next) || next.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(next) || next !== name && names.includes(next)) {
      setError('Use a unique name with letters, numbers or underscores.'); return;
    }
    setError(''); setDraft(next); if (next !== name) onRename(next);
  };
  return <><input aria-label={label} value={draft} maxLength={128} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/>{error && <span role="alert" className="inspector-error">{error}</span>}</>;
}
export function MotionExpressionEditor({ label, value, choices, onChange }: { label: string; value: MotionExpression; choices: Choice[]; onChange: (value: MotionExpression) => void }) {
  const entries = Object.entries(value.bindings ?? {});
  const bindings = (next: NonNullable<MotionExpression['bindings']>) => onChange({ ...value, bindings: Object.keys(next).length ? next : undefined });
  return <div className="inspector-motion-expression">
    <label className="inspector-field">{label}<input aria-label={label} maxLength={4100} value={value.text} placeholder="Value or [[expression]]" onChange={event => onChange({ ...value, text: event.target.value })}/></label>
    <details><summary>{label} local widgets{entries.length ? ` (${entries.length})` : ''}</summary>
      {entries.map(([alias, binding]) => <div key={alias} className="inspector-motion-binding">
        <label className="inspector-field">Name<BindingName name={alias} scope={value} names={entries.map(([name]) => name)} label={`${label} local name ${alias}`} onRename={name => {
          onChange(renameMotionBinding(value, alias, name));
        }}/></label>
        <label className="inspector-field">Widget<WidgetChoice label={`${label} local widget ${alias}`} value={binding.targetId} choices={choices} onChange={targetId => bindings({ ...value.bindings, [alias]: { kind: 'widget', targetId } })}/></label>
        <button type="button" className="inspector-icon inspector-danger" aria-label={`Remove ${label} local widget ${alias}`} onClick={() => bindings(Object.fromEntries(entries.filter(([key]) => key !== alias)))}><Trash2 size={12}/></button>
      </div>)}
      <button type="button" className="inspector-add-inline" disabled={!choices.length || entries.length >= 128} onClick={() => {
        let index = 1; while (Object.hasOwn(value.bindings ?? {}, `local${index}`)) index++;
        bindings({ ...value.bindings, [`local${index}`]: { kind: 'widget', targetId: choices[0].widget.id } });
      }}><Plus size={12}/>Add local widget</button>
    </details>
  </div>;
}
function BoundaryNode({ value, label, choices, depth = 0, onChange }: { value: MotionBoundary; label: string; choices: Choice[]; depth?: number; onChange: (value: MotionBoundary) => void }) {
  return <fieldset className="inspector-motion-boundary"><legend>{label}</legend>
    <label className="inspector-field">Match<select aria-label={`${label} match`} value={value.kind} onChange={event => {
      const kind = event.target.value as MotionBoundary['kind'];
      onChange(kind === 'compare' ? defaultBoundary() : value.kind === 'compare' ? { kind, left: value, right: defaultBoundary() } : { ...value, kind });
    }}><option value="compare">Condition</option><option value="and" disabled={depth >= 15}>All conditions</option><option value="or" disabled={depth >= 15}>Any condition</option></select></label>
    {value.kind === 'compare' ? <>
      <label className="inspector-field">Constrain<select aria-label={`${label} edge`} value={value.direction} onChange={event => onChange({ ...value, direction: event.target.value as typeof value.direction })}>{(['left','right','top','bottom'] as const).map(edge => <option key={edge} value={edge}>{title(edge)}</option>)}</select></label>
      <MotionExpressionEditor label={`${label} position`} value={value.left} choices={choices} onChange={left => onChange({ ...value, left })}/>
      <label className="inspector-field">Comparison<select aria-label={`${label} comparison`} value={value.operator} onChange={event => onChange({ ...value, operator: event.target.value as typeof value.operator })}>{['>=','<=','>','<'].map(operator => <option key={operator}>{operator}</option>)}</select></label>
      <MotionExpressionEditor label={`${label} limit`} value={value.right} choices={choices} onChange={right => onChange({ ...value, right })}/>
    </> : <>
      <BoundaryNode label={`${label} first`} depth={depth + 1} value={value.left} choices={choices} onChange={left => onChange({ ...value, left })}/>
      <BoundaryNode label={`${label} second`} depth={depth + 1} value={value.right} choices={choices} onChange={right => onChange({ ...value, right })}/>
      <button type="button" className="inspector-add-inline" onClick={() => onChange(value.left)}>Keep first condition</button>
      <button type="button" className="inspector-add-inline" onClick={() => onChange(value.right)}>Keep second condition</button>
    </>}
  </fieldset>;
}
function BoundaryEditor({ value, choices, label, onChange }: { value?: MotionBoundary; choices: Choice[]; label: string; onChange: (value?: MotionBoundary) => void }) {
  const [error, setError] = useState('');
  return <details className="inspector-motion-bounds"><summary>{label}{value ? ' · On' : ''}</summary>
    <label className="inspector-check"><input type="checkbox" aria-label={`Enable ${label}`} checked={Boolean(value)} onChange={event => { setError(''); onChange(event.target.checked ? defaultBoundary() : undefined); }}/>Constrain movement</label>
    {value && <BoundaryNode label={label} value={value} choices={choices} onChange={next => { try { onChange(parseMotionBoundary(next)); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'Invalid boundary'); } }}/>}
    {error && <p role="alert" className="inspector-error">{error}</p>}
  </details>;
}
export function MotionActionEditor({ kind, value, choices, onChange }: {
  kind: 'move' | 'resize'; value: MoveActionSpec | ResizeActionSpec; choices: Choice[]; onChange: (value: MoveActionSpec | ResizeActionSpec) => void;
}) {
  const entries: (MoveTargetSpec | ResizeTargetSpec)[] = value.targets;
  const targetChoices = kind === 'resize' ? choices.filter(({ widget }) => supportsAnimatedResize(widget)) : choices;
  const update = (index: number, patch: Omit<Partial<MoveTargetSpec & ResizeTargetSpec>, 'target'> & { target?: MoveTarget | ResizeTarget }) => onChange({ targets: entries.map((entry, at) => at === index ? { ...entry, ...patch } : entry) } as MoveActionSpec | ResizeActionSpec);
  const reorder = (index: number, delta: number) => { const targets = [...entries]; [targets[index], targets[index + delta]] = [targets[index + delta], targets[index]]; onChange({ targets } as MoveActionSpec | ResizeActionSpec); };
  return <fieldset className="inspector-motion-action" aria-label={`${title(kind)} action`}><legend>{kind === 'move' ? 'Move' : 'Set size'}</legend>
    {entries.map((entry, index) => {
      const label = `${title(kind)} target ${index + 1}`, widgetId = entry.target.kind === 'widget' ? entry.target.id : undefined, selected = widgetId ? `widget:${widgetId}` : entry.target.kind;
      return <fieldset key={index} className="inspector-motion-target"><legend>Target {index + 1}</legend>
        <div className="inspector-row inspector-motion-target-order">
          <button type="button" className="inspector-icon" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUp size={12}/></button>
          <button type="button" className="inspector-icon" aria-label={`Move ${label} down`} disabled={index === entries.length - 1} onClick={() => reorder(index, 1)}><ArrowDown size={12}/></button>
          <button type="button" className="inspector-icon inspector-danger" aria-label={`Remove ${label}`} disabled={entries.length === 1} onClick={() => onChange({ targets: entries.filter((_, at) => at !== index) } as MoveActionSpec | ResizeActionSpec)}><Trash2 size={12}/></button>
        </div>
        <label className="inspector-field">Target<select aria-label={label} value={selected} onChange={event => {
          const next = event.target.value; update(index, { target: next.startsWith('widget:') ? { kind: 'widget', id: next.slice(7) } : kind === 'move' ? { kind: next as 'this' | 'widgetsBelow' | 'widgetsRight' } : { kind: next as 'this' | 'thisItem' } });
        }}><option value="this">This widget</option>{kind === 'move' ? <><option value="widgetsBelow">Widgets below this widget</option><option value="widgetsRight">Widgets right of this widget</option></> : <option value="thisItem">This repeater item</option>}
          {widgetId && !targetChoices.some(({ widget }) => widget.id === widgetId) && <option value={selected}>{choices.some(({ widget }) => widget.id === widgetId) ? 'Unsupported widget' : 'Missing widget'} · {widgetId}</option>}
          {targetChoices.map(({ widget, label }) => <option key={widget.id} value={`widget:${widget.id}`}>{label}</option>)}
        </select></label>
        {'mode' in entry ? <>
          <label className="inspector-field">Move<select aria-label={`${label} mode`} value={entry.mode} onChange={event => update(index, { mode: event.target.value as MoveTargetSpec['mode'] })}>{MOVE_MODES.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
          <MotionExpressionEditor label={`${label} X`} value={entry.x} choices={choices} onChange={x => update(index, { x })}/>
          <MotionExpressionEditor label={`${label} Y`} value={entry.y} choices={choices} onChange={y => update(index, { y })}/>
          <label className="inspector-field">Path<select aria-label={`${label} path`} disabled={entry.easing === 'none'} value={entry.trajectory} onChange={event => update(index, { trajectory: event.target.value as MoveTargetSpec['trajectory'] })}>{MOVE_TRAJECTORIES.map(path => <option key={path} value={path}>{({ straight: 'Straight', arcClockwise: 'Arc clockwise', arcAntiClockwise: 'Arc counterclockwise' })[path]}</option>)}</select></label>
          <BoundaryEditor label={`${label} boundary`} value={entry.boundary} choices={choices} onChange={boundary => update(index, { boundary })}/>
        </> : <>
          <MotionExpressionEditor label={`${label} width`} value={entry.width} choices={choices} onChange={width => update(index, { width })}/>
          <MotionExpressionEditor label={`${label} height`} value={entry.height} choices={choices} onChange={height => update(index, { height })}/>
          <label className="inspector-field">Anchor<select aria-label={`${label} anchor`} value={entry.anchor} onChange={event => update(index, { anchor: event.target.value as ResizeTargetSpec['anchor'] })}>{ROTATION_ANCHORS.map(anchor => <option key={anchor} value={anchor}>{title(anchor)}</option>)}</select></label>
        </>}
        <div className="inspector-grid">
          <label className="inspector-field">Animate<select aria-label={`${label} animation`} value={entry.easing} onChange={event => update(index, { easing: event.target.value as MoveTargetSpec['easing'] })}>{ROTATION_EASINGS.map(easing => <option key={easing} value={easing}>{easingLabel(easing)}</option>)}</select></label>
          <label className="inspector-field">Duration (ms)<input aria-label={`${label} duration`} type="number" min={0} max={60000} step="any" disabled={entry.easing === 'none'} value={entry.duration} onChange={event => { const duration = Number(event.target.value); if (Number.isFinite(duration) && duration >= 0 && duration <= 60000) update(index, { duration }); }}/></label>
        </div>
      </fieldset>;
    })}
    <button type="button" className="inspector-add-inline" disabled={entries.length >= 200} onClick={() => onChange({ targets: [...entries, kind === 'move' ? defaultMoveTarget() : defaultResizeTarget()] } as MoveActionSpec | ResizeActionSpec)}><Plus size={12}/>Add target</button>
    <p className="inspector-help">Leave a coordinate or size empty to keep it unchanged. Local widget names apply to their own expression.</p>
  </fieldset>;
}
