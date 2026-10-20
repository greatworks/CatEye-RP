import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const census=read('research/table-format-census.json'),analysis=read('research/table-format-analysis.json'),audit=read('research/table-format-import-audit.json');
const proof={target:'Axure RP 11.0.0.4150',method:'Static ECMA-335/CIL and original object graphs; own native parser/importer and focused tests; no target assembly execution or original GUI verification',assemblySha256:read('research/table-format-metadata.json').sha256,
 corpus:census.samples.map(s=>({file:s.file,sha256:s.sha256,tables:s.types['Axure:DiagramObject:Table']??0,cells:s.types['Axure:DiagramObject:TableCell']??0,packageFailures:s.packageFailures})),
 tables:analysis.tables.map(t=>({id:t.id,packageId:t.packageId,page:audit.samples.flatMap(s=>s.tables??[]).find(x=>x.id.endsWith(t.id))?'Classic table':t.page,parents:t.parents,rows:t.rows,columns:t.columns,columnWidths:t.columnWidths,rowHeights:t.rowHeights,matrixCellIds:t.matrixCellIds,containerCellIds:t.containerCellIds,admitted:t.id==='36a2bbf16b624eb9869e340c7b663c36',cells:t.cells.map(c=>({id:c.id,row:c.row,column:c.column,geometry:c.expected,localLocation:c.explicitLocalLocation,cacheChainComplete:c.appearance.cacheChainComplete,locationSource:c.appearance.resolvedGeometry.location.source,borders:c.borders,emptyPaste:c.emptyPaste,richTextStatus:c.richText.status}))})),
 protocol:{tableStatus:'supported-table',candidate:'native-table-matrix',cellCandidate:'native-table-cell',matrixOrder:'row-major',eventOrder:'diagram-objects',cellOrder:'scoped native object enumeration order, omitted only if equal to row-major',atomic:'all cells and dependencies or no table',limits:{axes:1000,cells:9999,trackMin:1,totalDimensionMax:100000}},
 evidence:[
  {file:'research/table-format-Table-cil.json',method:'Table.NIwY',token:100702118,il:['0023','005F','0068','0094','00C0','00EC','011E','0149'],claim:'Base container plus initialization string, dimensions, matrix and tracks'},
  {file:'research/table-format-TableCell-cil.json',method:'TableCell.NIwY',token:100702239,il:['0022','0097','00CE','00FF','0130','0162','0193','01C4','01FA'],claim:'TextRectObject serialization and four widths/colors'},
  {file:'research/rp-next-coverage-textrect-cil.json',method:'TextRectObject.NIwY',token:100702405,il:['0023'],claim:'Calls inherited omitted-empty rich text serialization; _IsEmpty is not text presence'},
  {file:'research/table-format-json-dispatch-cil.json',method:'wJe6.jJeK',token:100694305,il:['07B4','07C1','07F5'],claim:'Table JSON uses DiagramObjects, skips inline concatenation, FJem false'},
  {file:'research/table-format-json-dispatch-cil.json',method:'wJe6.FJem',token:100694317,il:['0031','0038','0065','0078'],claim:'False branch enumerates supplied sequence directly'},
  {file:'research/table-format-sequence-cil.json',method:'Bbib.Sb73',token:100689134,il:['0008'],claim:'Constructs System.Collections.Generic.List<T>, resolved TypeSpec1B00066E'},
  {file:'research/table-format-cell-drawing-cil.json',method:'RPFormatConverter.iJcb',token:100692593,claim:'Axvg cell border-edge elimination; prototype image seam remains unproven'}
 ],
 unknown:['Final prototype image/CSS seam width','Whole Table author style propagation','Merged cells and menu semantics','Original GUI parity'],
 tests:{reader:{file:'research/scripts/read-rp-table.test.mjs',passed:25},importer:{file:'tests/import-rp-table.test.ts',passed:24},hyperlinkRegression:{file:'tests/import-rp-rich-hyperlink.test.ts',passed:24},typecheck:'passed',fullSuite:'parent-owned; not claimed here'},
 audit:{file:'research/table-format-import-audit.json',sha256:sha('research/table-format-import-audit.json'),totals:audit.totals,samples:audit.samples.map(s=>({file:path.basename(s.file),sha256:s.sha256,import:s.import,delta:s.delta,error:s.importError,compactSemanticBytes:s.compactSemanticBytes}))}
};
fs.writeFileSync('research/table-format-evidence.json',JSON.stringify(proof,null,2)+'\n');
const sources=[...fs.readdirSync('research').filter(f=>f.startsWith('table-format-')&&f!=='table-format-manifest.json').map(f=>'research/'+f),'research/scripts/read-rp-table.test.mjs','tests/import-rp-table.test.ts','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/rp-next-coverage-textrect-cil.json'];
fs.writeFileSync('research/table-format-manifest.json',JSON.stringify({capturedAt:new Date().toISOString(),target:proof.target,assemblySha256:proof.assemblySha256,sources:sources.map(file=>({file,sha256:sha(file),bytes:fs.statSync(file).size}))},null,2)+'\n');
console.log(JSON.stringify({totals:audit.totals,sources:sources.filter(f=>['research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/table-format-evidence.md','research/table-format-evidence.json'].includes(f)).map(file=>({file,sha256:sha(file)}))},null,2));
