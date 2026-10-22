import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const foundation='research/selection-adaptive-svg-probe-final.mjs',sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const code=fs.readFileSync(foundation,'utf8').split('const browser=await chromium.launch')[0].replace("import {chromium} from '@playwright/test';",'')+'\nexport {base,preparation,mathSlice,adaptive,paths};';
const source=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const inputs=[];
for(const type of ['checkbox','radioButton']){
 inputs.push({name:'decimal-view-repeat',type,styles:{a:{size:{width:133.3,height:31.7}},b:{size:{width:133.3,height:31.7}},c:{size:{width:133.3,height:31.7}},d:{size:{width:133.3,height:31.7}}},steps:[{call:'initialize'},...['a','b','c','d'].map(view=>({call:'switch',view}))]});
 inputs.push({name:'fraction-view-repeat',type,baseSize:{width:3,height:7},styles:{a:{size:{width:4,height:8}},b:{size:{width:4,height:8}},c:{size:{width:4,height:8}}},steps:[{call:'initialize'},...['a','b','c'].map(view=>({call:'switch',view}))]});
 inputs.push({name:'identity-without-and-after-transform',type,styles:{a:{size:{width:100,height:24}},b:{size:{width:50,height:8}},c:{size:{width:100,height:24}}},steps:[{call:'initialize'},{call:'switch',view:'a'},{call:'inline-css',values:{u_img:{transform:'scale(2, 3)'}}},{call:'switch',view:'b'},{call:'switch',view:'c'}]});
 inputs.push({name:'tiny-finite-precision',type,styles:{a:{size:{width:.000123456789,height:.000246913578}},b:{size:{width:133.3,height:31.7}},c:{size:{width:133.3,height:31.7}}},steps:[{call:'initialize'},...['a','b','c'].map(view=>({call:'switch',view}))]});
}
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 for(const input of inputs){
  const page=await browser.newPage({viewport:{width:900,height:700}});page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:source.base.text.css});await page.addScriptTag({content:source.base.text.jquery});await page.addScriptTag({content:source.base.setup});await page.addScriptTag({content:source.preparation});await page.evaluate(input=>prepareAdaptive(input),input);await page.addScriptTag({content:source.base.instrumented});await page.addScriptTag({content:source.mathSlice});await page.addScriptTag({content:source.adaptive});
  await page.evaluate(()=>{const original=snapshot;window.snapshot=()=>{const s=original(),m=new WebKitCSSMatrix(getComputedStyle(document.getElementById('u_img')).transform);s.sourceComputedMatrix={m11:m.m11,m22:m.m22,m41:m.m41,m42:m.m42};return s;};installTrace();});
  const actual=[];for(const step of input.steps)actual.push(await page.evaluate(step=>performAdaptiveStep(step),step));results.push({input,actual});await page.close();
 }
 assert.deepEqual(errors,[]);for(const r of results)for(const row of r.actual)assert.equal(row.error,undefined);
 const output={method:'Complete original adaptive/style chain retained through final probe harness. Independent original WebKitCSSMatrix call records the precise computed-style readback used by the source before its next multiplication.',environment:{channel:'msedge',version:browser.version(),headless:true},sources:[foundation,import.meta.filename,...Object.values(source.paths)].map(path=>({path,sha256:sha(path)})),summary:{sequences:results.length,steps:results.reduce((n,r)=>n+r.actual.length,0),pageErrors:errors.length,exceptions:0},results,errors};
 fs.writeFileSync('research/selection-adaptive-svg-numerics-probes.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(output.summary));
}finally{await browser.close();}
