import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin = file => ({file,sha256:sha(file)});
const prefix='research/native-point-editing-format-';
const inventory=read(prefix+'inventory.json'), imported=read(prefix+'import.json');
for(const p of [...inventory.samples,...imported.sources,imported.sample,imported.fixture])assert.equal(sha(p.file),p.sha256,p.file);
assert.equal(imported.widgets.length,2);
assert.ok(imported.widgets.every(w=>w.sourceShape===300&&w.widget.type==='path'&&w.widget.style.cornerVisibility===undefined));
const sources=[
  'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll',
  'research/samples/metadata-Shape.json','research/rp-vector-path-vector-cil.json',
  'research/rp-vector-path-shape-predicate-cil.json','research/rp-vector-path-vector-drawing-cil.json',
  'research/rp-vector-path-world-scale-cil.json','research/rp-vector-path-widget-transform-cil.json',
  'research/rp-vector-path-point-transform-cil.json','research/rp-vector-path-scale-cil.json',
  'research/rp-vector-path-evidence.md','research/adaptive-all-views-effects-evidence.md',
  'research/adaptive-all-views-effects-shape-cil.json','research/native-corners-format-census.json',
  'research/adaptive-behavior-format-census.json',prefix+'shape-cil.json',
  'research/native-point-editing-evidence-shape-cil.json',
  prefix+'inventory.mjs',prefix+'inventory.json',prefix+'import.mjs',prefix+'import.json',
  prefix+'custom-rectangles.rea.json',prefix+'freeze.mjs'];
const evidence={schema:'native-point-editing-format-v1',capturedAt:new Date().toISOString(),
  target:{version:'11.0.0.4150',sha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7'},
  method:'Read-only retained CIL and original stored records; original DLL/GUI not executed. Historical census reused, two original files reread for four exact source witnesses, complete UI file freshly imported and saved/read back.',
  claims:[
    {status:'direct-static',claim:'Shape identity is independent of saved path family. DSO4 is Shape==300; LN4g returns cN89 directly for300 and regenerates all other shapes before returning it.',
      anchors:[{method:'DSO4',token:100708406,il:'7-15'},{method:'LN4g',token:100702676,il:'7-43'}]},
    {status:'direct-static',claim:'Shared Shape and ControlPoints are object fields; the shape serializer calls LN4g(0) before writing the control point array. A saved noncustom path is a generated snapshot at save time.',
      anchors:[{method:'get_Shape',token:100702789,field:'SN8X',il:'7-13'},
        {method:'DN4W',token:100702683,field:'cN89',il:'7-42'},
        {method:'NIwY',token:100702762,il:'401-465'}]},
    {status:'direct-static',claim:'For parameter shapes jN4k reads current sizing rectangle, effective radius, border parameters, smart-point data and corner mask, then calls the shape factory. Its result is not determined by stored ControlPoints alone.',
      anchors:[{method:'jN4k',token:100702679,il:'7-97',factoryToken:100722530}]},
    {status:'direct-static',claim:'TN46 itself is a geometry update, not a Shape300 setter: hN4K produces bounds/normalized points, xJ0B/uJ0j write location/size, and DN4W stores points.',
      anchors:[{method:'TN46',token:100702684,il:'7-56'},{method:'xJ0B',token:100695349},{method:'uJ0j',token:100695365}]},
    {status:'direct-static',claim:'ChangeShapeTo qNnT can store supplied contours, call set_Shape and invalidate dependent geometry; set_Shape changes shared SN8X and may change type-dependent defaults/caches. It is separate from ordinary adaptive PName editing.',
      anchors:[{method:'qNnT',token:100702809,il:'7-146'},{method:'set_Shape',token:100702790,il:'388-551'}]},
    {status:'direct-record',claim:'Two actual UI records are Shape300 despite exact four-anchor rectangular geometry. Current complete native import preserves both as type path without cornerVisibility.',sourceIds:imported.widgets.map(w=>w.sourceId)},
    {status:'direct-record',claim:'Two actual Form Shape300 custom11-anchor paths retain local determined+overridden P71=2. Radius presence is not parameter-shape identity and does not prove regeneration is active.',sourceIds:inventory.localCornerCustom.map(w=>w.sourceId)},
    {status:'direct-static-and-record',claim:'Shape/path identity and normalized points are shared; placement, size and visual properties remain separate provider data. Shape300 normalized geometry still scales through the current sizing/world transform. Thirteen Flow Shape300 records have three adaptive style references each; those observed maps are empty style records, not a nonempty custom path override witness.',
      anchors:[{method:'WNn5',token:100702749},{method:'eJmT',token:100695285},{method:'A5ph',token:100720533},{method:'D5pZ',token:100720547}]},
  ],
  counts:inventory.counts,
  sourceWitnesses:inventory.rawWitnesses.map(w=>({sourceId:w.sourceId,packageId:w.packageId,sourcePartSha256:w.sourcePartSha256,sample:w.sample,shape:w.shape,size:w.size,witnessKind:w.witnessKind})),
  importVerification:{file:prefix+'import.json',sha256:sha(prefix+'import.json'),widgets:imported.widgets.map(w=>({sourceId:w.sourceId,id:w.widget.id,type:w.widget.type})),fixture:imported.fixture,saveReadback:true},
  modelContract:[
    'Keep parameter-vs-custom identity separate from a rectangle-family recognizer. Once a genuine custom edit commits, returning coordinates to a rectangle must not by itself reactivate parameter geometry.',
    'Do not delete retained radius/mask, state maps or inactive adaptive declarations merely because geometry becomes custom. Suppress parameter reconstruction by identity; retain unrelated paint and shared content.',
    'A committed path/identity change is shared content. Per-view location/size and visual overrides must retain their existing scope; resolving the visible view must not flatten parent or inactive declarations.',
    'The exact native entry/exit gesture timing, no-op conversion and undo transaction are owned by the companion point-mode investigation. This format report alone does not authorize conversion merely on entering edit mode.',
  ],
  limits:[
    'No sample contains before/after editing history. The two rectangular custom shapes prove final representation, not the user gesture that created it.',
    'No claim that all node edits use TN46, that every conversion clears or preserves every style-provider slot, or that custom geometry is automatically recognized back into a parameter shape.',
    'The helper family check was invoked without native Shape gating solely to demonstrate geometric equivalence. The production reader correctly keeps the original Shape300 gate.',
    'Historical adaptiveStyleCount6 was a flat alternating GUID/ref array length: actual maps are three, not six views. Frozen old census is not rewritten.',
    'The first research import oracle omitted the explicit closing L emitted by the existing converter; the oracle was corrected to M/L/L/L/L/Z without changing the original file or product.',
    'No production files, old tests or frozen reports were modified, and no full suite/browser/build/package/original application run is claimed.',
  ],
  sources:sources.map(pin),samples:inventory.samples.map(({file,sha256})=>({file,sha256})),
};
assert.equal(sha(sources[0]),evidence.target.sha256);
fs.writeFileSync(prefix+'evidence.json',JSON.stringify(evidence,null,2)+'\n');
fs.writeFileSync(prefix+'evidence.md',`# Native point editing: format and identity

Target Axure RP11.0.0.4150; DLL SHA-256 \`${evidence.target.sha256}\`. This is read-only static CIL and stored-file evidence. No original DLL/application execution, original GUI comparison, or product modification occurred.

## A rectangle-shaped path is not Rectangle identity

\`Shape\` and \`ControlPoints\` are distinct common-object fields. The meaningful native test is \`cSqL.DSO4\` (100708406, IL7–15), which checks Shape300. \`VectorShape.LN4g\` (100702676, IL7–43) returns the stored/cache contour list for300; other shapes call \`jN4k\`, replacing that list through \`DN4W\` before returning. This is direct executable control-flow evidence, not a guess from the enum name Vector.

\`jN4k\` (100702679) reads the current sizing rectangle and effective radius/border/corner parameters before calling \`L5vW.w5Qk\`. \`NIwY\` (100702762, IL401–465) calls LN4g(0) before writing ControlPoints. Thus a Shape0 saved outline is a snapshot of parameter generation at save time; Shape300 treats the stored normalized points as its geometry. Both still use the current sizing/world transform when painted. Shared point data does not mean fixed pixel dimensions across adaptive views.

Two real UI-library records demonstrate the distinction even when all points are rectangular:

| Source ID | Package ID | Shape | Size | Normalized anchors |
|---|---|---:|---|---|
| 04417a8fd0fe4f8e8734460a02a0b2b2 | 6881ba8b98974feb8ba4bf4d89c9b422 | 300 |350×80| (1,0),(1,1),(0,1),(0,0) |
| 25a13179ceeb4c69a7ac383ce58dd7f0 | 5c6f3b90e33443189fa470be22096bbc | 300 |350×80| same |

Both have double-NaN handles and all four outgoing segments enabled. Their default cache supplies P71=0 and P81=15. The standalone geometric helper accepts both as rectangles, while the native importer correctly keeps **type path**, without cornerVisibility. Their UI file SHA-256 is \`cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b\`; exact part hashes and raw records are in [the inventory](native-point-editing-format-inventory.json). No editing history was recovered, so these records do not identify the original author gesture.

## Geometry writes and identity writes are separate

\`DN4W\` (100702683) clears dependent caches and stores contour data in cN89. \`TN46\` (100702684) normalizes supplied geometry through hN4K, writes its computed location/size through xJ0B/uJ0j, then calls DN4W. **TN46 does not set Shape.**

\`qNnT\` / ChangeShapeTo (100702809) is a separate operation: its supplied-shape branch can store contours, invokes set_Shape and invalidates geometry. \`set_Shape\` (100702790) stores SN8X at IL388 and also has type-default/cache/notification work; it is not an ordinary adaptive style-property write. The exact point-mode entry/gesture/undo path is the companion investigator's scope. This report does not equate entry into edit mode, a no-op drag and a committed point change.

Two Form-library Shape300 records, \`b607dd0c4ccc42e2b83eeb7cda35167f\` and \`b365f0e6db904531bfec85ad07a1d17e\`, retain local OD **P71=2** despite their11-anchor custom tooltip outlines. This is positive stored evidence that a radius field can survive on custom geometry. It is not authority to regenerate the path from that field or to claim every native conversion deletes it. The original Form hash is \`1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179\`.

## Adaptive and persistence boundary

The frozen11-file census contains2,805 VectorShape records:1,388 Shape0 and1,127 Shape300. The current narrow reread verifies four records in the two original files; it does not rerun or relabel all historical semantic admission. Thirteen Flow Shape300 owners contain three adaptive style references each. The old semantic count6 describes the alternating GUID/reference array length, not six views. The observed referenced style lists are empty, so they do not prove nonempty per-view point editing.

The shared Shape/ControlPoints fields remain outside AdaptiveStyles. Normalized custom points still scale through WNn5→eJmT→A5ph/D5pZ, while location/size/style use their provider contracts. A product should keep custom identity shared, preserve per-view geometry and visual declarations, and avoid flattening inactive local maps when editing the visible view. Retained radius/mask/state data must not be mistaken for an instruction to turn a custom path back into a rectangle.

The current complete UI-file reader→importer→save/readback succeeds and preserves both witnesses as path. [Import verification and complete widgets](native-point-editing-format-import.json) bind current reader/model hashes. [The two-page fixture](native-point-editing-format-custom-rectangles.rea.json) passes parseDocument and is explicitly a **research extraction**; widget IDs, text, style, geometry and commands are unchanged. The first research assertion forgot the converter's explicit closing L; only that oracle was corrected.

## Proposed implementation guard

Preserve a distinction between parameter identity and geometric qualification. Conversion on a genuine committed edit should be one-way unless a separate explicit shape-conversion command is invoked; a later rectangular outline is insufficient. Undo must restore identity and the prior path, alongside the normal document transaction. Keep stored corner/effect declarations but stop parameter reconstruction once custom. Use the companion point-editing command evidence to choose the exact entry/no-op/commit boundary, rather than deriving it from file layout.

Original GUI gestures, native font/render pixels, automatic custom-to-Rectangle restoration, and every provider-side consequence of all point commands remain outside this report. New source/sample/evidence hashes are in \`native-point-editing-format-evidence.json\`; old frozen artifacts were not changed.
`);
const manifest={stage:'native-point-editing-format',capturedAt:evidence.capturedAt,
  files:[...evidence.sources,pin(prefix+'evidence.md'),pin(prefix+'evidence.json')],
  samples:evidence.samples,checks:{rawSourceWitnesses:4,actualImportedCustomRectangles:2,saveReadback:true,originalGuiCompared:false}};
for(const r of [...manifest.files,...manifest.samples])assert.equal(sha(r.file),r.sha256,r.file);
fs.writeFileSync(prefix+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({evidence:pin(prefix+'evidence.json'),markdown:pin(prefix+'evidence.md'),manifest:pin(prefix+'manifest.json'),fixture:imported.fixture,checks:manifest.checks},null,2));
