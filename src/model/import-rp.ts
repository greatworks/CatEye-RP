import { defaultStyle, DOCUMENT_LIMITS, parseExternalUrl, parseRichText, parseWidgetStylePatch, parseMotionExpression, parseMoveActionSpec, parseResizeActionSpec } from './document';
import { parseVectorPath } from './vector';
import { createLineStyleRenderer } from './line-style';
import { normalizePageTree } from './page-tree-core';
import { layerAuthoringBounds } from './layer-geometry';
import { importAdaptiveSets, importAdaptiveStyles, importPlacement } from './import-rp-adaptive';
import { importAuthorResizePins, importNativeAuthorPin } from './import-rp-resize-pins';
import { INPUT_TYPES, LINE_PATTERNS, ARROW_STYLES, ROTATION_ANCHORS, ROTATION_EASINGS } from './types';
import type { Action, AdaptiveWidgetOverride, Condition, Document, EventType, InputType, Interaction, MotionBoundary, MotionExpression, Page, PageFolder, Widget, WidgetStyle } from './types';

export interface RpImportIssue {
  code: string;
  message: string;
  severity: 'warning' | 'skipped';
  packageId?: string;
  sourceId?: string;
  /** Inert source values/provenance that were not mapped into the editable model. */
  details?: unknown;
}
export interface RpImportReport {
  sourceSha256: string;
  pagesImported: number;
  widgetsImported: number;
  /** Top-level page members only; panel-state contents are reported separately. */
  widgetsSkipped: number;
  panelStatesImported: number;
  nestedWidgetsImported: number;
  nestedWidgetsSkipped: number;
  eventsImported: number;
  eventsSkipped: number;
  interactionTreesSkipped: number;
  casesImported: number;
  actionsImported: number;
  variablesImported: number;
  issues: RpImportIssue[];
}
export interface RpImportResult { document: Document; report: RpImportReport }
type Data = Record<string, unknown>;
const nativeRectangleRadii = createLineStyleRenderer().rectangleRadii;
function validateNativeBorderSurface(style: Partial<WidgetStyle>, widget: Widget): void {
  if (style.borderVisibility && widget.type === 'box' && (!widget.vectorPath || !nativeRectangleRadii(widget.vectorPath,widget.width,widget.height))) throw new Error('原生四边可见性缺少完整可验证的矩形轮廓。');
  if (style !== widget.style && (style.radius !== undefined || style.cornerVisibility !== undefined) && !widget.style.cornerVisibility) throw new Error('原生圆角状态缺少已验证的完整基态半径和角掩码。');
  if (style.cornerVisibility || style !== widget.style && style.radius !== undefined) {
    if (!['box','input','textarea','select'].includes(widget.type)) throw new Error('该原生表面的独立圆角参数尚未验证。');
    if (widget.type === 'box' && (!widget.vectorPath || !nativeRectangleRadii(widget.vectorPath,widget.width,widget.height))) throw new Error('原生圆角参数缺少完整可验证的矩形轮廓。');
    if (style.cornerRadii !== undefined) throw new Error('原生统一半径和角掩码不能混入旧四角快照。');
  }
}
class ImportBudgetError extends Error {}
function record(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('RP 恢复结果包含无效对象。');
  return value as Data;
}
const own = (o: Data, key: string): unknown => Object.hasOwn(o, key) ? o[key] : undefined;
function list(value: unknown, max: number = DOCUMENT_LIMITS.widgets): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('RP 恢复结果列表无效或超过安全上限。');
  return value;
}
function text(value: unknown, max: number = DOCUMENT_LIMITS.text): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('RP 恢复结果文本无效或超过安全上限。');
  return value;
}
function id(value: unknown): string {
  const s = text(value, 32);
  if (!/^[a-f0-9]{32}$/.test(s)) throw new Error('RP 源对象标识无效。');
  return s;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('交互标志未明确恢复。');
  return value;
}
function identifier(value: unknown): string {
  const key = text(value, 256);
  if (!key.trim() || ['__proto__', 'prototype', 'constructor'].includes(key) || /[\u0000-\u001f\u007f]/.test(key)) throw new Error('变量名称无效。');
  return key;
}
function literal(value: unknown): string {
  const result = text(value);
  // Native literal strings must not accidentally become this product's expressions.
  if (result.includes('[[') || result.includes(']]')) throw new Error('原生字面值包含表达式分隔符，尚不能保持其语义。');
  return result;
}
function number(value: unknown, min = -100_000, max = 100_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('RP 存储坐标或尺寸超出支持范围。');
  return value;
}
function exactFields(value: Data, required: string[], optional: string[] = []): void {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw new Error('原生移动或尺寸动作字段不完整或含未知参数。');
}
/** Revalidate the evidence-bound numeric grammar at the untrusted worker boundary.
 * This checks syntax and dependencies only: no geometry is evaluated on import.
 * See runtime-transform-bindings-evidence; do not extend to arbitrary getters/JS.
 */
function validateNativeMotionText(value: string, bindings: Set<string>, root: (name: string) => void): void {
  const source = value.trim();
  if (!source.startsWith('[[')) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(source) || !Number.isFinite(Number(source))) throw new Error('原生动作仅恢复已验证的数值字面量或完整表达式。');
    return;
  }
  if (!source.endsWith(']]')) throw new Error('原生动作表达式不完整。');
  const input=source.slice(2,-2).trim(), tokens:{kind:string;value:string|number}[]=[], regex=/\s*(?:(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?|([A-Za-z_][A-Za-z0-9_]*)|([()+\-*/.,]))/y;
  let offset=0,index=0;
  while(offset<input.length){regex.lastIndex=offset;const match=regex.exec(input);if(!match)throw new Error('原生动作表达式包含未验证语法。');tokens.push(match[1]!==undefined?{kind:'number',value:Number(match[1]+(match[2]??''))}:match[3]?{kind:'name',value:match[3]}:{kind:'symbol',value:match[4]});offset=regex.lastIndex;if(tokens.length>256)throw new Error('原生动作表达式超过安全上限。');}
  const has=(value:string)=>tokens[index]?.value===value,take=(value:string)=>{if(tokens[index++]?.value!==value)throw new Error('原生动作表达式结构不完整。');};
  function atom(depth:number):void {
    if(depth>32)throw new Error('原生动作表达式嵌套超过安全上限。');
    const token=tokens[index++];if(!token)throw new Error('原生动作表达式缺少操作数。');let objectName:string|undefined;
    if(token.kind==='number'){if(!Number.isFinite(token.value))throw new Error('原生动作表达式数值无效。');}
    else if(token.value==='+'||token.value==='-')atom(depth+1);
    else if(token.value==='('){expression(0,depth+1);take(')');}
    else if(token.kind==='name'){
      const name=String(token.value).toLowerCase();
      if(!['this','target','window','dragx','dragy'].includes(name)&&!bindings.has(name))throw new Error('原生动作表达式引用未恢复的变量。');
      root(name);if(!['dragx','dragy'].includes(name))objectName=name;
    }else throw new Error('原生动作表达式操作数无效。');
    while(has('.')){
      take('.');const property=tokens[index++];if(property?.kind!=='name')throw new Error('原生动作表达式属性无效。');
      if(property.value==='toFixed'){
        if(objectName)throw new Error('原生 toFixed 仅支持数值算术结果。');take('(');const precision=tokens[index++];if(precision?.kind!=='number'||typeof precision.value!=='number'||!Number.isInteger(precision.value)||precision.value<0||precision.value>100)throw new Error('原生 toFixed 精度未验证。');take(')');
      }else if(!objectName||!['x','y','width','height','left','right','top','bottom'].includes(String(property.value))||(objectName==='window'&&!['width','height'].includes(String(property.value))))throw new Error('原生动作几何 getter 尚未验证。');
      objectName=undefined;
    }
    if(objectName)throw new Error('原生动作不接受对象值作为数值。');
  }
  const precedence:Record<string,number>={'+':1,'-':1,'*':2,'/':2};
  function expression(min:number,depth:number):void {atom(depth);while(precedence[String(tokens[index]?.value)]>=min){const op=String(tokens[index++].value);expression(precedence[op]+1,depth+1);}}
  expression(0,0);if(index!==tokens.length)throw new Error('原生动作表达式含剩余语法。');
}
function stored(entry: unknown): Data {
  const p = record(entry);
  if (own(p, 'determined') !== true || own(p, 'overridden') !== true) throw new Error('位置或尺寸依赖未解析的样式继承。');
  return record(own(p, 'value'));
}
function resolvedGeometry(entry: unknown, recovery: unknown, field: 'location' | 'size'): Data {
  try { return stored(entry); } catch (error) {
    const style = recovery === undefined ? {} : record(recovery), geometry = own(style, 'resolvedGeometry');
    if (own(style, 'cacheChainComplete') !== true || !geometry) throw error;
    const resolved = record(own(record(geometry), field));
    const source = record(own(resolved, 'source'));
    if (own(resolved, 'determined') !== true || !['cached-document-default', 'cached-matched-base', 'local-object-style'].includes(String(own(source, 'kind')))) throw error;
    return record(own(resolved, 'value'));
  }
}
function recoveredRotation(item: Data, geometry: Data, type: Widget['type'], hasPath: boolean): number {
  const rotation=own(geometry,'rotation'), transform=own(geometry,'transform'), origin=own(geometry,'transformOrigin'), recovery=own(item,'rotationRecovery');
  if(transform!==null||origin!==null&&origin!==undefined)throw new Error('带显式变换或变换原点的元件尚未转换。');
  if(recovery===undefined){if(rotation!==null&&own(record(rotation),'value')!==0)throw new Error('非零或未知旋转尚未转换。');return 0;}
  if(own(record(recovery),'status')==='unsupported-rotation')throw new Error(`原生旋转或变换未恢复：${text(own(record(recovery),'reason'),2000)}`);
  const exact=(value:unknown,keys:string[])=>{const o=record(value);if(Object.keys(o).length!==keys.length||Object.keys(o).some(k=>!keys.includes(k)))throw new Error('旋转恢复协议字段不完整或包含未知字段。');return o;};
  const r=exact(recovery,['status','rotation','origin','mapping','cacheChainComplete','source']);
  if(own(r,'status')!=='supported-center-rotation'||own(r,'mapping')!=='native-vector-center-rotation'||own(r,'cacheChainComplete')!==true||own(record(own(item,'styleRecovery')),'cacheChainComplete')!==true||own(item,'type')!=='Axure:DiagramObject:VectorShape'||!['box','ellipse','path'].includes(type)||!hasPath)throw new Error('中心旋转的原生类型、路径或完整样式链未明确恢复。');
  const center=exact(own(r,'origin'),['x','y']);if(own(center,'x')!==.5||own(center,'y')!==.5)throw new Error('非中心旋转原点尚未转换。');
  const angle=number(own(r,'rotation')),local=record(rotation),sources=exact(own(r,'source'),['rotation','transform','transformOrigin']);
  const entry=(value:unknown,key:number)=>{const e=exact(value,['value','determined','overridden','rawDoaName','source']),raw=own(e,'rawDoaName');if(!Number.isInteger(raw)||(Number(raw)&0xfffffff)!==key||own(e,'determined')!==true||!(Number(raw)&0x80000000)||own(e,'overridden')!==Boolean(Number(raw)&0x40000000))throw new Error('旋转来源属性编号或确定性无效。');return e;};
  const fromRotation=entry(own(sources,'rotation'),50),fromLocal=exact(own(fromRotation,'source'),['kind','objectId']);
  if(own(local,'determined')!==true||own(local,'overridden')!==true||own(local,'rawDoaName')!==own(fromRotation,'rawDoaName')||own(local,'value')!==angle||own(fromRotation,'value')!==angle||own(fromRotation,'overridden')!==true||own(fromLocal,'kind')!=='local-object-style'||id(own(fromLocal,'objectId'))!==id(own(geometry,'styleId')))throw new Error('旋转并非一致的本地显式 P50。');
  const defaultIds:string[]=[];
  for(const [key,p,values]of [['transform',1401,{ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0}],['transformOrigin',1402,{X:50,Y:50}]] as const){
    const e=entry(own(sources,key),p),source=exact(own(e,'source'),['kind','styleId','libraryId']);if(own(source,'kind')!=='cached-document-default')throw new Error('显式或命名样式变换尚未转换。');defaultIds.push(id(own(source,'styleId'))+id(own(source,'libraryId')));
    const map=exact(own(e,'value'),['$map']),pairs=list(own(map,'$map'),5);if(pairs.length!==Object.keys(values).length)throw new Error('旋转默认变换字段不完整。');const seen=new Set();for(const pair of pairs){const parts=list(pair,2),name=parts[0];if(parts.length!==2||typeof name!=='string'||!Object.hasOwn(values,name)||seen.has(name)||parts[1]!==values[name as keyof typeof values])throw new Error('旋转默认变换并非单位变换与中心原点。');seen.add(name);}
  }
  if(defaultIds[0]!==defaultIds[1])throw new Error('旋转默认变换来源不一致。');
  return angle;
}
function recoveredStyle(value: unknown, type: Widget['type'], asPatch = false): WidgetStyle {
  const result: WidgetStyle = { ...defaultStyle(), ...(['input', 'textarea', 'select'].includes(type) ? { textAlign: 'left' as const } : {}), ...(['panel','table','menu','inlineFrame'].includes(type) ? { fill: '#ffffff00', strokeWidth: 0 } : {}) };
  if (value === undefined) return result;
  const style = record(own(record(value), 'style'));
  for(const paint of ['fill','stroke'])if(own(style,paint)!==undefined&&own(style,paint+'Gradient')!==undefined)throw new Error('同一个原生绘制属性不能同时恢复为纯色和渐变。');
  for (const key of Object.keys(style)) {
    const v = own(style, key);
    switch (key) {
      case 'fill': case 'stroke': case 'color': {
        const c = text(v, 9); if (!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(c)) throw new Error('恢复的颜色格式无效。'); result[key] = c; break;
      }
      case 'fillGradient': case 'strokeGradient': {
        const exact=(value:unknown,keys:string[])=>{const o=record(value);if((Object.getPrototypeOf(o)!==Object.prototype&&Object.getPrototypeOf(o)!==null)||Object.keys(o).length!==keys.length||Object.keys(o).some(k=>!keys.includes(k)))throw new Error('恢复的渐变字段不完整或包含未知字段。');return o;};
        const raw=record(v),kind=own(raw,'type');
        exact(raw,['type','stops',...(kind==='linear'?['start','end']:['center','axis1','axis2'])]);
        for(const key of kind==='linear'?['start','end']:['center','axis1','axis2'])exact(own(raw,key),['x','y']);
        for(const stop of list(own(raw,'stops'),100))exact(stop,['offset','color']);
        const parsed=parseWidgetStylePatch({[key]:v})[key]!;
        if(parsed.stops.some(stop=>!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(stop.color)))throw new Error('恢复的渐变色标必须为原生ARGB转换颜色。');
        result[key]=parsed;break;
      }
      case 'fontFamily': { const family = text(v, 200); if (!/^[\p{L}\p{N}\s,'"_-]+$/u.test(family)) throw new Error('恢复的字体名无效。'); result.fontFamily = family; break; }
      case 'fontSize': result.fontSize = number(v, 1, 512); break;
      case 'fontWeight': result.fontWeight = number(v, 100, 1000); break;
      case 'fontStyle': if (v !== 'normal' && v !== 'italic') throw new Error('恢复的字体样式无效。'); result.fontStyle = v; break;
      case 'underline': case 'strikethrough': result[key] = boolean(v); break;
      case 'outerShadow': case 'innerShadow': case 'textShadow': {
        const shadow=record(v),keys=['on','offsetX','offsetY','blurRadius','color',...(key==='innerShadow'?['spread']:[])];
        if(Object.keys(shadow).length!==keys.length||Object.keys(shadow).some(field=>!keys.includes(field)))throw new Error('恢复的阴影字段不完整或包含未知字段。');
        const color=text(own(shadow,'color'),9);if(!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color))throw new Error('恢复的阴影颜色无效。');
        const parsed={on:boolean(own(shadow,'on')),offsetX:number(own(shadow,'offsetX'),-1000,1000),offsetY:number(own(shadow,'offsetY'),-1000,1000),blurRadius:number(own(shadow,'blurRadius'),0,1000),color};
        if(key==='innerShadow')result.innerShadow={...parsed,spread:number(own(shadow,'spread'),0,1000)};else result[key]=parsed;
        break;
      }
      case 'strokeWidth': result.strokeWidth = number(v, 0, 100); break;
      case 'linePattern': {
        if (typeof v !== 'string' || !LINE_PATTERNS.includes(v as typeof LINE_PATTERNS[number])) throw new Error('恢复的线条图案无效。');
        result.linePattern = v as typeof LINE_PATTERNS[number]; break;
      }
      case 'lineEnds': {
        const pair=record(v);
        if ((Object.getPrototypeOf(pair)!==Object.prototype&&Object.getPrototypeOf(pair)!==null)||Object.keys(pair).length!==2||Object.keys(pair).some(key=>!['start','end'].includes(key))) throw new Error('恢复的线端必须是完整原子属性。');
        const start=own(pair,'start'),end=own(pair,'end');
        if(typeof start!=='string'||typeof end!=='string'||!ARROW_STYLES.includes(start as typeof ARROW_STYLES[number])||!ARROW_STYLES.includes(end as typeof ARROW_STYLES[number]))throw new Error('恢复的箭头类型无效。');
        result.lineEnds={start:start as typeof ARROW_STYLES[number],end:end as typeof ARROW_STYLES[number]};break;
      }
      case 'borderVisibility': {
        if(!['box','input','textarea','select'].includes(type))throw new Error('该原生表面尚未验证四边可见性。');
        const sides=list(v,4);if(sides.length!==4)throw new Error('恢复的边框可见性必须完整包含四边。');
        result.borderVisibility=sides.map(boolean) as [boolean,boolean,boolean,boolean];break;
      }
      case 'cornerVisibility': {
        if(!['box','input','textarea','select'].includes(type))throw new Error('该原生表面的独立圆角参数尚未验证。');
        const corners=list(v,4);if(corners.length!==4)throw new Error('恢复的角可见性必须完整包含四角。');
        if(!asPatch&&(own(style,'radius')===undefined||own(style,'cornerRadii')!==undefined))throw new Error('原生角掩码必须具有真实统一半径，不能混入旧四角快照。');
        result.cornerVisibility=corners.map(boolean) as [boolean,boolean,boolean,boolean];break;
      }
      case 'radius': result.radius = number(v, 0, 10000); break;
      case 'opacity': result.opacity = number(v, 0, 1); break;
      case 'textAlign': if (v !== 'left' && v !== 'center' && v !== 'right') throw new Error('恢复的文字对齐无效。'); result.textAlign = v; break;
      case 'cornerRadii': { const r = list(v, 4); if (r.length !== 4) throw new Error('恢复的圆角数量无效。'); result.cornerRadii = r.map(n => number(n, 0, 1000)) as [number,number,number,number]; break; }
      case 'textPadding': { const p = list(v, 4); if (p.length !== 4) throw new Error('恢复的文字边距数量无效。'); result.textPadding = p.map(n => number(n, 0, 1000)) as [number,number,number,number]; break; }
      case 'verticalAlign': if (v !== 'top' && v !== 'middle' && v !== 'bottom') throw new Error('恢复的文字垂直对齐无效。'); result.verticalAlign = v; break;
      case 'lineHeight': if (v !== 'normal') throw new Error('恢复的自动行距格式无效。'); result.lineHeight = v; break;
      default: throw new Error(`未知的恢复样式字段：${key}`);
    }
  }
  return result;
}

function nativeLinkProjection(value: unknown): unknown[] {
  const recovery=record(value);
  if(own(recovery,'status')!=='decoded-interaction-tree')throw new Error('链接交互树未完整恢复。');
  return list(own(recovery,'events'),1).flatMap(value=>{
    const event=record(value);
    if(own(event,'status')!=='supported-event'||own(event,'event')!=='click'||own(event,'nativeEventType')!==16)throw new Error('链接事件载体尚未验证。');
    return list(own(event,'cases'),100).map(value=>{
      const c=record(value),caseId=id(own(c,'id'));
      return {id:caseId,name:own(c,'name'),event:'click',enabled:own(c,'enabled'),isNewIfGroup:own(c,'isNewIfGroup'),conditionMode:own(c,'conditionMode'),
        conditions:list(own(c,'conditions'),100).map(value=>{const p=record(value);return {source:own(p,'source'),key:own(p,'source')==='variable'?own(p,'key'):own(p,'targetSourceId'),operator:own(p,'operator'),value:own(p,'value'),comparisonMode:own(p,'comparisonMode')};}),
        actions:list(own(c,'actions'),DOCUMENT_LIMITS.actions).map((value,i)=>{const a=record(value),type=own(a,'type');return {id:`native-a-${caseId}-${i}`,type,
          ...(own(a,'targetSourceId')!==undefined?{targetId:own(a,'targetSourceId')}:type==='openPage'?{targetId:own(a,'targetPackageId')}:{}),
          ...(type==='setState'?{value:own(a,'targetPackageId')}:own(a,'value')!==undefined?{value:own(a,'value')}:{}),
          ...(own(a,'selectText')!==undefined?{selectText:own(a,'selectText')}:{}),...(own(a,'windowTarget')!==undefined?{windowTarget:own(a,'windowTarget')}:{}),
          ...(own(a,'adaptiveView')!==undefined?{adaptiveView:own(record(own(a,'adaptiveView')),'kind')==='nativeGuid'?{kind:'view',viewId:own(record(own(a,'adaptiveView')),'guid')}:own(a,'adaptiveView')}:{})};})};
    });
  });
}
function equalData(a: unknown,b: unknown): boolean {
  if(a===b)return true;
  if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equalData(v,b[i]));
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    const aa=record(a),bb=record(b),keys=Object.keys(aa);return keys.length===Object.keys(bb).length&&keys.every(k=>Object.hasOwn(bb,k)&&equalData(aa[k],bb[k]));
  }
  return false;
}
function recoveredRichText(value: unknown, legacyText: string): { richText: NonNullable<Widget['richText']>; text: string; linkSources?: Data[] } {
  const recovery = record(value);
  if (own(recovery,'status') !== 'supported-rich-text' || Object.keys(recovery).some(key => !['status','richText','text','source','evidence'].includes(key))) throw new Error('富文本恢复协议无效。');
  const raw = record(own(recovery,'richText'));
  if (own(raw,'expressionMode') !== 'literal' || Object.keys(raw).some(key => !['paragraphs','expressionMode','links'].includes(key))) throw new Error('原生富文本必须保留为字面文字。');
  const data = list(own(raw,'paragraphs'),1000);
  if (!data.length) throw new Error('富文本必须保留至少一段。');
  let runCount = 0, length = 0;
  const paragraphs = data.map<NonNullable<Widget['richText']>['paragraphs'][number]>(value => {
    const paragraph = record(value);
    if (Object.keys(paragraph).some(key => !['runs','textAlign','lineHeightPx'].includes(key))) throw new Error('未知富文本段落字段。');
    const alignment = own(paragraph,'textAlign'), spacing = own(paragraph,'lineHeightPx');
    if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') throw new Error('富文本段落对齐无效。');
    const lineHeightPx = spacing === 'normal' ? spacing : number(spacing,Number.MIN_VALUE,1000);
    const values = list(own(paragraph,'runs'),10000);
    if (!values.length || (runCount += values.length) > 10000) throw new Error('富文本字符片段超过上限或缺失。');
    const runs = values.map(value => {
      const run = record(value);
      if (Object.keys(run).length !== (own(run,'linkId')===undefined?2:3) || Object.keys(run).some(key => !['text','style','linkId'].includes(key))) throw new Error('未知富文本字符片段字段。');
      const content = text(own(run,'text'));
      if (/[\r\n\t]/.test(content) || (length += content.length) > 100000) throw new Error('原生富文本换行结构未知或文字过长。');
      const style = record(own(run,'style')), fields = ['fontFamily','fontSize','fontWeight','fontStyle','color','underline','strikethrough'];
      if (Object.keys(style).length !== fields.length || Object.keys(style).some(key => !fields.includes(key))) throw new Error('原生字符字体字段未完整恢复。');
      recoveredStyle({style},'box');
      return { text:content,style:parseWidgetStylePatch(style),...(own(run,'linkId')!==undefined?{linkId:id(own(run,'linkId'))}:{}) };
    });
    return { runs,textAlign:alignment,lineHeightPx };
  });
  const projection = paragraphs.map(p=>p.runs.map(r=>r.text).join(''));
  const projectedText = projection.join('\n');
  if (projectedText.length > 100000 || text(own(recovery,'text')) !== projectedText || legacyText !== projection.join('\n\n')) throw new Error('富文本投影与原生段落文字不一致。');
  const source = record(own(recovery,'source'));
  if (own(source,'kind') !== 'native-rp11-paragraph-runs' || own(source,'runStyleSchemaVersion') !== 2 || own(source,'paragraphCount') !== paragraphs.length || own(source,'runCount') !== runCount || own(source,'normalizedBoundaryLF') !== paragraphs.length-1 || own(source,'nativeSizeDivisor') !== .75 || own(source,'nativeLineSpacingDivisor') !== .75 || own(source,'nativeFontMetricsVerified') !== false) throw new Error('富文本来源转换记录不一致。');
  const links=own(raw,'links'),richText=parseRichText({paragraphs,expressionMode:'literal',...(links!==undefined?{links}:{})});
  let linkSources:Data[]|undefined;
  if(links!==undefined){
    const definitions=richText.links!;
    if(!definitions.length||definitions.length>100||own(source,'linkSchemaVersion')!==1||own(source,'linkCount')!==definitions.length)throw new Error('原生链接协议版本或计数不一致。');
    linkSources=list(own(source,'linkSources'),100).map(record);
    if(linkSources.length!==definitions.length)throw new Error('链接来源缺失。');
    const seen=new Set<string>();
    for(const [index,link]of definitions.entries()){
      id(link.id);const native=linkSources[index];
      if(Object.keys(native).some(k=>!['id','sourceType','styleSources','interactionRecovery'].includes(k))||own(native,'id')!==link.id||seen.has(link.id)||own(native,'sourceType')!=='Axure:DiagramObject:Hyperlink')throw new Error('链接来源身份不一致。');
      seen.add(link.id);
      if(!equalData(link.interactions,nativeLinkProjection(own(native,'interactionRecovery'))))throw new Error('链接交互与来源图不一致。');
      const fields=['normal',...(link.mouseOverStyle!==undefined?['MouseOver']:[]),...(link.mouseDownStyle!==undefined?['MouseDown']:[])];
      const styles=list(own(native,'styleSources'),3);if(styles.length!==fields.length)throw new Error('链接样式来源缺失。');
      const seenStates=new Set<string>();
      for(const value of styles){
        const entry=record(value),sourceStyleId=id(own(entry,'sourceStyleId')),styleId=id(own(entry,'styleId')),libraryId=id(own(entry,'libraryId')),localLibraryId=id(own(entry,'localLibraryId'));
        const state=text(own(entry,'state'),20),i=fields.indexOf(state);
        if(Object.keys(entry).some(k=>!['state','sourceStyleId','styleId','libraryId','localLibraryId','localProperties','sourceProperties','style'].includes(k))||i<0||seenStates.has(state)||sourceStyleId==='0'.repeat(32)||styleId==='0'.repeat(32)||![libraryId,'0'.repeat(32)].includes(localLibraryId))throw new Error('链接样式库身份无效。');
        seenStates.add(state);
        const local=list(own(entry,'localProperties'),9),properties=list(own(entry,'sourceProperties'),7),patch=record(own(entry,'style'));
        const keys=new Map<number,string>([[1,'fontFamily'],[2,'fontSize'],[5,'underline'],[6,'color'],[95,'strikethrough'],[1001,'fontWeight'],[1002,'fontStyle']]);
        if(!local.includes(0)||(i===0&&!local.includes(21))||new Set(local).size!==local.length||local.some(k=>k!==0&&(i!==0||k!==21)&&!keys.has(k as number))||new Set(properties).size!==properties.length||properties.some(k=>!keys.has(k as number))||Object.keys(patch).length!==properties.length||properties.some(k=>!Object.hasOwn(patch,keys.get(k as number)!)))throw new Error('链接样式源属性不完整。');
        recoveredStyle({style:patch},'box');
        if(i===0){for(const p of paragraphs)for(const r of p.runs)if(r.linkId===link.id&&Object.keys(patch).some(k=>!equalData(patch[k],record(r.style)[k])))throw new Error('链接基态与字符样式不一致。');}
        else if(!equalData(patch,fields[i]==='MouseOver'?link.mouseOverStyle:link.mouseDownStyle))throw new Error('链接活动样式与源属性不一致。');
      }
    }
  }else if(['linkSchemaVersion','linkCount','linkSources'].some(k=>own(source,k)!==undefined))throw new Error('没有链接却携带链接来源。');
  return {richText,text:projectedText,...(linkSources?{linkSources}:{})};
}

const RP_STYLE_STATES = {
  mouseover: ['MouseOver', 'mouseOverStyle'], mousedown: ['MouseDown', 'mouseDownStyle'],
  focused: ['Focused', 'focusedStyle'], disabled: ['Disabled', 'disabledStyle'],
} as const;
const RP_STATE_STYLE_FIELDS = new Map<number, keyof WidgetStyle>([[1,'fontFamily'],[2,'fontSize'],[5,'underline'],[6,'color'],[7,'fill'],[8,'stroke'],[9,'textAlign'],[10,'verticalAlign'],[15,'strokeWidth'],[16,'linePattern'],[17,'lineEnds'],[20,'lineHeight'],[70,'opacity'],[71,'radius'],[72,'outerShadow'],[73,'innerShadow'],[74,'textShadow'],[80,'borderVisibility'],[81,'cornerVisibility'],[95,'strikethrough'],[1001,'fontWeight'],[1002,'fontStyle']]);
/** Validate the worker's explicit patch independently; never fill omitted fields from normal appearance. */
function recoveredInteractionStyle(value: unknown, nativeState: string, complete: boolean, type: Widget['type'], allowNamedColors = false): Partial<WidgetStyle> {
  const state = record(value);
  if (Object.keys(state).some(key => !['sourceState','status','sourceStyleId','sourceProperties','independentOfInheritedBase','style','provenance',...(allowNamedColors?['namedStyleMatch']:[])].includes(key))) throw new Error('状态样式协议包含未知字段。');
  if (own(state, 'sourceState') !== nativeState || own(state, 'status') !== 'supported-state-style') throw new Error('状态样式身份或恢复状态不一致。');
  if (id(own(state, 'sourceStyleId')) === '0'.repeat(32)) throw new Error('已恢复的状态样式不能使用空引用。');
  const properties = list(own(state, 'sourceProperties'), 30);
  if (new Set(properties).size !== properties.length || properties.some(key => typeof key !== 'number' || !Number.isInteger(key) || (!RP_STATE_STYLE_FIELDS.has(key) && ![11,12,13,14].includes(key)))) throw new Error('状态样式源属性未被完整支持。');
  if (own(state,'namedStyleMatch') !== undefined) {
    const match = record(own(state,'namedStyleMatch')), local = list(own(match,'localProperties'),4);
    if (Object.keys(match).length !== 3 || Object.keys(match).some(key=>!['styleId','libraryId','localProperties'].includes(key)) || id(own(match,'styleId')) === '0'.repeat(32)) throw new Error('命名状态样式缓存身份无效。');
    id(own(match,'libraryId'));
    if (!local.includes(0) || new Set(local).size!==local.length || local.some(key=>![0,6,7,8].includes(key as number)) || !properties.length || properties.some(key=>![6,7,8].includes(key as number))) throw new Error('命名状态样式仅支持唯一匹配的完整颜色补丁。');
  }
  const independence = own(state, 'independentOfInheritedBase');
  if (complete ? independence !== undefined : independence !== true || !properties.length || properties.some(key => ![6,7,8].includes(key as number))) throw new Error('未解析的继承链只允许明确独立的本地颜色。');
  const padding = [11,12,13,14].filter(key => properties.includes(key));
  if (padding.length && padding.length !== 4) throw new Error('状态文字边距必须明确保存四边。');
  const raw = record(own(state, 'style'));
  if(['fillGradient','strokeGradient'].some(key=>own(raw,key)!==undefined)&&(!complete||own(state,'namedStyleMatch')!==undefined))throw new Error('渐变状态需要完整已知继承链和明确本地源。');
  const expected = new Set(properties.map(key => key===7&&own(raw,'fillGradient')!==undefined?'fillGradient':key===8&&own(raw,'strokeGradient')!==undefined?'strokeGradient':RP_STATE_STYLE_FIELDS.get(key as number)).filter((key): key is keyof WidgetStyle => key !== undefined));
  if (padding.length) expected.add('textPadding');
  if (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null) throw new Error('状态样式必须是普通数据对象。');
  if (Object.keys(raw).length !== expected.size || Object.keys(raw).some(key => !expected.has(key as keyof WidgetStyle))) throw new Error('状态样式输出与明确源属性不一致。');
  // Native import accepts its narrower color/font vocabulary before the general model parser.
  recoveredStyle({ style: raw }, type, true);
  return parseWidgetStylePatch(raw);
}

function recoveredImage(value: unknown, width: number, height: number): { dataUrl: string; details: Data } {
  const image = record(value);
  if (own(image, 'status') !== 'validated-embedded-png') throw new Error(`图片资源未可靠恢复：${typeof own(image, 'reason') === 'string' ? text(own(image, 'reason'), 2000) : '未知资源'}`);
  if (own(image, 'mime') !== 'image/png' || own(image, 'mapping') !== 'same-aspect-stored-rectangle') throw new Error('图片编码或矩形映射未确定。');
  const imageWidth = number(own(image, 'width'), 1, 8192), imageHeight = number(own(image, 'height'), 1, 8192);
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth * imageHeight > 8 * 1024 * 1024 || Math.abs(width * imageHeight - height * imageWidth) > 1e-6) throw new Error('图片像素上限或存储宽高比不一致。');
  const dataUrl = text(own(image, 'dataUrl'), Math.min(DOCUMENT_LIMITS.image, 22 + 4 * Math.ceil(4 * 1024 * 1024 / 3)));
  const encoded = dataUrl.slice(22);
  if (!dataUrl.startsWith('data:image/png;base64,') || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error('导入图片必须是内嵌 PNG base64，不能使用链接或可执行图像格式。');
  const expectedBytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (expectedBytes < 45 || expectedBytes > 4 * 1024 * 1024 || own(image, 'decodedBytes') !== expectedBytes) throw new Error('图片字节数超过上限或与来源不符。');
  // The worker verifies the entire PNG and its SHA-256. This pure boundary checks the carrier/header again.
  const header = atob(encoded.slice(0, 44)), u32 = (offset: number) => [...header.slice(offset, offset + 4)].reduce((n, c) => n * 256 + c.charCodeAt(0), 0);
  if ([137,80,78,71,13,10,26,10].some((v, i) => header.charCodeAt(i) !== v) || header.slice(12,16) !== 'IHDR' || u32(8) !== 13 || u32(16) !== imageWidth || u32(20) !== imageHeight) throw new Error('PNG 文件头与恢复元数据不符。');
  const sha256 = text(own(image, 'sha256'), 64), source = record(own(image, 'source')), stream = record(own(source, 'stream'));
  if (!/^[a-f0-9]{64}$/.test(sha256) || own(stream, 'sha256') !== sha256 || own(stream, 'length') !== expectedBytes) throw new Error('图片来源摘要或长度不一致。');
  const { dataUrl: _dataUrl, ...details } = image;
  return { dataUrl, details };
}

/** Convert only the strictly identified subset. Never opens a file, evaluates source data, or writes RP. */
export function importRpSemantics(input: unknown, name = 'Imported RP'): RpImportResult {
  const source = record(input);
  if (own(source, 'status') !== 'partial-read-only-recovery' || own(source, 'recoveryVersion') !== 1) throw new Error('不支持的 RP 研究读取器结果版本。');
  const hash = text(own(source, 'fileSha256'), 64);
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('RP 源文件散列无效。');
  const report: RpImportReport = { sourceSha256: hash, pagesImported: 0, widgetsImported: 0, widgetsSkipped: 0, panelStatesImported: 0, nestedWidgetsImported: 0, nestedWidgetsSkipped: 0, eventsImported: 0, eventsSkipped: 0, interactionTreesSkipped: 0, casesImported: 0, actionsImported: 0, variablesImported: 0, issues: [] };
  const issue = (code: string, message: string, severity: RpImportIssue['severity'] = 'warning', packageId?: string, sourceId?: string, details?: unknown) => report.issues.push({ code, message, severity, ...(packageId ? { packageId } : {}), ...(sourceId ? { sourceId } : {}), ...(details !== undefined ? { details } : {}) });
  issue('experimental-subset', '实验性只读导入仅恢复明确的页面、基础对象、纯文本和本地存储矩形；不表示 Axure 兼容，也不支持写回 .rp。');
  issue('appearance-defaults', '仅恢复可识别的缓存样式链、统一文字样式及矩形圆角；未恢复字段仍用本产品默认值。已识别的自动行距使用浏览器字体默认度量，尚未与原版精确排版对照。页面尺寸和背景未恢复，保存矩形不是重新计算的最终布局。');
  issue('behavior-subset', '交互仅恢复报告中列出的已支持事件；任一条件、动作或目标不支持时跳过整个事件。母版、组件、中继器未导入；自适应集合、页面归属和局部声明仅接受完整验证的来源协议。页面层级和顺序仅在完整验证源页面树后恢复。图片仅支持严格验证的内嵌静态 PNG 子集。');
  for (const key of ['packageFailures', 'semanticFailures']) for (const item of list(own(source, key))) {
    const failure = record(item);
    issue('source-recovery-failure', `${text(own(failure, 'path'), 2000)}：${text(own(failure, 'reason'), 2000)}`);
  }
  const diagrams = list(own(source, 'diagrams'));
  const diagramPackages = new Set<string>();
  for (const value of diagrams) {
    const diagram = record(value);
    if (!['Axure:Page', 'Axure:PanelState'].includes(String(own(diagram, 'rootType')))) continue;
    const packageId = id(own(diagram, 'packageId'));
    if (diagramPackages.has(packageId)) throw new Error('重复的页面或面板状态包标识，无法唯一映射元件和交互。');
    diagramPackages.add(packageId);
  }
  const pages: Page[] = [], seenPages = new Set<string>();
  const widgetTargets = new Map<string, Widget>();
  const pendingAdaptive = new Map<Widget,{packageId:string;sourceId:string;maps:Map<string,AdaptiveWidgetOverride>}>();
  const pendingRichLinks = new Map<string,{packageId:string;sourceId:string;sources:Data[]}>();
  const selectionTargets = new Set<string>();
  const errorTargets = new Set<string>();
  const ambiguousTargets = new Set<string>();
  // Tables are one atomic graph. A cell ID colliding with any member in the
  // same package is invalid even when that member appears later in the stream.
  const nativeOccurrences=new Map<string,number>();
  function sourceMembers(values:unknown[],depth=0):unknown[]{
    if(depth>DOCUMENT_LIMITS.depth)throw new ImportBudgetError('RP 表格嵌套超过上限。');
    const result:unknown[]=[];
    for(const value of values){result.push(value);if(result.length>DOCUMENT_LIMITS.widgets)throw new ImportBudgetError('RP 表格元件数超过上限。');
      if(value&&typeof value==='object'&&!Array.isArray(value)){
        const table=own(value as Data,'tableRecovery');
        if(table&&typeof table==='object'&&!Array.isArray(table)&&Array.isArray(own(table as Data,'cells')))result.push(...sourceMembers(list(own(table as Data,'cells'),9999),depth+1));
        const menu=own(value as Data,'menuRecovery');
        if(menu&&typeof menu==='object'&&!Array.isArray(menu)&&own(menu as Data,'table')!==undefined)result.push(...sourceMembers([own(menu as Data,'table')],depth+1));
        const tree=own(value as Data,'treeRecovery'),node=own(value as Data,'treeNodeRecovery');
        if(tree&&typeof tree==='object'&&!Array.isArray(tree)&&Array.isArray(own(tree as Data,'nodes')))result.push(...sourceMembers(list(own(tree as Data,'nodes'),9999),depth+1));
        if(node&&typeof node==='object'&&!Array.isArray(node)){if(own(node as Data,'label')!==undefined)result.push(...sourceMembers([own(node as Data,'label')],depth+1));if(Array.isArray(own(node as Data,'children')))result.push(...sourceMembers(list(own(node as Data,'children'),9999),depth+1));}
      }
    }return result;
  }
  for(const value of diagrams){const d=record(value),pkg=own(d,'packageId');for(const member of sourceMembers(list(own(d,'widgets')))){if(member&&typeof member==='object'&&!Array.isArray(member)){const key=`${pkg}:${own(member as Data,'id')}`;nativeOccurrences.set(key,(nativeOccurrences.get(key)??0)+1);}}}
  const stateDiagrams = new Map<string, Data>(), usedStates = new Set<string>();
  for (const value of diagrams) { const d = record(value); if (own(d, 'rootType') === 'Axure:PanelState') { const key = id(own(d, 'packageId')); if (stateDiagrams.has(key)) throw new Error('重复的面板状态包标识。'); stateDiagrams.set(key, d); } }
  let seenMembers = 0, imageCharacters = 0;
  function convertMembers(diagram: Data, packageId: string, depth: number, ancestors: Set<string>, nested: boolean, tableOwnerId?:string, menuOwnerId?:string, treeContext?:{role:'node'|'label';rootId:string;parentId:string}): Widget[] {
    if (depth > DOCUMENT_LIMITS.depth) throw new ImportBudgetError('RP 面板嵌套超过上限。');
    const widgets: Widget[] = [], members = list(own(diagram, 'widgets')), seenIds = new Set<string>(), layerItems = new Map<string,Data>();
    seenMembers += members.length;
    if (seenMembers > DOCUMENT_LIMITS.widgets) throw new ImportBudgetError('RP 元件数量超过导入上限。');
    for (const entry of members) {
      let sourceId: string | undefined;
      try {
        const item = record(entry);
        sourceId = id(own(item, 'id'));
        if (seenIds.has(sourceId)) { ambiguousTargets.add(`${packageId}:${sourceId}`); throw new Error('同一页面出现重复元件标识。'); }
        seenIds.add(sourceId);
        if (own(item, 'status') !== 'stored-fields-recovered') throw new Error('元件字段未可靠恢复。');
        if (!own(item, 'typeCandidate')) {for(const key of ['tableRecovery','menuRecovery','treeRecovery','inlineFrameRecovery','layerRecovery']){const recovery=own(item,key);if(recovery&&typeof recovery==='object'&&['unsupported-table','unsupported-menu','unsupported-tree','unsupported-inline-frame','unsupported-layer-membership'].includes(String(own(recovery as Data,'status'))))throw new Error(`原生容器未完整恢复：${text(own(recovery as Data,'reason'),2000)}`);}throw new Error('对象形状、路径或表单类型尚未确定。');}
        const candidate = record(own(item, 'typeCandidate')), sourceType = text(own(item, 'type'), 200);
        const type = own(candidate, 'type');
        // Layer is an ordered index over these same flat members. Defer its
        // atomic assembly until every ordinary member has passed existing gates.
        if(type==='layer'){
          if(tableOwnerId||menuOwnerId||treeContext||sourceType!=='Axure:DiagramObject:Layer'||own(candidate,'mapping')!=='native-layer-membership')throw new Error('组身份或所属坐标范围未验证。');
          layerItems.set(sourceId,item);continue;
        }
        if(own(item,'layerRecovery')!==undefined)throw new Error('组恢复数据附着到错误类型。');
        if (type !== 'box' && type !== 'ellipse' && type !== 'path' && type !== 'input' && type !== 'textarea' && type !== 'panel' && type !== 'image' && type !== 'radio' && type !== 'checkbox' && type !== 'select' && type !== 'table' && type !== 'tableCell' && type !== 'menu' && type !== 'tree' && type !== 'treeNode' && type !== 'text' && type !== 'inlineFrame') throw new Error('对象形状或表单类型尚未确定。');
        if(type==='inlineFrame'&&(sourceType!=='Axure:DiagramObject:InlineFrame'||own(candidate,'mapping')!=='native-inline-frame'||nativeOccurrences.get(`${packageId}:${sourceId}`)!==1))throw new Error('内联框架原生身份或映射未验证。');
        if(type!=='inlineFrame'&&own(item,'inlineFrameRecovery')!==undefined)throw new Error('内联框架恢复数据附着到错误类型。');
        if(type==='tree'||type==='treeNode'||type==='text'){
          if(nativeOccurrences.get(`${packageId}:${sourceId}`)!==1)throw new Error('树对象或标签的源身份不唯一。');
          if(type==='tree'){if(treeContext||sourceType!=='Axure:DiagramObject:TreeNodeObject'||own(candidate,'mapping')!=='native-tree-root')throw new Error('树根身份未验证。');}
          else if(type==='treeNode'){if(treeContext?.role!=='node'||sourceType!=='Axure:DiagramObject:TreeNodeObject'||own(candidate,'mapping')!=='native-tree-node'||own(candidate,'rootId')!==treeContext.rootId||own(candidate,'parentId')!==treeContext.parentId)throw new Error('树节点父级身份未验证。');}
          else if(treeContext?.role!=='label'||sourceType!=='Axure:DiagramObject:VectorShape'||own(candidate,'mapping')!=='native-contained-tree-label'||own(candidate,'ownerId')!==treeContext.parentId||own(candidate,'rootId')!==treeContext.rootId)throw new Error('独立文字候选不是已验证的树标签。');
        }else if(treeContext)throw new Error('树子对象类型不符合角色。');
        if(type!=='tree'&&own(item,'treeRecovery')!==undefined||type!=='treeNode'&&own(item,'treeNodeRecovery')!==undefined||type!=='text'&&own(item,'treeLabelRecovery')!==undefined)throw new Error('树恢复字段附着到错误类型。');
        if(tableOwnerId ? type!=='tableCell' : type==='tableCell')throw new Error('表格单元格必须属于完整矩阵。');
        if(menuOwnerId&&type!=='table')throw new Error('菜单的直接子节点必须是已验证表格。');
        if(type==='menu'&&(sourceType!=='Axure:DiagramObject:MenuObject'||own(candidate,'mapping')!=='native-menu-container'||nativeOccurrences.get(`${packageId}:${sourceId}`)!==1))throw new Error('原生菜单身份或同包引用不唯一。');
        if(type!=='menu'&&own(item,'menuRecovery')!==undefined)throw new Error('非菜单对象含菜单恢复数据。');
        if(type==='table'||type==='tableCell'){
          if(sourceType!==`Axure:DiagramObject:${type==='table'?'Table':'TableCell'}`||own(candidate,'mapping')!==(type==='table'?'native-table-matrix':'native-table-cell')||nativeOccurrences.get(`${packageId}:${sourceId}`)!==1)throw new Error('原生表格身份或同包引用不唯一。');
          if(type==='tableCell'&&own(candidate,'tableOwnerId')!==tableOwnerId)throw new Error('单元格所属表格不一致。');
        }else if(own(item,'tableRecovery')!==undefined||own(item,'borderRecovery')!==undefined)throw new Error('非表格对象包含表格恢复数据。');
        if (type === 'select' && !['Axure:DiagramObject:ComboBox', 'Axure:DiagramObject:ListBox'].includes(sourceType)) throw new Error('列表类型候选与源类型不一致。');
        if ((['box', 'ellipse', 'path'].includes(type) && sourceType !== 'Axure:DiagramObject:VectorShape') || (type === 'input' && sourceType !== 'Axure:DiagramObject:TextBox') || (type === 'textarea' && sourceType !== 'Axure:DiagramObject:TextArea') || (type === 'panel' && sourceType !== 'Axure:DiagramObject:DynamicPanel') || (type === 'image' && sourceType !== 'Axure:DiagramObject:ImageBox') || (type === 'radio' && sourceType !== 'Axure:DiagramObject:RadioButton') || (type === 'checkbox' && sourceType !== 'Axure:DiagramObject:CheckBox')) throw new Error('类型候选与源类型不一致。');
        const vectorValue = own(candidate, 'vectorPath');
        if (vectorValue !== undefined && !['box', 'ellipse', 'path'].includes(type)) throw new Error('非图形元件不能携带矢量路径。');
        if (vectorValue !== undefined || type === 'ellipse' || type === 'path') {
          if (own(candidate, 'mapping') !== 'native-control-points-to-svg' || own(candidate, 'storedControlGeometryPreserved') !== true || !Number.isInteger(own(candidate, 'sourceShape'))) throw new Error('矢量路径映射或存储几何边界未明确恢复。');
          if ((type === 'ellipse' && own(candidate, 'sourceShape') !== 15) || (type === 'box' && own(candidate, 'sourceShape') !== 0)) throw new Error('基础图形与原生形状标识不一致。');
          if (vectorValue === undefined) throw new Error('缺少已恢复的矢量路径。');
        }
        const vectorPath = vectorValue === undefined ? undefined : parseVectorPath(vectorValue);
        if (vectorPath && (vectorPath.fillRule !== 'nonzero' || !vectorPath.commands.some(c => c.op === 'L' || c.op === 'C'))) throw new Error('原生路径填充规则或线段未明确恢复。');
        if (type === 'textarea' && own(candidate, 'inputType') !== undefined) throw new Error('多行文本框不支持附加输入类型。');
        const geometry = record(own(item, 'storedGeometry')), flags = record(own(item, 'storedFlags'));
        let styleRecovery = own(item, 'styleRecovery');
        let location:Data;
        const menuPosition=own(item,'menuPositionRecovery');
        if(menuOwnerId){
          const recovery=record(menuPosition);
          if(Object.keys(recovery).some(k=>!['status','menuOwnerId','x','y','padding','source'].includes(k))||own(recovery,'status')!=='derived-menu-table-position'||own(recovery,'source')!=='MenuObject.bN04'||own(recovery,'menuOwnerId')!==menuOwnerId||own(recovery,'x')!==0||own(recovery,'y')!==0||JSON.stringify(own(recovery,'padding'))!=='[0,0,0,0]')throw new Error('菜单内部表格缺少已验证的零边距布局。');
          if(own(geometry,'location')!==null){const explicit=stored(own(geometry,'location'));if(own(explicit,'X')!==0||own(explicit,'Y')!==0)throw new Error('内部表格保存位置与菜单布局冲突。');}
          location={X:0,Y:0};
        }else{if(menuPosition!==undefined)throw new Error('派生菜单位置不能用于独立对象。');location=resolvedGeometry(own(geometry,'location'),styleRecovery,'location');}
        const size = resolvedGeometry(own(geometry, 'size'), styleRecovery, 'size');
        if (own(geometry, 'isComputedLayout') !== false) throw new Error('元件的计算布局上下文尚未确定。');
        if (own(flags, 'IsContained') !== (treeContext?.role==='label')) throw new Error('元件容器关系尚未确定。');
        if (['is-fixed', 'is-percent-width'].some(k => own(flags, k) === true)) throw new Error('固定定位或百分比布局尚未求解。');
        if (type !== 'panel' && own(flags, 'fit-to-content') === true) throw new Error('非面板的适应内容布局尚未求解。');
        if (['box', 'ellipse', 'path'].includes(type) && (typeof own(flags, 'AutoFitWidth') !== 'boolean' || typeof own(flags, 'AutoFitHeight') !== 'boolean')) throw new Error('图形自动尺寸状态未知。');
        if (type === 'panel' && typeof own(flags, 'fit-to-content') !== 'boolean') throw new Error('面板缺少明确的尺寸模式。');
        const rotation = recoveredRotation(item,geometry,type,!!vectorPath);
        const authorPins = importAuthorResizePins(own(item,'authorResizePinRecovery'),sourceId,own(geometry,'styleId'));
        const storedText = record(own(item, 'text')), textStatus = own(storedText, 'status');
        let widgetText = '';
        if (textStatus === 'stored-plain-text' || textStatus === 'stored-rich-text-as-plain') widgetText = text(own(storedText, 'text'));
        else if (textStatus === 'stored-empty-rich-text' && ['box', 'ellipse', 'path','tableCell'].includes(type) && own(storedText, 'text') === '' && own(storedText, 'source') === 'native-omitted-empty-rich-text') widgetText = '';
        else if (!['panel','image','table','menu','tree','treeNode','inlineFrame'].includes(type) || textStatus !== 'no-observed-text-field') throw new Error(textStatus === 'no-observed-text-field' ? '没有已验证的文本字段，无法确认是否为空。' : '富文本包含未支持的内联内容。');
        if (type === 'textarea') {
          if (textStatus !== 'stored-plain-text') throw new Error('多行文本框缺少明确的纯文本字段。');
          widgetText = literal(widgetText).replace(/\r\n?/g, '\n');
        }
        if(rotation!==0&&widgetText!=='')throw new Error('非空文字的独立文字旋转尚未恢复，不能仅旋转整个元件。');
        const label = own(item, 'label');
        if (label !== null && typeof label !== 'string') throw new Error('元件名称无效。');
        for (const key of ['VisibleFromSettings', 'Disabled', 'IsLocked']) if (typeof own(flags, key) !== 'boolean') throw new Error(`元件状态 ${key} 未明确保存。`);
        const selectionValue = own(item, 'selectionRecovery');
        const selection = selectionValue === undefined ? undefined : record(selectionValue);
        const selectionSupported = selection && own(selection, 'status') === 'supported-selection';
        if (selectionSupported) styleRecovery = own(selection, 'baseStyleRecovery');
        if (['radio', 'checkbox'].includes(type) && !selectionSupported) throw new Error('表单勾选状态或分组尚未可靠恢复。');
        const recoveredVisibility = styleRecovery === undefined ? null : own(record(styleRecovery), 'visible');
        if (recoveredVisibility !== null && typeof recoveredVisibility !== 'boolean') throw new Error('恢复的可见性格式无效。');
        const widget: Widget = {
          id: `rp-w-${packageId}-${sourceId}`, type, name: typeof label === 'string' && label ? text(label, 500) : `${type} ${sourceId.slice(0, 8)}`,
          text: widgetText, x: number(own(location, 'X')), y: number(own(location, 'Y')),
          width: number(own(size, 'Width'), 1), height: number(own(size, 'Height'), 1), rotation,
          style: { ...recoveredStyle(styleRecovery, type), ...authorPins },
          ...(vectorPath ? { vectorPath } : {}),
          hidden: own(flags, 'VisibleFromSettings') === false || recoveredVisibility === false, disabled: own(flags, 'Disabled') === true, locked: own(flags, 'IsLocked') === true,
          interactions: [], notes: `Experimental RP import\nSource package: ${packageId}\nSource object: ${sourceId}\nSource type: ${sourceType}\nStored base rectangle, recognized cached styles and uniform text. Layout was not recomputed. See import report for supported behavior and omitted fields.`,
        };
        const placement=importPlacement(own(item,'placementRecovery'),own(geometry,'placement'),sourceId,own(geometry,'styleId'),type,!!(tableOwnerId||menuOwnerId||treeContext));
        if(placement===false)widget.placed=false;
        if(widget.style.cornerVisibility&&type==='box'&&own(candidate,'sourceShape')!==0)throw new Error('原生矩形圆角参数缺少明确的 Shape0 身份。');
        validateNativeBorderSurface(widget.style,widget);
        if (sourceType === 'Axure:DiagramObject:VectorShape' && ['box', 'ellipse', 'path'].includes(type)) {
          widget.shapeText = { autoFitWidth: boolean(own(flags, 'AutoFitWidth')), autoFitHeight: boolean(own(flags, 'AutoFitHeight')) };
        }
        const richValue = own(item,'richTextRecovery');
        if (richValue !== undefined) {
          const recovery = record(richValue), status = own(recovery,'status');
          if (status === 'supported-rich-text') {
            const richCarrier = sourceType === 'Axure:DiagramObject:VectorShape' && (['box','ellipse','path'].includes(type)||type==='text'&&treeContext?.role==='label')
              || sourceType === 'Axure:DiagramObject:RadioButton' && type === 'radio'
              || sourceType === 'Axure:DiagramObject:CheckBox' && type === 'checkbox'
              || sourceType === 'Axure:DiagramObject:TableCell' && type === 'tableCell';
            if (!richCarrier || textStatus !== 'stored-rich-text-as-plain') throw new Error('原生富文本载体与元件类型不一致。');
            const recovered = recoveredRichText(recovery,widgetText);
            if(rotation!==0&&recovered.text!=='')throw new Error('非空富文本的独立文字旋转尚未恢复。');
            widget.richText = recovered.richText; widget.text = recovered.text;
            if(recovered.linkSources)pendingRichLinks.set(`${packageId}:${sourceId}`,{packageId,sourceId,sources:recovered.linkSources});
            issue('rich-text-recovery','已恢复段落、字符字体及字面文字，按保存的段落终止符消除重复换行；保留空段。自动行高采用浏览器 normal，未重算原生文字尺寸。','warning',packageId,sourceId,own(recovery,'source'));
          } else if (status === 'unsupported-rich-text') {if(type==='tableCell')throw new Error('表格单元格富文本未完整恢复。');issue('rich-text-omitted','富文本格式包含未支持字段；当前只保留此前可恢复的纯文本，未宣称格式恢复。','warning',packageId,sourceId,recovery);}
          else if (status !== 'no-rich-text') throw new Error('未知富文本恢复状态。');
        }
        const selectValue = own(item, 'selectRecovery');
        if (type === 'select') {
          const recovery = record(selectValue), mode = sourceType === 'Axure:DiagramObject:ComboBox' ? 'dropdown' : 'listbox';
          if (own(recovery, 'status') !== 'decoded-select-properties' || Object.keys(recovery).some(key => !['status', 'selectMode', 'multiple', 'options', 'storedSelectedIndices'].includes(key))) throw new Error('列表选项未完整恢复。');
          if (own(candidate, 'mapping') !== 'native-select-options' || own(candidate, 'selectMode') !== mode || own(recovery, 'selectMode') !== mode) throw new Error('列表的原生类型映射不一致。');
          const multiple = boolean(own(recovery, 'multiple'));
          if (mode === 'dropdown' && multiple) throw new Error('原生下拉框不启用多选。');
          if (textStatus !== 'stored-plain-text' || widgetText !== '') throw new Error('列表的基础文本字段必须明确为空；选项取自 SelectObject。');
          const seenOptions = new Set<string>(), selected: number[] = [];
          const options = list(own(recovery, 'options'), 500).map((value, index) => {
            const option = record(value), sourceId = id(own(option, 'sourceId'));
            if (Object.keys(option).some(key => !['sourceId', 'value', 'selected'].includes(key)) || seenOptions.has(sourceId)) throw new Error('列表选项引用重复或包含未知字段。');
            seenOptions.add(sourceId); if (boolean(own(option, 'selected'))) selected.push(index);
            // Options are literal strings, including whitespace and [[...]].
            return text(own(option, 'value'), 2000);
          });
          const stored = list(own(recovery, 'storedSelectedIndices'), 500);
          if (JSON.stringify(stored) !== JSON.stringify(selected)) throw new Error('列表的选中标记与选项索引不一致。');
          const effective = multiple ? selected : selected.length ? [selected.at(-1)!] : mode === 'dropdown' && options.length ? [0] : [];
          Object.assign(widget, { selectMode: mode, multiple, options, selectedIndices: effective, text: '' });
          issue('select-options-recovery', '已按原顺序保留选项文字、空格与选中标记。单选下拉框无标记时默认首项；列表框无标记时不选中。采用标准 HTML select 映射，原生混淆属性名及操作系统弹出菜单像素尚未逐项核对。', 'warning', packageId, sourceId, { ...recovery, effectiveSelectedIndices: effective, htmlSize: mode === 'listbox' ? 2 : null });
        } else if (selectValue !== undefined) throw new Error('非列表控件不能携带列表选项。');
        let errorKnown = false;
        if (selectionSupported) {
          const selected = boolean(own(selection, 'selected')), group = text(own(selection, 'selectionGroup'), 256);
          if (/[\u0000-\u001f\u007f]/.test(group)) throw new Error('选中组名称无效。');
          if (type === 'radio' || type === 'checkbox') {
            if (group) throw new Error('表单混合选择组尚不支持。');
            widget.checked = selected;
            if (type === 'radio') { const radioGroup = text(own(selection, 'radioGroup'), 256); if (/[\u0000-\u001f\u007f]/.test(radioGroup)) throw new Error('单选组名称无效。'); if (radioGroup) widget.radioGroup = radioGroup; }
          } else { widget.selected = selected; if (group) widget.selectionGroup = group; }
          const selectedPatch=record(own(selection,'selectedStyle'));
          for(const paint of ['fill','stroke']){
            if(own(selectedPatch,paint)!==undefined&&own(selectedPatch,paint+'Gradient')!==undefined)throw new Error('原生选中绘制不能同时为纯色和渐变。');
            if(own(selectedPatch,paint+'Gradient')!==undefined)recoveredStyle({style:{[paint+'Gradient']:own(selectedPatch,paint+'Gradient')}},type);
          }
          for(const field of ['linePattern','lineEnds','borderVisibility','radius','cornerVisibility'])if(own(selectedPatch,field)!==undefined)recoveredStyle({style:{[field]:own(selectedPatch,field)}},type,true);
          const patch = parseWidgetStylePatch(selectedPatch);
          validateNativeBorderSurface(patch,widget);
          for(const field of ['outerShadow','innerShadow','textShadow'] as const)if(patch[field]!==undefined)recoveredStyle({style:{[field]:patch[field]}},type);
          if (Object.keys(patch).length) widget.selectedStyle = patch;
        } else if (selection) issue('selection-omitted', '选中状态或状态样式不完整；保留初始外观，相关交互不会恢复。', 'warning', packageId, sourceId, selection);
        const interactionStyleValue = own(item, 'interactionStyleRecovery');
        if (interactionStyleValue !== undefined) {
          try {
            const recovery = record(interactionStyleValue);
            if (own(recovery, 'status') !== 'recovered-interaction-styles') throw new Error('交互样式引用或继承尚未可靠恢复。');
            const complete = boolean(own(recovery, 'cacheChainComplete')), states = record(own(recovery, 'states'));
            if (Object.keys(states).length !== 4 || Object.keys(states).some(key => !Object.hasOwn(RP_STYLE_STATES, key))) throw new Error('交互样式状态集合无效。');
            for (const [stateName, [nativeState, field]] of Object.entries(RP_STYLE_STATES)) {
              const value = own(states, stateName);
              try {
                const state = record(value);
                if (own(state, 'sourceState') !== nativeState) throw new Error('交互样式的原生状态身份不一致。');
                if (own(state, 'status') === 'unsupported-state-style') throw new Error(text(own(state, 'reason'), 2000));
                if (own(state, 'status') === 'no-state-style') {
                  if (Object.keys(state).some(key => !['sourceState','status'].includes(key))) throw new Error('空状态样式携带了未验证属性。');
                  continue;
                }
                const patch = recoveredInteractionStyle(state, nativeState, complete, type);
                validateNativeBorderSurface(patch,widget);
                widget[field] = patch;
                issue('interaction-style-recovery', `已恢复 ${stateName} 的明确状态样式；未推断原生组合状态的完整优先级。`, 'warning', packageId, sourceId, { state: stateName, recovery: state, cacheChainComplete: complete });
              } catch (error) {
                issue('interaction-style-omitted', `${stateName} 状态样式未导入：${(error as Error).message}`, 'warning', packageId, sourceId, { state: stateName, recovery: value });
              }
            }
            const unhandled = own(recovery, 'unhandledStates');
            if (Array.isArray(unhandled) && unhandled.length && own(item,'errorHintRecovery') === undefined) issue('interaction-style-omitted', 'Error/Hint 等其他原生样式状态尚未恢复。', 'warning', packageId, sourceId, { unhandledStates: unhandled });
          } catch (error) {
            issue('interaction-style-omitted', (error as Error).message, 'warning', packageId, sourceId, interactionStyleValue);
          }
        }
        const errorHintValue = own(item,'errorHintRecovery');
        if (errorHintValue !== undefined) {
          try {
            const recovery = record(errorHintValue);
            if (own(recovery,'status') !== 'recovered-error-hint' || Object.keys(recovery).some(key=>!['status','error','inputHint','normalStyleRecovery','styles'].includes(key))) throw new Error('错误状态或提示字段未可靠恢复。');
            const error = boolean(own(recovery,'error'));
            if (own(flags,'Error') !== error) throw new Error('错误状态与明确存储标志不一致。');
            let hint: { hintText:string; hintHideOn:'focus'|'typing' } | undefined;
            if (type === 'input' || type === 'textarea') {
              const raw = record(own(recovery,'inputHint')), policy = own(raw,'hintHideOn');
              if (Object.keys(raw).some(key=>!['hintText','hintHideOn','sourceFields'].includes(key)) || (policy !== 'focus' && policy !== 'typing')) throw new Error('提示文字或隐藏方式无效。');
              const fields = list(own(raw,'sourceFields'),2);
              if (fields.length!==2 || fields[0]!=='PlaceholderText' || fields[1]!=='HideHintOnFocus') throw new Error('提示来源字段未确认。');
              hint = {hintText:literal(own(raw,'hintText')),hintHideOn:policy};
            } else if (own(recovery,'inputHint') !== undefined) throw new Error('非输入控件不能携带提示文字。');
            if (error) {
              if (own(flags,'Selected') !== false || own(flags,'Disabled') !== false) throw new Error('同时选中或禁用的初始错误外观尚未可靠拆分。');
              widget.style = { ...recoveredStyle(record(own(recovery,'normalStyleRecovery')),type), ...authorPins };
              validateNativeBorderSurface(widget.style,widget);
            }
            widget.error = error; if(hint)Object.assign(widget,hint);errorKnown=true;
            issue('error-hint-recovery','已恢复明确错误标志及输入提示；提示文字独立于输入值，初始错误事件触发时机尚未与原版界面对照。','warning',packageId,sourceId,{error,...(hint?{inputHint:hint}:{})});
            const styles = record(own(recovery,'styles'));
            if (own(styles,'status') !== 'recovered-interaction-styles') throw new Error('Error/Hint 样式继承未完全解析；行为字段已保留。');
            const complete = boolean(own(styles,'cacheChainComplete')), states = record(own(styles,'states'));
            if (Object.keys(states).length!==2 || Object.keys(states).some(key=>!['error','hint'].includes(key))) throw new Error('Error/Hint 状态集合无效。');
            for (const [stateName,nativeState,field] of [['error','Error','errorStyle'],['hint','Hint','hintStyle']] as const) {
              const value = own(states,stateName);
              try {
                const state = record(value);
                if (own(state,'sourceState')!==nativeState) throw new Error('状态身份不一致。');
                if (own(state,'status')==='no-state-style') {
                  if(Object.keys(state).some(key=>!['sourceState','status'].includes(key)))throw new Error('空状态携带未验证属性。');
                  continue;
                }
                if(own(state,'status')==='unsupported-state-style')throw new Error(text(own(state,'reason'),2000));
                if(stateName==='hint' && !hint)throw new Error('Hint 样式仅用于输入或多行输入。');
                const patch = recoveredInteractionStyle(state,nativeState,complete,type,true);
                validateNativeBorderSurface(patch,widget);widget[field] = patch;
                issue('error-hint-style-recovery',`已恢复 ${stateName} 的明确样式。`,'warning',packageId,sourceId,{state:stateName,recovery:state});
              } catch(error) { issue('error-hint-style-omitted',`${stateName}：${(error as Error).message}`,'warning',packageId,sourceId,{state:stateName,recovery:value}); }
            }
          } catch(error) { issue('error-hint-omitted',(error as Error).message,'warning',packageId,sourceId,errorHintValue); }
        }
        const formPropertiesValue = own(item, 'formPropertiesRecovery');
        if (formPropertiesValue !== undefined) {
          const form = record(formPropertiesValue);
          if (type !== 'input' && type !== 'textarea') throw new Error('表单属性附着到非文本输入控件。');
          if (own(form, 'status') !== 'recovered-form-properties' || Object.keys(form).some(key => !['status', 'sourceType', 'readOnly', 'maxLength', 'submitButton'].includes(key))) throw new Error('原生表单属性未完整恢复。');
          if (own(form, 'sourceType') !== (type === 'input' ? 'TextBox' : 'TextArea') || own(form, 'submitButton') !== null) throw new Error('原生输入类型或提交按钮绑定尚未验证。');
          const readOnly = boolean(own(form, 'readOnly')), length = own(form, 'maxLength');
          if (type === 'input' ? typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > 2147483647 : length !== null) throw new Error('原生最大字符数无效。');
          widget.readOnly = readOnly;
          if (typeof length === 'number' && length !== 2147483647) widget.maxLength = length;
          issue('form-properties-recovery', '已恢复明确只读状态和文本框最大字符数；原生 Int32.MaxValue 表示无限制，非零提交按钮绑定尚未恢复。', 'warning', packageId, sourceId, form);
        }
        if (type === 'input' && own(candidate, 'inputType') !== undefined) {
          const inputType = own(candidate, 'inputType');
          if (typeof inputType !== 'string' || !INPUT_TYPES.includes(inputType as InputType)) throw new Error('未知的输入框类型。');
          const nativeType = own(candidate, 'nativeInputType'), mapping = own(candidate, 'inputTypeMapping');
          if (nativeType !== undefined || mapping !== undefined || !['text','password'].includes(inputType)) {
            const nativeTypes: Record<string, number> = { text:0, password:1, email:2, number:3, tel:4, url:5, search:6, file:12, date:17, month:18, time:19 };
            if (nativeType !== nativeTypes[inputType] || mapping !== 'standard-html-input-type') throw new Error('原生输入类型编号或标准 HTML 映射未明确验证。');
          }
          if (inputType === 'file' && (widget.text !== '' || widget.hintText !== '' || formPropertiesValue === undefined)) throw new Error('文件输入仅支持明确空文本和空提示；不恢复文件选择或预填文件路径。');
          widget.inputType = inputType as InputType;
          if (!['text','password'].includes(inputType)) issue('input-type-recovery', '已恢复官方输入类型的标准 HTML 对应值；原生 HTML 字面未解码，显示、有效输入值及只读/长度适用性由浏览器决定。', 'warning', packageId, sourceId, { nativeInputType: nativeType, inputType, mapping, ...(inputType === 'file' ? { fileSelectionRecovered:false } : {}) });
        }
        if (type === 'image') {
          const recovered = recoveredImage(own(item, 'imageRecovery'), widget.width, widget.height);
          if (imageCharacters + recovered.dataUrl.length > 8 * 1024 * 1024) throw new ImportBudgetError('图片累计 data URL 超过导入上限。');
          imageCharacters += recovered.dataUrl.length;widget.imageSrc = recovered.dataUrl;
          issue('embedded-image-recovery', '仅恢复原文件内校验过的静态 PNG 字节及等比例存储矩形；裁剪、滤镜、方向元数据、九宫格和交互换图未恢复。', 'warning', packageId, sourceId, recovered.details);
        }
        if(type==='inlineFrame'){
          const recovery=record(own(item,'inlineFrameRecovery')),source=record(own(recovery,'source')),preview=record(own(recovery,'preview')),zero='0'.repeat(32);
          if(Object.keys(recovery).some(k=>!['status','hideBorders','scrolling','preview','source'].includes(k))||own(recovery,'status')!=='supported-inline-frame'||Object.keys(preview).length!==1||own(preview,'kind')!=='none')throw new Error('内联框架目标或预览未完整恢复。');
          const sourceKeys=['targetId','literalId','targetType','targetPageId','literal','variableIdentifiers','repeaterScopeId','targetRepeaterScopeId','sourceStyleId','localStyleKeys','nativeShowBorder','nativeScrollbars','nativePreview','customImageHash','stylePolicy'];
          if(Object.keys(source).length!==sourceKeys.length||Object.keys(source).some(k=>!sourceKeys.includes(k)))throw new Error('内联框架来源协议不完整。');
          const refs=[sourceId,id(own(source,'targetId')),id(own(source,'literalId')),id(own(source,'sourceStyleId'))];
          if(refs.includes(zero)||new Set(refs).size!==4||refs[3]!==own(geometry,'styleId'))throw new Error('内联框架引用身份有冲突。');
          if(own(source,'targetType')!==0||own(source,'targetPageId')!==zero||own(source,'literal')!==''||JSON.stringify(own(source,'variableIdentifiers'))!=='[]'||own(source,'repeaterScopeId')!==zero||own(source,'targetRepeaterScopeId')!==zero)throw new Error('仅恢复已验证的空内联框架目标。');
          const showBorder=boolean(own(source,'nativeShowBorder')),hideBorders=boolean(own(recovery,'hideBorders')),scroll=own(source,'nativeScrollbars'),scrolling=own(recovery,'scrolling');
          if(hideBorders!==!showBorder||![1,2,3].includes(scroll as number)||scrolling!==({1:'auto',2:'yes',3:'no'} as Record<number,string>)[scroll as number]||own(source,'nativePreview')!==0||own(source,'customImageHash')!==''||own(source,'stylePolicy')!=='frame-native-border-only'||JSON.stringify(own(source,'localStyleKeys'))!=='[101,105]')throw new Error('内联框架边框、滚动或样式来源不一致。');
          stored(own(geometry,'location'));stored(own(geometry,'size'));
          if(selectionSupported||Object.keys(record(own(record(own(item,'styleRecovery')),'style'))).length||own(flags,'Disabled')!==false||own(flags,'Selected')!==false||own(flags,'Error')!==false||widget.text!==''||widget.richText||own(item,'panelStatePackages')!==null||widget.selectionGroup||widget.selectedStyle||widget.mouseOverStyle||widget.mouseDownStyle||widget.focusedStyle||widget.disabledStyle||widget.errorStyle||widget.hintStyle)throw new Error('内联框架含未支持的内容、状态或外观。');
          widget.inlineFrame={hideBorders,scrolling:scrolling as 'auto'|'yes'|'no',preview:{kind:'none'}};
          issue('inline-frame-recovery','已恢复空内联框架、独立边框开关及滚动策略。普通形状样式缓存未完整解析，采用中性的透明无描边包装；未声明恢复原生字体或非空地址、文件和预览图。','warning',packageId,sourceId,recovery);
        }
        // Validate the owner's local declarations before registering any child
        // graph. A rejected container must never leave addressable descendants.
        const adaptiveMaps=importAdaptiveStyles(own(item,'adaptiveStyleRecovery'),own(geometry,'adaptiveStyleCount'),sourceId,widget,validateNativeBorderSurface,!!(tableOwnerId||menuOwnerId||treeContext));
        if((treeContext||menuOwnerId)&&[...adaptiveMaps.values()].some(patch=>Object.keys(patch).length))throw new Error('菜单或树的共享后代不支持非空自适应声明。');
        if(type==='text'&&treeContext?.role==='label'){
          const recovery=record(own(item,'treeLabelRecovery'));
          if(own(recovery,'status')!=='supported-contained-tree-label'||Object.keys(recovery).some(k=>!['status','ownerId','rootId','sourceStyleId','source','location','size','inheritedFields'].includes(k))||own(recovery,'ownerId')!==treeContext.parentId||own(recovery,'rootId')!==treeContext.rootId||own(recovery,'source')!=='KJm7.cJO3-contained-parent')throw new Error('树标签继承来源未完整验证。');
          id(own(recovery,'sourceStyleId'));
          const rawLocation=record(own(recovery,'location')),rawSize=record(own(recovery,'size'));
          if(Object.keys(rawLocation).length!==2||Object.keys(rawSize).length!==2||own(rawLocation,'X')!==22||own(rawLocation,'Y')!==0||own(rawSize,'Width')!==widget.width||own(rawSize,'Height')!==20||widget.x!==22||widget.y!==0||widget.height!==20||own(geometry,'styleId')!==null||own(record(own(geometry,'location')),'source')!=='ContainedLocation'||own(record(own(geometry,'size')),'source')!=='ContainedSize')throw new Error('树标签矩形与明确的 Contained 字段不一致。');
          if(JSON.stringify(own(recovery,'inheritedFields'))!==JSON.stringify(['MyStyle','AdaptiveStyles','SubmitButton','Disabled','Selected','Error','VisibleFromSettings'])||own(record(own(item,'styleRecovery')),'cacheChainComplete')!==true||own(flags,'AutoFitWidth')!==true||own(flags,'AutoFitHeight')!==false||own(flags,'Disabled')!==false||own(flags,'Selected')!==false||own(flags,'Error')!==false||!widget.richText||widget.style.strokeWidth!==0||widget.style.fill!=='#ffffff00'||widget.selectionGroup||own(item,'panelStatePackages')!==null)throw new Error('树标签样式、状态或完整富文本尚未确定。');
          issue('tree-label-recovery','保留独立标签身份、Contained 矩形和字面富文本；样式来自已核对的父节点样式 getter，自动文字宽度保持保存快照。','warning',packageId,sourceId,recovery);
        }
        if(type==='tree'||type==='treeNode'){
          const isRoot=type==='tree',recovery=record(own(item,isRoot?'treeRecovery':'treeNodeRecovery')),source=record(own(recovery,'source'));
          const keys=isRoot?['status','nodes','indent','showExpandIcons','iconStyle','showIcons','source']:['status','expanded','label','children','source'];
          const sourceKeys=isRoot?['sourceType','rootId','childIds','diagramObjectIds','images','auxiliaryObjects','layout']:['rootId','parentId','labelId','childIds','diagramObjectIds','expandImageId','iconId','layout'];
          if(own(recovery,'status')!==(isRoot?'supported-tree':'supported-tree-node')||Object.keys(recovery).some(k=>!keys.includes(k))||Object.keys(source).some(k=>!sourceKeys.includes(k)))throw new Error('树协议包含未知或不完整字段。');
          const rootId=isRoot?sourceId:treeContext!.rootId;
          if(own(source,'rootId')!==rootId||own(source,'layout')!==(isRoot?'native-stored-tree-rows':'stored-tree-row')||!isRoot&&own(source,'parentId')!==treeContext!.parentId)throw new Error('树根或父子来源不一致。');
          if(own(record(own(item,'styleRecovery')),'cacheChainComplete')!==true||own(flags,'Disabled')!==false||own(flags,'Selected')!==false||own(flags,'Error')!==false||widget.text!==''||widget.richText||widget.selectionGroup||own(item,'panelStatePackages')!==null)throw new Error('树容器样式、初始状态或文本关系尚未确定。');
          const nativeNodes=list(own(recovery,isRoot?'nodes':'children'),9999),childIds=list(own(source,'childIds'),9999).map(id),members=list(own(source,'diagramObjectIds'),9999).map(id);
          if(new Set(childIds).size!==childIds.length||new Set(members).size!==members.length||nativeNodes.length!==childIds.length||nativeNodes.some((n,i)=>id(own(record(n),'id'))!==childIds[i]))throw new Error('树节点顺序或引用集合不完整。');
          let nativeLabel:Data|undefined;
          if(isRoot){
            if(own(source,'sourceType')!==sourceType||own(recovery,'indent')!==20||own(recovery,'showExpandIcons')!==true||own(recovery,'iconStyle')!=='triangle'||own(recovery,'showIcons')!==false||!childIds.length||JSON.stringify(members)!==JSON.stringify(childIds))throw new Error('原生树展开图标或根布局不在已验证子集。');
            const images=record(own(source,'images'));
            if(Object.keys(images).length!==2)throw new Error('树展开图标来源不完整。');
            for(const [key,hash,length]of [['CollapsedImage','b0ec13894dda3f4c13309076278aa2b4ff3c0fc9989d9da919aa90595ea55380',175],['ExpandedImage','355c13dccbc66c3e84af4b4491636f997bd83e1b01b023b8d8f6c97c103fdba8',176]] as const){const image=record(own(images,key));if(Object.keys(image).some(k=>!['sha256','offset','length','width','height'].includes(k))||own(image,'sha256')!==hash||own(image,'length')!==length||own(image,'width')!==9||own(image,'height')!==9||!Number.isSafeInteger(own(image,'offset'))||number(own(image,'offset'),0)>32*1024*1024)throw new Error('树三角图标摘要或尺寸不一致。');}
            const all=sourceMembers(nativeNodes),nodeSources=all.filter(n=>own(record(n),'type')==='Axure:DiagramObject:TreeNodeObject').map(n=>record(own(record(n),'treeNodeRecovery'))),roles=list(own(source,'auxiliaryObjects'),9999),roleIds=new Set<string>();
            if(roles.length!==nodeSources.length*2)throw new Error('树辅助图像集合不完整。');
            for(const roleValue of roles){const role=record(roleValue),roleId=id(own(role,'id')),kind=own(role,'role');if(Object.keys(role).length!==3||roleIds.has(roleId)||nativeOccurrences.has(`${packageId}:${roleId}`)||kind!=='icon'&&kind!=='expand')throw new Error('树辅助图像身份冲突。');roleIds.add(roleId);const match=nodeSources.filter(n=>own(record(own(n,'source')),kind==='icon'?'iconId':'expandImageId')===roleId);if(match.length!==1||own(role,'active')!==(kind==='expand'&&list(own(match[0],'children')).length>0))throw new Error('树辅助图像活动角色不一致。');}
          }else{
            nativeLabel=record(own(recovery,'label'));const labelId=id(own(source,'labelId')),plus=id(own(source,'expandImageId')),icon=id(own(source,'iconId'));
            if(id(own(nativeLabel,'id'))!==labelId||new Set([labelId,plus,icon,...childIds]).size!==3+childIds.length||members.length!==1+childIds.length+(childIds.length?1:0)||[labelId,...childIds,...(childIds.length?[plus]:[])].some(v=>!members.includes(v))||widget.height!==20||widget.width<23||typeof own(recovery,'expanded')!=='boolean')throw new Error('树行、标签或辅助对象关系不一致。');
          }
          const oldTargets=new Set(widgetTargets.keys()),oldSelections=new Set(selectionTargets),oldErrors=new Set(errorTargets),oldLinks=new Set(pendingRichLinks.keys()),oldIssues=report.issues.length,oldCounts={nestedWidgetsImported:report.nestedWidgetsImported,nestedWidgetsSkipped:report.nestedWidgetsSkipped};
          try{
            const label=nativeLabel?convertMembers({widgets:[nativeLabel]},packageId,depth+1,ancestors,true,undefined,undefined,{role:'label',rootId,parentId:sourceId})[0]:undefined;
            const children=convertMembers({widgets:nativeNodes},packageId,depth+1,ancestors,true,undefined,undefined,{role:'node',rootId,parentId:sourceId});
            if(children.length!==nativeNodes.length||children.some(c=>c.type!=='treeNode'||!c.treeNode)||!isRoot&&(!label||label.type!=='text'||label.width+22!==widget.width||id(own(record(own(nativeLabel!,'treeLabelRecovery')),'sourceStyleId'))!==id(own(geometry,'styleId'))))throw new Error(`树子图未完整恢复：${report.issues.slice(oldIssues).find(i=>i.severity==='skipped')?.message??'不完整标签或节点'}`);
            const extent=(n:Widget):{height:number;right:number}=>{let height=n.height,right=n.width;if(n.treeNode!.expanded)for(const c of n.treeNode!.children){const e=extent(c);height+=e.height;right=Math.max(right,c.x+e.right);}return {height,right};};
            let y=isRoot?0:20,width=0;for(const child of children){if(child.x!==(isRoot?0:20)||child.y!==y)throw new Error('树保存坐标与展开行顺序不一致。');const e=extent(child);y+=e.height;width=Math.max(width,child.x+e.right);}
            if(isRoot){if(widget.width!==width||widget.height!==y)throw new Error('树根保存矩形与完整可见行范围不一致。');widget.tree={nodes:children,indent:20,showExpandIcons:true,iconStyle:'triangle',showIcons:false};}
            else widget.treeNode={label:label!,children,expanded:boolean(own(recovery,'expanded'))};
            issue('tree-container-recovery','保留树根、节点和标签的独立身份及保存行布局；默认三角用独立图形绘制，原版图标逐像素及文字自动尺寸未宣称等价。','warning',packageId,sourceId,source);
          }catch(error){for(const key of widgetTargets.keys())if(!oldTargets.has(key))widgetTargets.delete(key);for(const key of selectionTargets)if(!oldSelections.has(key))selectionTargets.delete(key);for(const key of errorTargets)if(!oldErrors.has(key))errorTargets.delete(key);for(const key of pendingRichLinks.keys())if(!oldLinks.has(key))pendingRichLinks.delete(key);Object.assign(report,oldCounts);report.issues.length=oldIssues;throw error;}
        }
        if(type==='menu'){
          const recovery=record(own(item,'menuRecovery')),source=record(own(recovery,'source')),orientation=own(recovery,'orientation');
          if(own(recovery,'status')!=='supported-menu'||Object.keys(recovery).some(k=>!['status','orientation','padding','table','submenus','source'].includes(k))||Object.keys(source).some(k=>!['sourceType','nativeOrientation','tableId','submenuIds','layout'].includes(k)))throw new Error('菜单协议或来源含未知字段。');
          if((orientation!=='horizontal'&&orientation!=='vertical')||own(source,'nativeOrientation')!==(orientation==='horizontal'?0:1)||own(source,'sourceType')!==sourceType||own(source,'layout')!=='menu-padding-table')throw new Error('原生菜单方向或布局映射不一致。');
          if(JSON.stringify(own(recovery,'padding'))!=='[0,0,0,0]'||list(own(recovery,'submenus')).length||list(own(source,'submenuIds')).length)throw new Error('仅恢复有真实证据的零边距、无子菜单原生菜单。');
          if(own(flags,'Disabled')!==false||own(flags,'Selected')!==false||own(flags,'Error')!==false||widget.selectionGroup||widget.text!==''||widget.richText||own(item,'panelStatePackages')!==null)throw new Error('菜单初始状态、文字或容器关系尚未确定。');
          const nativeTable=record(own(recovery,'table'));if(id(own(nativeTable,'id'))!==id(own(source,'tableId')))throw new Error('菜单表格来源标识不一致。');
          const oldTargets=new Set(widgetTargets.keys()),oldSelections=new Set(selectionTargets),oldErrors=new Set(errorTargets),oldLinks=new Set(pendingRichLinks.keys()),oldIssues=report.issues.length;
          const oldCounts={nestedWidgetsImported:report.nestedWidgetsImported,nestedWidgetsSkipped:report.nestedWidgetsSkipped};
          try{
            const converted=convertMembers({widgets:[nativeTable]},packageId,depth+1,ancestors,true,undefined,sourceId),table=converted[0];
            if(converted.length!==1||!table?.table||table.type!=='table')throw new Error(`菜单内部表格未完整恢复：${report.issues.slice(oldIssues).find(i=>i.severity==='skipped')?.message??'未知表格'}`);
            if(table.x!==0||table.y!==0||table.width!==widget.width||table.height!==widget.height||(orientation==='horizontal'?table.table.rowHeights.length!==1:table.table.columnWidths.length!==1))throw new Error('菜单方向、外框与内部表格不一致。');
            widget.menu={orientation,padding:[0,0,0,0],table,submenus:[]};
            issue('menu-container-recovery','已保留菜单、内部表格和各格独立身份；内部表格位置由已核对的 MenuObject.bN04 零边距布局求得，不是猜测缺失坐标。非空原生子菜单尚未恢复。','warning',packageId,sourceId,{...source,position:own(nativeTable,'menuPositionRecovery')});
          }catch(error){
            for(const key of widgetTargets.keys())if(!oldTargets.has(key))widgetTargets.delete(key);
            for(const key of selectionTargets)if(!oldSelections.has(key))selectionTargets.delete(key);
            for(const key of errorTargets)if(!oldErrors.has(key))errorTargets.delete(key);
            for(const key of pendingRichLinks.keys())if(!oldLinks.has(key))pendingRichLinks.delete(key);
            Object.assign(report,oldCounts);report.issues.length=oldIssues;throw error;
          }
        }
        if(type==='table'||type==='tableCell'){
          if(own(flags,'Disabled')!==false||own(flags,'Selected')!==false||own(flags,'Error')!==false||widget.selectionGroup)throw new Error('原生表格初始状态或分组尚未完整恢复。');
          if(type==='tableCell'){
            const recovery=record(own(item,'borderRecovery')),layout=record(own(recovery,'layout')),transform=record(own(layout,'transform'));
            if(own(recovery,'status')!=='supported-cell-borders'||Object.keys(recovery).some(k=>!['status','widths','color','source','layout'].includes(k))||own(layout,'rotation')!==0||Object.keys(layout).length!==2||Object.keys(transform).length!==5||Object.entries({ScaleX:1,ScaleY:1,TranslateX:0,TranslateY:0,Rotate:0}).some(([key,value])=>own(transform,key)!==value))throw new Error('单元格边框或无旋转布局未验证。');
            if(own(record(own(item,'styleRecovery')),'cacheChainComplete')!==true||own(flags,'AutoFitWidth')!==false||own(flags,'AutoFitHeight')!==false||own(item,'panelStatePackages')!==null)throw new Error('单元格的完整样式、固定尺寸或容器关系未验证。');
            const widths=list(own(recovery,'widths'),4);if(widths.length!==4)throw new Error('单元格四边边框不完整。');
            const color=text(own(recovery,'color'),9),borderSource=record(own(recovery,'source')),nativeColors=list(own(borderSource,'nativeColors'),4);
            if(!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(color)||own(borderSource,'order')!=='top-right-bottom-left'||nativeColors.length!==4||nativeColors.some(n=>!Number.isInteger(n)||typeof n!=='number'||n<-2147483648||n>2147483647)||new Set(nativeColors).size!==1)throw new Error('单元格边框颜色来源无效。');
            const argb=(nativeColors[0] as number)>>>0,rgb=(argb&0xffffff).toString(16).padStart(6,'0'),alpha=argb>>>24;
            if(color!==`#${rgb}${alpha===255?'':alpha.toString(16).padStart(2,'0')}`)throw new Error('单元格边框颜色与来源不一致。');
            widget.style.borderWidths=widths.map(v=>number(v,0,100)) as [number,number,number,number];widget.style.stroke=color;
            issue('table-cell-borders-recovery','按明确四边宽度和同色边框恢复单元格；原版图像接缝的最终像素尚未核对。','warning',packageId,sourceId,recovery);
          }else{
            const recovery=record(own(item,'tableRecovery'));
            if(own(recovery,'status')!=='supported-table'||Object.keys(recovery).some(k=>!['status','rows','columns','columnWidths','rowHeights','cells','source'].includes(k)))throw new Error('原生表格矩阵未完整恢复。');
            const rows=number(own(recovery,'rows'),1,1000),columns=number(own(recovery,'columns'),1,1000);
            if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows*columns>9999)throw new Error('表格行列或单元格数量超限。');
            const columnWidths=list(own(recovery,'columnWidths'),1000).map(v=>number(v,1)),rowHeights=list(own(recovery,'rowHeights'),1000).map(v=>number(v,1));
            if(columnWidths.length!==columns||rowHeights.length!==rows||columnWidths.reduce((a,b)=>a+b,0)!==widget.width||rowHeights.reduce((a,b)=>a+b,0)!==widget.height||widget.text!==''||widget.richText)throw new Error('表格矩形与轨道总和不一致或容器含文字。');
            const nativeCells=list(own(recovery,'cells'),9999),provenance=record(own(recovery,'source'));
            const cellIds=list(own(provenance,'cellIds'),9999).map(id),order=list(own(provenance,'diagramObjectIds'),9999).map(id);
            if(own(provenance,'sourceType')!==sourceType||own(provenance,'matrixOrder')!=='row-major'||own(provenance,'eventOrder')!=='diagram-objects'||nativeCells.length!==rows*columns||cellIds.length!==nativeCells.length||order.length!==cellIds.length||new Set(cellIds).size!==cellIds.length||new Set(order).size!==order.length||order.some(v=>!cellIds.includes(v))||nativeCells.some((c,i)=>own(record(c),'id')!==cellIds[i]))throw new Error('表格矩阵与原生对象顺序、集合或引用不一致。');
            const oldTargets=new Set(widgetTargets.keys()),oldSelections=new Set(selectionTargets),oldErrors=new Set(errorTargets),oldLinks=new Set(pendingRichLinks.keys());
            const oldCounts={nestedWidgetsImported:report.nestedWidgetsImported,nestedWidgetsSkipped:report.nestedWidgetsSkipped},oldIssues=report.issues.length;
            try{
              const cells=convertMembers({widgets:nativeCells},packageId,depth+1,ancestors,true,sourceId);
              if(cells.length!==nativeCells.length)throw new Error(`表格有未恢复单元格，整个矩阵省略：${report.issues.slice(oldIssues).find(i=>i.severity==='skipped')?.message??'未知单元格'}`);
              let y=0;for(let row=0;row<rows;row++){let x=0;for(let col=0;col<columns;col++){const cell=cells[row*columns+col];if(cell.x!==x||cell.y!==y||cell.width!==columnWidths[col]||cell.height!==rowHeights[row])throw new Error('单元格矩形与行列前缀和不一致。');x+=columnWidths[col];}y+=rowHeights[row];}
              widget.table={columnWidths,rowHeights,cells,...(order.some((v,i)=>v!==cellIds[i])?{cellOrder:order.map(nativeId=>`rp-w-${packageId}-${nativeId}`)}:{})};
              issue('table-matrix-recovery','已恢复完整行优先矩阵、独立单元格及原生对象事件顺序。整体作为透明容器；菜单、合并格、未知几何及残缺矩阵均不降格。','warning',packageId,sourceId,provenance);
            }catch(error){
              for(const key of widgetTargets.keys())if(!oldTargets.has(key))widgetTargets.delete(key);
              for(const key of selectionTargets)if(!oldSelections.has(key))selectionTargets.delete(key);
              for(const key of errorTargets)if(!oldErrors.has(key))errorTargets.delete(key);
              for(const key of pendingRichLinks.keys())if(!oldLinks.has(key))pendingRichLinks.delete(key);
              Object.assign(report,oldCounts);report.issues.length=oldIssues;throw error;
            }
          }
        }
        if (type === 'panel') {
          if (own(flags, 'fit-to-content') === true) widget.fitToContent = true;
          const refs = list(own(item, 'panelStatePackages'), 200);
          if (!refs.length) throw new Error('面板没有可恢复的状态引用。');
          const stateIds = refs.map(v => { const r = record(v); if (own(r, 'referenceTag') !== 19 || own(r, 'name') !== 'Axure:PanelState') throw new Error('未知面板状态引用类型。'); return id(own(r, '$reference')); });
          if (new Set(stateIds).size !== stateIds.length) throw new Error('面板状态引用重复。');
          for (const stateId of stateIds) {
            if (ancestors.has(stateId) || stateId === packageId || usedStates.has(stateId)) throw new Error('循环或重复使用的状态包无法可靠转换。');
            const state = stateDiagrams.get(stateId); if (!state || typeof own(state, 'name') !== 'string') throw new Error('缺少面板状态包或状态名称。');
            text(own(state, 'name'), 500); list(own(state, 'widgets'));
          }
          if (widget.fitToContent) for (const stateId of stateIds) for (const member of list(own(stateDiagrams.get(stateId)!, 'widgets'))) {
            const child = record(member), childFlags = record(own(child, 'storedFlags')), childStyle = record(own(child, 'styleRecovery'));
            if (own(record(own(childStyle, 'boundsRecovery')), 'outerShadowAbsent') !== true || own(childFlags, 'AutoFitWidth') === true || own(childFlags, 'AutoFitHeight') === true) throw new Error('适应内容的子元件含未知阴影或自动文字尺寸，边界尚不可靠。');
          }
          const nextAncestors = new Set([...ancestors, packageId]);
          const previousTargets = new Set(widgetTargets.keys()), previousSelections = new Set(selectionTargets), previousErrors = new Set(errorTargets), previousUsed = new Set(usedStates);
          const previousCounts = { panelStatesImported: report.panelStatesImported, nestedWidgetsImported: report.nestedWidgetsImported, nestedWidgetsSkipped: report.nestedWidgetsSkipped };
          for (const stateId of stateIds) usedStates.add(stateId);
          widget.states = stateIds.map(stateId => {
            const state = stateDiagrams.get(stateId)!;
            return { id: `rp-s-${stateId}`, name: text(own(state, 'name'), 500), widgets: convertMembers(state, stateId, depth + 1, nextAncestors, true) };
          });
          if (widget.fitToContent && widget.states.some((state, index) => state.widgets.length !== list(own(stateDiagrams.get(stateIds[index])!, 'widgets')).length)) {
            for (const key of widgetTargets.keys()) if (!previousTargets.has(key)) widgetTargets.delete(key);
            for (const key of selectionTargets) if (!previousSelections.has(key)) selectionTargets.delete(key);
            for (const key of errorTargets) if (!previousErrors.has(key)) errorTargets.delete(key);
            for (const key of usedStates) if (!previousUsed.has(key)) usedStates.delete(key);
            Object.assign(report, previousCounts);
            throw new Error('适应内容面板的状态有未恢复子元件，不能用残缺内容计算尺寸。');
          }
          widget.activeStateId = widget.states[0].id;
          if (widget.fitToContent) {
            const bounds = (item: Widget): [number,number] => {
              if (item.type !== 'panel' || !item.fitToContent) return [item.width,item.height];
              const state = item.states?.find(state=>state.id===item.activeStateId) ?? item.states?.[0];
              let right=0,bottom=0;
              for (const child of state?.widgets ?? []) if (!child.hidden && child.placed !== false) {
                const [width,height]=bounds(child);
                // Native childrenBoundingRect uses the center-rotated AABB.
                // Preserve zero-angle arithmetic and its existing exact values.
                const angle=child.rotation*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
                right=Math.max(right,child.rotation===0?child.x+width:child.x+width/2+(width*cos+height*sin)/2);
                bottom=Math.max(bottom,child.rotation===0?child.y+height:child.y+height/2+(width*sin+height*cos)/2);
              }
              return [right,bottom];
            };
            const [width,height] = bounds(widget);
            // Authored rectangles stay positive; runtime supports native empty
            // fit states at 0x0. The editor starts with the recovered first state.
            widget.width = Math.max(1,width); widget.height = Math.max(1,height);
          }
          report.panelStatesImported += widget.states.length;
          issue('panel-state-order', '按保存的状态引用顺序恢复内容，初始展示首个状态；交互恢复结果单独列出。', 'warning', packageId, sourceId);
          if (widget.fitToContent) issue('panel-fit-recovery', '预览和离线导出按当前状态可见子元件的 right/bottom 边界计算尺寸；支持状态切换、显隐及移动后重算。阴影、自动文字尺寸及残缺内容未猜测。', 'warning', packageId, sourceId);
        }
        if(adaptiveMaps.size)pendingAdaptive.set(widget,{packageId,sourceId,maps:adaptiveMaps});
        widgets.push(widget); widgetTargets.set(`${packageId}:${sourceId}`, widget); if (nested) report.nestedWidgetsImported++; else report.widgetsImported++;
        if(rotation!==0)issue('center-rotation-recovery','已按原生 P50 恢复围绕保存矩形中心的顺时针旋转；位置、尺寸和存储路径保持原值。一般变换、非中心原点和旋转状态覆盖未扩展。','warning',packageId,sourceId,own(item,'rotationRecovery'));
        if (vectorPath) issue('vector-path-recovery', '已保留存储路径的归一化节点、直线及三次曲线，采用原生 SVG 分支的非零填充规则。编辑、缩放、保存和导出继续使用该路径。原版非自定义矢量还会按形状、尺寸和样式重新生成；本次保留存储快照，描边位移、端帽/箭头、连接、渐变及最终布局尚未逐像素复现。', 'warning', packageId, sourceId, candidate);
        if (textStatus === 'stored-empty-rich-text') issue('omitted-empty-shape-text', '原生图形省略了空富文本字段；按已核对的构造、序列化与读取规则恢复为空文本。', 'warning', packageId, sourceId, storedText);
        if (type === 'textarea' && widgetText !== own(storedText, 'text')) issue('textarea-line-endings', '多行文本框的 CRLF/CR 已按原型浏览器 value 规则规范为 LF。', 'warning', packageId, sourceId, storedText);
        if (selectionSupported) selectionTargets.add(widget.id);
        if (errorKnown) errorTargets.add(widget.id);
        if (own(flags, 'AutoFitWidth') === true || own(flags, 'AutoFitHeight') === true) issue('stored-autofit-snapshot', widget.shapeText ? '已保留自动文字尺寸标志和原矩形，普通形状使用独立文字层排版。原生运行时 AutoFit 改变元件尺寸的行为尚未实现。' : '已冻结明确保存的矩形；源对象启用自动文字尺寸，导入后不重算字体度量或自动尺寸。', 'warning', packageId, sourceId, { AutoFitWidth: own(flags, 'AutoFitWidth'), AutoFitHeight: own(flags, 'AutoFitHeight') });
        if (styleRecovery !== undefined) issue('partial-style-recovery', '已恢复可识别样式；未映射属性及来源保留在报告 details，选中状态独立保存，交互恢复结果单独列出。', 'warning', packageId, sourceId, own(item, 'styleRecovery'));
        else issue('widget-default-appearance', '仅恢复本地存储矩形和纯文本；外观、继承样式未恢复，交互恢复结果单独列出。', 'warning', packageId, sourceId);
      } catch (error) {
        if (error instanceof ImportBudgetError) throw error;
        if (nested) report.nestedWidgetsSkipped++; else report.widgetsSkipped++;
        issue('widget-skipped', error instanceof Error ? error.message : '元件无法可靠转换。', 'skipped', packageId, sourceId);
      }
    }
    if(!layerItems.size)return widgets;
    const flatIds=members.map(value=>id(own(record(value),'id'))), flatSet=new Set(flatIds), parentIds=new Map<string,string[]>();
    for(const value of members){
      const item=record(value), recovery=own(item,'layerRecovery');
      if(own(item,'type')!=='Axure:DiagramObject:Layer'||!recovery||typeof recovery!=='object')continue;
      let refs=own(recovery as Data,'childIds');
      if(own(recovery as Data,'status')==='unsupported-layer-membership')try{
        const proof=record(own(recovery as Data,'membershipReferences'));exactFields(proof,['childIds','diagramId','sourcePartSha256','packageVersion']);
        if(own(proof,'diagramId')!==own(diagram,'diagramId')||own(proof,'sourcePartSha256')!==own(diagram,'sourcePartSha256')||JSON.stringify(own(proof,'packageVersion'))!=='[11,0,0,0]')throw Error();
        const children=list(own(proof,'childIds')).map(id);if(new Set(children).size!==children.length||children.some(child=>!flatSet.has(child)||child===own(item,'id')))throw Error();refs=children;
      }catch{refs=undefined;}
      if(Array.isArray(refs))for(const child of refs)if(typeof child==='string'&&/^[a-f0-9]{32}$/.test(child))parentIds.set(child,[...(parentIds.get(child)??[]),id(own(item,'id'))]);
    }
    const assembled=new Map<string,Widget>(),failed=new Set<string>(),claimed=new Set<string>(),visiting=new Set<string>();
    const existing=new Map(widgets.map(w=>[w.id.slice(-32),w]));
    const assemble=(sourceId:string,level:number):Widget|undefined=>{
      if(assembled.has(sourceId))return assembled.get(sourceId);
      if(failed.has(sourceId))return undefined;
      const item=layerItems.get(sourceId);if(!item)return existing.get(sourceId);
      try{
        if(level+depth>DOCUMENT_LIMITS.depth||visiting.has(sourceId))throw new Error('组层级循环或超过上限。');
        visiting.add(sourceId);
        if(nativeOccurrences.get(`${packageId}:${sourceId}`)!==1||flatSet.size!==flatIds.length)throw new Error('组或图中元件身份不唯一。');
        const recovery=record(own(item,'layerRecovery')),source=record(own(recovery,'source')),geometry=record(own(item,'storedGeometry')),flags=record(own(item,'storedFlags'));
        exactFields(recovery,['status','childIds','propagate','localProperties','source']);
        exactFields(source,['sourceType','field','coordinateSpace','diagramId','parentLayerId','packageVersion','sourcePartSha256','styleId']);
        if(own(recovery,'status')!=='supported-layer-membership'||own(source,'sourceType')!=='Axure:DiagramObject:Layer'||own(source,'field')!=='DiagramObjects'||own(source,'coordinateSpace')!=='diagram'||own(source,'diagramId')!==own(diagram,'diagramId')||own(source,'sourcePartSha256')!==own(diagram,'sourcePartSha256')||!/^[a-f0-9]{64}$/.test(String(own(source,'sourcePartSha256')))||JSON.stringify(own(source,'packageVersion'))!=='[11,0,0,0]'||id(own(source,'styleId'))!==own(geometry,'styleId'))throw new Error('组成员来源、版本或坐标范围未验证。');
        const parents=parentIds.get(sourceId)??[];
        if(parents.length>1||own(source,'parentLayerId')!==(parents[0]??null))throw new Error('组父级不完整或有歧义。');
        for(const key of ['VisibleFromSettings','Disabled','Selected','Error','IsLocked'])boolean(own(flags,key));
        if(own(flags,'IsContained')!==false||own(geometry,'isComputedLayout')!==false||own(geometry,'size')!==null||own(geometry,'adaptiveStyleCount')!==0||['rotation','transform','transformOrigin'].some(key=>own(geometry,key)!==null)||own(geometry,'placement')!==undefined)throw new Error('组包含未验证的容器、变换、放置或尺寸字段。');
        const props=list(own(recovery,'localProperties'),6),keys=new Set<number>(),authorPins:Partial<WidgetStyle>={};let visible=true;
        for(const value of props){
          const prop=record(value);exactFields(prop,['key','rawDoaName','value']);const key=number(own(prop,'key'),0,0xffff),raw=number(own(prop,'rawDoaName'),-2147483648,2147483647),v=own(prop,'value');
          if(!Number.isInteger(raw)||raw!==(key|0xc0000000)||keys.has(key)||![101,106,107,108,109,110].includes(key))throw new Error('组本地属性或覆盖标记未验证。');keys.add(key);
          if(key===101){const pairs=list(own(record(v),'$map'),2);if(pairs.length!==2)throw new Error('组保存位置无效。');const point=Object.fromEntries(pairs.map(p=>{const a=list(p,2);if(a.length!==2||!['X','Y'].includes(String(a[0])))throw new Error('组保存位置无效。');return [String(a[0]),number(a[1])];}));if(Object.keys(point).length!==2)throw new Error('组保存位置重复。');}
          else if([106,107,108,109].includes(key))Object.assign(authorPins,importNativeAuthorPin(key,v));
          else {boolean(v);if(key===110)visible=v as boolean;}
        }
        const children=list(own(recovery,'childIds')).map(id);
        if(new Set(children).size!==children.length)throw new Error('组成员重复。');
        const descendants:string[]=[sourceId],childWidgets:Widget[]=[];
        const flatten=(w:Widget):string[]=>[w.id.slice(-32),...(w.layer?w.layer.widgets.flatMap(flatten):[])];
        for(const childId of children){
          if(!flatSet.has(childId)||parentIds.get(childId)?.length!==1||parentIds.get(childId)?.[0]!==sourceId)throw new Error('组成员缺失、跨图或有多个父级。');
          const child=assemble(childId,level+1);if(!child)throw new Error(`组成员 ${childId} 未完整导入；保留可恢复的原成员。`);
          childWidgets.push(child);descendants.push(...flatten(child));
        }
        const index=flatIds.indexOf(sourceId);
        if(descendants.some((value,i)=>flatIds[index+i]!==value))throw new Error('组顺序不等于原图连续前序，不能改变绘制顺序。');
        const label=own(item,'label');if(label!==null&&typeof label!=='string')throw new Error('组名称无效。');
        const bounds=layerAuthoringBounds(childWidgets);number(bounds.x);number(bounds.y);number(bounds.width,0);number(bounds.height,0);
        const widget:Widget={id:`rp-w-${packageId}-${sourceId}`,type:'layer',name:typeof label==='string'&&label?text(label,500):`layer ${sourceId.slice(0,8)}`,text:'',...bounds,rotation:0,style:{...defaultStyle(),fill:'transparent',strokeWidth:0,...authorPins},hidden:own(flags,'VisibleFromSettings')===false||!visible,disabled:own(flags,'Disabled')===true,locked:own(flags,'IsLocked')===true,selected:own(flags,'Selected')===true,error:own(flags,'Error')===true,interactions:[],notes:`Experimental RP Layer import\nSource package: ${packageId}\nSource object: ${sourceId}\nChildren retain diagram coordinates; the group frame is derived from complete member owner rectangles.`,layer:{widgets:childWidgets,propagate:boolean(own(recovery,'propagate'))}};
        assembled.set(sourceId,widget);widgetTargets.set(`${packageId}:${sourceId}`,widget);selectionTargets.add(widget.id);errorTargets.add(widget.id);
        for(const child of children)claimed.add(child);
        if(nested)report.nestedWidgetsImported++;else{report.widgetsImported+=1-children.length;report.nestedWidgetsImported+=children.length;}
        issue('layer-membership-recovery','已恢复完整有序组；成员保持原图坐标、独立身份和交互。组框按原编辑器成员矩形推导，未把保存位置当作成员偏移。','warning',packageId,sourceId,recovery);
        if(Object.keys(authorPins).length)issue('layer-authoring-pins-recovered','已按独立属性保留原生组固定边与固定尺寸约束。','warning',packageId,sourceId,props);
        return widget;
      }catch(error){failed.add(sourceId);if(nested)report.nestedWidgetsSkipped++;else report.widgetsSkipped++;issue('widget-skipped',error instanceof Error?error.message:'组无法完整恢复。','skipped',packageId,sourceId);return undefined;}
      finally{visiting.delete(sourceId);}
    };
    for(const sourceId of layerItems.keys())assemble(sourceId,0);
    return flatIds.filter(sourceId=>!claimed.has(sourceId)).flatMap(sourceId=>{const widget=assembled.get(sourceId)??existing.get(sourceId);return widget?[widget]:[];});
  }
  for (const value of diagrams) {
    const diagram = record(value);
    if (own(diagram, 'rootType') !== 'Axure:Page') continue;
    if (pages.length >= DOCUMENT_LIMITS.pages) throw new Error('RP 页面数量超过导入上限。');
    const packageId = id(own(diagram, 'packageId'));
    if (seenPages.has(packageId)) throw new Error('RP 恢复结果有重复页面标识。');
    seenPages.add(packageId);
    const sourceName = own(diagram, 'name');
    if (typeof sourceName !== 'string' || sourceName.length > 500) { issue('page-name-missing', '页面没有明确名称，已跳过。', 'skipped', packageId); continue; }
    const widgets = convertMembers(diagram, packageId, 0, new Set(), false);
    pages.push({ id: `rp-p-${packageId}`, name: sourceName, width: 1200, height: 900, background: '#ffffff', widgets, interactions: [], adaptiveViews: [], notes: 'Experimental RP import: source package ' + packageId + '. Page size and background were not recovered.' });
  }
  if (stateDiagrams.size > usedStates.size) issue('non-page-diagrams-omitted', `${stateDiagrams.size - usedStates.size} 个面板状态图未能关联至可导入面板，未转为独立页面，其内部成员未计入顶层元件统计。`);
  if (!pages.length) throw new Error('没有可可靠恢复名称和标识的页面。');
  report.pagesImported = pages.length;
  if (!report.widgetsImported) issue('no-supported-widgets', '本次仅恢复了页面；所有顶层元件均因未知类型或布局而跳过。');
  const document: Document = { format: 'rea-prototype', version: 1, id: `rp-doc-${hash.slice(0, 32)}`, name: text(name, 500), pages, components: [], variables: {}, styles: [] };
  // Organization is an independent atomic recovery: a broken sitemap must not
  // discard supported page geometry or change GUID-based interaction targets.
  try {
    const value = own(source, 'pageTreeRecovery');
    if (value === undefined) throw new Error('旧版恢复数据不含页面树；保留页面包顺序和平面列表。');
    const tree = record(value);
    if (own(tree, 'status') !== 'supported-page-tree') throw new Error(typeof own(tree, 'reason') === 'string' ? text(own(tree, 'reason'), 2000) : '源页面树未可靠恢复。');
    id(own(tree, 'rootId')); id(own(tree, 'treeId'));
    if (!/^[a-f0-9]{64}$/.test(text(own(tree, 'sourcePartSha256'), 64))) throw new Error('页面树来源摘要无效。');
    const nodes = list(own(tree, 'nodes'), DOCUMENT_LIMITS.pages + DOCUMENT_LIMITS.pageFolders);
    const availablePages = new Map(pages.map(page => [page.id.slice(5), page]));
    const nodeIds = new Map<string, string>(), usedPages = new Set<string>(), usedFolders = new Set<string>();
    const nextPages: Page[] = [], folders: PageFolder[] = [], order: string[] = [];
    for (const value of nodes) {
      const node = record(value), nodeId = id(own(node, 'nodeId')), sourceParent = own(node, 'parentNodeId');
      if (nodeIds.has(nodeId)) throw new Error('页面树节点标识重复。');
      let parentId: string | undefined;
      if (sourceParent !== null) {
        parentId = nodeIds.get(id(sourceParent));
        if (!parentId) throw new Error('页面树父节点缺失、循环或不在前序位置。');
      }
      const kind = own(node, 'kind'), name = text(own(node, 'name'), 500);
      let mappedId: string;
      if (kind === 'page') {
        const packageId = id(own(node, 'packageId')), page = availablePages.get(packageId);
        if (!page || usedPages.has(packageId) || page.name !== name || own(node, 'folderId') !== undefined) throw new Error('页面树页面引用、名称或唯一性不一致。');
        usedPages.add(packageId); mappedId = page.id;
        nextPages.push({ ...page, ...(parentId === undefined ? {} : { parentId }) });
      } else if (kind === 'folder') {
        const folderId = id(own(node, 'folderId'));
        if (usedFolders.has(folderId) || folders.length >= DOCUMENT_LIMITS.pageFolders || own(node, 'packageId') !== undefined) throw new Error('页面树文件夹标识重复、载体不一致或超过上限。');
        usedFolders.add(folderId); mappedId = `rp-f-${folderId}`;
        folders.push({ id: mappedId, name, ...(parentId === undefined ? {} : { parentId }) });
      } else throw new Error('页面树含未知节点类型。');
      nodeIds.set(nodeId, mappedId); order.push(mappedId);
    }
    if (usedPages.size !== pages.length) throw new Error('页面树没有完整覆盖已导入页面。');
    const candidate = normalizePageTree({ ...document, pages: nextPages, pageFolders: folders, pageOrder: order });
    if (candidate.pageOrder!.some((value, index) => value !== order[index])) throw new Error('页面树节点顺序不是规范前序，不能猜测源树。');
    pages.splice(0, pages.length, ...candidate.pages);
    document.pageFolders = candidate.pageFolders; document.pageOrder = candidate.pageOrder;
    issue('page-tree-recovered', `已恢复源页面树：${pages.length} 个页面、${folders.length} 个文件夹及其父子关系和顺序。`, 'warning', undefined, undefined, { sourcePartSha256: own(tree, 'sourcePartSha256'), pages: pages.length, folders: folders.length });
  } catch (error) { issue('page-tree-omitted', `页面层级和顺序未恢复，保留平面页面列表：${error instanceof Error ? error.message : '页面树无效。'}`); }
  const adaptive = importAdaptiveSets(own(source,'adaptiveRecovery'), diagrams, (code,message,packageId,sourceId,details)=>issue(code,message,'warning',packageId,sourceId,details));
  if(adaptive.sets.length)document.adaptiveViewSets=adaptive.sets;
  for(const page of pages){const packageId=page.id.slice(5),assignment=adaptive.assignments.get(packageId);if(assignment?.set){page.adaptiveViewSetId=assignment.set.model.id;issue('adaptive-page-canvas-fallback','原生 Base 尺寸只用于视图选择；页面画布尺寸未恢复，继续采用明确的 1200×900 编辑画布回退，未用它替换源阈值。','warning',packageId,assignment.sourceId,{baseSize:assignment.set.model.baseSize,canvas:{width:1200,height:900}});}}
  const variableNames = new Map<string, string>();
  let motionVariablesKnown = false;
  const settingsValue = own(source, 'documentSettingsRecovery');
  if (settingsValue !== undefined) {
    const settings = record(settingsValue);
    try {
      const recovery = record(own(settings, 'variables'));
      if (own(recovery, 'status') !== 'supported') throw new Error(typeof own(recovery, 'reason') === 'string' ? text(own(recovery, 'reason'), 2000) : '变量集合未恢复');
      const ids = new Set<string>(), names = new Map<string, string>();
      const entries = list(own(recovery, 'variables'), 1000).map(value => {
        const item = record(value), nativeId = id(own(item, 'id')), key = identifier(own(item, 'name')), content = text(own(item, 'value'));
        if (ids.has(nativeId) || names.has(key.toLowerCase())) throw new Error('重复的变量标识或名称。');
        ids.add(nativeId); names.set(key.toLowerCase(), key); return [key, content];
      });
      document.variables = Object.fromEntries(entries);
      for (const [key, value] of names) variableNames.set(key, value);
      report.variablesImported = entries.length;
      motionVariablesKnown = true;
    } catch (error) { issue('variables-omitted', error instanceof Error ? error.message : '变量集合未恢复。'); }
    try {
      const recovery = record(own(settings, 'caseSelection'));
      if (own(recovery, 'status') !== 'supported' || own(recovery, 'sourceValue') !== 'DisplayMultipleTargetsOnly' || own(recovery, 'value') !== 'auto') throw new Error('默认 HTML 配置的 Case Behavior 尚未可靠恢复。');
      document.caseSelection = 'auto';
    } catch (error) { issue('case-behavior-omitted', error instanceof Error ? error.message : 'Case Behavior 未恢复。'); }
  } else issue('document-settings-omitted', '旧版恢复数据不含变量和 Case Behavior；保留本产品旧项目的自动执行模式。');

  const pageTargets = new Map(pages.map(page => [page.id.slice(5), page]));
  // Selection has implicit peer targets. Audit the complete source page tree,
  // including rejected panels/states, before accepting any group-dependent event.
  const blockedSelections = new Map<string, string>();
  const sourceDiagrams = new Map(diagrams.map(value => { const d = record(value); return [own(d, 'packageId'), d]; }));
  const packageScopes = new Map<string, string>();
  const ambiguousAdaptiveScopes = new Set<string>(), adaptiveScopeChildren = new Map<string,Set<string>>();
  const uncertainScopes = new Set<string>();
  const scopeMembers = new Map<string, Set<Widget>>();
  for (const pageId of pageTargets.keys()) {
    const pending = [pageId], visited = new Set<string>();
    const members = new Set<Widget>(); scopeMembers.set(pageId, members);
    const groups = new Map<string, { members: Set<Widget>; incomplete: boolean }>();
    while (pending.length) {
      const packageId = pending.pop()!;
      if (visited.has(packageId)) { uncertainScopes.add(pageId); ambiguousAdaptiveScopes.add(packageId); continue; }
      visited.add(packageId);
      const previous = packageScopes.get(packageId);
      if (previous && previous !== pageId) { uncertainScopes.add(previous); uncertainScopes.add(pageId); ambiguousAdaptiveScopes.add(packageId); }
      packageScopes.set(packageId, pageId);
      const diagram = sourceDiagrams.get(packageId);
      if (!diagram) { uncertainScopes.add(pageId); continue; }
      for (const value of sourceMembers(list(own(diagram, 'widgets')))) {
        const item = record(value), key = `${packageId}:${own(item, 'id')}`, target = widgetTargets.get(key);
        if (target) members.add(target);
        try {
          const identity = record(own(item, 'selectionGroups'));
          if (own(identity, 'status') !== 'known-selection-groups') throw new Error('Unknown selection membership');
          for (const field of ['selectionGroup', 'radioGroup'] as const) {
            if (field === 'radioGroup' && own(item, 'type') !== 'Axure:DiagramObject:RadioButton') continue;
            const name = text(own(identity, field), 256);
            if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('Invalid selection membership');
            if (!name) continue;
            const groupKey = JSON.stringify([field, name]);
            const group = groups.get(groupKey) ?? { members: new Set<Widget>(), incomplete: false };
            if (target) group.members.add(target);
            if (!target || ambiguousTargets.has(key) || !selectionTargets.has(target.id) || target[field] !== name) group.incomplete = true;
            groups.set(groupKey, group);
          }
          if (target && (target.selectionGroup !== (own(identity, 'selectionGroup') || undefined) || target.radioGroup !== (own(identity, 'radioGroup') || undefined))) {
            blockedSelections.set(target.id, '源选中组身份与恢复的分组不一致。');
          }
        } catch { uncertainScopes.add(pageId); }
        if (own(item, 'type') === 'Axure:DiagramObject:DynamicPanel' || own(item, 'panelStatePackages') != null) {
          try {
            if (own(item, 'panelStatePackagesError') !== undefined) throw new Error('Unknown panel descendants');
            const refs = list(own(item, 'panelStatePackages'), 200);
            if (!refs.length) throw new Error('Missing panel descendants');
            for (const value of refs) {
              const ref = record(value), stateId = id(own(ref, '$reference'));
              if (own(ref, 'referenceTag') !== 19 || own(ref, 'name') !== 'Axure:PanelState' || !stateDiagrams.has(stateId)) throw new Error('Unknown panel descendant');
              const children=adaptiveScopeChildren.get(packageId)??new Set<string>();children.add(stateId);adaptiveScopeChildren.set(packageId,children);
              pending.push(stateId);
            }
          } catch { uncertainScopes.add(pageId); }
        }
      }
    }
    for (const group of groups.values()) if (group.incomplete) for (const target of group.members) blockedSelections.set(target.id, '选中组包含未导入或状态样式未恢复的成员；相关事件整项跳过。');
  }
  // Adaptive actions require an unambiguous Page, independently of selection
  // group recovery. Ambiguous panel ownership also poisons its descendant scopes.
  const ambiguousPending=[...ambiguousAdaptiveScopes];while(ambiguousPending.length){for(const child of adaptiveScopeChildren.get(ambiguousPending.pop()!)??[])if(!ambiguousAdaptiveScopes.has(child)){ambiguousAdaptiveScopes.add(child);ambiguousPending.push(child);}}
  for (const pageId of uncertainScopes) for (const target of scopeMembers.get(pageId) ?? []) {
    if (target.selectionGroup || target.radioGroup) blockedSelections.set(target.id, '页面或面板状态中存在未知分组身份，无法确认选中组完整性。');
  }
  const requireSelection = (target: Widget) => {
    if (!selectionTargets.has(target.id)) throw new Error('选择事件或动作的状态、样式未恢复。');
    const reason = blockedSelections.get(target.id); if (reason) throw new Error(reason);
    if(target.layer)for(const child of target.layer.widgets)requireSelection(child);
  };
  const requireError = (target: Widget, recursive = false, seen = new Set<string>()) => {
    if (!errorTargets.has(target.id) || seen.has(target.id)) throw new Error('错误状态事件或动作的目标标志未恢复或容器循环。');
    seen.add(target.id);
    if(recursive&&target.layer)for(const child of target.layer.widgets)requireError(child,true,seen);
    if (recursive && target.type === 'panel') {
      if (!target.states?.length) throw new Error('错误状态传播目标没有完整面板状态。');
      for (const state of target.states) {
        const stateId = state.id.slice('rp-s-'.length), source = stateDiagrams.get(stateId);
        if (!source || list(own(source,'widgets')).length !== state.widgets.length) throw new Error('错误状态传播包含未导入子元件，整个事件跳过。');
        for (const value of list(own(source,'widgets'))) {
          const sourceId = id(own(record(value),'id')), key = `${stateId}:${sourceId}`, child = widgetTargets.get(key);
          if (!child || !state.widgets.includes(child) || ambiguousTargets.has(key)) throw new Error('错误状态传播子元件引用不完整。');
          requireError(child,true,seen);
        }
      }
    }
  };
  const events = new Map<number, EventType>([[16, 'click'], [17, 'doubleClick'], [18, 'mouseEnter'], [20, 'mouseLeave'], [48, 'focus'], [49, 'blur'], [50, 'change'], [51, 'change'], [52, 'selectedChange'], [53, 'select'], [54, 'unselect'], [55,'errorSet'], [56,'errorRemoved'], [279,'rotate'], [288, 'load'], [289, 'itemLoad'], [320, 'load'], [338,'adaptiveViewChange']]);
  const rotatableNativeWidget = (widget: Widget) => ['box','ellipse','path','text','line','image','hotspot','panel','layer'].includes(widget.type);
  // Native local paths do not establish row/contained geometry by themselves.
  // A model text/box label inside these compounds is not an ordinary source
  // VectorShape target. PanelState packages keep their own local scope instead.
  const motionContained = new Set<string>();
  const markMotionScope = (items:Widget[],contained=false):void => {for(const w of items){
    if(contained)motionContained.add(w.id);
    if(w.layer)markMotionScope(w.layer.widgets,contained);
    for(const state of w.states??[])markMotionScope(state.widgets,contained);
    if(w.repeater)markMotionScope(w.repeater.template,true);
    if(w.table)markMotionScope(w.table.cells,true);
    if(w.menu){markMotionScope([w.menu.table],true);markMotionScope(w.menu.submenus,true);}
    if(w.tree)markMotionScope(w.tree.nodes,true);
    if(w.treeNode){markMotionScope([w.treeNode.label],true);markMotionScope(w.treeNode.children,true);}
  }};
  for(const page of pages)markMotionScope(page.widgets);
  function convertInteractions(recoveryValue: unknown, packageId: string, sourceId: string | undefined, target: Widget | Page | undefined, atomicLink = false) {
    if (recoveryValue === undefined) return;
    const scopeKey = `${packageId}-${sourceId ?? 'page'}`;
    const widget = (value: unknown) => {
      const nativeId = id(value), found = widgetTargets.get(`${packageId}:${nativeId}`);
      if (!found || ambiguousTargets.has(`${packageId}:${nativeId}`)) throw new Error(`交互目标元件 ${nativeId} 未导入或有歧义；不会跨包猜测同名 ID。`);
      return found;
    };
    try {
      const recovery = record(recoveryValue);
      if (own(recovery, 'status') !== 'decoded-interaction-tree') throw new Error(typeof own(recovery, 'reason') === 'string' ? text(own(recovery, 'reason'), 2000) : '交互树未可靠恢复');
      const sourceEvents = list(own(recovery, 'events'), 100), nativeTypes = new Set<unknown>();
      for (const value of sourceEvents) {
        const event = record(value), nativeType = own(event, 'nativeEventType');
        if (nativeTypes.has(nativeType)) throw new Error('重复事件类型，无法确认 IF/ELSE 边界。');
        nativeTypes.add(nativeType);
      }
      for (const [eventIndex, value] of sourceEvents.entries()) {
        try {
          const event = record(value);
          if (own(event, 'status') !== 'supported-event') throw new Error(typeof own(event, 'reason') === 'string' ? text(own(event, 'reason'), 2000) : '不支持的原生事件');
          if (!target) throw new Error('事件所属页面、元件或面板状态未导入。');
          if (document.caseSelection !== 'auto') throw new Error('Case Behavior 未恢复，无法保证事件执行或菜单选择方式。');
          id(own(event, 'id'));
          const nativeType = number(own(event, 'nativeEventType'), 0, 100000), eventType = events.get(nativeType);
          if (!eventType || eventType !== own(event, 'event')) throw new Error('事件类型映射不一致。');
          if(atomicLink&&nativeType!==16)throw new Error('链接只支持已验证的点击事件。');
          if ('widgets' in target) { if (![320,338].includes(nativeType)||sourceDiagrams.get(packageId)?.rootType!=='Axure:Page'||sourceId!==undefined) throw new Error('此页面事件尚不支持。'); }
          else {
            if (nativeType === 320 || nativeType === 338 || (eventType === 'itemLoad' && target.type !== 'repeater')) throw new Error('事件载体不匹配。');
            if ((eventType === 'focus' || eventType === 'blur') && !['input', 'textarea', 'select', 'checkbox', 'radio'].includes(target.type)) throw new Error('当前元件不支持原生焦点事件。');
            if (eventType === 'change' && !((nativeType === 50 && ['input', 'textarea'].includes(target.type)) || (nativeType === 51 && target.type === 'select'))) throw new Error('值改变事件载体不匹配。');
            if (['selectedChange','select','unselect'].includes(eventType)) requireSelection(target);
            if (eventType==='errorSet' || eventType==='errorRemoved') requireError(target);
            if (eventType==='rotate' && !rotatableNativeWidget(target)) throw new Error('原生旋转事件载体不匹配。');
          }
          const sourceCases = list(own(event, 'cases'), 100), seenCases = new Set<string>();
          if (target.interactions.length + sourceCases.length > 100) throw new Error('恢复的 Case 数量超过上限。');
          const converted = sourceCases.map((value, caseIndex): Interaction => {
            const item = record(value), nativeId = id(own(item, 'id'));
            if (seenCases.has(nativeId)) throw new Error('重复的 Case 标识。'); seenCases.add(nativeId);
            const caseId = `rp-i-${scopeKey}-${eventIndex}-${caseIndex}`;
            const mode = own(item, 'conditionMode'); if (mode !== 'all' && mode !== 'any') throw new Error('不支持的条件组合。');
            const conditions = list(own(item, 'conditions'), 100).map((value): Condition => {
              const condition = record(value), operator = own(condition, 'operator');
              if (operator !== 'equals' && operator !== 'notEquals') throw new Error('此条件比较尚未验证。');
              if (own(condition, 'comparisonMode') !== 'axure') throw new Error('条件缺少已确认的原生比较方式。');
              const source = own(condition, 'source'), content = literal(own(condition, 'value'));
              if (source === 'widgetText' || source === 'selectedOption') {
                const target = widget(own(condition, 'targetSourceId'));
                // Native GetWidgetText aggregates descendant text for panels and
                // other div targets. Our generic widget.text is not equivalent.
                if (source === 'selectedOption' ? target.type !== 'select' : !['input', 'textarea', 'select'].includes(target.type) || target.type === 'select' && target.multiple) throw new Error('条件文本载体不匹配；多选列表的原生 GetWidgetText 数组比较尚未支持。');
                return { source, key: target.id, operator, value: content, comparisonMode: 'axure' };
              }
              if (source === 'variable') {
                const key = variableNames.get(identifier(own(condition, 'key')).toLowerCase());
                if (!key) throw new Error('条件变量未恢复。');
                return { source, key, operator, value: content, comparisonMode: 'axure' };
              }
              throw new Error('未知条件来源。');
            });
            const actions = list(own(item, 'actions'), DOCUMENT_LIMITS.actions).map((value, actionIndex): Action => {
              const action = record(value), type = own(action, 'type'), actionId = `rp-a-${scopeKey}-${eventIndex}-${caseIndex}-${actionIndex}`;
              id(own(action, 'sourceId'));
              if(type==='move'||type==='resize'){
                exactFields(action,['sourceId','type',type]);
                if(atomicLink||!packageScopes.has(packageId)||ambiguousAdaptiveScopes.has(packageId))throw new Error('原生移动或尺寸动作的页面/父级作用域未完整恢复。');
                const spec=record(own(action,type));exactFields(spec,['targets']);
                const ordinary=(w:Widget,resize=false):Widget=>{
                  const allowed=resize?['box','ellipse','path','text','image','panel']:['box','ellipse','path','text','line','image','panel','layer'];
                  if(!allowed.includes(w.type)||motionContained.has(w.id))throw new Error('原生移动或尺寸目标类型、行或容器坐标作用域尚未验证。');
                  return w;
                };
                const sourceWidget=():Widget=>{if(!sourceId||'widgets' in target)throw new Error('原生 This 必须引用已导入的普通元件。');return ordinary(widget(sourceId));};
                const readExpression=(value:unknown):MotionExpression=>{
                  const raw=record(value);exactFields(raw,['text'],['bindings']);const content=text(own(raw,'text'),4100),bindingNames=new Set<string>();
                  let mappedBindings:MotionExpression['bindings'];
                  if(own(raw,'bindings')!==undefined){const rawBindings=record(own(raw,'bindings'));if(Object.keys(rawBindings).length>128)throw new Error('原生动作局部变量超过安全上限。');mappedBindings={};
                    for(const [name,value]of Object.entries(rawBindings)){
                      if(!/^[a-z][a-z0-9_]*$/.test(name)||name.length>128||['this','target','window','dragx','dragy','constructor','prototype','__proto__'].includes(name))throw new Error('原生动作局部变量身份不明确。');
                      if(!motionVariablesKnown||variableNames.has(name))throw new Error('原生动作局部变量与全局变量冲突或全局集合未知。');
                      const b=record(value);exactFields(b,['kind','targetSourceId']);if(own(b,'kind')!=='widget')throw new Error('原生动作局部变量不是已验证的 GetWidget 绑定。');
                      mappedBindings[name]={kind:'widget',targetId:ordinary(widget(own(b,'targetSourceId'))).id};bindingNames.add(name);
                    }
                  }
                  validateNativeMotionText(content,bindingNames,name=>{
                    if(!motionVariablesKnown||variableNames.has(name))throw new Error('原生动作表达式变量存在全局冲突或未知作用域。');
                    if(name==='this')sourceWidget();
                    if(name==='dragx'||name==='dragy')throw new Error('原生拖动表达式所需的事件上下文尚未恢复。');
                  });
                  return parseMotionExpression({text:content,...(mappedBindings?{bindings:mappedBindings}:{})});
                };
                const boundarySeen=new Set<object>();
                const readBoundary=(value:unknown,depth=0):MotionBoundary=>{
                  if(depth>16||boundarySeen.size>=127)throw new Error('原生移动边界超过安全上限。');const b=record(value);if(boundarySeen.has(b))throw new Error('原生移动边界重复或循环。');boundarySeen.add(b);
                  const kind=own(b,'kind');if(kind==='and'||kind==='or'){exactFields(b,['kind','left','right']);return{kind,left:readBoundary(own(b,'left'),depth+1),right:readBoundary(own(b,'right'),depth+1)};}
                  exactFields(b,['kind','operator','direction','left','right']);const operator=own(b,'operator'),direction=own(b,'direction');
                  if(kind!=='compare'||typeof operator!=='string'||!['>','<','>=','<='].includes(operator)||typeof direction!=='string'||!['left','right','top','bottom'].includes(direction))throw new Error('原生移动边界比较尚未验证。');
                  return{kind,operator:operator as '>'|'<'|'>='|'<=',direction:direction as 'left'|'right'|'top'|'bottom',left:readExpression(own(b,'left')),right:readExpression(own(b,'right'))};
                };
                const targets=list(own(spec,'targets'),200).map(value=>{
                  const entry=record(value);exactFields(entry,type==='move'?['target','mode','x','y','trajectory','easing','duration']:['target','width','height','anchor','easing','duration'],type==='move'?['boundary']:[]);
                  const rawTarget=record(own(entry,'target')),kind=own(rawTarget,'kind');let mappedTarget:{kind:'widget';id:string}|{kind:'this'};
                  if(kind==='widget'){exactFields(rawTarget,['kind','sourceId']);mappedTarget={kind,id:ordinary(widget(own(rawTarget,'sourceId')),type==='resize').id};}
                  else if(kind==='this'){exactFields(rawTarget,['kind']);ordinary(sourceWidget(),type==='resize');mappedTarget={kind};}
                  else throw new Error('原生动作特殊目标或行选择器尚未恢复。');
                  const common={target:mappedTarget,easing:own(entry,'easing'),duration:own(entry,'duration')};
                  if(type==='resize')return{...common,width:readExpression(own(entry,'width')),height:readExpression(own(entry,'height')),anchor:own(entry,'anchor')};
                  const mode=own(entry,'mode');if(mode!=='location'&&mode!=='delta')throw new Error('原生移动模式依赖尚未恢复的拖动或尺寸事件上下文。');
                  return{...common,mode,x:readExpression(own(entry,'x')),y:readExpression(own(entry,'y')),trajectory:own(entry,'trajectory'),...(own(entry,'boundary')!==undefined?{boundary:readBoundary(own(entry,'boundary'))}:{})};
                });
                return type==='move'?{id:actionId,type,move:parseMoveActionSpec({targets})}:{id:actionId,type,resize:parseResizeActionSpec({targets})};
              }
              if(type==='rotate'){
                if(Object.keys(action).length!==4||Object.keys(action).some(k=>!['sourceId','type','targetSourceId','rotate'].includes(k)))throw new Error('原生旋转动作含未知字段或缺少完整参数。');
                const target=widget(own(action,'targetSourceId'));if(!rotatableNativeWidget(target))throw new Error('原生旋转目标类型尚未验证。');
                const spec=record(own(action,'rotate'));
                if(Object.keys(spec).length!==8||Object.keys(spec).some(k=>!['mode','degrees','clockwise','anchor','offsetX','offsetY','easing','duration'].includes(k)))throw new Error('原生旋转参数不完整。');
                const mode=own(spec,'mode'),anchor=own(spec,'anchor'),easing=own(spec,'easing');
                if(mode!=='by'&&mode!=='to')throw new Error('原生旋转模式无效。');
                if(!ROTATION_ANCHORS.includes(anchor as typeof ROTATION_ANCHORS[number])||!ROTATION_EASINGS.includes(easing as typeof ROTATION_EASINGS[number]))throw new Error('原生旋转锚点或缓动无效。');
                const numeric=(key:string)=>{const value=literal(own(spec,key));if(!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*$/.test(value)||!Number.isFinite(Number(value)))throw new Error('原生旋转表达式尚未恢复。');return value;};
                return {id:actionId,type,targetId:target.id,rotate:{mode,degrees:numeric('degrees'),clockwise:boolean(own(spec,'clockwise')),anchor:anchor as typeof ROTATION_ANCHORS[number],offsetX:numeric('offsetX'),offsetY:numeric('offsetY'),easing:easing as typeof ROTATION_EASINGS[number],duration:number(own(spec,'duration'),0,60000)}};
              }
              if(type==='setAdaptiveView'){
                if(Object.keys(action).length!==3||Object.keys(action).some(k=>!['sourceId','type','adaptiveView'].includes(k)))throw new Error('自适应动作恢复字段不完整或含未知字段。');
                const pagePackageId=packageScopes.get(packageId);if(!pagePackageId||ambiguousAdaptiveScopes.has(packageId))throw new Error('自适应动作所属页面缺失或面板归属有歧义。');
                return {id:actionId,type,adaptiveView:adaptive.target(pagePackageId,own(action,'adaptiveView'))};
              }
              if(type==='openUrl'){
                if(Object.keys(action).some(k=>!['sourceId','type','value','windowTarget'].includes(k)))throw new Error('外部链接含未知参数。');
                const windowTarget=own(action,'windowTarget');if(windowTarget!=='current'&&windowTarget!=='new')throw new Error('外部链接窗口类型无效。');
                return {id:actionId,type,value:parseExternalUrl(own(action,'value')),windowTarget};
              }
              if (type === 'openPage') {
                const page = pageTargets.get(id(own(action, 'targetPackageId'))); if (!page) throw new Error('页面跳转目标未导入。');
                return { id: actionId, type, targetId: page.id };
              }
              if (type === 'show' || type === 'hide' || type === 'toggle') return { id: actionId, type, targetId: widget(own(action, 'targetSourceId')).id };
              if (type === 'setFocus') {
                if (Object.keys(action).some(key => !['sourceId', 'type', 'targetSourceId', 'selectText'].includes(key))) throw new Error('聚焦动作含未验证参数。');
                const target = widget(own(action, 'targetSourceId'));
                if (!['input', 'textarea', 'select'].includes(target.type)) throw new Error('原生聚焦目标仅验证了文本和列表输入控件。');
                return { id: actionId, type, targetId: target.id, selectText: boolean(own(action, 'selectText')) };
              }
              if (type === 'setSelected') {
                const target = widget(own(action, 'targetSourceId')), value = own(action, 'value');
                requireSelection(target);
                if (['panel','repeater'].includes(target.type) || typeof value !== 'string' || !['true','false','toggle'].includes(value)) throw new Error('选中动作目标、状态样式或赋值尚未可靠恢复。');
                return { id: actionId, type, targetId: target.id, value };
              }
              if (type === 'setError') {
                const target = widget(own(action,'targetSourceId')), value = own(action,'value');
                requireError(target,true);
                if (typeof value !== 'string' || !['true','false','toggle'].includes(value)) throw new Error('原生错误状态赋值尚未可靠恢复。');
                return {id:actionId,type,targetId:target.id,value};
              }
              if (type === 'setState') {
                const panel = widget(own(action, 'targetSourceId')), stateId = `rp-s-${id(own(action, 'targetPackageId'))}`;
                if (panel.type !== 'panel' || !panel.states?.some(state => state.id === stateId)) throw new Error('面板状态目标未导入或不属于目标面板。');
                return { id: actionId, type, targetId: panel.id, value: stateId };
              }
              throw new Error(`动作 ${String(type)} 尚未完成原生语义映射。`);
            });
            return { id: caseId, name: text(own(item, 'name'), 500), event: eventType, enabled: boolean(own(item, 'enabled')), isNewIfGroup: boolean(own(item, 'isNewIfGroup')), conditionMode: mode, conditions, actions };
          });
          // Commit after every case/action/target has passed: never change an IF/ELSE
          // chain by retaining the supported fragments of a rejected event.
          target.interactions.push(...converted);
          if(!atomicLink){report.eventsImported++;report.casesImported += converted.length; report.actionsImported += converted.reduce((n, item) => n + item.actions.length, 0);}
        } catch (error) { if(atomicLink)throw error;report.eventsSkipped++; issue('interaction-event-skipped', error instanceof Error ? error.message : '事件未恢复。', 'skipped', packageId, sourceId, { eventIndex }); }
      }
    } catch (error) { if(atomicLink)throw error;report.interactionTreesSkipped++; issue('interaction-tree-skipped', error instanceof Error ? error.message : '交互树未恢复。', 'skipped', packageId, sourceId); }
  }
  // Links keep their entire owner atomic. Resolve all admitted targets first,
  // then repeat if removal invalidates another link or a fit-to-content parent.
  const rejectedLinks=new Set<string>(),prunedWidgets=new Set<string>(),discardedLayerTrees=new Set<string>(),convertedLinks=new Map<string,NonNullable<Widget['richText']>>();
  const discardOwned=(widget:Widget):void=>{
    rejectedLinks.add(widget.id);
    if(widget.layer){discardedLayerTrees.add(widget.id);for(const child of widget.layer.widgets)discardOwned(child);}
  };
  const prune=(items:Widget[],nested=false):Widget[]=>items.flatMap(widget=>{
    if(prunedWidgets.has(widget.id))return [];
    if(widget.layer){const old=widget.layer.widgets.map(w=>w.id);widget.layer.widgets=prune(widget.layer.widgets,true);if(old.length!==widget.layer.widgets.length||old.some((id,i)=>widget.layer!.widgets[i]?.id!==id))rejectedLinks.add(widget.id);}
    if(widget.states){for(const state of widget.states){const old=state.widgets.length;state.widgets=prune(state.widgets,true);if(widget.fitToContent&&state.widgets.length!==old)rejectedLinks.add(widget.id);}}
    if(widget.table){const old=widget.table.cells.length;widget.table.cells=prune(widget.table.cells,true);if(widget.table.cells.length!==old)rejectedLinks.add(widget.id);}
    if(widget.menu){const tables=prune([widget.menu.table],true);if(tables.length)widget.menu.table=tables[0];else rejectedLinks.add(widget.id);}
    if(widget.tree){const old=widget.tree.nodes.length;widget.tree.nodes=prune(widget.tree.nodes,true);if(widget.tree.nodes.length!==old)rejectedLinks.add(widget.id);}
    if(widget.treeNode){const labels=prune([widget.treeNode.label],true);if(labels.length)widget.treeNode.label=labels[0];else rejectedLinks.add(widget.id);const old=widget.treeNode.children.length;widget.treeNode.children=prune(widget.treeNode.children,true);if(widget.treeNode.children.length!==old)rejectedLinks.add(widget.id);}
    if(!rejectedLinks.has(widget.id))return [widget];
    if(widget.menu){rejectedLinks.add(widget.menu.table.id);prune([widget.menu.table],true);}
    if(widget.table){for(const cell of widget.table.cells)rejectedLinks.add(cell.id);widget.table.cells=prune(widget.table.cells,true);}
    if(widget.tree){for(const node of widget.tree.nodes)rejectedLinks.add(node.id);widget.tree.nodes=prune(widget.tree.nodes,true);}
    if(widget.treeNode){rejectedLinks.add(widget.treeNode.label.id);prune([widget.treeNode.label],true);for(const node of widget.treeNode.children)rejectedLinks.add(node.id);widget.treeNode.children=prune(widget.treeNode.children,true);}
    for(const state of widget.states??[])for(const child of state.widgets)discardOwned(child);
    for(const state of widget.states??[])state.widgets=prune(state.widgets,true);
    if(widget.states)report.panelStatesImported-=widget.states.length;
    for(const [key,target]of widgetTargets)if(target===widget){widgetTargets.delete(key);selectionTargets.delete(target.id);errorTargets.delete(target.id);
      const [packageId,sourceId]=key.split(':');
      report.issues=report.issues.filter(i=>i.packageId!==packageId||i.sourceId!==sourceId||!['rich-text-recovery','partial-style-recovery','vector-path-recovery'].includes(i.code));
      if(widget.type==='panel')issue('widget-skipped','富文本链接目标不完整导致子元件被省略，适应内容面板不能使用残缺子树。','skipped',packageId,sourceId);
      if(widget.type==='table')issue('widget-skipped','富文本链接目标不完整导致单元格被省略，整个表格矩阵省略。','skipped',packageId,sourceId);
      if(widget.type==='menu')issue('widget-skipped','内部表格或单元格的链接依赖未完整恢复，整个菜单省略。','skipped',packageId,sourceId);
      if(widget.type==='tree'||widget.type==='treeNode')issue('widget-skipped','树节点或标签的链接依赖未完整恢复，整个树子图省略。','skipped',packageId,sourceId);
      if(widget.type==='layer')issue('widget-skipped','组成员的后续依赖未完整恢复，省略组包装并保留其可恢复成员。','skipped',packageId,sourceId);
      for(const peer of scopeMembers.get(packageScopes.get(packageId)??'')??[])if(widget.selectionGroup&&peer.selectionGroup===widget.selectionGroup||widget.radioGroup&&peer.radioGroup===widget.radioGroup)blockedSelections.set(peer.id,'选中组中的链接载体未完整导入。');
    }
    if(nested){report.nestedWidgetsImported--;report.nestedWidgetsSkipped++;}else{report.widgetsImported--;report.widgetsSkipped++;}
    prunedWidgets.add(widget.id);
    if(widget.layer&&!discardedLayerTrees.has(widget.id)){
      if(!nested){report.nestedWidgetsImported-=widget.layer.widgets.length;report.widgetsImported+=widget.layer.widgets.length;}
      return widget.layer.widgets;
    }
    return [];
  });
  for(const [widget,pending]of pendingAdaptive)if(!packageScopes.has(pending.packageId)||ambiguousAdaptiveScopes.has(pending.packageId)){
    rejectedLinks.add(widget.id);issue('widget-skipped','局部自适应声明的所属页面无法唯一确定，整个元件省略。','skipped',pending.packageId,pending.sourceId);
  }
  if(rejectedLinks.size)for(const page of pages)page.widgets=prune(page.widgets);
  let removed=true;
  while(removed){removed=false;convertedLinks.clear();
    for(const [key,pending]of pendingRichLinks){
      const owner=widgetTargets.get(key);if(!owner?.richText?.links)continue;
      try{
        if(ambiguousTargets.has(key))throw new Error('链接所属元件标识有歧义。');
        const rich=structuredClone(owner.richText),ids=new Map<string,string>();
        for(const [i,link]of rich.links!.entries()){
          const nativeId=id(link.id),scoped=`${pending.packageId}-${pending.sourceId}-${nativeId}`,temporary:Widget={...owner,interactions:[]};
          convertInteractions(own(pending.sources[i],'interactionRecovery'),pending.packageId,`${pending.sourceId}-${nativeId}`,temporary,true);
          ids.set(nativeId,`rp-l-${scoped}`);link.id=ids.get(nativeId)!;link.interactions=temporary.interactions;
        }
        for(const p of rich.paragraphs)for(const r of p.runs)if(r.linkId)r.linkId=ids.get(r.linkId)!;
        convertedLinks.set(key,parseRichText(rich));
      }catch(error){removed=true;rejectedLinks.add(owner.id);issue('widget-skipped',`富文本链接未完整恢复，整个文字元件省略：${error instanceof Error?error.message:'未知目标'}`,'skipped',pending.packageId,pending.sourceId);}
    }
    if(removed)for(const page of pages)page.widgets=prune(page.widgets);
  }
  for(const [key,rich]of convertedLinks){
    const owner=widgetTargets.get(key)!;owner.richText=rich;const pending=pendingRichLinks.get(key)!;
    for(const source of pending.sources){const recovery=record(own(source,'interactionRecovery'));report.eventsImported+=list(own(recovery,'events'),100).length;}
    for(const link of rich.links??[]){report.casesImported+=link.interactions.length;report.actionsImported+=link.interactions.reduce((n,c)=>n+c.actions.length,0);}
    issue('rich-text-links-recovery','已保留独立超链接身份、完整点击条件动作及命名交互样式；目标在完整导入后按原包作用域解析。','warning',pending.packageId,pending.sourceId,{linkCount:rich.links!.length,sources:pending.sources});
  }
  // All geometry must be known before any cross-widget or cross-page reference is mapped.
  for (const value of diagrams) {
    const diagram = record(value), packageId = id(own(diagram, 'packageId'));
    if (!['Axure:Page', 'Axure:PanelState'].includes(String(own(diagram, 'rootType')))) continue;
    convertInteractions(own(diagram, 'interactionRecovery'), packageId, undefined, pageTargets.get(packageId));
    for (const value of sourceMembers(list(own(diagram, 'widgets')))) {
      const item = record(value), recovery = own(item, 'interactionRecovery'); if (recovery === undefined) continue;
      const sourceId = typeof own(item, 'id') === 'string' ? text(own(item, 'id'), 32) : undefined;
      convertInteractions(recovery, packageId, sourceId, ambiguousTargets.has(`${packageId}:${sourceId}`) ? undefined : widgetTargets.get(`${packageId}:${sourceId}`));
    }
  }
  // Traverse the final admitted graph, not the earlier target index: a rejected
  // parent or linked dependency must not leave orphan override identities.
  for(const page of pages){
    const visit=(widgets:Widget[])=>{for(const widget of widgets){
      const pending=pendingAdaptive.get(widget);
      if(pending){for(const [viewId,patch]of pending.maps){page.adaptiveOverrides??={};page.adaptiveOverrides[viewId]??={};page.adaptiveOverrides[viewId][widget.id]=patch;}
        issue('adaptive-local-declarations','已保留严格验证的局部声明；未知视图标识保持为非活动覆盖，不补造视图。','warning',pending.packageId,pending.sourceId,{viewIds:[...pending.maps.keys()]});}
      if(widget.layer)visit(widget.layer.widgets);for(const state of widget.states??[])visit(state.widgets);if(widget.repeater)visit(widget.repeater.template);if(widget.table)visit(widget.table.cells);if(widget.menu){visit([widget.menu.table]);visit(widget.menu.submenus);}if(widget.tree)visit(widget.tree.nodes);if(widget.treeNode){visit([widget.treeNode.label]);visit(widget.treeNode.children);}
    }};visit(page.widgets);
  }
  return { document, report };
}
