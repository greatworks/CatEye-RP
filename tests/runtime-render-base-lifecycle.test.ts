import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const event = (action: Omit<Action, 'id'>): Interaction => ({ id: uid(), event: 'click', name: 'Refresh', enabled: true, conditionMode: 'all', conditions: [], actions: [{ ...action, id: uid() }] });
for (const portable of [false, true]) describe(portable ? 'serialized render bases' : 'module render bases', () => {
  it('forgets display-only row bases before a rebuilt row receives actions', async () => {
    const doc = createDocument(), list = createWidget('repeater'), shape = createWidget('box', 10, 20);
    list.repeater!.template = [shape]; list.repeater!.rows = [{ Name: 'Same row' }]; doc.pages[0].widgets = [list];
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
    try {
      await runtime.start(); const row = runtime.rows(list)[0];
      runtime.widget({ ...shape, x: 99 }, row.context); // Render-only: no action/registration/override.
      await runtime.execute(event({ type: 'removeFilter', targetId: list.id, value: '{"all":true}' }));
      const rebuilt = runtime.rows(list)[0]; expect(rebuilt.id).toBe(row.id);
      // The unspecified axis must use the rebuilt template, not the prior view.
      await runtime.execute(event({ type: 'move', targetId: shape.id, y: 5 }), rebuilt.data, rebuilt.context);
      expect(runtime.widget(shape, rebuilt.context)).toMatchObject({ x: 10, y: 5 });
    } finally { runtime.dispose(); }
  });
});
