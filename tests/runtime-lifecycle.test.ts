import { describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { createRuntime, evaluateConditions } from '../src/runtime/engine';
import type { Interaction } from '../src/model/types';

describe('runtime lifecycle and literal values', () => {
  it('does not notify or repaint for an event with no handler', async () => {
    const doc = createDocument(), button = createWidget('button');
    doc.pages[0].widgets.push(button);
    const runtime = createOfflineRuntime(doc), changed = vi.fn();
    runtime.subscribe(changed);
    await runtime.trigger(button.id, 'mouseEnter');
    await runtime.trigger(button.id, 'mouseLeave');
    expect(changed).not.toHaveBeenCalled();
  });

  it('disposing a runtime cancels pending waits and their later actions', async () => {
    vi.useFakeTimers();
    try {
      const doc = createDocument(), button = createWidget('button');
      button.interactions.push({ id: uid(), event: 'click', name: 'Delayed', enabled: true, conditionMode: 'all', conditions: [], actions: [
        { id: uid(), type: 'wait', duration: 60000 },
        { id: uid(), type: 'setVariable', targetId: 'Status', value: 'stale' },
      ] });
      doc.pages[0].widgets.push(button);
      const runtime = createOfflineRuntime(doc), changed = vi.fn();
      runtime.subscribe(changed);
      const pending = runtime.trigger(button.id, 'click');
      await Promise.resolve();
      runtime.dispose();
      await pending;
      expect(runtime.state().variables.Status).toBeUndefined();
      expect(changed).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('compares stored form and variable text without parsing its placeholder syntax', async () => {
    const doc = createDocument(), input = createWidget('input'), button = createWidget('button');
    doc.variables.Literal = '[[Missing]]';
    doc.pages[0].widgets.push(input, button);
    const empty: Interaction = { id: uid(), event: 'click', name: 'Not empty', enabled: true, conditionMode: 'all', conditions: [
      { source: 'widgetText', key: input.id, operator: 'isEmpty', value: '' },
    ], actions: [{ id: uid(), type: 'setVariable', targetId: 'BadMatch', value: 'bad' }] };
    button.interactions.push(empty);
    // User-entered values belong to runtime overrides. Authored initial text
    // expressions are resolved once, just as the actual form renderer does.
    const state = createRuntime(doc); state.widgetOverrides[input.id] = { text: '[[Missing]]' };
    expect(evaluateConditions(doc, state, empty)).toBe(false);
    const offline = createOfflineRuntime(doc); offline.input(input.id, '[[Missing]]'); await offline.trigger(button.id, 'click');
    expect(offline.state().variables.BadMatch).toBeUndefined();
    empty.conditions = [{ source: 'variable', key: 'Literal', operator: 'isEmpty', value: '' }];
    expect(evaluateConditions(doc, createRuntime(doc), empty)).toBe(false);
  });
});
