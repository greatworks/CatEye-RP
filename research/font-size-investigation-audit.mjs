import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
const hashChecks = [];
function checkHash(file, expected, group) {
  const actual = sha(file); assert.equal(actual, expected, `${group}: ${file}`);
  hashChecks.push({ file, sha256: actual, group });
}
const previous = read('.build/rotation-source-audit.json');
for (const [file, digest] of Object.entries(previous.sourceFiles)) checkHash(file, digest, 'previous-release-source-unchanged');
assert.deepEqual(read('release/verification.json'), read('.build/pre-font-size-verification.json'));
const release = read('release/verification.json');
checkHash(release.archive, release.sha256, 'previous-release-archive-unchanged');
const probe = read('research/font-size-browser-probe.json');
assert.equal(probe.ok, true); assert.equal(probe.designUnchanged, true);
assert.deepEqual(probe.errors, []); assert.deepEqual(probe.network, []);
for (const source of [...probe.sources, probe.imported]) checkHash(source.file, source.sha256, 'packaged-probe-input');
assert.equal(probe.owners.length, 4);
assert.deepEqual(probe.stages.map(stage => stage.name), ['baseline-28', 'native-font-28', 'native-font-21', 'native-font-20', 'restored-28']);
let labels = 0;
const screenshotSizes = [];
for (const stage of probe.stages) {
  assert.equal(stage.pages.length, 2);
  for (const page of stage.pages) {
    assert.equal(page.labels.length, 2);
    checkHash(page.screenshot.file, page.screenshot.sha256, 'packaged-probe-screenshot');
    const png = fs.readFileSync(path.join(root, page.screenshot.file));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    screenshotSizes.push({ file: page.screenshot.file, pixelWidth: png.readUInt32BE(16), pixelHeight: png.readUInt32BE(20) });
    for (const label of page.labels) {
      labels++;
      assert.equal(label.widget.height, 27);
      assert.equal(label.widget.width, label.text === 'Problems' ? 95 : 54);
      const native = stage.name.startsWith('native-font');
      assert.deepEqual(label.platformFonts.map(font => font.postScriptName), [native ? 'OpenSans-Bold' : 'Noto-Sans-SC-Bold']);
      assert.equal(label.lineCount, stage.name === 'native-font-20' ? 1 : 2);
      assert.equal(label.css.fontSize, `${native ? stage.name.split('-').at(-1) : 28}px`);
    }
  }
}
assert.equal(labels, 20);
assert.deepEqual(probe.stages[0].pages.map(page => page.labels), probe.stages[4].pages.map(page => page.labels));
const format = read('research/font-size-format-manifest.json');
for (const source of [...format.sources, ...format.samples, ...format.files]) checkHash(source.file, source.sha256, 'native-format-evidence');
const formatChecks = read('research/font-size-format-check.json').checks;
assert.equal(formatChecks.length, 8); assert.ok(formatChecks.every(check => check.status === 'passed'));
const replayCounts = {};
for (const file of ['research/font-size-runtime-replay.json', 'research/font-size-runtime-autofit-replay.json']) {
  const evidence = read(file);
  for (const source of [...evidence.sources, ...(evidence.dependencies ?? [])]) checkHash(source.path ?? source.file, source.sha256, 'static-replay-input');
  replayCounts[file] = evidence.results.length;
}
const gui = read('research/font-size-gui-observation.json');
checkHash(gui.sampleCopy.path, gui.sampleCopy.sha256, 'native-gui-prepared-copy');
for (const key of ['originalSampleOpened', 'originalHtmlGenerated', 'originalScreenshotCompared', 'blankProjectSaved', 'unsavedProjectDiscarded', 'productChanged']) assert.equal(gui[key], false);
const runtime = read('research/font-size-runtime-evidence.json');
for (const source of [...runtime.sources, ...runtime.evidence, ...runtime.tests]) checkHash(source.path, source.sha256, 'native-runtime-evidence');
assert.ok(runtime.results.every(result => result.passed === result.total));
const rendering = read('research/font-size-rendering-review.json');
for (const source of rendering.sources) checkHash(source.file, source.sha256, 'product-rendering-review');
const fonts = read('research/open-sans-font-evidence.json');
for (const source of [...fonts.sources, ...fonts.faces]) checkHash(source.file, source.sha256, 'open-sans-metadata');
assert.equal(fonts.faces.length, 11); assert.equal(fonts.uniqueFaces.length, 10);
assert.ok(fonts.faces.every(face => face.fsType === 0));
const evidenceFiles = fs.readdirSync(path.join(root, 'research')).filter(name => /^(font-size-|open-sans-font-)/.test(name) && name !== 'font-size-investigation-audit.json').sort();
const audit = {
  verifiedAt: new Date().toISOString(), ok: true,
  scope: 'Read-only investigation and isolated packaged DOM experiments. No product fix or new release is claimed.',
  previousReleaseSourceFilesUnchanged: Object.keys(previous.sourceFiles).length,
  previousReleaseVerificationUnchanged: true,
  previousReleaseArchiveUnchanged: true,
  openSansFontFiles: fonts.faces.length, openSansUniqueFaces: fonts.uniqueFaces.length,
  packagedDomObservations: labels, packagedStages: 5, screenshotSizes,
  nativeFormatStaticAssertions: formatChecks.length, staticReplayRecords: replayCounts,
  originalSampleGuiTest: 'not completed',
  fontSizeOrNativeBoundsChanged: false,
  evidence: evidenceFiles.map(name => ({ file: `research/${name}`, sha256: sha(`research/${name}`) })),
  hashChecks,
  remaining: ['Original whole-project load may have additional style synchronization not covered by the traced branches.', 'Initial native TextPanel measurement is distinct from the saved owner rectangle; owner overflow and complete CSS geometry are not verified.', 'Packaged application does not embed Open Sans; loading the correct face alone does not remove the observed wrapping.', 'Native editor screenshot and file-dialog focus failures prevent original generated-output comparison.']
};
fs.writeFileSync(path.join(root, 'research/font-size-investigation-audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify({ok:audit.ok,sourceFilesUnchanged:audit.previousReleaseSourceFilesUnchanged,hashChecks:hashChecks.length,packagedDomObservations:labels,formatStaticAssertions:formatChecks.length,staticReplayRecords:replayCounts,evidenceFiles:evidenceFiles.length}));
