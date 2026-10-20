import { Script, createContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import type { Document, Interaction } from '../src/model/types';
import { exportPrototype, inlineFrameBootstrap } from '../src/runtime/export';
import { mountOfflinePrototype, type OfflineRuntime } from '../src/runtime/export-runtime';

function fixture() {
  const doc = createDocument(); doc.caseSelection = 'never';
  doc.variables.FirstWidth = ''; doc.variables.NextWidth = '';
  const record = (name: string): Interaction => ({ id: uid(), name, event: 'load', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: uid(), type: 'setVariable', targetId: name, value: '[[This.width]]' }] });
  const hidden = createWidget('box'); hidden.hidden = true; hidden.width = 80;
  hidden.interactions = [record('FirstWidth')];
  const first = doc.pages[0]; first.width = 1200; first.widgets = [hidden];
  first.adaptiveViews = [{ id: 'first-phone', name: 'Phone', width: 390, overrides: { [hidden.id]: { width: 111 } } }];
  const next = createPage('Narrow destination'); next.width = 360;
  const panel = createWidget('panel'), inactive = createWidget('box'); inactive.width = 90;
  inactive.interactions = [record('NextWidth')];
  panel.states = [{ id: uid(), name: 'Visible', widgets: [] }, { id: uid(), name: 'Inactive', widgets: [inactive] }];
  panel.activeStateId = panel.states[0].id; next.widgets = [panel];
  next.adaptiveViews = [{ id: 'destination-phone', name: 'Phone', width: 360, overrides: { [inactive.id]: { width: 222 } } }];
  doc.pages.push(next);
  // Preserve this suite's legacy maximum-width bootstrap contract explicitly.
  for (const page of doc.pages) { delete page.adaptiveSelection; delete page.adaptiveBaseSize; }
  return { doc, next };
}

/** Run the actual emitted bootstrap and serialized core. Only the DOM mount is
 * replaced: these tests target initialization policy and Loaded ordering; the
 * browser suite separately exercises real DOM mounting and viewport events. */
async function boot(doc: Document, width: number, embedded: boolean) {
  const captured: { runtime?: OfflineRuntime; started?: Promise<void>; initialView?: string } = {};
  const mount = (_doc: Document, runtime: OfflineRuntime) => {
    captured.runtime = runtime; captured.initialView = runtime.adaptiveViewId(); captured.started = runtime.start();
  };
  const window = { innerWidth: width, addEventListener() {}, removeEventListener() {}, parent: { postMessage() {} } };
  const context = createContext({ structuredClone, setTimeout, clearTimeout, crypto: webcrypto, window, location: { href: 'file:///isolated/prototype.html' }, document: {
    getElementById(id: string) { return { textContent: id === 'prototype-data' ? JSON.stringify(doc) : '' }; },
  }, captureMount: mount });
  const serializedMount = `(${mountOfflinePrototype.toString()})`;
  if (embedded) {
    const source = inlineFrameBootstrap();
    expect(source.includes(serializedMount)).toBe(true);
    const bootstrap = new Script(`(${source.replace(serializedMount, 'captureMount')})`).runInContext(context);
    bootstrap(structuredClone(doc), { base: 'file:///isolated/prototype.html', styles: '', bootstrap: '' }, doc.pages[0].id);
  } else {
    const html = exportPrototype(doc), source = html.match(/<\/script><script>([^]*?)<\/script>/)![1];
    expect(source.includes(serializedMount)).toBe(true);
    new Script(source.replace(serializedMount, 'captureMount')).runInContext(context);
  }
  await captured.started;
  return { runtime: captured.runtime!, initialView: captured.initialView };
}

for (const embedded of [false, true]) describe(`${embedded ? 'embedded child' : 'offline root'} emitted adaptive bootstrap`, () => {
  for (const width of [390, 1000]) it(`selects its own ${width}px viewport before hidden Loaded, then reclamps on navigation`, async () => {
    const { doc, next } = fixture(), before = JSON.stringify(doc);
    const { runtime, initialView } = await boot(doc, width, embedded);
    try {
      expect(initialView).toBe(width === 390 ? 'first-phone' : undefined);
      expect(runtime.state().variables.FirstWidth).toBe(width === 390 ? '111' : '80');
      await runtime.navigate(next.id);
      expect(runtime.adaptiveViewId()).toBe('destination-phone');
      expect(runtime.state().variables.NextWidth).toBe('222');
      expect(JSON.stringify(doc)).toBe(before);
    } finally { runtime.dispose(); }
  });
});
