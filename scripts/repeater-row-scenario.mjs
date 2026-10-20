import { expect } from '@playwright/test';

export const ROW_BOX = { width:140.1, height:46.2, gapX:8.4, gapY:6.3, padding:[7.1,4.2,9.3,6.4], borders:[3,5,7,2], wrap:2, growWidth:180.3, growHeight:62.4, trimWidth:120.05, trimHeight:35.1 };
const widget = (scope, name) => scope.locator(`.widget[aria-label="${name}"]`);

// Independent DOM oracle, adapted from the research group-extents model that was
// compared with native functions in repeater-row-quantization-host-{1,1p5}.json.
// No product layout/measurement helper or vendor function is loaded here.
async function oracle(scope, vertical) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  return page.evaluate(({ f, vertical }) => {
    let root, ids, groups, nominal, geometry, moved, rootGeometry, events = 0;
    const rows = new Map(), px = Number.parseFloat;
    const sum = (group, axis) => group.reduce((value, id, index) => value + (index ? axis ? f.gapY : f.gapX : 0) + nominal[id][axis], 0);
    const max = (group, axis) => Math.max(0, ...group.map(id => nominal[id][axis]));
    const read = element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect(), outer = root.getBoundingClientRect();
      return { inline:[element.style.left,element.style.top,element.style.width,element.style.height], css:[css.left,css.top,css.width,css.height], rect:[rect.x-outer.x,rect.y-outer.y,rect.width,rect.height] };
    };
    const snapshot = () => ({ root:read(root), rootGeometry:{...rootGeometry}, events, rows:ids.map(id => ({ id, ...read(rows.get(id)), geometry:{...geometry[id],...moved[id]} })) });
    function init(order) {
      root?.remove(); rows.clear(); ids=order; groups=[]; for(let i=0;i<ids.length;i+=f.wrap)groups.push(ids.slice(i,i+f.wrap));
      root=document.createElement('div');Object.assign(root.style,{position:'fixed',left:'0px',top:'0px',visibility:'hidden',pointerEvents:'none',boxSizing:'border-box',borderStyle:'solid',borderWidth:f.borders.map(v=>`${v}px`).join(' '),padding:'0',margin:'0'});document.body.append(root);
      const css=getComputedStyle(root), origin=[f.padding[3]-px(css.borderLeftWidth),f.padding[0]-px(css.borderTopWidth)];
      const primary=Math.min(ids.length,f.wrap),secondary=Math.ceil(ids.length/f.wrap);
      rootGeometry={width:f.padding[1]+f.padding[3]+(f.width+((vertical?secondary:primary)-1)*(f.width+f.gapX)),height:f.padding[0]+f.padding[2]+(f.height+((vertical?primary:secondary)-1)*(f.height+f.gapY))};
      nominal={};geometry={};moved={};let left=origin[0],top=origin[1],index=0;
      for(const id of ids){const element=document.createElement('div');Object.assign(element.style,{position:'absolute',left:`${left}px`,top:`${top}px`,width:`${f.width}px`,height:`${f.height}px`,padding:'0',margin:'0',border:'0',boxSizing:'border-box'});root.append(element);rows.set(id,element);
        nominal[id]=[f.width,f.height];geometry[id]={width:f.width,height:f.height};moved[id]={x:left,y:top};
        if(++index%f.wrap===0){if(vertical){top=origin[1];left+=f.width+f.gapX;}else{left=origin[0];top+=f.height+f.gapY;}}
        else if(vertical)top+=f.height+f.gapY;else left+=f.width+f.gapX;
      }
      root.style.width=`${Math.max(0,rootGeometry.width)}px`;root.style.height=`${Math.max(0,rootGeometry.height)}px`;return snapshot();
    }
    function resize(id,width,height){
      const deltas=[width-nominal[id][0],height-nominal[id][1]];
      if(!deltas[0]&&!deltas[1])return snapshot();
      const main=vertical?1:0,groupIndex=groups.findIndex(group=>group.includes(id)),group=groups[groupIndex],index=group.indexOf(id);
      for(let axis=0;axis<2;axis++){
        const delta=deltas[axis];if(!delta)continue;const prop=axis?'height':'width',location=axis?'top':'left',element=rows.get(id);
        element.style[prop]=`${Math.max(0,px(getComputedStyle(element)[prop])+delta)}px`;
        const rowCss=getComputedStyle(element);geometry[id]={width:px(rowCss.width),height:px(rowCss.height)};
        let rootDelta,shift,affected;
        if(axis===main){const before=sum(group,axis),after=before+delta,other=Math.max(0,...groups.filter((_,i)=>i!==groupIndex).map(g=>sum(g,axis)));rootDelta=Math.max(after,other)-Math.max(before,other);shift=delta;affected=group.slice(index+1);nominal[id][axis]+=delta;}
        else{const before=max(group,axis);nominal[id][axis]+=delta;shift=max(group,axis)-before;rootDelta=shift;affected=groups.slice(groupIndex+1).flat();}
        if(rootDelta!==0){const css=getComputedStyle(root),border=vertical?px(css.borderTopWidth)+px(css.borderBottomWidth):px(css.borderLeftWidth)+px(css.borderRightWidth);
          root.style[prop]=`${Math.max(0,px(css[prop])+rootDelta+border)}px`;const updated=getComputedStyle(root);rootGeometry={width:px(updated.width),height:px(updated.height)};
        }
        if(shift!==0)for(const sibling of affected){const element=rows.get(sibling);element.style[location]=`${px(getComputedStyle(element)[location])+shift}px`;const css=getComputedStyle(element);moved[sibling]={x:px(css.left),y:px(css.top)};}
      }
      events++;return snapshot();
    }
    try {
      const initial=init(['A','B','C','D','E']);
      const trim=resize('A',vertical?f.trimWidth:f.width,vertical?f.height:f.trimHeight);
      const grow=resize('A',f.growWidth,f.growHeight),repeat=resize('A',f.growWidth,f.growHeight);
      const third=resize('C',f.growWidth,f.growHeight),fifth=resize('E',f.growWidth,f.growHeight);
      const restore=resize('A',f.width,f.height),refresh=init(['E','D','C','B','A']);
      const borders=getComputedStyle(root);
      return {dpr:devicePixelRatio,borders:[borders.borderTopWidth,borders.borderRightWidth,borders.borderBottomWidth,borders.borderLeftWidth],initial,trim,grow,repeat,third,fifth,restore,refresh};
    } finally { root?.remove(); }
  }, { f:ROW_BOX, vertical });
}

// DOMRect uses viewport coordinates. At host scale 1.5, translating identical
// boxes across x=1024 changes float rounding before subtracting the parent.
// Measure the independent oracle's CSS at the current viewport origin, including
// after click-induced scrolling. No product row geometry is used as an oracle.
async function placedRects(scope, state, origin) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  return page.evaluate(({state,origin,borders})=>{
    const root=document.createElement('div');
    Object.assign(root.style,{position:'fixed',left:`${origin[0]}px`,top:`${origin[1]}px`,width:state.root.inline[2],height:state.root.inline[3],visibility:'hidden',pointerEvents:'none',boxSizing:'border-box',borderStyle:'solid',borderWidth:borders.map(v=>`${v}px`).join(' '),padding:'0',margin:'0'});
    document.body.append(root);
    try {
      for(const row of state.rows){const child=document.createElement('div');Object.assign(child.style,{position:'absolute',left:row.inline[0],top:row.inline[1],width:row.inline[2],height:row.inline[3],boxSizing:'border-box',padding:'0',margin:'0',border:'0'});root.append(child);}
      const outer=root.getBoundingClientRect(),read=element=>{const rect=element.getBoundingClientRect();return [rect.x-outer.x,rect.y-outer.y,rect.width,rect.height];};
      return {root:read(root),rows:[...root.children].map(read)};
    } finally {root.remove();}
  },{state,origin,borders:ROW_BOX.borders});
}

/** Reusable in preview, downloaded file HTML, and hidden packaged Electron. */
export async function exerciseRepeaterRows(scope) {
  for(const direction of ['vertical','horizontal']){
    const expected=await oracle(scope,direction==='vertical'),records=widget(scope,`${direction} fractional records`),rows=records.locator(':scope > .repeater-row');
    const resizeLog=widget(scope,`${direction} resize log`),loadLog=widget(scope,`${direction} load log`),rootLog=widget(scope,`${direction} root log`);
    await expect(rows).toHaveCount(5);
    // Initial native geometry remains the requested 140.1 x 46.2 even though CSS
    // has already rounded the row. The distinct inline/computed values matter.
    expect(expected.initial.rows[0].css[2]).not.toBe(expected.initial.rows[0].inline[2]);
    const inspect=async state=>{
      await widget(scope,`Inspect ${direction} root`).click();await expect(rootLog).toHaveText(`Root ${state.rootGeometry.width}|${state.rootGeometry.height}`);
    };
    const verify=async(state,changed)=>{
      const actual=await records.evaluate(element=>{
        const root=element.getBoundingClientRect(),read=node=>{const css=getComputedStyle(node),rect=node.getBoundingClientRect();return {inline:[node.style.left,node.style.top,node.style.width,node.style.height],css:[css.left,css.top,css.width,css.height],rect:[rect.x-root.x,rect.y-root.y,rect.width,rect.height]};};
        return {origin:[root.x,root.y],root:read(element),rows:[...element.querySelectorAll(':scope > .repeater-row')].map(read)};
      });
      const rects=await placedRects(scope,state,actual.origin);
      expect(actual.root.inline.slice(2)).toEqual(state.root.inline.slice(2));expect(actual.root.css.slice(2)).toEqual(state.root.css.slice(2));
      for(const [index,row] of actual.rows.entries()){
        expect(row.inline).toEqual(state.rows[index].inline);expect(row.css).toEqual(state.rows[index].css);
        row.rect.forEach((value,axis)=>expect(value,`${direction} row ${index} axis ${axis}, root ${actual.origin}`).toBeCloseTo(rects.rows[index][axis],4));
      }
      actual.root.rect.slice(2).forEach((value,axis)=>expect(value).toBeCloseTo(rects.root[axis+2],4));
      if(changed){const row=state.rows.find(row=>row.id===changed),g=row.geometry;
        await expect(resizeLog).toHaveText(`Resize ${state.events}: ${changed}|${g.x}|${g.y}|${g.width}|${g.height}|${state.rootGeometry.width}|${state.rootGeometry.height}`);
      }
      await inspect(state);
    };
    await expect(loadLog).toHaveText('Loaded A:140.1,46.2|B:140.1,46.2|C:140.1,46.2|D:140.1,46.2|E:140.1,46.2|');
    await expect(resizeLog).toHaveText('No resize yet');await verify(expected.initial);
    const click=(index,label)=>rows.nth(index).locator(`.widget[aria-label="${label}"]`).click();
    await click(0,'Trim cross axis');await verify(expected.trim,'A');
    expect(expected.trim.root).toEqual(expected.initial.root);expect(expected.trim.events).toBe(1);
    await click(0,'Grow fractional row');await verify(expected.grow,'A');
    await click(0,'Grow fractional row');await verify(expected.repeat,'A');expect(expected.repeat.events).toBe(expected.grow.events);
    await click(2,'Grow fractional row');await verify(expected.third,'C');
    await click(4,'Grow fractional row');await verify(expected.fifth,'E');
    await click(0,'Restore fractional row');await verify(expected.restore,'A');
    await widget(scope,`Refresh ${direction} rows`).click();await verify(expected.refresh);
    await expect(loadLog).toHaveText('Loaded E:140.1,46.2|D:140.1,46.2|C:140.1,46.2|B:140.1,46.2|A:140.1,46.2|');
    expect(expected.refresh.events).toBe(5);
  }
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
