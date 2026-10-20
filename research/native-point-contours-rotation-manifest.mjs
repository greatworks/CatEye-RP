import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=path=>JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const entry=path=>({path,sha256:hash(path)});
const probe=read('research/native-point-contours-rotation-probes.json');
assert.equal(probe.caseCount,126);
assert.equal(probe.results.length,126);
assert.equal(probe.methodsReplayed.length,36);
assert.equal(hash(probe.original.path),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
for(const source of [...probe.sources,probe.probe])assert.equal(hash(source.path),source.sha256,`Source changed: ${source.path}`);
const fixtures=read('research/native-point-contours-rotation-fixtures.json');
assert.equal(fixtures.fixtureCount,64);
assert.equal(hash(fixtures.source.path),fixtures.source.sha256);
const frozenPrevious=[
 {path:'research/native-point-commit-evidence.md',sha256:'21899e6b8d7282607650ec935d4f5e19fdbbe7e2d282df6d774e37e2929f3f31'},
 {path:'research/native-point-commit-evidence.json',sha256:'cc4a11b191a1711b40ab4434619a28d52f8dcf578e09a17e3afa0d4e3a955eb1'},
 {path:'research/native-point-commit-evidence-probes.json',sha256:'a0b9bba9c73cde89e75b281671d2032650cad4a57c8f1a268c0c03c61b6d09ab'},
];
for(const source of frozenPrevious)assert.equal(hash(source.path),source.sha256,`Previous frozen evidence changed: ${source.path}`);
const evidenceFiles=fs.readdirSync('research').filter(name=>name.startsWith('native-point-contours-rotation-')&&name!=='native-point-contours-rotation-evidence.json').sort().map(name=>`research/${name}`);
const report={
 schema:1,kind:'native-point-contours rotation evidence manifest',generatedAt:new Date().toISOString(),status:'pass',
 original:{...probe.original,distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
 sources:[entry(probe.original.path),...probe.sources,entry('research/scripts/inspect-rp-serialization.ps1')],
 evidence:evidenceFiles.map(entry),frozenPrevious,
 verification:{caseCount:126,retainedMethods:36,numericFixtures:64,dllShaVerified:true,previousEvidenceUnchanged:true,kind:'bounded retained CIL instruction replay plus independent numeric composition',vendorDllExecuted:false,guiExecuted:false,productCodeChanged:false},
 contract:{units:'degrees; jbxa100688805 multiplies by pi/180',frameThreshold:{epsilon:1e-5,comparison:'abs(effective angle) < epsilon',below:'boxed unrotated j5u5, reported angle0, sin0/cos1',atOrAbove:'g5s7 preserving supplied effective angle'},worldMapping:'captured SizingRect corner interpolation before commit dispatch',commitDispatch:'hN4K uses reported frame angle, not modulo-reduced trig angle',wholeTurns:'rotated branch with exact identity trig',signedRemainder:'raw angle % 360; no positive-modulo conversion',normalization:'TN46 false uses expanded new owner frame; raw stored rotation is not changed by this chain'},
 limits:probe.limits,
};
fs.writeFileSync('research/native-point-contours-rotation-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'pass',cases:126,methods:36,fixtures:64,manifest:entry('research/native-point-contours-rotation-evidence.json'),report:entry('research/native-point-contours-rotation-evidence.md'),probe:entry('research/native-point-contours-rotation-probes.json'),fixtureFile:entry('research/native-point-contours-rotation-fixtures.json')}));
