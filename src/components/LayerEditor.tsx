import { Group, Square } from 'lucide-react';
import type { Widget } from '../model/types';

/** The outline keeps genuine ownership visible even before entering a group. */
export function LayerOutlineEntries({ layer, onSelect }: { layer: Widget; onSelect: (parent: Widget, child: Widget) => void }) {
  return <div className="layer-outline-entries">
    {layer.layer?.widgets.slice().reverse().map(child => <div key={child.id}>
      <button className="tree-row" data-outline-layer-member-id={child.id} data-placed={child.placed !== false}
        aria-label={`Select group member ${child.name}`} onClick={() => onSelect(layer, child)}>
        {child.layer ? <Group size={13}/> : <Square size={13}/>}
        <span>{child.name}{child.placed === false ? ' · Unplaced' : ''}</span>
      </button>
      {child.layer && <LayerOutlineEntries layer={child} onSelect={onSelect}/>}
    </div>)}
  </div>;
}
