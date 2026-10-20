import { expect } from '@playwright/test';
const widget = (scope, name) => scope.locator(`.widget[aria-label="${name}"]`);
const rows = (scope, name) => widget(scope, name).locator(':scope > .repeater-row');
const geometry = locator => locator.evaluateAll(elements => elements.map(el => ['left', 'top', 'width', 'height'].map(key => Number.parseFloat(el.style[key]))));
export async function exerciseRepeaterLayout(scope) {
  const main = rows(scope, 'Wrapped records'), fit = rows(scope, 'Fitted records'), horizontal = rows(scope, 'Horizontal records');
  await expect(main).toHaveCount(5); await expect(fit).toHaveCount(2); await expect(horizontal).toHaveCount(5);
  expect(await geometry(main)).toEqual([[0,0,160,54],[0,62,160,54],[172,0,160,54],[172,62,160,54],[344,0,160,54]]);
  expect(await geometry(horizontal)).toEqual([[0,0,160,54],[172,0,160,54],[344,0,160,54],[0,62,160,54],[172,62,160,54]]);
  await widget(scope, 'Grow row').nth(0).click();
  await expect(widget(scope, 'Resize log')).toHaveText('Item Resized: 1:A|');
  expect(await geometry(main)).toEqual([[0,0,210,84],[0,92,160,54],[222,0,160,54],[222,62,160,54],[394,0,160,54]]);
  await expect(widget(scope, 'Wrapped records')).toHaveCSS('width', '554px'); await expect(widget(scope, 'Wrapped records')).toHaveCSS('height', '146px');
  await widget(scope, 'Grow row').nth(0).click(); await expect(widget(scope, 'Resize log')).toHaveText('Item Resized: 1:A|');
  await widget(scope, 'Shrink row').nth(0).click(); await expect(widget(scope, 'Resize log')).toHaveText('Item Resized: 1:A|1:A|');
  await expect(widget(scope, 'Wrapped records')).toHaveCSS('width', '504px');
  await widget(scope, 'Grow row').nth(2).click(); await expect(widget(scope, 'Resize log')).toHaveText('Item Resized: 1:A|1:A|3:C|');
  await widget(scope, 'Sort and reset rows').click(); await expect(widget(scope, 'Grow row')).toHaveText(['Grow E','Grow D','Grow C','Grow B','Grow A']);
  expect(await geometry(main)).toEqual([[0,0,160,54],[0,62,160,54],[172,0,160,54],[172,62,160,54],[344,0,160,54]]);
  await widget(scope, 'Grow row').nth(0).click(); await expect(widget(scope, 'Resize log')).toHaveText('Item Resized: 1:A|1:A|3:C|1:E|');
  await widget(scope, 'Expand content').nth(0).click(); await expect(widget(scope, 'Fit log')).toHaveText('Content fit: 1:A|');
  expect(await geometry(fit)).toEqual([[0,0,310,120],[0,130,330,70]]); await expect(widget(scope, 'Fitted records')).toHaveCSS('height', '200px');
  await widget(scope, 'Expand content').nth(0).click(); await expect(widget(scope, 'Fit log')).toHaveText('Content fit: 1:A|');
  await widget(scope, 'Reset fitted content').click(); expect(await geometry(fit)).toEqual([[0,0,330,70],[0,80,330,70]]);
  await widget(scope, 'Grow horizontal row').nth(1).click();
  expect(await geometry(horizontal)).toEqual([[0,0,160,54],[172,0,210,84],[394,0,160,54],[0,92,160,54],[172,92,160,54]]);
  await expect(widget(scope, 'Horizontal records')).toHaveCSS('width', '554px'); await expect(widget(scope, 'Horizontal records')).toHaveCSS('height', '146px');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}
