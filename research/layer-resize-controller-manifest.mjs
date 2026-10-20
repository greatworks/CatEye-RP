import fs from 'node:fs';
import { createHash } from 'node:crypto';

const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const ref = file => ({ file, sha256: sha(file) });
const dll = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const expectedDllSha = 'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
if (sha(dll) !== expectedDllSha) throw new Error('Pinned assembly changed');
const probesFile = 'research/layer-resize-controller-probes.json';
const probes = read(probesFile);
if (probes.summary.total !== 142 || probes.summary.failed !== 0) throw new Error('Unexpected controller probe results');
for (const source of probes.sources) {
  if (sha(source.file) !== source.sha256) throw new Error(`Probe source drift: ${source.file}`);
}
const methodRows = [
  ['TbN1..ctor',100686207,'ordered member tree and contacting-edge subset'],
  ['TbN1.EbNW',100686212,'stored contact mask'],
  ['KJm7.EJdP',100695456,'containing Layer after contained-widget traversal'],
  ['KJm7.dJdf',100695472,'outer contained widget'],
  ['KJm7.LIsW',100695469,'IDiagramObjectContainer cast to containing widget'],
  ['Layer.Add',100701046,'assign containing Layer reference'],
  ['Layer.Remove',100701048,'clear containing Layer reference'],
  ['Rect.Y5um',100722156,'strict four-edge contact mask'],
  ['rbx2.qbxO',100688812,'strict absolute-difference comparison'],
  ['kSct..ctor',100707157,'old unrounded frame, rotated AABB, angle snapshots'],
  ['kSct.dScI',100707162,'relative old frame'],
  ['kSct.KSc3',100707163,'relative old AABB'],
  ['obNM.cbN7',100686239,'preorder recursive snapshot object list'],
  ['obNM.jbNm',100686249,'recursive resize controller and two passes'],
  ['obNM.ubNp',100686251,'predict contacting-member union'],
  ['obNM.kbNq',100686252,'effective pins and capability/modifier conversion'],
  ['obNM.JbNd',100686253,'fit gates'],
  ['obNM.VbN8',100686260,'ordinary/Connector commit gate'],
  ['KJm7.YJ0S',100695371,'Size then Location; false allViews'],
  ['KJm7.Locked',100695483,'root/current-Layer lock context'],
  ['Layer.IsCurrentLayer',100701033,'editing context lock boundary'],
  ['DynamicPanel.AllPinnedObjects',100700551,'all panel diagrams then root/pin filter'],
  ['KJm7.IJdh',100695459,'effective horizontal/vertical pin eligibility'],
  ['GbXY.pbXw',100689840,'ordered difference construction'],
  ['Difference predicate',100689849,'negate membership'],
  ['Bbib.Sbhg',100689190,'Contains or enumerated equality'],
  ['obNM.sbN0',100686250,'temporary scaling state scope'],
  ['TrapScaling closure',100686280,'restore saved scaling state'],
  ['obNM.CbNX',100686248,'entry snapshot/selection context; only partially replayed'],
  ['obNM.EbNf',100686262,'editor finalization hook; not complete history proof'],
  ['obNM.mbNT',100686263,'editor finalization hook; not complete history proof'],
];
const currentCilFiles = fs.readdirSync('research')
  .filter(n => /^layer-resize-controller-.*-cil\.json$/.test(n))
  .map(n => `research/${n}`);
const prepFiles = fs.readdirSync('.build/next-layer-authoring')
  .filter(n => /-cil\.json$/.test(n))
  .map(n => `.build/next-layer-authoring/${n}`);
const methodIndex = new Map();
for (const file of [...prepFiles, ...currentCilFiles]) {
  for (const type of read(file).Types ?? []) for (const method of type.Methods ?? []) {
    if (!methodIndex.has(method.Token) || file.startsWith('research/')) methodIndex.set(method.Token, {
      file, sha256: sha(file), declaringType: type.Name, nativeName: method.Name,
      token: method.Token, ilBytes: method.ILBytes,
    });
  }
}
const methods = methodRows.map(([label, token, proves]) => {
  const source = methodIndex.get(token);
  if (!source) throw new Error(`Missing evidence method ${token}`);
  return { label, proves, ...source };
});
const sourceFiles = [...new Set([
  ...probes.sources.map(s => s.file),
  ...methods.map(m => m.file),
  '.build/next-layer-authoring/manifest.json',
  '.build/next-layer-authoring/evidence.json',
  '.build/next-layer-authoring/pin-input-probe.json',
  '.build/next-layer-authoring/metadata.json',
  'research/native-layers-format-extract.ps1',
  'research/native-point-commit-format-evidence.md',
  'research/native-point-commit-format-manifest.json',
  'research/layer-resize-controller-metadata.json',
  'research/layer-resize-controller-methodspecs.json',
])];
const missing = sourceFiles.filter(f => !fs.existsSync(f));
if (missing.length) throw new Error(`Missing retained sources: ${missing.join(', ')}`);
const evidence = {
  schemaVersion: 1,
  stage: 'layer-resize-controller',
  source: { ...ref(dll), version: '11.0.0.4150' },
  originalDllExecuted: false,
  originalGuiCompared: false,
  productModified: false,
  correctionsToRetainedPreparation: [
    'ebNe is contacting-edge subset, not selected-member subset',
    'EJdP is containing Layer via outer contained widget, not arbitrary parent',
    'UScH is UnroundedRect and zSc1 is its rotated AABB',
    'Lock behavior depends on root/current Layer context; own locked is not an unconditional descendant veto',
  ],
  contract: {
    geometrySources: ['immutable old unrounded frame', 'immutable old rotated AABB', 'old angle'],
    contact: { comparator: 'abs(a-b) < epsilon', epsilon: 0.0001, edges: { left:1, top:2, right:4, bottom:8 } },
    passes: [
      { members:'contacting subset in original order', oldParent:'old origin-zero Layer frame', newParent:'requested origin-zero Layer frame' },
      { members:'all members minus contacting subset, original order', oldParent:'old origin-zero Layer frame', newParent:'predicted contacting-members candidate frame' },
    ],
    layerLocation: 'relative snapshots during solving, optional new origin added once after solver',
    panelChildren: 'all-state root objects/Layers with effective H or V pins; no optional Layer origin; movement freedom All',
    fitEpsilon: 0.00001,
    ordinaryWrites: { order:['Size','Location'], allViews:false, notify:true },
    sharedFitFields: ['VectorShape AutoFitWidth','VectorShape AutoFitHeight','ImageBox FitToImage'],
    panelFit: 'controller boolean proved; complete typed-store/notification cascade not replayed',
  },
  probes: { ...ref(probesFile), ...probes.summary, description: probes.description, sinks: probes.sinks },
  methods,
  implementationScope: [
    'Layer member trees with ordinary VectorShape/ImageBox leaves, subject to independent solver and model constraints',
    'Current-view paired geometry with immutable planning snapshot, ordering, lock context and applicable shared fit updates',
    'No generic outer-size replacement for composite controls',
  ],
  unresolved: [
    'Numerical INw2/mNwa/ubNp results are injected here; separate numeric evidence must be integrated before a product planner',
    'Complete native mouse gesture, cancellation, undo and notification/connection transaction semantics',
    'Panel FitToContent downstream cascade and full all-state contained-object execution',
    'Connector dedicated VbN8 branch and virtual geometry/content setters of Table/Menu/Tree/Repeater',
    'Original GUI and real native application execution were not performed',
  ],
  sources: sourceFiles.map(ref),
};
fs.writeFileSync('research/layer-resize-controller-evidence.json', JSON.stringify(evidence,null,2)+'\n');
const files = fs.readdirSync('research')
  .filter(n=>n.startsWith('layer-resize-controller-') && n!=='layer-resize-controller-manifest.json')
  .sort().map(n=>`research/${n}`);
const manifest = {
  schemaVersion:1, stage:'layer-resize-controller', source:evidence.source,
  originalDllExecuted:false, originalGuiCompared:false,
  summary:evidence.probes, sources:evidence.sources, files:files.map(ref),
};
fs.writeFileSync('research/layer-resize-controller-manifest.json', JSON.stringify(manifest,null,2)+'\n');
for(const record of [...manifest.sources,...manifest.files]) {
  if(sha(record.file)!==record.sha256)throw new Error(`Hash mismatch ${record.file}`);
}
console.log(JSON.stringify({
  probes:probes.summary,methods:methods.length,sources:manifest.sources.length,files:manifest.files.length,
  evidence:ref('research/layer-resize-controller-evidence.json'),
  report:ref('research/layer-resize-controller-evidence.md'),
  manifest:ref('research/layer-resize-controller-manifest.json'),
}));
