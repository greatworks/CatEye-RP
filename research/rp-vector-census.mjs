/** Read-only census of observed native VectorShape storage, not a path importer. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { recoverRpSemantics, property as p } from './scripts/read-rp-semantics.mjs';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json', 'utf8'));
const shapeMetadata = JSON.parse(fs.readFileSync('research/samples/metadata-Shape.json', 'utf8'));
const shapeType = shapeMetadata.Types.find(t => t.Namespace === 'Axure.Platform' && t.Name === 'Shape');
const shapeNames = Object.fromEntries(shapeType.Fields.filter(f => f.Constant?.length === 8).map(f => [Buffer.from(f.Constant, 'hex').readInt32LE(), f.Name]));
const count = (obj, key, n = 1) => { obj[String(key)] = (obj[String(key)] || 0) + n; };
const keys = value => Array.isArray(value?.$map) ? value.$map.map(([key]) => key).sort() : null;
const num = value => typeof value === 'number' && Number.isFinite(value) ? value : value?.$number === 'NaN' ? 'NaN' : { unknown: value ?? 'missing' };
const pair = value => [num(p(value, 'X')), num(p(value, 'Y'))];
const pairKind = value => value.every(n => typeof n === 'number') ? 'finite' : value.every(n => n === 'NaN') ? 'NaN-pair' : value.some(n => n === 'NaN') && value.some(n => typeof n === 'number') ? 'partial-axis-NaN' : 'unknown';
const expectedWidgetKeys = new Set(['ControlPoints','Shape','reference-page-package-id','name-block','tooltip','IsContained','IsLocked','SelectedStyleGroup','MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings','AutoFitHeight','AutoFitWidth','InteractionMap']);
const report = {
  target: 'Axure RP 11.0.0.4150', method: 'Read-only self-written container/object decoding; no vendor DLL execution or GUI validation',
  createdAt: new Date().toISOString(),
  sources: ['research/rp-form-candidates-evidence.json','research/samples/metadata-Shape.json','research/samples/metadata-PName.json','research/scripts/read-rp-container.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs','research/rp-vector-census.mjs'].map(file => ({ file, sha256: hash(file) })),
  shapeEnum: { namespace: shapeType.Namespace, token: shapeType.Token, names: shapeNames },
  samples: [], totals: {}, records: [], representatives: {},
  limitations: ['Raw objects include nondirect members; candidates are storage observations, not guaranteed importable widgets.', 'Current semantic style results depend on restricted cache recovery. Missing/inherited values are unknown.', 'Vertex segment flags describe stored topology; fill rule, implicit close, scaling and edge stroking require separate native implementation evidence.', 'NaN is retained as a sentinel, not coerced to zero. Numeric coordinates are stored values, not rendered geometry.'],
};
for (const input of source.samples) {
  const file = input.file, decoded = inspectRpObjects(file), semantic = recoverRpSemantics(decoded);
  if (decoded.fileSha256 !== input.sha256) throw new Error(`Source changed: ${file}`);
  const semanticMap = new Map(semantic.diagrams.flatMap(d => d.widgets.map(w => [`${d.packageId}:${w.id}`, { ...w, diagramName: d.name, rootType: d.rootType }])));
  const summary = { file, sha256: decoded.fileSha256, packageFailures: decoded.packages.filter(p => !p.objects).length, semanticFailures: semantic.semanticFailures, counts: {} };
  report.samples.push(summary);
  for (const pack of decoded.packages) for (const object of pack.objects || []) {
    if (object.type !== 'Axure:DiagramObject:VectorShape') continue;
    const props = object.properties, shape = p(props, 'Shape'), rawPaths = p(props, 'ControlPoints'), sem = semanticMap.get(`${pack.packageId}:${object.id}`);
    const objects = new Map(pack.objects.map(o => [o.id, o])), style = objects.get(p(props, 'MyStyle')?.$reference);
    const localStyles = (p(style?.properties, 'PropList') || []).filter(s => [7,8,15,16,50,70,71,72,80,81,101,105,1401].includes(p(s,'DOAName') & 0x0fffffff)).map(s => ({ key: p(s,'DOAName') & 0x0fffffff, raw: p(s,'DOAName'), value: p(s,'Value') }));
    const record = { sample: path.basename(file), sampleSha256: input.sha256, packageId: pack.packageId, packageSha256: pack.sha256, version: pack.version, id: object.id, offset: object.offset, shape, shapeName: shapeNames[shape] ?? null, directDiagramMember: Boolean(sem), diagramName: sem?.diagramName ?? null, rootType: sem?.rootType ?? null, propertyKeys: keys(props), missingText: p(props,'TextBlock') === undefined && p(props,'RichTextBlock') === undefined, extraMissingTextKeys: [], storedFlags: Object.fromEntries(['AutoFitWidth','AutoFitHeight','Selected','Disabled','Error','IsContained'].map(k => [k,p(props,k)])), paths: [], observations: [], localStyles, semantic: sem ? { status: sem.status, typeCandidate: sem.typeCandidate?.type, storedGeometry: sem.storedGeometry, textStatus: sem.text?.status, style: sem.styleRecovery?.style, cacheChainComplete: sem.styleRecovery?.cacheChainComplete, resolvedGeometry: sem.styleRecovery?.resolvedGeometry, unknownStyleKeys: sem.styleRecovery?.unknown.map(item=>item.property ?? item.reason) } : null };
    record.extraMissingTextKeys = record.missingText ? record.propertyKeys.filter(k => !expectedWidgetKeys.has(k)) : [];
    if (record.semantic) record.semantic.unmappedGeometryOrStroke = sem.styleRecovery?.unknown.filter(item => ['BORDER_VISIBILITY','LINE_PATTERN','ROTATION','TRANSFORM'].includes(item.property));
    let points = 0, finiteAnchors = true, knownHandles = true, falseSegments = 0, internalFalseSegments = 0, partialNaN = 0, lowerOnly = 0, higherOnly = 0, invalidKeys = 0, emptyPaths = 0, maxCoordinate = 0, minCoordinate = 0, anchorOutside = false, handleOutside = false;
    if (!Array.isArray(rawPaths)) record.observations.push('ControlPoints is not an array');
    else for (const rawPath of rawPaths) {
      if (!Array.isArray(rawPath)) { record.observations.push('Path is not an array'); continue; }
      if (!rawPath.length) emptyPaths++;
      const vertices = rawPath.map((vertex,i) => {
        const anchor = pair(p(vertex,'Path')), lower = pair(p(vertex,'LowerHandle')), higher = pair(p(vertex,'HigherHandle')), segment = p(vertex,'HigherSegmentExists');
        const a = pairKind(anchor), l = pairKind(lower), h = pairKind(higher);
        if (a !== 'finite') finiteAnchors = false;
        if (l === 'unknown' || h === 'unknown' || typeof segment !== 'boolean') knownHandles = false;
        if (l === 'partial-axis-NaN' || h === 'partial-axis-NaN') partialNaN++;
        if (l === 'finite' && h !== 'finite') lowerOnly++;
        if (h === 'finite' && l !== 'finite') higherOnly++;
        if (segment === false) { falseSegments++; if (i !== rawPath.length - 1) internalFalseSegments++; }
        if (JSON.stringify(keys(vertex)) !== JSON.stringify(['HigherHandle','HigherSegmentExists','LowerHandle','Path']) || ['Path','LowerHandle','HigherHandle'].some(k => JSON.stringify(keys(p(vertex,k))) !== JSON.stringify(['X','Y']))) invalidKeys++;
        for (const [kind,xy] of [['anchor',anchor],['handle',lower],['handle',higher]]) for (const n of xy) if (typeof n === 'number') { minCoordinate = Math.min(minCoordinate,n); maxCoordinate = Math.max(maxCoordinate,n); if (n < 0 || n > 1) { if (kind === 'anchor') anchorOutside = true; else handleOutside = true; } }
        return [...anchor,...lower,...higher,segment];
      });
      points += vertices.length;
      record.paths.push(vertices);
    }
    record.topology = { pathCount: record.paths.length, pathLengths: record.paths.map(a => a.length), pointCount: points, finiteAnchors, knownHandles, falseSegments, internalFalseSegments, allSegmentsExist: falseSegments === 0, partialAxisNaNVertices: partialNaN, lowerOnlyVertices: lowerOnly, higherOnlyVertices: higherOnly, invalidMapKeys: invalidKeys, emptyPaths, anchorOutsideUnitSquare: anchorOutside, handleOutsideUnitSquare: handleOutside, minCoordinate, maxCoordinate };
    record.storageCandidate = Array.isArray(rawPaths) && record.paths.length > 0 && !emptyPaths && finiteAnchors && knownHandles && !invalidKeys;
    report.records.push(record);
    for (const counts of [summary.counts, report.totals]) {
      count(counts,'vectorShapes');count(counts,`shape:${shape}:${shapeNames[shape]}`);count(counts,`paths:${record.paths.length}`);count(counts,`version:${pack.version.join('.')}`);count(counts,sem?'directDiagramMembers':'nonDirectObjects');
      if (record.storageCandidate) { count(counts,'storageCandidates'); if (sem) count(counts,'directStorageCandidates'); }
      if (record.missingText) { count(counts,'missingText');count(counts,`missingTextShape:${shape}`); if (record.extraMissingTextKeys.length) count(counts,'missingTextUnknownKeys'); }
      if (falseSegments) count(counts,'hasFalseSegment'); else count(counts,'allSegmentsExist');
      if (internalFalseSegments) count(counts,'hasInternalFalseSegment');
      if (record.paths.length > 1) count(counts,'compoundPaths');
      if (partialNaN) count(counts,'partialAxisNaNObjects');
      if (lowerOnly || higherOnly) count(counts,'oneHandleOnlyObjects');
      if (anchorOutside) count(counts,'anchorOutsideUnitSquare');
      if (handleOutside) count(counts,'handleOutsideUnitSquare');
      if (invalidKeys) count(counts,'unknownControlPointMapKeys');
      if (!finiteAnchors) count(counts,'nonfiniteAnchorObjects');
      if (sem?.styleRecovery) { count(counts,`semanticCache:${sem.styleRecovery.cacheChainComplete}`); count(counts,`semanticStrokeWidth:${sem.styleRecovery.style.strokeWidth ?? 'unknown'}`); }
    }
    const tags = [`shape:${shape}`, ...(record.paths.length>1?['compound']:[]), ...(falseSegments?['open-or-disconnected']:[]), ...(internalFalseSegments?['internal-break']:[]), ...(partialNaN?['partial-axis-NaN']:[]), ...(lowerOnly || higherOnly?['one-handle-only']:[]), ...(anchorOutside?['anchor-outside-unit']:[]), ...(handleOutside?['handle-outside-unit']:[]), ...(invalidKeys?['unexpected-point-keys']:[]), ...(!finiteAnchors?['nonfinite-anchor']:[])];
    for (const tag of tags) if (!report.representatives[tag] || points < report.records[report.representatives[tag].recordIndex].topology.pointCount) report.representatives[tag] = { recordIndex: report.records.length - 1, sample: record.sample, packageId: pack.packageId, id: object.id, pointCount: points };
  }
}
report.totals.totalPaths = report.records.reduce((n,r) => n + r.paths.length, 0);
report.totals.totalVertices = report.records.reduce((n,r) => n + r.topology.pointCount, 0);
report.totals.maxPointsPerObject = Math.max(...report.records.map(r => r.topology.pointCount));
report.totals.maxPathsPerObject = Math.max(...report.records.map(r => r.paths.length));
report.aggregateDetails = { pathLengths: {}, pathFlags: {}, vertexHandles: {}, enabledEdgeHandles: {}, duplicateAdjacentAnchors: 0, localStyleValues: {}, missingTextVersionShape: {}, closedCompoundCandidates: [], minimumVertexCount: Infinity, coordinateRange: { min: 0, max: 0 } };
const ag = report.aggregateDetails;
for (const r of report.records) {
  if (r.missingText) count(ag.missingTextVersionShape, `${r.version.join('.')}/shape${r.shape}/${r.extraMissingTextKeys.length?'unknown-keys':'known-keys'}`);
  for (const s of r.localStyles) if ([7,8,15,16,80].includes(s.key)) {
    const values = ag.localStyleValues[s.key] ||= {};
    count(values, s.key === 7 || s.key === 8 ? `${p(s.value,'fill-type') ?? 'unknown'}/determined=${Boolean(s.raw & 0x80000000)}` : `${JSON.stringify(s.value)}/determined=${Boolean(s.raw & 0x80000000)}`);
  }
  ag.coordinateRange.min = Math.min(ag.coordinateRange.min,r.topology.minCoordinate);
  ag.coordinateRange.max = Math.max(ag.coordinateRange.max,r.topology.maxCoordinate);
  if (r.paths.length > 1 && r.paths.every(a => a.every(v => v[6] === true))) ag.closedCompoundCandidates.push({ sample:r.sample,packageId:r.packageId,id:r.id,shape:r.shape,direct:r.directDiagramMember,paths:r.paths.length,vertices:r.topology.pointCount,diagram:r.diagramName });
  for (const vertices of r.paths) {
    ag.minimumVertexCount = Math.min(ag.minimumVertexCount,vertices.length);
    count(ag.pathLengths,vertices.length);
    count(ag.pathFlags,vertices.every(v=>v[6])?'all-true':vertices.slice(0,-1).every(v=>v[6])?'last-false-only':'interior-false');
    for (let i=0;i<vertices.length;i++) {
      const v=vertices[i],prev=vertices[(i+vertices.length-1)%vertices.length];
      count(ag.vertexHandles,`${pairKind(v.slice(2,4))}/${pairKind(v.slice(4,6))}`);
      if (prev[6]) count(ag.enabledEdgeHandles,`${pairKind(prev.slice(4,6))}/${pairKind(v.slice(2,4))}`);
      if (prev[0]===v[0] && prev[1]===v[1]) ag.duplicateAdjacentAnchors++;
    }
  }
}
const summarize = records => ({ rawObjects: records.length, directDiagramMembers: records.filter(r => r.directDiagramMember).length, version11: records.filter(r => r.version.join('.') === '11.0.0.0').length, version11Direct: records.filter(r => r.version.join('.') === '11.0.0.0' && r.directDiagramMember).length });
report.candidateLayers = {
  structuralOnly: summarize(report.records.filter(r=>r.storageCandidate)),
  rejectInternalFalse: summarize(report.records.filter(r=>r.storageCandidate && !r.topology.internalFalseSegments)),
  newShapesRejectInternalFalse: summarize(report.records.filter(r=>r.storageCandidate && ![0,15].includes(r.shape) && !r.topology.internalFalseSegments)),
  closedCompoundOnly: summarize(report.records.filter(r=>r.paths.length>1&&r.paths.every(a=>a.every(v=>v[6])))),
  missingTextKnownKeysOnly: summarize(report.records.filter(r=>r.missingText&&!r.extraMissingTextKeys.length)),
  newShapesMissingTextKnownKeysOnly: summarize(report.records.filter(r=>r.missingText&&!r.extraMissingTextKeys.length&&![0,15].includes(r.shape))),
};
for (const file of report.sources) if (hash(file.file) !== file.sha256) throw new Error(`Reader source changed during census: ${file.file}`);
report.pointEncoding = '[Path.X, Path.Y, LowerHandle.X, LowerHandle.Y, HigherHandle.X, HigherHandle.Y, HigherSegmentExists]; NaN sentinel string is not a numeric zero';
fs.writeFileSync('research/rp-vector-census.json', JSON.stringify(report)+'\n');
console.log(JSON.stringify({ totals: report.totals, samples: report.samples.map(s=>({sample:path.basename(s.file),count:s.counts.vectorShapes,direct:s.counts.directDiagramMembers,compound:s.counts.compoundPaths||0,open:s.counts.hasFalseSegment||0})), representatives: report.representatives },null,2));
