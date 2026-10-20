/** Evidence-bound native adaptive set reader. Pure decoded-data processing;
 * never evaluates expressions, loads the target DLL, or invents orphan views.
 * See ../adaptive-import-sets-evidence.md and the frozen hierarchy/behavior CIL.
 */
export const NATIVE_BASE_VIEW_ID = '19e82109f102476f933582835c373474';
export const NATIVE_AUTO_VIEW_ID = '982030d673df45868f11149ca2b8b02f';
/** P111 uses BoolOverride, not a Boolean. The writer emits limbo=!True(value).
 * IGNORE=0 consequently emits limbo:true when it is an eligible declaration.
 * See adaptive-placement-format-evidence.md; no cache eligibility is inferred here.
 */
export function nativePlaced(value) {
  if (!Number.isInteger(value) || ![0,1,2].includes(value)) throw new Error('P111 requires native BoolOverride integer 0, 1 or 2');
  return value === 1;
}
const ZERO = '0'.repeat(32), GUID = /^[0-9a-f]{32}$/, SHA = /^[0-9a-f]{64}$/;
const VERSIONS = new Set(['9.0.0.0','9.0.1.0','10.0.1.0','10.0.3.0','10.0.4.0','11.0.0.0']);
const fail = message => { throw new Error(message); };
const list = (value, name, max) => { if (!Array.isArray(value) || value.length > max) fail(`invalid or oversized ${name}`); return value; };
const text = (value, name) => { if (typeof value !== 'string' || value.length > 500) fail(`invalid ${name}`); return value; };
const identity = (value, name) => { if (typeof value !== 'string' || !GUID.test(value)) fail(`invalid ${name} GUID`); return value; };
const taggedGuid = (value, name) => {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 1 || !Object.hasOwn(value,'$guid')) fail(`invalid ${name} GUID tag`);
  return identity(value.$guid,name);
};
const reference = (value, name) => {
  if (!value || value.referenceTag !== 3 || Object.keys(value).length !== 2 || !Object.hasOwn(value,'$reference')) fail(`invalid ${name} reference`);
  return identity(value.$reference,name);
};
function properties(value, label, allowed) {
  if (!value || !Array.isArray(value.$map)) fail(`missing ${label} property map`);
  const result = new Map();
  for (const pair of list(value.$map,`${label} properties`,1000)) {
    if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') fail(`invalid ${label} property entry`);
    if (result.has(pair[0])) fail(`duplicate ${label} property ${pair[0]}`);
    if (allowed && !allowed.includes(pair[0])) fail(`unsupported ${label} property ${pair[0]}`);
    result.set(pair[0],pair[1]);
  }
  return key => result.get(key);
}
function version(pack) {
  if (!Array.isArray(pack.version) || pack.version.length !== 4 || !pack.version.every(Number.isInteger) || !VERSIONS.has(pack.version.join('.'))) fail('unsupported or missing object package version');
  if (pack.schema !== 50001 || pack.status !== 'decoded-observed-object-structure') fail('unsupported object package schema/status');
  if (typeof pack.sha256 !== 'string' || !SHA.test(pack.sha256)) fail('invalid source package SHA256');
}
function dimension(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) fail('unsupported adaptive dimension (expected finite 0..100000)');
  return value;
}
function source(pack, object) { return {packageId:pack.packageId,sourceId:object.id}; }
function reliableSetId(object) {
  try {return taggedGuid(properties(object.properties,'set')('Id'),'set Id');} catch {return undefined;}
}

export function recoverAdaptiveSets({packages} = {}) {
  const result = {schema:1,status:'decoded-adaptive-sets',baseViewId:NATIVE_BASE_VIEW_ID,sets:[],pages:[],diagnostics:[]};
  const diagnostic = (scope,code,reason,context={}) => { if(result.diagnostics.length<12000)result.diagnostics.push({scope,...context,code,reason}); };
  try {
    list(packages,'packages',10000);
    const packageIds=new Set(), contexts=[], roots=[];let objectCount=0, standaloneParts=0;
    for(const pack of packages){
      // readObjectPackage also decodes standalone values (for example library
      // widgetinfo). They have no object/package identity and cannot declare
      // sets. Do not mistake an invalid object package for this separate form.
      if(pack && Object.hasOwn(pack,'rootValue') && !Object.hasOwn(pack,'packageId') && !Object.hasOwn(pack,'rootId') && Array.isArray(pack.objects) && pack.objects.length===0){
        version(pack);standaloneParts++;continue;
      }
      identity(pack?.packageId,'package');
      if(packageIds.has(pack.packageId))fail(`duplicate package ID ${pack.packageId}`);
      packageIds.add(pack.packageId);
      const objects=list(pack.objects??[],'package objects',200000);objectCount+=objects.length;
      if(objectCount>200000)fail('adaptive object inventory limit');
      const index=new Map();let invalid;
      try{version(pack);for(const object of objects){identity(object?.id,'object');if(index.has(object.id))fail(`duplicate object ID ${object.id}`);index.set(object.id,object);}}
      catch(error){invalid=error.message;diagnostic('package','unsupported-package',invalid,{packageId:pack.packageId});}
      const context={pack,objects,index,invalid};contexts.push(context);
      for(const object of objects)if(object.type==='Axure:DesignDocument')roots.push({context,object});
    }
    if(standaloneParts)diagnostic('document','standalone-value-parts','Decoded standalone values contain no object identities; not candidates for adaptive sets',{count:standaloneParts});
    let declared=[], root;
    try{
      if(roots.length!==1)fail(roots.length?'multiple DesignDocument roots':'missing DesignDocument root');
      root=roots[0];if(root.context.invalid)fail(root.context.invalid);
      const p=properties(root.object.properties,'DesignDocument');
      declared=list(p('AdaptiveViewSets'),'DesignDocument.AdaptiveViewSets',100).map(value=>reference(value,'AdaptiveViewSets'));
      if(new Set(declared).size!==declared.length)fail('duplicate declared set reference');
      if(declared.includes(ZERO))fail('zero declared set reference');
    }catch(error){diagnostic('document','unsupported-set-scope',error.message,root?source(root.context.pack,root.object):{});declared=[];root=undefined;}
    const declaredObjects=new Set();
    if(root){
      const {pack,index}=root.context;
      for(const sourceId of declared){
        const object=index.get(sourceId),raw={packageId:pack.packageId,sourceId,...(object&&reliableSetId(object)?{id:reliableSetId(object)}:{})};
        declaredObjects.add(`${pack.packageId}:${sourceId}`);
        try{
          if(!object)fail(`unresolved declared set ${sourceId}`);
          if(object.type!=='Axure:AdaptiveViewSet')fail('wrong type for declared adaptive set');
          const p=properties(object.properties,'AdaptiveViewSet',['Id','Name','DefaultAdaptiveView','AdaptiveViews']);
          const id=taggedGuid(p('Id'),'set Id');if([ZERO,NATIVE_BASE_VIEW_ID,NATIVE_AUTO_VIEW_ID].includes(id))fail('reserved set Id');
          const baseRef=reference(p('DefaultAdaptiveView'),'DefaultAdaptiveView'),namedRefs=list(p('AdaptiveViews'),'AdaptiveViews',50).map(value=>reference(value,'AdaptiveViews'));
          const refs=[baseRef,...namedRefs];if(new Set(refs).size!==refs.length)fail('duplicate Base/named view reference');
          const viewIds=new Set();
          const readView=(ref,isBase)=>{
            const view=index.get(ref);if(!view)fail(`unresolved adaptive view ${ref}`);if(view.type!=='Axure:AdaptiveView')fail('wrong type for adaptive view');
            const v=properties(view.properties,'AdaptiveView',['Id','Size','Name','BaseViewId','BaseViewName','Cursor','ParentAdaptiveViewSet']);
            const viewId=taggedGuid(v('Id'),'view Id'),parent=taggedGuid(v('BaseViewId'),'BaseViewId');
            if(isBase){if(viewId!==NATIVE_BASE_VIEW_ID||parent!==NATIVE_BASE_VIEW_ID)fail('invalid default Base identity or parent');}
            else if([ZERO,NATIVE_BASE_VIEW_ID,NATIVE_AUTO_VIEW_ID].includes(viewId))fail('reserved named view Id');
            if(viewIds.has(viewId))fail('duplicate stored view ID');viewIds.add(viewId);
            if(reference(v('ParentAdaptiveViewSet'),'ParentAdaptiveViewSet')!==object.id)fail('adaptive view parent set back-reference mismatch');
            const size=properties(v('Size'),'view Size',['Width','Height']),cursor=v('Cursor');
            if(cursor!==0&&cursor!==1)fail('unsupported PageCursor (expected Desktop0 or Touch1)');
            return {sourceId:view.id,id:viewId,name:text(v('Name'),'view Name'),width:dimension(size('Width')),height:dimension(size('Height')),cursor,baseViewId:parent,baseViewName:text(v('BaseViewName'),'BaseViewName')};
          };
          const base=readView(baseRef,true),views=namedRefs.map(ref=>readView(ref,false)),byId=new Map(views.map(view=>[view.id,view]));
          for(const view of views){
            let current=view;const seen=new Set();
            while(current){if(seen.has(current.id))fail('adaptive parent cycle');seen.add(current.id);if(current.baseViewId===NATIVE_BASE_VIEW_ID)break;current=byId.get(current.baseViewId);if(!current)fail('adaptive parent is missing or outside this set');}
          }
          result.sets.push({...raw,id,status:'supported-adaptive-set',name:text(p('Name'),'set Name'),base,views,provenance:{version:[...pack.version],sourcePartSha256:pack.sha256,documentSourceId:root.object.id}});
        }catch(error){result.sets.push({...raw,status:'unsupported-adaptive-set',reason:error.message});diagnostic('set','unsupported-adaptive-set',error.message,raw);}
      }
    }
    // Duplicate native identities are ambiguous even if one candidate failed
    // for an unrelated reason; never silently choose a survivor.
    const duplicateSets=new Set(),setIds=new Map(),viewOwners=new Map(),duplicateViewOwners=new Set();
    for(const item of result.sets){
      if(item.id){if(setIds.has(item.id)){duplicateSets.add(item.id);}else setIds.set(item.id,item);}
      if(item.status==='supported-adaptive-set')for(const view of item.views){const prior=viewOwners.get(view.id);if(prior){duplicateViewOwners.add(prior);duplicateViewOwners.add(item.sourceId);}else viewOwners.set(view.id,item.sourceId);}
    }
    result.sets=result.sets.map(item=>{
      const reason=duplicateSets.has(item.id)?'duplicate native adaptive set ID':duplicateViewOwners.has(item.sourceId)?'duplicate named view ID across sets':undefined;
      if(!reason)return item;
      const record={packageId:item.packageId,sourceId:item.sourceId,...(item.id?{id:item.id}:{}),status:'unsupported-adaptive-set',reason};diagnostic('set','ambiguous-native-id',reason,record);return record;
    });
    const supported=new Map(result.sets.filter(set=>set.status==='supported-adaptive-set').map(set=>[set.id,set]));
    for(const context of contexts)for(const object of context.objects){
      const {pack}=context;
      if(object.type==='Axure:AdaptiveViewSet'&&!declaredObjects.has(`${pack.packageId}:${object.id}`))diagnostic('set','undeclared-adaptive-set','adaptive set is not declared by the unique DesignDocument',source(pack,object));
      if(object.type!=='Axure:Page')continue;
      const record=source(pack,object);
      try{
        if(context.invalid)fail(context.invalid);
        const p=properties(object.properties,'Page'),setId=taggedGuid(p('AdaptiveViewSetId'),'Page.AdaptiveViewSetId');
        const direct=reference(p('AdaptiveViewSet'),'Page.AdaptiveViewSet');
        Object.assign(record,{setId,directSetSourceId:direct,provenance:{version:[...pack.version],sourcePartSha256:pack.sha256}});
        // Page getter OJAL resolves setId from DesignDocument. A nonzero legacy
        // direct reference is data to report, not authority to override that ID.
        if(direct!==ZERO)diagnostic('page','ignored-page-direct-reference','Page getter uses AdaptiveViewSetId; direct reference is retained without changing assignment',{...source(pack,object),directSetSourceId:direct});
        if(setId===ZERO){result.pages.push({...record,status:'unassigned'});continue;}
        const target=supported.get(setId);if(!target)fail(`unresolved or unsupported project adaptive set ${setId}`);
        result.pages.push({...record,status:'assigned',setSourceId:target.sourceId,setPackageId:target.packageId});
      }catch(error){result.pages.push({...record,status:'unsupported-assignment',reason:error.message});diagnostic('page','unsupported-assignment',error.message,source(pack,object));}
    }
    return result;
  }catch(error){
    // Inventory ambiguity prevents trusted cross-package resolution. Discard
    // all partially built successes rather than retaining accidental Map wins.
    diagnostic('document','invalid-adaptive-inventory',error.message);
    return {...result,status:'unsupported-adaptive-inventory',sets:[],pages:[]};
  }
}
