import {describe,expect,it} from 'vitest';
import {resolveEditorShortcut,type EditorKey} from '../src/model/editor-shortcuts';

const key=(value:string,modifiers:Partial<EditorKey>={}):EditorKey=>({key:value,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...modifiers});

describe('editor shortcut distinctions',()=>{
  it('distinguishes clipboard, alignment, and unsupported paste modes',()=>{
    expect(resolveEditorShortcut(key('C',{ctrlKey:true}))).toBe('copy');
    expect(resolveEditorShortcut(key('c',{ctrlKey:true,altKey:true}))).toBe('alignCenter');
    expect(resolveEditorShortcut(key('v',{ctrlKey:true}))).toBe('paste');
    expect(resolveEditorShortcut(key('v',{ctrlKey:true,altKey:true}))).toBeUndefined();
    expect(resolveEditorShortcut(key('v',{ctrlKey:true,shiftKey:true}))).toBeUndefined();
  });
  it('distinguishes file opening/export, pen/point editing, and unsupported preview options',()=>{
    expect(resolveEditorShortcut(key('o',{ctrlKey:true}))).toBe('open');
    expect(resolveEditorShortcut(key('O',{ctrlKey:true,shiftKey:true}))).toBe('exportHtml');
    expect(resolveEditorShortcut(key('p',{ctrlKey:true,shiftKey:true}))).toBe('pen');
    expect(resolveEditorShortcut(key('p',{ctrlKey:true,altKey:true}))).toBe('editPoints');
    expect(resolveEditorShortcut(key('p',{ctrlKey:true,altKey:true,shiftKey:true}))).toBeUndefined();
  });
  it.each(['n','x','d','a'])('does not run destructive or selection command %s with extra modifiers',letter=>{
    for(const altKey of [false,true])for(const shiftKey of [false,true]){
      if(!altKey&&!shiftKey)continue;
      expect(resolveEditorShortcut(key(letter,{ctrlKey:true,altKey,shiftKey}))).toBeUndefined();
    }
  });
  it('retains primary-modifier compatibility without combining Ctrl and Meta',()=>{
    expect(resolveEditorShortcut(key('z',{metaKey:true,shiftKey:true}))).toBe('redo');
    expect(resolveEditorShortcut(key('g',{metaKey:true,shiftKey:true}))).toBe('ungroup');
    expect(resolveEditorShortcut(key('s',{metaKey:true,ctrlKey:true}))).toBeUndefined();
  });
  it('ignores IME and AltGraph instead of treating them as application shortcuts',()=>{
    expect(resolveEditorShortcut(key('r',{isComposing:true}))).toBeUndefined();
    expect(resolveEditorShortcut(key('c',{ctrlKey:true,altKey:true,getModifierState:name=>name==='AltGraph'}))).toBeUndefined();
    expect(resolveEditorShortcut(key('Dead'))).toBeUndefined();
  });
  it('does not activate insertion tools with Alt or Shift held',()=>{
    for(const letter of ['r','o','t','p','l','f','d','h']){
      expect(resolveEditorShortcut(key(letter,{altKey:true}))).toBeUndefined();
      expect(resolveEditorShortcut(key(letter,{shiftKey:true}))).toBeUndefined();
    }
  });
  it('supports logical shifted bracket keys and their printable Windows forms',()=>{
    for(const primary of [{ctrlKey:true},{metaKey:true}]){
      expect(resolveEditorShortcut(key(']',{...primary,shiftKey:true}))).toBe('front');
      expect(resolveEditorShortcut(key('}',{...primary,shiftKey:true}))).toBe('front');
      expect(resolveEditorShortcut(key('{',{...primary,shiftKey:true}))).toBe('back');
      expect(resolveEditorShortcut(key(']',primary))).toBeUndefined();
      expect(resolveEditorShortcut(key('}',{...primary,shiftKey:true,altKey:true}))).toBeUndefined();
    }
  });
});
