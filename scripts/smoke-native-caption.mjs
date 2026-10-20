import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const diagnostic = process.env.REA_CAPTION_DIAGNOSTIC === '1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-native-caption-'));
const auditFile = path.join(root, diagnostic ? '.build/native-caption-desktop-diagnostic.json' : '.build/native-caption-desktop-audit.json');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'research/rp-input-types-evidence.json'), 'utf8'));
const sample = manifest.samples.find(sample => path.basename(sample.file) === 'Sample form patterns.rplib');
const source = path.resolve(root, sample.file), sourceSha = sha(await fs.readFile(source));
expect(sourceSha).toBe('1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
const prefix = 'rp-w-784fffad1a36482594f6f965760990d6-';
const captions = [
  ['521d7ce3a85d4cf0a40f3934f8677b75', 'First name*', 78],
  ['dd95d9e7839f43bb811c83f46238249a', 'Last name*', 76],
  ['0f045efac5b24769857e5ac8f794f50a', 'Email address*', 101],
  ['c1b87b64b81c4dcab59309167dc6b268', 'Phone number', 97],
  ['c2a9b16835bd4d008aaf88e0b6b5ee2f', 'Date of birth', 83],
  ['739c2aaee48f40b88062ae1a48534bd6', 'Country / Region', 112],
  ['a2c769440f514b97b07eb58d67180cd9', 'Street address', 97],
  ['3057b27358d54974bd35fa392ccca3c9', 'City', 26],
  ['d8d23bfff7314a6ca9331c1bc5e50c1d', 'State / Province', 107],
  ['3eee678743e24793a67aa4d4adae81c6', 'ZIP / Postal', 79],
];
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, userData, source, sourceSha256: sourceSha,
  errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false,
  boundary: 'Exact shipped library is supplied through mocked OS picker. DOM character rectangles measure wrapping; font line boxes are not treated as painted glyph bounds. No original GUI or raster equivalence claim.' };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message));
  app.on('window', observe); await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setContentSize(1600, 1100); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const save = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  const capture = async (name, id, target) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const data = await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id);
    const bytes = Buffer.from(data, 'base64'), file = path.join(root, 'artifacts', name); expect(bytes.length).toBeGreaterThan(1000);
    await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
  await menu('Import Axure .rp (experimental)…');
  const report = page.getByRole('dialog', { name: 'RP import report', exact: true }); await expect(report).toBeVisible({ timeout: 20000 });
  audit.importReport = await report.innerText(); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const saved = path.join(userData, 'native-caption.rea.json'), doc = await save(saved);
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'research/native-caption-before.rea.json'), 'utf8'));
  const targetPage = doc.pages.find(p => p.name === 'Personal information form'), oldPage = baseline.pages.find(p => p.name === 'Personal information form');
  for (const [id, text, width] of captions) {
    const w = targetPage.widgets.find(w => w.id === prefix + id), old = oldPage.widgets.find(w => w.id === prefix + id);
    expect(w).toMatchObject({ text, width, height: 16, x: old.x, y: old.y, style: { fontFamily: 'Roboto', fontSize: 14, strokeWidth: 0, textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' } });
  }
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, saved);
  await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); expect(await save(path.join(userData, 'reopened.rea.json'))).toEqual(doc);
  await page.locator('.left-pane').getByRole('button', { name: 'Pages', exact: true }).click(); await page.locator(`[data-page-node-id="${targetPage.id}"]`).dblclick();
  const check = async scope => {
    const measurements = [];
    for (const [id, text, width] of captions) {
      const item = scope.locator(`[data-widget-id="${prefix + id}"]`), span = item.locator('.widget-text');
      await span.evaluate(async element => { await document.fonts.load(getComputedStyle(element).font, element.textContent); await document.fonts.ready; });
      await expect(span).toHaveText(text); await expect(item).toHaveCSS('border-width', '0px'); await expect(span).toHaveCSS('padding', '0px'); await expect(span).toHaveCSS('line-height', 'normal'); await expect(span).toHaveCSS('align-items', 'normal'); await expect(span).toHaveCSS('align-self', 'flex-start'); await expect(span).toHaveCSS('overflow', 'visible');
      await expect(item.locator('svg.widget-vector [data-shadow-stroke]')).toHaveAttribute('stroke-width', '0'); await expect(item.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill', 'rgba(255, 255, 255, 0)');
      const measured = await item.evaluate(element => {
        const span = element.querySelector('.widget-text'), outer = element.getBoundingClientRect(), walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT), rects = [];
        while (walker.nextNode()) { const node = walker.currentNode; for (let i = 0; i < node.textContent.length; i++) { const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1); const b = range.getBoundingClientRect(); if (b.width) rects.push({ left: b.left - outer.left, right: b.right - outer.left, top: b.top - outer.top, bottom: b.bottom - outer.top }); } }
        const css = getComputedStyle(span), context = document.createElement('canvas').getContext('2d'); context.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
        const metrics = context.measureText(span.textContent), top = Math.min(...rects.map(r => r.top));
        return { width: outer.width, height: outer.height, lines: new Set(rects.map(r => Math.round(r.top * 100) / 100)).size, left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top, bottom: Math.max(...rects.map(r => r.bottom)), font: css.font, fontFamily: css.fontFamily, fontSize: css.fontSize, canvasMetrics: {ascent: metrics.fontBoundingBoxAscent, descent: metrics.fontBoundingBoxDescent, inkAscent: metrics.actualBoundingBoxAscent, inkDescent: metrics.actualBoundingBoxDescent}, estimatedInkTop: top + metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent, estimatedInkBottom: top + metrics.fontBoundingBoxAscent + metrics.actualBoundingBoxDescent };
      });
      (audit.measurementAttempts ??= []).push({ id: prefix + id, text, ...measured });
      expect(measured.width).toBe(width); expect(measured.height).toBe(16);
      if (!diagnostic) { expect(measured.lines).toBe(1); expect(measured.left).toBeGreaterThanOrEqual(-0.01); expect(measured.right).toBeLessThanOrEqual(width + 0.1); expect(measured.estimatedInkTop).toBeGreaterThanOrEqual(-0.05); expect(measured.estimatedInkBottom).toBeLessThanOrEqual(16.05); }
      // Record this host's line and ink metrics separately: Edge's font-box
      // height is not a valid expectation for the packaged Electron host.
      expect(measured.top).toBeGreaterThanOrEqual(-0.05);
      measurements.push({ id: prefix + id, text, ...measured });
    }
    return measurements;
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.preview = await check(page.locator('.preview-page')); await capture('native-caption-desktop.png', mainId, page);
  const cdp = await app.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const dom = await cdp.send('DOM.getDocument'), fontNode = await cdp.send('DOM.querySelector', {nodeId: dom.root.nodeId, selector: `.preview-page [data-widget-id="${prefix + captions[0][0]}"] .widget-text`});
  audit.packagedCaptionFonts = (await cdp.send('CSS.getPlatformFontsForNode', {nodeId: fontNode.nodeId})).fonts; await cdp.detach();
  if (!diagnostic) expect(audit.packagedCaptionFonts.some(font => font.isCustomFont && font.postScriptName === 'Roboto-Regular')).toBe(true);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(path.join(userData, 'after-preview.rea.json'))).toEqual(doc);
  const html = path.join(userData, 'native-caption.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported'); await app.context().setOffline(true);
  const pending = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(html).href });
    await offline.getByRole('button', { name: targetPage.name, exact: true }).click(); audit.offline = await check(offline); await capture('native-caption-desktop-offline.png', offlineId, offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after-export.rea.json'))).toEqual(doc); expect(sha(await fs.readFile(source))).toBe(sourceSha);
  await fs.copyFile(saved, path.join(root, 'artifacts/native-caption-demo.rea.json')); await fs.copyFile(html, path.join(root, 'artifacts/native-caption-demo.html'));
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: !diagnostic, diagnosticOnly: diagnostic, sourceUnchanged: true, designUnchanged: true, savedAndReopened: true, storedCaptionGeometryUnchanged: true, tenCaptionsSingleLine: [...audit.preview, ...audit.offline].every(m => m.lines === 1), hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(auditFile, JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
