import {expect,it} from 'vitest';
import {createDocument,createWidget,serializeDocument} from '../src/model/document';
import {createRuntime,executeInteraction,getRuntimeWidget} from '../src/runtime/engine';
import type {Interaction} from '../src/model/types';

it('keeps completed rotation fit geometry in the snapshot rendering helper',async()=>{
 const doc=createDocument(),panel=createWidget('panel'),child=createWidget('box',0,0);
 Object.assign(child,{width:200,height:100,rotation:30});panel.fitToContent=true;panel.states![0].widgets=[child];doc.pages[0].widgets=[panel];
 const original=serializeDocument(doc),before=createRuntime(doc),initial=getRuntimeWidget(panel,before);
 expect(initial.width).toBeCloseTo(211.60254037844388,8);expect(initial.height).toBeCloseTo(143.30127018922192,8);
 const interaction:Interaction={id:'snapshot-rotate-case',event:'click',name:'Rotate to zero',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'snapshot-rotate',type:'rotate',targetId:child.id,rotate:{mode:'to',degrees:'0',clockwise:true,anchor:'center',offsetX:'0',offsetY:'0',easing:'none',duration:0}}]};
 const after=await executeInteraction(doc,before,interaction);expect(getRuntimeWidget(child,after).rotation).toBe(0);
 // The original bounds cache uses the authored angle when its cached target
 // angle is zero. Painted orientation and the committed fit bounds differ.
 expect(getRuntimeWidget(panel,after).width).toBeCloseTo(initial.width,8);expect(getRuntimeWidget(panel,after).height).toBeCloseTo(initial.height,8);
 expect(serializeDocument(doc)).toBe(original);
});
