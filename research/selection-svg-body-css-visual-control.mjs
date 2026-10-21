import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const resultPath = 'research/selection-svg-body-css-probes.json';
const probe = JSON.parse(await fs.readFile(resultPath, 'utf8'));
const sample = probe.results.findLast(item => item.input.scaled);
assert.equal(sample.passed, true);
const hash = async path => createHash('sha256').update(await fs.readFile(path)).digest('hex');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 1 });
  const size = sample.input.cssRect.width;
  // Separate inline positioning avoids the original illustration's #u-only
  // selector leaking into the cloned control. This is a synthetic paint probe.
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; font: 16px sans-serif; background: white; color: #13243b; }
    .caption { position:absolute; top:55px; }
    .note { position:absolute; left:50px; top:285px; font-size:13px; }
  </style></head><body>
    <div class="caption" style="left:50px">Default inline SVG: clipped</div>
    <div class="caption" style="left:420px">Explicit overflow: visible</div>
    ${['clipped', 'visible'].map((id, index) => `<div id="${id}-owner" style="position:absolute;left:${index ? 440 : 100}px;top:150px;width:100px;height:30px"><label style="position:absolute;left:0;top:0;width:100px;height:30px"><svg id="${id}" style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;transform:scale(2,3);transform-origin:top left;${index ? 'overflow:visible;' : ''}"><rect id="${id}-body" x="-5" y="-5" width="${size + 10}" height="${size + 10}" fill="#2058b0"/></svg></label></div>`).join('')}
    <div class="note">Synthetic oversized body · viewport 22 × 22 · CSS scale 2 × 3</div>
  </body></html>`);
  await page.addStyleTag({ content: await fs.readFile(probe.sources[0].path, 'utf8') });
  const controls = await page.evaluate(() => ['clipped', 'visible'].map(id => {
    const svg = document.getElementById(id), rect = svg.getBoundingClientRect();
    return { id, overflow: getComputedStyle(svg).overflow,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      hits: { inside: document.elementFromPoint(rect.x + 1, rect.y + 1)?.id,
        left: document.elementFromPoint(rect.x - 1, rect.y + 1)?.id,
        right: document.elementFromPoint(rect.right + 1, rect.y + 1)?.id } };
  }));
  assert.equal(controls[0].overflow, 'hidden');
  assert.equal(controls[1].overflow, 'visible');
  for (const control of controls) {
    assert.equal(control.rect.y, 150);
    assert.equal(control.rect.width, size * 2);
    assert.equal(control.rect.height, size * 3);
    assert.equal(control.hits.inside, `${control.id}-body`);
  }
  assert.notEqual(controls[0].hits.left, 'clipped-body');
  assert.notEqual(controls[0].hits.right, 'clipped-body');
  assert.equal(controls[1].hits.left, 'visible-body');
  assert.equal(controls[1].hits.right, 'visible-body');
  const screenshot = '.build/selection-svg-body-css-control-corrected.png';
  await page.screenshot({ path: screenshot });
  const output = {
    method: 'Corrected visual control only. Original 24-case result retained; this does not execute the original DLL or claim native path geometry.',
    correction: 'Original screenshot cloned an owner whose #u and #u label CSS did not apply to the clone. The 24 independent case assertions were unaffected. Each new control has explicit independent inline positioning.',
    controls, screenshot: { path: screenshot, sha256: await hash(screenshot) },
    sources: await Promise.all([resultPath, probe.sources[0].path, import.meta.filename].map(async path => ({ path, sha256: await hash(path) }))),
    passed: true,
  };
  await fs.writeFile('research/selection-svg-body-css-visual-control.json', JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: true, controls }));
} finally { await browser.close(); }
