import { createInlineFrameHost, type InlineFrameHost } from '../runtime/inline-frame-runtime';
import { previewFrameOptions } from '../runtime/export';
import { browserBoxReader } from '../runtime/browser-box';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { X, RotateCcw, Monitor, Smartphone, Tablet, ChevronRight, List } from 'lucide-react';
import type { Document, Widget, EventType, CaseMenu, AdaptiveViewTarget } from '../model/types';
import { createRuntime } from '../runtime/engine';
import { mergeWidgetStyle } from '../model/document';
import { createShapeTextRenderer } from '../model/shape-text';
import { createShapeTextMeasurer } from '../runtime/shape-text-measure';
import { orderedTableCells } from '../model/table';
import { createOfflineRuntime, type OfflineRuntime, type RowContext, type RuntimeViewport } from '../runtime/export-runtime';
import { evaluateExpression } from '../runtime/expressions';
import { bindRuntimeDrag, type DragInputController } from '../runtime/drag-input';
import { WidgetContent, widgetStyle, applyGradientContext } from './WidgetView';
import { CaseMenus } from './CaseMenus';
import { PreviewPageTree } from './PageTree';
import { createPreviewNavigation } from '../runtime/navigation';
const shapeTextMeasurer=createShapeTextMeasurer(createShapeTextRenderer());
export function Preview({document:doc,pageId,onClose}:{document:Document;pageId:string;onClose:()=>void}) {
  const [runtime,setRuntime]=useState(()=>createRuntime(doc,pageId));
  const [device,setDevice]=useState(0);const [showPages,setShowPages]=useState(true);
  const viewportElement=useRef<HTMLDivElement|null>(null),deviceWidth=useRef(0);
  const api=useRef<OfflineRuntime|null>(null);
  const dragInput=useRef<DragInputController|null>(null);
  const frames=useRef<InlineFrameHost|null>(null);const frameElements=useRef(new Set<HTMLIFrameElement>());
  const widgetElements=useRef(new Map<string,HTMLDivElement>());
  const measuredWidgets=useRef(new Map<string,Widget>());
  const eventSources=useRef(new Map<string,HTMLElement>());
  const suppressControlFocus=useRef(false);
  const [revision,setRevision]=useState(0);const [error,setError]=useState('');
  const renderErrors:string[]=[];
  function report(promise:Promise<void>|undefined){void promise?.catch(e=>setError(String(e)))}
  const page=doc.pages.find(p=>p.id===runtime.pageId)??doc.pages[0];
  const declaredViews=page.adaptiveViewSetId?doc.adaptiveViewSets?.find(set=>set.id===page.adaptiveViewSetId)?.views??[]:page.adaptiveViews;
  const selectedViewId=api.current?.adaptiveViewId();
  const adaptiveViews=selectedViewId&&!declaredViews.some(view=>view.id===selectedViewId)?[...declaredViews,{id:selectedViewId,name:`Missing view (${selectedViewId})`}]:declaredViews;
  const adaptiveTarget:AdaptiveViewTarget=api.current?.adaptiveSelectionMode()==='forced'?(api.current.adaptiveViewId()?{kind:'view',viewId:api.current.adaptiveViewId()!}:{kind:'base'}):{kind:'auto'};
  const width=device||page.width;
  function viewportPolicy(value:number):RuntimeViewport{return {...(value?{width:value}:{}),height:viewportElement.current?.clientHeight??window.innerHeight}}
  measuredWidgets.current=new Map();
  useEffect(()=>{
    // Read the actual, mounted scroll viewport before constructing/starting the
    // session: initial Loaded must see the selected height-dependent view.
    const viewport=viewportPolicy(deviceWidth.current);
    const session=createOfflineRuntime(doc,pageId,evaluateExpression,browserBoxReader,viewport);api.current=session;
    const drag=bindRuntimeDrag(globalThis.document,session,cause=>setError(String(cause)));dragInput.current=drag;
    const measurementSources=new Map<string,{widget:Widget;pageId:string;disabledParents:Widget[]}>();
    const indexMeasurementSources=(widgets:Widget[],pageId:string,disabledParents:Widget[]=[])=>{
      for(const widget of widgets){
        measurementSources.set(widget.id,{widget,pageId,disabledParents});
        const children=[...(widget.layer?.widgets??[]),...(widget.states?.flatMap(state=>state.widgets)??[]),...(widget.repeater?.template??[]),...(widget.table?.cells??[]),...(widget.menu?[widget.menu.table,...widget.menu.submenus]:[]),...(widget.tree?.nodes??[]),...(widget.treeNode?[widget.treeNode.label,...widget.treeNode.children]:[])];
        indexMeasurementSources(children,pageId,['panel','repeater'].includes(widget.type)?[...disabledParents,widget]:disabledParents);
      }
    };
    for(const page of doc.pages)indexMeasurementSources(page.widgets,page.id);
    const navigation=createPreviewNavigation(cause=>setError(String(cause)));session.bindNavigation(navigation);
    const frameHost=createInlineFrameHost(doc,session,{...previewFrameOptions(doc,navigation),onError:cause=>setError(String(cause))});frames.current=frameHost;
    const control=(id:string,context:RowContext)=>{
      const key=JSON.stringify([session.state().pageId,...context.map(item=>item.rowId),id]),element=widgetElements.current.get(key);
      return element?sourceElement(element):undefined;
    };
    session.bindControls({
      flush:()=>flushSync(()=>setRuntime(structuredClone(session.state()))),
      anchor:(id,context,event:EventType='focus')=>{const element=control(id,context);if(!element)return;const rect=element.getBoundingClientRect(),point={x:rect.left,y:rect.bottom};eventSources.current.set(sourceKey(id,event,point),element);if(eventSources.current.size>256)eventSources.current.delete(eventSources.current.keys().next().value!);return point},
      focus:(id,context)=>control(id,context)?.focus(),
      selectText:(id,context)=>{const element=control(id,context);if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement)element.select()},
      measureShapeText:(id,context)=>{
        const key=JSON.stringify([session.state().pageId,...context.map(item=>item.rowId),id]);
        let widget=measuredWidgets.current.get(key);
        if(!widget){
          const source=measurementSources.get(id);if(!source||source.pageId!==session.state().pageId)return;
          const effective=(source:Widget,parentDisabled=false)=>session.widget(source,context,parentDisabled);
          widget=effective(source.widget,source.disabledParents.some(parent=>effective(parent).disabled));
          if(widget.richText)widget={...widget,richText:session.richText(widget,undefined,context)};
          else if(!session.hasOverride(id,'text',context))widget={...widget,text:session.text(widget.text,undefined,context)};
        }
        const owner=widgetElements.current.get(key),measurement=shapeTextMeasurer.measure(widget,owner,globalThis.document,{plainSetter:session.nativeTextSet(id,context)});
        return measurement?{...measurement,rect:{x:widget.x,y:widget.y,width:widget.width,height:widget.height},textAlign:widget.style.textAlign,verticalAlign:widget.style.verticalAlign??'top'}:undefined;
      },
    });
    const release=()=>session.releasePointerStyles();
    window.addEventListener('mouseup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);window.addEventListener('dragend',release);
    session.subscribe(()=>{if(drag.hasActiveDrag()&&!session.state().motionState?.drag?.started)drag.cancel();setRuntime(structuredClone(session.state()))});
    let measuredHeight=viewport.height;
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{
      const next=viewportPolicy(deviceWidth.current);
      if(next.height===measuredHeight)return;
      measuredHeight=next.height;report(session.setViewport(next));
    });
    if(viewportElement.current)observer?.observe(viewportElement.current);
    setRuntime(structuredClone(session.state()));report(session.start());
    return()=>{observer?.disconnect();window.removeEventListener('mouseup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',release);window.removeEventListener('dragend',release);drag.dispose();if(dragInput.current===drag)dragInput.current=null;frameHost.dispose();if(frames.current===frameHost)frames.current=null;frameElements.current.clear();session.dispose();if(api.current===session)api.current=null};
  },[doc,pageId,revision]);
  useEffect(()=>{const connected=new Set([...frameElements.current].filter(element=>element.isConnected));frameElements.current=connected;frames.current?.prune(connected)});
  const containsFrame=(w:Widget):boolean=>Boolean(w.inlineFrame||w.layer?.widgets.some(containsFrame)||w.states?.some(s=>s.widgets.some(containsFrame))||w.repeater?.template.some(containsFrame));
  function sourceElement(element:HTMLElement){return element.matches('.input, .textarea, .select, .checkbox, .radio')?element.querySelector<HTMLElement>('input, textarea, select')??element:element}
  function sourceKey(id:string,event:EventType,anchor?:{x:number;y:number}){return JSON.stringify([id,event,anchor?.x,anchor?.y])}
  function trigger(w:Widget,event:EventType,row:Record<string,string>|undefined,context:RowContext,element?:HTMLElement,anchor?:{x:number;y:number}){
    if((event==='focus'||event==='blur')&&suppressControlFocus.current)return;
    if((w.disabled||!w.interactions.some(item=>item.event===event))&&event!=='click'&&event!=='doubleClick')return;
    const source=element?sourceElement(element):undefined;
    if(source){
      const rect=source.getBoundingClientRect();anchor??={x:rect.left,y:rect.bottom};
      for(const [key,element] of eventSources.current)if(!element.isConnected)eventSources.current.delete(key);
      eventSources.current.set(sourceKey(w.id,event,anchor),source);
      if(eventSources.current.size>256)eventSources.current.delete(eventSources.current.keys().next().value!);
    }
    setError('');report(api.current?.trigger(w.id,event,row,context,anchor));
  }
  function menuSource(menu:CaseMenu){
    const origin=eventSources.current.get(sourceKey(menu.sourceId,menu.event,menu.anchor));
    if(origin?.isConnected)return origin;
    const widget=[...widgetElements.current.values()].find(element=>element.dataset.widgetId===menu.sourceId);
    return widget?sourceElement(widget):null;
  }
  function focusMenuElement(element:HTMLElement){
    const previous=suppressControlFocus.current;suppressControlFocus.current=true;
    try{element.focus({preventScroll:true})}finally{suppressControlFocus.current=previous}
  }
  function submenuBounds(element:HTMLElement|undefined){
    if(!element)return;const rect=element.getBoundingClientRect(),css=getComputedStyle(element);
    const size=(axis:'width'|'height')=>Math.max(0,parseFloat(css[axis])-(css.boxSizing==='border-box'?(axis==='width'?['left','right']:['top','bottom']).reduce((sum,side)=>sum+parseFloat(css.getPropertyValue('padding-'+side)||'0')+parseFloat(css.getPropertyValue('border-'+side+'-width')||'0'),0):0));
    return {left:rect.left,top:rect.top,width:size('width'),height:size('height')};
  }
  function restart(){api.current?.dispose();eventSources.current.clear();setError('');setRuntime(createRuntime(doc,pageId));setRevision(value=>value+1)}
  function changeDevice(value:number){
    deviceWidth.current=value;setDevice(value);report(api.current?.setViewport(viewportPolicy(value)));
  }
  function renderWidget(original:Widget,row?:Record<string,string>,context:RowContext=[],parentDisabled=false,ancestorHidden=false,ancestorUnplaced=false):React.ReactNode {
    const baseStyle=mergeWidgetStyle(original.style,api.current?.adaptiveWidgetOverride(original.id)?.style);
    const w=api.current?.widget(original,context,parentDisabled)??{...original};const hidden=ancestorHidden||w.hidden;w.disabled ||= parentDisabled;
    const ownUnplaced=api.current?.placementHidden(w.id,context)??w.placed===false,unplaced=ancestorUnplaced||ownUnplaced;
    const treeInfo=api.current?.treeInfo(w.id,context);
    // Hidden text is not rendered or evaluated. A qualifying native SetText
    // measurement resolves its own missing-DOM copy through the control host.
    if(hidden&&!unplaced&&!containsFrame(original))return null;
    const key=JSON.stringify([page.id,...context.map(item=>item.rowId),w.id]);
    const interactive=w.interactions.length>0;
    const keyboardButton=!['input','textarea','select','checkbox','radio'].includes(w.type)&&w.interactions.some(item=>item.event==='click');
    const focusable=keyboardButton||Boolean(api.current?.hasInteractionStyle(w.id,'focused'));

    let resolvedText=w.text,initialFormValue:string|undefined;
    if(w.richText){
      try{w.richText=api.current?.richText(w,row,context)??w.richText;resolvedText=w.richText.paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n')}
      catch(cause){renderErrors.push(String(cause));resolvedText=`[${String(cause)}]`;delete w.richText}
    }else if(!api.current?.hasOverride(w.id,'text',context)){
      try{resolvedText=api.current?.text(w.text,row,context)??w.text}catch(cause){renderErrors.push(String(cause));resolvedText=`[${String(cause)}]`}
    }
    if(api.current&&(w.type==='input'||w.type==='textarea')){
      try{initialFormValue=api.current.controlInitialValue(w.id,context);resolvedText=api.current.controlValue(w.id,context)}catch(cause){renderErrors.push(String(cause));resolvedText=''}
    }
    measuredWidgets.current.set(key,{...w,text:resolvedText});
    const change=(value:string,valid=true)=>{if(api.current?.input(w.id,value,w.type==='checkbox'||w.type==='radio'?value==='true':undefined,context,valid))trigger(w,'change',row,context,widgetElements.current.get(key))};
    const choose=(indices:number[],element:HTMLSelectElement)=>{
      const rect=element.getBoundingClientRect(),anchor={x:rect.left,y:rect.bottom};
      for(const [key,source] of eventSources.current)if(!source.isConnected)eventSources.current.delete(key);
      eventSources.current.set(sourceKey(w.id,'change',anchor),element);
      if(eventSources.current.size>256)eventSources.current.delete(eventSources.current.keys().next().value!);
      setError('');report(api.current?.chooseOptions(w.id,indices,context,anchor));
    };
    const controlFocus=(focused:boolean,element:HTMLElement)=>{
      const rect=element.getBoundingClientRect(),anchor={x:rect.left,y:rect.bottom};
      for(const [key,source] of eventSources.current)if(!source.isConnected)eventSources.current.delete(key);
      eventSources.current.set(sourceKey(w.id,focused?'focus':'blur',anchor),element);
      if(eventSources.current.size>256)eventSources.current.delete(eventSources.current.keys().next().value!);
      report(api.current?.focus(w.id,focused,context,anchor,suppressControlFocus.current,(element as HTMLInputElement).validity?.valid??true));
    };
    const check=(checked:boolean,element:HTMLElement)=>{
      const session=api.current;if(!session||w.disabled)return;
      const before=Boolean(session.widget(w,context).checked),pageBefore=session.state().pageId,rect=element.getBoundingClientRect();setError('');
      report((async()=>{await session.check(w.id,checked,context,{x:rect.left,y:rect.bottom});if(api.current===session&&session.state().pageId===pageBefore&&before!==Boolean(session.widget(w,context).checked))trigger(w,'change',row,context,element)})());
    };
    const drawn=api.current?.renderSize(w,context);
    return <div key={key} ref={element=>{if(element){widgetElements.current.set(key,element);applyGradientContext(element,w)}else widgetElements.current.delete(key)}} data-widget-id={w.id} aria-label={w.name} role={keyboardButton?'button':undefined} tabIndex={focusable&&!w.disabled&&!['input','textarea','select','checkbox','radio'].includes(w.type)?0:-1} aria-disabled={w.disabled||undefined} className={`widget runtime-widget ${w.type}`} style={{...widgetStyle(w,true,drawn),display:hidden||ownUnplaced?'none':undefined,visibility:ownUnplaced?'hidden':undefined,...(w.inlineFrame?{background:'transparent',border:0,borderRadius:0}:{}),...drawn,cursor:interactive?'pointer':undefined,...(w.inlineFrame||w.vectorPath||w.type==='hotspot'?{backgroundColor:'transparent',backgroundImage:'none'}:{}),...(w.menu||w.tree||w.treeNode?{overflow:'visible' as const,...(w.rotation===0?{transform:'none'}:{})}:{}),...(w.layer?{transform:'none',overflow:'visible',background:'transparent',border:0,boxShadow:'none'}:{}),zIndex:api.current?.menuLayer(w.id,context)}}
      onClick={e=>{e.stopPropagation();if(e.target instanceof Element&&e.target.closest('[data-rich-link-id]'))return;trigger(w,'click',row,context,e.currentTarget,e.detail?{x:e.clientX,y:e.clientY}:undefined)}}
      onDoubleClick={e=>{e.stopPropagation();trigger(w,'doubleClick',row,context,e.currentTarget,{x:e.clientX,y:e.clientY})}}
      onMouseEnter={e=>{if(!w.disabled)api.current?.setInteractionState(w.id,{mouseOver:true},context);trigger(w,'mouseEnter',row,context,e.currentTarget,{x:e.clientX,y:e.clientY});report(api.current?.menuPointer(w.id,'enter',context))}}
      onMouseLeave={e=>{api.current?.setInteractionState(w.id,{mouseOver:false},context);trigger(w,'mouseLeave',row,context,e.currentTarget,{x:e.clientX,y:e.clientY});const child=api.current?.menuChild(w.id),element=child?widgetElements.current.get(JSON.stringify([page.id,...context.map(item=>item.rowId),child])):undefined,bounds=submenuBounds(element);report(api.current?.menuPointer(w.id,'leave',context,{x:e.clientX,y:e.clientY},bounds))}}
      onMouseDown={e=>{e.stopPropagation();if(!w.disabled){api.current?.setInteractionState(w.id,{mouseDown:true},context);dragInput.current?.start(e.nativeEvent,w.id,context,e.currentTarget,{moveCursor:w.interactions.some(item=>item.enabled&&item.event==='drag'),preventTouch:w.interactions.some(item=>item.enabled&&['drag','swipeUp','swipeDown'].includes(item.event))})}}}
      onTouchStart={e=>{e.stopPropagation();if(!w.disabled)dragInput.current?.start(e.nativeEvent,w.id,context,e.currentTarget,{moveCursor:w.interactions.some(item=>item.enabled&&item.event==='drag'),preventTouch:w.interactions.some(item=>item.enabled&&['drag','swipeUp','swipeDown'].includes(item.event))})}}
      onFocus={e=>{if(e.target===e.currentTarget&&!w.disabled)controlFocus(true,e.currentTarget)}}
      onBlur={e=>{if(e.target===e.currentTarget)controlFocus(false,e.currentTarget)}}
      onKeyDown={e=>{if(keyboardButton&&e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();if(!e.repeat)trigger(w,'click',row,context,e.currentTarget)}}}>
      {w.layer?<div data-layer-scope={w.id} style={{position:'absolute',left:-w.x,top:-w.y,width:0,height:0,overflow:'visible'}}>{w.layer.widgets.map(child=>renderWidget(child,row,context,parentDisabled,hidden,unplaced))}</div>:w.inlineFrame?<iframe ref={element=>{if(element){frameElements.current.add(element);frames.current?.update(element,w,context)}}} title={w.name} data-inline-frame={w.id} sandbox="allow-scripts allow-forms" style={{width:'100%',height:'100%',display:'block',border:w.inlineFrame.hideBorders?0:'2px inset'}}/>:w.tree?w.tree.nodes.map(child=>renderWidget(child,row,context,parentDisabled,false,unplaced)):w.treeNode?<>
        {treeInfo?.branch&&treeInfo.showExpandIcons&&<button type="button" data-tree-toggle={w.id} aria-label={`${treeInfo.expanded?'Collapse':'Expand'} ${w.name}`} aria-expanded={treeInfo.expanded} style={{position:'absolute',left:6,top:Math.max(0,Math.round((w.height-9)/2)),width:9,height:9,padding:0,border:0,background:'transparent',lineHeight:0,cursor:'default'}} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.preventDefault();e.stopPropagation();report(api.current?.treeToggle(w.id,context,{x:e.clientX,y:e.clientY}))}}><svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">{treeInfo.iconStyle==='plusMinus'?<><rect x=".5" y=".5" width="8" height="8" fill="white" stroke="#555"/><path d={treeInfo.expanded?'M2 4.5H7':'M2 4.5H7M4.5 2V7'} stroke="#555"/></>:<path d={treeInfo.expanded?'M0 2H9L4.5 7Z':'M2 0L7 4.5L2 9Z'} fill="#555"/>}</svg></button>}
        {treeInfo?.showIcons&&w.treeNode.iconSrc&&<img data-tree-node-icon={w.id} src={w.treeNode.iconSrc} alt="" style={{position:'absolute',left:Math.max(16,w.treeNode.label.x-18),top:Math.max(0,(w.height-16)/2),width:16,height:16}}/>}
        {renderWidget(w.treeNode.label,row,context,parentDisabled,false,unplaced)}
        {w.treeNode.expanded&&w.treeNode.children.map(child=>renderWidget(child,row,context,parentDisabled,false,unplaced))}
      </>:w.menu?[w.menu.table,...w.menu.submenus].map(child=>renderWidget(child,row,context,parentDisabled,false,unplaced)):w.type==='table'&&w.table?orderedTableCells(w).map(cell=>renderWidget(cell,row,context,parentDisabled,false,unplaced)):w.type==='panel'?w.states?.flatMap(state=>{const active=state.id===(w.activeStateId??w.states?.[0]?.id);return state.widgets.filter(child=>active||containsFrame(child)).map(child=>renderWidget(child,row,context,w.disabled,hidden||!active,unplaced))}):w.type==='repeater'&&w.repeater?<>{(api.current?.rows(w,context)??[]).map(item=><div className="repeater-row" data-row-id={item.id} key={`${item.id}:${item.revision}`} style={{position:'absolute',left:item.x,top:item.y,width:item.width,height:item.height,boxSizing:'border-box',border:['layout','itemWidth','wrap','horizontalGap','verticalGap','fitToContent','padding'].some(field=>Object.hasOwn(w.repeater!,field))?0:undefined}}>{w.repeater!.template.map(child=>renderWidget(child,item.data,item.context,w.disabled,hidden,unplaced))}</div>)}</>:<WidgetContent widget={w} gradientBase={baseStyle.fillGradient} strokeGradientBase={baseStyle.strokeGradient} gradientSession={api.current??revision} linksDisabled={w.disabled} onLinkPointer={(id,phase)=>api.current?.setLinkState(w.id,id,phase,context)} onLinkClick={(id,event)=>{const element=event.currentTarget,rect=element.getBoundingClientRect(),point={x:rect.left,y:rect.bottom};eventSources.current.set(sourceKey(id,'click',point),element);if(eventSources.current.size>256)eventSources.current.delete(eventSources.current.keys().next().value!);setError('');report(api.current?.triggerLink(w.id,id,context,point))}} runtime={runtime} row={row} resolvedText={resolvedText} nativeTextSet={api.current?.nativeTextSet(w.id,context)} resolved selectedIndices={w.type==='select'?api.current?.selectedOptions(w.id,context):undefined} onSelectOptions={choose} initialValue={initialFormValue} files={w.inputType==='file'?api.current?.fileSelection(w.id,context):undefined} onFiles={files=>{api.current?.fileSelection(w.id,context,files)}} hintValue={api.current?.hint(w.id,context)} onHideHint={()=>api.current?.hideHint(w.id,context)??false} onTextCheck={element=>{if(api.current?.textChanged(w.id,context))trigger(w,'change',row,context,element)}} radioName={w.type==='radio'&&w.radioGroup?JSON.stringify([page.id,context.map(item=>[item.repeaterId,item.rowId]),w.radioGroup]):undefined} onSubmit={()=>report(api.current?.submit(w.id,context))} onInput={change} onCheck={check} onFocus={element=>controlFocus(true,element)} onBlur={element=>controlFocus(false,element)}/>}
    </div>;
  }
  const contents=page.widgets.map(w=>renderWidget(w));
  const displayedError=renderErrors[0]||error;
  return <div className="preview-overlay" onKeyDown={event=>{const menu=runtime.caseMenus?.at(-1);if(event.key==='Escape'&&menu){event.preventDefault();event.stopPropagation();api.current?.cancelCaseMenus(menu.id)}}}><header className="preview-toolbar"><button title="Toggle pages" onClick={()=>setShowPages(!showPages)}><List size={17}/></button><strong>{doc.name}</strong><ChevronRight size={13}/><span>{page.name}</span><div className="toolbar-spacer"/>{adaptiveViews.length>0&&<select aria-label="Adaptive view" title="Page-local selection; resets to Auto on page navigation" value={JSON.stringify(adaptiveTarget)} onChange={event=>{setError('');report(api.current?.setAdaptiveView(JSON.parse(event.target.value) as AdaptiveViewTarget))}}><option value={JSON.stringify({kind:'auto'})}>Auto</option><option value={JSON.stringify({kind:'base'})}>Base</option>{adaptiveViews.map(view=><option key={view.id} value={JSON.stringify({kind:'view',viewId:view.id})}>{view.name}</option>)}</select>}{[[0,Monitor,'Desktop'],[768,Tablet,'Tablet'],[390,Smartphone,'Mobile']].map(([n,Icon,label])=>{const I=Icon as typeof Monitor;return <button key={String(label)} title={String(label)} className={device===n?'active':''} onClick={()=>changeDevice(Number(n))}><I size={18}/></button>})}<button title="Restart prototype" onClick={restart}><RotateCcw size={17}/></button><button onClick={onClose}><X size={18}/> Close preview</button></header>{displayedError&&<div role="alert" className="preview-error">{displayedError}</div>}<div className="preview-body">{showPages&&<nav className="preview-pages"><h4>PAGES</h4><PreviewPageTree document={doc} pageId={page.id} onNavigate={id=>report(api.current?.navigate(id))}/></nav>}<div className="preview-scroll" ref={viewportElement}><div className="preview-page" style={{width,minHeight:page.height,background:page.background}}>{contents}</div></div></div>
    <CaseMenus menus={runtime.caseMenus??[]} getSource={menuSource} focusElement={focusMenuElement} onCancel={id=>api.current?.cancelCaseMenus(id)} onSelect={(id,optionId)=>{setError('');report(api.current?.selectCase(id,optionId))}}/>
  </div>;
}
