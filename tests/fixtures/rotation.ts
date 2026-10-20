import { createDocument, createPage, createWidget } from '../../src/model/document';
import type { Widget, WidgetType } from '../../src/model/types';

/** Independent authored examples. Positions and styling are not Axure defaults. */
export function rotationFixture() {
  const doc = createDocument(); doc.name = 'Rotation — geometry and interaction'; doc.caseSelection = 'never';
  const page = doc.pages[0]; Object.assign(page, { id: 'rotation-page', name: 'Rotation studio', width: 1120, height: 1080, background: '#f4f7fc' });
  const make = (id: string, type: WidgetType, text: string, x: number, y: number, width: number, height: number, rotation = 0): Widget =>
    Object.assign(createWidget(type, x, y), { id, name: text || id, text, width, height, rotation });
  const label = (id: string, text: string, x: number, y: number, width = 1040, height = 42) => {
    const w = make(id, 'text', text, x, y, width, height);
    Object.assign(w.style, { fill: 'transparent', strokeWidth: 0, fontSize: 17, color: '#324b70', textAlign: 'left' }); return w;
  };
  const title = label('rotation-title', 'Rotation, local geometry and live controls', 40, 15, 1040, 45);
  title.style.fontSize = 28; title.style.fontWeight = 700;
  page.widgets = [title, label('rotation-description', 'Each shape turns around its centre; its stored width and height stay local.', 40, 70, 1040, 28)];
  [0, 45, 90, 180, 270, -30].forEach((angle, i) => {
    const x = 95 + i % 3 * 350, y = 200 + Math.floor(i / 3) * 235;
    const w = make(`rotation-box-${angle}`, 'box', `${angle}°`, x, y, 180, 70, angle);
    Object.assign(w.style, { fill: '#dbe7fb', stroke: '#315f9f', strokeWidth: 3, radius: 12, color: '#27456d', fontSize: 24 });
    page.widgets.push(label(`rotation-label-${i}`, `Local size 180 × 70 · ${angle}°`, x - 35, y - 90, 280, 24), w);
  });
  const line = make('rotation-arrow', 'line', '', 115, 697, 200, 32, 35);
  Object.assign(line.style, { fill: 'transparent', strokeWidth: 5, linePattern: 'dash-dot', lineEnds: { start: 'hollow-circle', end: 'filled-triangle' }, strokeGradient: { type: 'linear', start: { x: 0, y: .5 }, end: { x: 1, y: .5 }, stops: [{ offset: 0, color: '#2061db' }, { offset: 1, color: '#e76554' }] } });
  const curve = make('rotation-curve', 'path', '', 480, 658, 200, 104, -25);
  curve.vectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0, y: .8 }, { op: 'C', x1: .15, y1: -.1, x2: .8, y2: 1.1, x: 1, y: .2 }] };
  Object.assign(curve.style, { fill: 'transparent', stroke: '#7859b8', strokeWidth: 5, lineEnds: { start: 'none', end: 'large-filled-triangle' } });
  const input = make('rotation-input', 'input', 'Type into this rotated input', 800, 680, 240, 50, 15);
  Object.assign(input.style, { stroke: '#5c799f', strokeWidth: 2, fill: '#ffffff' });
  page.widgets.push(label('rotation-arrow-label', 'Dash + gradient + endpoints', 80, 592, 290), line, label('rotation-curve-label', 'Stored cubic control points', 425, 592, 290), curve, label('rotation-input-label', 'An editable live form control', 775, 592, 300), input);
  const result = label('rotation-result', 'Click the tilted button', 460, 900, 500, 65);
  const button = make('rotation-button', 'button', 'Click while rotated', 90, 895, 260, 55, -12);
  button.interactions = [{ id: 'rotation-click-event', event: 'click', name: 'Rotated pointer target', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'rotation-set-text', type: 'setText', targetId: result.id, value: 'The rotated click reached its target.' }] }];
  page.widgets.push(button, result);

  const nested = createPage('Nested rotation'); Object.assign(nested, { id: 'rotation-nested-page', width: 1120, height: 880, background: page.background });
  const panel = make('rotation-panel', 'panel', '', 170, 260, 620, 340, 20);
  Object.assign(panel.style, { fill: '#e4ebf7', stroke: '#426999', strokeWidth: 3 }); panel.fitToContent = false;
  const child = make('rotation-child', 'box', 'Child −35° / parent +20°', 80, 100, 360, 75, -35);
  Object.assign(child.style, { fill: '#ffffff', stroke: '#426999', strokeWidth: 3, fontSize: 19 });
  panel.states = [{ id: 'rotation-panel-state', name: 'State 1', widgets: [child] }]; panel.activeStateId = 'rotation-panel-state';
  nested.widgets = [label('rotation-nested-title', 'A child keeps its own local angle inside a rotated parent.', 40, 45), panel]; doc.pages.push(nested);
  const embedded = createPage('Embedded rotation'); Object.assign(embedded, { id: 'rotation-frame-page', width: 1160, height: 1130 });
  const frame = make('rotation-frame', 'inlineFrame', '', 10, 10, 1130, 1100); frame.inlineFrame!.target = { kind: 'page', pageId: page.id };
  embedded.widgets = [frame]; doc.pages.push(embedded); return doc;
}
