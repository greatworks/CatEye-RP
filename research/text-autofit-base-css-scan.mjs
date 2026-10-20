import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import postcss from 'postcss';

const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const fileEntry = file => ({ path: file.replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) });
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(directory, item.name)) : [path.join(directory, item.name)]);
const cssFiles = walk(root).filter(file => file.endsWith('.css')).sort();
const property = /^(?:overflow(?:-[xy]|-wrap)?|position|width|height|min-width|max-width|min-height|max-height|white-space|word-wrap|line-height|display|box-sizing|padding(?:-.+)?|margin(?:-.+)?|border|align-self|text-overflow)$/;
const css = cssFiles.map(file => {
  const rules = [];
  postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }).walkRules(rule => {
    const declarations = [];
    rule.walkDecls(decl => { if (property.test(decl.prop)) declarations.push({ property: decl.prop, value: decl.value, important: !!decl.important, line: decl.source.start.line }); });
    rules.push({ selector: rule.selector, line: rule.source.start.line, endLine: rule.source.end.line, declarations });
  });
  return { ...fileEntry(file), relativePath: path.relative(root, file).replaceAll('\\', '/'), ruleCount: rules.length, rules };
});
const rel = name => path.join(root, name);
const read = name => fs.readFileSync(rel(name), 'utf8');
const snippets = [];
const snippet = (name, start, end, purpose) => snippets.push({ source: name, startLine: start, endLine: end, purpose, text: read(name).split(/\r?\n/).slice(start - 1, end).join('\n') });
snippet('start.html', 9, 10, 'Shell stylesheet links');
snippet('start.html', 119, 129, 'Separate prototype iframe');
snippet('resources/scripts/axure/style.js', 1647, 1700, 'State repaint targets background child, not owner dimensions');
snippet('resources/scripts/axure/style.js', 2076, 2094, 'Active alignment helper returns callback; old updates commented');
snippet('resources/scripts/axure/style.js', 2427, 2441, 'Text descendant size measurement');
snippet('resources/scripts/axure/style.js', 2465, 2502, 'Typography property map');
snippet('resources/scripts/axure/style.js', 1373, 1373, 'Line SVG overflow exception');
snippet('resources/scripts/axure/adaptive.js', 131, 142, 'Empty text alignment callback and AutoFit registry update');
snippet('resources/scripts/axure/adaptive.js', 591, 609, 'Scrolling container cleanup scope');
snippet('resources/scripts/axure/expr.js', 379, 403, 'Post-setter fitting and explicit registry');
snippet('resources/scripts/axure/expr.js', 469, 552, 'Explicit runtime AutoFit owner resize');
snippet('resources/scripts/axure/events.js', 512, 522, 'Case-menu nowrap scope');
const runtimeNames = [...new Set(snippets.map(x => x.source))];
const assertions = [];
const check = (name, test) => { test(); assertions.push({ name, passed: true }); };
check('Pinned original style.js identity', () => assert.equal(fileEntry(rel('resources/scripts/axure/style.js')).sha256, 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c'));
check('Nine retained CSS files / 721 parsed rules', () => { assert.equal(css.length, 9); assert.equal(css.reduce((sum, item) => sum + item.ruleCount, 0), 721); });
check('No exact .text or .ax_default class selector in those CSS rules', () => assert.equal(css.flatMap(x => x.rules).some(x => /\.(?:text|ax_default)(?![a-zA-Z0-9_-])/.test(x.selector)), false));
check('Paragraph base rule does not set layout or white-space', () => {
  const rule = css.find(x => x.relativePath === 'resources/css/axure_rp_page.css').rules.find(x => x.selector === 'p');
  assert.ok(rule); assert.deepEqual(rule.declarations.map(x => [x.property, x.value]), [['margin', '0px']]);
});
check('Shell imports default.css and contains separate mainFrame', () => { assert.match(read('start.html'), /href="resources\/css\/default\.css"/); assert.match(read('start.html'), /<iframe id="mainFrame"/); });
check('State AutoFit changes id_div dimensions', () => { const s = snippets.find(x => x.startLine === 1647).text; assert.match(s, /borderElement = document\.getElementById\(id \+ '_div'\)/); assert.match(s, /borderElement\.style\.width = width \+ 'px'/); assert.match(s, /borderElement\.style\.height = height \+ 'px'/); });
check('Typography map has no layout/overflow/white-space assignment', () => assert.doesNotMatch(snippets.find(x => x.startLine === 2465).text, /\.(?:overflow|whiteSpace|width|height|position)\s*=/));
check('Live alignment helper returns callback', () => assert.match(snippets.find(x => x.startLine === 2076).text, /return transformFn\(\);/));
check('AutoFit update enumerates registry only', () => assert.match(snippets.find(x => x.startLine === 379).text, /for \(var id  in _autoFitIds\)/));
check('Explicit text AutoFit can resize owner and record it', () => { const s = snippets.find(x => x.startLine === 469).text; assert.match(s, /query\.resize\(css, \{\}\)/); assert.match(s, /_setAutoFitId\(id, css\)/); });
const output = {
  schema: 'text-autofit-base-css-evidence-v1', inspectedAt: new Date().toISOString(),
  method: 'Static retained CSS parsing and bounded runtime/HTML source inspection; no vendor code execution, browser rendering, or generated-page cascade claim.',
  extractionEvidenceId: 'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
  distributionSha256: 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',
  sources: [...css.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), ...runtimeNames.map(name => fileEntry(rel(name)))],
  evidence: ['research/text-autofit-base-css-evidence.md', 'research/text-autofit-base-css-scan.mjs', 'research/text-autofit-native-evidence.md'].map(fileEntry),
  summary: { cssFiles: css.length, cssRules: css.reduce((sum, x) => sum + x.ruleCount, 0), textClassRules: 0, plainAxDefaultClassRules: 0, originalGeneratedUxPageAvailable: false, fullCascadeKnown: false, assertionsPassed: assertions.length },
  css, snippets, assertions,
  limits: ['No ordinary generated UX page/project stylesheet or final computed cascade was obtained.', 'Player shell overflow declarations do not establish shape/text overflow inside the iframe.', 'Post-SetText AutoFit owner resize does not establish first-load enrollment for every AutoFit object.', 'Original GUI, native font engine and proprietary DLL were not executed by this audit.']
};
fs.writeFileSync('research/text-autofit-base-css-evidence.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output.summary, file: fileEntry('research/text-autofit-base-css-evidence.json') }, null, 2));
