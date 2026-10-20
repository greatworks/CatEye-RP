import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const record=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),bytes:fs.statSync(file).size});
const owners=read('research/font-size-format-owners.json');
const impact=read('research/font-size-format-impact.json');
const checks=read('research/font-size-format-check.json');
const browser=read('research/font-size-browser-probe.json');
if(record(owners.sample.file).sha256!==owners.sample.sha256)throw Error('Pinned native sample changed');
if(checks.checks.length!==8||checks.checks.some(c=>c.status!=='passed'))throw Error('Focused evidence checks must pass');

const dependencies=[
  'research/samples/font-scale-cil.json','research/samples/font-i1i4-cil.json','research/samples/font-tHej-cil.json',
  'research/gradient-angle-version-cil.json','research/font-style-format-run-base-cil.json','research/rp-next-coverage-richtext-cil.json',
  'research/rp-text-layout-evidence.md','research/rich-text-format-evidence.md','research/rich-text-format-html-style-cil.json',
  'research/rotation-import-baseline.json',
  'research/font-size-browser-probe.json','research/font-size-browser-probe.mjs','research/font-size-imported-before.rea.json',
  'research/font-size-runtime-css-cil.json','research/font-size-runtime-conversion-cil.json','research/font-size-runtime-round-cil.json',
  'research/font-size-runtime-run-provider-cil.json','research/font-size-runtime-replay.mjs','research/font-size-runtime-replay.json',
  'research/font-size-runtime-autofit-cil.json','research/font-size-runtime-richpanel-layout-cil.json','research/font-size-runtime-graphics-layout-cil.json',
  'research/font-size-runtime-autofit-replay.mjs','research/font-size-runtime-autofit-replay.json',
];
const evidence={
  capturedAt:new Date().toISOString(),target:'Axure RP 11.0.0.4150',
  method:'Focused raw RP objects and static managed CIL; no target assembly execution, original GUI, production edits, global tests or broad native recensus.',
  sample:owners.sample,
  conclusion:{
    unitConversion:'The traced native drawing and current HTML formatter convert native size to pixels by96/72. Current run21 therefore formats28 when supplied unchanged.',
    loadBranch:'The traced v11 saveable AxRun reader parses and directly sets21; WNZO passesfalse to RNO1 and skips its optional SyncStyleToAttrString call.',
    wholeProjectLifecycleVerified:false,
    fullOriginalHtmlFontSizeVerified:false,
    autoFitOriginalPixelMeasurementVerified:false,
    productionChangeRecommended:false,
    reason:'Named-style15/run21 and saved AutoFit geometry conflict. Size20 fitting the saved rectangle is evidence to investigate synchronization/layout, not permission to discard explicit run formatting or change the native divisor.',
  },
  owners:owners.owners.map(o=>({
    packageId:o.packageId,sourceId:o.sourceId,packageVersion:o.packageVersion,
    text:o.rawObject.RichTextBlock['attributed-string'].Paragraphs[0].Inlines[0].Text,
    bounds:{x:o.imported.x,y:o.imported.y,width:o.imported.width,height:o.imported.height},
    autoFit:{width:o.rawObject.AutoFitWidth,height:o.rawObject.AutoFitHeight},
    attributedStringVersion:o.rawObject.RichTextBlock['attributed-string'].Version,
    localFontSizePropertyPresent:o.myStyle.entries.some(e=>e.property===2),
    cachedBase:{info:o.matchingBase[0].info,fontSizeProperty:o.matchingBase[0].properties.find(e=>e.property===2)},
    run:o.rawObject.RichTextBlock['attributed-string'].Paragraphs[0].Inlines[0],
    recovered:{fontSize:o.imported.style.fontSize,provenance:o.recovered.style.provenance.fontSize,textPadding:o.imported.style.textPadding,lineHeight:o.imported.style.lineHeight,verticalAlign:o.imported.style.verticalAlign},
  })),
  directSynchronizerCallers:read('research/font-size-format-sync-callers.json').records,
  anchors:[
    {file:'research/samples/font-scale-cil.json',token:100692664,il:'0x3e–0x4d',finding:'get_Size /0.75 then Axvg.Run.set_Size'},
    {file:'research/font-size-format-axrun-reader-cil.json',token:100718409,il:'64–75;modern979;older647',finding:'Versioned run loader numeric parse then raw Size setter'},
    {file:'research/gradient-angle-version-cil.json',token:100691304,il:'33–42',finding:'gbzX is7.0.0.0'},
    {file:'research/font-size-format-double-reader-cil.json',token:100718349,il:'7–14',finding:'Explicit numeric conversion without unit scaling'},
    {file:'research/font-style-format-run-base-cil.json',token:100707824,il:'33–35',finding:'Stores raw Size double'},
    {file:'research/rp-next-coverage-richtext-cil.json',token:100702351,il:'130–131',finding:'WNZO passesfalse to RNO1'},
    {file:'research/font-size-format-panel-load-cil.json',token:100701880,il:'109–110;261;450',finding:'False branch skips optional synchronizer'},
    {file:'research/font-size-format-link-sync-cil.json',token:100700952,il:'78',finding:'Only other direct synchronizer caller found, on InlineLink property change'},
    {file:'research/font-size-runtime-css-cil.json',token:100699304,finding:'HTML formatter callsx5ig with72'},
    {file:'research/font-size-runtime-conversion-cil.json',token:100719575,finding:'value*96/72 then three-decimal AwayFromZero rounding'},
    {file:'research/font-size-runtime-richpanel-layout-cil.json',token:100701896,finding:'Initial text-panel layout measures AutoFit width; mocked graphics replay is not original pixel parity'},
  ],
  browserComparison:{
    source:'research/font-size-browser-probe.json',method:browser.method,
    stages:browser.stages.map(s=>({name:s.name,pages:s.pages.map(p=>({page:p.page,labels:p.labels.map(l=>({id:l.id,text:l.text,css:l.css,textRects:l.textRects,platformFonts:l.platformFonts,canvasTextWidth:l.canvasTextWidth,lineCount:l.lineCount,maxCharacterClipping:l.maxCharacterClipping}))}))})),
    inference:'20px precisely fitting95/54×27 agrees with cached base15 converted by96/72, but does not prove the original full-load effective value.',
  },
  priorSnapshotImpact:{source:'research/font-size-format-impact.json',counts:impact.totals,nativeRecensus:false,scope:'Stored imported-model fields, not visible glyphs. Some base fields may be model defaults. Icons excluded by prior import limit.',priorPositiveExamples:impact.priorPositiveExamples},
  unknowns:[
    'Complete original document loading/style synchronization after the traced saveable reader.',
    'Final effective run and named-style values supplied by a fully loaded original UX project.',
    'Exact native measured text-panel rectangle and any owner outer-bounds update for the four owners.',
    'Original generated overflow/wrapping and final pixels; the independent Electron probe is a product-host experiment.',
  ],
  validation:{formatStaticAssertions:checks.checks.length,command:'node research/font-size-format-check.mjs',originalAssemblyExecuted:false,globalTestsRun:false},
  dependencies:dependencies.map(record),
};
fs.writeFileSync('research/font-size-format-evidence.json',JSON.stringify(evidence,null,2)+'\n');
const ownFiles=fs.readdirSync('research').filter(f=>f.startsWith('font-size-format-')&&f!=='font-size-format-manifest.json').sort().map(f=>'research/'+f);
const assembly=read('research/font-size-format-sync-callers.json');
const manifest={capturedAt:new Date().toISOString(),scope:'Read-only native font-size format evidence. Production and prior frozen release evidence are unchanged by this task.',sources:[record(assembly.assembly),...dependencies.map(record)],samples:[record(owners.sample.file)],files:ownFiles.map(record),validation:evidence.validation};
fs.writeFileSync('research/font-size-format-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({owners:evidence.owners.length,checks:checks.checks.length,files:manifest.files.length,manifest:record('research/font-size-format-manifest.json')},null,2));
