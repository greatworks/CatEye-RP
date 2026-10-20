import type { RichText, WidgetStyle } from '../model/types';
import { textDecorationLine } from '../model/rich-text';

export type RichSelection = { start: number; end: number; backward?: boolean };

/** Only our paragraph/run schema is written. Pasted/IME DOM is never imported as HTML. */
export function paintRichText(root: HTMLElement, rich: RichText, base: Partial<WidgetStyle>) {
  const document = root.ownerDocument, fragment = document.createDocumentFragment();
  for (const [index, paragraph] of rich.paragraphs.entries()) {
    const block = document.createElement('span'); block.dataset.richParagraph = String(index);
    Object.assign(block.style, { display: 'block', margin: '0', textAlign: paragraph.textAlign ?? '', lineHeight: typeof paragraph.lineHeightPx === 'number' ? `${paragraph.lineHeightPx}px` : paragraph.lineHeightPx ?? '' });
    for (const [runIndex, run] of paragraph.runs.entries()) {
      const span = document.createElement('span'); span.dataset.richRun = String(runIndex);
      if (run.linkId) { span.dataset.richLinkId = run.linkId; span.title = `Hyperlink: ${rich.links?.find(link => link.id === run.linkId)?.name ?? ''}`; }
      const style = run.style ?? {};
      Object.assign(span.style, { fontFamily: style.fontFamily ?? '', fontSize: style.fontSize === undefined ? '' : `${style.fontSize}px`, fontWeight: style.fontWeight === undefined ? '' : String(style.fontWeight), fontStyle: style.fontStyle ?? '', color: style.color ?? '', textDecorationLine: textDecorationLine({ underline: style.underline ?? base.underline, strikethrough: style.strikethrough ?? base.strikethrough }) });
      span.textContent = run.text; block.append(span);
    }
    const text = paragraph.runs.map(run => run.text).join('');
    // A trailing soft break needs a final caret line. The sentinel contributes no model character.
    if (!text || text.endsWith('\n')) { const br = document.createElement('br'); br.dataset.richSentinel = ''; block.append(br); }
    fragment.append(block);
  }
  root.replaceChildren(fragment);
}

export function editableText(root: HTMLElement): string {
  // A browser/accessibility replacement can leave a bare text node at the root.
  // Read only text in that fallback too; never infer formatting from foreign DOM.
  return Array.from(root.childNodes, node => node.textContent ?? '').join('\n').replace(/\r\n?/g, '\n');
}

export function offsetFromDOM(root: HTMLElement, node: Node, offset: number): number {
  const paragraphs = Array.from(root.children);
  if (node === root) return paragraphs.slice(0, offset).reduce((sum, p) => sum + (p.textContent?.length ?? 0) + 1, 0) - (offset === paragraphs.length && offset > 0 ? 1 : 0);
  let block: Node | null = node;
  while (block && block.parentNode !== root) block = block.parentNode;
  if (!block) return 0;
  const index = paragraphs.indexOf(block as Element);
  const prefix = paragraphs.slice(0, index).reduce((sum, p) => sum + (p.textContent?.length ?? 0) + 1, 0);
  const range = root.ownerDocument.createRange(); range.selectNodeContents(block); range.setEnd(node, offset);
  return prefix + range.toString().length;
}

export function readRichSelection(root: HTMLElement): RichSelection | undefined {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return undefined;
  const anchor = offsetFromDOM(root, selection.anchorNode, selection.anchorOffset), focus = offsetFromDOM(root, selection.focusNode, selection.focusOffset);
  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus), backward: anchor > focus };
}

function pointAt(root: HTMLElement, offset: number): [Node, number] {
  const paragraphs = Array.from(root.children);
  for (let index = 0; index < paragraphs.length; index++) {
    const block = paragraphs[index], length = block.textContent?.length ?? 0;
    if (offset <= length || index === paragraphs.length - 1) {
      const walk = root.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT); let node: Node | null;
      while ((node = walk.nextNode())) { const size = node.textContent?.length ?? 0; if (offset <= size) return [node, Math.min(offset, size)]; offset -= size; }
      return [block, 0];
    }
    offset -= length + 1;
  }
  return [root, 0];
}

export function writeRichSelection(root: HTMLElement, value: RichSelection, focus = true) {
  if (focus) root.focus({ preventScroll: true });
  const first = pointAt(root, value.start), last = pointAt(root, value.end), selection = root.ownerDocument.getSelection();
  if (value.backward) selection?.setBaseAndExtent(last[0], last[1], first[0], first[1]);
  else selection?.setBaseAndExtent(first[0], first[1], last[0], last[1]);
}
