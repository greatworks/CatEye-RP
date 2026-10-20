import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {importRpSemantics} from '../src/model/import-rp';
import {parseDocument,serializeDocument} from '../src/model/document';
import {resolveAdaptiveWidgets} from '../src/model/adaptive';
import {resolveAdaptivePage} from '../src/model/adaptive-view-sets';
// @ts-expect-error Test-only independent raw object encoder.
import {makeSyntheticPlacementRp} from '../scripts/synthetic-rp-placement-fixture.mjs';
// @ts-expect-error Native bounded reader shipped with the desktop.
import {inspectRpSemantics} from '../research/scripts/read-rp-semantics.mjs';

describe('raw RP placement across reader, importer and saved document',()=>{
  it('keeps Base placement separate from visibility and child placement resets after reload',()=>{
    const {bytes,manifest}=makeSyntheticPlacementRp(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'rea-placement-integration-')),file=path.join(directory,'SYNTHETIC.rp');
    try{
      fs.writeFileSync(file,bytes);const imported=importRpSemantics(inspectRpSemantics(file),'SYNTHETIC placement');
      expect(imported.report.widgetsImported).toBe(6);expect(imported.report.widgetsSkipped).toBe(0);expect(imported.report.eventsSkipped).toBe(0);
      const doc=parseDocument(serializeDocument(imported.document)),page=resolveAdaptivePage(doc,doc.pages[0]);
      expect(doc).toEqual(imported.document);
      for(const [viewId,targetPlaced,orphanPlaced] of [[null,true,false],[`rp-av-${manifest.ids.tablet}`,false,false],[`rp-av-${manifest.ids.phone}`,true,true]] as const){
        const widgets=resolveAdaptiveWidgets(page,viewId),id=(key:string)=>`rp-w-${manifest.ids.pagePackage}-${manifest.ids[key]}`;
        const target=widgets.find(w=>w.id===id('target'))!,orphan=widgets.find(w=>w.id===id('orphan'))!;
        expect((target as typeof target&{placed?:boolean}).placed!==false).toBe(targetPlaced);
        expect((orphan as typeof orphan&{placed?:boolean}).placed!==false).toBe(orphanPlaced);
        expect(target.hidden).toBe(false);expect(orphan.hidden).toBe(false);
      }
      expect(page.adaptiveOverrides?.[`rp-av-${manifest.ids.phone}`]?.[`rp-w-${manifest.ids.pagePackage}-${manifest.ids.target}`]).toMatchObject({placed:true});
    }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);}
  });
});
