import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const census=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8'));
const audit=JSON.parse(fs.readFileSync('research/rich-hyperlink-import-audit.json','utf8'));
const files=[
 'research/rich-hyperlink-format-evidence.md','research/rich-hyperlink-format-manifest.mjs','research/rich-hyperlink-format-census.mjs','research/rich-hyperlink-format-census.json','research/rich-hyperlink-import-audit.mjs','research/rich-hyperlink-import-audit.json',
 'research/rich-hyperlink-html-writer-cil.json','research/rich-text-format-html-cil.json','research/rich-text-format-html-inline-cil.json','research/rich-text-format-html-style-cil.json',
 'research/rp-interaction-LinkType-cil.json','research/rp-interaction-IxTargetType-cil.json','research/rp-interaction-IxEventType-cil.json','research/selected-style-filter-evidence.md',
 'research/hyperlink-runtime-evidence.md','research/hyperlink-runtime-evidence.json','research/inline-text-verification.json','research/text-decoration-import-audit.json',
 'research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','src/model/import-rp.ts','research/scripts/read-rp-rich-hyperlink.test.mjs','tests/import-rp-rich-hyperlink.test.ts',
 'research/scripts/read-rp-rich-text.test.mjs','research/scripts/read-rp-text-decoration.test.mjs','research/scripts/read-rp-interactions.test.mjs',
];
const report={capturedAt:new Date().toISOString(),target:{product:'Axure RP',version:'11.0.0.4150',assemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',originalAssemblyExecuted:false,originalGuiCompared:false,destinationUrlsVisited:false},
 method:'Pinned corpus object census, ECMA-335 metadata/CIL, self-written parser/importer and synthetic boundary mutations; original runtime probes are an independently linked report',
 schema:{runStyleSchemaVersion:2,linkSchemaVersion:1,linkFields:['id','name','interactions','mouseOverStyle?','mouseDownStyle?'],runLink:'linkId',baseline:'Explicit child run seven-field style, matched against resolved normal subset; no parent/link baseline flattening',source:'linkSources: exact local identities, state source properties and full decoded interaction tree',idScope:'package + owner + native link',windowModes:{Current:1,New:2},targetTypes:{WebUrl:0,Page:1}},
 limits:{linkDefinitions:100,paragraphs:1000,expandedRuns:10000,projectedCharacters:100000,literalUrlCharacters:4096},
 owners:census.owners.map((o,index)=>({file:o.file,sha256:o.sha256,packageId:o.packageId,packageSha256:o.packageSha256,ownerId:o.ownerId,ownerType:o.ownerType,page:index?'Getting started':'Instructions',linkIds:o.links.map(l=>l.linkId),nativeInlinePaths:o.inlines.map(i=>i.path),sourceGraphObjectCounts:o.links.map(l=>l.graph.length)})),
 sources:files.map(file=>({file,sha256:hash(file)})),corpus:census.samples,importTotals:audit.totals,
 validation:{focusedParser:{passed:52,newHyperlink:40,existingRichAndDecoration:12},followupParser:{passed:64,newHyperlink:40,existingInteraction:24,reason:'Category-compatible precise diagnostic only; 40 overlap with focusedParser'},uniqueParserTestsAcrossBothRuns:76,focusedImport:{passed:61,newHyperlink:24,existingRichAndDecoration:37},typecheck:true,all11AuditAndStrictSaveReopen:true,fullSuitesRunByThisAgent:false,browserOrDesktopRunByThisAgent:false},
 known:['Two distinct diagram-object hyperlink identities linked from typed inline wrappers','Exact stored nested-run text/style and paragraph LF boundaries','Local OD-active typography overrides uniquely identified named cache','Current1/New2 external URL mode mapping with WebUrl0','Complete click tree reused under existing strict decoder mappings; no partial event/owner conversion'],
 rejectedOrUnknown:['Native wrapper tag/href/tabindex and original keyboard behavior','Dynamic/bound URLs and non-HTTP(S) protocols','Popup/Parent/Frame/ParentFrame and New-window native Page','Native hyperlink This and compound/repeater/master target paths','Adaptive/disabled/selected/error/tooltip link behaviors','Missing/ambiguous inherited named-cache identity and conflicting normal-vs-run format','Nested AxHyperlink wrappers, unknown active properties, unfamiliar rich versions','Original glyph metrics and full native layout equivalence'],
 cilAnchors:[
 {file:'research/rich-text-format-html-cil.json',method:'cNCQ.ONiF',token:100699551,il:['0x38D AxHyperlink gSXD','0x597 FNiU.oNPx','0x409 child enumeration','0x331 child KNiN','0x3EE ordinary KNiN']},
 {file:'research/rich-text-format-html-inline-cil.json',method:'cNCQ.KNiN / BNiS',tokens:[100699555,100699556],il:['0x41 run style construction','0xC PNKu.RNxS']},
 {file:'research/rich-hyperlink-html-writer-cil.json',method:'FNiU.oNPx',token:100699665,il:['0x6D gSXD.JSXe','0x72 InlineLink cast','0x51 identifier','0x114 / 0x186 wrapper writer with unresolved literals']},
 {file:'research/rp-interaction-LinkType-cil.json',typeToken:33557790,fields:{Invalid:0,Current:1,New:2,Popup:3,Parent:4,Frame:5,ParentFrame:6}},
 ]};
fs.writeFileSync('research/rich-hyperlink-format-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:'research/rich-hyperlink-format-evidence.json',sha256:hash('research/rich-hyperlink-format-evidence.json'),totals:report.importTotals,sourceHashes:report.sources.filter(s=>['research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','src/model/import-rp.ts'].includes(s.file))},null,2));
