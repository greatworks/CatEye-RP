import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {recoverRichText} from './read-rp-semantics.mjs';

const map=object=>({$map:Object.entries(object)}),guid={$guid:'a'.repeat(32)};
const run=(text,style={})=>map({Type:'Axure:AttributedString:AxRun',Text:text,Family:'Arial',Size:9.75,Weight:400,Style:0,Stretch:5,Underline:false,Color:-16777216,Baseline:0,CharacterSpacing:0,Strikethrough:false,...style});
const paragraph=(runs,line=0)=>map({Wrapping:0,Trimming:0,HorizontalAlignment:0,LineSpacing:line,ListInfo:map({IndentLevel:0,ListType:0}),Inlines:runs});
const fixture=(paragraphs=[paragraph([run('Hello')])])=>({type:'Axure:DiagramObject:VectorShape',properties:map({RichTextBlock:map({'*type':'rich-text-block','attributed-string':map({Version:map({Major:11,Minor:0,Build:0,Revision:0}),Paragraphs:paragraphs}),'property-dictionary':map({type:'rich-text-object','diagram-object-label':'','text-object-id':guid,'parent-diagram-id':guid})})})});
const set=(map,key,value)=>{const pair=map.$map.find(p=>p[0]===key);if(pair)pair[1]=value;else map.$map.push([key,value]);};

test('native mixed runs remain literal and preserve explicit fonts and paragraph units',()=>{
  const f=fixture([paragraph([run('Bold ',{Weight:700}),run('[[Example]]\n',{Style:1,Size:16.5})],12),paragraph([run('Next\n')],21),paragraph([run('Final')],27)]),before=JSON.stringify(f),r=recoverRichText(f);
  assert.equal(r.status,'supported-rich-text');assert.equal(r.richText.expressionMode,'literal');
  assert.equal(r.text,'Bold [[Example]]\nNext\nFinal');assert.deepEqual(r.richText.paragraphs.map(p=>p.lineHeightPx),[16,28,36]);
  assert.deepEqual(r.richText.paragraphs[0].runs[1],{text:'[[Example]]',style:{fontFamily:'Arial',fontSize:22,fontWeight:400,fontStyle:'italic',color:'#000000',underline:false,strikethrough:false}});
  assert.equal(JSON.stringify(f),before);
});

test('blank paragraphs and empty final runs preserve exactly one native boundary LF',()=>{
  const r=recoverRichText(fixture([paragraph([run('A\n')]),paragraph([run('\n')]),paragraph([run('')])]));
  assert.equal(r.text,'A\n\n');assert.deepEqual(r.richText.paragraphs.map(p=>p.runs[0].text),['A','','']);
  assert.equal(r.source.normalizedBoundaryLF,2);assert.equal(r.richText.paragraphs[1].lineHeightPx,'normal');
});

test('unknown, duplicate, missing and executable font fields fail the entire rich payload',()=>{
  for(const [key,value]of [['Family','Arial;url(x)'],['Size',NaN],['Size',0],['Weight',1001],['Style',2],['Style',-1],['Color','red'],['Stretch',4],['Underline',1],['Strikethrough','true'],['Baseline',1],['CharacterSpacing',.3],['Unexpected',0]]) {
    const r=run('safe');set(r,key,value);const result=recoverRichText(fixture([paragraph([r])]));assert.equal(result.status,'unsupported-rich-text',`${key}/${value}`);assert.equal(result.richText,undefined);
  }
  const duplicate=run('safe');duplicate.$map.push(['Style',0]);assert.equal(recoverRichText(fixture([paragraph([duplicate])])).status,'unsupported-rich-text');
  const missing=run('safe');missing.$map=missing.$map.filter(([k])=>k!=='Style');assert.equal(recoverRichText(fixture([paragraph([missing])])).status,'unsupported-rich-text');
});

test('unknown inline type, paragraph options and unsupported breaks are not silently flattened',()=>{
  for(const [key,value]of [['Wrapping',1],['Trimming',2],['HorizontalAlignment',3],['LineSpacing',-1],['LineSpacing',.01],['LineSpacing',Infinity],['ListInfo',map({IndentLevel:1,ListType:0})],['UnknownParagraph',0]]) {
    const p=paragraph([run('safe')]);set(p,key,value);assert.equal(recoverRichText(fixture([p])).status,'unsupported-rich-text');
  }
  for(const content of ['\t','\r','last\n','internal\ntext'])assert.equal(recoverRichText(fixture([paragraph([run(content)])])).status,'unsupported-rich-text');
  assert.equal(recoverRichText(fixture([paragraph([run('no boundary')]),paragraph([run('last')])])).status,'unsupported-rich-text');
  assert.equal(recoverRichText(fixture([paragraph([run('two\n\n')]),paragraph([run('last')])])).status,'unsupported-rich-text');
  const unknown=run('Link');set(unknown,'Type','Axure:AttributedString:UnknownInline');assert.match(recoverRichText(fixture([paragraph([unknown])])).reason,/inline type/);
});

test('budgets and incomplete empty structures are rejected, while absent rich fields are identified separately',()=>{
  const invalid=[[],[paragraph([])],Array.from({length:1001},()=>paragraph([run('\n')])),[paragraph(Array.from({length:10001},()=>run('')))], [paragraph([run('x'.repeat(100001))])]];
  for(const paragraphs of invalid)assert.equal(recoverRichText(fixture(paragraphs)).status,'unsupported-rich-text');
  assert.equal(recoverRichText({properties:map({})}).status,'no-rich-text');
});

test('all 49 SHA-pinned mixed owners recover; hyperlinks require their original package context',()=>{
  const prior=JSON.parse(fs.readFileSync(new URL('../font-style-format-verification.json',import.meta.url),'utf8'));
  let count=0,paragraphs=0,runs=0,conflicts=0,literals=0;
  for(const sample of prior.samples) {
    if(!sample.italicOwners.length)continue;
    assert.equal(createHash('sha256').update(fs.readFileSync(sample.file)).digest('hex'),sample.sha256);
    const decoded=inspectRpObjects(sample.file);
    for(const owner of sample.italicOwners) {
      const pack=decoded.packages.find(p=>p.packageId===owner.packageId),widget=pack.objects.find(o=>o.id===owner.objectId),r=recoverRichText(widget);
      if(!owner.imported){assert.equal(r.status,'unsupported-rich-text');assert.match(r.reason,/original local package context/);continue;}
      assert.equal(r.status,'supported-rich-text',owner.objectId);count++;paragraphs+=r.source.paragraphCount;runs+=r.source.runCount;
      if(r.text.includes('[['))literals++;
      if(['9ae80b88ab624d3aa80eb671b09e5c7f','c4338edb658541abaea6b13bdefe6d83','343f5bc495e94af3aa5abf4d71685da7'].includes(owner.objectId)){assert.ok(r.richText.paragraphs.every(p=>p.runs.every(run=>run.style.fontSize===22)));conflicts++;}
    }
  }
  assert.deepEqual({count,paragraphs,runs,conflicts,literals},{count:49,paragraphs:241,runs:1093,conflicts:3,literals:1});
});
