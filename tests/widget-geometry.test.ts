import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

type Step = Omit<Action, 'id'>;
const interaction = (actions: Step[], event: Interaction['event'] = 'click', extra: Partial<Interaction> = {}): Interaction => ({ id: uid(), name: event, event, enabled: true, isNewIfGroup: true, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: uid() })), ...extra });
const record = (value: string): Step => ({ type: 'setVariable', targetId: 'Trace', value: `[[Trace]]${value}` });
const box = (root: string) => ['x', 'y', 'width', 'height', 'left', 'right', 'top', 'bottom'].map(p => `[[${root}.${p}]]`).join(',');

function fixture(portable: boolean) {
  const doc = createDocument(), source = createWidget('button'), target = createWidget('text'), list = createWidget('repeater'), child = createWidget('button'), cell = createWidget('text');
  doc.caseSelection = 'never'; doc.variables = { Trace: '', Gate: 'yes' };
  Object.assign(source, { x: 10, y: 20, width: 30, height: 40, rotation: 90 });
  Object.assign(target, { x: 70, y: 80, width: 50, height: 60 });
  Object.assign(list, { x: 100, y: 200, width: 70, height: 106 }); list.style.strokeWidth = 0;
  Object.assign(child, { x: 3, y: 4, width: 10, height: 20 });
  Object.assign(cell, { x: 30, y: 8, width: 20, height: 15 });
  list.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [child, cell], itemWidth: 70, itemHeight: 50, gap: 6, layout: 'vertical' };
  doc.pages[0].widgets = [source, target, list];
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  const execute = (...steps: Step[]) => runtime.execute(interaction(steps));
  const inside = (index: number, ...steps: Step[]) => { const row = runtime.rows(list)[index]; return runtime.execute(interaction(steps), row.data, row.context); };
  const clickChild = (index = 0) => { const row = runtime.rows(list)[index]; return runtime.trigger(child.id, 'click', row.data, row.context); };
  return { doc, source, target, list, child, cell, runtime, execute, inside, clickChild };
}

afterEach(() => vi.useRealTimers());

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} widget geometry providers`, () => {
  it('reads local unrotated dimensions and refreshes direct This after move and resize', async () => {
    const f = fixture(portable); f.source.interactions = [interaction([
      record(`${box('This')}|`), { type: 'move', targetId: f.source.id, x: -5.5, y: 25 },
      { type: 'resize', targetId: f.source.id, x: 35, y: 45 }, record(box('This')),
    ])];
    await f.runtime.start(); await f.runtime.trigger(f.source.id, 'click');
    expect(f.runtime.state().variables.Trace).toBe('10,20,30,40,10,40,20,60|-5.5,25,35,45,-5.5,29.5,25,70'); f.runtime.dispose();
  });

  it('distinguishes whole repeater, row event source and child-local geometry', async () => {
    const f = fixture(portable);
    f.list.interactions = [interaction([record(`B:${box('This')}|`)]), interaction([record(`R:${box('This')}/[[This.Repeater.width]]/[[Item.Repeater.width]]|`)], 'itemResize')];
    f.child.interactions = [interaction([record(`C:${box('This')}/[[This.Repeater.width]]|`), { type: 'resizeItem', targetId: f.list.id, x: 90, y: 60 }])];
    await f.runtime.start(); await f.runtime.trigger(f.list.id, 'click'); await f.clickChild(1);
    expect(f.runtime.state().variables.Trace).toBe('B:100,200,70,106,100,170,200,306|C:3,4,10,20,3,13,4,24/70|R:0,56,90,60,0,90,56,116/90/90|'); f.runtime.dispose();
  });

  it('reads each actual action target with its row overrides and owning repeater', async () => {
    const f = fixture(portable); await f.runtime.start();
    await f.inside(0, { type: 'move', targetId: f.cell.id, x: 11, y: 12 }, { type: 'resize', targetId: f.cell.id, x: 40, y: 45 });
    f.source.interactions = [interaction([
      { type: 'setText', targetId: f.target.id, value: `${box('Target')}|[[This.width]]` },
      { type: 'setText', targetId: f.cell.id, value: `${box('Target')}|[[Target.Repeater.width]]/[[TargetItem.Repeater.height]]` },
    ])];
    await f.runtime.trigger(f.source.id, 'click');
    expect(f.runtime.widget(f.target).text).toBe('70,80,50,60,70,120,80,140|30');
    const rows = f.runtime.rows(f.list);
    expect(f.runtime.widget(f.cell, rows[0].context).text).toBe('11,12,40,45,11,51,12,57|70/106');
    expect(f.runtime.widget(f.cell, rows[1].context).text).toBe('30,8,20,15,30,50,8,23|70/106'); f.runtime.dispose();
  });

  it('preserves only unavailable Target fragments and does not read a short-circuited Target', async () => {
    const f = fixture(portable);
    f.source.interactions = [interaction([
      record(`before:${box('Target')}|[[Target.Repeater.width]]:after|[[This.width]]|[[if(false, Target.x, 1)]];`),
      { type: 'setText', targetId: f.target.id, value: '[[Target.x]]/[[Target.width]]/[[if(false, 1 / 0, Target.right)]]' },
      record('[[Target.x]]/[[This.width]]'),
    ])];
    await f.runtime.start(); await f.runtime.trigger(f.source.id, 'click');
    expect(f.runtime.state().variables.Trace).toBe(`before:${box('Target')}|[[Target.Repeater.width]]:after|30|1;[[Target.x]]/30`);
    expect(f.runtime.widget(f.target).text).toBe('70/50/120'); f.runtime.dispose();
  });

  it('retains all four Item.Repeater coordinates when only one was read before mutations', async () => {
    const f = fixture(portable); f.child.interactions = [interaction([
      record('[[Item.Repeater.x]]|'), { type: 'resizeItem', targetId: f.list.id, x: 120, y: 80 },
      { type: 'move', targetId: f.list.id, x: 300, y: 400 }, record(`${box('Item.Repeater')}|${box('This.Repeater')}`),
    ])];
    await f.runtime.start(); await f.clickChild();
    expect(f.runtime.state().variables.Trace).toBe('100|100,200,70,106,100,170,200,306|300,400,120,136,300,420,400,536'); f.runtime.dispose();
  });

  it('shares Item.Repeater geometry through all rows and child Loaded handlers in one refresh', async () => {
    const f = fixture(portable);
    f.list.interactions = [interaction([record('I[[Item.Name]]:[[Item.Repeater.x]]/[[Item.Repeater.width]];'), { type: 'resizeItem', targetId: f.list.id, x: 120 }], 'itemLoad')];
    f.child.interactions = [interaction([record('C[[Item.Name]]:[[Item.Repeater.width]]/[[This.Repeater.width]];')], 'load')];
    await f.runtime.start();
    expect(f.runtime.state().variables.Trace).toBe('IA:100/70;CA:70/120;IB:100/70;CB:70/120;');
    await f.execute({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'move', targetId: f.list.id, x: 250 }, { type: 'removeFilter', targetId: f.list.id, value: '{"all":true}' });
    expect(f.runtime.state().variables.Trace).toBe('IA:250/70;CA:70/120;IB:250/70;CB:70/120;'); f.runtime.dispose();
  });

  it('shares the refresh holder with TargetItem while Target.Repeater uses fresh geometry', async () => {
    const f = fixture(portable);
    f.list.interactions = [interaction([
      record('[[Item.Name]]:[[Item.Repeater.width]];'), { type: 'resizeItem', targetId: f.list.id, x: 120 },
      { type: 'setText', targetId: f.cell.id, value: '[[Item.Repeater.width]]/[[TargetItem.Repeater.width]]/[[Target.Repeater.width]]' },
    ], 'itemLoad')];
    await f.runtime.start();
    expect(f.runtime.state().variables.Trace).toBe('A:70;B:70;');
    expect(f.runtime.rows(f.list).map(row => f.runtime.widget(f.cell, row.context).text)).toEqual(['70/70/120', '70/70/120']); f.runtime.dispose();
  });

  it('reads TargetItem live after Wait releases the refresh cache while Item retains its holder', async () => {
    vi.useFakeTimers(); const f = fixture(portable);
    f.list.interactions = [interaction([
      record('[[Item.Name]]:[[Item.Repeater.width]];'), { type: 'resizeItem', targetId: f.list.id, x: 120 }, { type: 'wait', duration: 100 },
      { type: 'setText', targetId: f.cell.id, value: '[[Item.Repeater.width]]/[[TargetItem.Repeater.width]]/[[Target.Repeater.width]]' },
    ], 'itemLoad')];
    const started = f.runtime.start(); await vi.advanceTimersByTimeAsync(0);
    await f.inside(0, { type: 'resizeItem', targetId: f.list.id, x: 160 });
    await vi.advanceTimersByTimeAsync(100); await started;
    expect(f.runtime.state().variables.Trace).toBe('A:70;B:70;');
    expect(f.runtime.rows(f.list).map(row => f.runtime.widget(f.cell, row.context).text)).toEqual(['70/160/160', '70/160/160']); f.runtime.dispose();
  });

  it('rereads This and actual Target in a Wait continuation after independent changes', async () => {
    vi.useFakeTimers(); const f = fixture(portable);
    f.source.interactions = [interaction([record('[[This.width]]|'), { type: 'wait', duration: 100 }, { type: 'setText', targetId: f.target.id, value: '[[This.width]]/[[Target.width]]/[[Target.right]]' }])];
    await f.runtime.start(); const pending = f.runtime.trigger(f.source.id, 'click'); await vi.advanceTimersByTimeAsync(0);
    await f.execute({ type: 'resize', targetId: f.source.id, x: 60 }, { type: 'resize', targetId: f.target.id, x: 90 }, { type: 'move', targetId: f.target.id, x: 100 });
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(f.runtime.state().variables.Trace).toBe('30|'); expect(f.runtime.widget(f.target).text).toBe('60/90/190'); f.runtime.dispose();
  });

  it('keeps Item.Repeater first-read values across Wait while This.Repeater is live', async () => {
    vi.useFakeTimers(); const f = fixture(portable);
    f.child.interactions = [interaction([record('[[Item.Repeater.x]]|'), { type: 'wait', duration: 100 }, record(`${box('Item.Repeater')}|${box('This.Repeater')}`)])];
    await f.runtime.start(); const pending = f.clickChild(); await vi.advanceTimersByTimeAsync(0);
    await f.inside(0, { type: 'resizeItem', targetId: f.list.id, x: 120, y: 80 }, { type: 'move', targetId: f.list.id, x: 300, y: 400 });
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(f.runtime.state().variables.Trace).toBe('100|100,200,70,106,100,170,200,306|300,400,120,136,300,420,400,536'); f.runtime.dispose();
  });

  it('captures Item.Repeater only at a delayed first read and keeps the holder after refresh ends', async () => {
    vi.useFakeTimers(); const f = fixture(portable);
    f.list.interactions = [interaction([{ type: 'wait', duration: 100 }, record('[[Item.Name]]:[[Item.Repeater.width]];')], 'itemLoad')];
    const started = f.runtime.start(); await vi.advanceTimersByTimeAsync(0);
    await f.inside(0, { type: 'resizeItem', targetId: f.list.id, x: 130 });
    await vi.advanceTimersByTimeAsync(100); await started;
    expect(f.runtime.state().variables.Trace).toBe('A:130;B:130;'); f.runtime.dispose();
  });

  it('gives a later refresh a new holder without replacing a suspended event holder', async () => {
    vi.useFakeTimers(); const f = fixture(portable);
    f.child.interactions = [interaction([record('old:[[Item.Repeater.x]];'), { type: 'wait', duration: 100 }, record('tail:[[Item.Repeater.x]]/[[This.Repeater.x]];')])];
    await f.runtime.start(); const pending = f.clickChild(); await vi.advanceTimersByTimeAsync(0);
    f.list.interactions = [interaction([record('new[[Item.Name]]:[[Item.Repeater.x]];')], 'itemLoad')];
    await f.execute({ type: 'move', targetId: f.list.id, x: 500 }, { type: 'removeFilter', targetId: f.list.id, value: '{"all":true}' });
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(f.runtime.state().variables.Trace).toBe('old:100;newA:500;newB:500;tail:100/500;'); f.runtime.dispose();
  });

  for (const conditional of [false, true]) it(`rereads source and action target after a delayed menu choice (conditional=${conditional})`, async () => {
    const f = fixture(portable); f.doc.caseSelection = 'always';
    f.source.interactions = [interaction([{ type: 'setText', targetId: f.target.id, value: '[[This.width]]/[[Target.width]]/[[Target.right]]' }], 'click', conditional ? { conditions: [{ source: 'variable', key: 'Gate', operator: 'equals', value: 'yes' }] } : {})];
    await f.runtime.start(); await f.runtime.trigger(f.source.id, 'click'); const menu = f.runtime.state().caseMenus![0];
    await f.execute({ type: 'resize', targetId: f.source.id, x: 60 }, { type: 'resize', targetId: f.target.id, x: 90 }, { type: 'move', targetId: f.target.id, x: 100 });
    await f.runtime.selectCase(menu.id, menu.options[0].id);
    expect(f.runtime.widget(f.target).text).toBe('60/90/190'); f.runtime.dispose();
  });
});
