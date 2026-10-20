import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={'expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6','axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd','move.js':'c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644','visibility.js':'bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53','events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3','repeater.js':'d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=Object.entries(pins).map(([file,sha256])=>{const bytes=fs.readFileSync(base+'/'+file);assert.equal(hash(bytes),sha256);return{file,path:base+'/'+file,sha256,lines:bytes.toString().split(/\r?\n/)}});
const excerpts=[];function slice(file,start,end){const text=sources.find(s=>s.file===file).lines.slice(start-1,end).join('\n');excerpts.push({file,start,end,sha256:hash(text),text});return text;}
const original=[slice('axQuery.std.js',570,826),slice('move.js',7,108),slice('move.js',120,208),slice('visibility.js',1363,1380),slice('visibility.js',1392,1406),slice('events.js',1701,1717),slice('repeater.js',1590,1626),slice('expr.js',469,552)].join('\n');
const setup=`
var log=[],_move={},widgetMoveInfo={},_movedIds={},_resizedIds={},_resizingIds={},_visibility={resizingIds:_resizingIds},_blockSetMoveIds=false,registered={},q={};
var n={id:'w',type:c.type||'vector',autoFitWidth:c.flags?.[0]??true,autoFitHeight:c.flags?.[1]??true,interactionMap:{onResize:{eventType:'OnResize'},onMove:{eventType:'OnMove'}},style:{width:c.oldW??100,height:c.oldH??20,left:10,top:20,transform:'rotate('+(c.rotation||0)+'deg)',visibility:c.hidden?'hidden':'visible'}};
var initial={width:n.style.width,height:n.style.height};if(c.priorCache)_resizedIds.w={...c.priorCache};
function size(){return {...(_resizedIds.w||initial)}};
function location(){return _movedIds.w?{x:_movedIds.w.left,y:_movedIds.w.top}:{x:10,y:20}};
function snap(){return{size:size(),position:location(),css:{...n.style},resizing:!!_resizingIds.w}};
function record(kind,extra={}){log.push({kind,...extra,...snap()})}
function list(items=[]){const out={length:items.length,not:()=>out,children:()=>list(),each:fn=>items.forEach((e,i)=>fn(i,e))};items.forEach((e,i)=>out[i]=e);return out;}
var svg={id:'w_svg',style:{transform:'matrix(1,0,0,1,0,0)'}};
var jq={0:n,length:1,css(a,b){if(typeof a==='string'&&b===undefined)return a==='position'?'absolute':n.style[a];const values=typeof a==='object'?a:{[a]:b};for(const [k,v]of Object.entries(values)){n.style[k]=typeof v==='string'&&v.startsWith('+=')?(Number(n.style[k])||0)+Number(v.slice(2)):v;}record('css');return this;},children(sel){if(sel==='#w_text')return{height:()=>c.measureH??35};if(sel==='svg.img')return list(c.svg?[svg]:[]);return list();},find(sel){return sel==='p'?[{spanWidths:c.spanWidths||[c.measureW??130]}]:[];},animate(){throw Error('Unexpected animation')},hasClass:()=>false};
function $(obj){if(Array.isArray(obj))return list(obj);if(obj?.spanWidths)return{children:()=>obj.spanWidths.map(width=>({width}))};if(obj&&typeof obj.width==='number')return{width:()=>obj.width};return jq;}
$.extend=(a,b)=>Object.assign(a,b);$.inArray=(a,b)=>b.indexOf(a);
function $ax(sel){return Object.assign(Object.create($ax.public.fn),{getElementIds:()=>[sel.slice(1)],size,offsetLocation:location,offsetBoundingRect:()=>({left:location().x,top:location().y,...size()}),getParents:()=>[[]],getChildren:()=>[{children:[]}],childrenBoundingRect:()=>({right:c.hidden?0:location().x+size().width,bottom:c.hidden?0:location().y+size().height})})};
$ax.public={fn:{IsResizable:t=>!['tableCell','checkbox','radio','repeater'].includes(t),IsDynamicPanel:t=>t==='panel',IsLayer:()=>false,IsConnector:()=>false}};
$ax.move=_move;$ax.visibility={};$ax.annotation={adjustIconLocation:()=>record('annotation')};$ax.drag={LogMovedWidgetForDrag:()=>record('drag-log')};$ax.action={queueTypes:{resize:'resize',move:'move'},fireAnimationFromQueue:(id,type)=>record('queue:'+type)};
$ax.adaptive={currentViewId:'',updateMobileScrollOnBody:()=>record('body-scroll')};
var _dynamicPanelManager=$ax.dynamicPanelManager={getFixedInfo:()=>({}),isPercentWidthPanel:()=>false};
function getParentLayerOrRdo(){return null};function getParentPanel(){return c.panel?{parent:'p',state:0,stateId:'p_state0'}:null};
function _updateMobileScroll(){record('panel-scroll')};function _updateFitPanel(){record('panel-fit');return false};
$ax.getParentRepeaterFromElementId=()=>c.repeater?'r':null;
$ax.repeater={getItemIdFromElementId:()=>7,createElementId:()=> 'r-7',setItemSize:(id,row,w,h)=>record('row-fit',{row,width:w,height:h})};
function $obj(id){return id==='w'?n:id==='r'?{repeaterPropMap:{fitToContent:c.fit!==false}}:null};
function $jobj(){return jq};function $addAll(){return jq};$ax.getTypeFromElementId=()=>n.type;
$ax.GetTextPanelId=()=> 'w_text';$ax.style={generateState:()=> 'normal',computeFullStyle:()=>({horizontalAlignment:c.alignX||'left',verticalAlignment:c.alignY||'top',paddingTop:c.pad?.[0]||0,paddingRight:c.pad?.[1]||0,paddingBottom:c.pad?.[2]||0,paddingLeft:c.pad?.[3]||0}),IsWidgetDisabled:()=>!!c.disabled};
$ax.event={};$ax.getObjectFromElementId=$obj;$ax.getEventInfoFromEvent=()=>({});$ax.getjBrowserEvent=()=>({});
function _handleEvent(id,info,event){record(event.eventType);if(event.eventType==='OnResize'&&c.resizeHandlerMove)_movedIds.w={left:100,top:200};}
function _displayWidgetIfNeeded(){record('measure',{hidden:!!c.hidden});return{jObject:jq,trap:c.hidden?()=>record('remove-clone'):null}};
function _setAutoFitId(id,css){registered[id]={...css};record('registered')};
var window={getComputedStyle:()=>({transform:'matrix(1,0,0,1,0,0)'})};class WebKitCSSMatrix{constructor(){this.m11=1;this.m22=1}};
`;
const results=[];
function probe(name,c,check,command='autofitWidget("w")'){const context=vm.createContext({c},{codeGeneration:{strings:false,wasm:false}});vm.runInContext(setup+'\n'+original+'\n'+command,context,{timeout:1000});const out=JSON.parse(vm.runInContext('JSON.stringify({log,final:snap(),registered,svg},(k,v)=>typeof v==="number"&&!Number.isFinite(v)?String(v):v)',context));check(out);results.push({name,input:c,observed:out,pass:true});}
const kinds=r=>r.log.map(e=>e.kind);const event=(r,n)=>r.log.find(e=>e.kind===n);
probe('ordinary resize and alignment move expose intermediate geometry',{alignX:'center',alignY:'middle'},r=>{assert.deepEqual(event(r,'OnResize').position,{x:10,y:20});assert.deepEqual(event(r,'OnResize').size,{width:130,height:35});assert.deepEqual(event(r,'OnMove').position,{x:-5,y:12.5});assert.equal(event(r,'OnResize').resizing,true);assert.equal(event(r,'OnMove').resizing,false);assert.ok(kinds(r).indexOf('OnResize')<kinds(r).indexOf('queue:move'));assert.ok(!kinds(r).includes('queue:resize'));});
probe('same measured dimensions only register',{measureW:100,measureH:20},r=>assert.deepEqual(kinds(r),['measure','registered']));
probe('both flags false perform no work',{flags:[false,false]},r=>assert.deepEqual(kinds(r),[]));
probe('fractional sizes and right bottom moves remain unrounded',{measureW:130.125,measureH:35.375,alignX:'right',alignY:'bottom'},r=>{assert.deepEqual(r.final.size,{width:130.125,height:35.375});assert.deepEqual(r.final.position,{x:-20.125,y:4.625});});
probe('both zero updates CSS but does not replace logical size cache',{measureW:0,measureH:0},r=>{assert.deepEqual(r.final.size,{width:100,height:20});assert.equal(r.final.css.width,0);assert.equal(r.final.css.height,0);assert.deepEqual(r.registered.w,{width:0,height:0});});
probe('both zero also retains a previous nonzero logical cache',{measureW:0,measureH:0,priorCache:{width:80,height:15}},r=>assert.deepEqual(r.final.size,{width:80,height:15}));
probe('one zero axis is cached when other is nonzero',{measureW:0,measureH:35},r=>assert.deepEqual(r.final.size,{width:0,height:35}));
probe('negative requested dimensions are not clamped by query resize',{},r=>{assert.deepEqual(r.final.size,{width:-2.25,height:-3.5});assert.equal(r.final.css.width,-2.25)},'$ax("#w").resize({width:-2.25,height:-3.5},{})');
probe('pure owner rotation does not rotate alignment movement',{rotation:90,alignX:'right',alignY:'bottom'},r=>{assert.equal(r.final.css.transform,'rotate(90deg)');assert.deepEqual(r.final.position,{x:-20,y:5});});
probe('resize handler mutation is observable before alignment correction',{alignX:'center',alignY:'middle',resizeHandlerMove:true},r=>assert.deepEqual(r.final.position,{x:85,y:192.5}));
probe('repeater fits at resized old position but not after direct alignment move',{repeater:true,alignX:'right',alignY:'bottom'},r=>{const fits=r.log.filter(e=>e.kind==='row-fit');assert.equal(fits.length,1);assert.equal(fits[0].width,140);assert.equal(fits[0].height,55);assert.deepEqual(r.final.position,{x:-20,y:5});assert.ok(kinds(r).indexOf('row-fit')<kinds(r).indexOf('OnResize'));});
probe('fixed repeater disables automatic row fit',{repeater:true,fit:false},r=>assert.ok(!kinds(r).includes('row-fit')));
probe('panel parent stops direct traversal to repeater',{repeater:true,panel:true},r=>{assert.equal(kinds(r).filter(e=>e==='panel-fit').length,1);assert.ok(!kinds(r).includes('row-fit'));});
probe('hidden owner still resizes and fires synthetic events; fit excludes hidden owner',{hidden:true,repeater:true,alignX:'right'},r=>{assert.ok(event(r,'OnResize'));assert.ok(event(r,'OnMove'));assert.equal(event(r,'row-fit').width,0);assert.ok(kinds(r).indexOf('remove-clone')>kinds(r).indexOf('OnMove'));});
probe('disabled flag does not suppress resize/move synthetic event names',{disabled:true,alignX:'right'},r=>{assert.ok(event(r,'OnResize'));assert.ok(event(r,'OnMove'));});
probe('table cell rejects resize but alignment move still executes',{type:'tableCell',alignX:'right'},r=>{assert.deepEqual(r.final.size,{width:100,height:20});assert.deepEqual(r.final.position,{x:-20,y:20});assert.ok(!event(r,'OnResize'));assert.ok(event(r,'OnMove'));assert.equal(r.final.resizing,true)});
probe('SVG child scales from old size with raw fractional ratio',{svg:true,measureW:150,measureH:25},r=>assert.equal(r.svg.style.transform,'Scale(1.5, 1.25)'));
probe('SVG zero old axis produces unguarded infinite scale',{svg:true,oldW:0,measureW:130},r=>assert.equal(r.svg.style.transform,'Scale(Infinity, 1.75)'));
const report={method:'Exact hash-pinned original function slices in Node VM; DOM/CSS, measurements, parent-panel layout, event action bodies and animation queue are explicit dependency stubs. No original app/GUI/browser rendering.',sources:sources.map(({lines,...s})=>s),excerpts,results,passed:results.length,limitations:['CSS stub records assignments; does not model browser clamping, used boxes, 1/64 quantization or border-box minimums','Height/width measurements are injected, not font measurements','Synthetic event dispatcher is original; handler body is a synchronous snapshot/mutation stub, not full case/menu/Wait execution','Repeater fit dispatch is original; child bounds and row-size sink are stubbed, not original push layout','No general transform, fixed panel/layer wrapper DOM, image offsets, parent panel full resize or SVG rendering is probed']};
fs.writeFileSync('research/runtime-text-autofit-geometry-probes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:results.length}));
