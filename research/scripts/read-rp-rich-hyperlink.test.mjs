import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './read-rp-objects.mjs';
import {property as p,recoverRichText} from './read-rp-semantics.mjs';
import {recoverInteractionMap} from './read-rp-interactions.mjs';

const census=JSON.parse(fs.readFileSync(new URL('../rich-hyperlink-format-census.json',import.meta.url),'utf8'));
const set=(object,key,value)=>{const pair=object.$map.find(p=>p[0]===key);if(pair)pair[1]=value;else object.$map.push([key,value]);};
const map=o=>({$map:Object.entries(o)}),ref=id=>({$reference:id,referenceTag:3}),zero='0'.repeat(32);
const packages=census.owners.map(o=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(o.file)).digest('hex'),o.sha256);
  return inspectRpObjects(o.file).packages.find(p=>p.packageId===o.packageId);
});
function fixture(index=0){
  const pack=structuredClone(packages[index]),identity=census.owners[index],objects=new Map(pack.objects.map(o=>[o.id,o]));
  const owner=objects.get(identity.ownerId),root=objects.get(pack.rootId),link=objects.get(identity.links[0].linkId);
  const style=objects.get(p(link.properties,'MyStyle').$reference),ix=p(p(style.properties,'PropList').find(e=>(p(e,'DOAName')&0xfffffff)===21),'Value');
  const paragraphs=p(p(p(owner.properties,'RichTextBlock'),'attributed-string'),'Paragraphs');
  const paragraph=paragraphs.find(p0=>p(p0,'Inlines').some(i=>p(i,'Type')==='Axure:AttributedString:AxHyperlink'));
  const inline=p(paragraph,'Inlines').find(i=>p(i,'Type')==='Axure:AttributedString:AxHyperlink');
  const type=name=>[...objects.values()].find(o=>o.type===name && identity.links[0].graph.some(g=>g.id===o.id));
  return {owner,root,objects,packageId:pack.packageId,link,style,ix,paragraph,inline,
    action:type('Axure:InteractionLinkWindowAction'),target:type('Axure:InteractionTarget'),literal:type('Axure:Expr:StringLiteral'),event:type('Axure:InteractionEvent'),case:type('Axure:InteractionCase')};
}
const read=f=>recoverRichText(f.owner,f),unsupported=f=>assert.equal(read(f).status,'unsupported-rich-text');

test('both SHA-pinned owners retain literal linked runs, independent links and complete New-window URL actions',()=>{
  for(let index=0;index<2;index++){
    const f=fixture(index),before=JSON.stringify(f.owner),r=read(f);
    assert.equal(r.status,'supported-rich-text');assert.equal(r.richText.expressionMode,'literal');
    assert.equal(r.source.runStyleSchemaVersion,2);assert.equal(r.source.linkSchemaVersion,1);assert.equal(r.source.linkCount,1);
    const l=r.richText.links[0],run=r.richText.paragraphs.flatMap(p=>p.runs).find(r=>r.linkId===l.id);
    assert.equal(l.id,f.link.id);assert.equal(run.style.underline,true);assert.equal(run.style.strikethrough,false);
    assert.deepEqual(l.interactions[0].actions.map(a=>({type:a.type,value:a.value,windowTarget:a.windowTarget})),[{type:'openUrl',value:index?'https://www.axure.com/support':'https://docs.axure.com/axure-rp/widgets/repeaters/',windowTarget:'new'}]);
    assert.deepEqual(l.mouseOverStyle,index?{underline:true}:{color:'#eb2084cd',underline:true});
    assert.deepEqual(l.mouseDownStyle,index?{color:'#ff0000'}:{});
    assert.equal(JSON.stringify(f.owner),before);
  }
});
test('local zero library can reference exact Default named identity; absent context never guesses',()=>{
  const f=fixture(1);assert.equal(p(f.style.properties,'LibraryId').$guid,zero);assert.notEqual(p(p(f.style.properties,'MatchInfo'),'LibraryId').$guid,zero);
  assert.equal(read(f).status,'supported-rich-text');assert.match(recoverRichText(f.owner).reason,/original local package context/);
});
test('repeated wrapper references share identity while each actual run retains its format',()=>{
  const f=fixture(),copy=structuredClone(f.inline);p(f.paragraph,'Inlines').splice(0,0,copy);
  const r=read(f);assert.equal(r.status,'supported-rich-text');assert.equal(r.richText.links.length,1);
  assert.equal(r.richText.paragraphs.flatMap(p=>p.runs).filter(r=>r.linkId).length,2);
});
test('aggregate linked run budget is enforced before repeated wrapper expansion',()=>{
  const f=fixture(),child=p(f.inline,'Inlines')[0];set(f.inline,'Inlines',Array(6000).fill(child));
  set(f.paragraph,'Inlines',[f.inline,f.inline]);assert.match(read(f).reason,/inline limit/);
});
for(const kind of ['wrong tag','zero','missing object','wrong type','extra ref','nested inline','empty children','duplicate field','unknown flag','adaptive','normal conflict','unknown state','duplicate state','missing cache','duplicate cache','wrong cache library','wrong named base','wrong local library','active unknown style','inactive unknown style','unknown cached style'])test(`atomic hyperlink reader boundary: ${kind}`,()=>{
  const f=fixture(),r=p(f.inline,'Link'),styles=p(p(f.root.properties,'StyleCache'),'Styles'),match=p(f.style.properties,'MatchInfo');
  const cache=styles.find(c=>p(p(c,'Info'),'Id').$guid===p(match,'Id').$guid && p(p(c,'Info'),'LibraryId').$guid===p(match,'LibraryId').$guid);
  if(kind==='wrong tag')r.referenceTag=22;
  if(kind==='zero')r.$reference=zero;
  if(kind==='missing object')f.objects.delete(r.$reference);
  if(kind==='wrong type')f.link.type='Axure:DiagramObject:VectorShape';
  if(kind==='extra ref')r.extra=true;
  if(kind==='nested inline')set(f.inline,'Inlines',[structuredClone(f.inline)]);
  if(kind==='empty children')set(f.inline,'Inlines',[]);
  if(kind==='duplicate field')f.link.properties.$map.push(['Disabled',false]);
  if(kind==='unknown flag')set(f.link.properties,'Error',true);
  if(kind==='adaptive')set(f.link.properties,'AdaptiveStyles',[ref('f'.repeat(32))]);
  if(kind==='normal conflict')set(p(f.inline,'Inlines')[0],'Underline',false);
  if(kind==='unknown state')f.ix.$map[0][0]='Selected';
  if(kind==='duplicate state')f.ix.$map[1][0]=f.ix.$map[0][0];
  if(kind==='missing cache')styles.splice(styles.indexOf(cache),1);
  if(kind==='duplicate cache')styles.push(structuredClone(cache));
  if(kind==='wrong cache library')set(p(cache,'Info'),'LibraryId',{$guid:'e'.repeat(32)});
  if(kind==='wrong named base')set(match,'Id',{$guid:'e'.repeat(32)});
  if(kind==='wrong local library')set(f.style.properties,'LibraryId',{$guid:'e'.repeat(32)});
  if(kind==='active unknown style'||kind==='inactive unknown style')p(f.style.properties,'PropList').push(map({DOAName:(kind==='active unknown style'?0xc0000000:0x80000000)+1003,Value:0}));
  if(kind==='unknown cached style')p(cache,'Props').push(map({DOAName:0x80000000+1003,Value:0}));
  if(kind==='inactive unknown style')assert.equal(read(f).status,'supported-rich-text');else unsupported(f);
});
for(const value of ['javascript:alert(1)','https://user:pass@example.test/','https://example.test/\npath','https://example.test/[[URL]]','https://example.test/\\path','https:///','https://example.test/'+ 'x'.repeat(4096)])test(`external URL rejected atomically: ${JSON.stringify(value).slice(0,60)}`,()=>{const f=fixture();set(f.literal.properties,'value',value);unsupported(f);});
for(const mode of [0,3,4,5,6])test(`unmapped native window mode ${mode} rejects entire linked rich graph`,()=>{const f=fixture();set(f.action.properties,'link-type',mode);unsupported(f);});
test('current literal URL mode works for both inline and ordinary widget interactions without normalization',()=>{
  const f=fixture();set(f.action.properties,'link-type',1);set(f.literal.properties,'value','HTTPS://example.test/%2F?q=%26#Hash');
  const a=read(f).richText.links[0].interactions[0].actions[0];assert.equal(a.windowTarget,'current');assert.equal(a.value,'HTTPS://example.test/%2F?q=%26#Hash');
  set(f.owner.properties,'InteractionMap',p(f.link.properties,'InteractionMap'));
  const ordinary=recoverInteractionMap({owner:f.owner,objects:f.objects,packageId:f.packageId});assert.equal(ordinary.events[0].cases[0].actions[0].type,'openUrl');
});

test('native hyperlink adaptive destinations survive the intermediate rich-text projection',()=>{
  for(const [guid,auto,expected]of [['c'.repeat(32),false,{kind:'view',viewId:'c'.repeat(32)}],['19e82109f102476f933582835c373474',false,{kind:'base'}],[zero,true,{kind:'auto'}]]){
    const f=fixture();f.action.type='Axure:InteractionSetAdaptiveView';f.action.properties=map({Disabled:false,set_adaptive_view_id:{$guid:guid},set_adaptive_view_to_auto:auto});
    const r=read(f);assert.equal(r.status,'supported-rich-text',r.reason);assert.deepEqual(r.richText.links[0].interactions[0].actions[0].adaptiveView,expected);
  }
});
test('unsupported action and event do not retain a working URL fragment',()=>{
  for(const mutate of [f=>set(f.action.properties,'Disabled',true),f=>{f.action.type='Axure:UnknownAction';},f=>set(f.event.properties,'Event',48)]){
    const f=fixture();mutate(f);unsupported(f);
  }
});
test('a fully decoded explicit SetFocus target remains available but This never becomes the host widget',()=>{
  for(const useThis of [false,true]){
    const f=fixture(),targetId='a'.repeat(32),pathId='b'.repeat(32);
    f.objects.set(targetId,{id:targetId,type:'Axure:DiagramObject:TextBox',properties:map({})});
    f.objects.set(pathId,{id:pathId,type:'Axure:DiagramObjectPath',properties:map({'rdo-path':[],'repeater-path':[],'object-id':{$reference:useThis?zero:targetId,referenceTag:22},'is-dummy':false})});
    f.action.type='Axure:InteractionSetFocusOnWidgetAction';f.action.properties=map({Disabled:false,panelobjectpaths:[ref(pathId)],SelectTextOnFocus:true});
    if(useThis)assert.match(read(f).reason,/This target/);else assert.equal(read(f).richText.links[0].interactions[0].actions[0].targetId,targetId);
  }
});
