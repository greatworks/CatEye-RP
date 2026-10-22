import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const inputs=[1.2345649,1.234565,1.2345651,1.234575,1.0000049,1.000005,1.0000051,2.000005,-1.2345649,-1.234565,-1.2345651,-1.000005,.1234565,.0001234565,1.234565e-20,1.234565e20,1e-40,1e40,1e308,0,-0];
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.setContent('<!doctype html><html><body><svg id="s" style="position:absolute;left:0;top:0;width:15px;height:15px"></svg></body></html>');
 const results=[];
 for(const input of inputs){
  const actual=await page.evaluate(value=>{const s=document.getElementById('s');s.style.transform='';s.style.transform='Scale('+value+', '+value+')';const css=getComputedStyle(s).transform;let parsed,error;try{const m=new WebKitCSSMatrix(css);parsed={m11:m.m11,m22:m.m22};}catch(e){error=String(e);}const m=s.getScreenCTM();return{inline:s.style.transform,computed:css,parsed,error,screenCTM:{a:m.a,d:m.d}};},input);
  const raw6=Number(input.toPrecision(6)),fround=Math.fround(input),fround6=Number(fround.toPrecision(6));
  results.push({input,raw6,fround,fround6,actual,raw6Matches:actual.parsed?.m11===raw6,fround6Matches:actual.parsed?.m11===fround6});
 }
 assert.deepEqual(errors,[]);
 const output={method:'Browser CSS numeric controls, no original target or product code. Assign the raw finite double to scale, read exact computed transform through original-source-equivalent WebKitCSSMatrix, and compare raw six-significant-digit and float32-then-six-digit candidates. Extreme values are intentionally outside ordinary owner-size support.',environment:{channel:'msedge',headless:true,version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent)},source:{path:import.meta.filename,sha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},summary:{cases:results.length,raw6Matches:results.filter(r=>r.raw6Matches).length,fround6Matches:results.filter(r=>r.fround6Matches).length,pageErrors:errors.length},results,errors};
 const json=JSON.stringify(output,(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?String(value):value,2)+'\n';
 fs.writeFileSync('research/selection-adaptive-svg-rounding-controls.json',json,{flag:'wx'});console.log(JSON.stringify(output.summary));
}finally{await browser.close();}
