import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const foundation='research/selection-state-dispatch-probe-extended.mjs',sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const code=fs.readFileSync(foundation,'utf8').split('const browser=await chromium.launch')[0].replace("import {chromium} from '@playwright/test';",'')+'\nexport {setup,instrumented,paths,text};';
const base=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:base.text.css});await page.addScriptTag({content:base.text.jquery});await page.addScriptTag({content:base.setup});
 for(const type of ['checkbox','radioButton'])for(const mode of ['same-class-gate','clear-previous','adaptive-repeated','adaptive-without-svg']){
  await page.evaluate(type=>makeFixture({type}),type);await page.addScriptTag({content:base.instrumented});
  const actual=await page.evaluate(mode=>{
   $ax.placeholderManager={refreshPlaceholder:()=>{}};const rows=[];
   const apply=(label,fn)=>{const before=trace.length;fn();rows.push({label,trace:structuredClone(trace.slice(before)),visible:document.getElementById('mark')?readFixture():null});};
   if(mode==='same-class-gate'){
    apply('A-width3',()=>$ax.style.applyWidgetStyle('u','A',{borderWidth:3},null,false));
    apply('A-width0-same',()=>$ax.style.applyWidgetStyle('u','A',{borderWidth:0},null,false));
    apply('B-width0',()=>$ax.style.applyWidgetStyle('u','B',{borderWidth:0},null,false));
    apply('B-width0-clear',()=>$ax.style.applyWidgetStyle('u','B',{borderWidth:0},null,true));
   }else if(mode==='clear-previous'){
    apply('A-width3',()=>$ax.style.applyWidgetStyle('u','A',{borderWidth:3},null,false));
    apply('B-color',()=>$ax.style.applyWidgetStyle('u','B',{borderFill:{fillType:'solid',color:0xff654321,opacity:.5}},null,false));
    apply('C-clear',()=>$ax.style.applyWidgetStyle('u','C',{fill:{fillType:'solid',color:0xffabcdef,opacity:.5}},null,true));
   }else if(mode==='adaptive-repeated'){
    $ax.adaptive.currentViewId='v1';for(const width of [3,0,0]){objects.u.adaptiveStyles.v1={borderWidth:width};apply('width'+width,()=>$ax.style.setAdaptiveStyle('u',objects.u.adaptiveStyles.v1,'normal'));}
   }else{document.getElementById('u_img').remove();apply('missing-svg',()=>$ax.style.setAdaptiveStyle('u',{borderWidth:3},'normal'));}
   return rows;
  },mode);
  results.push({type,mode,actual});const counts=actual.map(r=>r.trace.filter(t=>t.kind==='svg').length);const widths=actual.flatMap(r=>r.trace.filter(t=>t.kind==='svg').map(t=>t.style.borderWidth));
  if(mode==='same-class-gate'){assert.deepEqual(counts,[1,0,1,1]);assert.deepEqual(widths,[3,0,0]);assert.equal(actual.at(-1).visible.mark.widthAttribute,'3');}
  if(mode==='clear-previous'){assert.deepEqual(counts,[1,1,1]);assert.deepEqual(widths,[3,3,1]);}
  if(mode==='adaptive-repeated'){assert.deepEqual(counts,[1,1,1]);assert.deepEqual(widths,[3,0,0]);assert.equal(actual.at(-1).visible.mark.widthAttribute,'3');}
  if(mode==='adaptive-without-svg')assert.deepEqual(counts,[0]);
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('research/selection-state-dispatch-style-action-probes.json',JSON.stringify({method:'Complete original style.js; direct applyWidgetStyle and setAdaptiveStyle entry calls. Full compute style, last class gate, clear-previous and original SVG consumer execute. Placeholder refresh is no-op; flat adaptive data is supplied.',sources:[...Object.values(base.paths),foundation,import.meta.filename].map(path=>({path,sha256:sha(path)})),summary:{sequences:results.length,passed:results.length,failed:0},errors,results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:results.length}));
}finally{await browser.close();}
