import type { TreeData, TreeNodeData, Widget } from './types';
import { replaceWidgetText } from './rich-text';

export function treeData(tree: Widget): TreeData {
  if (tree.type !== 'tree' || !tree.tree || !tree.tree.nodes.length) throw new Error('A tree must contain at least one node');
  const data = tree.tree;
  if (!Number.isFinite(data.indent) || data.indent < 0 || data.indent > 100000 || !['triangle', 'plusMinus'].includes(data.iconStyle)) throw new Error('Invalid tree properties');
  return data;
}
export function treeNodeData(node: Widget): TreeNodeData {
  if (node.type !== 'treeNode' || !node.treeNode || node.treeNode.label.type !== 'text') throw new Error('A tree node requires its independently identified text label');
  return node.treeNode;
}
export function treeSharedDescendantIds(widgets: Widget[]): Set<string> {
  const ids = new Set<string>();
  const visit = (items: Widget[], inside = false) => { for (const widget of items) {
    if (inside) ids.add(widget.id);
    if (widget.layer) visit(widget.layer.widgets, inside);
    for (const state of widget.states ?? []) visit(state.widgets, inside);
    if (widget.repeater) visit(widget.repeater.template, inside);
    if (widget.table) visit(widget.table.cells, inside);
    if (widget.menu) visit([widget.menu.table, ...widget.menu.submenus], inside);
    if (widget.tree) visit(widget.tree.nodes, true);
    if (widget.treeNode) visit([widget.treeNode.label, ...widget.treeNode.children], true);
  } };
  visit(widgets); return ids;
}
function plain(type: Widget['type'], name: string): Widget {
  return { id: crypto.randomUUID(), type, name, text: '', x: 0, y: 0, width: 1, height: 20, rotation: 0,
    hidden: false, locked: false, disabled: false, notes: '', interactions: [],
    style: { fill: '#ffffff00', stroke: '#797979', strokeWidth: 0, radius: 0, color: '#333333', fontSize: 13, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal', underline: false, strikethrough: false, textAlign: 'left', verticalAlign: 'middle', textPadding: [2,2,2,2], lineHeight: 'normal', opacity: 1 } };
}
export function createTreeNode(text = 'New item'): Widget {
  const label = { ...plain('text', text), text, x: 22, width: text === 'Item 1' ? 42 : text.startsWith('Item 1.') ? 53 : 84 };
  return { ...plain('treeNode', text), width: label.x + label.width, treeNode: { label, children: [], expanded: true } };
}
export function createTree(x = 100, y = 100): Widget {
  const node = createTreeNode('Item 1'); node.treeNode!.children = [1, 2, 3].map(index => createTreeNode(`Item 1.${index}`));
  return layoutTree({ ...plain('tree', 'Tree'), x, y, tree: { nodes: [node], indent: 20, showExpandIcons: true, iconStyle: 'triangle', showIcons: false } });
}
/** Canonical authoring layout. Runtime expansion retains the original root bounds. */
export function layoutTree(tree: Widget): Widget {
  const data = treeData(tree); let count = 0;
  const arrange = (nodes: Widget[], depth: number, start: number): { nodes: Widget[]; height: number; width: number } => {
    if (nodes.length && depth > 10) throw new Error('Tree nesting exceeds the document limit');
    let y = start, width = 1;
    const next = nodes.map(node => {
      if (++count > 4999) throw new Error('Tree exceeds the document widget limit');
      const item = treeNodeData(node), label = item.label;
      if (![label.x,label.y,label.width,label.height,node.height].every(Number.isFinite) || label.width < 1 || label.height < 1 || node.height < 1) throw new Error('Invalid tree node geometry');
      const rowWidth = Math.max(1, label.x + label.width), rowHeight = Math.max(node.height, label.y + label.height);
      const children = arrange(item.children, depth + 1, rowHeight), x = depth ? data.indent : 0;
      const result = { ...node, x, y, width: rowWidth, height: rowHeight, rotation: 0, treeNode: { ...item, children: children.nodes } };
      y += rowHeight + (item.expanded ? children.height : 0);
      width = Math.max(width, x + rowWidth, ...(item.expanded && item.children.length ? [x + children.width] : []));
      return result;
    });
    if (y > 100000 || width > 100000) throw new Error('Tree bounds exceed 100000 pixels');
    return { nodes: next, height: y - start, width };
  };
  const result = arrange(data.nodes, 0, 0);
  return { ...tree, width: result.width, height: Math.max(1, result.height), tree: { ...data, nodes: result.nodes } };
}
export function treeNodeLocation(root: Widget, id: string): { node: Widget; parentId?: string; index: number; siblings: Widget[] } {
  const walk = (nodes: Widget[], parentId?: string): ReturnType<typeof treeNodeLocation> | undefined => {
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index]; if (node.id === id) return { node, parentId, index, siblings: nodes };
      const found = walk(treeNodeData(node).children, node.id); if (found) return found;
    }
  };
  const found = walk(treeData(root).nodes); if (!found) throw new Error('Node does not belong to the selected tree'); return found;
}
export function findTreeNode(root: Widget, id: string): Widget | undefined { try { return treeNodeLocation(root, id).node; } catch { return undefined; } }
export function updateTreeNode(root: Widget, id: string, update: (node: Widget) => Widget): Widget {
  treeNodeLocation(root, id);
  const walk = (nodes: Widget[]): Widget[] => nodes.map(node => node.id === id ? update(node) : { ...node, treeNode: { ...treeNodeData(node), children: walk(node.treeNode!.children) } });
  return layoutTree({ ...root, tree: { ...treeData(root), nodes: walk(root.tree!.nodes) } });
}
export function patchTreeLabel(root: Widget, id: string, patch: Partial<Widget> | ((label: Widget) => Partial<Widget>)): Widget {
  return updateTreeNode(root, id, node => {
    const data = treeNodeData(node), changes = typeof patch === 'function' ? patch(data.label) : patch;
    for (const key of ['id','type','tree','treeNode','table','menu','repeater','states','imageSrc','vectorPath','componentId','componentInstance','groupId','rotation'] as const) if (Object.hasOwn(changes, key)) throw new Error(`Cannot change a tree label's ${key}`);
    let label = { ...data.label, ...changes };
    if (Object.hasOwn(changes, 'text') && !Object.hasOwn(changes, 'richText')) label = replaceWidgetText(label, changes.text!);
    return { ...node, treeNode: { ...data, label } };
  });
}
function replaceSiblings(root: Widget, parentId: string | undefined, siblings: Widget[]): Widget {
  return parentId ? updateTreeNode(root, parentId, node => ({ ...node, treeNode: { ...treeNodeData(node), children: siblings } })) : layoutTree({ ...root, tree: { ...treeData(root), nodes: siblings } });
}
export function insertTreeNode(root: Widget, referenceId: string, kind: 'child' | 'before' | 'after'): Widget {
  const location = treeNodeLocation(root, referenceId), node = createTreeNode();
  if (kind === 'child') return updateTreeNode(root, referenceId, parent => ({ ...parent, treeNode: { ...treeNodeData(parent), expanded: true, children: [...parent.treeNode!.children, node] } }));
  const siblings = [...location.siblings]; siblings.splice(location.index + (kind === 'after' ? 1 : 0), 0, node);
  return replaceSiblings(root, location.parentId, siblings);
}
export function deleteTreeNode(root: Widget, id: string): Widget {
  const location = treeNodeLocation(root, id);
  if (!location.parentId && location.siblings.length === 1) throw new Error('Cannot delete all items');
  return replaceSiblings(root, location.parentId, location.siblings.filter(node => node.id !== id));
}
export function moveTreeNode(root: Widget, id: string, direction: 'up' | 'down' | 'indent' | 'outdent'): Widget {
  const location = treeNodeLocation(root, id), siblings = [...location.siblings];
  if (direction === 'up' || direction === 'down') {
    const target = location.index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= siblings.length) throw new Error('No sibling in that direction');
    [siblings[location.index], siblings[target]] = [siblings[target], siblings[location.index]];
    return replaceSiblings(root, location.parentId, siblings);
  }
  if (direction === 'indent') {
    if (!location.index) throw new Error('The first sibling cannot be indented');
    const previous = siblings[location.index - 1]; siblings.splice(location.index, 1);
    siblings[location.index - 1] = { ...previous, treeNode: { ...treeNodeData(previous), expanded: true, children: [...previous.treeNode!.children, location.node] } };
    return replaceSiblings(root, location.parentId, siblings);
  }
  if (!location.parentId) throw new Error('A top-level node cannot be outdented');
  const parent = treeNodeLocation(root, location.parentId), upper = [...parent.siblings];
  upper[parent.index] = { ...parent.node, treeNode: { ...treeNodeData(parent.node), children: siblings.filter(node => node.id !== id) } };
  upper.splice(parent.index + 1, 0, location.node);
  return replaceSiblings(root, parent.parentId, upper);
}
export function setTreeNodeExpanded(root: Widget, id: string, expanded: boolean): Widget {
  return updateTreeNode(root, id, node => ({ ...node, treeNode: { ...treeNodeData(node), expanded } }));
}
export function setTreeProperties(root: Widget, properties: Partial<Omit<TreeData, 'nodes'>>): Widget {
  return layoutTree({ ...root, tree: { ...treeData(root), ...properties } });
}
