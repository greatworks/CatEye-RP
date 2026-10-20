import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const sourceRoot = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash = value => createHash('sha256').update(value).digest('hex');
const pins = {
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
  'variables.js': '91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
};
const sources = Object.entries(pins).map(([name, sha256]) => {
  const file = path.join(sourceRoot, name), bytes = fs.readFileSync(file);
  assert.equal(hash(bytes), sha256, name);
  return { path: file, sha256, bytes: bytes.length };
});
const source = name => fs.readFileSync(path.join(sourceRoot, name), 'utf8');
const ranges = [];
const slice = (file, from, through) => {
  const text = source(file).split(/\r?\n/).slice(from - 1, through).join('\n');
  ranges.push({ file, from, through, sha256: hash(text) }); return text;
};
// Inputs, bindings and boxed objects are constructed in the original source's
// realm. Crossing a VM boundary would invalidate instanceof Object evidence.
function harness() {
  const realm = vm.createContext({});
  vm.runInContext(`
    var calls=[], widgets={track:{x:10,width:200,text:'Track'},other:{x:50,width:70,text:'Other'}};
    var $ax = function(){return {offsetLocation:function(){return {left:100,top:200}}}};
    Object.assign($ax,{
      document:{globalVariables:{count:'3',zero:'0',blank:'',falsevalue:'false'}},
      messageCenter:{addMessageListener:function(){}},
      getElementIdsFromPath:function(path){return path},
      getWidgetInfo:function(id){calls.push(id);return Object.assign({},widgets[id])},
      drag:{GetDragX:function(){return 0},GetDragY:function(){return 0},GetTotalDragX:function(){return 0},GetTotalDragY:function(){return 0},GetDragTime:function(){return 600000}}
    });
    var $axure={internal:function(fn){fn($ax)}},window={};
    var $=function(){return {scrollLeft:function(){return 0},scrollTop:function(){return 0}}};
    var $jobj=function(){return {css:function(){return 'absolute'}}};
    var SAFARI=false,IOS=false,SHARE_APP=false;
    function lit(value,type){var out={sto:'literal',value:value};if(type)out.computedType=type;return out}
    function variable(name,type){var out={sto:'var',name:name};if(type)out.desiredType=type;return out}
    function prop(name,key){return {sto:'propCall',thisSTO:variable(name),prop:key}}
    function bin(op,left,right,type){var out={sto:'binOp',op:op,leftSTO:left,rightSTO:right};if(type)out.computedType=type;return out}
    function stringExpr(text,stos,locals){return {exprType:'stringLiteral',value:text,stos:stos||[],localVariables:locals||{}}}
    function binding(id){return {exprType:'fcall',functionName:'GetWidget',arguments:[{exprType:'pathLiteral',value:[id]}]}}
    function describe(value){return {type:typeof value,tag:Object.prototype.toString.call(value),value:value}}
    var event={srcElement:'source',targetElement:'target',thiswidget:{elementId:'track'},window:{width:1280,height:720},dragInfo:{}};
  `, realm);
  for (const name of ['variables.js', 'sto.js', 'expr.js']) vm.runInContext(source(name), realm, { timeout: 1500 });
  vm.runInContext(slice('action.js', 866, 1042) + '\n' + slice('action.js', 1045, 1059) + '\nglobalThis.move = _getMoveLoc;', realm);
  return code => JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})(),function(k,v){return typeof v==='number'&&!Number.isFinite(v)?{$number:String(v)}:v})`, realm, { timeout: 1500 }));
}
const results = [];
function test(name, code, expected) {
  try { const actual = harness()(code); assert.deepEqual(actual, expected); results.push({ name, passed: true, actual }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
const described = (value, type = typeof value, tag = `[object ${type[0].toUpperCase()}${type.slice(1)}]`) => ({ type, tag, value });
for (const [label, text, sto, expected] of [
  ['literal zero', '0', null, '0'], ['numeric expression zero', '[[0]]', 'lit(0)', '0'],
  ['string expression zero', '[["0"]]', 'lit("0")', '0'], ['numeric false', '[[false]]', 'lit(false)', 'false'],
  ['empty literal', '', null, ''], ['empty expression', '[[""]]', 'lit("")', ''],
  ['undefined expression', '[[Missing]]', 'lit(undefined)', 'undefined'],
  ['mixed number', 'A[[0]]B', 'lit(0)', 'A0B'], ['NaN expression', '[[NaN]]', 'lit(NaN)', 'NaN'],
  ['computed numeric cast', '[["0"]]', 'lit("0","float")', '0'],
]) test(`StringLiteral ${label}`, `return describe($ax.expr.evaluateExpr(stringExpr(${JSON.stringify(text)},${sto ? `[${sto}]` : '[]'}),event));`, described(expected));
for (const [label, expression, expected] of [
  ['raw numeric literal', 'lit(0)', 0], ['raw boolean literal', 'lit(false)', false],
  ['raw global string', 'variable("count")', '3'], ['global desired float', 'variable("count","float")', 3],
  ['plus numeric strings', 'bin("+",lit("1"),lit("2"))', 3],
  ['plus empty and number', 'bin("+",lit(""),lit(2))', 2],
  ['plus mixed text', 'bin("+",lit("x"),lit(2))', 'x2'],
  ['plus numeric result cast string', 'bin("+",lit("1"),lit("2"),"string")', '3'],
  ['comparison converts both numeric strings', 'bin("<",lit("10"),lit("2"))', false],
  ['logical false string normalization', 'bin("&&",lit("FALSE"),lit(8))', false],
  ['Window width is numeric', 'prop("window","width")', 1280],
  ['This geometry is numeric', 'prop("this","width")', 200],
]) test(`STO ${label}`, `return describe($ax.evaluateSTO(${expression},{},event));`, described(expected));
test('STO logical branches are eagerly evaluated', `try{$ax.evaluateSTO(bin("&&",lit(false),{sto:'propCall',thisSTO:lit(null),prop:'width'}),{},event);return 'no error'}catch(e){return e.name}`, 'TypeError');
test('StringLiteral catches an STO error and retains the original marker', `return $ax.expr.evaluateExpr(stringExpr('[[Missing.width]]',[{sto:'propCall',thisSTO:lit(null),prop:'width'}]),event)`, '[[Missing.width]]');
test('an unknown global is empty text and its absent property is undefined', `return describe($ax.evaluateSTO(prop('missing','width'),{},event));`, { type: 'undefined', tag: '[object Undefined]' });
test('one complete object expression returns the same-realm object', `return describe($ax.expr.evaluateExpr(stringExpr('[[track]]',[variable('track')],{track:binding('track')}),event));`, described({ x: 10, width: 200, text: 'Track' }, 'object', '[object Object]'));
test('mixed object expression substitutes its text', `return $ax.expr.evaluateExpr(stringExpr('X[[track]]Y',[variable('track')],{track:binding('track')}),event);`, 'XTrackY');
test('two complete object expressions substitute their texts', `return $ax.expr.evaluateExpr(stringExpr('[[track]][[track]]',[variable('track'),variable('track')],{track:binding('track')}),event);`, 'TrackTrack');
test('StringLiteral creates fresh binding snapshots per evaluation', `var expr=stringExpr('[[track.width]]',[prop('track','width')],{track:binding('track')});var a=$ax.expr.evaluateExpr(expr,event);widgets.track.width=333;var b=$ax.expr.evaluateExpr(expr,event);return {a:a,b:b,calls:calls};`, { a: '200', b: '333', calls: ['track', 'track'] });
test('all local bindings rebuild even when text has no markers', `var value=$ax.expr.evaluateExpr(stringExpr('plain',[],{track:binding('track'),unused:binding('other')}),event);return {value:value,calls:calls};`, { value: 'plain', calls: ['track', 'other'] });
test('bindings do not leak to the next StringLiteral', `var a=$ax.expr.evaluateExpr(stringExpr('[[track.width]]',[prop('track','width')],{track:binding('track')}),event);var b=$ax.expr.evaluateExpr(stringExpr('[[track.width]]',[prop('track','width')]),event);return {a:a,b:b};`, { a: '200', b: 'undefined' });
for (const [name, expr, expected] of [
  ['literal zero', `stringExpr('0')`, -100], ['whole numeric zero', `stringExpr('[[0]]',[lit(0)])`, -100],
  ['whole string zero', `stringExpr('[["0"]]',[lit('0')])`, -100],
  ['empty string', `stringExpr('')`, 0], ['numeric option carrier', `{exprType:'optionLiteral',value:0}`, 0],
]) test(`Complete expression to Move ${name}`, `var x=${expr};return move('target',{moveType:'location',xValue:x,yValue:stringExpr('')},event,{instant:true},{},{}).x;`, expected);

const output = process.argv[2] ?? 'research/runtime-transform-expression-first-probes.json';
assert.ok(!fs.existsSync(path.join(root, output)), 'Choose a new output; preserve evidence');
const uniqueRanges = ranges.filter((entry, i) => ranges.findIndex(other => other.file === entry.file && other.from === entry.from) === i);
const report = { capturedAt: new Date().toISOString(), target: 'Axure RP 11.0.0.4150', execution: 'Complete retained expr.js, sto.js, variables.js and exact Move helper in one VM realm', sources, ranges: uniqueRanges, script: { path: 'research/runtime-transform-expression-probe.mjs', sha256: hash(fs.readFileSync(import.meta.filename)) }, summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length }, results, substitutions: ['STO objects and StringLiteral carriers are explicit controlled inputs, not compiled by the native DLL.', 'GetWidget geometry/text snapshots, element path resolution, window and offsets use declared facades.', 'No browser pointer or original editor GUI; no native DLL methods executed.'], originalAxureGuiCompared: false, originalDllExecuted: false };
fs.writeFileSync(path.join(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, summary: report.summary, failures: results.filter(r => !r.passed) }));
if (report.summary.failed) process.exitCode = 1;
