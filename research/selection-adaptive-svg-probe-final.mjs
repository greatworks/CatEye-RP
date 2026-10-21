import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const prefix='research/selection-adaptive-svg-',foundation='research/selection-state-dispatch-probe-extended.mjs';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const foundationCode=fs.readFileSync(foundation,'utf8').split('const browser=await chromium.launch')[0].replace("import {chromium} from '@playwright/test';",'')+'\nexport {setup,instrumented,paths,text};';
const base=await import('data:text/javascript;base64,'+Buffer.from(foundationCode).toString('base64'));
const root=base.paths.style.slice(0,-'style.js'.length),paths={...base.paths,adaptive:root+'adaptive.js',math:root+'math.js'};
const adaptive=fs.readFileSync(paths.adaptive,'utf8'),math=fs.readFileSync(paths.math,'utf8');
const lines=(value,start,end)=>value.split(/\r?\n/).slice(start-1,end).join('\n');
const mathSlice=lines(math,151,153)+'\n'+lines(math,169,201);
const preparation=`
window.prepareAdaptive=input=>{
 makeFixture({type:input.type,classSelected:true,checked:true,states:{selected:{borderWidth:3,borderFill:{fillType:'solid',color:0xffaa2211,opacity:1}},disabled:{borderWidth:0}}});
 const o=objects.u,svg=document.getElementById('u_img'),owner=document.getElementById('u'),label=owner.querySelector('label');
 label.id='u_label';svg.setAttribute('class','img');owner.style.cssText='';label.style.cssText='position:absolute';
 if(!input.legacyViewport){svg.removeAttribute('viewBox');svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('data','declared-fixture.svg');}
 if(input.directChild)owner.insertBefore(svg,label);
 o.style.size=structuredClone(input.baseSize??{width:100,height:24});o.style.alignRight=!!input.alignRight;
 o.buttonSize=input.buttonSize??14;o.style.buttonSize=o.buttonSize;
 if(input.stateSize)o.style.stateStyles.selected.size=structuredClone(input.stateSize);
 if(input.unselected){owner.classList.remove('selected');document.getElementById('u_input').checked=false;}
 if(input.type==='radioButton')document.getElementById('mark').setAttribute('d','M 7 3.5 C 8.96 3.5 10.5 5.04 10.5 7 C 10.5 8.96 8.96 10.5 7 10.5 C 5.04 10.5 3.5 8.96 3.5 7 C 3.5 5.04 5.04 3.5 7 3.5 Z');
 o.adaptiveStyles=structuredClone(input.styles);o.images=undefined;
 const views=Object.keys(input.styles).map((id,i)=>({id,name:id,size:{width:300+i*10,height:0},...(input.parents?.[id]?{baseViewId:input.parents[id]}:{})}));
 const q0=$ax;
 const q=selector=>{const r=q0(selector);r.jQuery=()=>selector==='*'?$('#u'):$(selector);r.each=fn=>{for(const [id,obj]of Object.entries(objects))if(selector==='*'||selector==='#'+id)fn(obj,id);return r;};return r;};
 Object.assign(q,q0);window.$ax=window.$axure=q;$axure.internal=fn=>fn($ax);
 $axure.utils={makeBindable:target=>{target.triggerEvent=(name,args)=>trace.push({kind:'view-event',name,args});},isInPlayer:()=>false};
 $axure.resize=fn=>{window.resizeListener=fn;};
 $ax.messageCenter={addMessageListener:fn=>{window.messageListener=fn;}};
 $ax.document.configuration={useViews:true};$ax.pageData={adaptiveViews:views,defaultAdaptiveView:{id:'',size:{width:0,height:0}},page:{style:{},adaptiveStyles:{}},masters:{},sketchKeys:{}};
 const sink=name=>(...args)=>trace.push({kind:'facade',name,args:args.map(a=>typeof a==='object'&&a?.jQuery?'query':a?.id??a)});
 $ax.public.fn.IsLayer=()=>false;
 $ax.dynamicPanelManager={resetFixedPanel:sink('resetFixedPanel'),resetAdaptivePercentPanel:sink('resetAdaptivePercentPanel'),updateParentsOfNonDefaultFitPanels:sink('updateParentsOfNonDefaultFitPanels'),updatePercentPanelCache:sink('updatePercentPanelCache'),updateAllLayerSizeCaches:sink('updateAllLayerSizeCaches')};
 Object.assign($ax.visibility,{resetLimboAndHiddenToDefaults:sink('resetLimboAndHiddenToDefaults'),clearMovedAndResized:sink('clearMovedAndResized'),clearLimboAndHidden:sink('clearLimboAndHidden'),addLimboAndHiddenIds:sink('addLimboAndHiddenIds')});
 $ax.repeater.refreshAllRepeaters=sink('refreshAllRepeaters');$ax.getParentRepeaterFromElementIdExcludeSelf=()=>undefined;$ax.getParentRepeaterFromScriptId=()=>undefined;
 $ax.GetButtonShapeId=id=>id;$ax.placeholderManager={refreshPlaceholder:sink('refreshPlaceholder')};$ax.expr={updateAutoFitted:sink('updateAutoFitted')};
 $ax.annotation={updateAllFootnotes:sink('updateAllFootnotes'),jQueryAnn:()=>$([])};$ax.constants={CONNECTOR_TYPE:'connector'};
 $ax.postAdaptiveViewChanged=sink('postAdaptiveViewChanged');$ax.viewChangePageAndMasters=sink('viewChangePageAndMasters');$ax.postResize=sink('postResize');
 $ax.deepCopy=value=>structuredClone(value);
 const assetViewport=input.legacyViewport?14:15;
 const rules=['body{margin:0}#u{position:absolute;left:80px;top:60px;width:'+o.style.size.width+'px;height:'+o.style.size.height+'px;display:flex}#u_label{left:0px;top:0px;width:100%;height:100%}#u_img{position:absolute;left:'+(input.alignRight?83:3)+'px;top:5px;width:'+assetViewport+'px;height:'+assetViewport+'px;overflow:visible}#u_input{position:absolute;width:0;height:0;opacity:0}'];
 for(const[id,s]of Object.entries(input.styles)){
   const size=s?.size,css=[];if(size&&Object.hasOwn(size,'width'))css.push('width:'+size.width+'px');if(size&&Object.hasOwn(size,'height'))css.push('height:'+size.height+'px');
   rules.push('#u.'+id+'{'+css.join(';')+'}');
   if(input.viewCss?.[id])rules.push('#u_img.'+id+'{'+input.viewCss[id]+'}');
 }
 if(input.initialSvgCss)rules.push('#u_img{'+input.initialSvgCss+'}');
 const style=document.createElement('style');style.id='fixture-css';style.textContent=rules.join('\\n');document.head.append(style);
 window.fixtureCss=style.textContent;
 window.initialNodes={svg,outline:svg.querySelectorAll('.stroke')[0],mark:document.getElementById('mark')};
};
window.snapshot=()=>{
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,left:r.left,right:r.right,bottom:r.bottom};};
 const read=id=>{const el=document.getElementById(id);if(!el)return null;const c=getComputedStyle(el);return{tag:el.tagName,classes:el.className?.baseVal??el.className,inline:el.getAttribute('style'),attrs:Object.fromEntries([...el.attributes].map(a=>[a.name,a.value])),computed:Object.fromEntries(['position','left','top','width','height','transform','transformOrigin','transformBox','display','overflow'].map(k=>[k,c[k]])),bbox:rect(el)};};
 const svg=document.getElementById('u_img'),box=svg.getBBox(),ctm=svg.getScreenCTM();
 return{currentView:$ax.adaptive.currentViewId??'',objSize:structuredClone(objects.u.style.size),objButtonSize:objects.u.buttonSize,fullBase:$ax.style.computeFullStyle('u','normal',''),fullCurrent:$ax.style.computeFullStyle('u',sourceInternals.state('u'),$ax.adaptive.currentViewId),overrides:$ax.style.computeAllOverrides('u',undefined,sourceInternals.state('u'),$ax.adaptive.currentViewId),owner:read('u'),label:read('u_label'),svg:read('u_img'),mark:read('mark'),svgBBox:{x:box.x,y:box.y,width:box.width,height:box.height},screenCTM:ctm?{a:ctm.a,b:ctm.b,c:ctm.c,d:ctm.d,e:ctm.e,f:ctm.f}:null,identity:{svg:svg===initialNodes.svg,outline:svg.querySelectorAll('.stroke')[0]===initialNodes.outline,mark:document.getElementById('mark')===initialNodes.mark}};
};
window.installTrace=()=>{
 window.styleObserver=new MutationObserver(()=>{});styleObserver.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['style','class','width','height','viewBox']});
 const original=$ax.style.setAdaptiveStyle;
 $ax.style.setAdaptiveStyle=function(...args){trace.push({kind:'adaptive-enter',args:structuredClone(args),before:snapshot()});try{return original.apply(this,args);}finally{trace.push({kind:'adaptive-exit',after:snapshot()});}};
 for(const name of ['addClass','removeClass']){const original=$.fn[name];$.fn[name]=function(...args){const result=original.apply(this,args);trace.push({kind:'class-write',method:name,args:structuredClone(args),ids:this.toArray().map(el=>el.id).filter(Boolean)});return result;};}
};
window.performAdaptiveStep=step=>{
 styleObserver.takeRecords();const before=snapshot();trace.length=0;let error;
 try{
  if(step.call==='initialize'){$ax.adaptive.setAdaptiveView(step.view??'default');$ax.adaptive.initialize();}
  else if(step.call==='switch')$ax.adaptive.setAdaptiveView(step.view);
  else if(step.call==='apply-view')$ax.adaptive.applyView(step.view);
  else if(step.call==='helper'){$ax.adaptive.currentViewId=step.view??'v1';if(step.install!==false)objects.u.adaptiveStyles[$ax.adaptive.currentViewId]=structuredClone(step.style);$ax.style.setAdaptiveStyle('u',structuredClone(step.style),step.state);}
  else if(step.call==='state')$ax.style[step.method]('u',step.value,step.force);
  else if(step.call==='inline-css'){for(const[id,values]of Object.entries(step.values))Object.assign(document.getElementById(id).style,values);}
  else if(step.call==='resize-event')resizeListener({type:'resize'});
 }catch(cause){error=String(cause.stack??cause);}
 const records=styleObserver.takeRecords(),mutations=records.map((r,index)=>{const next=records.slice(index+1).find(n=>n.target===r.target&&n.attributeName===r.attributeName);return{id:r.target.id,attribute:r.attributeName,old:r.oldValue,new:next?next.oldValue:r.target.getAttribute(r.attributeName)};});
 return{step,before,after:snapshot(),trace:structuredClone(trace),mutations,error};
};
`;

const styles={v1:{size:{width:200,height:72}},width:{size:{width:150,height:24}},height:{size:{width:100,height:48}},empty:{},p94:{buttonSize:28},halfWidth:{size:{width:220}},halfHeight:{size:{height:48}},zeroWidth:{size:{width:0,height:24}},zeroBoth:{size:{width:0,height:0}},emptySize:{size:{}},nullSize:{size:null},falseSize:{size:false},numberZero:{size:0},child:{size:{width:125,height:36}}};
const switchSteps=[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'v1'},{call:'apply-view',view:'v1'},{call:'switch',view:'width'},{call:'switch',view:'height'},{call:'switch',view:'empty'},{call:'switch',view:'p94'},{call:'state',method:'SetWidgetSelected',value:true,force:true},{call:'state',method:'SetWidgetEnabled',value:false},{call:'switch',view:'default'},{call:'switch',view:'v1'},{call:'switch',view:'unknown'}];
const helperSteps=[{call:'initialize'},...[
 {size:{width:200,height:72}},{size:{width:200,height:72}},{size:{width:150,height:24}},{size:{width:100,height:48}},{},{buttonSize:28},{size:{width:100,height:24}}
].map(style=>({call:'helper',style})),{call:'state',method:'SetWidgetSelected',value:true,force:true}];
const cases=[];
for(const type of ['checkbox','radioButton'])for(const alignRight of [false,true]){
 cases.push({name:'complete-switch-chain',type,alignRight,styles,steps:switchSteps});
 cases.push({name:'isolated-helper-chain',type,alignRight,styles,steps:helperSteps});
 cases.push({name:'initial-named-and-return',type,alignRight,styles,steps:[{call:'initialize',view:'v1'},{call:'switch',view:'default'},{call:'switch',view:'v1'}]});
 cases.push({name:'partial-and-falsy-size',type,alignRight,styles,steps:[{call:'initialize'},{call:'switch',view:'v1'},...['halfWidth','halfHeight','emptySize','nullSize','falseSize','numberZero','p94','default'].map(view=>({call:'switch',view}))]});
 cases.push({name:'zero-scale-return',type,alignRight,styles,steps:[{call:'initialize'},{call:'switch',view:'zeroWidth'},{call:'switch',view:'v1'},{call:'switch',view:'zeroBoth'},{call:'switch',view:'default'},{call:'switch',view:'v1'}]});
 cases.push({name:'generated-css-position-carrier',type,alignRight,styles,viewCss:{v1:'left:'+(alignRight?183:3)+'px;top:29px;width:15px;height:15px',width:'left:'+(alignRight?133:3)+'px;top:5px;width:19px;height:19px'},steps:[{call:'initialize'},{call:'inline-css',values:{u:{left:'91px',top:'72px',width:'123px',height:'45px'},u_label:{left:'7px',top:'9px',transform:'translate(2px, 3px)'},u_img:{left:'11px',top:'13px'}}},{call:'switch',view:'v1'},{call:'switch',view:'width'},{call:'switch',view:'default'}]});
 cases.push({name:'view-css-without-inline-position',type,alignRight,styles,viewCss:{v1:'left:'+(alignRight?183:3)+'px;top:29px;width:15px;height:15px',width:'left:'+(alignRight?133:3)+'px;top:5px;width:19px;height:19px'},steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'width'},{call:'switch',view:'default'}]});
}
for(const type of ['checkbox','radioButton']){
 for(const baseSize of [{width:0,height:24},{width:100,height:0},{width:0,height:0}])cases.push({name:'zero-base-denominator',type,baseSize,styles,steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'zeroBoth'},{call:'switch',view:'default'}]});
 cases.push({name:'direct-child-negative-control',type,directChild:true,styles,steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'width'},{call:'switch',view:'default'}]});
 cases.push({name:'declared-origin-and-scale',type,initialSvgCss:'transform:scale(1.5,.75);transform-origin:7px 7px',styles,steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'default'}]});
 cases.push({name:'inherited-view-size-and-child-p94',type,styles:{parent:{size:{width:200,height:72}},leaf:{buttonSize:28},partial:{size:{width:150}}},parents:{leaf:'parent',partial:'parent'},steps:[{call:'initialize'},{call:'switch',view:'leaf'},{call:'switch',view:'partial'},{call:'switch',view:'default'}]});
 for(const style of [{},{size:0},{size:false},{size:null},{size:{}},{size:{width:0,height:24}},{size:{width:100,height:0}}])cases.push({name:'fresh-size-truthiness',type,styles:{v1:style},steps:[{call:'initialize'},{call:'switch',view:'v1'}]});
 cases.push({name:'state-size-does-not-scale-until-adaptive-entry',type,unselected:true,stateSize:{width:150,height:48},styles:{v1:{size:{width:200,height:72}},empty:{}},steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'state',method:'SetWidgetSelected',value:true,force:true},{call:'switch',view:'empty'},{call:'state',method:'SetWidgetSelected',value:false,force:true},{call:'switch',view:'default'}]});
 cases.push({name:'legacy-viewbox-negative-control',type,legacyViewport:true,styles,steps:[{call:'initialize'},{call:'switch',view:'v1'},{call:'switch',view:'default'}]});
}

const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];let environment;
try{
 for(const input of cases){
  const page=await browser.newPage({viewport:{width:900,height:700}});page.on('pageerror',error=>errors.push({case:input.name,type:input.type,error:String(error)}));
  environment??={channel:'msedge',headless:true,version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),devicePixelRatio:await page.evaluate(()=>devicePixelRatio)};
  await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:base.text.css});await page.addScriptTag({content:base.text.jquery});await page.addScriptTag({content:base.setup});await page.addScriptTag({content:preparation});await page.evaluate(input=>prepareAdaptive(input),input);await page.addScriptTag({content:base.instrumented});await page.addScriptTag({content:mathSlice});await page.addScriptTag({content:adaptive});await page.evaluate(()=>installTrace());
  const actual=[];for(const step of input.steps)actual.push(await page.evaluate(step=>performAdaptiveStep(step),step));
  const fixtureCss=await page.evaluate(()=>window.fixtureCss);results.push({input,fixtureCss,actual});await page.close();
 }
 const exceptions=results.flatMap(r=>r.actual.filter(a=>a.error).map(a=>({case:r.input.name,type:r.input.type,step:a.step,error:a.error})));
 const output={method:'Complete retained style.js and adaptive.js modules, actual public setAdaptiveView/initialize/applyView and direct helper comparator. Original convertToSingleImage ordinary noncompound gate retained. Primary owner-label-SVG carrier has no viewBox/width/height attributes and a declared 15px CSS viewport, matching the independent ordinary b14/border1 emitted-envelope evidence. Body paths, absolute positions, generated-position CSS declarations and page/repeater services remain declared fixtures, not original GUI or full asset replay.',environment,sources:[...Object.values(paths),foundation,'research/selection-svg-bounds-probes.json','research/selection-layout-render-dom-probes.json','research/selection-layout-indicator-dom-detail-probes.json',import.meta.filename].map(path=>({path,sha256:sha(path),bytes:fs.statSync(path).size})),summary:{sequences:results.length,steps:results.reduce((n,r)=>n+r.actual.length,0),svgCalls:results.reduce((n,r)=>n+r.actual.reduce((m,a)=>m+a.trace.filter(t=>t.kind==='svg').length,0),0),exceptions:exceptions.length,pageErrors:errors.length},exceptions,errors,results};
 fs.writeFileSync(prefix+'probes-final.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(output.summary));
 assert.deepEqual(errors,[]);assert.deepEqual(exceptions,[]);
}catch(error){let n=1;while(fs.existsSync(prefix+'failure-'+n+'.json'))n++;fs.writeFileSync(prefix+'failure-'+n+'.json',JSON.stringify({message:error.stack,scriptSha256:sha(import.meta.filename),results,errors},null,2)+'\n',{flag:'wx'});throw error;}finally{await browser.close();}
