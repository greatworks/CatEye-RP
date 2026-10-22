import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const cssFile='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/css/axure_rp_page.css';
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const css=await fs.readFile(cssFile,'utf8');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:900,height:500},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  const results=[];
  for(const b of [14,18])for(const strokeWidth of [0,1,3])for(const alignRight of [false,true])for(const scaled of [false,true]){
    const pad=strokeWidth>1?strokeWidth/2:0,extra=strokeWidth>1?strokeWidth+1:1,size=b+extra;
    const x=(alignRight?100-b:0)-pad,y=2-pad;
    const input={b,strokeWidth,alignRight,scaled,cssRect:{x,y,width:size,height:size}};
    // Only the retained root envelope/CSS rectangle are modeled. This synthetic
    // oversized rectangle is deliberately not claimed to be a native body.
    await page.setContent(`<!doctype html><html><head><style>
      body{margin:0;background:white}#u{position:absolute;left:100px;top:80px;width:100px;height:30px}
      #u label{position:absolute;left:0;top:0;width:100px;height:30px}
      #u_img{position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px}
    </style></head><body><div id="u"><label for="u_input"><svg data="source.svg" id="u_img" class="img"><rect id="overpaint" x="-5" y="-5" width="${size+10}" height="${size+10}" fill="#2058b0"/></svg></label><input id="u_input" style="display:none"></div></body></html>`);
    const snapshot=()=>page.evaluate(()=>{
      const svg=document.getElementById('u_img'),p=document.getElementById('overpaint'),label=svg.parentElement,c=getComputedStyle(svg),r=svg.getBoundingClientRect(),g=svg.getBBox();
      return {attributes:Object.fromEntries([...svg.attributes].map(a=>[a.name,a.value])),overflow:{svg:c.overflow,x:c.overflowX,y:c.overflowY,label:getComputedStyle(label).overflow,owner:getComputedStyle(label.parentElement).overflow},
        transform:c.transform,origin:c.transformOrigin,viewport:{x:r.x,y:r.y,width:r.width,height:r.height},bodyBBox:{x:g.x,y:g.y,width:g.width,height:g.height},
        hits:{inside:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id??null,left:document.elementFromPoint(r.x-1,r.y+r.height/2)?.id??null,right:document.elementFromPoint(r.right+1,r.y+r.height/2)?.id??null}};
    });
    const beforePageCss=await snapshot();await page.addStyleTag({content:css});const afterPageCss=await snapshot();
    assert.deepEqual(afterPageCss,beforePageCss);
    if(scaled)await page.evaluate(()=>{const s=document.getElementById('u_img');s.style.transformOrigin='top left';s.style.transform='scale(2,3)';});
    const clipped=await snapshot();
    assert.equal(clipped.overflow.svg,'hidden');assert.equal(clipped.overflow.label,'visible');assert.equal(clipped.overflow.owner,'visible');
    assert.equal(clipped.hits.inside,'overpaint');assert.notEqual(clipped.hits.left,'overpaint');assert.notEqual(clipped.hits.right,'overpaint');
    assert.equal(clipped.viewport.width,size*(scaled?2:1));assert.equal(clipped.viewport.height,size*(scaled?3:1));
    assert.equal(clipped.attributes.viewBox,undefined);assert.equal(clipped.attributes.width,undefined);assert.equal(clipped.attributes.height,undefined);
    await page.evaluate(()=>{document.getElementById('u_img').style.overflow='visible';});
    const visibleControl=await snapshot();assert.equal(visibleControl.hits.left,'overpaint');assert.equal(visibleControl.hits.right,'overpaint');
    results.push({input,beforePageCss,afterPageCss,clipped,visibleControl,passed:true});
  }
  // Visual control for the last case: the left SVG is clipped by its viewport;
  // the right otherwise identical SVG explicitly permits the rectangle overflow.
  await page.evaluate(()=>{
    const owner=document.getElementById('u');owner.style.left='20px';owner.style.top='140px';
    const clone=owner.cloneNode(true);clone.id='v';clone.style.left='330px';
    for(const el of clone.querySelectorAll('[id]'))el.id='v_'+el.id;
    document.body.append(clone);document.getElementById('u_img').style.overflow='hidden';
    const second=clone.querySelector('svg');Object.assign(second.style,{position:'absolute',left:'80.5px',top:'0.5px',width:'22px',height:'22px'});
    for(const [x,text] of [[90,'Default: hidden overflow'],[400,'Control: visible overflow']]){const el=document.createElement('div');el.textContent=text;Object.assign(el.style,{position:'absolute',left:x+'px',top:'90px',font:'16px sans-serif'});document.body.append(el);}
  });
  const screenshot='.build/selection-svg-body-css-control.png';await page.screenshot({path:screenshot});
  assert.deepEqual(errors,[]);
  const sources=[cssFile,'research/selection-svg-bounds-probes.json',import.meta.filename];
  const output={method:'Browser CSS and clipping controls over the retained inline-root envelope, with a declared synthetic oversized body; no native body/pixel-parity claim, original DLL execution or product imports.',
    environment:{channel:'msedge',version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),devicePixelRatio:1},
    summary:{cases:results.length,passed:results.length,failed:0,pageErrors:errors.length},sources:await Promise.all(sources.map(async path=>({path,sha256:await hash(path)}))),
    screenshot:{path:screenshot,sha256:await hash(screenshot)},results,errors};
  await fs.writeFile('research/selection-svg-body-css-probes.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(output.summary));
}finally{await browser.close();}
