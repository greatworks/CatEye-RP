import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const css='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/css/axure_rp_page.css';
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:900,height:700}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.setContent('<!doctype html><html><head><style>body{margin:0}#u{position:absolute;left:80px;top:60px}#u_img{position:absolute;left:3px;top:5px;width:14px;height:14px}</style></head><body><div id="u"><label><svg id="u_img" viewBox="0 0 14 14" width="14" height="14"><path d="M0 0H14V14H0Z"/></svg></label></div></body></html>');
 const snapshot=()=>page.evaluate(()=>{const el=document.getElementById('u_img'),c=getComputedStyle(el),r=el.getBoundingClientRect();return{inline:el.getAttribute('style'),transform:c.transform,origin:c.transformOrigin,bbox:{x:r.x,y:r.y,width:r.width,height:r.height}};});
 const beforePageCss=await snapshot();await page.addStyleTag({content:fs.readFileSync(css,'utf8')});const afterPageCss=await snapshot();
 const assignments=[];for(const value of ['Scale(2, 3)','Scale(Infinity, 3)','Scale(NaN, 3)','Scale(2, undefined)','Scale(0, 3)','Scale(2, 0)']){const before=await snapshot();await page.evaluate(value=>{document.getElementById('u_img').style.transform=value;},value);assignments.push({value,before,after:await snapshot()});}
 const result={method:'Browser CSS controls only; these distinguish UA origin and CSS invalid-assignment behavior from original helper statements. No product imports.',environment:{channel:'msedge',headless:true,version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),devicePixelRatio:await page.evaluate(()=>devicePixelRatio)},sources:[css,import.meta.filename].map(path=>({path,bytes:fs.statSync(path).size,sha256:hash(path)})),beforePageCss,afterPageCss,assignments,errors};
 assert.deepEqual(beforePageCss,afterPageCss);assert.equal(beforePageCss.origin,'7px 7px');
 for(const row of assignments.slice(1,4))assert.deepEqual(row.before,row.after);
 assert.equal(assignments[4].after.bbox.width,0);assert.equal(assignments[5].after.bbox.height,0);assert.deepEqual(errors,[]);
 fs.writeFileSync('research/selection-adaptive-svg-css-controls.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:9,browser:result.environment.version}));
}finally{await browser.close();}
