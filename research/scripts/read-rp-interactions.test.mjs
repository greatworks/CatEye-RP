import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { property as p } from './read-rp-semantics.mjs';
import { recoverInteractionMap } from './read-rp-interactions.mjs';

const samples = new Map();
const sample = name => {
  if (!samples.has(name)) samples.set(name, inspectRpObjects(fileURLToPath(new URL(`../samples/${name}`, import.meta.url))));
  return structuredClone(samples.get(name));
};
const ZERO = '0'.repeat(32);
const ref = (id, tag = 3, name) => ({ $reference:id, referenceTag:tag, ...(name ? {name} : {}) });
function set(object, key, value) {
  const pair = object.properties.$map.find(pair => pair[0] === key);
  if (pair) pair[1] = value; else object.properties.$map.push([key,value]);
}
function fixture(file = 'complex-interactions-required-fields.rp', ownerId = 'cb0cc5841b274fdfb0698f9e05198f77') {
  const data = sample(file), part = data.packages.find(part => part.objects?.some(o=>o.id===ownerId));
  const objects = new Map(part.objects.map(o=>[o.id,o])), owner = objects.get(ownerId);
  return { owner, objects, packageId:part.packageId };
}
const decode = f => recoverInteractionMap(f);
const owned = data => data.packages.flatMap(part => {
  const objects = new Map((part.objects??[]).map(o=>[o.id,o]));
  return [...objects.values()].filter(o=>p(o.properties,'InteractionMap')||p(o.properties,'interactionmap')).map(owner=>({part:part.path,owner,...decode({owner,objects,packageId:part.packageId})}));
});
const successId = 'a5205725172f4d52b3628baeece06220';
const conditionId = '952cc9cfe4d24a85821876d2db090c8e';
const linkActionId = 'e8c66a2a12134e369e1a51bcc83990a9';

test('official Required Fields restores focus hide, ordered AND/default cases and Page package navigation', () => {
  const results = owned(sample('complex-interactions-required-fields.rp'));
  assert.equal(results.length,5); assert.ok(results.every(r=>r.status==='decoded-interaction-tree'));
  const events = results.flatMap(r=>r.events); assert.equal(events.length,3); assert.ok(events.every(e=>e.status==='supported-event'));
  assert.deepEqual(events.map(e=>e.event),['focus','focus','click']);
  assert.deepEqual(events.slice(0,2).map(e=>e.cases[0].actions[0].type),['hide','hide']);
  const click = events[2]; assert.deepEqual(click.cases.map(c=>c.name),['Successful Signup','Unsuccessful Signup']);
  assert.deepEqual(click.cases.map(c=>c.isNewIfGroup),[false,false]);
  assert.equal(click.cases[0].conditionMode,'all');
  assert.deepEqual(click.cases[0].conditions,[
    {source:'widgetText',targetSourceId:'28de2d860170465c8b28bbe3e69a5e42',operator:'notEquals',value:'',comparisonMode:'axure'},
    {source:'widgetText',targetSourceId:'65078eb0278d4c4fb0bbd3b77fa06c8b',operator:'notEquals',value:'',comparisonMode:'axure'},
  ]);
  assert.deepEqual(click.cases[0].actions,[{sourceId:linkActionId,type:'openPage',targetPackageId:'1862954f3d4d4eb69fb481b7b3512b77'}]);
  assert.equal(click.cases[1].actions[0].type,'show');
  assert.equal(click.cases[1].actions[0].targetSourceId,'eb900b90427f4f4b828f41c72e8db177');
});

test('official Tab Menu restores both complete ordered events, including This-widget selection', () => {
  const tabs = owned(sample('the-basics-tab-menu.rp')).filter(r=>r.events.length);
  assert.equal(tabs.length,2);
  for (const tab of tabs) {
    const event=tab.events[0];assert.equal(event.status,'supported-event');assert.equal(event.event,'click');
    assert.deepEqual(event.cases[0].actions.map(a=>a.type),['setState','setSelected']);
    assert.equal(event.cases[0].actions[0].targetSourceId,'c909f8f46aa742d4a7e1677418cdac66');
    assert.deepEqual(event.cases[0].actions[1],{sourceId:tab.owner.id==='2f76607a24f242f6ba9db84b579676c9'?'5f59984f93514eaebb42de8020c580f0':'c0388e597ae542e793a62f926c0ff5a3',type:'setSelected',targetSourceId:tab.owner.id,value:'true'});
  }
  assert.deepEqual(tabs.map(r=>r.events[0].cases[0].actions[0].targetPackageId),['23eeb8170eeb46959589f1496236e76b','cd27998bdbb547138fc87312c1037656']);
});

test('Quick Win restores two OnSelect panel actions, while animated/moving events still fail atomically', () => {
  const quick = owned(sample('Quick Win.rp')).flatMap(r=>r.events);
  assert.equal(quick.length,4);assert.ok(quick.every(e=>e.nativeEventType===53));
  const supported=quick.filter(e=>e.status==='supported-event');assert.equal(supported.length,2);
  assert.ok(supported.every(e=>e.event==='select'&&e.cases.length===1&&e.cases[0].actions.length===1&&e.cases[0].actions[0].type==='setState'));
  assert.deepEqual(supported.map(e=>e.cases[0].actions[0].targetPackageId),['0dafad5771cf4d8088ce17fb2c8d9929','1dc108e8c0864ae2970bc76105b03a18']);
  const rejected=quick.filter(e=>e.status==='unsupported-event');assert.equal(rejected.length,2);assert.ok(rejected.every(e=>/Unsupported active option easing/.test(e.reason)&&!('cases'in e)));
});

test('UX retains seven page links and one plain show; cross-package and lightbox behavior remains explicitly unsupported', () => {
  const results = owned(sample('UX Prototyping.rp'));
  assert.ok(results.every(r=>r.status==='decoded-interaction-tree'));
  const events = results.flatMap(r=>r.events), supported = events.filter(e=>e.status==='supported-event');
  assert.equal(events.length,15); assert.equal(supported.length,8);
  assert.equal(supported.flatMap(e=>e.cases.flatMap(c=>c.actions)).filter(a=>a.type==='openPage').length,7);
  assert.ok(events.some(e=>e.status==='unsupported-event'&&/show-type/.test(e.reason)));
  assert.equal(events.filter(e=>e.status==='unsupported-event'&&/not local/.test(e.reason)).length,6);
  // The same native action GUID in two page packages really has different destination packages.
  const copies=supported.flatMap(e=>e.cases.flatMap(c=>c.actions)).filter(a=>a.sourceId==='246c18e2f9e84d618eaeefabfcbd59b3');
  assert.deepEqual(copies.map(a=>a.targetPackageId),['52bb046bb95c4e789c35be661e8286b8','cb6927343c814c6d95ba86343baca891']);
});

test('tree child ordering survives shuffled object storage and reversed node-table entry order', () => {
  const f=fixture(), map=f.objects.get(p(f.owner.properties,'InteractionMap').$reference);
  p(map.properties,'node-table').$map.reverse(); f.objects=new Map([...f.objects].reverse());
  const cases=decode(f).events[0].cases;
  assert.deepEqual(cases.map(c=>c.id),[successId,'907f53a24ebb4b62b3821bd48f63872f']);
});

test('a bad first case action rejects the whole event and never leaves its ELSE branch executable', () => {
  const f=fixture(); f.objects.get(linkActionId).type='Axure:UnknownAction';
  const event=decode(f).events[0]; assert.equal(event.status,'unsupported-event');assert.match(event.reason,/UnknownAction/);assert.equal(event.cases,undefined);
});

test('one unsupported event does not discard an independent event in the same map', () => {
  const f=fixture(), map=f.objects.get(p(f.owner.properties,'InteractionMap').$reference), tree=f.objects.get(p(map.properties,'tree').$reference);
  const sourceMap=f.objects.get('89b4fc426ded4aff990f2d1cb445c197'), sourceTree=f.objects.get(p(sourceMap.properties,'tree').$reference);
  const nodes=p(sourceMap.properties,'node-table').$map.map(([r])=>f.objects.get(r.$reference));
  const eventNode=nodes[0]; set(eventNode,'parent-node',ref(tree.id)); for(const node of nodes)set(node,'tree',ref(tree.id));
  p(tree.properties,'children').push(ref(eventNode.id));p(map.properties,'node-table').$map.push(...p(sourceMap.properties,'node-table').$map);
  f.objects.get(linkActionId).type='Axure:UnknownAction';
  const result=decode(f);assert.equal(result.status,'decoded-interaction-tree');assert.deepEqual(result.events.map(e=>e.status),['unsupported-event','supported-event']);assert.equal(result.events[1].event,'focus');
});

test('event and case disabled states are preserved; a disabled action fails closed because current action model lacks enabled', () => {
  let f=fixture();set(f.objects.get(successId),'Disabled',true);assert.equal(decode(f).events[0].cases[0].enabled,false);
  f=fixture();set(f.objects.get('f5a77aa72cf74aad8851303f4a7d144a'),'Disabled',true);assert.ok(decode(f).events[0].cases.every(c=>!c.enabled));
  f=fixture();set(f.objects.get(linkActionId),'Disabled',true);assert.match(decode(f).events[0].reason,/Disabled action/);
});

test('homogeneous OR can flatten, while mixed Boolean groups are rejected without semantic approximation', () => {
  let f=fixture();set(f.objects.get(conditionId),'operation',2);let result=decode(f).events[0];assert.equal(result.status,'supported-event');assert.equal(result.cases[0].conditionMode,'any');assert.equal(result.cases[0].conditions.length,2);
  f=fixture(); const outer=f.objects.get(conditionId), left=f.objects.get(p(outer.properties,'left-expr').$reference), copy=structuredClone(left);copy.id='f'.repeat(32);f.objects.set(copy.id,copy);
  set(left,'operation',2);set(left,'left-expr',ref(copy.id));set(left,'right-expr',p(outer.properties,'right-expr'));
  result=decode(f).events[0];assert.equal(result.status,'unsupported-event');assert.match(result.reason,/mixed AND\/OR/);
});

test('stored comparison text is returned literally, including expression-looking text, quotes and newlines', () => {
  const f=fixture(), literal=f.objects.get('6ab6bb35a0e24083ba87c8d636eec8ee');
  const value='[[globalThis.constructor]] "quoted"\nsecond line';set(literal,'value',value);
  assert.equal(decode(f).events[0].cases[0].conditions[0].value,value);
});

test('unsupported expression functions, nonempty literal bindings, and comparison kinds reject whole events', () => {
  let f=fixture();set(f.objects.get('0baae8863739404b8ac479902b07da9e'),'function-name','EvaluateJavaScript');assert.match(decode(f).events[0].reason,/Unsupported condition function/);
  f=fixture();set(f.objects.get('6ab6bb35a0e24083ba87c8d636eec8ee'),'variable-identifiers',[ref('f'.repeat(32))]);assert.match(decode(f).events[0].reason,/literal variable bindings/);
  for(const operation of [5,6,7,8]) { f=fixture();set(f.objects.get('37f1bf472a7243ad95c658f983c960cf'),'operation',operation);assert.match(decode(f).events[0].reason,new RegExp(`comparison ${operation}`)); }
});

test('compound, missing and This-widget targets are rejected rather than rebound by name', () => {
  for(const kind of ['compound','missing','this']) {
    const f=fixture(), path=f.objects.get('d79d1a5c353f43929e006445b69619d8');
    if(kind==='compound')set(path,'rdo-path',[ref('f'.repeat(32))]);else set(path,'object-id',ref(kind==='missing'?'f'.repeat(32):ZERO,22));
    assert.equal(decode(f).events[0].status,'unsupported-event');
  }
});

test('active visual effects, unsupported link modes and non-Page target tags cannot be silently reduced', () => {
  let f=fixture();set(f.objects.get('f157bc38f6324ed39965b3dd69f7080d'),'show-type',2);assert.match(decode(f).events[0].reason,/show-type/);
  f=fixture();set(f.objects.get(linkActionId),'link-type',2);assert.match(decode(f).events[0].reason,/link window mode/);
  f=fixture();set(f.objects.get('ce1881d8cd414bcaa9cf11eb46123bcf'),'target-page-id',ref('1862954f3d4d4eb69fb481b7b3512b77',22));assert.match(decode(f).events[0].reason,/page package reference/);
});

test('synthetic isolated panel action preserves diagram package identity, not the inactive literal state index', () => {
  const f=fixture('the-basics-tab-menu.rp','bcfb632e6e7b4fe288077a145b7330df'), map=f.objects.get(p(f.owner.properties,'InteractionMap').$reference);
  const caseNode=f.objects.get('413ac084408a453799a91080056c48e0');set(caseNode,'children',p(caseNode.properties,'children').slice(0,1));
  const table=p(map.properties,'node-table');table.$map=table.$map.filter(([node])=>node.$reference!=='80fbaa20ac264cc089be33a9b71e74a3');
  const event=decode(f).events[0];assert.equal(event.status,'supported-event');assert.deepEqual(event.cases[0].actions,[{sourceId:'39a796f5f2a348aebbb137ad44039414',targetSourceId:'c909f8f46aa742d4a7e1677418cdac66',type:'setState',targetPackageId:'cd27998bdbb547138fc87312c1037656'}]);
  set(f.objects.get('4880c069c04045a1ac3d175e40b335a5'),'diagram-id',ref('f'.repeat(32),22));assert.match(decode(f).events[0].reason,/does not belong/);
});

test('malformed duplicate, dangling, unreachable and cyclic trees fail the complete map', () => {
  for(const kind of ['duplicate','dangling','unreachable','cycle','parent']){
    const f=fixture(), map=f.objects.get(p(f.owner.properties,'InteractionMap').$reference), table=p(map.properties,'node-table').$map, tree=f.objects.get(p(map.properties,'tree').$reference), node=f.objects.get(p(tree.properties,'children')[0].$reference);
    if(kind==='duplicate')table.push(table[0]);
    if(kind==='dangling')f.objects.delete(node.id);
    if(kind==='unreachable')set(tree,'children',[]);
    if(kind==='cycle')p(node.properties,'children').push(ref(node.id));
    if(kind==='parent')set(node,'parent-node',ref(ZERO));
    const result=decode(f);assert.equal(result.status,'unsupported-interaction-tree',kind);assert.deepEqual(result.events,[]);
  }
});

test('duplicate property names and unexpected behavior properties never overwrite silently', () => {
  let f=fixture();f.objects.get(successId).properties.$map.push(['Condition',ref(ZERO)]);assert.equal(decode(f).events[0].status,'unsupported-event');
  f=fixture();set(f.objects.get(linkActionId),'RunCustomScript','alert(1)');assert.match(decode(f).events[0].reason,/Unsupported .* property/);
});

test('missing interaction map returns an empty decoded tree and does not mutate source objects', () => {
  const f=fixture(), before=structuredClone(f.owner);const result=decode(f);assert.equal(result.events[0].status,'supported-event');assert.deepEqual(f.owner,before);
  f.owner={id:'a'.repeat(32),type:'Axure:Page',properties:{$map:[]}};assert.deepEqual(decode(f),{status:'decoded-interaction-tree',events:[]});
});

const tabFixture=()=>fixture('the-basics-tab-menu.rp','2f76607a24f242f6ba9db84b579676c9');
const selectionIds={action:'5f59984f93514eaebb42de8020c580f0',block:'a96b9905a0844e9993ba3e59c6e32c91',call:'7f77316bbcd840588d1c89cfc7864cd5',pathLiteral:'c5bcbb7b8df24e55ab523e40c6d2388f',path:'0098b81100af481bb3bf11d55e115c03',value:'cfd8738152d44b3a8e612a6e387cd857',event:'c78da0498c4942c49855d78d0bd225f3'};

test('selected-change/select/unselect remain distinct from droplist selection-change', () => {
  for(const [native,event] of [[51,'change'],[52,'selectedChange'],[53,'select'],[54,'unselect']]) {
    const f=tabFixture();set(f.objects.get(selectionIds.event),'event-type',native);
    const result=decode(f).events[0];assert.equal(result.status,'supported-event');assert.equal(result.event,event);
  }
});

test('SetCheckState static false/toggle preserve the explicit target and do not evaluate strings', () => {
  for(const value of ['true','false','toggle']) {
    const f=tabFixture();set(f.objects.get(selectionIds.value),'value',value);
    set(f.objects.get(selectionIds.path),'object-id',ref('bcfb632e6e7b4fe288077a145b7330df',22));
    const action=decode(f).events[0].cases[0].actions[1];assert.equal(action.value,value);assert.equal(action.targetSourceId,'bcfb632e6e7b4fe288077a145b7330df');
  }
  for(const value of ['FALSE','', '[[true]]', 'true\n', true]) {
    const f=tabFixture();set(f.objects.get(selectionIds.value),'value',value);const event=decode(f).events[0];
    assert.equal(event.status,'unsupported-event');assert.equal(event.cases,undefined);
  }
});

test('SetCheckState supports ordinary/checked targets but rejects container propagation and special tree semantics', () => {
  for(const type of ['VectorShape','ImageBox','TextBox','CheckBox','RadioButton']) {
    const f=tabFixture();f.owner.type=`Axure:DiagramObject:${type}`;
    assert.equal(decode(f).events[0].status,'supported-event',type);
  }
  for(const type of ['DynamicPanel','Repeater','Layer','TreeNode','UnknownWidget']) {
    const f=tabFixture();f.owner.type=`Axure:DiagramObject:${type}`;const event=decode(f).events[0];
    assert.equal(event.status,'unsupported-event',type);assert.match(event.reason,/Unsupported SetCheckState widget type/);assert.equal(event.cases,undefined);
  }
});

test('SetCheckState This must be the local widget owner; compound/dummy/dangling paths never rebind', () => {
  for(const kind of ['page','detached-owner','rdo','repeater','dummy','missing','wrong-tag']) {
    const f=tabFixture(),path=f.objects.get(selectionIds.path);
    if(kind==='page'){f.owner.type='Axure:Page';set(f.owner,'interactionmap',p(f.owner.properties,'InteractionMap'));}
    if(kind==='detached-owner')f.owner=structuredClone(f.owner);
    if(kind==='rdo')set(path,'rdo-path',[ref(f.owner.id)]);
    if(kind==='repeater')set(path,'repeater-path',[ref(f.owner.id)]);
    if(kind==='dummy')set(path,'is-dummy',true);
    if(kind==='missing')set(path,'object-id',ref('f'.repeat(32),22));
    if(kind==='wrong-tag')set(path,'object-id',ref(f.owner.id,3));
    const event=decode(f).events[0];assert.equal(event.status,'unsupported-event',kind);assert.equal(event.cases,undefined);
  }
});

test('unknown options anywhere in SetCheckState reject the full event including its earlier panel action', () => {
  for(const [object,key,value] of [['action','DontFire',true],['action','animation',0],['block','SuppressEvents',false],['call','animation',0],['pathLiteral','isFocused',false],['path','extra',false],['value','evaluate',false]]) {
    const f=tabFixture();set(f.objects.get(selectionIds[object]),key,value);const event=decode(f).events[0];
    assert.equal(event.status,'unsupported-event',`${object}.${key}`);assert.match(event.reason,/Unsupported .* property/);assert.equal(event.cases,undefined);
  }
});

test('SetCheckState mismatched functions, disabled actions, bound values and extra arguments fail closed', () => {
  for(const kind of ['action-function','call-function','disabled','extra-arg','bound','scope','target-scope','empty-block','wrong-expression']) {
    const f=tabFixture();
    if(kind==='action-function')set(f.objects.get(selectionIds.action),'SetFunction','SetSelectedOption');
    if(kind==='call-function')set(f.objects.get(selectionIds.call),'function-name','SetSelectedOption');
    if(kind==='disabled')set(f.objects.get(selectionIds.action),'Disabled',true);
    if(kind==='extra-arg')p(f.objects.get(selectionIds.call).properties,'args').push(ref(selectionIds.value));
    if(kind==='bound')set(f.objects.get(selectionIds.value),'variable-identifiers',[ref(f.owner.id)]);
    if(kind==='scope')set(f.objects.get(selectionIds.value),'repeater-scope',ref(f.owner.id));
    if(kind==='target-scope')set(f.objects.get(selectionIds.value),'TargetRepeaterScope',ref(f.owner.id));
    if(kind==='empty-block')set(f.objects.get(selectionIds.block),'subexpressions',[]);
    if(kind==='wrong-expression')f.objects.get(selectionIds.value).type='Axure:Expr:BinaryExpr';
    const event=decode(f).events[0];assert.equal(event.status,'unsupported-event',kind);assert.equal(event.cases,undefined);
  }
});

test('a SetCheckState block retains subexpression order and source identity, and a bad later call rejects all', () => {
  const f=tabFixture(),call=structuredClone(f.objects.get(selectionIds.call)),value=structuredClone(f.objects.get(selectionIds.value));
  call.id='e'.repeat(32);value.id='f'.repeat(32);set(value,'value','false');set(call,'args',[ref(selectionIds.pathLiteral),ref(value.id)]);
  f.objects.set(call.id,call);f.objects.set(value.id,value);p(f.objects.get(selectionIds.block).properties,'subexpressions').push(ref(call.id));
  const actions=decode(f).events[0].cases[0].actions;assert.deepEqual(actions.map(a=>a.type),['setState','setSelected','setSelected']);
  assert.deepEqual(actions.slice(1).map(a=>[a.sourceId,a.value]),[[selectionIds.action,'true'],[selectionIds.action,'false']]);
  set(call,'function-name','RunScript');const event=decode(f).events[0];assert.equal(event.status,'unsupported-event');assert.equal(event.cases,undefined);
});
