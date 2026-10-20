import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serializeDocument } from '../../src/model/document';
import { nativeLayersRuntimeFixture } from '../fixtures/native-layers-runtime';

async function open(page: Page) {
  const doc = nativeLayersRuntimeFixture(); await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'native-layers-runtime.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name); return doc;
}
const widget = (scope: Page | Locator, id: string) => scope.locator(`[data-widget-id="${id}"]`);
const geometry = (target: Locator) => target.evaluate(node => {
  const css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(css.transform);
  return { x: parseFloat(css.left), y: parseFloat(css.top), width: parseFloat(css.width), height: parseFloat(css.height), a: matrix.a, b: matrix.b };
});
async function at(target: Locator, wanted: Partial<Awaited<ReturnType<typeof geometry>>>) {
  await expect.poll(async () => {
    const value = await geometry(target);
    return Object.entries(wanted).reduce((sum, [field, expected]) => sum + Math.abs(value[field as keyof typeof value] - expected!), 0);
  }).toBeLessThan(.02);
}
async function exercise(page: Page, scope: Page | Locator) {
  const root = widget(scope, 'layer-motion'), first = widget(scope, 'layer-first'), second = widget(scope, 'layer-second');
  await at(first, { x: 100, y: 100 }); await at(second, { x: 160, y: 100 });
  const initial = await first.boundingBox(), rootBox = await root.boundingBox();
  expect(initial!.x).toBeCloseTo(rootBox!.x, 3); expect(initial!.y).toBeCloseTo(rootBox!.y, 3);
  await widget(scope, 'layer-combine').click();
  await at(first, { x: 120, y: 110, width: 80, height: 40 });
  await at(second, { x: 240, y: 110, width: 80, height: 40 });
  await widget(scope, 'layer-rotate').click();
  await at(first, { x: 180, y: 50, width: 80, height: 40, a: 0, b: 1 });
  await at(second, { x: 180, y: 170, width: 80, height: 40, a: 0, b: 1 });
  await expect(root).toHaveCSS('transform', 'none');
  // The inner same-scope compensation must keep visual coordinates correct.
  const drawnFirst = (await first.boundingBox())!, drawnSecond = (await second.boundingBox())!;
  expect(drawnSecond.y - drawnFirst.y).toBeCloseTo(120, 2); expect(drawnSecond.x).toBeCloseTo(drawnFirst.x, 2);

  await widget(scope, 'layer-style-direct').hover();
  await expect(widget(scope, 'layer-style-direct')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await expect(widget(scope, 'layer-style-blocked')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await widget(scope, 'layer-select').click();
  await expect(widget(scope, 'layer-style-direct')).toHaveCSS('background-color', 'rgb(0, 170, 68)');
  await expect(widget(scope, 'layer-style-blocked')).toHaveCSS('background-color', 'rgb(0, 170, 68)');
  const rows = widget(scope, 'layer-row-leaf'); await expect(rows).toHaveCount(4);
  await rows.nth(0).click(); await at(rows.nth(0), { x: 32, y: 8 });
  for (let i = 1; i < 4; i++) await at(rows.nth(i), { x: 12, y: 8 });
  await rows.nth(3).click(); await at(rows.nth(3), { x: 32, y: 8 }); await at(rows.nth(0), { x: 32, y: 8 });
  const frame = widget(scope, 'layer-frame').locator('iframe').contentFrame(), member = frame.locator('[data-widget-id="layer-frame-leaf"]');
  await at(member, { x: 30, y: 70 }); await frame.locator('[data-widget-id="layer-frame-move"]').click(); await at(member, { x: 65, y: 85 });
  return { first: await geometry(first), second: await geometry(second), rowRects: await Promise.all((await rows.all()).map(geometry)) };
}
async function saveUnchanged(page: Page, info: TestInfo, source: ReturnType<typeof nativeLayersRuntimeFixture>) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath('unchanged.rea.json'); await (await pending).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(source);
}

test('preview Layer motion, nested scope, state propagation and frame runtime keep independent identities', async ({ page }, info) => {
  const doc = await open(page), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const scope = page.locator('.preview-overlay'), observed = await exercise(page, scope);
  await scope.screenshot({ path: info.outputPath('preview.png') });
  await writeFile(info.outputPath('observations.json'), JSON.stringify({ observed, errors }, null, 2)); expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); await saveUnchanged(page, info, doc);
});
test('offline file Layer motion, nested rows and inner frame use the same portable runtime', async ({ page, browser }, info) => {
  const doc = await open(page), pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const file = info.outputPath('layers.html'); await (await pending).saveAs(file);
  const context = await browser.newContext({ offline: true }), offline = await context.newPage(), errors: string[] = [], requests: string[] = [];
  offline.on('pageerror', error => errors.push(error.message)); context.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  try {
    await offline.goto(pathToFileURL(file).href); const observed = await exercise(offline, offline);
    await offline.screenshot({ path: info.outputPath('offline.png'), fullPage: true });
    await writeFile(info.outputPath('observations.json'), JSON.stringify({ observed, errors, requests }, null, 2));
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { await context.close(); }
  await writeFile(info.outputPath('source.rea.json'), serializeDocument(doc));
});
