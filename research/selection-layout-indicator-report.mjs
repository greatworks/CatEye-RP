import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const prefix = 'research/selection-layout-indicator-'
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const canonical = file => {
  const full = path.resolve(file)
  const relative = path.relative(process.cwd(), full)
  return !relative.startsWith('..') && !path.isAbsolute(relative) ? relative.replaceAll('\\', '/') : full.replaceAll('\\', '/')
}
const entry = file => ({ path: canonical(file), sha256: hash(file) })
const previous = read('research/selection-layout-render-evidence.json')
const frozen = [
  { path: 'research/selection-layout-render-evidence.json', sha256: '2a77d3c5f6852726c8a44790a7c1ba759a1afb7afcad2e150a5fbe08774e5bf2' },
  { path: 'research/selection-layout-render-manifest.json', sha256: 'ffa1224006d6edd41ff649531c3eaeec110bcf3e99d92e5279c185958144995a' },
]
const probes = [
  ['glyph-probes.json', 'retained-cil-record', 56],
  ['css-probes.json', 'retained-cil-record', 4],
  ['dom-detail-probes.json', 'retained-cil-record', 2],
  ['asset-probes.json', 'retained-cil-record', 16],
  ['browser-probes.json', 'controlled-edge-exact-js', 11],
]
const dependencies = new Map()
function bind(item) {
  if (hash(item.path) !== item.sha256) throw Error(`Source changed: ${item.path}`)
  const normalized = entry(item.path)
  if (dependencies.has(normalized.path) && dependencies.get(normalized.path).sha256 !== normalized.sha256) throw Error(`Conflicting source: ${normalized.path}`)
  dependencies.set(normalized.path, normalized)
}
for (const source of [...previous.sources, ...frozen]) bind(source)
const results = probes.map(([suffix, kind, expected]) => {
  const file = prefix + suffix, result = read(file)
  if (result.summary.total !== expected || result.summary.passed !== expected || result.summary.failed !== 0) throw Error(`Probe failed: ${file}`)
  for (const source of result.sources) bind(source)
  return { ...entry(file), kind, ...result.summary, method: result.method, sinks: result.sinks || result.boundaries || [] }
})
const newFiles = fs.readdirSync('research').filter(file => file.startsWith('selection-layout-indicator-'))
  .map(file => `research/${file}`).filter(file => !file.endsWith('-evidence.json') && !file.endsWith('-manifest.json'))
for (const file of newFiles) dependencies.set(canonical(file), entry(file))
for (const file of [
  'research/selection-layout-render-evidence.md',
  'research/selection-layout-render-manifest.json',
  'research/selection-layout-transaction-evidence.md',
  'research/selection-layout-transaction-evidence.json',
  'research/native-layers-format-extract.ps1',
]) dependencies.set(canonical(file), entry(file))
const sorted = [...dependencies.values()].sort((a, b) => a.path.localeCompare(b.path))
const sources = sorted.filter(item => previous.sources.some(source => canonical(source.path) === item.path))
const tests = sorted.filter(item => /selection-layout-indicator-(?:.*probe.*|browser\.mjs)$/.test(item.path) && !item.path.includes('-failure-'))
const evidence = sorted.filter(item => !sources.includes(item) && !tests.includes(item))
const findings = [
  { id: 'SLI-01', methodTokens: [100699787, 100701393, 100710703, 100710704, 100720517, 100720518], claim: 'Centered square b=rect.width. Check points (3u,b/2),(b/2-u,b-4u),(b-3u,3u), u=b/14, pen3u. Radio inset b/4, diameter b/2.', kind: 'retained-cil-record-replay', cases: 56 },
  { id: 'SLI-02', methodTokens: [100723527, 100723564, 100699650], claim: 'Source SVG marks carry stroke btn_check; CSS selected display inherits. Asset state0 or flags containing8 temporarily set selected during successful render.', kind: 'static-literal-plus-retained-cil-replay', cases: 16 },
  { id: 'SLI-03', methodTokens: [100722161, 100699215], claim: 'Ordinary owner flex, absolute label with SVG/text, sibling 0x0 opacity0 absolute input. Full SNLp argument capture and four CSS runs; bounded owner overflow visible, ancestor clipping unchanged.', kind: 'retained-cil-plus-controlled-dom', cases: 6 },
  { id: 'SLI-04', source: 'style.js', lines: [[991, 1645], [810, 812], [2503, 2532]], claim: 'Exact consumer uses base buttonSize for checkbox check width, supplied border paint for mark; controlled glyph d/rectangle remain unchanged. This does not include generated state assets or full P94 lifecycle.', kind: 'controlled-edge-exact-js', cases: 11 },
]
const report = {
  target: 'Axure RP 11.0.0.4150',
  scope: 'Selection indicator geometry, generated input/label CSS, mark class/asset selection, bounded SVG consumer',
  originalGuiCompared: false,
  vendorDllExecuted: false,
  extractionEvidenceId: previous.extractionEvidenceId,
  distributionSha256: previous.distributionSha256,
  summary: { total: 89, passed: 89, failed: 0, retainedCilRecord: 78, controlledEdgeExactJs: 11 },
  findings,
  reports: results,
  implementationStatus: {
    productEditedByThisTask: false,
    nativeInputReplaced: false,
    fullStateSvgAssetsImplemented: false,
    fullP94VisualLifecycleClosed: false,
    parentReportedIndependentFixes: ['selection-only native input flex:none', 'bounded selection owner overflow visible; ancestor clipping retained'],
    parentFixesVerifiedByTheseProbes: false,
  },
  boundaries: [
    'No original application GUI, vendor CLR execution, native rasterizer or full generated project.',
    'CIL uses declared graphics/pen/brush/font/input/context sinks; each probe records its own substitutions.',
    'Browser fixture independently builds glyph geometry; actual retained jQuery/style.js/base CSS execute.',
    'Full state assets/disabled theme pipeline, outer border/shadow SVG and full P94 state/action drawing remain unresolved.',
    'Owner overflow conclusion is limited to proven ordinary selection calls plus shipped base CSS; no ancestor clip change or universal cascade claim.',
    'Previous direct-child autofit-height NaN finding remains in the frozen prior report, not newly verified or fixed.',
    'Six failure artifacts are harness errors with hash-only intermediate script identities; failed script versions were not snapshotted.',
  ],
  historicalHarnessFailures: sorted.filter(item => item.path.includes('-failure-')),
  frozenPriorFiles: frozen,
  sources, evidence, tests, implementation: [], screenshots: [],
  report: entry(prefix + 'evidence.md'),
}
fs.writeFileSync(prefix + 'evidence.json', JSON.stringify(report, null, 2) + '\n')
const files = [...sorted, entry(prefix + 'evidence.json')].sort((a, b) => a.path.localeCompare(b.path))
const manifest = {
  target: report.target,
  scope: report.scope,
  summary: report.summary,
  verification: 'All listed current path bytes were SHA-256 checked. Historical failed-attempt embedded hashes are not current-source claims.',
  frozenPriorFiles: frozen,
  sources, evidence: [...evidence, entry(prefix + 'evidence.json')], tests, implementation: [], screenshots: [],
  files,
}
fs.writeFileSync(prefix + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n')
for (const item of files) if (hash(item.path) !== item.sha256) throw Error(`Final mismatch: ${item.path}`)
console.log(JSON.stringify({
  summary: report.summary, boundFiles: files.length,
  report: entry(prefix + 'evidence.md'),
  evidence: entry(prefix + 'evidence.json'),
  manifest: entry(prefix + 'manifest.json'),
  priorFilesUnchanged: true,
}, null, 2))
