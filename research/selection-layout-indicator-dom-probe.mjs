// Extend the retained pNPt writer replay with correct full SNLp call capture.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const original='research/selection-layout-render-dom-probe.mjs';
let source=fs.readFileSync(original,'utf8')
 .replaceAll('selection-layout-render-dom-','selection-layout-indicator-dom-detail-')
 .replace("s.splice(s.length-6,6);out.events.push({kind:'owner-css-sink'});",
 "const args=s.splice(s.length-13,13);out.events.push({kind:'owner-css-call',args:args.slice(1)});")
 .replace("const api=await import(",String.raw`
code=code.replace("i.Resolved==='fNiZ.FNiU::eN7V'?[]", "i.Resolved==='h5uH.j5u5::O5sD'?{x:0,y:0,width:0,height:0}:i.Resolved==='fNiZ.FNiU::eN7V'?[]");
const api=await import(`)
 .replace("['open','rich-content','close','input-sink','indicator-svg-sink']",
 "['open','rich-content','close','input-sink','indicator-svg-sink','owner-css-call']")
 .replace("adapterFile,'research/selection-layout-indicator-dom-detail-probe.mjs'",
 `adapterFile,${JSON.stringify(original)},'research/selection-layout-indicator-dom-probe.mjs','research/native-point-contours-topology-rect-static-cil.json'`);
// The original string only interpolates read-only absolute modules and new output names.
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
