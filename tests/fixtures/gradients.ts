import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { GradientFill, Widget, WidgetType } from '../../src/model/types';

/** Independent example content. Geometry and colors are demonstrations, not native presets. */
export function gradientFixture() {
  const doc = createDocument(); doc.name = 'Gradients — points, axes and color stops'; doc.caseSelection = 'never';
  const page = doc.pages[0]; page.id = 'gradient-page'; page.name = 'Gradient studio'; page.width = 1100; page.height = 850; page.background = '#f5f7fc';
  const linear: GradientFill = { type: 'linear', start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 }, stops: [{ offset: 0, color: '#2668ec' }, { offset: 0.45, color: '#8057d8' }, { offset: 1, color: '#f29cab' }] };
  const radial: GradientFill = { type: 'radial', center: { x: 0.4, y: 0.5 }, axis1: { x: 0.8, y: 0.8 }, axis2: { x: 0.2, y: 0.85 }, stops: [{ offset: 0, color: '#fff2b0' }, { offset: 0.5, color: '#fbb96b' }, { offset: 1, color: '#ef6b92' }] };
  const widget = (id: string, type: WidgetType, name: string, x: number, y: number, width: number, height: number): Widget => {
    const w = createWidget(type, x, y); Object.assign(w, { id, name, text: name, width, height }); return w;
  };
  const heading = widget('gradient-heading', 'text', 'Color follows points and axes', 40, 25, 960, 55); Object.assign(heading.style, { fontSize: 30, fontWeight: 700, color: '#172744', textPadding: [0, 0, 0, 0] });
  const subtitle = widget('gradient-subtitle', 'text', 'Linear and radial fills, ordered stops, transparent colors, and independent repeated instances.', 40, 85, 990, 45); Object.assign(subtitle.style, { color: '#536785', fontSize: 16 });
  const card = widget('gradient-linear', 'box', 'Linear fill', 45, 150, 305, 155); Object.assign(card.style, { fill: '#ffffff', fillGradient: structuredClone(linear), color: '#ffffff', radius: 18, strokeWidth: 0, fontSize: 24, fontWeight: 600 });
  const ellipse = widget('gradient-radial', 'ellipse', 'Two radial axes', 390, 145, 305, 170); Object.assign(ellipse.style, { fillGradient: structuredClone(radial), color: '#5e2242', strokeWidth: 0, fontSize: 23, fontWeight: 600 });
  const hard = widget('gradient-hard', 'box', 'Hard transition', 735, 150, 315, 155); Object.assign(hard.style, { fillGradient: { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, stops: [{ offset: 0, color: '#125065' }, { offset: 0.5, color: '#125065' }, { offset: 0.5, color: '#4b9b91' }, { offset: 1, color: '#4b9b91' }] } satisfies GradientFill, color: '#ffffff', radius: 18, strokeWidth: 0, fontSize: 22 });
  const vector = widget('gradient-vector', 'path', 'Path fill', 60, 355, 270, 175); vector.vectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0.5, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] };
  Object.assign(vector.style, { fillGradient: structuredClone(linear), stroke: '#254780', strokeWidth: 2, color: 'white', fontWeight: 600, outerShadow: { on: true, offsetX: 5, offsetY: 7, blurRadius: 4, color: '#24395840' } });
  const transparent = widget('gradient-transparent', 'box', 'Transparent stops', 390, 370, 305, 145); Object.assign(transparent.style, { fill: '#ff00ff', fillGradient: { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#4e6fde00' }, { offset: 1, color: '#4e6fdeff' }] } satisfies GradientFill, strokeWidth: 0, radius: 12, color: '#183365', fontSize: 21 });
  const parent = widget('gradient-parent', 'panel', 'Gradient panel', 735, 365, 315, 160); Object.assign(parent.style, { fillGradient: structuredClone(radial), radius: 18 });
  const child = widget('gradient-child', 'box', 'Independent child fill', 24, 47, 267, 65); Object.assign(child.style, { fill: '#ffffff', radius: 10, strokeWidth: 0, fontSize: 19 }); parent.states![0].widgets = [child];
  const row = widget('gradient-row', 'path', 'Row [[Item.Name]]', 10, 4, 265, 46); row.vectorPath = { fillRule: 'nonzero', commands: [{ op: 'M', x: 0.08, y: 0 }, { op: 'L', x: 1, y: 0 }, { op: 'L', x: 0.92, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' }] }; Object.assign(row.style, { fillGradient: structuredClone(linear), color: 'white', strokeWidth: 0, fontSize: 19 });
  const repeater = widget('gradient-repeater', 'repeater', 'Gradient rows', 45, 600, 285, 125); repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [row], itemHeight: 58, itemWidth: 285, layout: 'vertical', gap: 4, fitToContent: false };
  const subjects = [card, ellipse, hard, vector, transparent, parent, row];
  const control = (id: string, name: string, x: number, restore: boolean) => {
    const w = widget(id, 'button', name, x, 600, 260, 48); w.interactions = [{ id: uid(), name, event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: subjects.map(subject => ({ id: uid(), type: 'setStyle' as const, targetId: subject.id, style: restore ? { fillGradient: structuredClone(subject.style.fillGradient!) } : { fill: '#d9e2f2' } })) }]; return w;
  };
  const note = widget('gradient-note', 'text', 'Switch to a solid fill, then restore the saved gradient. Painting never changes the stored geometry.', 390, 675, 650, 68); Object.assign(note.style, { fontSize: 18, color: '#536785' });
  page.widgets = [heading, subtitle, card, ellipse, hard, vector, transparent, parent, repeater, control('gradient-solid', 'Switch to solid fills', 390, false), control('gradient-restore', 'Restore gradients', 735, true), note];
  const embedded = createPage('Embedded comparison'); embedded.id = 'gradient-frame-page'; embedded.width = 1180; embedded.height = 910;
  const frame = widget('gradient-frame', 'inlineFrame', 'Gradient frame', 15, 15, 1140, 870); frame.text = ''; frame.inlineFrame!.target = { kind: 'page', pageId: page.id }; embedded.widgets = [frame]; doc.pages.push(embedded);
  return doc;
}
