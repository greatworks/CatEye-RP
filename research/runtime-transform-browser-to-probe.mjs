import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const harnessPath = 'research/runtime-transform-browser-probe.mjs';
const harness = fs.readFileSync(harnessPath, 'utf8');
// Reuse the unchanged controlled bootstrap and exact retained source loading.
// This evaluates research harness construction only, not vendor DLL methods.
const setup = harness.slice(harness.indexOf('const sha ='), harness.indexOf('const output ='));
const { jq, bootstrap, sources, slices } = new Function('fs', 'path', 'crypto', 'assert', setup + '\nreturn {jq,bootstrap,sources,slices};')(fs, path, crypto, assert);
const output = process.argv[2] || 'research/runtime-transform-browser-to-probes.json';
assert.ok(path.basename(output).startsWith('runtime-transform-browser-'));
assert.equal(fs.existsSync(output), false);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const requests = [], errors = [];
await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e.stack || e)));
let results = [], fatal;
try {
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({ content: jq }); await page.addScriptTag({ content: bootstrap });
  results = await page.evaluate(async () => {
    const out = [], near = (a,b) => Math.abs(a-b)<1e-8;
    async function test(name, actions, expected, variables, hook) {
      H.reset(); if(variables) Object.assign(H.vars(), variables);
      if(hook) H.hooks().onRotate=()=>{H.vars().x=400;};
      let observed, error;
      try {
        H.dispatch(actions.map(([kind, opts]) => H.action(kind, opts)));
        observed = await H.settle(900);
        const basic = observed.timers===0 && Object.values(observed.queues).every(q=>Object.values(q).every(n=>n===0));
        const { final }=observed;
        const passed=basic && near(final.moved.left,expected.x) && near(final.moved.top,expected.y) && near(final.resized.width,expected.width) && near(final.angle,expected.angle)
          &&(!hook||observed.trace.filter(t=>t.kind==='evaluate'&&t.detail.expr?.value==='$x').map(t=>t.detail.result).join(',')==='140');
        out.push({ name, configuration:{actions,expected,variables,hook}, passed, observed });
      } catch(e) { error=String(e.stack||e); out.push({name,configuration:{actions,expected},passed:false,observed,error}); }
    }
    const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(b=>[v,...b])):[[]];
    for(const order of permutations(['move','resize','rotate']))await test('long-move-to-'+order.join('-'),order.map(kind=>[kind,kind==='move'?{mode:'location',x:140,y:120,duration:100}:{duration:kind==='resize'?70:40}]),{x:140,y:120,width:299.65306122448976,angle:90});
    await test('long-move-to-negative',[['move',{mode:'location',x:-40,y:-20,duration:100}],['resize',{duration:70}],['rotate',{duration:40}]],{x:-40,y:-20,width:299.65306122448976,angle:90});
    await test('equal-move-to',[['move',{mode:'location',x:140,y:120}],['resize',{}],['rotate',{}]],{x:140,y:120,width:300,angle:90});
    await test('equal-move-to-empty-axis',[['move',{mode:'location',x:'',y:120}],['resize',{}],['rotate',{}]],{x:100,y:120,width:300,angle:90});
    await test('long-move-to-cached-expression',[['move',{mode:'location',x:'$x',y:120,duration:100}],['resize',{duration:70}],['rotate',{duration:40}]],{x:140,y:120,width:299.65306122448976,angle:90},{x:140},true);
    return out;
  });
} catch(e) {fatal=String(e.stack||e);}
const version=browser.version();await browser.close();
const report={schema:1,capturedAt:new Date().toISOString(),environment:{browser:version,node:process.version},method:'Actual Edge Move-To supplement; exact same retained-source bootstrap, real jQuery timers and declared sinks as primary browser evidence.',sources,slices,harness:{path:harnessPath,sha256:hash(harness)},script:{path:'research/runtime-transform-browser-to-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},requests,errors,fatal,results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,sha256:hash(fs.readFileSync(output)),summary:report.summary,fatal,errors,failures:results.filter(x=>!x.passed).map(x=>({name:x.name,error:x.error,final:x.observed?.final}))},null,2));
if(fatal||errors.length||requests.length||report.summary.failed)process.exitCode=1;
