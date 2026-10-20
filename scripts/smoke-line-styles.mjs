import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-line-styles-'));
const source = path.join(root, 'artifacts/line-style-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes);
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, sourceSha256: sha(sourceBytes), userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1350); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async name => { const file = path.join(userData, name); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target = page) => {
    // capturePage can otherwise return the compositor frame from before the last
    // click even after computed styles have updated in a hidden window.
    await app.evaluate(({ BrowserWindow }, id) => { const w = BrowserWindow.fromId(id); w.webContents.setBackgroundThrottling(false); w.webContents.invalidate(); }, id);
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  // Hidden OOPIF input requires a compositor frame after any scroll; preserve real pointer input.
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); const window = await app.browserWindow(locator.page()); await window.evaluate(async w => (await w.webContents.capturePage(undefined, { stayHidden: true })).toPNG().length); await window.dispose(); await locator.click(); };
  await open(source); expect(await save('initial.rea.json')).toEqual(authored);
  const canvas = page.locator('.editor-widget').filter({ hasText: 'Top + bottom' }); await canvas.click();
  const inspector = page.locator('.inspector'); await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Line pattern', { exact: true })).toHaveValue('long-dash');
  await inspector.getByLabel('Line pattern', { exact: true }).selectOption('dot');
  const edited = await save('edited.rea.json');
  const expected = structuredClone(authored); expected.pages[0].widgets.find(w => w.id === 'line-sides').style.linePattern = 'dot'; expect(edited).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo.rea.json')).toEqual(authored);
  await capture('artifacts/line-style-editor.png', mainId);
  const patterns = { solid: [], 'long-dash': [68,32], 'medium-dash': [36,16], 'short-dash': [12,4], 'dash-dot': [36,16,8,16], 'dash-dot-dot': [36,16,8,16,8,16], 'long-dash-short-dash': [68,16,20,16], dot: [4,4], none: [0] };
  const dash = async locator => { const value=await locator.getAttribute('stroke-dasharray'); return !value || value==='none' ? [] : value.split(/[ ,]+/).filter(Boolean).map(Number); };
  const borderShape = locator => locator.evaluate(element=>{
    const explicit=element.querySelector('[data-shadow-stroke]');if(explicit)return JSON.stringify([...explicit.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)));
    const image=getComputedStyle(element).backgroundImage,match=image.match(/url\("?(data:image\/svg\+xml,[^"\)]+)"?\)/);
    if(!match)throw Error('No surface border SVG');const doc=new DOMParser().parseFromString(decodeURIComponent(match[1].slice('data:image/svg+xml,'.length)),'image/svg+xml');
    return [...doc.documentElement.children].filter(e=>e.tagName!=='defs').map(e=>e.outerHTML).join('');
  });
  const exercise = async scope => {
    const widget = id => scope.locator('[data-widget-id="'+id+'"]');
    for(const [pattern,expected] of Object.entries(patterns)) {
      const shaft=widget('line-pattern-'+pattern).locator('[data-line-shaft]'); await expect(shaft).toHaveCount(1); expect(await dash(shaft)).toEqual(expected);
      if(pattern==='none')await expect(shaft).toHaveAttribute('stroke-width','0');
    }
    const arrow=widget('line-arrow'),sides=widget('line-sides'),vector=widget('line-vector');
    for(const end of ['start','end'])expect(await arrow.locator('[data-line-arrow="'+end+'"]').count()).toBeGreaterThan(0);
    await expect(arrow.locator('[data-line-shaft]')).toHaveAttribute('stroke',/^url\(#/);
    await expect(vector.locator('[data-line-shaft]')).toHaveAttribute('stroke',/^url\(#/);
    expect(await vector.locator('[data-line-arrow="end"]').count()).toBeGreaterThan(0);
    await expect(widget('line-input').locator('input')).toHaveValue('Type here');
    await expect(widget('line-image')).toHaveCSS('border-top-style','dotted');
    await expect(widget('line-row')).toHaveCount(2);
    const rows=await widget('line-row').locator('linearGradient').evaluateAll(elements=>elements.map(e=>e.id));expect(rows.length).toBeGreaterThanOrEqual(4);expect(new Set(rows).size).toBe(rows.length);
    const before={d:await borderShape(sides),size:await sides.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),paint:await arrow.locator('[data-line-shaft]').getAttribute('stroke')};
    await click(widget('line-reset'));await expect(arrow.locator('[data-line-arrow]')).toHaveCount(0);await expect(vector.locator('[data-line-arrow]')).toHaveCount(0);
    expect(await dash(widget('line-pattern-long-dash').locator('[data-line-shaft]'))).toEqual([]);
    expect(await borderShape(sides)).not.toBe(before.d);
    await expect(arrow.locator('[data-line-shaft]')).toHaveAttribute('stroke',before.paint);
    await click(widget('line-restore'));expect(await arrow.locator('[data-line-arrow="end"]').count()).toBeGreaterThan(0);
    expect(await borderShape(sides)).toBe(before.d);
    expect(await sides.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))).toEqual(before.size);
    expect(await dash(widget('line-pattern-long-dash').locator('[data-line-shaft]'))).toEqual(patterns['long-dash']);
  };
  const gallery = async scope => {
    const styles=authored.pages.find(p=>p.id==='line-gallery-page').widgets.filter(w=>w.type==='line'); expect(styles.length).toBe(29);
    for(const item of styles){const rendered=scope.locator('[data-widget-id="'+item.id+'"]');
      if(item.style.lineEnds.start==='none')await expect(rendered.locator('[data-line-arrow]')).toHaveCount(0);
      else for(const end of ['start','end']) { const paths=rendered.locator('[data-line-arrow="'+end+'"]');expect(await paths.count()).toBeGreaterThan(0);expect(await paths.evaluateAll(elements=>elements.every(e=>{const box=e.getBBox();return box.width>0&&box.height>0&&!/NaN|Infinity/.test(e.outerHTML)}))).toBe(true); }
    }
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); await exercise(preview);
  await capture('artifacts/line-style-preview.png', mainId);
  await preview.locator('[data-page-id="line-gallery-page"]').click(); await gallery(preview); await capture('artifacts/line-style-gallery.png',mainId);
  await preview.locator('[data-page-id="line-frame-page"]').click(); const nested = preview.frameLocator('iframe[data-inline-frame="line-frame"]'); await exercise(nested);
  audit.fixedFramePlayer = true; await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save('after-preview.rea.json')).toEqual(authored);
  const exported = path.join(root, 'artifacts/line-style-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1350, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(1600, 1350); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href }); await exercise(offline.locator('body'));
    await capture('artifacts/line-style-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Endpoint gallery', exact: true }).click(); await gallery(offline.locator('body'));
    await offline.locator('nav').getByRole('button', { name: 'Embedded lines', exact: true }).click(); await exercise(offline.frameLocator('iframe[data-inline-frame="line-frame"]'));
    audit.offlineNestedPlayer = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline.rea.json')).toEqual(authored);
  const nativeSample=JSON.parse(await fs.readFile(path.join(root,'research/line-style-import-audit.json'),'utf8')).samples.find(sample=>sample.file.endsWith('Default.rplib'));
  expect(nativeSample.arrows.length).toBe(2); expect(sha(await fs.readFile(nativeSample.file))).toBe(nativeSample.sha256);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},nativeSample.file);
  await menu('Import Axure .rp (experimental)…');const report=page.getByRole('dialog',{name:'RP import report',exact:true});
  await expect(report).toContainText(`${nativeSample.import.pagesImported} page(s), ${nativeSample.import.widgetsImported} recovered widget(s), ${nativeSample.import.widgetsSkipped} skipped item(s).`);
  await report.getByRole('button',{name:'Close report',exact:true}).click();
  const native=await save('native-lines.rea.json');
  for(const item of nativeSample.arrows){const owner=native.pages.find(p=>p.widgets.some(w=>w.id===item.id));expect(owner).toBeTruthy();expect(owner.widgets.find(w=>w.id===item.id).style.lineEnds).toEqual({start:'none',end:'filled-triangle'});}
  await open(path.join(userData,'native-lines.rea.json'));expect(await save('native-lines-reopened.rea.json')).toEqual(native);
  await page.getByTitle('Preview (F5)',{exact:true}).click();
  for(const item of nativeSample.arrows){const owner=native.pages.find(p=>p.widgets.some(w=>w.id===item.id));await preview.locator(`[data-page-id="${owner.id}"]`).click();const rendered=preview.locator(`[data-widget-id="${item.id}"]`);
    await expect(rendered.locator('[data-line-shaft]')).toHaveCount(1);expect(await rendered.locator('[data-line-arrow="end"]').count()).toBeGreaterThan(0);
    expect(await rendered.locator('[data-line-arrow="end"]').evaluateAll(elements=>elements.every(e=>{const b=e.getBBox();return b.width>0&&b.height>0}))).toBe(true);
  }
  await capture('artifacts/line-style-native-preview.png',mainId);await preview.getByRole('button',{name:'Close preview',exact:true}).click();
  audit.native={file:nativeSample.file,sha256:nativeSample.sha256,arrowWidgets:2,workerImport:true,saveReopen:true,actualSvgPaint:true};
  expect(sha(await fs.readFile(nativeSample.file))).toBe(nativeSample.sha256);await open(source);
  expect(await save('final.rea.json')).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/line-style-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
