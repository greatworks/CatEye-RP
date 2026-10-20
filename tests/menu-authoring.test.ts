import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument } from '../src/model/document';
import { createMenu, addSubmenu, updateMenu, setMenuPadding, deleteMenuItem } from '../src/model/menu';
import { MenuStructureControls, MenuCanvasControls, menuAncestors } from '../src/components/MenuEditor';
import { WidgetContent, widgetStyle } from '../src/components/WidgetView';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';

function nested() {
  let menu=createMenu('horizontal');menu=addSubmenu(menu,menu.menu!.table.table!.cells[1].id);
  const first=menu.menu!.submenus[0];menu=updateMenu(menu,first.id,child=>addSubmenu(child,child.menu!.table.table!.cells[2].id));
  return menu;
}
describe('classic menu authoring surfaces',()=>{
  it('finds exact ancestor identities for arbitrary nested editing without writing visibility',()=>{
    const root=nested(),child=root.menu!.submenus[0],grandchild=child.menu!.submenus[0],before=JSON.stringify(root);
    expect(menuAncestors(root,grandchild.id)).toEqual([root.id,child.id,grandchild.id]);expect(menuAncestors(root,root.id)).toEqual([root.id]);expect(menuAncestors(root,'missing')).toBeUndefined();expect(JSON.stringify(root)).toBe(before);
  });
  it('keeps submenus closed in passive author thumbnails and expands only explicit editing branches',()=>{
    const root=nested(),child=root.menu!.submenus[0],grandchild=child.menu!.submenus[0];root.menu!.table.table!.cells[0].text='<script>unsafe</script>';
    const plain=renderToStaticMarkup(createElement(WidgetContent,{widget:root}));expect(plain).toContain('&lt;script&gt;unsafe&lt;/script&gt;');expect(plain).not.toContain(`data-menu-id="${child.id}"`);
    const opened=renderToStaticMarkup(createElement(WidgetContent,{widget:root,menuAuthoring:{openMenuIds:[child.id,grandchild.id],onCellPointerDown:()=>{},onCellDoubleClick:()=>{},onEditSubmenu:()=>{}}}));
    expect((opened.match(/data-menu-item-id=/g)??[])).toHaveLength(9);expect(opened).toContain(`data-menu-id="${grandchild.id}"`);expect(opened).not.toContain('Table editing controls');expect(widgetStyle(root).overflow).toBe('visible');
  });
  it('offers menu padding, item operations and independent outer paint without a fake menu caption',()=>{
    const root=setMenuPadding(createMenu('vertical'),[3,5,7,11]),document=createDocument();document.pages[0].widgets=[root];
    const context={menu:root,onOperation:()=>{},onSelectMenu:()=>{},onEditSubmenu:()=>{},onOrientation:()=>{},onPadding:()=>{}};
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget:root,onWidgetChange:()=>{},onPageChange:()=>{},menuContext:context}));
    expect(html).toContain('Menu padding left');expect(html).toContain('Add menu item after');expect(html).toContain('Fill &amp; border');expect(html).not.toContain('aria-label="Widget text"');expect(html).not.toContain('Selected by default');expect(html).not.toContain('Insert row');
    const controls=renderToStaticMarkup(createElement(MenuCanvasControls,{menu:root,selected:true,cellId:root.menu!.table.table!.cells[1].id,onSelectOwner:()=>{}}));expect(controls).toContain('left:11px;top:33px;width:100px;height:30px');
  });
  it('prevents an empty author menu and exposes Shown/Hidden only on menu event lists',()=>{
    let root=createMenu();root=deleteMenuItem(root,root.menu!.table.table!.cells[2].id);root=deleteMenuItem(root,root.menu!.table.table!.cells[1].id);
    const html=renderToStaticMarkup(createElement(MenuStructureControls,{menu:root,cellId:root.menu!.table.table!.cells[0].id,onOperation:()=>{},onSelectMenu:()=>{},onEditSubmenu:()=>{},onOrientation:()=>{},onPadding:()=>{}}));expect(html).toMatch(/<button disabled="">Delete menu item<\/button>/);
    const document=createDocument();document.pages[0].widgets=[root];const interaction={id:'test-case',event:'click' as const,name:'Case',enabled:true,conditions:[],conditionMode:'all' as const,actions:[]};
    const events=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget:root,interactions:[interaction],onChange:()=>{}}));expect(events).toContain('<option value="show">Shown</option>');expect(events).toContain('<option value="hide">Hidden</option>');
    const itemEvents=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget:root.menu!.table.table!.cells[0],interactions:[interaction],onChange:()=>{}}));expect(itemEvents).not.toContain('<option value="show">');
  });
});
