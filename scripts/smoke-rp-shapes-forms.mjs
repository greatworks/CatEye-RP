import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = async file => digest(await fs.readFile(file));
const fixtures = [
  { name: 'Default.rplib', sha256: '9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50', pages: 40, top: 34, skipped: 6, nested: 25, ellipses: 2, textareas: 1 },
  { name: 'Flow.rplib', sha256: '95d85ffaddac36144ae8ebd645341b2e557f0a6157b092319e7dac7b71d9d451', pages: 37, top: 21, skipped: 16, nested: 0, ellipses: 1, textareas: 0 },
  { name: 'Prototyping Basics.rp', sha256: '26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7', pages: 1, top: 173, skipped: 26, nested: 52, ellipses: 52, textareas: 0 },
];
const walk = widgets => widgets.flatMap(widget => [widget, ...walk((widget.states ?? []).flatMap(state => state.widgets)), ...walk(widget.repeater?.template ?? []), ...walk(widget.table?.cells ?? []), ...walk(widget.menu ? [widget.menu.table, ...widget.menu.submenus] : []), ...walk(widget.tree?.nodes ?? []), ...walk(widget.treeNode ? [widget.treeNode.label, ...widget.treeNode.children] : [])]);
const activeEllipses = widgets => widgets.flatMap(widget => widget.hidden ? [] : [
  ...(widget.type === 'ellipse' ? [widget] : []),
  ...activeEllipses(widget.type === 'panel' ? (widget.states?.find(state => state.id === widget.activeStateId) ?? widget.states?.[0])?.widgets ?? [] : []),
]);
const literalInput = '中文输入 🙂\n第二行 [[literal]]\n[[UserName]]';
await fs.mkdir(path.join(root, '.build'), { recursive: true });
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-rp-shapes-forms-'));
const auditPath = path.join(root, '.build', 'rp-shapes-forms-desktop-audit.json');
const audit = {
  ok: false, timestamp: new Date().toISOString(), executablePath: executablePath ?? null, userData,
  bundleHash: null, bundleHashKind: null, sourceHashes: {}, results: [], screenshots: [], network: [], errors: [],
  pickerSelectionMocked: true, originalAxureGuiComparison: false,
  limitations: [
    'Only OS picker responses are mocked; file bytes, Worker, parser, IPC, model conversion and export are real.',
    'Native picker currently filters .rp; this test supplies Default.rplib directly and does not assert chooser extension availability.',
    'Stored normalized vector geometry is rendered as SVG. Native stroke displacement, caps, arrowheads, join choices and pixel snapping are not reproduced.',
    'Prototyping Basics includes high Y coordinates beyond the recovered default page size; DOM presence is checked without claiming all objects are visible at once.',
  ],
};
let app;
try {
  if (executablePath) {
    const archive = path.join(path.dirname(executablePath), 'resources', 'app.asar');
    audit.bundleHash = await hashFile(archive); audit.bundleHashKind = 'resources/app.asar SHA-256';
  } else {
    const files = [];
    const collect = async relative => {
      for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
        const name = `${relative}/${entry.name}`;
        if (entry.isDirectory()) await collect(name); else if (entry.isFile()) files.push(name);
      }
    };
    await collect('dist'); await collect('desktop');
    files.push('package.json', ...['container', 'objects', 'interactions', 'semantics'].map(name => `research/scripts/read-rp-${name}.mjs`));
    const manifest = await Promise.all(files.sort().map(async file => [file, await hashFile(path.join(root, file))]));
    audit.bundleHash = digest(JSON.stringify(manifest)); audit.bundleHashKind = 'SHA-256 of sorted [relative-path,file-SHA256] launch-source manifest'; audit.bundleManifest = manifest;
  }
  for (const fixture of fixtures) {
    const file = path.join(root, 'research', 'samples', fixture.name);
    const before = await hashFile(file); expect(before).toBe(fixture.sha256); audit.sourceHashes[fixture.name] = { before };
  }
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet();
  const observe = page => { if (!observed.has(page)) { observed.add(page); page.on('pageerror', error => audit.errors.push(error.message)); } };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  const open = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened');
  };
  const save = async (file, expected) => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    const saved = JSON.parse(await fs.readFile(file, 'utf8')); if (expected) expect(saved).toEqual(expected); return saved;
  };
  const screenshot = async name => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const base64 = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
    const bytes = Buffer.from(base64, 'base64'), file = path.join(root, 'artifacts', name);
    expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: digest(bytes) });
  };
  const checkEllipse = async (scope, widget) => {
    const element = scope.locator(`[data-widget-id="${widget.id}"]`);
    await expect(element).toHaveCount(1); await expect(element).toHaveCSS('border-radius', '0px');
    await expect(element).toHaveCSS('border-width', '0px');
    const path = element.locator('svg.widget-vector [data-shadow-fill]');
    await expect(path).toHaveAttribute('fill-rule', 'nonzero');
    expect((await path.getAttribute('d')).match(/\bC\b/g)).toHaveLength(4);
    expect(await path.evaluate(node => node.getTotalLength())).toBeGreaterThan(widget.width * 2);
    const bounds = await element.evaluate(node => { const b = node.getBoundingClientRect(), s = getComputedStyle(node); return { width: b.width, height: b.height, left: s.left, top: s.top }; });
    expect(bounds.width).toBeCloseTo(widget.width, 3); expect(bounds.height).toBeCloseTo(widget.height, 3);
    expect(Number.parseFloat(bounds.left)).toBeCloseTo(widget.x, 3); expect(Number.parseFloat(bounds.top)).toBeCloseTo(widget.y, 3); return bounds;
  };
  const exercise = async (scope, nav, document, fixture, capture = false) => {
    const checkStoredPath = async name => {
      const sourcePage = document.pages.find(item => item.name === name), widget = sourcePage.widgets[0];
      expect(widget.type).toBe('path'); await nav.getByRole('button', { name, exact: true }).click();
      const path = scope.locator(`[data-widget-id="${widget.id}"] svg.widget-vector [data-shadow-fill]`);
      await expect(path).toHaveAttribute('fill-rule', widget.vectorPath.fillRule);
      const d = await path.getAttribute('d');
      const expected = widget.vectorPath.commands.map(c => c.op).join('');
      expect((d.match(/[MLCZ]/g) ?? []).join('')).toBe(expected);
      expect(await path.evaluate(node => node.getTotalLength())).toBeGreaterThan(0);
      return { name, storedCommands: widget.vectorPath.commands.length, subpaths: (d.match(/M/g) ?? []).length, closed: (d.match(/Z/g) ?? []).length };
    };
    if (fixture.name === 'Flow.rplib') {
      const checked = [];
      for (const name of ['Database', 'Actor', 'Stacked file']) checked.push(await checkStoredPath(name));
      if (capture) await screenshot('rp-compound-path-preview.png');
      return { checkedNativePaths: checked };
    }
    if (fixture.name === 'Default.rplib') {
      const checked = [];
      for (const [name, size] of [['Circle marker', 30], ['Ellipse', 170]]) {
        const sourcePage = document.pages.find(item => item.name === name), widget = sourcePage.widgets[0];
        expect(widget).toMatchObject({ type: 'ellipse', width: size, height: size, text: '' });
        await nav.getByRole('button', { name, exact: true }).click(); checked.push({ name, ...await checkEllipse(scope, widget) });
        if (capture && name === 'Ellipse') await screenshot('rp-ellipse-preview.png');
      }
      const paths = [];
      for (const name of ['Drop marker', 'Placeholder', 'Horizontal line']) paths.push(await checkStoredPath(name));
      expect(paths.find(p => p.name === 'Placeholder')).toMatchObject({ subpaths: 3, closed: 1 });
      expect(paths.find(p => p.name === 'Horizontal line')).toMatchObject({ closed: 0 });
      const tablePage=document.pages.find(item=>item.widgets.some(w=>w.type==='table')),table=tablePage.widgets.find(w=>w.type==='table');
      expect(table.table.cells).toHaveLength(9);expect(table.table.columnWidths).toEqual([100,100,100]);expect(table.table.rowHeights).toEqual([30,30,30]);
      await nav.getByRole('button',{name:tablePage.name,exact:true}).click();const grid=scope.locator(`[data-widget-id="${table.id}"]`);
      await expect(grid).toHaveCSS('width','300px');await expect(grid).toHaveCSS('height','90px');
      expect(await grid.locator('.tableCell').evaluateAll(cells=>cells.map(cell=>cell.getAttribute('data-widget-id')))).toEqual(table.table.cellOrder);
      for(const cell of table.table.cells){
        const dom=grid.locator(`[data-widget-id="${cell.id}"]`);await expect(dom).toHaveText(cell.text);await expect(dom).toHaveCSS('left',`${cell.x}px`);await expect(dom).toHaveCSS('top',`${cell.y}px`);
        // Chromium quantizes borders to physical pixels at fractional display scale.
        // Check the requested source width and the browser's own 1px reference separately.
        const border=await dom.evaluate(el=>{const reference=document.createElement('div');reference.style.border='1px solid black';el.parentElement.append(reference);const result={requested:el.style.borderTopWidth,actual:getComputedStyle(el).borderTopWidth,reference:getComputedStyle(reference).borderTopWidth};reference.remove();return result;});
        expect(border.requested).toBe('1px');expect(border.actual).toBe(border.reference);
      }
      if(capture)await screenshot('table-native-import-preview.png');
      const nativeMenus = [];
      for (const sourcePage of document.pages.filter(item => item.widgets.some(widget => widget.type === 'menu'))) {
        const menu = sourcePage.widgets.find(widget => widget.type === 'menu'), table = menu.menu.table;
        expect(menu.menu.submenus).toEqual([]); expect(menu.menu.padding).toEqual([0, 0, 0, 0]); expect(table.table.cells).toHaveLength(3);
        await nav.getByRole('button', { name: sourcePage.name, exact: true }).click();
        const container = scope.locator(`[data-widget-id="${menu.id}"]`), tableElement = container.locator(`[data-widget-id="${table.id}"]`);
        await expect(container).toHaveCSS('width', `${menu.width}px`); await expect(container).toHaveCSS('height', `${menu.height}px`);
        await expect(tableElement).toHaveCSS('left', '0px'); await expect(tableElement).toHaveCSS('top', '0px');
        expect(await tableElement.locator('.tableCell').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-widget-id')))).toEqual(table.table.cellOrder ?? table.table.cells.map(cell => cell.id));
        for (const cell of table.table.cells) { const element = tableElement.locator(`[data-widget-id="${cell.id}"]`); await expect(element).toHaveText(cell.text); await expect(element).toHaveCSS('left', `${cell.x}px`); await expect(element).toHaveCSS('top', `${cell.y}px`); await element.hover(); }
        nativeMenus.push({ orientation: menu.menu.orientation, cells: 3, wrapperAndTableIdentity: true, geometryAndObjectOrder: true, exactText: true });
        if (capture) await screenshot(`menu-native-${menu.menu.orientation}-preview.png`);
      }
      expect(nativeMenus.map(menu => menu.orientation).sort()).toEqual(['horizontal', 'vertical']);
      const treePage=document.pages.find(item=>item.widgets.some(w=>w.type==='tree')),nativeTreeRoot=treePage.widgets.find(w=>w.type==='tree');
      expect(treePage.name).toBe('Tree');expect(nativeTreeRoot).toMatchObject({x:100,y:100,width:95,height:80});
      const treeRows=[nativeTreeRoot.tree.nodes[0],...nativeTreeRoot.tree.nodes[0].treeNode.children],treeLabels=treeRows.map(n=>n.treeNode.label);
      expect(treeRows.map(n=>[n.x,n.y,n.width,n.height])).toEqual([[0,0,64,20],[20,20,75,20],[20,40,75,20],[20,60,75,20]]);
      expect(treeLabels.map(n=>[n.text,n.x,n.y,n.width,n.height])).toEqual([['Item 1',22,0,42,20],['Item 1.1',22,0,53,20],['Item 1.2',22,0,53,20],['Item 1.3',22,0,53,20]]);
      expect(new Set([nativeTreeRoot.id,...treeRows.map(n=>n.id),...treeLabels.map(n=>n.id)]).size).toBe(9);
      await nav.getByRole('button',{name:treePage.name,exact:true}).click();
      const treeElement=scope.locator(`[data-widget-id="${nativeTreeRoot.id}"]`);
      await expect(treeElement).toHaveCSS('width','95px');await expect(treeElement).toHaveCSS('height','80px');
      const assertTreeRows=async()=>{for(const node of [...treeRows,...treeLabels]){const element=treeElement.locator(`[data-widget-id="${node.id}"]`);await expect(element).toHaveCount(1);for(const [key,value] of Object.entries({left:node.x,top:node.y,width:node.width,height:node.height}))await expect(element).toHaveCSS(key,`${value}px`);}for(const label of treeLabels)await expect(treeElement.locator(`[data-widget-id="${label.id}"]`)).toHaveText(label.text);};
      await assertTreeRows();const toggle=treeElement.locator(`button[data-tree-toggle="${treeRows[0].id}"]`);await expect(toggle).toHaveAttribute('aria-expanded','true');await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
      for(const node of treeRows.slice(1))await expect(treeElement.locator(`[data-widget-id="${node.id}"]`)).toHaveCount(0);
      await expect(treeElement).toHaveCSS('width','95px');await expect(treeElement).toHaveCSS('height','80px');await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await assertTreeRows();
      await expect(treeElement).toHaveCSS('width','95px');await expect(treeElement).toHaveCSS('height','80px');if(capture)await screenshot('tree-widget-native-preview.png');
      const nativeTree={nodes:4,labels:4,identities:true,geometry:true,collapse:true};
      const framePage=document.pages.find(item=>item.name==='Inline frame'),nativeFrame=framePage.widgets.find(w=>w.type==='inlineFrame');
      expect(nativeFrame).toMatchObject({x:100,y:100,width:300,height:170,inlineFrame:{hideBorders:false,scrolling:'auto',preview:{kind:'none'}}});expect(nativeFrame.inlineFrame).not.toHaveProperty('target');expect(nativeFrame.style.strokeWidth).toBe(0);
      await nav.getByRole('button',{name:framePage.name,exact:true}).click();const frameWrapper=scope.locator(`[data-widget-id="${nativeFrame.id}"]`),frame=frameWrapper.locator(`iframe[data-inline-frame="${nativeFrame.id}"]`);
      await expect(frameWrapper).toHaveCSS('width','300px');await expect(frameWrapper).toHaveCSS('height','170px');await expect(frame).toHaveCount(1);await expect(frame).toHaveAttribute('frameborder','1');await expect(frame).toHaveAttribute('scrolling','auto');await expect(frame).toHaveAttribute('src','about:blank');
      const nativeInlineFrame={identity:true,geometry:true,defaultTargetEmpty:true,frameborder:'1',scrolling:'auto',preview:'none',src:'about:blank'};
      if(capture)await screenshot('inline-frame-native-preview.png');
      const sourcePage = document.pages.find(item => item.name === 'Text area'), widget = sourcePage.widgets[0];
      expect(widget).toMatchObject({ type: 'textarea', width: 300, height: 170, text: '' });
      await nav.getByRole('button', { name: 'Text area', exact: true }).click();
      const control = scope.locator(`[data-widget-id="${widget.id}"] textarea`);
      await expect(control).toHaveValue(''); await control.fill(literalInput); await expect(control).toHaveValue(literalInput);
      const wrapper = scope.locator(`[data-widget-id="${widget.id}"]`);
      await expect(wrapper).toHaveCSS('width', '300px'); await expect(wrapper).toHaveCSS('height', '170px');
      if (capture) await screenshot('rp-textarea-preview.png');
      return { checkedEllipses: checked, checkedNativePaths: paths, textareaUnicodeNewlineAndLiteralPreserved: true, nativeTable:{cells:9,matrixGeometry:true,objectOrder:true,exactText:true}, nativeMenus, nativeTree, nativeInlineFrame };
    }
    const sourcePage = document.pages[0]; await nav.getByRole('button', { name: sourcePage.name, exact: true }).click();
    const expected = activeEllipses(sourcePage.widgets);
    expect(expected).toHaveLength(46);
    const actualIds = await scope.locator('.widget.ellipse').evaluateAll(elements => elements.map(element => element.dataset.widgetId).sort());
    expect(actualIds).toEqual(expected.map(widget => widget.id).sort());
    for (const widget of expected) await checkEllipse(scope, widget);
    return { activeEllipseDomCount: actualIds.length, activeNestedEllipseDomCount: 3, totalSavedEllipseCount: 52, nestedSavedEllipseCount: 9, highYGeometryVisibilityNotClaimed: true };
  };
  for (const fixture of fixtures) {
    const source = path.join(root, 'research', 'samples', fixture.name);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Import Axure .rp (experimental)…', exact: true }).click();
    const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(`${fixture.pages} page(s), ${fixture.top} recovered widget(s), ${fixture.skipped} skipped item(s).`);
    await expect(report).toContainText(fixture.sha256);
    if (fixture.nested) await expect(report).toContainText(`${fixture.nested} recovered widget(s), 0 skipped item(s).`);
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const savedFile = path.join(userData, `${fixture.name}.rea.json`), document = await save(savedFile);
    const top = document.pages.flatMap(item => item.widgets), all = walk(top);
    expect(document.pages).toHaveLength(fixture.pages); expect(top).toHaveLength(fixture.top); expect(all.length - top.length).toBe(fixture.nested);
    expect(all.filter(widget => widget.type === 'ellipse')).toHaveLength(fixture.ellipses);
    expect(all.filter(widget => widget.type === 'textarea')).toHaveLength(fixture.textareas);
    if (fixture.name === 'Prototyping Basics.rp') { expect(top.filter(widget => widget.type === 'ellipse')).toHaveLength(43); expect(all.filter(widget => widget.type === 'ellipse').length - 43).toBe(9); }
    await open(savedFile); await save(path.join(userData, `${fixture.name}.reopened.rea.json`), document);
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    const preview = page.locator('.preview-overlay');
    const previewResult = await exercise(preview, preview.locator('nav.preview-pages'), document, fixture, true);
    await expect(preview.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    await save(path.join(userData, `${fixture.name}.after-preview.rea.json`), document);
    const htmlFile = path.join(userData, `${fixture.name}.html`);
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, htmlFile);
    await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
    expect((await fs.stat(htmlFile)).size).toBeGreaterThan(1000); await app.context().setOffline(true);
    const nextWindow = app.waitForEvent('window');
    const windowId = await app.evaluate(({ BrowserWindow }) => { const window = new BrowserWindow({ show: false, width: 1480, height: 960, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void window.loadURL('about:blank'); return window.id; });
    const offline = await nextWindow; observe(offline); let offlineResult;
    try {
      await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: windowId, url: pathToFileURL(htmlFile).href });
      await offline.waitForLoadState('domcontentloaded'); offlineResult = await exercise(offline.locator('main'), offline.locator('nav'), document, fixture);
      // Offline renderer keeps one empty alert output mounted even without errors.
      await expect(offline.getByRole('alert')).toHaveText('');
    } finally { await offline.close(); await app.context().setOffline(false); }
    await save(path.join(userData, `${fixture.name}.after-export.rea.json`), document);
    const after = await hashFile(source); expect(after).toBe(fixture.sha256); audit.sourceHashes[fixture.name].after = after;
    audit.results.push({ file: fixture.name, reportCounts: { pages: fixture.pages, top: fixture.top, skipped: fixture.skipped, nested: fixture.nested }, savedFile, savedSha256: await hashFile(savedFile), htmlFile, htmlSha256: await hashFile(htmlFile), nativeSaveReopen: true, designUnchangedAfterPreviewAndExport: true, preview: previewResult, offline: offlineResult });
  }
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally {
  if (app) await app.close();
  audit.finishedAt = new Date().toISOString();
  await fs.writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}
