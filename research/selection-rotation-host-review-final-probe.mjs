// Preserve the first 73-case script/report; re-run those same checks on final
// sources and independently verify the source-only angle-boundary regression.
import fs from 'node:fs';
let code=fs.readFileSync('research/selection-rotation-host-review-probe.mjs','utf8');
code=code.replace("from 'vite'",'from '+JSON.stringify(import.meta.resolve('vite')));
code=code.replace("'research/selection-rotation-host-review-probe.mjs'];",
 "'research/selection-rotation-host-review-probe.mjs','research/selection-rotation-host-review-final-probe.mjs','research/selection-rotation-model-angle-unit-probes.json'];")
 .replace("const drift=sources.filter",String.raw`
 const angleSource=read('research/selection-rotation-model-angle-unit-probes.json');
 const angleFixture={input:{...angleSource.input,freedom:1},observed:angleSource.actual};
 const anglePrepared=prepare(angleFixture),angleResult=model.planSelectionPointerRotate(anglePrepared.original,anglePrepared.state,angleFixture.input.requests[0]);
 assert.equal(angleResult.ok,true,angleResult.reason);
 const nativeAngle=angleSource.actual.frames[0].controller.events.find(e=>e.name==='angle.snap');
 assert.equal(angleResult.trace.rawAngle,nativeAngle.raw);
 assert.equal(angleResult.trace.angle,nativeAngle.answer);
 assert.notEqual(angleResult.trace.angle,15,'old reassociated degrees conversion chose the 15-degree magnet');
 for(const w of angleSource.actual.after)near(angleResult.state.targets.find(t=>t.id===w.id).ownerRect,w.rect);
 const angleBoundaryReview={passed:true,sourceRaw:nativeAngle.raw,sourceAngle:nativeAngle.answer,
  productRaw:angleResult.trace.rawAngle,productAngle:angleResult.trace.angle,
  fixedDefect:'K5wb multiplies its fixed 57.29577951308232 literal. Reassociating to *180/PI incorrectly snapped this source fixture to 15.'};
 const drift=sources.filter`)
 .replace('sources,sourceStableDuringProbe:', 'angleBoundaryReview,sources,sourceStableDuringProbe:')
 .replace("'research/selection-rotation-host-review-probes.json'", "'research/selection-rotation-host-review-final-probes.json'");
try{await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
catch(error){console.error(error.message);process.exitCode=1;}
