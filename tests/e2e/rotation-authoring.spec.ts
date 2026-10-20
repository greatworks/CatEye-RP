import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Rotated direct manipulation';
  const box = createWidget('box', 160, 160);
  Object.assign(box, { name: 'Rotated box', text: '', width: 200, height: 60, rotation: 90 });
  Object.assign(box.style, { fill: '#2563eb', strokeWidth: 0 });
  doc.pages[0].widgets = [box]; return doc;
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'rotation.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, file: string): Promise<Document> {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  await (await pending).saveAs(file); return JSON.parse(await readFile(file, 'utf8'));
}
async function center(page: Page, selector: string) {
  const bounds = await page.locator(selector).boundingBox();
  if (!bounds) throw new Error(`Missing ${selector}`);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

test('rotated east resize follows its visible axis and keeps the opposite edge fixed, with one undo', async ({ page }, info) => {
  const doc = fixture(); await open(page, doc);
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.5');
  await page.locator('.editor-widget.box').click();
  const east = await center(page, '.resize-handle.e'), west = await center(page, '.resize-handle.w');
  await page.mouse.move(east.x, east.y); await page.mouse.down();
  await page.mouse.move(east.x, east.y + 60, { steps: 4 }); await page.mouse.up();
  const saved = await save(page, info.outputPath('east-resized.rea.json'));
  // At 90 degrees the local +X axis points down. Forty local pixels grow width,
  // while the opposite edge at world (260,90) remains stationary.
  expect(saved.pages[0].widgets[0]).toMatchObject({ x: 140, y: 180, width: 240, height: 60, rotation: 90 });
  const after = await center(page, '.resize-handle.w');
  expect(after.x).toBeCloseTo(west.x, 1); expect(after.y).toBeCloseTo(west.y, 1);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('undo.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('redo.rea.json'))).toEqual(saved);
});

test('marquee intersects the rotated visible rectangle rather than the unrotated layout box', async ({ page }) => {
  await open(page, fixture());
  const canvas = await page.locator('.canvas-surface').boundingBox(); if (!canvas) throw new Error('Missing canvas');
  const marquee = async (x1: number, y1: number, x2: number, y2: number) => {
    await page.mouse.move(canvas.x + x1, canvas.y + y1); await page.mouse.down();
    await page.mouse.move(canvas.x + x2, canvas.y + y2, { steps: 4 }); await page.mouse.up();
  };
  // The rotated rectangle occupies x230..290 / y90..290. This first area only
  // intersects its stale, unrotated x160..360 / y160..220 layout bounds.
  await marquee(150, 170, 200, 200);
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(0);
  await marquee(220, 100, 275, 135);
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(1);
  await expect(page.locator('.selection-label')).toHaveText('Rotated box');
});
