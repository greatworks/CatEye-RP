/** Read-only, evidence-bound recovery, NOT a native RP importer or renderer. */
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { readObjectPackage } from './read-rp-objects.mjs';
import { inspectRpFile } from './read-rp-container.mjs';
import { recoverInteractionMap } from './read-rp-interactions.mjs';
import { recoverAdaptiveSets, nativePlaced, NATIVE_BASE_VIEW_ID, NATIVE_AUTO_VIEW_ID } from './read-rp-adaptive.mjs';

export const IMAGE_LIMITS = Object.freeze({ bytes: 4 * 1024 * 1024, dataUrlCharacters: 8 * 1024 * 1024, pixels: 8 * 1024 * 1024, dimension: 8192, inflatedBytes: 32 * 1024 * 1024, chunks: 4096 });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const imageError = message => { throw new Error(message); };
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
function crc32(bytes) { let n = 0xffffffff;for (const b of bytes) n = (n >>> 8) ^ crcTable[(n ^ b) & 255];return (n ^ 0xffffffff) >>> 0; }

/** Restricted static PNG validation. No image/target code is executed; no ancillary data is decompressed. */
export function inspectStaticPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > IMAGE_LIMITS.bytes || bytes.length < 45) imageError('PNG byte limit or truncated image');
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') imageError('Only embedded PNG is supported');
  let at = 8, width, height, bitDepth, colorType, idatEnded = false, paletteEntries = 0, ended = false;
  const seen = new Set(), compressed = [], chunks = [];
  while (at < bytes.length) {
    if (chunks.length >= IMAGE_LIMITS.chunks || at + 12 > bytes.length) imageError('PNG chunk count/bounds');
    const length = bytes.readUInt32BE(at), name = bytes.toString('latin1', at + 4, at + 8), end = at + 12 + length;
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(name)) imageError('PNG chunk bounds/type');
    if (crc32(bytes.subarray(at + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) imageError('PNG CRC mismatch');
    const data = bytes.subarray(at + 8, end - 4);
    if (!['IHDR','PLTE','tRNS','IDAT','IEND','sRGB','pHYs'].includes(name)) imageError(`Unsupported PNG chunk ${name}; animation, orientation and unknown metadata are not recovered`);
    if (name !== 'IDAT' && seen.has(name)) imageError('Duplicate PNG chunk');
    if (!chunks.length && name !== 'IHDR') imageError('PNG requires first IHDR');
    if (compressed.length && name !== 'IDAT') idatEnded = true;
    if (name === 'IHDR') {
      if (length !== 13) imageError('PNG IHDR length');
      width = data.readUInt32BE(0);height = data.readUInt32BE(4);bitDepth = data[8];colorType = data[9];
      if (!width || !height || width > IMAGE_LIMITS.dimension || height > IMAGE_LIMITS.dimension || width * height > IMAGE_LIMITS.pixels) imageError('PNG pixel/dimension limit');
      const depths = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
      if (!depths[colorType]?.includes(bitDepth) || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) imageError('Unsupported PNG color/bit-depth/compression/interlace');
    } else if (name === 'PLTE') {
      if (compressed.length || !length || length % 3 || length > 768 || [0,4].includes(colorType)) imageError('PNG palette bounds/order');
      paletteEntries = length / 3;
      if (colorType === 3 && paletteEntries > 2 ** bitDepth) imageError('PNG palette depth mismatch');
    } else if (name === 'tRNS') {
      if (compressed.length || !([0,2,3].includes(colorType)) || (colorType === 0 && length !== 2) || (colorType === 2 && length !== 6) || (colorType === 3 && (!paletteEntries || !length || length > paletteEntries))) imageError('PNG transparency bounds/order');
    } else if (name === 'IDAT') {
      if (idatEnded || (colorType === 3 && !paletteEntries)) imageError('PNG IDAT order/palette');compressed.push(data);
    } else if (name === 'IEND') {
      if (length !== 0 || !compressed.length || end !== bytes.length) imageError('PNG IEND/trailing data');ended = true;
    } else if (name === 'sRGB') {
      if (length !== 1 || data[0] > 3 || seen.has('PLTE') || compressed.length) imageError('PNG sRGB bounds/order');
    } else if (name === 'pHYs' && (length !== 9 || data[8] > 1 || compressed.length)) imageError('PNG pHYs bounds/order');
    chunks.push(name);seen.add(name);at = end;
  }
  if (!ended) imageError('PNG missing IEND');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType], stride = Math.ceil(width * bitDepth * channels / 8) + 1, expected = stride * height;
  if (expected > IMAGE_LIMITS.inflatedBytes) imageError('PNG inflated size limit');
  let inflated;
  try { inflated = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected }); } catch { imageError('PNG invalid/oversized compressed pixel data'); }
  if (inflated.length !== expected) imageError('PNG pixel data length mismatch');
  for (let row = 0; row < height; row++) if (inflated[row * stride] > 4) imageError('PNG unknown row filter');
  return { mime: 'image/png', width, height, bitDepth, colorType, decodedBytes: bytes.length, sha256: digest(bytes), chunks };
}

export function property(map, key) {
  if (map == null) return undefined;
  if (!Array.isArray(map.$map)) throw new Error(`Expected a property map for ${key}`);
  const pairs = map.$map.filter(pair => pair[0] === key);
  if (pairs.length > 1) throw new Error(`Ambiguous duplicate property ${key}`);
  return pairs[0]?.[1];
}

// Constants come from the shipped AxureRP11.dll ECMA-335 metadata, not numeric guesses.
// See metadata-PName.json and metadata-DOAName.json (assembly SHA-256 in both).
const PROPERTY_NAME_MASK = 0x0fffffff, LOCATION = 101, SIZE = 105;
const VECTOR_SHAPE_TYPES = new Set([0,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,100,101,102,103,104,105,106,202,203,204,205,206,207,208,210,211,212,213,214,216,300]);
function storedStyleProperty(style, name) {
  const list = property(style?.properties, 'PropList');
  if (list === undefined) return null;
  if (!Array.isArray(list)) throw new Error('Invalid PropList');
  const matches = list.filter(p => {
    const raw = property(p, 'DOAName');
    if (!Number.isInteger(raw)) throw new Error('Invalid DOAName');
    return (raw & PROPERTY_NAME_MASK) === name;
  });
  if (matches.length > 1) throw new Error(`Ambiguous duplicate style property ${name}`);
  if (!matches.length) return null;
  const raw = property(matches[0], 'DOAName');
  return { rawDoaName: raw, determined: Boolean(raw & 0x80000000), overridden: Boolean(raw & 0x40000000), value: property(matches[0], 'Value') };
}

function coordinatePair(entry, names) {
  if (!entry) return null;
  const result = Object.fromEntries(names.map(name => [name, property(entry.value, name)]));
  if (!names.every(name => Number.isFinite(result[name]))) throw new Error('Non-finite or missing stored geometry');
  return { ...entry, value: result };
}

export function recoverRectanglePath(paths, width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (!Array.isArray(paths) || paths.length !== 1 || !Array.isArray(paths[0]) || paths[0].length < 4 || paths[0].length > 8) return null;
  const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-6;
  const point = p => { const x = property(p, 'X'), y = property(p, 'Y'); return Number.isFinite(x) && Number.isFinite(y) ? [x * width, y * height] : null; };
  const none = p => ['X', 'Y'].every(k => { const n = property(p, k); return n?.$number === 'NaN' && n.numberTag === 6; });
  const vertices = paths[0].map(p => ({ xy: point(property(p, 'Path')), lower: property(p, 'LowerHandle'), higher: property(p, 'HigherHandle'), segment: property(p, 'HigherSegmentExists') }));
  if (vertices.some(v => !v.xy || v.segment !== true || v.xy[0] < -1e-6 || v.xy[0] > width + 1e-6 || v.xy[1] < -1e-6 || v.xy[1] > height + 1e-6)) return null;
  const top = vertices.filter(v => near(v.xy[1], 0)).map(v => v.xy[0]), bottom = vertices.filter(v => near(v.xy[1], height)).map(v => v.xy[0]);
  const left = vertices.filter(v => near(v.xy[0], 0)).map(v => v.xy[1]), right = vertices.filter(v => near(v.xy[0], width)).map(v => v.xy[1]);
  if ([top, bottom, left, right].some(a => !a.length)) return null;
  const radii = [Math.min(...top), width - Math.max(...top), width - Math.max(...bottom), Math.min(...bottom)];
  const cross = [Math.min(...left), Math.min(...right), height - Math.max(...right), height - Math.max(...left)];
  if (radii.some((r, i) => !near(r, cross[i]) || r < -1e-6 || r > Math.min(width, height) / 2 + 1e-6)) return null;
  const expected = [], add = (xy, lower = null, higher = null) => expected.push({ xy, lower, higher });
  // These control handles (0.44*r from the corner) are directly observed in both tutorial files.
  // This intentionally rejects arbitrary paths and other rounded-curve encodings.
  const [tl, tr, br, bl] = radii;
  if (tl > 1e-6) { add([0, tl], null, [0, tl * .44]); add([tl, 0], [tl * .44, 0]); } else add([0, 0]);
  if (tr > 1e-6) { add([width - tr, 0], null, [width - tr * .44, 0]); add([width, tr], [width, tr * .44]); } else add([width, 0]);
  if (br > 1e-6) { add([width, height - br], null, [width, height - br * .44]); add([width - br, height], [width - br * .44, height]); } else add([width, height]);
  if (bl > 1e-6) { add([bl, height], null, [bl * .44, height]); add([0, height - bl], [0, height - bl * .44]); } else add([0, height]);
  // The witnessed six-anchor pills coalesce two zero-length straight edges.
  // Native m5vw/P5vT first merges the closing seam, then adjacent equal anchors,
  // retaining the first lower handle and second higher handle. Do not apply
  // this to arbitrary contours or widen the existing eight-anchor encoding.
  if (vertices.length === 6 && expected.length === 8) {
    const canMerge = (a, b) => !a.higher && !b.lower && near(a.xy[0], b.xy[0]) && near(a.xy[1], b.xy[1]);
    const merge = (a, b) => ({ xy: b.xy, lower: a.lower, higher: b.higher });
    if (canMerge(expected.at(-1), expected[0])) expected[0] = merge(expected.pop(), expected[0]);
    for (let i = 1; i < expected.length; i++) if (canMerge(expected[i - 1], expected[i])) { expected.splice(i - 1, 2, merge(expected[i - 1], expected[i])); i--; }
  }
  if (vertices.length !== expected.length) return null;
  const matchPoint = (a, b) => a && near(a[0], b[0]) && near(a[1], b[1]);
  const matches = (v, e) => matchPoint(v.xy, e.xy) && (e.lower ? matchPoint(point(v.lower), e.lower) : none(v.lower)) && (e.higher ? matchPoint(point(v.higher), e.higher) : none(v.higher));
  const matched = vertices.some((_, shift) => expected.every((e, i) => matches(vertices[(i + shift) % vertices.length], e)));
  return matched ? { cornerRadii: radii.map(r => Math.abs(r) < 1e-6 ? 0 : Math.round(r * 1e6) / 1e6), evidence: 'Stored Shape=0, perimeter vertices and observed cubic corner handles; dimensions from stored SIZE' } : null;
}

/** Recognize only the four-extrema ellipse encoding witnessed in shipped RP11 files. */
export function recoverEllipsePath(paths) {
  if (!Array.isArray(paths) || paths.length !== 1 || !Array.isArray(paths[0]) || paths[0].length !== 4) return null;
  const expected = [
    [[.5, 0], [.22, 0], [.78, 0]],
    [[1, .5], [1, .22], [1, .78]],
    [[.5, 1], [.78, 1], [.22, 1]],
    [[0, .5], [0, .78], [0, .22]],
  ];
  const pointMatches = (value, point) => ['X', 'Y'].every((key, i) => {
    const number = property(value, key);
    return Number.isFinite(number) && Math.abs(number - point[i]) < 1e-12;
  });
  const matches = (vertex, points) => property(vertex, 'HigherSegmentExists') === true
    && ['Path', 'LowerHandle', 'HigherHandle'].every((key, i) => pointMatches(property(vertex, key), points[i]));
  if (!paths[0].some((_, offset) => expected.every((points, i) => matches(paths[0][(i + offset) % 4], points)))) return null;
  return { sourceShape: 15, evidence: 'RPShapeType.Ellipse=15; four extrema with the observed normalized cubic handles' };
}

/** Recover stored normalized control geometry; this does not solve native layout or paint effects. */
export function recoverVectorPath(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 256) return null;
  const exactMap = (value, keys) => value && Array.isArray(value.$map) && value.$map.length === keys.length
    && keys.every(key => value.$map.filter(pair => Array.isArray(pair) && pair.length === 2 && pair[0] === key).length === 1);
  const scalar = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000;
  const nan = value => value?.$number === 'NaN' && value.numberTag === 6 && Object.keys(value).length === 2;
  const point = (value, handle = false) => {
    if (!exactMap(value, ['X', 'Y'])) throw new Error('Unknown control-point coordinate fields');
    const x = property(value, 'X'), y = property(value, 'Y');
    // Native builder branches disagree on partial-axis NaN; only their common domain is recovered.
    if (handle && nan(x) && nan(y)) return null;
    if (!scalar(x) || !scalar(y)) throw new Error('Unsupported control-point coordinate');
    return { x, y };
  };
  const commands = [];
  let verticesTotal = 0;
  try {
    for (const source of paths) {
      if (!Array.isArray(source) || source.length < 2 || (verticesTotal += source.length) > 3500) return null;
      const vertices = source.map(value => {
        if (!exactMap(value, ['Path', 'LowerHandle', 'HigherHandle', 'HigherSegmentExists'])) throw new Error('Unknown control-point fields');
        const segment = property(value, 'HigherSegmentExists');
        if (typeof segment !== 'boolean') throw new Error('Unknown segment flag');
        return { point: point(property(value, 'Path')), lower: point(property(value, 'LowerHandle'), true), higher: point(property(value, 'HigherHandle'), true), segment };
      });
      // Interior segment breaks need a verified figure/fill grouping; do not connect them by inference.
      if (vertices.slice(0, -1).some(v => !v.segment)) return null;
      commands.push({ op: 'M', ...vertices[0].point });
      const closed = vertices.at(-1).segment;
      for (let i = 0; i < vertices.length - (closed ? 0 : 1); i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if (!a.higher && !b.lower) {
          if (a.point.x !== b.point.x || a.point.y !== b.point.y) commands.push({ op: 'L', ...b.point });
        } else {
          const first = a.higher ?? a.point, second = b.lower ?? b.point;
          commands.push({ op: 'C', x1: first.x, y1: first.y, x2: second.x, y2: second.y, ...b.point });
        }
      }
      if (closed) commands.push({ op: 'Z' });
    }
    if (commands.length > 4096 || !commands.some(c => c.op === 'L' || c.op === 'C')) return null;
    // SVG fill implementation dHbV.G3jJ explicitly passes FillRuleSvg.NonZero=0.
    // Native fill closes open contours, while stroke follows HigherSegmentExists.
    // See research/rp-vector-path-evidence.md for the exact CIL chains and limits.
    return { fillRule: 'nonzero', commands };
  } catch { return null; }
}

// AllTypes chooser is the witnessed 11-value subset; GNpV's return strings are
// obfuscated. HTML spellings below are the documented standard input mapping.
const NATIVE_INPUT_TYPES = new Map([[0, 'text'], [1, 'password'], [2, 'email'], [3, 'number'], [4, 'tel'], [5, 'url'], [6, 'search'], [12, 'file'], [17, 'date'], [18, 'month'], [19, 'time']]);
function basicTypeCandidate(widget, size) {
  const p = widget.properties;
  if (widget.type === 'Axure:DiagramObject:ImageBox') return { type: 'image', evidence: 'Exact ImageBox type; embedded image and layout require separate validation' };
  const inputType = property(p, 'Type');
  if (widget.type === 'Axure:DiagramObject:TextBox' && NATIVE_INPUT_TYPES.has(inputType) && property(p, 'WordWrap') === false && typeof property(p, 'ReadOnly') === 'boolean') {
    if (inputType === 12 && (property(property(p, 'TextBlock'), 'text') !== '' || property(p, 'PlaceholderText') !== '')) return null;
    return { type: 'input', inputType: NATIVE_INPUT_TYPES.get(inputType), nativeInputType: inputType, inputTypeMapping: 'standard-html-input-type', evidence: 'TextBox explicit Type in the verified 11-value AllTypes chooser; documented standard HTML mapping, native obfuscated return literals not decoded; file only empty text and hint; form properties validated separately' };
  }
  if (widget.type === 'Axure:DiagramObject:TextArea') {
    const submit = property(p, 'SubmitButton');
    if (inputType === 0 && property(p, 'WordWrap') === true && typeof property(p, 'ReadOnly') === 'boolean'
      && typeof property(p, 'PlaceholderText') === 'string' && property(p, 'PlaceholderText').length <= 100000 && typeof property(p, 'HideHintOnFocus') === 'boolean'
      && submit?.referenceTag === 3 && submit.$reference === '0'.repeat(32)) {
      return { type: 'textarea', evidence: 'Exact TextArea type; explicit wrapped plain text; form properties and hint validated separately' };
    }
    return null;
  }
  if (['Axure:DiagramObject:RadioButton', 'Axure:DiagramObject:CheckBox'].includes(widget.type) && property(p, 'align-selection-button-right') === 'False') return { type: widget.type.endsWith(':RadioButton') ? 'radio' : 'checkbox', evidence: 'Exact native form type and explicit left selection button alignment' };
  if (widget.type === 'Axure:DiagramObject:DynamicPanel' && Array.isArray(property(p, 'panel-diagrams'))) return { type: 'panel', evidence: 'DynamicPanel and explicit ordered PanelState package references' };
  if (widget.type !== 'Axure:DiagramObject:VectorShape') return null;
  const sourceShape = property(p, 'Shape'), paths = property(p, 'ControlPoints');
  if (!VECTOR_SHAPE_TYPES.has(sourceShape)) return null;
  const vectorPath = recoverVectorPath(paths);
  if (!vectorPath) return null;
  const ellipse = sourceShape === 15 ? recoverEllipsePath(paths) : null;
  const rectangle = sourceShape === 0 ? recoverRectanglePath(paths, size?.value.Width, size?.value.Height) : null;
  return { type: ellipse ? 'ellipse' : rectangle ? 'box' : 'path', ...(ellipse ?? rectangle ?? {}),
    sourceShape, mapping: 'native-control-points-to-svg', storedControlGeometryPreserved: true, vectorPath,
    evidence: 'VectorShape.ControlPoints: normalized anchors, previous HigherHandle and next LowerHandle; NonZero SVG fill. Stored geometry only, not native paint/layout equivalence.' };
}

/** Explicit native form fields; no inference of a missing flag or nonzero binding. */
export function recoverFormProperties(widget) {
  if (!['Axure:DiagramObject:TextBox', 'Axure:DiagramObject:TextArea'].includes(widget.type)) return undefined;
  try {
    const p = widget.properties, readOnly = property(p, 'ReadOnly'), submit = property(p, 'SubmitButton');
    if (typeof readOnly !== 'boolean') throw new Error('ReadOnly must be an explicit Boolean');
    if (!submit || submit.referenceTag !== 3 || submit.$reference !== '0'.repeat(32) || Object.keys(submit).some(k => !['referenceTag', '$reference'].includes(k))) throw new Error('Nonzero, missing or compound SubmitButton is not yet evidenced');
    const sourceType = widget.type.endsWith(':TextBox') ? 'TextBox' : 'TextArea';
    const nativeLength = property(p, 'MaxLength');
    if (sourceType === 'TextBox' && (!Number.isInteger(nativeLength) || nativeLength < 0 || nativeLength > 2147483647)) throw new Error('Invalid or missing native MaxLength');
    if (sourceType === 'TextArea' && nativeLength !== undefined) throw new Error('TextArea MaxLength is not a witnessed native field');
    return { status: 'recovered-form-properties', sourceType, readOnly, maxLength: sourceType === 'TextBox' ? nativeLength : null, submitButton: null };
  } catch (error) { return { status: 'unsupported-form-properties', reason: error.message }; }
}

/** Ordered native option records. HTML default selection is intentionally not inferred here. */
export function recoverSelectProperties(widget, objects) {
  if (!['Axure:DiagramObject:ComboBox', 'Axure:DiagramObject:ListBox'].includes(widget?.type)) return undefined;
  try {
    const fail = message => { throw new Error(message); };
    if (!(objects instanceof Map) || objects.get(widget.id) !== widget || !validGuid(widget.id)) fail('Select owner must belong to the local package');
    const keys = new Set(['name-block','tooltip','IsContained','IsLocked','SelectedStyleGroup','InteractionMap','MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings','TextBlock','WordWrap','ReadOnly','PlaceholderText','HideHintOnFocus','Type','multiple','list-options']);
    const checkedMap = (map, allowed, name) => {
      if (!Array.isArray(map?.$map)) fail(`Missing ${name} property map`);
      const seen = new Set();
      for (const pair of map.$map) {
        if (!Array.isArray(pair) || pair.length !== 2 || !allowed.has(pair[0]) || seen.has(pair[0])) fail(`Unsupported or duplicate ${name} property`);
        seen.add(pair[0]);
      }
    };
    const p = widget.properties;
    checkedMap(p, keys, 'select');
    // These inherited TextObject fields have no verified nondefault list mapping.
    for (const [key,value] of Object.entries({Type:0,WordWrap:true,ReadOnly:false,PlaceholderText:'',HideHintOnFocus:false})) if (property(p,key) !== value) fail(`Unsupported select ${key}`);
    if (property(property(p,'TextBlock'),'text') !== '') fail('Select TextBlock must be explicitly empty; it does not encode selected options');
    const reference = value => {
      if (!value || value.referenceTag !== 3 || !validGuid(value.$reference) || Object.keys(value).length !== 2) fail('Invalid select local reference');
      return value.$reference;
    };
    if (reference(property(p,'SubmitButton')) !== ZERO_GUID) fail('Nonempty select SubmitButton is not evidenced');
    const selectMode = widget.type.endsWith(':ComboBox') ? 'dropdown' : 'listbox', multiple = property(p,'multiple');
    if (typeof multiple !== 'boolean' || (selectMode === 'dropdown' && multiple)) fail('Unsupported select multiple flag');
    const references = property(p,'list-options');
    if (!Array.isArray(references) || references.length > 500) fail('Missing or oversized list-options');
    const seen = new Set(), storedSelectedIndices = [];
    const options = references.map((ref,index) => {
      const sourceId = reference(ref), option = objects.get(sourceId);
      if (seen.has(sourceId)) fail('Repeated list option reference');
      seen.add(sourceId);
      if (!option || option.id !== sourceId || option.type !== 'Axure:SelectObject') fail('Unresolved or wrong-type local list option');
      checkedMap(option.properties, new Set(['object','selected']), 'option');
      const value = property(option.properties,'object'), selected = property(option.properties,'selected');
      if (typeof value !== 'string' || value.length > 2000 || typeof selected !== 'boolean') fail('Unsupported option text or selected flag');
      if (selected) storedSelectedIndices.push(index);
      return { sourceId, value, selected };
    });
    return { status:'decoded-select-properties', selectMode, multiple, options, storedSelectedIndices };
  } catch (error) { return { status:'unsupported-select-properties', reason:error.message }; }
}

// PName constants are recorded in metadata-PName.json. This is a restricted cache-chain reader,
// not the complete Axure stylesheet, adaptive-view, or interaction-style evaluator.
const STYLE_NAMES = new Map([[1,'FONT_NAME'],[2,'FONT_SIZE'],[3,'BOLD'],[5,'UNDERLINE'],[6,'FORE_GROUND_FILL'],[7,'FILL'],[8,'BORDER_FILL'],[9,'HORIZONTAL_ALIGNMENT'],[15,'BORDER_WIDTH'],[16,'LINE_PATTERN'],[17,'LINE_ENDS'],[21,'IX_STYLES'],[50,'ROTATION'],[70,'OPACITY'],[71,'CORNER_RADIUS'],[72,'OUTER_SHADOW'],[73,'INNER_SHADOW'],[74,'TEXT_SHADOW'],[80,'BORDER_VISIBILITY'],[81,'CORNER_VISIBILITY'],[95,'STRIKETHROUGH'],[1001,'FONT_WEIGHT'],[1002,'FONT_STYLE'],[110,'VISIBLE'],[1401,'TRANSFORM']]);
// Platform.LineStyle=1..9 and ArrowStyle=1..29, confirmed by property signatures.
// LINE_ENDS is a single SHeh value: never merge Start and End independently.
const LINE_PATTERNS = ['solid','long-dash','medium-dash','short-dash','dash-dot','dash-dot-dot','long-dash-short-dash','dot','none'];
const ARROW_STYLES = ['none','reverse-crow','filled-triangle','skinny-triangle','diamond','cross-bar','half-reverse-crow','curved-reverse-crow','double-reverse-crow','crow','double-filled-triangle','hollow-triangle','double-hollow-triangle','double-cross-bar','slanted-bar','t-bar','hollow-diamond','filled-circle','hollow-circle','filled-square','hollow-square','crow-hollow-circle','cross-bar-hollow-circle','crow-cross-bar','t-bar-reverse-crow','large-hollow-triangle','large-filled-triangle','large-hollow-diamond','large-filled-diamond'];
const nativeLinePattern = value => Number.isInteger(value) && value >= 1 && value <= LINE_PATTERNS.length ? LINE_PATTERNS[value-1] : null;
function nativeLineEnds(value) {
  if (!Array.isArray(value?.$map) || value.$map.length !== 2 || !['Start','End'].every(key=>value.$map.filter(pair=>Array.isArray(pair)&&pair.length===2&&pair[0]===key).length===1)) return null;
  const start=property(value,'Start'),end=property(value,'End');
  return [start,end].every(v=>Number.isInteger(v)&&v>=1&&v<=ARROW_STYLES.length) ? {start:ARROW_STYLES[start-1],end:ARROW_STYLES[end-1]} : null;
}
// Platform.AxFontStyle, not the differently numbered Axvg.Graphics.FontStyle.
// None=-1 and Oblique=2 remain reported until the product can preserve them.
const nativeFontStyle = value => value === 0 ? 'normal' : value === 1 ? 'italic' : null;
function styleEntries(props, source) {
  if (!Array.isArray(props)) throw new Error('Invalid style property list');
  const result = new Map();
  for (const p of props) {
    const raw = property(p, 'DOAName');
    if (!Number.isInteger(raw)) throw new Error('Invalid DOAName');
    const key = raw & PROPERTY_NAME_MASK;
    if (result.has(key)) throw new Error('Duplicate style property');
    result.set(key, { value: property(p, 'Value'), determined: Boolean(raw & 0x80000000), overridden: Boolean(raw & 0x40000000), rawDoaName: raw, source });
  }
  return result;
}
// The native IX_STYLES JSON generator recursively emits only Overridden &&
// !Indeterminate local records. Validate every record before filtering; a saved
// snapshot is not an active patch. This rule does not apply to flattened caches.
function localStateProps(props, source) {
  if (!Array.isArray(props)) throw new Error('Local interaction style requires an explicit PropList array');
  const entries = styleEntries(props, source);
  return props.filter(prop => {
    const entry = entries.get(property(prop,'DOAName') & PROPERTY_NAME_MASK);
    return entry.determined && entry.overridden;
  });
}
export function argbColor(value) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 4294967295) return null;
  const unsigned = value >>> 0, alpha = unsigned >>> 24, rgb = (unsigned & 0xffffff).toString(16).padStart(6, '0');
  return `#${rgb}${alpha === 255 ? '' : alpha.toString(16).padStart(2, '0')}`;
}
// a5yY Property metadata and B5Sy.u590 bind this exact six-field value.
// Outer/text spread is not represented by the supported shipped JS paint path.
function nativeShadow(value, inner) {
  const keys=['On','OffsetX','OffsetY','BlurRadius','Color','Spread'],pairs=value?.$map;
  if (!Array.isArray(pairs) || pairs.length!==keys.length || pairs.some(pair=>!Array.isArray(pair)||pair.length!==2||!keys.includes(pair[0])) || new Set(pairs.map(pair=>pair[0])).size!==keys.length) return null;
  const on=property(value,'On'),offsetX=property(value,'OffsetX'),offsetY=property(value,'OffsetY'),blurRadius=property(value,'BlurRadius'),spread=property(value,'Spread'),color=argbColor(property(value,'Color'));
  if(typeof on!=='boolean'||!Number.isFinite(offsetX)||Math.abs(offsetX)>1000||!Number.isFinite(offsetY)||Math.abs(offsetY)>1000||!Number.isFinite(blurRadius)||blurRadius<0||blurRadius>1000||!Number.isFinite(spread)||spread<0||spread>1000||!color||!inner&&spread!==0)return null;
  return {on,offsetX,offsetY,blurRadius,color,...(inner?{spread}:{})};
}
function nativeFillGradient(value, nativeVersion) {
  const type=property(value,'fill-type'),linear=type==='linear-gradient';
  if(!linear&&type!=='radial-gradient')return null;
  const keys=['fill-type','fill-center-point','fill-axis1',linear?'fill-angle':'fill-axis2','fill-offsets','fill-colors'];
  const exact=(v,ks)=>Array.isArray(v?.$map)&&v.$map.length===ks.length&&v.$map.every(p=>Array.isArray(p)&&p.length===2&&ks.includes(p[0]))&&new Set(v.$map.map(p=>p[0])).size===ks.length;
  const modernRp11=Array.isArray(nativeVersion)&&nativeVersion.length===4&&nativeVersion.every((n,i)=>n===(i===0?11:0));
  if(!exact(value,keys)||linear&&(!Number.isFinite(property(value,'fill-angle'))||!modernRp11&&property(value,'fill-angle')!==0))return null;
  // RP11 A59X explicitly ignores this reserved stored angle and assigns NaN;
  // only its version<9 migration path consumes the angle. Keep existing points.
  // Unknown-version helper callers retain their prior conservative zero subset.
  const point=v=>exact(v,['X','Y'])&&['X','Y'].every(k=>Number.isFinite(property(v,k))&&Math.abs(property(v,k))<=1000)?{x:property(v,'X'),y:property(v,'Y')}:null;
  const center=point(property(value,'fill-center-point')),axis1=point(property(value,'fill-axis1')),axis2=linear?null:point(property(value,'fill-axis2'));
  const offsets=property(value,'fill-offsets'),colors=property(value,'fill-colors');
  if(!center||!axis1||!linear&&!axis2||!Array.isArray(offsets)||!Array.isArray(colors)||offsets.length<2||offsets.length>100||colors.length!==offsets.length)return null;
  if(offsets.some((o,i)=>!Number.isFinite(o)||o<0||o>1||i>0&&o<offsets[i-1])||colors.some(c=>argbColor(c)===null))return null;
  const stops=offsets.map((offset,i)=>({offset,color:argbColor(colors[i])}));
  return linear?{type:'linear',start:center,end:axis1,stops}:{type:'radial',center,axis1,axis2,stops};
}
function commonRichStyle(props) {
  const paragraphs = property(property(property(props, 'RichTextBlock'), 'attributed-string'), 'Paragraphs');
  if (!Array.isArray(paragraphs)) return null;
  const runs = paragraphs.flatMap(p => property(p, 'Inlines') || []);
  if (!runs.length || runs.some(r => property(r, 'Type') !== 'Axure:AttributedString:AxRun')) return null;
  const result = { mixedFields: [] };
  for (const [out, field] of [['fontFamily','Family'],['fontSize','Size'],['fontWeight','Weight'],['fontStyle','Style'],['color','Color'],['underline','Underline'],['strikethrough','Strikethrough']]) {
    const values = runs.map(r => property(r, field));
    if (values.every(v => v === values[0])) result[out] = values[0]; else result.mixedFields.push(out);
  }
  const align = paragraphs.map(p => property(p, 'HorizontalAlignment'));
  if (align.every(v => v === align[0])) result.textAlign = align[0]; else result.mixedFields.push('textAlign');
  const spacing = paragraphs.map(p => property(p, 'LineSpacing'));
  if (spacing.length && spacing.every(v => v === spacing[0])) result.lineSpacing = spacing[0]; else result.mixedFields.push('lineSpacing');
  return result;
}
const ZERO_GUID = '0'.repeat(32);
const validGuid = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
function storedGuid(value) {
  return value && Object.keys(value).length === 1 && validGuid(value.$guid) ? value.$guid : null;
}
function defaultStyleIdentity(value) {
  // Compatibility for callers of the public appearance helpers. The native
  // document reader below always supplies both explicitly stored identities.
  if (validGuid(value)) return { id: value, libraryId: ZERO_GUID };
  return value && validGuid(value.id) && validGuid(value.libraryId) ? value : null;
}
function readDefaultStyleIdentity(decoded) {
  const packages = decoded.packages.filter(pack => pack.path === 'DesignDocument');
  if (!packages.length) return null;
  if (packages.length !== 1 || !Array.isArray(packages[0].objects)) throw new Error('Missing or ambiguous DesignDocument package');
  const pack = packages[0], objects = new Map();
  for (const object of pack.objects) {
    if (!validGuid(object.id) || objects.has(object.id)) throw new Error('Invalid or duplicate document object ID');
    objects.set(object.id, object);
  }
  const ref = (value, type) => {
    if (!value || value.referenceTag !== 3 || !validGuid(value.$reference) || value.$reference === ZERO_GUID || Object.keys(value).some(key => !['$reference','referenceTag'].includes(key))) throw new Error('Default style requires an explicit local object reference');
    const target = objects.get(value.$reference);
    if (target?.type !== type) throw new Error(`Missing or wrong-type ${type}`);
    return target;
  };
  const doc = objects.get(pack.rootId);
  if (doc?.type !== 'Axure:DesignDocument') throw new Error('Missing or wrong-type DesignDocument root');
  const sheet = ref(property(doc.properties, 'StyleSheet'), 'Axure:StyleSheet');
  const style = ref(property(sheet.properties, 'DefaultStyle'), 'Axure:Style');
  const id = storedGuid(property(style.properties, 'Id')), libraryId = storedGuid(property(style.properties, 'LibraryId'));
  if (!id || !libraryId) throw new Error('Default style Id and LibraryId must both be explicit GUID values');
  return { id, libraryId, provenance: { kind: 'document-default-style-identity', packageId: pack.packageId, sourcePartSha256: pack.sha256, documentId: doc.id, styleSheetId: sheet.id, styleObjectId: style.id } };
}
function resolveStyleChain(style, root, defaultStyleId) {
  const effective = new Map();
  const merge = (props, source) => { for (const [key, entry] of styleEntries(props, source)) effective.set(key, entry); };
  const caches = property(property(root.properties, 'StyleCache'), 'Styles');
  const identity = defaultStyleIdentity(defaultStyleId);
  const match = property(style?.properties, 'MatchInfo'), matchId = storedGuid(property(match, 'Id')), matchLibrary = storedGuid(property(match, 'LibraryId'));
  const baseId = storedGuid(storedStyleProperty(style, 0)?.value);
  let chainComplete = false;
  if (Array.isArray(caches) && identity && matchId && matchLibrary && baseId) {
    const defaults = caches.filter(c => storedGuid(property(property(c, 'Info'), 'Id')) === identity.id && storedGuid(property(property(c, 'Info'), 'LibraryId')) === identity.libraryId);
    const bases = caches.filter(c => storedGuid(property(property(c, 'Info'), 'Id')) === matchId && storedGuid(property(property(c, 'Info'), 'LibraryId')) === matchLibrary);
    if (defaults.length === 1 && bases.length === 1 && baseId === matchId) {
      merge(property(defaults[0], 'Props'), { kind: 'cached-document-default', styleId: identity.id, libraryId: identity.libraryId });
      merge(property(bases[0], 'Props'), { kind: 'cached-matched-base', styleId: baseId, libraryId: matchLibrary });
      chainComplete = true;
    }
  }
  if (style) merge(property(style.properties, 'PropList') || [], { kind: 'local-object-style', objectId: style.id });
  return { effective, chainComplete, baseId };
}
const AUTHOR_PIN_KEYS = [106,107,108,109];
const validAuthorPin = (key,value) => key === 106 ? [0,1,4,5,256].includes(value)
  : key === 107 ? [0,2,8,10,512].includes(value) : typeof value === 'boolean';
/** Author constraints are normal style properties, independent of paint/state
 * recovery. An inactive local slot must not hide its inherited declaration.
 * The supported cache identity is the same explicit one used by normal styles;
 * an unresolved chain is retained as a diagnostic, never guessed. */
export function recoverAuthorResizePins(widget, style, root, defaultStyleId, nativeVersion) {
  if(widget.type==='Axure:DiagramObject:Layer')return undefined; // Its literal MyStyle is proved by Layer membership.
  try {
    const local=styleEntries(property(style?.properties,'PropList')??[],{kind:'local-object-style',objectId:style?.id});
    const pinLocals=AUTHOR_PIN_KEYS.filter(key=>local.has(key));
    const preliminary=resolveStyleChain(style,root,defaultStyleId);
    if(!pinLocals.length&&!AUTHOR_PIN_KEYS.some(key=>{const e=preliminary.effective.get(key);return e&&e.value!==(key<108?0:false);} ))return undefined;
    if(JSON.stringify(nativeVersion)!=='[11,0,0,0]')throw new Error('Author pins require the evidenced RP11 package version');
    const unlinked=property(style?.properties,'All')===false&&property(style?.properties,'MatchInfo')===undefined&&!local.has(0);
    if(!style?.id||style.type!=='Axure:Style'||!preliminary.chainComplete&&!unlinked)throw new Error('Author pins require an identified cache chain or an explicit unlinked local style');
    const inactive=[];
    for(const key of pinLocals){
      const entry=local.get(key);
      if(!validAuthorPin(key,entry.value))throw new Error(`Invalid author pin property ${key}`);
      if(!Number.isInteger(entry.rawDoaName)||entry.rawDoaName< -2147483648||entry.rawDoaName>2147483647||(entry.rawDoaName&0x3fffffff)!==key)throw new Error('Invalid author pin flags');
      if(entry.overridden&&!entry.determined)throw new Error('Indeterminate author pin overrides cannot be flattened');
      if(!entry.overridden)inactive.push({key,rawDoaName:entry.rawDoaName,value:entry.value});
    }
    const filtered={...style,properties:{$map:style.properties.$map.map(([key,value])=>[key,key==='PropList'?value.filter(prop=>{
      const raw=property(prop,'DOAName'),key=raw&PROPERTY_NAME_MASK;
      return !AUTHOR_PIN_KEYS.includes(key)||(raw&0x40000000)!==0;
    }):value])}};
    const {effective,chainComplete}=resolveStyleChain(filtered,root,defaultStyleId);
    if(!chainComplete&&!unlinked)throw new Error('Author pin cache chain became incomplete');
    const fields=AUTHOR_PIN_KEYS.map(key=>{
      const e=effective.get(key);
      if(!e)return {key,value:key<108?0:false,source:{kind:'native-default-table',methodToken:100717199}};
      if(!e.determined||!e.overridden||!validAuthorPin(key,e.value)||e.rawDoaName!==(key|0xc0000000))throw new Error(`Unresolved author pin ${key} in normal style chain`);
      return {key,value:e.value,rawDoaName:e.rawDoaName,source:e.source};
    });
    return {schema:1,status:'supported-author-resize-pins',sourceId:widget.id,styleId:style.id,packageVersion:[...nativeVersion],cacheChainComplete:chainComplete,
      ...(!chainComplete?{unlinkedStyle:{all:false,matchInfoAbsent:true,basePropertyAbsent:true}}:{}),fields,inactive};
  }catch(error){return {schema:1,status:'unsupported-author-resize-pins',sourceId:widget.id,reason:error.message};}
}
const placementSurface = (widget, candidate, descendant) => !descendant && property(widget.properties,'IsContained') !== true &&
  ['box','ellipse','path','text','input','textarea','select','radio','checkbox','image','panel','table','menu','tree','inlineFrame'].includes(candidate?.type);
/** Only direct MyStyle OD placement is newly recovered. Flattened nontrue
 * default/named caches are diagnosed rather than promoted to active overrides.
 */
export function recoverPlacement(widget, style, root, defaultStyleId, typeCandidate, compoundDescendant = false, nativeVersion) {
  const identity={schema:1,sourceId:widget.id};let source;
  try {
    const local=storedStyleProperty(style,111);
    if(local){
      if(!Array.isArray(nativeVersion)||nativeVersion.length!==4||nativeVersion.some((v,i)=>v!==[11,0,0,0][i]))throw new Error('Direct placement requires the evidenced RP11 package version');
      const raw=local.rawDoaName;
      if(raw< -2147483648||raw>2147483647)throw new Error('Invalid placement DOAName Int32');
      nativePlaced(local.value);
      source={kind:'native-object-MyStyle',styleId:style.id,rawDoaName:raw,value:local.value,packageVersion:[...nativeVersion]};
      if(local.determined&&local.overridden){
        if(!placementSurface(widget,typeCandidate,compoundDescendant))throw new Error('Independent placement of this contained or compound descendant is unsupported');
        return {...identity,status:'supported-direct-placement',placed:nativePlaced(local.value),source};
      }
    }
    // Inactive local entries must not replace the resolved cache snapshot.
    const filtered=local?{...style,properties:{$map:style.properties.$map.map(([key,value])=>[key,key==='PropList'?value.filter(p=>(property(p,'DOAName')&PROPERTY_NAME_MASK)!==111):value])}}:style;
    const {effective,chainComplete}=resolveStyleChain(filtered,root,defaultStyleId),entry=effective.get(111);
    if(entry){
      if(!chainComplete||!entry.determined||!nativePlaced(entry.value)){
        source=entry;throw new Error('Nontrue or indeterminate cached placement is outside the verified direct-source subset');
      }
    }
    if(local){
      if(!chainComplete||!entry)throw new Error('Inactive placement lacks a complete known true cached fallback');
      return {...identity,status:'inactive-direct-placement',source,fallback:'complete-known-true-cache',cacheChainComplete:true,fallbackSource:entry};
    }
    return undefined;
  }catch(error){return {...identity,status:'unsupported-placement',reason:error.message,...(source?{source}:{})};}
}
// P50 is emitted beside the unchanged HtmlRect. Default-cache P1401 is not an
// active transform (get_Transform follows explicit OD linked/local properties).
// See rotation-format-evidence.md and rotation-runtime-evidence.md.
export function recoverRotation(widget, style, root, defaultStyleId, typeCandidate, nativeVersion) {
  try {
    const {effective,chainComplete}=resolveStyleChain(style,root,defaultStyleId);
    const rotation=effective.get(50),transform=effective.get(1401),origin=effective.get(1402);
    const localRotation=storedStyleProperty(style,50),localTransform=storedStyleProperty(style,1401),localOrigin=storedStyleProperty(style,1402);
    const exactDefault=(entry,values)=>entry?.determined&&entry.source.kind==='cached-document-default'&&entry.value?.$map?.length===Object.keys(values).length&&Object.entries(values).every(([key,value])=>property(entry.value,key)===value);
    const identityDefault=exactDefault(transform,{ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0}),centerDefault=exactDefault(origin,{X:50,Y:50});
    if(!localTransform&&!localOrigin&&(!rotation||rotation.value===0)&&(!transform||identityDefault)&&(!origin||centerDefault))return undefined;
    const fail=reason=>{throw new Error(reason);};
    if(widget.type!=='Axure:DiagramObject:VectorShape'||!['box','ellipse','path'].includes(typeCandidate?.type)||!typeCandidate.vectorPath)fail('Center rotation requires a supported stored VectorShape path');
    const text=recoverWidgetText(widget,nativeVersion);
    if(!['stored-empty-rich-text','stored-plain-text','stored-rich-text-as-plain'].includes(text.status)||text.text!=='')fail('Nonempty or unresolved independently rotated text is outside this geometry subset');
    if(!chainComplete)fail('Rotation requires the complete exact cached style chain');
    if(!localRotation?.determined||!localRotation.overridden||typeof localRotation.value!=='number'||!Number.isFinite(localRotation.value)||Math.abs(localRotation.value)>100000||rotation?.source.kind!=='local-object-style')fail('Rotation requires a finite explicit determined/overridden P50');
    if(localTransform||localOrigin)fail('Explicit transform or transform origin has not been mapped');
    if(!identityDefault||!centerDefault)fail('Linked transform/origin or nonidentity defaults have not been mapped');
    return {status:'supported-center-rotation',rotation:localRotation.value,origin:{x:.5,y:.5},mapping:'native-vector-center-rotation',cacheChainComplete:true,source:{rotation,transform,transformOrigin:origin}};
  }catch(error){return {status:'unsupported-rotation',reason:error.message};}
}
export function recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, forcedSelected, forcedState, resolvedState, nativeVersion) {
  const p = widget.properties, unknown = [], provenance = {}, css = {};
  const { effective, chainComplete, baseId } = resolveStyleChain(style, root, defaultStyleId);
  // P71 and P81 are independent native parameters. The stored ControlPoints
  // identify a supported rectangle, but do not supply either style parameter.
  const cornerSurface = typeCandidate?.type === 'box' && typeCandidate.sourceShape === 0 && typeCandidate.cornerRadii?.length === 4 && typeCandidate.vectorPath
    || ['input','textarea','select'].includes(typeCandidate?.type);
  const cornerParameters = entries => {
    const radius=entries.get(71),mask=entries.get(81),known=e=>e?.determined&&(!['local-object-style','stored-active-state-style'].includes(e.source.kind)||e.overridden);
    return known(radius)&&known(mask)&&Number.isFinite(radius.value)&&radius.value>=0&&radius.value<=10000&&Number.isInteger(mask.value)&&mask.value>=0&&mask.value<=15;
  };
  const baseCornersKnown = cornerSurface && chainComplete && cornerParameters(effective);
  const merge = (props, source) => { for (const [key, entry] of styleEntries(props, source)) effective.set(key, entry); };
  if (!chainComplete) unknown.push({ reason: 'No unique, matching cached base/default chain; inherited properties not resolved.' });
  const interactionStyles = effective.get(21);
  const selectionMapKnown = !interactionStyles || interactionStyles.determined && Array.isArray(interactionStyles.value?.$map);
  const selectedRef = interactionStyles?.determined ? property(interactionStyles.value, 'Selected') : undefined;
  const selectionRefKnown = selectedRef === undefined || selectedRef?.referenceTag === 3 && /^[a-f0-9]{32}$/.test(selectedRef.$reference);
  const selectedTarget = selectionRefKnown ? resolve(selectedRef) : undefined;
  const active = forcedState !== undefined ? (forcedState === null ? [] : [forcedState]) : ['Selected','Disabled','Error'].filter(key => (key === 'Selected' && forcedSelected !== undefined ? forcedSelected : property(p, key)) === true);
  if (active.length === 1) {
    const interactions = effective.get(21);
    const ref = interactions?.determined ? property(interactions.value, active[0]) : undefined, selectedStyle = ref?.referenceTag === 3 ? resolve(ref) : undefined;
    if (selectedStyle?.type === 'Axure:Style') {
      const source = { kind: 'stored-active-state-style', state: active[0], objectId: selectedStyle.id };
      const stateProps = resolvedState?.state === active[0] ? resolvedState.props : localStateProps(property(selectedStyle.properties,'PropList'),source);
      merge(stateProps, source);
    }
    else if (ref?.$reference && ref.$reference !== '0'.repeat(32)) unknown.push({ reason: `Active ${active[0]} style is unresolved.` });
  } else if (active.length > 1) unknown.push({ reason: 'Combined selected/disabled/error style precedence is not resolved.', states: active });
  const consumed = new Set([0,101,105,21]), rich = commonRichStyle(p);
  const take = (key, output, convert) => {
    const entry = effective.get(key); if (!entry?.determined) return;
    const value = convert(entry.value);
    if (value !== null && value !== undefined) { css[output] = value; provenance[output] = { ...entry.source, property: STYLE_NAMES.get(key) || key }; consumed.add(key); }
  };
  const finite = (min,max) => value => Number.isFinite(value) && value >= min && value <= max ? value : null;
  const solid = fill => property(fill, 'fill-type') === 'solid' ? argbColor(property(fill, 'fill-color')) : null;
  take(7,'fill',solid);
  take(8,'stroke',solid); take(6,'color',solid);
  for(const [key,field] of [[7,'fillGradient'],[8,'strokeGradient']]){
    const entry=effective.get(key);
    if(entry?.source.kind!=='local-object-style'||entry.overridden)take(key,field,value=>nativeFillGradient(value,nativeVersion));
    if(css[field]?.type==='linear'&&Array.isArray(nativeVersion)&&nativeVersion.length===4&&nativeVersion.every((n,i)=>n===(i===0?11:0)))provenance[field].nativeAngle={stored:property(entry.value,'fill-angle'),policy:'ignored-rp11-reserved-field',packageVersion:[...nativeVersion],readerMethodToken:100718382};
  }
  take(15,'strokeWidth',finite(0,100)); take(70,'opacity',finite(0,1));
  for (const [key,field,convert] of [[16,'linePattern',nativeLinePattern],[17,'lineEnds',nativeLineEnds]]) {
    const entry=effective.get(key);
    if(entry?.source.kind!=='local-object-style'||entry.overridden)take(key,field,convert);
  }
  take(1,'fontFamily',v => typeof v === 'string' && v.length <= 200 && /^[\p{L}\p{N}\s,'"_-]+$/u.test(v) ? v : null);
  take(2,'fontSize',v => finite(.75,384)(v) === null ? null : v / .75);
  take(1001,'fontWeight',finite(100,1000));
  const fontEntry = effective.get(1002);
  const explicitFontRequired = ['local-object-style','stored-active-state-style'].includes(fontEntry?.source.kind);
  if (!explicitFontRequired || fontEntry.overridden) take(1002,'fontStyle',nativeFontStyle);
  const decoration = value => typeof value === 'boolean' ? value : null;
  for (const [key,field] of [[5,'underline'],[95,'strikethrough']]) {
    const entry = effective.get(key);
    if (entry?.source.kind !== 'local-object-style' || entry.overridden) take(key,field,decoration);
  }
  for (const [key,field] of [[72,'outerShadow'],[73,'innerShadow'],[74,'textShadow']]) {
    const entry=effective.get(key);
    // Raw local non-overridden values are snapshots, not active paint. Keep
    // them reported as unknown rather than inventing an inherited fallback.
    if(entry?.source.kind!=='local-object-style'||entry.overridden)take(key,field,value=>nativeShadow(value,key===73));
  }
  const alignment = v => Number.isInteger(v) && v >= 0 && v <= 2 ? ['left','center','right'][v] : null;
  take(9,'textAlign',alignment);
  take(10,'verticalAlign',v => Number.isInteger(v) && v >= 0 && v <= 2 ? ['top','middle','bottom'][v] : null);
  // Zero is automatic spacing, not 0px. Browser font metrics are our rendering
  // choice for this documented subset, not a claim of exact native glyph layout.
  if (rich?.lineSpacing === 0 && effective.get(20)?.determined && effective.get(20).value === 0) {
    css.lineHeight = 'normal'; consumed.add(20);
    provenance.lineHeight = { kind: 'browser-default-for-automatic-spacing', property: 'LINE_SPACING=0 and all Paragraph.LineSpacing=0', nativeFontMetricsVerified: false };
  }
  // PName explicitly identifies left/top/right/bottom padding as 11/12/13/14.
  // Preserve the CSS clockwise order only when every side is determined.
  const paddingKeys = [12,13,14,11], padding = paddingKeys.map(key => effective.get(key));
  if (padding.every(entry => entry?.determined && finite(0,1000)(entry.value) !== null)) {
    css.textPadding = padding.map(entry => entry.value);
    provenance.textPadding = { kind: 'determined-text-padding', order: 'top,right,bottom,left', sides: padding.map((entry,i) => ({ ...entry.source, property: paddingKeys[i] })) };
    paddingKeys.forEach(key => consumed.add(key));
  }
  // Rich-text values provide actual uniform run formatting; explicit object/state overrides win.
  for (const [field,key,convert] of [['fontFamily',1,v=>typeof v==='string'&&v.length<=200&&/^[\p{L}\p{N}\s,'"_-]+$/u.test(v)?v:null],['fontSize',2,v=>finite(.75,384)(v)===null?null:v/.75],['fontWeight',1001,finite(100,1000)],['fontStyle',1002,nativeFontStyle],['color',6,argbColor],['textAlign',9,alignment],['underline',5,decoration],['strikethrough',95,decoration]]) {
    const local = effective.get(key)?.source.kind;
    if (rich && ((local !== 'local-object-style' && local !== 'stored-active-state-style') || ['fontStyle','underline','strikethrough'].includes(field) && !effective.get(key)?.overridden)) {
      if (rich.mixedFields.includes(field)) { delete css[field]; delete provenance[field]; unknown.push({ property: field, reason: 'Mixed rich-text formatting cannot be represented by one widget style.' }); continue; }
      const value = convert(rich[field]); if (value !== null && value !== undefined) { css[field] = value; provenance[field] = { kind: 'uniform-rich-text-runs', conversion: field === 'fontSize' ? 'stored Size / 0.75, evidenced in RPFormatExtensions.bJcT' : 'direct stored value' }; }
      else if (field === 'fontStyle') { delete css[field]; delete provenance[field]; unknown.push({ property: field, value: rich[field], reason: 'Uniform native AxRun.Style is absent or outside supported Normal=0 / Italic=1.' }); }
    }
  }
  const visibility = effective.get(80);
  const rectangleSurface = typeCandidate?.type === 'box' && typeCandidate.sourceShape === 0 && typeCandidate.cornerRadii?.length === 4 && typeCandidate.vectorPath
    || ['input','textarea','select'].includes(typeCandidate?.type);
  if (rectangleSurface) {
    if(visibility?.source.kind!=='local-object-style'||visibility.overridden)take(80,'borderVisibility',v=>Number.isInteger(v)&&v>=0&&v<=15?[2,4,8,1].map(bit=>Boolean(v&bit)):null);
  } else if (visibility?.determined && visibility.value === 0) {
    // Legacy none/all subset for surfaces whose partial-side native geometry
    // has not been established (including ImageBox and contained tree labels).
    css.strokeWidth = 0; provenance.strokeWidth = { ...visibility.source, property: 'BORDER_VISIBILITY=0', recovery:'legacy-none-snapshot' }; consumed.add(80);
  } else if (visibility?.determined && visibility.value === 15) consumed.add(80);
  if (baseCornersKnown && cornerParameters(effective)) {
    take(71,'radius',finite(0,10000));
    take(81,'cornerVisibility',value=>[1,2,4,8].map(bit=>Boolean(value&bit)));
  } else if (typeCandidate?.cornerRadii) {
    css.cornerRadii = typeCandidate.cornerRadii; css.radius = Math.max(...typeCandidate.cornerRadii);
    provenance.cornerRadii = { kind: 'stored-rectangle-control-path', evidence: typeCandidate.evidence }; provenance.radius = provenance.cornerRadii;
    // A path-only snapshot is retained for compatibility; missing, inactive or
    // invalid native parameters stay reported and cannot authorize regeneration.
  }
  // Preserve every unconverted property and its origin for the import report.
  for (const [key, entry] of effective) if (!consumed.has(key)) unknown.push({ property: STYLE_NAMES.get(key) || `PName:${key}`, value: entry.value, source: entry.source, reason: 'Not mapped by the restricted style converter.' });
  const visible = effective.get(110);
  const identity = defaultStyleIdentity(defaultStyleId);
  return { style: css, provenance, unknown, cacheChainComplete: chainComplete, baseStyleId: baseId ?? null, defaultStyleId: identity?.id ?? null, defaultStyleLibraryId: identity?.libraryId ?? null, visible: visible?.determined && typeof visible.value === 'boolean' ? visible.value : null,
    resolvedGeometry: chainComplete ? { location: coordinatePair(effective.get(101), ['X','Y']), size: coordinatePair(effective.get(105), ['Width','Height']) } : null,
    boundsRecovery: { outerShadowAbsent: effective.get(72)?.determined === true && property(effective.get(72).value, 'On') === false },
    selectedStyleReference: selectedRef ?? null, selectedStyleResolved: Boolean(selectionMapKnown && selectionRefKnown && (!selectedRef || selectedRef.$reference === '0'.repeat(32) || selectedTarget?.type === 'Axure:Style')),
    ...(widget.type === 'Axure:DiagramObject:ImageBox' ? { imageProperties: Object.fromEntries([30,71,90,50,1401].map(key => [key, effective.get(key) ?? null])) } : {}) };
}

const INTERACTION_STYLE_STATES = Object.freeze({ mouseover: 'MouseOver', mousedown: 'MouseDown', focused: 'Focused', disabled: 'Disabled' });
const INTERACTION_STYLE_FIELDS = new Map([[1,'fontFamily'],[2,'fontSize'],[5,'underline'],[6,'color'],[7,'fill'],[8,'stroke'],[9,'textAlign'],[10,'verticalAlign'],[15,'strokeWidth'],[16,'linePattern'],[17,'lineEnds'],[20,'lineHeight'],[70,'opacity'],[71,'radius'],[72,'outerShadow'],[73,'innerShadow'],[74,'textShadow'],[80,'borderVisibility'],[81,'cornerVisibility'],[95,'strikethrough'],[1001,'fontWeight'],[1002,'fontStyle']]);
/** Independent, explicit appearance patches. This does not evaluate combined native state precedence. */
export function recoverInteractionStyles(widget, style, root, defaultStyleId, resolve, typeCandidate, nativeVersion) {
  return recoverNamedInteractionStyles(widget, style, root, defaultStyleId, resolve, typeCandidate, INTERACTION_STYLE_STATES, false, nativeVersion);
}
function recoverNamedInteractionStyles(widget, style, root, defaultStyleId, resolve, typeCandidate, stateNames, allowNamedColors = false, nativeVersion) {
  try {
    const { effective, chainComplete } = resolveStyleChain(style, root, defaultStyleId);
    const entry = effective.get(21), rawMap = entry?.value;
    if (!chainComplete && (!entry?.determined || !entry.overridden || entry.source.kind !== 'local-object-style')) throw new Error('Interaction styles have neither a complete cache chain nor an explicit local IX_STYLES map');
    const pairs = entry === undefined ? [] : rawMap?.$map;
    if (entry && (!entry.determined || !Array.isArray(pairs) || pairs.length > 7)) throw new Error('Unknown or invalid IX_STYLES map');
    const names = new Set(), knownStates = new Set([...Object.values(INTERACTION_STYLE_STATES),'Selected','Error','Hint']);
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || !knownStates.has(pair[0]) || names.has(pair[0])) throw new Error('Unknown or duplicate interaction state key');
      names.add(pair[0]);
    }
    const base = recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, undefined, null, undefined, nativeVersion);
    const states = {};
    for (const [name, sourceState] of Object.entries(stateNames)) {
      const record = { sourceState }, ref = property(rawMap, sourceState);
      try {
        if (ref === undefined) {
          if (!chainComplete) throw new Error('An absent local state cannot establish absence in an unresolved base style');
          states[name] = { ...record, status: 'no-state-style' }; continue;
        }
        if (ref?.referenceTag !== 3 || typeof ref.$reference !== 'string' || !/^[a-f0-9]{32}$/.test(ref.$reference) || Object.keys(ref).some(key => !['$reference','referenceTag'].includes(key))) throw new Error('Invalid local interaction-style reference');
        if (ref.$reference === '0'.repeat(32)) { states[name] = { ...record, status: 'no-state-style' }; continue; }
        record.sourceStyleId = ref.$reference;
        const target = resolve(ref);
        if (target?.type !== 'Axure:Style') throw new Error('Unresolved or wrong-type interaction-style target');
        const knownStyleKeys = new Set(['LibraryId','LibraryName','LegacyName','style-name','Id','PropList','Capabilities','All']);
        if (allowNamedColors) knownStyleKeys.add('MatchInfo');
        if (!Array.isArray(target.properties?.$map) || target.properties.$map.some(pair => !Array.isArray(pair) || pair.length !== 2 || !knownStyleKeys.has(pair[0]))) throw new Error('Unknown interaction-style metadata or inheritance');
        if (property(target.properties, 'All') !== false) throw new Error('Only explicit local interaction-style patches are recovered');
        let props = property(target.properties, 'PropList');
        if (!Array.isArray(props)) throw new Error('Interaction style requires an explicit PropList array');
        props = localStateProps(props, { kind: 'interaction-state-style', state: sourceState, objectId: target.id });
        let entries = styleEntries(props, { kind: 'interaction-state-style', state: sourceState, objectId: target.id });
        if (allowNamedColors && (entries.has(0) || property(target.properties, 'MatchInfo') !== undefined)) {
          const base = entries.get(0), match = property(target.properties, 'MatchInfo'), styleId = property(match, 'Id')?.$guid, libraryId = property(match, 'LibraryId')?.$guid;
          if (!base?.determined || !base.overridden || base.value?.$guid !== styleId || !/^[a-f0-9]{32}$/.test(styleId) || !/^[a-f0-9]{32}$/.test(libraryId) || property(target.properties,'LibraryId')?.$guid !== libraryId) throw new Error('Named state style identity is not explicit and matching');
          const caches = property(property(root.properties,'StyleCache'),'Styles');
          const matches = Array.isArray(caches) ? caches.filter(cache => property(property(cache,'Info'),'Id')?.$guid === styleId && property(property(cache,'Info'),'LibraryId')?.$guid === libraryId) : [];
          if (matches.length !== 1) throw new Error('Named state cache is missing or ambiguous');
          const cached = property(matches[0],'Props'), inherited = styleEntries(cached,{kind:'cached-interaction-state-style',styleId,libraryId});
          if (!inherited.size || [...inherited].some(([key,e]) => ![6,7,8].includes(key) || !e.determined || property(e.value,'fill-type')!=='solid') || [...entries].some(([key,e]) => ![0,6,7,8].includes(key) || !e.determined || !e.overridden || key!==0&&property(e.value,'fill-type')!=='solid')) throw new Error('Named state cache supports only complete solid color patches');
          record.namedStyleMatch = { styleId, libraryId, localProperties:[...entries.keys()] };
          props = [...cached, ...props.filter(prop => (property(prop,'DOAName') & 0x0fffffff) !== 0)];
          const merged = new Map();for(const prop of props)merged.set(property(prop,'DOAName') & 0x0fffffff,prop);props=[...merged.values()];
          entries = styleEntries(props,{kind:'cached-interaction-state-style',styleId,libraryId});
        }
        record.sourceProperties = [...entries.keys()];
        if (!chainComplete) {
          // A directly stored solid color fully specifies that color, regardless of
          // normal appearance. Do not extend this rule to geometry/font inheritance.
          if (!entries.size || [...entries].some(([key,value]) => ![6,7,8].includes(key) || !value.determined || !value.overridden || property(value.value,'fill-type')!=='solid')) throw new Error('Unresolved base style permits only explicit independent solid color properties');
          record.independentOfInheritedBase = true;
        }
        const paddingKeys = [12,13,14,11], hasPadding = paddingKeys.some(key => entries.has(key));
        if (hasPadding && !paddingKeys.every(key => entries.has(key))) throw new Error('Partial state text padding cannot be represented by a complete style tuple');
        for (const [key, value] of entries) {
          if (!INTERACTION_STYLE_FIELDS.has(key) && !paddingKeys.includes(key)) throw new Error(`Unsupported interaction style property ${key}`);
          if (!value.determined) throw new Error(`Undetermined interaction style property ${key}`);
          if (key === 1002 && !value.overridden) throw new Error('Font style requires an explicit overridden property 1002');
        }
        // Named-color materialization has already validated its exact cache
        // identity. Its determined cache records must not be filtered as local.
        const active = recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, undefined, sourceState, {state:sourceState,props}, nativeVersion);
        if (active.unknown.some(item => item.source?.kind === 'stored-active-state-style')) throw new Error('Interaction style contains values that cannot be represented');
        const outputs = [...entries.keys()].map(key => key===7&&Object.hasOwn(active.style,'fillGradient')?'fillGradient':key===8&&Object.hasOwn(active.style,'strokeGradient')?'strokeGradient':INTERACTION_STYLE_FIELDS.get(key)).filter(Boolean);
        if (hasPadding) outputs.push('textPadding');
        const patch = {}, provenance = {};
        for (const output of outputs) {
          if (!Object.hasOwn(active.style, output)) throw new Error(`Interaction style ${output} has no supported value`);
          // Keep an explicitly stored reset even when it equals the normal appearance.
          patch[output] = active.style[output]; provenance[output] = { ...active.provenance[output], ...(record.namedStyleMatch ? { namedStyleMatch:record.namedStyleMatch } : {}) };
        }
        states[name] = { ...record, status: 'supported-state-style', style: patch, provenance };
      } catch (error) { states[name] = { ...record, status: 'unsupported-state-style', reason: error.message }; }
    }
    return { status: 'recovered-interaction-styles', cacheChainComplete: chainComplete, baseStyleRecovery: { style: base.style, provenance: base.provenance, visible: base.visible }, states,
      unhandledStates: ['Error','Hint'].filter(name => names.has(name) && !Object.values(stateNames).includes(name)), evidence: 'PName.IX_STYLES=21, IxStyleState metadata, local Style references and explicit PropList appearance fields; no native combined-state evaluation' };
  } catch (error) { return { status: 'unsupported-interaction-styles', reason: error.message }; }
}

/** Local declarations only: do not flatten inherited view properties or create an
 * empty state-style boundary merely because an ordinary Style has no properties.
 * Native eligibility and shallow geometry/state-map semantics are recorded in
 * adaptive-import-styles-evidence. Unknown active properties reject the owner.
 */
export function recoverLocalAdaptiveStyles(widget, style, root, defaultStyleId, resolve, typeCandidate, nativeVersion, compoundDescendant = false) {
  const identity={schema:1,sourceId:widget.id};
  try {
    const fail=message=>{throw new Error(message);},zero='0'.repeat(32),validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
    const exact=(value,keys)=>{
      if(!value||Object.keys(value).length!==1||!Array.isArray(value.$map)||value.$map.length!==keys.length||value.$map.some(pair=>!Array.isArray(pair)||pair.length!==2||!keys.includes(pair[0]))||new Set(value.$map.map(pair=>pair[0])).size!==keys.length)fail('Invalid local adaptive property map');
    };
    const reference=value=>{if(!value||Object.keys(value).length!==2||value.referenceTag!==3||!validId(value.$reference))fail('Invalid local adaptive Style reference');return value.$reference;};
    if(!Array.isArray(nativeVersion)||!['9.0.0.0','9.0.1.0','10.0.1.0','10.0.3.0','10.0.4.0','11.0.0.0'].includes(nativeVersion.join('.')))fail('Unsupported local adaptive package version');
    const raw=property(widget.properties,'AdaptiveStyles');
    if(!Array.isArray(raw)||raw.length%2||raw.length>2000)fail('AdaptiveStyles must contain bounded alternating GUID/reference pairs');
    const records=target=>{
      if(target?.type!=='Axure:Style')fail('Unresolved or wrong-type local adaptive Style');
      const pairs=target.properties?.$map,allowed=['LibraryId','LibraryName','LegacyName','style-name','Id','PropList','Capabilities','All'];
      if(!Array.isArray(pairs)||pairs.some(p=>!Array.isArray(p)||p.length!==2||!allowed.includes(p[0]))||new Set(pairs.map(p=>p[0])).size!==pairs.length||property(target.properties,'All')!==false)fail('Unknown local adaptive Style metadata or inheritance');
      const props=property(target.properties,'PropList');if(!Array.isArray(props)||props.length>1000)fail('Missing or oversized local adaptive PropList');
      for(const p of props){exact(p,['DOAName','Value']);const raw=property(p,'DOAName');if(!Number.isInteger(raw)||raw< -2147483648||raw>2147483647)fail('Invalid native local DOAName');if((raw&PROPERTY_NAME_MASK)===111){if(nativeVersion.join('.')!=='11.0.0.0')fail('Local placement requires the evidenced RP11 package version');nativePlaced(property(p,'Value'));}
        const key=raw&PROPERTY_NAME_MASK;if(AUTHOR_PIN_KEYS.includes(key)&&(nativeVersion.join('.')!=='11.0.0.0'||(raw&0x3fffffff)!==key||!validAuthorPin(key,property(p,'Value'))))fail('Invalid or unevidenced local author pin carrier');
      }
      const all=styleEntries(props,{kind:'native-local-adaptive-style',objectId:target.id}),eligible=new Map([...all].filter(([,e])=>e.determined&&e.overridden));
      return {props,eligible,source:props.map(p=>({rawDoaName:property(p,'DOAName'),value:property(p,'Value')}))};
    };
    const visual=(props,entries)=>{
      const padding=[12,13,14,11];
      if(entries.has(71)||entries.has(81)){
        const original=recoverStyle(widget,style,root,defaultStyleId,resolve,typeCandidate,undefined,null,undefined,nativeVersion);
        if(!original.cacheChainComplete||!original.style.cornerVisibility||original.provenance.radius?.property!=='CORNER_RADIUS')fail('Local adaptive corners require complete proven native base radius and mask');
      }
      if(padding.some(key=>entries.has(key))&&!padding.every(key=>entries.has(key)))fail('Partial local adaptive padding cannot be represented without freezing inherited sides');
      for(const key of entries.keys())if(!INTERACTION_STYLE_FIELDS.has(key)&&!padding.includes(key))fail(`Unsupported local adaptive visual property ${key}`);
      for(const [key,entry]of entries)if([6,7,8].includes(key)&&property(entry.value,'fill-type')==='solid')exact(entry.value,['fill-type','fill-color']);
      // The merged carrier provides the existing type-specific conversion context,
      // but only explicitly eligible output keys are copied to the delta below.
      const baseProps=property(style?.properties,'PropList')??[],merged=new Map(baseProps.map(p=>[property(p,'DOAName')&PROPERTY_NAME_MASK,p]));
      for(const p of props)if(entries.has(property(p,'DOAName')&PROPERTY_NAME_MASK))merged.set(property(p,'DOAName')&PROPERTY_NAME_MASK,p);
      const local={...style,properties:{$map:[...(style?.properties?.$map??[]).filter(([k])=>k!=='PropList'),['PropList',[...merged.values()]]]}};
      const active=recoverStyle(widget,local,root,defaultStyleId,resolve,typeCandidate,undefined,null,undefined,nativeVersion),patch={};
      for(const key of entries.keys()){
        if(padding.includes(key))continue;
        const output=key===7&&Object.hasOwn(active.style,'fillGradient')?'fillGradient':key===8&&Object.hasOwn(active.style,'strokeGradient')?'strokeGradient':INTERACTION_STYLE_FIELDS.get(key);
        if(!Object.hasOwn(active.style,output)||active.provenance[output]?.kind!=='local-object-style'&&!(key===20&&active.provenance[output]?.kind==='browser-default-for-automatic-spacing'))fail(`Unrepresentable local adaptive visual value ${key}`);
        patch[output]=active.style[output];
      }
      if(padding.every(key=>entries.has(key))){if(!active.style.textPadding||!active.provenance.textPadding.sides.every(p=>p.kind==='local-object-style'))fail('Unrepresentable adaptive text padding');patch.textPadding=active.style.textPadding;}
      return patch;
    };
    const states={MouseOver:'mouseOver',MouseDown:'mouseDown',Focused:'focused',Selected:'selected',Error:'error',Hint:'hint',Disabled:'disabled'},seen=new Set(),entries=[];
    for(let i=0;i<raw.length;i+=2){
      const tagged=raw[i],viewId=tagged?.$guid;
      if(!tagged||Object.keys(tagged).length!==1||!validId(viewId)||[zero,NATIVE_BASE_VIEW_ID,NATIVE_AUTO_VIEW_ID].includes(viewId)||seen.has(viewId))fail('Invalid, reserved or duplicate adaptive view identity');
      seen.add(viewId);const styleId=reference(raw[i+1]);if(styleId===zero)fail('Zero local adaptive Style reference');
      const local=records(resolve(raw[i+1])),patch={},stateStyleSources=[],visualEntries=new Map();
      for(const [key,e]of local.eligible){
        if(key===101||key===105){
          const keys=key===101?['X','Y']:['Width','Height'];exact(e.value,keys);
          const values=keys.map(k=>property(e.value,k));if(values.some(n=>!Number.isFinite(n)||n< (key===105?1:-100000)||n>100000))fail('Invalid local adaptive geometry');
          if(key===101)[patch.x,patch.y]=values;else[patch.width,patch.height]=values;
        }else if(key===110){if(typeof e.value!=='boolean')fail('Invalid adaptive visibility');patch.hidden=!e.value;
        }else if(key===111){if(!placementSurface(widget,typeCandidate,compoundDescendant))fail('Independent adaptive placement of this contained or compound descendant is unsupported');patch.placed=nativePlaced(e.value);
        }else if(AUTHOR_PIN_KEYS.includes(key)){
          if(nativeVersion.join('.')!=='11.0.0.0'||!validAuthorPin(key,e.value))fail('Invalid or unevidenced local author pin');
          const name=key===106?'pinHorizontal':key===107?'pinVertical':key===108?'fixedHeight':'fixedWidth';
          const names=key===106?{0:'none',1:'left',4:'right',5:'both',256:'center'}:{0:'none',2:'top',8:'bottom',10:'both',512:'center'};
          patch.style={...patch.style,[name]:key<108?names[e.value]:e.value};
        }else if(key===21){
          const pairs=e.value?.$map;if(!e.value||Object.keys(e.value).length!==1||!Array.isArray(pairs)||pairs.length>7||pairs.some(p=>!Array.isArray(p)||p.length!==2||!Object.hasOwn(states,p[0]))||new Set(pairs.map(p=>p[0])).size!==pairs.length)fail('Invalid local adaptive state-style map');
          patch.stateStyles={};
          for(const [name,ref]of pairs){const id=reference(ref);if(id===zero)continue;const s=records(resolve(ref)),state=states[name];patch.stateStyles[state]=visual(s.props,s.eligible);stateStyleSources.push({state,sourceId:id,properties:s.source});}
        }else visualEntries.set(key,e);
      }
      if(visualEntries.size)patch.style={...patch.style,...visual(local.props,visualEntries)};
      entries.push({viewId,styleId,status:'supported-local-adaptive-style',patch,source:{kind:'native-local-adaptive-style',packageVersion:[...nativeVersion],properties:local.source,stateStyleSources}});
    }
    return {...identity,status:'decoded-adaptive-styles',entries};
  }catch(error){return {...identity,status:'unsupported-adaptive-styles',reason:error.message};}
}

export function recoverErrorHint(widget, style, root, defaultStyleId, resolve, typeCandidate, nativeVersion) {
  try {
    const error = property(widget.properties,'Error');
    if (typeof error !== 'boolean') throw new Error('Initial Error flag is not explicitly known');
    const input = ['Axure:DiagramObject:TextBox','Axure:DiagramObject:TextArea'].includes(widget.type);
    let inputHint;
    if (input) {
      const hintText = property(widget.properties,'PlaceholderText'), hide = property(widget.properties,'HideHintOnFocus');
      if (typeof hintText !== 'string' || hintText.length > 100000 || typeof hide !== 'boolean') throw new Error('Hint text or focus policy is not explicitly known');
      if (hintText.includes('[[') || hintText.includes(']]')) throw new Error('Hint expression substitution has not been recovered');
      inputHint = { hintText, hintHideOn:hide?'focus':'typing', sourceFields:['PlaceholderText','HideHintOnFocus'] };
    }
    const { baseStyleRecovery: _base, ...styles } = recoverNamedInteractionStyles(widget,style,root,defaultStyleId,resolve,typeCandidate,{error:'Error',hint:'Hint'},true,nativeVersion);
    return { status:'recovered-error-hint', error, ...(inputHint ? {inputHint} : {}),
      ...(error ? {normalStyleRecovery:recoverStyle(widget,style,root,defaultStyleId,resolve,typeCandidate,undefined,null,undefined,nativeVersion)} : {}), styles };
  } catch(error) { return { status:'unsupported-error-hint',reason:error.message }; }
}

/** Source group identity survives unsupported geometry, styles, and type candidates. */
export function recoverSelectionGroups(widget) {
  try {
    const name = (value, field) => {
      if (typeof value !== 'string' || value.length > 256 || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new Error(`Unknown or invalid ${field}`);
      return value;
    };
    const selectionGroup = name(property(widget.properties, 'SelectedStyleGroup'), 'selection group');
    const radioGroup = widget.type === 'Axure:DiagramObject:RadioButton' ? name(property(widget.properties, 'radio-group'), 'radio group') : undefined;
    return { status: 'known-selection-groups', selectionGroup, ...(radioGroup === undefined ? {} : { radioGroup }) };
  } catch (error) { return { status: 'unknown-selection-groups', reason: error.message }; }
}

export function recoverSelection(widget, style, root, defaultStyleId, resolve, typeCandidate, nativeVersion) {
  try {
    const p = widget.properties, selected = property(p, 'Selected'), groups = recoverSelectionGroups(widget);
    if (groups.status !== 'known-selection-groups') throw new Error(groups.reason);
    const group = groups.selectionGroup;
    if (typeof selected !== 'boolean') throw new Error('Unknown selected state');
    if (property(p, 'Disabled') !== false || property(p, 'Error') !== false) throw new Error('Combined disabled/error selection appearance is not recovered');
    const base = recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, false, undefined, undefined, nativeVersion);
    const active = recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, true, undefined, undefined, nativeVersion);
    if (!base.cacheChainComplete || !active.selectedStyleResolved) throw new Error('Selection style has an unresolved cache or reference');
    const target = resolve(active.selectedStyleReference);
    const selectedOutputs = new Set();
    if (target) {
      const knownStyleKeys = new Set(['LibraryId','LibraryName','LegacyName','style-name','Id','PropList','Capabilities','All']);
      if (!Array.isArray(target.properties?.$map) || target.properties.$map.some(pair => !Array.isArray(pair) || pair.length !== 2 || !knownStyleKeys.has(pair[0])) || property(target.properties,'All') !== false) throw new Error('Unknown selected style metadata or inheritance');
      const supported = new Set([1,2,5,6,7,8,9,10,11,12,13,14,15,16,17,20,70,71,72,73,74,80,81,95,1001,1002]);
      const selectedProps = property(target.properties, 'PropList');
      if (!Array.isArray(selectedProps)) throw new Error('Selected style requires an explicit PropList array');
      const entries = styleEntries(localStateProps(selectedProps,{kind:'selected'}),{kind:'selected'});
      const paddingKeys = [12,13,14,11];
      if (paddingKeys.some(key=>entries.has(key)) && !paddingKeys.every(key=>entries.has(key))) throw new Error('Partial selected text padding cannot be represented by a complete style tuple');
      for (const [key, entry] of entries) {
        if (!supported.has(key) || !entry.determined) throw new Error(`Unsupported selected style property ${key}`);
        selectedOutputs.add(paddingKeys.includes(key)?'textPadding':key===80&&!Object.hasOwn(active.style,'borderVisibility')?'strokeWidth':key===7&&Object.hasOwn(active.style,'fillGradient')?'fillGradient':key===8&&Object.hasOwn(active.style,'strokeGradient')?'strokeGradient':INTERACTION_STYLE_FIELDS.get(key));
      }
      if (active.unknown.some(item => item.source?.kind === 'stored-active-state-style')) throw new Error('Selected style contains values that cannot be represented');
    }
    const selectedStyle = {};
    for (const key of selectedOutputs) {
      if (!Object.hasOwn(active.style,key)) throw new Error(`Selected style ${key} has no supported value`);
      selectedStyle[key] = active.style[key];
    }
    const result = { status: 'supported-selection', selected, selectionGroup: group, baseStyleRecovery: { style: base.style, provenance: base.provenance, visible: base.visible }, selectedStyle, evidence: 'Native Selected and SelectedStyleGroup; selected style remains separate from base appearance' };
    if (typeCandidate?.type === 'radio') {
      if (groups.radioGroup === undefined || group) throw new Error('Unknown or combined radio/selection grouping');
      result.radioGroup = groups.radioGroup;
    } else if (typeCandidate?.type === 'checkbox' && group) throw new Error('Checkbox selection-style groups are not recovered');
    return result;
  } catch (error) { return { status: 'unsupported-selection', reason: error.message }; }
}

export function recoverEmbeddedImage(widget, style, size, styleRecovery, part, budget) {
  let source;
  try {
    const p = widget.properties, entry = storedStyleProperty(style, 27);
    if (!entry?.determined || !entry.overridden) imageError('Image depends on absent, undetermined or inherited IMAGE property');
    const stream = property(entry.value, 'Stream')?.$bytes, extension = property(entry.value, 'Extension');
    source = { styleId: style.id, property: 'IMAGE=27', storedExtension: extension ?? null, storedHash: property(entry.value, 'Hash') ?? null, stream: stream ?? null, packagePath: part?.path ?? null };
    if (!stream) imageError('No embedded Stream; vector/hash-only/external image references are unsupported');
    if (extension !== '.png' && extension !== '') imageError('Only explicit PNG or empty extension with validated PNG bytes is supported');
    if (property(p, 'fit-to-image') !== false || property(p, 'AutoFitWidth') !== false || property(p, 'AutoFitHeight') !== false) imageError('Image automatic sizing/fit-to-image is unsupported');
    const corners = property(p, 'PreserveCornersRectangle');
    if (!['X','Y','Width','Height'].every(key => property(corners, key) === 0)) imageError('Image preserve-corners/nine-slice geometry is unsupported');
    if (['Selected','Disabled','Error'].some(key => property(p, key) !== false)) imageError('Image interaction-state appearance is unsupported');
    if (!styleRecovery.cacheChainComplete || styleRecovery.style.strokeWidth !== 0) imageError('Image needs a resolved cache chain and zero border for verified aspect mapping');
    const known = key => { const v = styleRecovery.imageProperties?.[key];if (!v?.determined) imageError(`Image layout property ${key} is unresolved`);return v.value; };
    if (known(30) !== 0 || known(71) !== 0 || known(50) !== 0 || property(known(90), 'On') !== false) imageError('Image repetition, corner clipping, rotation or filters are unsupported');
    const transform = known(1401);
    if (![['ScaleX',1],['ScaleY',1],['TranslateX',0],['TranslateY',0],['Rotate',0]].every(([key,v]) => property(transform,key) === v)) imageError('Image transform is unsupported');
    if (!size?.determined || !size.overridden) imageError('Image stored size is unresolved');
    if (!part || !Buffer.isBuffer(part.data) || !Number.isSafeInteger(stream.offset) || !Number.isSafeInteger(stream.length) || stream.offset < 0 || stream.length < 1 || stream.length > IMAGE_LIMITS.bytes || stream.offset + stream.length > part.data.length) imageError('Embedded image byte range/limit is invalid');
    const bytes = part.data.subarray(stream.offset, stream.offset + stream.length);
    if (digest(bytes) !== stream.sha256) imageError('Embedded image source SHA-256 mismatch');
    const image = inspectStaticPng(bytes), { Width, Height } = size.value;
    if (!Number.isFinite(Width) || !Number.isFinite(Height) || Width <= 0 || Height <= 0 || Math.abs(Width * image.height - Height * image.width) > 1e-6) imageError('Image target/source aspect ratios differ; crop/stretch mapping is not inferred');
    const characters = 22 + 4 * Math.ceil(bytes.length / 3);
    if (!budget || !Number.isSafeInteger(budget.used) || budget.used < 0 || budget.used + characters > IMAGE_LIMITS.dataUrlCharacters) imageError('Total embedded image data URL budget exceeded');
    budget.used += characters;
    return { status: 'validated-embedded-png', ...image, source, mapping: 'same-aspect-stored-rectangle', dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
  } catch (error) { return { status: 'unsupported-image', reason: error.message, ...(source ? { source } : {}) }; }
}

export function recoverPlainText(props) {
  const plain = property(props, 'TextBlock');
  if (plain !== undefined) {
    const text = property(plain, 'text');
    return typeof text === 'string' ? { status: 'stored-plain-text', text } : { status: 'unsupported-plain-text' };
  }
  const rich = property(props, 'RichTextBlock');
  if (rich === undefined) return { status: 'no-observed-text-field' };
  const paragraphs = property(property(rich, 'attributed-string'), 'Paragraphs');
  if (!Array.isArray(paragraphs)) return { status: 'unsupported-rich-text' };
  const texts = [];
  for (const paragraph of paragraphs) {
    const inlines = property(paragraph, 'Inlines');
    if (!Array.isArray(inlines)) return { status: 'unsupported-rich-text' };
    let text = '';
    for (const inline of inlines) {
      const type = property(inline, 'Type'), value = property(inline, 'Text');
      if (type !== 'Axure:AttributedString:AxRun' || typeof value !== 'string') return { status: 'unsupported-rich-text-inline', inlineType: type ?? null };
      text += value;
    }
    texts.push(text);
  }
  return { status: 'stored-rich-text-as-plain', text: texts.join('\n'), paragraphCount: texts.length, formattingRecovered: false };
}

/** Native identities remain local here; the importer resolves admitted targets atomically. */
export function normalizeNativeLinkInteractions(recovery) {
  if (recovery?.status !== 'decoded-interaction-tree' || !Array.isArray(recovery.events)) throw new Error('Unresolved hyperlink interaction tree');
  const seenEvents = new Set(), interactions = [];
  for (const event of recovery.events) {
    if (event.status !== 'supported-event' || event.event !== 'click' || event.nativeEventType !== 16 || seenEvents.has(event.nativeEventType)) throw new Error(`Unsupported or duplicate hyperlink event: ${event.reason ?? event.nativeEventType}`);
    seenEvents.add(event.nativeEventType);
    for (const c of event.cases) interactions.push({id:c.id,name:c.name,event:'click',enabled:c.enabled,isNewIfGroup:c.isNewIfGroup,conditionMode:c.conditionMode,
      conditions:c.conditions.map(p=>({source:p.source,key:p.source==='variable'?p.key:p.targetSourceId,operator:p.operator,value:p.value,comparisonMode:p.comparisonMode})),
      actions:c.actions.map((a,i)=>({id:`native-a-${c.id}-${i}`,type:a.type,
        ...(a.targetSourceId?{targetId:a.targetSourceId}:a.type==='openPage'?{targetId:a.targetPackageId}:{}),
        ...(a.type==='setState'?{value:a.targetPackageId}:a.value!==undefined?{value:a.value}:{}),
        ...(a.selectText!==undefined?{selectText:a.selectText}:{}),...(a.windowTarget!==undefined?{windowTarget:a.windowTarget}:{}),
        ...(a.type==='setAdaptiveView'?{adaptiveView:a.adaptiveView.kind==='nativeGuid'?{kind:'view',viewId:a.adaptiveView.guid}:{...a.adaptiveView}}:{})}))});
  }
  if (interactions.length > 100) throw new Error('Hyperlink case count exceeds 100');
  return interactions;
}

function recoverNativeInlineLink(ref, context) {
  const {objects,root,packageId} = context ?? {};
  const fail=message=>{throw new Error(message);},zero='0'.repeat(32);
  const reference=value=>{if(!value||Object.keys(value).length!==2||value.referenceTag!==3||!/^[a-f0-9]{32}$/.test(value.$reference)||value.$reference===zero)fail('Invalid hyperlink local reference');return value.$reference;};
  if (!(objects instanceof Map)||!root||typeof packageId!=='string')fail('Hyperlink requires its original local package context');
  const id=reference(ref),link=objects.get(id);
  if(link?.id!==id||link.type!=='Axure:DiagramObject:Hyperlink')fail('Unresolved or wrong-type native hyperlink');
  const exact=(value,keys)=>{if(!Array.isArray(value?.$map)||value.$map.length!==keys.length||keys.some(k=>value.$map.filter(p=>Array.isArray(p)&&p.length===2&&p[0]===k).length!==1))fail('Unknown or duplicate hyperlink fields');};
  exact(link.properties,['name-block','tooltip','IsContained','IsLocked','SelectedStyleGroup','InteractionMap','MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings']);
  const p=key=>property(link.properties,key);
  for(const key of ['IsContained','IsLocked','Disabled','Selected','Error'])if(p(key)!==false)fail(`Unsupported hyperlink flag ${key}`);
  if(p('VisibleFromSettings')!==true||p('SelectedStyleGroup')!==''||p('tooltip')!==''||!Array.isArray(p('AdaptiveStyles'))||p('AdaptiveStyles').length||p('SubmitButton')?.referenceTag!==3||p('SubmitButton')?.$reference!==zero)fail('Unsupported hyperlink behavior metadata');
  const nameBlock=p('name-block');exact(nameBlock,['*type','text','property-dictionary']);
  if(property(nameBlock,'*type')!=='text-block'||typeof property(nameBlock,'text')!=='string'||property(nameBlock,'text').length>500)fail('Invalid hyperlink name');
  const name=property(nameBlock,'text'),dictionary=property(nameBlock,'property-dictionary');exact(dictionary,['type','diagram-object-id','parent-diagram-id']);
  if(property(dictionary,'type')!=='label'||!storedGuid(property(dictionary,'diagram-object-id'))||!storedGuid(property(dictionary,'parent-diagram-id')))fail('Invalid hyperlink label metadata');
  const typography=new Map([[1,'fontFamily'],[2,'fontSize'],[5,'underline'],[6,'color'],[95,'strikethrough'],[1001,'fontWeight'],[1002,'fontStyle']]);
  const style=objects.get(reference(p('MyStyle'))),styleSources=[];
  const materialize=(object,normal=false,stateName='normal')=>{
    if(object?.type!=='Axure:Style')fail('Unresolved hyperlink style');
    exact(object.properties,['LibraryId','LibraryName','MatchInfo','LegacyName','style-name','Id','PropList','Capabilities','All']);
    if(property(object.properties,'All')!==false)fail('Unsupported hyperlink style inheritance mode');
    const source={kind:'native-hyperlink-style',objectId:object.id},all=styleEntries(property(object.properties,'PropList'),source),local=new Map([...all].filter(([,v])=>v.determined&&v.overridden));
    const base=local.get(0),match=property(object.properties,'MatchInfo'),styleId=storedGuid(property(match,'Id')),libraryId=storedGuid(property(match,'LibraryId'));
    const localLibraryId=storedGuid(property(object.properties,'LibraryId'));
    if(!base||storedGuid(base.value)!==styleId||!styleId||styleId===zero||!libraryId||![zero,libraryId].includes(localLibraryId))fail('Unmatched hyperlink named style identity');
    const caches=property(property(root.properties,'StyleCache'),'Styles');
    const matches=Array.isArray(caches)?caches.filter(c=>storedGuid(property(property(c,'Info'),'Id'))===styleId&&storedGuid(property(property(c,'Info'),'LibraryId'))===libraryId):[];
    if(matches.length!==1)fail('Missing or ambiguous hyperlink named cache');
    const inherited=styleEntries(property(matches[0],'Props'),{kind:'cached-hyperlink-style',styleId,libraryId});
    if([...inherited].some(([k,v])=>!typography.has(k)||!v.determined)||[...local].some(([k])=>k!==0&&(!normal||k!==21)&&!typography.has(k)))fail('Unsupported hyperlink named or local style property');
    const merged=new Map(inherited);for(const [k,v]of local)if(typography.has(k))merged.set(k,v);
    const patch={};for(const [k,v]of merged){let value=v.value;
      if(k===1){if(typeof value!=='string'||!value.length||value.length>200||!/^[\p{L}\p{N}\s,'"_-]+$/u.test(value))fail('Unsupported hyperlink font');}
      else if(k===2){if(!Number.isFinite(value)||value<.75||value>384)fail('Unsupported hyperlink font size');value/=.75;}
      else if(k===1001){if(!Number.isFinite(value)||value<100||value>1000)fail('Unsupported hyperlink font weight');}
      else if(k===1002){value=nativeFontStyle(value);if(!value)fail('Unsupported hyperlink font style');}
      else if(k===5||k===95){if(typeof value!=='boolean')fail('Invalid hyperlink decoration');}
      else if(k===6){exact(value,['fill-type','fill-color']);if(property(value,'fill-type')!=='solid'||!(value=argbColor(property(value,'fill-color'))))fail('Unsupported hyperlink color');}
      patch[typography.get(k)]=value;
    }
    styleSources.push({state:stateName,sourceStyleId:object.id,styleId,libraryId,localLibraryId,localProperties:[...local.keys()],sourceProperties:[...merged.keys()],style:patch});
    return {patch,local};
  };
  const base=materialize(style,true),states={},ix=base.local.get(21);
  if(!ix||!Array.isArray(ix.value?.$map)||ix.value.$map.length>2)fail('Hyperlink interaction style identity not explicit');
  const seen=new Set();for(const pair of ix.value.$map){if(!Array.isArray(pair)||pair.length!==2||!['MouseOver','MouseDown'].includes(pair[0])||seen.has(pair[0]))fail('Unsupported or duplicate hyperlink state');seen.add(pair[0]);
    const state=objects.get(reference(pair[1]));states[pair[0]==='MouseOver'?'mouseOverStyle':'mouseDownStyle']=materialize(state,false,pair[0]).patch;
  }
  const interactionRecovery=recoverInteractionMap({owner:link,objects,packageId}),interactions=normalizeNativeLinkInteractions(interactionRecovery);
  return {definition:{id,name,interactions,...states},normalStyle:base.patch,source:{id,sourceType:link.type,styleSources,interactionRecovery}};
}

/** Paragraph/run data is literal content, never generated HTML or an expression. */
export function recoverRichText(widget, context) {
  const block = property(widget.properties, 'RichTextBlock');
  if (block === undefined) return { status: 'no-rich-text' };
  try {
    const exact = (value, keys) => {
      if (!value || !Array.isArray(value.$map) || value.$map.length !== keys.length || keys.some(key => value.$map.filter(pair => Array.isArray(pair) && pair.length === 2 && pair[0] === key).length !== 1)) throw new Error('Unknown or duplicate rich-text fields');
    };
    exact(block, ['*type','attributed-string','property-dictionary']);
    if (property(block,'*type') !== 'rich-text-block') throw new Error('Unknown rich-text block type');
    const dictionary = property(block,'property-dictionary');
    exact(dictionary,['type','diagram-object-label','text-object-id','parent-diagram-id']);
    if (property(dictionary,'type') !== 'rich-text-object' || typeof property(dictionary,'diagram-object-label') !== 'string' || property(dictionary,'diagram-object-label').length > 100000
      || !storedGuid(property(dictionary,'text-object-id')) || !storedGuid(property(dictionary,'parent-diagram-id'))) throw new Error('Unknown rich-text metadata');
    // Copied library objects can retain metadata identities from their source.
    // They are inert provenance and must not resolve to a different widget.
    const attributed = property(block,'attributed-string'); exact(attributed,['Version','Paragraphs']);
    const version = property(attributed,'Version'); exact(version,['Major','Minor','Build','Revision']);
    if (['Major','Minor','Build','Revision'].some((key,i) => property(version,key) !== (i === 0 ? 11 : 0))) throw new Error('Unsupported attributed-string version');
    const source = property(attributed,'Paragraphs');
    if (!Array.isArray(source) || !source.length || source.length > 1000) throw new Error('Rich-text paragraph limit or empty structure');
    let runCount = 0, characterCount = 0, normalizedBoundaryLF = 0;
    const links=new Map();
    const paragraphs = source.map((paragraph, index) => {
      exact(paragraph,['Wrapping','Trimming','HorizontalAlignment','LineSpacing','ListInfo','Inlines']);
      if (property(paragraph,'Wrapping') !== 0 || property(paragraph,'Trimming') !== 0) throw new Error('Unsupported rich-text wrapping or trimming');
      const info = property(paragraph,'ListInfo'); exact(info,['IndentLevel','ListType']);
      if (property(info,'IndentLevel') !== 0 || property(info,'ListType') !== 0) throw new Error('Rich-text list layout has not been recovered');
      const align = property(paragraph,'HorizontalAlignment'), spacing = property(paragraph,'LineSpacing');
      if (![0,1,2].includes(align) || !Number.isFinite(spacing) || spacing < 0 || spacing > 750 || spacing > 0 && spacing < .075) throw new Error('Unknown paragraph alignment or line spacing');
      const inlines = property(paragraph,'Inlines');
      if (!Array.isArray(inlines) || !inlines.length || inlines.length > 10000) throw new Error('Rich-text inline limit or empty structure');
      const expanded=inlines.flatMap(inline=>{
        if(property(inline,'Type')!=='Axure:AttributedString:AxHyperlink'){
          if(++runCount>10000)throw new Error('Rich-text inline limit');
          return [{inline}];
        }
        exact(inline,['Type','Link','Inlines']);
        const ref=property(inline,'Link');let link=links.get(ref?.$reference);
        if(!link){if(links.size>=100)throw new Error('Hyperlink definition count exceeds 100');link=recoverNativeInlineLink(ref,context);links.set(link.definition.id,link);}
        else if(ref.referenceTag!==3||Object.keys(ref).length!==2)throw new Error('Invalid repeated hyperlink reference');
        const children=property(inline,'Inlines');if(!Array.isArray(children)||!children.length||children.length>10000)throw new Error('Invalid hyperlink run list');
        // Bound the expansion before allocating wrappers, including repeated
        // references whose child arrays are individually below the limit.
        if((runCount+=children.length)>10000)throw new Error('Rich-text inline limit');
        return children.map(inline=>({inline,link}));
      });
      const runs = expanded.map(({inline,link}) => {
        if (property(inline,'Type') !== 'Axure:AttributedString:AxRun') throw new Error('Unsupported rich-text inline type');
        exact(inline,['Type','Text','Family','Size','Weight','Style','Stretch','Underline','Color','Baseline','CharacterSpacing','Strikethrough']);
        const text = property(inline,'Text'), family = property(inline,'Family'), size = property(inline,'Size'), weight = property(inline,'Weight'), fontStyle = nativeFontStyle(property(inline,'Style')), color = argbColor(property(inline,'Color'));
        if (typeof text !== 'string' || (characterCount += text.length) > 100000 || /[\r\t]/.test(text)) throw new Error('Unsupported run text or text limit');
        if (typeof family !== 'string' || !family.length || family.length > 200 || !/^[\p{L}\p{N}\s,'"_-]+$/u.test(family)
          || !Number.isFinite(size) || size < .75 || size > 384 || !Number.isFinite(weight) || weight < 100 || weight > 1000 || !fontStyle || !color) throw new Error('Unsupported rich-text font or color');
        const underline = property(inline,'Underline'), strikethrough = property(inline,'Strikethrough');
        if (typeof underline !== 'boolean' || typeof strikethrough !== 'boolean' || property(inline,'Stretch') !== 5 || property(inline,'Baseline') !== 0 || property(inline,'CharacterSpacing') !== 0) throw new Error('Unsupported rich-text decoration, stretch, baseline or character spacing');
        const style={ fontFamily:family, fontSize:size/.75, fontWeight:weight, fontStyle, color, underline, strikethrough };
        if(link&&Object.entries(link.normalStyle).some(([k,v])=>style[k]!==v))throw new Error('Hyperlink normal style conflicts with explicit nested run baseline');
        return { text, style,...(link?{linkId:link.definition.id}:{}) };
      });
      // The witnessed RP11 paragraph boundary is one LF on the final run of
      // every non-final paragraph. Preserve empty paragraphs and empty runs.
      if (index < source.length - 1) {
        if (!runs.at(-1).text.endsWith('\n')) throw new Error('Missing native paragraph LF terminator');
        runs.at(-1).text = runs.at(-1).text.slice(0,-1); normalizedBoundaryLF++;
      }
      if (runs.some(run => run.text.includes('\n'))) throw new Error('Unrecovered inline or repeated line break');
      return { runs, textAlign:['left','center','right'][align], lineHeightPx:spacing === 0 ? 'normal' : spacing/.75 };
    });
    const text = paragraphs.map(p => p.runs.map(r => r.text).join('')).join('\n');
    return { status:'supported-rich-text', richText:{paragraphs,expressionMode:'literal',...(links.size?{links:[...links.values()].map(l=>l.definition)}:{})}, text,
      source:{kind:'native-rp11-paragraph-runs',runStyleSchemaVersion:2,paragraphCount:paragraphs.length,runCount,normalizedBoundaryLF,nativeSizeDivisor:.75,nativeLineSpacingDivisor:.75,nativeFontMetricsVerified:false,metadata:dictionary,...(links.size?{linkSchemaVersion:1,linkCount:links.size,linkSources:[...links.values()].map(l=>l.source)}:{})},
      evidence:'Typed run/paragraph serialization, RPFormatExtensions bJcT/XJc4, and witnessed paragraph LF boundary; original glyph metrics are not reproduced' };
  } catch (error) { return { status:'unsupported-rich-text',reason:error.message }; }
}

function recoverWidgetText(widget, version) {
  const recovered = recoverPlainText(widget.properties);
  // RichTextObject initializes an empty attributed string. Its serializer omits
  // empty content and its reader leaves that default in place when absent.
  // This inference is restricted to the witnessed VectorShape hierarchy.
  const emptyShapeFields = new Set(['ControlPoints', 'Shape', 'reference-page-package-id', 'name-block', 'tooltip', 'IsContained', 'IsLocked', 'SelectedStyleGroup', 'MyStyle', 'AdaptiveStyles', 'SubmitButton', 'Disabled', 'Selected', 'Error', 'VisibleFromSettings', 'AutoFitHeight', 'AutoFitWidth', 'InteractionMap']);
  const emptyCellFields = new Set([...TABLE_COMMON_FIELDS, 'AutoFitHeight', 'AutoFitWidth', '_IsEmpty', ...CELL_BORDER_FIELDS]);
  const witnessedVersion = Array.isArray(version) && version.length === 4 && version.every((n, i) => n === (i === 0 ? 11 : 0));
  const emptyFields = widget.type === 'Axure:DiagramObject:TableCell' ? emptyCellFields
    : widget.type === 'Axure:DiagramObject:VectorShape' && VECTOR_SHAPE_TYPES.has(property(widget.properties, 'Shape')) ? emptyShapeFields : null;
  if (witnessedVersion && emptyFields && recovered.status === 'no-observed-text-field' && widget.properties.$map.every(([key]) => emptyFields.has(key))) {
    return { status: 'stored-empty-rich-text', text: '', source: 'native-omitted-empty-rich-text' };
  }
  return recovered;
}

const TABLE_COMMON_FIELDS = ['name-block','tooltip','IsContained','IsLocked','SelectedStyleGroup','MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings','InteractionMap'];
/** Layer membership is a second ordered index over the same diagram objects,
 * not a contained/local-coordinate diagram. Keep the flat records intact until
 * the importer has proved every member can be retained. */
export function recoverLayerMembership(widget, style, objects, diagram, pack) {
  if (widget.type !== 'Axure:DiagramObject:Layer') return undefined;
  try {
    const fail=message=>{throw new Error(message);},p=widget.properties;
    if(JSON.stringify(pack.version)!=='[11,0,0,0]')fail('Layer membership requires the evidenced RP11 package version');
    const allowed=new Set([...TABLE_COMMON_FIELDS,'DiagramObjects','Propagate','ExpandedOnOutlineTreeView']),pairs=p?.$map;
    if(!Array.isArray(pairs)||pairs.some(pair=>!Array.isArray(pair)||pair.length!==2||!allowed.has(pair[0]))||new Set(pairs.map(pair=>pair[0])).size!==pairs.length)fail('Unknown or duplicate Layer fields');
    for(const key of ['IsLocked','Disabled','Selected','Error','VisibleFromSettings','Propagate','ExpandedOnOutlineTreeView'])if(typeof property(p,key)!=='boolean')fail(`Missing Layer Boolean ${key}`);
    if(property(p,'IsContained')!==false||property(p,'tooltip')!==''||property(p,'SelectedStyleGroup')!==''||tableReference(property(p,'SubmitButton'))!=='0'.repeat(32))fail('Unsupported Layer ownership, tooltip, selection group or submit binding');
    const adaptive=property(p,'AdaptiveStyles');if(!Array.isArray(adaptive)||adaptive.length)fail('Nonempty native Layer adaptive declarations are not yet witnessed');
    if(tableReference(property(p,'MyStyle'))!==style?.id||style?.type!=='Axure:Style'||property(style.properties,'All')!==false||property(style.properties,'MatchInfo')!==undefined)fail('Layer MyStyle must be a direct, noninherited native style');
    const localProperties=[];
    for(const [key,entry]of styleEntries(property(style.properties,'PropList'))){
      if(![101,106,107,108,109,110].includes(key)||!entry.determined||!entry.overridden||entry.rawDoaName!==(key|0xc0000000))fail(`Unsupported Layer style property ${key} or flags`);
      const v=entry.value;
      if(key===101){if(!Array.isArray(v?.$map)||v.$map.length!==2||new Set(v.$map.map(p=>p[0])).size!==2||['X','Y'].some(k=>!Number.isFinite(property(v,k))||Math.abs(property(v,k))>100000))fail('Invalid stored Layer location');}
      else if(key===106||key===107){if(!(key===106?[0,1,4,5,256]:[0,2,8,10,512]).includes(v))fail('Unknown Layer pin value');}
      else if(typeof v!=='boolean')fail('Invalid Layer fixed-size/visible Boolean');
      localProperties.push({key,rawDoaName:entry.rawDoaName,value:v});
    }
    const flat=property(diagram.properties,'diagram-objects');if(!Array.isArray(flat)||flat.length>10000)fail('Missing Layer diagram index');
    const flatIds=flat.map(tableReference);if(new Set(flatIds).size!==flatIds.length||!flatIds.includes(widget.id))fail('Layer diagram has duplicate or missing identities');
    const parents=new Map();
    for(const object of objects.values())if(object.type==='Axure:DiagramObject:Layer'){
      const children=property(object.properties,'DiagramObjects');if(!Array.isArray(children))continue;
      for(const ref of children){const child=ref?.$reference;parents.set(child,[...(parents.get(child)??[]),object.id]);}
    }
    const ownParents=parents.get(widget.id)??[];if(ownParents.length>1||ownParents.some(id=>!flatIds.includes(id)))fail('Ambiguous or cross-diagram Layer parent');
    const walk=(object,seen,depth)=>{
      if(depth>50||seen.has(object.id))fail('Layer membership cycle or depth limit');
      if(!flatIds.includes(object.id)||property(object.properties,'IsContained')!==false||!object.type.startsWith('Axure:DiagramObject:'))fail('Layer member is not an independent member of the same diagram');
      if(object.type!=='Axure:DiagramObject:Layer')return [object.id];
      const refs=property(object.properties,'DiagramObjects');if(!Array.isArray(refs)||refs.length>10000)fail('Missing Layer DiagramObjects array');
      const ids=refs.map(tableReference);if(new Set(ids).size!==ids.length)fail('Duplicate Layer member');
      const next=new Set([...seen,object.id]);return [object.id,...ids.flatMap(id=>{const child=objects.get(id);if(!child||parents.get(id)?.length!==1||parents.get(id)[0]!==object.id)fail('Missing or multiply owned Layer member');return walk(child,next,depth+1);})];
    };
    const preorder=walk(widget,new Set(),0),start=flatIds.indexOf(widget.id);
    if(preorder.some((id,i)=>flatIds[start+i]!==id))fail('Layer hierarchy does not match the preserved diagram paint order');
    return {status:'supported-layer-membership',childIds:property(p,'DiagramObjects').map(tableReference),propagate:property(p,'Propagate'),localProperties,
      source:{sourceType:widget.type,field:'DiagramObjects',coordinateSpace:'diagram',diagramId:diagram.id,parentLayerId:ownParents[0]??null,packageVersion:[...pack.version],sourcePartSha256:pack.sha256,styleId:style.id}};
  }catch(error){
    // A rejected wrapper can still provide an exact literal membership index.
    // This is only a parent-reference proof for independently complete inner
    // Layers; it never authorizes importing this wrapper.
    let membershipReferences;
    try{
      if(JSON.stringify(pack.version)!=='[11,0,0,0]')throw Error();
      const refs=property(widget.properties,'DiagramObjects'),flat=property(diagram.properties,'diagram-objects');
      if(!Array.isArray(refs)||refs.length>10000||!Array.isArray(flat))throw Error();
      const childIds=refs.map(tableReference),flatIds=flat.map(tableReference);
      if(!flatIds.includes(widget.id)||new Set(flatIds).size!==flatIds.length||new Set(childIds).size!==childIds.length||childIds.some(id=>id===widget.id||!flatIds.includes(id)||!objects.get(id)?.type.startsWith('Axure:DiagramObject:')||property(objects.get(id).properties,'IsContained')!==false))throw Error();
      if(childIds.some((id,i)=>i>0&&flatIds.indexOf(id)<=flatIds.indexOf(childIds[i-1])))throw Error();
      membershipReferences={childIds,diagramId:diagram.id,sourcePartSha256:pack.sha256,packageVersion:[...pack.version]};
    }catch{/* No partial membership claim if its literal scope is itself invalid. */}
    return {status:'unsupported-layer-membership',reason:error.message,...(membershipReferences?{membershipReferences}:{})};
  }
}
const CELL_BORDER_FIELDS = ['top','right','bottom','left'].flatMap(side => [`${side}-border-width`,`${side}-border-color`]);
function tableFields(widget, extra) {
  const allowed = new Set([...TABLE_COMMON_FIELDS,...extra]), pairs = widget.properties?.$map;
  if (!Array.isArray(pairs) || pairs.some(pair => !Array.isArray(pair) || pair.length !== 2 || !allowed.has(pair[0])) || new Set(pairs.map(p => p[0])).size !== pairs.length) throw new Error('Unknown or duplicate native table fields');
  const p=widget.properties, submit=property(p,'SubmitButton');
  if (property(p,'tooltip')!=='' || property(p,'IsContained')!==false || property(p,'Disabled')!==false || property(p,'Error')!==false || property(p,'Selected')!==false || property(p,'SelectedStyleGroup')!=='') throw new Error('Unsupported table ownership, tooltip or initial state');
  if (submit?.referenceTag!==3 || submit.$reference!=='0'.repeat(32) || Object.keys(submit).length!==2 || !Array.isArray(property(p,'AdaptiveStyles')) || property(p,'AdaptiveStyles').length) throw new Error('Unsupported table binding or adaptive styles');
}
function tableReference(value) {
  if (!value || value.referenceTag!==3 || !/^[a-f0-9]{32}$/.test(value.$reference) || Object.keys(value).length!==2) throw new Error('Invalid table object reference');
  return value.$reference;
}
function recoverTableCellBorders(widget) {
  tableFields(widget,['AutoFitHeight','AutoFitWidth','_IsEmpty','RichTextBlock','TextBlock',...CELL_BORDER_FIELDS]);
  const p=widget.properties;
  if (property(p,'AutoFitHeight')!==false || property(p,'AutoFitWidth')!==false || property(p,'_IsEmpty')!==false) throw new Error('Unsupported table-cell auto-fit or paste state');
  const widths=['top','right','bottom','left'].map(side=>property(p,`${side}-border-width`));
  const nativeColors=['top','right','bottom','left'].map(side=>property(p,`${side}-border-color`));
  const colors=nativeColors.map(argbColor);
  if(widths.some(v=>!Number.isFinite(v)||v<0||v>100)||colors.some(c=>!c||c!==colors[0]))throw new Error('Unsupported table-cell border widths or nonuniform colors');
  return {status:'supported-cell-borders',widths,color:colors[0],source:{nativeColors,order:'top-right-bottom-left'}};
}
function recoverTable(widget, objects, readCell, size, diagramId, owners, menuOwnerId) {
  try {
    tableFields(widget,['diagram-objects','initialized','rows','columns','cells','row-heights','column-widths']);
    const tableOwners=(owners.get(widget.id)??[]).map(id=>objects.get(id));
    if(tableOwners.length!==1||(menuOwnerId?tableOwners[0].id!==menuOwnerId||tableOwners[0].type!=='Axure:DiagramObject:MenuObject':tableOwners[0].id!==diagramId||!['Axure:Diagram','Axure:PanelDiagram'].includes(tableOwners[0].type)))throw new Error('Table belongs to an unvalidated menu or ambiguous container');
    const p=widget.properties,rows=property(p,'rows'),columns=property(p,'columns');
    if(property(p,'initialized')!=='True'||!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>1000||columns>1000||rows*columns>9999)throw new Error('Invalid table dimensions or initialization');
    const tracks=(key,count)=>{const v=property(p,key);if(!Array.isArray(v)||v.length!==count||v.some(n=>!Number.isFinite(n)||n<1||n>100000)||v.reduce((a,b)=>a+b,0)>100000)throw new Error('Invalid table track sizes');return [...v];};
    const columnWidths=tracks('column-widths',columns),rowHeights=tracks('row-heights',rows);
    if(size?.determined!==true||size?.overridden!==true||size.value.Width!==columnWidths.reduce((a,b)=>a+b,0)||size.value.Height!==rowHeights.reduce((a,b)=>a+b,0))throw new Error('Table size does not equal its complete tracks');
    const refs=key=>{const value=property(p,key);if(!Array.isArray(value)||value.length!==rows*columns)throw new Error('Incomplete table cell matrix');const ids=value.map(tableReference);if(new Set(ids).size!==ids.length)throw new Error('Duplicate table cell reference');return ids;};
    const cellIds=refs('cells'),diagramObjectIds=refs('diagram-objects');
    const cellSet=new Set(cellIds);
    if(diagramObjectIds.some(id=>!cellSet.has(id)))throw new Error('Table matrix and container membership differ');
    const x=[0],y=[0];for(const w of columnWidths)x.push(x.at(-1)+w);for(const h of rowHeights)y.push(y.at(-1)+h);
    const cells=cellIds.map((id,index)=>{
      if(owners.get(id)?.length!==1||owners.get(id)[0]!==widget.id)throw new Error('Cell has ambiguous or foreign container ownership');
      const cell=objects.get(id);if(cell?.type!=='Axure:DiagramObject:TableCell')throw new Error('Table cell reference has unexpected type');
      const result=readCell(cell,index,widget.id),row=Math.floor(index/columns),column=index%columns;
      if(result.status!=='stored-fields-recovered'||result.typeCandidate?.type!=='tableCell')throw new Error(`Unsupported table cell ${id}: ${result.reason??'unknown fields'}`);
      const recovered=result.styleRecovery;
      if(recovered?.cacheChainComplete!==true)throw new Error('Table cell style/default cache is incomplete');
      const location=recovered.resolvedGeometry?.location,value=recovered.resolvedGeometry?.size;
      if(location?.determined!==true||value?.determined!==true||location.value.X!==x[column]||location.value.Y!==y[row]||value.value.Width!==columnWidths[column]||value.value.Height!==rowHeights[row])throw new Error('Table cell geometry disagrees with matrix tracks');
      if(result.richTextRecovery.status==='unsupported-rich-text'||!['stored-rich-text-as-plain','stored-plain-text','stored-empty-rich-text'].includes(result.text.status))throw new Error('Table cell text is not completely recoverable');
      return result;
    });
    return {status:'supported-table',rows,columns,columnWidths,rowHeights,cells,source:{cellIds,diagramObjectIds,sourceType:widget.type,matrixOrder:'row-major',eventOrder:'diagram-objects'}};
  } catch(error){return {status:'unsupported-table',reason:error.message};}
}

function recoverMenu(widget,objects,readWidget,size,diagramId,owners){
  try{
    tableFields(widget,['diagram-objects','orientation','left-padding','right-padding','top-padding','bottom-padding','submenus']);
    const menuOwners=(owners.get(widget.id)??[]).map(id=>objects.get(id));
    if(menuOwners.length!==1||menuOwners[0].id!==diagramId||!['Axure:Diagram','Axure:PanelDiagram'].includes(menuOwners[0].type))throw new Error('Only standalone native menus are currently witnessed');
    const p=widget.properties,orientation=property(p,'orientation'),padding=['top','right','bottom','left'].map(side=>property(p,`${side}-padding`)),submenus=property(p,'submenus'),refs=property(p,'diagram-objects');
    if(orientation!==0&&orientation!==1)throw new Error('Unsupported native menu orientation');
    if(padding.some(n=>n!==0))throw new Error('Only witnessed zero menu padding is currently mapped');
    if(!Array.isArray(submenus)||submenus.length)throw new Error('Native submenu binding/geometry has no witnessed nonempty fixture');
    if(!Array.isArray(refs)||refs.length!==1)throw new Error('Native menu must contain exactly one table');
    const tableId=tableReference(refs[0]),nativeTable=objects.get(tableId);
    if(nativeTable?.type!=='Axure:DiagramObject:Table')throw new Error('Menu table has missing or unexpected type');
    const table=readWidget(nativeTable,0,undefined,widget.id),recovery=table.tableRecovery;
    if(table.status!=='stored-fields-recovered'||recovery?.status!=='supported-table')throw new Error(`Menu table is incomplete: ${table.reason??recovery?.reason??'unknown'}`);
    if(orientation===0?recovery.rows!==1:recovery.columns!==1)throw new Error('Menu matrix is not consistent with its orientation');
    if(size?.determined!==true||size?.overridden!==true||size.value.Width!==table.storedGeometry.size?.value.Width||size.value.Height!==table.storedGeometry.size?.value.Height)throw new Error('Menu rectangle does not match its zero-padding table');
    return {status:'supported-menu',orientation:orientation===0?'horizontal':'vertical',padding,table,submenus:[],source:{sourceType:widget.type,nativeOrientation:orientation,tableId,submenuIds:[],layout:'menu-padding-table'}};
  }catch(error){return {status:'unsupported-menu',reason:error.message};}
}

function recoverInlineFrame(widget,style,objects){
  try{
    const zero='0'.repeat(32),p=widget.properties;
    tableFields(widget,['DefaultTarget','ShowBorder','Scrollbars','Preview','CustomImage']);
    const exact=(value,keys)=>{const pairs=value?.$map;if(!Array.isArray(pairs)||pairs.length!==keys.length||pairs.some(pair=>!Array.isArray(pair)||pair.length!==2||!keys.includes(pair[0]))||new Set(pairs.map(pair=>pair[0])).size!==keys.length)throw new Error('Unknown or duplicate InlineFrame target fields');};
    if(style?.type!=='Axure:Style')throw new Error('Missing InlineFrame local style');
    const entries=styleEntries(property(style.properties,'PropList'));
    if(entries.size!==2||[...entries.keys()].some(k=>![LOCATION,SIZE].includes(k))||[...entries.values()].some(v=>!v.determined||!v.overridden))throw new Error('InlineFrame requires only explicit stored location and size');
    const targetId=tableReference(property(p,'DefaultTarget')),target=objects.get(targetId);if(target?.type!=='Axure:InteractionTarget')throw new Error('InlineFrame target reference is incomplete');
    exact(target.properties,['target-type','target-page-id','target-literal']);
    const page=property(target.properties,'target-page-id');
    if(property(target.properties,'target-type')!==0||page?.referenceTag!==19||page.$reference!==zero||page.name!=='Axure:Page'||Object.keys(page).length!==3)throw new Error('Only witnessed empty InlineFrame destinations are recovered');
    const literalId=tableReference(property(target.properties,'target-literal')),literal=objects.get(literalId);if(literal?.type!=='Axure:Expr:StringLiteral'||literalId===targetId||literalId===widget.id)throw new Error('InlineFrame literal reference is incomplete');
    exact(literal.properties,['value','variable-identifiers','repeater-scope','TargetRepeaterScope']);
    const variables=property(literal.properties,'variable-identifiers');
    if(property(literal.properties,'value')!==''||!Array.isArray(variables)||variables.length||tableReference(property(literal.properties,'repeater-scope'))!==zero||tableReference(property(literal.properties,'TargetRepeaterScope'))!==zero)throw new Error('InlineFrame nonempty or expression targets are unsupported');
    const showBorder=property(p,'ShowBorder'),scrollbars=property(p,'Scrollbars'),preview=property(p,'Preview'),image=property(p,'CustomImage');
    exact(image,['Hash']);
    if(typeof showBorder!=='boolean'||![1,2,3].includes(scrollbars)||preview!==0||property(image,'Hash')!=='')throw new Error('InlineFrame border, scrolling or preview carrier is unsupported');
    return {status:'supported-inline-frame',hideBorders:!showBorder,scrolling:{1:'auto',2:'yes',3:'no'}[scrollbars],preview:{kind:'none'},source:{targetId,literalId,targetType:0,targetPageId:zero,literal:'',variableIdentifiers:[],repeaterScopeId:zero,targetRepeaterScopeId:zero,sourceStyleId:style.id,localStyleKeys:[LOCATION,SIZE],nativeShowBorder:showBorder,nativeScrollbars:scrollbars,nativePreview:preview,customImageHash:'',stylePolicy:'frame-native-border-only'}};
  }catch(error){return {status:'unsupported-inline-frame',reason:error.message};}
}

const TREE_FIELDS=['diagram-objects','parentnode','rootnode','rootshowplusminus','rootshowicon','plusminus','icon','buttonshape','isexpanded','childnodes','CollapsedImage','ExpandedImage'];
const TREE_TRIANGLES={CollapsedImage:'b0ec13894dda3f4c13309076278aa2b4ff3c0fc9989d9da919aa90595ea55380',ExpandedImage:'355c13dccbc66c3e84af4b4491636f997bd83e1b01b023b8d8f6c97c103fdba8'};
function recoverTree(widget,objects,readWidget,rootStyle,diagramId,owners,part){
  try{
    const zero='0'.repeat(32),used=new Set(),sourceRoles=[],rootId=widget.id;
    const ids=(p,key)=>{const v=property(p,key);if(!Array.isArray(v)||v.length>9999)throw new Error('Invalid tree member list');const a=v.map(tableReference);if(new Set(a).size!==a.length)throw new Error('Duplicate tree member reference');return a;};
    const claim=(id,type,parent)=>{if(used.has(id)||used.size>=9999)throw new Error('Tree identity cycle, repetition or size limit');used.add(id);const o=objects.get(id);if(o?.type!==type)throw new Error('Missing or unexpected tree object type');const owner=owners.get(id)??[];if(parent===null?owner.length!==0:owner.length!==1||owner[0]!==parent)throw new Error('Ambiguous tree ownership');return o;};
    const mapObject=(value,keys)=>{if(!Array.isArray(value?.$map)||value.$map.length!==keys.length||value.$map.some(([k])=>!keys.includes(k))||new Set(value.$map.map(([k])=>k)).size!==keys.length)throw new Error('Invalid contained tree rectangle');const r=Object.fromEntries(value.$map);if(keys.some(k=>!Number.isFinite(r[k])))throw new Error('Nonfinite contained tree rectangle');return r;};
    const validateStyle=r=>{const g=r.styleRecovery;if(!g?.cacheChainComplete||!g.resolvedGeometry?.location?.determined||!g.resolvedGeometry?.size?.determined||g.boundsRecovery?.outerShadowAbsent!==true)throw new Error('Tree layout requires complete identity-style geometry');return {location:g.resolvedGeometry.location.value,size:g.resolvedGeometry.size.value};};
    const readNode=(node,index,parentId,depth)=>{
      if(depth>32)throw new Error('Tree nesting limit');tableFields(node,TREE_FIELDS);const p=node.properties;
      if(tableReference(property(p,'rootnode'))!==rootId||tableReference(property(p,'parentnode'))!==parentId||property(p,'rootshowplusminus')!==true||property(p,'rootshowicon')!==false||typeof property(p,'isexpanded')!=='boolean')throw new Error('Tree relationship, icon mode or expansion state is unsupported');
      if(property(p,'CollapsedImage')!==undefined||property(p,'ExpandedImage')!==undefined)throw new Error('Non-root tree image overrides are unsupported');
      const r=readWidget(node,index,undefined,undefined,{mode:'node',rootId,parentId});if(r.status!=='stored-fields-recovered')throw new Error(r.reason??'Tree row is unsupported');const g=validateStyle(r);
      const childIds=ids(p,'childnodes'),labelId=tableReference(property(p,'buttonshape')),plusId=tableReference(property(p,'plusminus')),iconId=tableReference(property(p,'icon'));
      const members=ids(p,'diagram-objects'),expected=[labelId,...childIds,...(childIds.length?[plusId]:[])];if(members.length!==expected.length||expected.some(id=>!members.includes(id)))throw new Error('Tree active object membership differs from its declared roles');
      const label=claim(labelId,'Axure:DiagramObject:VectorShape',node.id),lp=label.properties;
      const labelFields=new Set(['ControlPoints','Shape','reference-page-package-id','name-block','tooltip','IsContained','IsLocked','SelectedStyleGroup','ContainedLocation','ContainedSize','RichTextBlock','AutoFitWidth','AutoFitHeight']);
      if(!Array.isArray(lp?.$map)||lp.$map.some(([k])=>!labelFields.has(k))||new Set(lp.$map.map(([k])=>k)).size!==lp.$map.length||property(lp,'Shape')!==0||property(lp,'IsContained')!==true||property(lp,'tooltip')!==''||property(lp,'SelectedStyleGroup')!==''||property(lp,'AutoFitWidth')!==true||property(lp,'AutoFitHeight')!==false)throw new Error('Unknown contained tree label fields');
      const location=mapObject(property(lp,'ContainedLocation'),['X','Y']),size=mapObject(property(lp,'ContainedSize'),['Width','Height']);
      if(location.X!==22||location.Y!==0||!Number.isFinite(size.Width)||size.Width<1||size.Height!==20||g.size.Width!==22+size.Width||g.size.Height!==20||recoverRectanglePath(property(lp,'ControlPoints'),size.Width,size.Height)?.cornerRadii.some(r=>r!==0)!==false)throw new Error('Tree label geometry or rectangle path is unsupported');
      const reference=property(lp,'reference-page-package-id');if(reference?.referenceTag!==19||reference.$reference!==zero||reference.name!=='Axure:Page')throw new Error('Tree label page reference unsupported');
      const inherited=['MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings'];
      const effective={...label,properties:{$map:[...lp.$map,...inherited.map(k=>[k,property(p,k)])]}};
      const labelResult=readWidget(effective,0,undefined,undefined,{mode:'label',rootId,parentId:node.id,location,size});
      if(labelResult.status!=='stored-fields-recovered'||labelResult.richTextRecovery?.status!=='supported-rich-text'||labelResult.styleRecovery?.cacheChainComplete!==true)throw new Error('Tree label rich text or inherited style is incomplete');
      labelResult.storedGeometry.styleId=null;labelResult.treeLabelRecovery={status:'supported-contained-tree-label',ownerId:node.id,rootId,sourceStyleId:tableReference(property(p,'MyStyle')),source:'KJm7.cJO3-contained-parent',location,size,inheritedFields:inherited};
      for(const [role,id,active]of [['expand',plusId,childIds.length>0],['icon',iconId,false]]){
        const image=claim(id,'Axure:DiagramObject:ImageBox',active?node.id:null),ip=image.properties;
        tableFields(image,['AutoFitHeight','AutoFitWidth','PreserveCornersRectangle','fit-to-image']);
        if(property(ip,'IsContained')!==false||property(ip,'Disabled')!==false||property(ip,'Selected')!==false||property(ip,'Error')!==false||property(ip,'InteractionMap')!==undefined)throw new Error('Tree auxiliary image has unsupported behavior');
        const img=readWidget(image,0),ig=img.styleRecovery?.resolvedGeometry;
        const imageStyle=img.styleRecovery?.imageProperties,transform=imageStyle?.[1401],identity={ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0};
        if(imageStyle?.[50]?.determined!==true||imageStyle[50].value!==0||transform?.determined!==true||transform.value?.$map?.length!==5||Object.entries(identity).some(([k,v])=>property(transform.value,k)!==v)||img.styleRecovery?.boundsRecovery?.outerShadowAbsent!==true)throw new Error('Tree auxiliary image transform or shadow is unsupported');
        if(!img.styleRecovery?.cacheChainComplete||!ig?.size?.determined||(role==='expand'?(ig.size.value.Width!==9||ig.size.value.Height!==9):(ig.size.value.Width!==16||ig.size.value.Height!==16)))throw new Error('Tree auxiliary image dimensions are unsupported');
        if(active&&(!ig.location?.determined||ig.location.value.X!==6||ig.location.value.Y!==6))throw new Error('Tree expander origin is unsupported');
        sourceRoles.push({id,role,active});
      }
      const children=childIds.map((id,i)=>readNode(claim(id,'Axure:DiagramObject:TreeNodeObject',node.id),i,node.id,depth+1));
      let y=20;for(const child of children){const cg=child.styleRecovery.resolvedGeometry;if(cg.location.value.X!==20||cg.location.value.Y!==y)throw new Error('Tree child positions disagree with expanded row layout');y+=visibleHeight(child);}
      r.treeNodeRecovery={status:'supported-tree-node',expanded:property(p,'isexpanded'),label:labelResult,children,source:{rootId,parentId,labelId,childIds,diagramObjectIds:members,expandImageId:plusId,iconId,layout:'stored-tree-row'}};return r;
    };
    const visibleHeight=node=>20+(node.treeNodeRecovery.expanded?node.treeNodeRecovery.children.reduce((n,c)=>n+visibleHeight(c),0):0);
    claim(rootId,'Axure:DiagramObject:TreeNodeObject',diagramId);tableFields(widget,TREE_FIELDS);const p=widget.properties;
    if(tableReference(property(p,'rootnode'))!==rootId||tableReference(property(p,'parentnode'))!==zero||['buttonshape','plusminus','icon'].some(k=>tableReference(property(p,k))!==zero)||property(p,'isexpanded')!==true||property(p,'rootshowplusminus')!==true||property(p,'rootshowicon')!==false)throw new Error('Unsupported native tree root mode');
    const images={};for(const [key,expected]of Object.entries(TREE_TRIANGLES)){const value=property(p,key),stream=property(value,'Stream')?.$bytes;if(!Array.isArray(value?.$map)||value.$map.length!==3||value.$map.some(([k])=>!['Stream','Extension','Hash'].includes(k))||property(value,'Extension')!==''||!stream||!part||!Number.isSafeInteger(stream.offset)||!Number.isSafeInteger(stream.length)||stream.offset<0||stream.length<1||stream.length>512||stream.offset+stream.length>part.data.length)throw new Error('Tree expansion image byte carrier is invalid');const bytes=part.data.subarray(stream.offset,stream.offset+stream.length);if(digest(bytes)!==stream.sha256||stream.sha256!==expected)throw new Error('Only witnessed native triangle images are mapped');if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==9||bytes.readUInt32BE(20)!==9)throw new Error('Tree expansion image is not 9 by 9');images[key]={sha256:stream.sha256,offset:stream.offset,length:stream.length,width:9,height:9};}
    const childIds=ids(p,'childnodes'),members=ids(p,'diagram-objects');if(!childIds.length||JSON.stringify(childIds)!==JSON.stringify(members))throw new Error('Tree root member ordering is incomplete');
    const nodes=childIds.map((id,i)=>readNode(claim(id,'Axure:DiagramObject:TreeNodeObject',rootId),i,rootId,1));
    let y=0,width=0;const right=(n,offset=0)=>Math.max(offset+n.styleRecovery.resolvedGeometry.size.value.Width,...(n.treeNodeRecovery.expanded?n.treeNodeRecovery.children.map(c=>right(c,offset+20)):[]));
    for(const node of nodes){const g=node.styleRecovery.resolvedGeometry;if(g.location.value.X!==0||g.location.value.Y!==y)throw new Error('Tree root row positions are inconsistent');y+=visibleHeight(node);width=Math.max(width,right(node));}
    if(!rootStyle?.cacheChainComplete||rootStyle.resolvedGeometry?.size?.value.Width!==width||rootStyle.resolvedGeometry?.size?.value.Height!==y)throw new Error('Tree root dimensions disagree with stored visible rows');
    return {status:'supported-tree',nodes,indent:20,showExpandIcons:true,iconStyle:'triangle',showIcons:false,source:{sourceType:widget.type,rootId,childIds,diagramObjectIds:members,images,auxiliaryObjects:sourceRoles,layout:'native-stored-tree-rows'}};
  }catch(error){return {status:'unsupported-tree',reason:error.message};}
}

/** Sitemap grammar witnessed in six official samples; fail the tree atomically, not the diagrams. */
export function recoverPageTree(decoded) {
  try {
    const fail = message => { throw new Error(message); };
    const guid = value => { if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) fail('Invalid sitemap GUID'); return value; };
    const ref = (value, tag, name) => {
      if (!value || value.referenceTag !== tag || (name !== undefined && value.name !== name)) fail('Unknown sitemap reference kind');
      return guid(value.$reference);
    };
    const name = value => { if (typeof value !== 'string' || value.length > 500) fail('Unknown page/folder name'); return value; };
    const documents = decoded.packages.filter(pack => pack.path === 'DesignDocument');
    if (documents.length !== 1 || !Array.isArray(documents[0].objects)) fail('Missing or ambiguous DesignDocument');
    const pack = documents[0], objects = new Map();
    for (const object of pack.objects) {
      guid(object.id); if (objects.has(object.id)) fail('Duplicate document object ID'); objects.set(object.id, object);
    }
    const get = (id, type) => { const object = objects.get(id); if (object?.type !== type) fail(`Missing or unexpected ${type}`); return object; };
    const root = get(guid(pack.rootId), 'Axure:DesignDocument');
    const sitemap = get(ref(property(root.properties, 'sitemap'), 3), 'Axure:SiteTreeMap');
    const tree = get(ref(property(sitemap.properties, 'tree'), 3), 'Axure:Tree');
    if (ref(property(tree.properties, 'tree'), 3) !== tree.id) fail('Sitemap tree self-reference mismatch');
    const infos = property(root.properties, 'PackageInfos');
    if (!Array.isArray(infos)) fail('Missing PackageInfos array');
    const pageInfos = new Map(), seenInfoIds = new Set();
    for (const value of infos) {
      const infoId = ref(value, 3), info = get(infoId, 'Axure:PackageInfo');
      if (seenInfoIds.has(infoId)) fail('Duplicate PackageInfo reference'); seenInfoIds.add(infoId);
      const target = property(info.properties, 'package-id');
      if (target?.name !== 'Axure:Page') continue;
      const packageId = ref(target, 19, 'Axure:Page');
      if (pageInfos.has(packageId)) fail('Duplicate page PackageInfo');
      pageInfos.set(packageId, name(property(info.properties, 'package-name')));
    }
    const pagePackages = new Set();
    for (const candidate of decoded.packages) {
      const roots = candidate.objects?.filter(object => object.id === candidate.rootId) ?? [];
      if (!roots.some(object => object.type === 'Axure:Page')) continue;
      if (roots.length !== 1 || pagePackages.has(candidate.packageId) || candidate.path !== `${candidate.packageId}/package`) fail('Ambiguous page package identity');
      pagePackages.add(guid(candidate.packageId));
    }
    if (pageInfos.size !== pagePackages.size || [...pageInfos.keys()].some(id => !pagePackages.has(id))) fail('Page packages and PackageInfos do not match');
    const pairs = property(sitemap.properties, 'node-table')?.$map;
    if (!Array.isArray(pairs) || pairs.length > 400) fail('Missing sitemap node table or node limit');
    const table = new Map();
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) fail('Invalid sitemap node-table pair');
      const nodeId = ref(pair[0], 3); get(nodeId, 'Axure:Node');
      if (table.has(nodeId)) fail('Duplicate sitemap node-table entry'); table.set(nodeId, pair[1]);
    }
    for (const object of objects.values()) if (object.type === 'Axure:Node' && property(object.properties, 'tree')?.$reference === tree.id && !table.has(object.id)) fail('Sitemap-owned node absent from node table');
    const nodes = [], visited = new Set(), usedPages = new Set(), usedFolders = new Set(), folderObjects = new Set();
    const walk = (owner, depth) => {
      const children = property(owner.properties, 'children');
      if (!Array.isArray(children) || children.length > 400) fail('Missing or invalid sitemap children');
      for (const child of children) {
        if (depth >= 12 || nodes.length >= 400) fail('Sitemap depth/node limit');
        const nodeId = ref(child, 3), node = get(nodeId, 'Axure:Node');
        if (visited.has(nodeId)) fail('Cyclic or duplicate sitemap attachment'); visited.add(nodeId);
        if (!table.has(nodeId)) fail('Sitemap child absent from node table');
        if (ref(property(node.properties, 'parent-node'), 3) !== owner.id || ref(property(node.properties, 'tree'), 3) !== tree.id) fail('Sitemap parent/tree mismatch');
        const content = table.get(nodeId), common = { nodeId, parentNodeId: owner === tree ? null : owner.id };
        if (content?.referenceTag === 19) {
          const packageId = ref(content, 19, 'Axure:PackageInfo');
          if (!pageInfos.has(packageId) || usedPages.has(packageId)) fail('Missing or duplicate sitemap page');
          usedPages.add(packageId); if (usedPages.size > 200) fail('Sitemap page limit');
          nodes.push({ ...common, kind: 'page', packageId, name: pageInfos.get(packageId) });
        } else {
          const objectId = ref(content, 3), folder = get(objectId, 'Axure:MasterTreeFolder');
          const folderId = guid(property(folder.properties, 'folder-id')?.$guid);
          if (usedFolders.has(folderId) || folderObjects.has(objectId)) fail('Duplicate sitemap folder identity');
          usedFolders.add(folderId); folderObjects.add(objectId); if (usedFolders.size > 200) fail('Sitemap folder limit');
          nodes.push({ ...common, kind: 'folder', folderId, name: name(property(folder.properties, 'name')) });
        }
        walk(node, depth + 1);
      }
    };
    walk(tree, 0);
    if (visited.size !== table.size) fail('Unreachable sitemap node-table entry');
    if (usedPages.size !== pageInfos.size) fail('Sitemap does not cover every page package');
    return { status: 'supported-page-tree', rootId: root.id, treeId: tree.id, sourcePartSha256: pack.sha256, nodes };
  } catch (error) { return { status: 'unsupported-page-tree', reason: error.message, nodes: [] }; }
}

function recoverDocumentSettings(decoded) {
  const result = { variables: { status: 'unsupported', reason: 'Missing DesignDocument' }, caseSelection: { status: 'unsupported', reason: 'Missing DesignDocument' } };
  try {
    const documents = decoded.packages.filter(pack => pack.path === 'DesignDocument');
    if (documents.length !== 1 || !documents[0].objects) throw new Error('Missing or ambiguous DesignDocument');
    const pack = documents[0], objects = new Map();
    for (const object of pack.objects) { if (objects.has(object.id)) throw new Error('Duplicate document object ID'); objects.set(object.id, object); }
    const root = objects.get(pack.rootId);
    if (root?.type !== 'Axure:DesignDocument') throw new Error('Unexpected DesignDocument root type');
    try {
      const setRef = property(root.properties, 'GlobalVariableSet'), set = objects.get(setRef?.$reference);
      if (setRef?.referenceTag !== 3 || set?.type !== 'Axure:GlobalVariableSet') throw new Error('Unknown global variable set reference');
      const refs = property(set.properties, 'global-variables');
      if (!Array.isArray(refs) || refs.length > 1000) throw new Error('Invalid global variable collection');
      const usedIds = new Set(), names = new Set();
      const variables = refs.map(ref => {
        const item = objects.get(ref?.$reference);
        if (ref?.referenceTag !== 3 || item?.type !== 'Axure:GlobalVariable') throw new Error('Unknown global variable reference');
        const name = property(item.properties, 'name'), value = property(item.properties, 'default-value'), id = property(item.properties, 'variable-id')?.$guid;
        if (typeof name !== 'string' || !name.trim() || name.length > 256 || typeof value !== 'string' || value.length > 100000 || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid global variable fields');
        if (usedIds.has(id) || names.has(name.toLowerCase())) throw new Error('Duplicate global variable identity or case-insensitive name');
        usedIds.add(id); names.add(name.toLowerCase()); return { id, name, value };
      });
      result.variables = { status: 'supported', variables, sourcePartSha256: pack.sha256 };
    } catch (error) { result.variables = { status: 'unsupported', reason: error.message }; }
    try {
      const ref = property(root.properties, 'default-prototype-configuration-id');
      if (ref?.referenceTag !== 19 || ref?.name !== 'Axure:HtmlPrototypeGeneratorConfiguration') throw new Error('Unknown default HTML configuration reference');
      const candidates = decoded.packages.filter(candidate => candidate.packageId === ref.$reference);
      if (candidates.length !== 1 || !candidates[0].objects) throw new Error('Missing or ambiguous default HTML configuration package');
      const configPack = candidates[0], roots = configPack.objects.filter(item => item.id === configPack.rootId);
      if (roots.length !== 1 || roots[0].type !== 'Axure:HtmlPrototypeGeneratorConfiguration') throw new Error('Unknown default HTML configuration root');
      const sourceValue = property(roots[0].properties, 'link-style');
      // The serializer uses a custom string table, not Enum.ToString. Only this
      // spelling is corroborated by both shipped files and the native enum.
      const choices = new Map([['DisplayMultipleTargetsOnly', 'auto']]);
      if (!choices.has(sourceValue)) throw new Error('Unknown native Case Behavior setting');
      result.caseSelection = { status: 'supported', value: choices.get(sourceValue), sourceValue, sourcePackageId: configPack.packageId, sourcePartSha256: configPack.sha256 };
    } catch (error) { result.caseSelection = { status: 'unsupported', reason: error.message }; }
  } catch (error) { result.variables.reason = error.message; result.caseSelection.reason = error.message; }
  return result;
}

export function recoverRpSemantics(decoded, parts = new Map()) {
  const imageBudget = { used: 0 };
  const result = {
    status: 'partial-read-only-recovery', recoveryVersion: 1, fileSha256: decoded.fileSha256,
    limitations: [
      'Stored base geometry and validated local adaptive declarations are recovered; unknown active properties reject an adaptive owner. No automatic layout computation or original editor write-back.',
      'Diagram list follows package enumeration; independently validated pageTreeRecovery supplies sitemap hierarchy/order when supported. Diagram member arrays retain stored order; paint-order equivalence is unverified.',
      'Plain text only; unsupported rich-text inline forms are reported rather than silently flattened.',
      'Images recover only explicit, static embedded PNG with validated bytes, supported metadata and matching aspect ratio. Other formats/crops/layouts are omitted.',
      'Only explicitly decoded interaction events, conditions and actions are exposed; unsupported events are rejected atomically. Masters, component overrides, repeater instances and native write-back are not implemented.',
      'No Axure GUI round-trip, rendered-position, or interaction differential validation has been performed.',
    ],
    packageFailures: decoded.packages.filter(p => p.status === 'unsupported').map(p => ({ path: p.path, reason: p.reason })),
    semanticFailures: [], diagrams: [],
  };
  result.documentSettingsRecovery = recoverDocumentSettings(decoded);
  result.pageTreeRecovery = recoverPageTree(decoded);
  result.adaptiveRecovery = recoverAdaptiveSets(decoded);
  const names = new Map();
  let defaultStyleId = null;
  try { defaultStyleId = readDefaultStyleIdentity(decoded); }
  catch (error) { result.semanticFailures.push({ path: 'DesignDocument', reason: `Default style reference: ${error.message}` }); }
  result.defaultStyleIdentityRecovery = defaultStyleId ? {
    status: 'recovered-document-default-style-identity', defaultStyleId: defaultStyleId.id,
    defaultStyleLibraryId: defaultStyleId.libraryId, provenance: defaultStyleId.provenance,
  } : { status: 'unresolved-document-default-style-identity' };
  for (const pack of decoded.packages) if (pack.path === 'DesignDocument') for (const o of pack.objects || []) if (o.type === 'Axure:PackageInfo') {
    try {
      const id = property(o.properties, 'package-id')?.$reference, name = property(o.properties, 'package-name');
      if (id && typeof name === 'string') {
        if (names.has(id) && names.get(id) !== name) throw new Error('Ambiguous package name');
        names.set(id, name);
      }
    } catch (error) { result.semanticFailures.push({ path: pack.path, objectId: o.id, reason: error.message }); }
  }
  for (const pack of decoded.packages) {
    if (!pack.objects?.length) continue;
    try {
      const objects = new Map();
      for (const o of pack.objects) { if (objects.has(o.id)) throw new Error('Duplicate object ID'); objects.set(o.id, o); }
      const resolve = ref => objects.get(ref?.$reference);
      const root = objects.get(pack.rootId);
      if (!root || !['Axure:Page', 'Axure:PanelState'].includes(root.type)) continue;
      if(root.type==='Axure:Page'){
        const pageAdaptive=property(root.properties,'AdaptiveStyles');
        if(pageAdaptive!==undefined&&(!Array.isArray(pageAdaptive)||pageAdaptive.length))result.adaptiveRecovery.diagnostics.push({scope:'page',packageId:pack.packageId,sourceId:root.id,code:'unsupported-page-adaptive-styles',reason:'Page adaptive appearance uses a distinct page-style carrier and is not mapped to widget overrides.'});
      }
      const diagram = resolve(property(root.properties, 'diagram'));
      if (!diagram || !['Axure:Diagram', 'Axure:PanelDiagram'].includes(diagram.type)) throw new Error('Missing or unsupported root diagram');
      const refs = property(diagram.properties, 'diagram-objects');
      if (!Array.isArray(refs)) throw new Error('Missing diagram member list');
      // Structural ownership only, never arbitrary interaction references.
      const containerOwners=new Map();
      for(const object of objects.values()){
        const members=property(object.properties,'diagram-objects');
        if(Array.isArray(members))for(const ref of members){const id=ref?.$reference;containerOwners.set(id,[...(containerOwners.get(id)??[]),object.id]);}
      }
      const output = {
        packagePath: pack.path, packageId: pack.packageId, sourcePartSha256: pack.sha256,
        rootId: root.id, rootType: root.type, diagramId: diagram.id,
        name: root.type === 'Axure:PanelState' ? property(diagram.properties, 'Name') ?? null : names.get(pack.packageId) ?? null,
        interactionRecovery: recoverInteractionMap({ owner: root, objects, packageId: pack.packageId }),
        widgets: [],
      };
      function readWidget(widget, index, tableOwnerId, menuOwnerId, treeContext) {
        if (!widget || !widget.type?.startsWith('Axure:DiagramObject:')) {
          return { storedIndex: index, status: 'unsupported-member', reference: refs[index] };
        }
        const identity = { storedIndex: index, id: widget.id, type: widget.type, selectionGroups: recoverSelectionGroups(widget), panelStatePackages: null };
        try {
          const references = property(widget.properties, 'panel-diagrams');
          if (widget.type === 'Axure:DiagramObject:DynamicPanel' && !Array.isArray(references)) throw new Error('Missing or invalid panel state references');
          identity.panelStatePackages = references ?? null;
        }
        catch (error) { identity.panelStatePackagesError = error.message; }
        try {
          const p = widget.properties, style = resolve(property(p, 'MyStyle'));
          if (style && style.type !== 'Axure:Style') throw new Error('Unexpected MyStyle target type');
          const location = treeContext?.mode==='label'?{value:treeContext.location,determined:true,overridden:true,source:'ContainedLocation'}:coordinatePair(storedStyleProperty(style, LOCATION), ['X', 'Y']);
          const size = treeContext?.mode==='label'?{value:treeContext.size,determined:true,overridden:true,source:'ContainedSize'}:coordinatePair(storedStyleProperty(style, SIZE), ['Width', 'Height']);
          const rotation = storedStyleProperty(style, 50), transform = storedStyleProperty(style, 1401);
          const adaptiveStyles = property(p, 'AdaptiveStyles');
          const selectRecovery = recoverSelectProperties(widget, objects);
          let typeCandidate = selectRecovery?.status === 'decoded-select-properties'
            ? { type:'select', selectMode:selectRecovery.selectMode, mapping:'native-select-options', evidence:'Exact ComboBox/ListBox type and ordered literal SelectObject records; stored flags are distinct from HTML effective selection' }
            : basicTypeCandidate(widget, size);
          let tableRecovery, borderRecovery, menuRecovery, menuPositionRecovery, treeRecovery, inlineFrameRecovery;
          const layerRecovery=recoverLayerMembership(widget,style,objects,diagram,pack);
          if(layerRecovery?.status==='supported-layer-membership')typeCandidate={type:'layer',mapping:'native-layer-membership'};
          if(widget.type==='Axure:DiagramObject:InlineFrame'){
            inlineFrameRecovery=recoverInlineFrame(widget,style,objects);
            if(inlineFrameRecovery.status==='supported-inline-frame')typeCandidate={type:'inlineFrame',mapping:'native-inline-frame'};
          }
          if(widget.type==='Axure:DiagramObject:TreeNodeObject'){
            if(tableOwnerId||menuOwnerId)throw new Error('Tree has an unsupported container');
            const chain=resolveStyleChain(style,root,defaultStyleId),r=chain.effective.get(50),t=chain.effective.get(1401),identity={ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0};
            if(!chain.chainComplete||r?.determined!==true||r.value!==0||t?.determined!==true||t.value?.$map?.length!==5||Object.entries(identity).some(([k,v])=>property(t.value,k)!==v)||[...styleEntries(property(style?.properties,'PropList')).keys()].some(k=>![0,LOCATION,SIZE,111].includes(k)))throw new Error('Tree identity transform or local style is unsupported');
            if(treeContext?.mode==='node')typeCandidate={type:'treeNode',mapping:'native-tree-node',rootId:treeContext.rootId,parentId:treeContext.parentId};
            else{treeRecovery=recoverTree(widget,objects,readWidget,recoverStyle(widget,style,root,defaultStyleId,resolve,{type:'tree'},undefined,undefined,undefined,pack.version),diagram.id,containerOwners,parts.get(pack.path));if(treeRecovery.status==='supported-tree')typeCandidate={type:'tree',mapping:'native-tree-root'};}
          }
          if(treeContext?.mode==='label')typeCandidate={type:'text',mapping:'native-contained-tree-label',ownerId:treeContext.parentId,rootId:treeContext.rootId};
          if(widget.type==='Axure:DiagramObject:MenuObject'){
            if(tableOwnerId||menuOwnerId)throw new Error('Native submenu recovery is not yet witnessed');
            if([...styleEntries(property(style?.properties,'PropList')).keys()].some(key=>![LOCATION,SIZE,111].includes(key)))throw new Error('Unsupported native menu container style');
            menuRecovery=recoverMenu(widget,objects,readWidget,size,diagram.id,containerOwners);
            if(menuRecovery.status==='supported-menu')typeCandidate={type:'menu',mapping:'native-menu-container'};
          }
          if(widget.type==='Axure:DiagramObject:Table'){
            if(tableOwnerId)throw new Error('Nested table cell container is unsupported');
            // The witnessed native table is a geometry-only container. Do not
            // reinterpret author appearance fields as automatic cell changes.
            if([...styleEntries(property(style?.properties,'PropList')).keys()].some(key=>![LOCATION,SIZE,111].includes(key)))throw new Error('Unsupported native table container style');
            tableRecovery=recoverTable(widget,objects,readWidget,size,diagram.id,containerOwners,menuOwnerId);
            if(tableRecovery.status==='supported-table')typeCandidate={type:'table',mapping:'native-table-matrix'};
            if(menuOwnerId){
              if(location&&(location.determined!==true||location.overridden!==true||location.value.X!==0||location.value.Y!==0))throw new Error('Stored menu table location conflicts with its zero-padding layout');
              menuPositionRecovery={status:'derived-menu-table-position',menuOwnerId,x:0,y:0,padding:[0,0,0,0],source:'MenuObject.bN04'};
            }
          }
          if(widget.type==='Axure:DiagramObject:TableCell'){
            if(!tableOwnerId)throw new Error('Table cell requires a validated matrix owner');
            borderRecovery=recoverTableCellBorders(widget);
            const chain=resolveStyleChain(style,root,defaultStyleId),rotation=chain.effective.get(50),transform=chain.effective.get(1401);
            const identity={ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0};
            if(!chain.chainComplete||rotation?.determined!==true||rotation.value!==0||transform?.determined!==true||transform.value?.$map?.length!==5||Object.entries(identity).some(([k,v])=>property(transform.value,k)!==v))throw new Error('Table cell rotation or transform is not the verified identity');
            borderRecovery.layout={rotation:0,transform:identity};
            typeCandidate={type:'tableCell',mapping:'native-table-cell',tableOwnerId};
          }
          const styleRecovery = recoverStyle(widget, style, root, defaultStyleId, resolve, typeCandidate, undefined, undefined, undefined, pack.version);
          const rotationRecovery = recoverRotation(widget,style,root,defaultStyleId,typeCandidate,pack.version);
          const authorResizePinRecovery = recoverAuthorResizePins(widget,style,root,defaultStyleId,pack.version);
          const compoundDescendant=!!(tableOwnerId||menuOwnerId||treeContext),placementRecovery=recoverPlacement(widget,style,root,defaultStyleId,typeCandidate,compoundDescendant,pack.version);
          const richTextRecovery=recoverRichText(widget,{objects,root,packageId:pack.packageId});
          return {
            ...identity, status: 'stored-fields-recovered',
            sourceDecodedOffset: widget.offset, label: property(property(p, 'name-block'), 'text') ?? null,
            typeCandidate,
            interactionRecovery: recoverInteractionMap({ owner: widget, objects, packageId: pack.packageId }),
            storedGeometry: { styleId: style?.id ?? null, location, size, rotation, transform, transformOrigin: storedStyleProperty(style,1402), ...(storedStyleProperty(style,111)?{placement:storedStyleProperty(style,111)}:{}), adaptiveStyleCount: Array.isArray(adaptiveStyles) ? adaptiveStyles.length : null, isComputedLayout: false },
            ...(rotationRecovery ? {rotationRecovery} : {}),
            ...(authorResizePinRecovery ? {authorResizePinRecovery} : {}),
            ...(placementRecovery ? {placementRecovery} : {}),
            text: richTextRecovery.status==='supported-rich-text'&&richTextRecovery.richText.links?.length?{status:'stored-rich-text-as-plain',text:richTextRecovery.richText.paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n\n'),paragraphCount:richTextRecovery.richText.paragraphs.length,formattingRecovered:false}:recoverWidgetText(widget, pack.version),
            richTextRecovery,
            styleRecovery,
            adaptiveStyleRecovery: recoverLocalAdaptiveStyles(widget,style,root,defaultStyleId,resolve,typeCandidate,pack.version,compoundDescendant),
            selectionRecovery: recoverSelection(widget, style, root, defaultStyleId, resolve, typeCandidate, pack.version),
            interactionStyleRecovery: recoverInteractionStyles(widget, style, root, defaultStyleId, resolve, typeCandidate, pack.version),
            errorHintRecovery: recoverErrorHint(widget, style, root, defaultStyleId, resolve, typeCandidate, pack.version),
            ...(widget.type === 'Axure:DiagramObject:TextBox' || widget.type === 'Axure:DiagramObject:TextArea' ? { formPropertiesRecovery: recoverFormProperties(widget) } : {}),
            ...(selectRecovery ? { selectRecovery } : {}),
            ...(tableRecovery ? { tableRecovery } : {}),
            ...(borderRecovery ? { borderRecovery } : {}),
            ...(menuRecovery ? { menuRecovery } : {}),
            ...(menuPositionRecovery ? { menuPositionRecovery } : {}),
            ...(treeRecovery ? { treeRecovery } : {}),
            ...(inlineFrameRecovery ? { inlineFrameRecovery } : {}),
            ...(layerRecovery ? { layerRecovery } : {}),
            ...(widget.type === 'Axure:DiagramObject:ImageBox' ? { imageRecovery: recoverEmbeddedImage(widget, style, size, styleRecovery, parts.get(pack.path), imageBudget) } : {}),
            storedFlags: Object.fromEntries(['AutoFitWidth', 'AutoFitHeight', 'fit-to-content', 'is-fixed', 'is-percent-width', 'Disabled', 'Selected', 'Error', 'VisibleFromSettings', 'IsContained', 'IsLocked'].map(key => [key, property(p, key) ?? null])),
          };
        } catch (error) { return { ...identity, status: 'unsupported-widget-fields', reason: error.message }; }
      }
      for (let index=0;index<refs.length;index++)output.widgets.push(readWidget(resolve(refs[index]),index));
      result.diagrams.push(output);
    } catch (error) { result.semanticFailures.push({ path: pack.path, reason: error.message }); }
  }
  return result;
}

export function inspectRpSemantics(file) {
  // Read one immutable container snapshot; byte ranges always refer to this exact decoded part.
  const container = inspectRpFile(file), parts = new Map();
  for (const entry of container.entries) { if (parts.has(entry.path)) throw new Error('Ambiguous duplicate container part path');parts.set(entry.path, entry); }
  const packages = container.entries.filter(e => e.data.length >= 4 && e.data.readUInt32LE(0) === 27).map(entry => {
    try { return { path: entry.path, sha256: entry.sha256, ...readObjectPackage(entry.data) }; }
    catch (error) { return { path: entry.path, sha256: entry.sha256, status: 'unsupported', reason: error.message }; }
  });
  return recoverRpSemantics({ fileSha256: container.fileSha256, packages }, parts);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) { console.error('Usage: node read-rp-semantics.mjs <file.rp|file.rplib>'); process.exitCode = 2; }
  else { try { console.log(JSON.stringify(inspectRpSemantics(process.argv[2]), null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
}
