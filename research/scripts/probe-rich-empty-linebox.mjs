import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

// Independent HTML/CSS measurement, not execution of the native Axure page generator.
const fontFile='src/assets/fonts/roboto/Roboto-Regular.ttf';
const font=fs.readFileSync(fontFile);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage();
  const cases=[
    {name:'current-empty-run-sibling-br',html:'<span class="run"></span><br>'},
    {name:'empty-run-child-br',html:'<span class="run"><br></span>'},
    {name:'only-br',html:'<br>'},
    {name:'paragraph-first-run-font',html:'<span class="run"></span><br>',paragraph:'font-family:ProbeRoboto;font-size:26px'},
    {name:'paragraph-zero-strut',html:'<span class="run"><br></span>',paragraph:'font-size:0'},
    {name:'nonempty-run',html:'<span class="run">B</span>'},
    {name:'empty-run-no-br',html:'<span class="run"></span>'},
    {name:'native-plain-three-lines',html:'<span class="run"><span>A</span><br><br><span>B</span></span>'},
    {name:'same-font-empty-run-br',html:'<span style="font-family:Arial;font-size:14px"></span><br>',line:28},
  ];
  await page.setContent(`<!doctype html><style>@font-face{font-family:ProbeRoboto;src:url(data:font/ttf;base64,${font.toString('base64')})}body{font:14px Arial;margin:0}.p{display:block;margin:0;white-space:pre-wrap;width:500px}.run{font-family:ProbeRoboto;font-size:26px}</style>${cases.map((c,i)=>`<div class="p" id="p${i}" style="line-height:${c.line??36}px;${c.paragraph??''}">${c.html}</div>`).join('')}`);
  await page.evaluate(async()=>{await document.fonts.load('26px ProbeRoboto');await document.fonts.ready;});
  const results=await page.evaluate(cases=>cases.map((c,i)=>{const p=document.getElementById(`p${i}`),s=getComputedStyle(p);return {...c,height:p.getBoundingClientRect().height,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,runs:[...p.querySelectorAll('span,br')].map(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return{tag:e.tagName,text:e.textContent,height:b.height,top:b.top-p.getBoundingClientRect().top,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight}})}}),cases);
  const report={capturedAt:new Date().toISOString(),method:'Independent Edge headless setContent with bundled licensed font; no original GUI or page generator',browserVersion:browser.version(),font:{file:fontFile,sha256:createHash('sha256').update(font).digest('hex')},results};
  fs.writeFileSync('research/rich-empty-linebox-evidence.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(results.map(({name,height,lineHeight})=>({name,height,lineHeight})),null,2));
  if(process.argv[2]) {
    const file=process.argv[2];await page.goto(pathToFileURL(file).href);
    await page.locator('[data-widget-id="rich-button-4"]').click();
    await page.evaluate(async()=>{await document.fonts.ready;});
    const actual=await page.evaluate(()=>{
      const p=document.querySelector('[data-widget-id="rich-target"] [data-rich-paragraph="1"]');
      function describe(e){const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,html:e.outerHTML,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,fontStyle:s.fontStyle,lineHeight:s.lineHeight,display:s.display,verticalAlign:s.verticalAlign,height:r.height,width:r.width,top:r.top}}
      const before={paragraph:describe(p),children:[...p.children].map(describe),ancestors:[]};for(let e=p.parentElement;e&&before.ancestors.length<4;e=e.parentElement)before.ancestors.push(describe(e));
      const original=p.innerHTML,style=p.getAttribute('style'),variants=[];
      function probe(name,html,extra=''){p.innerHTML=html;p.setAttribute('style',style+';'+extra);variants.push({name,paragraph:describe(p),children:[...p.children].map(describe)});}
      probe('original',original);
      const run=p.querySelector('span');probe('br-inside-first-run',`<span style="${run.getAttribute('style')}"><br></span>`);
      probe('only-br','<br>');
      probe('paragraph-first-run-font',original,'font-family:Roboto;font-size:26px');
      probe('paragraph-zero-strut',original,'font-size:0');
      probe('text-in-first-run',original.replace('</span>','B</span>'));
      p.innerHTML=original;p.setAttribute('style',style);
      return{before,variants};
    });
    const actualReport={...report,results:undefined,file:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')},actual};
    fs.writeFileSync('research/rich-empty-linebox-export-evidence.json',JSON.stringify(actualReport,null,2)+'\n');
    console.log(JSON.stringify(actual.variants.map(v=>({name:v.name,height:v.paragraph.height,lineHeight:v.paragraph.lineHeight,children:v.children.map(c=>({font:c.fontFamily,size:c.fontSize,height:c.height}))})),null,2));
  }
} finally {await browser.close();}
