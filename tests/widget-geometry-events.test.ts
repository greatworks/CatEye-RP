import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { InteractionsEditor } from '../src/components/Inspector';
import type { EventType, Interaction, Widget } from '../src/model/types';

const interaction = (event: EventType): Interaction => ({ id: uid(), name: event, event, enabled: true, isNewIfGroup: true, conditionMode: 'all', conditions: [], actions: [] });
function options(widget?: Widget, allowedEvents?: readonly EventType[]) {
  const doc = createDocument();
  const html = renderToStaticMarkup(createElement(InteractionsEditor, { document: doc, page: doc.pages[0], widget, interactions: [interaction('click')], onChange: () => {}, allowedEvents }));
  const select = html.match(/<select aria-label="Interaction event"[^>]*>(.*?)<\/select>/s)?.[1];
  expect(select).toBeDefined();
  return select!;
}

describe('ordinary widget geometry events', () => {
  it.each(['box', 'input', 'panel', 'repeater'] as const)('round-trips move and resize cases on %s without changing their actions or chain boundaries', type => {
    const doc = createDocument(), widget = createWidget(type); doc.pages[0].widgets = [widget];
    widget.interactions = [interaction('resize'), interaction('move')];
    widget.interactions[1].enabled = false;
    widget.interactions[0].actions = [{ id: uid(), type: 'setText', targetId: widget.id, value: '[[This.width]] × [[This.height]]' }];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const [clone] = cloneWidgets([widget]);
    expect(clone.interactions.map(caseOf => caseOf.event)).toEqual(['resize', 'move']);
    expect(clone.interactions[0].actions[0].targetId).toBe(clone.id);
    expect(clone.interactions[1].enabled).toBe(false);
  });

  it.each(['resize', 'move'] as const)('rejects %s on pages instead of quietly accepting an inert page event', event => {
    const doc = createDocument(); doc.pages[0].interactions = [interaction(event)];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('resize and move events require a widget');
  });

  it('preserves nested source scope and keeps Item Resized restricted to repeaters', () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = repeater.repeater!.template[0];
    doc.pages[0].widgets = [repeater]; repeater.interactions = [interaction('itemResize'), interaction('resize')];
    child.interactions = [interaction('resize'), interaction('move')];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    child.interactions.push(interaction('itemResize'));
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('itemResize is supported only on a repeater');
  });

  it('shows distinct widget and row geometry events only in appropriate authoring contexts', () => {
    const shape = options(createWidget('box'));
    expect(shape).toContain('<option value="resize">Resized</option>');
    expect(shape).toContain('<option value="move">Moved</option>');
    expect(shape).not.toContain('value="itemResize"');
    const repeater = options(createWidget('repeater'));
    expect(repeater).toContain('<option value="itemResize">Item resized</option>');
    expect(repeater).toContain('<option value="resize">Resized</option>');
    expect(repeater).toContain('<option value="move">Moved</option>');
    const page = options();
    expect(page).not.toContain('value="resize"'); expect(page).not.toContain('value="move"'); expect(page).not.toContain('value="itemResize"');
  });

  it('honors the restricted inline-link event picker instead of leaking geometry options', () => {
    const limited = options(createWidget('text'), ['click']);
    expect(limited).toContain('value="click"'); expect(limited).not.toContain('value="resize"'); expect(limited).not.toContain('value="move"');
  });
});
