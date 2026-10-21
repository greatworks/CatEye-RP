// Reuse the frozen static resource decoder, selecting only newly retained SVG methods.
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
let source=fs.readFileSync('research/selection-layout-indicator-literals.mjs','utf8')
 .replace("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("process.argv.slice(2).map(f=>[f,[]])","[['research/selection-layout-border-svg-fill-cil.json',[]]]")
 .replace("research/selection-layout-indicator-literals.json","research/selection-layout-border-literals.json")
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
