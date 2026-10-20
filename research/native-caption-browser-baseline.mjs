import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';

const root = path.resolve(import.meta.dirname, '..'), baseURL = process.argv.find(value => value.startsWith('http://')) ?? 'http://127.0.0.1:5189';
const fresh = process.argv.includes('--fresh');
const prefix = path.join(root, `research/native-caption-browser-${fresh ? 'after' : 'baseline'}`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const formsEvidence = JSON.parse(await fs.readFile(path.join(root, 'research/rp-input-types-evidence.json'), 'utf8'));
const sample = formsEvidence.samples.find(sample => path.basename(sample.file) === 'Sample form patterns.rplib');
const sources = [sample.file, path.join(root, 'research/samples/complex-interactions-required-fields.rp')];
const sourceHashes = await Promise.all(sources.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
const desktopAudit = JSON.parse(await fs.readFile(path.join(root, '.build/input-types-desktop-audit.json'), 'utf8'));
const baselineFile = path.join(root, 'research/native-caption-before.rea.json');
const baselineBytes = await fs.readFile(baselineFile);
const audit = { startedAt: new Date().toISOString(), baseURL, method: 'Actual browser editor UI imports original containers; saved document plus unmodified preview DOM measurements. No CSS fixes or product changes.', sources: sourceHashes, errors: [], network: [], stages: [], screenshots: [], limitations: ['DOM Range rectangles are typographic selection bounds, not pixel-exact ink.', 'Canvas per-character ink estimates assume the Range top plus fontBoundingBoxAscent is the baseline and ignore kerning/ligature differences; raw per-character metrics are retained.', 'Viewport clipping is excluded from widget-text clipping. No original Axure GUI or native font rasterizer comparison.'] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1300 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage(); page.on('pageerror', error => audit.errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(baseURL)) audit.network.push(request.url()); });
  audit.browser = browser.version();
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const save = async name => { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = `${prefix}-${name}.rea.json`; await (await download).saveAs(file); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const openDocument = async (doc, name) => {
    await page.goto(baseURL); const chooser = page.waitForEvent('filechooser'); await menu('Open… Ctrl+O');
    await (await chooser).setFiles({ name: `${name}.rea.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
    await expect(page.locator('.titlebar')).toContainText(doc.name);
    return await save(name);
  };
  const collect = async (name, doc) => {
    await page.evaluate(() => document.fonts.ready);
    const data = await page.locator('.preview-page').evaluate((host, doc) => {
      const all = widgets => widgets.flatMap(widget => [widget, ...all((widget.states ?? []).flatMap(state => state.widgets)), ...all(widget.repeater?.template ?? [])]);
      const models = new Map(doc.pages.flatMap(page => all(page.widgets)).map(widget => [widget.id, widget]));
      const rect = value => ({ x: value.x, y: value.y, left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height });
      const css = element => { const computed = getComputedStyle(element), result = {}; for (const key of ['display', 'boxSizing', 'position', 'font', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight', 'letterSpacing', 'whiteSpace', 'overflowWrap', 'wordBreak', 'textAlign', 'alignItems', 'justifyContent', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'overflow', 'overflowX', 'overflowY', 'transform']) result[key] = computed[key]; return result; };
      const clipped = (bounds, clip) => ({ left: Math.max(0, clip.left - bounds.left), top: Math.max(0, clip.top - bounds.top), right: Math.max(0, bounds.right - clip.right), bottom: Math.max(0, bounds.bottom - clip.bottom) });
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      return [...host.querySelectorAll('.widget[data-widget-id]')].flatMap(widget => {
        const span = widget.querySelector(':scope > .widget-text'); if (!span || !span.textContent.trim()) return [];
        const model = models.get(widget.dataset.widgetId), widgetRect = rect(widget.getBoundingClientRect()), spanRect = rect(span.getBoundingClientRect()), widgetCss = css(widget), textCss = css(span);
        const clip = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }, clippingAncestors = [];
        for (let element = span; element; element = element.parentElement) {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          const x = /^(hidden|clip|auto|scroll)$/.test(style.overflowX), y = /^(hidden|clip|auto|scroll)$/.test(style.overflowY);
          if (x) { clip.left = Math.max(clip.left, box.left + parseFloat(style.borderLeftWidth)); clip.right = Math.min(clip.right, box.right - parseFloat(style.borderRightWidth)); }
          if (y) { clip.top = Math.max(clip.top, box.top + parseFloat(style.borderTopWidth)); clip.bottom = Math.min(clip.bottom, box.bottom - parseFloat(style.borderBottomWidth)); }
          if (x || y) clippingAncestors.push({ tag: element.tagName, classes: element.className, rect: rect(box), overflowX: style.overflowX, overflowY: style.overflowY });
          if (element === widget) break;
        }
        const fullRange = document.createRange(); fullRange.selectNodeContents(span); const range = rect(fullRange.getBoundingClientRect());
        ctx.font = `${textCss.fontStyle} ${textCss.fontWeight} ${textCss.fontSize} ${textCss.fontFamily}`;
        const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT), characters = []; let node;
        while ((node = walker.nextNode())) {
          let offset = 0;
          for (const character of node.textContent) {
            const local = document.createRange(); local.setStart(node, offset); offset += character.length; local.setEnd(node, offset);
            if (!character.trim()) continue;
            const box = rect(local.getBoundingClientRect()), m = ctx.measureText(character), baseline = box.top + m.fontBoundingBoxAscent;
            const ink = { left: box.left - m.actualBoundingBoxLeft, right: box.left + m.actualBoundingBoxRight, top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent };
            characters.push({ character, rect: box, clipping: clipped(box, clip), canvas: { width: m.width, actualBoundingBoxLeft: m.actualBoundingBoxLeft, actualBoundingBoxRight: m.actualBoundingBoxRight, actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent, fontBoundingBoxAscent: m.fontBoundingBoxAscent, fontBoundingBoxDescent: m.fontBoundingBoxDescent }, estimatedInk: ink, estimatedInkClipping: clipped(ink, clip) });
          }
        }
        const lines = [];
        for (const item of characters) { let line = lines.find(line => Math.abs(line.top - item.rect.top) < .2); if (!line) { line = { top: item.rect.top, bottom: item.rect.bottom, left: item.rect.left, right: item.rect.right, text: '' }; lines.push(line); } line.text += item.character; line.left = Math.min(line.left, item.rect.left); line.right = Math.max(line.right, item.rect.right); }
        const max = field => Object.fromEntries(['left', 'top', 'right', 'bottom'].map(side => [side, Math.max(0, ...characters.map(item => item[field][side]))]));
        return [{ id: widget.dataset.widgetId, name: model?.name, type: model?.type, text: span.textContent, model: model && { x: model.x, y: model.y, width: model.width, height: model.height, rotation: model.rotation, style: model.style, vectorPath: Boolean(model.vectorPath) }, widgetRect, spanRect, widgetCss, textCss, client: { width: span.clientWidth, height: span.clientHeight, scrollWidth: span.scrollWidth, scrollHeight: span.scrollHeight }, availableTextWidth: span.clientWidth - parseFloat(textCss.paddingLeft) - parseFloat(textCss.paddingRight), clippingAncestors, clip, range, rangeClipping: clipped(range, clip), characters, lines, lineCount: lines.length, maxCharacterClipping: max('clipping'), maxEstimatedInkClipping: max('estimatedInkClipping'), fontLoaded: document.fonts.check(`${textCss.fontWeight} ${textCss.fontSize} ${textCss.fontFamily}`) }];
      });
    }, doc);
    const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root: documentRoot } = await cdp.send('DOM.getDocument');
    for (const label of data) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: documentRoot.nodeId, selector: `.preview-page [data-widget-id="${label.id}"] > .widget-text` });
      label.platformFonts = (await cdp.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
    }
    await cdp.detach();
    const file = `${prefix}-${name}.png`; await page.screenshot({ path: file, fullPage: true }); audit.screenshots.push(file); audit.stages.push({ name, dpr: await page.evaluate(() => devicePixelRatio), labels: data });
  };

  audit.method = 'Actual editor Open/Save/Preview of fixed pre-fix desktop-imported forms project, compared with current reader/importer Required Fields recovery. Unmodified DOM measurements; no CSS fixes or product changes.';
  audit.baseline = { file: baselineFile, sha256: sha(baselineBytes), desktopImportAudit: '.build/input-types-desktop-audit.json', packagedAsarSha256: desktopAudit.appAsarSha256, importedSourceSha256: desktopAudit.nativePhone.sourceSha256 };
  expect(desktopAudit.ok).toBe(true); expect(desktopAudit.nativePhone.sourceSha256).toBe(sourceHashes[0].sha256);
  let forms;
  if (fresh) {
    const semantics = inspectRpSemantics(sources[0]); await page.goto(baseURL);
    const recovered = await page.evaluate(async semantics => (await import('/src/model/import-rp.ts')).importRpSemantics(semantics, 'Sample form patterns.rplib'), semantics);
    forms = { doc: await openDocument(recovered.document, 'forms') }; audit.formsImportReport = recovered.report;
    audit.method = 'Fresh real-container reader/importer recovery, followed by actual editor Open/Save/Preview and unmodified DOM measurements. No CSS fixes or product changes.';
  } else { forms = { doc: await openDocument(JSON.parse(baselineBytes), 'forms') }; audit.formsImportReport = desktopAudit.nativeImportReport; }
  const personal = forms.doc.pages.find(page => page.name === 'Personal information form'); expect(personal).toBeTruthy();
  await page.locator('.left-pane').getByRole('button', { name: 'Pages', exact: true }).click(); await page.locator(`[data-page-node-id="${personal.id}"]`).dblclick();
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await collect('personal-information', forms.doc);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('forms-after')).toEqual(forms.doc);
  const semantics = inspectRpSemantics(sources[1]);
  await page.goto(baseURL);
  const recovered = await page.evaluate(async semantics => (await import('/src/model/import-rp.ts')).importRpSemantics(semantics, 'Required Fields browser comparison'), semantics);
  const required = { doc: await openDocument(recovered.document, 'required') }; audit.requiredImportReport = recovered.report;
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await collect('required-initial', required.doc);
  const scope = page.locator('.preview-overlay'); await scope.locator('.widget').filter({ hasText: /^Sign Up$/ }).click(); await expect(scope.locator('.widget[aria-label="Error Message"]')).toBeVisible(); await collect('required-error', required.doc);
  await scope.locator('input[aria-label="Email Field"]').fill('person@example.test'); await scope.locator('input[aria-label="Password Field"]').fill('secret'); await scope.locator('.widget').filter({ hasText: /^Sign Up$/ }).click();
  await expect(scope.getByText('Thank you for signing up!', { exact: true })).toBeVisible(); await collect('required-success', required.doc);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('required-after')).toEqual(required.doc);
  for (const source of sourceHashes) expect(sha(await fs.readFile(source.file))).toBe(source.sha256);
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]); audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally {
  await browser.close(); audit.finishedAt = new Date().toISOString(); await fs.writeFile(`${prefix}.json`, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify({ ok: audit.ok, failure: audit.failure, stages: audit.stages.map(stage => ({ name: stage.name, labels: stage.labels.length, clipped: stage.labels.filter(label => Object.values(label.maxCharacterClipping).some(value => value > .5)).map(label => ({ id: label.id, text: label.text, size: [label.model.width, label.model.height], padding: label.model.style.textPadding, font: label.textCss.font, lineHeight: label.textCss.lineHeight, lines: label.lineCount, rangeClipping: label.maxCharacterClipping, estimatedInkClipping: label.maxEstimatedInkClipping })) })) }, null, 2));
}
