import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { Page } from '../model/types';
import { adaptiveViewChain, clearAdaptiveOverrides, createAdaptiveView, deleteAdaptiveView, updateAdaptiveBaseSize, updateAdaptiveView } from '../model/adaptive';
import { useDialogs } from './Dialogs';
import './AdaptiveControls.css';

export interface AdaptiveControlsProps {
  page: Page;
  viewId: string | null;
  onSelectView: (viewId: string | null) => void;
  onChange: (page: Page) => void;
}

export function AdaptiveControls({ page, viewId, onSelectView, onChange }: AdaptiveControlsProps) {
  const { prompt } = useDialogs();
  const view = page.adaptiveViews.find(item => item.id === viewId);
  const native = page.adaptiveSelection === 'native-size';
  const declaredWidth = view?.width ?? page.adaptiveBaseSize?.width ?? 0;
  const declaredHeight = view?.height ?? (view ? 0 : page.adaptiveBaseSize?.height ?? 0);
  const [width, setWidth] = useState(String(declaredWidth));
  const [height, setHeight] = useState(String(declaredHeight));
  const [error, setError] = useState('');
  useEffect(() => { setWidth(String(declaredWidth)); setHeight(String(declaredHeight)); setError(''); }, [page.id, view?.id, native, declaredWidth, declaredHeight]);
  function attempt(change: () => void) {
    try { change(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  async function addView() {
    const defaults = [390, 768, 1024], nextWidth = defaults.find(candidate => !page.adaptiveViews.some(item => item.width === candidate)) ?? page.width;
    const name = await prompt('Adaptive view name', nextWidth === 390 ? 'Mobile' : nextWidth === 768 ? 'Tablet' : `View ${page.adaptiveViews.length + 1}`);
    if (name === null) return;
    attempt(() => { const next = createAdaptiveView(page, name, nextWidth, { baseViewId: view?.id }); onChange(next); onSelectView(next.adaptiveViews[next.adaptiveViews.length - 1].id); });
  }
  function commitSize(axis: 'width' | 'height') {
    const text = axis === 'width' ? width : height;
    const value = text.trim() ? Number(text) : NaN;
    if (value === (axis === 'width' ? declaredWidth : declaredHeight)) { setError(''); return; }
    attempt(() => onChange(view ? updateAdaptiveView(page, view.id, { [axis]: value }) : updateAdaptiveBaseSize(page, { [axis]: value })));
  }
  return <div className="adaptive-controls" role="group" aria-label="Adaptive views">
    <label className="adaptive-view-select">View
      <select aria-label="Adaptive view" value={view?.id ?? ''} onChange={event => { onSelectView(event.target.value || null); setError(''); }}>
        <option value="">Base{native ? ` · ${page.adaptiveBaseSize?.width ?? 0} × ${page.adaptiveBaseSize?.height ?? 0}` : ` · ${page.width}px`}</option>
        {page.adaptiveViews.map(item => <option key={item.id} value={item.id}>{item.name} · {native ? `${item.width} × ${item.height ?? 0}` : `≤ ${item.width}px`}</option>)}
      </select>
    </label>
    <button type="button" aria-label="Add adaptive view" title="Add adaptive view" onClick={addView}><Plus size={14}/></button>
    {(view || native) && <>
      <label className="adaptive-width">{native ? 'Width' : 'Max width'}
        <input aria-label={view ? native ? 'Adaptive view width' : 'Adaptive view max width' : 'Base view width'} type="number" min={native ? '0' : '1'} max="100000" value={width} onChange={event => setWidth(event.target.value)} onBlur={() => commitSize('width')} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/><span>px</span>
      </label>
      {native && <label>Height
        <input aria-label={view ? 'Adaptive view height' : 'Base view height'} type="number" min="0" max="100000" value={height} onChange={event => setHeight(event.target.value)} onBlur={() => commitSize('height')} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/><span>px</span>
      </label>}
    </>}
    {view && <>
      <label className="adaptive-parent">Inherit from
        <select aria-label="Inherit from" value={view.baseViewId ?? ''} onChange={event => attempt(() => onChange(updateAdaptiveView(page, view.id, { baseViewId: event.target.value || null })))}>
          <option value="">Base</option>
          {page.adaptiveViews.filter(item => !adaptiveViewChain(page, item.id).some(ancestor => ancestor.id === view.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <span className="adaptive-count" title="Widgets with local layout or style changes">{Object.keys(view.overrides).length} override{Object.keys(view.overrides).length === 1 ? '' : 's'}</span>
      <button type="button" aria-label="Reset adaptive overrides" title="Reset this view to its parent's layout and style" disabled={!Object.keys(view.overrides).length} onClick={() => attempt(() => onChange(clearAdaptiveOverrides(page, view.id)))}><RotateCcw size={14}/></button>
      <button type="button" aria-label="Delete adaptive view" title="Delete this adaptive view" onClick={() => attempt(() => { onChange(deleteAdaptiveView(page, view.id)); onSelectView(null); })}><Trash2 size={14}/></button>
    </>}
    {!native && <button className="adaptive-convert" type="button" aria-label="Use view size rules" title="Change automatic selection to view sizes: the largest width up to the viewport wins; height resolves equal widths. Undo restores max-width rules." onClick={() => onChange({ ...page, adaptiveSelection: 'native-size', adaptiveBaseSize: { width: 0, height: 0 } })}>Use view sizes</button>}
    <span className="adaptive-help" title={native ? 'Automatic selection uses width first, then height for equal widths. Base has its own size. A zero-sized canvas axis uses the page dimensions. Children inherit layout and style from their parent.' : 'This project uses its original max-width rules. Children inherit layout and style from their parent.'}>{view ? 'Local changes · content shared' : native ? 'Base size · content shared' : 'Legacy max-width rules'}</span>
    {error && <span className="adaptive-error" role="alert">{error}</span>}
  </div>;
}
