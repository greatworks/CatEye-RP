import { createDocument, createPage, createWidget } from '../../src/model/document';
import type { Action, EventType, Interaction, MoveTargetSpec, ResizeTargetSpec, Widget } from '../../src/model/types';

export const moveSpec = (id: string, patch: Partial<MoveTargetSpec> = {}): MoveTargetSpec => ({ target: { kind: 'widget', id }, mode: 'delta', x: { text: '40' }, y: { text: '20' }, trajectory: 'straight', easing: 'none', duration: 500, ...patch });
export const resizeSpec = (id: string, patch: Partial<ResizeTargetSpec> = {}): ResizeTargetSpec => ({ target: { kind: 'widget', id }, width: { text: '300' }, height: { text: '160' }, anchor: 'top left', easing: 'none', duration: 500, ...patch });
export const motionEvent = (id: string, event: EventType, actions: Omit<Action, 'id'>[]): Interaction => ({ id: `${id}-${event}`, name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map((action, index) => ({ id: `${id}-${event}-${index}`, ...action })) });
const shape = (id: string, text: string, x: number, y: number, width: number, height: number, type: Widget['type'] = 'box') => {
  const widget = createWidget(type, x, y); Object.assign(widget, { id, name: text, text, width, height }); return widget;
};
const label = (id: string, text: string, x: number, y: number, width = 1000, size = 14) => {
  const widget = shape(id, text, x, y, width, 34, 'text'); Object.assign(widget.style, { color: '#334155', textAlign: 'left', fontSize: size }); return widget;
};
const button = (id: string, text: string, x: number, y: number, actions: Omit<Action, 'id'>[]) => {
  const widget = shape(id, text, x, y, 210, 38, 'button'); widget.interactions = [motionEvent(id, 'click', actions)]; return widget;
};
const draggable = (id: string, text: string, x: number, y: number, statusId?: string) => {
  const widget = shape(id, text, x, y, 140, 56); Object.assign(widget.style, { fill: '#0f766e', color: '#ffffff', stroke: '#115e59', radius: 8 });
  widget.interactions = [motionEvent(id, 'drag', [{ type: 'move', move: { targets: [moveSpec(id, { target: { kind: 'this' }, mode: 'drag' })] } }])];
  if (statusId) widget.interactions.push(motionEvent(id, 'dragDrop', [{ type: 'setText', targetId: statusId, value: 'Dropped [[DragX]],[[TotalDragX]]' }]), motionEvent(id, 'click', [{ type: 'setText', targetId: statusId, value: 'Clicked' }]));
  return widget;
};

/** Independently authored fixture: contains no extracted Axure script or asset. */
export function runtimeTransformFixture() {
  const doc = createDocument(); Object.assign(doc, { id: 'transform-demo', name: 'Motion · timing, local widgets and drag', caseSelection: 'never' });
  const page = doc.pages[0]; Object.assign(page, { id: 'transform-home', name: 'Motion lab', width: 1120, height: 860, background: '#f5f7fb' });
  const combined = shape('transform-combined', 'MOVE + SIZE + ROTATE', 100, 170, 200, 100); Object.assign(combined.style, { fill: '#2563eb', color: '#fff', stroke: '#1d4ed8', radius: 8 });
  const first = shape('transform-first', 'FIRST', 600, 160, 100, 50), second = shape('transform-second', 'SECOND', 820, 160, 100, 50);
  const ordered = button('transform-ordered', 'Move ordered targets', 600, 250, [{ type: 'move', move: { targets: [moveSpec(first.id, { mode: 'location', x: { text: '[[Track.x + 10]]', bindings: { track: { kind: 'widget', targetId: second.id } } }, y: { text: '225' } }), moveSpec(second.id, { x: { text: '-20' }, y: { text: '' } })] } }]);
  const repeater = shape('transform-repeater', '', 48, 520, 620, 190, 'repeater');
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First row' }, { Name: 'Second row' }], itemHeight: 92, gap: 2, template: [draggable('transform-row-drag', '[[Item.Name]]', 14, 12), label('transform-row-note', 'Drag this row independently', 210, 22, 320)] };
  const child = createPage('Embedded motion'); Object.assign(child, { id: 'transform-child', width: 310, height: 230 }); child.widgets = [label('transform-child-title', 'Independent frame', 20, 12, 270), draggable('transform-child-drag', 'DRAG IN FRAME', 30, 70)];
  const frame = shape('transform-frame', '', 760, 520, 312, 232, 'inlineFrame'); frame.inlineFrame!.target = { kind: 'page', pageId: child.id };
  page.widgets = [label('transform-title', 'Motion lab', 48, 25, 1000, 30), label('transform-intro', 'Combined animation, ordered local targets and independent drag instances.', 48, 76),
    combined, first, second, ordered,
    button('transform-combine', 'Move · size · rotate', 48, 430, [
      { type: 'move', move: { targets: [moveSpec(combined.id, { easing: 'linear', duration: 240 })] } },
      { type: 'resize', resize: { targets: [resizeSpec(combined.id, { easing: 'linear', duration: 420 })] } },
      { type: 'rotate', targetId: combined.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 600 } },
    ]),
    draggable('transform-drag', 'DRAG ME', 600, 360, 'transform-drag-status'), label('transform-drag-status', 'Ready', 800, 370, 280),
    label('transform-repeater-title', 'REPEATER · INDEPENDENT ROWS', 48, 475, 600, 12), repeater, frame,
    label('transform-footer', 'Restart the prototype to restore all positions, sizes and angles.', 48, 795),
  ]; doc.pages.push(child); return doc;
}
