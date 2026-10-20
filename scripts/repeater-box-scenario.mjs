import { expect } from '@playwright/test';

const widget = (scope, name) => scope.locator(`.widget[aria-label="${name}"]`);
const rowGeometry = locator => locator.evaluateAll(elements => elements.map(element => ['left','top','width','height'].map(key => Number.parseFloat(element.style[key]))));
const outerSize = locator => locator.evaluate(element => { const r = element.getBoundingClientRect(); return [r.width, r.height]; });

// Independent browser oracle: authored fixture constants + DOM CSS setters.
// No runtime helper or live product geometry is used to construct expectations.
async function hostOracle(scope) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  return page.evaluate(() => {
    const root = document.createElement('div'), row = document.createElement('div'), empty = document.createElement('div');
    for (const element of [root, empty]) Object.assign(element.style, { position:'fixed', left:'0', top:'0', visibility:'hidden', pointerEvents:'none', margin:'0', padding:'0', boxSizing:'border-box', borderStyle:'solid', borderWidth:'3px 5px 7px 2px' });
    Object.assign(row.style,{position:'absolute',border:'0',padding:'0',margin:'0'});document.body.append(root,empty);root.append(row);
    const border = getComputedStyle(root), borders = [border.borderTopWidth,border.borderRightWidth,border.borderBottomWidth,border.borderLeftWidth].map(parseFloat);
    const primary = borders[0]+borders[2];row.style.left=(6-borders[3])+'px';row.style.top=(7-borders[0])+'px';
    const read = () => {const css=getComputedStyle(root),r=root.getBoundingClientRect();return {inline:[root.style.width,root.style.height],css:[css.width,css.height],outer:[r.width,r.height],row:[parseFloat(row.style.left),parseFloat(row.style.top),parseFloat(row.style.width),parseFloat(row.style.height)]};};
    let previous=[100,20],cache=[110,36];
    const reset=()=>{root.style.width='110px';root.style.height='36px';row.style.width='100px';row.style.height='20px';previous=[100,20];cache=[110,36];return {...read(),cache:[...cache]};};
    const resize=(width,height)=>{const next=[width,height];for(let axis=0;axis<2;axis++){const delta=next[axis]-previous[axis];if(delta!==0){const prop=axis?'height':'width';row.style[prop]=(parseFloat(getComputedStyle(row)[prop])+delta)+'px';root.style[prop]=Math.max(0,parseFloat(getComputedStyle(root)[prop])+delta+primary)+'px';const cs=getComputedStyle(root);cache=[parseFloat(cs.width),parseFloat(cs.height)];}}previous=next;return {...read(),cache:[...cache]};};
    const initial=reset(),grown=resize(130,35),shrunk=resize(100,20),refreshed=reset(),final=resize(130,35);
    empty.style.width='0px';empty.style.height='0px';const ec=getComputedStyle(empty),er=empty.getBoundingClientRect();
    const result={dpr:devicePixelRatio,borders,initial,grown,shrunk,refreshed,final,empty:{css:[ec.width,ec.height],outer:[er.width,er.height]}};
    root.remove();empty.remove();return result;
  });
}

/** Shared by actual preview, downloaded file:// HTML, and packaged desktop smoke. */
export async function exerciseRepeaterBox(scope) {
  const records = widget(scope, 'Bordered records'), rows = records.locator(':scope > .repeater-row');
  const empty = widget(scope, 'Empty bordered records');
  const expected = await hostOracle(scope);
  // Preserve the original literal DPR1 regression, in addition to host measurement.
  if(expected.dpr===1){
    expect(expected.borders).toEqual([3,5,7,2]);expect(expected.initial.row).toEqual([4,4,100,20]);
    expect(expected.initial.cache).toEqual([110,36]);expect(expected.grown.cache).toEqual([150,61]);
    expect(expected.shrunk.cache).toEqual([130,56]);expect(expected.refreshed.cache).toEqual([110,36]);expect(expected.empty.css).toEqual(['7px','10px']);
  }
  const size = async state => {
    await expect(records).toHaveCSS('width',state.css[0]);await expect(records).toHaveCSS('height',state.css[1]);
    const actual = (await rowGeometry(rows))[0];expect(actual).toHaveLength(4);
    actual.forEach((value,index)=>expect(value).toBeCloseTo(state.row[index],4));
    const outer=await outerSize(records);outer.forEach((value,index)=>expect(value).toBeCloseTo(state.outer[index],4));
  };
  const inspect = async state => {
    await widget(scope, 'Inspect repeater geometry').click();
    await expect(widget(scope, 'Target repeater log')).toHaveText(`Target root ${state.cache[0]}×${state.cache[1]} | Target empty -6×-2`);
  };
  await expect(rows).toHaveCount(1);
  await size(expected.initial);
  await expect(widget(scope, 'This row log')).toHaveText('This row 100×20 | Item.Repeater 110×36');
  await expect(empty.locator(':scope > .repeater-row')).toHaveCount(0);
  await expect(empty).toHaveCSS('width',expected.empty.css[0]); await expect(empty).toHaveCSS('height',expected.empty.css[1]);
  expect(await empty.evaluate(element=>[element.style.width,element.style.height])).toEqual(['0px','0px']);
  const emptyOuter=await outerSize(empty);emptyOuter.forEach((value,index)=>expect(value).toBeCloseTo(expected.empty.outer[index],4));
  await expect(widget(scope,'Empty This log')).toHaveText('This raw -6×-2 | no DOM rows');
  await inspect(expected.initial);
  await widget(scope,'Grow bordered row').click();
  await size(expected.grown);
  await expect(widget(scope,'This row log')).toHaveText(`This row 130×35 | Item.Repeater ${expected.grown.cache[0]}×${expected.grown.cache[1]}`);
  await expect(widget(scope,'Resize event log')).toHaveText('Resize events: 1');
  await inspect(expected.grown);
  await widget(scope,'Grow bordered row').click(); await expect(widget(scope,'Resize event log')).toHaveText('Resize events: 1');
  await widget(scope,'Reset bordered row').click();
  await size(expected.shrunk);
  await expect(widget(scope,'This row log')).toHaveText(`This row 100×20 | Item.Repeater ${expected.shrunk.cache[0]}×${expected.shrunk.cache[1]}`);
  await expect(widget(scope,'Resize event log')).toHaveText('Resize events: 2');
  await inspect(expected.shrunk);
  await widget(scope,'Refresh bordered records').click();
  await size(expected.refreshed);
  await expect(widget(scope,'This row log')).toHaveText('This row 100×20 | Item.Repeater 110×36');
  await expect(widget(scope,'Resize event log')).toHaveText('Resize events: 2');
  await inspect(expected.refreshed);
  await widget(scope,'Live geometry target').click();
  await expect(widget(scope,'This geometry log')).toHaveText('This x=65, y=590, width=160, height=42');
  await widget(scope,'Move and resize geometry target').click();
  await expect(widget(scope,'Target geometry log')).toHaveText('Target x=290, y=590, width=190, height=64');
  await widget(scope,'Live geometry target').click();
  await expect(widget(scope,'This geometry log')).toHaveText('This x=290, y=590, width=190, height=64');
  expect(await outerSize(widget(scope,'Live geometry target'))).toEqual([190,64]);
  // Leave the demonstration showing a grown row and matching live telemetry.
  await widget(scope,'Grow bordered row').click(); await inspect(expected.final);
  await expect(widget(scope,'This row log')).toHaveText(`This row 130×35 | Item.Repeater ${expected.final.cache[0]}×${expected.final.cache[1]}`);
  await expect(widget(scope,'Resize event log')).toHaveText('Resize events: 3');
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
