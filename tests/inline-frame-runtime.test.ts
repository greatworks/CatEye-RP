import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createWidget, createPage, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { inlineFrameFixture } from './fixtures/inline-frames';
import type { Action, Interaction } from '../src/model/types';
const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(session => session.dispose()));
const ix = (actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Frame action', enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} inline frames`, () => {
  function setup() {
    const doc = inlineFrameFixture();
    const factory = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, URL }) : createOfflineRuntime;
    const runtime: OfflineRuntime = factory(doc, undefined, evaluateExpression); sessions.push(runtime);
    return { doc, runtime, left: doc.pages[0].widgets.find(w => w.id === 'frame-left')! };
  }
  it('retains authored target and does not load embedded pages into the parent runtime', async () => {
    const { doc, runtime } = setup(), before = serializeDocument(doc);
    await runtime.start(); expect(runtime.frame('frame-left')?.target).toEqual({ kind: 'page', pageId: 'frame-catalog' });
    expect(runtime.state().variables.FrameCount).toBe('0'); expect(serializeDocument(doc)).toBe(before);
  });
  it('same target navigation changes revision each time without resetting another frame', async () => {
    const { runtime } = setup(), initial = runtime.frame('frame-left')!.revision, right = runtime.frame('frame-right')!.revision;
    await runtime.trigger('frame-reload', 'click'); const next = runtime.frame('frame-left')!.revision;
    expect(next).not.toBe(initial); expect(runtime.frame('frame-right')!.revision).toBe(right);
    await runtime.trigger('frame-reload', 'click'); expect(runtime.frame('frame-left')!.revision).not.toBe(next);
  });
  it('navigation continues synchronously before any iframe load', async () => {
    const { runtime } = setup();
    await runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId: 'frame-left', frameTarget: { kind: 'page', pageId: 'frame-detail' } }, { type: 'setVariable', targetId: 'FrameCount', value: 'finished' }]));
    expect(runtime.state().variables.FrameCount).toBe('finished'); expect(runtime.frame('frame-left')?.target).toEqual({ kind: 'page', pageId: 'frame-detail' });
  });
  it('literal URL and local file targets are not expression interpolated', async () => {
    const { runtime } = setup();
    for (const target of [{ kind: 'url', url: 'https://example.invalid/a?x=%26' }, { kind: 'file', path: 'local document.html' }] as const) {
      await runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId: 'frame-left', frameTarget: target }]));
      expect(runtime.frame('frame-left')?.target).toEqual(target);
    }
  });
  it('hidden and authored-disabled frames still accept navigation actions', async () => {
    const { runtime, left } = setup(); left.hidden = true; left.disabled = true;
    await runtime.trigger('frame-show-detail', 'click'); expect(runtime.frame(left.id)?.target).toEqual({ kind: 'page', pageId: 'frame-detail' });
  });
  it('unrelated rendering changes and hide/show preserve frame revision', async () => {
    const { runtime } = setup(), before = runtime.frame('frame-left');
    await runtime.trigger('frame-sibling-update', 'click');
    await runtime.execute(ix([{ type: 'hide', targetId: 'frame-left' }, { type: 'show', targetId: 'frame-left' }]));
    expect(runtime.frame('frame-left')).toEqual(before);
  });
  it('a failed action segment restores frame target and reload revision', async () => {
    const { runtime } = setup(), before = runtime.frame('frame-left');
    await expect(runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId: 'frame-left', frameTarget: { kind: 'page', pageId: 'frame-detail' } }, { type: 'setVariable', targetId: 'FrameCount', value: '[[globalThis.alert]]' }]))).rejects.toThrow();
    expect(runtime.frame('frame-left')).toEqual(before);
  });
  it('parent scope routes a typed target to the host then continues the action chain', async () => {
    const { runtime } = setup(), seen: unknown[] = []; runtime.bindParentFrame(target => seen.push([target, runtime.state().variables.FrameCount]));
    await runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'parent', frameTarget: { kind: 'page', pageId: 'frame-detail' } }, { type: 'setVariable', targetId: 'FrameCount', value: 'next' }]));
    expect(seen).toEqual([[{ kind: 'page', pageId: 'frame-detail' }, '0']]); expect(runtime.state().variables.FrameCount).toBe('next');
  });
  it('missing host rejects instead of silently navigating the editor', async () => {
    const { runtime } = setup(); await expect(runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'parent', frameTarget: { kind: 'page', pageId: 'frame-detail' } }]))).rejects.toThrow(/host/);
  });
  it('non-frame and missing action targets are no-ops', async () => {
    const { runtime } = setup();
    for (const targetId of ['frame-heading', 'absent']) await runtime.execute(ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId, frameTarget: { kind: 'page', pageId: 'frame-detail' } }]));
    expect(runtime.state().frameNavigations).toBeUndefined();
  });
  it('page reentry resets frame destinations and invalidates the old DOM revision', async () => {
    const { runtime } = setup(); await runtime.trigger('frame-show-detail', 'click'); const before = runtime.frame('frame-left')!.revision;
    await runtime.navigate('frame-parent-destination'); await runtime.navigate('frame-home');
    expect(runtime.frame('frame-left')?.target).toEqual({ kind: 'page', pageId: 'frame-catalog' }); expect(runtime.frame('frame-left')!.revision).not.toBe(before);
  });
  it('row-local navigation isolates instances and refresh resets temporary destinations', async () => {
    const { runtime, doc, left } = setup(), repeater = createWidget('repeater');
    // Construct a new runtime so ownership is indexed from the final document.
    runtime.dispose(); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], itemHeight: 200, gap: 0, template: [left] }; doc.pages[0].widgets = [repeater];
    const factory = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, URL }) : createOfflineRuntime;
    const session: OfflineRuntime = factory(doc, undefined, evaluateExpression); sessions.push(session); await session.start();
    const rows = session.rows(repeater), action = ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId: left.id, frameTarget: { kind: 'page', pageId: 'frame-detail' } }]);
    await session.execute(action, rows[1].data, rows[1].context);
    expect(session.frame(left.id, rows[0].context)?.target).toEqual(left.inlineFrame!.target); expect(session.frame(left.id, rows[1].context)?.target).toEqual({ kind: 'page', pageId: 'frame-detail' });
    await session.execute(ix([{ type: 'addRow', targetId: repeater.id, value: '{"Name":"C"}' }]));
    expect(session.frame(left.id, session.rows(repeater)[1].context)?.target).toEqual(left.inlineFrame!.target);
  });
  it('outside-row frame action resolves only the first visible instance', async () => {
    const { runtime, doc, left } = setup(), repeater = createWidget('repeater'); runtime.dispose();
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], itemHeight: 200, gap: 0, template: [left] }; doc.pages[0].widgets = [repeater];
    const session = createOfflineRuntime(doc); sessions.push(session); await session.start();
    await session.execute(ix([{ type: 'openLinkInFrame', frameScope: 'widget', targetId: left.id, frameTarget: { kind: 'page', pageId: 'frame-detail' } }]));
    expect(session.frame(left.id, session.rows(repeater)[0].context)?.target).toEqual({ kind: 'page', pageId: 'frame-detail' }); expect(session.frame(left.id, session.rows(repeater)[1].context)?.target).toEqual(left.inlineFrame!.target);
  });
});
