import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = [
  { name: 'Quick Win.rp', sha256: '04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051', widgets: 35, skipped: 7, width: 1200, height: 900, bytes: 15232, imageHash: '12212b85d5f88d3b5a83ceccddfb912750c8f5d2cbc49552585dc2701d8dc178' },
  { name: 'UX Prototyping.rp', sha256: '1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72', widgets: 129, skipped: 24, width: 1064, height: 912, bytes: 21063, imageHash: 'b879d0524ee695756c6eab1e0bdd40b4ef540cc44b169dc8e6de146beec2af36' },
];
await fs.mkdir(path.join(root, '.build'), { recursive: true });
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const userData = await fs.mkdtemp(path.join(root, '.build', 'rp-images-user-'));
const app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
const results = [];
try {
  const page = await app.firstWindow(), errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  await app.context().route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.locator('.application').waitFor();
  for (const fixture of fixtures) {
    const source = path.join(root, 'research', 'samples', fixture.name);
    expect(digest(await fs.readFile(source))).toBe(fixture.sha256);
    // Mock only OS picker responses. File reading, Worker, parser, IPC and conversion remain real.
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Import Axure .rp (experimental)…', exact: true }).click();
    const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(`${fixture.widgets} recovered widget(s), ${fixture.skipped} skipped item(s).`);
    await expect(report).toContainText(fixture.sha256);
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const savedFile = path.join(userData, `${fixture.name}.rea.json`);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, savedFile);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(savedFile)}`);
    const document = JSON.parse(await fs.readFile(savedFile, 'utf8'));
    const images = document.pages.flatMap(p => p.widgets).filter(w => w.type === 'image');
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image.imageSrc).toMatch(/^data:image\/png;base64,/);
      const bytes = Buffer.from(image.imageSrc.slice(22), 'base64');
      expect(bytes.length).toBe(fixture.bytes); expect(digest(bytes)).toBe(fixture.imageHash);
    }
    // Reopen the saved project, then verify decoded pixels in the editor and preview.
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, savedFile);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened');
    const imagePage = document.pages.find(p => p.widgets.some(w => w.type === 'image'));
    await page.locator('.pages-pane .tree-list').getByRole('button', { name: imagePage.name, exact: true }).dblclick();
    const decoded = async locator => {
      await expect.poll(() => locator.evaluate(img => ({ complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }))).toEqual({ complete: true, width: fixture.width, height: fixture.height });
      expect(await locator.getAttribute('src')).toBe(images[0].imageSrc);
    };
    await decoded(page.locator('.canvas-surface img').first());
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    await decoded(page.locator('.preview-page img').first());
    await page.locator('.preview-page img').first().scrollIntoViewIfNeeded();
    if (!results.length) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const screenshot = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
      await fs.writeFile(path.join(root, 'artifacts', 'rp-image-preview.png'), Buffer.from(screenshot, 'base64'));
    }
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    const htmlFile = path.join(userData, `${fixture.name}.html`);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, htmlFile);
    await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Exported');
    // A second hidden, sandboxed window opens the actual exported file with HTTP blocked.
    const nextWindow = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow }, url) => {
      const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      void window.loadURL(url);
    }, pathToFileURL(htmlFile).href);
    const offline = await nextWindow;
    offline.on('pageerror', error => errors.push(error.message));
    await offline.waitForLoadState('domcontentloaded');
    await offline.locator('nav').getByRole('button', { name: imagePage.name, exact: true }).click();
    await decoded(offline.locator('main img').first());
    await offline.close();
    expect(digest(await fs.readFile(source))).toBe(fixture.sha256);
    results.push({ file: fixture.name, widgets: fixture.widgets, skipped: fixture.skipped, images: 2, originalBytesPreserved: true, nativeSaveOpen: true, editorPreviewAndOfflineDecoded: true });
  }
  expect(errors).toEqual([]); expect(network).toEqual([]);
  console.log(JSON.stringify({ ok: true, results, unexpectedNetworkRequests: network.length, originalAxureVisualComparison: false }, null, 2));
} finally { await app.close(); }
