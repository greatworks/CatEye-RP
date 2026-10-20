import fs from 'node:fs';
import crypto from 'node:crypto';
const entry=path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
const original='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/';
const evidence=[
  'research/line-style-runtime-evidence.md','research/scripts/probe-line-style-runtime.mjs','research/line-style-runtime-probes.json',
  'research/scripts/probe-line-style-arrows.mjs','research/line-style-arrow-probes.json','research/scripts/line-style-runtime-manifest.mjs','research/scripts/probe-line-style-arrow-paint.mjs','research/line-style-arrow-paint-probes.json',
  'research/line-style-arrow-base-cil.json','research/line-style-arrow-geometry-cil.json','research/line-style-arrow-point-cil.json',
  'research/line-style-arrow-circle-cil.json','research/line-style-arrow-parity-cil.json','research/line-style-arrow-stroke-cil.json','research/line-style-arrow-stroke-cap-cil.json',
  'research/line-style-platform-functions-cil.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
  'research/line-style-svg-evidence.md','research/line-style-svg-replay.mjs','research/line-style-svg-replay.json','research/line-style-svg-pen-base-cil.json',
  'research/line-style-svg-pen-cil.json','research/line-style-svg-writer-cil.json','research/line-style-json-pattern-cil.json','research/line-style-pen-cil.json','research/line-style-dash-rva.json',
];
const implementation=['src/model/line-style.ts','src/model/gradient.ts','src/model/shadow.ts','src/model/types.ts','src/model/document.ts','src/model/adaptive.ts','src/model/vector.ts','src/components/WidgetView.tsx','src/components/Preview.tsx','src/runtime/export-runtime.ts','src/runtime/export.ts','src/runtime/frame-player.ts','scripts/frame-player-build.ts','public/frame-player.html'];
const tests=['tests/line-style-runtime.test.ts','tests/fixtures/line-styles.ts','tests/e2e/line-style-runtime.spec.ts','tests/gradient-border-runtime.test.ts','tests/gradient-runtime.test.ts','tests/export.test.ts','tests/e2e/gradient-border-runtime.spec.ts','tests/e2e/gradient-runtime.spec.ts'];
const screenshots=['artifacts/line-runtime-preview.png','artifacts/line-runtime-gallery-preview.png','artifacts/line-runtime-offline.png','artifacts/line-runtime-gallery-offline.png','artifacts/line-runtime-arrow-paint-before.png'];
const probes=JSON.parse(fs.readFileSync('research/line-style-runtime-probes.json','utf8'));
const arrow=JSON.parse(fs.readFileSync('research/line-style-arrow-probes.json','utf8'));
const manifest={
  schemaVersion:1,generatedAt:new Date().toISOString(),stage:'line patterns, visibility and endpoints',
  evidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
  packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
  sources:[entry(original+'AxureRP11.dll'),...['style.js','math.js'].map(file=>entry(original+'DefaultSettings/Prototype_Files/resources/scripts/axure/'+file))],
  evidence:evidence.map(entry),implementation:implementation.map(entry),tests:tests.map(entry),screenshots:screenshots.map(entry),
  verification:{
    originalRuntime:{kind:'exact retained source slices in NodeVM with explicitly mocked DOM/CSS sinks',total:probes.results.length,passed:probes.results.filter(r=>r.pass).length},
    arrowArithmetic:{kind:'bounded self-written interpreter of retained static CIL, no assembly execution',dimensions:arrow.results.length,resolvedGeometryLists:arrow.results.filter(r=>r.geometry).length,nonemptyGeometryLists:arrow.results.filter(r=>r.geometry?.length).length,polygonCoordinateComparisons:104,unresolvedOffsetSolverCases:arrow.results.filter(r=>r.unresolved).length},
    unit:{newTestsPassed:24,modes:['module','serialized'],existingFocusedTestsPassed:40},
    browser:{kind:'actual Edge headless DOM, pointer input, screenshots and exact sampled pixels',newTestsPassed:2,modes:['preview','actual exported offline file'],existingGradientBorderTestsPassed:2,finalCombinedFillAndLineTestsPassed:4},
    arrowPaintCoordinates:{nativeCilPlacementCasesPassed:24,baselinePixelFailure:'Right triangle expected red, observed blue before inverse paint correction',fixedBrowserCasesPassed:2,radialCompositionUnitCasesPassed:2},
    typecheck:'passed after final product edit',
    recordedTransientFailure:'One earlier unchanged gradient-runtime offline-parameter author-canvas screenshot sampled red207 instead of208; exact original assertion rerun passed in final4/4. Not hidden by tolerance changes.',
    scope:'No full suite/build/package/native GUI execution by this stage worker. Parent owns final production/package acceptance.'
  },
  boundaries:[
    'Native open-curve offset solver pixels are not replicated; retained crow center curves and flat caps are rendered with browser SVG strokes.',
    'Cubic Length uses a bounded128-subdivision estimate; original numerical solver equivalence is unknown. Native distance/Length parameter and sequential cut quirks are preserved.',
    'Each open compound contour is independently supported; full original-generator compound admission has not been proven.',
    'Image CSS dashed/dotted literal mapping is inferred within proven same-label groups, not decrypted native string evidence.',
    'Ordinary forms/containers and independent asymmetric side widths are bounded renderer support, not blanket original generator parity.',
    'Dynamic width/end regeneration, width0 no paint and None endpoint suppression intentionally avoid stale-original-SVG state residues.',
    'Preview screenshots are current scrolled viewports, not a native GUI screenshot or complete stitched gallery.'
  ]
};
fs.writeFileSync('research/line-style-runtime-evidence.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sources:manifest.sources.length,evidence:manifest.evidence.length,implementation:manifest.implementation.length,tests:manifest.tests.length,screenshots:manifest.screenshots.length,verification:manifest.verification}));
