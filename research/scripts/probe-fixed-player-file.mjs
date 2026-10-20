import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { buildFramePlayerHtml } from '../../scripts/frame-player-build.ts';

const root = path.resolve(import.meta.dirname, '../..');
const executable = process.argv[2] ?? path.join(root, 'release/REA Prototype Studio-win32-x64/REA Prototype Studio.exe');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-fixed-player-file-'));
const html = await buildFramePlayerHtml(), playerPath = path.join(directory, 'frame-player.html'), playerUrl = pathToFileURL(playerPath).href;
await fs.writeFile(playerPath, html);
const doc = JSON.parse(await fs.readFile(path.join(root, 'artifacts/inline-frame-demo.rea.json'), 'utf8'));
const catalog = doc.pages.find(p => p.id === 'frame-catalog'), detail = doc.pages.find(p => p.id === 'frame-detail');
const nested = structuredClone(doc.pages[0].widgets.find(w => w.id === 'frame-left'));
Object.assign(nested, { id: 'probe-nested', name: 'Nested file player', x: 18, y: 400, width: 460, height: 260 });
nested.inlineFrame.target = { kind: 'page', pageId: detail.id }; catalog.height = 710; catalog.widgets.push(nested);
const button = structuredClone(catalog.widgets.find(w => w.id === 'frame-child-parent'));
Object.assign(button, { id: 'probe-parent', name: 'Immediate parent', text: 'Immediate parent', x: 20, y: 100 });
button.interactions.forEach((c, i) => { c.id = `probe-case-${i}`; c.actions.forEach((a, j) => { a.id = `probe-action-${j}`; }); });
detail.widgets.push(button);
const token = 'fixed-file-proof-token', options = { bootstrap: '', styles: 'body{margin:0}main{position:relative}.widget{position:absolute;box-sizing:border-box}', base: pathToFileURL(path.join(directory, 'index.html')).href, playerUrl, token, pages: ['probe-root', 'frame-catalog'], depth: 1, budget: 32 };
await fs.writeFile(path.join(directory, 'outer.js'), `const frame=document.querySelector('iframe');window.addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.data?.channel==='rea-inline-frame'&&event.data?.token===${JSON.stringify(token)}&&event.data?.operation==='ready')frame.contentWindow.postMessage(${JSON.stringify({ channel: 'rea-inline-frame-init', token, doc, options, pageId: catalog.id })},'*')});frame.src=${JSON.stringify(playerUrl + '?frame=' + token + '#' + token)};`);
await fs.writeFile(path.join(directory, 'index.html'), `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self' about: https: http: file:"><iframe title="Root child" sandbox="allow-scripts allow-forms" style="width:600px;height:750px"></iframe><script src="outer.js"></script>`);
const result = { timestamp: new Date().toISOString(), executable, directory, playerSha256: createHash('sha256').update(html).digest('hex'), consoleErrors: [], failedRequests: [], pageErrors: [], assertions: {} };
const app = await electron.launch({ executablePath: executable, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: path.join(directory, 'user-data') } });
try {
  await app.firstWindow();
  const next = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }, file) => { const window = new BrowserWindow({ show: false, width: 900, height: 950, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } }); await window.loadFile(file); }, path.join(directory, 'index.html'));
  const page = await next;
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('pageerror', error => result.pageErrors.push(error.message));
  // Reload after all diagnostic listeners are bound; retain actual file CSP.
  await page.reload();
  const frame = page.frameLocator('iframe').first(), count = frame.locator('[data-widget-id="frame-child-count"]');
  await count.waitFor({ timeout: 7000 }); assert.equal(await count.innerText(), 'Count: 1'); result.assertions.initialCounter = true;
  await frame.locator('[data-widget-id="frame-child-increment"]').click(); assert.equal(await count.innerText(), 'Count: 2'); result.assertions.actualInteraction = true;
  const inner = frame.frameLocator('[data-inline-frame="probe-nested"]');
  await inner.locator('[data-widget-id="frame-detail-heading"]').waitFor({ timeout: 7000 }); result.assertions.nestedFilePlayer = true;
  result.isolation = await inner.locator('body').evaluate(() => { let blocked = false; try { void window.parent.document; } catch { blocked = true; } return { desktop: typeof window.desktop, require: typeof window.require, parentBlocked: blocked }; });
  assert.deepEqual(result.isolation, { desktop: 'undefined', require: 'undefined', parentBlocked: true });
  await inner.locator('[data-widget-id="probe-parent"]').click(); await frame.locator('[data-widget-id="frame-parent-heading"]').waitFor(); result.assertions.immediateParentNavigation = true;
  assert.equal(await page.locator('iframe').count(), 1); result.assertions.outerSurvived = true;
  assert.deepEqual(result.consoleErrors, []); assert.deepEqual(result.failedRequests, []); assert.deepEqual(result.pageErrors, []);
  result.hidden = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible())); assert.equal(result.hidden, true);
  result.passed = true;
} catch (error) { result.error = String(error); result.passed = false; process.exitCode = 1; }
finally { await app.close(); await fs.writeFile(path.join(root, '.build/inline-frame-fixed-file-proof.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2)); }
