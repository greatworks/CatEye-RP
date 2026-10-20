const {parentPort,workerData}=require('node:worker_threads');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
  try{
    const modulePath=path.join(__dirname,'../research/scripts/read-rp-semantics.mjs');
    const {inspectRpSemantics}=await import(pathToFileURL(modulePath).href);
    const semantics=inspectRpSemantics(workerData.file);
    // Complete library style provenance reaches 24.5 MB in the shipped form
    // sample. Keep a bounded IPC payload while retaining unresolved evidence.
    if(Buffer.byteLength(JSON.stringify(semantics))>32*1024*1024)throw new Error('Recovered RP data exceeds the 32 MiB import limit');
    parentPort.postMessage({ok:true,semantics});
  }catch(error){parentPort.postMessage({ok:false,error:String(error?.message??error)})}
})();
