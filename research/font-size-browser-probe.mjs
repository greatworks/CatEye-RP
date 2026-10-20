import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const executablePath = path.join(root, 'release/REA Prototype Studio-win32-x64/REA Prototype Studio.exe');
const nativeFile = path.join(root, 'research/samples/UX Prototyping.rp');
const fontFile = String.raw`C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\Fonts\OpenSans-Bold.ttf`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = async file => ({ file, sha256: sha(await fs.readFile(file)) });
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-font-size-'));
const audit = { ok: false, startedAt: new Date().toISOString(), method: 'Actual fixed packaged Electron Worker import, save/reopen/preview. Original font and candidate sizes injected into isolated DOM only, not a product fix. CDP identifies actual glyph fonts; Range measures line wrapping and clipping. No original Axure GUI comparison.', userData, errors: [], network: [], stages: [], sources: await Promise.all([nativeFile, fontFile, executablePath, path.join(path.dirname(executablePath), 'resources/app.asar')].map(manifest)) };
let app;
try {
  app = await electron.launch({ executablePath, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); page.on('pageerror', e => audit.errors.push(e.message));
  await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1250); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, nativeFile);
  await menu('Import Axure .rp (experimental)…');
  const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
  await expect(report).toContainText('129 recovered widget(s)'); audit.importReport = await report.innerText();
  await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const savedFile = path.join(root, 'research/font-size-imported-before.rea.json');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, savedFile);
  await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Saved font-size-imported-before.rea.json');
  const savedBytes = await fs.readFile(savedFile), doc = JSON.parse(savedBytes); audit.imported = { file: savedFile, sha256: sha(savedBytes) };
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, savedFile);
  await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened');
  const targetPages = doc.pages.filter(p => ['Problems and ideas', 'Sample problems and ideas'].includes(p.name));
  const owners = targetPages.flatMap(p => p.widgets.filter(w => ['Problems', 'Ideas'].includes(w.text)).map(w => ({ pageId: p.id, page: p.name, widget: w })));
  expect(owners).toHaveLength(4); audit.owners = owners;
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const cdp = await app.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const collect = async name => {
    const stage = { name, pages: [] };
    for (const p of targetPages) {
      await page.locator(`.preview-overlay [data-page-id="${p.id}"]`).click(); await page.evaluate(() => document.fonts.ready);
      const labels = [];
      for (const { widget: w } of owners.filter(o => o.pageId === p.id)) {
        const selector = `.preview-page [data-widget-id="${w.id}"]`;
        const metrics = await page.locator(selector).evaluate(element => {
          const rect = r => ({ x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom });
          const clip = element.getBoundingClientRect(), run = element.querySelector('[data-rich-run]'), css = getComputedStyle(run), parentCss = getComputedStyle(element);
          const range = document.createRange(); range.selectNodeContents(run);
          const textRects = [...range.getClientRects()].map(rect), node = run.firstChild, chars = [];
          for(let i=0; node && i<node.textContent.length; i++) { range.setStart(node,i); range.setEnd(node,i+1); chars.push({ text:node.textContent[i], ...rect(range.getBoundingClientRect()) }); }
          const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.font = css.font;
          const measured = ctx.measureText(run.textContent);
          const lineYs = [...new Set(chars.map(c=>c.y))];
          return { text:run.textContent, widget:rect(clip), css:{font:css.font,fontFamily:css.fontFamily,fontSize:css.fontSize,fontWeight:css.fontWeight,lineHeight:css.lineHeight,overflowWrap:css.overflowWrap}, parentFont:parentCss.font, textRects, chars, lineCount:lineYs.length, maxCharacterClipping:{left:Math.max(0,...chars.map(c=>clip.x-c.x)),right:Math.max(0,...chars.map(c=>c.right-clip.right)),top:Math.max(0,...chars.map(c=>clip.y-c.y)),bottom:Math.max(0,...chars.map(c=>c.bottom-clip.bottom))}, canvasTextWidth:measured.width, fontCheck:document.fonts.check(`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`) };
        });
        const { root: documentRoot } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: `${selector} [data-rich-run]` });
        metrics.platformFonts = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
        labels.push({ id: w.id, ...metrics });
      }
      const file = `research/font-size-${name}-${stage.pages.length}.png`;
      await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), mainId);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), mainId), 'base64');
      await fs.writeFile(path.join(root, file), bytes); stage.pages.push({ page:p.name, labels, screenshot:{file,sha256:sha(bytes)} });
    }
    audit.stages.push(stage);
  };
  await collect('baseline-28');
  const fontUrl = `data:font/ttf;base64,${(await fs.readFile(fontFile)).toString('base64')}`;
  await page.evaluate(async url => { const face=new FontFace('REA Probe Open Sans',`url(${url})`,{weight:'700',style:'normal'}); await face.load(); document.fonts.add(face); }, fontUrl);
  const ids = owners.map(o=>o.widget.id);
  for (const size of [28,21,20]) {
    await page.evaluate(({ids,size})=>{ let sheet=document.getElementById('font-size-experiment'); if(!sheet){sheet=document.createElement('style');sheet.id='font-size-experiment';document.head.append(sheet);} sheet.textContent=ids.map(id=>`[data-widget-id="${id}"], [data-widget-id="${id}"] [data-rich-run]{font-family:"REA Probe Open Sans"!important;font-size:${size}px!important}`).join('\n'); },{ids,size});
    await collect(`native-font-${size}`);
  }
  await page.evaluate(()=>document.getElementById('font-size-experiment').remove()); await collect('restored-28');
  await cdp.detach();
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  const afterFile=path.join(userData,'font-size-after.rea.json');
  await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},afterFile);
  await page.getByTitle('Save',{exact:true}).click(); await expect(page.locator('.statusbar')).toContainText('Saved font-size-after.rea.json');
  expect(JSON.parse(await fs.readFile(afterFile,'utf8'))).toEqual(doc);
  for(const source of audit.sources) expect((await manifest(source.file)).sha256).toBe(source.sha256);
  expect(audit.errors).toEqual([]);expect(audit.network).toEqual([]);
  audit.designUnchanged=true; audit.ok=true;
} catch(error) { audit.failure=error.message; process.exitCode=1; }
finally { if(app) await app.close(); audit.finishedAt=new Date().toISOString(); await fs.writeFile(path.join(root,'research/font-size-browser-probe.json'),JSON.stringify(audit,null,2)+'\n'); console.log(JSON.stringify({ok:audit.ok,failure:audit.failure,stages:audit.stages.map(s=>({name:s.name,labels:s.pages.flatMap(p=>p.labels.map(l=>({text:l.text,font:l.css.fontSize,actual:l.platformFonts.map(f=>f.postScriptName),width:l.canvasTextWidth,lines:l.lineCount,clipping:l.maxCharacterClipping})))}))},null,2)); }
