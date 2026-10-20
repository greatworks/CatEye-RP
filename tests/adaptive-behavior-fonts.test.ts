import { expect, it } from 'vitest';
import { createDocument, createWidget } from '../src/model/document';
import { documentUsesRoboto, documentUsesOpenSans } from '../src/runtime/embedded-fonts';

it.each(['page', 'shared', 'inactive'])('keeps fonts used only by %s adaptive state effects in offline output', storage => {
  const doc = createDocument(), page = doc.pages[0], widget = createWidget('box'); page.widgets = [widget];
  const override = { stateStyles: { mouseOver: { fontFamily: 'Roboto' }, disabled: { fontFamily: 'Open Sans' } } };
  if (storage === 'page') page.adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [widget.id]: override } }];
  else {
    if (storage === 'shared') { doc.adaptiveViewSets = [{ id: 'set', name: 'Set', baseSize: { width: 0, height: 0 }, views: [{ id: 'phone', name: 'Phone', width: 390 }] }]; page.adaptiveViewSetId = 'set'; }
    page.adaptiveOverrides = { phone: { [widget.id]: override } };
  }
  const before = JSON.stringify(doc); expect(documentUsesRoboto(doc)).toBe(true); expect(documentUsesOpenSans(doc)).toBe(true); expect(JSON.stringify(doc)).toBe(before);
});
