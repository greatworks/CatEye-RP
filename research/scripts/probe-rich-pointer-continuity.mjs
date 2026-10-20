import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
const file=process.argv[2];if(!file)throw Error('Usage: node probe-rich-pointer-continuity.mjs <actual-export.html>');
const browser=await chromium.launch({channel:'msedge',headless:true});
const cases=[];
try {
 for(const retainUnchangedMarkup of [false,true]) {
  const context=await browser.newContext();const page=await context.newPage();
  await page.addInitScript(retain=>{
   const trace=[];globalThis.__pointerTrace=trace;
   const describe=e=>e?{tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,80),widget:e.closest?.('[data-widget-id]')?.dataset.widgetId,connected:e.isConnected}:null;
   let down;
   for(const type of ['pointerdown','mousedown','blur','focus','pointerup','mouseup','click'])document.addEventListener(type,event=>{
    if(type==='mousedown')down=event.target;
    trace.push({type,target:describe(event.target),down:describe(down),active:describe(document.activeElement)});
    queueMicrotask(()=>trace.push({type:`after:${type}`,target:describe(event.target),down:describe(down),active:describe(document.activeElement)}));
   },true);
   const original=Element.prototype.replaceChildren;
   Element.prototype.replaceChildren=function(...children){
    const rich=this.classList.contains('widget-text')&&children[0]?.classList?.contains('rich-text-content');
    const same=rich&&children.length===1&&this.innerHTML===children[0].outerHTML;
    if(retain&&same){trace.push({type:'skip-identical-rich-replacement',target:describe(this),down:describe(down)});return;}
    if(rich)trace.push({type:'replace-rich',target:describe(this),same,containsDown:!!down&&this.contains(down),down:describe(down)});
    return original.apply(this,children);
   };
  },retainUnchangedMarkup);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(pathToFileURL(file).href);await page.evaluate(()=>document.fonts.ready);
  const submit=page.locator('.widget').filter({hasText:/^Sign Up$/}),email=page.locator('input[aria-label="Email Field"]'),error=page.locator('.widget[aria-label="Error Message"]');
  await submit.click();const firstError=await error.count();await email.click();const cleared=await error.count();await email.fill('person@example.test');
  await page.evaluate(()=>{globalThis.__pointerTrace.length=0;});await submit.click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  cases.push({retainUnchangedMarkup,firstError,cleared,secondError:await error.count(),errors,trace:await page.evaluate(()=>globalThis.__pointerTrace)});await context.close();
 }
}finally{await browser.close();}
const report={capturedAt:new Date().toISOString(),method:'Exact failed exported artifact in isolated headless Edge; A/B retains only byte-identical rich subtree in memory, no file/product mutation',source:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')},cases};
fs.writeFileSync('research/rich-pointer-continuity-evidence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(cases.map(({trace,...item})=>({...item,relevant:trace.filter(t=>(['mousedown','blur','mouseup','click'].includes(t.type))||t.type==='replace-rich'&&t.containsDown).map(t=>({type:t.type,target:t.target,down:t.down,same:t.same}))})),null,2));
