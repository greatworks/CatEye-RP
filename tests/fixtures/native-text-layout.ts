import { createDocument, createPage, createWidget } from '../../src/model/document';
import { richTextPlainText } from '../../src/model/rich-text';

export function nativeTextLayoutFixture() {
  const doc = createDocument(); doc.id = 'native-text-layout'; doc.name = 'Independent shape text'; doc.caseSelection = 'never';
  const page = doc.pages[0]; Object.assign(page, { id: 'native-layout-matrix', name: 'Layout matrix', width: 1460, height: 950, background: '#ffffff' });
  for (const [column, flags] of [[false, false], [false, true], [true, false], [true, true]].entries()) {
    for (const [row, verticalAlign] of (['top', 'middle', 'bottom'] as const).entries()) {
      const widget = createWidget('box', 35 + column * 350, 45 + row * 200);
      Object.assign(widget, { id: `native-layout-${column}-${row}`, name: `Layout ${column} ${verticalAlign}`, width: 180, height: 90,
        text: 'Longwordwithoutbreaks short', shapeText: { autoFitWidth: flags[0], autoFitHeight: flags[1] } });
      Object.assign(widget.style, { fontFamily: 'Roboto', fontSize: 24, fontWeight: 400, lineHeight: 1.5,
        fill: 'transparent', strokeWidth: 0, textPadding: [7, 13, 17, 23], textAlign: 'left', verticalAlign });
      page.widgets.push(widget);
    }
  }
  const rich = createWidget('box', 35, 665);
  Object.assign(rich, { id: 'native-layout-breaks', name: 'Explicit native breaks', width: 180, height: 32,
    shapeText: { autoFitWidth: true, autoFitHeight: false },
    richText: { paragraphs: [{ runs: [{ text: '<br> A\nB\nC\u2028D\nE', style: { fontWeight: 700 } }] }, { runs: [{ text: 'Next paragraph', style: { fontStyle: 'italic' } }] }] } });
  rich.text = richTextPlainText(rich.richText!);
  Object.assign(rich.style, { fontFamily: 'Roboto', fontSize: 18, lineHeight: 1.5, fill: 'transparent', strokeWidth: 0, textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0] });
  const legacy = structuredClone(rich); legacy.id = 'native-layout-legacy'; legacy.name = 'Legacy independent control'; legacy.x = 500;
  delete legacy.shapeText; delete legacy.richText; legacy.text = 'Longwordwithoutbreaks short';
  page.widgets.push(rich, legacy);
  const natural = structuredClone(legacy); Object.assign(natural, { id: 'native-layout-natural', name: 'Natural line height', text: 'Natural line height', x: 750, y: 800, height: 20, shapeText: { autoFitWidth: true, autoFitHeight: false } });
  natural.style.fontSize = 24; delete natural.style.lineHeight; page.widgets.push(natural);
  const change = createWidget('button', 1030, 680); Object.assign(change, { id: 'native-layout-change', name: 'Change text style', text: 'Change text style', width: 180, height: 40 });
  change.interactions = [{ id: 'layout-case', name: 'Change text layout', enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: [{ id: 'layout-action', type: 'setStyle', targetId: page.widgets[0].id, style: { verticalAlign: 'bottom', textPadding: [2, 4, 6, 8], fontSize: 30 } }] }];
  page.widgets.push(change);
  const framed = createPage('Embedded layout'); Object.assign(framed, { id: 'native-layout-framed', width: 1460, height: 1050 });
  const frame = createWidget('inlineFrame', 10, 10); Object.assign(frame, { id: 'native-layout-frame', name: 'Embedded layout', width: 1430, height: 1000 });
  frame.inlineFrame!.target = { kind: 'page', pageId: page.id }; frame.inlineFrame!.hideBorders = true; framed.widgets.push(frame); doc.pages.push(framed);
  return doc;
}
