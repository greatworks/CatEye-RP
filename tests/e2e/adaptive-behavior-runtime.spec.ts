import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseDocument, serializeDocument } from '../../src/model/document';
// @ts-expect-error The shared executable JS scenario is validated by parseDocument below.
import { adaptiveBehaviorFixture, exerciseAdaptiveBehavior } from '../../scripts/adaptive-behavior-scenario.mjs';

const fixture = parseDocument(JSON.stringify(adaptiveBehaviorFixture()));
for (const mode of ['preview', 'offline'] as const) test(`${mode}: shared adaptive states, action boundaries and embedded lifecycle survive save/reopen`, async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const source = serializeDocument(fixture), errors: string[] = [], network: string[] = [];
  const sourcePath = info.outputPath('adaptive-behavior-source.rea.json'); await writeFile(sourcePath, source);
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); await page.goto('/');
  const open = async (text: string) => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
    await (await chooser).setFiles({ name: 'adaptive-behavior.rea.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(page.locator('.titlebar')).toContainText(fixture.name);
  };
  const save = async (suffix: string) => {
    const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
    const file = info.outputPath(`adaptive-behavior-${suffix}.rea.json`); await (await pending).saveAs(file);
    const saved = await readFile(file, 'utf8'); expect(JSON.parse(saved)).toEqual(JSON.parse(source)); return saved;
  };
  await open(source); await open(await save('initial')); await save('reopened');
  const context = mode === 'offline' ? await browser.newContext({ offline: true, viewport: { width: 1200, height: 1000 } }) : undefined;
  let player = page, scope = page.locator('.preview-overlay');
  if (context) {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const output = info.outputPath('adaptive-behavior.html'); await (await download).saveAs(output);
    await context.route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
    player = await context.newPage(); player.on('pageerror', error => errors.push(error.message));
    await player.goto(pathToFileURL(output).href); expect(player.url().startsWith('file:')).toBe(true); scope = player.locator('main').first();
  } else await page.getByTitle('Preview (F5)', { exact: true }).click();
  try {
    const result = await exerciseAdaptiveBehavior(scope, {
      selection: (mode === 'preview' ? scope : player).getByRole('combobox', { name: 'Adaptive view', exact: true }),
      click: (locator: import('@playwright/test').Locator) => locator.click(), hover: (locator: import('@playwright/test').Locator) => locator.hover(),
      mobile: () => mode === 'preview' ? scope.getByTitle('Mobile', { exact: true }).click() : player.setViewportSize({ width: 390, height: 1000 }),
      capture: (suffix: string) => player.screenshot({ path: info.outputPath(`adaptive-behavior-${mode}-${suffix}.png`), fullPage: true }),
    });
    await writeFile(info.outputPath(`adaptive-behavior-${mode}-checks.json`), JSON.stringify({ mode, result, network, errors }, null, 2));
  } finally { if (context) await context.close(); else await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  await save('after-runtime'); expect(network).toEqual([]); expect(errors).toEqual([]);
});
