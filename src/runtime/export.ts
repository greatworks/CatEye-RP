import { createInlineFrameHost, type InlineFrameOptions } from './inline-frame-runtime';
import { frameFileUrl } from '../model/inline-frame';
import { createBrowserBoxReader } from './browser-box';
import type { Document } from '../model/types';
import { parseDocument } from '../model/document';
import { createOfflineRuntime, mountOfflinePrototype } from './export-runtime';
import { evaluateExpression } from './expressions';
import { bindRuntimeDrag } from './drag-input';
import { vectorPathData } from '../model/vector';
import { createShapeTextRenderer } from '../model/shape-text';
import { createShapeTextMeasurer } from './shape-text-measure';
import { createShadowRenderer } from '../model/shadow';
import { createGradientRenderer } from '../model/gradient';
import { createLineStyleRenderer } from '../model/line-style';
import caseMenuStyles from '../components/CaseMenus.css?raw';
import { documentFontAssets } from './embedded-fonts';

/** Generates one portable HTML file, including licensed bundled fonts when used.
 * No original Axure runtime code is included. */
export function exportPrototype(doc: Document): string {
  const validated = parseDocument(JSON.stringify(doc));
  // The model permits HTTP images; an offline artifact deliberately requires embedded assets.
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'imageSrc' && typeof child === 'string' && child && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(child)) throw new Error('Offline export requires embedded PNG, JPEG, WebP or GIF images. Import remote images into the project first.');
      inspect(child);
    }
  };
  inspect(validated);
  const json = JSON.stringify(validated).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const title = validated.name.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
  const fonts = documentFontAssets(validated);
  const fontLicense = fonts.license ? `<!--\n${fonts.license.replace(/--/g, '- -')}\n-->` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src about: https: http: file:; base-uri 'none'; form-action 'none'">
<title>${title}</title>${fontLicense}<style id="prototype-styles">
${prototypeStyles(validated)}
</style></head><body><div id="prototype"></div><script id="prototype-data" type="application/json">${json}</script><script>
const doc=JSON.parse(document.getElementById('prototype-data').textContent),runtime=(${createOfflineRuntime.toString()})(doc,undefined,(${evaluateExpression.toString()}),(${createBrowserBoxReader.toString()})(),{width:window.innerWidth,height:window.innerHeight,clampToPage:true});
const frames=(${createInlineFrameHost.toString()})(doc,runtime,{bootstrap:${scriptJSON(inlineFrameBootstrap())},styles:document.getElementById('prototype-styles').textContent,base:location.href,fileUrl:(${frameFileUrl.toString()})});
const shapeText=(${createShapeTextRenderer.toString()})();
(${mountOfflinePrototype.toString()})(doc,runtime,document.getElementById('prototype'),(${vectorPathData.toString()}),{frames,dragInput:(${bindRuntimeDrag.toString()}),shapeText,shapeTextMeasure:(${createShapeTextMeasurer.toString()})(shapeText),shadows:(${createShadowRenderer.toString()})(),lines:(${createLineStyleRenderer.toString()})(),gradients:(${createGradientRenderer.toString()})((${createLineStyleRenderer.toString()})())});
</script></body></html>`;
}

function scriptJSON(value: unknown): string { return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')); }

export function prototypeStyles(doc: Document): string { return `${documentFontAssets(doc).css}
*{box-sizing:border-box}body{margin:0;background:#e9edf2;color:#263348;font:14px Arial,sans-serif}nav{position:sticky;top:0;z-index:10;display:flex;gap:8px;align-items:center;min-height:52px;padding:10px 18px;background:#fff;border-bottom:1px solid #d8dde5}nav strong{margin-right:24px}nav button{font:inherit;padding:6px 12px;border:1px solid #d8dde5;background:#fff;border-radius:4px;cursor:pointer}nav button[aria-current=true]{background:#5b5ce2;color:#fff}main{position:relative;margin:24px auto;box-shadow:0 2px 16px #0001}.widget{box-sizing:border-box;overflow:hidden}.widget-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:inherit;padding:5px;white-space:pre-wrap;overflow-wrap:anywhere}.widget.text .widget-text{display:block}.widget input:not([type=checkbox]):not([type=radio]),.widget textarea,.widget select{width:100%;height:100%;font:inherit;color:inherit;text-align:inherit;background:transparent;border:0;padding:7px;outline-offset:-2px}.widget label{display:flex;gap:7px;align-items:center;height:100%}.widget img{width:100%;height:100%;object-fit:contain}.repeater-row{position:relative;display:flex;gap:12px;padding:0 8px}.placeholder{background-image:linear-gradient(to top right,transparent 49.7%,#ccd2dc 50%,transparent 50.3%),linear-gradient(to bottom right,transparent 49.7%,#ccd2dc 50%,transparent 50.3%)}output:not(:empty){display:block;background:#fff1f0;color:#9e1b19;padding:12px}button:focus-visible,[role=button]:focus-visible{outline:2px solid #696bf0;outline-offset:2px}
${caseMenuStyles}
.offline-header{height:52px;display:flex;align-items:center;gap:16px;padding:0 16px;background:#fff;border-bottom:1px solid #d8dde5}.offline-header button{font:inherit;border:0;background:transparent;cursor:pointer;padding:6px}.offline-layout{display:flex;height:calc(100vh - 52px);min-height:0}.offline-layout>nav{position:static;display:block;flex:0 0 210px;width:210px;min-width:0;overflow:auto;padding:12px 8px;border-right:1px solid #d8dde5;border-bottom:0}.offline-layout>nav[hidden]{display:none}.offline-viewport{flex:1;min-width:0;overflow:auto}.offline-viewport main{margin:24px auto}.navigation-row{display:flex;align-items:center;min-height:33px}.navigation-row button{display:block;min-width:0;flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:0;padding:8px 9px}.navigation-row .navigation-toggle{flex:0 0 22px;width:22px;padding:5px 3px}.navigation-folder{font-weight:600;color:#69778a}.navigation-row button:hover{background:#eef3ff}.navigation-row button[aria-current=true]{background:#5b5ce2;color:#fff}
`; }

/** The child carries source factories, never parent globals or a desktop bridge. */
export function inlineFrameBootstrap(): string {
  return `function(doc,options,pageId){options.fileUrl=(${frameFileUrl.toString()});const runtime=(${createOfflineRuntime.toString()})(doc,pageId,(${evaluateExpression.toString()}),(${createBrowserBoxReader.toString()})(),{width:window.innerWidth,height:window.innerHeight,clampToPage:true});const frames=(${createInlineFrameHost.toString()})(doc,runtime,options),shapeText=(${createShapeTextRenderer.toString()})();(${mountOfflinePrototype.toString()})(doc,runtime,document.getElementById('prototype'),(${vectorPathData.toString()}),{frames,dragInput:(${bindRuntimeDrag.toString()}),embedded:true,shapeText,shapeTextMeasure:(${createShapeTextMeasurer.toString()})(shapeText),shadows:(${createShadowRenderer.toString()})(),lines:(${createLineStyleRenderer.toString()})(),gradients:(${createGradientRenderer.toString()})((${createLineStyleRenderer.toString()})())});}`;
}

export function previewFrameOptions(doc: Document, external: NonNullable<InlineFrameOptions['external']>): InlineFrameOptions { return { bootstrap: inlineFrameBootstrap(), styles: prototypeStyles(doc), base: location.href, fileUrl: frameFileUrl, external, playerUrl: new URL('frame-player.html', location.href).href }; }
