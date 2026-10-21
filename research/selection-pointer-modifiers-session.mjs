// Reuse the frozen interpreter construction; add exact hInw/BJG9/QJGS records.
// No vendor DLL or product module is executed. Platform key-state is a facade.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const oldPath='research/selection-pointer-session-probe.mjs';
let code=fs.readFileSync(oldPath,'utf8');
code=code.slice(0,code.indexOf("if(process.argv[1]?"));
code=code.replace("'./selection-pointer-control-probe.mjs'",JSON.stringify(pathToFileURL('research/selection-pointer-control-probe.mjs').href));
code=code.replace("'./selection-pointer-numeric-probe.mjs'",JSON.stringify(pathToFileURL('research/selection-pointer-numeric-probe.mjs').href));
const addition=String.raw`
for(const file of ['research/selection-pointer-modifiers-entry-cil.json','research/selection-pointer-modifiers-key-tests-cil.json'])for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,m);
for(const [t,n]of [[100686246,4],[100686248,8],[100691307,2],[100691309,1]])cil(t,n);
bind(100708646,0,()=>({platform:true}));
bind(100710378,1,()=>{event('platform.keys.read',{mask:context.modifierMask});return context.modifierMask;});
`;
code=code.replace('function begin(input){',addition+'\nfunction begin(input){');
code=code.replaceAll('for(const delta of input.deltas)', 'for(const [frameIndex,delta] of input.deltas.entries())');
code=code.replaceAll("execute(100686248,[c,delta.x,delta.y,false,false,!!input.shift,3,false]);", "context.modifierMask=input.keyMasks?.[frameIndex]??0; execute(100686246,[c,delta.x,delta.y,false]);");
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// The imported frozen control module installs an uncaughtException file sink;
// this wrapper never uses it. All new probe errors are caught by their own main.
export const sourceFiles=[...new Set([oldPath,'research/selection-pointer-modifiers-entry-cil.json','research/selection-pointer-modifiers-key-tests-cil.json',...api.sourceFiles])];
export const session=api.session;
export const multiple=api.multiple;
