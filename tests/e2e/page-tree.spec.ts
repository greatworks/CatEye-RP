import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const tree = (page: Page) => page.getByRole('tree', { name: 'Pages', exact: true });
const node = (page: Page, id: string) => tree(page).locator(`.tree-row[data-page-node-id="${id}"]`);
const nameButton = (page: Page, name: string) => tree(page).getByRole('button', { name, exact: true });
const marker = (scope: Page | Locator, name: string) => scope.locator('.widget').filter({ hasText: new RegExp(`^${name} canvas$`) });

function fixture() {
  const doc = createDocument(); doc.name = 'Page tree browser fixture'; doc.caseSelection = 'never';
  const section = { id: uid(), name: 'Section' };
  const home = createPage('Home'), details = createPage('Details'), final = createPage('Final');
  home.parentId = section.id; details.parentId = home.id;
  for (const page of [home, details, final]) {
    page.width = 1000; page.height = 650;
    const text = createWidget('box', 70, 80); text.name = `${page.name} marker`; text.text = `${page.name} canvas`; text.width = 280;
    page.widgets = [text];
  }
  const link = createWidget('button', 70, 240); link.name = 'Open details'; link.text = 'Open details';
  link.interactions = [{ id: uid(), name: 'Open child page', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'openPage', targetId: details.id }] }];
  home.widgets.push(link);
  doc.pages = [home, details, final]; doc.pageFolders = [section]; doc.pageOrder = [section.id, home.id, details.id, final.id];
  return { doc, section, home, details, final };
}

async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'page-tree.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name); await expect(tree(page)).toBeVisible();
}
async function save(page: Page, file: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  await (await download).saveAs(file); return JSON.parse(await readFile(file, 'utf8')) as Document;
}
async function reopen(page: Page, file: string) {
  await fileMenu(page, 'New Ctrl+N');
  // A fresh document is unsaved; explicitly accept replacing it with the saved fixture.
  page.once('dialog', dialog => dialog.accept());
  const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles(file); await expect(page.locator('.statusbar')).toContainText('Document opened');
}
async function action(page: Page, id: string, label: string) {
  await node(page, id).click({ button: 'right' });
  await page.getByRole('menu', { name: 'Page actions', exact: true }).getByRole('menuitem', { name: label, exact: true }).click();
}
async function rename(page: Page, id: string, kind: 'Page' | 'Folder', name: string) {
  await node(page, id).click(); await page.keyboard.press('F2');
  const dialog = page.getByRole('dialog', { name: `${kind} name`, exact: true });
  await dialog.getByRole('textbox', { name: `${kind} name`, exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(node(page, id)).toHaveAttribute('aria-label', name);
}
async function move(page: Page, source: string, target: string, position: 'before' | 'inside' | 'after') {
  const box = await node(page, target).boundingBox(); expect(box).not.toBeNull();
  await node(page, source).dragTo(node(page, target), { targetPosition: { x: box!.width * .7, y: box!.height * ({ before: .1, inside: .5, after: .9 }[position]) } });
}
async function pressNode(page: Page, id: string, key: string) { await node(page, id).click(); await page.keyboard.press(key); }
const parents = (doc: Document) => Object.fromEntries([...doc.pages, ...(doc.pageFolders ?? [])].map(value => [value.id, value.parentId ?? null]));

test('tree selection, ancestor search, folder/page creation and F2 rename survive save and reopen', async ({ page }, info) => {
  const { doc, section, home, details, final } = fixture(); await open(page, doc);
  await expect(node(page, section.id)).toHaveAttribute('aria-level', '1');
  await expect(node(page, home.id)).toHaveAttribute('aria-level', '2');
  await expect(node(page, details.id)).toHaveAttribute('aria-level', '3');
  await nameButton(page, 'Final').click(); await expect(marker(page, 'Home')).toBeVisible();
  await nameButton(page, 'Final').dblclick(); await expect(marker(page, 'Final')).toBeVisible();
  await nameButton(page, 'Section').dblclick(); await expect(node(page, home.id)).not.toBeVisible();
  const search = page.getByLabel('Search pages and widgets', { exact: true }); await search.fill('Details');
  await expect(node(page, section.id)).toBeVisible(); await expect(node(page, home.id)).toBeVisible(); await expect(node(page, details.id)).toBeVisible();
  await expect(node(page, final.id)).not.toBeVisible(); await expect(marker(page, 'Final')).toBeVisible();
  await search.fill(''); await expect(node(page, home.id)).not.toBeVisible();
  await tree(page).getByRole('button', { name: 'Expand Section', exact: true }).click();
  await rename(page, section.id, 'Folder', 'Section <routes> & links');
  await rename(page, details.id, 'Page', 'Details renamed');
  await action(page, home.id, 'Add child folder');
  const addedFolder = tree(page).locator('.tree-row[data-page-kind="folder"]').last();
  const folderId = (await addedFolder.getAttribute('data-page-node-id'))!;
  await rename(page, folderId, 'Folder', 'Resources');
  await page.getByTitle('Add page', { exact: true }).click();
  await expect(nameButton(page, 'Page 4')).toBeVisible();
  const file = info.outputPath('page-tree-created.rea.json'), created = await save(page, file);
  const newPage = created.pages.find(value => value.name === 'Page 4')!;
  expect(newPage.parentId).toBe(folderId); expect(created.pageFolders).toEqual([{ ...section, name: 'Section <routes> & links' }, { id: folderId, name: 'Resources', parentId: home.id }]);
  expect(created.pageOrder).toEqual([section.id, home.id, details.id, folderId, newPage.id, final.id]);
  expect(created.pages.map(value => value.id)).toEqual([home.id, details.id, newPage.id, final.id]);
  expect(created.pages.find(value => value.id === home.id)?.widgets).toEqual(home.widgets);
  expect(created.pages.find(value => value.id === details.id)?.name).toBe('Details renamed');
  await reopen(page, file); expect(await save(page, info.outputPath('page-tree-reopened.rea.json'))).toEqual(created);
  await expect(marker(page, 'Home')).toBeVisible(); await expect(node(page, newPage.id)).toHaveAttribute('aria-level', '4');
  await page.screenshot({ path: info.outputPath('page-tree-created.png'), fullPage: true });
});

test('drag drop zones and tree keyboard moves preserve whole subtrees, IDs and canvas widgets through undo', async ({ page }, info) => {
  const { doc, section, home, details, final } = fixture(); await open(page, doc);
  // Leave a canvas widget selected: tree shortcuts must never nudge or delete it.
  await marker(page, 'Home').click();
  await move(page, final.id, section.id, 'inside');
  let saved = await save(page, info.outputPath('inside.rea.json'));
  expect(saved.pageOrder).toEqual([section.id, home.id, details.id, final.id]); expect(parents(saved)[final.id]).toBe(section.id);
  await move(page, final.id, home.id, 'before');
  saved = await save(page, info.outputPath('before.rea.json')); expect(saved.pageOrder).toEqual([section.id, final.id, home.id, details.id]);
  await move(page, final.id, home.id, 'after');
  saved = await save(page, info.outputPath('after.rea.json')); expect(saved.pageOrder).toEqual([section.id, home.id, details.id, final.id]);
  // Illegal cycle is a no-op, not a partial detach of Home or its child.
  await move(page, home.id, details.id, 'inside'); expect(await save(page, info.outputPath('cycle.rea.json'))).toEqual(saved);
  await pressNode(page, final.id, 'Control+ArrowUp');
  saved = await save(page, info.outputPath('up.rea.json')); expect(saved.pageOrder).toEqual([section.id, final.id, home.id, details.id]);
  await pressNode(page, final.id, 'Control+ArrowDown');
  await pressNode(page, final.id, 'Control+ArrowRight');
  saved = await save(page, info.outputPath('indent.rea.json')); expect(parents(saved)[final.id]).toBe(home.id); expect(saved.pageOrder).toEqual([section.id, home.id, details.id, final.id]);
  await pressNode(page, final.id, 'Control+ArrowLeft');
  const beforeUndo = await save(page, info.outputPath('outdent.rea.json')); expect(parents(beforeUndo)[final.id]).toBe(section.id);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('tree-undone.rea.json'))).toEqual(saved);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('tree-redone.rea.json'))).toEqual(beforeUndo);
  expect(beforeUndo.pages.find(value => value.id === home.id)?.widgets).toEqual(home.widgets);
  expect(beforeUndo.pages.find(value => value.id === details.id)?.parentId).toBe(home.id);
  // Search textbox navigation is ordinary text navigation, not a tree mutation.
  const search = page.getByLabel('Search pages and widgets', { exact: true }); await search.fill('Home'); await search.press('Control+ArrowRight'); await search.press('Delete'); await search.fill('');
  expect(await save(page, info.outputPath('search-shortcuts.rea.json'))).toEqual(beforeUndo);
});

test('subtree deletion can be cancelled, restores with undo, and cannot remove the last real page', async ({ page }, info) => {
  const { doc, section, home, final } = fixture(); await open(page, doc);
  const cancelled = page.waitForEvent('dialog'); await node(page, section.id).click();
  const deleteKey = page.keyboard.press('Delete'); const firstDialog = await cancelled; expect(firstDialog.type()).toBe('confirm'); await firstDialog.dismiss(); await deleteKey;
  expect(await save(page, info.outputPath('delete-cancelled.rea.json'))).toEqual(doc); await expect(marker(page, 'Home')).toBeVisible();
  const accepted = page.waitForEvent('dialog'); const deleteAction = action(page, section.id, 'Delete');
  const secondDialog = await accepted; expect(secondDialog.type()).toBe('confirm'); await secondDialog.accept(); await deleteAction;
  await expect(marker(page, 'Final')).toBeVisible(); await expect(node(page, section.id)).toHaveCount(0); await expect(node(page, home.id)).toHaveCount(0);
  const deleted = await save(page, info.outputPath('subtree-deleted.rea.json'));
  expect(deleted.pages).toEqual([final]); expect(deleted.pageFolders).toEqual([]); expect(deleted.pageOrder).toEqual([final.id]);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('delete-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('delete-redone.rea.json'))).toEqual(deleted);
  await node(page, final.id).click(); await page.keyboard.press('Delete');
  await expect(page.locator('.statusbar')).toContainText('at least one page'); expect(await save(page, info.outputPath('last-page-kept.rea.json'))).toEqual(deleted);
});

test('opened tabs reorder independently of the page tree and close without deleting pages or consuming undo', async ({ page }, info) => {
  const { doc, home } = fixture(); await open(page, doc);
  const tabs = page.getByRole('tablist', { name: 'Open pages', exact: true });
  await expect(tabs.getByRole('tab')).toHaveText(['Home']);
  await rename(page, home.id, 'Page', 'Home renamed');
  const renamed = await save(page, info.outputPath('tab-rename.rea.json'));
  await expect(tabs.getByRole('tab')).toHaveText(['Home renamed']);
  await nameButton(page, 'Final').click(); await expect(tabs.getByRole('tab')).toHaveCount(1);
  await nameButton(page, 'Final').dblclick(); await nameButton(page, 'Details').dblclick();
  await expect(tabs.getByRole('tab')).toHaveText(['Home renamed', 'Final', 'Details']);
  const finalTab = tabs.getByRole('tab', { name: 'Final', exact: true }).locator('..');
  const homeTab = tabs.getByRole('tab', { name: 'Home renamed', exact: true }).locator('..');
  const targetBox = await homeTab.boundingBox(); expect(targetBox).not.toBeNull();
  await finalTab.dragTo(homeTab, { targetPosition: { x: targetBox!.width * .2, y: targetBox!.height * .5 } });
  await expect(tabs.getByRole('tab')).toHaveText(['Final', 'Home renamed', 'Details']);
  expect(await save(page, info.outputPath('tabs-reordered.rea.json'))).toEqual(renamed);
  await page.getByTitle('Open pages list', { exact: true }).click();
  await page.getByRole('menu', { name: 'Open pages', exact: true }).getByRole('menuitem', { name: 'Home renamed', exact: true }).click();
  await expect(marker(page, 'Home')).toBeVisible();
  const tabAction = async (name: string, label: string) => {
    await tabs.getByRole('tab', { name, exact: true }).click({ button: 'right' });
    await page.getByRole('menu', { name: 'Tab actions', exact: true }).getByRole('menuitem', { name: label, exact: true }).click();
  };
  await tabAction('Home renamed', 'Close other tabs'); await expect(tabs.getByRole('tab')).toHaveText(['Home renamed']);
  await nameButton(page, 'Details').dblclick(); await tabs.getByRole('tab', { name: 'Details', exact: true }).click(); await page.keyboard.press('Delete');
  await expect(tabs.getByRole('tab')).toHaveText(['Home renamed']); await expect(nameButton(page, 'Details')).toBeVisible();
  await marker(page, 'Home').click();
  await expect(page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel('Widget name', { exact: true })).toHaveValue('Home marker');
  await tabAction('Home renamed', 'Close all tabs'); await expect(tabs.getByRole('tab')).toHaveCount(0); await expect(page.locator('.gallery')).toBeVisible();
  await page.evaluate(() => { (document.activeElement as HTMLElement).blur(); document.body.focus(); });
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  await page.keyboard.press('Delete'); await page.keyboard.press('Control+d'); await page.keyboard.press('ArrowRight');
  expect(await save(page, info.outputPath('tabs-closed.rea.json'))).toEqual(renamed);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('tabs-undo-rename.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('tabs-redo-rename.rea.json'))).toEqual(renamed);
  await nameButton(page, 'Final').dblclick(); await expect(marker(page, 'Final')).toBeVisible();
  await page.getByTitle('Close Final', { exact: true }).click(); await expect(page.locator('.gallery')).toBeVisible();
  expect(await save(page, info.outputPath('tabs-final.rea.json'))).toEqual(renamed);
});

test('undo deleting the active added page restores an opened fallback tab after the older tab was closed', async ({ page }, info) => {
  const { doc, home } = fixture(); delete home.parentId; doc.pages = [home]; doc.pageFolders = []; doc.pageOrder = [home.id];
  await open(page, doc); const tabs = page.getByRole('tablist', { name: 'Open pages', exact: true });
  await page.getByTitle('Add page', { exact: true }).click(); await expect(tabs.getByRole('tab', { name: 'Page 2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByTitle('Close Home', { exact: true }).click(); await expect(tabs.getByRole('tab')).toHaveText(['Page 2']);
  await page.keyboard.press('Control+z'); expect(await save(page, info.outputPath('undo-page-fallback.rea.json'))).toEqual(doc);
  await expect(marker(page, 'Home')).toBeVisible(); await expect(tabs.getByRole('tab')).toHaveText(['Home']);
  await expect(tabs.getByRole('tab', { name: 'Home', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('collapsing a selected descendant moves keyboard selection to the visible ancestor before Delete', async ({ page }, info) => {
  const { doc, section, details, final } = fixture(); await open(page, doc);
  await nameButton(page, 'Details').click(); await expect(node(page, details.id)).toHaveAttribute('aria-selected', 'true');
  await tree(page).getByRole('button', { name: 'Collapse Section', exact: true }).click(); await expect(node(page, details.id)).not.toBeVisible();
  // Soft checks also let the old implementation demonstrate the consequential hidden-page deletion.
  await expect.soft(node(page, section.id)).toHaveAttribute('aria-selected', 'true', { timeout: 1000 }); await expect.soft(node(page, section.id)).toHaveAttribute('tabindex', '0', { timeout: 1000 });
  const messages: string[] = []; const dismiss = async (dialog: import('@playwright/test').Dialog) => { messages.push(dialog.message()); await dialog.dismiss(); };
  page.on('dialog', dismiss); await page.keyboard.press('Delete'); const unchanged = await save(page, info.outputPath('collapsed-delete-cancelled.rea.json')); page.off('dialog', dismiss);
  expect(messages).toHaveLength(1); expect(messages[0]).toContain('Section'); expect(unchanged).toEqual(doc);
  await page.getByLabel('Search pages and widgets', { exact: true }).fill('Final');
  await expect(node(page, final.id)).toHaveAttribute('aria-selected', 'true'); await expect(node(page, final.id)).toHaveAttribute('tabindex', '0');
  await node(page, final.id).focus(); await page.keyboard.press('F2');
  const dialog = page.getByRole('dialog', { name: 'Page name', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Page name', exact: true })).toHaveValue('Final');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await save(page, info.outputPath('search-owns-rename.rea.json'))).toEqual(doc);
});

test('focused tabs and close buttons own their keys without mutating a selected canvas widget', async ({ page }, info) => {
  const { doc } = fixture();
  for (const focus of ['tab', 'close'] as const) {
    await open(page, doc); await marker(page, 'Home').click();
    await expect(page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel('Widget name', { exact: true })).toHaveValue('Home marker');
    const target = focus === 'tab' ? page.getByRole('tablist', { name: 'Open pages', exact: true }).getByRole('tab', { name: 'Home', exact: true }) : page.getByTitle('Close Home', { exact: true });
    await target.focus(); await page.keyboard.press('ArrowDown');
    expect.soft(await save(page, info.outputPath(`${focus}-arrow-ownership.rea.json`))).toEqual(doc);
    await target.focus(); await page.keyboard.press('Backspace');
    expect.soft(await save(page, info.outputPath(`${focus}-backspace-ownership.rea.json`))).toEqual(doc);
  }
});

test('preview and real offline export navigate parent pages and children while folders never become pages', async ({ page, browser }, info) => {
  const { doc, section, home, details } = fixture(); await open(page, doc);
  await rename(page, details.id, 'Page', 'Renamed destination');
  const saved = info.outputPath('navigation-tree.rea.json'), authored = await save(page, saved);
  expect(authored.pages.find(value => value.id === home.id)?.widgets).toEqual(home.widgets);
  await reopen(page, saved);
  const exercise = async (scope: Page | Locator) => {
    await expect(marker(scope, 'Home')).toBeVisible();
    const collapse = scope.getByRole('button', { name: 'Collapse Section', exact: true }); await collapse.click();
    await expect(scope.getByRole('button', { name: 'Renamed destination', exact: true })).not.toBeVisible(); await expect(marker(scope, 'Home')).toBeVisible();
    await scope.getByRole('button', { name: 'Expand Section', exact: true }).click();
    await scope.getByRole('button', { name: 'Renamed destination', exact: true }).click(); await expect(marker(scope, 'Details')).toBeVisible();
    await scope.getByRole('button', { name: 'Home', exact: true }).click(); await expect(marker(scope, 'Home')).toBeVisible();
    await scope.locator('.widget[aria-label="Open details"]').click(); await expect(marker(scope, 'Details')).toBeVisible();
    await scope.getByRole('button', { name: 'Final', exact: true }).click(); await expect(marker(scope, 'Final')).toBeVisible();
    await expect(scope.locator(`.widget[aria-label="${section.name} marker"]`)).toHaveCount(0);
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay'));
  await page.screenshot({ path: info.outputPath('page-tree-preview.png') }); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const html = info.outputPath('page-tree.html'); await (await download).saveAs(html);
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  try {
    const exported = await context.newPage(), requests: string[] = [], errors: string[] = [];
    exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); }); exported.on('pageerror', error => errors.push(error.message));
    await exported.goto(pathToFileURL(html).href); await exercise(exported); await exported.screenshot({ path: info.outputPath('page-tree-offline.png') });
    expect(requests).toEqual([]); expect(errors).toEqual([]);
  } finally { await context.close(); }
  expect(await save(page, info.outputPath('navigation-after-playback.rea.json'))).toEqual(authored);
});
