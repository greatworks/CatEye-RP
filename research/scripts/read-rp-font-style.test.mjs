import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recoverStyle, recoverSelection, recoverInteractionStyles, inspectRpSemantics } from './read-rp-semantics.mjs';

const map = values => ({$map:Object.entries(values)});
const prop = (key,value,flags=0xc0000000) => map({DOAName:key|flags,Value:value});
const guid = value => ({$guid:value});
const zero='0'.repeat(32), defaultId='a'.repeat(32), baseId='b'.repeat(32);
function fixture(styles=[0]) {
  const run = Style => map({Type:'Axure:AttributedString:AxRun',Family:'Roboto',Size:10.5,Weight:400,Style,Color:-16777216});
  const widget={type:'Axure:DiagramObject:VectorShape',properties:map({Selected:false,SelectedStyleGroup:'',Disabled:false,Error:false,RichTextBlock:map({'attributed-string':map({Paragraphs:[map({Inlines:styles.map(run),HorizontalAlignment:0,LineSpacing:0})]})})})};
  const ix=map({});
  const local=[prop(0,guid(baseId)),prop(21,ix)];
  const style={id:'c'.repeat(32),properties:map({MatchInfo:map({Id:guid(baseId),LibraryId:guid(zero)}),PropList:local})};
  const cache=(id,Props)=>map({Info:map({Id:guid(id),LibraryId:guid(zero)}),Props});
  const root={properties:map({StyleCache:map({Styles:[cache(defaultId,[prop(1002,0,0x80000000)]),cache(baseId,[])]})})};
  const targets=new Map();
  const state=(name,props)=>{const id=(targets.size+1).toString(16).padStart(32,'d');targets.set(id,{id,type:'Axure:Style',properties:map({All:false,PropList:props})});ix.$map.push([name,{$reference:id,referenceTag:3}]);};
  const args=[widget,style,root,defaultId,r=>targets.get(r?.$reference),{type:'box'}];
  return {args,local,state,style:()=>recoverStyle(...args,false),selection:()=>recoverSelection(...args),states:()=>recoverInteractionStyles(...args)};
}

test('PName1002 getter binds Platform AxFontStyle and its enum is not the graphics enum',()=>{
  const metadata=JSON.parse(fs.readFileSync(new URL('../font-style-format-metadata.json',import.meta.url),'utf8'));
  assert.equal(metadata.sha256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
  const native=metadata.records.find(r=>r.type==='Axure.Platform.AxFontStyle');
  assert.deepEqual(Object.fromEntries(native.fields.filter(f=>f.constant!==null).map(f=>[f.name,Buffer.from(f.constant,'hex').readInt32LE()])),{None:-1,Normal:0,Italic:1,Oblique:2});
  const cil=JSON.parse(fs.readFileSync(new URL('../font-style-format-property-cil.json',import.meta.url),'utf8'));
  const getter=cil.Types.flatMap(t=>t.Methods).find(m=>m.Name==='ktz1');
  assert.ok(getter.Instructions.some(i=>i.Operand===1002)); assert.ok(getter.Signature.endsWith('11BA04'));
  const run=JSON.parse(fs.readFileSync(new URL('../font-style-format-run-base-cil.json',import.meta.url),'utf8')).Types[0];
  assert.equal(run.Methods.find(m=>m.Name==='OIQV').Signature,'200011BA04');
  assert.equal(run.Fields.find(f=>f.Name==='NSmW').Signature,'0611BA04');
  const writer=run.Methods.find(m=>m.Name==='eIwT');
  const styleCall=writer.Instructions.findIndex(i=>i.Resolved==='aSXQ.iSXv::OIQV');
  assert.ok(styleCall>0);assert.equal(writer.Instructions[styleCall+1].Resolved,'ftnd.Wtnq::op_Implicit');
  assert.equal(writer.Instructions[styleCall+2].Resolved,'MtXw.StXT::Add');
});

test('uniform native run Normal/Italic has precedence over cached defaults with source provenance',()=>{
  for(const [value,expected] of [[0,'normal'],[1,'italic']]) {
    const result=fixture([value,value]).style(); assert.equal(result.style.fontStyle,expected);
    assert.equal(result.provenance.fontStyle.kind,'uniform-rich-text-runs');
  }
});

test('mixed or unsupported run styles are retained as unknown and never silently replaced by cached normal',()=>{
  for(const styles of [[0,1],[1,2],[2],[-1],['1'],[null],[undefined],[NaN]]) {
    const result=fixture(styles).style(); assert.equal(result.style.fontStyle,undefined,JSON.stringify(styles));
    assert.ok(result.unknown.some(p=>p.property==='fontStyle'));
  }
});

test('explicit local font style wins over rich runs, while a non-overridden local default cannot clear italic',()=>{
  const explicit=fixture([1]); explicit.local.push(prop(1002,0));
  assert.equal(explicit.style().style.fontStyle,'normal'); assert.equal(explicit.style().provenance.fontStyle.kind,'local-object-style');
  const implicit=fixture([1]); implicit.local.push(prop(1002,0,0x80000000));
  assert.equal(implicit.style().style.fontStyle,'italic'); assert.ok(implicit.style().unknown.some(p=>p.property==='FONT_STYLE'));
  const invalid=fixture([1]); invalid.local.push(prop(1002,2)); assert.equal(invalid.style().style.fontStyle,undefined);
  assert.ok(invalid.style().unknown.some(p=>p.property==='FONT_STYLE'&&p.value===2));
});

test('explicit selected normal reset survives equality with base and coexists with hover italic',()=>{
  const f=fixture(); f.state('Selected',[prop(1002,0)]);f.state('MouseOver',[prop(1002,1)]);
  assert.deepEqual(f.selection().selectedStyle,{fontStyle:'normal'});
  assert.deepEqual(f.states().states.mouseover.style,{fontStyle:'italic'});
  assert.deepEqual(f.states().states.mouseover.sourceProperties,[1002]);
});

test('each named state accepts only independently explicit 0/1 and rejects whole unsupported patches',()=>{
  for(const name of ['MouseOver','MouseDown','Focused','Disabled']) for(const value of [0,1,2,-1,'1',null,NaN]) {
    const f=fixture(); f.state(name,[prop(1002,value)]);
    const r=Object.values(f.states().states).find(s=>s.sourceState===name);
    assert.equal(r.status,[0,1].includes(value)?'supported-state-style':'unsupported-state-style',`${name}/${value}`);
  }
  for(const flags of [0,0x80000000,0x40000000]) {
    const f=fixture();f.state('Selected',[prop(1002,0,flags)]);f.state('MouseOver',[prop(1002,1,flags)]);
    // The recursive native state generator excludes these saved snapshot values.
    assert.equal(f.selection().status,'supported-selection');assert.deepEqual(f.selection().selectedStyle,{});
    assert.equal(f.states().states.mouseover.status,'supported-state-style');assert.deepEqual(f.states().states.mouseover.style,{});
  }
});

test('unsupported companion fields and duplicate FONT_STYLE remain atomic failures',()=>{
  for(const props of [[prop(1002,0),prop(1003,5)],[prop(1002,0),prop(1002,1)]]) {
    const f=fixture();f.state('Selected',props);f.state('Focused',props);
    assert.equal(f.selection().status,'unsupported-selection');assert.equal(f.states().states.focused.status,'unsupported-state-style');
  }
});

test('real Tab Menu typography recovers normal without changing native selected fills',()=>{
  const result=inspectRpSemantics(fileURLToPath(new URL('../samples/the-basics-tab-menu.rp',import.meta.url)));
  const labels=result.diagrams.find(d=>d.name==='Page 1').widgets.slice(0,2);
  for(const label of labels) { assert.equal(label.styleRecovery.style.fontStyle,'normal');assert.deepEqual(label.selectionRecovery.selectedStyle,{fill:'#81d3f8'}); }
});
