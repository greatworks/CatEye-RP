import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-vector-editing-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: executablePath ?? null, userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
await fs.mkdir(path.join(root, '.build'), { recursive: true });
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
let app;
try {
  if (executablePath) audit.appAsarSha256 = hash(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message));
  app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.locator('.application').waitFor();
  const save = async name => {
    const file = path.join(userData, name);
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  const capture = async name => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const base64 = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
    const bytes = Buffer.from(base64, 'base64'); expect(bytes.length).toBeGreaterThan(1000);
    const file = path.join(root, 'artifacts', name); await fs.writeFile(file, bytes);
    audit.screenshots.push({ file, sha256: hash(bytes) });
  };
  const surface = await page.locator('.canvas-surface').boundingBox();
  if (!surface) throw new Error('Missing canvas');
  const click = (x, y) => page.mouse.click(surface.x + x, surface.y + y);
  await page.getByTitle('Pen (P)', { exact: true }).click();
  await click(100, 130);
  await page.mouse.move(surface.x + 260, surface.y + 130); await page.mouse.down();
  await page.mouse.move(surface.x + 300, surface.y + 170, { steps: 5 }); await page.mouse.up();
  await click(260, 290); await click(100, 130);
  await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  const created = await save('pen-created.rea.json');
  const original = created.pages[0].widgets[0];
  expect(original.vectorPath.commands[0].op).toBe('M');
  expect(original.vectorPath.commands.at(-1).op).toBe('Z');
  expect(original.vectorPath.commands.filter(command => command.op === 'C')).toHaveLength(2);
  // One entire completed Pen path is one history step, not one step per click.
  await page.getByTitle('Undo', { exact: true }).click(); await expect(page.locator('.editor-widget')).toHaveCount(0);
  await page.getByTitle('Redo', { exact: true }).click(); await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  await page.locator('.editor-widget.path').click();
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  const anchor = page.getByLabel('Vector point 1', { exact: true });
  await expect(anchor).toBeVisible();
  const anchorBounds = await anchor.boundingBox();
  if (!anchorBounds) throw new Error('Missing vector anchor');
  const cx = anchorBounds.x + anchorBounds.width / 2, cy = anchorBounds.y + anchorBounds.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 20, cy + 10, { steps: 5 }); await page.mouse.up();
  await capture('vector-editing-desktop.png');
  await page.getByRole('button', { name: 'Done editing points', exact: true }).click();
  const edited = await save('pen-edited.rea.json');
  const current = edited.pages[0].widgets[0];
  expect(current.id).toBe(original.id);
  // The first curve's y minimum is 114.4897959… (t=5/7), and
  // the second curve's x maximum is 277.7777778… (t=1/3).
  // Point commit rounds the curve bounds outward; Pen creation used its hull.
  // Electron's fractional surface origin can put the final input anchor a few
  // 1e-5 px above 290. Apply the retained one-sided ceil to that saved input.
  const bottom=original.y+original.height,ceilBottom=Math.ceil(bottom),roundedBottom=Math.abs(ceilBottom-bottom-1)<1e-5?bottom:ceilBottom;
  expect([current.x,current.y,current.width,current.height]).toEqual([120,114,158,roundedBottom-114]);
  expect(current.x+current.vectorPath.commands[0].x*current.width).toBeCloseTo(120,8);
  expect(current.y+current.vectorPath.commands[0].y*current.height).toBeCloseTo(140,8);
  expect(current.vectorPath.commands).toHaveLength(original.vectorPath.commands.length);
  for(let i=0;i<original.vectorPath.commands.length;i++){
    const before=original.vectorPath.commands[i],after=current.vectorPath.commands[i];expect(after.op).toBe(before.op);if(before.op==='Z')continue;
    for(const [axis,origin,extent]of [['x','x','width'],['y','y','height']])for(const key of [axis,axis+'1',axis+'2'])if(typeof before[key]==='number'){
      const seam=key===axis&&before.x===original.vectorPath.commands[0].x&&before.y===original.vectorPath.commands[0].y;
      const firstOutgoing=i===1&&key===axis+'1';
      expect(current[origin]+after[key]*current[extent]).toBeCloseTo(original[origin]+before[key]*original[extent]+(seam||firstOutgoing?(axis==='x'?20:10):0),8);
    }
  }
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('pen-undo.rea.json')).toEqual(created);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save('pen-redo.rea.json')).toEqual(edited);
  const projectFile = path.join(userData, 'pen-edited.rea.json');
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, projectFile);
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
  await expect(page.locator('.statusbar')).toContainText('Document opened');
  expect(await save('pen-reopened.rea.json')).toEqual(edited);
  const expectedD = current.vectorPath.commands.map(command => {
    if (command.op === 'Z') return 'Z';
    const end = `${command.x * current.width} ${command.y * current.height}`;
    return command.op === 'C' ? `C ${command.x1 * current.width} ${command.y1 * current.height} ${command.x2 * current.width} ${command.y2 * current.height} ${end}` : `${command.op} ${end}`;
  }).join(' ');
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await expect(page.locator('.preview-page .widget-vector [data-shadow-fill]')).toHaveAttribute('d', expectedD);
  await expect(page.locator('.preview-page .widget-vector [data-shadow-fill]')).toHaveAttribute('fill-rule', current.vectorPath.fillRule);
  await capture('vector-editing-preview.png');
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const htmlFile = path.join(userData, 'pen-edited.html');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, htmlFile);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const nextWindow = app.waitForEvent('window');
  const id = await app.evaluate(({ BrowserWindow }) => { const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void window.loadURL('about:blank'); return window.id; });
  const offline = await nextWindow;
  try {
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id, url: pathToFileURL(htmlFile).href });
    await expect(offline.locator('main .widget-vector [data-shadow-fill]')).toHaveAttribute('d', expectedD);
    expect(await offline.locator('main .widget-vector [data-shadow-fill]').evaluate(element => element.getTotalLength())).toBeGreaterThan(300);
    await expect(offline.getByRole('alert')).toHaveText('');
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('pen-after-preview-export.rea.json')).toEqual(edited);
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  await fs.copyFile(projectFile, path.join(root, 'artifacts', 'pen-demo.rea.json'));
  await fs.copyFile(htmlFile, path.join(root, 'artifacts', 'pen-demo.html'));
  Object.assign(audit, { ok: true, penDrawing: true, canvasPointEditing: true, atomicUndoRedo: true, nativeSaveOpen: true, previewAndOffline: true, projectSha256: hash(await fs.readFile(projectFile)), htmlSha256: hash(await fs.readFile(htmlFile)), expectedD });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally {
  if (app) await app.close();
  audit.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(root, '.build', 'vector-editing-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}
