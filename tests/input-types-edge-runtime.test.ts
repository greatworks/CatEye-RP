import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget } from '../src/model/document';
import type { InputType } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
// Exact original functions in Edge reject these values; the evidence records
// attribute, direct property and original SetText paths independently.
const trailingNewlineCases: [InputType, string][] = (['\n', '\u2028', '\u2029']).flatMap(ending => [
  ['number', `1${ending}`], ['date', `2024-01-01${ending}`], ['month', `2024-02${ending}`], ['time', `09:05${ending}`],
] as [InputType, string][]);
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} strict input value endings`, () => {
  it.each(trailingNewlineCases)('rejects a final newline for %s', (inputType, text) => {
    const field = { ...createWidget('input'), inputType, text }, doc = createDocument(); doc.pages[0].widgets = [field];
    const api: OfflineRuntime = portable
      ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
      : createOfflineRuntime(doc, undefined, evaluateExpression);
    sessions.push(api);
    expect(api.controlValue(field.id)).toBe('');
    expect(api.text(`[[Widget.${field.id}.text]]`)).toBe('');
    expect(field.text).toBe(text);
  });
});
