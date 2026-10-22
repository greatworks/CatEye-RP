// Reuse the frozen static resource decoder without executing a vendor assembly.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const inputs = ['research/selection-svg-body-paint-E5dq-cil.json','research/selection-svg-body-paint-R5qL-cil.json','research/selection-svg-body-paint-KH9k-cil.json','research/selection-svg-body-paint-V5Z9-cil.json','research/selection-svg-body-paint-b5ZH-cil.json','research/selection-svg-body-paint-F5ZK-cil.json','research/selection-svg-body-paint-W5ZX-cil.json','research/selection-svg-body-paint-pHSq-cil.json','research/selection-svg-body-paint-fH9a-cil.json','research/selection-svg-body-paint-f5wV-format-cil.json','research/selection-svg-body-paint-m5k3-format-cil.json','research/line-style-svg-writer-cil.json','research/line-style-svg-pen-base-cil.json'];
let source=fs.readFileSync('research/selection-layout-indicator-literals.mjs','utf8')
 .replace("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace('process.argv.slice(2).map(f=>[f,[]])',JSON.stringify(inputs.map(f=>[f,[]])))
 .replace("'research/selection-layout-indicator-literals.json'","'research/selection-svg-body-paint-literals.json'")
 .replace("console.log(records.map(r=>`${r.method} IL${r.il} @${r.offset}: ${r.text}`).join('\\n'));","console.log(JSON.stringify({literals:records.length}));");
if(fs.existsSync('research/selection-svg-body-paint-literals.json'))throw Error('Frozen output exists');
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
