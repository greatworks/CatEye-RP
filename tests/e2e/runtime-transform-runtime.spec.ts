import { expect, test, type Page, type Locator, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serializeDocument } from '../../src/model/document';
import { motionEvent, runtimeTransformFixture } from '../fixtures/runtime-transform';

async function open(page: Page, doc = runtimeTransformFixture()) {
  await page.goto('/'); const pending = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles({ name: 'runtime-transform.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name); return doc;
}
const widget = (scope: Page | Locator, id: string) => scope.locator(`[data-widget-id="${id}"]`);
const geometry = (target: Locator) => target.evaluate(node => {
  const css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(css.transform);
  return { x: parseFloat(css.left), y: parseFloat(css.top), width: parseFloat(css.width), height: parseFloat(css.height), a: matrix.a, b: matrix.b };
});
async function drag(page: Page, target: Locator, dx: number, dy: number) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox(); expect(box).not.toBeNull(); const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy); await page.mouse.up();
}
async function at(target: Locator, x: number, y: number) {
  await expect.poll(async () => { const actual = await geometry(target); return Math.abs(actual.x - x) + Math.abs(actual.y - y); }).toBeLessThan(.02);
}
async function exercise(page: Page, scope: Page | Locator) {
  const combined = widget(scope, 'transform-combined'); await widget(scope, 'transform-combine').click();
  await expect.poll(async () => { const actual = await geometry(combined); return actual.width > 200.5 && actual.width < 299 && actual.b > .01 && actual.b < .99; }, { intervals: [10, 15, 20] }).toBe(true);
  await expect.poll(async () => { const actual = await geometry(combined); return Math.abs(actual.a) + Math.abs(actual.b - 1); }).toBeLessThan(.00001);
  const final = await geometry(combined); expect(final.x).toBeCloseTo(140, 2); expect(final.y).toBeCloseTo(190, 2);
  expect(final.width).toBeCloseTo(299.65306122448976, 1); expect(final.height).toBeCloseTo(159.59183673469386, 1);
  await widget(scope, 'transform-ordered').click(); await at(widget(scope, 'transform-first'), 830, 225); await at(widget(scope, 'transform-second'), 800, 160);
  const target = widget(scope, 'transform-drag'); await drag(page, target, 50, 20); await at(target, 650, 380);
  await expect(widget(scope, 'transform-drag-status')).toHaveText('Dropped 50,50');
  // The drag-generated click is suppressed, but a fresh ordinary click remains usable.
  await target.click(); await expect(widget(scope, 'transform-drag-status')).toHaveText('Clicked');
  const rows = widget(scope, 'transform-row-drag'); await expect(rows).toHaveCount(2); await drag(page, rows.first(), 40, 10);
  await at(rows.first(), 54, 22); await at(rows.nth(1), 14, 12); await drag(page, rows.nth(1), 20, 5); await at(rows.nth(1), 34, 17); await at(rows.first(), 54, 22);
  const frame = widget(scope, 'transform-frame').locator('iframe').contentFrame(), inner = frame.locator('[data-widget-id="transform-child-drag"]');
  await drag(page, inner, 35, 15); await at(inner, 65, 85);
  return final;
}
async function saveUnchanged(page: Page, info: TestInfo, original: ReturnType<typeof runtimeTransformFixture>) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath('after-preview.rea.json');
  await (await pending).saveAs(file); expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(original);
}

test('preview paints combined transforms and supports independent mouse drags in rows and frames', async ({ page }, info) => {
  test.setTimeout(90_000);
  const original = await open(page), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); const final = await exercise(page, preview);
  await preview.screenshot({ path: info.outputPath('preview.png') }); await writeFile(info.outputPath('observations.json'), JSON.stringify({ final, errors }, null, 2));
  expect(errors).toEqual([]); await page.getByRole('button', { name: 'Close preview', exact: true }).click(); await saveUnchanged(page, info, original);
});

test('portable file HTML performs the same transforms and native mouse drags offline', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const original = await open(page), pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const file = info.outputPath('motion.html'); await (await pending).saveAs(file);
  const context = await browser.newContext({ offline: true }), offline = await context.newPage(), errors: string[] = [], requests: string[] = [];
  offline.on('pageerror', error => errors.push(error.message)); context.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  try {
    await offline.goto(pathToFileURL(file).href); const final = await exercise(offline, offline); await offline.screenshot({ path: info.outputPath('offline.png'), fullPage: true });
    await writeFile(info.outputPath('observations.json'), JSON.stringify({ final, errors, requests }, null, 2)); expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { await context.close(); }
  await writeFile(info.outputPath('source.rea.json'), serializeDocument(original));
});

test('browser touch events move the widget, prevent scrolling, and touchCancel ends only that drag', async ({ page }) => {
  await open(page); await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'), target = widget(preview, 'transform-drag');
  const box = (await target.boundingBox())!, session = await page.context().newCDPSession(page), x = box.x + 70, y = box.y + 28;
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.evaluate(() => { (window as unknown as { touchPrevented: boolean[] }).touchPrevented = []; window.addEventListener('touchmove', event => (window as unknown as { touchPrevented: boolean[] }).touchPrevented.push(event.defaultPrevented)); });
  const point = (x: number, y: number) => [{ x, y, radiusX: 1, radiusY: 1, force: 1, id: 7 }];
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x, y) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x + 40, y + 10) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await at(target, 640, 370); await expect(widget(preview, 'transform-drag-status')).toHaveText('Dropped 40,40');
    expect(await page.evaluate(() => (window as unknown as { touchPrevented: boolean[] }).touchPrevented)).toEqual([true]);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x + 40, y + 10) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x + 60, y + 20) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await at(target, 660, 380); await expect(widget(preview, 'transform-drag-status')).toHaveText('Dropped 40,40');
  } finally { await session.detach(); }
});

test('deleting the dragged repeater row restores the cursor and leaves the surviving row usable', async ({ page }) => {
  const doc = runtimeTransformFixture(), list = doc.pages[0].widgets.find(item => item.id === 'transform-repeater')!, source = list.repeater!.template[0];
  source.interactions[0].actions.push({ id: 'delete-dragged-row', type: 'deleteRow', targetId: list.id, value: '{"row":"this"}' });
  await open(page, doc); await page.getByTitle('Preview (F5)', { exact: true }).click(); const rows = widget(page.locator('.preview-overlay'), source.id);
  await expect(rows).toHaveCount(2); const box = (await rows.first().boundingBox())!; await page.mouse.move(box.x + 25, box.y + 25); await page.mouse.down(); await page.mouse.move(box.x + 35, box.y + 30);
  await expect(rows).toHaveCount(1); await expect.poll(() => page.evaluate(() => document.body.style.cursor)).not.toBe('move'); await page.mouse.up(); await at(rows.first(), 14, 12);
  const surviving = (await rows.first().boundingBox())!; await page.mouse.move(surviving.x + 25, surviving.y + 25); await page.mouse.down(); await page.mouse.move(surviving.x + 35, surviving.y + 30); await page.mouse.up(); await expect(rows).toHaveCount(0);
});

test('navigation during Drag Start cancels the old page gesture before its Drag action', async ({ page }) => {
  const doc = runtimeTransformFixture(), source = doc.pages[0].widgets.find(item => item.id === 'transform-drag')!;
  source.interactions.unshift(motionEvent('drag-navigate', 'dragStart', [{ type: 'openPage', targetId: doc.pages[1].id }]));
  await open(page, doc); await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'), target = widget(preview, source.id), box = (await target.boundingBox())!;
  await page.mouse.move(box.x + 25, box.y + 25); await page.mouse.down(); await page.mouse.move(box.x + 35, box.y + 30); await page.mouse.up();
  await expect(target).toHaveCount(0); const child = widget(preview, 'transform-child-drag'); await at(child, 30, 70);
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).not.toBe('move'); await drag(page, child, 30, 10); await at(child, 60, 80);
});

test('closing preview during an active drag restores the cursor and releases document listeners', async ({ page }, info) => {
  const original = await open(page); await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'), target = widget(preview, 'transform-drag');
  const box = (await target.boundingBox())!; await page.mouse.move(box.x + 25, box.y + 25); await page.mouse.down(); await page.mouse.move(box.x + 35, box.y + 30);
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe('move');
  // Dispatch the close command without another pointer action, while the drag is live.
  await page.getByRole('button', { name: 'Close preview', exact: true }).evaluate(node => (node as HTMLButtonElement).click());
  await page.mouse.up(); await expect.poll(() => page.evaluate(() => document.body.style.cursor)).not.toBe('move'); await saveUnchanged(page, info, original);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const fresh = widget(page.locator('.preview-overlay'), 'transform-drag'); await at(fresh, 600, 360);
  await drag(page, fresh, 20, 10); await at(fresh, 620, 370);
});
