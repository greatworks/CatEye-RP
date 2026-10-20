import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RowContext } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const live: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of live.splice(0)) runtime.dispose(); });
const event = (name: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), event: name, name, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
function makeRuntime(doc: Document, portable: boolean): OfflineRuntime {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  live.push(runtime); return runtime;
}
function fixture(portable: boolean, type: Widget['type'] = 'input', hintHideOn?: Widget['hintHideOn']) {
  const doc = createDocument(), widget = createWidget(type); doc.caseSelection = 'never'; doc.variables.Log = '';
  if (type === 'input' || type === 'textarea') { widget.hintText = 'Hint'; if (hintHideOn) widget.hintHideOn = hintHideOn; }
  widget.style.fill = '#ffffff'; widget.errorStyle = { fill: '#ffdddd', fontWeight: 700 };
  doc.pages[0].widgets = [widget]; const runtime = makeRuntime(doc, portable);
  return { doc, widget, runtime, action: (...actions: Omit<Action, 'id'>[]) => runtime.execute(event('click', ...actions)) };
}
function logErrors(widget: Widget, label: string) {
  widget.interactions = ['errorSet', 'errorRemoved'].map(name => event(name as EventType, { type: 'setVariable', targetId: 'Log', value: `[[Log]]${label}.${name};` }));
}
const logical = (runtime: OfflineRuntime, widget: Widget, context: RowContext = []) => runtime.text(`[[Widget.${widget.id}.text]]`, undefined, context);

// Expectations follow research/error-hint-evidence.md's isolated original-function
// probes. Initial Error Set event timing is deliberately not asserted: the native
// compiler's initial error class remains unverified.
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} Error and Hint runtime`, () => {
  it('deduplicates Error Set/Removed while retaining flags even without an Error effect', async () => {
    for (const errorStyle of [undefined, {}, { fill: '#ff0000' }]) {
      const { doc, widget, runtime } = fixture(portable, 'box'); widget.errorStyle = errorStyle; logErrors(widget, 'A'); const saved = serializeDocument(doc);
      await runtime.setError(widget.id, true); await runtime.setError(widget.id, true);
      expect(runtime.widget(widget).error).toBe(true); expect(runtime.state().variables.Log).toBe('A.errorSet;');
      await runtime.setError(widget.id, false); await runtime.setError(widget.id, false);
      expect(runtime.widget(widget).error).toBe(false); expect(runtime.state().variables.Log).toBe('A.errorSet;A.errorRemoved;');
      expect(runtime.widget(widget).style.fill).toBe('#ffffff'); expect(serializeDocument(doc)).toBe(saved);
    }
  });

  it('ignores error changes on disabled targets and preserves lower selected/error properties', async () => {
    const { widget, runtime, action } = fixture(portable, 'box'); widget.selected = true; widget.selectedStyle = { color: '#123456', fill: '#ccccff' }; widget.disabledStyle = { fill: '#cccccc', opacity: 0.4 }; logErrors(widget, 'A');
    await runtime.setError(widget.id, true); await action({ type: 'disable', targetId: widget.id }); await runtime.setError(widget.id, false);
    expect(runtime.widget(widget)).toMatchObject({ error: true, disabled: true, style: { fill: '#cccccc', color: '#123456', fontWeight: 700, opacity: 0.4 } });
    expect(runtime.state().variables.Log).toBe('A.errorSet;');
    await action({ type: 'enable', targetId: widget.id }); await runtime.setError(widget.id, false);
    expect(runtime.widget(widget).style.fill).toBe('#ccccff'); expect(runtime.state().variables.Log).toBe('A.errorSet;A.errorRemoved;');
  });

  it('composes selected then Error then Hint then Disabled by property', async () => {
    const { widget, runtime } = fixture(portable); widget.selected = true; widget.selectedStyle = { fill: '#0000ff', stroke: '#111177' };
    widget.hintStyle = { fill: '#ddffdd', fontSize: 24 }; widget.disabledStyle = { fill: '#cccccc' };
    await runtime.setError(widget.id, true);
    expect(runtime.widget(widget).style).toMatchObject({ fill: '#ddffdd', stroke: '#111177', fontWeight: 700, fontSize: 24, color: '#999999' });
    expect(runtime.widget(widget, [], true).style).toMatchObject({ fill: '#cccccc', fontWeight: 700, fontSize: 24 });
    runtime.hideHint(widget.id); expect(runtime.widget(widget).style.fill).toBe('#ffdddd');
    await runtime.setError(widget.id, false); expect(runtime.widget(widget).style.fill).toBe('#0000ff');
  });

  it('recurses through a panel itself and every state, but stops at repeater branches', async () => {
    const doc = createDocument(), panel = createWidget('panel'), active = createWidget('box'), inactive = createWidget('input'), disabled = createWidget('box'), nested = createWidget('panel'), leaf = createWidget('box'), repeater = createWidget('repeater'), rowChild = createWidget('box');
    doc.caseSelection = 'never'; doc.variables.Log = ''; disabled.disabled = true; disabled.error = true;
    panel.states![0].widgets = [active, disabled, repeater]; panel.states!.push({ id: uid(), name: 'Inactive state', widgets: [inactive, nested] }); nested.states![0].widgets = [leaf]; repeater.repeater!.template = [rowChild];
    for (const [item, label] of [[panel, 'P'], [active, 'A'], [inactive, 'I'], [disabled, 'D'], [nested, 'N'], [leaf, 'L'], [repeater, 'R'], [rowChild, 'Row']] as const) logErrors(item, label);
    doc.pages[0].widgets = [panel]; const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable); await runtime.start();
    await runtime.setError(panel.id, true);
    expect(runtime.state().variables.Log).toBe('P.errorSet;A.errorSet;I.errorSet;N.errorSet;L.errorSet;');
    for (const item of [panel, active, inactive, nested, leaf]) expect(runtime.widget(item).error).toBe(true);
    expect(runtime.widget(repeater).error).toBe(false); for (const row of runtime.rows(repeater)) expect(runtime.widget(rowChild, row.context).error).toBe(false);
    await runtime.setError(panel.id, false); expect(runtime.widget(disabled).error).toBe(true);
    await runtime.setError(repeater.id, true); expect(runtime.widget(repeater).error).toBe(false); expect(serializeDocument(doc)).toBe(saved);
  });

  it('continues into enabled children when the containing panel itself is disabled', async () => {
    const doc = createDocument(), panel = createWidget('panel'), child = createWidget('box'); panel.disabled = true; panel.states![0].widgets = [child];
    doc.caseSelection = 'never'; doc.variables.Log = ''; logErrors(panel, 'P'); logErrors(child, 'C'); doc.pages[0].widgets = [panel];
    const runtime = makeRuntime(doc, portable); await runtime.setError(panel.id, true);
    expect(runtime.widget(panel).error).toBe(false); expect(runtime.widget(child).error).toBe(true); expect(runtime.state().variables.Log).toBe('C.errorSet;');
  });

  it('keeps a reentrant flag removal distinct from the outer forced Error paint and effective getter', async () => {
    const { widget, runtime } = fixture(portable, 'box');
    widget.interactions = [event('errorSet', { type: 'setVariable', targetId: 'Log', value: '[[Log]]set;' }, { type: 'setError', targetId: widget.id, value: 'false' }), event('errorRemoved', { type: 'setVariable', targetId: 'Log', value: '[[Log]]removed;' })];
    await runtime.setError(widget.id, true);
    expect(runtime.state().variables.Log).toBe('set;removed;'); expect(runtime.state().widgetOverrides[widget.id].error).toBe(false);
    expect(runtime.widget(widget).error).toBe(true); expect(runtime.widget(widget).style.fill).toBe('#ffdddd');
    runtime.setInteractionState(widget.id, { mouseOver: true }); expect(runtime.widget(widget).style.fill).toBe('#ffdddd');
    await runtime.setError(widget.id, false); expect(runtime.state().variables.Log).toBe('set;removed;removed;');
    expect(runtime.widget(widget).error).toBe(false); expect(runtime.widget(widget).style.fill).toBe('#ffffff');
  });

  it('isolates row error and hint state, refreshes them, and lets an outside error action reach visible rows', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('input');
    doc.caseSelection = 'never'; child.hintText = 'Row hint'; child.errorStyle = { fill: '#ff0000' }; repeater.repeater!.template = [child]; doc.pages[0].widgets = [repeater];
    const runtime = makeRuntime(doc, portable); await runtime.start(); const rows = runtime.rows(repeater);
    await runtime.setError(child.id, true, rows[0].context); runtime.hideHint(child.id, rows[0].context); runtime.input(child.id, 'First value', undefined, rows[0].context);
    expect(runtime.widget(child, rows[0].context).error).toBe(true); expect(logical(runtime, child, rows[0].context)).toBe('First value');
    expect(runtime.widget(child, rows[1].context).error).toBe(false); expect(runtime.hint(child.id, rows[1].context)).toBe('Row hint');
    await runtime.execute(event('click', { type: 'setError', targetId: child.id, value: 'true' }));
    for (const row of runtime.rows(repeater)) expect(runtime.widget(child, row.context).error).toBe(true);
    await runtime.execute(event('click', { type: 'removeFilter', targetId: repeater.id, value: '{"all":true}' }));
    for (const row of runtime.rows(repeater)) { expect(runtime.widget(child, row.context).error).toBe(false); expect(runtime.hint(child.id, row.context)).toBe('Row hint'); expect(logical(runtime, child, row.context)).toBe(''); }
  });

  it('bounds recursive Error events and rolls back flag, paint, hint and prior actions in the failed segment', async () => {
    const { widget, runtime, action } = fixture(portable); runtime.hint(widget.id);
    widget.interactions = [event('errorSet', { type: 'setError', targetId: widget.id, value: 'toggle' }), event('errorRemoved', { type: 'setError', targetId: widget.id, value: 'toggle' })];
    const before = structuredClone(runtime.state());
    await expect(action({ type: 'setText', targetId: widget.id, value: 'temporary' }, { type: 'setVariable', targetId: 'Log', value: 'temporary' }, { type: 'setError', targetId: widget.id, value: 'true' })).rejects.toThrow('Error event cycle limit');
    expect(runtime.state()).toEqual(before); expect(runtime.hint(widget.id)).toBe('Hint'); expect(runtime.widget(widget).error).toBe(false); expect(runtime.widget(widget).style.fill).toBe('#ffffff');
    widget.interactions = []; await runtime.setError(widget.id, true); expect(runtime.widget(widget).error).toBe(true);
  });

  it('preserves primitive Error expression coercion rather than converting numeric zero into string zero', async () => {
    const { doc, widget, runtime, action } = fixture(portable, 'box'); const saved = serializeDocument(doc);
    const cases: [string, boolean][] = [['[[0]]', false], ['[[1]]', true], ['[[false]]', false], ['[[true]]', true], ['[[""]]', false], ['[["false"]]', false], ['[["FALSE"]]', true], ['[["0"]]', true], ['[[MissingVariable]]', false]];
    for (const [value, expected] of cases) {
      await runtime.setError(widget.id, false); await action({ type: 'setError', targetId: widget.id, value }); expect(runtime.widget(widget).error, value).toBe(expected);
    }
    await runtime.setError(widget.id, false); await action({ type: 'setError', targetId: widget.id, value: '[["toggle"]]' }); expect(runtime.widget(widget).error).toBe(true);
    await action({ type: 'setError', targetId: widget.id, value: '[["toggle"]]' }); expect(runtime.widget(widget).error).toBe(false); expect(serializeDocument(doc)).toBe(saved);
  });

  it('coerces geometry Error providers as numbers but preserves text and global string zero', async () => {
    const doc = createDocument(), target = createWidget('box'), source = createWidget('input');
    doc.caseSelection = 'never'; doc.variables.Zero = '0'; target.x = 0; source.text = '0';
    source.interactions = [event('click', { type: 'setError', targetId: target.id, value: '[[This.text]]' })];
    doc.pages[0].widgets = [source, target]; const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable);
    await runtime.start();
    await runtime.execute(event('click', { type: 'setError', targetId: target.id, value: '[[Target.x]]' }));
    expect(runtime.widget(target).error).toBe(false);
    await runtime.execute(event('click', { type: 'move', targetId: target.id, x: 10, y: target.y }, { type: 'setError', targetId: target.id, value: '[[Target.x]]' }));
    expect(runtime.widget(target).error).toBe(true);
    await runtime.setError(target.id, false); await runtime.trigger(source.id, 'click');
    expect(runtime.widget(target).error).toBe(true);
    await runtime.setError(target.id, false);
    await runtime.execute(event('click', { type: 'setError', targetId: target.id, value: '[[Zero]]' }));
    expect(runtime.widget(target).error).toBe(true); expect(serializeDocument(doc)).toBe(saved);
  });

  it('coerces Item Error metadata as booleans while preserving ordinary row string zero', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('input');
    doc.caseSelection = 'never'; repeater.repeater!.columns = ['Value']; repeater.repeater!.rows = [{ Value: '0' }]; repeater.repeater!.template = [child]; doc.pages[0].widgets = [repeater];
    const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable); await runtime.start(); const row = runtime.rows(repeater)[0];
    const setFromRow = (value: string) => runtime.execute(event('click', { type: 'setError', targetId: child.id, value }), row.data, row.context);
    await setFromRow('[[Item.Value]]'); expect(runtime.widget(child, row.context).error).toBe(true);
    await setFromRow('[[Item.isMarked]]'); expect(runtime.widget(child, row.context).error).toBe(false);
    await runtime.execute(event('click', { type: 'markRows', targetId: repeater.id, value: '{"row":"this"}' }), row.data, row.context);
    await setFromRow('[[Item.isMarked]]'); expect(runtime.widget(child, row.context).error).toBe(true);
    expect(serializeDocument(doc)).toBe(saved);
  });

  it('keeps configured hint text literal and logically empty, including empty hints and password fields', async () => {
    for (const type of ['input', 'textarea'] as const) {
      const { doc, widget, runtime } = fixture(portable, type); widget.hintText = '姓名 [[NotEvaluated]]\nSecond line'; if (type === 'input') widget.inputType = 'password';
      const saved = serializeDocument(doc); expect(runtime.hint(widget.id)).toBe(widget.hintText); expect(logical(runtime, widget)).toBe('');
      expect(runtime.widget(widget).text).toBe(''); expect(runtime.widget(widget).style.color).toBe('#999999');
      runtime.hideHint(widget.id); expect(runtime.hint(widget.id)).toBeUndefined(); runtime.input(widget.id, '[[UserLiteral]]'); expect(logical(runtime, widget)).toBe('[[UserLiteral]]');
      expect(serializeDocument(doc)).toBe(saved);
    }
    const { widget, runtime } = fixture(portable); widget.hintText = ''; widget.hintStyle = { color: '#ff0000' };
    expect(runtime.hint(widget.id)).toBe(''); expect(logical(runtime, widget)).toBe(''); expect(runtime.widget(widget).style.color).toBe(widget.style.color);
  });

  it('keeps ordinary nonempty initial values and reproduces the initial raw-value-equals-hint quirk', () => {
    for (const value of ['Stored value', 'Hint']) {
      const doc = createDocument(), widget = createWidget('input'); widget.hintText = 'Hint'; widget.text = value; doc.pages[0].widgets = [widget]; const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable);
      expect(runtime.hint(widget.id)).toBe(value === 'Hint' ? 'Hint' : undefined); expect(logical(runtime, widget)).toBe(value === 'Hint' ? '' : value); expect(serializeDocument(doc)).toBe(saved);
    }
  });

  it('compares resolved initial form text while preserving subsequent literal input and action values', async () => {
    for (const type of ['input', 'textarea'] as const) {
      const doc = createDocument(), widget = createWidget(type);
      doc.caseSelection = 'never'; doc.variables.Value = 'A'; doc.variables.Literal = '[[Value]]'; doc.variables.Log = '';
      widget.text = '[[Value]]'; widget.hintText = 'Hint';
      widget.interactions = [event('change', { type: 'setVariable', targetId: 'Log', value: '[[Log]]change;' })];
      doc.pages[0].widgets = [widget]; const saved = serializeDocument(doc), runtime = makeRuntime(doc, portable);
      await runtime.start();
      expect(logical(runtime, widget)).toBe('A'); expect(runtime.hint(widget.id)).toBeUndefined();
      await runtime.execute(event('click', { type: 'setText', targetId: widget.id, value: 'A' }));
      expect(runtime.state().variables.Log).toBe(''); expect(logical(runtime, widget)).toBe('A');

      expect(runtime.input(widget.id, '[[Value]]')).toBe(true);
      expect(logical(runtime, widget)).toBe('[[Value]]'); expect(runtime.widget(widget).text).toBe('[[Value]]');
      await runtime.execute(event('click', { type: 'setText', targetId: widget.id, value: 'reset' }));
      await runtime.execute(event('click', { type: 'setText', targetId: widget.id, value: '[[Literal]]' }));
      expect(logical(runtime, widget)).toBe('[[Value]]'); expect(runtime.widget(widget).text).toBe('[[Value]]');
      expect(runtime.state().variables.Log).toBe('change;change;'); expect(serializeDocument(doc)).toBe(saved);
    }
  });

  it('typing mode retains hints on focus, clears on pre-edit, and restores empty valid input while focused', async () => {
    const { widget, runtime } = fixture(portable); await runtime.focus(widget.id, true); expect(runtime.hint(widget.id)).toBe('Hint');
    expect(runtime.hideHint(widget.id)).toBe(true); expect(runtime.hideHint(widget.id)).toBe(false); expect(runtime.hint(widget.id)).toBeUndefined();
    expect(runtime.textChanged(widget.id)).toBe(true); expect(runtime.textChanged(widget.id)).toBe(false);
    expect(runtime.input(widget.id, 'Typed')).toBe(true); expect(logical(runtime, widget)).toBe('Typed'); expect(runtime.hint(widget.id)).toBeUndefined();
    expect(runtime.input(widget.id, '')).toBe(true); expect(logical(runtime, widget)).toBe(''); expect(runtime.hint(widget.id)).toBe('Hint');
    // Active-empty input first deactivates; a second inactive-empty input restores.
    expect(runtime.input(widget.id, '')).toBe(true); expect(runtime.hint(widget.id)).toBeUndefined();
    expect(runtime.input(widget.id, '')).toBe(true); expect(runtime.hint(widget.id)).toBe('Hint');
  });

  it('validity controls restoration on empty input and blur', async () => {
    const { widget, runtime } = fixture(portable); runtime.hideHint(widget.id); runtime.input(widget.id, 'Value');
    runtime.input(widget.id, '', undefined, [], false); expect(runtime.hint(widget.id)).toBeUndefined();
    await runtime.focus(widget.id, false, [], undefined, false, false); expect(runtime.hint(widget.id)).toBeUndefined();
    await runtime.focus(widget.id, false, [], undefined, false, true); expect(runtime.hint(widget.id)).toBe('Hint');
  });

  it('focus mode clears on focus and restores only on valid empty blur, not empty input', async () => {
    const { widget, runtime } = fixture(portable, 'input', 'focus'); expect(runtime.hint(widget.id)).toBe('Hint');
    await runtime.focus(widget.id, true); expect(runtime.hint(widget.id)).toBeUndefined();
    runtime.input(widget.id, 'Value'); runtime.input(widget.id, ''); expect(runtime.hint(widget.id)).toBeUndefined();
    await runtime.focus(widget.id, false, [], undefined, false, false); expect(runtime.hint(widget.id)).toBeUndefined();
    await runtime.focus(widget.id, false); expect(runtime.hint(widget.id)).toBe('Hint');
  });

  it('Set Text empty activates a focus-mode hint while focused and retains the later mixed-display quirk', async () => {
    const { widget, runtime, action } = fixture(portable, 'input', 'focus'); await runtime.focus(widget.id, true); runtime.input(widget.id, 'Value');
    await action({ type: 'setText', targetId: widget.id, value: '' }); expect(runtime.hint(widget.id)).toBe('Hint'); expect(logical(runtime, widget)).toBe('');
    expect(runtime.input(widget.id, 'xHint')).toBe(true); expect(runtime.hint(widget.id)).toBe('xHint'); expect(logical(runtime, widget)).toBe('');
    await runtime.focus(widget.id, false); expect(runtime.hint(widget.id)).toBe('xHint'); expect(logical(runtime, widget)).toBe('');
  });

  it('Set Text to the active raw hint is a no-op while a same-display user input becomes actual text', async () => {
    const { widget, runtime, action } = fixture(portable); widget.interactions = [event('change', { type: 'setVariable', targetId: 'Log', value: '[[Log]]change;' })];
    expect(runtime.hint(widget.id)).toBe('Hint'); await action({ type: 'setText', targetId: widget.id, value: 'Hint' });
    expect(runtime.hint(widget.id)).toBe('Hint'); expect(logical(runtime, widget)).toBe(''); expect(runtime.state().variables.Log).toBe('');
    expect(runtime.input(widget.id, 'Hint')).toBe(false); expect(runtime.hint(widget.id)).toBeUndefined(); expect(logical(runtime, widget)).toBe('Hint');
  });

  it('runs focus actions before hiding the hint and can suppress only user focus callbacks', async () => {
    const { widget, runtime } = fixture(portable, 'input', 'focus');
    widget.interactions = [event('focus', { type: 'setVariable', targetId: 'Log', value: '[[Log]]focus;' }, { type: 'setText', targetId: widget.id, value: 'Hint' })];
    await runtime.focus(widget.id, true); expect(runtime.state().variables.Log).toBe('focus;'); expect(runtime.hint(widget.id)).toBeUndefined(); expect(logical(runtime, widget)).toBe('');
    await runtime.focus(widget.id, false); expect(runtime.hint(widget.id)).toBe('Hint');
    await runtime.focus(widget.id, true, [], undefined, true); expect(runtime.state().variables.Log).toBe('focus;'); expect(runtime.hint(widget.id)).toBeUndefined();
  });

  it('deduplicates raw text-change checks across focus, keydown-style clearing, input and Set Text', async () => {
    const { widget, runtime, action } = fixture(portable); widget.interactions = [event('change', { type: 'setVariable', targetId: 'Log', value: '[[Log]]change;' })];
    expect(runtime.textChanged(widget.id)).toBe(false); runtime.hideHint(widget.id);
    expect(runtime.textChanged(widget.id)).toBe(true); expect(runtime.textChanged(widget.id)).toBe(false);
    expect(runtime.input(widget.id, 'A')).toBe(true); expect(runtime.textChanged(widget.id)).toBe(false); expect(runtime.input(widget.id, 'A')).toBe(false);
    await action({ type: 'setText', targetId: widget.id, value: 'B' }); expect(runtime.state().variables.Log).toBe('change;');
    await action({ type: 'setText', targetId: widget.id, value: 'B' }); expect(runtime.state().variables.Log).toBe('change;'); expect(runtime.textChanged(widget.id)).toBe(false);
  });

  it('preserves native whole-target-loop return when the first repeater form already has the requested text', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('input'); child.hintText = 'Hint'; repeater.repeater!.template = [child]; doc.pages[0].widgets = [repeater];
    const runtime = makeRuntime(doc, portable); await runtime.start(); const rows = runtime.rows(repeater);
    for (const [index, row] of rows.entries()) { runtime.hideHint(child.id, row.context); runtime.input(child.id, index === 0 ? 'Same' : `Other ${index}`, undefined, row.context); }
    await runtime.execute(event('click', { type: 'setText', targetId: child.id, value: 'Same' }));
    expect(logical(runtime, child, rows[0].context)).toBe('Same'); expect(logical(runtime, child, rows[1].context)).toBe('Other 1');
    await runtime.execute(event('click', { type: 'setText', targetId: child.id, value: 'Changed' }));
    for (const row of rows) expect(logical(runtime, child, row.context)).toBe('Changed');
  });

  it('keeps Error during ordinary text edits and allows Set Text on disabled hinted controls', async () => {
    const { widget, runtime, action } = fixture(portable); await runtime.setError(widget.id, true); runtime.hideHint(widget.id); runtime.input(widget.id, 'Typed');
    expect(runtime.widget(widget).error).toBe(true); await action({ type: 'disable', targetId: widget.id });
    expect(runtime.input(widget.id, 'Blocked')).toBe(false); expect(logical(runtime, widget)).toBe('Typed');
    await action({ type: 'setText', targetId: widget.id, value: '' }); expect(runtime.hint(widget.id)).toBe('Hint'); expect(logical(runtime, widget)).toBe(''); expect(runtime.widget(widget).error).toBe(true);
  });

  it('clears page-local hint/error caches on navigation and resets text-change comparison', async () => {
    const { doc, widget, runtime } = fixture(portable), next = createPage('Other'); doc.pages.push(next);
    runtime.hideHint(widget.id); runtime.input(widget.id, 'Changed'); await runtime.setError(widget.id, true);
    await runtime.navigate(next.id); await runtime.navigate(doc.pages[0].id);
    expect(runtime.widget(widget).error).toBe(false); expect(runtime.hint(widget.id)).toBe('Hint'); expect(logical(runtime, widget)).toBe('');
    expect(runtime.textChanged(widget.id)).toBe(false);
  });
});
