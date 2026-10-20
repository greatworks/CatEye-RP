import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs=['research/table-format-census.json','research/tree-widget-format-census.json','research/menu-format-census.json'];
const records=new Map();
function add(source,owner,object,role){
  if(!object||!object.type?.startsWith('Axure:DiagramObject:'))return;
  const props=object.properties??Object.fromEntries(object.raw?.$map??[]);
  if(typeof props.IsContained!=='boolean')return;
  const id=object.id,packageId=owner.packageId,key=packageId+'/'+id;
  const old=records.get(key);
  if(old){assert.equal(old.isContained,props.IsContained);old.roles.push(role);return;}
  records.set(key,{id,packageId,type:object.type,isContained:props.IsContained,roles:[role],evidence:source,sourcePath:owner.file,sourceSha256:owner.sha256??owner.fileSha256,packageSha256:owner.packageSha256});
}
const [table,tree,menu]=inputs.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
for(const o of table.objects)add(inputs[0],o,o,'table corpus object');
for(const t of tree.trees)for(const pair of t.nodes){add(inputs[1],t,pair.node,'tree node');add(inputs[1],t,pair.label,'tree label');}
for(const m of menu.menus){add(inputs[2],m,m.menu,'menu wrapper');for(const t of m.tables)add(inputs[2],m,t,'menu inner table');for(const c of m.cells)add(inputs[2],m,c,'menu table cell');}
const values=[...records.values()];const groups={};
for(const r of values){const k=r.type+':'+r.isContained;groups[k]=(groups[k]??0)+1;}
assert.equal(groups['Axure:DiagramObject:TableCell:false'],15);
assert.equal(groups['Axure:DiagramObject:Table:false'],3);
assert.equal(groups['Axure:DiagramObject:MenuObject:false'],2);
assert.equal(groups['Axure:DiagramObject:TreeNodeObject:false'],5);
assert.equal(groups['Axure:DiagramObject:VectorShape:true'],4);
const sourceFiles=[...new Map(values.map(r=>[r.sourcePath,{path:r.sourcePath,sha256:r.sourceSha256}])).values()];
for(const f of sourceFiles)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
const output={schema:'adaptive-transition-contained-corpus-v1',capturedAt:new Date().toISOString(),method:'Read-only join of retained compact censuses; no new importer runs or sample extraction. Native IsContained storage does not alone determine all transitive DOM resets.',inputs:inputs.map(p=>({path:p,sha256:sha(fs.readFileSync(p))})),sources:sourceFiles,counts:groups,records:values};
fs.writeFileSync('research/adaptive-transition-containment.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({status:'pass',objects:values.length,counts:groups}));
