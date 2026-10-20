import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Deterministic author-created demo, not an imported native Axure sample. */
export function runtimeTextAutofitFixture() {
  let sequence = 0;
  const id = name => `runtime-autofit-${name}`;
  const event = (type, ...actions) => ({ id: id(`case-${++sequence}`), name: type, event: type, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: id(`action-${++sequence}`) })) });
  const widget = (type, key, name, x, y, text = '') => ({ id: id(key), type, name, text, x, y, width: 180, height: 90, rotation: 0, style: { fill: '#ffffff', stroke: '#b8bdc7', strokeWidth: 0, radius: 0, color: '#263348', fontSize: 20, fontFamily: 'Arial', fontWeight: 400, textAlign: 'left', opacity: 1 }, hidden: false, locked: false, disabled: false, notes: '', interactions: [] });
  const shape = (key, name, x, y) => ({ ...widget('box', key, name, x, y, 'Initial'), width: 80, height: 60, shapeText: { autoFitWidth: true, autoFitHeight: true }, style: { ...widget('box', key, name, x, y).style, textPadding: [0,0,0,0], verticalAlign: 'top', lineHeight: 1.2 } });
  const label = (key, text, x, y, width = 1000) => ({ ...widget('text', key, text, x, y, text), width, height: 32, style: { ...widget('text', key, text, x, y).style, fill: 'transparent', fontSize: 14 } });
  const button = (key, name, x, y, ...actions) => ({ ...widget('button', key, name, x, y, name), width: 160, height: 40, style: { ...widget('button', key, name, x, y).style, fill: '#5b5ce2', color: '#ffffff', textAlign: 'center', fontSize: 14, fontWeight: 600, radius: 5 }, interactions: [event('click', ...actions)] });
  const page = (key, name) => ({ id: id(key), name, width: 1200, height: 900, background: '#ffffff', widgets: [], notes: '', interactions: [], adaptiveViews: [] });
  const geometry = page('geometry-page', 'Runtime geometry'), hiddenPage = page('hidden-page', 'Hidden and rows'), adaptive = page('adaptive-page', 'Adaptive registration'), embedded = page('frame-page', 'Embedded runtime');
  const target = shape('rich', 'Fitted rich shape', 400, 220); target.rotation = 30; target.style.textAlign = 'right'; target.style.verticalAlign = 'bottom';
  target.text = 'Initial second\nparagraph'; target.richText = { expressionMode: 'literal', paragraphs: [{ textAlign: 'right', lineHeightPx: 24, runs: [{ text: 'Initial', style: { fontSize: 20, fontWeight: 700 } }, { text: ' second', style: { fontSize: 30 } }] }, { runs: [{ text: 'paragraph' }] }] };
  const resizeLog = label('resize-log', 'not resized', 30, 390), moveLog = label('move-log', 'not moved', 30, 460);
  target.interactions = [event('resize', { type: 'setText', targetId: resizeLog.id, value: '[[This.width]]|[[This.height]]|[[This.x]]|[[This.y]]|[[This.widthchange]]' }), event('move', { type: 'setText', targetId: moveLog.id, value: '[[This.width]]|[[This.height]]|[[This.x]]|[[This.y]]' })];
  geometry.widgets = [label('geometry-title', 'SetText measures the painted first run, then resizes and aligns the owner.', 30, 20), target, resizeLog, moveLog,
    label('resize-caption', 'OnResize: new width | height | pre-alignment x | y | width change', 30, 360), label('move-caption', 'OnMove: new width | height | aligned x | y', 30, 430),
    button('grow', 'Grow text', 30, 70, { type: 'setText', targetId: target.id, value: 'A much longer first-formatted line' }),
    button('raw', 'Raw text', 210, 70, { type: 'setText', targetId: target.id, value: '  <b>A\rB\u2028C\r\n\nD\n' }),
    button('empty', 'Empty text', 390, 70, { type: 'setText', targetId: target.id, value: '' }),
  ];
  const hidden = shape('hidden', 'Hidden fitted shape', 40, 180); hidden.hidden = true;
  const panel = widget('panel', 'hidden-panel', 'Hidden disabled panel', 30, 470), child = shape('hidden-child', 'Hidden disabled panel child', 10, 10);
  panel.width = 700; panel.height = 160; panel.hidden = panel.disabled = true; panel.activeStateId = id('hidden-state'); panel.states = [{ id: panel.activeStateId, name: 'State 1', widgets: [child] }]; child.disabledStyle = { fontSize: 30, lineHeight: 1 };
  const repeater = widget('repeater', 'rows', 'Independent row instances', 450, 180), rowShape = shape('row-shape', 'Row fitted shape', 10, 10); rowShape.height = 30;
  const rowButton = button('row-button', 'Change row text', 140, 50, { type: 'setText', targetId: rowShape.id, value: '[[Item.Name]]\nOne\nTwo\nThree' }); rowButton.height = 30;
  repeater.width = 220; repeater.height = 170; repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First row' }, { Name: 'Second row' }], template: [rowShape, rowButton], layout: 'vertical', itemWidth: 220, itemHeight: 80, gap: 10, fitToContent: true };
  hiddenPage.widgets = [label('hidden-title', 'Hidden text uses an isolated measurement; only the clicked repeater row changes.', 30, 20), hidden, panel, repeater,
    button('set-hidden', 'Set hidden text', 30, 70, { type: 'setText', targetId: hidden.id, value: 'Measured while hidden' }, { type: 'setText', targetId: child.id, value: 'Measured while hidden' }),
    button('show-hidden', 'Show hidden shape', 210, 70, { type: 'show', targetId: hidden.id }, { type: 'show', targetId: panel.id }),
  ];
  const registered = shape('registered', 'Registered shape', 40, 170), untouched = shape('untouched', 'Unregistered shape', 190, 170);
  for (const item of [registered, untouched]) { item.shapeText = { autoFitWidth: false, autoFitHeight: true }; item.width = 100; item.height = 80; item.text = 'A repeated phrase that wraps into several lines'; }
  adaptive.adaptiveViews = [{ id: id('phone-view'), name: 'Phone text', width: 390, overrides: { [registered.id]: { style: { fontSize: 30 } }, [untouched.id]: { style: { fontSize: 30 } } } }];
  adaptive.widgets = [label('adaptive-title', 'Only registered text remeasures after the viewport selects Phone text.', 30, 20), registered, untouched, button('register', 'Register text', 30, 70, { type: 'setText', targetId: registered.id, value: registered.text })];
  const frame = widget('inlineFrame', 'frame', 'Embedded runtime geometry', 20, 70); frame.width = 1140; frame.height = 720; frame.style.fill = 'transparent'; frame.inlineFrame = { target: { kind: 'page', pageId: geometry.id }, hideBorders: true, scrolling: 'auto', preview: { kind: 'none' } };
  embedded.widgets = [label('frame-title', 'The same SetText interactions execute inside the sandboxed offline player.', 30, 20), frame];
  return { format: 'rea-prototype', version: 1, id: id('document'), name: 'Runtime SetText AutoFit demo', caseSelection: 'never', pages: [geometry, hiddenPage, adaptive, embedded], components: [], variables: {}, styles: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = path.resolve(import.meta.dirname, '../artifacts/runtime-text-autofit-demo.rea.json');
  await fs.writeFile(output, JSON.stringify(runtimeTextAutofitFixture(), null, 2) + '\n'); console.log(output);
}
