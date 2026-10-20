import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const prefix='research/runtime-rotate-motion-integration-review';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pin=path=>({path,sha256:sha(path)});
const final=read(prefix+'-final.json'), shadow=read(prefix+'-shadow-public.json'),fit=read(prefix+'-fit-source-valid.json');
assert(final.sourceStableDuringRun&&final.checks.failed===0);assert(shadow.checks.failed===0&&fit.checks.failed===0);
for(const source of final.sources)assert.equal(sha(source.path),source.sha256,'Product changed since final review: '+source.path);
const history=[
 ['-first.json','harness-error','Missing required adaptiveViews fixture field; not a product failure.'],
 ['-first-valid.json','product-failure','Queued error rejected the earlier successful task and stranded the failing task.'],
 ['-second.json','correction','Queue correction and negative-shadow orbit pass.'],
 ['-expanded.json','product-failure','Public x/y still read painted CSS instead of moved cache.'],
 ['-cache.json','correction','Public cache and snapshot transfer pass.'],
 ['-fit.json','product-failure','Parent fit destination-zero fallback and Resize event missing.'],
 ['-fit-correction.json','correction','Both parent-fit cases pass.'],
 ['-shadow-probe.json','harness-error','Truncated function slice caused SyntaxError.'],
 ['-shadow-valid.json','harness-error','Function slice was still truncated; filename valid was premature.'],
 ['-shadow-composed.json','harness-error','Missing getBoundingRectForRotate dependency.'],
 ['-shadow-source.json','exact-source-success','Nine composed source cases, prior to adding public getter.'],
 ['-fit-source.json','harness-error','Slice included the start of the next function.'],
].map(([suffix,kind,note])=>({...pin(prefix+suffix),kind,note}));
const findings=[
 {id:'RRM-REVIEW-01',severity:'P1',status:'corrected-and-independently-retested',title:'Queued-start error rejected the wrong task and stopped the preceding tween',failure:prefix+'-first-valid.json',observed:'Normal first task rejected; invalid second task pending; angle 67.5 and zero scheduled timers.',correction:'Isolate a released job start in its own transaction, attribute failure to its owner, terminate failed jobs, and preserve preceding completion.'},
 {id:'RRM-REVIEW-02',severity:'P2',status:'corrected-and-independently-retested',title:'Negative-shadow public coordinates read painted CSS instead of moved cache',failure:prefix+'-expanded.json',observed:'CSS was 120,60; original fresh getter reads cached 104,34 after the measured orbit.',correction:'Keep execution location separate from drawn location and use it in expression geometry; preserve dimensions without rotation/shadow.'},
 {id:'RRM-REVIEW-03',severity:'P2',status:'corrected-and-independently-retested',title:'Rotate parent fit ignored the target-angle zero-cache fallback',failure:prefix+'-fit.json',observed:'Authored 30 degrees to target 0 reduced parent to 200x100 instead of retaining 211.602540378x143.301270189.',correction:'Rotate-related parent bounds consume the same motion cache as original bounds; other fit behavior is not generalized.'},
 {id:'RRM-REVIEW-04',severity:'P2',status:'corrected-and-independently-retested',title:'Changed parent fit did not dispatch Resize',failure:prefix+'-fit.json',observed:'Parent resized to 150x150 but its Resize case was not invoked.',correction:'Preserve the prior fit dimensions and dispatch the parent Resize event only on an actual completion-time size change.'},
];
const limits=[
 'No original application GUI, managed DLL method, browser suite, full unit suite, build, or package was executed in this review.',
 'Original-source supplemental probes run retained function slices in NodeVM. CSS geometry, timers, model lookup and event/host sinks are explicitly declared; these are not original-page pixel checks.',
 'The portable product factory is type-stripped and run in a separate NodeVM with a deterministic clock. Its model/transaction assertions are independent software policy when no vendor transaction contract exists.',
 'Flat groupId siblings are a compatibility mapping, not native nested Layer identity or its split-duration quirks.',
 'Complete native timed Move/Resize/Rotate coalescing is not implemented; current product Move/Resize actions remain instantaneous.',
 'Fractional-angle getter uses an ideal normalized numeric angle; original computed CSS matrix decimal serialization may differ slightly.',
 'General fixed/percent panel layout, full containment/RDO geometry, event-level cached widget-expression lifetime, and vendor page/row races remain outside these bounded probes.',
 'Historical failed harness output files are preserved and excluded from successful source/product totals. Earlier evolving harness source revisions were not separately copied; their then-hashes remain in the outputs. Final runnable scripts are fully bound.',
];
const md=`# Runtime Rotate independent integration review\n\nThe final bounded comparison passes **${final.checks.passed}/${final.checks.total} product cases**, with **${shadow.checks.passed} exact-source shadow/getter cases** and **${fit.checks.passed} exact-source parent-fit cases**. These are separate from the frozen original 131-case investigation. No final blocker remains among the reproduced findings below. This is not a claim of complete Axure parity.\n\n## Findings and corrections\n\n${findings.map(f=>`- **${f.id}: ${f.title}.** ${f.observed} Corrected: ${f.correction} Failure retained in \`${f.failure}\`; correction independently retested in the final output.`).join('\n')}\n\n## What was checked\n\nThe product comparison covers independent task error attribution, rollback of group angles, state-effective shadow, multi-frame negative-shadow orbit, public cached coordinates, all 32 retained easing quarter samples and completion values, integer/full-turn versus fractional getter behavior, adaptive group-angle persistence, snapshot transfer, and parent-fit cache/event behavior. Read-only inspection also covered row generations, navigation/disposal invalidation, serialization dependencies, and queue release ordering. The parent/core focused tests cover additional row and completion sequencing; those are not counted as independently executed here.\n\nSource locations: \`action.js:1061–1256\` for ordinary/layer dispatch; \`move.js:255–335\` for circular motion; \`visibility.js:1347–1380\` for first moved-location cache; \`axQuery.std.js:1438–1575,1644–1647\` for bounds/location; \`doc.js:449–512\` for public geometry caching; \`repeater.js:2022–2078\` for parent fit and Resize. Adaptive reset clears four geometry maps (\`visibility.js:1416–1420\`), not the layer DOM data field.\n\nThe negative-shadow controlled case starts at (100,100), size 200x100, shadow (-10,-20), blur 6, local offset (30,-10), By90. It ends with drawn CSS (120,60), moved cache (104,34), and fresh public geometry [104,34,200,100]. Both one-step and multi-step original function compositions preserve that distinction. Parent fit directly executes the retained bounds and fit functions with numeric DOM sinks: authored30/cache0 leaves 211.602540378x143.301270189 unchanged; authored0/cache90 writes150x150 and raises one onResize.\n\n## Preserved failures\n\n${history.map(h=>`- \`${h.path}\`: **${h.kind}**. ${h.note}`).join('\n')}\n\nDo not count SyntaxError/missing-dependency harness attempts as native failures or product regressions. \`shadow-public.json\` and \`fit-source-valid.json\` are the valid supplemental source runs. The final product result is \`runtime-rotate-motion-integration-review-final.json\`.\n\n## Boundaries\n\n${limits.map(x=>'- '+x).join('\n')}\n\nExact product, original source, probe and output hashes are recorded in the adjacent JSON. Historical evidence and production files were not edited by this reviewer.\n`;
fs.writeFileSync(prefix+'.md',md);
const sourceManifest=read('research/runtime-rotate-motion-evidence.json');
const evidence=[...history.map(({path,sha256})=>({path,sha256})),pin(prefix+'-final.json'),pin(prefix+'-shadow-public.json'),pin(prefix+'-fit-source-valid.json'),pin('research/runtime-rotate-motion-evidence.json'),pin('research/runtime-rotate-motion-probes.json')];
const tests=[prefix+'-probe.mjs',prefix+'-shadow-probe.mjs',prefix+'-fit-source.mjs',prefix+'-freeze.mjs'].map(pin);
const report={schema:1,capturedAt:new Date().toISOString(),status:'bounded-review-passed',sources:sourceManifest.sources,implementation:final.sources,evidence,tests,reports:[pin(prefix+'.md')],checks:{product:final.checks,exactSourceShadow:shadow.checks,exactSourceFit:fit.checks},findings,history,limits};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:pin(prefix+'.json'),markdown:pin(prefix+'.md'),checks:report.checks}));
