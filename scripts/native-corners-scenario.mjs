import {expect} from '@playwright/test';

export async function checkNativeCornersPlayer(scope,page,{capture,samplePixel}={}){
  const w=id=>scope.locator(`[data-widget-id="${id}"]`),fill=id=>w(id).locator('[data-shadow-fill]');
  const countCurves=async locator=>((await locator.getAttribute('d'))?.match(/C /g)??[]).length;
  for(let mask=0;mask<16;mask++)expect(await countCurves(fill(`corner-mask-${mask}`))).toBe([1,2,4,8].filter(bit=>mask&bit).length);
  await expect(w('corners-html')).toHaveCSS('border-radius','30px 0px 0px 30px');
  await expect(fill('corners-target')).toHaveAttribute('d',/C 0 8\.8 8\.8 0 20 0/);
  await w('corners-mask').click();expect(await countCurves(fill('corners-target'))).toBe(1);await expect(fill('corners-target')).toHaveAttribute('d',/C 0 8\.8 8\.8 0 20 0/);
  await w('corners-radius').click();expect(await countCurves(fill('corners-target'))).toBe(1);await expect(fill('corners-target')).toHaveAttribute('d',/C 0 5\.28 5\.28 0 12 0/);
  await w('corners-target').hover();expect(await countCurves(fill('corners-target'))).toBe(1);await expect(fill('corners-target')).toHaveAttribute('d',/ 36 0/);
  await w('corners-select').click();expect(await countCurves(fill('corners-target'))).toBe(2);await expect(fill('corners-target')).toHaveAttribute('d',/ 12 0/);
  await w('corners-target').hover();expect(await countCurves(fill('corners-target'))).toBe(2);await expect(fill('corners-target')).toHaveAttribute('d',/ 36 0/);
  await w('corners-title').hover();
  const rows=w('corners-row');await expect(rows).toHaveCount(2);await rows.first().hover();expect(await countCurves(rows.first().locator('[data-shadow-fill]'))).toBe(1);expect(await countCurves(rows.last().locator('[data-shadow-fill]'))).toBe(4);
  await w('corners-title').hover();
  // Independent pixel evidence: rounded TL reveals the white page, disabled TL
  // paints blue. Sample away from both text and antialiased border edges.
  for(const [id,expected]of [['corner-mask-1',[255,255,255,255]],['corner-mask-0',[39,103,200,255]]]){
    const pixel=samplePixel?await samplePixel(w(id),5,5):await page.evaluate(async base64=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return Array.from(ctx.getImageData(5,5,1,1).data);},(await w(id).screenshot()).toString('base64'));
    expect(pixel,id).toEqual(expected);
  }
  await capture?.();return {maskCases:16,independentActions:true,stateComposition:true,rowIsolation:true,pixelChecks:2};
}
