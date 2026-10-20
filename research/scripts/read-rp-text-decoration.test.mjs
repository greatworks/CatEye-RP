import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {recoverStyle,recoverSelection,recoverInteractionStyles,recoverRichText,property} from './read-rp-semantics.mjs';
import {inspectRpObjects} from './read-rp-objects.mjs';

const map=o=>({$map:Object.entries(o)}),prop=(key,value,flags=0xc0000000)=>map({DOAName:key|flags,Value:value});
const zero='0'.repeat(32),def='a'.repeat(32),base='b'.repeat(32),guid=value=>({$guid:value});
function fixture(underline=false,strikethrough=false) {
 const run=map({Type:'Axure:AttributedString:AxRun',Text:'literal [[name]]',Family:'Arial',Size:10.5,Weight:400,Style:0,Stretch:5,Underline:underline,Color:-16777216,Baseline:0,CharacterSpacing:0,Strikethrough:strikethrough});
 const block=map({'*type':'rich-text-block','property-dictionary':map({type:'rich-text-object','diagram-object-label':'','text-object-id':guid(def),'parent-diagram-id':guid(base)}),'attributed-string':map({Version:map({Major:11,Minor:0,Build:0,Revision:0}),Paragraphs:[map({Wrapping:0,Trimming:0,HorizontalAlignment:0,LineSpacing:0,ListInfo:map({IndentLevel:0,ListType:0}),Inlines:[run]})]})});
 const widget={type:'Axure:DiagramObject:VectorShape',properties:map({Selected:false,SelectedStyleGroup:'',Disabled:false,Error:false,RichTextBlock:block})},ix=map({}),local=[prop(0,guid(base)),prop(21,ix)];
 const style={id:'c'.repeat(32),properties:map({MatchInfo:map({Id:guid(base),LibraryId:guid(zero)}),PropList:local})};
 const cache=(id,Props)=>map({Info:map({Id:guid(id),LibraryId:guid(zero)}),Props});
 const root={properties:map({StyleCache:map({Styles:[cache(def,[prop(5,false,0x80000000),prop(95,false,0x80000000)]),cache(base,[])]})})};
 const targets=new Map(),state=(name,props)=>{const id=(targets.size+1).toString(16).padStart(32,'d');targets.set(id,{id,type:'Axure:Style',properties:map({All:false,PropList:props})});ix.$map.push([name,{$reference:id,referenceTag:3}]);};
 const args=[widget,style,root,def,ref=>targets.get(ref?.$reference),{type:'box'}];
 return {widget,run,local,state,rich:()=>recoverRichText(widget),base:()=>recoverStyle(...args,false),selection:()=>recoverSelection(...args),states:()=>recoverInteractionStyles(...args)};
}
test('native enum and CSS writer independently bind two decoration booleans',()=>{
 const metadata=JSON.parse(fs.readFileSync(new URL('../samples/metadata-PName.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 const fields=metadata.Types[0].Fields;
 assert.equal(Buffer.from(fields.find(f=>f.Name==='UNDERLINE').Constant,'hex').readInt32LE(),5);
 assert.equal(Buffer.from(fields.find(f=>f.Name==='STRIKETHROUGH').Constant,'hex').readInt32LE(),95);
 const source=JSON.parse(fs.readFileSync(new URL('../text-decoration-css-cil.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 assert.equal(source.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
 const writer=source.Types[0].Methods.find(m=>m.Name==='mNx9');
 assert.equal(writer.Token,100699319);assert.equal(writer.Instructions.filter(i=>i.Resolved==='System.Text.StringBuilder::Append').length,2);
 assert.equal(writer.Instructions.find(i=>i.Offset===0xd).Op,'ldarg.1');assert.equal(writer.Instructions.find(i=>i.Offset===0x35).Op,'ldarg.2');
});
test('run protocol v2 preserves all four decoration combinations, false values and literal content',()=>{
 for(const underline of [false,true])for(const strikethrough of [false,true]) {
  const f=fixture(underline,strikethrough),before=JSON.stringify(f.widget),r=f.rich();
  assert.equal(r.status,'supported-rich-text');assert.equal(r.source.runStyleSchemaVersion,2);
  assert.equal(r.richText.paragraphs[0].runs[0].style.underline,underline);assert.equal(r.richText.paragraphs[0].runs[0].style.strikethrough,strikethrough);
  assert.equal(r.text,'literal [[name]]');assert.equal(r.richText.expressionMode,'literal');assert.equal(JSON.stringify(f.widget),before);
 }
});
test('base uniform run decoration survives cached false; explicit local false remains distinct from absence',()=>{
 const f=fixture(true,true);assert.equal(f.base().style.underline,true);assert.equal(f.base().style.strikethrough,true);
 f.local.push(prop(5,false),prop(95,false));assert.equal(f.base().style.underline,false);assert.equal(f.base().style.strikethrough,false);
 assert.equal(f.rich().richText.paragraphs[0].runs[0].style.underline,true);
 const inactive=fixture(true,true);inactive.local.push(prop(5,false,0x80000000),prop(95,false,0x80000000));
 assert.equal(inactive.base().style.underline,true);assert.equal(inactive.base().style.strikethrough,true);
});
test('selected and named patches retain independent explicit false, true and absence without filling sibling values',()=>{
 for(const props of [[prop(5,false)],[prop(95,false)],[prop(5,true),prop(95,true)],[prop(5,false),prop(95,true)]]) {
  const f=fixture(true,true);f.state('Selected',props);f.state('MouseOver',props);
  const expected=Object.fromEntries(props.map(p=>[(property(p,'DOAName')&0x0fffffff)===5?'underline':'strikethrough',property(p,'Value')]));
  assert.deepEqual(f.selection().selectedStyle,expected);assert.deepEqual(f.states().states.mouseover.style,expected);
 }
});
test('malformed booleans and other active unknown fields reject atomically; inactive decoration snapshots stay inactive',()=>{
 for(const value of [undefined,null,0,1,'true',{},[]]) {
  const f=fixture(value,false);if(value===undefined)f.run.$map=f.run.$map.filter(([k])=>k!=='Underline');
  assert.equal(f.rich().status,'unsupported-rich-text');f.state('Selected',[prop(5,value)]);f.state('Focused',[prop(95,value)]);
  assert.equal(f.selection().status,'unsupported-selection');assert.equal(f.states().states.focused.status,'unsupported-state-style');
 }
 for(const props of [[prop(5,true),prop(72,map({On:true}))],[prop(5,true),prop(5,false)]]){const f=fixture();f.state('Selected',props);assert.equal(f.selection().status,'unsupported-selection');}
 const f=fixture();f.state('Selected',[prop(5,true,0x80000000),prop(95,true,0x40000000)]);assert.deepEqual(f.selection().selectedStyle,{});
});
test('real underlined hyperlinks and nonzero letter spacing remain unsupported instead of flattening their semantics',()=>{
 const raw=inspectRpObjects(fileURLToPath(new URL('../samples/Prototyping Basics.rp',import.meta.url))),pack=raw.packages.find(p=>p.packageId==='8165e87159f34c58a974459d9e910e34');
 const underlined=pack.objects.find(o=>o.id==='4f4e187b657a4108aa50438dd7d0fca8'),r=recoverRichText(underlined);
 assert.equal(raw.fileSha256,'26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7');
 assert.equal(r.status,'unsupported-rich-text');assert.match(r.reason,/original local package context/);
 const paragraphs=property(property(property(underlined.properties,'RichTextBlock'),'attributed-string'),'Paragraphs');
 const hyperlink=paragraphs.flatMap(p=>property(p,'Inlines')).find(r=>property(r,'Type')==='Axure:AttributedString:AxHyperlink');
 assert.equal(property(property(hyperlink,'Inlines')[0],'Underline'),true);
 assert.equal(property(property(hyperlink,'Inlines')[0],'Text'),'www.axure.com/support');
 const spaced=pack.objects.find(o=>o.id==='3471e28ded924670841f3dfd061d33a0');assert.match(recoverRichText(spaced).reason,/character spacing/);
 const census=JSON.parse(fs.readFileSync(new URL('../rich-text-format-census.json',import.meta.url),'utf8'));
 const link=census.owners.find(o=>o.objectId==='14ea8a9456d14c888e8e483e64492173');assert.ok(link.block);
 // AxHyperlink remains outside the ordinary AxRun protocol; true underline alone is not permission to flatten it.
 assert.equal(link.block['attributed-string'].Paragraphs.flatMap(p=>p.Inlines).some(r=>r.Type==='Axure:AttributedString:AxHyperlink'),true);
});
