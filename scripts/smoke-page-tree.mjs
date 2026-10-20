import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-page-tree-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
await fs.mkdir(path.join(root, '.build'), { recursive: true }); await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const style = { fill: '#ffffff', stroke: '#bcc4d2', strokeWidth: 1, radius: 6, color: '#263348', fontSize: 16, fontFamily: 'Arial', fontWeight: 400, textAlign: 'left', opacity: 1 };
function makePage(name, text) {
  return { id: randomUUID(), name, width: 960, height: 640, background: '#f7f8fc', widgets: [{ id: randomUUID(), type: 'text', name: `${name} heading`, text, x: 56, y: 64, width: 820, height: 100, rotation: 0, style: { ...style, fill: 'transparent', strokeWidth: 0, fontSize: 30 }, hidden: false, locked: false, disabled: false, notes: '', interactions: [] }], notes: '', interactions: [], adaptiveViews: [] };
}
const overview = makePage('Project overview', 'A connected prototype'), review = makePage('Review checklist', 'Review the flow, then share your feedback.'), notes = makePage('Release notes', 'Page organization is part of the prototype.');
const folder = { id: randomUUID(), name: 'Product prototype' }; overview.parentId = folder.id; review.parentId = overview.id;
overview.widgets.push({ ...structuredClone(overview.widgets[0]), id: randomUUID(), type: 'button', name: 'Open checklist', text: 'Open review checklist →', y: 220, width: 280, height: 46, style: { ...style, fill: '#5b5ce2', strokeWidth: 0, color: '#ffffff', textAlign: 'center' }, interactions: [{ id: randomUUID(), event: 'click', name: 'Open the nested review page', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: randomUUID(), type: 'openPage', targetId: review.id }] }] });
const fixture = { format: 'rea-prototype', version: 1, id: randomUUID(), name: 'Page organization demo', caseSelection: 'never', pages: [overview, review, notes], pageFolders: [folder], pageOrder: [folder.id, overview.id, review.id, notes.id], components: [], variables: {}, styles: [] };
const source = path.join(userData, 'page-tree-source.rea.json'); await fs.writeFile(source, JSON.stringify(fixture));
let app;
try {
  if (executablePath) audit.appAsarSha256 = digest(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  const menu = async action => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async name => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64')), 'base64');
    const file = path.join(root, 'artifacts', name); await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: digest(bytes) });
  };
  await open(source);
  const tree = page.getByRole('tree', { name: 'Pages', exact: true });
  await expect(tree.locator(`[data-page-node-id="${review.id}"]`)).toHaveAttribute('aria-level', '3');
  await tree.getByRole('button', { name: notes.name, exact: true }).click(); await expect(page.locator('.editor-widget.text')).toHaveText(overview.widgets[0].text);
  await tree.getByRole('button', { name: notes.name, exact: true }).dblclick(); await expect(page.locator('.editor-widget.text')).toHaveText(notes.widgets[0].text);
  await tree.locator(`[data-page-node-id="${folder.id}"]`).click(); await page.keyboard.press('Control+ArrowDown');
  const file = path.join(userData, 'page-tree.rea.json'), moved = await save(file);
  expect(moved.pageOrder).toEqual([notes.id, folder.id, overview.id, review.id]); expect(moved.pages.map(value => value.id)).toEqual([notes.id, overview.id, review.id]);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(path.join(userData, 'undo.rea.json'))).toEqual(fixture);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(file)).toEqual(moved);
  await open(file); expect(await save(path.join(userData, 'reopened.rea.json'))).toEqual(moved);
  await tree.getByRole('button', { name: overview.name, exact: true }).dblclick();
  await capture('page-tree-desktop.png');
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await page.locator('.preview-page').getByRole('button', { name: 'Open checklist', exact: true }).click();
  await expect(page.locator('.preview-page .widget.text')).toHaveText(review.widgets[0].text); await capture('page-tree-preview.png');
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const html = path.join(userData, 'page-tree.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  const nextWindow = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, url) => { const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void window.loadURL(url); }, pathToFileURL(html).href);
  const offline = await nextWindow;
  await expect(offline.locator('main .widget.text')).toHaveText(notes.widgets[0].text);
  await offline.locator('nav').getByRole('button', { name: overview.name, exact: true }).click(); await offline.locator('main .widget[aria-label="Open checklist"]').click();
  await expect(offline.locator('main .widget.text')).toHaveText(review.widgets[0].text); await expect(offline.getByRole('alert')).toHaveText(''); await offline.close();
  expect(await save(path.join(userData, 'after-playback.rea.json'))).toEqual(moved);
  await fs.copyFile(file, path.join(root, 'artifacts', 'page-tree-demo.rea.json')); await fs.copyFile(html, path.join(root, 'artifacts', 'page-tree-demo.html'));

  // Independent decoded sitemap ledger supplies expected order; no importer helper is used as an oracle.
  const evidence = JSON.parse(await fs.readFile(path.join(root, 'research/page-management-evidence.json'), 'utf8'));
  const recorded = evidence.samples.find(sample => sample.file === 'UX Prototyping.rp');
  const rpFile = path.join(root, 'research/samples', recorded.file); expect(digest(await fs.readFile(rpFile))).toBe(recorded.fileSha256);
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, rpFile);
  await menu('Import Axure .rp (experimental)…'); const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
  await expect(report).toContainText('129 recovered widget(s), 24 skipped item(s).'); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const recovered = await save(path.join(userData, 'ux-sitemap.rea.json'));
  expect(recovered.pages).toHaveLength(10); expect(recovered.pageFolders).toHaveLength(6); expect(recovered.pages[0].name).toBe('Overview');
  const bySource = new Map(recorded.nodes.map(node => [node.nodeId, node.kind === 'page' ? `rp-p-${node.packageId}` : `rp-f-${node.folderId}`]));
  const expectedTree = recorded.nodes.map(node => ({ id: bySource.get(node.nodeId), name: node.name, parentId: node.parentNodeId ? bySource.get(node.parentNodeId) : undefined }));
  expect(recovered.pageOrder).toEqual(expectedTree.map(node => node.id));
  for (const expected of expectedTree) { const actual = [...recovered.pages, ...recovered.pageFolders].find(node => node.id === expected.id); expect(actual).toBeDefined(); expect(actual.name).toBe(expected.name); expect(actual.parentId).toBe(expected.parentId); }
  await expect(tree.locator('[data-page-kind="folder"]')).toHaveCount(6); await capture('rp-page-tree-desktop.png');
  expect(digest(await fs.readFile(rpFile))).toBe(recorded.fileSha256);
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  Object.assign(audit, { ok: true, authoring: { pages: 3, folders: 1, subtreeReorder: true, atomicUndoRedo: true, nativeSaveOpen: true, previewAndOfflineLinks: true, offlineLandingFollowsTree: true }, nativeRp: { file: recorded.file, sourceSha256: recorded.fileSha256, pages: 10, folders: 6, nodes: 16, exactSourceTree: true, sourceUnchanged: true }, demos: ['page-tree-demo.rea.json', 'page-tree-demo.html'] });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { if (app) await app.close(); audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/page-tree-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); }
