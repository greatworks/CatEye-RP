import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-font-style-'));
const source = path.join(root, 'artifacts/font-style-demo.rea.json'), sourceSha256 = sha(await fs.readFile(source));
const authored = JSON.parse(await fs.readFile(source, 'utf8'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256, userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', e => audit.errors.push(e.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1100); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  const faces = [[100, 'Thin'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']];
  const inspectFonts = async (target, scope) => {
    await target.evaluate(async weights => { await Promise.all(['normal','italic'].flatMap(style => weights.map(weight => document.fonts.load(`${style} ${weight} 24px Roboto`)))); await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, faces.map(([weight]) => weight));
    const cdp = await target.context().newCDPSession(target), result = [];
    try {
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root: documentNode } = await cdp.send('DOM.getDocument');
      let index = 0;
      for (const style of ['normal','italic']) for (const [weight, name] of faces) {
        const selector = scope === '.canvas-surface' ? `${scope} > .editor-widget:nth-child(${index + 3}) > .widget-text` : `${scope} [data-widget-id="face-${style}-${weight}"] > .widget-text`;
        index++;
        await expect(target.locator(selector)).toHaveCSS('font-style', style);
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentNode.nodeId, selector }); expect(nodeId).toBeGreaterThan(0);
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        const postScriptName = `Roboto-${style === 'normal' ? name : name === 'Regular' ? 'Italic' : `${name}Italic`}`;
        expect(fonts.length).toBeGreaterThan(0); expect(fonts.every(font => font.isCustomFont && font.postScriptName === postScriptName)).toBe(true); result.push({ style, weight, postScriptName, fonts });
      }
    } finally { await cdp.detach(); }
    return result;
  };
  const behavior = async scope => {
    const target = scope.locator('[data-widget-id="action-target"]'), child = scope.locator('[data-widget-id="legacy-child"]'), panel = scope.locator('[data-widget-id="italic-panel"]');
    await expect(target).toHaveCSS('font-style','italic'); await expect(target).toHaveCSS('font-weight','700');
    await expect(panel).toHaveCSS('font-style','italic'); await expect(child).toHaveCSS('font-style','normal');
    await target.hover(); await expect(target).toHaveCSS('font-style','normal');
    await scope.locator('[data-widget-id="make-normal"]').click(); await expect(target).toHaveCSS('font-style','normal');
    await scope.locator('[data-widget-id="make-italic"]').click(); await expect(target).toHaveCSS('font-style','italic');
    await target.hover(); await expect(target).toHaveCSS('font-style','normal');
    await scope.locator('[data-widget-id="heading"]').hover(); await expect(target).toHaveCSS('font-style','italic');
    await expect(target).toHaveCSS('font-weight','700');
    return { independentWeight: true, normalActionReset: true, italicAction: true, hoverNormalReset: true, pointerLeaveRestoresBase: true, legacyChildNormal: true };
  };
  await open(source); expect(await save(path.join(userData,'reopened.rea.json'))).toEqual(authored);
  audit.editorFonts = await inspectFonts(page,'.canvas-surface');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.previewFonts = await inspectFonts(page,'.preview-page'); audit.preview = await behavior(page.locator('.preview-page')); await capture('artifacts/font-style-desktop.png',mainId,page);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(path.join(userData,'after-preview.rea.json'))).toEqual(authored);
  const html = path.join(root,'artifacts/font-style-demo.html');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button',{name:'Export HTML',exact:true}).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  const exported = await fs.readFile(html,'utf8'); expect((exported.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(12); expect(exported).toContain('Apache License');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({show:false,width:1600,height:1100,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}}); void w.loadURL('about:blank'); return w.id; }), target = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), {id:offlineId,url:pathToFileURL(html).href});
    audit.offlineFonts = await inspectFonts(target,'main'); audit.offline = await behavior(target.locator('main')); await capture('artifacts/font-style-offline.png',offlineId,target);
  } finally { await target.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData,'after-export.rea.json'))).toEqual(authored);
  expect(sha(await fs.readFile(source))).toBe(sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w=>!w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath),'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit,{ok:true,sourceUnchanged:true,designUnchanged:true,savedAndReopened:true,hiddenWindows:true});
} catch(error) {audit.failure=error.stack??String(error);throw error;}
finally {try {if(app)await app.close();} finally {audit.finishedAt=new Date().toISOString();await fs.writeFile(path.join(root,'.build/font-style-desktop-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));}}
