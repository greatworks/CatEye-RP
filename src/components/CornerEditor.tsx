import { useEffect, useState } from 'react';
import type { Widget, WidgetStyle } from '../model/types';
import { mergeWidgetStyle } from '../model/document';
import { createLineStyleRenderer } from '../model/line-style';
import { editCornerOverride, type CornerStyleCommand } from './widget-style-command';
import './CornerEditor.css';

const renderer = createLineStyleRenderer();
const corners = ['top left', 'top right', 'bottom right', 'bottom left'] as const;
const label = (prefix: string, text: string) => prefix ? `${prefix} ${text.toLowerCase()}` : text;
export const supportsCornerEditing = (widget: Widget) => widget.type !== 'treeNode' && renderer.supportsCorners(widget);

function RadiusInput({ value, legacy, prefix, onCommand }: { value: number; legacy: boolean; prefix: string; onCommand: (command: CornerStyleCommand) => void }) {
  const [draft, setDraft] = useState(String(value)), [modified, setModified] = useState(false);
  useEffect(() => { setDraft(String(value)); setModified(false); }, [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number)) { setDraft(String(value)); setModified(false); return; }
    const next = Math.min(10000, Math.max(0, number));
    setDraft(String(next)); setModified(false);
    if (next !== value || legacy && modified) onCommand({ kind: 'radius', value: next });
  };
  return <label className="inspector-number"><span>Radius</span><input aria-label={label(prefix, 'Radius')} type="number" min={0} max={10000} step={0.1} value={draft} onChange={event => { setDraft(event.target.value); setModified(true); }} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); setModified(false); event.stopPropagation(); } }}/></label>;
}

function MaskEditor({ style, prefix, onCommand }: { style: WidgetStyle; prefix: string; onCommand: (command: CornerStyleCommand) => void }) {
  return <div className="corner-visibility" role="group" aria-label={label(prefix, 'Corner visibility')}><span>Rounded corners</span><div>{corners.map((corner, index) => <label key={corner}><input type="checkbox" aria-label={label(prefix, `Corner ${corner} rounded`)} checked={style.cornerVisibility?.[index] ?? true} onChange={event => onCommand({ kind: 'visibility', corner: index as 0 | 1 | 2 | 3, value: event.target.checked })}/>{corner[0].toUpperCase() + corner.slice(1)}</label>)}</div></div>;
}

/** Existing arbitrary paths remain untouched; only declared native rectangles opt in. */
export function CornerEditor({ widget, onCommand }: { widget: Widget; onCommand: (command: CornerStyleCommand) => void }) {
  if (!supportsCornerEditing(widget)) return null;
  return <div className="corner-editor"><RadiusInput value={widget.style.radius} legacy={Boolean(widget.style.cornerRadii)} prefix="" onCommand={onCommand}/><MaskEditor style={widget.style} prefix="" onCommand={onCommand}/>{widget.style.cornerVisibility && <button type="button" className="inspector-add-inline" onClick={() => onCommand({ kind: 'inherit', property: 'cornerVisibility' })}>Use default corner visibility</button>}{widget.style.cornerRadii && <p className="inspector-help">Legacy independent corners are retained. Radius restores a uniform value; corner visibility is independent.</p>}</div>;
}

export function CornerOverrides({ widget, patch, prefix, onChange }: { widget: Widget; patch: Partial<WidgetStyle>; prefix: string; onChange: (patch: Partial<WidgetStyle>, command: CornerStyleCommand) => void }) {
  if (!supportsCornerEditing(widget)) return null;
  const style = mergeWidgetStyle(widget.style, patch), update = (command: CornerStyleCommand) => onChange(editCornerOverride(widget.style, patch, command), command);
  return <div className="corner-overrides">{(['radius', 'cornerVisibility'] as const).map(property => {
    const title = property === 'radius' ? 'radius' : 'corner visibility', present = Object.hasOwn(patch, property);
    return <div key={property}><label className="inspector-check"><input type="checkbox" aria-label={`Override ${prefix} ${title}`} checked={present} onChange={event => update({ kind: event.target.checked ? 'override' : 'inherit', property })}/>{title[0].toUpperCase() + title.slice(1)}</label>{present && (property === 'radius' ? <RadiusInput value={style.radius} legacy={Boolean(style.cornerRadii)} prefix={prefix} onCommand={update}/> : <MaskEditor style={style} prefix={prefix} onCommand={update}/>)}</div>;
  })}</div>;
}
