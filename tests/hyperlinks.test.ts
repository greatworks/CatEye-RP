import { describe, expect, it } from 'vitest';
import { cloneWidgets, collectWidgetIdentifiers, createDocument, createPage, createWidget, parseDocument, parseExternalUrl, parseRichText, serializeDocument, uid } from '../src/model/document';
import { applyComponentInstanceChanges, createComponent, createComponentInstance, updateComponent } from '../src/model/components';
import { applyRichTextStyle, assignRichTextLink, formatRichTextRange, insertRichTextSoftBreak, removeRichTextLink, removeRichTextLinkRange, replaceRichTextRange, replaceWidgetText, richTextFromPlainText, richTextLinkAt, richTextPlainText, updateRichTextLink } from '../src/model/rich-text';
import type { Action, Document, RichText, RichTextLink, Widget } from '../src/model/types';

function link(name = 'Details'): RichTextLink {
  return { id: uid(), name, mouseOverStyle: { color: '#123456', underline: true }, mouseDownStyle: { fontStyle: 'italic' }, interactions: [{ id: uid(), name: 'Visit', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [{ id: uid(), type: 'openUrl', value: 'https://example.invalid/path?q=%5B%5BName%5D%5D#details', windowTarget: 'new' }] }] };
}
function richFixture(): RichText {
  const item = link();
  return { expressionMode: 'literal', links: [item], paragraphs: [{ textAlign: 'right', lineHeightPx: 28, runs: [{ text: 'A ', style: { fontWeight: 400 } }, { text: 'link', style: { color: '#660000', fontStyle: 'italic' }, linkId: item.id }, { text: ' Z' }] }, { runs: [{ text: 'Again', linkId: item.id, style: { fontFamily: 'Georgia', underline: false } }] }] };
}
function fixture() {
  const doc = createDocument(), owner = createWidget('text'), target = createWidget('text'), select = createWidget('select'), panel = createWidget('panel');
  const nextPage = createPage('Destination'), external = createWidget('text');
  doc.pages.push(nextPage); nextPage.widgets = [external];
  owner.richText = richFixture(); owner.text = richTextPlainText(owner.richText);
  const item = owner.richText.links![0];
  item.interactions[0].conditions = [
    { source: 'widgetText', key: target.id, operator: 'equals', value: `[[Widget.${target.id}.text]]` },
    { source: 'selectedOption', key: select.id, operator: 'equals', value: 'Option 1' },
    { source: 'variable', key: 'Gate', operator: 'equals', value: 'yes' },
  ];
  item.interactions[0].actions = [
    { id: uid(), type: 'setText', targetId: target.id, value: `[[Widget.${owner.id}.text]]` },
    { id: uid(), type: 'setSelectedOption', targetId: select.id, value: 'Option 1' },
    { id: uid(), type: 'setState', targetId: panel.id, value: panel.activeStateId },
    { id: uid(), type: 'openPage', targetId: nextPage.id },
    { id: uid(), type: 'setVariable', targetId: 'Gate', value: 'yes' },
    { id: uid(), type: 'setText', targetId: external.id, value: 'Outside' },
    { id: uid(), type: 'openUrl', value: `https://example.invalid/Widget.${target.id}.text?q=%5B%5BWidget.${target.id}.text%5D%5D`, windowTarget: 'current' },
  ];
  item.interactions.push({ id: uid(), name: 'Fallback', event: 'click', enabled: false, isNewIfGroup: false, conditionMode: 'any', conditions: [], actions: [{ id: uid(), type: 'wait', duration: 0 }] });
  doc.variables.Gate = 'yes'; doc.pages[0].widgets = [owner, target, select, panel];
  return { doc, owner, target, select, panel, external, nextPage };
}
const linkedText = (rich: RichText) => rich.paragraphs.flatMap(p => p.runs.filter(r => r.linkId).map(r => r.text)).join('|');
function assertInternalGraph(widgets: Widget[], original: ReturnType<typeof fixture>) {
  const [owner, target, select, panel] = widgets, item = owner.richText!.links![0], branch = item.interactions[0];
  expect(owner.richText!.paragraphs.flatMap(p => p.runs).filter(r => r.linkId).map(r => r.linkId)).toEqual([item.id, item.id]);
  expect(branch.conditions).toEqual([
    { source: 'widgetText', key: target.id, operator: 'equals', value: `[[Widget.${target.id}.text]]` },
    { source: 'selectedOption', key: select.id, operator: 'equals', value: 'Option 1' },
    { source: 'variable', key: 'Gate', operator: 'equals', value: 'yes' },
  ]);
  expect(branch.actions.map(({ id: _id, ...action }) => action)).toEqual([
    { type: 'setText', targetId: target.id, value: `[[Widget.${owner.id}.text]]` },
    { type: 'setSelectedOption', targetId: select.id, value: 'Option 1' },
    { type: 'setState', targetId: panel.id, value: panel.activeStateId },
    { type: 'openPage', targetId: original.nextPage.id },
    { type: 'setVariable', targetId: 'Gate', value: 'yes' },
    { type: 'setText', targetId: original.external.id, value: 'Outside' },
    { type: 'openUrl', value: original.owner.richText!.links![0].interactions[0].actions[6].value, windowTarget: 'current' },
  ]);
}

describe('hyperlink strict document boundaries', () => {
  it('round-trips graph identities, literal URL, disjoint run references and independent effects without changing legacy documents', () => {
    const { doc } = fixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const old = createDocument(); old.pages[0].widgets = [createWidget('text')];
    expect(parseDocument(serializeDocument(old))).toEqual(old); expect(serializeDocument(old)).not.toContain('links');
    expect(parseRichText(richTextFromPlainText('old'))).not.toHaveProperty('links');
  });

  it.each(['owner', 'page', 'case', 'action', 'other-link'] as const)('rejects hyperlink identity aliasing a %s identifier globally', kind => {
    const { doc, owner } = fixture(), item = owner.richText!.links![0], oldId = item.id;
    const next = kind === 'owner' ? owner.id : kind === 'page' ? doc.pages[0].id : kind === 'case' ? item.interactions[0].id : kind === 'action' ? item.interactions[0].actions[0].id : item.id;
    if (kind === 'other-link') owner.richText!.links!.push(structuredClone(item));
    else { item.id = next; owner.richText!.paragraphs.forEach(p => p.runs.forEach(r => { if (r.linkId === oldId) r.linkId = next; })); }
    expect(() => parseDocument(JSON.stringify(doc))).toThrow(/duplicate identifier/);
  });

  it.each(['unknown-reference', 'unreferenced-definition', 'missing-definitions', 'duplicate-case', 'duplicate-action', 'unsupported-event', 'unknown-link-field', 'unsafe-style', 'unsafe-key'] as const)('rejects %s rather than flattening links', kind => {
    const rich = richFixture(), item = rich.links![0];
    if (kind === 'unknown-reference') rich.paragraphs[0].runs[1].linkId = 'missing';
    if (kind === 'unreferenced-definition') rich.links!.push(link('unused'));
    if (kind === 'missing-definitions') delete rich.links;
    if (kind === 'duplicate-case') item.interactions.push(structuredClone(item.interactions[0]));
    if (kind === 'duplicate-action') item.interactions[0].actions.push(structuredClone(item.interactions[0].actions[0]));
    if (kind === 'unsupported-event') item.interactions[0].event = 'mouseEnter';
    if (kind === 'unknown-link-field') Object.assign(item, { href: 'https://example.invalid' });
    if (kind === 'unsafe-style') Object.assign(item.mouseOverStyle!, { fill: 'red' });
    if (kind === 'unsafe-key') Object.defineProperty(item, '__proto__', { enumerable: true, value: {} });
    expect(() => parseRichText(rich)).toThrow();
  });

  it('applies ordinary action and condition target restrictions inside link cases', () => {
    const { doc, owner, target, panel } = fixture(), branch = owner.richText!.links![0].interactions[0];
    branch.actions = [{ id: uid(), type: 'setSelected', targetId: panel.id, value: 'true' }];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('setSelected does not support panel');
    branch.actions = [{ id: uid(), type: 'setSelectedOption', targetId: target.id, value: 'X' }];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('setSelectedOption requires a select');
    branch.actions = []; branch.conditions = [{ source: 'selectedOption', key: target.id, operator: 'equals', value: '' }];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectedOption requires a select');
  });

  it('retains missing ordinary targets for the established runtime no-op contract', () => {
    const { doc, owner } = fixture(); owner.richText!.links![0].interactions[0].actions = [{ id: uid(), type: 'setText', targetId: 'deleted-control', value: 'text' }];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it.each(['current', 'new'] as const)('keeps an exact encoded HTTP(S) destination for the %s window', windowTarget => {
    const { doc, owner } = fixture(), value = 'HTTPS://example.invalid/a%20b?q=%5B%5Bliteral%5D%5D#中文';
    owner.richText!.links![0].interactions[0].actions = [{ id: uid(), type: 'openUrl', value, windowTarget }];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(parseExternalUrl(value)).toBe(value);
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'file:///C:/private', '//example.invalid', 'https://user:pass@example.invalid/', 'https://example.invalid/[[Name]]', 'https://example.invalid/with space', 'https://example.invalid/\nline', 'https://example.invalid/\\path', ' https://example.invalid', 'https://', `https://example.invalid/${'x'.repeat(4096)}`])('rejects a nonliteral or unsafe URL %j', value => {
    const { doc, owner } = fixture(); owner.richText!.links![0].interactions[0].actions = [{ id: uid(), type: 'openUrl', value, windowTarget: 'new' }];
    expect(() => parseExternalUrl(value)).toThrow(); expect(() => parseDocument(JSON.stringify(doc))).toThrow();
  });

  it.each(['missing-window', 'invalid-window', 'missing-url', 'widget-target', 'window-on-other-action'] as const)('rejects the openUrl action configuration %s', kind => {
    const { doc, owner } = fixture(); const action: Action = { id: uid(), type: 'openUrl', value: 'http://example.invalid', windowTarget: 'current' };
    if (kind === 'missing-window') delete action.windowTarget;
    if (kind === 'invalid-window') Object.assign(action, { windowTarget: '_blank' });
    if (kind === 'missing-url') delete action.value;
    if (kind === 'widget-target') action.targetId = owner.id;
    if (kind === 'window-on-other-action') action.type = 'setText';
    owner.richText!.links![0].interactions[0].actions = [action]; expect(() => parseDocument(JSON.stringify(doc))).toThrow();
  });

  it('enforces link and case budgets before accepting potentially huge graphs', () => {
    const rich = richFixture(); rich.links = Array.from({ length: 1001 }, () => link());
    expect(() => parseRichText(rich)).toThrow();
    const next = richFixture(); next.links![0].interactions = Array.from({ length: 101 }, () => link().interactions[0]);
    expect(() => parseRichText(next)).toThrow();
  });
});

describe('hyperlink text edits and range semantics', () => {
  it('assigns across paragraph/run boundaries without flattening formats and prunes a replaced link definition', () => {
    const original = richFixture(), snapshot = structuredClone(original), replacement = link('Replacement');
    const next = assignRichTextLink(original, 1, richTextPlainText(original).length, replacement);
    expect(original).toEqual(snapshot); expect(richTextPlainText(next)).toBe(richTextPlainText(original));
    expect(next.expressionMode).toBe('literal'); expect(next.links).toEqual([replacement]);
    expect(next.paragraphs[0]).toMatchObject({ textAlign: 'right', lineHeightPx: 28 });
    expect(next.paragraphs[0].runs.find(r => r.text === 'link')).toMatchObject({ linkId: replacement.id, style: { color: '#660000', fontStyle: 'italic' } });
    expect(next.paragraphs[1].runs[0]).toMatchObject({ linkId: replacement.id, style: { fontFamily: 'Georgia', underline: false } });
    expect(() => parseRichText(next)).not.toThrow();
    replacement.name = 'External mutation'; expect(next.links![0].name).toBe('Replacement');
  });

  it('removes just selected link text and removes an entire identity without clearing chosen formatting', () => {
    const original = richFixture(), id = original.links![0].id;
    const partial = removeRichTextLinkRange(original, 3, 5);
    expect(linkedText(partial)).toBe('l|k|Again'); expect(partial.links).toEqual(original.links);
    expect(partial.paragraphs[0].runs.find(r => r.text === 'in')).toEqual({ text: 'in', style: { color: '#660000', fontStyle: 'italic' } });
    const removed = removeRichTextLink(partial, id); expect(removed).not.toHaveProperty('links'); expect(linkedText(removed)).toBe('');
    expect(richTextPlainText(removed)).toBe(richTextPlainText(original));
    expect(removed.paragraphs[1].runs[0].style).toEqual(original.paragraphs[1].runs[0].style);
    expect(original.links).toHaveLength(1); expect(() => parseRichText(removed)).not.toThrow();
  });

  it('updates a link graph independently of run IDs and formats, with explicit optional effect removal', () => {
    const original = richFixture(), item = original.links![0], interactions = structuredClone(item.interactions);
    interactions[0].actions[0].windowTarget = 'current'; interactions[0].actions[0].value = 'http://example.invalid/new';
    const updated = updateRichTextLink(original, item.id, { name: 'Revised', interactions, mouseOverStyle: undefined });
    expect(updated.paragraphs).toEqual(original.paragraphs); expect(updated.links![0]).toMatchObject({ id: item.id, name: 'Revised', interactions, mouseDownStyle: item.mouseDownStyle });
    expect(updated.links![0].mouseOverStyle).toBeUndefined(); expect(original.links![0].name).toBe('Details');
    interactions[0].name = 'External mutation'; expect(updated.links![0].interactions[0].name).toBe('Visit');
    expect(() => updateRichTextLink(original, 'missing', { name: 'No' })).toThrow('missing');
    expect(() => parseRichText(updated)).not.toThrow();
  });

  it('formatting and whole-widget style commands preserve graph identities and unselected formatting', () => {
    const original = richFixture(), formatted = formatRichTextRange(original, 3, 5, { fontStyle: 'normal', underline: true });
    expect(formatted.links).toEqual(original.links); expect(formatted.paragraphs[0].runs.find(r => r.text === 'in')).toMatchObject({ linkId: original.links![0].id, style: { fontStyle: 'normal', color: '#660000', underline: true } });
    const all = applyRichTextStyle(formatted, { fontWeight: 700, color: '#008800' });
    expect(all.links).toEqual(original.links); expect(linkedText(all)).toBe('l|in|k|Again'); expect(richTextPlainText(all)).toBe(richTextPlainText(original));
    expect(() => parseRichText(all)).not.toThrow();
  });

  it.each([0, 2, 6, 8])('collapsed caret at outer or plain offset %i does not grow a link', at => {
    const rich = richFixture(), next = replaceRichTextRange(rich, at, at, 'X');
    expect(richTextLinkAt(next, at)).toBeUndefined(); expect(linkedText(next)).toBe('link|Again');
  });

  it('collapsed caret inside the same link inherits across differently formatted adjacent runs', () => {
    const rich = richFixture(), id = rich.links![0].id;
    rich.paragraphs[0].runs.splice(1, 1, { text: 'li', linkId: id, style: { color: '#112233' } }, { text: 'nk', linkId: id, style: { fontWeight: 700 } });
    const next = replaceRichTextRange(rich, 4, 4, 'X'); expect(richTextLinkAt(next, 4)?.id).toBe(id); expect(linkedText(next)).toBe('li|Xnk|Again');
    expect(richTextPlainText(next)).toBe('A liXnk Z\nAgain'); expect(next.links).toEqual(rich.links);
  });

  it('replacement wholly inside one link inherits identity, including paragraph and soft breaks', () => {
    const rich = richFixture(), id = rich.links![0].id;
    const replacement = replaceRichTextRange(rich, 3, 5, 'X\nY');
    expect(richTextPlainText(replacement)).toBe('A lX\nYk Z\nAgain');
    expect(replacement.paragraphs[0].runs.at(-1)?.linkId).toBe(id); expect(replacement.paragraphs[1].runs[0].linkId).toBe(id);
    const soft = insertRichTextSoftBreak(rich, 4, 4); expect(soft.paragraphs).toHaveLength(2); expect(richTextLinkAt(soft, 4)?.id).toBe(id);
    expect(() => parseRichText(replacement)).not.toThrow(); expect(() => parseRichText(soft)).not.toThrow();
  });

  it.each(['unlinked', 'different-link'] as const)('replacement does not inherit merely equal endpoint IDs across an %s gap', gap => {
    const item = link(), other = link('Other');
    const rich: RichText = { links: gap === 'unlinked' ? [item] : [item, other], paragraphs: [{ runs: [{ text: 'ab', linkId: item.id }, { text: 'gap', ...(gap === 'different-link' ? { linkId: other.id } : {}) }, { text: 'cd', linkId: item.id }] }] };
    const next = replaceRichTextRange(rich, 1, 6, 'X');
    expect(richTextPlainText(next)).toBe('aXd'); expect(richTextLinkAt(next, 1)).toBeUndefined();
    expect(linkedText(next)).toBe('a|d'); expect(next.links).toEqual([item]);
  });

  it('plain setText preserves only the single linked span/single-line special case and prunes removed graphs', () => {
    const item = link(), widget = createWidget('text'); widget.richText = { links: [item], paragraphs: [{ runs: [{ text: 'sole', linkId: item.id, style: { fontStyle: 'italic' } }] }] }; widget.text = 'sole';
    const same = replaceWidgetText(widget, 'replacement'); expect(same.richText!.links).toEqual([item]); expect(same.richText!.paragraphs[0].runs[0].linkId).toBe(item.id);
    const multiline = replaceWidgetText(widget, 'first\nsecond'); expect(multiline.richText).not.toHaveProperty('links'); expect(linkedText(multiline.richText!)).toBe('');
    widget.richText = richFixture(); widget.text = richTextPlainText(widget.richText);
    const multiRun = replaceWidgetText(widget, 'plain'); expect(multiRun.richText).not.toHaveProperty('links'); expect(multiRun.richText!.paragraphs[0].runs[0].style).toEqual(widget.richText.paragraphs[0].runs[0].style);
  });

  it('rejects invalid selections and an empty link assignment without mutating the source', () => {
    const rich = richFixture(), snapshot = structuredClone(rich), item = link();
    for (const [start, end] of [[-1, 1], [2, 1], [0.5, 2], [0, 999]]) {
      expect(() => assignRichTextLink(rich, start, end, item)).toThrow();
      expect(() => removeRichTextLinkRange(rich, start, end)).toThrow();
      expect(() => replaceRichTextRange(rich, start, end, 'X')).toThrow();
    }
    expect(() => assignRichTextLink(rich, 3, 3, item)).toThrow('Select text'); expect(rich).toEqual(snapshot);
  });
});

describe('hyperlink graph identity through duplication and reusable components', () => {
  it('clones graph IDs and all internal action/condition references while leaving external pages, variables and URL text literal', () => {
    const original = fixture(), before = structuredClone(original.doc), source = original.doc.pages[0].widgets, copies = cloneWidgets(source, 35);
    assertInternalGraph(copies, original);
    const sourceIds = new Set(collectWidgetIdentifiers(source).keys()), copiedIds = [...collectWidgetIdentifiers(copies).keys()];
    expect(copiedIds).toHaveLength(sourceIds.size); expect(copiedIds.every(id => !sourceIds.has(id))).toBe(true);
    expect(copies[0].x).toBe(original.owner.x + 35); expect(copies[0].richText!.links![0].mouseOverStyle).toEqual(original.owner.richText!.links![0].mouseOverStyle);
    const next = structuredClone(original.doc); next.pages[0].widgets.push(...copies); expect(parseDocument(serializeDocument(next))).toEqual(next); expect(original.doc).toEqual(before);
  });

  it('keeps identities independent in nested panel/repeater template copies', () => {
    const original = fixture(), panel = createWidget('panel'), repeater = createWidget('repeater');
    repeater.repeater!.template = original.doc.pages[0].widgets; panel.states![0].widgets = [repeater];
    const [copy] = cloneWidgets([panel], 10), contents = copy.states![0].widgets[0].repeater!.template;
    assertInternalGraph(contents, original); expect(contents[0].x).toBe(original.owner.x);
    const next = structuredClone(original.doc); next.pages[0].widgets = [panel, copy]; expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('materializes definitions and two instances with distinct complete hyperlink identity maps', () => {
    const original = fixture(), component = createComponent(original.doc.pages[0].widgets, 'Linked card');
    const first = createComponentInstance(component, 300, 100), second = createComponentInstance(component, 700, 200);
    const definitionLink = component.widgets[0].richText!.links![0], originalLink = original.owner.richText!.links![0];
    expect(definitionLink.id).not.toBe(originalLink.id); assertInternalGraph(component.widgets, original);
    for (const instance of [first, second]) {
      assertInternalGraph(instance.states![0].widgets, original);
      const instanceLink = instance.states![0].widgets[0].richText!.links![0];
      expect(instance.componentInstance!.sourceIds[definitionLink.id]).toBe(instanceLink.id);
      expect(instance.componentInstance!.sourceIds[definitionLink.interactions[0].id]).toBe(instanceLink.interactions[0].id);
      expect(instance.componentInstance!.sourceIds[definitionLink.interactions[0].actions[0].id]).toBe(instanceLink.interactions[0].actions[0].id);
    }
    expect(first.states![0].widgets[0].richText!.links![0].id).not.toBe(second.states![0].widgets[0].richText!.links![0].id);
    original.doc.components = [component]; original.doc.pages[0].widgets.push(first, second); expect(parseDocument(serializeDocument(original.doc))).toEqual(original.doc);
  });

  it('publishes edited link content back to its definition and siblings without changing their stable IDs or unrelated widgets', () => {
    const original = fixture(), component = createComponent(original.doc.pages[0].widgets, 'Linked card');
    const first = createComponentInstance(component, 300, 100), second = createComponentInstance(component, 700, 200);
    original.doc.components = [component]; original.doc.pages[0].widgets.push(first, second);
    const local = first.states![0].widgets[0], firstLink = local.richText!.links![0], secondLink = second.states![0].widgets[0].richText!.links![0], sourceLink = component.widgets[0].richText!.links![0];
    local.richText = updateRichTextLink(local.richText!, firstLink.id, { name: 'Published', mouseDownStyle: { color: '#880000' } });
    const result = applyComponentInstanceChanges(original.doc, first.id), updatedFirst = result.pages[0].widgets.find(w => w.id === first.id)!, updatedSecond = result.pages[0].widgets.find(w => w.id === second.id)!;
    expect(result.components[0].widgets[0].richText!.links![0]).toMatchObject({ id: sourceLink.id, name: 'Published', mouseDownStyle: { color: '#880000' } });
    for (const [instance, oldLink] of [[updatedFirst, firstLink], [updatedSecond, secondLink]] as const) {
      expect(instance.states![0].widgets[0].richText!.links![0]).toMatchObject({ id: oldLink.id, name: 'Published' });
      assertInternalGraph(instance.states![0].widgets, original);
    }
    expect(result.pages[0].widgets[0]).toBe(original.owner); expect(result.pages[1]).toBe(original.doc.pages[1]);
    expect(parseDocument(serializeDocument(result))).toEqual(result);
  });

  it('propagates link removal from a definition and prunes obsolete instance ID mappings', () => {
    const original = fixture(), component = createComponent(original.doc.pages[0].widgets), instance = createComponentInstance(component);
    original.doc.components = [component]; original.doc.pages[0].widgets = [instance];
    const removedIds = [component.widgets[0].richText!.links![0].id, ...component.widgets[0].richText!.links![0].interactions.flatMap(i => [i.id, ...i.actions.map(a => a.id)])];
    const updated = structuredClone(component); updated.widgets[0].richText = removeRichTextLink(updated.widgets[0].richText!, removedIds[0]);
    const result: Document = updateComponent(original.doc, updated), next = result.pages[0].widgets[0];
    expect(next.states![0].widgets[0].richText).not.toHaveProperty('links');
    for (const id of removedIds) expect(next.componentInstance!.sourceIds).not.toHaveProperty(id);
    expect(next.id).toBe(instance.id); expect(next.states![0].widgets[0].id).toBe(instance.states![0].widgets[0].id);
    expect(parseDocument(serializeDocument(result))).toEqual(result);
  });

  it('publishes a newly authored link with new definition/sibling IDs but retains the publishing instance IDs', () => {
    const original = fixture(), component = createComponent(original.doc.pages[0].widgets), first = createComponentInstance(component), second = createComponentInstance(component, 600, 300);
    original.doc.components = [component]; original.doc.pages[0].widgets = [first, second];
    const [localOwner, localTarget] = first.states![0].widgets, added = link('New link');
    added.interactions[0].conditions = [{ source: 'widgetText', key: localTarget.id, operator: 'equals', value: `[[Widget.${localTarget.id}.text]]` }];
    added.interactions[0].actions = [{ id: uid(), type: 'setText', targetId: localTarget.id, value: `[[Widget.${localOwner.id}.text]]` }];
    localOwner.richText = assignRichTextLink(localOwner.richText!, 0, 1, added);
    // Unsynchronized new local IDs are a valid saveable authoring draft.
    expect(parseDocument(serializeDocument(original.doc))).toEqual(original.doc);
    const result = applyComponentInstanceChanges(original.doc, first.id), definition = result.components[0], [nextFirst, nextSecond] = result.pages[0].widgets;
    const source = definition.widgets[0].richText!.links!.find(item => item.name === 'New link')!;
    const own = nextFirst.states![0].widgets[0].richText!.links!.find(item => item.name === 'New link')!;
    const sibling = nextSecond.states![0].widgets[0].richText!.links!.find(item => item.name === 'New link')!;
    expect(own).toEqual(added); expect(new Set([source.id, own.id, sibling.id]).size).toBe(3);
    expect(nextFirst.componentInstance!.sourceIds[source.id]).toBe(added.id);
    expect(nextSecond.componentInstance!.sourceIds[source.id]).toBe(sibling.id);
    for (const [widgets, item] of [[definition.widgets, source], [nextSecond.states![0].widgets, sibling]] as const) {
      expect(widgets[0].richText!.paragraphs[0].runs[0].linkId).toBe(item.id);
      expect(item.interactions[0].conditions[0]).toEqual({ source: 'widgetText', key: widgets[1].id, operator: 'equals', value: `[[Widget.${widgets[1].id}.text]]` });
      expect(item.interactions[0].actions[0]).toMatchObject({ type: 'setText', targetId: widgets[1].id, value: `[[Widget.${widgets[0].id}.text]]` });
      expect(item.interactions[0].id).not.toBe(added.interactions[0].id);
      expect(item.interactions[0].actions[0].id).not.toBe(added.interactions[0].actions[0].id);
    }
    expect(parseDocument(serializeDocument(result))).toEqual(result);
  });
});
