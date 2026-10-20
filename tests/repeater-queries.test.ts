import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { readFileSync } from 'node:fs';
import { createDocument, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Interaction, RepeaterSortSpec } from '../src/model/types';

const event = (actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Query', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
const standardRows = [
  { ID: 'A', Team: 'red', X: '3', Secondary: 'b' }, { ID: 'B', Team: 'blue', X: '2', Secondary: 'a' },
  { ID: 'C', Team: 'red', X: '1', Secondary: 'a' }, { ID: 'D', Team: 'green', X: '4', Secondary: 'b' },
];
function fixture(portable: boolean, rows: Record<string,string>[] = standardRows, evaluate = evaluateExpression) {
  const doc = createDocument(), list = createWidget('repeater'), input = createWidget('input'), button = createWidget('button');
  doc.caseSelection = 'never'; doc.variables = { Minimum: '0', Trace: '' }; button.text = '3';
  list.repeater = { columns: ['ID','Team','X','Secondary'], rows: structuredClone(rows), template: [input], itemHeight: 40, gap: 0 };
  doc.pages[0].widgets = [list, button];
  const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluate) : createOfflineRuntime(doc, undefined, evaluate);
  const action = (type: Action['type'], spec: unknown): Omit<Action,'id'> => ({ type, targetId: list.id, value: typeof spec === 'string' ? spec : JSON.stringify(spec) });
  const filter = (name: string, expression: string, extra: object = {}) => action('addFilter', { name, expression, mode: 'smart', removeOthers: false, ...extra });
  const sort = (name: string, column = 'X', dataType: RepeaterSortSpec['dataType'] = 'number', extra: object = {}) => action('addSort', { name, column, dataType, direction: 'asc', toggle: false, removeOthers: false, ...extra });
  const act = async (...actions: Omit<Action,'id'>[]) => { button.interactions = [event(actions)]; await runtime.trigger(button.id, 'click'); };
  const ids = () => runtime.rows(list).map(row => row.data.ID);
  return { doc, list, input, button, runtime, action, filter, sort, act, ids };
}

const evidence = JSON.parse(readFileSync(new URL('../research/repeater-query-evidence.json', import.meta.url), 'utf8')).experiments;
const typeNames: Record<number, RepeaterSortSpec['dataType']> = { 1:'number', 2:'text', 3:'textCase', 4:'natural', 16:'dateYMD', 17:'dateMDY', 18:'dateDMY' };

describe('native named repeater query rules', () => {
  for (const portable of [false, true]) {
    const mode = portable ? 'portable' : 'module';
    it(`${mode}: Smart groups same-column alternatives, combines columns and expression rules, and removes every exact duplicate name`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start();
        await f.act(f.filter('Team','[[TargetItem.Team == "red"]]',{column:'Team'}), f.filter('Team','[[TargetItem.Team == "blue"]]',{column:'Team'}), f.filter('minimum','[[TargetItem.X >= 2]]',{column:'X'}));
        expect(f.ids()).toEqual(['A','B']); expect(f.runtime.state().queryFilters[f.list.id]).toHaveLength(3);
        await f.act(f.filter('advanced','[[TargetItem.ID != "B"]]')); expect(f.ids()).toEqual(['A']);
        await f.act(f.action('removeFilter',{name:'team'})); expect(f.ids()).toEqual(['A']);
        await f.act(f.action('removeFilter',{name:'Team'})); expect(f.ids()).toEqual(['A','D']);
        await f.act(f.action('removeFilter',{all:true})); expect(f.ids()).toEqual(['A','B','C','D']);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: the last surviving rule controls All/Any/Smart; empty names do not remove, but even no-op removal refreshes`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start();
        await f.act(f.filter('red','[[Item.Team == "red"]]',{column:'Team',mode:'all'}), f.filter('blue','[[Item.Team == "blue"]]',{column:'Team',mode:'any'}));
        expect(f.ids()).toEqual(['A','B','C']);
        await f.act(f.action('removeFilter',{name:'blue'})); expect(f.ids()).toEqual(['A','C']);
        await f.act(f.filter('','[[Item.X >= 2]]',{mode:'all'})); expect(f.ids()).toEqual(['A']);
        const row = f.runtime.rows(f.list)[0]; f.runtime.input(f.input.id,'temporary',undefined,row.context);
        await f.act(f.action('removeFilter',{name:''})); expect(f.ids()).toEqual(['A']);
        expect(f.runtime.rows(f.list)[0].revision).toBe(row.revision+1);
        expect(f.runtime.widget(f.input,row.context).text).not.toBe('temporary');
        await f.act(f.filter('replacement','[[true]]',{removeOthers:true})); expect(f.ids()).toEqual(['A','B','C','D']);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: evaluates after the action segment and rereads current globals and source control text only on refresh`, async () => {
      const seen: (string | number | boolean | undefined)[] = []; const f = fixture(portable, standardRows, (expr,read) => { seen.push(read('Minimum')); return evaluateExpression(expr,read); });
      try {
        await f.runtime.start();
        await f.act(f.filter('live','[[TargetItem.X >= Minimum && TargetItem.X <= This.text]]'), {type:'setVariable',targetId:'Minimum',value:'2'});
        expect(seen).toEqual(['2','2','2','2']); expect(f.ids()).toEqual(['A','B']);
        await f.act({type:'setVariable',targetId:'Minimum',value:'3'}); expect(f.ids()).toEqual(['A','B']);
        await f.act(f.action('removeFilter',{name:'missing'})); expect(f.ids()).toEqual(['A']);
        await f.act({type:'setText',targetId:f.button.id,value:'4'}, f.action('removeFilter',{name:'missing'})); expect(f.ids()).toEqual(['A','D']);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: exact true string is required and failed bounded expressions do not pass`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start();
        for (const expression of ['[[false]]','[[0]]','[[1]]','[["TRUE"]]','[[" true "]]','[["hello"]]','[[1/0]]','[[window.location]]']) {
          await f.act(f.filter('truth',expression,{removeOthers:true})); expect(f.ids(),expression).toEqual([]);
        }
        for (const expression of ['[[true]]','[["true"]]']) { await f.act(f.filter('truth',expression,{removeOthers:true})); expect(f.ids()).toHaveLength(4); }
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: a row source retains its numeric source address even when hidden or shifted by deletion`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start(); const b = f.runtime.rows(f.list)[1];
        f.input.interactions = [event([f.filter('source','[[TargetItem.X >= Item.X]]')])];
        await f.runtime.trigger(f.input.id,'click',b.data,b.context); expect(f.ids()).toEqual(['A','B','D']);
        await f.act(f.filter('hide source','[[TargetItem.ID != "B"]]')); expect(f.ids()).toEqual(['A','D']);
        await f.act(f.action('deleteRow',{where:{column:'ID',operator:'equals',value:'A'}}));
        // Original position 2 now identifies C (X=1), not stable row B (X=2).
        expect(f.ids()).toEqual(['C','D']);
        await f.act(f.action('deleteRow',{where:{column:'ID',operator:'equals',value:'C'}}), f.action('deleteRow',{where:{column:'ID',operator:'equals',value:'D'}}));
        expect(f.ids()).toEqual([]); // The out-of-range source does not silently become the candidate.
        await f.act(f.action('removeFilter',{all:true})); expect(f.ids()).toEqual(['B']);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: query-stage metadata sees unfiltered source order/counts before sorting and final pagination`, async () => {
      const f = fixture(portable);
      try {
        await f.runtime.start(); await f.act(f.action('setItemsPerPage','2'),f.action('setRepeaterPage','2'),f.sort('reverse','ID','text',{direction:'desc'}));
        expect(f.ids()).toEqual(['B','A']);
        await f.act(f.filter('index','[[TargetItem.index == 1 && TargetItem.Repeater.itemCount == 4]]'));
        expect(f.ids()).toEqual(['C']); expect(f.runtime.repeaterInfo(f.list)).toMatchObject({itemCount:1,pageIndex:1,pageCount:1});
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: a deleted source address still exposes its repeater metadata without inventing source column data`,async()=>{
      const f=fixture(portable,standardRows.slice(0,2));try{
        await f.runtime.start();const source=f.runtime.rows(f.list)[1];
        f.input.interactions=[event([f.filter('metadata','[[Item.Repeater.dataCount > 0 && Item.valid]]')])];
        await f.runtime.trigger(f.input.id,'click',source.data,source.context);
        await f.act(f.action('deleteRow',{where:{column:'ID',operator:'equals',value:'B'}}));expect(f.ids()).toEqual(['A']);
        expect(f.runtime.repeaterInfo(f.list).dataCount).toBe(1);
      }finally{f.runtime.dispose();}
    });
    it(`${mode}: sorts replace their column and move to highest priority; duplicate labels and toggle follow native rules`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start(); await f.act(f.sort('same','X'),f.sort('same','Team','text'));
        expect(f.ids()).toEqual(['B','D','C','A']);
        await f.act(f.sort('x','X','number',{toggle:true})); expect(f.ids()).toEqual(['D','A','B','C']);
        expect(f.runtime.state().querySorts[f.list.id].map(sort=>[sort.column,sort.direction])).toEqual([['Team','asc'],['X','desc']]);
        await f.act(f.sort('same','X','number',{toggle:true,removeOthers:true})); expect(f.ids()).toEqual(['C','B','A','D']);
        await f.act(f.sort('same','Team','text')); await f.act(f.action('removeSort',{name:'same'})); expect(f.ids()).toEqual(['A','B','C','D']);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: remove-all and replacement clear legacy rules, while existing single-rule authoring remains unchanged`, async () => {
      const f = fixture(portable); try {
        await f.runtime.start(); await f.act(f.action('filterRows','{"column":"Team","operator":"equals","value":"red"}'),f.action('sortRows','X:desc'));
        expect(f.ids()).toEqual(['A','C']);
        await f.act(f.filter('all','[[true]]',{removeOthers:true}),f.sort('new','ID','text',{removeOthers:true})); expect(f.ids()).toEqual(['A','B','C','D']);
        expect(f.runtime.state().filters[f.list.id]).toBeUndefined(); expect(f.runtime.state().sorts[f.list.id]).toBeUndefined();
        await f.act(f.action('removeFilter',{all:true}),f.action('removeSort',{all:true}));
        expect(f.runtime.state().queryFilters[f.list.id]).toEqual([]); expect(f.runtime.state().querySorts[f.list.id]).toEqual([]);
      } finally { f.runtime.dispose(); }
    });
    it(`${mode}: rejects malformed specifications atomically and ignores same-repeater query mutations while refreshing`, async () => {
      const f = fixture(portable); try {
        f.list.interactions=[{...event([f.filter('recursive','[[false]]')]),event:'itemLoad'}];
        await f.runtime.start(); expect(f.ids()).toHaveLength(4); expect(f.runtime.state().queryFilters[f.list.id]).toEqual([]);
        for (const action of [f.action('addFilter',{name:'bad',expression:'[[true]]',mode:'all',removeOthers:0}),f.action('removeSort',{all:false}),f.sort('bad','missing'),f.action('removeFilter',{name:'x',extra:true})]) {
          await expect(f.act({type:'setVariable',targetId:'Trace',value:'changed'},action)).rejects.toThrow();
          expect(f.runtime.state().variables.Trace).toBe(''); expect(f.ids()).toHaveLength(4);
        }
      } finally { f.runtime.dispose(); }
    });

    // Expected orders below are retained output of SHA-pinned original runtime
    // functions, not an implementation-derived comparator or a UI equivalence claim.
    for (const sample of evidence.sortTypes as {type:number;ascending:boolean;order:string[]}[]) {
      it(`${mode}: original ${typeNames[sample.type]} conversion probe ${sample.ascending?'asc':'desc'}`,async()=>{
        const data=(evidence.sortInputs as {ID:string;value:string}[]).map(item=>({ID:item.ID,...(item.ID==='missing'?{}:{X:item.value})}));
        const f=fixture(portable,data);try{await f.runtime.start();await f.act(f.sort('primary','X',typeNames[sample.type],{direction:sample.ascending?'asc':'desc'}));expect(f.ids()).toEqual(sample.order);}finally{f.runtime.dispose();}
      });
    }
    for (const sample of evidence.tieCases as {name:string;type:number;ascending:boolean;rows:Record<string,string>[];order:string[]}[]) {
      it(`${mode}: original comparator tie probe: ${sample.name} ${sample.ascending?'asc':'desc'}`,async()=>{
        const f=fixture(portable,sample.rows);try {await f.runtime.start();await f.act(f.sort('secondary','Secondary'),f.sort('primary','X',typeNames[sample.type],{direction:sample.ascending?'asc':'desc'}));expect(f.ids()).toEqual(sample.order);}finally{f.runtime.dispose();}
      });
    }
    for (const sample of evidence.dateTypes as {type:number;ascending:boolean;dates:string[];order:string[]}[]) {
      it(`${mode}: original date order ${typeNames[sample.type]} ${sample.ascending?'asc':'desc'}`,async()=>{
        const f=fixture(portable,sample.dates.map((X,i)=>({ID:String.fromCharCode(65+i),X})));try {await f.runtime.start();await f.act(f.sort('date','X',typeNames[sample.type],{direction:sample.ascending?'asc':'desc'}));expect(f.ids()).toEqual(sample.order);}finally{f.runtime.dispose();}
      });
    }
  }
});
