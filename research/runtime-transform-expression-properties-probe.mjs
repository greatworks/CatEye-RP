import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const original = JSON.parse(fs.readFileSync(path.join(root, 'research/runtime-transform-expression-final-probes.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = original.sources.filter(entry => ['sto.js', 'expr.js', 'variables.js'].includes(path.basename(entry.path)));
const sourceRoot = path.dirname(sources[0].path), docPath = path.join(sourceRoot, 'doc.js');
sources.push({ path: docPath, sha256: '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1', bytes: fs.statSync(docPath).size });
for (const entry of sources) assert.equal(hash(fs.readFileSync(entry.path)), entry.sha256, entry.path);
const docSlice = fs.readFileSync(docPath, 'utf8').split(/\r?\n/).slice(348, 543).join('\n');
function harness() {
  const realm = vm.createContext({});
  vm.runInContext(`
    var reads=[], rect={left:10,top:20,width:200,height:100}, old={width:190,height:90}, text='first', angle=30;
    var $ax=function(selector){return {offsetBoundingRect:function(a,b){reads.push(['bounds',selector,a,b]);return Object.assign({},rect)},text:function(){reads.push(['text']);return text},viewportLocation:function(){return {left:5,top:6}}}};
    Object.assign($ax,{document:{globalVariables:{count:'3'}},messageCenter:{addMessageListener:function(){}},
      public:{fn:{IsLayer:function(){return false},IsRepeater:function(){return false},IsDynamicPanel:function(){return false}}},
      repeater:{getScriptIdFromElementId:function(id){return id}},getParentRepeaterFromScriptId:function(){},
      getElementIdsFromPath:function(ids){return ids},move:{getRotationDegree:function(){reads.push(['rotation']);return angle}},
      visibility:{getResizingRect:function(){return old}},dynamicPanelManager:{getPanelSizeChange:function(){}}
    });
    var $axure={internal:function(fn){fn($ax)}},$jobj=function(){return {data:function(){return ''}}},$obj=function(){return {type:'shape'}},_getParentElement=function(id){return id};
    function lit(value,type){var out={sto:'literal',value:value};if(type)out.computedType=type;return out}
    function variable(name,type){var out={sto:'var',name:name};if(type)out.desiredType=type;return out}
    function prop(name,key){return {sto:'propCall',thisSTO:variable(name),prop:key}}
    function call(receiver,precision){return {sto:'fCall',func:'toFixed',thisSTO:receiver,arguments:precision===undefined?[]:[lit(precision)]}}
    function expr(text,stos,locals){return {exprType:'stringLiteral',value:text,stos:stos||[],localVariables:locals||{}}}
    function binding(){return {exprType:'fcall',functionName:'GetWidget',arguments:[{exprType:'pathLiteral',value:['track']}]}}
    var event={srcElement:'source',targetElement:'target',thiswidget:{elementId:'track'},window:{width:1280,height:720}};
  `, realm);
  for (const entry of sources.slice(0, 3)) vm.runInContext(fs.readFileSync(entry.path, 'utf8'), realm, { timeout: 1500 });
  vm.runInContext(docSlice, realm, { timeout: 1500 });
  return code => JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})())`, realm, { timeout: 1500 }));
}
const results = [];
function test(name, code, expected) {
  try { const actual = harness()(code); assert.deepEqual(actual, expected); results.push({ name, passed: true, actual }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
test('widget-info construction does not read geometry; first geometry access caches all four axes', `var w=$ax.getWidgetInfo('track'),before=reads.length;rect={left:40,top:50,width:300,height:160};var first=w.x();rect={left:90,top:95,width:400,height:200};return {before:before,first:first,rest:[w.y(),w.width(),w.height(),w.right(),w.bottom()],reads:reads};`, { before: 0, first: 40, rest: [50,300,160,340,210], reads: [['bounds','#track',true,true]] });
test('text and angle have independent lazy caches', `var w=$ax.getWidgetInfo('track');w.width();text='second';angle=70;var first=[w.text(),w.rotation()];text='third';angle=80;return {first:first,last:[w.text(),w.rotation()],reads:reads};`, { first: ['second',70], last: ['second',70], reads: [['bounds','#track',true,true],['text'],['rotation']] });
test('widthchange is not cached but the width used by it is cached', `var w=$ax.getWidgetInfo('track'),a=w.widthchange();old.width=180;rect.width=400;return {a:a,b:w.widthchange(),reads:reads};`, { a: 10, b: 20, reads: [['bounds','#track',true,true]] });
test('StringLiteral alias shares one lazy geometry object within its substitutions', `var value=$ax.expr.evaluateExpr(expr('[[track.x]]/[[track.width]]',[prop('track','x'),prop('track','width')],{track:binding()}),event);return {value:value,reads:reads};`, { value: '10/200', reads: [['bounds','#track',true,true]] });
test('each new StringLiteral reconstructs its alias geometry cache', `var e=expr('[[track.width]]',[prop('track','width')],{track:binding()}),a=$ax.expr.evaluateExpr(e,event);rect.width=350;var b=$ax.expr.evaluateExpr(e,event);return {a:a,b:b,reads:reads};`, { a: '200', b: '350', reads: [['bounds','#track',true,true],['bounds','#track',true,true]] });
test('This is fetched as a fresh widget-info for each STO property access', `var value=$ax.expr.evaluateExpr(expr('[[This.x]]/[[This.width]]',[prop('this','x'),prop('this','width')]),event);return {value:value,reads:reads};`, { value: '10/200', reads: [['bounds','#track',true,true],['bounds','#track',true,true]] });
for (const [value, precision, expected] of [[100/3,0,'33'],[100/3,2,'33.33'],[12.25,undefined,'12'],[12.25,1.9,'12.3'],[NaN,0,'NaN'],[Infinity,0,'Infinity']]) test(`original numeric toFixed ${value}/${precision}`, `return $ax.evaluateSTO(call(lit(${String(value)}),${String(precision)}),{},event);`, expected);
test('original toFixed rejects a string receiver without compiler coercion', `try{return $ax.evaluateSTO(call(variable('count'),0),{},event)}catch(e){return e.name}`, 'TypeError');
test('original toFixed accepts a global receiver with explicit desired float', `return $ax.evaluateSTO(call(variable('count','float'),2),{},event);`, '3.00');
test('out of range original toFixed is retained as the original StringLiteral marker', `return $ax.expr.evaluateExpr(expr('[[(1).toFixed(101)]]',[call(lit(1),101)]),event)`, '[[(1).toFixed(101)]]');

const output = process.argv[2] ?? 'research/runtime-transform-expression-properties-probes.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Choose a new output filename');
const report = { capturedAt: new Date().toISOString(), target: 'Axure RP 11.0.0.4150', sources, ranges: [{ file: 'doc.js', from: 349, through: 543, sha256: hash(docSlice) }], script: { path: 'research/runtime-transform-expression-properties-probe.mjs', sha256: hash(fs.readFileSync(import.meta.filename)) }, summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length }, results, substitutions: ['Original doc.js widget-info consumer is executed, but DOM geometry/text/rotation reads are explicit mutable providers.', 'STO carriers and desiredType are supplied explicitly; native text-to-STO compiler coercion inference is not executed.', 'No GUI, real pointer, or original DLL execution.'] };
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, summary: report.summary, failures: results.filter(r => !r.passed) }));
if (report.summary.failed) process.exitCode = 1;
