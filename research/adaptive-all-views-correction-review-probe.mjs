import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')&&!path.extname(s))return n(`${s}.ts`,c); throw e; } } });
const { createPage, createWidget, mergeWidgetStyle } = await import('../src/model/document.ts');
const { resolveAdaptiveWidgets, applyAdaptiveWidgetEdits } = await import('../src/model/adaptive.ts');
const { resolveWidgetStyleCommand } = await import('../src/components/widget-style-command.ts');
const { patchTableCells } = await import('../src/model/table.ts');
const { createMenu, patchMenuItems } = await import('../src/model/menu.ts');
const { createTree, patchTreeLabel } = await import('../src/model/tree-widget.ts');
const { applyRichTextStyle, patchWidgetTextStyle } = await import('../src/model/rich-text.ts');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const bind = file => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const prior = [
  'research/adaptive-all-views-independent-review.md', 'research/adaptive-all-views-independent-review.json',
  'research/adaptive-all-views-independent-review-probe.mjs',
].map(bind);
if(prior[1].sha256!=='9727ba029b7ed9b2bcfe4cddc2cac807ce2cf1ca53911a8b31fa0f8809916616')throw new Error('Before-fix witness changed');
const sources = [
  'src/App.tsx','src/components/Inspector.tsx','src/components/widget-style-command.ts','src/components/LineStyleEditor.tsx',
  'src/model/adaptive.ts','src/model/types.ts','src/model/document.ts','src/model/adaptive-view-sets.ts','src/model/rich-text.ts',
  'src/model/table.ts','src/model/menu.ts','src/model/tree-widget.ts','src/runtime/export-runtime.ts',
  'tests/adaptive-all-views-padding-selection.test.ts','tests/e2e/adaptive-all-views-multiselect.spec.ts',
].map(bind);
const slices = [];
function extract(file, from, to) {
  const text = fs.readFileSync(file,'utf8'), start=text.indexOf(from), end=text.indexOf(to,start);
  if(start<0||end<0)throw new Error(`Slice missing: ${file}`);
  const source=text.slice(start,end);
  slices.push({path:file,startLine:text.slice(0,start).split('\n').length,endLine:text.slice(0,end).split('\n').length-1,sha256:sha(source)});
  return stripTypeScriptTypes(source);
}
const appSlice=extract('src/App.tsx','  function patchSelected(','\n  function undo(');
const inspectorSlice=extract('src/components/Inspector.tsx','  const updateStyle = (patch: Partial<WidgetStyle>,','  const uniformCorners');
const inspector=fs.readFileSync('src/components/Inspector.tsx','utf8');
const controlStart=inspector.indexOf('onChange={value => { const textPadding = '), controlEnd=inspector.indexOf(' }}/>)',controlStart);
if(controlStart<0||controlEnd<0)throw new Error('Single-side numeric callback missing');
const control=inspector.slice(controlStart+'onChange={'.length,controlEnd+2);
slices.push({path:'src/components/Inspector.tsx',startLine:inspector.slice(0,controlStart).split('\n').length,sha256:sha(control)});
const callback=stripTypeScriptTypes(`const callback = ${control};`);
const results=[];
const check=(name,observed,expected)=>results.push({name,pass:isDeepStrictEqual(observed,expected),observed,expected});

function fixture() {
  const page=createPage('Correction'), widgets=['a','b','equal'].map(id=>Object.assign(createWidget('box'),{id}));page.id='correction';page.widgets=widgets;
  widgets.forEach((w,i)=>{w.style.textPadding=[[1,2,3,4],[51,52,53,54],[81,82,83,84]][i];});
  page.adaptiveViews=[{id:'child',name:'Child',width:390,overrides:{
    a:{style:{textPadding:[11,12,13,14]}},b:{x:123,style:{textPadding:[61,62,63,64],fill:'#123456'}},equal:{style:{textPadding:[91,40,93,94]},stateStyles:{}}
  }}];
  page.adaptiveOverrides={inactive:{a:{style:{textPadding:[21,22,23,24]}},b:{style:{textPadding:[71,72,73,74],color:'#345678'}},equal:{hidden:true,style:{textPadding:[101,102,103,104]}}}};
  return page;
}
function invoke(context, side='right', value=40) {
  const common={selectedTree:undefined,selectedTreeNode:undefined,treeSelection:undefined,activeMenuRoot:undefined,activeMenu:undefined,selectedTable:undefined,tableSelection:undefined,
    mergeWidgetStyle,resolveWidgetStyleCommand,filterLineStylePatch:(_widget,patch)=>patch,
    patchTableCells,patchMenuItems,patchTreeLabel,applyRichTextStyle,patchWidgetTextStyle,
    setNotice:message=>{throw new Error(message)},...context};
  const selected=Function(...Object.keys(common),`return (${appSlice})`)(...Object.values(common));
  const style=common.current.style;
  const updateStyle=Function('style','mergeWidgetStyle','onChange',`${inspectorSlice};return updateStyle;`)(style,mergeWidgetStyle,selected);
  const controlFn=Function('style','updateStyle','index','side',`${callback};return callback;`)(style,updateStyle,['top','right','bottom','left'].indexOf(side),side);
  controlFn(value);
}
function ordinary(page,viewId,allViews,side='right',value=40) {
  const widgets=resolveAdaptiveWidgets(page,viewId);let result;
  invoke({widgets,current:widgets[0],selected:widgets.map(w=>w.id),viewId,placementAllViews:allViews,
    changeWidgets:(edited,_history,explicitTextStyle)=>{result=applyAdaptiveWidgetEdits(page,viewId,edited,{allViews,placementAllViews:allViews,explicitTextStyle,explicitTextWidgetIds:widgets.map(w=>w.id)});}},side,value);
  return result;
}
for(const allViews of [false,true]) {
  const page=fixture(),snapshot=structuredClone(page),out=ordinary(page,'child',allViews);
  check(`right/current-view-${!allViews}/other-edges`,resolveAdaptiveWidgets(out,'child').map(w=>w.style.textPadding),[[11,40,13,14],[61,40,63,64],[91,40,93,94]]);
  check(`right/allViews-${allViews}/base`,out.widgets.map(w=>w.style.textPadding),allViews?[[1,40,3,4],[51,40,53,54],[81,82,83,84]]:page.widgets.map(w=>w.style.textPadding));
  check(`right/allViews-${allViews}/equal-target-byte-preservation`,{base:out.widgets[2],local:out.adaptiveViews[0].overrides.equal,inactive:out.adaptiveOverrides.inactive.equal},{base:page.widgets[2],local:page.adaptiveViews[0].overrides.equal,inactive:page.adaptiveOverrides.inactive.equal});
  check(`right/allViews-${allViews}/inactive-other-sides`,out.adaptiveOverrides.inactive.b,allViews?{style:{color:'#345678'},textPaddingSides:{top:71,bottom:73,left:74}}:page.adaptiveOverrides.inactive.b);
  check(`right/allViews-${allViews}/source-immutable`,page,snapshot);
}
{
  const page=fixture(),out=ordinary(page,null,false);
  check('base/mixed-selection-other-edges',out.widgets.map(w=>w.style.textPadding),[[1,40,3,4],[51,40,53,54],[81,40,83,84]]);
  check('base/all-view-maps-unchanged',{active:out.adaptiveViews,inactive:out.adaptiveOverrides},{active:page.adaptiveViews,inactive:page.adaptiveOverrides});
}
for(const side of ['top','bottom','left']) {
  const page=fixture(),out=ordinary(page,'child',true,side,0),index=['top','right','bottom','left'].indexOf(side);
  const expected=page.widgets.map(w=>{const t=[...w.style.textPadding];t[index]=0;return t});
  check(`allViews/${side}/other-edges`,out.widgets.map(w=>w.style.textPadding),expected);
}
{
  const table=createWidget('table');const cells=table.table.cells;cells[0].style.textPadding=[11,12,13,14];cells[1].style.textPadding=[61,62,63,64];cells[2].style.textPadding=[91,40,93,94];let output;
  invoke({selectedTable:table,tableSelection:{cellIds:cells.slice(0,3).map(c=>c.id)},current:cells[0],changeTable:value=>{output=value}});
  check('table/mixed-cell-targets',output.table.cells.slice(0,3).map(c=>c.style.textPadding),[[11,40,13,14],[61,40,63,64],[91,40,93,94]]);
  check('table/unselected-cells',output.table.cells.slice(3),cells.slice(3));
}
{
  const menu=createMenu(),cell=menu.menu.table.table.cells[0];cell.style.textPadding=[61,62,63,64];let output;
  invoke({activeMenuRoot:menu,activeMenu:menu,menuSelection:{cellId:cell.id},menuCurrent:cell,current:cell,changeMenu:(_root,_id,update)=>{output=update(menu)}});
  check('menu/item-path-keeps-other-edges',output.menu.table.table.cells[0].style.textPadding,[61,40,63,64]);
}
{
  const tree=createTree(),node=tree.tree.nodes[0],label=node.treeNode.label;label.style.textPadding=[61,62,63,64];let output;
  invoke({selectedTree:tree,selectedTreeNode:node,treeSelection:{part:'label'},current:label,changeTree:(_tree,update)=>{output=update(tree)}});
  check('tree/label-path-keeps-other-edges',output.tree.nodes[0].treeNode.label.style.textPadding,[61,40,63,64]);
}
{
  const page=fixture();page.widgets[1].richText={paragraphs:[{runs:[{text:'A',style:{fontSize:18}},{text:'B',style:{fontSize:24}}]}]};page.widgets[1].text='AB';
  const out=ordinary(page,null,false);
  check('base/rich-style-second-pass-keeps-resolved-tuple',out.widgets[1].style.textPadding,[51,40,53,54]);
  check('base/rich-runs-unchanged-by-padding',out.widgets[1].richText,page.widgets[1].richText);
}
for(const type of ['input','textarea','select']) {
  const page=fixture();page.widgets[1]=Object.assign(createWidget(type),{id:'b'});delete page.widgets[1].style.textPadding;page.adaptiveViews[0].overrides.b={};
  const out=ordinary(page,'child',false);
  check(`${type}/fallback-per-target`,resolveAdaptiveWidgets(out,'child')[1].style.textPadding,[7,40,7,7]);
}
for(const entry of sources)if(bind(entry.path).sha256!==entry.sha256)throw new Error(`Source changed during review: ${entry.path}`);
const output={schemaVersion:1,generatedAt:new Date().toISOString(),finding:'AAV-REVIEW-01',status:results.every(r=>r.pass)?'corrected-in-bounded-product-replay':'remaining-failure',prior,sources,slices,
  execution:'Exact extracted current Inspector numeric callback + updateStyle + App.patchSelected, with real widget-style-command and model helpers; Node execution, not browser or native Axure GUI.',
  changesFromOriginalProbe:['Calls the third WidgetStyleEditIntent argument through actual Inspector code rather than fabricating a complete tuple alone.','Imports the new resolveWidgetStyleCommand helper.','Adds current-view, Base, equal-target, other edges, table/menu/tree label, rich second pass and form fallback cases.'],
  sinks:['React hosts changeWidgets/changeTable/changeMenu/changeTree capture the actual callback result; normal widget cases then use real applyAdaptiveWidgetEdits.','The unchanged line-style capability filter is an identity sink for these padding-only commands.'],
  results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).map(r=>r.name),
  boundaries:['No browser/undo/save lifecycle executed here; parent owns real browser regression.','Menu/tree/table paths keep existing shared-content semantics; no additional native containment parity claimed.','Original failed report and probe remain unchanged.']};
const file=process.argv[2]??'research/adaptive-all-views-correction-review.json';
fs.writeFileSync(file,`${JSON.stringify(output,null,2)}\n`,{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({file,status:output.status,passed:output.passed,failed:output.failed}));
if(output.failed.length)process.exitCode=1;
