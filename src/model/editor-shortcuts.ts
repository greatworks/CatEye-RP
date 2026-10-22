/** Editor commands only. Text, tree, table and vector editing own their local keys. */
const shortcuts={
  'mod+n':'new', 'mod+o':'open', 'mod+s':'save', 'mod+shift+s':'save',
  'mod+z':'undo', 'mod+y':'redo', 'mod+shift+z':'redo',
  'mod+a':'selectAll', 'mod+c':'copy', 'mod+x':'cut', 'mod+v':'paste', 'mod+d':'duplicate',
  'mod+g':'group', 'mod+shift+g':'ungroup',
  'mod+shift+b':'box', 'mod+shift+e':'ellipse', 'mod+shift+t':'text', 'mod+shift+p':'pen',
  'mod+alt+p':'editPoints',
  'mod+alt+l':'alignLeft', 'mod+alt+c':'alignCenter', 'mod+alt+r':'alignRight',
  'mod+alt+t':'alignTop', 'mod+alt+m':'alignMiddle', 'mod+alt+b':'alignBottom',
  'mod+shift+]':'front', 'mod+shift+[':'back',
  'mod+/':'quick', 'mod+.':'preview', 'mod+shift+o':'exportHtml',
  "mod+'":'grid', 'mod+0':'resetZoom',
  v:'select',r:'box',o:'ellipse',t:'text',p:'pen',l:'line',f:'input',d:'panel',h:'hotspot',
  '/':'quick','.':'preview',f5:'preview',
} as const;

export type EditorCommand=typeof shortcuts[keyof typeof shortcuts];
export interface EditorKey {
  key:string;
  ctrlKey:boolean;
  metaKey:boolean;
  altKey:boolean;
  shiftKey:boolean;
  isComposing?:boolean;
  getModifierState?:(key:string)=>boolean;
}

/** Extra modifiers select a different chord; they never fall back to a simpler one. */
export function resolveEditorShortcut(event:EditorKey):EditorCommand|undefined {
  if(event.isComposing||event.ctrlKey&&event.metaKey||event.getModifierState?.('AltGraph'))return;
  let key=event.key.toLowerCase();
  // Windows reports shifted bracket glyphs on some keyboard layouts.
  if(event.shiftKey&&key==='}')key=']';
  if(event.shiftKey&&key==='{')key='[';
  const chord=`${event.ctrlKey||event.metaKey?'mod+':''}${event.altKey?'alt+':''}${event.shiftKey?'shift+':''}${key}`;
  if(Object.hasOwn(shortcuts,chord))return shortcuts[chord as keyof typeof shortcuts];
}
