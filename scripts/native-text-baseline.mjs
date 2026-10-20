import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

/** Compare against the frozen complete document, allowing only flags separately
 * evidenced in the pre-implementation native corpus. Never regenerate baseline. */
export async function assertNativeTextMetadataOnly(document, baseline, sourceSha256) {
  const bytes = await fs.readFile(new URL('../research/text-autofit-corpus-evidence.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '5f878e9a52ab60045c00aa3411e8d7c6aa97b1809887cbe838aa90edf7252b26');
  const records = JSON.parse(bytes).records.filter(item => item.sampleSha256 === sourceSha256);
  assert.ok(records.length > 0);
  const expected = new Map(records.map(item => [item.importedId, item])); let metadataCount = 0;
  function walk(widgets) {
    for (const widget of widgets) {
      const record = expected.get(widget.id); assert.ok(record, `Missing frozen identity ${widget.id}`);
      if (record.category === 'ordinary-vector-shape') {
        assert.deepEqual(widget.shapeText, { autoFitWidth: record.nativeFlags.AutoFitWidth, autoFitHeight: record.nativeFlags.AutoFitHeight }); metadataCount++;
      } else assert.equal(Object.hasOwn(widget, 'shapeText'), false);
      walk((widget.states ?? []).flatMap(state => state.widgets)); walk(widget.table?.cells ?? []);
      walk(widget.menu ? [widget.menu.table, ...widget.menu.submenus] : []); walk(widget.tree?.nodes ?? []);
      walk(widget.treeNode ? [widget.treeNode.label, ...widget.treeNode.children] : []);
    }
  }
  walk(document.pages.flatMap(page => page.widgets));
  assert.equal(metadataCount, records.filter(item => item.category === 'ordinary-vector-shape').length);
  assert.deepEqual(JSON.parse(JSON.stringify(document, (key, value) => key === 'shapeText' ? undefined : value)), baseline);
  return metadataCount;
}
