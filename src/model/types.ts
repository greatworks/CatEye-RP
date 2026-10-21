export type WidgetType = 'box' | 'ellipse' | 'path' | 'text' | 'button' | 'image' | 'placeholder' | 'line' | 'input' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'hotspot' | 'panel' | 'repeater' | 'table' | 'tableCell' | 'menu' | 'tree' | 'treeNode' | 'inlineFrame' | 'layer';
/** The supported text-field types; these are HTML values, including Phone as tel. */
export const INPUT_TYPES = ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'file', 'date', 'month', 'time'] as const;
export type InputType = typeof INPUT_TYPES[number];
export type VectorCommand = { op: 'M' | 'L'; x: number; y: number } | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number } | { op: 'Z' };
/** Coordinates are normalized to widget width/height and may extend outside 0..1. */
export interface VectorPath { fillRule: 'nonzero' | 'evenodd'; commands: VectorCommand[] }
export type EventType = 'click' | 'doubleClick' | 'mouseEnter' | 'mouseLeave' | 'change' | 'focus' | 'blur' | 'load' | 'itemLoad' | 'itemResize' | 'resize' | 'move' | 'rotate' | 'selectedChange' | 'select' | 'unselect' | 'errorSet' | 'errorRemoved' | 'show' | 'hide' | 'adaptiveViewChange' | 'dragStart' | 'drag' | 'dragDrop' | 'swipeLeft' | 'swipeRight' | 'swipeUp' | 'swipeDown';
export type ActionType = 'openUrl' | 'openPage' | 'show' | 'hide' | 'toggle' | 'setText' | 'setSelectedOption' | 'setFocus' | 'setState' | 'nextState' | 'previousState' | 'setVariable' | 'move' | 'rotate' | 'resize' | 'resizeItem' | 'setStyle' | 'enable' | 'disable' | 'wait' | 'addRow' | 'deleteRow' | 'sortRows' | 'filterRows' | 'updateRow' | 'setSelected' | 'setError' | 'markRows' | 'unmarkRows' | 'setRepeaterPage' | 'setItemsPerPage' | 'addFilter' | 'removeFilter' | 'addSort' | 'removeSort' | 'expandTreeNode' | 'collapseTreeNode' | 'toggleTreeNode' | 'openLinkInFrame' | 'setAdaptiveView';
export const ROTATION_ANCHORS = ['top left', 'top', 'top right', 'left', 'center', 'right', 'bottom left', 'bottom', 'bottom right'] as const;
export const ROTATION_EASINGS = ['none', 'swing', 'linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutBounce', 'easeOutElastic', 'easeInSine', 'easeInQuad', 'easeInQuart', 'easeInQuint', 'easeInExpo', 'easeInCirc', 'easeInBack', 'easeInElastic', 'easeInBounce', 'easeOutSine', 'easeOutQuad', 'easeOutQuart', 'easeOutQuint', 'easeOutExpo', 'easeOutCirc', 'easeOutBack', 'easeInOutSine', 'easeInOutQuad', 'easeInOutQuart', 'easeInOutQuint', 'easeInOutExpo', 'easeInOutCirc', 'easeInOutBack', 'easeInOutElastic', 'easeInOutBounce'] as const;
/** Numeric strings can contain expressions; evaluate when each target's animation starts. */
export interface RotateActionSpec {
  mode: 'by' | 'to'; degrees: string; clockwise: boolean;
  anchor: typeof ROTATION_ANCHORS[number]; offsetX: string; offsetY: string;
  easing: typeof ROTATION_EASINGS[number]; duration: number;
}
/** Each expression owns its local widget bindings; evaluation never changes them. */
export interface MotionExpression {
  text: string;
  bindings?: Record<string, { kind: 'widget'; targetId: string }>;
}
export const MOVE_MODES = ['location', 'delta', 'drag', 'dragX', 'dragY', 'locationBeforeDrag', 'withThis', 'sizeDeltaX', 'sizeDeltaY'] as const;
export const MOVE_TRAJECTORIES = ['straight', 'arcClockwise', 'arcAntiClockwise'] as const;
export type WidgetMotionTarget = { kind: 'widget'; id: string } | { kind: 'this' };
export type MoveTarget = WidgetMotionTarget | { kind: 'widgetsBelow' } | { kind: 'widgetsRight' };
export type ResizeTarget = WidgetMotionTarget | { kind: 'thisItem' };
/** Keep the predicate and projection direction: OR is not a rectangle clamp. */
export type MotionBoundary =
  | { kind: 'and' | 'or'; left: MotionBoundary; right: MotionBoundary }
  | { kind: 'compare'; operator: '>' | '<' | '>=' | '<='; direction: 'left' | 'right' | 'top' | 'bottom'; left: MotionExpression; right: MotionExpression };
export interface MoveTargetSpec {
  target: MoveTarget; mode: typeof MOVE_MODES[number]; x: MotionExpression; y: MotionExpression;
  trajectory: typeof MOVE_TRAJECTORIES[number]; easing: typeof ROTATION_EASINGS[number]; duration: number;
  boundary?: MotionBoundary;
}
export interface ResizeTargetSpec {
  target: ResizeTarget; width: MotionExpression; height: MotionExpression;
  anchor: typeof ROTATION_ANCHORS[number]; easing: typeof ROTATION_EASINGS[number]; duration: number;
}
/** Repeated entries and their order are meaningful within one original action. */
export interface MoveActionSpec { targets: MoveTargetSpec[] }
export interface ResizeActionSpec { targets: ResizeTargetSpec[] }
/** Each shadow is one atomic style property; an explicit off object clears inherited paint. */
export interface ShadowStyle {
  on: boolean; offsetX: number; offsetY: number; blurRadius: number; color: string;
}
export interface InnerShadowStyle extends ShadowStyle { spread: number }
/** Gradient points use fractions of the widget bounds, including points outside it. */
export interface GradientPoint { x: number; y: number }
/** Equal offsets retain their order, allowing a hard color transition. */
export interface GradientStop { offset: number; color: string }
export type GradientFill =
  | { type: 'linear'; start: GradientPoint; end: GradientPoint; stops: GradientStop[] }
  | { type: 'radial'; center: GradientPoint; axis1: GradientPoint; axis2: GradientPoint; stops: GradientStop[] };
/** Native RP11 line styles; patterns are independent from stroke paint and width. */
export const LINE_PATTERNS = ['solid', 'long-dash', 'medium-dash', 'short-dash', 'dash-dot', 'dash-dot-dot', 'long-dash-short-dash', 'dot', 'none'] as const;
export type LinePattern = typeof LINE_PATTERNS[number];
/** Concrete RP11 endpoint shapes. The native multi-selection sentinel is not saved. */
export const ARROW_STYLES = ['none', 'reverse-crow', 'filled-triangle', 'skinny-triangle', 'diamond', 'cross-bar', 'half-reverse-crow', 'curved-reverse-crow', 'double-reverse-crow', 'crow', 'double-filled-triangle', 'hollow-triangle', 'double-hollow-triangle', 'double-cross-bar', 'slanted-bar', 't-bar', 'hollow-diamond', 'filled-circle', 'hollow-circle', 'filled-square', 'hollow-square', 'crow-hollow-circle', 'cross-bar-hollow-circle', 'crow-cross-bar', 't-bar-reverse-crow', 'large-hollow-triangle', 'large-filled-triangle', 'large-hollow-diamond', 'large-filled-diamond'] as const;
export type ArrowStyle = typeof ARROW_STYLES[number];
/** One atomic style property, matching the native LINE_ENDS pair. */
export interface LineEnds { start: ArrowStyle; end: ArrowStyle }
export const PIN_HORIZONTAL_VALUES = ['none', 'left', 'right', 'both', 'center'] as const;
export const PIN_VERTICAL_VALUES = ['none', 'top', 'bottom', 'both', 'center'] as const;
export type PinHorizontal = typeof PIN_HORIZONTAL_VALUES[number];
export type PinVertical = typeof PIN_VERTICAL_VALUES[number];
/** Independent native authoring constraints; defaults are resolved without saving them. */
export interface ResizePins {
  pinHorizontal: PinHorizontal; pinVertical: PinVertical; fixedWidth: boolean; fixedHeight: boolean;
}
export interface WidgetStyle {
  fill: string; stroke: string; strokeWidth: number; radius: number;
  /** Native P106–P109. Author normal styles only, never interaction effects or actions. */
  pinHorizontal?: PinHorizontal;
  pinVertical?: PinVertical;
  fixedWidth?: boolean;
  fixedHeight?: boolean;
  /** Native P94, independent from shared selection text flags. No saved default.
   * Normal/named/adaptive/state styles and SetStyle carry this same scalar. */
  selectionButtonSize?: number;
  /** Atomic fill paint. A fill-only style patch returns to the supplied solid color. */
  fillGradient?: GradientFill;
  /** Independent atomic border paint. A stroke-only patch restores its solid color. */
  strokeGradient?: GradientFill;
  /** Omitted means solid. None retains the authored width and paint. */
  linePattern?: LinePattern;
  /** Omitted means no endpoints. Applies to supported open line/path geometry. */
  lineEnds?: LineEnds;
  /** Independent border-side visibility in top, right, bottom, left order. */
  borderVisibility?: [boolean, boolean, boolean, boolean];
  /** Optional per-side border widths, in CSS order: top, right, bottom, left. */
  borderWidths?: [number, number, number, number];
  /** Optional clockwise per-corner radii: top-left, top-right, bottom-right, bottom-left. */
  cornerRadii?: [number, number, number, number];
  /** Independent native corner mask, clockwise TL/TR/BR/BL. Omitted enables every corner. */
  cornerVisibility?: [boolean, boolean, boolean, boolean];
  /** Optional text insets, in CSS order: top, right, bottom, left. */
  textPadding?: [number, number, number, number];
  /** Applies to ordinary text content, not native form-control alignment. */
  verticalAlign?: 'top' | 'middle' | 'bottom';
  /** Unitless text line-height multiplier; omitted retains the renderer's legacy default. */
  lineHeight?: 'normal' | number;
  color: string; fontSize: number; fontFamily: string; fontWeight: number;
  /** Omitted retains upright text. Explicit normal can override an italic style layer. */
  fontStyle?: 'normal' | 'italic';
  /** Independent text decorations; false explicitly clears the corresponding layer. */
  underline?: boolean;
  strikethrough?: boolean;
  textAlign: 'left' | 'center' | 'right'; opacity: number;
  outerShadow?: ShadowStyle;
  innerShadow?: InnerShadowStyle;
  textShadow?: ShadowStyle;
}
/** Structured text only; never executable HTML or arbitrary CSS. */
export type RichTextRunStyle = Partial<Pick<WidgetStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'color' | 'underline' | 'strikethrough'>>;
export interface RichTextRun { text: string; style?: RichTextRunStyle; linkId?: string }
/** A link has independent actions and transient styles; its initial typography lives in its runs. */
export interface RichTextLink {
  id: string; name: string; interactions: Interaction[];
  mouseOverStyle?: RichTextRunStyle; mouseDownStyle?: RichTextRunStyle;
}
export interface RichTextParagraph {
  runs: RichTextRun[];
  textAlign?: WidgetStyle['textAlign'];
  /** Absolute CSS pixels, distinct from WidgetStyle.lineHeight's multiplier. */
  lineHeightPx?: 'normal' | number;
}
export interface RichText { paragraphs: RichTextParagraph[]; expressionMode?: 'literal'; links?: RichTextLink[] }
/** Transient visual state, owned by the player rather than saved in the document. */
export interface InteractionStyleState { mouseOver?: boolean; mouseDown?: boolean; focused?: boolean; hint?: boolean }
export interface Condition {
  source: 'variable' | 'widgetText' | 'selectedOption'; key: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greater' | 'less' | 'isEmpty'; value: string;
  /** Imported Axure coercion semantics, supported only for equals/notEquals. */
  comparisonMode?: 'axure';
}
export interface Action {
  id: string; type: ActionType; targetId?: string; value?: string;
  /** Absence retains the old numeric, immediate Move/Resize contract. */
  move?: MoveActionSpec; resize?: ResizeActionSpec;
  x?: number; y?: number; duration?: number; style?: Partial<WidgetStyle>;
  /** Only rotate uses this complete motion specification. */
  rotate?: RotateActionSpec;
  /** Only valid for setFocus; omitted leaves the current text selection alone. */
  selectText?: boolean;
  /** Only openUrl uses this field. The URL value is literal, never an expression. */
  windowTarget?: 'current' | 'new';
  /** openLinkInFrame only; a parent scope has no widget targetId. */
  frameScope?: 'widget' | 'parent';
  frameTarget?: FrameTarget;
  /** Literal adaptive selection; only valid for setAdaptiveView. */
  adaptiveView?: AdaptiveViewTarget;
}
export type AdaptiveViewTarget = { kind: 'auto' } | { kind: 'base' } | { kind: 'view'; viewId: string };
export interface Interaction {
  id: string; event: EventType; name: string; enabled: boolean;
  /** false continues the previous IF chain for this event; absent preserves legacy independent cases. */
  isNewIfGroup?: boolean;
  conditions: Condition[]; conditionMode: 'all' | 'any'; actions: Action[];
}
export interface PanelState { id: string; name: string; widgets: Widget[] }
export interface RepeaterRowSelector { row?: 'this' | 'all' | 'marked' | number; where?: { column: string; operator: Condition['operator']; value: string } }
export interface RepeaterFilterSpec { name: string; expression: string; column?: string; mode: 'smart' | 'all' | 'any'; removeOthers: boolean }
export interface RepeaterSortSpec { name: string; column: string; direction: 'asc' | 'desc'; dataType: 'number' | 'text' | 'textCase' | 'natural' | 'dateYMD' | 'dateMDY' | 'dateDMY'; toggle: boolean; removeOthers: boolean }
export type RepeaterRuleRemoval = { all: true } | { name: string };
export interface RepeaterData {
  columns: string[]; rows: Record<string, string>[]; template: Widget[]; itemHeight: number; gap: number;
  /** Optional grid layout fields; omission preserves the legacy stored outer bounds. */
  itemWidth?: number; layout?: 'vertical' | 'horizontal'; wrap?: number;
  horizontalGap?: number; verticalGap?: number; fitToContent?: boolean;
  /** Optional container insets, in CSS order: top, right, bottom, left. */
  padding?: [number, number, number, number];
  /** Omitted means all rows. Numbers are retained exactly, including fractions. */
  pagination?: { itemsPerPage: number; startPage: number };
}
/** A live component is materialized inside one panel state. Definition IDs map to stable local IDs. */
export interface ComponentInstance { sourceIds: Record<string, string> }
/** Fixed row-major grid. Each cell is an independently addressable text widget. */
export interface TableData { columnWidths: number[]; rowHeights: number[]; cells: Widget[]; cellOrder?: string[] }
/** Menus retain their own container, table and cell identities. Submenu coordinates are local to the parent menu. */
export interface MenuData {
  orientation: 'horizontal' | 'vertical'; table: Widget; submenus: Widget[];
  /** Present only on submenus, referencing one cell in the immediate parent's table. */
  parentCellId?: string;
  padding: [number, number, number, number];
}
/** Tree root and node labels retain their independent native identities. */
export interface TreeData {
  nodes: Widget[]; indent: number; showExpandIcons: boolean;
  iconStyle: 'triangle' | 'plusMinus'; showIcons: boolean;
}
/** Node bounds describe its own row; children use coordinates relative to that row. */
export interface TreeNodeData { label: Widget; children: Widget[]; expanded: boolean; iconSrc?: string }
/** Literal destinations: page identity is independent of widget identity. */
export type FrameTarget = { kind: 'page'; pageId: string } | { kind: 'url'; url: string } | { kind: 'file'; path: string };
export interface InlineFrameData {
  /** Omitted means a blank frame. Preview images are authoring content only. */
  target?: FrameTarget;
  hideBorders: boolean;
  scrolling: 'auto' | 'yes' | 'no';
  preview: { kind: 'none' | 'video' | 'map' | 'custom'; imageSrc?: string };
}
export interface LayerData {
  /** Ordered, independently identified children. A layer does not establish a
   * new coordinate origin: its children retain page/state/item coordinates. */
  widgets: Widget[];
  /** Native group propagation setting; false when omitted. */
  propagate?: boolean;
}
/** Shared selection-object fields, independent from adaptive style P94. */
export interface SelectionTextLayout {
  autoFitWidth: boolean; autoFitHeight: boolean; alignRight: boolean;
}
export interface Widget {
  id: string; type: WidgetType; name: string; text: string;
  /** text must equal each paragraph's concatenated runs, joined with one LF. */
  richText?: RichText;
  x: number; y: number; width: number; height: number; rotation: number;
  style: WidgetStyle; placed?: boolean; hidden: boolean; locked: boolean; disabled: boolean;
  notes: string; interactions: Interaction[]; groupId?: string;
  imageSrc?: string; options?: string[]; checked?: boolean;
  /** Select widgets only. Omitted presentation retains the legacy dropdown. */
  selectMode?: 'dropdown' | 'listbox';
  multiple?: boolean;
  /** Exact, ascending option indices. Omitted derives the first exact text match; [] selects none. */
  selectedIndices?: number[];
  /** Explicit geometry for box/ellipse/path; mandatory for the path widget type. */
  vectorPath?: VectorPath;
  /** Native shape text layout flags. They do not change the saved owner rectangle. */
  shapeText?: { autoFitWidth: boolean; autoFitHeight: boolean };
  /** Checkbox/radio only. Omission preserves legacy layout; no flags are inferred. */
  selectionText?: SelectionTextLayout;
  /** Checkbox/radio selection uses checked instead; omitted ordinary selection is false. */
  selected?: boolean;
  selectionGroup?: string;
  /** Native radio groups are independent from ordinary selection groups. */
  radioGroup?: string;
  selectedStyle?: Partial<WidgetStyle>;
  mouseOverStyle?: Partial<WidgetStyle>;
  mouseDownStyle?: Partial<WidgetStyle>;
  focusedStyle?: Partial<WidgetStyle>;
  disabledStyle?: Partial<WidgetStyle>;
  error?: boolean;
  errorStyle?: Partial<WidgetStyle>;
  /** Literal placeholder text, supported only by input and textarea. */
  hintText?: string;
  /** Omitted means typing. The placeholder never becomes the control's value. */
  hintHideOn?: 'focus' | 'typing';
  hintStyle?: Partial<WidgetStyle>;
  /** Only valid for input widgets. Omitted values preserve ordinary text input behavior. */
  inputType?: InputType;
  /** Text fields and text areas only; omission retains editable behavior. */
  readOnly?: boolean;
  /** Text fields only. Omitted means unlimited; browser applicability depends on inputType. */
  maxLength?: number;
  /** Text fields/areas only. Missing targets are retained like action targets. */
  submitButtonId?: string;
  states?: PanelState[]; activeStateId?: string; repeater?: RepeaterData;
  layer?: LayerData;
  table?: TableData;
  menu?: MenuData;
  tree?: TreeData;
  treeNode?: TreeNodeData;
  inlineFrame?: InlineFrameData;
  /** Dynamic panel bounds fit the active state's contents during preview/export. */
  fitToContent?: boolean;
  componentId?: string;
  componentInstance?: ComponentInstance;
}
export type AdaptiveStateKey = 'mouseOver' | 'mouseDown' | 'focused' | 'selected' | 'error' | 'hint' | 'disabled';
export type AdaptiveStateStyles = Partial<Record<AdaptiveStateKey, Partial<WidgetStyle>>>;
/** Native padding is four independent properties. Older style.textPadding
 * tuples remain valid and declare all four sides before this sparse layer. */
export type AdaptiveTextPaddingSides = Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
export type AdaptiveWidgetOverride = Partial<Pick<Widget, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'hidden' | 'placed'>> & {
  style?: Partial<WidgetStyle>;
  textPaddingSides?: AdaptiveTextPaddingSides;
  /** Omission inherits the nearest map; an explicit empty map blocks all inherited effects. */
  stateStyles?: AdaptiveStateStyles;
};
export interface AdaptiveView {
  id: string; name: string; width: number; height?: number;
  /** Omitted means Base. Parents must be named views on this page. */
  baseViewId?: string;
  overrides: Record<string, AdaptiveWidgetOverride>;
}
export type AdaptiveViewDefinition = Omit<AdaptiveView, 'overrides'>;
export interface AdaptiveViewSet {
  id: string; name: string; baseSize: { width: number; height: number };
  views: AdaptiveViewDefinition[];
}
export interface Page {
  id: string; name: string; parentId?: string; width: number; height: number;
  background: string; widgets: Widget[]; notes: string;
  interactions: Interaction[]; adaptiveViews: AdaptiveView[];
  /** Omitted preserves the original maximum-width selection rule. */
  adaptiveSelection?: 'native-size';
  /** Native Base selection dimensions, separate from authored canvas size; omitted means 0 x 0. */
  adaptiveBaseSize?: { width: number; height: number };
  /** Shared definitions are project owned; stored adaptiveViews must then be empty. */
  adaptiveViewSetId?: string;
  /** Page-owned declarations, including inactive view IDs retained during set reassignment. */
  adaptiveOverrides?: Record<string, Record<string, AdaptiveWidgetOverride>>;
}
export interface PageFolder { id: string; name: string; parentId?: string }
export interface Component { id: string; name: string; widgets: Widget[]; width: number; height: number }
export interface Document {
  format: 'rea-prototype'; version: 1; id: string; name: string;
  /** Old documents omit this field and retain automatic case execution. */
  caseSelection?: 'auto' | 'always' | 'never';
  pages: Page[]; components: Component[]; variables: Record<string, string>;
  adaptiveViewSets?: AdaptiveViewSet[];
  /** Optional organization nodes. Only real pages belong in pages. */
  pageFolders?: PageFolder[];
  /** Every page/folder ID once, canonically stored in tree preorder. */
  pageOrder?: string[];
  styles: { id: string; name: string; style: WidgetStyle }[];
}
export interface EditorState { document: Document; pageId: string; selectedIds: string[]; past: Document[]; future: Document[] }
export interface CaseMenu {
  id: string; sourceId: string; event: EventType; mode: 'cases' | 'event';
  options: { id: string; name: string }[];
  anchor?: { x: number; y: number };
}
/** Execution caches only; never part of the saved prototype Document. */
export interface RuntimeMotionState {
  groupAngles?: Record<string, number>;
  rotationTargets?: Record<string, number>;
  rotationLocations?: Record<string, { x: number; y: number }>;
  /** Logical Resize destinations can lead the dimensions currently painted. */
  resizeTargets?: Record<string, { width: number; height: number }>;
  /** Event execution context only; retained deltas differ from public drag getters after Drop. */
  drag?: {
    sourceId?: string; context?: { repeaterId: string; rowId: string }[];
    started: boolean; hasDragged: boolean; startX?: number; startY?: number;
    currentX?: number; currentY?: number; deltaX?: number; deltaY?: number;
    startTime?: number; currentTime?: number; movedWidgets: Record<string, { x: number; y: number }>;
  };
  moveInfos?: Record<string, { deltaX: number; deltaY: number; easing: typeof ROTATION_EASINGS[number]; duration: number }>;
}
export interface RuntimeState { motionState?: RuntimeMotionState; frameNavigations?: Record<string, { target: FrameTarget; revision: number }>; pageId: string; variables: Record<string, string>; widgetOverrides: Record<string, Partial<Widget>>; repeaterRows: Record<string, Record<string, string>[]>; pendingNavigation?: string; caseMenus?: CaseMenu[]; richTextStyleOverrides?: Record<string, Partial<WidgetStyle>> }
