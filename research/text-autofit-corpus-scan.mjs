import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const files = ['research/rotation-import-baseline.json', 'research/rotation-import-audit.json', 'research/rp-vector-census.json', 'research/table-format-census.json', 'research/font-size-format-owners.json'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const source = file => ({ path: file, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) });
const [baseline, audit, census, table, titleEvidence] = files.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
const count = (values, key) => values.reduce((out, value) => { const k = String(key(value)); out[k] = (out[k] ?? 0) + 1; return out; }, {});
const flagKey = flags => `${flags.AutoFitWidth}/${flags.AutoFitHeight}`;
const nativeKey = (sha, packageId, id) => `${sha}:${packageId}:${id}`;
const vectors = new Map(census.records.map(r => [nativeKey(r.sampleSha256, r.packageId, r.id), r]));
assert.equal(vectors.size, census.records.length);
const cells = new Map(table.objects.filter(r => r.type === 'Axure:DiagramObject:TableCell').map(r => [nativeKey(r.fileSha256, r.packageId, r.id), r]));
const members = (widgets, ancestry = [], output = []) => {
  for (const widget of widgets) {
    output.push({ widget, ancestry });
    const next = [...ancestry, { id: widget.id, type: widget.type }];
    for (const state of widget.states ?? []) members(state.widgets, [...next, { id: state.id, type: 'panelState' }], output);
    members(widget.table?.cells ?? [], next, output);
    members(widget.menu ? [widget.menu.table, ...widget.menu.submenus] : [], next, output);
    members(widget.tree?.nodes ?? [], next, output);
    members(widget.treeNode ? [widget.treeNode.label, ...widget.treeNode.children] : [], next, output);
  }
  return output;
};
const breakStats = text => ({ LF: (text.match(/\n/g) ?? []).length, CR: (text.match(/\r/g) ?? []).length, LS: (text.match(/\u2028/g) ?? []).length, PS: (text.match(/\u2029/g) ?? []).length });
const records = [], samples = [], full = new Map();
for (const original of baseline.samples) {
  assert.equal(source(original.file).sha256, original.sha256, `Native bytes changed: ${original.file}`);
  const after = audit.samples.find(s => s.sha256 === original.sha256); assert.ok(after);
  const sampleName = path.basename(original.file);
  if (!original.document) { samples.push({ file: original.file, sha256: original.sha256, sample: sampleName, importError: original.importError, admittedNodes: 0 }); continue; }
  assert.equal(after.priorCompleteDocumentPreserved, true);
  const seen = new Set(), sampleRecords = [];
  for (const page of original.document.pages) {
    const additions = after.rotations.filter(w => w.pageId === page.id);
    for (const { widget: w, ancestry } of members([...page.widgets, ...additions])) {
      assert.ok(!seen.has(w.id)); seen.add(w.id);
      const match = /^rp-w-([^-]+)-([^-]+)$/.exec(w.id); assert.ok(match, `Unknown imported identity: ${w.id}`);
      const [, packageId, objectId] = match;
      const sourceType = /Source type: ([^\n]+)/.exec(w.notes ?? '')?.[1]; assert.ok(sourceType);
      const vector = vectors.get(nativeKey(original.sha256, packageId, objectId));
      if (sourceType === 'Axure:DiagramObject:VectorShape') assert.ok(vector, `Missing retained vector: ${w.id}`);
      const cell = cells.get(nativeKey(original.sha256, packageId, objectId));
      if (sourceType === 'Axure:DiagramObject:TableCell') assert.ok(cell);
      const category = vector ? vector.storedFlags.IsContained || ancestry.some(x => x.type === 'treeNode') ? 'tree-contained-vector-label' : 'ordinary-vector-shape' : cell ? ancestry.some(x => x.type === 'menu') ? 'menu-table-cell' : 'table-cell' : 'other';
      const flags = vector?.storedFlags ?? (cell ? { AutoFitWidth: cell.properties.AutoFitWidth, AutoFitHeight: cell.properties.AutoFitHeight, IsContained: cell.properties.IsContained } : null);
      if (flags) assert.ok(typeof flags.AutoFitWidth === 'boolean' && typeof flags.AutoFitHeight === 'boolean');
      const paragraphs = w.richText?.paragraphs ?? [];
      const runs = paragraphs.flatMap(p => p.runs);
      const runText = runs.map(r => r.text).join('');
      const r = {
        sample: sampleName, sampleSha256: original.sha256, packageId, sourceId: objectId, importedId: w.id,
        sourcePackageSha256: vector?.packageSha256 ?? cell?.packageSha256 ?? null,
        nativeVersion: vector?.version ?? cell?.packageVersion ?? null,
        sourceType, category, importedType: w.type, pageId: page.id, pageName: page.name, ancestry,
        nativeFlags: flags, autoFitCombination: flags ? flagKey(flags) : null,
        storedRectangle: { x: w.x, y: w.y, width: w.width, height: w.height }, rotation: w.rotation,
        importedText: { lengthUTF16: w.text?.length ?? 0, sha256: hash(w.text ?? ''), preview: (w.text ?? '').slice(0,240), breaks: breakStats(w.text ?? '') },
        layoutStyle: { textPadding: w.style.textPadding ?? null, verticalAlign: w.style.verticalAlign ?? null, lineHeight: w.style.lineHeight ?? null, textAlign: w.style.textAlign, fontFamily: w.style.fontFamily, fontSize: w.style.fontSize, fontWeight: w.style.fontWeight },
        richText: { present: !!w.richText, paragraphCount: paragraphs.length, runCount: runs.length,
          paragraphs: paragraphs.map(p => ({ runCount: p.runs.length, lineHeightPx: p.lineHeightPx ?? null, textAlign: p.textAlign ?? null, internalBreaks: breakStats(p.runs.map(r => r.text).join('')) })),
          internalRunBreaks: breakStats(runText), fontFamilies: [...new Set(runs.map(r => r.style?.fontFamily ?? null))], fontSizes: [...new Set(runs.map(r => r.style?.fontSize ?? null))],
          distinctRunStyleCount: new Set(runs.map(r => JSON.stringify(r.style ?? {}))).size,
          mixedRunStyles: new Set(runs.map(r => JSON.stringify(r.style ?? {}))).size > 1,
          links: w.richText?.links?.length ?? 0 },
        originSnapshot: additions.some(x => x.id === w.id) ? 'rotation-import-audit addition' : 'rotation-import-baseline document'
      };
      full.set(`${original.sha256}:${w.id}`, w); records.push(r); sampleRecords.push(r);
    }
  }
  const expectedNodes = after.import.widgetsImported + after.import.nestedWidgetsImported;
  assert.equal(sampleRecords.length, expectedNodes);
  samples.push({ file: original.file, sha256: original.sha256, sample: sampleName, admittedNodes: sampleRecords.length, ordinaryVectors: sampleRecords.filter(r => r.category === 'ordinary-vector-shape').length, importCounts: after.import, categories: count(sampleRecords, r => r.category) });
}
const ordinary = records.filter(r => r.category === 'ordinary-vector-shape');
const textful = ordinary.filter(r => r.importedText.lengthUTF16 > 0);
const breakGroup = values => ({ owners: values.length, nonempty: values.filter(r => r.importedText.lengthUTF16 > 0).length,
  ownersWithProjectedLF: values.filter(r => r.importedText.breaks.LF > 0).length,
  ownersWithProjectedCR: values.filter(r => r.importedText.breaks.CR > 0).length,
  projectedLF: values.reduce((n,r) => n+r.importedText.breaks.LF,0), projectedCR: values.reduce((n,r) => n+r.importedText.breaks.CR,0),
  ownersWithLSorPS: values.filter(r => r.importedText.breaks.LS+r.importedText.breaks.PS > 0).length,
  ownersWithRunInternalLF: values.filter(r => r.richText.internalRunBreaks.LF > 0).length,
  ownersWithRunInternalCR: values.filter(r => r.richText.internalRunBreaks.CR > 0).length,
  internalRunLF: values.reduce((n,r) => n+r.richText.internalRunBreaks.LF,0), internalRunCR: values.reduce((n,r) => n+r.richText.internalRunBreaks.CR,0),
  multiParagraphOwners: values.filter(r => r.richText.paragraphCount > 1).length,
  totalParagraphs: values.reduce((n,r) => n+r.richText.paragraphCount,0), paragraphCounts: count(values,r => r.richText.paragraphCount)
});
const summary = {
  sampleCount: samples.length, importedSampleCount: samples.filter(s => !s.importError).length,
  admittedNodes: records.length, sourceTypes: count(records,r => r.sourceType), categories: count(records,r => r.category),
  ordinaryShapeCount: ordinary.length, ordinaryTextfulCount: textful.length,
  flagsAll: count(ordinary,r => r.autoFitCombination), flagsTextful: count(textful,r => r.autoFitCombination),
  bySample: Object.fromEntries(samples.filter(s=>!s.importError).map(s=>{const subset=ordinary.filter(r=>r.sampleSha256===s.sha256);return[s.sample,{ordinary:subset.length,nonempty:subset.filter(r=>r.importedText.lengthUTF16>0).length,flags:count(subset,r=>r.autoFitCombination),rich:subset.filter(r=>r.richText.present).length}];})),
  importedTypes: count(ordinary,r=>r.importedType), nativeVersions: count(ordinary,r=>JSON.stringify(r.nativeVersion)),
  padding: count(ordinary,r=>JSON.stringify(r.layoutStyle.textPadding)), verticalAlign: count(ordinary,r=>r.layoutStyle.verticalAlign), widgetLineHeight:count(ordinary,r=>r.layoutStyle.lineHeight??'absent'),
  paragraphLineHeight: count(ordinary.flatMap(r=>r.richText.paragraphs),p=>p.lineHeightPx??'absent'),
  richOwners:ordinary.filter(r=>r.richText.present).length,mixedRunStyleOwners:ordinary.filter(r=>r.richText.mixedRunStyles).length,
  numericParagraphLineHeightOwners:ordinary.filter(r=>r.richText.paragraphs.some(p=>typeof p.lineHeightPx==='number')).length,
  rotations:count(ordinary,r=>r.rotation),rotatedTextful:ordinary.filter(r=>r.rotation!==0&&r.importedText.lengthUTF16>0).length,
  nestedInPanels:ordinary.filter(r=>r.ancestry.some(a=>a.type==='panelState')).length,
  lineBreaks:{plain:breakGroup(ordinary.filter(r=>!r.richText.present)),rich:breakGroup(ordinary.filter(r=>r.richText.present))},
  byFlags:Object.fromEntries(['false/false','true/true','false/true','true/false'].map(k=>{const x=ordinary.filter(r=>r.autoFitCombination===k);return[k,{owners:x.length,rich:x.filter(r=>r.richText.present).length,vertical:count(x,r=>r.layoutStyle.verticalAlign),padding:count(x,r=>JSON.stringify(r.layoutStyle.textPadding)),lineBreaks:breakGroup(x)}];}))
};
const representatives=[];
const select=(reason,predicate,prefer=()=>true)=>{const candidates=records.filter(predicate);const r=candidates.find(prefer)??candidates[0];if(!r)return;const w=full.get(`${r.sampleSha256}:${r.importedId}`);representatives.push({reason,record:r,fullText:w.text,richText:w.richText??null,style:w.style});};
for(const k of ['false/false','true/true','false/true','true/false']) select(`flags ${k}`,r=>r.category==='ordinary-vector-shape'&&r.autoFitCombination===k&&r.importedText.lengthUTF16>0,r=>r.sample==='Default.rplib');
select('plain text with explicit LF',r=>r.category==='ordinary-vector-shape'&&!r.richText.present&&r.importedText.breaks.LF>0);
select('rich run internal LF',r=>r.category==='ordinary-vector-shape'&&r.richText.present&&r.richText.internalRunBreaks.LF>0);
select('rich multiple paragraphs',r=>r.category==='ordinary-vector-shape'&&r.richText.paragraphCount>1);
select('numeric paragraph line height',r=>r.category==='ordinary-vector-shape'&&r.richText.paragraphs.some(p=>typeof p.lineHeightPx==='number'));
select('bottom vertical alignment',r=>r.category==='ordinary-vector-shape'&&r.layoutStyle.verticalAlign==='bottom'&&r.importedText.lengthUTF16>0);
select('asymmetric padding',r=>r.category==='ordinary-vector-shape'&&r.importedText.lengthUTF16>0&&new Set(r.layoutStyle.textPadding).size>1);
select('mixed rich run styles',r=>r.category==='ordinary-vector-shape'&&r.richText.mixedRunStyles);
select('nested ordinary shape',r=>r.category==='ordinary-vector-shape'&&r.ancestry.some(a=>a.type==='panelState')&&r.importedText.lengthUTF16>0);
select('rotated empty ordinary shape',r=>r.category==='ordinary-vector-shape'&&r.rotation!==0);
select('contained tree label excluded from ordinary',r=>r.category==='tree-contained-vector-label');
select('table cell excluded from ordinary',r=>r.category==='table-cell');
select('menu table cell excluded from ordinary',r=>r.category==='menu-table-cell');
for(const t of titleEvidence.owners)select('prior UX title comparison',r=>r.sampleSha256===titleEvidence.sample.sha256&&r.packageId===t.packageId&&r.sourceId===t.sourceId);
assert.equal(records.length,1778);assert.equal(ordinary.length,1571);assert.equal(summary.rotatedTextful,0);assert.equal(representatives.filter(r=>r.reason==='prior UX title comparison').length,4);
assert.equal(records.filter(r=>r.originSnapshot==='rotation-import-audit addition').length,12);
assert.equal(samples.length,11);assert.equal(samples.filter(s=>!s.importError).length,10);
const out={schema:'text-autofit-corpus-evidence-v1',capturedAt:new Date().toISOString(),method:'Pure JSON joins of immutable vector census and complete imported pre-rotation snapshot, adding only the 12 audit-confirmed post-rotation objects. No source reparsing, extraction, or new import execution.',snapshotDates:{baseline:baseline.capturedAt,rotationAudit:audit.capturedAt,vectorCensus:census.createdAt},extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',limitations:['Counts describe the retained post-rotation imported coverage snapshot, not a new current import run.','AutoFit flags are stored source values and do not prove initial/runtime resizing.','Layout and rich-text figures describe recovered document values, not measured original GUI layout.','Internal run LF is an explicit character inside a recovered paragraph; this does not infer original Wrapping or Trimming semantics.','Plain-model paragraphCount=0 means structured paragraphs are unavailable, not that the native source had no paragraphs.','Icons.rplib was rejected at the page-count limit and contributes no recovered objects.'],summary,samples,records,representatives,sources:[...samples.map(s=>({path:s.file,sha256:s.sha256})),...files.map(source)],evidence:[source('research/text-autofit-corpus-scan.mjs'),source('research/rich-text-format-evidence.md')]};
if(fs.existsSync('research/text-autofit-corpus-evidence.md'))out.evidence.push(source('research/text-autofit-corpus-evidence.md'));
fs.writeFileSync('research/text-autofit-corpus-evidence.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({summary,representatives:representatives.map(r=>({reason:r.reason,sample:r.record.sample,page:r.record.pageName,id:r.record.sourceId,package:r.record.packageId,text:r.fullText?.slice(0,140),flags:r.record.autoFitCombination,paragraphs:r.record.richText.paragraphCount,internalLF:r.record.richText.internalRunBreaks.LF,style:r.record.layoutStyle})),output:source('research/text-autofit-corpus-evidence.json')},null,2));
