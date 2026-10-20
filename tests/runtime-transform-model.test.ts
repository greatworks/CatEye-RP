import { describe, expect, it } from 'vitest';
import { cloneWidgets, createDocument, createWidget, parseDocument, parseMotionBoundary, parseMotionExpression, serializeDocument, uid } from '../src/model/document';
import { createComponent, createComponentInstance } from '../src/model/components';
import { MOVE_MODES, MOVE_TRAJECTORIES, ROTATION_ANCHORS, ROTATION_EASINGS, type Action, type MotionBoundary, type MoveTargetSpec, type ResizeTargetSpec } from '../src/model/types';

const expr = (text = '0') => ({ text });
const move = (id = 'target'): MoveTargetSpec => ({ target: { kind: 'widget', id }, mode: 'location', x: expr('[[Target.x + 20]]'), y: expr(''), trajectory: 'straight', easing: 'linear', duration: 200 });
const resize = (id = 'target'): ResizeTargetSpec => ({ target: { kind: 'widget', id }, width: expr('[[Target.width + 40]]'), height: expr('160'), anchor: 'top left', easing: 'linear', duration: 300 });
const bound = (): Extract<MotionBoundary, { kind: 'compare' }> => ({ kind: 'compare', operator: '>', direction: 'top', left: expr('[[This.y - (This.y - Target.y)]]'), right: expr('0') });
function fixture(type: 'move' | 'resize' = 'move') {
  const doc = createDocument(), owner = createWidget('button'), target = createWidget('box');
  const action: Action = type === 'move' ? { id: uid(), type, move: { targets: [move(target.id)] } } : { id: uid(), type, resize: { targets: [resize(target.id)] } };
  owner.interactions = [{ id: uid(), name: 'Transform', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [action] }];
  doc.pages[0].widgets = [owner, target]; return { doc, owner, target, action };
}
const roundtrip = (doc: ReturnType<typeof createDocument>) => parseDocument(serializeDocument(doc));

describe('structured motion storage', () => {
  it('preserves legacy numeric actions and their inert duration without adding structured parameters', () => {
    const { doc, action, target } = fixture(); delete action.move; Object.assign(action, { targetId: target.id, x: 20, y: 30, duration: 500 });
    const before = serializeDocument(doc); expect(serializeDocument(roundtrip(doc))).toBe(before);
  });
  it('preserves ordered and duplicate entries, separate expression scopes and boolean boundary structure', () => {
    const { doc, target, action } = fixture();
    action.move!.targets.push({ ...move(target.id), x: { text: '[[track.width]]', bindings: { track: { kind: 'widget', targetId: target.id } } }, boundary: { kind: 'or', left: bound(), right: { ...bound(), operator: '<=', direction: 'right' } } });
    expect(roundtrip(doc)).toEqual(doc); expect(roundtrip(doc).pages[0].widgets[0].interactions[0].actions[0].move!.targets).toHaveLength(2);
  });
  it.each(MOVE_MODES)('retains mode %s', mode => { const { doc, action } = fixture(); action.move!.targets[0].mode = mode; expect(roundtrip(doc)).toEqual(doc); });
  it.each(MOVE_TRAJECTORIES)('retains trajectory %s even while easing is none', trajectory => { const { doc, action } = fixture(); Object.assign(action.move!.targets[0], { trajectory, easing: 'none' }); expect(roundtrip(doc)).toEqual(doc); });
  it.each(ROTATION_ANCHORS)('retains Size anchor %s', anchor => { const { doc, action } = fixture('resize'); action.resize!.targets[0].anchor = anchor; expect(roundtrip(doc)).toEqual(doc); });
  it.each(ROTATION_EASINGS)('retains native easing %s', easing => { const { doc, action } = fixture(); action.move!.targets[0].easing = easing; expect(roundtrip(doc)).toEqual(doc); });
  it.each(['this', 'widgetsBelow', 'widgetsRight'] as const)('retains Move context target %s', kind => { const { doc, action } = fixture(); action.move!.targets[0].target = { kind }; expect(roundtrip(doc)).toEqual(doc); });
  it.each(['this', 'thisItem'] as const)('retains Size context target %s', kind => { const { doc, action } = fixture('resize'); action.resize!.targets[0].target = { kind }; expect(roundtrip(doc)).toEqual(doc); });
  it.each(['targetId', 'value', 'x', 'y', 'duration', 'style'])('rejects ambiguous outer %s', field => {
    for (const type of ['move', 'resize'] as const) { const { doc, action } = fixture(type); Object.assign(action, { [field]: field === 'style' ? { fill: '#fff' } : field === 'value' || field === 'targetId' ? 'target' : 1 }); expect(() => roundtrip(doc)).toThrow('legacy'); }
  });
  it('rejects specs on an unrelated action and a Move/Size combination', () => {
    const { doc, action } = fixture(); action.type = 'show'; expect(() => roundtrip(doc)).toThrow('only supported');
    action.type = 'move'; action.resize = { targets: [resize()] }; expect(() => roundtrip(doc)).toThrow('only supported');
  });
  it.each(['target', 'mode', 'x', 'y', 'trajectory', 'easing', 'duration'])('requires Move %s', field => {
    const { doc, action } = fixture(); delete (action.move!.targets[0] as unknown as Record<string, unknown>)[field]; expect(() => roundtrip(doc)).toThrow();
  });
  it.each(['target', 'width', 'height', 'anchor', 'easing', 'duration'])('requires Size %s', field => {
    const { doc, action } = fixture('resize'); delete (action.resize!.targets[0] as unknown as Record<string, unknown>)[field]; expect(() => roundtrip(doc)).toThrow();
  });
  it.each([[[] as MoveTargetSpec[]], [Array.from({ length: 201 }, () => move())]])('bounds the target list', targets => { const { doc, action } = fixture(); action.move!.targets = targets; expect(() => roundtrip(doc)).toThrow(); });
  it('rejects unsupported target forms and a Size By discriminator', () => {
    const { doc, action } = fixture('resize'); Object.assign(action.resize!.targets[0], { mode: 'by' }); expect(() => roundtrip(doc)).toThrow('unknown field');
    delete (action.resize!.targets[0] as unknown as Record<string, unknown>).mode;
    Object.assign(action.resize!.targets[0].target, { kind: 'thisItem' }); expect(() => roundtrip(doc)).toThrow('no widget identifier');
    action.resize!.targets[0].target = { kind: 'widgetsBelow' } as never; expect(() => roundtrip(doc)).toThrow();
  });
});

describe('bound expression and boundary validation', () => {
  it('keeps an explicitly empty binding map and empty input', () => { expect(parseMotionExpression({ text: '', bindings: {} })).toEqual({ text: '', bindings: {} }); });
  it.each(['Track', 'bad.name', '', 'a-b', '变量'])('rejects a noncanonical alias %s', alias => { expect(() => parseMotionExpression({ text: '1', bindings: { [alias]: { kind: 'widget', targetId: 'x' } } })).toThrow(); });
  it('rejects unsafe keys, arbitrary binding code and unbounded scopes', () => {
    expect(() => parseMotionExpression(JSON.parse('{"text":"1","bindings":{"__proto__":{"kind":"widget","targetId":"x"}}}'))).toThrow('unsafe');
    expect(() => parseMotionExpression({ text: '1', bindings: { x: { kind: 'widget', targetId: 'x', evaluate: 'evil()' } } })).toThrow('unknown');
    expect(() => parseMotionExpression({ text: '1', bindings: Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`x${i}`, { kind: 'widget', targetId: 'x' }])) })).toThrow('128');
    expect(() => parseMotionExpression({ text: 'x'.repeat(4101) })).toThrow('4100');
  });
  it('requires a direction on every comparison and keeps AST left expressions', () => {
    expect(parseMotionBoundary(bound())).toEqual(bound());
    const node = { ...bound(), direction: undefined }; expect(() => parseMotionBoundary(node)).toThrow();
    expect(() => parseMotionBoundary({ kind: 'and', left: bound(), right: bound(), operator: '>=' })).toThrow('only');
  });
  it('bounds recursive and branching boundary trees', () => {
    let tree: MotionBoundary = bound(); for (let i = 0; i < 18; i++) tree = { kind: 'or', left: tree, right: bound() }; expect(() => parseMotionBoundary(tree)).toThrow('limit');
    const full = (depth: number): MotionBoundary => depth ? { kind: 'and', left: full(depth - 1), right: full(depth - 1) } : bound();
    expect(() => parseMotionBoundary(full(7))).toThrow('limit');
  });
});

describe('copy and component transform identities', () => {
  it('remaps nested bindings, target pairs and boundary expressions, preserving external and quoted references', () => {
    const { owner, target, action } = fixture(); target.id = 'motion-target';
    action.move!.targets = [{ ...move(target.id), x: { text: '[[Widget.motion-target.text + "Widget.motion-target.text"]]', bindings: { track: { kind: 'widget', targetId: target.id } } }, boundary: { kind: 'or', left: { ...bound(), right: { text: '[[outside.width]]', bindings: { outside: { kind: 'widget', targetId: 'external' } } } }, right: { ...bound(), left: { text: '[[track.x]]', bindings: { track: { kind: 'widget', targetId: target.id } } } } } }];
    owner.interactions[0].actions.push({ id: uid(), type: 'resize', resize: { targets: [{ ...resize(target.id), width: { text: '[[track.width]]', bindings: { track: { kind: 'widget', targetId: target.id } } } }] } });
    const before = structuredClone(owner), [copy, local] = cloneWidgets([owner, target], 0), [m, r] = copy.interactions[0].actions;
    expect(m.move!.targets[0].target).toEqual({ kind: 'widget', id: local.id });
    expect(m.move!.targets[0].x).toEqual({ text: `[[Widget.${local.id}.text + "Widget.motion-target.text"]]`, bindings: { track: { kind: 'widget', targetId: local.id } } });
    expect(JSON.stringify(m.move!.targets[0].boundary)).toContain('external');
    expect(JSON.stringify(m.move!.targets[0].boundary)).toContain(local.id);
    expect(r.resize!.targets[0].width.bindings!.track.targetId).toBe(local.id); expect(owner).toEqual(before);
  });
  it('assigns independent bound targets to separate component instances', () => {
    const { owner, target, action } = fixture(); action.move!.targets[0].x = { text: '[[track.width]]', bindings: { track: { kind: 'widget', targetId: target.id } } };
    const component = createComponent([owner, target]), instances = [createComponentInstance(component), createComponentInstance(component)];
    for (const instance of instances) { const [button, box] = instance.states![0].widgets; const entry = button.interactions[0].actions[0].move!.targets[0]; expect(entry.target).toEqual({ kind: 'widget', id: box.id }); expect(entry.x.bindings!.track.targetId).toBe(box.id); }
    expect(instances[0].states![0].widgets[1].id).not.toBe(instances[1].states![0].widgets[1].id);
  });
});
