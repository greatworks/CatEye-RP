// Read-only source extraction plus isolated original-function experiments.
// No Axure app, full runtime, DOM, network, or expression compiler is executed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const sourceBase = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const output = process.argv[3] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../repeater-query-evidence.json');
const expected = {
  'repeater.js': 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'doc.js': '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'variables.js': '91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
};
const files = {}, hashes = {};
for (const file of [...Object.keys(expected), 'expr.js']) {
  const bytes = fs.readFileSync(path.join(sourceBase, file));
  hashes[file] = crypto.createHash('sha256').update(bytes).digest('hex');
  if (expected[file] && hashes[file] !== expected[file]) throw new Error(`Source hash mismatch: ${file}`);
  files[file] = bytes.toString('utf8').split(/\r?\n/);
}
const ranges = {
  'repeater.js': [[60,71],[605,669],[671,1013],[1291,1316],[1332,1340],[1483,1490],[1503,1519]],
  'doc.js': [[328,346]], 'variables.js': [[33,85]], 'sto.js': [[116,126]], 'action.js': [[1856,1934]],
};
const source = Object.entries(ranges).flatMap(([file, spans]) => spans.map(([a,b]) => files[file].slice(a - 1, b).join('\n'))).join('\n');
const clone = x => JSON.parse(JSON.stringify(x));
function nativeRows(rows) {
  const result = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, text]) => [key, { text }])));
  result.props = [...new Set(rows.flatMap(row => Object.keys(row)))]; return result;
}
function create(rows) {
  const evaluations = [], logs = [], widgetTexts = { outside: '3' }, absentElements = new Set();
  const data = nativeRows(rows);
  const sandbox = {
    _repeaterManager: {}, _stoHandlers: {}, _globalVariableProvider: {}, _globalVariableValues: { limit: '3' },
    _actionHandlers: {}, _ignoreAction: () => false, _addRefresh: id => logs.push(['refresh', id]), _dispatchAction: () => {},
    repeaterInfoCache: {}, repeaterToCurrentDataSet: { r: data }, repeaterToLocalDataSet: { r: data },
    repeaterToActiveDataSet: {}, repeaterToFilters: { r: [] }, repeaterToSorts: { r: [] }, repeaterToPageInfo: { r: { noLimit: true } },
    console: { log: (...args) => logs.push(args) }, _getParentElement: id => id,
    $jobj: id => ({ length: absentElements.has(id) ? 0 : 1 }),
  };
  const getWidgetInfo = id => ({ elementId: id, text: () => widgetTexts[id] ?? '' });
  sandbox._getWidgetInfo = getWidgetInfo;
  sandbox.$ax = {
    deepCopy: structuredClone, splice: (a, i, n) => a.splice(i, n), document: { globalVariables: {} },
    getWidgetInfo, getBasicEventInfo: () => ({}), getElementIdsFromPath: path => [path[0]], adaptive: { getSketchKey: () => 'default' },
    getParentRepeaterFromScriptId: id => id === 'r' || id === 'source' ? 'r' : undefined,
    expr: { evaluateExpr: (expr, event) => {
      evaluations.push({ expression: expr?.id ?? 'literal', source: event?.srcElement, target: event?.targetElement });
      return expr?.fn ? expr.fn(event, sandbox) : expr?.value;
    } },
  };
  vm.createContext(sandbox); vm.runInContext(source, sandbox, { timeout: 1000 });
  sandbox.$ax.repeater = sandbox._repeaterManager;
  sandbox.$ax.repeater.isEditItem = () => false;
  sandbox.$ax.getItemInfo = sandbox._getItemInfo;
  sandbox.$ax.globalVariableProvider = sandbox._globalVariableProvider;
  sandbox.repeaterToActiveDataSet.r = sandbox.getActiveDataSet('r');
  const col = (event, name, target = false) => sandbox._stoHandlers.item({ name, isTarget: target }, {}, event);
  const expr = (id, fn) => ({ id, fn });
  const filter = (label, fn, { removeOthers = false, column, mode = 1, sourceId = 'outside', id = label } = {}) => sandbox._addFilter('r', removeOthers, label, expr(id, fn), undefined, column, mode, sourceId);
  const sort = (label, column, ascending = true, type = 1, toggle = false, removeOthers = false) => sandbox._addSort('r', label, column, ascending, toggle, type, removeOthers);
  const order = event => sandbox.getOrderedIds('r', event).map(id => rows[id - 1]?.ID ?? id);
  const ruleState = () => ({ filters: sandbox.repeaterToFilters.r.map(f => ({ label: f.label, column: f.columnName, mode: f.comboType, source: f.thisId, expression: f.filter?.id })), sorts: clone(sandbox.repeaterToSorts.r) });
  return { sandbox, filter, sort, order, ruleState, col, expr, evaluations, logs, widgetTexts, absentElements };
}

const result = {
  version: '11.0.0.4150', packageSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
  extractionEvidenceId: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
  sourceBase, hashes, ranges, engine: { node: process.version, defaultLocale: Intl.DateTimeFormat().resolvedOptions().locale },
  method: 'Only listed original function slices run in fresh Node VM. No full expression compiler/evaluator or DOM is loaded. Most predicates use deterministic callbacks and widget text/presence bridges; nativeExpressionWrapper additionally runs the original stringLiteral/substituteSTOs/evaluateExpr chain with an Item-only STO bridge. Original variable-provider and Item-column accessor slices run. Native cell shape is {text}; no source code is copied into product.',
  experiments: {},
};
const e = result.experiments;
{
  const p = create([{ID:'one'}]);
  const values = [true,false,'true','false','TRUE','True',' true ','',0,1,'0','1','anything',null,undefined];
  e.filterTruth = values.map(value => ({ type: typeof value, value: value === undefined ? '(undefined)' : value, passes: p.sandbox._evaluateFilter({ filter:{ value } }, {}) }));
}
{
  const p = create([{ID:'A',X:'1'},{ID:'B',X:'2'},{ID:'C',X:'3'}]);
  p.filter('same', ev => Number(p.col(ev,'X')) > 1);p.filter('same', ev => Number(p.col(ev,'X')) < 3);
  p.filter('Same', () => true);const before = p.ruleState();const ids = p.order();
  p.sandbox._removeFilter('r','same');const after = p.ruleState();const afterIds=p.order();
  p.filter('replacement',()=>true,{removeOthers:true});e.filterNames={before,ids,after,afterIds,replaced:p.ruleState()};
}
{
  const rows = [{ID:'A',Color:'red',Size:'small'},{ID:'B',Color:'blue',Size:'large'},{ID:'C',Color:'green',Size:'large'},{ID:'D',Color:'red',Size:'large'}];
  e.filterCombination=[];
  for(const mode of [0,1,2,undefined,9]) {
    const p=create(rows);p.filter('red',ev=>p.col(ev,'Color')==='red',{column:'Color',mode:1});p.filter('blue',ev=>p.col(ev,'Color')==='blue',{column:'Color',mode:1});p.filter('large',ev=>p.col(ev,'Size')==='large',{column:'Size',mode:1});
    p.filter('not B',ev=>p.col(ev,'ID')!=='B',{mode});if(mode===undefined)p.sandbox.repeaterToFilters.r.at(-1).comboType=undefined;
    const ids=p.order(),evals=clone(p.evaluations);p.sandbox._removeFilter('r','not B');e.filterCombination.push({mode:mode??'(undefined)',ids,evals,afterRemoveLatest:p.order(),logs:p.logs});
  }
}
{
  const p=create([{ID:'A',X:'1'},{ID:'B',X:'2'},{ID:'C',X:'3'}]);
  p.filter('live', (ev,b)=>Number(p.col(ev,'X'))<Number(b._globalVariableProvider.getVariableValue('limit',ev)) && Number(p.col(ev,'X'))<Number(b._globalVariableProvider.getVariableValue('This',ev).text()));
  const callsAtAdd=p.evaluations.length, initial=p.order();p.sandbox._globalVariableValues.limit='2';const afterGlobal=p.order();p.sandbox._globalVariableValues.limit='4';p.widgetTexts.outside='4';const afterWidget=p.order();
  e.dynamicValues={callsAtAdd,initial,afterGlobal,afterWidget,evaluations:p.evaluations};
}
{
  const p=create([{ID:'A',X:'1'},{ID:'B',X:'2'},{ID:'C',X:'3'}]);
  p.filter('source-vs-target',ev=>p.col(ev,'X')<p.col(ev,'X',true),{sourceId:'source-2'});
  const initial=p.order();p.absentElements.add('source-2');const hidden=p.order();
  const sourceInfo=p.sandbox._getItemInfo('source-2');p.sandbox.repeaterToCurrentDataSet.r[1].X.text='4';const changedSource=p.order();
  const readSource=()=>p.col({srcElement:'source-2',targetElement:'r-1'},'X');const beforeDeleteSourceValue=readSource();
  p.sandbox.repeaterToCurrentDataSet.r.splice(1,1);const afterDelete=p.order(),afterDeleteSourceValue=readSource();
  let beyondEnd;try{p.sandbox.repeaterToCurrentDataSet.r.splice(1,1);p.order();beyondEnd='no error';}catch(error){beyondEnd=String(error)}
  e.sourceRowBinding={initial,hidden,hiddenSourceValid:sourceInfo.valid,hiddenSourceVisible:sourceInfo.isvisible,changedSource,beforeDeleteSourceValue,afterDeleteSourceValue,afterDelete,beyondEnd,exceptionBoundary:'Raw original Item accessor through callback expression; see nativeExpressionWrapper for actual stringLiteral catch behavior.'};
}
{
  const p=create([{ID:'A',X:'1'},{ID:'B',X:'2'}]);p.sandbox.repeaterToCurrentDataSet.s=nativeRows([{Other:'other'}]);
  p.sandbox.$ax.getParentRepeaterFromScriptId=id=>id==='other'?'s':id==='r'||id==='source'?'r':undefined;
  const ev={srcElement:'other-1',targetElement:'r-2'};e.missingSourceColumnFallback={sourceHasX:p.sandbox.$ax.repeater.hasData('other-1','X'),itemX:p.col(ev,'X'),targetX:p.col(ev,'X',true)};
}
{
  const p=create([{ID:'A',X:'2',Y:'b'},{ID:'B',X:'1',Y:'b'},{ID:'C',X:'3',Y:'a'}]);
  p.sort('same','X');p.sort('same','Y',true,3);const twoRules=p.ruleState(),latestWins=p.order();
  p.sort('new','X',true,1,true);const afterToggle=p.ruleState(),toggleOrder=p.order();
  p.sandbox._removeSort('r','same');const removed=p.ruleState();p.sort('only','Y',false,3,false,true);
  e.sortNamesAndPriority={twoRules,latestWins,afterToggle,toggleOrder,removed,removeOthers:p.ruleState()};
}
{
  const p=create([{ID:'A',X:'1',Y:'2'},{ID:'B',X:'2',Y:'1'}]);p.sort('same','X');p.sort('same','Y');p.sort('Same','Z',true,2);p.sandbox._removeSort('r','same');e.removeAllMatchingSortNames=p.ruleState();p.sandbox._removeSort('r');e.removeAllSorts=p.ruleState();
}
{
  const entries=[['missing',undefined],['empty',''],['space',' '],['zero','0'],['decimal','2'],['zeroPad','02'],['ten','10'],['negative','-1'],['bad','x'],['upper','A'],['lower','a'],['exponent','1e1'],['infinity','Infinity']];
  const rows=entries.map(([ID,X])=>({ID,...(X===undefined?{}:{X})}));e.sortTypes=[];
  for(const type of [1,2,3,4])for(const ascending of [true,false]){const p=create(rows);p.sort('test','X',ascending,type);e.sortTypes.push({type,ascending,order:p.order()});}
  e.sortInputs=entries.map(([ID,value])=>({ID,value:value??'(missing)'}));
}
{
  e.tieCases=[];
  for(const [name,type,values]of[['identical numeric text',1,['2','2','2']],['equal numeric different text',1,['2','02','2.0']],['distinct invalid numeric text',1,['bad','no','NaN']],['same invalid numeric text',1,['bad','bad','bad']],['equal date different text',16,['2024-1-1','2024/01/01','2024-01-01']],['alpha lowercase ties',2,['B','b','B']],['alphanumeric collator equals',4,['2','02','002']]])for(const ascending of[true,false]){
    const rows=values.map((X,i)=>({ID:String.fromCharCode(65+i),X,Secondary:['2','3','1'][i]}));const p=create(rows);p.sort('secondary','Secondary',true,1);p.sort('primary','X',ascending,type);e.tieCases.push({name,type,ascending,rows,order:p.order()});
  }
}
{
  const dateInput=['2024-02-29','2023-02-29','2024/1/2','2024-2-30','2024-2.5-1','2024-1-1.5','-1-1','Infinity-1-1','2024--1','2024-1-0'];
  const p=create([]);e.dateParsing=dateInput.map(text=>({text,ymd:p.sandbox.getDate1(text)}));
  e.dateTypes=[];for(const [type,dates]of[[16,['2024-01-02','2023/12/31','bad','']],[17,['01-02-2024','12/31/2023','bad','']],[18,['02-01-2024','31/12/2023','bad','']]])for(const ascending of[true,false]){const rows=dates.map((X,i)=>({ID:String.fromCharCode(65+i),X}));const p=create(rows);p.sort('date','X',ascending,type);e.dateTypes.push({type,ascending,dates,order:p.order()});}
}
{
  const p=create([{ID:'A',X:'1'},{ID:'B',X:'2'},{ID:'C',X:'3'},{ID:'D',X:'4'},{ID:'E',X:'5'}]);
  p.sandbox.repeaterToPageInfo.r={itemsPerPage:2,currPage:3};p.filter('keep',ev=>Number(p.col(ev,'X'))<4);p.sort('desc','X',false,1);
  const order=p.order(),before=clone(p.sandbox.repeaterToPageInfo.r),bounds=p.sandbox._getVisibleDataBounds(p.sandbox.repeaterToPageInfo.r,order.length);
  e.pagination={order,before,bounds,after:clone(p.sandbox.repeaterToPageInfo.r),visible:order.slice(...bounds)};
  p.sandbox._setRepeaterDataSet('r','r');e.datasetReset=p.ruleState();
}
{
  const p=create([{ID:'A'}]);p.filter('same',()=>true);p.filter('same',()=>true);p.sandbox._removeFilter('r');e.removeAllFilters=p.ruleState();
  const original={srcElement:'caller',targetElement:'oldTarget',thiswidget:{elementId:'caller'},item:{valid:false}};const before=clone(original);p.filter('true',()=>true);p.order(original);e.eventRestoration={before,after:clone(original)};
}
{
  const p=create([{ID:'A',X:'1'}]);p.filter('[[Name]]',()=>true);p.sort('[[Name]]','X');
  const event={srcElement:'outside'};
  const remove=(kind,name,all=false)=>p.sandbox._actionHandlers[kind==='filter'?'removeFilterFromRepeater':'removeSortFromRepeater'](event,[{[kind==='filter'?'repeatersToRemoveFilter':'repeatersToRemoveSort']:[{path:['r'],removeAll:all,[kind==='filter'?'filterName':'sortName']:name}]}],0);
  remove('filter','');remove('sort','');const afterEmpty=p.ruleState();remove('filter','Name');remove('sort','Name');const afterNonliteral=p.ruleState();remove('filter','[[Name]]');remove('sort','[[Name]]');const afterExact=p.ruleState();
  p.filter('new',()=>true);p.sort('new','X');remove('filter','ignored',true);remove('sort','ignored',true);
  e.removeActionOptions={afterEmpty,afterNonliteral,afterExact,afterAll:p.ruleState(),evaluations:p.evaluations,refreshes:p.logs};
}
{
  const p=create([{ID:'A',X:'1'},{ID:'B',X:'2'}]);
  const spans=[[204,244],[760,764]];
  vm.runInContext('var _exprHandlers={}; var _exprFunctions={ToString:String};\n'+spans.map(([a,b])=>files['expr.js'].slice(a-1,b).join('\n')).join('\n'),p.sandbox,{timeout:1000});
  p.sandbox.$ax.evaluateSTO=(sto,scope,event)=>p.sandbox._stoHandlers[sto.sto](sto,scope,event);
  const expr={exprType:'stringLiteral',value:'[[Item.X]]',localVariables:{},stos:[{sto:'item',name:'X'}]};
  p.sandbox._addFilter('r',false,'native-wrapper',expr,undefined,undefined,1,'source-2');
  p.sandbox.repeaterToCurrentDataSet.r.splice(1,1);
  const event={srcElement:'source-2',targetElement:'r-1'},result=p.sandbox.$ax.expr.evaluateExpr(expr,event),ids=p.order();
  p.sandbox._exprHandlers.controlledFailure=()=>{throw new Error('controlled local-variable fault');};
  let outsideCatch;try{p.sandbox.$ax.expr.evaluateExpr({...expr,localVariables:{L:{exprType:'controlledFailure'}}},event);outsideCatch='no error';}catch(error){outsideCatch=String(error)}
  e.nativeExpressionWrapper={ranges:{'expr.js':spans},result,filterPasses:p.sandbox._evaluateFilter({filter:expr},event),ids,outsideCatch,scope:'Original stringLiteral/substituteSTOs/evaluateExpr plus original Item accessor; tiny evaluateSTO bridge dispatches the item handler only. Controlled failure checks local-variable boundary, not a generated RP expression.'};
}
{
  const p=create(['A','B','C','D','E'].map((ID,i)=>({ID,X:String(i+1)}))),metadata=[];
  p.sandbox.repeaterToPageInfo.r={itemsPerPage:2,currPage:2};p.sort('desc','X',false,1);
  p.filter('index-one',ev=>{const item=p.sandbox.$ax.getItemInfo(ev.targetElement);metadata.push({target:ev.targetElement,index:item.index??null,isFirst:item.isfirst??null,isLast:item.islast??null});return item.index===1;});
  const order=p.order();e.filterMetadataStage={paging:clone(p.sandbox.repeaterToPageInfo.r),metadata,order,note:'Metadata sees fresh unfiltered source order and existing page 2; sorting and final pagination have not run.'};
}
assert.deepEqual(e.filterTruth.filter(x=>x.passes).map(x=>[x.type,x.value]),[['boolean',true],['string','true']]);
assert.deepEqual(Array.from(e.filterNames.ids),['B']);
assert.deepEqual(Array.from(e.filterCombination[0].ids),['D']);
assert.equal(e.dynamicValues.callsAtAdd,0);
assert.deepEqual(Array.from(e.dynamicValues.afterGlobal),['A']);
assert.equal(e.sourceRowBinding.afterDeleteSourceValue,'3');
assert.match(e.sourceRowBinding.beyondEnd,/undefined/);
assert.deepEqual(Array.from(e.sortNamesAndPriority.latestWins),['C','B','A']);
assert.equal(e.removeActionOptions.afterEmpty.filters.length,1);
assert.equal(e.removeActionOptions.afterExact.filters.length,0);
assert.equal(e.removeActionOptions.refreshes.length,8);
assert.equal(e.nativeExpressionWrapper.result,'[[Item.X]]');
assert.equal(e.nativeExpressionWrapper.filterPasses,false);
assert.match(e.nativeExpressionWrapper.outsideCatch,/controlled local-variable fault/);
assert.deepEqual(Array.from(e.filterMetadataStage.order),['C']);
result.probeAssertions=15;
fs.writeFileSync(output,JSON.stringify(result,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?{$number:String(v)}:v,2)+'\n','utf8');
console.log(JSON.stringify({output,categories:Object.keys(e),verifiedHashes:Object.keys(hashes),method:result.method},null,2));
