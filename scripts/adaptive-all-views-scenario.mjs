import {expect} from '@playwright/test';

export const allViewsTarget = 'all-views-target';
const inspector=page=>page.getByRole('complementary',{name:'Properties inspector'});
export const selectAllViewsTarget=async page=>{
  await page.getByRole('button',{name:'Outline',exact:true}).click();
  await page.locator(`[data-outline-widget-id="${allViewsTarget}"]`).locator('span').first().click();
};

/** Independent expected document for a fill-only edit. Other fields and other
 * objects remain byte-for-byte equal; this never calls the product edit helper. */
export function expectedAllViewsFill(source,fill){
  const expected=structuredClone(source),page=expected.pages[0];
  const target=page.widgets.find(widget=>widget.id===allViewsTarget);
  target.style.fill=fill;delete target.style.fillGradient;
  for(const map of [...page.adaptiveViews.map(view=>view.overrides),...Object.values(page.adaptiveOverrides??{})]){
    const patch=map[allViewsTarget];if(!patch?.style)continue;
    delete patch.style.fill;delete patch.style.fillGradient;
    if(!Object.keys(patch.style).length)delete patch.style;
    if(!Object.keys(patch).length)delete map[allViewsTarget];
  }
  return expected;
}

export async function exerciseAllViewsFill(page,source,host){
  await page.getByLabel('Adaptive view',{exact:true}).selectOption('all-phone');
  await selectAllViewsTarget(page);
  // The legacy label is accepted only so the first red run can exercise the
  // published placement-only switch and fail on actual saved behavior.
  await page.getByLabel(/^(Affect all views|Placement and insertion: all views)$/).check();
  const color=inspector(page).getByLabel('Fill',{exact:true});
  await color.fill('#11aa66');await color.press('Tab');
  const expected=expectedAllViewsFill(source,'#11aa66');
  expect(await host.save('all-fill')).toEqual(expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await host.save('undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await host.save('redo')).toEqual(expected);
  await host.open(expected);expect(await host.save('reopened')).toEqual(expected);
  for(const view of ['', 'all-tablet','all-phone','all-other']){
    await page.getByLabel('Adaptive view',{exact:true}).selectOption(view);
    await selectAllViewsTarget(page);await expect(inspector(page).getByLabel('Fill',{exact:true})).toHaveValue('#11aa66');
  }
  return {expected,checks:{baseWrite:true,allSavedMapsClearedForFillOnly:true,unrelatedValuesPreserved:true,undoRedo:true,saveReopen:true}};
}

export async function checkAllViewsFillPlayer(scope,selection){
  const target=scope.locator(`[data-widget-id="${allViewsTarget}"]`);
  for(const id of [null,'all-tablet','all-phone','all-other']){
    await selection.selectOption(JSON.stringify(id?{kind:'view',viewId:id}:{kind:'base'}));
    await expect(target).toHaveCSS('background-color','rgb(17, 170, 102)');
    await expect(target).toHaveCSS('background-image','none');
    await expect(target).toHaveCSS('left',id==='all-phone'?'80px':id==='all-tablet'?'60px':id==='all-other'?'100px':'40px');
  }
  return {allViewPaint:true,unrelatedLayoutRetained:true};
}

export function paddingFixture(source){
  const doc=structuredClone(source),page=doc.pages[0];page.widgets[0].style.textPadding=[1,2,3,4];
  for(const [id,values]of Object.entries({'all-tablet':[5,6,7,8],'all-phone':[11,12,13,14],'all-other':[21,22,23,24],'inactive-view':[31,32,33,34]}))page.adaptiveOverrides[id][allViewsTarget].style.textPadding=values;
  return doc;
}

export async function exerciseAllViewsPadding(page,source,host){
  await page.getByLabel('Adaptive view',{exact:true}).selectOption('all-phone');await selectAllViewsTarget(page);
  await page.getByLabel('Affect all views',{exact:true}).check();
  const input=inspector(page).getByLabel('Padding right',{exact:true});await input.fill('40');await input.press('Tab');
  const expected=structuredClone(source),target=expected.pages[0].widgets[0];target.style.textPadding[1]=40;
  for(const map of Object.values(expected.pages[0].adaptiveOverrides)){
    const local=map[allViewsTarget],tuple=local.style.textPadding;delete local.style.textPadding;
    local.textPaddingSides={top:tuple[0],bottom:tuple[2],left:tuple[3]};
  }
  expect(await host.save('padding-global')).toEqual(expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await host.save('padding-undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await host.save('padding-redo')).toEqual(expected);
  await page.getByLabel('Affect all views',{exact:true}).uncheck();await page.getByLabel('Adaptive view',{exact:true}).selectOption('');await selectAllViewsTarget(page);
  const base=inspector(page).getByLabel('Padding right',{exact:true});await base.fill('45');await base.press('Tab');expected.pages[0].widgets[0].style.textPadding[1]=45;
  expect(await host.save('padding-base-later')).toEqual(expected);await host.open(expected);
  for(const [id,values]of Object.entries({'all-tablet':[5,45,7,8],'all-phone':[11,45,13,14],'all-other':[21,45,23,24]})){
    await page.getByLabel('Adaptive view',{exact:true}).selectOption(id);await selectAllViewsTarget(page);
    for(const [index,side]of ['top','right','bottom','left'].entries())await expect(inspector(page).getByLabel(`Padding ${side}`,{exact:true})).toHaveValue(String(values[index]));
  }
  return {expected,checks:{onlyChangedPaddingSideCleared:true,otherSideDeclarationsRetained:true,laterBaseChangeInherited:true,undoRedo:true,saveReopen:true}};
}

export async function checkAllViewsPaddingPlayer(scope,selection){
  const text=scope.locator(`[data-widget-id="${allViewsTarget}"] .widget-text`).first();
  for(const [id,values]of Object.entries({'base':[1,45,3,4],'all-tablet':[5,45,7,8],'all-phone':[11,45,13,14],'all-other':[21,45,23,24]})){
    await selection.selectOption(JSON.stringify(id==='base'?{kind:'base'}:{kind:'view',viewId:id}));
    for(const [index,side]of ['top','right','bottom','left'].entries())await expect(text).toHaveCSS(`padding-${side}`,`${values[index]}px`);
  }
  return {eachPaddingSideResolved:true,legacyAndSparseDeclarationsCompose:true};
}
