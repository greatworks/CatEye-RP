import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, findWidget, mapWidgets, cloneWidgets, collectWidgetIdentifiers, deleteWidgetTree, parseDocument, serializeDocument, uid } from '../src/model/document';
import { createTree, createTreeNode, deleteTreeNode, findTreeNode, insertTreeNode, layoutTree, moveTreeNode, patchTreeLabel, setTreeNodeExpanded, setTreeProperties, treeNodeLocation, treeSharedDescendantIds } from '../src/model/tree-widget';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance } from '../src/model/components';
import type { Widget } from '../src/model/types';
import { treeWidgetFixture } from './fixtures/tree-widgets';
const roundtrip = (root: Widget) => { const doc = createDocument(); doc.pages[0].widgets = [root]; return parseDocument(serializeDocument(doc)).pages[0].widgets[0]; };
const first = (root: Widget) => root.tree!.nodes[0];

describe('tree widget authoring structure', () => {
  it('retains root, four node and four label identities and witnessed default geometry', () => {
    const root = createWidget('tree', 10, 30), node = first(root);
    expect([root.x, root.y, root.width, root.height]).toEqual([10,30,95,80]);
    expect([node.width, node.height, node.treeNode!.label.x]).toEqual([64,20,22]);
    expect(node.treeNode!.children.map(child => [child.x,child.y,child.width,child.height])).toEqual([[20,20,75,20],[20,40,75,20],[20,60,75,20]]);
    expect(collectWidgetIdentifiers([root]).size).toBe(9); expect(roundtrip(root)).toEqual(root);
  });
  it('moves complete subtrees and retains references while indenting and outdenting', () => {
    const root = createTree(), node = first(root), [a,b,c] = node.treeNode!.children;
    const indented = moveTreeNode(root,b.id,'indent');
    expect(findTreeNode(indented,a.id)!.treeNode!.children[0].id).toBe(b.id);
    const moved = moveTreeNode(indented,c.id,'up');
    expect(first(moved).treeNode!.children.map(n=>n.id)).toEqual([c.id,a.id]);
    const outdented = moveTreeNode(moved,b.id,'outdent');
    expect(first(outdented).treeNode!.children.map(n=>n.id)).toEqual([c.id,a.id,b.id]);
    expect(roundtrip(outdented)).toEqual(outdented);
  });
  it('supports child and sibling insertion with unique identities and no source mutation', () => {
    const root = createTree(), node = first(root), before = insertTreeNode(root,node.id,'before');
    expect(before.tree!.nodes[1].id).toBe(node.id); expect(root.tree!.nodes).toHaveLength(1);
    const after = insertTreeNode(root,node.id,'after'); expect(after.tree!.nodes[0].id).toBe(node.id);
    const child = insertTreeNode(root,node.id,'child'); expect(first(child).treeNode!.children).toHaveLength(4);
    expect(collectWidgetIdentifiers([child]).size).toBe(11); expect(roundtrip(child)).toEqual(child);
  });
  it('deletes a subtree atomically and refuses to remove the last root node', () => {
    const root = createTree(), node = first(root), another = insertTreeNode(root,node.id,'after');
    const result = deleteTreeNode(another,node.id);
    expect(collectWidgetIdentifiers([result]).size).toBe(3);
    expect(() => deleteTreeNode(root,node.id)).toThrow('Cannot delete all items');
    expect(() => moveTreeNode(root,node.id,'outdent')).toThrow(); expect(() => moveTreeNode(root,node.id,'indent')).toThrow();
  });
  it('collapses authoring layout and preserves descendant expansion states', () => {
    const root = createTree(), node = first(root), withSibling = insertTreeNode(root,node.id,'after');
    const collapsed = setTreeNodeExpanded(withSibling,node.id,false);
    expect(collapsed.tree!.nodes[1].y).toBe(20); expect(collapsed.height).toBe(40);
    expect(first(collapsed).treeNode!.children.every(child=>child.treeNode!.expanded)).toBe(true);
    const open = setTreeNodeExpanded(collapsed,node.id,true); expect(open.tree!.nodes[1].y).toBe(80); expect(open.height).toBe(100);
  });
  it('preserves rich text consistency and independent label size while editing', () => {
    const root = createTree(), node = first(root);
    node.treeNode!.label.richText = {paragraphs:[{runs:[{text:node.treeNode!.label.text,style:{fontWeight:700}}]}]};
    const edited = patchTreeLabel(root,node.id,{text:'目录',width:120,height:30});
    const label = first(edited).treeNode!.label;
    expect(label.richText!.paragraphs[0].runs[0].text).toBe('目录'); expect(first(edited).width).toBe(142);
    expect(first(edited).height).toBe(30); expect(first(edited).treeNode!.children[0].y).toBe(30);
    expect(roundtrip(edited)).toEqual(edited);
    expect(() => patchTreeLabel(root,node.id,{id:'other'})).toThrow();
  });
  it('sets tree properties without changing node identities', () => {
    const root = createTree(), changed = setTreeProperties(root,{indent:32,iconStyle:'plusMinus',showExpandIcons:false});
    expect(first(changed).treeNode!.children[0].x).toBe(32);
    expect([...collectWidgetIdentifiers([changed]).keys()]).toEqual([...collectWidgetIdentifiers([root]).keys()]);
    expect(roundtrip(changed)).toEqual(changed);
  });
  it('rejects invalid structural edits and numeric layout values', () => {
    const root = createTree(); expect(()=>setTreeProperties(root,{indent:NaN})).toThrow();
    expect(()=>treeNodeLocation(root,'absent')).toThrow(); expect(findTreeNode(root,'absent')).toBeUndefined();
    expect(()=>moveTreeNode(root,first(root).id,'up')).toThrow();
    expect(()=>patchTreeLabel(root,first(root).id,{width:Infinity})).toThrow();
  });
});
describe('tree document integration', () => {
  it('roundtrips the complete demo and validates expansion target kinds', () => {
    const doc = treeWidgetFixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const button = doc.pages[0].widgets.find(w => w.id === 'tree-expand')!;
    button.interactions[0].actions[0].targetId = 'tree-status';
    expect(() => parseDocument(serializeDocument(doc))).toThrow('tree node target');
  });
  it('walks all nodes and labels, clones forward references, and protects structural deletion', () => {
    const root=createTree(), node=first(root), target=node.treeNode!.children[2].treeNode!.label;
    node.interactions=[{id:uid(),name:'forward',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:uid(),type:'setText',targetId:target.id,value:'[[Widget.'+target.id+'.text]]'}]}];
    let count=0;mapWidgets([root],w=>{count++;return w;});expect(count).toBe(9);expect(findWidget({widgets:[root]},target.id)).toBe(target);
    const copy=cloneWidgets([root],12)[0], copiedTarget=first(copy).treeNode!.children[2].treeNode!.label;
    expect(copy.x).toBe(112);expect(first(copy).x).toBe(0);
    expect(first(copy).interactions[0].actions[0]).toMatchObject({targetId:copiedTarget.id,value:'[[Widget.'+copiedTarget.id+'.text]]'});
    expect(roundtrip(copy)).toEqual(copy);expect(deleteWidgetTree([root],[root.id])).toEqual([]);
    expect(()=>deleteWidgetTree([root],[node.id])).toThrow('tree');expect(()=>deleteWidgetTree([root],[target.id])).toThrow('tree');
  });
  it('materializes all independent identities inside a component', () => {
    const component=createComponent([createTree()]), instance=createComponentInstance(component), doc=createDocument();
    doc.components=[component];doc.pages[0].widgets=[instance];expect(Object.keys(instance.componentInstance!.sourceIds)).toHaveLength(9);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('shares all tree appearance, geometry and contents; only root placement visibility is local', () => {
    const root=createTree(), doc=createDocument();doc.pages[0].widgets=[root];const page=createAdaptiveView(doc.pages[0]), view=page.adaptiveViews[0];
    let edit=patchTreeLabel(root,first(root).id,{text:'shared'});edit=setTreeNodeExpanded(edit,first(root).id,false);edit.x=55;edit.hidden=true;
    const next=applyAdaptiveWidgetEdits(page,view.id,[edit]);
    expect(next.widgets[0].x).toBe(55);expect(next.widgets[0].hidden).toBe(false);expect(first(next.widgets[0]).treeNode!.expanded).toBe(false);
    expect(next.adaptiveViews[0].overrides).toEqual({[root.id]:{hidden:true}});expect(resolveAdaptiveWidgets(next,view.id)[0].hidden).toBe(true);
    expect(treeSharedDescendantIds([root]).size).toBe(8);doc.pages=[next];expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it.each([
    (root:Widget)=>{root.tree!.nodes=[];},
    (root:Widget)=>{root.tree!.nodes[0].id=root.id;},
    (root:Widget)=>{first(root).treeNode!.label.id=first(root).id;},
    (root:Widget)=>{first(root).treeNode!.label.type='button';},
    (root:Widget)=>{first(root).treeNode!.label.rotation=10;},
    (root:Widget)=>{first(root).rotation=10;},
    (root:Widget)=>{first(root).treeNode!.iconSrc='javascript:alert(1)';},
    (root:Widget)=>{root.tree!.indent=Infinity;},
    (root:Widget)=>{first(root).states=[];},
    (root:Widget)=>{first(root).treeNode!.children.push(createWidget('text'));},
  ])('rejects malformed structures %#', corrupt=>{const root=createTree();corrupt(root);expect(()=>roundtrip(root)).toThrow();});
  it('rejects stand-alone tree nodes and local adaptive interior overrides',()=>{
    expect(()=>roundtrip(createTreeNode())).toThrow('belong');const root=createTree(),doc=createDocument();doc.pages[0].widgets=[root];
    doc.pages[0]=createAdaptiveView(doc.pages[0]);doc.pages[0].adaptiveViews[0].overrides[first(root).treeNode!.label.id]={hidden:true};
    expect(()=>parseDocument(serializeDocument(doc))).toThrow('shared');
  });
  it('preserves noncanonical stored geometry while roundtripping native or authored data',()=>{
    const root=createTree();first(root).treeNode!.children[1].y=57;root.width=300;
    expect(roundtrip(root)).toEqual(root);expect(layoutTree(root).width).toBe(95);
  });
});
