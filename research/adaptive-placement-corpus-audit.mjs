import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const root=path.resolve(import.meta.dirname,'..'),baselineFile='.build/before-adaptive-placement/corpus-baseline.json';
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8').replace(/^\uFEFF/,''));
assert.equal(sha(baselineFile),'c3029c75b54e9419988119fb12d05b28fe78c13574b0d6f2587c01a66c369377');
const modules=new Map(),urls=new Map();
function moduleUrl(file){file=path.resolve(root,file);if(urls.has(file))return urls.get(file);modules.set(file,sha(file));const source=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file),r.endsWith('.ts')?r:`${r}.ts`)))}`);const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;urls.set(file,url);return url;}
const {importRpSemantics}=await import(moduleUrl('src/model/import-rp.ts')),{parseDocument,serializeDocument}=await import(moduleUrl('src/model/document.ts'));
const baseline=read(baselineFile),samples=[],failures=[];
for(const prior of baseline.samples){
  assert.equal(sha(prior.file),prior.sha256);const item={name:prior.name,file:prior.file,sha256:prior.sha256};
  try{
    const semantics=inspectRpSemantics(prior.file);
    if(prior.importError){assert.throws(()=>importRpSemantics(semantics),error=>error.message===prior.importError);item.rejectionUnchanged=true;}
    else {const result=importRpSemantics(semantics);assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);assert.deepEqual(result.document,prior.document,`${prior.name}: complete imported document changed`);assert.deepEqual(result.report,prior.report,`${prior.name}: complete import report changed`);item.completeDocumentUnchanged=true;item.completeReportUnchanged=true;item.widgetsImported=result.report.widgetsImported;item.pagesImported=result.report.pagesImported;}
    item.ok=true;
  }catch(error){item.ok=false;item.failure=String(error.message).slice(0,12000);failures.push({name:prior.name,failure:item.failure});}
  assert.equal(sha(prior.file),prior.sha256);samples.push(item);
}
const sources=[{file:baselineFile,sha256:sha(baselineFile)},...['container','objects','interactions','adaptive','semantics'].map(name=>{const file=`research/scripts/read-rp-${name}.mjs`;return{file,sha256:sha(file)};}),...[...modules].map(([file,hash])=>{assert.equal(sha(file),hash);return{file:path.relative(root,file).replaceAll('\\','/'),sha256:hash};})];
const result={verifiedAt:new Date().toISOString(),ok:failures.length===0,method:'Fresh reader/importer/serialize/reopen on all pinned originals compared deeply with immutable complete pre-change documents AND reports, including order and inactive declarations.',sources,samples,failures,totals:{samples:samples.length,admitted:samples.filter(i=>i.completeDocumentUnchanged).length,rejected:samples.filter(i=>i.rejectionUnchanged).length},originalNativeUnplacedPositiveCount:0,limitations:['No original corpus file has a direct/local P111 FALSE or IGNORE declaration. Positive cases use explicitly synthetic raw carriers.']};
fs.writeFileSync(path.join(root,'research/adaptive-placement-corpus-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:result.ok,totals:result.totals,failures}));if(!result.ok)process.exitCode=1;
