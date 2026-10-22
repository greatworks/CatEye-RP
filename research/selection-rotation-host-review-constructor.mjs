// Static retained-CIL constructor/getter replay. No vendor assembly is loaded.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const old=fs.readFileSync('research/layer-resize-controller-probe.mjs','utf8');
let source=old.slice(0,old.indexOf('for(let mask=0;mask<16;mask++)'))
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
source+=String.raw`
const added=['research/selection-rotation-host-review-freedom-cil.json','research/layer-resize-controller-planner-axis-cil.json','research/selection-input-grid-dependencies-cil.json'];
for(const file of added)for(const type of read(file).Types)for(const method of type.Methods)methods.set(method.Token,{...method,file});
for(const [token,n]of [[100686217,3],[100686100,2],[100686099,1],[100708345,1],[100708315,1],[100708318,1],[100708321,1],[100708324,1]])cil(token,n);
bind(100685893,2,()=>VOID); // base editor UI construction, no sizing-field writes (xref separately retained)
export function constructorFreedom(handle){const c={};execute(100686217,[c,{editor:true},handle]);return execute(100686099,[c]);}
`;
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
export const {constructorFreedom}=api;
