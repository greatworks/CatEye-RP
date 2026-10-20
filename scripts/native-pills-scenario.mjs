import {expect} from '@playwright/test';

export async function checkNativePillsPlayer(scope,page,{capture,samplePixel}={}){
  const w=id=>scope.locator(`[data-widget-id="${id}"]`),fill=id=>w(id).locator('[data-shadow-fill]');
  const curves=async id=>((await fill(id).getAttribute('d'))?.match(/C /g)??[]).length;
  for(let index=0;index<18;index++)expect(await curves(`pills-gallery-${index}`)).toBe(4);
  const target=fill('pills-target');await expect(target).toHaveAttribute('d',/ 3 0/);
  await w('pills-resize').click();await expect(w('pills-target')).toHaveCSS('width','240px');await expect(w('pills-target')).toHaveCSS('height','60px');await expect(target).toHaveAttribute('d',/ 5 0/);
  await w('pills-radius').click();await expect(target).toHaveAttribute('d',/ 18 0/);expect(await curves('pills-target')).toBe(4);
  await w('pills-mask').click();await expect(target).toHaveAttribute('d',/ 18 0/);expect(await curves('pills-target')).toBe(1);
  for(const [x,y,expected]of [[2,2,[255,255,255,255]],[235,5,[39,103,200,255]]]){
    const pixel=samplePixel?await samplePixel(w('pills-target'),x,y):await page.evaluate(async({base64,x,y})=>{
      const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return Array.from(ctx.getImageData(x,y,1,1).data);
    },{base64:(await w('pills-target').screenshot()).toString('base64'),x,y});
    expect(pixel,`capsule pixel ${x},${y}`).toEqual(expected);
  }
  await w('pills-target').hover();await expect(target).toHaveAttribute('d',/ 24 0/);expect(await curves('pills-target')).toBe(1);
  await w('pills-select').click();await expect(target).toHaveAttribute('d',/ 18 0/);expect(await curves('pills-target')).toBe(2);
  await w('pills-target').hover();await expect(target).toHaveAttribute('d',/ 24 0/);expect(await curves('pills-target')).toBe(2);
  await w('pills-title').hover();await expect(target).toHaveAttribute('d',/ 18 0/);
  await capture?.();return {originalCapsules:18,resize:true,independentActions:true,stateComposition:true,pixelChecks:2};
}
