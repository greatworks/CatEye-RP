import { expect } from '@playwright/test';

// Independent authored fixture. Original-function evidence lives in research;
// this scenario verifies our editor/player integration, not the native GUI.
export function adaptiveBehaviorFixture() {
  const style = { fill: '#ffffff', stroke: '#667788', strokeWidth: 1, radius: 0, color: '#123456', fontSize: 16, fontFamily: 'Arial', fontWeight: 400, textAlign: 'left', opacity: 1, textPadding: [4, 6, 4, 6], verticalAlign: 'top' };
  const widget = (id, type, x, y, text = id, extra = {}) => ({ id, type, name: id, text, x, y, width: 180, height: 42, rotation: 0, style: { ...style }, hidden: false, locked: false, disabled: false, notes: '', interactions: [], ...extra });
  const interaction = (id, event, actions, extra = {}) => ({ id: `${id}-case`, name: id, event, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map((action, i) => ({ id: `${id}-action-${i}`, ...action })), ...extra });
  const set = (key, value) => ({ type: 'setVariable', targetId: key, value });
  const append = text => set('Trace', `[[concat(Trace,'${text}')]]`);
  const button = (id, x, y, text, actions) => widget(id, 'button', x, y, text, { width: 112, height: 34, style: { ...style, fill: '#e6edf5', textAlign: 'center' }, interactions: [interaction(id, 'click', actions)] });
  const selector = (id, x, y, title, target) => ({ ...button(id, x, y, title, []), interactions: [
    interaction(`${id}-first`, 'click', [append(`${title}:before|`), { type: 'setAdaptiveView', adaptiveView: target }, append('BAD-successor|')], { isNewIfGroup: true }),
    interaction(`${id}-else`, 'click', [append('BAD-else|')], { isNewIfGroup: false }),
    interaction(`${id}-independent`, 'click', [append(`${title}:after|`)], { isNewIfGroup: true }),
  ] });
  const page = (id, name, widgets) => ({ id, name, width: 1200, height: 760, background: '#f7f9fc', notes: '', interactions: [interaction(`${id}-changed`, 'adaptiveViewChange', [set('Changes', '[[number(Changes)+1]]')])], adaptiveViews: [], adaptiveViewSetId: 'ab-set', widgets });
  const marker = widget('ab-marker', 'box', 20, 132, 'Authored marker', { height: 54, selected: true, selectedStyle: { fill: '#228855' } });
  const input = widget('ab-focus', 'input', 20, 220, '', { width: 240, focusedStyle: { stroke: '#0000ff' } });
  const main = page('ab-main', 'Shared set · first page', [
    widget('ab-heading', 'text', 20, 12, 'Adaptive behavior', { width: 340, style: { ...style, fill: 'transparent', strokeWidth: 0, fontSize: 26, fontWeight: 700 } }),
    selector('ab-child', 20, 70, 'Child', { kind: 'view', viewId: 'ab-child-view' }),
    selector('ab-base', 140, 70, 'Base', { kind: 'base' }), selector('ab-auto', 260, 70, 'Auto', { kind: 'auto' }), marker, input,
    button('ab-mutate', 20, 280, 'Mutate', [{ type: 'resize', targetId: marker.id, x: 300, y: 54 }, { type: 'setStyle', targetId: marker.id, style: { opacity: 0.4 } }, { type: 'setText', targetId: marker.id, value: 'Runtime marker' }]),
    button('ab-second', 140, 280, 'Second page', [{ type: 'openPage', targetId: 'ab-second-page' }]),
    button('ab-frames', 260, 280, 'Frame page', [{ type: 'openPage', targetId: 'ab-frame-page' }]),
    widget('ab-trace', 'text', 20, 340, '[[Trace]]', { width: 350, height: 150, style: { ...style, fontSize: 12, strokeWidth: 0 } }),
    widget('ab-changes', 'text', 20, 510, 'Changes: [[Changes]]', { width: 320, style: { ...style, strokeWidth: 0 } }),
    widget('ab-note', 'text', 20, 580, 'Child has an empty state map. The focused input still suppresses hover because its ancestor declares Focused.', { width: 350, height: 100, style: { ...style, fontSize: 14, strokeWidth: 0, fill: 'transparent' } }),
  ]);
  main.adaptiveOverrides = {
    'ab-parent-view': { [marker.id]: { width: 210, style: { color: '#13579b' }, stateStyles: { selected: { fill: '#ff9900' } } }, [input.id]: { stateStyles: { focused: {}, mouseOver: { fill: '#ff0000' } } } },
    'ab-child-view': { [marker.id]: { width: 240, stateStyles: {} }, [input.id]: { stateStyles: { mouseOver: { fill: '#00aa55' } } } },
  };
  const secondMarker = widget('ab-second-marker', 'box', 20, 132, 'Second page state', { selected: true, selectedStyle: { fill: '#8844aa' } });
  const second = page('ab-second-page', 'Shared set · second page', [
    selector('ab-second-child', 20, 70, 'Child', { kind: 'view', viewId: 'ab-child-view' }),
    button('ab-back', 140, 70, 'First page', [{ type: 'openPage', targetId: main.id }]), secondMarker,
  ]);
  second.adaptiveOverrides = {
    'ab-parent-view': { [secondMarker.id]: { width: 210, stateStyles: { selected: { fill: '#ffff00' } } } },
    'ab-child-view': { [secondMarker.id]: { width: 240, stateStyles: { selected: { fill: '#3366ff' } } } },
  };
  const frame = widget('ab-frame', 'inlineFrame', 20, 110, '', { width: 390, height: 680, inlineFrame: { hideBorders: true, scrolling: 'auto', preview: { kind: 'none' }, target: { kind: 'page', pageId: main.id } } });
  const frames = { id: 'ab-frame-page', name: 'Independent embedded session', width: 1200, height: 850, background: '#f7f9fc', notes: '', interactions: [], adaptiveViews: [], widgets: [
    button('ab-frame-reload', 20, 20, 'Reload frame', [{ type: 'openLinkInFrame', frameScope: 'widget', targetId: frame.id, frameTarget: { kind: 'page', pageId: main.id } }]),
    widget('ab-outer-trace', 'text', 20, 60, '[[Trace]]', { width: 1100, height: 40, style: { ...style, fontSize: 12 } }), frame,
  ] };
  return { format: 'rea-prototype', version: 1, id: 'ab-document', name: 'Adaptive behavior runtime', caseSelection: 'never', pages: [main, second, frames], components: [], styles: [], variables: { Trace: '', Changes: '0' }, adaptiveViewSets: [
    { id: 'ab-set', name: 'Shared responsive set', baseSize: { width: 1200, height: 0 }, views: [
      { id: 'ab-parent-view', name: 'Parent', width: 390, height: 0 },
      { id: 'ab-child-view', name: 'Child', width: 768, height: 0, baseViewId: 'ab-parent-view' },
    ] },
  ] };
}

export const adaptiveBehaviorWidget = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);

/** Host adapters retain real pointer actions, including hidden Electron sync. */
export async function exerciseAdaptiveBehavior(scope, host) {
  const w = id => adaptiveBehaviorWidget(scope, id), click = host.click ?? (locator => locator.click());
  let trace = '';
  const select = async (id, title) => { await click(w(id)); trace += `${title}:before|${title}:after|`; await expect(w('ab-trace')).toHaveText(trace); };
  const color = (id, rgb) => expect(w(id)).toHaveCSS('background-color', rgb);
  const mode = target => expect(host.selection ?? scope.getByRole('combobox', { name: 'Adaptive view', exact: true })).toHaveValue(JSON.stringify(target));
  await mode({ kind: 'auto' }); await color('ab-marker', 'rgb(34, 136, 85)'); await expect(w('ab-changes')).toHaveText('Changes: 0');
  await select('ab-child', 'Child'); await mode({ kind: 'view', viewId: 'ab-child-view' });
  await color('ab-marker', 'rgb(255, 255, 255)'); await expect(w('ab-marker')).toHaveCSS('width', '240px'); await expect(w('ab-marker')).toHaveCSS('color', 'rgb(19, 87, 155)');
  await expect(w('ab-changes')).toHaveText('Changes: 1');
  await host.hover(w('ab-focus')); await color('ab-focus', 'rgb(0, 170, 85)');
  await click(w('ab-focus').locator('input')); await expect(w('ab-focus').locator('input')).toBeFocused(); await color('ab-focus', 'rgb(255, 255, 255)');
  await click(w('ab-mutate')); await expect(w('ab-marker')).toHaveCSS('width', '300px'); await expect(w('ab-marker')).toHaveCSS('opacity', '0.4');
  await select('ab-child', 'Child'); await expect(w('ab-marker')).toHaveCSS('width', '300px'); await expect(w('ab-marker')).toHaveCSS('opacity', '0.4'); await expect(w('ab-changes')).toHaveText('Changes: 1');
  await select('ab-base', 'Base'); await mode({ kind: 'base' }); await color('ab-marker', 'rgb(34, 136, 85)');
  await expect(w('ab-marker')).toHaveCSS('width', '180px'); await expect(w('ab-marker')).toHaveCSS('opacity', '1'); await expect(w('ab-marker')).toHaveText('Runtime marker');
  await host.mobile(); await color('ab-marker', 'rgb(34, 136, 85)'); await mode({ kind: 'base' });
  await select('ab-auto', 'Auto'); await mode({ kind: 'auto' }); await color('ab-marker', 'rgb(255, 153, 0)'); await expect(w('ab-marker')).toHaveCSS('width', '210px');
  // A forced Child must not leak across navigation: the destination starts Auto.
  await select('ab-child', 'Child'); await click(w('ab-second')); await mode({ kind: 'auto' });
  await color('ab-second-marker', 'rgb(255, 255, 0)'); await expect(w('ab-second-marker')).toHaveCSS('width', '210px');
  await click(w('ab-second-child')); trace += 'Child:before|Child:after|'; await mode({ kind: 'view', viewId: 'ab-child-view' });
  await color('ab-second-marker', 'rgb(51, 102, 255)');
  await click(w('ab-back')); await mode({ kind: 'auto' }); await color('ab-marker', 'rgb(255, 153, 0)'); await expect(w('ab-trace')).toHaveText(trace);
  await expect(w('ab-marker')).toHaveText('Authored marker'); // Navigation rebuilds page content.
  await host.capture?.('page-local-states');
  await click(w('ab-frames'));
  const inner = scope.frameLocator('[data-inline-frame="ab-frame"]'), iw = id => adaptiveBehaviorWidget(inner, id);
  await expect(iw('ab-marker')).toHaveCSS('background-color', 'rgb(255, 153, 0)');
  await expect(iw('ab-trace')).toHaveText(''); await expect(w('ab-outer-trace')).toHaveText(trace);
  await click(iw('ab-child')); await expect(iw('ab-marker')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(iw('ab-trace')).toHaveText('Child:before|Child:after|'); await expect(w('ab-outer-trace')).toHaveText(trace);
  await click(iw('ab-second')); await expect(iw('ab-second-marker')).toHaveCSS('background-color', 'rgb(255, 255, 0)');
  await click(w('ab-frame-reload')); await expect(iw('ab-marker')).toHaveCSS('background-color', 'rgb(255, 153, 0)');
  await expect(iw('ab-trace')).toHaveText(''); await expect(w('ab-outer-trace')).toHaveText(trace);
  await host.capture?.('embedded-session');
  return { wholeMapBarrier: true, normalParentStyleInherited: true, focusedPresenceWithEmptyEffectivePatch: true, forcedResizeHeld: true,
    sameViewKeepsActions: true, transitionResetsActions: true, caseSuccessorTerminated: true, laterIndependentIfRuns: true,
    sharedDefinitionsPageLocalStates: true, navigationRestoresAuto: true, iframeIndependentVariablesAndSelection: true, sameTargetReloadRestartsSession: true, finalOuterTrace: trace };
}
