import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MotionActionEditor, defaultMoveTarget, defaultResizeTarget, renameMotionBinding } from '../src/components/MotionActionEditor';
import { parseMotionExpression, parseMoveActionSpec, parseResizeActionSpec } from '../src/model/document';

describe('motion authoring controls', () => {
  it('starts with complete valid specs and unchanged coordinates', () => {
    expect(parseMoveActionSpec({ targets: [defaultMoveTarget()] })).toEqual({ targets: [defaultMoveTarget()] });
    expect(parseResizeActionSpec({ targets: [defaultResizeTarget()] })).toEqual({ targets: [defaultResizeTarget()] });
    expect(defaultMoveTarget().x.text).toBe(''); expect(defaultResizeTarget().width.text).toBe('');
  });
  it('renders every ordered target with its own movement, bindings, boundary and duration controls', () => {
    const html = renderToStaticMarkup(createElement(MotionActionEditor, { kind: 'move', value: { targets: [defaultMoveTarget(), { ...defaultMoveTarget(), target: { kind: 'widgetsBelow' }, mode: 'sizeDeltaY' }] }, choices: [], onChange: () => {} }));
    for (const label of ['Move target 1 X', 'Move target 2 X', 'Move target 2 mode', 'Move target 2 duration', 'Enable Move target 2 boundary']) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('Arc clockwise'); expect(html).toContain('Move target 2 down');
  });
  it('renders Size anchors and This Item without an invented Size By option', () => {
    const html = renderToStaticMarkup(createElement(MotionActionEditor, { kind: 'resize', value: { targets: [defaultResizeTarget()] }, choices: [], onChange: () => {} }));
    expect(html).toContain('Resize target 1 width'); expect(html).toContain('Resize target 1 anchor'); expect(html).toContain('This repeater item'); expect(html).not.toContain('value="by"');
  });
  it('renames bound identifiers in expressions while preserving strings, plain text, and other roots', () => {
    const original = { text: 'track [[Track.width + track.x + soundtrack.x + value("track.width") + \'track.x\']] track [[中文track.x]]', bindings: { track: { kind: 'widget' as const, targetId: 'source' } } };
    const renamed = renameMotionBinding(original, 'track', 'rail');
    expect(renamed.text).toBe('track [[rail.width + rail.x + soundtrack.x + value("track.width") + \'track.x\']] track [[中文track.x]]');
    expect(renamed.bindings).toEqual({ rail: { kind: 'widget', targetId: 'source' } }); expect(original.bindings.track.targetId).toBe('source'); expect(parseMotionExpression(renamed)).toEqual(renamed);
  });
  it.each([['e3', '[[1e3 + e3.x]]', '[[1e3 + rail.x]]'], ['e', '[[1e-3 + e.x]]', '[[1e-3 + rail.x]]'], ['e2', '[[.5E+2 + e2.width + 5.e2]]', '[[.5E+2 + rail.width + 5.e2]]']])('preserves numeric exponent tokens while renaming %s', (alias, text, expected) => {
    expect(renameMotionBinding({ text, bindings: { [alias]: { kind: 'widget', targetId: 'shape' } } }, alias, 'rail').text).toBe(expected);
  });
});
