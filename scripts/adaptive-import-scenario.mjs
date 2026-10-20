import { expect } from '@playwright/test';

/** One scenario shared by production-browser and exact-package tests. The input
 * originates in an explicitly synthetic raw RP carrier, not a direct model fixture.
 */
export async function exerciseAdaptiveImport(scope,host,ids){
  const w=id=>scope.locator(`[data-widget-id="rp-w-${ids.pagePackage}-${id}"]`),target=w(ids.target),selection=host.selection;
  const click=host.click??(locator=>locator.click()),hover=host.hover??(locator=>locator.hover());
  const paint=rgb=>expect(target.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill',rgb);
  const mode=value=>expect(selection).toHaveValue(JSON.stringify(value));
  const box=async(x,y,width,height)=>{for(const[k,v]of Object.entries({left:x,top:y,width,height}))await expect(target).toHaveCSS(k,`${v}px`);};
  await click(w(ids.baseButton));await mode({kind:'base'});await paint('rgb(129, 211, 248)');await box(220,220,140,40);
  await selection.selectOption(JSON.stringify({kind:'view',viewId:`rp-av-${ids.tablet}`}));
  await paint('rgb(255, 0, 0)');await box(80,220,240,64);await host.capture?.('tablet');
  await click(w(ids.phoneButton));await mode({kind:'view',viewId:`rp-av-${ids.phone}`});await paint('rgb(0, 255, 0)');await box(24,240,240,64);
  await hover(target);await paint('rgb(0, 255, 0)');await host.capture?.('phone');
  await click(w(ids.baseButton));await mode({kind:'base'});await host.mobile();await paint('rgb(129, 211, 248)');await box(220,220,140,40);
  await click(w(ids.autoButton));await mode({kind:'auto'});await paint('rgb(0, 255, 0)');await box(24,240,240,64);
  return {rawNativeActionTargets:true,baseStyleRestored:true,parentGeometryInherited:true,wholeStateMapBarrier:true,selectedStylePreserved:true,hoverBlockedByEmptyMap:true,forcedBaseSurvivesResize:true,autoResumesViewportSelection:true};
}
