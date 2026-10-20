import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpObjects } from './scripts/read-rp-objects.mjs';
import { recoverRpSemantics, property as p } from './scripts/read-rp-semantics.mjs';

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const count = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
// Execute only our own pure converter through Node's type stripper; no vendor assembly is loaded.
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip = file => stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector = url(strip('src/model/vector.ts')), tree = url(strip('src/model/page-tree-core.ts'));
const documentModule = url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)));
const { importRpSemantics } = await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(documentModule)).replace("'./page-tree-core'",JSON.stringify(tree))));
const { parseDocument, serializeDocument } = await import(documentModule);
const flatten = widgets => widgets.flatMap(w => [w,...(w.states ?? []).flatMap(s => flatten(s.widgets))]);
const source = JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json', 'utf8'));
const report = {
  target: 'Axure RP 11.0.0.4150', method: 'Self-written object parsing and static metadata; no target assembly or GUI execution',
  sourceFiles: ['research/rp-form-candidates-evidence.json','research/rp-interaction-styles-enum.json','research/rp-interaction-styles-metadata.json','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/vector.ts','src/model/page-tree-core.ts','research/rp-interaction-styles-audit.mjs'].map(file => ({ file, sha256: sha256(file) })),
  stateCodes: { MouseOver: 1, MouseDown: 2, Focused: 4, Selected: 8, Error: 16, Hint: 32, Disabled: 64 },
  samples: [], records: [], totals: { rawReferences: {}, directStates: {}, importedStyles: {}, supportedProperties: {}, rejectedReasons: {} },
};
for (const input of source.samples) {
  const decoded = inspectRpObjects(input.file); if (decoded.fileSha256 !== input.sha256) throw new Error(`Sample changed: ${input.file}`);
  const semantic = recoverRpSemantics(decoded), summary = { file: input.file, sha256: input.sha256, semanticJsonBytes: Buffer.byteLength(JSON.stringify(semantic)), rawReferences: {}, directStates: {}, semanticFailures: semantic.semanticFailures };
  try {
    const imported = importRpSemantics(semantic, path.basename(input.file)); parseDocument(serializeDocument(imported.document));
    summary.import = { widgets: imported.report.widgetsImported, skipped: imported.report.widgetsSkipped, nestedWidgets: imported.report.nestedWidgetsImported, nestedSkipped: imported.report.nestedWidgetsSkipped, styles: {}, records: [] };
    const legacy = structuredClone(semantic);
    for (const diagram of legacy.diagrams) for (const widget of diagram.widgets) delete widget.interactionStyleRecovery;
    const old = importRpSemantics(legacy,path.basename(input.file));
    summary.import.legacyCountDifferences = Object.keys(old.report).filter(key => typeof old.report[key] === 'number' && old.report[key] !== imported.report[key]);
    if (summary.import.legacyCountDifferences.length) throw new Error(`Legacy count regression: ${summary.import.legacyCountDifferences.join(',')}`);
    for (const widget of imported.document.pages.flatMap(page => flatten(page.widgets))) for (const [state,key] of Object.entries({mouseover:'mouseOverStyle',mousedown:'mouseDownStyle',focused:'focusedStyle',disabled:'disabledStyle'})) if (widget[key]) {
      count(summary.import.styles,state); count(report.totals.importedStyles,state);
      summary.import.records.push({ id:widget.id, name:widget.name, type:widget.type, state, style:widget[key] });
    }
  } catch (error) { summary.import = { rejected: error.message }; }
  report.samples.push(summary);
  for (const pack of decoded.packages) {
    const objects = new Map((pack.objects ?? []).map(object => [object.id, object]));
    for (const object of objects.values()) if (object.type === 'Axure:Style') {
      for (const entry of p(object.properties, 'PropList') ?? []) if ((p(entry,'DOAName') & 0x0fffffff) === 21) {
        for (const [state] of p(entry,'Value')?.$map ?? []) { count(summary.rawReferences,state); count(report.totals.rawReferences,state); }
      }
    }
    const diagram = semantic.diagrams.find(diagram => diagram.packageId === pack.packageId); if (!diagram) continue;
    for (const widget of diagram.widgets) {
      const recovery = widget.interactionStyleRecovery;
      if (!recovery) continue;
      if (recovery.status !== 'recovered-interaction-styles') { count(summary.directStates,recovery.status); count(report.totals.directStates,recovery.status); continue; }
      for (const [state, recovered] of Object.entries(recovery.states)) {
        count(summary.directStates,`${state}:${recovered.status}`); count(report.totals.directStates,`${state}:${recovered.status}`);
        if (recovered.status === 'no-state-style') continue;
        const target = objects.get(recovered.sourceStyleId), original = objects.get(widget.id), style = objects.get(p(original?.properties,'MyStyle')?.$reference);
        const record = { sample: path.basename(input.file), sampleSha256: input.sha256, packageId: pack.packageId, packageSha256: pack.sha256,
          diagram: diagram.name, rootType: diagram.rootType, id: widget.id, label: widget.label, type: widget.type, typeCandidate: widget.typeCandidate?.type ?? null,
          cacheChainComplete: widget.styleRecovery?.cacheChainComplete, objectStyleId: style?.id, state,
          recovered, sourceStyleMetadata: target ? target.properties.$map.filter(([key]) => key !== 'PropList') : null,
          sourceStyleProperties: target ? (p(target.properties,'PropList') ?? []).map(entry => ({ key: p(entry,'DOAName') & 0x0fffffff, rawDoaName: p(entry,'DOAName'), value: p(entry,'Value') })) : null };
        report.records.push(record);
        if (recovered.status === 'supported-state-style') for (const key of recovered.sourceProperties) count(report.totals.supportedProperties,key);
        else count(report.totals.rejectedReasons,recovered.reason);
      }
    }
  }
}
fs.writeFileSync('research/rp-interaction-styles-evidence.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ samples: report.samples.map(s => ({ file:path.basename(s.file), raw:s.rawReferences, direct:s.directStates })), totals:report.totals, records:report.records.length },null,2));
