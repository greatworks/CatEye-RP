import { createOfflineRuntime, mountOfflinePrototype } from './export-runtime';
import { createInlineFrameHost, type InlineFrameOptions } from './inline-frame-runtime';
import { evaluateExpression } from './expressions';
import { bindRuntimeDrag } from './drag-input';
import { createBrowserBoxReader } from './browser-box';
import { vectorPathData } from '../model/vector';
import { frameFileUrl } from '../model/inline-frame';
import { createShapeTextRenderer } from '../model/shape-text';
import { createShapeTextMeasurer } from './shape-text-measure';
import { createSelectionTextLayout } from './selection-text-layout';
import { createSelectionDisplay } from './selection-display';
import { createSelectionIndicatorRenderer } from '../model/selection-indicator';
import { createShadowRenderer } from '../model/shadow';
import { createGradientRenderer } from '../model/gradient';
import { createLineStyleRenderer } from '../model/line-style';
import type { Document } from '../model/types';

// Built into a fixed HTML document with a content-hash-authorized classic
// script. Opaque file:// frames cannot load a separate local script resource.
const token = document.querySelector<HTMLMetaElement>('meta[name="rea-frame-token"]')?.content || location.hash.slice(1);
const template = document.documentElement.cloneNode(true) as HTMLElement;
template.querySelectorAll('meta[name="rea-frame-token"]').forEach(meta => meta.remove());
const playerHtml = '<!doctype html>' + template.outerHTML;
let initialized = false;
window.addEventListener('message', event => {
  if (initialized || event.source !== window.parent || !event.data || event.data.channel !== 'rea-inline-frame-init' || event.data.token !== token) return;
  const { doc, options, pageId } = event.data as { doc: Document; options: InlineFrameOptions; pageId: string };
  if (!doc?.pages?.some(page => page.id === pageId) || options?.token !== token) return;
  initialized = true;
  const style = document.createElement('style'); style.textContent = options.styles; document.head.append(style);
  options.fileUrl = frameFileUrl;
  options.playerHtml = playerHtml;
  const runtime = createOfflineRuntime(doc, pageId, evaluateExpression, createBrowserBoxReader(), { width: window.innerWidth, height: window.innerHeight, clampToPage: true });
  const frames = createInlineFrameHost(doc, runtime, options);
  const shapeText = createShapeTextRenderer();
  mountOfflinePrototype(doc, runtime, document.getElementById('prototype')!, vectorPathData, { frames, dragInput: bindRuntimeDrag, embedded: true, previewImages: true, shapeText, shapeTextMeasure: createShapeTextMeasurer(shapeText), selectionDisplay: createSelectionDisplay(createSelectionTextLayout(shapeText), createSelectionIndicatorRenderer()), shadows: createShadowRenderer(), lines:createLineStyleRenderer(), gradients:createGradientRenderer(createLineStyleRenderer()) });
});
window.parent.postMessage({ channel: 'rea-inline-frame', operation: 'ready', token }, '*');
