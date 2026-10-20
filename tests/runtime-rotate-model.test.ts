import {describe,expect,it} from 'vitest';
import {cloneWidgets,createDocument,createWidget,parseDocument,serializeDocument,uid} from '../src/model/document';
import {createComponent,createComponentInstance} from '../src/model/components';
import {ROTATION_ANCHORS,ROTATION_EASINGS,type Action,type Interaction,type RotateActionSpec} from '../src/model/types';

const spec=():RotateActionSpec=>({mode:'by',degrees:'90',clockwise:true,anchor:'center',offsetX:'0',offsetY:'0',easing:'linear',duration:300});
const cases=(action:Action,event='click'):Interaction[]=>[{id:uid(),name:'Rotate',event:event as Interaction['event'],enabled:true,conditions:[],conditionMode:'all',actions:[action]}];
function fixture(){const doc=createDocument(),w=createWidget('box');doc.pages[0].widgets=[w];const a={id:uid(),type:'rotate',targetId:w.id,rotate:spec()} as unknown as Action;w.interactions=cases(a);return{doc,w,a:a as Action&{rotate:ReturnType<typeof spec>}};}

describe('saved Rotate action contract',()=>{
 it('round-trips relative and absolute rotation, expressions, offsets, animation and Rotated cases',()=>{
  const {doc,w,a}=fixture();a.rotate.mode='to';a.rotate.degrees='[[Turn + 0.5]]';a.rotate.clockwise=false;a.rotate.anchor='bottom right';a.rotate.offsetX='[[Target.width / 2]]';a.rotate.offsetY='-12.25';
  w.interactions.push(...cases({id:uid(),type:'setVariable',targetId:'Turns',value:'[[Turns + 1]]'},'rotate'));
  expect(parseDocument(serializeDocument(doc))).toEqual(doc);
 });
 it.each(['rotate','mode','degrees','clockwise','anchor','offsetX','offsetY','easing','duration'])('requires the complete %s contract',field=>{
  const {doc,a}=fixture();if(field==='rotate')delete(a as Partial<typeof a>).rotate;else delete(a.rotate as unknown as Record<string,unknown>)[field];
  expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
 });
 it.each([['mode','around'],['degrees',90],['clockwise','true'],['anchor','arbitrary'],['offsetX',{}],['offsetY',null],['easing','execute'],['duration',-1],['duration',60001],['unknown',true]])('rejects invalid %s=%s', (field,value)=>{
  const {doc,a}=fixture();(a.rotate as unknown as Record<string,unknown>)[field]=value;expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
 });
 it.each(['value','duration','x','y','style'])('rejects ambiguous outer %s fields on Rotate',field=>{
  const {doc,a}=fixture();Object.assign(a,{[field]:field==='style'?{fill:'#fff'}:field==='value'?'45':10});expect(()=>parseDocument(JSON.stringify(doc))).toThrow();
 });
 it('rejects rotation parameters attached to another action',()=>{const{doc,a}=fixture();a.type='show';expect(()=>parseDocument(JSON.stringify(doc))).toThrow();});
 it.each(ROTATION_EASINGS)('retains native easing %s',easing=>{const{doc,a}=fixture();a.rotate.easing=easing;expect(parseDocument(serializeDocument(doc))).toEqual(doc);});
 it.each(ROTATION_ANCHORS)('retains anchor %s',anchor=>{const{doc,a}=fixture();a.rotate.anchor=anchor;expect(parseDocument(serializeDocument(doc))).toEqual(doc);});
 it('remaps numeric expression references when copying while preserving quoted strings and outside targets',()=>{
  const{w,a}=fixture(),other=createWidget('input');other.id='turn-input';a.rotate.degrees='[[number(Widget.turn-input.text) + 5]]';a.rotate.offsetX='[[if(true, Widget.turn-input.text, "Widget.turn-input.text")]]';a.rotate.offsetY='[[Widget.outside.text]]';
  const[copied,target]=cloneWidgets([w,other],0),actual=(copied.interactions[0].actions[0] as typeof a);
  expect(actual.targetId).toBe(copied.id);expect(actual.rotate.degrees).toBe(`[[number(Widget.${target.id}.text) + 5]]`);
  expect(actual.rotate.offsetX).toBe(`[[if(true, Widget.${target.id}.text, "Widget.turn-input.text")]]`);expect(actual.rotate.offsetY).toBe(a.rotate.offsetY);expect(a.rotate.degrees).toContain('Widget.turn-input.text');
 });
 it('keeps component instance rotation targets and expression inputs local',()=>{
  const{w,a}=fixture(),other=createWidget('input');a.rotate.degrees=`[[Widget.${other.id}.text]]`;
  const component=createComponent([w,other]),one=createComponentInstance(component),two=createComponentInstance(component);
  for(const instance of[one,two]){const[target,input]=instance.states![0].widgets,action=target.interactions[0].actions[0] as typeof a;expect(action.targetId).toBe(target.id);expect(action.rotate.degrees).toBe(`[[Widget.${input.id}.text]]`);}
  expect(one.states![0].widgets[0].id).not.toBe(two.states![0].widgets[0].id);
 });
 it('remaps a group target with its copied members and preserves the source group',()=>{
  const{w,a}=fixture(),other=createWidget('box');w.groupId='turn-group';other.groupId='turn-group';a.targetId='turn-group';
  const[first,second]=cloneWidgets([w,other],0);expect(first.groupId).not.toBe('turn-group');expect(second.groupId).toBe(first.groupId);expect(first.interactions[0].actions[0].targetId).toBe(first.groupId);expect(a.targetId).toBe('turn-group');
 });
});
