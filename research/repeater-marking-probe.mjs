// Research only: execute selected, SHA-pinned vendor functions with explicit mocks.
// This never loads the vendor app, browser runtime, DLL, network, or product source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'repeater.js': 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'doc.js': '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'variables.js': '91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
};
const source = new Map();
const files = Object.entries(pins).map(([name, sha256]) => {
  const sourcePath = path.join(root, name), bytes = fs.readFileSync(sourcePath);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256, `Source identity changed: ${name}`);
  source.set(name, bytes.toString('utf8').split(/\r?\n/));
  return { name, path: sourcePath, bytes: bytes.length, sha256 };
});
const spans = [
  ['repeater.js', 13, 44, 'initialization'],
  ['repeater.js', 59, 84, 'dataset-reference-and-reset'],
  ['repeater.js', 605, 625, 'display-properties'],
  ['repeater.js', 671, 693, 'copy-filter-sort'],
  ['repeater.js', 929, 941, 'filter-expression-context'],
  ['repeater.js', 1015, 1068, 'pagination-does-not-mutate-marks'],
  ['repeater.js', 1291, 1309, 'column-data-live-read'],
  ['repeater.js', 1318, 1481, 'row-mutation-and-mark-membership'],
  ['action.js', 128, 140, 'refresh-guard'],
  ['action.js', 1745, 1785, 'mark-unmark-action'],
  ['action.js', 1793, 1839, 'add-delete-update-refresh'],
  ['doc.js', 291, 299, 'event-item-snapshot'],
  ['doc.js', 328, 347, 'item-metadata'],
  ['variables.js', 33, 65, 'item-targetitem-provider'],
  ['sto.js', 97, 125, 'variable-versus-column'],
  ['sto.js', 145, 161, 'metadata-property-read'],
];
const excerpts = spans.map(([file, startLine, endLine, purpose]) => ({ file, startLine, endLine, purpose, text: source.get(file).slice(startLine - 1, endLine).join('\n') }));
const slice = (file, first, last) => source.get(file).slice(first - 1, last).join('\n');
const extracted = [
  slice('repeater.js', 1318, 1340),
  slice('repeater.js', 1364, 1449),
  slice('repeater.js', 1451, 1481),
  slice('action.js', 1745, 1785),
  slice('doc.js', 328, 347),
  slice('variables.js', 33, 85),
].join('\n');
const bootstrap = `
var repeaterToEditItems = {r:[],other:[]};
var repeaterToCurrentDataSet = {r:[{value:'A'},{value:'B'},{value:'C'},{value:'D'}],other:[{value:'X'}]};
var _repeaterManager = {}, _actionHandlers = {}, _globalVariableProvider = {}, _globalVariableValues = {}, repeaterInfoCache = {};
var calls = { refresh:0, next:0, display:[] };
var _addRefresh = function(){ calls.refresh++; };
var _dispatchAction = function(){ calls.next++; };
var _getParentElement = function(id){return id;}, _getWidgetInfo = function(){return {};}, $jobj = function(){return {length:1};};
var _getItemIdFromElementId = function(id){return id && Number(id.split('-')[1]);};
var _createElementId = function(id,index){return id+'-'+index;};
var $ax = {
  repeater:_repeaterManager,
  document:{globalVariables:{}},
  getElementIdsFromPath:function(p){return [p];},
  getParentRepeaterFromScriptId:function(id){return id;},
  deepCopy:function(x){return JSON.parse(JSON.stringify(x));},
  splice:function(x,i,n){return x.splice(i,n);},
  expr:{evaluateExpr:function(rule,event){return typeof rule==='function'?rule(event):rule;}}
};
_repeaterManager.getScriptIdFromElementId=function(id){return id && id.split('-')[0];};
_repeaterManager.getItemIdFromElementId=_getItemIdFromElementId;
_repeaterManager.createElementId=_createElementId;
_repeaterManager.setDisplayProps=function(obj,id,index){ calls.display.push(index); };
function mark(add,type,event,path='r',rule){
  var action = {}; action[add?'repeatersToAddTo':'repeatersToRemoveFrom']=[{path:path,type:type,rule:rule}];
  _actionHandlers.modifyDataSetEditItems(event,[action],0);
}
`;
const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
vm.runInContext(bootstrap + extracted, context, { timeout: 1000 });
const results = [];
function probe(name, code, expected) {
  const actual = JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})())`, context, { timeout: 1000 }));
  assert.deepEqual(actual, expected, name);
  results.push({ name, pass: true, actual });
}
probe('All scans the entire dataset and duplicate marks remain unique', `
  mark(true,'all',{}); mark(true,'all',{});
  return {marks:repeaterToEditItems.r,refresh:calls.refresh};
`, { marks: [1, 2, 3, 4], refresh: 0 });
probe('Unmark This uses the source row and source repeater', `
  mark(false,'this',{srcElement:'r-2'},'other');
  return {r:repeaterToEditItems.r,other:repeaterToEditItems.other};
`, { r: [1, 3, 4], other: [] });
probe('Rule targets every row, retains source Item, restores target, and mutates after selection', `
  repeaterToEditItems.r=[];
  var seen=[],e={srcElement:'r-2',item:$ax.getItemInfo('r-2'),targetElement:'original'};
  mark(true,'rule',e,'r',function(info){
    seen.push({target:info.targetElement,item:getVariableValue('Item',info).ismarked,marks:repeaterToEditItems.r.length});
    return Number(info.targetElement.split('-')[1]) % 2 === 0 ? 'true':'false';
  });
  return {marks:repeaterToEditItems.r,target:e.targetElement,seen:seen};
`, { marks: [2, 4], target: 'original', seen: [1, 2, 3, 4].map(i => ({ target: `r-${i}`, item: false, marks: 0 })) });
probe('Item marked metadata is event snapshot; TargetItem is a live membership read', `
  repeaterToEditItems.r=[];
  var e={srcElement:'r-2',targetElement:'r-2',item:$ax.getItemInfo('r-2')};
  mark(true,'this',e);
  return {item:getVariableValue('Item',e).ismarked,target:getVariableValue('TargetItem',e).ismarked,newEvent:$ax.getItemInfo('r-2').ismarked};
`, { item: false, target: true, newEvent: true });
probe('Item outside a row falls back to TargetItem', `
  return getVariableValue('Item',{item:{valid:false},targetElement:'r-2'}).ismarked;
`, true);
probe('Marked is not a dedicated Mark/Unmark target branch', `
  repeaterToEditItems.r=[2,4]; var evaluations=0;
  mark(false,'marked',{},'r',function(){evaluations++;return 'false';});
  return {evaluations:evaluations,marks:repeaterToEditItems.r};
`, { evaluations: 4, marks: [2, 4] });
probe('Update Marked touches all marked source rows and preserves marks', `
  _repeaterManager.updateEditItems('r',{value:{type:'literal',literal:function(e){return e.targetElement;}}},{},'marked');
  return {values:repeaterToCurrentDataSet.r.map(x=>x.value),marks:repeaterToEditItems.r};
`, { values: ['A', { type: 'text', text: 'r-2' }, 'C', { type: 'text', text: 'r-4' }], marks: [2, 4] });
probe('Deleting an unmarked predecessor preserves the remaining marked row identities', `
  _repeaterManager.deleteItems('r',{srcElement:'r-1'},'this');
  return {values:repeaterToCurrentDataSet.r.map(x=>x.value),marks:repeaterToEditItems.r};
`, { values: [{ type: 'text', text: 'r-2' }, 'C', { type: 'text', text: 'r-4' }], marks: [1, 3] });
probe('Delete Marked copies the target set, deletes descending, and removes deleted marks', `
  _repeaterManager.deleteItems('r',{},'marked');
  return {values:repeaterToCurrentDataSet.r.map(x=>x.value),marks:repeaterToEditItems.r};
`, { values: ['C'], marks: [] });
const evidence = {
  version: 1, target: 'Axure RP 11.0.0.4150', method: 'Read-only static source plus isolated SHA-pinned function probes with explicit mocks; no original app execution',
  files, excerpts, probe: { count: results.length, results, limitations: ['DOM, renderer, generated action JSON, and full event scheduler are mocked or absent.', 'Does not prove original-browser UI behavior, generator spelling normalization, or same-event deletion-map edge cases.'] },
};
fs.writeFileSync(new URL('./repeater-marking-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ pass: true, probes: results.length, sourceFiles: files.length, excerpts: excerpts.length }));
