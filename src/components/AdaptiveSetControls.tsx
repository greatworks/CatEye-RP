import { useState } from 'react';
import type { Document, Page } from '../model/types';
import { assignAdaptiveViewSet, convertPageAdaptiveViewsToSet, createAdaptiveViewSet, removeAdaptiveViewSet, updateAdaptiveViewSet } from '../model/adaptive-view-sets';
import { useDialogs } from './Dialogs';

export function AdaptiveSetControls({ document, page, onChange, onAssign }: {
  document: Document; page: Page; onChange: (document: Document) => void; onAssign: () => void;
}) {
  const { prompt } = useDialogs();
  const [error, setError] = useState('');
  const sets = document.adaptiveViewSets ?? [];
  function apply(change: () => Document, assigned = false) {
    try { onChange(change()); setError(''); if (assigned) onAssign(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  async function create(share: boolean) {
    const name = await prompt('Adaptive view set name', share ? `${page.name} views` : `View set ${sets.length + 1}`);
    if (name === null) return;
    apply(() => {
      if (share) return convertPageAdaptiveViewsToSet(document, page.id, name);
      const next = createAdaptiveViewSet(document, name);
      return assignAdaptiveViewSet(next, page.id, next.adaptiveViewSets!.at(-1)!.id);
    }, true);
  }
  return <div className="adaptive-set-controls" role="group" aria-label="Adaptive view sets">
    <label>View set<select aria-label="Adaptive view set" value={page.adaptiveViewSetId ?? ''} onChange={event => apply(() => assignAdaptiveViewSet(document, page.id, event.target.value || null), true)}>
      <option value="">{page.adaptiveViewSetId ? 'Base only' : page.adaptiveViews.length ? 'Page views (local)' : 'Base only'}</option>
      {sets.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}
    </select></label>
    <button type="button" onClick={() => create(false)}>New view set</button>
    {!page.adaptiveViewSetId && page.adaptiveViews.length > 0 && page.adaptiveSelection === 'native-size' && <button type="button" onClick={() => create(true)}>Share page views</button>}
    {page.adaptiveViewSetId && <span>{document.pages.filter(item => item.adaptiveViewSetId === page.adaptiveViewSetId).length} page(s) share sizes · widget styles stay on each page</span>}
    {sets.length > 0 && <details className="adaptive-set-manager"><summary>Manage view sets</summary><div>
      {sets.map(set => {
        const users = document.pages.filter(item => item.adaptiveViewSetId === set.id);
        return <div key={set.id}><strong>{set.name}</strong><span>{users.length} page(s)</span>
          <button type="button" aria-label={`Rename view set ${set.name}`} onClick={async () => { const name = await prompt('Adaptive view set name', set.name); if (name !== null) apply(() => updateAdaptiveViewSet(document, set.id, { name })); }}>Rename</button>
          <button type="button" aria-label={`Delete view set ${set.name}`} disabled={users.length > 0} title={users.length ? 'Assign these pages to another set or Base before deleting' : 'Delete unused view set'} onClick={() => apply(() => removeAdaptiveViewSet(document, set.id))}>Delete</button>
        </div>;
      })}
    </div></details>}
    {error && <span className="adaptive-error" role="alert">{error}</span>}
  </div>;
}
