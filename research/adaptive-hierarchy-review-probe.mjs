// Read-only product-model review; no vendor application or browser is executed.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !path.extname(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { createPage, createWidget } = await import(pathToFileURL(path.resolve('src/model/document.ts')).href);
const { applyAdaptiveWidgetEdits, resolveAdaptiveWidgets } = await import(pathToFileURL(path.resolve('src/model/adaptive.ts')).href);
const results = [];
for (const property of ['width', 'color', 'hidden', 'fill-reset']) {
  const page = createPage('Review'), box = createWidget('box'); page.widgets = [box];
  const gradient = { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] };
  if (property === 'fill-reset') box.style.fillGradient = gradient;
  const coincident = property === 'width' ? { width: 300 } : property === 'color' ? { style: { color: '#ff0000' } } : property === 'hidden' ? { hidden: true } : { style: { fill: '#ffffff' } };
  page.adaptiveViews = [
    { id: 'parent', name: 'Parent', width: 768, height: 0, overrides: { [box.id]: structuredClone(coincident) } },
    { id: 'child', name: 'Child', width: 390, height: 0, baseViewId: 'parent', overrides: { [box.id]: structuredClone(coincident) } },
  ];
  const visible = structuredClone(resolveAdaptiveWidgets(page, 'child'));
  visible[0].notes = 'Only edit a shared note';
  const edited = applyAdaptiveWidgetEdits(page, 'child', visible);
  const afterSharedEdit = structuredClone(edited.adaptiveViews[1].overrides[box.id] ?? null);
  edited.adaptiveViews[0].overrides[box.id] = property === 'width' ? { width: 400 } : property === 'color' ? { style: { color: '#0000ff' } } : property === 'hidden' ? { hidden: false } : { style: { fillGradient: gradient } };
  const final = resolveAdaptiveWidgets(edited, 'child')[0];
  const expected = property === 'width' ? 300 : property === 'color' ? '#ff0000' : property === 'hidden' ? true : false;
  const observed = property === 'width' ? final.width : property === 'color' ? final.style.color : property === 'hidden' ? final.hidden : Boolean(final.style.fillGradient);
  results.push({ property, before: coincident, afterSharedEdit, expectedAfterParentChange: expected, observedAfterParentChange: observed, preserved: observed === expected });
}
const sources = ['src/model/adaptive.ts', 'src/model/adaptive-selection.ts', 'src/model/document.ts'].map(file => ({ path: file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }));
writeFileSync(process.argv[2] ?? 'research/adaptive-hierarchy-review-probe-after.json', `${JSON.stringify({ timestamp: new Date().toISOString(), method: 'Node built-in TypeScript stripping executes current product-model functions. All examples edit only shared notes before changing an ancestor. No product files are modified.', sources, results }, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
