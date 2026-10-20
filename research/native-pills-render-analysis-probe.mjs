import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { Script } from 'node:vm';

// Current product modules and an immutable pre-fix snapshot only. No Axure DLL,
// original application, browser, saved sample, or product file is executed/changed.
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pin = path => ({ path, sha256: hash(path) });
const beforePath = '.build/native-pills-renderer-before-line-style.ts';
const afterPath = 'src/model/line-style.ts';
const source = file => stripTypeScriptTypes(fs.readFileSync(file, 'utf8')).replace('export function createLineStyleRenderer', 'function createLineStyleRenderer');
const factory = text => new Script(`${text};createLineStyleRenderer()`).runInNewContext();
const beforeSource = source(beforePath), afterSource = source(afterPath);
const before = factory(beforeSource), after = factory(afterSource);
const inventoryPath = 'research/native-pills-format-inventory.json';
const pills = read(inventoryPath).owners.filter(owner => owner.observed.vertexCounts.length === 1 && owner.observed.vertexCounts[0] === 6);
if (pills.length !== 28) throw new Error('Expected the bounded 28-source pill inventory');
const widget = owner => ({ type: 'box', width: owner.size.Width, height: owner.size.Height, vectorPath: owner.vectorPath, style: { radius: owner.effective['71'].value, strokeWidth: owner.effective['15'].value, cornerVisibility: [true, true, true, true] } });
const samePoint = (a, b) => a.every((n, i) => Math.abs(n - b[i]) <= 1e-7);
function contour(commands) {
  const result = []; let cursor = [0, 0], start = cursor;
  for (const [op, ...values] of commands) {
    if (op === 'M') { cursor = values; start = cursor; continue; }
    const end = op === 'Z' ? start : values.slice(-2);
    if (op === 'C' || !samePoint(cursor, end)) result.push([...cursor, ...(op === 'Z' ? start : values)]);
    cursor = end;
  }
  return result;
}
const savedContour = owner => contour(owner.vectorPath.commands.map(c => c.op === 'Z' ? ['Z'] : [c.op, ...(c.op === 'C' ? [c.x1 * owner.size.Width, c.y1 * owner.size.Height, c.x2 * owner.size.Width, c.y2 * owner.size.Height] : []), c.x * owner.size.Width, c.y * owner.size.Height]));
function generatedContour(d) {
  const tokens = d.match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? [], commands = [];
  for (let i = 0; i < tokens.length;) { const op = tokens[i++], n = op === 'Z' ? 0 : op === 'C' ? 6 : 2; commands.push([op, ...tokens.slice(i, i + n).map(Number)]); i += n; }
  return contour(commands);
}
const sameContour = (a, b) => a.length === b.length && a.some((_, shift) => b.every((segment, i) => { const other = a[(i + shift) % a.length]; return segment.length === other.length && samePoint(segment, other); }));
const cases = pills.map(owner => {
  const w = widget(owner);
  return { sourceId: owner.sourceId, packageId: owner.packageId, sourcePartSha256: owner.sourcePartSha256, width: w.width, height: w.height, radius: w.style.radius, before: { physicalRadii: before.rectangleRadii(w.vectorPath, w.width, w.height), normalizedFamily: before.supportsCorners(w) }, after: { physicalRadii: after.rectangleRadii(w.vectorPath, w.width, w.height), normalizedFamily: after.supportsCorners(w), allBordersVisibleFillMatchesSavedContour: sameContour(savedContour(owner), generatedContour(after.vectorRectangle(w).fillD)) } };
});

// Log intermediates in a read-only in-memory copy of the exact previous helper.
const diagnosticSite = 'const expected=rectangleSegments(width,height,r);if(expected.length!==ss.length)return undefined;';
if (!beforeSource.includes(diagnosticSite)) throw new Error('Previous helper diagnostic site changed');
const diagnostics = [];
const diagnosticSource = beforeSource.replace(diagnosticSite, 'const expected=rectangleSegments(width,height,r);globalThis.diagnostics.push({width,height,r,actualSegments:ss.length,expectedSegments:expected.length,tinyStraightEdges:expected.filter(s=>!s.c&&!s.d&&Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y)<1e-7)});if(expected.length!==ss.length)return undefined;');
const diagnostic = new Script(`${diagnosticSource};createLineStyleRenderer()`).runInNewContext({ diagnostics });
const sample = pills.find(owner => owner.sourceId === 'ae97309c679341bd880e3f1e1ca9fd09');
diagnostic.supportsCorners(widget(sample));
const edited = widget(sample); edited.style = { ...edited.style, radius: 2 };
const rawStart = sample.vectorPath.commands[0];
const report = {
  capturedAt: new Date().toISOString(),
  method: 'Read-only current-product and pre-fix-source module execution. Metadata is explicitly supplied to the capability probe; this is not an importer, original DLL/JS, GUI or browser observation.',
  report: pin('research/native-pills-render-analysis.md'),
  sources: [beforePath, afterPath, inventoryPath, 'src/components/WidgetView.tsx', 'src/components/Preview.tsx', 'src/components/CanvasVectorTools.tsx', 'src/components/Inspector.tsx', 'src/App.tsx', 'src/model/vector.ts', 'src/model/vector-editing.ts', 'src/runtime/export-runtime.ts', 'src/runtime/export.ts', 'src/runtime/frame-player.ts', 'tests/native-pills-renderer.test.ts', 'research/native-corners-evidence.md'].map(pin),
  probe: pin('research/native-pills-render-analysis-probe.mjs'),
  cases,
  summary: { sources: cases.length, physicalRecognizedBefore: cases.filter(c => c.before.physicalRadii).length, normalizedRecognizedBefore: cases.filter(c => c.before.normalizedFamily).length, normalizedRecognizedAfter: cases.filter(c => c.after.normalizedFamily).length, allBordersVisibleFillMatchesSavedContour: cases.filter(c => c.after.allBordersVisibleFillMatchesSavedContour).length },
  floatingPointDiagnostic: { sourceId: sample.sourceId, diagnostics },
  nodeEditingMismatch: { sourceId: sample.sourceId, sourceDimensions: sample.size, command: 'effective radius=2; keep saved normalized vectorPath', rawFirstAnchorPixels: { x: rawStart.x * edited.width, y: rawStart.y * edited.height }, rendered: after.vectorRectangle(edited), status: 'Static integration mismatch plus product helper output; no original GUI or product browser capture.' },
  validation: ['.build/native-pills-renderer-red.json', '.build/native-pills-renderer-red.log', '.build/native-pills-renderer-green.json', '.build/native-pills-renderer-green.log', '.build/native-pills-renderer-line-regression.json', '.build/native-pills-renderer-line-regression.log', '.build/native-pills-renderer-typecheck.log'].map(pin),
  boundaries: ['Only normalized qualification was changed. Dynamic rectangle painting and initial/runtime paint lifecycle were not changed.', 'The previous epsilon=1e-7 point and handle tolerance is unchanged; there is no tolerance widening.', 'Original managed coalescence and JavaScript repaint are separately investigated by the native-evidence owner.', 'Node editor still uses stored vectorPath; effective parameter geometry can differ and remains a known issue.'],
  remainingFindings: [{ id: 'native-pill-parameter-versus-stored-node-geometry', status: 'Confirmed product source/helper mismatch, retained by parent for a separate editing contract', locations: ['src/components/CanvasVectorTools.tsx:24', 'src/components/CanvasVectorTools.tsx:146', 'src/App.tsx:419', 'src/App.tsx:458', 'src/components/WidgetView.tsx:171'], browserReproduction: false }],
};
fs.writeFileSync('research/native-pills-render-analysis.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summary: report.summary, diagnostic: report.floatingPointDiagnostic, node: report.nodeEditingMismatch }, null, 2));
