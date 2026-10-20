import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { richTextPlainText, textDecorationLine } from '../src/model/rich-text';
import { createOfflineRuntime, type OfflineRuntime, type RowContext } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Document, Interaction, RichTextLink, Widget, WidgetStyle } from '../src/model/types';

// Native expectations: research/hyperlink-runtime-evidence.md and the exact-original
// style/event/navigation probes. Authored expression identity is a product rule.
const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); vi.useRealTimers(); });
const branch = (actions: Omit<Action, 'id'>[] = [], patch: Partial<Interaction> = {}): Interaction => ({ id: uid(), name: 'Link case', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })), ...patch });
const trace = (value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value });
function fixture() {
  const doc = createDocument(), owner = createWidget('text'); doc.caseSelection = 'never'; doc.variables.Trace = '';
  const link: RichTextLink = { id: uid(), name: 'Independent link', interactions: [] };
  Object.assign(owner.style, { fontFamily: 'Arial', fontSize: 14, fontWeight: 400, color: '#123456' });
  owner.richText = { paragraphs: [{ runs: [{ text: 'Link', linkId: link.id, style: { underline: true, strikethrough: false } }] }], links: [link] };
  owner.text = richTextPlainText(owner.richText); doc.pages[0].widgets = [owner];
  return { doc, owner, link };
}
function make(doc: Document, portable: boolean) {
  const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, URL })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(runtime); return runtime;
}
function runStyle(runtime: OfflineRuntime, owner: Widget, context: RowContext = [], adaptive?: Partial<WidgetStyle>) {
  const w = runtime.widget(owner, context, false, adaptive), run = w.richText!.paragraphs[0].runs[0];
  return { ...w.style, ...run.style };
}
const line = (runtime: OfflineRuntime, owner: Widget, context: RowContext = [], adaptive?: Partial<WidgetStyle>) => textDecorationLine(runStyle(runtime, owner, context, adaptive));
const enter = (runtime: OfflineRuntime, owner: Widget, link: RichTextLink, context: RowContext = []) => { runtime.setInteractionState(owner.id, { mouseOver: true }, context); runtime.setLinkState(owner.id, link.id, 'enter', context); };

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} structured hyperlinks`, () => {
  it('applies parent hover then link hover only to the linked leaves', () => {
    const { doc, owner, link } = fixture(); owner.mouseOverStyle = { strikethrough: true }; link.mouseOverStyle = { underline: true };
    owner.richText!.paragraphs[0].runs.push({ text: ' Outside', style: { underline: false, strikethrough: false } }); owner.text = richTextPlainText(owner.richText!);
    const before = serializeDocument(doc), runtime = make(doc, portable); enter(runtime, owner, link);
    const w = runtime.widget(owner), runs = w.richText!.paragraphs[0].runs;
    expect(textDecorationLine(runs[0].style!)).toBe('underline line-through'); expect(textDecorationLine(runs[1].style!)).toBe('line-through');
    runtime.setLinkState(owner.id, link.id, 'leave'); expect(line(runtime, owner)).toBe('line-through'); expect(serializeDocument(doc)).toBe(before);
  });

  it('link down requests literal parent down, excluding its current hover and selected patches', async () => {
    const { doc, owner, link } = fixture(); owner.mouseOverStyle = { fontWeight: 700 }; owner.mouseDownStyle = { fontSize: 22 }; owner.selectedStyle = { color: '#ff0000' }; link.mouseDownStyle = { strikethrough: true };
    const runtime = make(doc, portable); await runtime.select(owner.id, true); enter(runtime, owner, link); runtime.setLinkState(owner.id, link.id, 'down');
    expect(runStyle(runtime, owner)).toMatchObject({ fontWeight: 400, fontSize: 22, color: '#123456', underline: false, strikethrough: true });
  });

  it('an empty link override returns without resetting existing parent selected paint', async () => {
    const { doc, owner, link } = fixture(); owner.selectedStyle = { strikethrough: true };
    const runtime = make(doc, portable); await runtime.select(owner.id, true); enter(runtime, owner, link); expect(line(runtime, owner)).toBe('line-through');
  });

  it('parent selected repaint replaces hovered link paint; reenter uses literal hover again', async () => {
    const { doc, owner, link } = fixture(); owner.selectedStyle = { strikethrough: true }; link.mouseOverStyle = { underline: false };
    const runtime = make(doc, portable); enter(runtime, owner, link); expect(line(runtime, owner)).toBe('none');
    await runtime.select(owner.id, true); expect(line(runtime, owner)).toBe('line-through');
    runtime.setLinkState(owner.id, link.id, 'enter'); expect(line(runtime, owner)).toBe('none');
  });

  it.each([false, true])('leave restores parent selected paint only with a nonempty parent hover effect (%s)', async hasHover => {
    const { doc, owner, link } = fixture(); owner.selectedStyle = { strikethrough: true }; if (hasHover) owner.mouseOverStyle = { fontWeight: 500 }; link.mouseOverStyle = { underline: false };
    const runtime = make(doc, portable); await runtime.select(owner.id, true); enter(runtime, owner, link); expect(line(runtime, owner)).toBe('none');
    runtime.setLinkState(owner.id, link.id, 'leave'); expect(line(runtime, owner)).toBe(hasHover ? 'line-through' : 'underline');
  });

  it('parent error repaint erases hover and the next link enter excludes error', async () => {
    const { doc, owner, link } = fixture(); owner.errorStyle = { strikethrough: true }; link.mouseOverStyle = { underline: false };
    const runtime = make(doc, portable); enter(runtime, owner, link); await runtime.setError(owner.id, true); expect(line(runtime, owner)).toBe('line-through');
    runtime.setLinkState(owner.id, link.id, 'enter'); expect(line(runtime, owner)).toBe('none');
  });

  it('mouse up resets down then reapplies nonempty link hover', () => {
    const { doc, owner, link } = fixture(); owner.mouseOverStyle = { fontWeight: 500 }; link.mouseOverStyle = { underline: false }; link.mouseDownStyle = { strikethrough: true };
    const runtime = make(doc, portable); enter(runtime, owner, link); runtime.setLinkState(owner.id, link.id, 'down'); expect(line(runtime, owner)).toBe('line-through');
    runtime.setLinkState(owner.id, link.id, 'up'); expect(line(runtime, owner)).toBe('none'); expect(runStyle(runtime, owner).fontWeight).toBe(500);
  });

  it('combines raw parent/link decoration once, with invalid FT restoring the leaf baseline', () => {
    const { doc, owner, link } = fixture(); owner.mouseOverStyle = { strikethrough: true }; link.mouseOverStyle = { underline: false };
    const runtime = make(doc, portable); enter(runtime, owner, link); expect(line(runtime, owner)).toBe('underline');
  });

  it('adaptive repaint replaces link paint; a repeated identical projection does not', () => {
    const { doc, owner, link } = fixture(); link.mouseOverStyle = { strikethrough: true }; const runtime = make(doc, portable);
    const first = { fontWeight: 500 }, next = { fontWeight: 700, color: '#abcdef' };
    runtime.widget(owner, [], false, first); enter(runtime, owner, link); expect(line(runtime, owner, [], first)).toBe('line-through'); expect(line(runtime, owner, [], { ...first })).toBe('line-through');
    expect(line(runtime, owner, [], next)).toBe('underline'); expect(runStyle(runtime, owner, [], next)).toMatchObject(next);
    runtime.setLinkState(owner.id, link.id, 'enter'); expect(line(runtime, owner, [], next)).toBe('line-through');
  });

  it('sole span plain Set Text keeps link identity and current painted style', async () => {
    const { doc, owner, link } = fixture(); link.mouseOverStyle = { strikethrough: true }; link.interactions = [branch([trace('link')])]; doc.variables.Value = 'Changed literal [[Trace]]';
    const runtime = make(doc, portable); enter(runtime, owner, link);
    await runtime.execute(branch([{ type: 'setText', targetId: owner.id, value: '[[Value]]' }]));
    const w = runtime.widget(owner); expect(w.text).toBe('Changed literal [[Trace]]'); expect(w.richText!.paragraphs[0].runs[0].linkId).toBe(link.id); expect(line(runtime, owner)).toBe('line-through');
    await runtime.triggerLink(owner.id, link.id); expect(runtime.state().variables.Trace).toBe('link');
    runtime.setLinkState(owner.id, link.id, 'leave'); expect(line(runtime, owner)).toBe('underline');
  });

  it.each(['multiple runs', 'multiple replacement lines'])('plain Set Text removes links for %s', async kind => {
    const { doc, owner, link } = fixture(); link.interactions = [branch([trace('must not run')])];
    if (kind === 'multiple runs') owner.richText!.paragraphs[0].runs.push({ text: ' rest' });
    owner.text = richTextPlainText(owner.richText!); const runtime = make(doc, portable);
    await runtime.execute(branch([{ type: 'setText', targetId: owner.id, value: kind === 'multiple runs' ? 'New' : 'New\nLine' }]));
    const rich = runtime.widget(owner).richText!; expect(rich.links).toBeUndefined(); expect(rich.paragraphs.flatMap(p => p.runs).every(run => run.linkId === undefined)).toBe(true);
    await runtime.triggerLink(owner.id, link.id); expect(runtime.state().variables.Trace).toBe('');
  });

  it('failed action segments restore link paint and adaptive paint context', async () => {
    const { doc, owner, link } = fixture(); link.mouseOverStyle = { strikethrough: true }; const runtime = make(doc, portable), adaptive = { fontWeight: 700 };
    runtime.widget(owner, [], false, adaptive); enter(runtime, owner, link); const before = runStyle(runtime, owner, [], adaptive);
    await expect(runtime.execute(branch([{ type: 'setStyle', targetId: owner.id, style: { color: '#ff0000' } }, { type: 'setSelected', targetId: owner.id, value: 'invalid' }]))).rejects.toThrow(/Invalid selected state/);
    expect(runStyle(runtime, owner, [], adaptive)).toEqual(before); expect(runtime.widget(owner, [], false, adaptive).text).toBe('Link');
  });

  it.each(['matching', 'empty', 'no cases', 'disabled case', 'false condition', 'disabled parent'])('logical parent handling: %s', async kind => {
    const { doc, owner, link } = fixture(); owner.interactions = [branch([trace('parent')])];
    if (kind !== 'no cases') link.interactions = [branch(kind === 'empty' ? [] : [trace('link')], {
      enabled: kind !== 'disabled case', conditions: kind === 'false condition' ? [{ source: 'variable', key: 'Trace', operator: 'equals', value: 'not equal' }] : [],
    })];
    if (kind === 'disabled parent') owner.disabled = true;
    const runtime = make(doc, portable); await runtime.triggerLink(owner.id, link.id);
    expect(runtime.state().variables.Trace).toBe(kind === 'matching' ? 'link' : ['no cases', 'disabled case', 'false condition'].includes(kind) ? 'parent' : '');
  });

  it('menu opening consumes the original click and only chosen link case runs', async () => {
    const { doc, owner, link } = fixture(); doc.caseSelection = 'always'; owner.interactions = [branch([trace('parent')])]; link.interactions = [branch([trace('link')])];
    const runtime = make(doc, portable); await runtime.triggerLink(owner.id, link.id); expect(runtime.state().variables.Trace).toBe('');
    const menu = runtime.state().caseMenus![0]; expect(menu.sourceId).toBe(link.id); await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Trace).toBe('link'); expect(runtime.state().caseMenus).toBeUndefined();
  });

  it('conditional Always menu evaluates at selection time without retroactive parent fallback', async () => {
    const { doc, owner, link } = fixture(); doc.caseSelection = 'always'; owner.interactions = [branch([trace('parent')])]; doc.variables.Choice = 'yes';
    link.interactions = [branch([trace('link')], { conditions: [{ source: 'variable', key: 'Choice', operator: 'equals', value: 'yes' }] })];
    const runtime = make(doc, portable); await runtime.triggerLink(owner.id, link.id); const menu = runtime.state().caseMenus![0];
    await runtime.execute(branch([{ type: 'setVariable', targetId: 'Choice', value: 'no' }])); await runtime.selectCase(menu.id, 'event'); expect(runtime.state().variables.Trace).toBe('');
  });

  it('Wait0 consumes parent click while later independent cases execute before its tail', async () => {
    vi.useFakeTimers(); const { doc, owner, link } = fixture(); owner.interactions = [branch([trace('parent')])];
    link.interactions = [branch([{ type: 'wait', duration: 0 }, trace('[[Trace]]tail|')]), branch([trace('second|')])];
    const runtime = make(doc, portable), pending = runtime.triggerLink(owner.id, link.id);
    await runtime.execute(branch()); expect(runtime.state().variables.Trace).toBe('second|'); await vi.runOnlyPendingTimersAsync(); await pending; expect(runtime.state().variables.Trace).toBe('second|tail|');
  });

  it('selected menu closes at Wait and its continuation keeps the link event', async () => {
    vi.useFakeTimers(); const { doc, owner, link } = fixture(); doc.caseSelection = 'always'; owner.interactions = [branch([trace('parent')])]; link.interactions = [branch([{ type: 'wait', duration: 10 }, trace('tail')])];
    const runtime = make(doc, portable); await runtime.triggerLink(owner.id, link.id); const menu = runtime.state().caseMenus![0], pending = runtime.selectCase(menu.id, menu.options[0].id);
    await runtime.execute(branch()); expect(runtime.state().caseMenus).toBeUndefined(); expect(runtime.state().variables.Trace).toBe(''); await vi.advanceTimersByTimeAsync(10); await pending; expect(runtime.state().variables.Trace).toBe('tail');
  });

  it('same link definition isolates row paint, source Item values, and target row mutations', async () => {
    const { doc, owner, link } = fixture(), repeater = createWidget('repeater'), output = createWidget('text'); output.text = 'untouched';
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [owner, output], itemHeight: 50, gap: 0 }; doc.pages[0].widgets = [repeater];
    link.mouseOverStyle = { strikethrough: true }; link.interactions = [branch([{ type: 'setText', targetId: output.id, value: '[[Item.Name]]' }])];
    const runtime = make(doc, portable); await runtime.start(); const [a, b] = runtime.rows(repeater); enter(runtime, owner, link, a.context);
    expect(line(runtime, owner, a.context)).toBe('line-through'); expect(line(runtime, owner, b.context)).toBe('underline'); await runtime.triggerLink(owner.id, link.id, a.context);
    expect(runtime.widget(output, a.context).text).toBe('A'); expect(runtime.widget(output, b.context).text).toBe('untouched'); await runtime.triggerLink(owner.id, link.id, b.context); expect(runtime.widget(output, b.context).text).toBe('B');
  });

  it('menus for one link in separate rows coexist and retain source contexts', async () => {
    const { doc, owner, link } = fixture(), repeater = createWidget('repeater'); doc.caseSelection = 'always';
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [owner], itemHeight: 50, gap: 0 }; doc.pages[0].widgets = [repeater]; link.interactions = [branch([trace('[[Item.Name]]')])];
    const runtime = make(doc, portable); await runtime.start(); const [a, b] = runtime.rows(repeater); await runtime.triggerLink(owner.id, link.id, a.context); await runtime.triggerLink(owner.id, link.id, b.context);
    const menus = runtime.state().caseMenus!; expect(menus).toHaveLength(2); await runtime.selectCase(menus[1].id, menus[1].options[0].id); expect(runtime.state().variables.Trace).toBe('B');
    await runtime.selectCase(menus[0].id, menus[0].options[0].id); expect(runtime.state().variables.Trace).toBe('A');
  });

  it.each(['current', 'new'] as const)('external %s URL host call is literal and synchronous within its action chain', async windowTarget => {
    const { doc, owner, link } = fixture(); const url = 'https://example.invalid/path?x=%5B%5BValue%5D%5D&v=1#fragment'; doc.variables.Value = 'do not substitute';
    link.interactions = [branch([trace('before'), { type: 'openUrl', value: url, windowTarget }, trace('after')])];
    const runtime = make(doc, portable), calls: { url: string; target: string; trace: string }[] = [];
    runtime.bindNavigation((value, target) => calls.push({ url: value, target, trace: runtime.state().variables.Trace })); await runtime.triggerLink(owner.id, link.id);
    expect(calls).toEqual([{ url, target: windowTarget, trace: 'before' }]); expect(runtime.state().variables.Trace).toBe('after');
  });

  it.each(['same link', 'different link', 'across paragraphs'])('resolved expression identity: %s', kind => {
    const { doc, owner, link } = fixture(); doc.variables.Value = 'Expanded'; const second = { ...link, id: uid(), name: 'Second link' };
    const left = { text: '[[Val', linkId: link.id }, right = { text: 'ue]]', linkId: kind === 'different link' ? second.id : link.id };
    owner.richText = { paragraphs: kind === 'across paragraphs' ? [{ runs: [{ ...left, text: '[[Value' }] }, { runs: [{ ...right, text: ']]' }] }] : [{ runs: [left, right] }], links: kind === 'different link' ? [link, second] : [link] };
    owner.text = richTextPlainText(owner.richText); const runtime = make(doc, portable), rich = runtime.richText(runtime.widget(owner))!;
    expect(richTextPlainText(rich)).toBe('Expanded');
    if (kind === 'same link') { expect(rich.paragraphs[0].runs[0].linkId).toBe(link.id); expect(rich.links).toHaveLength(1); }
    else { expect(rich.paragraphs.flatMap(p => p.runs).every(run => run.linkId === undefined)).toBe(true); expect(rich.links).toBeUndefined(); }
  });
});
