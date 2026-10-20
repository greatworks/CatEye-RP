import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const file='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/doc.js';
const bytes=fs.readFileSync(file),sha256=createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256,'986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1');
const lines=bytes.toString('utf8').split(/\r?\n/),source=lines.slice(767,823).join('\n');
const cases=[];
function probe(name,to,expected){const trace=[],location={};Object.defineProperty(location,'href',{get:()=> 'file:///isolated/prototype.html',set:value=>trace.push({kind:'assignLocation',value})});const sandbox={window:{location,open:(...args)=>trace.push({kind:'window.open',args})},$ax:{public:{},globalVariableProvider:{getLinkUrl:(value)=>{trace.push({kind:'variables',value});return value+'#fixture'}}},$axure:{utils:{getReloadPath:()=> 'resources/reload.html'}},top:{},parent:{}};vm.runInNewContext(source,sandbox);sandbox.$ax.navigate(to);assert.deepEqual(trace,expected);cases.push({name,to,trace,passed:true})}
probe('current literal uses same window location',{url:'https://example.invalid/path?x=1#part',target:'current',includeVariables:false},[{kind:'assignLocation',value:'https://example.invalid/path?x=1#part'}]);
probe('new literal calls window.open with empty window name and no feature string',{url:'https://example.invalid/path?x=1#part',target:'new',includeVariables:false},[{kind:'window.open',args:['https://example.invalid/path?x=1#part','']}]);
probe('direct current empty value has about blank fallback',{url:'',target:'current',includeVariables:false},[{kind:'assignLocation',value:'about:blank'}]);
probe('direct new empty value is passed through',{url:'',target:'new',includeVariables:false},[{kind:'window.open',args:['','']}]);
probe('navigation string shorthand uses current','https://example.invalid/shortcut',[{kind:'assignLocation',value:'https://example.invalid/shortcut'}]);
fs.writeFileSync('research/hyperlink-runtime-navigation-probe.json',JSON.stringify({timestamp:new Date().toISOString(),method:'Exact original navigate and needsReload in VM with inert window/location sinks; no browser and no network',file,sha256,sourceRange:{first:768,last:823},source,cases,limits:['External literal URL path only; popup/player/global-variable integration outside scope','window.open return/opener/browser policy not simulated']},null,2)+'\n');
console.log(JSON.stringify({passed:cases.length}));
