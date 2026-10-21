// Reproduce frozen retained-CIL evidence without overwriting it.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const suffix=process.argv[2];
if(!suffix||!/^[a-z0-9-]+$/.test(suffix))throw Error('Provide a new lower-case output suffix');
const source='research/selection-svg-body-paint-probe-final.mjs';
const expected='e749ec08e40a415f12b6d7d13ad919e2db1e52dc3c462ea2f052b37890b962ad';
const bytes=fs.readFileSync(source);
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Frozen replay source changed');
const output=`research/selection-svg-body-paint-reproduction-${suffix}.json`;
if(fs.existsSync(output))throw Error('Output already exists');
let code=bytes.toString('utf8').replace('research/selection-svg-body-paint-probes-final.json',output);
for(const name of ['gradient-angle-static-flow.mjs','selection-svg-body-matrix-api.mjs'])code=code.replace(`'./${name}'`,JSON.stringify(pathToFileURL('research/'+name).href));
code=code.replace('sha(import.meta.filename)',JSON.stringify(expected));
await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
if(fs.readFileSync(output,'utf8')!==fs.readFileSync('research/selection-svg-body-paint-probes-final.json','utf8'))throw Error('Independent reproduction differs from frozen output');
console.log(JSON.stringify({identical:true,output,sha256:createHash('sha256').update(fs.readFileSync(output)).digest('hex')}));
