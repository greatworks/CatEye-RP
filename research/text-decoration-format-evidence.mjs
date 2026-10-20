import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const census=JSON.parse(fs.readFileSync('research/text-decoration-census.json','utf8'));
const audit=JSON.parse(fs.readFileSync('research/text-decoration-import-audit.json','utf8'));
const sources=[
 'research/text-decoration-format-evidence.md','research/text-decoration-format-evidence.mjs',
 'research/text-decoration-census.mjs','research/text-decoration-census.json','research/text-decoration-import-audit.mjs','research/text-decoration-import-audit.json',
 'research/samples/metadata-PName.json','research/font-style-format-run-base-cil.json','research/font-style-format-conversion-cil.json','research/rich-text-format-metadata.json','research/rich-text-format-html-style-cil.json',
 'research/text-decoration-css-cil.json','research/text-decoration-json-keys-cil.json','research/text-decoration-property-names-cil.json','research/text-decoration-character-units-cil.json','research/text-decoration-rounding-cil.json',
 'research/selected-style-filter-json-entry.json','research/selected-style-filter-evidence.md',
 'research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/scripts/read-rp-text-decoration.test.mjs','research/scripts/read-rp-rich-text.test.mjs','tests/import-rp-text-decoration.test.ts','tests/import-rp-rich-text.test.ts',
];
const report={
 capturedAt:new Date().toISOString(),method:'Static original package/CIL evidence plus self-written parser/importer focused verification; no original DLL or GUI execution',
 originalAssemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',
 mappings:{underline:{pName:5,type:'Boolean',getterToken:100707831,serializeToken:100707862,serializeIL:'0x190..0x19A'},strikethrough:{pName:95,type:'Boolean',getterToken:100707833,serializeToken:100707862,serializeIL:'0x252..0x25C'},characterSpacing:{pName:91,type:'Double',getterToken:100707837,acceptedValue:0,nonzeroNumericConversion:'Math.Round(value * 96 / 72, 3, enum1); final CSS string unit unresolved',numericTokens:[100699324,100719575,100688822]},baseline:{pName:92,enum:{Normal:0,Super:1,Sub:2},getterToken:100707839,cssMapperToken:100699316,acceptedValue:0,cssLiteralMapping:'unresolved'}},
 cssWriter:{token:100699319,signature:'000301151281AD020E0E0202',underlineBranch:'0xD..0x2F',strikethroughBranch:'0x35..0x57',baseCallGuard:{token:100699318,IL:'0x80..0x8B',predicate:'underline || strikethrough'},stateBooleanWriter:{token:100694323,IL:'0x283..0x2AC',localFilter:'Overridden && !Indeterminate'}},
 protocol:audit.protocol,sampleCounts:census.counts,importTotals:audit.totals,
 samples:census.samples,underlinedRuns:census.interestingRuns.filter(r=>r.Underline||r.Strikethrough).map(({run,...r})=>({...r,wholeRichRecovery:'unsupported due to AxHyperlink carrier'})),
 verification:{newNode:6,relatedRichNode:6,relatedStateNode:39,newVitest:21,relatedRichVitest:16,typecheck:true,corpusAuditFiles:11,originalGuiVerified:false,fullSuiteRunByThisAgent:false},
 boundaries:['Both real underline=true runs belong to unsupported AxHyperlink inlines; no hyperlink flattening','No observed true strikethrough or OD-active decoration state in corpus','Nonzero CharacterSpacing/Baseline and nondefault Stretch remain unsupported','Base/run field independence does not imply naive state CSS merge equivalence','Legacy saved rich documents accept optional decoration; native worker protocol v1 is rejected'],
 sources:sources.map(file=>({file,sha256:sha(file)})),
};
fs.writeFileSync('research/text-decoration-format-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:'research/text-decoration-format-evidence.json',sha256:sha('research/text-decoration-format-evidence.json'),parser:sha('research/scripts/read-rp-semantics.mjs'),importer:sha('src/model/import-rp.ts'),totals:audit.totals},null,2));
