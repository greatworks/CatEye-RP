import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
type Probe = {
  calls: number; reads: string[]; failures: number;
  release(): Promise<void>; restore(): void;
};
type InstrumentedWindow = Window & { selectionAuthorProbe: Probe };

function fixture() {
  const doc = createDocument(); doc.name = 'Selection author command isolation';
  doc.pages[0].width = 1200; doc.pages[0].height = 700;
  doc.pages[0].widgets = (['FIRST_LABEL', 'SECOND_LABEL'] as const).map((text, index) => {
    const widget = createWidget(index ? 'radio' : 'checkbox', 100, 120 + index * 100);
    Object.assign(widget, { id: `stale-${index}`, name: text, text, width: 180, height: 40,
      selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: false } });
    Object.assign(widget.style, { fontFamily: 'monospace', fontSize: 16, fontWeight: 400,
      lineHeight: 1.25, textPadding: [2, 7, 3, 5], verticalAlign: 'top',
      textAlign: 'left', selectionButtonSize: index ? 18 : 14 });
    widget.richText = { paragraphs: [{ lineHeightPx: 20, runs: [{ text }] }] };
    return widget;
  });
  doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: {
    'stale-0': { width: 210, height: 42, style: { color: '#123456' } },
    'stale-1': { x: 110, y: 230 },
  } }];
  return doc;
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-author-stale.rea.json', mimeType: 'application/json',
    buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  // Use the normal autosave/reopen path to start with no history entries.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rea-prototype-document-v1')))
    .toBe(serializeDocument(doc));
  await page.reload();
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
}
async function selectFirst(page: Page) {
  await page.locator('.editor-widget.checkbox').click();
  await expect(page.locator('.selection-frame')).toHaveCount(1);
}
async function number(page: Page, label: string, value: number) {
  const field = inspector(page).getByLabel(label, { exact: true });
  await field.fill(String(value)); await field.press('Enter');
}
async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const download = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`);
  await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8')) as Document;
}

/** Delay the real font service, or fail one real Range measurement. This
 * instruments browser services only; every author command is issued by UI. */
async function instrument(page: Page, options: { delayFonts?: boolean; failText?: string } = {}) {
  await page.evaluate(async options => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const nativeLoad = document.fonts.load, nativeRect = Range.prototype.getBoundingClientRect;
    const outstanding: Promise<FontFace[]>[] = [];
    let releaseGate!: () => void;
    const gate = new Promise<void>(resolve => { releaseGate = resolve; });
    const probe: Probe = {
      calls: 0, reads: [], failures: 0,
      async release() {
        releaseGate();
        await Promise.allSettled(outstanding);
        await document.fonts.ready;
        // Drain the real async host continuation and React rendering.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      restore() {
        document.fonts.load = nativeLoad;
        Range.prototype.getBoundingClientRect = nativeRect;
      },
    };
    if (options.delayFonts) document.fonts.load = function(font, text) {
      probe.calls++;
      const request = gate.then(() => nativeLoad.call(this, font, text));
      outstanding.push(request); return request;
    };
    Range.prototype.getBoundingClientRect = function() {
      const node = this.commonAncestorContainer;
      const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
      const owner = element?.closest('[data-selection-author-measure]');
      if (owner) {
        const text = owner.textContent ?? ''; probe.reads.push(text);
        if (options.failText && text.includes(options.failText)) {
          probe.failures++; throw Error('Intentional second selection measurement failure');
        }
      }
      return nativeRect.call(this);
    };
    (window as unknown as InstrumentedWindow).selectionAuthorProbe = probe;
  }, options);
}
async function waiting(page: Page, minimumCalls = 1) {
  await expect.poll(() => page.evaluate(() => (window as unknown as InstrumentedWindow).selectionAuthorProbe.calls))
    .toBeGreaterThanOrEqual(minimumCalls);
}
async function release(page: Page) {
  await page.evaluate(() => (window as unknown as InstrumentedWindow).selectionAuthorProbe.release());
}
async function observations(page: Page) {
  return page.evaluate(() => {
    const { calls, reads, failures } = (window as unknown as InstrumentedWindow).selectionAuthorProbe;
    return { calls, reads, failures };
  });
}
async function clean(page: Page) {
  await expect(page.locator('[data-selection-author-measure], [data-selection-display-measure]')).toHaveCount(0);
}

test('font-delayed author command stays cancelled after a view round trip and reselect', async ({ page }, info) => {
  const original = fixture(); await open(page, original); await selectFirst(page);
  await instrument(page, { delayFonts: true });
  await number(page, 'W', 270); await waiting(page);
  expect(await save(page, info, 'pending')).toEqual(original);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('');
  await selectFirst(page);
  await release(page);
  expect(await save(page, info, 'view-round-trip')).toEqual(original);
  expect((await observations(page)).reads).toEqual([]);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await clean(page);
});

test('Undo cancels font-delayed author work with either populated or empty history', async ({ page }, info) => {
  for (const hasHistory of [false, true]) {
    const original = fixture(); await open(page, original); await selectFirst(page);
    if (hasHistory) {
      await number(page, 'X', 140);
      await expect(page.getByTitle('Undo', { exact: true })).toBeEnabled();
    }
    await instrument(page, { delayFonts: true });
    await number(page, 'W', 270); await waiting(page);
    // The keyboard route is available even with the disabled empty-history button.
    await page.keyboard.press('Control+z');
    await release(page);
    expect(await save(page, info, `undo-${hasHistory}`)).toEqual(original);
    expect((await observations(page)).reads).toEqual([]);
    await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
    if (hasHistory) {
      await page.getByTitle('Redo', { exact: true }).click();
      const expected = structuredClone(original); expected.pages[0].widgets[0].x = 140;
      expect(await save(page, info, 'redo-only-original-edit')).toEqual(expected);
    }
    await clean(page);
  }
});

test('a later ordinary property patch cancels waiting layout and owns the only undo entry', async ({ page }, info) => {
  const original = fixture(); await open(page, original); await selectFirst(page);
  await instrument(page, { delayFonts: true });
  await number(page, 'W', 270); await waiting(page);
  await number(page, 'X', 155);
  await release(page);
  const expected = structuredClone(original); expected.pages[0].widgets[0].x = 155;
  expect(await save(page, info, 'newer-property')).toEqual(expected);
  expect((await observations(page)).reads).toEqual([]);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'newer-property-undo')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await clean(page);
});

test('the newest font-delayed size command commits once and preserves other declarations', async ({ page }, info) => {
  const original = fixture(); await open(page, original); await selectFirst(page);
  await instrument(page, { delayFonts: true });
  await number(page, 'W', 240); await waiting(page);
  const firstCalls = (await observations(page)).calls;
  await number(page, 'W', 280); await waiting(page, firstCalls + 1);
  await release(page);
  await expect(page.locator('.statusbar')).toContainText('Selection layout updated');
  const expected = structuredClone(original);
  // WIyL unions this 20px panel and the 14px indicator after the external
  // width write; the old 40px owner height is not an independent invariant.
  Object.assign(expected.pages[0].widgets[0], { width: 280, height: 20 });
  expect(await save(page, info, 'newest-size')).toEqual(expected);
  expect((await observations(page)).reads.length).toBeGreaterThan(0);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'newest-size-undo')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info, 'newest-size-redo')).toEqual(expected);
  await clean(page);
});

test('adaptive font declarations project into measurement runs without changing saved rich text', async ({ page }, info) => {
  const original = fixture(), [first, second] = original.pages[0].widgets;
  for (const [index, widget] of [first, second].entries()) {
    widget.text = 'MMMMMMMMMMMM';
    widget.style.selectionButtonSize = 14;
    widget.richText = { paragraphs: [{ lineHeightPx: 20,
      runs: [{ text: widget.text, style: { fontSize: index ? 32 : 14 } }] }] };
  }
  original.pages[0].adaptiveViews[0].overrides = {
    [first.id]: { style: { fontSize: 32 } }, [second.id]: { style: { fontSize: 32 } },
  };
  await open(page, original);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  for (const type of ['checkbox', 'radio']) {
    await expect(page.locator(`.editor-widget.${type} [data-rich-run]`)).toHaveCSS('font-size', '32px');
  }
  await selectFirst(page); await page.keyboard.press('Control+a');
  await inspector(page).getByLabel('Fit selection width to text', { exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Selection layout updated');
  const saved = await save(page, info, 'adaptive-font-measured'), overrides = saved.pages[0].adaptiveViews[0].overrides;
  expect(overrides[first.id].width).toBeGreaterThan(180);
  expect(overrides[first.id].width).toEqual(overrides[second.id].width);
  expect(overrides[first.id].style).toEqual({ fontSize: 32 });
  expect(overrides[second.id].style).toEqual({ fontSize: 32 });
  // Only the explicit shared fit flag may change in Base; the declaration
  // projection must never be written back into either saved rich run.
  expect(saved.pages[0].widgets.map(widget => ({ ...widget, selectionText: {
    ...widget.selectionText!, autoFitWidth: false,
  } }))).toEqual(original.pages[0].widgets);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'adaptive-font-undo')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await clean(page);
});

test('second-target measurement failure discards the first plan and retry commits both in one undo', async ({ page }, info) => {
  const original = fixture(); await open(page, original); await selectFirst(page);
  await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-frame:not(.selection-group-frame)')).toHaveCount(2);
  await expect(page.locator('.selection-group-frame')).toHaveCount(1);
  await instrument(page, { failText: 'SECOND_LABEL' });
  await inspector(page).getByLabel('Fit selection width to text', { exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Intentional second selection measurement failure');
  const observed = await observations(page);
  expect(observed.reads.some(text => text.includes('FIRST_LABEL'))).toBe(true);
  expect(observed.failures).toBe(1);
  expect(await save(page, info, 'multi-target-rejected')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await expect(page.locator('.selection-frame:not(.selection-group-frame)')).toHaveCount(2);
  await expect(page.locator('.selection-group-frame')).toHaveCount(1);
  await clean(page);
  await page.evaluate(() => (window as unknown as InstrumentedWindow).selectionAuthorProbe.restore());
  await inspector(page).getByLabel('Fit selection width to text', { exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Selection layout updated');
  const committed = await save(page, info, 'multi-target-retry');
  for (const widget of committed.pages[0].widgets) {
    expect(widget.selectionText).toEqual({ autoFitWidth: true, autoFitHeight: false, alignRight: false });
    expect(widget.width).toBeLessThan(180);
  }
  expect(committed.pages[0].adaptiveViews).toEqual(original.pages[0].adaptiveViews);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'multi-target-undo')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info, 'multi-target-redo')).toEqual(committed);
  await clean(page);
});
