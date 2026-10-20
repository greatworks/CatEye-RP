import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const census=JSON.parse(fs.readFileSync('research/rich-text-format-census.json','utf8'));
const audit=JSON.parse(fs.readFileSync('research/rich-text-format-import-audit.json','utf8'));
const owners=census.owners.filter(o=>o.imported),paragraphs=owners.flatMap(o=>o.block['attributed-string'].Paragraphs),runs=paragraphs.flatMap(p=>p.Inlines);
const tally=values=>values.reduce((r,v)=>{const key=JSON.stringify(v);r[key]=(r[key]??0)+1;return r;},{});
const keys=['Family','Size','Weight','Style','Stretch','Underline','Strikethrough','Baseline','CharacterSpacing','Color'];
const report={
  capturedAt:new Date().toISOString(),method:'Read-only package inspection and static ECMA-335 metadata/CIL; current self-written parser/importer audited independently. No original application or DLL execution.',
  assemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',
  originalOwners:50,supportedMixedOwners:49,unsupportedOwner:{id:'14ea8a9456d14c888e8e483e64492173',reason:'AxHyperlink inline including an underlined inner run; never flattened as recovered rich text'},
  paragraphCount:paragraphs.length,runCount:runs.length,
  observedRuns:Object.fromEntries(keys.map(key=>[key,tally(runs.map(r=>r[key]))])),
  observedParagraphs:Object.fromEntries(['Wrapping','Trimming','HorizontalAlignment','LineSpacing','ListInfo'].map(key=>[key,tally(paragraphs.map(p=>p[key]))])),
  boundaries:{nonFinalParagraphs:192,exactlyOneTerminalLF:192,internalLF:0,CR:0,TAB:0,blankParagraphs:89,emptyFinalRuns:2,normalization:'Remove the single terminal LF from the last run of every non-final paragraph, then join paragraphs with one LF. Preserve empty runs and blank paragraphs.',legacyExtraLFRemoved:192},
  model:{expressionMode:'literal',runStyleKeys:['fontFamily','fontSize','fontWeight','fontStyle','color'],paragraphStyleKeys:['textAlign','lineHeightPx'],sizeConversion:'native / 0.75',lineSpacingConversion:'0 -> browser normal; positive native / 0.75',nativeFontMetricsVerified:false},
  sourceMetadata:'RichTextBlock property-dictionary IDs remain inert provenance; copied library metadata is not used as a cross-widget reference.',
  bounds:{paragraphs:1000,totalRuns:10000,totalCharacters:100000,nativeSize:[.75,384],nativeLineSpacing:[0,750],minimumPositiveNativeLineSpacing:.075,weight:[100,1000]},
  conflicts:owners.filter(o=>['9ae80b88ab624d3aa80eb671b09e5c7f','c4338edb658541abaea6b13bdefe6d83','343f5bc495e94af3aa5abf4d71685da7'].includes(o.objectId)).map(o=>({packageId:o.packageId,id:o.objectId,nativeObjectSize:13.5,nativeRunSize:16.5,modelBaseFontSize:18,modelRunFontSize:22})),
  literalExample:{packageId:'c598ff6cf4ba459cbef032f0cd4048f7',id:'f5c250636b6340ac82b96a677bec69a2',reason:'AxRun explanatory text contains [[...]] but is not an expression carrier'},
  staticCil:[
    {file:'research/font-style-format-conversion-cil.json',type:'Axure.Axvg.RPToAxvg.RPFormatExtensions',method:'bJcT',token:100692664,offsets:{trimLF:['0xE','0x13','0x15','0x1A'],size:['0x3E','0x4D'],style:'0x6F',weight:'0x85',decorations:['0x98','0xD2']}},
    {file:'research/samples/font-scale-cil.json',type:'Axure.Axvg.RPToAxvg.RPFormatExtensions',method:'XJc4',token:100692660,offsets:{lineSpacingZero:'0x58..0x6B',positiveDivide075:'0x72..0x81'}},
    {file:'research/rich-text-format-html-cil.json',type:'nNCA.cNCQ',method:'ONiF',token:100699551,offsets:{runHtml:'0x3EE',emptyParagraph:'0x7EC..0x80E'}},
    {file:'research/rich-text-format-html-inline-cil.json',type:'nNCA.cNCQ',method:'KNiN',token:100699555,offsets:{runStyle:'0x41',runText:['0x115','0x127']}},
    {file:'research/rich-text-format-html-inline-cil.json',type:'nNCA.cNCQ',method:'BNiS',token:100699556,offsets:{providerToCss:'0xC'}},
    {file:'research/rich-text-format-html-style-cil.json',type:'PNKu',method:'RNxS',token:100699318,offsets:{runSize:'0x12..0x14',convertedCss:'0x49..0x4E'}}
  ],
  staticBoundaries:['Obfuscated generated HTML literal strings have not been decoded.','Automatic normal is a browser mapping, not proof of native glyph/line metrics.','Font substitution, unsupported families, different platform fonts and original GUI layout are unverified.','Non-default stretch, underline, strike, baseline, character spacing, wrapping/trimming and lists are explicitly unsupported.'],
  auditTotals:audit.totals,
  textCorrections:audit.samples.filter(s=>s.textCorrections?.length).map(s=>({file:s.file,objects:s.textCorrections.length,removedDuplicateLF:s.textCorrections.reduce((n,w)=>n+w.removedDuplicateLF,0)})),
  selectedChange:{evidence:'research/selected-style-filter-evidence.md',rule:'Only original local state properties with determined && overridden pass; original property structure is validated first. Do not apply this filter to materialized named/default/base caches.',addedNestedRadioIds:audit.samples.flatMap(s=>(s.added??[]).map(w=>w.id)),eventTypes:tally(audit.samples.flatMap(s=>(s.eventChanges??[]).flatMap(w=>w.interactions.map(i=>i.event)))),allAddedActionTypes:['setSelected'],originalEightDropdownFocusBlurAreSubset:true},
  samples:audit.samples.map(s=>({file:s.file,sha256:s.sha256,compactSemanticBytes:s.compactSemanticBytes,readerRichStatuses:s.readerRichStatuses,import:s.import,richWidgets:s.rich?.length,added:s.added?.map(w=>({id:w.id,type:w.type,selectedStyle:w.selectedStyle})),eventChanges:s.eventChanges?.map(w=>({id:w.id,name:w.name,oldEvents:w.oldEvents,events:w.interactions.map(i=>i.event)})),importError:s.importError})),
  validation:{newNode:6,newVitest:16,selectedIndependentNode:7,relatedNodeTotal:45,relatedVitestTotal:31,legacyAppearanceNode:19,legacyDropdownInputVitest:53,typecheck:'passed',fullSuites:'Parent-owned; not run by this agent'}
};
const files=['research/rich-text-format-census.mjs','research/rich-text-format-census.json','research/rich-text-format-import-audit.mjs','research/rich-text-format-import-audit.json','research/rich-text-format-evidence.mjs','research/rich-text-format-metadata.json','research/rich-text-format-paragraph-cil.json','research/rich-text-format-html-cil.json','research/rich-text-format-html-inline-cil.json','research/rich-text-format-html-text-cil.json','research/rich-text-format-html-linebreak-cil.json','research/rich-text-format-html-style-cil.json','research/font-style-format-conversion-cil.json','research/font-style-format-run-base-cil.json','research/samples/font-scale-cil.json','research/selected-style-filter-evidence.md','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/scripts/read-rp-rich-text.test.mjs','tests/import-rp-rich-text.test.ts'];
files.push('research/rich-text-format-evidence.md');
files.push('research/selected-style-filter-import-verification.json','research/selected-style-filter-verify-import.mjs','research/scripts/read-rp-font-style.test.mjs','research/scripts/read-rp-interaction-styles.test.mjs','tests/import-rp-dropdown.test.ts','tests/import-rp-input-types.test.ts');
report.sources=files.map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/rich-text-format-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({owners:report.supportedMixedOwners,paragraphs:report.paragraphCount,runs:report.runCount,audit:report.auditTotals},null,2));


