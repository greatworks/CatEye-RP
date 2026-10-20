import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import type { Action, Document, Interaction, Widget } from '../src/model/types';
import { createDocument, createPage, createWidget } from '../src/model/document';
import { createRuntime, executeWidgetEvent } from '../src/runtime/engine';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { exportPrototype } from '../src/runtime/export';
import { evaluateExpression } from '../src/runtime/expressions';

function interaction(actions: Omit<Action, 'id'>[], overrides: Partial<Interaction> = {}): Interaction {
  return { id: crypto.randomUUID(), name: 'Test interaction', enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: crypto.randomUUID() })), ...overrides };
}
function fixture(): { doc: Document; input: Widget; output: Widget; button: Widget } {
  const doc = createDocument(), input = createWidget('input'), output = createWidget('text'), button = createWidget('button');
  doc.pages[0].widgets.push(input, output, button); doc.variables.Name = 'initial'; input.text = 'Ada'; return { doc, input, output, button };
}

describe('portable HTML export', () => {
  it('contains exactly the intended scripts even with hostile project/widget/variable text', () => {
    const { doc, output } = fixture();
    const hostile = '</script><script>globalThis.pwned=1</script><img src=x onerror=alert(1)>&\u2028\u2029';
    doc.name = hostile; output.text = hostile; doc.variables.Name = hostile;
    const html = exportPrototype(doc);
    expect((html.match(/<script\b/g) ?? []).length).toBe(2);
    expect((html.match(/<\/script>/g) ?? []).length).toBe(2);
    const json = html.match(/<script id="prototype-data" type="application\/json">([^]*?)<\/script>/)![1];
    expect(json).not.toContain('<'); expect(JSON.parse(json).variables.Name).toBe(hostile);
    const executable = html.match(/<\/script><script>([^]*?)<\/script>/)![1];
    expect(() => new Script(executable)).not.toThrow();
    expect(executable).not.toMatch(/\b(?:eval|Function)\s*\(/);
    expect(executable).not.toContain('innerHTML');
    expect(html).toContain("connect-src 'none'"); expect(html).toContain("img-src data:");
    expect(html).not.toMatch(/<script[^>]+src=/);
  });
  it('rejects remote/scriptable images and allows embedded raster content', () => {
    const { doc } = fixture(); const image = createWidget('image'); doc.pages[0].widgets.push(image);
    image.imageSrc = 'https://example.com/image.png'; expect(() => exportPrototype(doc)).toThrow(/Offline export/);
    image.imageSrc = 'data:image/svg+xml;base64,AAAA'; expect(() => exportPrototype(doc)).toThrow();
    image.imageSrc = 'javascript:alert(1)'; expect(() => exportPrototype(doc)).toThrow();
    image.imageSrc = 'data:image/png;base64,iVBORw0KGgo='; expect(exportPrototype(doc)).toContain('iVBORw0KGgo=');
  });
  it('rejects malformed documents instead of emitting broken or unsafe templates', () => {
    const { doc, output } = fixture(); output.style.fill = 'url(https://example.com/tracker)';
    expect(() => exportPrototype(doc)).toThrow(/color/);
    expect(() => exportPrototype({ ...doc, pages: [] })).toThrow();
  });
  it('serialized runtime executes in a clean context without module-scope dependencies', async () => {
    const { doc, output, button } = fixture();
    button.interactions.push(interaction([{ type: 'setText', targetId: output.id, value: 'portable' }]));
    const factory = new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout });
    const runtime = factory(structuredClone(doc)); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(output).text).toBe('portable');
  });
});

describe('the runtime embedded in exported HTML', () => {
  it('matches engine arithmetic and text functions after serialization into an isolated runtime', async () => {
    const {doc,input,output,button}=fixture();doc.variables.Count='2';input.text='3';
    button.interactions.push(interaction([
      {type:'setVariable',targetId:'Count',value:'[[Count + 1]]'},
      {type:'setText',targetId:output.id,value:`[[concat(upper("total"), ": ", Count * Widget.${input.id}.text)]]`},
    ]));
    const factory=new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({structuredClone,setTimeout,clearTimeout});
    const evaluator=new Script(`(${evaluateExpression.toString()})`).runInNewContext();
    const offline=factory(structuredClone(doc),undefined,evaluator);
    await offline.trigger(button.id,'click');
    const expected=await executeWidgetEvent(doc,createRuntime(doc),button,'click');
    expect(offline.widget(output).text).toBe('TOTAL: 9');
    expect(offline.state().variables).toEqual(expected.variables);
    expect(offline.state().widgetOverrides).toEqual(expected.widgetOverrides);
  });
  it('matches engine conditions and sequential form→variable→text/style/geometry actions', async () => {
    const { doc, input, output, button } = fixture();
    button.interactions.push(interaction([
      { type: 'setVariable', targetId: 'Name', value: '[[Widget.' + input.id + '.text]]' },
      { type: 'setText', targetId: output.id, value: 'Hello [[Name]]' },
      { type: 'setStyle', targetId: output.id, style: { fill: '#ff0000', fontWeight: 700 } },
      { type: 'move', targetId: output.id, x: 25, y: 40 }, { type: 'resize', targetId: output.id, x: 90, y: 70 },
      { type: 'hide', targetId: output.id }, { type: 'toggle', targetId: output.id },
    ], { conditions: [{ source: 'widgetText', key: input.id, operator: 'notEquals', value: '' }] }));
    const offline = createOfflineRuntime(doc); offline.input(input.id, 'Grace');
    const state = createRuntime(doc); state.widgetOverrides[input.id] = { text: 'Grace' };
    const expected = await executeWidgetEvent(doc, state, button, 'click'); await offline.trigger(button.id, 'click');
    expect(offline.state().variables).toEqual(expected.variables); expect(offline.state().widgetOverrides).toEqual(expected.widgetOverrides);
    expect(offline.widget(output).text).toBe('Hello Grace');
  });
  it('executes nested panel interactions, named/next/previous states and disabled behavior', async () => {
    const { doc, output } = fixture(); const panel = createWidget('panel'), inner = createWidget('button');
    const first = panel.states![0], second = { id: crypto.randomUUID(), name: 'Second', widgets: [] };
    first.widgets.push(inner); panel.states!.push(second); doc.pages[0].widgets.push(panel);
    inner.interactions.push(interaction([{ type: 'setState', targetId: panel.id, value: 'Second' }, { type: 'setText', targetId: output.id, value: 'clicked inside' }]));
    const runtime = createOfflineRuntime(doc); await runtime.trigger(inner.id, 'click'); expect(runtime.widget(panel).activeStateId).toBe(second.id); expect(runtime.widget(output).text).toBe('clicked inside');
    inner.interactions = [interaction([{ type: 'nextState', targetId: panel.id }, { type: 'previousState', targetId: panel.id }])];
    await runtime.trigger(inner.id, 'click'); expect(runtime.widget(panel).activeStateId).toBe(second.id);
    inner.disabled = true; inner.interactions = [interaction([{ type: 'setText', targetId: output.id, value: 'must not run' }])];
    await runtime.trigger(inner.id, 'click'); expect(runtime.widget(output).text).toBe('clicked inside');
  });
  it('keeps repeater source rows through filtering/sorting/deletion/addition and provides Item context', async () => {
    const { doc, button, output } = fixture(), repeater = createWidget('repeater'); doc.pages[0].widgets.push(repeater);
    repeater.repeater!.columns = ['Name', 'Score']; repeater.repeater!.rows = [{ Name: 'Amy', Score: '2' }, { Name: 'Bea', Score: '12' }, { Name: 'Cy', Score: '9' }];
    button.interactions = [interaction([{ type: 'sortRows', targetId: repeater.id, value: 'Score:desc' }, { type: 'filterRows', targetId: repeater.id, value: '{"column":"Score","operator":"greater","value":"2"}' }, { type: 'deleteRow', targetId: repeater.id, value: '0' }, { type: 'filterRows', targetId: repeater.id, value: '' }, { type: 'addRow', targetId: repeater.id, value: '{"Name":"Di","Score":"6"}' }])];
    const runtime = createOfflineRuntime(doc); await runtime.trigger(button.id, 'click');
    const expected = await executeWidgetEvent(doc, createRuntime(doc), button, 'click'); expect(runtime.state().repeaterRows).toEqual(expected.repeaterRows);
    expect(runtime.state().repeaterRows[repeater.id].map(r => r.Name)).toEqual(['Cy', 'Di', 'Amy']);
    const cell = repeater.repeater!.template[0]; cell.interactions = [interaction([{ type: 'setText', targetId: output.id, value: '[[Item.Name]]' }])];
    await runtime.trigger(cell.id, 'click', { Name: 'Cy' }); expect(runtime.widget(output).text).toBe('Cy'); expect(runtime.text('[[Item.Name]]', { Name: 'Amy' })).toBe('Amy');
  });
  it('runs change and load actions, navigation, and ordered waits without losing variables', async () => {
    const { doc, input, button, output } = fixture(); const second = createPage('Other'); doc.pages.push(second);
    input.interactions.push(interaction([{ type: 'setVariable', targetId: 'Name', value: '[[Widget.' + input.id + '.text]]' }], { event: 'change' }));
    button.interactions.push(interaction([{ type: 'setText', targetId: output.id, value: 'before' }, { type: 'wait', duration: 5 }, { type: 'openPage', targetId: second.id }]));
    second.interactions.push(interaction([{ type: 'setVariable', targetId: 'Loaded', value: 'Hello [[Name]]' }], { event: 'load' }));
    const runtime = createOfflineRuntime(doc); runtime.input(input.id, 'Lin'); await runtime.trigger(input.id, 'change');
    const observed: string[] = []; runtime.subscribe(() => observed.push(runtime.widget(output).text));
    await runtime.trigger(button.id, 'click'); expect(runtime.state().pageId).toBe(second.id); expect(runtime.state().variables.Loaded).toBe('Hello Lin'); expect(observed).toContain('before');
  });
  it('contains navigation loops and lets later user events run after an error', async () => {
    const { doc, output, button } = fixture(), second = createPage(); doc.pages.push(second);
    doc.pages[0].interactions = [interaction([{ type: 'openPage', targetId: second.id }], { event: 'load' })];
    second.interactions = [interaction([{ type: 'openPage', targetId: doc.pages[0].id }], { event: 'load' })];
    const runtime = createOfflineRuntime(doc); await expect(runtime.start()).rejects.toThrow(/16 transitions/);
    button.interactions = [interaction([{ type: 'setText', targetId: output.id, value: 'recovered' }])];
    await runtime.trigger(button.id, 'click'); expect(runtime.widget(output).text).toBe('recovered');
  });
  it('rejects invalid repeater mutations without pollution and handles any/all cases', async () => {
    const { doc, button, output } = fixture(), r = createWidget('repeater'); doc.pages[0].widgets.push(r);
    button.interactions = [interaction([{ type: 'addRow', targetId: r.id, value: '{"__proto__":"bad"}' }])];
    const runtime = createOfflineRuntime(doc); await expect(runtime.trigger(button.id, 'click')).rejects.toThrow(/Invalid repeater/);
    expect(Object.getPrototypeOf(runtime.state().variables)).toBe(Object.prototype);
    button.interactions = [interaction([{ type: 'setText', targetId: output.id, value: 'any passed' }], { conditionMode: 'any', conditions: [{ source: 'variable', key: 'Name', operator: 'equals', value: 'wrong' }, { source: 'variable', key: 'Name', operator: 'equals', value: 'initial' }] })];
    await runtime.trigger(button.id, 'click'); expect(runtime.widget(output).text).toBe('any passed');
  });
  it('uses single-pass own-property interpolation and limits expansion in action values', async () => {
    const { doc, output, button } = fixture(); doc.variables.Name = '[[Other]]'; doc.variables.Other = 'not expanded';
    const runtime = createOfflineRuntime(doc);
    expect(runtime.text('[[Name]]')).toBe('[[Other]]'); expect(runtime.text('[[Item.toString]]', {})).toBe('');
    doc.variables.Long = 'x'.repeat(60000); runtime.state().variables.Long = doc.variables.Long;
    button.interactions = [interaction([{ type: 'setText', targetId: output.id, value: 'temporary' }, { type: 'setText', targetId: output.id, value: '[[Long]][[Long]]' }])];
    await expect(runtime.trigger(button.id, 'click')).rejects.toThrow(/100000/);
    expect(runtime.widget(output).text).toBe(output.text);
  });
});
