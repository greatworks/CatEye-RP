// Bounded interpretation of retained CIL records; never loads the vendor assembly.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const oldFile='research/selection-layout-transaction-replay.mjs';
const old=fs.readFileSync(oldFile,'utf8');
let construction=old.slice(0,old.indexOf('const moduleCode='));
// Resolve its one relative import when the construction is evaluated as a data URL.
construction=construction.replace("'./gradient-angle-static-flow.mjs'", "'./gradient-angle-static-flow.mjs'");
const newFiles=['entry','panel','rich','style-refresh','write','key-setters','provider'].map(x=>'research/selection-author-properties-'+x+'-cil.json');
const addon=`
const propertyFiles=${JSON.stringify(newFiles)};
for(const file of propertyFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100702385,1],[100701893,1],[100701874,1],[100701895,2],[100701907,2],
 [100701880,3],[100701878,1],[100701879,2],[100701873,1],[100701890,2],[100701884,2],
 [100702333,2],[100702335,2],[100702337,2]])cil(id,n);
bind(100695411,1,()=>context.input.overridden?1:0);
bind(100701883,1,([p])=>{event('attributed.read-effective');return p[67126652];}); // provider/style projection is an explicit facade
bind(100707905,1,([a])=>{event('attributed.first-style');return a.firstStyle??{font:'controlled'};});
bind(100707910,2,([text,firstStyle])=>{event('attributed.from-plain',{text});return {text,firstStyle};});
bind(100707936,1,([a])=>{event('attributed.clone');return structuredClone(a);});
bind(100707935,1,([a])=>{event('attributed.normalize');return VOID;});
bind(100701892,2,([p,flag])=>{event('style.sync',{flag:!!flag,guard:!!p[67126655]});
 if(context.input.throwAtSync)throw Error('Injected style synchronization error');
 if(context.input.syncNotificationKeys)execute(100702033,[p.owner,context.input.syncNotificationKeys,1]);
 return VOID;}); // deliberately bounded downstream style-provider/inline-link service
bind(100701898,1,()=>{event('inline-links.refresh');return VOID;});
bind(100688766,2,(args,frame)=>{
 const scope=execute(100688766,args);
 if(scope){let done=false;scope.dispose=()=>{if(done)return;done=true;event('finally.dispose');execute(100688769,[scope]);};frame.cleanups.push(scope.dispose);}
 return scope;
});
bind(167772304,1,([scope])=>{scope?.dispose?.();return VOID;});
bind(167786506,2,([fn,v])=>{event(fn.method===100701907?'panel.change-guard':'guard',{value:!!v});return execute(fn.method,[fn.target,v]);});
bind(100702312,2,args=>{event('panel.style-refresh',{notify:!!args[1]});return execute(100701895,args);});
bind(100702325,1,()=>context.input.forceUpdate?1:0);
bind(100695255,3,([w,flag,keys])=>{event('owner.VJm0',{flag:!!flag,keys});return VOID;});
bind(100695441,1,()=>size(1,1));
bind(100717159,4,([provider,key,value,flag])=>{event('property.write',{key,value,flag:!!flag});return VOID;});
export function propertyCarrier(token,value=17){context={events:[]};execute(token,[{},value]);return context.events;}
export const propertySourceInputs=propertyFiles;
`;
const finalConstruction=construction+`
prefix=prefix.replace('else if(v===67134719) stack.push(point(0,0));','else if(v===67135093) stack.push(size(NaN,NaN)); else if(v===67134719) stack.push(point(0,0));');
prefix=prefix.replace("else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s') jump(v);", "else if(op==='leave'&&token===100701880&&v===423)jump(323); else if(op==='endfinally'&&token===100701880)jump(423); else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')jump(v);");
const ext=extension
 .replace('w.panel.owner=w;', 'w.panel.owner=w; w.panel[67126655]=input.panelChangeGuard?1:0; w.panel[67126654]={oldCache:1}; w.panel[67126651]={oldCache:2}; w.panel[67126660]=size(33,44); w.panel[67126820]=w; w.panel[67126652]={text:"old",firstStyle:{font:"controlled"}};')
 .replace("if(input.entry==='size')", "if(input.entry==='plainText')execute(100702333,[w,input.text??'New text']); else if(input.entry==='richText')execute(100702337,[w,input.attr??{text:'New rich text'}]); else if(input.entry==='RNO1')execute(100701880,[w.panel,input.attr??{text:'New rich text'},input.textNotify===false?0:1]); else if(input.entry==='refresh')execute(100701893,[w.panel]); else if(input.entry==='iIyW')execute(100701895,[w.panel,input.refreshNotify?1:0]); else if(input.entry==='size')")
 .replace('measures:context.measures,events:', 'attributedString:w.panel[67126652],panelChangeGuard:!!w.panel[67126655],panelCaches:{first:w.panel[67126654],second:w.panel[67126651],size:w.panel[67126660]},measures:context.measures,events:');
const moduleCode=prefix+oldAdapter+ext+${JSON.stringify(addon)};
export const api=await import('data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64'));
export const files=[...new Set([controllerFile,'research/selection-author-resize-probe.mjs',
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',...api.sourceInputs,...api.propertySourceInputs])];
`;
const built=await import('data:text/javascript;base64,'+Buffer.from(finalConstruction).toString('base64'));
export const api=built.api;
export const sourceFiles=[oldFile,...built.files];
if(process.argv[1]?.replaceAll('\\','/').endsWith('/selection-author-properties-replay.mjs')){
 const cases=[];
 const add=(name,input,check)=>{const actual=api.transaction(input);let error;try{assert.equal(actual.error,null);check(actual);}catch(e){error=e.message;}cases.push({name,input,actual,passed:!error,error});};
 for(const editingText of [false,true])for(const panelChangeGuard of [false,true])for(const widthFit of [false,true])for(const heightFit of [false,true]){
  const input={entry:'selectionStyleChanged',keys:[2],editingText,panelChangeGuard,widthFit,heightFit};
  add('Style refresh gates and force order',input,a=>assert.deepEqual(a.events.filter(x=>x.name==='OI8Z.enter'&&!x.alreadyGuarded).map(x=>x.force),editingText||panelChangeGuard?[false]:[true,false]));
 }
 for(const keys of [[],[101],[101,2],[94],[105]])for(const notify of [false,true]){
  add('Changed-key gate',{entry:'selectionStyleChanged',keys,notify},a=>assert.deepEqual(a.events.filter(x=>x.name==='OI8Z.enter'&&!x.alreadyGuarded).map(x=>x.force),!notify||keys.length===1&&keys[0]===101?[]:[true,false]));
 }
 for(const refreshNotify of [false,true])for(const forceUpdate of [false,true])add('Virtual refresh notification gate',{entry:'iIyW',refreshNotify,forceUpdate},a=>{
  assert.equal(a.events.filter(x=>x.name==='owner.VJm0').length,refreshNotify&&forceUpdate?1:0);
  assert.deepEqual(a.events.filter(x=>x.name==='OI8Z.enter'&&!x.alreadyGuarded).map(x=>x.force),[true]);
 });
 add('Direct ordinary refresh clears caches',{entry:'refresh'},a=>{assert.equal(a.panelCaches.first,null);assert.equal(a.panelCaches.second,null);assert(Number.isNaN(a.panelCaches.size.width));assert.equal(a.events.at(-1).name,'panel.invalidate');});
 for(const entry of ['plainText','richText','RNO1'])for(const overridden of [false,true])for(const panelChangeGuard of [false,true]){
  add('Text mutation entry and suppression scope',{entry,overridden,panelChangeGuard},a=>{
   assert.deepEqual(a.events.filter(x=>x.name==='OI8Z.enter'&&!x.alreadyGuarded).map(x=>x.force),overridden?[]:[true]);
   assert.equal(a.events.filter(x=>x.name==='owner.VJm0').length,overridden?0:1);
   assert.equal(a.panelChangeGuard,panelChangeGuard);
   if(!overridden){assert(a.events.find(x=>x.name==='style.sync').guard);assert.equal(a.events.at(-1).name,'owner.VJm0');}
  });
 }
 for(const input of [
  {keys:[2],suppressStyleLayout:true},{keys:[2],guarded:true},
  {keys:[94],buttonSize:120,notify:false},{keys:[94],buttonSize:120,empty:true},
  {keys:[94],buttonSize:100},{keys:[94],buttonSize:99},
  {keys:[94],buttonSize:120,suppressStyleLayout:true},{keys:[94],buttonSize:120,guarded:true}
 ])add('P94 preflight precedes base notification gate',{entry:'selectionStyleChanged',...input},a=>{
  const preflight=input.keys.includes(94)&&!input.empty&&input.buttonSize>100;
  const requests=a.events.filter(x=>x.name==='uJ0j.request');
  if(preflight)assert.equal(requests[0].width,input.buttonSize+50);
  else if(input.suppressStyleLayout||input.guarded)assert.equal(requests.length,0);
 });
 add('Text notify false still writes attributed value',{entry:'RNO1',textNotify:false},a=>{assert.equal(a.attributedString.text,'New rich text');assert.equal(a.measures,0);assert.equal(a.events.filter(x=>x.name==='owner.VJm0').length,0);});
 for(const panelChangeGuard of [false,true]){
  const input={entry:'RNO1',throwAtSync:true,panelChangeGuard};const actual=api.transaction(input);
  assert.equal(actual.error,'Injected style synchronization error');assert.equal(actual.panelChangeGuard,panelChangeGuard);
  cases.push({name:'Text suppression restored when injected sync fails',input,actual,passed:true});
 }
 // Setter instruction records prove carrier IDs. This does not assert all product value conversions.
 const carriers=[[100717263,1],[100717328,101],[100717330,105],[100717332,94],[100717346,1001],[100717348,1002],
 [100717352,2],[100717358,5],[100717366,95],[100717370,6],[100717372,7],[100717374,8],[100717376,70],
 [100717378,71],[100717380,9],[100717382,10],[100717384,11],[100717386,12],[100717388,13],[100717390,14],
 [100717392,15],[100717394,16],[100717396,17],[100717398,20],[100717412,21],[100717416,72],[100717418,73],
 [100717420,74],[100717426,80],[100717428,81]];
 for(const [token,key]of carriers){let actual,error;try{actual=api.propertyCarrier(token);assert.equal(actual[0].key,key);}catch(e){error=e.message;}cases.push({name:'Native setter carrier',input:{token,key},actual,error,passed:!error});}
 const output={kind:'retained-CIL-record replay with explicit graphics, notifications, provider, inline-link sinks',cases,passed:cases.filter(x=>x.passed).length,total:cases.length,sources:sourceFiles.map(path=>({path,sha256:sha(path)}))};
 fs.writeFileSync('research/selection-author-properties-probes.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({passed:output.passed,total:output.total,failures:cases.filter(x=>!x.passed).map(x=>({name:x.name,input:x.input,error:x.error,actualError:x.actual.error}))}));
 if(output.passed!==output.total)process.exitCode=1;
}
