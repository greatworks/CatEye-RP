import { createElement, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type PointerEvent, type MouseEvent } from 'react';
import type { Widget, RuntimeState, GradientFill } from '../model/types';
import { getRuntimeWidget, resolveText } from '../runtime/engine';
import { getSelectedOptionIndices, resolveSelectedStyle, resolveInteractionStylePatch } from '../model/document';
import { vectorPathData } from '../model/vector';
import { browserBoxReader, type BorderWidths } from '../runtime/browser-box';
import { Image as ImageIcon } from 'lucide-react';
import { applyRichTextStyle, projectTextStyleOverride, textDecorationLine, mapRichTextMatches, resolveRichText } from '../model/rich-text';
import { RichTextContent, explicitTextBreaks, type RichLinkHandlers } from './RichTextContent';
import { InlineFrameThumbnail } from './FrameTargetEditor';
import { layoutTree } from '../model/tree-widget';
import { createShadowRenderer } from '../model/shadow';
import { createGradientRenderer } from '../model/gradient';
import { createLineStyleRenderer } from '../model/line-style';
import { createShapeTextRenderer } from '../model/shape-text';
import { createSelectionTextLayout } from '../runtime/selection-text-layout';
import { createSelectionDisplay } from '../runtime/selection-display';
import { createSelectionIndicatorRenderer, type SelectionIndicatorPaint } from '../model/selection-indicator';
const shapeText = createShapeTextRenderer();
const selectionDisplay = createSelectionDisplay(createSelectionTextLayout(shapeText), createSelectionIndicatorRenderer());
const shadows = createShadowRenderer();
const lines = createLineStyleRenderer();
const gradients = createGradientRenderer(lines);

/** External SVG images cannot inherit CSS currentColor from their host. */
export function applyGradientContext(element: HTMLElement, widget: Widget): void {
  if (!widget.vectorPath && (gradients.supports(widget.type)||gradients.supportsStroke(widget.type)) && gradients.needsComputedColor(widget.style)) {
    const css=getComputedStyle(element),width=parseFloat(css.width),height=parseFloat(css.height);
    element.style.backgroundImage = gradients.backgrounds(widget.style,widget.type, Number.isFinite(width)?width:widget.width, Number.isFinite(height)?height:widget.height, css.color);
  }
}

function GradientContextPaint({ widget }: { widget: Widget }) {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => { const parent = marker.current?.parentElement; if (parent) applyGradientContext(parent, widget); });
  return <span ref={marker} hidden aria-hidden="true" data-gradient-context=""/>;
}

function staticRepeaterRows(widget: Widget): { rows: Record<string, string>[]; error?: string } {
  const data = widget.repeater!, rows = data.rows;
  if (!data.pagination) return { rows };
  const count = rows.length, size = data.pagination.itemsPerPage;
  let page = data.pagination.startPage, end = size * page, start = end - size;
  if (start >= count) { page = Math.floor((count - 1) / size) + 1; if (page <= 0) page = 1; end = size * page; start = end - size; }
  end = Math.min(end, count);
  const visible: typeof rows = [];
  for (let index = start; index < end; index++) {
    if (!Number.isInteger(index) || index < 0 || !rows[index]) return { rows: [], error: `Pagination requires a whole row index (${index}). Adjust page size or starting page.` };
    visible.push(rows[index]);
  }
  return { rows: visible };
}

/** Initial authoring geometry only: no lifecycle actions or fit-to-content execution. */
export function getStaticRepeaterLayout(widget: Widget) {
  const data = widget.repeater;
  if (!data || !['layout', 'itemWidth', 'wrap', 'horizontalGap', 'verticalGap', 'fitToContent', 'padding'].some(field => Object.hasOwn(data, field))) return undefined;
  const visible = staticRepeaterRows(widget), count = visible.rows.length;
  const width = data.itemWidth ?? widget.width, height = data.itemHeight;
  const gapX = data.horizontalGap ?? data.gap, gapY = data.verticalGap ?? data.gap;
  const vertical = data.layout !== 'horizontal', wrap = data.wrap ?? Math.max(1, count);
  const groups = Math.ceil(count / wrap), alongCount = Math.min(count, wrap);
  const along = alongCount ? alongCount * (vertical ? height : width) + (alongCount - 1) * (vertical ? gapY : gapX) : -(vertical ? gapY : gapX);
  const cross = groups ? groups * (vertical ? width : height) + (groups - 1) * (vertical ? gapX : gapY) : data.wrap === undefined ? vertical ? width : height : -(vertical ? gapX : gapY);
  const [top, right, bottom, left] = data.padding ?? [0, 0, 0, 0];
  const [borderTop, , , borderLeft] = browserBoxReader(0, 0, widget.style.borderWidths ?? Array(4).fill(widget.style.strokeWidth) as BorderWidths).borders;
  return { width: Math.max(0, left + right + (vertical ? cross : along)), height: Math.max(0, top + bottom + (vertical ? along : cross)), error: visible.error,
    rows: visible.rows.map((row, index) => ({ data: row, width, height,
      x: left - borderLeft + (vertical ? Math.floor(index / wrap) * (width + gapX) : index % wrap * (width + gapX)),
      y: top - borderTop + (vertical ? index % wrap * (height + gapY) : Math.floor(index / wrap) * (height + gapY)),
    })),
  };
}

export function widgetStyle(widget: Widget, resolved = false, paintSize?: {width:number;height:number}): CSSProperties {
  const w = resolved ? widget : { ...widget, style: resolveSelectedStyle(widget) };
  if (w.type === 'layer') return { position: 'absolute', left: w.x, top: w.y, width: Math.max(0, w.width), height: Math.max(0, w.height), overflow: 'visible', background: 'transparent', border: 0, transform: 'none', boxSizing: 'border-box' };
  const layout = !resolved ? getStaticRepeaterLayout(w) : undefined;
  const size=paintSize??(layout&&!layout.error?layout:undefined)??w;
  const gradient = gradients.supports(w.type) && !w.vectorPath && w.style.fillGradient;
  const selectionTextLayout = Boolean(w.selectionText && (w.type === 'checkbox' || w.type === 'radio')
    && w.style.textPadding !== undefined && w.style.verticalAlign !== undefined);
  return { display:shapeText.supports(w)?'flex':undefined, position: 'absolute', left:w.x, top:w.y, width:Math.max(0,size.width), height:Math.max(0,size.height), transform:`rotate(${w.rotation}deg)`,
    backgroundColor:w.vectorPath||gradient?'transparent':w.style.fill, backgroundImage:!w.vectorPath?gradients.backgrounds(w.style,w.type,size.width,size.height):'none', backgroundSize:'100% 100%', backgroundOrigin:'border-box', backgroundRepeat:'no-repeat', borderStyle:w.type==='image'?lines.pattern(w.style).css:'solid', borderColor:lines.paintedBorder(w.style,w.type)?'transparent':gradients.strokeColor(w.style,w.type), borderWidth:w.vectorPath||w.type==='line'?0:w.style.borderWidths?.map(value=>`${value}px`).join(' ')??w.style.strokeWidth, borderRadius:w.vectorPath?0:w.type==='ellipse'?'50%':(lines.supportsCorners(w)&&w.style.cornerVisibility?lines.cssRadii(w.style):lines.supportsSides(w)&&w.style.borderVisibility?.some(v=>!v)?lines.rectangle(w.style,size.width,size.height).radii:w.style.cornerRadii)?.map(radius=>`${radius}px`).join(' ')??w.style.radius,
    color:w.style.color, fontSize:w.style.fontSize, fontFamily:w.style.fontFamily, fontWeight:w.style.fontWeight, fontStyle:w.style.fontStyle??'normal',
    textAlign:w.style.textAlign, opacity:w.style.opacity, boxSizing:'border-box', boxShadow:shadows.css(w.style,shadows.mode(w.type,Boolean(w.vectorPath))).boxShadow, textShadow:'none', overflow:shapeText.supports(w)||selectionTextLayout||w.vectorPath||w.type==='line'||['menu','tree','treeNode'].includes(w.type)?'visible':'hidden' };
}
/** A value-controlled select collapses duplicate option identities; synchronize exact indices instead. */
function SelectControl({ widget, text, style, indices, onSelectOptions, onFocus, onBlur }: {
  widget: Widget; text: string; style: CSSProperties; indices?: readonly number[];
  onSelectOptions?: (indices: number[], element: HTMLSelectElement) => void; onFocus?: (event: React.FocusEvent<HTMLElement>) => void; onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
}) {
  const control = useRef<HTMLSelectElement>(null);
  const selection = indices ?? getSelectedOptionIndices(widget, text);
  useLayoutEffect(() => {
    const element = control.current; if (!element) return;
    const selected = new Set(selection);
    if (Array.from(element.options).every((option, index) => option.selected === selected.has(index))) return;
    // Clear the browser's implicit first choice before setting any exact option.
    element.selectedIndex = -1;
    for (const index of selection) if (element.options[index]) element.options[index].selected = true;
  });
  return <select ref={control} style={style} aria-label={widget.name} disabled={widget.disabled} multiple={widget.multiple ?? false} size={widget.selectMode === 'listbox' ? 2 : undefined}
    onChange={event => onSelectOptions?.(Array.from(event.currentTarget.selectedOptions, option => option.index),event.currentTarget)} onFocus={onFocus} onBlur={onBlur}>
    {(widget.options ?? []).map((option, index) => <option key={index} value={option}>{option}</option>)}
  </select>;
}

export interface TableAuthoringProps {
  onCellPointerDown: (cell: Widget, event: PointerEvent<HTMLDivElement>) => void;
  onCellDoubleClick: (cell: Widget, event: MouseEvent<HTMLDivElement>) => void;
  textEditor?: (cell: Widget) => ReactNode;
  resolveCell?: (cell: Widget) => Widget;
}
export interface MenuAuthoringProps {
  openMenuIds: readonly string[];
  onCellPointerDown: (menu: Widget, cell: Widget, event: PointerEvent<HTMLDivElement>) => void;
  onCellDoubleClick: (menu: Widget, cell: Widget, event: MouseEvent<HTMLDivElement>) => void;
  onEditSubmenu: (menu: Widget) => void;
  textEditor?: (cell: Widget) => ReactNode;
  resolveCell?: (cell: Widget) => Widget;
  controls?: (menu: Widget) => ReactNode;
}
export interface TreeAuthoringProps {
  revealedNodeIds: readonly string[];
  selectedNodeId?: string; selectedPart?: 'node' | 'label';
  onNodePointerDown: (node: Widget, part: 'node' | 'label', event: PointerEvent<HTMLDivElement>) => void;
  onLabelDoubleClick: (node: Widget, event: MouseEvent<HTMLDivElement>) => void;
  onToggle: (node: Widget, expanded: boolean) => void;
  textEditor?: (label: Widget) => ReactNode;
  resolveLabel?: (label: Widget) => Widget;
  controls?: ReactNode;
}

export function WidgetContent(props: Parameters<typeof WidgetContentBody>[0]): ReactNode {
  const widget=props.resolved?props.widget:{...props.widget,style:resolveSelectedStyle(props.widget)};
  return <>{!widget.vectorPath&&(gradients.supports(widget.type)||gradients.supportsStroke(widget.type))&&gradients.needsComputedColor(widget.style)&&<GradientContextPaint widget={widget}/>}<WidgetContentBody {...props}/></>;
}

function SelectionControl({source,current,paint,inputProps,textStyle,children,editing}:{source:Widget;current:Widget;paint?:SelectionIndicatorPaint|null;inputProps:React.ComponentProps<'input'>;textStyle:CSSProperties;children:ReactNode;editing:boolean}) {
  const id=useId(),label=useRef<HTMLLabelElement>(null),text=useRef<HTMLSpanElement>(null),input=useRef<HTMLInputElement>(null);
  useLayoutEffect(()=>{if(label.current&&text.current&&input.current)selectionDisplay.update(label.current,text.current,input.current,source,current,paint)});
  return <><label ref={label} htmlFor={editing?undefined:id} className="selection-control-label" onClick={event=>event.stopPropagation()}>
    <span ref={text} className="selection-text" style={textStyle}>{children}</span>
  </label><input {...inputProps} ref={input} id={id}/></>;
}

function WidgetContentBody({widget,selectionLayoutSource,selectionPaint,gradientBase,strokeGradientBase,gradientSession,textEditor,tableAuthoring,menuAuthoring,treeAuthoring,resolveChildDisplay,onLinkClick,onLinkPointer,linksDisabled,runtime,row,resolvedText,nativeTextSet=false,resolved=false,radioName,hintValue,initialValue,files,selectedIndices,onSelectOptions,onFiles,onHideHint,onTextCheck,onSubmit,onInput,onCheck,onFocus,onBlur}:{widget:Widget;selectionLayoutSource?:Widget;selectionPaint?:SelectionIndicatorPaint|null;gradientBase?:GradientFill;strokeGradientBase?:GradientFill;gradientSession?:unknown;textEditor?:ReactNode;tableAuthoring?:TableAuthoringProps;menuAuthoring?:MenuAuthoringProps;treeAuthoring?:TreeAuthoringProps;resolveChildDisplay?:(source:Widget)=>Widget;runtime?:RuntimeState;row?:Record<string,string>;resolvedText?:string;nativeTextSet?:boolean;resolved?:boolean;radioName?:string;hintValue?:string;initialValue?:string;files?:readonly File[];selectedIndices?:readonly number[];onSelectOptions?:(indices:number[],element:HTMLSelectElement)=>void;onFiles?:(files:readonly File[])=>void;onHideHint?:()=>boolean;onTextCheck?:(element:HTMLElement)=>void;onSubmit?:(element:HTMLElement)=>void;onInput?:(value:string,valid?:boolean)=>void;onCheck?:(checked:boolean,element:HTMLElement)=>void;onFocus?:(element:HTMLElement)=>void;onBlur?:(element:HTMLElement)=>void} & RichLinkHandlers) {
  const renderId=useId(), shadowId = shadows.filterId(renderId), gradientId=gradients.id(renderId+'/fill'), strokeGradientId=gradients.id(renderId+'/stroke');
  const checkActivation=useRef<{checked:boolean}|undefined>(undefined);
  const gradientPaint = useRef<{session:unknown;paint:ReturnType<typeof gradients.paintSession>;stroke:ReturnType<typeof gradients.paintSession>} | null>(null);
  if (!gradientPaint.current || gradientPaint.current.session!==gradientSession) gradientPaint.current={session:gradientSession,paint:gradients.paintSession(gradientBase),stroke:gradients.paintSession(strokeGradientBase)};
  const w = resolved ? widget : { ...widget, style: resolveSelectedStyle(widget) };
  const shadowCss = shadows.css(w.style,shadows.mode(w.type,Boolean(w.vectorPath)));
  const literal=runtime&&Object.hasOwn(runtime.widgetOverrides[w.id]??{},'text');
  let text=resolvedText??w.text;
  if(resolvedText===undefined&&runtime&&!literal&&!w.richText){try{text=resolveText(w.text,runtime,row)}catch(cause){text=`[${String(cause)}]`}}
  const projectRowText = (value: string) => value.replace(/\[\[Item\.([^\]]+)\]\]/g, (_, key) => row?.[key] ?? '');
  if (row && !runtime && resolvedText === undefined && !w.richText) text = projectRowText(w.text);
  let richText=w.richText;
  if(richText&&!resolved){
    richText=applyRichTextStyle(richText,projectTextStyleOverride(resolveInteractionStylePatch(widget))); 
    if(runtime&&!literal){try{richText=resolveRichText(richText,value=>resolveText(value,runtime,row))}catch(cause){text=`[${String(cause)}]`;richText=undefined}}
  }
  if (row && !runtime && richText && richText.expressionMode !== 'literal') richText = mapRichTextMatches(richText, /\[\[Item\.([^\]]+)\]\]/g, match => row[match[1]] ?? '');
  const nativeTextStyle = shapeText.css(w);
  const selectionTextLayout = Boolean(w.selectionText && (w.type === 'checkbox' || w.type === 'radio')
    && w.style.textPadding !== undefined && w.style.verticalAlign !== undefined);
  const nativeTextLayout = Boolean(nativeTextStyle) || selectionTextLayout;
  const plainText = nativeTextLayout ? explicitTextBreaks(text) : text;
  const displayedRichText = richText ?? (nativeTextSet ? { paragraphs: [{ runs: [{ text }] }] } : undefined);
  const textContent=textEditor??(displayedRichText?<RichTextContent richText={displayedRichText} baseStyle={widget.style} nativeLayout={nativeTextLayout} plainSetter={nativeTextSet} onLinkClick={onLinkClick} onLinkPointer={onLinkPointer} linksDisabled={linksDisabled}/>:w.style.underline||w.style.strikethrough?<span style={{textDecorationLine:textDecorationLine(w.style)}}>{plainText}</span>:plainText);
  const focusEvents = {
    onFocus: onFocus ? (event: React.FocusEvent<HTMLElement>) => { event.stopPropagation(); onFocus(event.currentTarget); } : undefined,
    onBlur: onBlur ? (event: React.FocusEvent<HTMLElement>) => { event.stopPropagation(); onBlur(event.currentTarget); } : undefined,
  };
  const paddingStyle: CSSProperties = { textShadow:shadowCss.textShadow, textDecorationLine:textDecorationLine(w.style), padding: w.style.textPadding?.map(value => `${value}px`).join(' ') };
  const customTextLayout = w.style.textPadding !== undefined || w.style.verticalAlign !== undefined;
  const textStyle: CSSProperties = nativeTextStyle ? { ...nativeTextStyle, textShadow:shadowCss.textShadow } : customTextLayout ? { textShadow:shadowCss.textShadow, padding:paddingStyle.padding, lineHeight: w.style.lineHeight, position: 'absolute', inset: 0, width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex',
    alignItems: (w.style.verticalAlign ?? (w.type === 'text' ? 'top' : 'middle')) === 'top' ? 'flex-start' : w.style.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: w.style.textAlign === 'left' ? 'flex-start' : w.style.textAlign === 'right' ? 'flex-end' : 'center' } : { textShadow:shadowCss.textShadow, lineHeight: w.style.lineHeight };
  if (nativeTextSet && text === '') textStyle.display = 'none';
  const renderLineArrows=(geometry:ReturnType<typeof lines.geometry>,fallback:string,border?:ReturnType<typeof gradients.svg>)=>!geometry.pattern.hidden&&w.style.strokeWidth>0&&geometry.arrows.map((arrow,index)=>{
    const paint=border&&!border.empty?gradients.inTransformedSpace(border,arrow.inverseTransform,`${border.attrs.id}-arrow-${index}`):undefined;
    const color=paint?`url(#${paint.attrs.id})`:fallback;
    return <g key={index} data-line-arrow={arrow.end} transform={arrow.transform}>
      {paint&&<defs>{createElement(paint.tag,paint.attrs,paint.stops.map((stop,i)=><stop key={i} offset={stop.offset} stopColor={stop.color}/>))}</defs>}
      {arrow.d&&<path d={arrow.d} fill={color} fillRule="evenodd"/>}{arrow.strokeD&&<path d={arrow.strokeD} fill="none" stroke={color} strokeWidth={arrow.strokeWidth} strokeLinecap="butt" strokeLinejoin="miter"/>}
    </g>;
  });
  if(w.type==='inlineFrame'&&w.inlineFrame)return runtime?null:<InlineFrameThumbnail widget={w}/>;
  if (w.vectorPath) {
    const primitives = shadows.inner(w.style), line = lines.geometry(w), rectangle=lines.vectorRectangle(w), d = rectangle?.fillD??vectorPathData(w.vectorPath,w.width,w.height), strokeD=rectangle?.strokeD??line.strokeD;
    const fillGradient=runtime?gradientPaint.current.paint(w.style.fillGradient):w.style.fillGradient;
    const gradient=fillGradient?gradients.svg(fillGradient,w.width,w.height,gradientId):undefined;
    const borderGradient=runtime?gradientPaint.current.stroke(w.style.strokeGradient):w.style.strokeGradient;
    const border=borderGradient?gradients.svg(borderGradient,w.width,w.height,strokeGradientId):undefined;
    const borderPaint=border?(border.empty?'none':`url(#${strokeGradientId})`):w.style.stroke;
    return <><svg className="widget-vector" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', filter:shadowCss.filter }}>
      {(primitives.length>0||gradient||border)&&<defs>{[gradient,border].map((paint,index)=>paint&&createElement(paint.tag,{key:index,...paint.attrs},paint.stops.map((stop,index)=><stop key={index} offset={stop.offset} stopColor={stop.color}/>)))}{primitives.length>0&&<filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">{primitives.map(({tag,attrs},index)=>createElement(tag,{key:index,...Object.fromEntries(Object.entries(attrs).map(([key,value])=>[key==='flood-color'?'floodColor':key,value]))}))}</filter>}</defs>}
      <path data-shadow-fill="" d={d} fill={gradient?(gradient.empty?'none':`url(#${gradientId})`):w.style.fill} fillRule={w.vectorPath.fillRule} stroke="none" strokeWidth={w.style.strokeWidth} vectorEffect="non-scaling-stroke" filter={primitives.length?`url(#${shadowId})`:undefined}/>
      {<path data-shadow-stroke="" data-line-shaft="" data-line-border={rectangle?"":undefined} d={strokeD} fill="none" stroke={borderPaint} strokeWidth={line.pattern.hidden?0:w.style.strokeWidth} strokeDasharray={line.pattern.dashArray||undefined} strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke"/>}
      {renderLineArrows(line,borderPaint,border)}
    </svg><span className="widget-text" style={nativeTextStyle ? textStyle : { ...textStyle, position: 'absolute', inset: 0, height: '100%', overflow: 'hidden', display: nativeTextSet && text === '' ? 'none' : 'flex', alignItems: (w.style.verticalAlign ?? 'middle') === 'top' ? 'flex-start' : w.style.verticalAlign === 'bottom' ? 'flex-end' : 'center', justifyContent: w.style.textAlign === 'left' ? 'flex-start' : w.style.textAlign === 'right' ? 'flex-end' : 'center' }}>{textContent}</span></>;
  }
  if (w.type==='input'||w.type==='textarea') {
    const file=w.type==='input'&&w.inputType==='file';
    const displayHint=file?undefined:runtime?hintValue:text===''?w.hintText:undefined;
    const clearHint=(element:HTMLInputElement|HTMLTextAreaElement)=>{
      if(w.hintHideOn!=='focus'&&onHideHint?.()){
        element.value='';if(element instanceof HTMLInputElement)element.type=w.inputType??'text';
      }
    };
    const caret=(element:HTMLInputElement|HTMLTextAreaElement)=>{if(displayHint!==undefined){try{element.setSelectionRange(0,0)}catch{/* Numeric inputs do not support selection ranges. */}}};
    const displayed=runtime&&resolved?text:displayHint??text;
    const props={style:paddingStyle,'aria-label':w.name,disabled:w.disabled||file&&!onInput,readOnly:!onInput||w.readOnly,maxLength:w.type==='input'?w.maxLength:undefined,
      ref:(element:HTMLInputElement|HTMLTextAreaElement|null)=>{if(element){
        element.onbeforeinput=()=>clearHint(element);
        if(file){
          if(text===''&&element.value!=='')element.value='';
          else if(text!==''&&element instanceof HTMLInputElement&&!element.files?.length&&files?.length){const transfer=new DataTransfer();for(const file of files)transfer.items.add(file);element.files=transfer.files}
        }else{
          if(!element.dataset.formInitialValue){
            element.defaultValue=initialValue??text;
            // defaultValue can also change the live DOM value without updating
            // React's value tracker. Synchronize once so the first real clear
            // is not mistaken for the initially tracked empty string.
            element.value=displayed;element.dataset.formInitialValue='1';
          }
          // Preserve an in-progress invalid numeric edit whose public value is
          // empty; writing an equal value would erase the browser's edit buffer.
          if(element.value!==displayed)element.value=displayed;
        }
      }},
      onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{if(file&&e.currentTarget instanceof HTMLInputElement)onFiles?.(Array.from(e.currentTarget.files??[]));onInput?.(e.currentTarget.value,e.currentTarget.validity.valid)},
      onKeyDown:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{clearHint(e.currentTarget);onTextCheck?.(e.currentTarget);if(w.submitButtonId&&e.key==='Enter')e.preventDefault()},
      onKeyUp:(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{onTextCheck?.(e.currentTarget);if(w.submitButtonId&&e.key==='Enter')onSubmit?.(e.currentTarget)},
      onPaste:(e:React.ClipboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>clearHint(e.currentTarget),
      onMouseUp:(e:React.MouseEvent<HTMLInputElement|HTMLTextAreaElement>)=>caret(e.currentTarget),
      onFocus:(e:React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>)=>{e.stopPropagation();onFocus?.(e.currentTarget);caret(e.currentTarget)},
      onBlur:(e:React.FocusEvent<HTMLInputElement|HTMLTextAreaElement>)=>{e.stopPropagation();onBlur?.(e.currentTarget)},
    };
    return w.type==='input'?<input key={file?'file':'value'} {...props} type={displayHint&&w.inputType==='password'?'text':w.inputType??'text'}/>:<textarea {...props}/>;
  }
  if (w.type==='checkbox'||w.type==='radio') {
    const inputProps:React.ComponentProps<'input'>={'aria-label':w.name,type:w.type,name:runtime&&w.type==='radio'?radioName:undefined,checked:Boolean(w.checked),disabled:w.disabled,
      onClickCapture:w.type==='checkbox'?event=>{const activation={checked:event.currentTarget.checked};checkActivation.current=activation;setTimeout(()=>{if(checkActivation.current===activation)checkActivation.current=undefined},0)}:undefined,
      onClick:w.type==='radio'&&onCheck?e=>onCheck(e.currentTarget.checked,e.currentTarget):undefined,
      onChange:e=>{const checked=checkActivation.current?.checked??e.target.checked;checkActivation.current=undefined;if(onCheck){if(w.type==='checkbox')onCheck(checked,e.currentTarget)}else onInput?.(String(checked))},...focusEvents};
    const selectionStyle:CSSProperties={textShadow:shadowCss.textShadow,...(selectionTextLayout?{
      display:nativeTextSet&&text===''?'none':'block',lineHeight:w.style.lineHeight??'normal',
      whiteSpace:w.selectionText!.autoFitWidth?'nowrap':'normal',overflowWrap:w.selectionText!.autoFitWidth?'normal':'break-word',
    }: {})};
    const source=selectionLayoutSource??widget;
    if(selectionDisplay.supports(source,selectionPaint??undefined))return <SelectionControl source={source} current={w} paint={selectionPaint} inputProps={inputProps} textStyle={selectionStyle} editing={Boolean(textEditor)}>{textContent}</SelectionControl>;
    return <label className="check-widget" onClickCapture={event=>{if(textEditor&&(event.target as HTMLElement).closest('[contenteditable]'))event.preventDefault()}}><input {...inputProps} style={selectionTextLayout?{flex:'none'}:undefined}/><span className={selectionTextLayout?'selection-text':undefined} style={selectionStyle}>{textContent}</span></label>;
  }
  if (w.type==='select') return <SelectControl widget={w} text={text} style={paddingStyle} indices={selectedIndices} onSelectOptions={onSelectOptions} {...focusEvents}/>;
  if (w.type==='image') return w.imageSrc?<img src={w.imageSrc} alt={w.name} draggable={false}/>:<div className="image-empty"><ImageIcon size={32}/><span>Image</span></div>;
  if (w.type==='placeholder') return <div className="placeholder-cross"><span style={{textShadow:shadowCss.textShadow}}>{textContent}</span></div>;
  if (w.type==='line') {
    const value=runtime?gradientPaint.current.stroke(w.style.strokeGradient):w.style.strokeGradient;
    const border=value?gradients.svg(value,w.width,w.height,strokeGradientId):undefined;
    const line=lines.geometry(w),paint=border?(border.empty?'none':`url(#${strokeGradientId})`):w.style.stroke;
    return <svg className="widget-line" width="100%" height="100%" preserveAspectRatio="none" style={{filter:shadowCss.filter,overflow:'visible',pointerEvents:'none'}}>{border&&<defs>{createElement(border.tag,border.attrs,border.stops.map((stop,index)=><stop key={index} offset={stop.offset} stopColor={stop.color}/>))}</defs>}{w.style.lineEnds&&(w.style.lineEnds.start!=='none'||w.style.lineEnds.end!=='none')?<path data-line-shaft="" d={line.strokeD} fill="none" stroke={paint} strokeWidth={line.pattern.hidden?0:w.style.strokeWidth} strokeDasharray={line.pattern.dashArray||undefined} strokeLinecap="butt" strokeLinejoin="miter"/>:<line data-line-shaft="" x1="0" y1="50%" x2="100%" y2="50%" stroke={paint} strokeWidth={line.pattern.hidden?0:w.style.strokeWidth} strokeDasharray={line.pattern.dashArray||undefined} strokeLinecap="butt"/>}{renderLineArrows(line,paint,border)}</svg>;
  }
  if (w.type==='hotspot') return <div className="hotspot-content"/>;
  if (w.type === 'tree' && w.tree) {
    const revealed = treeAuthoring?.revealedNodeIds ?? [];
    let source = w;
    if (revealed.length) {
      const expand = (nodes: Widget[]): Widget[] => nodes.map(node => ({ ...node, treeNode: { ...node.treeNode!, expanded: node.treeNode!.expanded || revealed.includes(node.id), children: expand(node.treeNode!.children) } }));
      source = layoutTree({ ...w, tree: { ...w.tree, nodes: expand(w.tree.nodes) } });
    }
    const renderNodes = (nodes: Widget[]): ReactNode => nodes.map(node => {
      const data = node.treeNode!, label = treeAuthoring?.resolveLabel?.(data.label) ?? resolveChildDisplay?.(data.label) ?? data.label;
      return <div key={node.id} className={'widget tree-author-node ' + (treeAuthoring?.selectedNodeId === node.id && treeAuthoring.selectedPart === 'node' ? 'is-current-node' : '')} data-tree-node-id={node.id} style={widgetStyle(node)} onPointerDown={treeAuthoring ? event => treeAuthoring.onNodePointerDown(node, 'node', event) : undefined}>
        {source.tree!.showExpandIcons && data.children.length > 0 && <button type="button" data-tree-toggle={node.id} className={'tree-expand-control ' + (source.tree!.iconStyle === 'plusMinus' ? 'plus-minus' : '')} aria-label={(data.expanded ? 'Collapse' : 'Expand') + ' node ' + node.name} aria-expanded={data.expanded} disabled={!treeAuthoring || w.locked || node.locked} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); treeAuthoring?.onToggle(node, !data.expanded); }}><span>{source.tree!.iconStyle === 'plusMinus' ? data.expanded ? '−' : '+' : <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path fill="currentColor" d={data.expanded?'M0 2 L8 2 L4 7 Z':'M2 0 L7 4 L2 8 Z'}/></svg>}</span></button>}
        {source.tree!.showIcons && data.iconSrc && <img className="tree-node-icon" src={data.iconSrc} alt="" style={{ left: Math.max(0, label.x - 18), top: Math.max(0, (node.height - 16) / 2), width: 16, height: 16 }}/>} 
        <div className={'widget tree-author-label ' + (treeAuthoring?.selectedNodeId === node.id && treeAuthoring.selectedPart === 'label' ? 'is-current-label' : '')} data-tree-label-id={label.id} style={widgetStyle(label, Boolean(treeAuthoring?.resolveLabel || resolveChildDisplay))} onPointerDown={treeAuthoring ? event => treeAuthoring.onNodePointerDown(node, 'label', event) : undefined} onDoubleClick={treeAuthoring ? event => treeAuthoring.onLabelDoubleClick(node, event) : undefined}>
          <WidgetContent widget={label} row={row} resolveChildDisplay={resolveChildDisplay} resolved={Boolean(treeAuthoring?.resolveLabel || resolveChildDisplay)} textEditor={treeAuthoring?.textEditor?.(data.label)}/>
        </div>
        {data.expanded && renderNodes(data.children)}
      </div>;
    });
    return <div className="tree-content" data-tree-widget-id={w.id}>{renderNodes(source.tree!.nodes)}{treeAuthoring?.controls}</div>;
  }
  if (w.type === 'menu' && w.menu) {
    const table = w.menu.table;
    return <div className="menu-content" data-menu-id={w.id}>
      <div className="widget menu-table" style={widgetStyle(table)}>{table.table!.cells.map(source => {
        const cell = menuAuthoring?.resolveCell?.(source) ?? resolveChildDisplay?.(source) ?? source, submenu = w.menu!.submenus.find(child => child.menu!.parentCellId === source.id);
        return <div key={cell.id} className="widget menu-author-item" data-menu-item-id={cell.id} aria-label={`Menu item ${cell.name}`} style={widgetStyle(cell, Boolean(menuAuthoring?.resolveCell || resolveChildDisplay))} onPointerDown={menuAuthoring ? event => menuAuthoring.onCellPointerDown(w, source, event) : undefined} onDoubleClick={menuAuthoring ? event => menuAuthoring.onCellDoubleClick(w, source, event) : undefined}>
          <WidgetContent widget={cell} row={row} resolveChildDisplay={resolveChildDisplay} resolved={Boolean(menuAuthoring?.resolveCell || resolveChildDisplay)} textEditor={menuAuthoring?.textEditor?.(source)}/>
          {submenu && menuAuthoring && <button className="menu-submenu-toggle" aria-label={`Edit submenu for ${source.name}`} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); menuAuthoring.onEditSubmenu(submenu); }}>{w.menu!.orientation === 'horizontal' ? '▼' : '▶'}</button>}
        </div>;
      })}</div>
      {w.menu.submenus.filter(child => menuAuthoring?.openMenuIds.includes(child.id)).map(child => <div key={child.id} className="widget menu" style={widgetStyle(child)}><WidgetContent widget={child} menuAuthoring={menuAuthoring} row={row} resolveChildDisplay={resolveChildDisplay}/></div>)}
      {menuAuthoring?.controls?.(w)}
    </div>;
  }
  if (w.type === 'table' && w.table) return <div className="table-content" role="grid" aria-label={w.name} style={{ position: 'absolute', inset: 0 }}>
    {w.table.cells.map((source, index) => {
      const cell = tableAuthoring?.resolveCell?.(source) ?? resolveChildDisplay?.(source) ?? (runtime ? getRuntimeWidget(source, runtime) : source);
      return <div key={cell.id} role="gridcell" aria-label={`Cell row ${Math.floor(index / w.table!.columnWidths.length) + 1} column ${index % w.table!.columnWidths.length + 1}`} data-table-cell-id={cell.id} className="widget table-cell" style={widgetStyle(cell, Boolean(tableAuthoring?.resolveCell || resolveChildDisplay))} onPointerDown={tableAuthoring ? event => tableAuthoring.onCellPointerDown(source, event) : undefined} onDoubleClick={tableAuthoring ? event => tableAuthoring.onCellDoubleClick(source, event) : undefined}>
        <WidgetContent widget={cell} resolveChildDisplay={resolveChildDisplay} resolved={Boolean(tableAuthoring?.resolveCell || resolveChildDisplay)} runtime={runtime} row={row} textEditor={tableAuthoring?.textEditor?.(source)}/>
      </div>;
    })}
  </div>;
  if (w.type==='layer' && w.layer) {
    return <div className="layer-contents" style={{ position: 'absolute', left: -w.x, top: -w.y, width: 0, height: 0, overflow: 'visible' }}>
      {w.layer.widgets.filter(child => child.placed !== false && (!runtime || !child.hidden)).map(child => {
        const projected = resolveChildDisplay?.(child) ?? (runtime ? getRuntimeWidget(child, runtime) : child);
        return <div key={child.id} data-layer-member-id={child.id} className={`widget ${child.type}${!runtime && child.hidden ? ' is-hidden' : ''}`} style={widgetStyle(projected,Boolean(resolveChildDisplay))}><WidgetContent widget={projected} resolved={Boolean(resolveChildDisplay)} resolveChildDisplay={resolveChildDisplay} runtime={runtime} row={row}/></div>;
      })}
    </div>;
  }
  if (w.type==='panel') {
    const state=w.states?.find(s=>s.id===w.activeStateId)??w.states?.[0];
    return <>{state?.widgets.map(child=>{const c=resolveChildDisplay?.(child)??(runtime?getRuntimeWidget(child,runtime):child);return c.placed===false||c.hidden&&runtime?null:<div key={c.id} style={widgetStyle(c,Boolean(resolveChildDisplay))} className="widget"><WidgetContent widget={c} resolved={Boolean(resolveChildDisplay)} resolveChildDisplay={resolveChildDisplay} runtime={runtime} row={row}/></div>})}</>;
  }
  if (w.type==='repeater'&&w.repeater) {
    let rows=runtime?.repeaterRows[w.id]??w.repeater.rows;
    const layout = !runtime ? getStaticRepeaterLayout(w) : undefined;
    if (!runtime) {
      const visible = staticRepeaterRows(w);
      if (visible.error) return <div role="alert">{visible.error}</div>;
      rows = visible.rows;
    }
    return <div>{rows.map((row,i)=>{const item=layout?.rows[i];return <div key={i} className="repeater-row" style={item?{position:'absolute',left:item.x,top:item.y,width:item.width,height:item.height,marginBottom:0,border:0,boxSizing:'border-box'}:{height:w.repeater!.itemHeight,marginBottom:w.repeater!.gap}}>{w.repeater!.template.length?w.repeater!.template.filter(child=>child.placed!==false).map(child=>{const c=resolveChildDisplay?.(child)??child;return <div key={c.id} style={widgetStyle(c,Boolean(resolveChildDisplay))} className="widget"><WidgetContent widget={c} resolved={Boolean(resolveChildDisplay)} resolveChildDisplay={resolveChildDisplay} runtime={runtime} row={row}/></div>}):w.repeater!.columns.map(col=><span key={col}>{row[col]}</span>)}</div>})}</div>;
  }
  return <span className="widget-text" style={textStyle}>{textContent}</span>;
}
