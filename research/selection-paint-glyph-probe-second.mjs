// Reuse only the retained-CIL adapter construction, never its frozen output writer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const original='research/selection-layout-indicator-glyph-probe.mjs';
let wrapper=fs.readFileSync(original,'utf8').split("process.on('uncaughtException'")[0];
wrapper=wrapper.replace("'research/selection-layout-indicator-html-geometry-cil.json'","'research/selection-layout-indicator-html-geometry-cil.json','research/selection-paint-fill-uHV0-cil.json'");
wrapper=wrapper.replace('bind(100720805,1,([f])=>f.color);',"cil(100723090,1);bind(100720805,1,([f])=>execute(100723090,[f]));");
wrapper=wrapper.replace('bind(100720811,3,([fill,r,flag])=>({fill,rect:r,flag}));',"cil(100723099,3);bind(100720811,3,args=>execute(100723099,args));");
wrapper+='\nexport const api=await import(\'data:text/javascript;base64,\'+Buffer.from(code).toString(\'base64\'));';
const {api}=await import('data:text/javascript;base64,'+Buffer.from(wrapper).toString('base64'));
const results=[];
for(const kind of ['checkbox','radio'])for(const b of [14,18])for(const disabled of [false,true])for(const alpha of [null,0,1/255,.5,1]){
 const color=alpha===null?null:{red:18,green:52,blue:86,alpha};
 const fill=color===null?null:{67135106:color};
 const actual=api.glyph(kind,b,b,fill,disabled,0,0);
 const expected=color??(disabled?'disabled-theme':'normal-theme');
 assert.equal(actual.length,1);
 assert.deepEqual(kind==='checkbox'?actual[0].pen.color:actual[0].brush.color,expected);
 if(kind==='checkbox')assert.equal(actual[0].pen.width,(b/14)*3);
 else assert.equal(actual[0].kind,'fill');
 results.push({input:{kind,b,disabled,alpha,fill},actual,passed:true});
}
const paths=[original,import.meta.filename,'research/selection-paint-fill-uHV0-cil.json',...api.sourceFiles,'research/layer-resize-controller-probe.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'];
fs.writeFileSync('research/selection-paint-glyph-probes.json',JSON.stringify({target:'Axure RP 11.0.0.4150',assemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',method:'Retained B9HX/V9Hm CIL with actual uHV0 gIQJ and b3bV CIL. Numeric/struct and pen/brush/draw sinks declared. Vendor DLL not executed.',summary:{total:results.length,passed:results.length,failed:0},sources:[...new Set(paths)].map(path=>({path,sha256:sha(path)})),boundaries:['Transparent nonnull color data is retained by concrete solid fill getter and brush route; it is not a null theme request.','Theme values are labeled controlled inputs. Full theme, caller effective style and native rasterization not evaluated.','Zero border width does not enter either glyph method; geometry source b controls checkbox pen width.','Alpha is represented as explicit struct field payload; final SVG color serialization is separate.'],results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:results.length}));

