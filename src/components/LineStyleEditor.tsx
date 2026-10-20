import { ARROW_STYLES, LINE_PATTERNS, type ArrowStyle, type LineEnds, type Widget, type WidgetStyle } from '../model/types';
import { createLineStyleRenderer } from '../model/line-style';
import './LineStyleEditor.css';

export const LINE_STYLE_FIELDS = ['linePattern', 'lineEnds', 'borderVisibility'] as const;
export type LineStyleField = typeof LINE_STYLE_FIELDS[number];
type Geometry = Pick<Widget, 'type' | 'vectorPath'> & Partial<Pick<Widget, 'width' | 'height'>>;
const renderer = createLineStyleRenderer();
const names: Record<LineStyleField, string> = { linePattern: 'line pattern', lineEnds: 'line ends', borderVisibility: 'border visibility' };
const title = (name: string) => name.split('-').map(word => word === 't' ? 'T' : word[0].toUpperCase() + word.slice(1)).join(' ');
const label = (prefix: string, name: string) => prefix ? `${prefix} ${name.toLowerCase()}` : name;

/** Capability gates are deliberately separate from the stored style carrier. */
export function lineStyleFieldsFor(widget: Geometry): LineStyleField[] {
  const fields: LineStyleField[] = [];
  if (renderer.supportsPattern(widget.type)) fields.push('linePattern');
  if (renderer.supportsEnds(widget)) fields.push('lineEnds');
  if (renderer.supportsSides(widget)) fields.push('borderVisibility');
  return fields;
}

/** A mixed selection applies only the channels supported by each target's geometry. */
export function filterLineStylePatch(widget: Geometry, patch: Partial<WidgetStyle>): Partial<WidgetStyle> {
  const supported = lineStyleFieldsFor(widget), next = { ...patch };
  for (const key of LINE_STYLE_FIELDS) if (!supported.includes(key)) delete next[key];
  return next;
}

export function changeLineEnd(value: LineEnds | undefined, end: 'start' | 'end', arrow: ArrowStyle): LineEnds {
  return { start: value?.start ?? 'none', end: value?.end ?? 'none', [end]: arrow };
}
export function changeBorderVisibility(value: WidgetStyle['borderVisibility'], side: number, visible: boolean): NonNullable<WidgetStyle['borderVisibility']> {
  const next: NonNullable<WidgetStyle['borderVisibility']> = [...value ?? [true, true, true, true]];
  next[side] = visible;
  return next;
}
export function inheritLineStyleProperty(patch: Partial<WidgetStyle>, field: LineStyleField): Partial<WidgetStyle> {
  const next = { ...patch }; delete next[field]; return next;
}
function defaultValue(field: LineStyleField): WidgetStyle[LineStyleField] {
  return field === 'linePattern' ? 'solid' : field === 'lineEnds' ? { start: 'none', end: 'none' } : [true, true, true, true];
}

function PropertyEditor({ field, style, prefix, defaults, onChange }: { field: LineStyleField; style: Partial<WidgetStyle>; prefix: string; defaults: boolean; onChange: (patch: Partial<WidgetStyle>) => void }) {
  if (field === 'linePattern') return <label className="line-style-field"><span>Line pattern</span><select aria-label={label(prefix, 'Line pattern')} value={style.linePattern ?? (defaults ? '' : 'solid')} onChange={event => onChange({ linePattern: (event.target.value || undefined) as WidgetStyle['linePattern'] })}>
    {defaults && <option value="">Default (solid)</option>}{LINE_PATTERNS.map(value => <option key={value} value={value}>{title(value)}</option>)}
  </select></label>;
  if (field === 'lineEnds') return <div className="line-style-ends">{(['start', 'end'] as const).map(end => <label key={end} className="line-style-field"><span>{title(end)} arrow</span><select aria-label={label(prefix, `${title(end)} arrow`)} value={style.lineEnds?.[end] ?? 'none'} onChange={event => onChange({ lineEnds: changeLineEnd(style.lineEnds, end, event.target.value as ArrowStyle) })}>{ARROW_STYLES.map(value => <option key={value} value={value}>{title(value)}</option>)}</select></label>)}{defaults && style.lineEnds && <button type="button" className="line-style-reset" onClick={() => onChange({ lineEnds: undefined })}>Use default line ends</button>}</div>;
  return <div className="line-style-sides" role="group" aria-label={label(prefix, 'Border visibility')}><span>Visible borders</span><div>{(['top', 'right', 'bottom', 'left'] as const).map((side, index) => <label key={side}><input type="checkbox" aria-label={label(prefix, `Border ${side} visible`)} checked={style.borderVisibility?.[index] ?? true} onChange={event => onChange({ borderVisibility: changeBorderVisibility(style.borderVisibility, index, event.target.checked) })}/>{title(side)}</label>)}</div>{defaults && style.borderVisibility && <button type="button" className="line-style-reset" onClick={() => onChange({ borderVisibility: undefined })}>Use default border visibility</button>}</div>;
}

function RetainedLineStyle({ widget, style }: { widget: Geometry; style: Partial<WidgetStyle> }) {
  const supported = lineStyleFieldsFor(widget), retained = LINE_STYLE_FIELDS.filter(field => !supported.includes(field) && style[field] !== undefined);
  return retained.length ? <p className="inspector-help">Saved {retained.map(field => names[field]).join(', ')} settings are kept. They do not apply to this geometry.</p> : null;
}

export function LineStyleEditor({ widget, style, prefix = '', onChange }: { widget: Geometry; style: Partial<WidgetStyle>; prefix?: string; onChange: (patch: Partial<WidgetStyle>) => void }) {
  return <div className="line-style-editor">{lineStyleFieldsFor(widget).map(field => <PropertyEditor key={field} field={field} style={style} prefix={prefix} defaults onChange={onChange}/>)}<RetainedLineStyle widget={widget} style={style}/></div>;
}

/** Presence is inheritance; solid/none/all-visible are separate explicit resets. */
export function LineStyleOverrides({ widget, patch, base, prefix, onChange }: { widget: Geometry; patch: Partial<WidgetStyle>; base: WidgetStyle; prefix: string; onChange: (patch: Partial<WidgetStyle>) => void }) {
  return <div className="line-style-editor">{lineStyleFieldsFor(widget).map(field => {
    const present = Object.hasOwn(patch, field);
    return <div key={field} className="line-style-override"><label className="inspector-check"><input type="checkbox" aria-label={`Override ${prefix} ${names[field]}`} checked={present} onChange={event => onChange(event.target.checked ? { ...patch, [field]: structuredClone(base[field] ?? defaultValue(field)) } : inheritLineStyleProperty(patch, field))}/>{title(names[field])}</label>{present && <PropertyEditor field={field} style={patch} prefix={prefix} defaults={false} onChange={value => onChange({ ...patch, ...value })}/>}</div>;
  })}<RetainedLineStyle widget={widget} style={patch}/></div>;
}

export function LineStyleToolbar({ widget, onChange }: { widget: Widget; onChange: (patch: Partial<WidgetStyle>) => void }) {
  return <details className="line-style-toolbar" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary aria-label="Line style">Line style</summary><div className="line-style-popover" role="group" aria-label="Toolbar line style"><LineStyleEditor widget={widget} style={widget.style} prefix="Toolbar" onChange={onChange}/></div></details>;
}
