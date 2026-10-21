import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverRpSemantics, property } from './read-rp-semantics.mjs';

const census = JSON.parse(fs.readFileSync(new URL('../selection-author-resize-census.json', import.meta.url), 'utf8'));
const sources = new Map();
for (const source of census.samples.filter(sample => sample.selectionControls > 0)) {
  const bytes = fs.readFileSync(source.file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
  sources.set(source.file, inspectRpObjects(source.file));
}
const defaultPath = fileURLToPath(new URL('../samples/Default.rplib', import.meta.url));
const defaultSource = [...sources].find(([file]) => file.replaceAll('\\', '/').endsWith('/Default.rplib'))?.[1]
  ?? inspectRpObjects(defaultPath);
const defaultCheckbox = defaultSource.packages.flatMap(pack => pack.objects.map(widget => ({ pack, widget })))
  .find(({ widget }) => widget.type === 'Axure:DiagramObject:Checkbox');
assert(defaultCheckbox);
function recovered(source, id = defaultCheckbox.widget.id) {
  return recoverRpSemantics(source).diagrams.flatMap(page => page.widgets).find(widget => widget.id === id);
}
function change(callback) {
  const source = structuredClone(defaultSource);
  const widget = source.packages.find(pack => pack.packageId === defaultCheckbox.pack.packageId)
    .objects.find(widget => widget.id === defaultCheckbox.widget.id);
  callback(widget);
  return recovered(source);
}

test('recognizes all 22 exact native Checkbox carriers and retains all 17 RadioButton carriers', () => {
  let checkboxes = 0, radios = 0;
  for (const [file, decoded] of sources) {
    const before = JSON.stringify(decoded);
    const semantic = recoverRpSemantics(decoded);
    for (const row of census.widgets.filter(widget => widget.sourceFile === file)) {
      const widget = semantic.diagrams.find(page => page.packageId === row.packageId)?.widgets.find(widget => widget.id === row.sourceId);
      const type = row.type === 'Axure:DiagramObject:Checkbox' ? 'checkbox' : 'radio';
      assert.equal(widget?.type, row.type);
      assert.equal(widget?.typeCandidate?.type, type, `${file}: ${row.sourceId}`);
      assert.equal(widget?.selectionRecovery?.status, 'supported-selection', row.sourceId);
      assert.equal(widget.storedFlags.AutoFitWidth, row.fields.AutoFitWidth);
      assert.equal(widget.storedFlags.AutoFitHeight, row.fields.AutoFitHeight);
      assert.deepEqual(widget.selectionLayoutRecovery?.sharedFields, {
        AutoFitWidth: row.fields.AutoFitWidth,
        AutoFitHeight: row.fields.AutoFitHeight,
        'align-selection-button-right': row.fields['align-selection-button-right'],
      });
      assert.equal(widget.selectionLayoutRecovery.status, 'supported-selection-layout');
      assert.equal(widget.selectionLayoutRecovery.buttonSize.value, row.indicatorEvidence.effective.property.value);
      assert.equal(widget.selectionLayoutRecovery.cacheChainComplete, true);
      type === 'checkbox' ? checkboxes++ : radios++;
    }
    assert.equal(JSON.stringify(decoded), before);
  }
  assert.deepEqual({ checkboxes, radios }, { checkboxes: 22, radios: 17 });
});

test('selection layout rejects absent, malformed and duplicate shared flags rather than choosing defaults', () => {
  for (const key of ['AutoFitWidth', 'AutoFitHeight', 'align-selection-button-right']) {
    for (const value of [undefined, null, 0, key === 'align-selection-button-right' ? false : 'False']) {
      const row = change(widget => {
        widget.properties.$map = widget.properties.$map.filter(pair => pair[0] !== key);
        if (value !== undefined) widget.properties.$map.push([key, value]);
      });
      assert.equal(row.selectionLayoutRecovery?.status, 'unsupported-selection-layout', `${key}: ${value}`);
    }
  }
});

function changeIndicator(callback) {
  const source = structuredClone(defaultSource);
  const pack = source.packages.find(pack => pack.packageId === defaultCheckbox.pack.packageId);
  const widget = pack.objects.find(widget => widget.id === defaultCheckbox.widget.id);
  const style = pack.objects.find(object => object.id === property(widget.properties, 'MyStyle').$reference);
  callback({ pack, widget, style });
  return recovered(source);
}
const map = pairs => ({ $map: pairs });
const prop = (key,value,flags=0xc0000000) => map([['DOAName',key|flags],['Value',value]]);
const replace = (value,key,next) => {
  const pair = value.$map.find(pair => pair[0] === key);
  if (pair) pair[1] = next; else value.$map.push([key,next]);
};
function declaration({pack,widget,style}, target, value, flags=0xc0000000) {
  const id = 'd'.repeat(32), record = {id,type:'Axure:Style',properties:map([['All',false],['PropList',[prop(94,value,flags)]]])};
  pack.objects.push(record);
  if (target === 'adaptive') replace(widget.properties,'AdaptiveStyles',[{$guid:'c'.repeat(32)},{$reference:id,referenceTag:3}]);
  else {
    const properties = property(style.properties,'PropList').filter(item => (property(item,'DOAName')&0x0fffffff)!==21);
    properties.push(prop(21,map([[target,{$reference:id,referenceTag:3}]])));
    replace(style.properties,'PropList',properties);
  }
}
test('selection indicator size requires a resolved cache and unambiguous determined active P94', () => {
  for (const value of [NaN, Infinity, -1, 100001, '14', null]) {
    const row = changeIndicator(({ style }) => {
      const list = property(style.properties, 'PropList');
      const field = list.find(item => (property(item, 'DOAName') & 0x0fffffff) === 94);
      assert(field);
      field.$map.find(pair => pair[0] === 'Value')[1] = value;
    });
    assert.equal(row.selectionLayoutRecovery?.status, 'unsupported-selection-layout', String(value));
  }
  for (const raw of [94 | 0x40000000, 94 | 0xd0000000]) {
    const row = changeIndicator(({ style }) => {
      const field = property(style.properties, 'PropList').find(item => (property(item, 'DOAName') & 0x0fffffff) === 94);
      field.$map.find(pair => pair[0] === 'DOAName')[1] = raw;
    });
    assert.equal(row.selectionLayoutRecovery?.status, 'unsupported-selection-layout', String(raw));
  }
  const missing = changeIndicator(({ style }) => {
    style.properties.$map = style.properties.$map.filter(pair => pair[0] !== 'MatchInfo');
  });
  assert.equal(missing.selectionLayoutRecovery?.status, 'unsupported-selection-layout');
});

test('inactive local P94 does not mask its identified default-cache value', () => {
  const row = changeIndicator(({ style }) => {
    const field = property(style.properties, 'PropList').find(item => (property(item, 'DOAName') & 0x0fffffff) === 94);
    field.$map.find(pair => pair[0] === 'DOAName')[1] = 94 | 0x80000000;
    field.$map.find(pair => pair[0] === 'Value')[1] = 91;
  });
  assert.equal(row.selectionLayoutRecovery?.status, 'supported-selection-layout');
  assert.equal(row.selectionLayoutRecovery.buttonSize.value, 12);
  assert.equal(row.selectionLayoutRecovery.buttonSize.source.kind, 'cached-document-default');
  assert.deepEqual(row.selectionLayoutRecovery.inactive, { rawDoaName: 94 | 0x80000000, value: 91 });
  assert.equal(row.styleRecovery.style.selectionButtonSize, 12);
});

for (const target of ['Selected','MouseOver','adaptive']) {
  test(`preserves explicit selection indicator sizes in ${target} declarations without changing shared fit`, () => {
    for (const value of [0,12,37.5,100000]) {
      const row = changeIndicator(context => declaration(context,target,value));
      const patch = target === 'adaptive' ? row.adaptiveStyleRecovery.entries?.[0].patch.style
        : target === 'Selected' ? row.selectionRecovery.selectedStyle : row.interactionStyleRecovery.states.mouseover.style;
      assert.deepEqual(patch,{selectionButtonSize:value}, `${target}: ${value}`);
      assert.equal(row.selectionLayoutRecovery.sharedFields.AutoFitWidth,defaultCheckbox.widget.properties.$map.find(([key])=>key==='AutoFitWidth')[1]);
      assert.notEqual(row.selectionLayoutRecovery.buttonSize.value,37.5);
    }
  });
  test(`keeps inactive selection indicator snapshots out of ${target} declarations`, () => {
    const row = changeIndicator(context => declaration(context,target,91,0x80000000));
    const patch = target === 'adaptive' ? row.adaptiveStyleRecovery.entries?.[0].patch
      : target === 'Selected' ? row.selectionRecovery.selectedStyle : row.interactionStyleRecovery.states.mouseover.style;
    assert.deepEqual(patch,{});
  });
  test(`rejects invalid active selection indicator values in ${target}`, () => {
    for (const [value,flags] of [[-1,0xc0000000],['12',0xc0000000],[12,0xd0000000]]) {
      const row = changeIndicator(context => declaration(context,target,value,flags));
      const status = target === 'adaptive' ? row.adaptiveStyleRecovery.status
        : target === 'Selected' ? row.selectionRecovery.status : row.interactionStyleRecovery.states.mouseover.status;
      assert.equal(status,target === 'adaptive' ? 'unsupported-adaptive-styles'
        : target === 'Selected' ? 'unsupported-selection' : 'unsupported-state-style');
    }
  });
}
test('rejects malformed inactive adaptive P94 records without turning them into defaults', () => {
  for (const [value,flags] of [[-1,0x80000000],[12,0xa0000000]]) {
    const row = changeIndicator(context => declaration(context,'adaptive',value,flags));
    assert.equal(row.adaptiveStyleRecovery.status,'unsupported-adaptive-styles');
  }
});

test('does not accept misspelled native control classes or ambiguous alignment fields', () => {
  for (const type of ['Axure:DiagramObject:checkbox', 'Axure:DiagramObject:CHECKBOX', 'Axure:DiagramObject:CheckboxUnknown']) {
    assert.equal(change(widget => { widget.type = type; }).typeCandidate, null, type);
  }
  const duplicate = change(widget => {
    widget.properties.$map.push(['align-selection-button-right', property(widget.properties, 'align-selection-button-right')]);
  });
  assert.equal(duplicate.status, 'unsupported-widget-fields');
});
