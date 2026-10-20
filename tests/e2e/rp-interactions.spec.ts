import { expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importRpSemantics } from '../../src/model/import-rp';
import type { Document } from '../../src/model/types';

const read = (name: string) => importRpSemantics(JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('../../research/scripts/read-rp-semantics.mjs', import.meta.url)), fileURLToPath(new URL(`../../research/samples/${name}`, import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })), name).document;
async function tabs(scope: Locator | Page) {
  const a=scope.locator('.widget.box').filter({hasText:/^Tab 1$/}),b=scope.locator('.widget.box').filter({hasText:/^Tab 2$/}),panel=scope.locator('.widget.panel');
  await expect(panel).toHaveCSS('width','300px'); await expect(panel).toHaveCSS('height','170px');
  await expect(panel).toHaveText('Tab 1 Content'); await expect(a.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(129, 211, 248)');
  for (let i=0;i<2;i++) {
    await b.click(); await expect(panel).toHaveText('Tab 2 Content');
    await expect(a.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(255, 255, 255)'); await expect(b.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(129, 211, 248)');
    await a.click(); await expect(panel).toHaveText('Tab 1 Content');
    await expect(a.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(129, 211, 248)'); await expect(b.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(255, 255, 255)');
  }
  await expect(scope.getByRole('menu',{name:'Choose a case',exact:true})).toHaveCount(0);
}
async function menu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'native-interactions.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
for (const mode of ['preview','offline'] as const) test(`${mode}: real Tab Menu RP switches panel state and selected styles without losing inherited layout`,async({page,browser},testInfo)=>{
  const doc=read('the-basics-tab-menu.rp'); await open(page,doc);
  if(mode==='preview') { await page.getByTitle('Preview (F5)',{exact:true}).click(); await tabs(page.locator('.preview-overlay')); }
  else {
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();
    const file=testInfo.outputPath('native-tabs.html');await(await download).saveAs(file);
    const context=await browser.newContext();try { const exported=await context.newPage();await exported.goto(pathToFileURL(file).href);await tabs(exported); }finally{await context.close();}
  }
});
async function requiredFields(scope: Locator | Page) {
  const email = scope.locator('input[aria-label="Email Field"]'), password = scope.locator('input[aria-label="Password Field"]');
  const error = scope.locator('.widget[aria-label="Error Message"]'), submit = scope.locator('.widget').filter({ hasText: /^Sign Up$/ });
  const textFits = async (label: Locator) => {
    await expect(label).toBeVisible();
    expect(await label.evaluate(element => {
      const span = element.querySelector('.widget-text')!, range = document.createRange(); range.selectNodeContents(span);
      const text = range.getBoundingClientRect(), widget = element.getBoundingClientRect();
      return text.left >= widget.left - 1 && text.right <= widget.right + 1 && text.top >= widget.top - 1 && text.bottom <= widget.bottom + 1;
    })).toBe(true);
  };
  await expect(password).toHaveAttribute('type', 'password'); await expect(error).toHaveCount(0);
  for (const name of ['Email', 'Password']) await textFits(scope.locator('.widget').filter({ hasText: new RegExp(`^${name}$`) }));
  await submit.click(); await expect(error).toBeVisible(); await textFits(error);
  await email.click(); await expect(error).toHaveCount(0); await email.fill('person@example.test');
  await submit.click(); await expect(error).toBeVisible();
  await password.click(); await expect(error).toHaveCount(0); await password.fill('FaLsE');
  await submit.click(); await expect(error).toBeVisible(); // Native getBool equality, not strict string comparison.
  await password.click(); await expect(error).toHaveCount(0); await password.fill('secret');
  await submit.click(); await expect(scope.getByText('Thank you for signing up!', { exact: true })).toBeVisible();
  await textFits(scope.locator('.widget').filter({ hasText: /^Thank you for signing up!$/ }));
  await expect(scope.getByRole('menu', { name: 'Choose a case', exact: true })).toHaveCount(0);
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: real Required Fields RP recovers password, focus, conditional failure and page navigation`, async ({ page, browser }, testInfo) => {
  const doc = read('complex-interactions-required-fields.rp'), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await requiredFields(page.locator('.preview-overlay'));
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = testInfo.outputPath('native-required.html'); await (await download).saveAs(file);
    const context = await browser.newContext();
    try {
      const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', error => errors.push(error.message));
      exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(file).href); await requiredFields(exported); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: UX navigation keeps reused native widget IDs inside their page packages`, async ({ page, browser }, testInfo) => {
  const doc = read('UX Prototyping.rp'); await open(page, doc);
  const pairs = doc.pages.flatMap(p => p.widgets.filter(w => w.interactions.some(i => i.actions.some(a => a.type === 'openPage'))).map(w => ({ page: p, widget: w })));
  expect(pairs).toHaveLength(6);
  const exercise = async (scope: Locator | Page, offline: boolean) => {
    for (const { page: source, widget } of pairs) {
      const navigation = scope.locator(offline ? 'nav' : '.preview-pages');
      await navigation.getByRole('button', { name: source.name, exact: true }).click();
      const target = doc.pages.find(p => p.id === widget.interactions[0].actions[0].targetId)!;
      await scope.locator(`.widget[aria-label="${widget.name}"]`).click();
      if (offline) await expect(navigation.getByRole('button', { name: target.name, exact: true })).toHaveAttribute('aria-current', 'true');
      else await expect(scope.locator('.preview-toolbar')).toContainText(target.name);
    }
  };
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay'), false); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = testInfo.outputPath('native-ux.html'); await (await download).saveAs(file);
    const context = await browser.newContext(); try { const exported = await context.newPage(); await exported.goto(pathToFileURL(file).href); await exercise(exported, true); } finally { await context.close(); }
  }
});
