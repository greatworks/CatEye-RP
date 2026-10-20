import { createElement, useEffect, useId, useState } from 'react';
import type { GradientFill, GradientPoint, WidgetStyle } from '../model/types';
import { parseWidgetStylePatch } from '../model/document';
import { createGradientRenderer } from '../model/gradient';
import { isShadowColor } from '../model/shadow-color';
import './FillEditor.css';

type Fill = Pick<WidgetStyle, 'fill' | 'fillGradient'> & Partial<Pick<WidgetStyle, 'color'>>;
type FillPatch = Partial<Pick<WidgetStyle, 'fill' | 'fillGradient'>>;
type Stroke = Pick<WidgetStyle, 'stroke' | 'strokeGradient'> & Partial<Pick<WidgetStyle, 'color'>>;
type StrokePatch = Partial<Pick<WidgetStyle, 'stroke' | 'strokeGradient'>>;
type PaintChannel = 'fill' | 'stroke';
type Paint = { solid: string; gradient?: GradientFill; color?: string };
type PaintPatch = Partial<Pick<Paint, 'solid' | 'gradient'>>;
type Draft = { type: GradientFill['type']; points: Record<string, { x: string; y: string }>; stops: { offset: string; color: string }[] };
const renderer = createGradientRenderer();
const pointNames = (type: GradientFill['type']) => type === 'linear' ? ['start', 'end'] : ['center', 'axis1', 'axis2'];
const pointLabel = (name: string) => ({ start: 'Start', end: 'End', center: 'Center', axis1: 'Axis 1', axis2: 'Axis 2' })[name];

/** Explicit fill is a solid command, even when its fallback color is unchanged. */
export function replaceFillProperties(style: Partial<WidgetStyle>, patch: FillPatch): Partial<WidgetStyle> {
  return replacePaintProperties(style, patch, 'fill');
}
export function inheritFillProperties(style: Partial<WidgetStyle>): Partial<WidgetStyle> {
  return inheritPaintProperties(style, 'fill');
}
export function replaceStrokeProperties(style: Partial<WidgetStyle>, patch: StrokePatch): Partial<WidgetStyle> { return replacePaintProperties(style, patch, 'stroke'); }
export function inheritStrokeProperties(style: Partial<WidgetStyle>): Partial<WidgetStyle> { return inheritPaintProperties(style, 'stroke'); }
function replacePaintProperties(style: Partial<WidgetStyle>, patch: Partial<WidgetStyle>, channel: PaintChannel): Partial<WidgetStyle> {
  const next = { ...style, ...patch }, gradientKey = channel === 'fill' ? 'fillGradient' : 'strokeGradient';
  if (Object.hasOwn(patch, channel) && !Object.hasOwn(patch, gradientKey)) delete next[gradientKey];
  return next;
}
function inheritPaintProperties(style: Partial<WidgetStyle>, channel: PaintChannel): Partial<WidgetStyle> {
  const next = { ...style }; delete next[channel]; delete next[channel === 'fill' ? 'fillGradient' : 'strokeGradient']; return next;
}
/** Neutral author defaults, not a claim about native author gestures or presets. */
export function newFillGradient(type: GradientFill['type'], color: string): GradientFill {
  const stops = [{ offset: 0, color }, { offset: 1, color: '#ffffff' }];
  return type === 'linear' ? { type, start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops }
    : { type, center: { x: .5, y: .5 }, axis1: { x: 1, y: .5 }, axis2: { x: .5, y: 1 }, stops };
}
export function gradientDraft(value: GradientFill): Draft {
  return { type: value.type, points: Object.fromEntries(pointNames(value.type).map(key => { const p = (value as unknown as Record<string, GradientPoint>)[key]; return [key, { x: String(p.x), y: String(p.y) }]; })), stops: value.stops.map(stop => ({ offset: String(stop.offset), color: stop.color })) };
}
export function parseGradientDraft(draft: Draft): GradientFill {
  const number = (value: string) => { if (!value.trim() || !Number.isFinite(Number(value))) throw new Error('Enter finite coordinates and stop offsets.'); return Number(value); };
  const value = { type: draft.type, ...Object.fromEntries(pointNames(draft.type).map(key => [key, { x: number(draft.points[key].x), y: number(draft.points[key].y) }])), stops: draft.stops.map(stop => ({ offset: number(stop.offset), color: stop.color })) };
  return parseWidgetStylePatch({ fillGradient: value }).fillGradient!;
}
/** Move a color stop into a new ordered position; equal-offset order is retained. */
export function moveGradientStop(draft: Draft, index: number, direction: -1 | 1): Draft {
  const other = index + direction;
  if (other < 0 || other >= draft.stops.length) return draft;
  const stops = draft.stops.map(stop => ({ ...stop }));
  // Offsets belong to the ordered slots. The moved colors exchange positions.
  [stops[index].color, stops[other].color] = [stops[other].color, stops[index].color];
  return { ...draft, stops };
}

function GradientPreview({ gradient, label, color, channel = 'fill' }: { gradient?: GradientFill; label: string; color?: string; channel?: PaintChannel }) {
  const id = 'fill-preview-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!gradient) return <div className="fill-preview fill-preview-invalid">Complete the gradient to preview it.</div>;
  const definition = renderer.svg(gradient, 240, 90, id);
  const paint = definition.empty ? 'none' : `url(#${id})`;
  return <svg className="fill-preview" viewBox="0 0 240 90" style={{color}} aria-label={`${label} gradient preview`} role="img"><defs>{createElement(definition.tag, definition.attrs, gradient.stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color}/>))}</defs>{channel==='stroke'?<rect x="6" y="6" width="228" height="78" fill="none" stroke={paint} strokeWidth="12"/>:<rect width="240" height="90" fill={paint}/>}</svg>;
}

function SolidColor({ label, value, onChange, noun }: { label: string; value: string; onChange: (value: string) => void; noun: string }) {
  const [draft, setDraft] = useState(value), [error, setError] = useState(false);
  useEffect(() => { setDraft(value); setError(false); }, [value]);
  const commit = () => { if (draft === value) return; if (!isShadowColor(draft)) { setError(true); return; } setError(false); onChange(draft); };
  const change = (next: string) => { setDraft(next); setError(false); if (next !== value && isShadowColor(next)) onChange(next); };
  return <><label className="inspector-color"><span>{label}</span><span className="inspector-swatch" style={{ background: value }}/><input aria-label={label} value={draft} aria-invalid={error} onChange={event => change(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value); setError(false); event.stopPropagation(); } }} spellCheck={false}/></label>{error && <p role="alert" className="inspector-error">Enter a valid {noun.toLowerCase()} color.</p>}</>;
}

function GradientEditor({ label, value, color, channel, onApply, onCancel }: { label: string; value: GradientFill; color?: string; channel: PaintChannel; onApply: (value: GradientFill) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => gradientDraft(value)), [showError, setShowError] = useState(false);
  let parsed: GradientFill | undefined, error = '';
  try { parsed = parseGradientDraft(draft); } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  const update = (next: Draft) => { setDraft(next); setShowError(false); };
  return <div role="group" aria-label={`${label} gradient editor`} className="fill-gradient-editor" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onCancel(); } }}>
    <GradientPreview gradient={parsed} label={label} color={color} channel={channel}/>
    <p className="inspector-help">Coordinates use widget bounds: 0 is the left/top, 1 is the right/bottom. Points outside the bounds are preserved.</p>
    <div className="fill-points">{pointNames(draft.type).map(key => <div key={key}><span>{pointLabel(key)}</span>{(['x', 'y'] as const).map(axis => <label key={axis}>{axis.toUpperCase()}<input type="number" step="0.01" min="-1000" max="1000" aria-label={`${label} ${pointLabel(key)} ${axis.toUpperCase()}`} value={draft.points[key][axis]} onChange={event => update({ ...draft, points: { ...draft.points, [key]: { ...draft.points[key], [axis]: event.target.value } } })}/></label>)}</div>)}</div>
    <p className="inspector-help">Stop offsets run from 0 to 1 in ascending order. Equal offsets create a sharp transition; arrow buttons move colors between positions.</p>
    <div className="fill-stops">{draft.stops.map((stop, index) => <div className="fill-stop" key={index} role="group" aria-label={`${label} Stop ${index + 1}`}>
      <label>Position<input aria-label={`${label} Stop ${index + 1} offset`} type="number" min="0" max="1" step="0.01" value={stop.offset} onChange={event => update({ ...draft, stops: draft.stops.map((item, i) => i === index ? { ...item, offset: event.target.value } : item) })}/></label>
      <label>Color<input aria-label={`${label} Stop ${index + 1} color`} spellCheck={false} value={stop.color} onChange={event => update({ ...draft, stops: draft.stops.map((item, i) => i === index ? { ...item, color: event.target.value } : item) })}/></label>
      <div className="fill-stop-actions"><button type="button" aria-label={`Move ${label} stop ${index + 1} earlier`} disabled={index === 0} onClick={() => update(moveGradientStop(draft, index, -1))}>↑</button><button type="button" aria-label={`Move ${label} stop ${index + 1} later`} disabled={index === draft.stops.length - 1} onClick={() => update(moveGradientStop(draft, index, 1))}>↓</button><button type="button" aria-label={`Delete ${label} stop ${index + 1}`} disabled={draft.stops.length <= 2} onClick={() => update({ ...draft, stops: draft.stops.filter((_, i) => i !== index) })}>×</button></div>
    </div>)}</div>
    <button type="button" className="inspector-small-button" disabled={draft.stops.length >= 100} onClick={() => update({ ...draft, stops: [...draft.stops, { ...draft.stops[draft.stops.length - 1] }] })}>Add {label} stop</button>
    {showError && error && <p role="alert" className="inspector-error">{error}</p>}
    <div className="fill-editor-actions"><button type="button" onClick={onCancel}>Cancel {label} gradient</button><button type="button" onClick={() => { if (parsed) onApply(parsed); else setShowError(true); }}>Apply {label} gradient</button></div>
  </div>;
}

function PaintEditor({ label, value, onChange, widgetType, channel }: { label: string; value: Paint; onChange: (patch: PaintPatch) => void; widgetType?: string; channel: PaintChannel }) {
  const [editing, setEditing] = useState<GradientFill | null>(null);
  const supported = !widgetType || (channel === 'fill' ? renderer.supports(widgetType) : renderer.supportsStroke(widgetType));
  const type = editing?.type ?? value.gradient?.type ?? 'solid';
  const noun = channel === 'fill' ? 'Fill' : 'Border';
  return <div className="fill-editor">
    <label className="inspector-field">{noun} type<select aria-label={`${label} type`} value={type} disabled={editing!==null} onChange={event => {
      if (event.target.value === 'solid') { setEditing(null); if (value.gradient) onChange({ solid: value.solid }); }
      else { const kind = event.target.value as GradientFill['type'], fresh = newFillGradient(kind, value.solid); setEditing(structuredClone(value.gradient?.type === kind ? value.gradient : { ...fresh, stops: value.gradient?.stops ?? fresh.stops })); }
    }}><option value="solid">Solid</option><option value="linear" disabled={!supported}>Linear gradient</option><option value="radial" disabled={!supported}>Radial gradient</option></select></label>
    {type === 'solid' && <SolidColor label={label} value={value.solid} noun={noun} onChange={solid=>onChange({solid})}/>}
    {channel==='stroke' && widgetType==='image' && type!=='solid' && <p className="inspector-help">Image borders use only the first stop of a linear gradient. Radial image borders are transparent.</p>}
    {!editing && value.gradient && <><GradientPreview gradient={value.gradient} label={label} color={value.color} channel={channel}/><button type="button" disabled={!supported} className="inspector-small-button" onClick={() => setEditing(structuredClone(value.gradient!))}>Edit {label} gradient</button></>}
    {!supported && value.gradient && <p className="inspector-help">This widget does not display gradient {channel==='fill'?'fills':'borders'}. Its saved gradient is retained.</p>}
    {editing && <GradientEditor key={editing.type} label={label} value={editing} color={value.color} channel={channel} onCancel={() => setEditing(null)} onApply={gradient => { setEditing(null); if (JSON.stringify(gradient) !== JSON.stringify(value.gradient)) onChange({ gradient }); }}/>} 
  </div>;
}

const channelPatch = (patch: PaintPatch, channel: PaintChannel): Partial<WidgetStyle> => ({ ...(Object.hasOwn(patch,'solid') ? { [channel]: patch.solid } : {}), ...(Object.hasOwn(patch,'gradient') ? { [channel==='fill'?'fillGradient':'strokeGradient']: patch.gradient } : {}) });

export function FillEditor({ label = 'Fill', value, onChange, widgetType }: { label?: string; value: Fill; onChange: (patch: FillPatch) => void; widgetType?: string }) {
  return <PaintEditor label={label} channel="fill" value={{solid:value.fill,gradient:value.fillGradient,color:value.color}} widgetType={widgetType} onChange={patch=>onChange(channelPatch(patch,'fill'))}/>;
}
export function StrokeEditor({ label = 'Border', value, onChange, widgetType }: { label?: string; value: Stroke; onChange: (patch: StrokePatch) => void; widgetType?: string }) {
  return <PaintEditor label={label} channel="stroke" value={{solid:value.stroke,gradient:value.strokeGradient,color:value.color}} widgetType={widgetType} onChange={patch=>onChange(channelPatch(patch,'stroke'))}/>;
}

type OverrideProps<T> = { label: string; patch: Partial<WidgetStyle>; base: T; onChange: (patch: Partial<WidgetStyle>) => void; showInherited?: boolean; widgetType?: string };
function PaintOverrideEditor({ label, patch, base, onChange, showInherited = false, widgetType, channel }: OverrideProps<Paint> & {channel:PaintChannel}) {
  const gradientKey = channel === 'fill' ? 'fillGradient' : 'strokeGradient';
  const present = Object.hasOwn(patch, channel) || Object.hasOwn(patch, gradientKey);
  const value: Paint = { solid: patch[channel] ?? base.solid, color: patch.color ?? base.color, gradient: Object.hasOwn(patch, gradientKey) ? patch[gradientKey] : Object.hasOwn(patch, channel) ? undefined : base.gradient };
  return <div className="fill-override"><label className="inspector-check"><input type="checkbox" aria-label={`Override ${label}`} checked={present} onChange={event => onChange(event.target.checked ? { ...patch, ...(base.gradient ? { [gradientKey]: structuredClone(base.gradient) } : { [channel]: base.solid }) } : inheritPaintProperties(patch,channel))}/>{channel==='fill'?'Fill':'Border'}</label>{(present || showInherited) && <PaintEditor label={label} value={value} channel={channel} widgetType={widgetType} onChange={value => onChange(replacePaintProperties(patch, channelPatch(value,channel),channel))}/>}</div>;
}
export function FillOverrideEditor(props: OverrideProps<Fill>) {
  return <PaintOverrideEditor {...props} channel="fill" base={{solid:props.base.fill,gradient:props.base.fillGradient,color:props.base.color}}/>;
}
export function StrokeOverrideEditor(props: OverrideProps<Stroke>) {
  return <PaintOverrideEditor {...props} channel="stroke" base={{solid:props.base.stroke,gradient:props.base.strokeGradient,color:props.base.color}}/>;
}
