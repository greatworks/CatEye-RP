// Reusable, side-effect-free setup for the frozen bounded CIL matrix probe.
// Importing this module reads retained data only; it creates no result artifacts.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const input='research/selection-svg-body-matrix-probe.mjs';
const expected='2d10d7af4e4404f2d6cd34005a924c8d0c6cbc7ccdb9acf5d051ecd470ad6b51';
const bytes=fs.readFileSync(input);
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Matrix probe source identity mismatch');
const marker='const results=[];';
let code=bytes.toString('utf8');
if(code.indexOf(marker)<0)throw Error('Missing inert setup boundary');
code=code.slice(0,code.indexOf(marker)).replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href));
code+='\nexport {run,graphics,point,matrix,components,multiply,identity,callback}; export function resetTrace(){trace=[];} export function getTrace(){return trace.slice();}';
const core=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
export const run=core.run,graphics=core.graphics,point=core.point,matrix=core.matrix,components=core.components,multiply=core.multiply,identity=core.identity,callback=core.callback,resetTrace=core.resetTrace,getTrace=core.getTrace;
export const retainedProbe={path:input,sha256:expected};