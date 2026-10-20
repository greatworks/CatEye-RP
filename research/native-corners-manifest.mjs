import fs from 'node:fs';
import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entry=path=>({path,sha256:hash(path)});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const js=read('research/native-corners-runtime-probes.json'),cil=read('research/native-corners-static-probes.json');
const assembly=read('research/native-corners-owner-cil.json');
const evidence=[
 'research/native-corners-evidence.md','research/native-corners-runtime-probe.mjs','research/native-corners-runtime-probes.json',
 'research/native-corners-static-probe.mjs','research/native-corners-static-probes.json','research/native-corners-metadata.ps1','research/native-corners-metadata.json',
 'research/native-corners-owner-cil.json','research/native-corners-drawing-cil.json','research/native-corners-shape-factory-cil.json','research/native-corners-path-builder-cil.json',
 'research/native-corners-geometry-metadata.ps1','research/native-corners-geometry-metadata.json','research/native-corners-css-writer-cil.json','research/native-corners-css-literals.mjs','research/native-corners-css-literals.json',
 'research/adaptive-all-views-authoring-evidence.md','research/adaptive-all-views-authoring-evidence.json','research/adaptive-all-views-properties-cil.json',
 'research/line-style-platform-functions-cil.json','research/line-style-position-enum-cil.json','research/line-style-metadata.json',
 'research/rp-vector-path-vector-cil.json','research/shadow-format-css-sites-cil.json','research/text-autofit-style-css-units-cil.json','research/text-autofit-style-literals.json',
 'research/text-autofit-native-literals.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',
 'research/text-autofit-native-literal-dispatch-cil.json','research/text-autofit-native-literal-data-cil.json','research/text-autofit-native-literal-transform-cil.json','research/text-autofit-native-literals.bin',
 'research/scripts/inspect-rp-serialization.ps1','research/native-corners-manifest.mjs'
];
const report={schema:1,capturedAt:new Date().toISOString(),evidenceId:'NC-RUNTIME-11-4150',
 distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
 extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
 sources:[entry(assembly.AssemblyPath),...js.sources.map(s=>entry(s.path))],evidence:evidence.map(entry),
 observations:{runtime:{kind:js.kind,count:js.results.length,passed:js.results.filter(r=>r.pass).length,matrix:js.matrix},static:{kind:cil.kind,count:cil.results.length,passed:cil.results.filter(r=>r.pass).length},literalCount:read('research/native-corners-css-literals.json').records.length},
 contract:{nativeKeys:{radius:71,cornerVisibility:81,borderVisibility:80},cornerOrder:['topLeft','topRight','bottomRight','bottomLeft'],cornerBits:[1,2,4,8],cornerStrings:['left','top','right','bottom'],borderOrder:['top','right','bottom','left'],borderBits:[2,4,8,1],independentKeys:true,documentDefaults:{radius:0,cornerVisibility:15,source:'Companion native-corners-format census; document defaults, not missing-key fallback in JS.'},strokeEligibility:'positive radius AND corner bit AND both adjacent border bits',fillEligibility:'positive radius AND corner bit AND adjacent border bits equal',dynamicClamp:'half height for an active same-column stroke pair; half width for an active same-row stroke pair; otherwise full axis; minimum with requested radius; fill reuses stroke-clamped radius',css:'raw uniform px radius plus per-corner zero override; browser performs CSS normalization',allViews:'ordinary changed P71 and P81 independently clear their own native keys in all maps; equal current determined value is no-op'},
 methods:[['VectorShape.jN4k',100702679],['L5vW.w5Qk',100722530],['L5vW.i5vf',100722498],['L5vW.b5QE',100722529],['JNLP.cNK1',100699253],['JNLP.FNKB',100699240],['JNLP.lNKV',100699241],['ebDE.QbLj',100688629]].map(([name,token])=>({name,token})),
 limitations:['No original GUI or original generated page pixel comparison.','Node VM uses mocked object lookup and DOM/CSS sinks; exact extracted functions execute.','CIL replay stops before path construction and does not load/execute target assembly.','Managed separate fill clamp differs from dynamic SVG reused clamp for some large-radius/hidden-border cases.','CSS, image update and SVG paths have distinct type gates; universal concrete generator coverage is not claimed.','Legacy product cornerRadii is an extension, not native P81.','Arbitrary edited vector contours must not be replaced solely due to radius metadata.']};
fs.writeFileSync('research/native-corners-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runtime:report.observations.runtime.count,static:report.observations.static.count,sources:report.sources.length,evidence:report.evidence.length,sha256:hash('research/native-corners-evidence.json')}));
