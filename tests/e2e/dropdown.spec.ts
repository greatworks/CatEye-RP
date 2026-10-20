import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { serializeDocument } from '../../src/model/document';
import { dropdownFixture } from '../fixtures/dropdown';
type Scope = Page | Locator;
const w = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
const indices = (control: Locator) => control.evaluate(e => Array.from((e as HTMLSelectElement).selectedOptions, o => o.index));
async function exercise(scope: Scope) {
  const single = scope.locator('select[aria-label="Single choice"]'), multi = scope.locator('select[aria-label="Multiple choices"]');
  expect(await single.locator('option').evaluateAll(options => options.map(e => [(e as HTMLOptionElement).value, e.textContent]))).toEqual(['A', 'A', '', ' ', 'B', '[[literal]]', 'a\nb'].map(s => [s, s]));
  expect(await indices(single)).toEqual([0]); expect(await indices(multi)).toEqual([]);
  await expect(multi).toHaveAttribute('multiple', ''); await expect(multi).toHaveAttribute('size', '2');
  expect(await indices(scope.locator('select[aria-label="Unselected listbox"]'))).toEqual([]); await expect(scope.locator('select[aria-label="Empty choices"] option')).toHaveCount(0);
  await single.focus(); await single.press('ArrowDown'); expect(await indices(single)).toEqual([1]); await expect(w(scope, 'Single count')).toHaveText('1');
  await w(scope, 'Set A').click(); expect(await indices(single)).toEqual([1]); await expect(w(scope, 'Single count')).toHaveText('1');
  await w(scope, 'Set B').click(); expect(await indices(single)).toEqual([4]); await expect(w(scope, 'Single echo')).toHaveText('B');
  await w(scope, 'Set A').click(); expect(await indices(single)).toEqual([0]); await expect(w(scope, 'Single count')).toHaveText('3');
  await w(scope, 'Set missing').click(); await w(scope, 'Set missing').click(); expect(await indices(single)).toEqual([]); await expect(w(scope, 'Single count')).toHaveText('5');
  await w(scope, 'Refresh display').click(); expect(await indices(single)).toEqual([]);
  await w(scope, 'Set blank').click(); expect(await indices(single)).toEqual([2]); await expect(w(scope, 'Single count')).toHaveText('6');
  await w(scope, 'Set space').click(); expect(await indices(single)).toEqual([3]); await expect(single).toHaveValue(' ');
  await w(scope, 'Set Text no-op').click(); expect(await indices(single)).toEqual([3]);
  await w(scope, 'Disable and set B').click(); await expect(single).toBeDisabled(); expect(await indices(single)).toEqual([4]); await expect(w(scope, 'Single count')).toHaveText('8');
  await w(scope, 'Enable choice').click(); await w(scope, 'Focus choice').click(); await expect(single).toBeFocused(); await expect(w(scope, 'Single choice')).toHaveCSS('border-top-color', 'rgb(226, 15, 25)');
  await w(scope, 'Multi set blank').click(); expect(await indices(multi)).toEqual([]); await expect(w(scope, 'Multiple count')).toHaveText('0');
  await w(scope, 'Multi set A').click(); expect(await indices(multi)).toEqual([0, 1]); await w(scope, 'Multi set A').click(); await expect(w(scope, 'Multiple count')).toHaveText('2');
  await multi.selectOption([{ index: 0 }, { index: 4 }]); expect(await indices(multi)).toEqual([0, 4]); await expect(w(scope, 'Multiple echo')).toHaveText('A,B');
  await w(scope, 'Multi set comma').click(); expect(await indices(multi)).toEqual([0, 4]); await expect(w(scope, 'Multiple count')).toHaveText('3');
  await w(scope, 'Hide choices').click(); await expect(single).toHaveCount(0); await w(scope, 'Show choices').click(); expect(await indices(single)).toEqual([4]); expect(await indices(multi)).toEqual([0, 4]);
  const rows = scope.locator('select[aria-label="Row choice"]'); await rows.nth(0).selectOption({ index: 1 }); expect(await indices(rows.nth(0))).toEqual([1]); expect(await indices(rows.nth(1))).toEqual([0]); await expect(w(scope, 'Row echo')).toHaveText('1:One');
  await rows.nth(1).selectOption({ index: 2 }); await expect(w(scope, 'Row echo')).toHaveText('2:Two'); expect(await indices(rows.nth(0))).toEqual([1]);
  await w(scope, 'Refresh rows').click(); expect(await indices(rows.nth(0))).toEqual([0]); expect(await indices(rows.nth(1))).toEqual([0]);
  await w(scope, 'Other page').click(); await w(scope, 'Back to choices').click(); expect(await indices(single)).toEqual([0]); expect(await indices(multi)).toEqual([]);
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: exact option identity, synchronous actions, lists, focus, remount and row lifecycle`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/');
  const picker = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await picker).setFiles({ name: 'dropdown.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(dropdownFixture())) });
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay')); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = info.outputPath('dropdown.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } });
    try { const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', e => errors.push(e.message)); exported.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); }); await exported.goto(pathToFileURL(path).href); await exercise(exported); expect(requests).toEqual([]); } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});
