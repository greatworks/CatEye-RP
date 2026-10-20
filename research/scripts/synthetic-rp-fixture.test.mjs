import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeSyntheticEmptyRp } from '../../scripts/synthetic-rp-fixture.mjs';
import { inspectRpSemantics } from './read-rp-semantics.mjs';

test('independently encoded synthetic RP follows the real container/object/semantic readers', () => {
  const dir=mkdtempSync(join(tmpdir(),'rea-synthetic-rp-'));
  try {
    const file=join(dir,'SYNTHETIC-empty-page.rp');writeFileSync(file,makeSyntheticEmptyRp());
    const recovery=inspectRpSemantics(file);
    assert.deepEqual(recovery.packageFailures,[]);
    // This deliberately minimal, independently encoded empty fixture has no
    // StyleSheet/DefaultStyle. Report that unknown instead of fabricating one.
    assert.deepEqual(recovery.semanticFailures,[{path:'DesignDocument',reason:'Default style reference: Default style requires an explicit local object reference'}]);
    assert.deepEqual(recovery.defaultStyleIdentityRecovery,{status:'unresolved-document-default-style-identity'});
    assert.equal(recovery.diagrams.length,1);
    assert.equal(recovery.diagrams[0].name,'SYNTHETIC empty page');
    assert.equal(recovery.diagrams[0].rootType,'Axure:Page');
    assert.deepEqual(recovery.diagrams[0].widgets,[]);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
