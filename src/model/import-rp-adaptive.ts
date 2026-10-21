import type { AdaptiveViewSet, AdaptiveViewTarget, AdaptiveWidgetOverride, Widget, WidgetStyle, GradientFill } from './types';
import { ARROW_STYLES, LINE_PATTERNS } from './types';
import { parseNativeSelectionStylePatch } from './import-rp-selection-layout';
import { importNativeAuthorPin } from './import-rp-resize-pins';

type Data = Record<string, unknown>;
type Issue = (code: string, message: string, packageId?: string, sourceId?: string, details?: unknown) => void;
const ZERO = '0'.repeat(32);
export const RP_BASE_VIEW = '19e82109f102476f933582835c373474';
const AUTO = '982030d673df45868f11149ca2b8b02f';
const VERSIONS = ['9.0.0.0','9.0.1.0','10.0.1.0','10.0.3.0','10.0.4.0','11.0.0.0'];
function fail(message: string): never { throw new Error(message); }
function object(value: unknown, required: string[], optional: string[] = []): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('自适应恢复对象无效。');
  const o=value as Data;
  if (required.some(k=>!Object.hasOwn(o,k)) || Object.keys(o).some(k=>!required.includes(k)&&!optional.includes(k))) fail('自适应恢复字段不完整或包含未知字段。');
  return o;
}
function array(value: unknown, limit: number): unknown[] { if(!Array.isArray(value)||value.length>limit)fail('自适应恢复列表无效或超过上限。');return value; }
function guid(value: unknown): string { if(typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))fail('自适应原生 GUID 无效。');return value; }
function text(value: unknown): string { if(typeof value!=='string'||value.length>500)fail('自适应名称或诊断无效。');return value; }
function size(value: unknown): number { if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100000)fail('自适应尺寸必须为有限的 0..100000。');return value; }
function provenance(value: unknown, document = false): Data {
  const p=object(value,['version','sourcePartSha256',...(document?['documentSourceId']:[])]),v=array(p.version,4);
  if(v.length!==4||!v.every(Number.isInteger)||!VERSIONS.includes(v.join('.'))||typeof p.sourcePartSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sourcePartSha256))fail('自适应来源版本或摘要无效。');
  if(document)guid(p.documentSourceId);return p;
}
interface NativeSet { raw: Data; nativeId: string; sourceId: string; packageId: string; model: AdaptiveViewSet; viewIds: Set<string> }
interface Assignment { sourceId: string; set?: NativeSet }
export interface ImportedAdaptiveSets {
  sets: AdaptiveViewSet[];
  assignments: Map<string, Assignment>;
  target: (pagePackageId: string, value: unknown) => AdaptiveViewTarget;
}

/** Revalidate the decoded native protocol rather than spreading it into a project. */
export function importAdaptiveSets(value: unknown, diagrams: unknown[], issue: Issue): ImportedAdaptiveSets {
  const assignments=new Map<string,Assignment>(),result:ImportedAdaptiveSets={sets:[],assignments,target(pagePackageId,targetValue){
    const target=object(targetValue,['kind'],['guid']);
    const assignment=assignments.get(pagePackageId);if(!assignment)fail('动作所属页面的自适应集合或归属未完整恢复。');
    if(target.kind==='auto'||target.kind==='base'){object(targetValue,['kind']);return {kind:target.kind};}
    if(target.kind!=='nativeGuid')fail('未知原生自适应动作目标类型。');
    object(targetValue,['kind','guid']);const nativeId=guid(target.guid);
    if([ZERO,AUTO,RP_BASE_VIEW].includes(nativeId)||!assignment.set?.viewIds.has(nativeId))fail('原生自适应动作目标不属于页面的完整集合；整个事件省略。');
    return {kind:'view',viewId:`rp-av-${nativeId}`};
  }};
  if(value===undefined)return result;
  try{
    const recovery=object(value,['schema','status','baseViewId','sets','pages','diagnostics']);
    if(recovery.schema!==1||recovery.status!=='decoded-adaptive-sets'||recovery.baseViewId!==RP_BASE_VIEW)fail('自适应恢复协议版本、状态或 Base 标识无效。');
    const sets=array(recovery.sets,100),pages=array(recovery.pages,10000);
    const diagnostics=array(recovery.diagnostics,12000);
    for(const value of diagnostics){const d=object(value,['scope','code','reason'],['packageId','sourceId','id','directSetSourceId','status','count']);if(!['document','package','set','page'].includes(String(d.scope)))fail('自适应诊断范围无效。');text(d.code);if(typeof d.reason!=='string'||d.reason.length>2000)fail('自适应诊断无效。');for(const k of ['packageId','sourceId','id','directSetSourceId'])if(d[k]!==undefined)guid(d[k]);if(d.count!==undefined&&(!Number.isSafeInteger(d.count)||Number(d.count)<0))fail('自适应诊断计数无效。');if(d.status!==undefined)text(d.status);}
    // Reject all colliding candidates, even when one failed some other check.
    const counts=new Map<string,number>(),viewOwners=new Map<string,Set<string>>();
    for(const entry of sets){
      if(entry&&typeof entry==='object'&&!Array.isArray(entry)){
        const s=entry as Data;if(typeof s.id==='string')counts.set(s.id,(counts.get(s.id)??0)+1);
        if(Array.isArray(s.views))for(const item of s.views){if(item&&typeof item==='object'&&typeof (item as Data).id==='string'){const key=(item as Data).id as string,owners=viewOwners.get(key)??new Set<string>();owners.add(JSON.stringify([s.packageId,s.sourceId,s.id]));viewOwners.set(key,owners);}}
      }
    }
    const supported=new Map<string,NativeSet>();
    for(const entry of sets){
      let nativeId:string|undefined,sourceId:string|undefined,packageId:string|undefined;
      try{
        const raw=entry as Data;
        if(raw?.status==='unsupported-adaptive-set'){const s=object(raw,['packageId','sourceId','status','reason'],['id']);packageId=guid(s.packageId);sourceId=guid(s.sourceId);if(s.id!==undefined)nativeId=guid(s.id);throw new Error(typeof s.reason==='string'?s.reason:'原集合未完整恢复。');}
        const s=object(entry,['packageId','sourceId','id','status','name','base','views','provenance']);nativeId=guid(s.id);sourceId=guid(s.sourceId);packageId=guid(s.packageId);
        if(s.status!=='supported-adaptive-set'||[ZERO,RP_BASE_VIEW,AUTO].includes(nativeId)||(counts.get(nativeId)??0)!==1)fail('自适应集合状态、标识或唯一性无效。');
        provenance(s.provenance,true);
        const seenIds=new Set<string>(),sourceIds=new Set([sourceId]);
        const view=(value:unknown,isBase:boolean)=>{
          const v=object(value,['sourceId','id','name','width','height','cursor','baseViewId','baseViewName']),native=guid(v.id),source=guid(v.sourceId),parent=guid(v.baseViewId);
          if(sourceIds.has(source)||seenIds.has(native))fail('自适应视图身份重复。');sourceIds.add(source);seenIds.add(native);
          if(isBase?native!==RP_BASE_VIEW||parent!==RP_BASE_VIEW:[ZERO,RP_BASE_VIEW,AUTO].includes(native)||(viewOwners.get(native)?.size??0)>1)fail('自适应视图 Base、父级或跨集合身份无效。');
          if(v.cursor!==0&&v.cursor!==1)fail('未知原生设备光标类型。');text(v.baseViewName);
          return {id:`rp-av-${native}`,name:text(v.name),width:size(v.width),height:size(v.height),...(parent===RP_BASE_VIEW?{}:{baseViewId:`rp-av-${parent}`})};
        };
        const base=view(s.base,true),views=array(s.views,50).map(v=>view(v,false)),byId=new Map(views.map(v=>[v.id,v]));
        for(const item of views){let v:typeof item|undefined=item;const seen=new Set<string>();while(v){if(seen.has(v.id))fail('自适应视图父级循环。');seen.add(v.id);if(!v.baseViewId)break;v=byId.get(v.baseViewId);if(!v)fail('自适应父级不属于本集合。');}}
        const model:AdaptiveViewSet={id:`rp-avs-${nativeId}`,name:text(s.name),baseSize:{width:base.width,height:base.height},views};
        supported.set(nativeId,{raw:s,nativeId,sourceId,packageId,model,viewIds:new Set(views.map(v=>v.id.slice(6)))});
      }catch(error){issue('adaptive-set-omitted',error instanceof Error?error.message:'自适应集合未恢复。',packageId,sourceId,entry);}
    }
    result.sets=[...supported.values()].map(s=>s.model);
    for(const set of supported.values())issue('adaptive-device-shell-unmapped','已保留原生视图尺寸和层级；Desktop/Touch 光标及设备壳设置仅保留在来源报告，未转换为播放器设备外观。',set.packageId,set.sourceId,set.raw);
    const sourcePages=new Map<string,Data>();
    for(const d of diagrams)if(d&&typeof d==='object'&&!Array.isArray(d)&&(d as Data).rootType==='Axure:Page')sourcePages.set(String((d as Data).packageId),d as Data);
    const pageCounts=new Map<string,number>();for(const p of pages)if(p&&typeof p==='object'&&typeof (p as Data).packageId==='string'){const key=(p as Data).packageId as string;pageCounts.set(key,(pageCounts.get(key)??0)+1);}
    for(const entry of pages){let packageId:string|undefined,sourceId:string|undefined;
      try{
        const raw=entry as Data;
        if(raw?.status==='unsupported-assignment'){const p=object(raw,['packageId','sourceId','status','reason'],['setId','directSetSourceId','provenance']);packageId=guid(p.packageId);sourceId=guid(p.sourceId);throw new Error(typeof p.reason==='string'?p.reason:'页面自适应归属未知。');}
        const p=object(entry,['packageId','sourceId','status','setId','directSetSourceId','provenance'],['setSourceId','setPackageId']);packageId=guid(p.packageId);sourceId=guid(p.sourceId);const nativeId=guid(p.setId);guid(p.directSetSourceId);
        const source=sourcePages.get(packageId),proof=provenance(p.provenance);
        if(pageCounts.get(packageId)!==1||!source||source.rootId!==sourceId||source.sourcePartSha256!==proof.sourcePartSha256)fail('页面自适应归属的源对象、包摘要或唯一性不一致。');
        if(p.status==='unassigned'){if(nativeId!==ZERO||p.setSourceId!==undefined||p.setPackageId!==undefined)fail('无集合页面载体不一致。');assignments.set(packageId,{sourceId});continue;}
        const set=supported.get(nativeId);
        if(p.status!=='assigned'||!set||guid(p.setSourceId)!==set.sourceId||guid(p.setPackageId)!==set.packageId)fail('页面自适应集合引用未完整恢复。');
        assignments.set(packageId,{sourceId,set});
      }catch(error){issue('adaptive-assignment-omitted',error instanceof Error?error.message:'页面自适应归属未恢复。',packageId,sourceId,entry);}
    }
    if(diagnostics.length)issue('adaptive-source-diagnostics','原生自适应来源诊断已保留；不根据缓存或名称补造缺失集合。',undefined,undefined,diagnostics);
    return result;
  }catch(error){issue('adaptive-recovery-omitted',error instanceof Error?error.message:'自适应恢复协议无效。',undefined,undefined,value);return result;}
}

function number(value: unknown, min: number, max: number): number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail('原生局部样式数值无效。');return value;
}
function bool(value:unknown):boolean {if(typeof value!=='boolean')fail('原生局部样式布尔值无效。');return value;}
function rawMap(value:unknown,keys?:string[],limit=100):Map<string,unknown>{
  const o=object(value,['$map']),pairs=array(o.$map,limit),result=new Map<string,unknown>();
  for(const pair of pairs){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||result.has(pair[0])||keys&&!keys.includes(pair[0]))fail('原生局部样式 map 字段无效或重复。');result.set(pair[0],pair[1]);}
  if(keys&&result.size!==keys.length)fail('原生局部样式 map 字段不完整。');return result;
}
function eligibleProperties(value:unknown):Map<number,unknown>{
  const all=new Set<number>(),result=new Map<number,unknown>();
  for(const entry of array(value,1000)){
    const p=object(entry,['rawDoaName','value']),raw=number(p.rawDoaName,-2147483648,2147483647);
    if(!Number.isInteger(raw))fail('原生 DOAName 必须为 Int32。');
    const key=raw&0x0fffffff;if(all.has(key))fail('重复的原生局部样式属性。');all.add(key);
    if(key===111)placedEnum(p.value);
    if([106,107,108,109].includes(key)){if((raw&0x3fffffff)!==key)fail('固定边约束包含未知标记。');importNativeAuthorPin(key,p.value);}
    if(key===94){if((raw&0x3fffffff)!==94)fail('选择控件尺寸包含未知标记。');number(p.value,0,100000);}
    if((raw>>>30)===3)result.set(key,p.value);
  }
  return result;
}
function argb(value:unknown):string{
  const n=number(value,-2147483648,4294967295);if(!Number.isInteger(n))fail('原生颜色必须为 ARGB 整数。');
  const u=n>>>0,hex=(u&0xffffff).toString(16).padStart(6,'0'),alpha=u>>>24;return '#'+hex+(alpha===255?'':alpha.toString(16).padStart(2,'0'));
}
function nativePaint(value:unknown,version:string):string|GradientFill{
  const kind=rawMap(value).get('fill-type');
  if(kind==='solid')return argb(rawMap(value,['fill-type','fill-color']).get('fill-color'));
  if(kind!=='linear-gradient'&&kind!=='radial-gradient')fail('未知原生局部渐变类型。');
  const keys=['fill-type','fill-center-point','fill-axis1','fill-offsets','fill-colors',...(kind==='linear-gradient'?['fill-angle']:['fill-axis2'])],m=rawMap(value,keys);
  const point=(v:unknown)=>{const m=rawMap(v,['X','Y']);return{x:number(m.get('X'),-1000,1000),y:number(m.get('Y'),-1000,1000)};};
  const offsets=array(m.get('fill-offsets'),100),colors=array(m.get('fill-colors'),100);
  if(offsets.length<2||offsets.length!==colors.length)fail('原生局部渐变色标数量无效。');
  let last=-1;const stops=offsets.map((value,i)=>{const offset=number(value,0,1);if(offset<last)fail('原生渐变色标未排序。');last=offset;return{offset,color:argb(colors[i])};});
  if(kind==='linear-gradient'){const angle=number(m.get('fill-angle'),-Number.MAX_VALUE,Number.MAX_VALUE);if(version!=='11.0.0.0'&&angle!==0)fail('此版本非零渐变角度未验证。');return{type:'linear',start:point(m.get('fill-center-point')),end:point(m.get('fill-axis1')),stops};}
  return{type:'radial',center:point(m.get('fill-center-point')),axis1:point(m.get('fill-axis1')),axis2:point(m.get('fill-axis2')),stops};
}
function nativeVisual(properties:Map<number,unknown>,version:string,widget:Widget,validateSurface:(style:Partial<WidgetStyle>,widget:Widget)=>void):Partial<WidgetStyle>{
  const out:Data={},padding=[12,13,14,11];
  if(padding.some(key=>properties.has(key))&&!padding.every(key=>properties.has(key)))fail('不完整的局部四边文字内距无法保持继承。');
  for(const [key,value]of properties){
    if(padding.includes(key))continue;
    if(key===1){if(typeof value!=='string'||value.length>200||!/^[\p{L}\p{N}\s,'"_-]+$/u.test(value))fail('局部字体名称无效。');out.fontFamily=value;}
    else if(key===2)out.fontSize=number(value,.75,384)/.75;
    else if(key===5||key===95)out[key===5?'underline':'strikethrough']=bool(value);
    else if(key===6){const paint=nativePaint(value,version);if(typeof paint!=='string')fail('文字渐变颜色未支持。');out.color=paint;}
    else if(key===7||key===8){const paint=nativePaint(value,version);out[key===7?(typeof paint==='string'?'fill':'fillGradient'):(typeof paint==='string'?'stroke':'strokeGradient')]=paint;}
    else if(key===9||key===10){const n=number(value,0,2);if(!Number.isInteger(n))fail('局部对齐值无效。');out[key===9?'textAlign':'verticalAlign']=(key===9?['left','center','right']:['top','middle','bottom'])[n];}
    else if(key===15)out.strokeWidth=number(value,0,100);
    else if(key===16){const n=number(value,1,9);if(!Number.isInteger(n))fail('局部边框图案无效。');out.linePattern=LINE_PATTERNS[n-1];}
    else if(key===17){const m=rawMap(value,['Start','End']);const arrow=(v:unknown)=>{const n=number(v,1,29);if(!Number.isInteger(n))fail('局部线端值无效。');return ARROW_STYLES[n-1];};out.lineEnds={start:arrow(m.get('Start')),end:arrow(m.get('End'))};}
    else if(key===20){if(value!==0||!widget.richText?.paragraphs.length||widget.richText.paragraphs.some(p=>p.lineHeightPx!=='normal'))fail('局部自动行距缺少全部原段落 LineSpacing=0 的已验证证据。');out.lineHeight='normal';}
    else if(key===70)out.opacity=number(value,0,1);
    else if(key===71)out.radius=number(value,0,10000);
    else if([72,73,74].includes(key)){
      const m=rawMap(value,['On','OffsetX','OffsetY','BlurRadius','Color','Spread']),spread=number(m.get('Spread'),0,1000);
      if(key!==73&&spread!==0)fail('原生外阴影或文字阴影的扩展半径未支持。');
      out[key===72?'outerShadow':key===73?'innerShadow':'textShadow']={on:bool(m.get('On')),offsetX:number(m.get('OffsetX'),-1000,1000),offsetY:number(m.get('OffsetY'),-1000,1000),blurRadius:number(m.get('BlurRadius'),0,1000),color:argb(m.get('Color')),...(key===73?{spread}:{})};
    }else if(key===80){const n=number(value,0,15);if(!Number.isInteger(n)||!['box','input','textarea','select'].includes(widget.type))fail('此原生元件的四边显隐未验证。');out.borderVisibility=[2,4,8,1].map(bit=>Boolean(n&bit));}
    else if(key===81){const n=number(value,0,15);if(!Number.isInteger(n)||!['box','input','textarea','select'].includes(widget.type))fail('此原生元件的四角显隐未验证。');out.cornerVisibility=[1,2,4,8].map(bit=>Boolean(n&bit));}
    else if(key===94){if(version!=='11.0.0.0'||!['checkbox','radio'].includes(widget.type))fail('此原生元件或版本的选择控件尺寸未验证。');out.selectionButtonSize=number(value,0,100000);}
    else if(key===1001)out.fontWeight=number(value,100,1000);
    else if(key===1002){if(value!==0&&value!==1)fail('此原生字体样式未支持。');out.fontStyle=value===0?'normal':'italic';}
    else fail(`未支持的有效局部视觉属性 ${key}。`);
  }
  if(padding.every(key=>properties.has(key)))out.textPadding=padding.map(key=>number(properties.get(key),0,1000));
  const parsed=parseNativeSelectionStylePatch(out,widget.type);validateSurface(parsed,widget);return parsed;
}
function equalData(a:unknown,b:unknown):boolean{
  if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const x=a as Data,y=b as Data,keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(key=>Object.hasOwn(y,key)&&equalData(x[key],y[key]));
}

/** Project native raw local declarations a second time at the editable-project boundary. */
export function importAdaptiveStyles(value:unknown,count:unknown,sourceId:string,widget:Widget,validateSurface:(style:Partial<WidgetStyle>,widget:Widget)=>void,compoundDescendant=false):Map<string,AdaptiveWidgetOverride>{
  if(!Number.isInteger(count)||Number(count)<0||Number(count)>2000||Number(count)%2)fail('原生 AdaptiveStyles 计数无效。');
  if(value===undefined){if(count!==0)fail('非空 AdaptiveStyles 缺少严格局部声明恢复。');return new Map();}
  const recovery=object(value,['schema','status','sourceId'],['entries','reason']);
  if(recovery.schema!==1||recovery.sourceId!==sourceId)fail('局部自适应恢复版本或元件身份不一致。');
  if(recovery.status==='unsupported-adaptive-styles'){object(value,['schema','status','sourceId','reason']);fail(typeof recovery.reason==='string'?recovery.reason:'局部自适应声明未恢复。');}
  object(value,['schema','status','sourceId','entries']);if(recovery.status!=='decoded-adaptive-styles')fail('局部自适应恢复状态无效。');
  const entries=array(recovery.entries,1000),result=new Map<string,AdaptiveWidgetOverride>();if(entries.length*2!==count)fail('局部自适应恢复数量与源字段不一致。');
  const states:Record<string,string>={MouseOver:'mouseOver',MouseDown:'mouseDown',Focused:'focused',Selected:'selected',Error:'error',Hint:'hint',Disabled:'disabled'};
  for(const value of entries){
    const entry=object(value,['viewId','styleId','status','patch','source']),viewId=guid(entry.viewId),styleId=guid(entry.styleId);
    if([ZERO,AUTO,RP_BASE_VIEW].includes(viewId)||styleId===ZERO||result.has(`rp-av-${viewId}`)||entry.status!=='supported-local-adaptive-style')fail('局部视图或样式引用无效、保留或重复。');
    const source=object(entry.source,['kind','packageVersion','properties','stateStyleSources']),version=array(source.packageVersion,4).join('.');
    if(source.kind!=='native-local-adaptive-style'||!array(source.packageVersion,4).every(Number.isInteger)||!VERSIONS.includes(version))fail('局部样式来源版本无效。');
    const props=eligibleProperties(source.properties),stateSources=array(source.stateStyleSources,7),visual=new Map<number,unknown>(),patch:AdaptiveWidgetOverride={};let stateIndex=0;
    if(version!=='11.0.0.0'&&array(source.properties,1000).some(p=>(Number((p as Data).rawDoaName)&0xfffffff)===111))fail('局部 P111 仅支持已证实的 RP11 包版本。');
    if(version!=='11.0.0.0'&&array(source.properties,1000).some(p=>[106,107,108,109].includes(Number((p as Data).rawDoaName)&0xfffffff)))fail('局部固定边约束仅支持已证实的 RP11 包版本。');
    for(const [key,value]of props){
      if(key===101||key===105){const keys=key===101?['X','Y']:['Width','Height'],m=rawMap(value,keys),v=keys.map(k=>number(m.get(k),key===105?1:-100000,100000));if(key===101){patch.x=v[0];patch.y=v[1];}else{patch.width=v[0];patch.height=v[1];}}
      else if(key===110)patch.hidden=!bool(value);
      else if(key===111){if(compoundDescendant||['tableCell','treeNode'].includes(widget.type))fail('此复合子元件不支持独立放置声明。');patch.placed=placedEnum(value);}
      else if([106,107,108,109].includes(key)){if(version!=='11.0.0.0')fail('固定边约束仅支持已验证的 RP11 包版本。');patch.style={...patch.style,...importNativeAuthorPin(key,value)};}
      else if(key===21){patch.stateStyles={};for(const [name,reference]of rawMap(value,undefined,7)){
        if(!Object.hasOwn(states,name))fail('未知局部交互状态。');const ref=object(reference,['$reference','referenceTag']),id=guid(ref.$reference);if(ref.referenceTag!==3)fail('状态引用类型无效。');if(id===ZERO)continue;
        const state=states[name],proof=object(stateSources[stateIndex++],['state','sourceId','properties']);if(proof.state!==state||guid(proof.sourceId)!==id)fail('局部状态样式源身份或顺序不一致。');
        patch.stateStyles[state as keyof NonNullable<AdaptiveWidgetOverride['stateStyles']>]=nativeVisual(eligibleProperties(proof.properties),version,widget,validateSurface);
      }}else visual.set(key,value);
    }
    if(stateIndex!==stateSources.length)fail('存在未引用的局部状态样式来源。');
    if(visual.size)patch.style={...patch.style,...nativeVisual(visual,version,widget,validateSurface)};
    if(!equalData(entry.patch,patch))fail('局部样式投影与原生属性记录不一致。');
    if(widget.type==='tableCell'&&Object.keys(patch).length||['table','menu','tree'].includes(widget.type)&&Object.keys(patch).some(key=>!['hidden','placed'].includes(key)))fail('此共享容器或单元格不支持所存局部自适应声明。');
    result.set(`rp-av-${viewId}`,patch);
  }
  return result;
}

// Independently re-project the numeric carrier at the editable-document boundary.
function placedEnum(value:unknown):boolean {
  if(typeof value!=='number'||!Number.isInteger(value)||![0,1,2].includes(value))fail('原生 P111 必须为 BoolOverride 整数 0、1 或 2。');
  return value===1;
}
export function importPlacement(value:unknown,rawValue:unknown,sourceId:string,styleId:unknown,widgetType:Widget['type'],compoundDescendant=false):boolean|undefined {
  if(value===undefined){if(rawValue!==undefined)fail('显式 P111 缺少放置恢复证据。');return undefined;}
  const r=object(value,['schema','status','sourceId'],['placed','source','reason','fallback','cacheChainComplete','fallbackSource']);
  if(r.schema!==1||r.sourceId!==sourceId)fail('放置恢复协议或对象身份不一致。');
  if(r.status==='unsupported-placement')fail(typeof r.reason==='string'?r.reason:'原生放置声明未恢复。');
  const active=r.status==='supported-direct-placement';
  if(!active&&r.status!=='inactive-direct-placement')fail('放置恢复状态无效。');
  object(value,['schema','status','sourceId','source',...(active?['placed']:['fallback','cacheChainComplete','fallbackSource'])]);
  const source=object(r.source,['kind','styleId','rawDoaName','value','packageVersion']),raw=object(rawValue,['rawDoaName','determined','overridden','value']);
  const version=array(source.packageVersion,4);if(version.length!==4||version.some((v,i)=>v!==[11,0,0,0][i]))fail('直接 P111 仅支持已证实的 RP11 包版本。');
  const n=number(source.rawDoaName,-2147483648,2147483647),expected=placedEnum(source.value);
  if(!Number.isInteger(n)||(n&0xfffffff)!==111||source.kind!=='native-object-MyStyle'||guid(source.styleId)!==guid(styleId)||raw.rawDoaName!==n||raw.value!==source.value||raw.determined!==!!(n&0x80000000)||raw.overridden!==!!(n&0x40000000))fail('P111 来源与直接 MyStyle 原始记录不一致。');
  if(active){
    if((n>>>30)!==3||r.placed!==expected)fail('放置投影与有效原始枚举不一致。');
    if(compoundDescendant||['tableCell','treeNode'].includes(widgetType))fail('此复合子元件不支持独立放置声明。');
    // true is the project default; retaining it here would materialize a redundant Base field.
    return expected?undefined:false;
  }
  if((n>>>30)===3||r.fallback!=='complete-known-true-cache'||r.cacheChainComplete!==true)fail('非活动放置记录缺少可靠的已放置回退。');
  const fallback=object(r.fallbackSource,['value','determined','overridden','rawDoaName','source']),origin=object(fallback.source,['kind','styleId','libraryId']),f=number(fallback.rawDoaName,-2147483648,2147483647);
  if(!Number.isInteger(f)||(f&0xfffffff)!==111||fallback.value!==1||fallback.determined!==true||!(f&0x80000000)||fallback.overridden!==!!(f&0x40000000)||!['cached-document-default','cached-matched-base'].includes(String(origin.kind)))fail('非活动放置的缓存来源无效。');
  guid(origin.styleId);guid(origin.libraryId);return undefined;
}
