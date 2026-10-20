import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from '../research/scripts/read-rp-objects.mjs';
import {inspectRpSemantics} from '../research/scripts/read-rp-semantics.mjs';
import {NATIVE_BASE_VIEW_ID} from '../research/scripts/read-rp-adaptive.mjs';
import {encodeSyntheticRpContainer} from './synthetic-rp-object-carrier.mjs';

// SYNTHETIC test carrier. These bytes are independently encoded, NOT saved by
// Axure, NOT native write-back support, and NOT a new original-file witness.
export const SOURCE_SHA256='0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4';
const syntheticId=n=>'fa'+n.toString(16).padStart(30,'0');
export const IDS=Object.freeze({pagePackage:'216580735aa64e1db9043586ecd32d66',page:'c8fc4a19a8a04589b65905c6653f5446',target:'2f76607a24f242f6ba9db84b579676c9',orphan:'bcfb632e6e7b4fe288077a145b7330df',setObject:syntheticId(100),baseObject:syntheticId(101),tabletObject:syntheticId(102),phoneObject:syntheticId(103),set:syntheticId(200),tablet:syntheticId(201),phone:syntheticId(202),inactive:syntheticId(203),phoneButton:syntheticId(1000),baseButton:syntheticId(1100),autoButton:syntheticId(1200)});
const zero='0'.repeat(32),map=value=>({$map:Array.isArray(value)?value:Object.entries(value)}),guid=value=>({$guid:value}),ref=(value,referenceTag=3,name)=>({$reference:value,referenceTag,...(name===undefined?{}:{name})});
const get=(obj,key)=>obj.$map.find(([name])=>name===key)?.[1];
const put=(obj,key,value)=>{const pair=obj.$map.find(([name])=>name===key);if(pair)pair[1]=value;else obj.$map.push([key,value]);};
const prop=(name,value)=>map({DOAName:name|0xc0000000,Value:value});
const solid=color=>map({'fill-type':'solid','fill-color':color});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export function makeSyntheticAdaptiveRp(sourceFile='research/samples/the-basics-tab-menu.rp') {
  const sourceBytes=fs.readFileSync(sourceFile);if(hash(sourceBytes)!==SOURCE_SHA256)throw Error('Unexpected original Tab Menu source SHA256');
  const source=inspectRpObjects(sourceFile),modern=source.packages.filter(p=>p.version?.join('.')==='11.0.0.0');
  if(modern.length!==5||modern.some(p=>!p.packageId))throw Error('Expected five complete RP11 source object packages');
  // A referenced configuration can retain an older package version even when
  // its owning project graph is RP11. Resolve the actual ref19 dependency;
  // version filtering alone incorrectly removed the policy required by events.
  const sourceDocPack=modern.find(p=>p.path==='DesignDocument'),sourceDoc=sourceDocPack?.objects.find(o=>o.id===sourceDocPack.rootId);
  const configRef=sourceDoc&&get(sourceDoc.properties,'default-prototype-configuration-id');
  if(!configRef||configRef.referenceTag!==19||configRef.name!=='Axure:HtmlPrototypeGeneratorConfiguration'||typeof configRef.$reference!=='string')throw Error('Missing exact default HTML configuration reference');
  const configs=source.packages.filter(p=>p.packageId===configRef.$reference);
  if(configs.length!==1||configs[0].status!=='decoded-observed-object-structure'||configs[0].objects.find(o=>o.id===configs[0].rootId)?.type!==configRef.name)throw Error('Missing or ambiguous referenced HTML configuration package');
  const configPack=configs[0],retained=source.packages.filter(p=>modern.includes(p)||p===configPack);
  const packages=structuredClone(retained),pagePack=packages.find(p=>p.packageId===IDS.pagePackage),docPack=packages.find(p=>p.path==='DesignDocument');
  const find=(pack,id)=>{const object=pack.objects.find(o=>o.id===id);if(!object)throw Error(`Missing fixture source object ${id}`);return object;};
  const add=(pack,id,type,properties)=>{if(pack.objects.some(o=>o.id===id))throw Error('Synthetic ID collision');const object={id,type,properties:map(properties)};pack.objects.push(object);return object;};
  const doc=find(docPack,docPack.rootId),page=find(pagePack,IDS.page),target=find(pagePack,IDS.target),orphan=find(pagePack,IDS.orphan);
  const diagram=find(pagePack,get(page.properties,'diagram').$reference);
  const sourceShape=structuredClone(target),sourceStyle=structuredClone(find(pagePack,get(target.properties,'MyStyle').$reference));
  const changeStyle=(object,entries)=>{const props=get(object.properties,'PropList');for(const [key,value]of entries){const prior=props.find(p=>(get(p,'DOAName')&0xfffffff)===key);if(prior)put(prior,'Value',value);else props.push(prop(key,value));}};
  const configureShape=(widget,label,x,y,style)=>{
    put(widget.properties,'Selected',false);put(widget.properties,'SelectedStyleGroup','');put(widget.properties,'InteractionMap',ref(zero));put(widget.properties,'AdaptiveStyles',[]);
    const name=get(widget.properties,'name-block');put(name,'text',label);put(get(name,'property-dictionary'),'diagram-object-id',guid(widget.id));
    const rich=get(widget.properties,'RichTextBlock'),attributed=get(rich,'attributed-string'),paragraph=get(attributed,'Paragraphs')[0];
    put(get(paragraph,'Inlines')[0],'Text',label);put(get(rich,'property-dictionary'),'text-object-id',guid(widget.id));
    changeStyle(style,[[101,map({X:x,Y:y})],[21,map([])]]);
  };
  configureShape(target,'SYNTHETIC Target',220,220,find(pagePack,get(target.properties,'MyStyle').$reference));
  // Retain the original target's independently witnessed initial selection and
  // Selected blue fill. It makes the Tablet red / Phone empty-map barrier
  // observable without clicking the target or adding a selection action.
  put(target.properties,'Selected',true);
  const originalSelected=get(sourceStyle.properties,'PropList').find(p=>(get(p,'DOAName')&0xfffffff)===21);
  changeStyle(find(pagePack,get(target.properties,'MyStyle').$reference),[[21,structuredClone(get(originalSelected,'Value'))]]);
  configureShape(orphan,'SYNTHETIC Orphan',220,300,find(pagePack,get(orphan.properties,'MyStyle').$reference));
  const panel=pagePack.objects.find(o=>o.type==='Axure:DiagramObject:DynamicPanel');
  if(panel)changeStyle(find(pagePack,get(panel.properties,'MyStyle').$reference),[[101,map({X:20,Y:420})]]);
  const set=add(docPack,IDS.setObject,'Axure:AdaptiveViewSet',{Id:guid(IDS.set),Name:'SYNTHETIC Devices',DefaultAdaptiveView:ref(IDS.baseObject),AdaptiveViews:[ref(IDS.tabletObject),ref(IDS.phoneObject)]});
  const view=(objectId,id,name,width,parent)=>add(docPack,objectId,'Axure:AdaptiveView',{Id:guid(id),Name:name,Size:map({Width:width,Height:0}),BaseViewId:guid(parent),BaseViewName:parent===IDS.tablet?'SYNTHETIC Tablet':'',Cursor:0,ParentAdaptiveViewSet:ref(set.id)});
  view(IDS.baseObject,NATIVE_BASE_VIEW_ID,'',1200,NATIVE_BASE_VIEW_ID);view(IDS.tabletObject,IDS.tablet,'SYNTHETIC Tablet',768,NATIVE_BASE_VIEW_ID);view(IDS.phoneObject,IDS.phone,'SYNTHETIC Phone',390,IDS.tablet);
  put(doc.properties,'AdaptiveViewSets',[ref(set.id)]);put(page.properties,'AdaptiveViewSetId',guid(IDS.set));
  const style=(n,props)=>add(pagePack,syntheticId(n),'Axure:Style',{All:false,PropList:props});
  const selected=style(302,[prop(7,solid(-65536))]),hover=style(303,[prop(7,solid(-16711681))]);
  const tablet=style(300,[prop(7,solid(-16776961)),prop(101,map({X:80,Y:220})),prop(105,map({Width:240,Height:64})),prop(21,map({Selected:ref(selected.id),MouseOver:ref(hover.id)}))]);
  const phone=style(301,[prop(7,solid(-16711936)),prop(101,map({X:24,Y:240})),prop(21,map([]))]),inactive=style(304,[]);
  put(target.properties,'AdaptiveStyles',[guid(IDS.tablet),ref(tablet.id),guid(IDS.phone),ref(phone.id)]);
  put(orphan.properties,'AdaptiveStyles',[guid(IDS.inactive),ref(inactive.id)]);

  const attachEvent=(owner,start,eventType,selection)=>{
    const object=(offset,type,props)=>add(pagePack,syntheticId(start+offset),type,props);
    const treeId=syntheticId(start+1),eventNode=syntheticId(start+2),caseNode=syntheticId(start+4),actionNode=syntheticId(start+6);
    const event=object(3,'Axure:InteractionEvent',{Disabled:false,'event-type':eventType,'master-containing-raised-event':ref(zero,16,null),'raised-event-id':guid(zero),'variable-id':guid(zero)});
    const caseObject=object(5,'Axure:InteractionCase',{Disabled:false,Description:'SYNTHETIC adaptive case',Condition:ref(zero),IsNewIfGroup:true});
    const bindings=[[ref(eventNode),ref(event.id)],[ref(caseNode),ref(caseObject.id)]];
    let action;
    if(selection){action=object(7,'Axure:InteractionSetAdaptiveView',{Disabled:false,set_adaptive_view_id:guid(selection.id),set_adaptive_view_to_auto:selection.auto});bindings.push([ref(actionNode),ref(action.id)]);object(6,'Axure:Node',{children:[],'parent-node':ref(caseNode),tree:ref(treeId)});}
    object(2,'Axure:Node',{children:[ref(caseNode)],'parent-node':ref(treeId),tree:ref(treeId)});
    object(4,'Axure:Node',{children:selection?[ref(actionNode)]:[],'parent-node':ref(eventNode),tree:ref(treeId)});
    object(1,'Axure:Tree',{children:[ref(eventNode)],tree:ref(treeId)});
    const treeMap=object(0,'Axure:InteractionTreeMap',{'node-table':map(bindings),tree:ref(treeId),PackageMode:false});
    put(owner.properties,owner.type==='Axure:Page'?'interactionmap':'InteractionMap',ref(treeMap.id));
    return {ownerSourceId:owner.id,mapSourceId:treeMap.id,eventSourceId:event.id,caseSourceId:caseObject.id,...(action?{actionSourceId:action.id}:{}),nativeEventType:eventType,selection};
  };
  const buttons=[],events=[];
  for(const [id,n,label,y,selection]of [[IDS.phoneButton,1000,'SYNTHETIC Phone',20,{id:IDS.phone,auto:false}],[IDS.baseButton,1100,'SYNTHETIC Base',70,{id:NATIVE_BASE_VIEW_ID,auto:false}],[IDS.autoButton,1200,'SYNTHETIC Auto',120,{id:zero,auto:true}]]){
    const widget=structuredClone(sourceShape);widget.id=id;const ownStyle=structuredClone(sourceStyle);ownStyle.id=syntheticId(n+1);put(ownStyle.properties,'Id',guid(syntheticId(n+2)));pagePack.objects.push(widget,ownStyle);put(widget.properties,'MyStyle',ref(ownStyle.id));configureShape(widget,label,20,y,ownStyle);
    get(diagram.properties,'diagram-objects').push(ref(id));events.push(attachEvent(widget,n+10,16,selection));buttons.push({id,label,x:20,y,width:140,height:40});
  }
  events.push(attachEvent(page,2000,338));
  const rename=value=>{if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=value[i]==='Page 1'?'SYNTHETIC Adaptive Import':value[i],rename(value[i]);}else if(value&&typeof value==='object')Object.values(value).forEach(rename);};
  packages.forEach(p=>p.objects.forEach(o=>rename(o.properties)));
  const bytes=encodeSyntheticRpContainer(packages);
  return {bytes,manifest:{synthetic:true,description:'Independently encoded test RP, based on pinned decoded structure; not written/validated by Axure and not native write-back support.',source:{file:path.resolve(sourceFile),sha256:SOURCE_SHA256},retainedParts:retained.map(p=>({path:p.path,packageId:p.packageId,sha256:p.sha256,version:p.version,rootType:p.objects.find(o=>o.id===p.rootId)?.type,reason:p===configPack?'Exact DesignDocument.default-prototype-configuration-id ref19 dependency; required for supported case-selection policy.':'RP11 project/page/panel-state/settings graph carrier.'})),omittedParts:source.packages.filter(p=>!retained.includes(p)).map(p=>({path:p.path,sha256:p.sha256,version:p.version,rootType:p.objects.find(o=>o.id===p.rootId)?.type,reason:'Unrelated specification/report/print configuration outside this fixture; not selected by default HTML configuration reference. Opaque byte payloads are never re-encoded.'})),ids:IDS,buttons,events,expected:{tablet:{x:80,y:220,width:240,height:64,style:{fill:'#0000ff'},stateStyles:{selected:{fill:'#ff0000'},mouseOver:{fill:'#00ffff'}}},phone:{x:24,y:240,style:{fill:'#00ff00'},stateStyles:{}},inactive:{}},initialSelection:{target:true,baseSelectedFill:'#81d3f8',tabletSelectedFill:'#ff0000',phoneSelectedFill:'#00ff00',reason:'Target retains witnessed native Selected=true; Phone explicit empty map suppresses inherited selection style.'},rawSha256:hash(bytes)}};
}

export function writeSyntheticAdaptiveRp(directory='.build/adaptive-import-fixture') {
  fs.mkdirSync(directory,{recursive:true});const {bytes,manifest}=makeSyntheticAdaptiveRp();
  const file=path.resolve(directory,'SYNTHETIC-adaptive.raw.rp');fs.writeFileSync(file,bytes);
  const semantics=inspectRpSemantics(file);fs.writeFileSync(path.join(directory,'semantics.json'),JSON.stringify(semantics,null,2)+'\n');
  manifest.output=file;manifest.semanticsSha256=hash(fs.readFileSync(path.join(directory,'semantics.json')));
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return {file,manifest,semantics};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=writeSyntheticAdaptiveRp(process.argv[2]);console.log(JSON.stringify({file:result.file,rawSha256:result.manifest.rawSha256,sets:result.semantics.adaptiveRecovery?.sets,packageFailures:result.semantics.packageFailures,semanticFailures:result.semantics.semanticFailures},null,2));}
