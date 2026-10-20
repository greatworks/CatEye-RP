import { expect, test } from '@playwright/test';
import { inputTypesFixture } from '../../scripts/input-types-scenario.mjs';

test('preview commits the first real-keyboard clear of an initialized number before another render', async ({ page }) => {
  const doc = inputTypesFixture();
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'initial-clear.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const scope = page.locator('.preview-overlay');
  const number = scope.getByRole('spinbutton', { name: 'Field number', exact: true });
  const changes = scope.locator('[data-widget-id="Changes"]');
  await expect(number).toHaveValue('01');
  await expect(changes).toHaveText('Number changes: 0');
  await number.focus();
  await number.press('Control+A');
  await number.press('Backspace');
  // This is a trusted DOM input and must commit independently of the next key.
  // No private React tracker, synthetic input, sleeps, or retrying clear steps.
  await expect(changes).toHaveText('Number changes: 1');
  await expect(number).toHaveValue('');
  await scope.getByRole('button', { name: 'Read values', exact: true }).click();
  await expect(scope.locator('[data-widget-id="Readback"]')).toHaveText('number=; email=user@example.test; file=');
  await expect(number).toHaveValue('');
  await number.pressSequentially('123456');
  await expect(number).toHaveValue('123456');
  await expect(changes).toHaveText('Number changes: 7');
});
