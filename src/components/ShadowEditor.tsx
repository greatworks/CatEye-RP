import { useEffect, useState } from 'react';
import type { InnerShadowStyle, ShadowStyle, WidgetStyle, Widget } from '../model/types';
import { parseWidgetStylePatch } from '../model/document';
import './ShadowEditor.css';

export const SHADOW_FIELDS = [['outerShadow', 'Outer shadow'], ['innerShadow', 'Inner shadow'], ['textShadow', 'Text shadow']] as const;
export type ShadowField = typeof SHADOW_FIELDS[number][0];
type Shadow = ShadowStyle | InnerShadowStyle;

/** Match actual render surfaces; unsupported stored properties are never discarded. */
export function shadowFieldsFor(widget?: Pick<Widget, 'type'>): readonly ShadowField[] {
  if (!widget || widget.type === 'inlineFrame' || widget.type === 'hotspot') return [];
  if (widget.type === 'image' || widget.type === 'line' || widget.type === 'panel') return ['outerShadow'];
  if (['repeater', 'table', 'menu', 'tree', 'treeNode'].includes(widget.type)) return ['outerShadow', 'innerShadow'];
  return SHADOW_FIELDS.map(([field]) => field);
}

export function RetainedShadows({ style, fields, readOnly = false }: { style: Partial<WidgetStyle>; fields: readonly ShadowField[]; readOnly?: boolean }) {
  const retained = SHADOW_FIELDS.filter(([field]) => !fields.includes(field) && style[field] !== undefined);
  return retained.length ? <div className="inspector-help"><p>{readOnly ? 'Container shadow settings are read-only here. Edit individual cells or node labels.' : `${retained.map(([, name])=>name).join(', ')} ${retained.length === 1 ? 'is' : 'are'} not displayed on this widget.`} Existing settings are kept.</p>{retained.map(([field,name])=>{const value=style[field]!;return <p key={field}>{name}: {value.on?'On':'Off'}; X {value.offsetX}, Y {value.offsetY}, blur {value.blurRadius}, color {value.color}{'spread' in value?`, spread ${value.spread}`:''}.</p>})}</div> : null;
}

/** Neutral authoring values, not a claimed native preset. No values are saved until edited. */
export function newShadow(field: ShadowField): Shadow {
  return { on: true, offsetX: 0, offsetY: 0, blurRadius: 0, color: '#000000', ...(field === 'innerShadow' ? { spread: 0 } : {}) };
}

function ShadowNumber({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) { setDraft(String(value)); return; }
    const next = Math.min(1000, Math.max(min, number)); setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const caption = label.endsWith('Offset X') ? 'Offset X' : label.endsWith('Offset Y') ? 'Offset Y' : label.split(' ').at(-1);
  return <label className="shadow-number"><span>{caption}</span><input aria-label={label} type="number" step="0.1" min={min} max={1000} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.stopPropagation(); } }}/></label>;
}

export function ShadowEditor({ field, label, value, onChange }: { field: ShadowField; label: string; value?: Shadow; onChange: (value: Shadow) => void }) {
  const current = value ?? newShadow(field);
  const [color, setColor] = useState(current.color), [error, setError] = useState('');
  useEffect(() => { setColor(current.color); setError(''); }, [current.color]);
  const update = (patch: Partial<InnerShadowStyle>) => onChange({ ...current, ...patch });
  const commitColor = () => {
    if (color === current.color) return;
    try { parseWidgetStylePatch({ [field]: { ...current, color } }); update({ color }); setError(''); }
    catch { setError('Enter a valid color, such as #00000080 or rgba(0, 0, 0, 0.5).'); }
  };
  return <div role="group" aria-label={label} className="shadow-editor">
    <label className="shadow-enabled"><input type="checkbox" aria-label={`${label} enabled`} checked={value?.on ?? false} onChange={event => update({ on: event.target.checked })}/>{label}</label>
    {value && <>
      <div className="shadow-numbers">
        <ShadowNumber label={`${label} Offset X`} value={value.offsetX} min={-1000} onChange={offsetX => update({ offsetX })}/>
        <ShadowNumber label={`${label} Offset Y`} value={value.offsetY} min={-1000} onChange={offsetY => update({ offsetY })}/>
        <ShadowNumber label={`${label} Blur`} value={value.blurRadius} min={0} onChange={blurRadius => update({ blurRadius })}/>
        {field === 'innerShadow' && <ShadowNumber label={`${label} Spread`} value={(value as InnerShadowStyle).spread} min={0} onChange={spread => update({ spread })}/>}
      </div>
      <label className="shadow-color"><span>Color</span><i style={{ background: current.color }}/><input aria-label={`${label} Color`} value={color} spellCheck={false} aria-invalid={!!error} onChange={event => { setColor(event.target.value); setError(''); }} onBlur={commitColor} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setColor(current.color); setError(''); event.stopPropagation(); } }}/></label>
      {error && <p role="alert" className="inspector-error">{error}</p>}
    </>}
  </div>;
}

/** Presence controls inheritance; on:false is a separate, persisted visual override. */
export function ShadowOverrides({ patch, base, prefix, fields = SHADOW_FIELDS.map(([field]) => field), onChange }: { patch: Partial<WidgetStyle>; base?: WidgetStyle; prefix: string; fields?: readonly ShadowField[]; onChange: (patch: Partial<WidgetStyle>) => void }) {
  return <div className="shadow-overrides">{SHADOW_FIELDS.filter(([field]) => fields.includes(field)).map(([field, name]) => {
    const label = `${prefix} ${name}`, present = Object.hasOwn(patch, field);
    return <div key={field}>
      <label className="shadow-enabled"><input type="checkbox" aria-label={`Override ${label}`} checked={present} onChange={event => {
        const next = { ...patch };
        if (event.target.checked) Object.assign(next, { [field]: structuredClone(base?.[field] ?? newShadow(field)) });
        else delete next[field];
        onChange(next);
      }}/>{name}</label>
      {present && <ShadowEditor field={field} label={label} value={patch[field]} onChange={value => onChange({ ...patch, [field]: value })}/>}
    </div>;
  })}<RetainedShadows style={patch} fields={fields}/></div>;
}
