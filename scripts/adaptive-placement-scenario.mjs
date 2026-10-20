import {expect} from '@playwright/test';

export async function exerciseAdaptivePlacement(scope,host,ids){
  const w=id=>scope.locator(`[data-widget-id="rp-w-${ids.pagePackage}-${id}"]`);
  const target=w(ids.target),orphan=w(ids.orphan),select=host.selection;
  const click=host.click??(locator=>locator.click());
  await click(w(ids.baseButton));await expect(target).toBeVisible();await expect(orphan).toBeHidden();
  await select.selectOption(JSON.stringify({kind:'view',viewId:`rp-av-${ids.tablet}`}));
  await expect(target).toBeHidden();await expect(orphan).toBeHidden();await host.capture?.('tablet-unplaced');
  await click(w(ids.phoneButton));await expect(target).toBeVisible();await expect(orphan).toBeVisible();
  await expect(target).toHaveCSS('left','24px');await expect(target).toHaveCSS('width','240px');
  await expect(target.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill','rgb(0, 255, 0)');
  await host.capture?.('phone-restored');
  await click(w(ids.baseButton));await host.mobile();await expect(target).toBeVisible();await expect(orphan).toBeHidden();
  await click(w(ids.autoButton));await expect(target).toBeVisible();await expect(orphan).toBeVisible();
  await select.selectOption(JSON.stringify({kind:'view',viewId:`rp-av-${ids.tablet}`}));await expect(target).toBeHidden();
  await click(w(ids.phoneButton));await expect(target).toBeVisible();
  return {baseUnplacedRetained:true,parentUnplaced:true,childExplicitTrueRestores:true,geometryAndStyleInheritance:true,nativeActionsChangeViews:true,baseSelectionSurvivesResize:true,autoUsesPlacement:true,repeatedTransitions:true};
}
