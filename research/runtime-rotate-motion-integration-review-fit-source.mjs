// Bounded exact-source fit function composition; numeric DOM/style sinks only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const evidence=JSON.parse(fs.readFileSync('research/runtime-rotate-motion-evidence.json','utf8'));
const dir=path.dirname(evidence.sources.find(s=>s.path.endsWith('/action.js')).path),ranges=[];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const slice=(name,start,end)=>{const file=path.join(dir,name),text=fs.readFileSync(file,'utf8').split(/\r?\n/).slice(start-1,end).join('\n');assert.equal(sha(file),evidence.sources.find(s=>path.resolve(s.path)===path.resolve(file)).sha256);ranges.push({file,start,end,sha256:crypto.createHash('sha256').update(text).digest('hex')});return text;};
const code=`
var calls=[],css={width:cfg.oldWidth,height:cfg.oldHeight},states={},_dynamicPanelManager={};
function $ax(selector){var id=selector.slice(1),q=Object.create($ax.public.fn);q.getElementIds=()=>[id];q.getChildren=()=>[{children:['a']}];q.getParents=()=>[[]];if(id==='p')q.offsetBoundingRect=()=>({left:0,top:0,width:cfg.oldWidth,height:cfg.oldHeight});return q;}
$ax.public={fn:{IsLayer:()=>false,IsDynamicPanel:()=>false}};$ax.getTypeFromElementId=()=> 'vector';
$ax.style={generateState:()=>'',computeFullStyle:()=>({location:{x:0,y:0},size:{width:200,height:100},rotation:cfg.authored,outerShadow:{on:false}})};$ax.adaptive={};
$ax.visibility={limboIds:{},IsIdVisible:()=>true,getMovedLocation:()=>undefined,getResizedSize:()=>undefined,getRotatedAngle:()=>cfg.target,
setResizingRect:(...a)=>calls.push(['resizingRect',...a]),GetPanelState:()=> 'p_state0',setResizedSize:(...a)=>calls.push(['resized',...a]),clearMovedAndResizedIds:(...a)=>calls.push(['clear',...a])};
$ax.dynamicPanelManager={isIdFitToContent:()=>true};$ax.repeater={applySuffixToElementId:(id,suffix)=>id+suffix};$ax.getNumFromPx=parseFloat;
$ax.event={raiseSyntheticEvent:(...a)=>calls.push(['event',...a])};$ax.flyoutManager={updateFlyout:()=>{}};
function $jobj(id){return {0:{id},width:v=>{if(v===undefined)return css.width;css.width=v;},height:v=>{if(v===undefined)return css.height;css.height=v;},children:()=>({each:()=>{}})};}
function getComputedStyle(){return {width:css.width+'px',height:css.height+'px',borderRightWidth:'0px',borderLeftWidth:'0px',borderTopWidth:'0px',borderBottomWidth:'0px'};}
var $axure={fn:$ax.public.fn},$obj=()=>({type:'vector'}),document={getElementById:()=>({getAttribute:()=>null})},_fixedLocation=()=>({valid:false});
var _adjustFixed=()=>{},_updatePanelPercentWidth=()=>{};
${slice('math.js',2,149)}
${slice('math.js',217,223)}
${slice('axQuery.std.js',1299,1323)}
${slice('axQuery.std.js',1325,1353)}
${slice('axQuery.std.js',1368,1371)}
${slice('axQuery.std.js',1438,1575)}
${slice('repeater.js',2022,2078)}
var returned=_updateFitPanel('p',0);
`;
const configs=[{name:'zero-cache-falls-back-to-author-style',authored:30,target:0,oldWidth:211.60254037844388,oldHeight:143.30127018922192,expectedWidth:211.60254037844388,expectedHeight:143.30127018922192,expectedEvents:0},{name:'normal-fit-emits-resize',authored:0,target:90,oldWidth:200,oldHeight:100,expectedWidth:150,expectedHeight:150,expectedEvents:1}];
const results=configs.map(cfg=>{const c=vm.createContext({cfg,Math,Number,parseFloat});try{vm.runInContext(code,c);const events=c.calls.filter(x=>x[0]==='event');return {name:cfg.name,cfg,observed:{css:{...c.css},calls:JSON.parse(JSON.stringify(c.calls)),returned:c.returned},passed:Math.abs(c.css.width-cfg.expectedWidth)<1e-8&&Math.abs(c.css.height-cfg.expectedHeight)<1e-8&&events.length===cfg.expectedEvents};}catch(e){return {name:cfg.name,passed:false,error:e.stack};}});
const output=process.argv[2]||'research/runtime-rotate-motion-integration-review-fit-source-valid.json';assert(!fs.existsSync(output));
const report={schema:1,capturedAt:new Date().toISOString(),kind:'exact retained _updateFitPanel + childrenBoundingRect + offsetBoundingRect in NodeVM',sources:evidence.sources.filter(s=>['math.js','axQuery.std.js','repeater.js'].some(n=>s.path.endsWith('/'+n))),ranges,probe:{path:import.meta.filename,sha256:sha(import.meta.filename)},substitutions:['Fixed known parent/child identity, active state and visibility.','State DOM width/height and computed border sizes are numeric sinks; no browser reflow.','Event, flyout, resize cache and fixed-panel callbacks are recorded sinks; no authored event bodies or nested percent panels.'],checks:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,checks:report.checks,results},null,2));if(report.checks.failed)process.exitCode=1;
