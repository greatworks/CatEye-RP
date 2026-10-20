import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Widget, TreeData } from '../model/types';
import { findTreeNode, treeNodeLocation } from '../model/tree-widget';
import './TreeEditor.css';

/** Editor focus is independent from saved/runtime selection of the node's label. */
export interface TreeSelection { rootTreeId: string; nodeId?: string; part: 'node' | 'label' }
export type TreeOperation = { kind: 'child' | 'before' | 'after' | 'delete' | 'up' | 'down' | 'indent' | 'outdent'; nodeId: string };
export interface TreeInspectorContext {
  tree: Widget; selection: TreeSelection | null;
  onSelect: (nodeId?: string, part?: 'node' | 'label') => void;
  onOperation: (operation: TreeOperation) => void;
  onProperties: (patch: Partial<Omit<TreeData, 'nodes'>>) => void;
  onExpanded: (nodeId: string, expanded: boolean) => void;
}

/** IDs only: revealing an Outline target must not mutate saved expanded flags. */
export function treeAncestors(root: Widget, targetId: string): string[] | undefined {
  function visit(nodes: Widget[], path: string[]): string[] | undefined {
    for (const node of nodes) {
      const next = [...path, node.id];
      if (node.id === targetId || node.treeNode?.label.id === targetId) return next;
      const found = visit(node.treeNode?.children ?? [], next); if (found) return found;
    }
    return undefined;
  }
  return root.id === targetId ? [] : visit(root.tree?.nodes ?? [], []);
}
export function visibleTreeNodes(root: Widget, revealed: readonly string[] = []): Widget[] {
  const list: Widget[] = [];
  function visit(nodes: Widget[]) { for (const node of nodes) { list.push(node); if (node.treeNode?.expanded || revealed.includes(node.id)) visit(node.treeNode?.children ?? []); } }
  visit(root.tree?.nodes ?? []); return list;
}

function IndentField({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() { const next = Number(draft); if (draft.trim() && Number.isFinite(next) && next >= 0 && next <= 100000) onChange(next); else setDraft(String(value)); }
  return <label>Indent<input aria-label="Tree indent" type="number" min={0} max={100000} disabled={disabled} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>;
}

export function TreeStructureControls({ tree, selection, onSelect, onOperation, onProperties, onExpanded }: TreeInspectorContext) {
  const data = tree.tree!, location = selection?.nodeId && findTreeNode(tree,selection.nodeId) ? treeNodeLocation(tree, selection.nodeId) : undefined, node = location?.node;
  const locked = tree.locked || Boolean(node?.locked), isLast = Boolean(node && !location?.parentId && data.nodes.length === 1);
  return <section className="tree-structure-controls" aria-label="Tree structure">
    <strong>Tree · {visibleTreeNodes(tree, allTreeIds(tree)).length} nodes</strong>
    {node && <div className="tree-operation-grid"><button onClick={() => onSelect()}>Select whole tree</button><button onClick={() => onSelect(node.id, selection?.part === 'label' ? 'node' : 'label')}>{selection?.part === 'label' ? 'Select node' : 'Edit node label'}</button></div>}
    <IndentField value={data.indent} disabled={tree.locked} onChange={indent => onProperties({ indent })}/>
    <label className="tree-check"><input type="checkbox" aria-label="Show expand icons" disabled={tree.locked} checked={data.showExpandIcons} onChange={event => onProperties({ showExpandIcons: event.target.checked })}/>Show expand icons</label>
    <label>Expand icon style<select aria-label="Tree expand icon style" disabled={tree.locked} value={data.iconStyle} onChange={event => onProperties({ iconStyle: event.target.value as TreeData['iconStyle'] })}><option value="triangle">Triangle</option><option value="plusMinus">Plus / minus</option></select></label>
    <label className="tree-check"><input type="checkbox" aria-label="Show node icons" disabled={tree.locked} checked={data.showIcons} onChange={event => onProperties({ showIcons: event.target.checked })}/>Show node icons</label>
    {data.showIcons && <p>Only nodes with stored icons show an image. Custom icon import is not available in this editor yet.</p>}
    {node && <label className="tree-check"><input type="checkbox" aria-label="Node expanded initially" disabled={locked} checked={node.treeNode!.expanded} onChange={event => onExpanded(node.id, event.target.checked)}/>Expanded initially</label>}
    <div className="tree-operation-grid">
      {([['child', 'Add child node'], ['before', 'Add sibling before'], ['after', 'Add sibling after'], ['delete', 'Delete tree node'], ['up', 'Move node up'], ['down', 'Move node down'], ['indent', 'Indent node'], ['outdent', 'Outdent node']] as const).map(([kind, label]) => <button key={kind} disabled={locked || !node || kind === 'delete' && isLast || (kind === 'up' || kind === 'indent') && location?.index === 0 || kind === 'down' && location?.index === location.siblings.length - 1 || kind === 'outdent' && !location?.parentId} onClick={() => node && onOperation({ kind, nodeId: node.id })}>{label}</button>)}
    </div>
    {!node && <p>Select a node on the canvas or in the Outline to edit its structure.</p>}
    {isLast && <p>At least one top-level node must remain. Deleting a node also deletes its children.</p>}
    <p>Structure, labels, styles and initial expansion are shared across adaptive views. Outline navigation reveals ancestors temporarily.</p>
  </section>;
}
function allTreeIds(root: Widget): string[] { const ids: string[] = []; function visit(nodes: Widget[]) { for (const node of nodes) { ids.push(node.id); visit(node.treeNode?.children ?? []); } } visit(root.tree?.nodes ?? []); return ids; }

export function TreeOutlineEntries({ tree, selection, onSelect }: { tree: Widget; selection: TreeSelection | null; onSelect: (node: Widget, part: 'node' | 'label') => void }) {
  function children(nodes: Widget[]) { return nodes.map(node => <div key={node.id} className="tree-outline-node"><button className={`tree-row ${selection?.nodeId === node.id && selection.part === 'node' ? 'selected' : ''}`} aria-label={`Select tree node ${node.name}`} onClick={() => onSelect(node, 'node')}>{node.name}</button><button className={`tree-row tree-outline-label ${selection?.nodeId === node.id && selection.part === 'label' ? 'selected' : ''}`} aria-label={`Select tree label ${node.treeNode!.label.name}`} onClick={() => onSelect(node, 'label')}>{node.treeNode!.label.name}</button>{children(node.treeNode!.children)}</div>); }
  return <div className="tree-outline-items">{children(tree.tree!.nodes)}</div>;
}

export function TreeCanvasControls({ tree, onSelectOwner, onOwnerPointerDown }: { tree: Widget; onSelectOwner: () => void; onOwnerPointerDown?: (event: ReactPointerEvent) => void }) {
  return <div className="tree-canvas-controls" role="group" aria-label={`Tree editing controls ${tree.name}`}><button className="tree-owner-control" aria-label={`Select tree ${tree.name}`} title="Select tree container" onPointerDown={event => { event.stopPropagation(); onOwnerPointerDown?.(event); }} onClick={event => { event.stopPropagation(); onSelectOwner(); }}>☷</button></div>;
}
