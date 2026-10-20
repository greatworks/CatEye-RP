import { NATIVE_BASE_VIEW_ID } from './scripts/read-rp-adaptive.mjs';
export const id = n => n.toString(16).padStart(32, '0');
export const guid = value => ({ $guid: value });
export const ref = value => ({ $reference: value, referenceTag: 3 });
export const map = entries => ({ $map: Object.entries(entries) });
export const object = (n,type,properties) => ({ id: id(n), type, offset: n, properties: map(properties) });
export const pack = (n,objects) => ({ packageId:id(n), sha256: 'a'.repeat(64), version:[11,0,0,0], schema:50001, status:'decoded-observed-object-structure', objects });
export const get = (o,key) => o.properties.$map.find(([name]) => name === key)?.[1];
export const set = (o,key,value) => { const pair=o.properties.$map.find(([name])=>name===key); if(pair)pair[1]=value;else o.properties.$map.push([key,value]); };
// Explicit self-written decoded fixture, not an original Axure export. Keys and
// tagged carriers follow the retained NIwY/oIw4 serializer evidence.
export function fixture() {
  const setObject = object(2,'Axure:AdaptiveViewSet',{Id:guid(id(102)),Name:'Devices',DefaultAdaptiveView:ref(id(3)),AdaptiveViews:[ref(id(4)),ref(id(5))]});
  const view = (n,stored,name,width,height,parent) => object(n,'Axure:AdaptiveView',{Id:guid(stored),Size:map({Width:width,Height:height}),Name:name,BaseViewId:guid(parent),BaseViewName:'',Cursor:1,ParentAdaptiveViewSet:ref(setObject.id)});
  const base=view(3,NATIVE_BASE_VIEW_ID,'',0,0,NATIVE_BASE_VIEW_ID),tablet=view(4,id(104),'Tablet',768,0,NATIVE_BASE_VIEW_ID),phone=view(5,id(105),'Phone',390,640,id(104));
  const doc=object(1,'Axure:DesignDocument',{AdaptiveViewSets:[ref(setObject.id)],UnrelatedPreservedByOtherReaders:true});
  const page=object(11,'Axure:Page',{AdaptiveViewSetId:guid(id(102)),AdaptiveViewSet:ref(id(0)),AdaptiveViewMatchInfos:[]});
  return {doc,setObject,base,tablet,phone,page,packages:[pack(1000,[doc,setObject,base,tablet,phone]),pack(2000,[page])]};
}

