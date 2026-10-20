import { expect, test } from '@playwright/test';
import { createDocument, createPage, createWidget, serializeDocument } from '../../src/model/document';

test('preview page list scrolls to the last page and back without moving the canvas', async ({ page }) => {
  const doc = createDocument(); doc.name = 'Sixty page navigation'; doc.caseSelection = 'never';
  doc.pages = Array.from({ length: 60 }, (_, index) => {
    const name = `Page ${String(index + 1).padStart(2, '0')}`, current = createPage(name);
    const text = createWidget('text', 40, 40); text.name = 'Page identity'; text.text = `${name} content`; text.width = 500;
    current.widgets = [text]; return current;
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'page-navigation.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay'), pages = preview.locator('.preview-pages');
  const first = pages.getByRole('button', { name: 'Page 01', exact: true }), last = pages.getByRole('button', { name: 'Page 60', exact: true });
  const content = preview.locator('.widget[aria-label="Page identity"]');
  await expect(pages.getByRole('button')).toHaveCount(60);
  await expect(first).toHaveClass('active'); await expect(content).toHaveText('Page 01 content');
  await expect(last).not.toBeInViewport();

  // Real wheel input must scroll the navigation itself, not rely on forced clicks.
  await pages.hover(); await page.mouse.wheel(0, 5000);
  await expect.poll(() => pages.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect(last).toBeInViewport(); await last.click();
  await expect(last).toHaveClass('active'); await expect(first).not.toHaveClass('active');
  await expect(content).toHaveText('Page 60 content');
  await expect(preview.locator('.preview-toolbar')).toContainText('Page 60');
  expect(await preview.locator('.preview-scroll').evaluate(node => node.scrollTop)).toBe(0);

  await pages.hover(); await page.mouse.wheel(0, -5000);
  await expect.poll(() => pages.evaluate(node => node.scrollTop)).toBe(0);
  await expect(first).toBeInViewport(); await first.click();
  await expect(first).toHaveClass('active'); await expect(last).not.toHaveClass('active');
  await expect(content).toHaveText('Page 01 content');
  await expect(preview.locator('.preview-toolbar')).toContainText('Page 01');
  expect(errors).toEqual([]);
});
