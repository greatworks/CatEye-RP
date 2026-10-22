import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { Document as PrototypeDocument, Page, RichText, RichTextLink, RichTextRunStyle, Widget, WidgetStyle } from '../model/types';
import { applyRichTextStyle, assignRichTextLink, formatRichTextRange, insertRichTextSoftBreak, removeRichTextLink, removeRichTextLinkRange, replaceRichTextRange, richTextFromPlainText, richTextLinkAt, richTextPlainText, updateRichTextLink } from '../model/rich-text';
import { parseRichText } from '../model/document';
import { createShapeTextRenderer } from '../model/shape-text';
import { InteractionsEditor } from './Inspector';
import { editableText, offsetFromDOM, paintRichText, readRichSelection, writeRichSelection, type RichSelection } from './rich-text-dom';
import './RichTextEditor.css';
const shapeText = createShapeTextRenderer();
type Selection = RichSelection;
type Snapshot = { rich: RichText; selection: Selection; insertion: RichTextRunStyle };
type LinkDraft = { link: RichTextLink; selection: Selection; existing: boolean };

function linksInRange(rich: RichText, selection: Selection): (string | undefined)[] {
  let offset = 0; const values = new Set<string | undefined>();
  for (const paragraph of rich.paragraphs) {
    for (const run of paragraph.runs) { if (offset < selection.end && offset + run.text.length > selection.start) values.add(run.linkId); offset += run.text.length; }
    offset++;
  }
  return [...values];
}
function selectedLink(rich: RichText, selection: Selection): RichTextLink | undefined {
  if (selection.start === selection.end) return richTextLinkAt(rich, selection.start);
  const values = linksInRange(rich, selection); return values.length === 1 && values[0] ? rich.links?.find(link => link.id === values[0]) : undefined;
}

function LinkEffectEditor({ label, value, onChange }: { label: string; value: RichTextRunStyle | undefined; onChange: (value: RichTextRunStyle | undefined) => void }) {
  const fields = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'underline', 'strikethrough'] as const;
  const names = ['font family', 'font size', 'font weight', 'font style', 'color', 'underline', 'strikethrough'];
  const defaults: Required<RichTextRunStyle> = { fontFamily: 'Arial', fontSize: 14, fontWeight: 400, fontStyle: 'normal', color: '#0000ff', underline: false, strikethrough: false };
  return <details className="rich-link-effect"><summary>{label} style{value === undefined ? ' · not set' : ''}</summary>{value === undefined ? <button onClick={() => onChange({})}>Add {label} style</button> : <>
    <button onClick={() => onChange(undefined)}>Remove {label} style</button>
    <div className="rich-link-effect-fields">{fields.map((key, index) => {
      const enabled = Object.hasOwn(value, key), name = `${label} ${names[index]}`;
      return <div key={key}><label><input type="checkbox" aria-label={`Override ${name}`} checked={enabled} onChange={event => { const next = { ...value }; if (event.target.checked) Object.assign(next, { [key]: defaults[key] }); else delete next[key]; onChange(next); }}/>{names[index]}</label>{enabled && (key === 'fontStyle' ? <select aria-label={name} value={value.fontStyle} onChange={event => onChange({ ...value, fontStyle: event.target.value as 'normal' | 'italic' })}><option value="normal">Normal</option><option value="italic">Italic</option></select> : key === 'underline' || key === 'strikethrough' ? <select aria-label={name} value={String(value[key])} onChange={event => onChange({ ...value, [key]: event.target.value === 'true' })}><option value="true">On</option><option value="false">Off</option></select> : <input aria-label={name} type={key === 'fontSize' || key === 'fontWeight' ? 'number' : 'text'} value={String(value[key] ?? '')} onChange={event => onChange({ ...value, [key]: key === 'fontSize' || key === 'fontWeight' ? Number(event.target.value) : event.target.value })}/>)}</div>;
    })}</div>
  </>}</details>;
}

function HyperlinkDraftEditor({ draft, document, page, widget, onChange, onApply, onCancel }: { draft: LinkDraft; document: PrototypeDocument; page: Page; widget: Widget; onChange: (link: RichTextLink) => void; onApply: () => void; onCancel: () => void }) {
  const link = draft.link, interaction = link.interactions[0], action = interaction?.actions[0];
  const simple = link.interactions.length === 1 && interaction.event === 'click' && interaction.enabled && !interaction.conditions.length && interaction.actions.length === 1 && action.type === 'openUrl';
  function changeUrl(patch: Partial<typeof action>) { onChange({ ...link, interactions: [{ ...interaction, actions: [{ ...action, ...patch }] }] }); }
  return <section role="group" aria-label="Hyperlink settings" className="rich-link-editor">
    <div className="rich-link-heading"><strong>{draft.existing ? 'Edit hyperlink' : 'Add hyperlink'}</strong><span>{draft.existing ? 'Changes apply to every text fragment with this link identity.' : 'The selected text keeps its existing formatting.'}</span><button onClick={onCancel}>Cancel link changes</button><button onClick={onApply}>Apply link</button></div>
    <label>Link name<input aria-label="Link name" autoFocus={!simple} value={link.name} maxLength={500} onChange={event => onChange({ ...link, name: event.target.value })}/></label>
    {simple && <div className="rich-link-url"><label>URL<input aria-label="Link URL" type="url" autoFocus value={action.value ?? ''} maxLength={4096} placeholder="https://example.com/" onChange={event => changeUrl({ value: event.target.value })}/></label><label>Open in<select aria-label="Link target" value={action.windowTarget ?? 'current'} onChange={event => changeUrl({ windowTarget: event.target.value as 'current' | 'new' })}><option value="current">Current window</option><option value="new">New window</option></select></label></div>}
    <p>HTTP(S) URLs are literal. They are not opened while editing. Apply or cancel link changes to resume text selection.</p>
    <details className="rich-link-interactions" open={!simple}><summary>Link interactions</summary><InteractionsEditor interactions={link.interactions} onChange={interactions => onChange({ ...link, interactions })} document={document} page={page} widget={widget} allowedEvents={['click']}/></details>
    <div className="rich-link-effects"><LinkEffectEditor label="Link MouseOver" value={link.mouseOverStyle} onChange={value => { const next = { ...link }; if (value === undefined) delete next.mouseOverStyle; else next.mouseOverStyle = value; onChange(next); }}/><LinkEffectEditor label="Link MouseDown" value={link.mouseDownStyle} onChange={value => { const next = { ...link }; if (value === undefined) delete next.mouseDownStyle; else next.mouseDownStyle = value; onChange(next); }}/></div>
  </section>;
}

export function richParagraphAt(rich: RichText, offset: number): number {
  for (let index=0;index<rich.paragraphs.length;index++) {
    const length=rich.paragraphs[index].runs.reduce((count,run)=>count+run.text.length,0);
    if(offset<=length||index===rich.paragraphs.length-1)return index;
    offset-=length+1;
  }
  return 0;
}

/** Browser textarea selections use UTF-16 offsets, the same offsets as the model helpers. */
export function changedTextRange(before: string, after: string) {
  let start = 0, oldEnd = before.length, newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  // Do not split a surrogate pair when an IME replaces an astral character.
  if (start > 0 && /[\uDC00-\uDFFF]/.test(before[start] ?? after[start] ?? '')) start--;
  return { start, end: oldEnd, text: after.slice(start, newEnd) };
}

/** Prefer the browser's actual edit location over an ambiguous repeated-text diff. */
export function textInputRange(before: string, after: string, selection?: Selection & { inputType: string }) {
  if (selection) {
    let { start, end } = selection;
    const removed = before.length - after.length;
    if (start === end && removed > 0 && selection.inputType.startsWith('delete')) {
      if (selection.inputType.endsWith('Backward')) start = Math.max(0, start - removed);
      else if (selection.inputType.endsWith('Forward')) end = Math.min(before.length, end + removed);
    }
    const added = after.length - (before.length - (end - start));
    if (added >= 0) {
      const text = after.slice(start, start + added);
      if (before.slice(0, start) + text + before.slice(end) === after) return { start, end, text };
    }
  }
  return changedTextRange(before, after);
}

function runStyleAt(rich: RichText, offset: number): RichTextRunStyle {
  for (const paragraph of rich.paragraphs) {
    for (const run of paragraph.runs) { if (offset < run.text.length) return run.style ?? {}; offset -= run.text.length; }
    if (offset <= 0) return paragraph.runs.at(-1)?.style ?? {};
    offset--;
  }
  return rich.paragraphs.at(-1)?.runs.at(-1)?.style ?? {};
}

export function RichTextEditor({ widget, document: project, page, displayStyle, styleOverride, onApply, onCancel }: {
  widget: Widget; document: PrototypeDocument; page: Page; displayStyle?: WidgetStyle; styleOverride?: Partial<WidgetStyle>; onApply: (rich: RichText) => void | Promise<boolean>; onCancel: () => void;
}) {
  const [rich, setRich] = useState<RichText>(() => structuredClone(widget.richText ?? richTextFromPlainText(widget.text)));
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [insertion, setInsertion] = useState<RichTextRunStyle>({});
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [family, setFamily] = useState(widget.style.fontFamily), [size, setSize] = useState(String(widget.style.fontSize)), [color, setColor] = useState(widget.style.color.startsWith('#') ? widget.style.color : '#263348');
  const [error, setError] = useState('');
  const [applying,setApplying]=useState(false),applyingRef=useRef(false);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null), linkDraftRef = useRef<LinkDraft | null>(null);
  const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const root = useRef<HTMLSpanElement>(null), toolbar = useRef<HTMLElement>(null), richRef = useRef(rich), selectionRef = useRef(selection), insertionRef = useRef(insertion), historyRef = useRef(history);
  const composition = useRef<Snapshot | null>(null), mounted = useRef(false);
  const actions = useRef({ before: (_event: InputEvent) => {}, input: (_event: InputEvent) => {}, selection: () => {}, apply: (): boolean => true });
  const base = displayStyle ?? widget.style;
  const paragraph = rich.paragraphs[Math.min(paragraphIndex, rich.paragraphs.length - 1)];
  const activeStyle = { ...widget.style, ...runStyleAt(rich, selection.start), ...insertion };
  const activeLink = selectedLink(rich, selection), hasSelectedLinks = linksInRange(rich, selection).some(Boolean);
  function setDraft(next: LinkDraft | null) { linkDraftRef.current = next; setLinkDraft(next); setError(''); }
  function openLink() {
    if (composition.current) finishComposition();
    const range = selectionRef.current, link = selectedLink(richRef.current, range);
    if (!link && range.start === range.end) return;
    setDraft({ existing: !!link, selection: range, link: link ? structuredClone(link) : { id: crypto.randomUUID(), name: `Link ${(richRef.current.links?.length ?? 0) + 1}`, interactions: [{ id: crypto.randomUUID(), name: 'Open link', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: crypto.randomUUID(), type: 'openUrl', value: '', windowTarget: 'current' }] }] } });
  }
  function draftRichText() {
    const draft = linkDraftRef.current; if (!draft) return richRef.current;
    return draft.existing ? updateRichTextLink(richRef.current, draft.link.id, { ...draft.link, mouseOverStyle: draft.link.mouseOverStyle, mouseDownStyle: draft.link.mouseDownStyle }) : assignRichTextLink(richRef.current, draft.selection.start, draft.selection.end, draft.link);
  }
  function applyLink() { attempt(() => { const range = linkDraftRef.current!.selection; const next = parseRichText(draftRichText()); setDraft(null); commit(next, range); queueMicrotask(() => { if (mounted.current) writeRichSelection(root.current!, range); }); }); }
  function cancelLink() { const range = linkDraftRef.current?.selection ?? selectionRef.current; setDraft(null); queueMicrotask(() => { if (mounted.current) writeRichSelection(root.current!, range); }); }
  function unlink() { attempt(() => { const range = selectionRef.current; commit(range.start !== range.end ? removeRichTextLinkRange(richRef.current, range.start, range.end) : activeLink ? removeRichTextLink(richRef.current, activeLink.id) : richRef.current, range); }); }
  function snapshot(): Snapshot { return { rich: richRef.current, selection: selectionRef.current, insertion: insertionRef.current }; }
  function remember(value: typeof history) { historyRef.current = value; setHistory(value); }
  function paint(next: RichText, range: Selection, focus = true) {
    if (!root.current) return;
    // Programmatic select changes need not focus their control. Keep a toolbar
    // edit from reading the collapsed Selection produced by replacing its DOM.
    if (!focus && document.activeElement === root.current) toolbar.current?.focus({ preventScroll: true });
    paintRichText(root.current, styleOverride ? applyRichTextStyle(next, styleOverride) : next, base);
    if (focus) writeRichSelection(root.current, range);
  }
  function commit(next: RichText, range = selectionRef.current, rememberEdit = true, focus = true) {
    next = parseRichText(next);
    const previous = snapshot();
    if (rememberEdit && JSON.stringify(next) !== JSON.stringify(previous.rich)) remember({ past: [...historyRef.current.past.slice(-99), previous], future: [] });
    richRef.current = next; selectionRef.current = range; setRich(next); setSelection(range); setError('');
    setParagraphIndex(richParagraphAt(next, range.start)); paint(next, range, focus);
  }
  function attempt(operation: () => void) { try { operation(); } catch (cause) { setError(String(cause)); if (linkDraftRef.current) toolbar.current?.focus({ preventScroll: true }); else paint(richRef.current, selectionRef.current); } }
  function trackSelection() {
    if (composition.current || linkDraftRef.current || document.activeElement !== root.current) return;
    const value = root.current && readRichSelection(root.current); if (!value) return;
    if (value.start !== selectionRef.current.start || value.end !== selectionRef.current.end) { insertionRef.current = {}; setInsertion({}); }
    selectionRef.current = value; setSelection(value); setParagraphIndex(richParagraphAt(richRef.current, value.start));
    const style = { ...widget.style, ...runStyleAt(richRef.current, value.start), ...insertionRef.current };
    setFamily(style.fontFamily); setSize(String(style.fontSize)); if (style.color.startsWith('#')) setColor(style.color);
  }
  function format(style: RichTextRunStyle) {
    attempt(() => {
      const value = selectionRef.current;
      if (value.start === value.end) { const marks = { ...insertionRef.current, ...style }; insertionRef.current = marks; setInsertion(marks); writeRichSelection(root.current!, value); }
      else commit(formatRichTextRange(richRef.current, value.start, value.end, style), value);
    });
  }
  function insert(text: string, soft = false, range = selectionRef.current) {
    const normalized = text.replace(/\r\n?/g, '\n');
    const next = soft ? insertRichTextSoftBreak(richRef.current, range.start, range.end, insertionRef.current) : replaceRichTextRange(richRef.current, range.start, range.end, normalized, insertionRef.current);
    const end = range.start + normalized.length; commit(next, { start: end, end });
  }
  function before(event: InputEvent) {
    if (event.isComposing || composition.current) return;
    const domRange = event.getTargetRanges?.()[0];
    let range = domRange ? { start: offsetFromDOM(root.current!, domRange.startContainer, domRange.startOffset), end: offsetFromDOM(root.current!, domRange.endContainer, domRange.endOffset) } : readRichSelection(root.current!) ?? selectionRef.current;
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); restore(event.inputType === 'historyUndo' ? 'undo' : 'redo'); return; }
    if (event.inputType.startsWith('format')) { event.preventDefault(); return; }
    if (event.inputType.startsWith('insert') && event.inputType !== 'insertFromPaste' && event.inputType !== 'insertFromDrop') {
      event.preventDefault(); attempt(() => insert(event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak' ? '\n' : event.data ?? '', event.inputType === 'insertLineBreak', range)); return;
    }
    if (event.inputType.startsWith('delete')) {
      event.preventDefault();
      if (range.start === range.end) {
        const text = richTextPlainText(richRef.current), points = [0, ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.index + part.segment.length)];
        range = event.inputType.endsWith('Backward') ? { start: points.filter(point => point < range.start).at(-1) ?? 0, end: range.end } : { start: range.start, end: points.find(point => point > range.end) ?? text.length };
      }
      attempt(() => insert('', false, range));
    }
  }
  function finishComposition() {
    const previous = composition.current; if (!previous || !root.current) return;
    const text = editableText(root.current), range = readRichSelection(root.current);
    composition.current = null;
    attempt(() => {
      const change = textInputRange(richTextPlainText(previous.rich), text, { ...previous.selection, inputType: 'insertCompositionText' });
      const next = replaceRichTextRange(previous.rich, change.start, change.end, change.text, previous.insertion);
      const end = change.start + change.text.length;
      commit(next, range ?? { start: end, end });
    });
  }
  function input(event: InputEvent) {
    if (event.isComposing || composition.current) return;
    // Accessibility tools/browser replacements may deliver input without a cancellable beforeinput.
    const text = editableText(root.current!); if (text === richTextPlainText(richRef.current)) return;
    attempt(() => { const change = changedTextRange(richTextPlainText(richRef.current), text), end = change.start + change.text.length; commit(replaceRichTextRange(richRef.current, change.start, change.end, change.text, insertionRef.current), readRichSelection(root.current!) ?? { start: end, end }); });
  }
  function restore(direction: 'undo' | 'redo') {
    if (composition.current) finishComposition();
    const state = historyRef.current, next = direction === 'undo' ? state.past.at(-1) : state.future[0]; if (!next) return;
    remember(direction === 'undo' ? { past: state.past.slice(0, -1), future: [snapshot(), ...state.future] } : { past: [...state.past, snapshot()], future: state.future.slice(1) });
    insertionRef.current = next.insertion; setInsertion(next.insertion); commit(next.rich, next.selection, false);
  }
  function paragraphStyle(patch: Partial<Pick<RichText['paragraphs'][number], 'textAlign' | 'lineHeightPx'>>) {
    attempt(() => { const index = paragraphIndex; commit({ ...richRef.current, paragraphs: richRef.current.paragraphs.map((value, at) => at === index ? { ...value, ...patch } : value) }, selectionRef.current, true, false); setParagraphIndex(index); });
  }
  function apply(): boolean {
    if(applyingRef.current)return false;
    if (composition.current) finishComposition();
    try {
      const result=onApply(parseRichText(draftRichText()));
      if(result){
        applyingRef.current=true;setApplying(true);setError('');
        void result.then(accepted=>{if(mounted.current&&!accepted)setError('Text could not be applied. Your draft is still available; retry or cancel.');},cause=>{if(mounted.current)setError(String(cause));}).finally(()=>{applyingRef.current=false;if(mounted.current)setApplying(false);});
        // An outside pointer/focus action must not replace the document or
        // cancel this asynchronous commit before its measurements finish.
        return false;
      }
      return true;
    }
    catch (cause) { setError(String(cause)); toolbar.current?.focus({ preventScroll: true }); return false; }
  }
  function keyDown(event: KeyboardEvent) {
    event.stopPropagation(); if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); if (linkDraftRef.current) cancelLink(); else onCancel(); return; }
    if(applyingRef.current){event.preventDefault();return;}
    const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (mod && ['z', 'y'].includes(key) && !linkDraftRef.current) { event.preventDefault(); restore(key === 'y' || event.shiftKey ? 'redo' : 'undo'); }
    if (mod && event.key === 'Enter') { event.preventDefault(); apply(); }
    if (mod && key === 's') event.preventDefault();
    if (event.currentTarget === root.current && mod && ['b', 'i', 'u'].includes(key)) { event.preventDefault(); format(key === 'b' ? { fontWeight: activeStyle.fontWeight >= 600 ? 400 : 700 } : key === 'i' ? { fontStyle: activeStyle.fontStyle === 'italic' ? 'normal' : 'italic' } : { underline: !activeStyle.underline }); }
  }
  actions.current = { before, input, selection: trackSelection, apply };
  useLayoutEffect(() => {
    mounted.current = true;
    const element = root.current!, previous = document.activeElement as HTMLElement | null;
    paint(richRef.current, selectionRef.current);
    const onBefore = (event: InputEvent) => actions.current.before(event), onInput = (event: Event) => actions.current.input(event as InputEvent), onSelection = () => actions.current.selection();
    const leave = (event: Event) => {
      const target = event.target as Node | null;
      if (!mounted.current || !target || element.contains(target) || toolbar.current?.contains(target)) return;
      // Commit before the next canvas/tool handler obtains its document snapshot.
      let accepted = false; flushSync(() => { accepted = actions.current.apply(); });
      if (!accepted) { event.preventDefault(); event.stopPropagation(); toolbar.current?.focus({ preventScroll: true }); }
    };
    element.addEventListener('beforeinput', onBefore); element.addEventListener('input', onInput); document.addEventListener('selectionchange', onSelection);
    document.addEventListener('pointerdown', leave, true); document.addEventListener('focusin', leave, true);
    return () => { mounted.current = false; element.removeEventListener('beforeinput', onBefore); element.removeEventListener('input', onInput); document.removeEventListener('selectionchange', onSelection); document.removeEventListener('pointerdown', leave, true); document.removeEventListener('focusin', leave, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    // The App remounts the editor when the document/page/edited widget changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Keep the text-node editor's offset model: pre preserves soft LF during
  // editing without replacing characters with zero-length BR DOM nodes.
  return <><span ref={root} className="rich-inline-editor" style={shapeText.supports({ ...widget, style: base }) ? { whiteSpace: widget.shapeText!.autoFitWidth ? 'pre' : 'pre-wrap', overflowWrap: 'break-word' } : undefined} contentEditable={!linkDraft&&!applying} aria-readonly={Boolean(linkDraft)||applying} suppressContentEditableWarning role="textbox" aria-label="Formatted text content" aria-multiline="true" spellCheck={false}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={keyDown}
    onPaste={event => { event.preventDefault(); attempt(() => insert(event.clipboardData.getData('text/plain'))); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); }}
    onCompositionStart={() => { composition.current = snapshot(); }} onCompositionEnd={() => queueMicrotask(() => { if (mounted.current) finishComposition(); })}/>
    {createPortal(<section ref={toolbar} tabIndex={-1} className="rich-editor-tools" role="region" aria-label="Text editing tools" onKeyDown={keyDown} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <div className="rich-editor-heading"><strong>{widget.name}</strong><span>{applying?'Applying text…':'Select and edit text on the canvas · Shift+Enter adds a line break'}</span><button onClick={onCancel}>Cancel</button><button className="primary-button" disabled={applying} onClick={apply}>Done editing text</button></div>
      <fieldset disabled={Boolean(linkDraft)||applying} className="rich-editor-toolbar" role="toolbar" aria-label="Text selection formatting">
        <label>Font<input aria-label="Selection font family" value={family} onChange={event => setFamily(event.target.value)}/></label><button disabled={!family.trim()} onClick={() => format({ fontFamily: family })}>Apply font</button>
        <label>Size<input aria-label="Selection font size" type="number" min="1" max="512" value={size} onChange={event => setSize(event.target.value)}/></label><button disabled={!Number.isFinite(Number(size)) || Number(size) < 1 || Number(size) > 512} onClick={() => format({ fontSize: Number(size) })}>Apply size</button>
        <button aria-label="Bold selection" aria-pressed={activeStyle.fontWeight >= 600} onClick={() => format({ fontWeight: 700 })}><b>B</b></button><button onClick={() => format({ fontWeight: 400 })}>Regular weight</button>
        <button aria-label="Italic selection" aria-pressed={activeStyle.fontStyle === 'italic'} onClick={() => format({ fontStyle: 'italic' })}><i>I</i></button><button onClick={() => format({ fontStyle: 'normal' })}>Normal style</button>
        <button aria-label="Underline selection" aria-pressed={!!activeStyle.underline} onClick={() => format({ underline: !activeStyle.underline })}><u>U</u></button><button aria-label="Strikethrough selection" aria-pressed={!!activeStyle.strikethrough} onClick={() => format({ strikethrough: !activeStyle.strikethrough })}><s>S</s></button>
        <label>Color<input aria-label="Selection text color" type="color" value={color} onChange={event => setColor(event.target.value)}/></label><button onClick={() => format({ color })}>Apply color</button>
        <button disabled={!activeLink && selection.start === selection.end} onClick={openLink}>{activeLink ? 'Edit hyperlink' : 'Add hyperlink'}</button><button disabled={!activeLink && !hasSelectedLinks} onClick={unlink}>Remove hyperlink</button>
      </fieldset>
      <fieldset disabled={Boolean(linkDraft)||applying} className="rich-editor-paragraph">
        <label><input aria-label="Text expressions" type="checkbox" checked={rich.expressionMode !== 'literal'} onChange={event => { const next = { ...rich }; if (event.target.checked) delete next.expressionMode; else next.expressionMode = 'literal'; attempt(() => commit(next, selectionRef.current, true, false)); }}/>Text expressions</label>
        <label>Paragraph<select aria-label="Formatted text paragraph" value={Math.min(paragraphIndex, rich.paragraphs.length - 1)} onChange={event => setParagraphIndex(Number(event.target.value))}>{rich.paragraphs.map((_, index) => <option key={index} value={index}>Paragraph {index + 1}</option>)}</select></label>
        <label>Alignment<select aria-label="Paragraph alignment" value={paragraph.textAlign ?? ''} onChange={event => paragraphStyle({ textAlign: (event.target.value || undefined) as typeof paragraph.textAlign })}><option value="">Inherit</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Line height<select aria-label="Paragraph line height" value={paragraph.lineHeightPx === undefined ? '' : paragraph.lineHeightPx === 'normal' ? 'normal' : 'pixels'} onChange={event => paragraphStyle({ lineHeightPx: event.target.value === 'pixels' ? widget.style.fontSize * 1.35 : event.target.value === 'normal' ? 'normal' : undefined })}><option value="">Inherit</option><option value="normal">Normal</option><option value="pixels">Pixels</option></select></label>
        {typeof paragraph.lineHeightPx === 'number' && <label>Pixels<input aria-label="Paragraph line height pixels" type="number" min="0.1" max="10000" step="0.1" value={paragraph.lineHeightPx} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0 && value <= 10000) paragraphStyle({ lineHeightPx: value }); }}/></label>}
        <span className="rich-editor-spacer"/><span>{selection.end - selection.start} characters selected</span><button disabled={!history.past.length} onClick={() => restore('undo')}>Undo text edit</button><button disabled={!history.future.length} onClick={() => restore('redo')}>Redo text edit</button>
      </fieldset>
      {linkDraft && <HyperlinkDraftEditor draft={linkDraft} document={project} page={page} widget={widget} onChange={link => setDraft({ ...linkDraftRef.current!, link })} onApply={applyLink} onCancel={cancelLink}/>}
      {error && <p role="alert" className="rich-editor-error">{error}</p>}
    </section>, document.body)}
  </>;
}

