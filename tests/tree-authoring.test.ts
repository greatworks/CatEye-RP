import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument } from '../src/model/document';
import { createTree, setTreeNodeExpanded } from '../src/model/tree-widget';
import { TreeStructureControls, TreeOutlineEntries, treeAncestors, visibleTreeNodes } from '../src/components/TreeEditor';
import { WidgetContent, widgetStyle } from '../src/components/WidgetView';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';

const noop=()=>{};
describe('Tree widget authoring surfaces',()=>{
  it('reveals collapsed descendants by identity without modifying authored expansion or selected state',()=>{
    let tree=createTree();const parent=tree.tree!.nodes[0],child=parent.treeNode!.children[1];tree=setTreeNodeExpanded(tree,parent.id,false);const before=JSON.stringify(tree);
    expect(treeAncestors(tree,child.id)).toEqual([parent.id,child.id]);expect(treeAncestors(tree,child.treeNode!.label.id)).toEqual([parent.id,child.id]);expect(treeAncestors(tree,'unknown')).toBeUndefined();
    expect(visibleTreeNodes(tree).map(node=>node.id)).toEqual([parent.id]);expect(visibleTreeNodes(tree,[parent.id])).toHaveLength(4);
    const closed=renderToStaticMarkup(createElement(WidgetContent,{widget:tree}));expect(closed).not.toContain(`data-tree-label-id="${child.treeNode!.label.id}"`);
    const reveal=renderToStaticMarkup(createElement(WidgetContent,{widget:tree,treeAuthoring:{revealedNodeIds:[parent.id],onNodePointerDown:noop,onLabelDoubleClick:noop,onToggle:noop}}));expect(reveal).toContain(`data-tree-label-id="${child.treeNode!.label.id}"`);expect(reveal).toContain('aria-expanded="true"');expect(JSON.stringify(tree)).toBe(before);
  });
  it('keeps root, node and label editor scopes distinct, with a last-root guard and no fake root text or node size fields',()=>{
    const tree=createTree(),node=tree.tree!.nodes[0],doc=createDocument();doc.pages[0].widgets=[tree];
    const context={tree,selection:{rootTreeId:tree.id,nodeId:node.id,part:'node' as const},onSelect:noop,onOperation:noop,onProperties:noop,onExpanded:noop};
    const controls=renderToStaticMarkup(createElement(TreeStructureControls,context));expect(controls).toContain('Add child node');expect(controls).toMatch(/<button disabled="">Delete tree node<\/button>/);expect(controls).toMatch(/<button disabled="">Outdent node<\/button>/);
    const root=renderToStaticMarkup(createElement(Inspector,{document:doc,page:doc.pages[0],widget:tree,onWidgetChange:noop,onPageChange:noop,treeContext:{...context,selection:null}}));expect(root).not.toContain('aria-label="Widget text"');expect(root).not.toContain('Selected by default');expect(root).toContain('Show expand icons');
    const nodeHtml=renderToStaticMarkup(createElement(Inspector,{document:doc,page:doc.pages[0],widget:node,onWidgetChange:noop,onPageChange:noop,treeContext:context}));expect(nodeHtml).not.toContain('aria-label="W"');expect(nodeHtml).toContain('independent identity');
    const label=renderToStaticMarkup(createElement(Inspector,{document:doc,page:doc.pages[0],widget:node.treeNode!.label,onWidgetChange:noop,onPageChange:noop,treeContext:{...context,selection:{...context.selection,part:'label'}}}));expect(label).toContain('aria-label="W"');expect(label).not.toContain('aria-label="Rotate"');
  });
  it('renders escaped literal labels and independent expansion hit targets with explicit author focus markers',()=>{
    const tree=createTree(),node=tree.tree!.nodes[0];node.treeNode!.label.text='<script>literal</script>';
    const html=renderToStaticMarkup(createElement(WidgetContent,{widget:tree,treeAuthoring:{revealedNodeIds:[],selectedNodeId:node.id,selectedPart:'label',onNodePointerDown:noop,onLabelDoubleClick:noop,onToggle:noop}}));
    expect(html).toContain('&lt;script&gt;literal&lt;/script&gt;');expect(html).toContain(`data-tree-node-id="${node.id}"`);expect(html).toContain('aria-label="Collapse node Item 1"');expect(html).toContain('is-current-label');expect(html).not.toContain('is-current-node');expect(widgetStyle(tree).overflow).toBe('visible');
    const outline=renderToStaticMarkup(createElement(TreeOutlineEntries,{tree,selection:null,onSelect:noop}));expect(outline).toContain('Select tree node Item 1');expect(outline).toContain('Select tree label Item 1.3');
  });
  it('offers only node identities for expansion actions while labels retain ordinary style/text targets',()=>{
    const tree=createTree(),doc=createDocument();doc.pages[0].widgets=[tree];const node=tree.tree!.nodes[0],label=node.treeNode!.label;
    const interaction={id:'case',name:'Node action',event:'click' as const,enabled:true,conditions:[],conditionMode:'all' as const,actions:[{id:'expand',type:'expandTreeNode' as const,targetId:node.id}]};
    const html=renderToStaticMarkup(createElement(InteractionsEditor,{document:doc,page:doc.pages[0],widget:node,interactions:[interaction],onChange:noop}));
    expect(html).toContain(`<option value="${node.id}" selected="">`);expect(html).not.toContain(`<option value="${tree.id}">`);expect(html).not.toContain(`<option value="${label.id}">`);
    const text=renderToStaticMarkup(createElement(InteractionsEditor,{document:doc,page:doc.pages[0],widget:node,interactions:[{...interaction,actions:[{id:'text',type:'setText',targetId:label.id,value:'new'}]}],onChange:noop}));expect(text).toContain(`<option value="${label.id}" selected="">`);expect(text).not.toContain(`<option value="${node.id}">`);
  });
});
