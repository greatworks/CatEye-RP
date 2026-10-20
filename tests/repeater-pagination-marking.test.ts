import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, EventType, Interaction } from '../src/model/types';

const interaction = (actions: Omit<Action,'id'>[], event: EventType = 'click'): Interaction => ({ id:uid(), name:event, event, enabled:true, conditions:[], conditionMode:'all', actions:actions.map(a=>({...a,id:uid()})) });
function fixture(portable = false, pagination: {itemsPerPage:number;startPage:number} | undefined = {itemsPerPage:2,startPage:1}) {
  const doc=createDocument(), list=createWidget('repeater'), input=createWidget('input'), button=createWidget('button');
  doc.variables={Trace:'',Snapshot:''}; doc.caseSelection='never';
  list.repeater={columns:['Name','Group','Count','Note'],rows:['A','B','C','D','E'].map((Name,i)=>({Name,Group:i%2?'even':'odd',Count:String(i+1),Note:Name})),template:[input],itemHeight:50,gap:0,...(pagination?{pagination}:{})};
  list.interactions=[interaction([{type:'setVariable',targetId:'Trace',value:'[[Trace]][[Item.Name]]:[[Item.index]]:[[Item.isMarked]];'}],'itemLoad')];
  doc.pages[0].widgets=[list,button];
  const runtime: OfflineRuntime=portable?new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout})(doc,undefined,evaluateExpression):createOfflineRuntime(doc,undefined,evaluateExpression);
  const act=async(...actions:Omit<Action,'id'>[])=>{button.interactions=[interaction(actions)];await runtime.trigger(button.id,'click');};
  const target=(type:Action['type'],value:string):Omit<Action,'id'>=>({type,targetId:list.id,value});
  const names=()=>runtime.rows(list).map(r=>r.data.Name);
  return {doc,list,input,button,runtime,act,target,names};
}

describe('native repeater pagination and stable marked rows',()=>{
  for(const portable of [false,true]) {
    const mode=portable?'portable':'module';
    it(`${mode}: initial, next, previous, first and last pages expose native counts and local display indices`,async()=>{
      const {runtime,list,act,target,names,input}=fixture(portable,{itemsPerPage:2,startPage:2});
      try {
        await runtime.start(); expect(names()).toEqual(['C','D']);
        expect(runtime.repeaterInfo(list)).toEqual({dataCount:5,itemCount:5,visibleItemCount:2,pageCount:3,pageIndex:2});
        expect(runtime.text('[[Item.index]]/[[Item.isLast]]/[[Item.Repeater.pageIndex]]/[[Item.Repeater.pageCount]]',undefined,runtime.rows(list)[1].context)).toBe('2/true/2/3');
        await act(target('setRepeaterPage','next')); expect(names()).toEqual(['E']);
        const item=runtime.rows(list)[0]; runtime.input(input.id,'temporary',undefined,item.context);
        const revision=item.revision, trace=runtime.state().variables.Trace;
        await act(target('setRepeaterPage','next')); expect(names()).toEqual(['E']);
        expect(runtime.rows(list)[0].revision).toBe(revision+1); expect(runtime.widget(input,item.context).text).not.toBe('temporary');
        expect(runtime.state().variables.Trace).toBe(trace+'E:1:false;');
        await act(target('setRepeaterPage','previous')); expect(names()).toEqual(['C','D']);
        await act(target('setRepeaterPage','first')); expect(names()).toEqual(['A','B']);
        await act(target('setRepeaterPage','last')); expect(names()).toEqual(['E']);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: marks survive paging, hidden-row updates, sorting and deletion of an earlier unmarked row`,async()=>{
      const {runtime,list,input,act,target,names}=fixture(portable);
      try {
        await runtime.start();
        input.interactions=[interaction([target('markRows','{"row":"this"}')])];
        const first=runtime.rows(list)[0]; runtime.input(input.id,'keep me',undefined,first.context);
        const revision=first.revision, trace=runtime.state().variables.Trace;
        await runtime.trigger(input.id,'click',first.data,first.context);
        expect(runtime.state().markedRowIds[list.id]).toEqual([first.id]);
        expect(runtime.rows(list)[0].revision).toBe(revision); expect(runtime.state().variables.Trace).toBe(trace);
        expect(runtime.widget(input,first.context).text).toBe('keep me');
        await act(target('setRepeaterPage','next'),target('markRows','{"where":{"column":"Name","operator":"equals","value":"D"}}'));
        expect(names()).toEqual(['C','D']);
        await act(target('filterRows','{"column":"Name","operator":"equals","value":"E"}'));
        expect(names()).toEqual(['E']); expect(runtime.repeaterInfo(list)).toMatchObject({itemCount:1,pageCount:1,pageIndex:1,dataCount:5});
        await act(target('updateRow','{"row":"marked","values":{"Count":"[[TargetItem.Count + 10]]","Note":"[[TargetItem.isMarked]]"}}'));
        expect(runtime.state().sourceRows[list.id].map(r=>r.Count)).toEqual(['11','2','3','14','5']);
        expect(runtime.state().sourceRows[list.id].filter(r=>r.Note==='true').map(r=>r.Name)).toEqual(['A','D']);
        await act(target('deleteRow','{"where":{"column":"Name","operator":"equals","value":"B"}}'));
        expect(runtime.state().markedRowIds[list.id]).toHaveLength(2);
        await act(target('filterRows',''),target('sortRows','Name:desc')); expect(names()).toEqual(['E','D']);
        await act(target('deleteRow','{"row":"marked"}')); expect(runtime.state().sourceRows[list.id].map(r=>r.Name)).toEqual(['C','E']);
        expect(runtime.state().markedRowIds[list.id]).toEqual([]); expect(names()).toEqual(['E','C']);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: Item mark state is captured at event entry while TargetItem sees the updated set`,async()=>{
      const {runtime,list,input,target}=fixture(portable);
      try {
        await runtime.start(); const first=runtime.rows(list)[0];
        input.interactions=[interaction([target('markRows','{"row":"this"}'),{type:'setVariable',targetId:'Snapshot',value:'[[Item.isMarked]]'},target('updateRow','{"row":"this","values":{"Note":"[[Item.isMarked]]/[[TargetItem.isMarked]]"}}')])];
        await runtime.trigger(input.id,'click',first.data,first.context);
        expect(runtime.state().variables.Snapshot).toBe('false'); expect(runtime.state().sourceRows[list.id][0].Note).toBe('false/true');
        await runtime.trigger(input.id,'click',first.data,first.context);
        expect(runtime.state().variables.Snapshot).toBe('true'); expect(runtime.state().sourceRows[list.id][0].Note).toBe('true/true');
      } finally { runtime.dispose(); }
    });
    it(`${mode}: mark/unmark all includes hidden pages, is idempotent, and row indices follow current display`,async()=>{
      const {runtime,list,act,target}=fixture(portable);
      try {
        await runtime.start(); await act(target('markRows','{"row":"all"}'),target('markRows','{"row":"all"}'));
        expect(runtime.state().markedRowIds[list.id]).toHaveLength(5);
        await act(target('sortRows','Name:desc'),target('unmarkRows','{"row":0}'));
        expect(runtime.state().markedRowIds[list.id]).not.toContain(runtime.rows(list)[0].id);
        await act(target('unmarkRows','{"where":{"column":"Group","operator":"equals","value":"odd"}}'));
        expect(runtime.state().sourceRows[list.id].filter((_,i)=>runtime.state().markedRowIds[list.id].includes(runtime.state().sourceRowIds[list.id][i])).map(r=>r.Name)).toEqual(['B','D']);
        await act(target('filterRows','{"column":"Name","operator":"equals","value":"A"}'),target('unmarkRows','{"row":"all"}'));
        expect(runtime.state().markedRowIds[list.id]).toEqual([]);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: marked updates process all selected rows of a column before reading the next column`,async()=>{
      const {runtime,list,input,act,target}=fixture(portable);
      try {
        await runtime.start(); await act(target('markRows','{"row":"all"}')); const source=runtime.rows(list)[1];
        input.interactions=[interaction([target('updateRow','{"row":"marked","values":{"Count":"9","Note":"[[Item.Count]]"}}')])];
        await runtime.trigger(input.id,'click',source.data,source.context);
        expect(runtime.state().sourceRows[list.id].map(r=>r.Note)).toEqual(['9','9','9','9','9']);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: item-limit actions retain a finite page, reset unlimited mode to page one and honor native numeric fallback`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable);
      try {
        await runtime.start(); await act(target('setRepeaterPage','last'),target('setItemsPerPage','1')); expect(names()).toEqual(['C']);
        await act(target('setItemsPerPage','all')); expect(names()).toEqual(['A','B','C','D','E']); expect(runtime.repeaterInfo(list)).toMatchObject({pageCount:1,pageIndex:1});
        await act(target('setRepeaterPage','next')); expect(names()).toHaveLength(5);
        await act(target('setItemsPerPage','2')); expect(names()).toEqual(['A','B']);
        await act(target('setRepeaterPage','100')); expect(names()).toEqual(['E']);
        await act(target('setRepeaterPage','nonsense')); expect(names()).toEqual(['A','B']);
        await act(target('setItemsPerPage','nonsense')); expect(runtime.state().pagination[list.id].itemsPerPage).toBe(20);
        await act(target('setItemsPerPage','-1')); expect(runtime.state().pagination[list.id].itemsPerPage).toBe(1);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: empty finite and unlimited data have distinct page counts and shrinking data clamps the page`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable,{itemsPerPage:2,startPage:99});
      try {
        await runtime.start(); expect(names()).toEqual(['E']);
        await act(target('deleteRow','0')); expect(names()).toEqual(['C','D']); expect(runtime.repeaterInfo(list).pageIndex).toBe(2);
        await act(target('deleteRow','all')); expect(runtime.repeaterInfo(list)).toEqual({dataCount:0,itemCount:0,visibleItemCount:0,pageCount:0,pageIndex:1});
        await act(target('setItemsPerPage','all')); expect(runtime.repeaterInfo(list)).toMatchObject({pageCount:1,pageIndex:1});
        await act(target('addRow','{"Name":"new"}')); expect(names()).toEqual(['new']); expect(runtime.state().markedRowIds[list.id]).toEqual([]);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: Mark is allowed during Item Loaded but recursive page changes are ignored`,async()=>{
      const {runtime,list,target}=fixture(portable);
      try {
        list.interactions.push(interaction([target('markRows','{"row":"this"}'),target('setRepeaterPage','next'),target('setItemsPerPage','all')],'itemLoad'));
        await runtime.start(); expect(runtime.state().markedRowIds[list.id]).toEqual(runtime.rows(list).map(r=>r.id));
        expect(runtime.repeaterInfo(list)).toMatchObject({pageIndex:1,visibleItemCount:2,pageCount:3}); expect(runtime.state().variables.Trace).toBe('A:1:false;B:2:false;');
      } finally { runtime.dispose(); }
    });
    it(`${mode}: invalid selectors and fractional array indices roll back without corrupting marks or paging`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable);
      try {
        await runtime.start(); await act(target('markRows','{"row":0}')); const before=structuredClone(runtime.state());
        for(const value of ['[]','{"row":"marked"}','{"row":"this"}','{"row":-1}','{"row":"all","where":{}}','{"where":{"column":"Missing","operator":"equals","value":"x"}}']) {
          await expect(act(target('markRows',value))).rejects.toThrow(); expect(runtime.state()).toEqual(before);
        }
        await expect(act(target('markRows','{"row":"all"}'),target('updateRow','{"row":"invalid","values":{}}'))).rejects.toThrow(); expect(runtime.state()).toEqual(before);
        await act(target('setRepeaterPage','1.5')); expect(names()).toEqual(['B','C']);
        await act(target('setRepeaterPage','first'),target('setItemsPerPage','2.5')); expect(names()).toEqual(['A','B','C']);
        expect(runtime.rows(list).map(r=>runtime.text('[[Item.isLast]]',r.data,r.context))).toEqual(['false','false','false']);
        const fractional=structuredClone(runtime.state());
        await expect(act(target('setRepeaterPage','2'))).rejects.toThrow(/fractional row index/); expect(runtime.state()).toEqual(fractional);
        await expect(act(target('setItemsPerPage','Infinity'))).rejects.toThrow(/pagination/); expect(runtime.state()).toEqual(fractional);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: Last in an unrefreshed add chain uses the previously committed active dataset`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable);
      try {
        await runtime.start(); await act(target('addRow','{"Name":"F"}'),target('addRow','{"Name":"G"}'),target('setRepeaterPage','last'));
        expect(names()).toEqual(['E','F']); expect(runtime.repeaterInfo(list)).toMatchObject({pageIndex:3,pageCount:4,dataCount:7});
        await act(target('setRepeaterPage','last')); expect(names()).toEqual(['G']);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: transient shrinking before a refresh does not permanently change the current page`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable,{itemsPerPage:2,startPage:3});
      try {
        await runtime.start(); await act(target('deleteRow','0'),target('addRow','{"Name":"F"}'));
        expect(names()).toEqual(['F']); expect(runtime.repeaterInfo(list).pageIndex).toBe(3);
        await act(target('filterRows','{"column":"Name","operator":"equals","value":"A"}'),target('filterRows',''));
        expect(names()).toEqual(['F']); expect(runtime.repeaterInfo(list).pageIndex).toBe(3);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: invalid initial fractional indices surface as a recoverable start error`,async()=>{
      const {runtime,list,act,target,names}=fixture(portable,{itemsPerPage:3,startPage:1.5});
      try {
        expect(names()).toEqual([]); await expect(runtime.start()).rejects.toThrow(/fractional row index/);
        await act(target('setRepeaterPage','first')); expect(names()).toEqual(['A','B','C']);
        expect(runtime.repeaterInfo(list).pageIndex).toBe(1);
      } finally { runtime.dispose(); }
    });
    it(`${mode}: leaving and returning reloads initial rows, marks and page while preserving global variables`,async()=>{
      const {runtime,doc,list,input,act,target,names}=fixture(portable);
      const other=createDocument().pages[0];doc.pages.push(other);
      try {
        await runtime.start(); const old=runtime.rows(list)[0];
        await act(target('markRows','{"row":"all"}'),target('updateRow','{"row":"all","values":{"Count":"9"}}'),target('setRepeaterPage','last'),{type:'setVariable',targetId:'Snapshot',value:'global retained'});
        await runtime.navigate(other.id); await runtime.navigate(doc.pages[0].id);
        expect(names()).toEqual(['A','B']); expect(runtime.repeaterInfo(list).pageIndex).toBe(1); expect(runtime.state().markedRowIds[list.id]).toEqual([]);
        expect(runtime.state().sourceRows[list.id].map(r=>r.Count)).toEqual(['1','2','3','4','5']);expect(runtime.state().variables.Snapshot).toBe('global retained');
        expect(runtime.rows(list)[0].id).not.toBe(old.id);
        runtime.input(input.id,'stale',undefined,old.context);expect(runtime.widget(input,runtime.rows(list)[0].context).text).not.toBe('stale');
      } finally { runtime.dispose(); }
    });
  }
  it('isolates nested repeater marks/pages by stable parent row and resets their transient state on parent refresh',async()=>{
    const doc=createDocument(), outer=createWidget('repeater'), inner=createWidget('repeater'), child=createWidget('button');
    inner.repeater!.rows=[{Name:'a'},{Name:'b'}]; inner.repeater!.pagination={itemsPerPage:1,startPage:1}; inner.repeater!.template=[child];
    outer.repeater!.rows=[{Name:'first'},{Name:'second'}]; outer.repeater!.template=[inner]; doc.pages[0].widgets=[outer];
    child.interactions=[interaction([{type:'markRows',targetId:inner.id,value:'{"row":"this"}'},{type:'setRepeaterPage',targetId:inner.id,value:'next'}])];
    const runtime=createOfflineRuntime(doc,undefined,evaluateExpression);
    try {
      await runtime.start(); const [a,b]=runtime.rows(outer), first=runtime.rows(inner,a.context)[0];
      await runtime.trigger(child.id,'click',first.data,first.context);
      expect(runtime.repeaterInfo(inner,a.context).pageIndex).toBe(2); expect(runtime.repeaterInfo(inner,b.context).pageIndex).toBe(1);
      expect(Object.values(runtime.state().markedRowIds).flat()).toEqual([first.id]);
      await runtime.execute(interaction([{type:'sortRows',targetId:outer.id,value:'Name:desc'}]));
      expect(Object.values(runtime.state().markedRowIds).flat()).toEqual([]);
      expect(runtime.repeaterInfo(inner,runtime.rows(outer)[0].context).pageIndex).toBe(1);
    } finally { runtime.dispose(); }
  });
});
