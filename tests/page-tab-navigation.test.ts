import { describe, expect, it } from 'vitest';
import { adjacentPageTab, pageVisitHistory, retainPageHistory, resolvePageTabShortcut, stepPageHistory, visitPage } from '../src/model/page-tab-navigation';

describe('page tab visit history (native chronological cursor, not MRU)', () => {
  it('preserves repeated visits and bounds both ends without wrapping', () => {
    let history = pageVisitHistory('A');
    for (const id of ['B', 'C', 'A']) history = visitPage(history, id);
    expect(history).toEqual({ ids: ['A', 'B', 'C', 'A'], cursor: 3 });
    expect(stepPageHistory(history, 1)).toBe(history);
    history = stepPageHistory(history, -1); expect(history.ids[history.cursor]).toBe('C');
    history = stepPageHistory(history, -1); expect(history.ids[history.cursor]).toBe('B');
    history = stepPageHistory(history, -1); expect(history.ids[history.cursor]).toBe('A');
    expect(stepPageHistory(history, -1)).toBe(history);
    history = stepPageHistory(history, 1); expect(history.ids[history.cursor]).toBe('B');
  });
  it('same-page activation preserves forward visits; a different page truncates them', () => {
    const history = { ids: ['A', 'B', 'C'], cursor: 1 };
    expect(visitPage(history, 'B')).toBe(history);
    expect(visitPage(history, 'A')).toEqual({ ids: ['A', 'B', 'A'], cursor: 2 });
  });
  it.each([
    [2, ['A', 'B'], ['A', 'B'], 1],
    [1, ['A', 'C'], ['A', 'C'], 0],
    [0, ['B', 'C'], ['B', 'C'], 0],
    [2, ['B', 'C'], ['B', 'C'], 1],
    [0, ['A', 'B'], ['A', 'B'], 0],
  ] as const)('removing a closed tab adjusts cursor %i with survivors %j', (cursor, open, ids, expectedCursor) => {
    expect(retainPageHistory({ ids: ['A', 'B', 'C'], cursor }, open)).toEqual({ ids, cursor: expectedCursor });
  });
  it('removes every occurrence and collapses all-identical survivors', () => {
    expect(retainPageHistory({ ids: ['A', 'B', 'A', 'C', 'B'], cursor: 4 }, ['A', 'C'])).toEqual({ ids: ['A', 'A', 'C'], cursor: 2 });
    expect(retainPageHistory({ ids: ['A', 'B', 'A'], cursor: 2 }, ['A'])).toEqual({ ids: ['A'], cursor: 0 });
    expect(retainPageHistory(pageVisitHistory('A'), [])).toEqual({ ids: [], cursor: -1 });
  });
  it('visual order wraps independently of visits and handles a single/absent tab', () => {
    expect(adjacentPageTab(['C', 'A', 'B'], 'B', 1)).toBe('C');
    expect(adjacentPageTab(['C', 'A', 'B'], 'C', -1)).toBe('B');
    expect(adjacentPageTab(['A'], 'A', 1)).toBe('A');
    expect(adjacentPageTab([], 'A', 1)).toBeUndefined();
    expect(adjacentPageTab(['A'], 'B', 1)).toBeUndefined();
  });
});

describe('exact Windows page tab shortcuts', () => {
  const key = { key: '', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };
  it.each([
    ['Tab', false, false, 'historyForward'], ['Tab', false, true, 'historyBack'],
    ['ArrowRight', true, false, 'visualNext'], ['ArrowLeft', true, false, 'visualPrevious'],
    ['w', false, false, 'close'], ['W', false, true, 'closeAll'], ['F4', false, false, 'close'],
  ])('resolves %s alt=%s shift=%s', (value, altKey, shiftKey, expected) => {
    expect(resolvePageTabShortcut({ ...key, key: String(value), altKey: Boolean(altKey), shiftKey: Boolean(shiftKey) })).toBe(expected);
  });
  it('does not alias extra modifiers, composition, AltGraph or macOS window commands', () => {
    for (const patch of [{ altKey: true }, { metaKey: true }, { ctrlKey: false, metaKey: true }, { isComposing: true }, { getModifierState: () => true }]) {
      expect(resolvePageTabShortcut({ ...key, key: 'w', ...patch })).toBeUndefined();
    }
    expect(resolvePageTabShortcut({ ...key, key: 'ArrowRight', altKey: true, shiftKey: true })).toBeUndefined();
    expect(resolvePageTabShortcut({ ...key, key: 'Tab', altKey: true })).toBeUndefined();
    expect(resolvePageTabShortcut({ ...key, key: 'Tab', ctrlKey: false })).toBeUndefined();
  });
});
