import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MousePointer2, Type, Square, Circle, Image as ImageIcon, Layers, PenTool, GitBranch, Zap, Play, Upload, ChevronDown, ChevronRight, Search, Plus, FilePlus2, FolderPlus, ChevronsUpDown, FileText, Grip, Undo2, Redo2, Group, Ungroup, ArrowUpToLine, ArrowDownToLine, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, Eye, EyeOff, Lock, Unlock, Save, FolderOpen, Download, Grid2X2, X, Trash2, PanelTop, List, SlidersHorizontal, CheckSquare, Minus, Hand, Copy, Check, Monitor, Braces } from 'lucide-react';
import type { Document, Page, Widget, WidgetType, WidgetStyle, RichText } from './model/types';
import { createDocument, createDemoDocument, createWidget, cloneWidgets, groupIntoLayer, ungroupLayers, ungroupWidgets, parseDocument, parseRichText, serializeDocument, updateWidgetTree, deleteWidgetTree, findWidget, uid, mergeWidgetStyle, resolveSelectedStyle, resolveInteractionStylePatch } from './model/document';
import { addPageNode } from './model/page-tree';
import { WidgetContent, widgetStyle, getStaticRepeaterLayout, type MenuAuthoringProps, type TreeAuthoringProps } from './components/WidgetView';
import { Inspector, type InteractionStyleField } from './components/Inspector';
import { LineStyleToolbar, filterLineStylePatch } from './components/LineStyleEditor';
import { editCornerOverride, resolveWidgetStyleCommand, type WidgetStyleEditIntent } from './components/widget-style-command';
import { supportsCornerEditing } from './components/CornerEditor';
import { Preview } from './components/Preview';
import { exportPrototype } from './runtime/export';
import { createComponent, createComponentInstance, applyComponentInstanceChanges, detachComponentInstance } from './model/components';
import { resolveAdaptiveWidgets, applyAdaptivePointEdit, applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveOverride, clearAdaptiveStateStyles, setAdaptivePlacement, deleteAdaptiveWidgets, isAdaptiveWidgetPlaced } from './model/adaptive';
import { resolveAdaptivePage, commitAdaptivePage } from './model/adaptive-view-sets';
import { AdaptiveControls } from './components/AdaptiveControls';
import { AdaptiveSetControls } from './components/AdaptiveSetControls';
import { useDialogs } from './components/Dialogs';
import { importRpSemantics, type RpImportReport } from './model/import-rp';
import { RpImportReportDialog } from './components/RpImportReport';
import { PrototypeSettings } from './components/PrototypeSettings';
import { CanvasVectorTools } from './components/CanvasVectorTools';
import type { CanvasVectorToolsHandle } from './components/CanvasVectorTools';
import { canvasToVectorPoint, closestVectorT, vectorSegmentPoint, vectorSegments } from './model/vector-editing';
import type { VectorPath } from './model/types';
import { resolveVectorEditPath, vectorEditPathUnsupportedReason } from './model/vector-authoring';
import { anchorRotatedResize, resizeRotatedBounds, rotatedBoundsIntersect } from './model/rotation-geometry';
import { PageTree } from './components/PageTree';
import { LayerOutlineEntries } from './components/LayerEditor';
import { translateWidget, widgetOwnershipPath } from './model/widget-structure';
import { fitLayerTree, layerAuthoringBounds, moveLayer } from './model/layer-geometry';
import { planAuthorLayerResize } from './model/author-layer-resize';
import { PageTabs } from './components/PageTabs';
import { RichTextEditor } from './components/RichTextEditor';
import { FrameTargetEditor } from './components/FrameTargetEditor';
import { TreeCanvasControls, TreeOutlineEntries, treeAncestors, visibleTreeNodes, type TreeSelection, type TreeOperation } from './components/TreeEditor';
import { createTree, findTreeNode, treeNodeLocation, updateTreeNode, patchTreeLabel, insertTreeNode, deleteTreeNode, moveTreeNode, setTreeNodeExpanded, setTreeProperties } from './model/tree-widget';
import { MenuCanvasControls, MenuOutlineEntries, menuAncestors, type MenuSelection, type MenuOperation } from './components/MenuEditor';
import { createMenu, findMenu, updateMenu, insertMenuItem, deleteMenuItem, moveMenuItem, patchMenuItems, setMenuPadding, addSubmenu, deleteSubmenu, resizeMenu, setMenuOrientation, type MenuOrientation } from './model/menu';
import { TableCanvasControls, TableOutlineEntries, PasteTableDialog, tableCellCoordinates, tableRectangleIds, selectedTableAxes, type TableSelection, type TableOperation } from './components/TableEditor';
import { layoutTable, patchTableCells, insertTableTrack, deleteTableTracks, moveTableTrack, setTableTrackSize, resizeTable, parseTableText, pasteTableText, copyTableText } from './model/table';
import { applyRichTextStyle, projectTextStyleOverride, patchWidgetTextStyle, replaceWidgetText, richTextPlainText, richTextFromPlainText, RICH_TEXT_WIDGET_TYPES, RICH_TEXT_STYLE_KEYS } from './model/rich-text';

const LIBRARY: {type:WidgetType;name:string;icon:typeof Square;key?:string;orientation?:MenuOrientation}[]=[
  {type:'box',name:'Box',icon:Square},{type:'ellipse',name:'Ellipse',icon:Circle},{type:'image',name:'Image',icon:ImageIcon},{type:'path',name:'Path',icon:PenTool},
  {type:'placeholder',name:'Placeholder',icon:Square},{type:'button',name:'Button',icon:PanelTop},{type:'text',name:'Text',icon:Type},
  {type:'line',name:'Line',icon:Minus},{type:'hotspot',name:'Hot spot',icon:MousePointer2},{type:'panel',name:'Dynamic panel',icon:Layers},
  {type:'input',name:'Text field',icon:PanelTop},{type:'textarea',name:'Text area',icon:FileText},{type:'checkbox',name:'Checkbox',icon:CheckSquare},
  {type:'menu',key:'menu-horizontal',name:'Horizontal Menu',icon:List,orientation:'horizontal'},{type:'menu',key:'menu-vertical',name:'Vertical Menu',icon:List,orientation:'vertical'},{type:'inlineFrame',name:'Inline Frame',icon:PanelTop},{type:'tree',name:'Tree',icon:GitBranch},{type:'table',name:'Table',icon:Grid2X2},{type:'radio',name:'Radio button',icon:Circle},{type:'select',name:'Droplist',icon:ChevronDown},{type:'repeater',name:'Repeater',icon:Grid2X2},
];
const CACHE_KEY='rea-prototype-document-v1';
function initialDocument(){try{const saved=localStorage.getItem(CACHE_KEY);return saved?parseDocument(saved):createDocument()}catch{return createDocument()}}
type LayerResizeContext={pageId:string;viewId:string|null;scopeId:string|null;stateId?:string;zoom:number;documentId:string};
type Drag={kind:'move'|'resize'|'marquee';startX:number;startY:number;original:Widget[];ids:string[];handle?:string;initialSelection?:string[];document?:Document;wasSaved?:boolean;layerResize?:LayerResizeContext};
const LAYER_RESIZE_HANDLES={w:1,n:2,nw:3,e:4,ne:6,s:8,sw:9,se:12} as const;
const RESIZE_PIN_FIELDS=['pinHorizontal','pinVertical','fixedWidth','fixedHeight'] as const;
export default function App(){
  const {prompt}=useDialogs();
  const [doc,setDoc]=useState<Document>(initialDocument);const [pageId,setPageId]=useState(doc.pages[0].id);
  const [pageNodeId,setPageNodeId]=useState(doc.pages[0].id);const [openPageIds,setOpenPageIds]=useState([doc.pages[0].id]);
  const [selected,setSelected]=useState<string[]>([]);const [past,setPast]=useState<Document[]>([]);const [future,setFuture]=useState<Document[]>([]);
  const [zoom,setZoom]=useState(1);const [grid,setGrid]=useState(false);const [snap,setSnap]=useState(false);const [tool,setTool]=useState<WidgetType|'select'|'hand'|'pen'>('select');
  const [pointEditingId,setPointEditingId]=useState<string|null>(null);
  const [vectorDraft,setVectorDraft]=useState<{id:string;path:VectorPath}|null>(null);
  const vectorTools=useRef<CanvasVectorToolsHandle>(null);
  const [leftTab,setLeftTab]=useState('Pages');const [libraryTab,setLibraryTab]=useState('Libraries');const [search,setSearch]=useState('');const [placementFilter,setPlacementFilter]=useState<'all'|'placed'|'unplaced'>('all');
  const [menu,setMenu]=useState<string|null>(null);const [quick,setQuick]=useState(false);const [quickText,setQuickText]=useState('');
  const [preview,setPreview]=useState(false);const [gallery,setGallery]=useState(false);const [variables,setVariables]=useState(false);
  const [prototypeSettings,setPrototypeSettings]=useState(false);
  const [notice,setNotice]=useState('Ready');const [saved,setSaved]=useState(true);const [editing,setEditing]=useState<string|null>(null);
  const [frameTargetEditing,setFrameTargetEditing]=useState<string|null>(null);
  const [richEditing,setRichEditing]=useState<string|null>(null);
  const [treeSelection,setTreeSelection]=useState<TreeSelection|null>(null);
  const [revealedTreeIds,setRevealedTreeIds]=useState<string[]>([]);
  const [menuSelection,setMenuSelection]=useState<MenuSelection|null>(null);
  const [expandedMenuIds,setExpandedMenuIds]=useState<string[]>([]);
  const [menuOrientation,setMenuCreationOrientation]=useState<MenuOrientation>('horizontal');
  const [tableSelection,setTableSelection]=useState<TableSelection|null>(null);
  const [tablePaste,setTablePaste]=useState<{existing:boolean;tableId?:string;cellId?:string}|null>(null);
  const tableSelectionDrag=useRef<{tableId:string;anchor:string;initial:string[]}|null>(null);
  const tableResize=useRef<{document:Document;table:Widget;wasSaved:boolean}|null>(null);
  const tableClipboard=useRef<string|null>(null);
  const [recovery,setRecovery]=useState<'pending'|'saved'|'failed'>('pending');
  const [panelPath,setPanelPath]=useState<string|null>(null);const [marquee,setMarquee]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const [adaptiveViewId,setAdaptiveViewId]=useState<string|null>(null);
  const [placementAllViews,setPlacementAllViews]=useState(false);
  const [effectPreview,setEffectPreview]=useState<{widgetId:string;field:InteractionStyleField}|null>(null);
  const [rpReport,setRpReport]=useState<{name:string;report:RpImportReport;opened:boolean}|null>(null);
  const docRef=useRef(doc);docRef.current=doc;const drag=useRef<Drag|null>(null);const clipboard=useRef<Widget[]>([]);const surface=useRef<HTMLDivElement>(null);const fileInput=useRef<HTMLInputElement>(null);const imageInput=useRef<HTMLInputElement>(null);
  const page=resolveAdaptivePage(doc,doc.pages.find(p=>p.id===pageId)??doc.pages[0]);
  useEffect(()=>{setOpenPageIds([doc.pages[0].id]);setPageNodeId(doc.pages[0].id);setPageId(doc.pages[0].id);setSearch('')},[doc.id]);
  useEffect(()=>{const missing=!doc.pages.some(p=>p.id===pageId);setOpenPageIds(ids=>{const next=ids.filter(id=>doc.pages.some(p=>p.id===id));if(missing&&!gallery&&!next.includes(doc.pages[0].id))next.push(doc.pages[0].id);return next.length===ids.length&&next.every((id,index)=>id===ids[index])?ids:next});if(missing){setPageId(doc.pages[0].id);setPageNodeId(doc.pages[0].id);setPanelPath(null);setAdaptiveViewId(null);setSelected([]);setEditing(null)}},[doc.pages,pageId,gallery]);
  const activeView=page.adaptiveViews.find(view=>view.id===adaptiveViewId);
  const viewId=activeView?.id??null;const canvasWidth=activeView?.width||page.width;const canvasHeight=activeView?.height||page.height;
  const pageWidgets=resolveAdaptiveWidgets(page,viewId);
  const panel=panelPath?findWidget({widgets:pageWidgets},panelPath):undefined;
  const activeState=panel?.states?.find(s=>s.id===panel.activeStateId)??panel?.states?.[0];
  const scopePath=panel?widgetOwnershipPath(pageWidgets,panel.id)??[]:[];
  const canvasContainer=scopePath.slice().reverse().find(widget=>widget.type==='panel'||widget.type==='repeater');
  function exitScope(){const parent=scopePath.slice(0,-1).reverse().find(widget=>['layer','panel','repeater'].includes(widget.type));setPanelPath(parent?.id??null);setSelected(panel?[panel.id]:[]);setEditing(null);setRichEditing(null)}
  const widgets=panel?.layer?panel.layer.widgets:panel?.type==='repeater'?panel.repeater!.template:activeState?.widgets??pageWidgets;const rootCurrent=widgets.find(w=>w.id===selected[0]);
  // A Layer gesture is tied to one immutable view/scope. Live previews must
  // never become the input for the next frame or survive a context switch.
  useEffect(()=>{
    const context=drag.current?.layerResize;
    if(!context)return;
    if(context.documentId!==doc.id){drag.current=null;return;}
    if(context.pageId!==page.id||context.viewId!==viewId||context.scopeId!==(panel?.id??null)||context.stateId!==activeState?.id||context.zoom!==zoom||preview||gallery||tool!=='select')pointerCancel();
  },[doc.id,page.id,viewId,panel?.id,activeState?.id,zoom,preview,gallery,tool]);
  const scopePlaced=!panel||isAdaptiveWidgetPlaced(pageWidgets,panel.id);
  const canvasWidgets=scopePlaced?widgets.filter(w=>w.placed!==false):[];
  useEffect(()=>{if(panel&&!scopePlaced){setPanelPath(null);setSelected([]);setEditing(null);setRichEditing(null)}},[panel?.id,scopePlaced]);
  const selectedTable=tableSelection&&selected.includes(tableSelection.tableId)?widgets.find(w=>w.id===tableSelection.tableId&&w.type==='table'):undefined;
  const selectedMenuRoot=menuSelection&&selected.includes(menuSelection.rootMenuId)?widgets.find(w=>w.id===menuSelection.rootMenuId&&w.type==='menu'):undefined;
  const selectedMenu=selectedMenuRoot&&menuSelection?findMenu(selectedMenuRoot,menuSelection.menuId):undefined;
  const activeMenuRoot=selectedMenuRoot??(rootCurrent?.type==='menu'?rootCurrent:undefined);
  const activeMenu=selectedMenu??activeMenuRoot;
  const localMenuSelection=Boolean(selectedMenuRoot&&selectedMenu&&(menuSelection?.cellId||selectedMenu.id!==selectedMenuRoot.id));
  const menuCurrent=selectedMenu?.menu?.table.table!.cells.find(cell=>cell.id===menuSelection?.cellId)??selectedMenu;
  const selectedTree=treeSelection&&selected.includes(treeSelection.rootTreeId)?widgets.find(w=>w.id===treeSelection.rootTreeId&&w.type==='tree'):undefined;
  const activeTree=selectedTree??(rootCurrent?.type==='tree'?rootCurrent:undefined);
  const selectedTreeNode=selectedTree&&treeSelection?.nodeId?findTreeNode(selectedTree,treeSelection.nodeId):undefined;
  const localTreeSelection=Boolean(selectedTreeNode);
  const treeCurrent=selectedTreeNode?(treeSelection?.part==='label'?selectedTreeNode.treeNode!.label:selectedTreeNode):undefined;
  const current=treeCurrent??menuCurrent??selectedTable?.table?.cells.find(cell=>cell.id===(tableSelection?.focusCellId??tableSelection?.cellIds[0]))??rootCurrent;
  const activeTable=selectedTable??(rootCurrent?.type==='table'?rootCurrent:undefined);
  useEffect(()=>{setTreeSelection(null);setRevealedTreeIds([]);setMenuSelection(null);setExpandedMenuIds([]);setTableSelection(null);tableSelectionDrag.current=null},[page.id,panel?.id,activeState?.id,viewId,preview,gallery,doc.id,tool]);
  useEffect(()=>{if(!tableSelection)return;if(!selectedTable){setTableSelection(null);return}const ids=tableSelection.cellIds.filter(id=>selectedTable.table!.cells.some(cell=>cell.id===id));if(ids.length!==tableSelection.cellIds.length)setTableSelection(ids.length?{...tableSelection,cellIds:ids,anchorCellId:ids.includes(tableSelection.anchorCellId??'')?tableSelection.anchorCellId:ids[0],focusCellId:ids.includes(tableSelection.focusCellId??'')?tableSelection.focusCellId:ids[0]}:null)},[selectedTable,tableSelection]);
  useEffect(()=>{if(!menuSelection)return;if(!selectedMenuRoot){setMenuSelection(null);return}if(!selectedMenu){setMenuSelection({rootMenuId:selectedMenuRoot.id,menuId:selectedMenuRoot.id});return}if(menuSelection.cellId&&!selectedMenu.menu!.table.table!.cells.some(cell=>cell.id===menuSelection.cellId))setMenuSelection({...menuSelection,cellId:undefined})},[selectedMenuRoot,selectedMenu,menuSelection]);
  useEffect(()=>{if(treeSelection&&(!selectedTree||treeSelection.nodeId&&!selectedTreeNode))setTreeSelection(selectedTree?{rootTreeId:selectedTree.id,part:'node'}:null)},[treeSelection,selectedTree,selectedTreeNode]);
  const frameTargetWidget=frameTargetEditing?findWidget(page,frameTargetEditing):undefined;
  useEffect(()=>{setFrameTargetEditing(null)},[page.id,panel?.id,activeState?.id,viewId,preview,gallery,tool,current?.id]);
  const richEditingWidget=richEditing?findWidget(page,richEditing):undefined;
  useEffect(()=>{setRichEditing(null)},[page.id,panel?.id,activeState?.id,viewId,preview,gallery,tool]);
  useEffect(()=>{if(richEditing&&current?.id!==richEditing)setRichEditing(null)},[current?.id]);
  const pointEditingUnavailable=current?.vectorPath?vectorEditPathUnsupportedReason(current):undefined;
  const vectorEditKey=JSON.stringify(current&&{type:current.type,vectorPath:current.vectorPath,style:current.style,width:current.width,height:current.height});
  const preparedVectorPath=useMemo(()=>current&&!pointEditingUnavailable?resolveVectorEditPath(current):undefined,[vectorEditKey,pointEditingUnavailable]);
  const pointEditing=!pointEditingUnavailable&&tool==='select'&&!editing&&!preview&&!gallery&&current?.id===pointEditingId&&!!current?.vectorPath&&!current.locked&&!current.hidden&&current.placed!==false&&rootCurrent?.placed!==false;
  // A successful point commit may rebound this frame. Keep its logical anchor
  // selection while still remounting for external scope/view/tool changes.
  const vectorSessionContext=[page.id,panel?.id,activeState?.id,viewId,tool,current?.id,zoom,pointEditing,preview,gallery].join(':');
  const vectorContext=[vectorSessionContext,current?.x,current?.y,current?.width,current?.height,current?.rotation].join(':');
  useEffect(()=>{setVectorDraft(null)},[vectorContext]);
  useEffect(()=>{setPointEditingId(null)},[page.id,panel?.id,activeState?.id,viewId,preview,gallery]);
  useEffect(()=>{if(tool!=='select')setPointEditingId(null)},[tool]);
  useEffect(()=>{if(pointEditingId&&current?.id!==pointEditingId)setPointEditingId(null)},[current?.id,pointEditingId]);
  function resetVectorTools(){setFrameTargetEditing(null);setTreeSelection(null);setRevealedTreeIds([]);setMenuSelection(null);setExpandedMenuIds([]);if(drag.current||tableResize.current)pointerCancel();setTableSelection(null);tableSelectionDrag.current=null;setTool('select');setPointEditingId(null);setVectorDraft(null);setRichEditing(null)}
  function enterPointEditing(widget:Widget){if(!widget.vectorPath||widget.locked||widget.hidden||widget.placed===false||rootCurrent?.placed===false||vectorEditPathUnsupportedReason(widget))return;setEditing(null);setRichEditing(null);setEffectPreview(null);setTool('select');setPointEditingId(widget.id)}
  function editPoints(){if(current)enterPointEditing(current)}
  const linkedInstance=panel?.componentInstance?panel:current?.componentInstance?current:undefined;
  const commit=useCallback((next:Document)=>{if(next===docRef.current)return;setPast(p=>[...p.slice(-99),docRef.current]);setFuture([]);setDoc(next);setSaved(false)},[]);
  function changeWidgets(next:Widget[],history=true,explicitViewTextStyle?:Partial<WidgetStyle>,sourceDocument=docRef.current,structureAcrossViews=false){
    const p=resolveAdaptivePage(sourceDocument,sourceDocument.pages.find(p=>p.id===page.id)!);const full=resolveAdaptiveWidgets(p,viewId);
    const list=panel?updateWidgetTree(full,panel.id,w=>panel.type==='layer'?{layer:{...w.layer!,widgets:next}}:panel.type==='repeater'?{repeater:{...w.repeater!,template:next}}:{states:w.states!.map(s=>s.id===activeState?.id?{...s,widgets:next}:s)}):next;
    let changed=applyAdaptiveWidgetEdits(p,viewId,list,{placementAllViews:structureAcrossViews||placementAllViews,allViews:placementAllViews,explicitTextStyle:explicitViewTextStyle,explicitTextWidgetIds:selected});
    if(viewId&&!placementAllViews&&explicitViewTextStyle){
      const patch=Object.fromEntries([...RICH_TEXT_STYLE_KEYS,'textAlign','lineHeight'].filter(key=>Object.hasOwn(explicitViewTextStyle,key)).map(key=>[key,explicitViewTextStyle[key as keyof WidgetStyle]??(key==='fontStyle'?'normal':key==='lineHeight'?1.35:key==='underline'||key==='strikethrough'?false:undefined)]));
      if(Object.keys(patch).length)changed={...changed,adaptiveViews:changed.adaptiveViews.map(view=>view.id!==viewId?view:{...view,overrides:{...view.overrides,...Object.fromEntries(next.filter(w=>selected.includes(w.id)&&w.richText).map(w=>[w.id,{...view.overrides[w.id],style:{...view.overrides[w.id]?.style,...patch}}]))}})};
    }
    const result=changed===p?sourceDocument:commitAdaptivePage(sourceDocument,changed);
    if(result===docRef.current||JSON.stringify(result)===JSON.stringify(docRef.current))return;
    if(history)commit(result);else{docRef.current=result;setDoc(result);setSaved(false)}
  }
  function changePointPath(widgetId:string,vectorPath:VectorPath){
    try{const source=docRef.current,p=resolveAdaptivePage(source,source.pages.find(p=>p.id===page.id)!);const changed=applyAdaptivePointEdit(p,viewId,widgetId,vectorPath);if(changed!==p)commit(commitAdaptivePage(source,changed))}catch(error){setNotice(error instanceof Error?error.message:String(error))}
  }
  function patchPage(patch:Partial<Page>){commit({...docRef.current,pages:docRef.current.pages.map(p=>p.id===page.id?{...p,...patch}:p)})}
  function editRichText(id:string){setEditing(null);setPointEditingId(null);setEffectPreview(null);setTool('select');setRichEditing(id)}
  function beginTextEdit(w:Widget){if(w.placed===false||rootCurrent?.placed===false)return;if(w.layer){if(!w.locked){setPanelPath(w.id);setSelected([])}return}if(w.type==='inlineFrame'){setFrameTargetEditing(w.id);return}if(['table','menu','tree','treeNode'].includes(w.type)){setNotice('Select an item to edit its text');return}if((RICH_TEXT_WIDGET_TYPES as readonly string[]).includes(w.type))editRichText(w.id);else setEditing(w.id)}
  function applyRichText(richText:RichText){
    if(!richEditingWidget)return;
    if(JSON.stringify(richText)!==JSON.stringify(parseRichText(richEditingWidget.richText??richTextFromPlainText(richEditingWidget.text))))changeWidgets(updateWidgetTree(widgets,richEditingWidget.id,{text:richTextPlainText(richText),richText}));
    setRichEditing(null);
  }
  function selectTree(root:Widget,nodeId?:string,part:'node'|'label'='node',reveal=false){
    setMenuSelection(null);setTableSelection(null);setTool('select');setSelected([root.id]);setPointEditingId(null);surface.current?.focus({preventScroll:true});
    setTreeSelection({rootTreeId:root.id,nodeId,part});
    if(reveal&&nodeId){const path=treeAncestors(root,nodeId)??[];setRevealedTreeIds(ids=>[...new Set([...ids,...path.slice(0,-1)])])}
  }
  function changeTree(root:Widget,update:(tree:Widget)=>Widget):Widget|undefined{
    if(root.locked)return;
    try{const fresh=findWidget(docRef.current.pages.find(p=>p.id===page.id)!,root.id)??root,next=update(fresh);if(JSON.stringify(fresh)!==JSON.stringify(next))changeWidgets(widgets.map(w=>w.id===root.id?next:w));return next}catch(error){setNotice(String(error));return undefined}
  }
  function treeOperation(root:Widget,operation:TreeOperation){
    const location=treeNodeLocation(root,operation.nodeId);if(location.node.locked)return;
    const next=changeTree(root,current=>['child','before','after'].includes(operation.kind)?insertTreeNode(current,operation.nodeId,operation.kind as 'child'|'before'|'after'):operation.kind==='delete'?deleteTreeNode(current,operation.nodeId):moveTreeNode(current,operation.nodeId,operation.kind as 'up'|'down'|'indent'|'outdent'));
    if(!next)return;
    if(['child','before','after'].includes(operation.kind)){
      const updated=treeNodeLocation(next,operation.nodeId),added=operation.kind==='child'?updated.node.treeNode!.children.at(-1)!:updated.siblings[updated.index+(operation.kind==='before'?-1:1)];selectTree(next,added.id,'label',true);
    }else if(operation.kind==='delete')selectTree(next,location.parentId??next.tree!.nodes[0].id,'node',true);
    else selectTree(next,operation.nodeId,treeSelection?.part??'node',true);
  }
  function toggleTree(root:Widget,nodeId:string,expanded:boolean){
    if(findTreeNode(root,nodeId)?.locked)return;
    const descendants=new Set<string>();const collect=(node:Widget)=>{descendants.add(node.id);node.treeNode!.children.forEach(collect)};const node=findTreeNode(root,nodeId);if(node)collect(node);
    setRevealedTreeIds(ids=>ids.filter(id=>!descendants.has(id)));
    const next=changeTree(root,current=>setTreeNodeExpanded(current,nodeId,expanded));
    if(next&&!expanded&&treeSelection?.nodeId&&treeSelection.nodeId!==nodeId&&descendants.has(treeSelection.nodeId))selectTree(next,nodeId,'node');
  }
  function treeAuthoring(root:Widget):TreeAuthoringProps{
    return {revealedNodeIds:selected.includes(root.id)?revealedTreeIds:[],selectedNodeId:selectedTree?.id===root.id?treeSelection?.nodeId:undefined,selectedPart:treeSelection?.part,resolveLabel:resolveTableCell,
      onNodePointerDown:(node,part,event)=>{event.stopPropagation();if(event.button!==0||richEditing===node.treeNode!.label.id)return;event.preventDefault();if(root.locked||node.locked){setSelected([root.id]);setTreeSelection(null);return}selectTree(root,node.id,part)},
      onLabelDoubleClick:(node,event)=>{event.stopPropagation();if(root.locked||node.locked||node.treeNode!.label.locked)return;selectTree(root,node.id,'label');beginTextEdit(node.treeNode!.label)},
      onToggle:(node,expanded)=>toggleTree(root,node.id,expanded),
      textEditor:label=>richEditingWidget?.id===label.id?<RichTextEditor key={label.id} widget={richEditingWidget} document={doc} page={page} displayStyle={resolveTableCell(label).style} styleOverride={projectTextStyleOverride(effectPreview?.widgetId===label.id?label[effectPreview.field]??{}:resolveInteractionStylePatch(label))} onApply={applyRichText} onCancel={()=>setRichEditing(null)}/>:undefined,
      controls:selected.includes(root.id)?<TreeCanvasControls tree={root} onSelectOwner={()=>selectTree(root)} onOwnerPointerDown={event=>startDrag(event,root)}/>:undefined};
  }
  function treeKeyDown(event:KeyboardEvent):boolean{
    if(!selectedTreeNode||!selectedTree||!treeSelection)return false;
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
    if(mod&&['a','c','v','x','d','g'].includes(key)){event.preventDefault();setNotice('Select the whole tree to copy it, or edit the label text');return true}
    if(mod)return false;
    if(key==='delete'||key==='backspace'){event.preventDefault();treeOperation(selectedTree,{kind:'delete',nodeId:selectedTreeNode.id});return true}
    if(key==='enter'){event.preventDefault();selectTree(selectedTree,selectedTreeNode.id,'label');beginTextEdit(selectedTreeNode.treeNode!.label);return true}
    if(key==='escape'){event.preventDefault();selectTree(selectedTree);return true}
    if(['arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
      event.preventDefault();const nodes=visibleTreeNodes(selectedTree,revealedTreeIds),index=nodes.findIndex(node=>node.id===selectedTreeNode.id),data=selectedTreeNode.treeNode!;
      if(key==='arrowup'||key==='arrowdown'){const next=nodes[index+(key==='arrowup'?-1:1)];if(next)selectTree(selectedTree,next.id,treeSelection.part)}
      else if(key==='arrowright'){if(data.children.length&&!(data.expanded||revealedTreeIds.includes(selectedTreeNode.id)))toggleTree(selectedTree,selectedTreeNode.id,true);else if(data.children.length)selectTree(selectedTree,data.children[0].id,treeSelection.part)}
      else if(data.children.length&&(data.expanded||revealedTreeIds.includes(selectedTreeNode.id)))toggleTree(selectedTree,selectedTreeNode.id,false);else{const parent=treeNodeLocation(selectedTree,selectedTreeNode.id).parentId;if(parent)selectTree(selectedTree,parent,treeSelection.part)}
      return true;
    }
    return false;
  }
  function selectMenu(root:Widget,menu:Widget,cellId?:string){
    setTreeSelection(null);setTableSelection(null);setTool('select');setSelected([root.id]);setPointEditingId(null);surface.current?.focus({preventScroll:true});
    setMenuSelection({rootMenuId:root.id,menuId:menu.id,cellId});
    const path=menuAncestors(root,menu.id)??[root.id],child=cellId?menu.menu!.submenus.find(child=>child.menu!.parentCellId===cellId):undefined;
    setExpandedMenuIds(ids=>[...new Set([...ids,...path,...(child?[child.id]:[])])]);
  }
  function changeMenu(root:Widget,menuId:string,update:(menu:Widget)=>Widget):Widget|undefined{
    if(root.locked)return;
    try{
      const page=docRef.current.pages.find(item=>item.id===pageId),fresh=page?findWidget(page,root.id)??root:root;
      const next=updateMenu(fresh,menuId,update);
      if(JSON.stringify(fresh)!==JSON.stringify(next))changeWidgets(widgets.map(widget=>widget.id===root.id?next:widget));
      return next;
    }catch(error){setNotice(String(error));return undefined}
  }
  function menuOperation(root:Widget,menu:Widget,operation:MenuOperation){
    if(menu.locked)return;
    const next=changeMenu(root,menu.id,current=>{
      if(operation.kind==='insert')return insertMenuItem(current,operation.index);
      if(operation.kind==='delete')return deleteMenuItem(current,operation.cellId);
      if(operation.kind==='move')return moveMenuItem(current,operation.from,operation.to);
      if(operation.kind==='addSubmenu')return addSubmenu(current,operation.cellId);
      return deleteSubmenu(current,operation.cellId);
    });
    if(!next)return;const changed=findMenu(next,menu.id)!;
    if(operation.kind==='insert')selectMenu(next,changed,changed.menu!.table.table!.cells[operation.index].id);
    if(operation.kind==='addSubmenu'){const child=changed.menu!.submenus.find(child=>child.menu!.parentCellId===operation.cellId)!;selectMenu(next,child,child.menu!.table.table!.cells[0].id)}
    if(operation.kind==='delete'||operation.kind==='deleteSubmenu')selectMenu(next,changed,operation.kind==='delete'?undefined:operation.cellId);
  }
  function menuAuthoring(root:Widget):MenuAuthoringProps{
    return {
      openMenuIds:selected.includes(root.id)?expandedMenuIds:[],resolveCell:resolveTableCell,
      onCellPointerDown:(menu,cell,event)=>{event.stopPropagation();if(event.button!==0||richEditing===cell.id)return;event.preventDefault();if(root.locked||menu.locked||cell.locked){setSelected([root.id]);setMenuSelection(null);return}selectMenu(root,menu,cell.id)},
      onCellDoubleClick:(menu,cell,event)=>{event.stopPropagation();if(root.locked||menu.locked||cell.locked)return;selectMenu(root,menu,cell.id);beginTextEdit(cell)},
      onEditSubmenu:menu=>selectMenu(root,menu),
      textEditor:cell=>richEditingWidget?.id===cell.id?<RichTextEditor key={cell.id} widget={richEditingWidget} document={doc} page={page} displayStyle={resolveTableCell(cell).style} styleOverride={projectTextStyleOverride(effectPreview?.widgetId===cell.id?cell[effectPreview.field]??{}:resolveInteractionStylePatch(cell))} onApply={applyRichText} onCancel={()=>setRichEditing(null)}/>:undefined,
      controls:menu=>selected.includes(root.id)?<MenuCanvasControls menu={menu} selected={menuSelection?.menuId===menu.id} cellId={menuSelection?.menuId===menu.id?menuSelection.cellId:undefined} onSelectOwner={()=>selectMenu(root,menu)} onOwnerPointerDown={menu.id===root.id?event=>startDrag(event,root):undefined}/>:undefined,
    };
  }
  function menuKeyDown(event:KeyboardEvent):boolean{
    if(!selectedMenuRoot||!selectedMenu||!menuSelection)return false;
    const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey,cellId=menuSelection.cellId;
    if(key==='escape'){event.preventDefault();if(cellId)selectMenu(selectedMenuRoot,selectedMenu);else{setMenuSelection(null);setExpandedMenuIds([])}return true}
    if(!cellId){if(selectedMenu.id!==selectedMenuRoot.id&&(['delete','backspace','arrowup','arrowdown','arrowleft','arrowright'].includes(key)||mod&&['x','d','g'].includes(key))){event.preventDefault();setNotice('Edit the submenu using its menu controls');return true}return false}
    if(mod&&['a','c','v','x','d','g'].includes(key)){event.preventDefault();setNotice('Enter text editing for clipboard commands, or select the whole menu');return true}
    if(key==='delete'||key==='backspace'){event.preventDefault();menuOperation(selectedMenuRoot,selectedMenu,{kind:'delete',cellId});return true}
    if(['arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)){
      event.preventDefault();const cells=selectedMenu.menu!.table.table!.cells,index=cells.findIndex(cell=>cell.id===cellId),delta=key==='arrowup'||key==='arrowleft'||key==='tab'&&event.shiftKey?-1:1;
      selectMenu(selectedMenuRoot,selectedMenu,cells[Math.max(0,Math.min(cells.length-1,index+delta))].id);return true;
    }
    return false;
  }
  function changeTable(next:Widget,history=true){
    const existing=widgets.find(w=>w.id===next.id);if(!existing||JSON.stringify(existing)===JSON.stringify(next))return;
    changeWidgets(widgets.map(w=>w.id===next.id?next:w),history);
  }
  function selectTableCells(table:Widget,ids:string[],anchor?:string,additive=false){
    setMenuSelection(null);setTool('select');setSelected([table.id]);setPointEditingId(null);surface.current?.focus({preventScroll:true});
    setTableSelection(previous=>{const base=additive&&previous?.tableId===table.id?previous.cellIds:[];const all=ids.every(id=>base.includes(id));const cellIds=additive&&all?base.filter(id=>!ids.includes(id)):[...new Set([...base,...ids])];return cellIds.length?{tableId:table.id,cellIds,anchorCellId:anchor??cellIds[0],focusCellId:cellIds.includes(anchor??'')?anchor:cellIds[0]}:null});
  }
  function cellPointerDown(table:Widget,cell:Widget,event:ReactPointerEvent<HTMLDivElement>){
    event.stopPropagation();if(event.button!==0||richEditing===cell.id)return;
    if(table.locked||cell.locked){setSelected([table.id]);setTableSelection(null);return}
    event.preventDefault();const additive=event.shiftKey||event.ctrlKey||event.metaKey;
    const initial=additive&&tableSelection?.tableId===table.id?tableSelection.cellIds:[];
    selectTableCells(table,[cell.id],cell.id,additive);tableSelectionDrag.current={tableId:table.id,anchor:cell.id,initial};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function tableOperation(table:Widget,operation:TableOperation){
    if(table.locked)return;
    try{let next=operation.kind==='insert'?insertTableTrack(table,operation.axis,operation.indices[0]):operation.kind==='delete'?deleteTableTracks(table,operation.axis,operation.indices):moveTableTrack(table,operation.axis,operation.indices[0],operation.to!);changeTable(next)}catch(error){setNotice(String(error))}
  }
  function startTableResize(table:Widget){tableSelectionDrag.current=null;tableResize.current={document:docRef.current,table:structuredClone(table),wasSaved:saved}}
  function resizeTableTrack(axis:'row'|'column',index:number,value:number){const active=tableResize.current;if(!active)return;try{changeTable(setTableTrackSize(active.table,axis,[index],value),false)}catch(error){setNotice(String(error))}}
  function endTableResize(){const active=tableResize.current;tableResize.current=null;if(!active)return;if(JSON.stringify(active.document)!==JSON.stringify(docRef.current)){setPast(p=>[...p.slice(-99),active.document]);setFuture([])}else setSaved(active.wasSaved)}
  function pasteTableClipboard(text:string){
    if(!selectedTable||!tableSelection?.cellIds.length)return;
    changeTable(pasteTableText(selectedTable,tableSelection.cellIds[0],text));setNotice('Pasted into existing table cells');
  }
  function applyTablePaste(text:string){
    if(tablePaste?.existing){const table=widgets.find(w=>w.id===tablePaste.tableId);if(!table||!tablePaste.cellId)throw Error('The destination table is no longer available');changeTable(pasteTableText(table,tablePaste.cellId,text))}
    else {const grid=parseTableText(text),table=createWidget('table');table.table={columnWidths:Array(grid[0].length).fill(100),rowHeights:Array(grid.length).fill(30),cells:grid.flatMap(row=>row.map(text=>({...createWidget('tableCell'),text})))};const next=layoutTable(table);changeWidgets([...widgets,next]);setSelected([next.id]);setTableSelection(null)}
    setTablePaste(null);setTool('select');
  }
  function resolveTableCell(cell:Widget):Widget{
    const patch=effectPreview?.widgetId===cell.id?cell[effectPreview.field]??{}:resolveInteractionStylePatch(cell),projected=projectTextStyleOverride(patch);
    return {...cell,style:mergeWidgetStyle(cell.style,projected),...(cell.richText?{richText:applyRichTextStyle(cell.richText,projected)}:{})};
  }
  // Display copies only: keep adaptive run projection out of editing/drag source data.
  function resolveCanvasDisplay(source:Widget,editingPoints=false){
    const adaptiveStyle=resolveAdaptiveOverride(page,viewId,source.id)?.style;
    const effectPatch=editingPoints?{}:effectPreview?.widgetId===source.id?source[effectPreview.field]??{}:resolveInteractionStylePatch(source);
    const displayPatch=projectTextStyleOverride({...adaptiveStyle,...effectPatch});
    const originalStyle=(findWidget(page,source.id)??source).style;
    const resolvedStyle=editingPoints?source.style:effectPreview?.widgetId===source.id?mergeWidgetStyle(source.style,projectTextStyleOverride(effectPatch)):resolveSelectedStyle(source);
    const widget={...source,style:{...resolvedStyle,underline:Object.hasOwn(displayPatch,'underline')?displayPatch.underline:originalStyle.underline,strikethrough:Object.hasOwn(displayPatch,'strikethrough')?displayPatch.strikethrough:originalStyle.strikethrough},...(source.richText?{richText:applyRichTextStyle(source.richText,displayPatch)}:{})};
    return {widget,displayPatch};
  }
  useEffect(()=>{
    const owns=(event:ClipboardEvent)=>{const element=event.target as HTMLElement|null;return selectedTable&&tableSelection&&!preview&&!gallery&&!tablePaste&&!element?.closest('input,textarea,select,[contenteditable="true"]')};
    const onPaste=(event:ClipboardEvent)=>{if(!owns(event))return;event.preventDefault();try{pasteTableClipboard(event.clipboardData?.getData('text/plain')??'')}catch(error){setNotice(String(error))}};
    const onCopy=(event:ClipboardEvent)=>{if(!owns(event))return;event.preventDefault();const text=copyTableText(selectedTable!,tableSelection!.cellIds);tableClipboard.current=text;event.clipboardData?.setData('text/plain',text);if(event.type==='cut')removeSelected()};
    document.addEventListener('paste',onPaste);document.addEventListener('copy',onCopy);document.addEventListener('cut',onCopy);
    return()=>{document.removeEventListener('paste',onPaste);document.removeEventListener('copy',onCopy);document.removeEventListener('cut',onCopy)};
  });
  function tableKeyDown(event:KeyboardEvent):boolean{
    if(!selectedTable||!tableSelection)return false;
    const mod=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
    if(mod&&['c','v','x'].includes(key))return true;
    if(mod&&key==='a'){event.preventDefault();selectTableCells(selectedTable,selectedTable.table!.cells.map(cell=>cell.id));return true}
    if(mod&&['d','g'].includes(key)){event.preventDefault();setNotice('Select the whole table for this command');return true}
    if(key==='escape'){event.preventDefault();setTableSelection(null);return true}
    if(key==='delete'||key==='backspace'){event.preventDefault();removeSelected();return true}
    if(['arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)){
      event.preventDefault();const data=selectedTable.table!,at=tableCellCoordinates(selectedTable,tableSelection.focusCellId??tableSelection.cellIds[0]);if(!at)return true;
      let row=at.row,column=at.column;if(key==='tab'){const index=Math.max(0,Math.min(data.cells.length-1,at.row*data.columnWidths.length+at.column+(event.shiftKey?-1:1)));row=Math.floor(index/data.columnWidths.length);column=index%data.columnWidths.length}else {row=Math.max(0,Math.min(data.rowHeights.length-1,row+(key==='arrowdown'?1:key==='arrowup'?-1:0)));column=Math.max(0,Math.min(data.columnWidths.length-1,column+(key==='arrowright'?1:key==='arrowleft'?-1:0)))}
      const target=data.cells[row*data.columnWidths.length+column],anchor=tableSelection.anchorCellId??tableSelection.cellIds[0];
      setTableSelection({tableId:selectedTable.id,cellIds:event.shiftKey&&key!=='tab'?tableRectangleIds(selectedTable,anchor,target.id):[target.id],anchorCellId:event.shiftKey&&key!=='tab'?anchor:target.id,focusCellId:target.id});return true;
    }
    return false;
  }
  function layerResizeContext():LayerResizeContext{return {pageId:page.id,viewId,scopeId:panel?.id??null,stateId:activeState?.id,zoom,documentId:doc.id}}
  function planLayerResizeDocument(source:Document,original:Widget[],ids:string[],handle:keyof typeof LAYER_RESIZE_HANDLES,delta:(widget:Widget)=>{x:number;y:number},context:LayerResizeContext,modifiers:{control?:boolean;alt?:boolean;shift?:boolean}={},sharedSelection=false):Document|undefined{
    const targets=original.filter(widget=>ids.includes(widget.id));
    if(targets.length!==ids.length||targets.some(widget=>!widget.layer)){
      setNotice('Resize groups separately from ordinary widgets. No widgets were changed.');return;
    }
    try{
      const p=resolveAdaptivePage(source,source.pages.find(item=>item.id===context.pageId)!);
      const bounds=targets.map(widget=>layerAuthoringBounds(widget.layer!.widgets));
      const left=Math.min(...bounds.map(rect=>rect.x)),top=Math.min(...bounds.map(rect=>rect.y));
      const selectionRect=sharedSelection?{x:left,y:top,width:Math.max(...bounds.map(rect=>rect.x+rect.width))-left,height:Math.max(...bounds.map(rect=>rect.y+rect.height))-top}:undefined;
      const plans=targets.map(layer=>{
        const move=delta(layer);
        return move.x===0&&move.y===0?undefined:planAuthorLayerResize({layer,selectionRect,handle:LAYER_RESIZE_HANDLES[handle],delta:move,preserveAspect:false,modifiers,currentLayerId:context.scopeId&&findWidget(p,context.scopeId)?.layer?context.scopeId:undefined});
      });
      const failure=plans.find(result=>result&&!result.ok);
      if(failure&&!failure.ok){setNotice(`Group resize unavailable: ${failure.reason}`);return;}
      const patches=plans.flatMap(result=>result?.ok?result.patches:[]);
      if(!patches.length)return source;
      // The controller emits complete changed Location/Size pairs. Write those
      // pairs to the current slot without the general Affect-all-views diff.
      // AutoFit flags, when present, remain shared content.
      let base=p.widgets;
      const geometry=new Map<string,Partial<Pick<Widget,'x'|'y'|'width'|'height'>>>();
      for(const patch of patches){
        if(patch.geometry)geometry.set(patch.id,patch.geometry);
        if(patch.shapeText||!context.viewId&&patch.geometry)base=updateWidgetTree(base,patch.id,{...(!context.viewId?patch.geometry:undefined),...(patch.shapeText?{shapeText:patch.shapeText}:{})});
      }
      const next={...p,widgets:fitLayerTree(base),adaptiveViews:p.adaptiveViews.map(view=>{
        if(view.id!==context.viewId)return view;
        const overrides={...view.overrides};
        for(const [id,patch] of geometry)overrides[id]={...overrides[id],...patch};
        return {...view,overrides};
      })};
      const result=commitAdaptivePage(source,next);
      return JSON.stringify(result)===JSON.stringify(source)?source:result;
    }catch(error){setNotice(`Group resize unavailable: ${error instanceof Error?error.message:String(error)}`);return;}
  }
  function patchSelected(patch:Partial<Widget>,explicitTextStyle?:Partial<WidgetStyle>,styleIntent?:WidgetStyleEditIntent){
    const sizeEdit=Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height');
    if(sizeEdit&&widgets.some(widget=>selected.includes(widget.id)&&widget.layer)){
      const handle=Object.hasOwn(patch,'width')?(Object.hasOwn(patch,'height')?'se':'e'):'s';
      const result=planLayerResizeDocument(docRef.current,widgets,selected,handle,widget=>({x:patch.width===undefined?0:patch.width-widget.width,y:patch.height===undefined?0:patch.height-widget.height}),layerResizeContext());
      if(result&&result!==docRef.current){commit(result);setNotice('Group resized in current view');}
      return;
    }
    // Pin controls send one explicit field. Preserve every other selected
    // widget's own constraints, including for Layers whose paint is read-only.
    const pinPatch=explicitTextStyle&&Object.fromEntries(RESIZE_PIN_FIELDS.filter(key=>Object.hasOwn(explicitTextStyle,key)).map(key=>[key,explicitTextStyle[key]]));
    if(pinPatch&&Object.keys(pinPatch).length){
      const edit=(widget:Widget)=>({...widget,style:mergeWidgetStyle(widget.style,pinPatch)});
      if(selectedTree&&selectedTreeNode&&treeSelection){changeTree(selectedTree,root=>treeSelection.part==='label'?patchTreeLabel(root,selectedTreeNode.id,edit):updateTreeNode(root,selectedTreeNode.id,edit));return;}
      if(activeMenuRoot&&activeMenu&&localMenuSelection){changeMenu(activeMenuRoot,activeMenu.id,menu=>menuSelection?.cellId?patchMenuItems(menu,[menuSelection.cellId],edit):edit(menu));return;}
      if(selectedTable&&tableSelection){changeTable(patchTableCells(selectedTable,tableSelection.cellIds,edit));return;}
      changeWidgets(widgets.map(widget=>selected.includes(widget.id)?edit(widget):widget));return;
    }
    // Point geometry is a current-widget-only shared-content command, including the first box-to-path conversion.
    if(Object.hasOwn(patch,'vectorPath')){if(current&&patch.vectorPath)changePointPath(current.id,patch.vectorPath);return;}
    const targetStylePatch=(target:Widget,command:Partial<WidgetStyle>)=>filterLineStylePatch(target,resolveWidgetStyleCommand(target,command,styleIntent));
    if(styleIntent?.kind==='corners'){
      const edit=(target:Widget):Widget=>{
        if(!supportsCornerEditing(target))return target;
        if(styleIntent.effect){
          const field=styleIntent.effect;
          if(field==='hintStyle'&&target.type!=='input'&&target.type!=='textarea')return target;
          const previous=target[field]??{},next=editCornerOverride(target.style,previous,styleIntent.command);
          return next===previous?target:{...target,[field]:next};
        }
        const style=mergeWidgetStyle(target.style,resolveWidgetStyleCommand(target,{},styleIntent));
        return JSON.stringify(style)===JSON.stringify(target.style)?target:{...target,style};
      };
      if(selectedTree&&selectedTreeNode&&treeSelection){if(treeSelection.part==='label')changeTree(selectedTree,root=>patchTreeLabel(root,selectedTreeNode.id,edit));return}
      if(activeMenuRoot&&activeMenu){changeMenu(activeMenuRoot,activeMenu.id,menu=>menuSelection?.cellId?patchMenuItems(menu,[menuSelection.cellId],edit):edit(menu));return}
      if(selectedTable&&tableSelection){changeTable(patchTableCells(selectedTable,tableSelection.cellIds,edit));return}
      changeWidgets(widgets.map(widget=>selected.includes(widget.id)?edit(widget):widget));return;
    }
    if(selectedTree&&selectedTreeNode&&treeSelection){
      changeTree(selectedTree,root=>treeSelection.part==='label'?patchTreeLabel(root,selectedTreeNode.id,label=>{const changes={...patch};const stylePatch=explicitTextStyle??(patch.style?Object.fromEntries(Object.entries(patch.style).filter(([key,value])=>value!==current?.style[key as keyof WidgetStyle])):undefined);if(stylePatch){changes.style=mergeWidgetStyle(label.style,targetStylePatch(label,stylePatch));if(explicitTextStyle&&label.richText)changes.richText=applyRichTextStyle(label.richText,explicitTextStyle)}return changes}):updateTreeNode(root,selectedTreeNode.id,node=>({...node,...Object.fromEntries(Object.entries(patch).filter(([key])=>['name','notes','interactions','locked'].includes(key)))})));
      return;
    }
    if(activeMenuRoot&&activeMenu){try{changeMenu(activeMenuRoot,activeMenu.id,menu=>{
      if(menuSelection?.cellId&&menuCurrent?.type==='tableCell'){
        const stylePatch=explicitTextStyle??(patch.style?Object.fromEntries(Object.entries(patch.style).filter(([key,value])=>value!==menuCurrent.style[key as keyof WidgetStyle])):undefined);
        return patchMenuItems(menu,[menuSelection.cellId],cell=>{const changes={...patch};if(stylePatch){changes.style=mergeWidgetStyle(cell.style,targetStylePatch(cell,stylePatch));if(explicitTextStyle&&cell.richText)changes.richText=applyRichTextStyle(cell.richText,explicitTextStyle)}return changes});
      }
      const command=explicitTextStyle??(patch.style?Object.fromEntries(Object.entries(patch.style).filter(([key,value])=>value!==menu.style[key as keyof WidgetStyle])):undefined);const next={...menu,...patch,style:command?mergeWidgetStyle(menu.style,targetStylePatch(menu,command)):menu.style};return Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height')?resizeMenu(next,patch.width??menu.width,patch.height??menu.height):next;
    })}catch(error){setNotice(String(error))}return}

    if(selectedTable&&tableSelection){try{const onlyCurrent=Object.hasOwn(patch,'name')||Object.hasOwn(patch,'interactions')||Object.hasOwn(patch,'notes');const ids=onlyCurrent?[current!.id]:tableSelection.cellIds;const stylePatch=explicitTextStyle??(patch.style?Object.fromEntries(Object.entries(patch.style).filter(([key,value])=>value!==current?.style[key as keyof WidgetStyle])):undefined);const next=patchTableCells(selectedTable,ids,cell=>{const changes={...patch};if(stylePatch){changes.style=mergeWidgetStyle(cell.style,targetStylePatch(cell,stylePatch));if(explicitTextStyle&&cell.richText)changes.richText=applyRichTextStyle(cell.richText,explicitTextStyle)}return changes});changeTable(next)}catch(error){setNotice(String(error))}return}
    if(current?.type==='table'&&(Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height'))){try{changeTable(resizeTable({...current,...patch},patch.width??current.width,patch.height??current.height))}catch(error){setNotice(String(error))}return}
    // Preserve explicit commands: equal-color Solid must still clear a gradient.
    const styleChanges=explicitTextStyle??(patch.style?Object.fromEntries(Object.entries(patch.style).filter(([key,value])=>value!==current?.style[key as keyof Widget['style']])):undefined);
    // Node editing belongs to the current path, even when other widgets are selected.
    const {layer,inlineFrame,hintText,hintHideOn,hintStyle,readOnly,submitButtonId,maxLength,inputType,options,selectMode,multiple,selectedIndices,...sharedPatch}=patch;
    const formPatch=Object.fromEntries(['hintText','hintHideOn','hintStyle','readOnly','submitButtonId'].filter(key=>Object.hasOwn(patch,key)).map(key=>[key,patch[key as keyof Widget]]));
    const inputPatch=Object.fromEntries(['maxLength','inputType'].filter(key=>Object.hasOwn(patch,key)).map(key=>[key,patch[key as keyof Widget]]));
    const framePatch=Object.hasOwn(patch,'inlineFrame')?{inlineFrame}:undefined;

    const selectPatch=Object.fromEntries(Object.entries({options,selectMode,multiple,selectedIndices}).filter(([key])=>Object.hasOwn(patch,key)));
    changeWidgets(widgets.map(w=>{
      if(!selected.includes(w.id))return w;
      if(w.layer){const moved=moveLayer(w,patch.x??w.x,patch.y??w.y);return {...moved,...sharedPatch,x:moved.x,y:moved.y,width:moved.width,height:moved.height,rotation:w.rotation,text:'',richText:undefined,style:w.style,layer:w.id===current?.id&&layer?{...moved.layer!,propagate:layer.propagate}:moved.layer}}
      if(w.type==='inlineFrame')return {...w,...sharedPatch,...(w.id===current?.id?framePatch:undefined),text:'',richText:undefined,style:styleChanges?mergeWidgetStyle(w.style,targetStylePatch(w,styleChanges)):w.style};
      if(w.type==='menu'){const next={...w,...sharedPatch,style:styleChanges?mergeWidgetStyle(w.style,targetStylePatch(w,styleChanges)):w.style,text:w.text};return Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height')?resizeMenu(next,patch.width??w.width,patch.height??w.height):next}
      if(w.type==='tree')return {...w,...sharedPatch,text:w.text,richText:w.richText,style:styleChanges?mergeWidgetStyle(w.style,targetStylePatch(w,styleChanges)):w.style};
      if(w.type==='table'){const next={...w,...sharedPatch,style:w.style,text:w.text};return Object.hasOwn(patch,'width')||Object.hasOwn(patch,'height')?resizeTable(next,patch.width??w.width,patch.height??w.height):next}
      let next={...w,...sharedPatch,...(w.type==='input'||w.type==='textarea'?formPatch:undefined),...(w.type==='input'?inputPatch:undefined),...(w.type==='select'&&w.id===current?.id?selectPatch:undefined),style:styleChanges?mergeWidgetStyle(w.style,targetStylePatch(w,styleChanges)):w.style};
      if(Object.hasOwn(patch,'text'))next=replaceWidgetText(next,patch.text!);
      if(explicitTextStyle&&!viewId&&!placementAllViews)next=patchWidgetTextStyle(next,targetStylePatch(w,explicitTextStyle));
      return next;
    }),true,explicitTextStyle);
  }
  function undo(){if(drag.current||tableResize.current){pointerCancel();return}if(!past.length)return;resetVectorTools();const previous=past[past.length-1];setFuture(f=>[docRef.current,...f]);setPast(p=>p.slice(0,-1));setDoc(previous);setSelected([]);setSaved(false)}
  function redo(){if(drag.current||tableResize.current){pointerCancel();return}if(!future.length)return;resetVectorTools();setPast(p=>[...p,docRef.current]);setDoc(future[0]);setFuture(f=>f.slice(1));setSelected([]);setSaved(false)}
  function switchPage(id:string){resetVectorTools();setEditing(null);setPageId(id);setPageNodeId(id);setOpenPageIds(ids=>ids.includes(id)?ids:[...ids,id]);setPanelPath(null);setAdaptiveViewId(null);setSelected([]);setGallery(false)}
  function changePageTree(next:Document){if(next===docRef.current)return;resetVectorTools();commit(next);if(!next.pages.some(p=>p.id===page.id))switchPage(next.pages[0].id)}
  function showGallery(){resetVectorTools();setSelected([]);setEditing(null);setPanelPath(null);setGallery(true)}
  function closePageTab(id:string){const tabs=openPageIds.filter(value=>value!==id&&doc.pages.some(p=>p.id===value));setOpenPageIds(tabs);if(page.id===id&&!gallery){if(tabs.length)switchPage(tabs[Math.min(openPageIds.indexOf(id),tabs.length-1)]);else showGallery()}}
  function addWidget(type:WidgetType,x=100,y=100,orientation:MenuOrientation=menuOrientation){if(gallery)switchPage(page.id);const w=type==='menu'?createMenu(orientation,x,y):type==='tree'?createTree(x,y):createWidget(type,x,y);changeWidgets([...widgets,w]);setSelected([w.id]);setTool('select');setNotice(`${w.name} added`)}
  function placeSelection(placed:boolean,allViews=placementAllViews,ids=selected){
    if(ids===selected&&(localTreeSelection||localMenuSelection||selectedTable)){setNotice('Select the whole table, menu or tree to change placement');return}
    try{const p=resolveAdaptivePage(docRef.current,docRef.current.pages.find(p=>p.id===page.id)!);const next=setAdaptivePlacement(p,viewId,ids,placed,allViews);if(next!==p){resetVectorTools();commit(commitAdaptivePage(docRef.current,next));setNotice(placed?'Placed in '+(allViews?'all views':'this view'):'Unplaced from '+(allViews?'all views':'this view'))}}catch(error){setNotice(String(error))}
  }
  function removeSelected(allViews=placementAllViews){if(selectedTree&&selectedTreeNode){treeOperation(selectedTree,{kind:'delete',nodeId:selectedTreeNode.id});return}if(localMenuSelection&&!menuSelection?.cellId){setNotice('Delete a submenu using its parent item');return}if(selectedMenuRoot&&selectedMenu&&menuSelection?.cellId){menuOperation(selectedMenuRoot,selectedMenu,{kind:'delete',cellId:menuSelection.cellId});return}if(selectedTable&&tableSelection){changeTable(patchTableCells(selectedTable,tableSelection.cellIds,{text:''}));return}const p=resolveAdaptivePage(docRef.current,docRef.current.pages.find(p=>p.id===page.id)!);const next=deleteAdaptiveWidgets(p,viewId,selected,allViews);if(next!==p){resetVectorTools();commit(commitAdaptivePage(docRef.current,next))}setSelected([])}
  function copy(){if(localTreeSelection){setNotice('Select the whole tree, or edit its label text');return false}if(localMenuSelection){setNotice('Select the whole menu to copy it, or enter text editing');return false}if(selectedTable&&tableSelection){tableClipboard.current=copyTableText(selectedTable,tableSelection.cellIds);void navigator.clipboard?.writeText(tableClipboard.current).catch(()=>{});setNotice('Selected cells copied');return}tableClipboard.current=null;clipboard.current=structuredClone(widgets.filter(w=>selected.includes(w.id)));setNotice(`${clipboard.current.length} widget(s) copied`)}
  function paste(){if(localTreeSelection){setNotice('Select the whole tree, or edit its label text');return }if(localMenuSelection){setNotice('Enter text editing to paste into a menu item');return}if(selectedTable&&tableSelection){setTablePaste({existing:true,tableId:selectedTable.id,cellId:tableSelection.cellIds[0]});return}if(!clipboard.current.length)return;const copies=cloneWidgets(clipboard.current);changeWidgets([...widgets,...copies]);setSelected(copies.map(w=>w.id))}
  function duplicate(){if(localTreeSelection){setNotice('Select the whole tree, or edit its label text');return }if(localMenuSelection){setNotice('Select the whole menu to duplicate it');return}if(selectedTable){setNotice('Select the whole table to duplicate it');return}const copies=cloneWidgets(widgets.filter(w=>selected.includes(w.id)));if(!copies.length)return;changeWidgets([...widgets,...copies]);setSelected(copies.map(w=>w.id))}
  function group(){if(selectedTable||localMenuSelection||localTreeSelection)return;const result=groupIntoLayer(widgets,selected);if(!result.layer)return;changeWidgets(result.widgets,true,undefined,docRef.current,true);setSelected([result.layer.id]);setNotice('Selection grouped')}
  function ungroup(){if(selectedTable||localMenuSelection||localTreeSelection)return;const result=ungroupLayers(widgets,selected);if(result.widgets!==widgets){changeWidgets(result.widgets);setSelected(result.selected)}else changeWidgets(ungroupWidgets(widgets,selected))}
  function arrange(direction:'front'|'back'){if(selectedTable||localMenuSelection||localTreeSelection)return;const yes=widgets.filter(w=>selected.includes(w.id));const no=widgets.filter(w=>!selected.includes(w.id));changeWidgets(direction==='front'?[...no,...yes]:[...yes,...no])}
  function align(axis:'left'|'center'|'right'|'top'|'middle'|'bottom'){
    if(selectedTable||localMenuSelection||localTreeSelection)return;
    const targets=canvasWidgets.filter(w=>selected.includes(w.id)&&!w.locked);if(targets.length<2)return;
    const minX=Math.min(...targets.map(w=>w.x)),maxX=Math.max(...targets.map(w=>w.x+w.width)),minY=Math.min(...targets.map(w=>w.y)),maxY=Math.max(...targets.map(w=>w.y+w.height));
    changeWidgets(widgets.map(w=>!targets.some(target=>target.id===w.id)?w:translateWidget(w,(axis==='left'?minX:axis==='right'?maxX-w.width:axis==='center'?(minX+maxX-w.width)/2:w.x)-w.x,(axis==='top'?minY:axis==='bottom'?maxY-w.height:axis==='middle'?(minY+maxY-w.height)/2:w.y)-w.y)));
  }
  function addPage(){try{const result=addPageNode(docRef.current,{kind:'page',name:`Page ${doc.pages.length+1}`});changePageTree(result.document);switchPage(result.id)}catch(e){setNotice(String(e))}}
  function newDocument(d=createDocument()){if(!saved&&!window.confirm('Create a new document? Save your current changes first if needed.'))return;resetVectorTools();commit(d);switchPage(d.pages[0].id);setNotice('New document')}
  function download(contents:string,name:string,type:string){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function save(){try{const text=serializeDocument(doc);const result=window.desktop?await window.desktop.saveDocument(text,doc.name):(download(text,`${doc.name}.rea.json`,'application/json'),`${doc.name}.rea.json`);if(result){setSaved(true);setNotice(`Saved ${result}`)}}catch(e){setNotice(`Save failed: ${String(e)}`)}}
  function load(text:string){try{const next=parseDocument(text);resetVectorTools();commit(next);switchPage(next.pages[0].id);setSaved(true);setNotice('Document opened')}catch(e){setNotice(`Cannot open document: ${String(e)}`)}}
  async function open(){if(!saved&&!window.confirm('Open another document and replace unsaved changes?'))return;if(window.desktop){try{const file=await window.desktop.openDocument();if(file)load(file.text)}catch(e){setNotice(String(e))}}else fileInput.current?.click()}
  async function exportHtml(){try{const html=exportPrototype(doc);const result=window.desktop?await window.desktop.exportPrototype(html,doc.name):(download(html,`${doc.name}.html`,'text/html'),`${doc.name}.html`);if(result)setNotice(`Exported ${result}`)}catch(e){setNotice(`Export failed: ${String(e)}`)}}
  async function importRp(){
    if(!window.desktop){setNotice('Experimental .rp import is available in the Windows desktop application');return}
    if(!saved&&!window.confirm('Import an RP project and replace unsaved changes?'))return;
    setNotice('Reading RP project…');
    try{
      const file=await window.desktop.importRpDocument();if(!file){setNotice('RP import canceled');return}
      const result=importRpSemantics(file.semantics,file.name.replace(/\.rp$/i,''));
      const opened=result.report.widgetsImported>0;
      if(opened){resetVectorTools();commit(parseDocument(JSON.stringify(result.document)));switchPage(result.document.pages[0].id);setSaved(false)}
      setRpReport({name:file.name,report:result.report,opened});
      setNotice(opened?'Partial RP recovery opened. Review the import report.':'No supported widgets recovered. Review the import report.');
    }catch(e){setNotice(`RP import failed: ${String(e)}`)}
  }
  async function makeComponent(){const list=widgets.filter(w=>selected.includes(w.id));if(!list.length)return;const name=await prompt('Component name','Component 1');if(!name)return;try{commit({...doc,components:[...doc.components,createComponent(list,name)]});setLibraryTab('Components');setNotice('Component created. Click its name to insert a linked copy.')}catch(e){setNotice(String(e))}}
  function publishComponent(){if(!linkedInstance)return;try{commit(applyComponentInstanceChanges(doc,linkedInstance.id));setNotice('Component changes applied to all linked copies')}catch(e){setNotice(String(e))}}
  function detachComponent(){if(!linkedInstance)return;const next=detachComponentInstance(linkedInstance);commit({...doc,pages:doc.pages.map(p=>p.id===page.id?{...p,widgets:updateWidgetTree(p.widgets,linkedInstance.id,()=>({...next,componentId:undefined,componentInstance:undefined}))}:p)});setNotice('Component detached; this copy is now a regular panel')}
  function startDrag(e:ReactPointerEvent,w:Widget,handle?:string){if(e.button!==0||w.placed===false||!scopePlaced)return;setTreeSelection(null);setMenuSelection(null);setTableSelection(null);e.stopPropagation();if(editing===w.id)return;if(pointEditing){setPointEditingId(null);setVectorDraft(null)}const groupIds=w.groupId?canvasWidgets.filter(a=>a.groupId===w.groupId).map(a=>a.id):[w.id];const ids=(e.shiftKey?[...new Set([...selected,...groupIds])]:selected.includes(w.id)?selected:groupIds).filter(id=>canvasWidgets.some(w=>w.id===id));const layerResize=Boolean(handle&&widgets.some(widget=>ids.includes(widget.id)&&widget.layer));if(layerResize&&ids.some(id=>!widgets.find(widget=>widget.id===id)?.layer)){setNotice('Resize groups separately from ordinary widgets. No widgets were changed.');return;}setSelected(ids);if(w.locked)return;drag.current={kind:handle?'resize':'move',startX:e.clientX,startY:e.clientY,original:structuredClone(widgets),ids,handle,document:docRef.current,wasSaved:saved,...(layerResize?{layerResize:layerResizeContext()}:{})};e.currentTarget.setPointerCapture(e.pointerId)}
  function point(e:ReactPointerEvent){const rect=surface.current!.getBoundingClientRect();return{x:(e.clientX-rect.left)/zoom,y:(e.clientY-rect.top)/zoom}}
  function canvasDown(e:ReactPointerEvent){if(e.button!==0)return;setTreeSelection(null);setRevealedTreeIds([]);setTableSelection(null);if(tool==='hand'||tool==='pen')return;const p=point(e);if(tool!=='select'){addWidget(tool,p.x,p.y);return}setPointEditingId(null);if(!e.shiftKey)setSelected([]);drag.current={kind:'marquee',startX:p.x,startY:p.y,original:widgets,ids:[],initialSelection:e.shiftKey?selected.filter(id=>canvasWidgets.some(w=>w.id===id)):[]};setMarquee({x:p.x,y:p.y,width:0,height:0});e.currentTarget.setPointerCapture(e.pointerId)}
  function pointerMove(e:ReactPointerEvent){const gridDrag=tableSelectionDrag.current;if(gridDrag){const table=widgets.find(w=>w.id===gridDrag.tableId),id=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-table-cell-id]')?.dataset.tableCellId;if(table&&id&&table.table!.cells.some(cell=>cell.id===id))setTableSelection({tableId:table.id,anchorCellId:gridDrag.anchor,focusCellId:id,cellIds:[...new Set([...gridDrag.initial,...tableRectangleIds(table,gridDrag.anchor,id)])]});return}const d=drag.current;if(!d)return;if(d.kind==='marquee'){const p=point(e);const r={x:Math.min(p.x,d.startX),y:Math.min(p.y,d.startY),width:Math.abs(p.x-d.startX),height:Math.abs(p.y-d.startY)};setMarquee(r);setSelected([...new Set([...(d.initialSelection??[]),...d.original.filter(w=>w.placed!==false&&rotatedBoundsIntersect(w.layer?{...w,rotation:0}:w,r)).map(w=>w.id)])]);return}let dx=(e.clientX-d.startX)/zoom,dy=(e.clientY-d.startY)/zoom;if(snap){dx=Math.round(dx/8)*8;dy=Math.round(dy/8)*8}if(e.shiftKey&&d.kind==='move'){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0}if(d.layerResize&&d.document){const result=planLayerResizeDocument(d.document,d.original,d.ids,(d.handle??'se') as keyof typeof LAYER_RESIZE_HANDLES,()=>({x:dx,y:dy}),d.layerResize,{control:e.ctrlKey,alt:e.altKey,shift:e.shiftKey},true);const next=result??d.document;if(JSON.stringify(next)!==JSON.stringify(docRef.current)){docRef.current=next;setDoc(next);}setSaved(next===d.document?(d.wasSaved??false):false);return;}if(dx===0&&dy===0){changeWidgets(d.original,false,undefined,d.document);return}changeWidgets(d.original.map(w=>{if(!d.ids.includes(w.id)||w.locked||w.placed===false)return w;if(d.kind==='move')return translateWidget(w,Math.round(w.x+dx)-w.x,Math.round(w.y+dy)-w.y);if(w.layer)return w;const h=d.handle??'se';const {width,height}=resizeRotatedBounds(w,h,{x:dx,y:dy});const resized=w.type==='menu'?resizeMenu(w,Math.max(w.menu!.padding[1]+w.menu!.padding[3]+w.menu!.table.table!.columnWidths.length,width),Math.max(w.menu!.padding[0]+w.menu!.padding[2]+w.menu!.table.table!.rowHeights.length,height)):w.type==='table'?resizeTable(w,Math.max(w.table!.columnWidths.length,width),Math.max(w.table!.rowHeights.length,height)):{...w,width:width,height:height};return{...resized,...anchorRotatedResize(w,h,resized.width,resized.height)}}),false,undefined,d.document)}
  function pointerUp(){tableSelectionDrag.current=null;const d=drag.current;drag.current=null;setMarquee(null);if(d?.document){if(JSON.stringify(d.document)!==JSON.stringify(docRef.current)){setPast(p=>[...p.slice(-99),d.document!]);setFuture([])}else setSaved(d.wasSaved??false)}}
  function pointerCancel(){tableSelectionDrag.current=null;const tableDrag=tableResize.current;tableResize.current=null;if(tableDrag){docRef.current=tableDrag.document;setDoc(tableDrag.document);setSaved(tableDrag.wasSaved)}const d=drag.current;drag.current=null;setMarquee(null);if(d?.document){docRef.current=d.document;setDoc(d.document);setSaved(d.wasSaved??false)}}
  function widgetDoubleClick(event:React.MouseEvent,w:Widget){
    event.stopPropagation();
    if(w.layer){if(!w.locked){setPanelPath(w.id);setSelected([]);setEditing(null);setRichEditing(null)}return}
    if(w.type==='inlineFrame'){setFrameTargetEditing(w.id);return}
    if(['table','menu','tree','treeNode'].includes(w.type)){setTreeSelection(null);setMenuSelection(null);setTableSelection(null);return}
    const normal=widgets.find(source=>source.id===w.id)??w;
    const editPath=!vectorEditPathUnsupportedReason(normal)?resolveVectorEditPath(normal):undefined;
    if(editPath&&!normal.locked&&!normal.hidden){const rect=surface.current!.getBoundingClientRect();const p=canvasToVectorPoint({x:(event.clientX-rect.left)/zoom,y:(event.clientY-rect.top)/zoom},normal);const border=vectorSegments(editPath).some(segment=>{const q=vectorSegmentPoint(segment,closestVectorT(segment,p,normal.width,normal.height));return Math.hypot((p.x-q.x)*normal.width,(p.y-q.y)*normal.height)*zoom<=10});if(border){setSelected([normal.id]);enterPointEditing(normal);return}}
    if(w.type==='panel'||w.type==='repeater'){setPanelPath(w.id);setSelected([])}else{setPointEditingId(null);beginTextEdit(w)}
  }
  useEffect(()=>{setRecovery('pending');const timer=setTimeout(()=>{try{localStorage.setItem(CACHE_KEY,serializeDocument(doc));setRecovery('saved')}catch{setRecovery('failed');setNotice('Autosave unavailable. Save a project file to keep your work.')}},500);return()=>clearTimeout(timer)},[doc]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable)return;const mod=e.ctrlKey||e.metaKey;const key=e.key.toLowerCase();if(key==='escape'&&drag.current?.layerResize){e.preventDefault();pointerCancel();setNotice('Group resize cancelled');return;}if(preview){if(key==='escape')setPreview(false);return}if(gallery&&!(mod&&['n','s','o','z','y'].includes(key))&&key!=='f5')return;if(mod&&key==='p'){e.preventDefault();if(e.altKey)editPoints();else if(e.shiftKey)setTool('pen');return}if(treeKeyDown(e))return;if(menuKeyDown(e))return;if(tableKeyDown(e))return;if(vectorTools.current?.keyDown(e))return;if(!mod&&key==='p'){e.preventDefault();setEditing(null);setTool('pen');return}if(pointEditing&&key==='enter'){e.preventDefault();setPointEditingId(null);beginTextEdit(current!);return}if(mod){if(['n','s','o','z','y','a','c','v','x','d','g'].includes(key))e.preventDefault();if(key==='n')newDocument();if(key==='s')void save();if(key==='o')void open();if(key==='z')e.shiftKey?redo():undo();if(key==='y')redo();if(key==='a')setSelected(canvasWidgets.map(w=>w.id));if(key==='c')copy();if(key==='v')paste();if(key==='x'){if(copy()!==false)removeSelected()}if(key==='d')duplicate();if(key==='g')e.shiftKey?ungroup():group();return}if(key==='delete'||key==='backspace'){e.preventDefault();removeSelected()}if(key==='escape'){setSelected([]);setQuick(false);setMenu(null);setTool('select')}if(key==='/'){e.preventDefault();setQuick(true)}if(key==='f5'){e.preventDefault();setPreview(true)}if(key==='enter'&&current)beginTextEdit(current);if(['arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&selected.length){e.preventDefault();if(!canvasWidgets.some(w=>selected.includes(w.id)&&!w.locked))return;const n=e.shiftKey?10:1;changeWidgets(widgets.map(w=>selected.includes(w.id)&&!w.locked&&w.placed!==false&&scopePlaced?translateWidget(w,key==='arrowright'?n:key==='arrowleft'?-n:0,key==='arrowdown'?n:key==='arrowup'?-n:0):w))}if(key==='v')setTool('select');if(key==='r')setTool('box');if(key==='o')setTool('ellipse');if(key==='t')setTool('text')};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)});
  const menuItems:Record<string,[string,()=>void,string?][]>= {
    File:[['New',()=>newDocument(),'Ctrl+N'],['Open…',()=>void open(),'Ctrl+O'],['Import Axure .rp (experimental)…',()=>void importRp()],['Save as…',()=>void save(),'Ctrl+S'],['Export HTML…',()=>void exportHtml()],['Open interactive example',()=>newDocument(createDemoDocument())]],
    Edit:[['Undo',undo,'Ctrl+Z'],['Redo',redo,'Ctrl+Y'],['Copy',copy,'Ctrl+C'],['Cut',()=>{if(copy()!==false)removeSelected()},'Ctrl+X'],['Paste',paste,'Ctrl+V'],['Paste as table…',()=>setTablePaste({existing:false})],['Duplicate',duplicate,'Ctrl+D'],['Delete',()=>removeSelected(),'Del'],['Place in View',()=>placeSelection(true,false)],['Unplace from View',()=>placeSelection(false,false)],['Place in All Views',()=>placeSelection(true,true)],['Unplace from All Views',()=>placeSelection(false,true)],['Delete from All Views',()=>removeSelected(true)]],
    View:[['Gallery',showGallery],['Show grid',()=>setGrid(!grid)],['Snap to grid',()=>setSnap(!snap)],['Zoom to 100%',()=>setZoom(1)],['Zoom to 75%',()=>setZoom(.75)],['Zoom to 50%',()=>setZoom(.5)]],
    Arrange:[['Group',group,'Ctrl+G'],['Ungroup',ungroup,'Ctrl+Shift+G'],['Bring to front',()=>arrange('front')],['Send to back',()=>arrange('back')],['Align left',()=>align('left')],['Align center',()=>align('center')],['Align right',()=>align('right')],['Create component',makeComponent]],
    Project:[['Rename project',async()=>{const name=await prompt('Project name',doc.name);if(name?.trim())commit({...doc,name:name.trim()})}],['Global variables',()=>setVariables(true)],['Prototype settings…',()=>setPrototypeSettings(true)],['Preview',()=>setPreview(true),'F5']],
    Help:[['Keyboard shortcuts',()=>setNotice('V select · R rectangle · O ellipse · T text · / quick actions · F5 preview · Ctrl+S save')],['Implementation status',()=>setNotice('Work in progress. RP import is partial; native write-back and cloud collaboration are unavailable.')]],
  };
  return <div className="application" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}>
    <input type="file" accept=".json" hidden ref={fileInput} onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>25*1024*1024)setNotice('File exceeds 25 MB');else load(await f.text())}e.target.value=''}}/>
    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden ref={imageInput} onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>8*1024*1024){setNotice('Image exceeds 8 MB');return}if(f.type==='image/svg+xml'){setNotice('Use PNG, JPEG or WebP images for now');return}const reader=new FileReader();reader.onload=()=>{const w={...createWidget('image',80,80),imageSrc:String(reader.result),name:f.name};changeWidgets([...widgets,w]);setSelected([w.id])};reader.readAsDataURL(f)}e.target.value=''}}/>
    <header className="titlebar"><span className="app-mark">R<span>P</span></span><span>{doc.name}{saved?'':' •'} — REA Prototype Studio</span><span className="title-hint">RP 11 reconstruction · development</span></header>
    <nav className="menubar">{Object.keys(menuItems).map(name=><div className="menu-anchor" key={name}><button className={menu===name?'open':''} onClick={()=>setMenu(menu===name?null:name)}>{name}</button>{menu===name&&<div className="dropdown-menu">{menuItems[name].map(([label,action,shortcut])=><button key={label} onClick={()=>{setMenu(null);action()}}><span>{label}</span><kbd>{shortcut}</kbd></button>)}</div>}</div>)}<span className="toolbar-spacer"/><span className="autosave">{recovery==='saved'&&<Check size={11}/>} {recovery==='saved'?'Recovery copy saved locally':recovery==='pending'?'Saving recovery copy…':'Recovery unavailable — save a file'}</span></nav>
    <div className="main-toolbar">
      <button title="Select (V)" className={tool==='select'?'active':''} onClick={()=>setTool('select')}><MousePointer2 size={21}/><ChevronDown size={10}/></button>
      <button title="Import image" onClick={()=>imageInput.current?.click()}><ImageIcon size={21}/><ChevronDown size={10}/></button>
      <button title="Text (T)" className={tool==='text'?'active':''} onClick={()=>setTool('text')}><Type size={22}/></button>
      <button title="Rectangle (R)" className={tool==='box'?'active':''} onClick={()=>setTool('box')}><Square size={21}/></button>
      <button title="Ellipse (O)" className={tool==='ellipse'?'active':''} onClick={()=>setTool('ellipse')}><Circle size={20}/></button>
      <button title="Pen (P)" aria-label="Pen (P)" className={tool==='pen'?'active':''} onClick={()=>{setEditing(null);setTool('pen')}}><PenTool size={20}/></button>{current?.vectorPath&&!current.locked&&!current.hidden&&<button className="vector-edit-points-button" disabled={!!pointEditingUnavailable} title={pointEditingUnavailable?'Point editing is unavailable for this border or corner configuration.':undefined} onClick={()=>{if(pointEditing){setPointEditingId(null);setVectorDraft(null)}else editPoints()}}>{pointEditing?'Done editing points':'Edit points'}</button>}<button title="Dynamic panel" onClick={()=>addWidget('panel')}><Layers size={20}/></button><button title="Line" onClick={()=>setTool('line')}><Minus size={22}/></button>
      <button title="Quick actions (/)" onClick={()=>setQuick(true)}><span className="slash-icon">/</span></button>
      <i className="separator"/><button title="Undo" disabled={!past.length} onClick={undo}><Undo2 size={19}/></button><button title="Redo" disabled={!future.length} onClick={redo}><Redo2 size={19}/></button>
      <i className="separator"/><button title="Bring to front" disabled={!selected.length} onClick={()=>arrange('front')}><ArrowUpToLine size={19}/></button><button title="Send to back" disabled={!selected.length} onClick={()=>arrange('back')}><ArrowDownToLine size={19}/></button><button title="Group" disabled={selected.length<2} onClick={group}><Group size={20}/></button><button title="Ungroup" disabled={!current?.groupId&&!current?.layer} onClick={ungroup}><Ungroup size={20}/></button>
      <div className="toolbar-spacer"/><select aria-label="Zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[.25,.5,.75,1,1.25,1.5,2].map(z=><option key={z} value={z}>{z*100}%</option>)}</select><button title="Save" onClick={()=>void save()}><Save size={19}/></button><button className="preview-button" title="Preview (F5)" onClick={()=>setPreview(true)}><Play size={17} fill="currentColor"/></button><button className="share-button" onClick={()=>void exportHtml()}><Upload size={17}/> Export HTML <ChevronDown size={12}/></button>
    </div>
    <div className="style-toolbar">{current?.layer?<span>{current.name} · {current.layer.widgets.length} members · Double-click to edit group</span>:current&&!['table','menu','tree','treeNode','inlineFrame'].includes(current.type)?<><label>Style <select aria-label="Widget style preset" onChange={e=>{const s=doc.styles.find(x=>x.id===e.target.value);if(s)patchSelected({style:s.style},s.style)}} defaultValue=""><option value="">Default</option>{doc.styles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><i className="separator"/><select aria-label="Font family" value={current.style.fontFamily} onChange={e=>patchSelected({style:{...current.style,fontFamily:e.target.value}},{fontFamily:e.target.value})}>{[...new Set(['Arial','Roboto','Open Sans','Inter','Segoe UI','Georgia','Times New Roman','Courier New',current.style.fontFamily])].map(f=><option key={f}>{f}</option>)}</select><input aria-label="Font size" type="number" min="1" max="512" value={current.style.fontSize} onChange={e=>patchSelected({style:{...current.style,fontSize:Math.max(1,Number(e.target.value))}},{fontSize:Math.max(1,Number(e.target.value))})}/><button className={current.style.fontWeight>=600?'active':''} onClick={()=>patchSelected({style:{...current.style,fontWeight:current.style.fontWeight>=600?400:700}},{fontWeight:current.style.fontWeight>=600?400:700})}><b>B</b></button>{(['left','center','right'] as const).map((a,i)=>{const Icon=[AlignLeft,AlignCenter,AlignRight][i];return <button key={a} onClick={()=>patchSelected({style:{...current.style,textAlign:a}},{textAlign:a})}><Icon size={16}/></button>})}<i className="separator"/><label>Fill <input type="color" aria-label="Fill color" value={current.style.fill.startsWith('#')?current.style.fill:'#ffffff'} onChange={e=>patchSelected({style:{...current.style,fill:e.target.value}},{fill:e.target.value})}/></label><label>Border <input type="color" aria-label="Border color" value={current.style.stroke.startsWith('#')?current.style.stroke:'#cccccc'} onChange={e=>patchSelected({style:{...current.style,stroke:e.target.value}},{stroke:e.target.value})}/></label><LineStyleToolbar key={`${current.id}/${page.id}/${viewId??'base'}`} widget={current} onChange={command=>patchSelected({style:mergeWidgetStyle(current.style,command)},command)}/><i className="separator"/><span>{selected.length} selected</span></>:<><label>Dimensions <select aria-label="Page dimensions" value={`${page.width}`} onChange={e=>patchPage({width:Number(e.target.value)})}>{[...new Set([1440,1280,1200,1024,768,390,page.width])].sort((a,b)=>b-a).map(n=><option key={n} value={n}>{n===1440?'Desktop':n===390?'Mobile':n} · {n}px</option>)}</select></label><button onClick={async()=>{const name=await prompt('Adaptive view name','Mobile');if(name){try{const next=createAdaptiveView(page,name,390,{baseViewId:viewId??undefined});commit(commitAdaptivePage(docRef.current,next));setAdaptiveViewId(next.adaptiveViews.at(-1)!.id);setSelected([])}catch(error){setNotice(String(error))}}}}><Plus size={14}/> Adaptive views</button><i className="separator"/><label>Page fill <input type="color" value={page.background} onChange={e=>patchPage({background:e.target.value})}/></label></>}<span className="toolbar-spacer"/><button className={grid?'active':''} onClick={()=>setGrid(!grid)} title="Show grid"><Grid2X2 size={16}/></button><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/> Snap</label></div>
    <main className="workspace" onClick={()=>menu&&setMenu(null)}>
      <aside className="left-pane"><section className="pages-pane"><div className="pane-tabs">{['Pages','Outline'].map(t=><button key={t} className={leftTab===t?'selected':''} onClick={()=>setLeftTab(t)}>{t}</button>)}</div>
      {leftTab==='Pages'?<PageTree key={doc.id} document={doc} selectedId={pageNodeId} activePageId={page.id} search={search} onSearch={setSearch} onSelect={setPageNodeId} onOpen={switchPage} onChange={changePageTree} onNotice={setNotice}/>:<><div className="pane-actions"><Search size={15}/><input aria-label="Search pages and widgets" placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)}/></div><label className="outline-placement-filter">Placement <select aria-label="Outline placement filter" value={placementFilter} onChange={e=>setPlacementFilter(e.target.value as typeof placementFilter)}><option value="all">All widgets</option><option value="placed">Placed</option><option value="unplaced">Unplaced</option></select></label><div className="tree-list">{widgets.filter(w=>w.name.toLowerCase().includes(search.toLowerCase())&&(placementFilter==='all'||(w.placed!==false)===(placementFilter==='placed'))).slice().reverse().map(w=><div key={w.id}><div data-outline-widget-id={w.id} data-placed={w.placed!==false} className={'tree-row '+(w.placed===false?'is-unplaced ':'')+(selected.includes(w.id)&&!selectedTable?'selected':'')} onClick={()=>{setTreeSelection(null);setRevealedTreeIds([]);setMenuSelection(null);setTableSelection(null);setSelected([w.id])}}><Square size={13}/><span>{w.name}{w.placed===false&&<small> · Unplaced</small>}</span><button title={w.placed===false?'Place in view':'Unplace from view'} onClick={e=>{e.stopPropagation();placeSelection(w.placed===false,placementAllViews,[w.id])}}>{w.placed===false?<Plus size={12}/>:<Minus size={12}/>}</button><button title="Toggle hidden" onClick={e=>{e.stopPropagation();changeWidgets(widgets.map(x=>x.id===w.id?{...x,hidden:!x.hidden}:x))}}>{w.hidden?<EyeOff size={12}/>:<Eye size={12}/>}</button><button title="Toggle lock" onClick={e=>{e.stopPropagation();changeWidgets(widgets.map(x=>x.id===w.id?{...x,locked:!x.locked}:x))}}>{w.locked?<Lock size={12}/>:<Unlock size={12}/>}</button></div>{w.layer&&<LayerOutlineEntries layer={w} onSelect={(parent,child)=>{if(parent.locked)return;resetVectorTools();setPanelPath(parent.id);setSelected([child.id])}}/>}{w.tree&&<TreeOutlineEntries tree={w} selection={selectedTree?.id===w.id?treeSelection:null} onSelect={(node,part)=>selectTree(w,node.id,part,true)}/>} {w.menu&&<MenuOutlineEntries menu={w} selection={selectedMenuRoot?.id===w.id?menuSelection:null} onSelect={(menu,cellId)=>selectMenu(w,menu,cellId)}/>} {w.table&&<TableOutlineEntries table={w} selection={selectedTable?.id===w.id?tableSelection:null} onSelect={(cell,additive)=>selectTableCells(w,[cell.id],cell.id,additive)}/>}</div>)}</div></>}</section>
      <section className="library-pane"><div className="pane-tabs">{['Libraries','Components'].map(t=><button key={t} className={libraryTab===t?'selected':''} onClick={()=>setLibraryTab(t)}>{t}</button>)}</div>{libraryTab==='Libraries'?<><div className="library-heading"><span>Default</span><ChevronDown size={13}/></div><div className="library-label">Common widgets</div><div className="widget-library">{LIBRARY.map(({type,name,icon:Icon,key,orientation})=><button draggable key={key??type} title={`Drag ${name} onto the canvas`} onDragStart={e=>e.dataTransfer.setData('application/x-rea-widget',orientation?JSON.stringify({type,orientation}):type)} onDoubleClick={()=>addWidget(type,100,100,orientation)} onClick={()=>{if(orientation)setMenuCreationOrientation(orientation);setTool(type)}} className={tool===type&&(!orientation||orientation===menuOrientation)?'chosen':''}><Icon size={29} strokeWidth={1.15}/><span>{name}</span></button>)}</div><p className="library-tip">Drag to canvas · double-click to insert</p></>:<div className="component-list"><button className="create-component" onClick={makeComponent} disabled={!selected.length}><Plus size={14}/> Create from selection</button><button disabled={!linkedInstance} onClick={publishComponent}>Update linked copies</button><button disabled={!linkedInstance} onClick={detachComponent}>Detach selected instance</button>{doc.components.map(c=><button key={c.id} onClick={()=>{try{const instance=createComponentInstance(c);changeWidgets([...widgets,instance]);setSelected([instance.id])}catch(e){setNotice(String(e))}}}><Layers size={23}/><span>{c.name}</span></button>)}</div>}</section></aside>
      <section className="canvas-pane"><div className="page-tabs"><button className={gallery?'selected':''} onClick={showGallery}><Grip size={13}/> Gallery</button><PageTabs pages={doc.pages} ids={openPageIds} activeId={gallery?null:page.id} onOpen={switchPage} onClose={closePageTab} onReorder={setOpenPageIds} onCloseOthers={id=>{setOpenPageIds([id]);switchPage(id)}} onCloseAll={()=>{setOpenPageIds([]);showGallery()}}/>{panel&&<><ChevronRight size={12}/><button aria-label={`Exit ${panel.name}`} onClick={exitScope}>{panel.name} / {panel.layer?'Group':panel.type==='repeater'?'Item template':activeState?.name}<X size={12}/></button></>}<span className="toolbar-spacer"/><span className="canvas-size">{canvasWidth} × {canvasHeight}</span></div><AdaptiveSetControls document={doc} page={page} onChange={commit} onAssign={()=>{setAdaptiveViewId(null);setSelected([]);setEffectPreview(null)}}/><label className="placement-scope"><input type="checkbox" checked={placementAllViews} onChange={e=>setPlacementAllViews(e.target.checked)}/>Affect all views</label><AdaptiveControls page={page} viewId={viewId} onSelectView={id=>{setAdaptiveViewId(id);setSelected([])}} onChange={next=>commit(commitAdaptivePage(docRef.current,next))}/>
      {gallery?<div className="gallery"><div className="gallery-title"><h2>Pages</h2><button onClick={addPage}><Plus size={16}/> Add page</button></div><div className="gallery-grid">{doc.pages.map(p=><button key={p.id} onDoubleClick={()=>switchPage(p.id)} onClick={()=>switchPage(p.id)}><div className="page-thumbnail"><div style={{width:p.width,height:p.height,transform:`scale(${220/p.width})`,transformOrigin:'0 0',background:p.background}}>{p.widgets.filter(w=>w.placed!==false).map(w=><div key={w.id} className={`widget ${w.type}`} style={widgetStyle(w)}><WidgetContent widget={w}/></div>)}</div></div><span><FileText size={14}/>{p.name}</span></button>)}</div></div>:<div className="canvas-scroll" onWheel={e=>{if(e.ctrlKey){e.preventDefault();setZoom(z=>Math.max(.25,Math.min(2,z+(e.deltaY<0?.1:-.1))))}}}><div className="canvas-extent" style={{width:Math.max(1500,canvasWidth*zoom+160),height:Math.max(1100,canvasHeight*zoom+180)}}><div className="ruler-x">{Array.from({length:Math.ceil(canvasWidth/100)+3},(_,i)=><span key={i} style={{left:20+i*100*zoom}}>{i*100}</span>)}</div><div className="ruler-y">{Array.from({length:Math.ceil(canvasHeight/100)+3},(_,i)=><span key={i} style={{top:20+i*100*zoom}}>{i*100}</span>)}</div><div ref={surface} tabIndex={-1} className={`canvas-surface ${grid?'grid-visible':''} ${tool!=='select'?'drawing':''}`} style={{width:canvasContainer?.width??canvasWidth,height:canvasContainer?.height??canvasHeight,backgroundColor:page.background,transform:`scale(${zoom})`}} onPointerDown={canvasDown} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const payload=e.dataTransfer.getData('application/x-rea-widget');let type=payload as WidgetType,orientation:MenuOrientation|undefined;try{if(payload.startsWith('{')){const data=JSON.parse(payload);type=data.type;orientation=data.orientation==='vertical'?'vertical':'horizontal'}}catch{return}if(!LIBRARY.some(w=>w.type===type))return;const rect=surface.current!.getBoundingClientRect();addWidget(type,(e.clientX-rect.left)/zoom,(e.clientY-rect.top)/zoom,orientation)}}>
        {canvasWidgets.map(source=>{const editingPoints=pointEditing&&source.id===current?.id;const {widget:w,displayPatch}=resolveCanvasDisplay(source,editingPoints);const editPath=editingPoints?(vectorDraft?.id===w.id?vectorDraft.path:preparedVectorPath):undefined;const staticLayout=getStaticRepeaterLayout(w);return <div key={w.id} className={`widget editor-widget ${w.type} ${selected.includes(w.id)?'is-selected':''} ${w.hidden?'is-hidden':''}`} style={{...widgetStyle(w,true,staticLayout&&!staticLayout.error?staticLayout:undefined),...(staticLayout&&!staticLayout.error?{width:staticLayout.width,height:staticLayout.height}:{}),outline:w.locked&&selected.includes(w.id)?'1px solid #d38d32':undefined}} onPointerDown={e=>startDrag(e,source)} onDoubleClick={e=>widgetDoubleClick(e,source)}><WidgetContent widget={editPath?{...w,type:'path',vectorPath:editPath}:w} resolved={true} resolveChildDisplay={child=>resolveCanvasDisplay(child).widget} tableAuthoring={w.type==='table'?{onCellPointerDown:(cell,event)=>cellPointerDown(source,cell,event),onCellDoubleClick:(cell,event)=>{event.stopPropagation();if(source.locked||cell.locked)return;selectTableCells(source,[cell.id],cell.id);beginTextEdit(cell)},resolveCell:resolveTableCell,textEditor:cell=>richEditingWidget?.id===cell.id?<RichTextEditor key={cell.id} widget={richEditingWidget} document={doc} page={page} displayStyle={resolveTableCell(cell).style} styleOverride={projectTextStyleOverride(effectPreview?.widgetId===cell.id?cell[effectPreview.field]??{}:resolveInteractionStylePatch(cell))} onApply={applyRichText} onCancel={()=>setRichEditing(null)}/>:undefined}:undefined} treeAuthoring={w.type==='tree'?treeAuthoring(source):undefined} menuAuthoring={w.type==='menu'?menuAuthoring(source):undefined} textEditor={richEditingWidget?.id===w.id?<RichTextEditor key={w.id} widget={richEditingWidget} document={doc} page={page} displayStyle={w.style} styleOverride={displayPatch} onApply={applyRichText} onCancel={()=>setRichEditing(null)}/>:undefined}/>{editing===w.id&&<textarea className="inline-text-editor" autoFocus defaultValue={w.text} onPointerDown={e=>e.stopPropagation()} onBlur={e=>{changeWidgets(widgets.map(x=>x.id===w.id?replaceWidgetText(x,e.target.value):x));setEditing(null)}} onKeyDown={e=>{if(e.key==='Escape'){setEditing(null)}if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.blur()}}}/>}</div>})}
        {activeTable&&activeTable.placed!==false&&scopePlaced&&!richEditing&&tool==='select'&&<TableCanvasControls key={[page.id,panel?.id,activeState?.id,viewId,activeTable.id,zoom,activeTable.rotation].join(':')} table={activeTable} selection={selectedTable?tableSelection:null} zoom={zoom} onOwnerPointerDown={event=>startDrag(event,activeTable)} onSelect={(ids,anchor,additive)=>selectTableCells(activeTable,ids,anchor,additive)} onSelectOwner={()=>{setSelected([activeTable.id]);setTableSelection(null)}} onOperation={operation=>tableOperation(activeTable,operation)} onResizeStart={()=>startTableResize(activeTable)} onResize={resizeTableTrack} onResizeEnd={endTableResize} onResizeCancel={pointerCancel}/>}
        {canvasWidgets.filter(w=>selected.includes(w.id)&&w.id!==selectedTable?.id&&w.id!==(localMenuSelection?selectedMenuRoot?.id:undefined)&&w.id!==(localTreeSelection?selectedTree?.id:undefined)&&w.id!==richEditing&&!(pointEditing&&w.id===current?.id)).map(w=><div key={`selection-${w.id}`} className="selection-frame" style={{left:w.x,top:w.y,width:w.width,height:w.height,transform:w.layer?'none':`rotate(${w.rotation}deg)`}}><span className="selection-label">{w.name} {w.locked?'🔒':''}</span>{!w.locked&&['nw','n','ne','e','se','s','sw','w'].map(h=><i key={h} className={`resize-handle ${h}`} onPointerDown={e=>startDrag(e,w,h)}/>)}</div>)}{marquee&&<div className="marquee" style={marquee}/>}{(tool==='pen'||pointEditing)&&!preview&&!gallery&&<CanvasVectorTools key={vectorSessionContext} ref={vectorTools} mode={tool==='pen'?'pen':'points'} widget={tool==='pen'?undefined:current} zoom={zoom} surface={surface} onCreate={geometry=>{const w={...createWidget('path'),...geometry};changeWidgets([...widgets,w]);setSelected([w.id]);setNotice('Path created')}} onPathChange={vectorPath=>{if(current)changePointPath(current.id,vectorPath)}} onPreview={path=>setVectorDraft(path&&current?{id:current.id,path}:null)} onDone={()=>{setTool('select');setPointEditingId(null);setVectorDraft(null)}} onNotice={setNotice}/>}</div></div></div>}
      </section><Inspector adaptiveEffects={viewId&&current&&!activeTable&&!activeMenuRoot&&!activeTree?{local:activeView?.overrides[current.id]?.stateStyles!==undefined,onInherit:()=>{commit(commitAdaptivePage(docRef.current,clearAdaptiveStateStyles(page,viewId,[current.id])));setEffectPreview(null)}}:undefined} styleContextKey={[page.id,panel?.id,activeState?.id,viewId].join(':')} treeContext={activeTree?{tree:activeTree,selection:selectedTree?treeSelection:null,onSelect:(nodeId,part)=>selectTree(activeTree,nodeId,part,true),onOperation:operation=>treeOperation(activeTree,operation),onProperties:patch=>changeTree(activeTree,tree=>setTreeProperties(tree,patch)),onExpanded:(nodeId,expanded)=>toggleTree(activeTree,nodeId,expanded)}:undefined} menuContext={activeMenuRoot&&activeMenu?{menu:activeMenu,cellId:menuSelection?.cellId,onSelectMenu:()=>selectMenu(activeMenuRoot,activeMenu),onEditSubmenu:child=>selectMenu(activeMenuRoot,child),onOperation:operation=>menuOperation(activeMenuRoot,activeMenu,operation),onOrientation:orientation=>changeMenu(activeMenuRoot,activeMenu.id,menu=>setMenuOrientation(menu,orientation)),onPadding:padding=>changeMenu(activeMenuRoot,activeMenu.id,menu=>setMenuPadding(menu,padding))}:undefined} tableContext={activeTable?{table:activeTable,onSelectAllCells:()=>selectTableCells(activeTable,activeTable.table!.cells.map(cell=>cell.id)),selection:selectedTable?tableSelection:null,onOperation:operation=>tableOperation(activeTable,operation),onSelectOwner:()=>{setSelected([activeTable.id]);setTableSelection(null)}}:undefined} document={doc} page={page} widget={current} onWidgetChange={patchSelected} onPageChange={patchPage} onStylePreview={setEffectPreview} onEditRichText={editRichText} onEditPoints={editPoints} onEditFrameTarget={setFrameTargetEditing}/>
    </main><footer className="statusbar"><span>{notice}</span><span className="toolbar-spacer"/><span>{widgets.length} widgets</span><span>{selected.length?'Selection: '+selected.length:'No selection'}</span><span>{Math.round(zoom*100)}%</span></footer>
    {frameTargetWidget?.inlineFrame&&<FrameTargetEditor key={frameTargetWidget.id} value={frameTargetWidget.inlineFrame.target} pages={doc.pages} allowBlank onApply={target=>{const fresh=findWidget(docRef.current.pages.find(p=>p.id===page.id)!,frameTargetWidget.id);if(fresh?.inlineFrame&&JSON.stringify(fresh.inlineFrame.target)!==JSON.stringify(target))changeWidgets(updateWidgetTree(widgets,fresh.id,{inlineFrame:{...fresh.inlineFrame,target}}));setFrameTargetEditing(null)}} onClose={()=>setFrameTargetEditing(null)}/>}
    {quick&&<div className="modal-backdrop" onClick={()=>setQuick(false)}><div className="quick-dialog" onClick={e=>e.stopPropagation()}><div><Search size={18}/><input autoFocus placeholder="Insert a widget or go to a page…" value={quickText} onChange={e=>setQuickText(e.target.value)}/><button onClick={()=>setQuick(false)}><X size={17}/></button></div><section>{LIBRARY.filter(w=>w.name.toLowerCase().includes(quickText.toLowerCase())).map(({type,name,icon:Icon,key,orientation})=><button key={key??type} onClick={()=>{addWidget(type,100,100,orientation);setQuick(false);setQuickText('')}}><Icon size={17}/>{name}<span>Insert widget</span></button>)}{doc.pages.filter(p=>p.name.toLowerCase().includes(quickText.toLowerCase())).map(p=><button key={p.id} onClick={()=>{switchPage(p.id);setQuick(false)}}><FileText size={17}/>{p.name}<span>Go to page</span></button>)}</section></div></div>}
    {tablePaste&&<PasteTableDialog existing={tablePaste.existing} onApply={applyTablePaste} onClose={()=>setTablePaste(null)}/>}
    {variables&&<div className="modal-backdrop"><div className="variables-dialog"><header><h3>Global variables</h3><button onClick={()=>setVariables(false)}><X size={18}/></button></header><p>Use [[VariableName]] in widget text and interaction values.</p>{Object.entries(doc.variables).map(([key,value])=><div className="variable-row" key={key}><label>{key}</label><input value={value} onChange={e=>commit({...doc,variables:{...doc.variables,[key]:e.target.value}})}/><button onClick={()=>{const vars={...doc.variables};delete vars[key];commit({...doc,variables:vars})}}><Trash2 size={14}/></button></div>)}<button className="primary-button" onClick={async()=>{const name=await prompt('Variable name','Variable1');if(name&&/^[A-Za-z][A-Za-z0-9_]*$/.test(name))commit({...doc,variables:{...doc.variables,[name]:''}})}}><Plus size={14}/> Add variable</button></div></div>}
    {prototypeSettings&&<PrototypeSettings value={doc.caseSelection??'never'} onClose={()=>setPrototypeSettings(false)} onApply={caseSelection=>{if((docRef.current.caseSelection??'never')!==caseSelection)commit({...docRef.current,caseSelection});setPrototypeSettings(false)}}/>}
    {preview&&<Preview document={doc} pageId={page.id} onClose={()=>setPreview(false)}/>}
    {rpReport&&<RpImportReportDialog {...rpReport} onClose={()=>setRpReport(null)}/>}
  </div>;
}
