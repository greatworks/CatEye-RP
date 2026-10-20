// Bind this read-only design to the current frozen product and new research.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const output = 'research/runtime-transform-core-plan.json';
assert(!fs.existsSync(output), `Refusing to overwrite ${output}`);
const sha = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const pin = path => ({ path, sha256: sha(path), bytes: fs.statSync(path).size });
const redPath = 'research/runtime-transform-core-red.json';
const red = JSON.parse(fs.readFileSync(redPath, 'utf8'));
const files = [
  'src/runtime/export-runtime.ts', 'src/runtime/expressions.ts', 'src/runtime/engine.ts',
  'src/model/types.ts', 'src/model/document.ts', 'src/model/components.ts',
  'src/components/Preview.tsx', 'src/components/Inspector.tsx',
  'src/runtime/export.ts', 'src/runtime/frame-player.ts', 'src/runtime/inline-frame-runtime.ts',
  'tests/runtime-rotate.test.ts', 'tests/wait-scheduling.test.ts',
  'tests/runtime-adaptive-transition.test.ts', 'tests/runtime-rotate-snapshot-projection.test.ts',
];
const sources = files.map(pin);
const unchangedSinceProbe = red.sources.every(item => sha(item.path) === item.sha256);
assert(unchangedSinceProbe, 'Product changed after capability probe; do not bind an unstated source');
const evidence = [
  'research/runtime-transform-motion-evidence.md', 'research/runtime-transform-motion-evidence.json',
  'research/runtime-transform-motion-final-probes.json',
  'research/runtime-transform-format-evidence.md', 'research/runtime-transform-format-evidence.json',
  'research/runtime-transform-format-static-probes.json', 'research/runtime-transform-format-summary.json',
].map(pin);
const result = {
  schema: 1, capturedAt: new Date().toISOString(), status: 'read-only-design-awaiting-shared-contract',
  scope: { productEdited: false, testsEdited: false, oldEvidenceEdited: false, originalCodeExecuted: false, browserStarted: false, buildRun: false, packageRun: false, originalAxureGuiCompared: false },
  sources, unchangedSinceProbe, evidence,
  newArtifacts: ['research/runtime-transform-core-probe.mjs', redPath, 'research/runtime-transform-core-plan.md', 'research/runtime-transform-core-plan-audit.mjs'].map(pin),
  probe: {
    executionPaths: ['current source function with type erasure', 'bare factory toString in fresh NodeVM'],
    compatibilityControls: { passed: 8, total: 8 },
    validNewCapabilityChecks: { missing: 8, total: 8 },
    supersededOrUnprovenExpectations: {
      total: 2,
      selector: 'motion expression API must preserve numeric zero versus string zero',
      reason: 'Direct helper primitive distinction does not prove native StringLiteral output type. Original expr/STO pipeline investigation supersedes the initial mandatory primitive-output expectation.',
    },
    harnessErrors: 0,
    caveat: 'New structured Move/Resize inputs are pre-agreement proposed strings and bypass the released parser. They are capability baselines, not regressions in valid old documents or the final MotionExpression schema.',
  },
  recommendedSchema: {
    actionMove: '{targets:MoveInfo[]}', actionResize: '{targets:ResizeInfo[]}',
    expression: '{text:string,bindings?:Record<string,{kind:"widget",targetId:string}>}',
    moveModes: ['location','delta','drag','dragX','dragY','locationBeforeDrag','withThis','sizeDeltaX','sizeDeltaY'],
    trajectories: ['straight','arcClockwise','arcAntiClockwise'],
    resizeByMode: false,
    targetKinds: { move: ['widget','this','widgetsBelow','widgetsRight'], resize: ['widget','this','thisItem'] },
    preserveOldRotateSchema: true,
    boundary: 'Structured and/or comparisons with direction and expression operands, source-ordered solver; exact field names and full evaluator pending shared agreement.',
  },
  compatibility: [
    'Absent new carrier keeps legacy numeric absolute Move/Resize and inert old duration.',
    'Resize legacy x/y means width/height; do not accidentally rename old persisted fields.',
    'No native By mode for Set Size; expressions express relative size.',
    'No native Layer claim for current flat groupId.',
    'Current bare createOfflineRuntime.toString must remain self-contained.',
    'Runtime caches may live in optional motionState; pending jobs are not a saved Document or resumable snapshot contract.',
  ],
  implementationBatches: [
    { order: 1, name: 'schema-and-planner-foundation', dependsOn: ['complete expr/STO input contract'], includes: ['strict ordered carriers','copy/remap','event identity','pure per-event planner','global channel reservations','legacy controls'] },
    { order: 2, name: 'ordinary-consumers-and-combinations', dependsOn: ['final actual DOM motion report'], includes: ['Move/Resize/Rotate leader paths','shortest slices/easing','actual caches','completion sequencing','rollback','zero/type guards'] },
    { order: 3, name: 'drag-special-targets-hosts', dependsOn: ['final drag and binding/boundary report'], includes: ['nine modes','special targets','Window/scroll/realm','row/frame identity','cleanup'] },
    { order: 4, name: 'model-and-lifecycle-closure', dependsOn: ['explicit Layer/pinning decisions'], includes: ['group/Layer boundary','DOM stop','snapshot continuity','native importer event atomicity','integration acceptance'] },
  ],
  explicitDecisionsStillRequired: [
    'Exact full StringLiteral/STO conversion and arithmetic behavior; primitive-output mode is not approved by these probes.',
    'Boundary JSON syntax and validated local binding scopes.',
    'Product bounded-error treatment for actual native nonprogress/TypeError mixed-instant sequences.',
    'Native Layer, fixed/percent panel representation beyond present flat groups.',
    'Precise Move/Resize DOM lifetime on stop/replacement/adaptive changes.',
  ],
  recentAgentUpdatesNotCountedAsIndependentEvidence: [
    'Sibling reports 88 actual Edge cases including unequal-duration final size, early successor starts, and two nonprogress paths plus one TypeError; await final bound report.',
    'Parent direct drag probe reports stale internal deltas after Drop and missing pre-drag source yielding nonfinite deltas; await final report.',
    'Format peer corrected boundary corpus to ten DragX AND non-strict cases plus two Move-To top > 0 cases; complete pipeline report pending.',
    'Format peer states all 126 Move/Size inputs are StringLiteral; primitive inner substitutions ultimately produce outer strings.',
  ],
};
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, sha256: sha(output), unchangedSinceProbe, sources: sources.length, compatibility: result.probe.compatibilityControls, validNewGaps: result.probe.validNewCapabilityChecks, unprovenExpectations: 2 }));
