import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { Action, InnerShadowStyle, ShadowStyle, Widget, WidgetType } from '../../src/model/types';

/** Original demonstration content. Values are deliberate contrast probes, not native presets. */
export function shadowFixture() {
  const doc = createDocument(); doc.name = 'Shadows — shape, surface and text'; doc.caseSelection = 'never';
  const page = doc.pages[0]; page.id = 'shadow-page'; page.name = 'Shadow studio'; page.width = 1100; page.height = 850; page.background = '#f5f7fc';
  const outer: ShadowStyle = { on: true, offsetX: 8, offsetY: 9, blurRadius: 6, color: 'rgba(36,60,120,0.4)' };
  const inner: InnerShadowStyle = { on: true, offsetX: 5, offsetY: 4, blurRadius: 7, color: 'rgba(80,37,153,0.65)', spread: 3 };
  const text: ShadowStyle = { on: true, offsetX: 2, offsetY: 3, blurRadius: 1, color: 'rgba(78,70,184,0.55)' };
  const widget = (id: string, type: WidgetType, name: string, x: number, y: number, width: number, height: number): Widget => {
    const w = createWidget(type, x, y); Object.assign(w, { id, name, text: name, width, height }); return w;
  };
  const heading = widget('shadow-heading', 'text', 'Three independent kinds of shadow', 40, 25, 950, 52); Object.assign(heading.style, { fontSize: 28, fontWeight: 700, color: '#172744', textPadding: [0, 0, 0, 0] });
  const subtitle = widget('shadow-subtitle', 'text', 'Change the light without changing the layout. Hover the card; switch all shadows off and back on.', 40, 80, 960, 34); subtitle.style.color = '#536785';
  const card = widget('shadow-card', 'box', 'Surface shadow', 45, 145, 250, 115); Object.assign(card.style, { fill: '#ffffff', stroke: '#b9c8e3', radius: 14, fontSize: 21, fontWeight: 600, outerShadow: { ...outer } });
  card.mouseOverStyle = { outerShadow: { ...outer, offsetX: -8, offsetY: 12, blurRadius: 14 } };
  const inset = widget('shadow-inset', 'box', 'Inset surface', 350, 145, 250, 115); Object.assign(inset.style, { fill: '#eee7ff', strokeWidth: 0, radius: 18, innerShadow: { ...inner }, fontSize: 21 });
  const lettering = widget('shadow-lettering', 'text', 'Text stays text', 655, 150, 350, 100); Object.assign(lettering.style, { fontSize: 34, fontWeight: 700, color: '#283d72', textShadow: { ...text }, verticalAlign: 'middle' });
  const vector = widget('shadow-vector', 'path', 'Path shadow', 75, 315, 200, 135);
  vector.vectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0.5, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] };
  Object.assign(vector.style, { fill: '#79d6be', stroke: '#197d65', strokeWidth: 2, outerShadow: { ...outer, offsetX: -7 }, innerShadow: { ...inner, color: 'rgba(0,80,60,0.6)', spread: 1 }, fontWeight: 600 });
  const input = widget('shadow-input', 'input', 'Editable text', 350, 320, 250, 56); Object.assign(input.style, { outerShadow: { ...outer, offsetY: 5 }, textShadow: { ...text }, fontSize: 19 });
  input.focusedStyle = { textShadow: { ...text, on: false }, outerShadow: { ...outer, color: '#7955dd80' } };
  const parent = widget('shadow-parent', 'panel', 'Shadowed container', 655, 310, 350, 150); Object.assign(parent.style, { fill: '#ffffff', radius: 8, outerShadow: { ...outer }, textShadow: { ...text } });
  const child = widget('shadow-child', 'text', 'Independent child — no text shadow', 12, 20, 326, 45); child.style.fontSize = 17;
  parent.states![0].widgets = [child];
  const row = widget('shadow-row', 'box', 'Row [[Item.Name]]', 10, 10, 270, 42); Object.assign(row.style, { fill: '#e4edff', outerShadow: { ...outer, offsetX: 3, offsetY: 3, blurRadius: 3 }, textShadow: { ...text, blurRadius: 0 } });
  const repeater = widget('shadow-repeater', 'repeater', 'Independent rows', 45, 520, 300, 140); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [row], itemHeight: 62, itemWidth: 290, layout: 'vertical', gap: 4, fitToContent: false };
  const subjects = [card, inset, lettering, vector, input, parent, row];
  const actions = (on: boolean): Omit<Action, 'id'>[] => subjects.flatMap(w => ['outerShadow', 'innerShadow', 'textShadow'].flatMap(field => {
    const key = field as 'outerShadow' | 'innerShadow' | 'textShadow', value = w.style[key];
    return value ? [{ type: 'setStyle' as const, targetId: w.id, style: { [key]: { ...value, on } } }] : [];
  }));
  const control = (id: string, name: string, x: number, on: boolean) => {
    const button = widget(id, 'button', name, x, 525, 200, 44); button.interactions = [{ id: uid(), name, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions(on).map(a => ({ ...a, id: uid() })) }]; return button;
  };
  const note = widget('shadow-note', 'text', 'Outer shadows follow the surface. Inner shadows stay inside. Text shadows are local to each widget.', 385, 615, 580, 70); Object.assign(note.style, { color: '#536785', fontSize: 18 });
  page.widgets = [heading, subtitle, card, inset, lettering, vector, input, parent, repeater, control('shadow-off', 'Switch shadows off', 390, false), control('shadow-on', 'Restore shadows', 640, true), note];
  const embedded = createPage('Embedded comparison'); embedded.id = 'shadow-frame-page'; embedded.width = 1180; embedded.height = 910;
  const frame = widget('shadow-frame', 'inlineFrame', 'Shadow frame', 15, 15, 1140, 870); frame.text = ''; frame.inlineFrame!.target = { kind: 'page', pageId: page.id }; embedded.widgets = [frame]; doc.pages.push(embedded);
  return doc;
}
