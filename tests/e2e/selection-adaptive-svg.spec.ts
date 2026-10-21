import { expect, test, type FrameLocator, type Locator } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Selection adaptive SVG'; doc.caseSelection = 'never';
  const controls = (['radio', 'checkbox'] as const).map((type, i) => {
    const w = createWidget(type, 70, 70 + i * 180);
    Object.assign(w, { id: `scale-${type}`, name: type, text: `${type} text`, width: 100, height: 24,
      selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: i === 1 } });
    Object.assign(w.style, { selectionButtonSize: 14, strokeWidth: 1, radius: 0, fill: '#ffffff', stroke: '#123456',
      fontFamily: 'Arial', fontSize: 14, fontWeight: 400, textAlign: 'left', verticalAlign: 'top', textPadding: [0,2,0,2] });
    return w;
  });
  const button = (name: string, y: number, actions: Omit<Action, 'id'>[]) => {
    const w = createWidget('button', 500, y); w.name = w.text = name; w.width = 210;
    w.interactions = [{ id: uid(), event: 'click', name, enabled: true, conditionMode: 'all', conditions: [],
      actions: actions.map(action => ({ id: uid(), ...action })) }]; return w;
  };
  const view = (id: string, name: string, y: number) => button(name, y, [{ type: 'setAdaptiveView', adaptiveView: { kind: 'view', viewId: id } }]);
  const page = doc.pages[0]; page.width = 1000; page.height = 650;
  // Use the supported legacy threshold policy so all three host widths start
  // at Base. Initial named-view applications are covered by the runtime suite.
  delete page.adaptiveSelection; delete page.adaptiveBaseSize;
  page.adaptiveViews = [
    { id: 'scale-a', name: 'Scale A', width: 400, overrides: Object.fromEntries(controls.map(w => [w.id, { width: 200, height: 72 }])) },
    { id: 'scale-b', name: 'Scale B', width: 300, overrides: Object.fromEntries(controls.map(w => [w.id, { width: 150, height: 24 }])) },
    { id: 'scale-p94', name: 'P94 only', width: 200, overrides: Object.fromEntries(controls.map(w => [w.id, { style: { selectionButtonSize: 28 } }])) },
    { id: 'scale-crop', name: 'Crop declaration', width: 190, overrides: Object.fromEntries(controls.map(w => [w.id, { style: { selectionButtonSize: 18, strokeWidth: 3 } }])) },
  ];
  page.widgets = [...controls, view('scale-a', 'Apply A', 70), view('scale-b', 'Apply B', 130), view('scale-p94', 'Apply P94', 190),
    button('Apply Base', 250, [{ type: 'setAdaptiveView', adaptiveView: { kind: 'base' } }]),
    view('scale-crop', 'Apply crop', 370), button('Paint controls', 310, controls.flatMap(w => [
      { type: 'setSelected' as const, targetId: w.id, value: 'true' },
      { type: 'setStyle' as const, targetId: w.id, style: { strokeWidth: 3, stroke: '#2244aa' } },
    ]))];
  const fractional = structuredClone(controls[0]);
  Object.assign(fractional, { id: 'fractional-radio', text: 'Fractional scale', y: 470 });
  page.widgets.push(fractional);
  for (let i = 1; i <= 4; i++) {
    const id = `fraction-${i}`, name = `Fraction ${i}`;
    page.adaptiveViews.push({ id, name, width: 100 - i, overrides: { [fractional.id]: { width: 133.3, height: 31.7 } } });
    const action = view(id, name, i * 60 + 10); action.x = 760; page.widgets.push(action);
  }
  const midpoint = structuredClone(controls[0]);
  Object.assign(midpoint, { id: 'midpoint-radio', text: 'Midpoint scale', x: 300, y: 470 }); page.widgets.push(midpoint);
  for (let i = 1; i <= 2; i++) {
    const id = `midpoint-${i}`, name = `Midpoint ${i}`;
    page.adaptiveViews.push({ id, name, width: 90 - i, overrides: { [midpoint.id]: { width: 101.5625, height: 24 } } });
    const action = view(id, name, 280 + i * 60); action.x = 760; page.widgets.push(action);
  }
  const framed = createPage('Adaptive SVG frame'), frame = createWidget('inlineFrame', 10, 10);
  Object.assign(frame, { id: 'adaptive-svg-frame', width: 1000, height: 650 });
  frame.inlineFrame!.target = { kind: 'page', pageId: page.id }; frame.inlineFrame!.hideBorders = true;
  framed.widgets = [frame]; framed.width = 1100; framed.height = 700; doc.pages.push(framed);
  return { doc, controls };
}

for (const mode of ['preview', 'frame', 'offline'] as const) test(`${mode}: adaptive SVG accumulates only on actual view applications`, async ({ page, browser }, info) => {
  const { doc, controls } = fixture(), errors: string[] = [];
  await writeFile(info.outputPath('input.rea.json'), serializeDocument(doc));
  page.on('pageerror', error => errors.push(error.message)); await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'adaptive-svg.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  async function exercise(scope: Locator | FrameLocator) {
    const owner = (id: string) => scope.locator(`[data-widget-id="${id}"]`);
    const svg = (id: string) => owner(id).locator('svg[data-selection-indicator]');
    const before = new Map<string, unknown>();
    for (const w of controls) {
      await expect(svg(w.id)).toHaveCSS('transform', 'none');
      await expect(svg(w.id)).toHaveCSS('width', '15px');
      await expect(svg(w.id)).toHaveCSS('height', '15px');
      await expect(svg(w.id)).toHaveCSS('overflow', 'hidden');
      for (const attribute of ['viewBox', 'width', 'height']) expect(await svg(w.id).getAttribute(attribute)).toBeNull();
      before.set(w.id, await svg(w.id).evaluate(node => {
        node.setAttribute('data-test-adaptive-identity', 'retained');
        return { viewBox: node.getAttribute('viewBox'), paths: [...node.children].map(child => child.getAttribute('d') ?? child.getAttribute('points')) };
      }));
      await owner(w.id).locator('input').evaluate(node => node.setAttribute('data-test-adaptive-identity', 'retained'));
    }
    // A disposable oversized body checks actual clipping on the product root.
    // Pointer events are enabled only for this probe and restored immediately.
    const clipping = await svg(controls[0].id).evaluate(node => {
      const svg = node as SVGSVGElement, saved = svg.getAttribute('style');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      marker.id = 'selection-crop-probe';
      for (const [name, value] of Object.entries({ x: '-5', y: '-5', width: '25', height: '25', fill: '#2058b0', 'pointer-events': 'all' })) marker.setAttribute(name, value);
      try {
        svg.append(marker); svg.style.pointerEvents = 'all';
        // Keep the text sibling from occluding the overflow control hit.
        svg.style.zIndex = '1';
        const rect = svg.getBoundingClientRect(), hit = () => ({
          inside: document.elementFromPoint(rect.x + 1, rect.y + 1)?.id,
          left: document.elementFromPoint(rect.x - 1, rect.y + 1)?.id,
          right: document.elementFromPoint(rect.right + 1, rect.y + 1)?.id,
        });
        const clipped = hit(); svg.style.overflow = 'visible';
        return { clipped, visible: hit() };
      } finally { marker.remove(); if (saved === null) svg.removeAttribute('style'); else svg.setAttribute('style', saved); }
    });
    expect(clipping.clipped.inside).toBe('selection-crop-probe');
    expect(clipping.clipped.left).not.toBe('selection-crop-probe'); expect(clipping.clipped.right).not.toBe('selection-crop-probe');
    expect(clipping.visible.left).toBe('selection-crop-probe'); expect(clipping.visible.right).toBe('selection-crop-probe');
    const check = async (x: number, y: number, crop = 15, logicalSize = 14, padding = 0) => {
      for (const w of controls) {
        await expect(svg(w.id)).toHaveCSS('transform', `matrix(${x}, 0, 0, ${y}, 0, 0)`);
        await expect(svg(w.id)).toHaveCSS('transform-origin', '0px 0px');
        await expect(svg(w.id)).toHaveAttribute('data-test-adaptive-identity', 'retained');
        await expect(owner(w.id).locator('input')).toHaveAttribute('data-test-adaptive-identity', 'retained');
        const geometry = await svg(w.id).evaluate(node => ({ viewBox: node.getAttribute('viewBox'),
          paths: [...node.children].map(child => child.getAttribute('d') ?? child.getAttribute('points')) }));
        expect(geometry).toEqual(before.get(w.id));
        await expect(svg(w.id)).toHaveCSS('width', `${crop}px`); await expect(svg(w.id)).toHaveCSS('height', `${crop}px`);
        await expect(svg(w.id)).toHaveCSS('overflow', 'hidden');
        const ownerWidth = Number.parseFloat(await owner(w.id).evaluate(node => getComputedStyle(node).width));
        await expect(svg(w.id)).toHaveCSS('left', `${w.selectionText!.alignRight ? ownerWidth - logicalSize - padding : -padding}px`);
        const box = await svg(w.id).boundingBox(); expect(box).not.toBeNull();
        expect(box!.width).toBeCloseTo(crop * x, 4); expect(box!.height).toBeCloseTo(crop * y, 4);
        await expect(owner(w.id)).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
        await expect(owner(w.id).locator('label')).toHaveCSS('transform', 'none');
      }
    };
    await scope.getByRole('button', { name: 'Apply A', exact: true }).click(); await check(2, 3);
    await scope.getByRole('button', { name: 'Apply A', exact: true }).click(); await check(2, 3);
    await scope.getByRole('button', { name: 'Paint controls', exact: true }).click(); await check(2, 3);
    for (const w of controls) { await expect(owner(w.id).locator('input')).toBeChecked(); await expect(svg(w.id).locator('[data-selection-outline]')).toHaveCSS('stroke-width', '3px'); }
    await scope.getByRole('button', { name: 'Apply B', exact: true }).click(); await check(3, 3);
    await scope.getByRole('button', { name: 'Apply P94', exact: true }).click(); await check(3, 3, 29, 28);
    await scope.getByRole('button', { name: 'Apply crop', exact: true }).click(); await check(3, 3, 22, 18, 1.5);
    await scope.getByRole('button', { name: 'Apply Base', exact: true }).click(); await check(3, 3);
    await scope.getByRole('button', { name: 'Apply A', exact: true }).click(); await check(6, 9);
    // Original style.js re-reads Chromium's computed matrix before multiplying.
    // Retaining arbitrary JS precision across all four steps gives other values.
    const fractions = [[1.333, 1.32083], [1.77689, 1.7446], [2.36859, 2.30433], [3.15733, 3.04364]];
    for (const [index, [x, y]] of fractions.entries()) {
      await scope.getByRole('button', { name: `Fraction ${index + 1}`, exact: true }).click();
      await expect(svg('fractional-radio')).toHaveCSS('transform', `matrix(${x}, 0, 0, ${y}, 0, 0)`);
      await check(6, 9);
    }
    await scope.getByRole('button', { name: 'Midpoint 1', exact: true }).click();
    await expect(svg('midpoint-radio')).toHaveCSS('transform', 'matrix(1.01562, 0, 0, 1, 0, 0)');
    await scope.getByRole('button', { name: 'Midpoint 2', exact: true }).click();
    await expect(svg('midpoint-radio')).toHaveCSS('transform', 'matrix(1.03149, 0, 0, 1, 0, 0)');
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  }
  if (mode === 'offline') {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const output = info.outputPath('adaptive-svg.html'); await (await download).saveAs(output);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try {
      const player = await context.newPage(), requests: string[] = [];
      player.on('pageerror', error => errors.push(error.message));
      player.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await player.goto(pathToFileURL(output).href); await exercise(player.locator('body'));
      await player.screenshot({ path: info.outputPath('selection-adaptive-offline.png') });
      await player.getByRole('button', { name: 'Adaptive SVG frame', exact: true }).click();
      await exercise(player.frameLocator('[data-inline-frame="adaptive-svg-frame"]')); expect(requests).toEqual([]);
    } finally { await context.close(); }
  } else {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    if (mode === 'frame') {
      await page.locator('.preview-overlay').getByRole('button', { name: 'Adaptive SVG frame', exact: true }).click();
      await exercise(page.frameLocator('[data-inline-frame="adaptive-svg-frame"]'));
    } else await exercise(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath(`selection-adaptive-${mode}.png`) });
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const output = info.outputPath('unchanged.rea.json'); await (await saved).saveAs(output);
  expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
