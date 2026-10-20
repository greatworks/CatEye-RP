import thin from '../assets/fonts/roboto/Roboto-Thin.ttf?inline';
import light from '../assets/fonts/roboto/Roboto-Light.ttf?inline';
import regular from '../assets/fonts/roboto/Roboto-Regular.ttf?inline';
import medium from '../assets/fonts/roboto/Roboto-Medium.ttf?inline';
import bold from '../assets/fonts/roboto/Roboto-Bold.ttf?inline';
import black from '../assets/fonts/roboto/Roboto-Black.ttf?inline';
import thinItalic from '../assets/fonts/roboto/Roboto-ThinItalic.ttf?inline';
import lightItalic from '../assets/fonts/roboto/Roboto-LightItalic.ttf?inline';
import regularItalic from '../assets/fonts/roboto/Roboto-RegularItalic.ttf?inline';
import mediumItalic from '../assets/fonts/roboto/Roboto-MediumItalic.ttf?inline';
import boldItalic from '../assets/fonts/roboto/Roboto-BoldItalic.ttf?inline';
import blackItalic from '../assets/fonts/roboto/Roboto-BlackItalic.ttf?inline';
import license from '../assets/fonts/roboto/LICENSE.txt?raw';
import notice from '../assets/fonts/roboto/NOTICE.txt?raw';
import openSansLight from '../assets/fonts/open-sans/OpenSans-Light.ttf?inline';
import openSansRegular from '../assets/fonts/open-sans/OpenSans-Regular.ttf?inline';
import openSansSemiBold from '../assets/fonts/open-sans/OpenSans-SemiBold.ttf?inline';
import openSansBold from '../assets/fonts/open-sans/OpenSans-Bold.ttf?inline';
import openSansExtraBold from '../assets/fonts/open-sans/OpenSans-ExtraBold.ttf?inline';
import openSansLightItalic from '../assets/fonts/open-sans/OpenSans-LightItalic.ttf?inline';
import openSansItalic from '../assets/fonts/open-sans/OpenSans-Italic.ttf?inline';
import openSansSemiBoldItalic from '../assets/fonts/open-sans/OpenSans-SemiBoldItalic.ttf?inline';
import openSansBoldItalic from '../assets/fonts/open-sans/OpenSans-BoldItalic.ttf?inline';
import openSansExtraBoldItalic from '../assets/fonts/open-sans/OpenSans-ExtraBoldItalic.ttf?inline';
import openSansLicense from '../assets/fonts/open-sans/LICENSE.txt?raw';
import openSansNotice from '../assets/fonts/open-sans/NOTICE.txt?raw';
import type { Document as PrototypeDocument, Interaction, Widget, WidgetStyle } from '../model/types';

/** Unmodified Apache-2.0 Roboto binaries. Thin is explicitly mapped to CSS 100;
 * its source OS/2 usWeightClass is 250, not a claimed native CSS weight mapping. */
export const ROBOTO_FACES = [
  { weight: 100, style: 'normal', name: 'Thin', url: thin },
  { weight: 300, style: 'normal', name: 'Light', url: light },
  { weight: 400, style: 'normal', name: 'Regular', url: regular },
  { weight: 500, style: 'normal', name: 'Medium', url: medium },
  { weight: 700, style: 'normal', name: 'Bold', url: bold },
  { weight: 900, style: 'normal', name: 'Black', url: black },
  { weight: 100, style: 'italic', name: 'ThinItalic', url: thinItalic },
  { weight: 300, style: 'italic', name: 'LightItalic', url: lightItalic },
  { weight: 400, style: 'italic', name: 'RegularItalic', url: regularItalic },
  { weight: 500, style: 'italic', name: 'MediumItalic', url: mediumItalic },
  { weight: 700, style: 'italic', name: 'BoldItalic', url: boldItalic },
  { weight: 900, style: 'italic', name: 'BlackItalic', url: blackItalic },
] as const;

/** Version 1.10, unchanged Apache-2.0 bytes. Italic and RegularItalic were
 * byte-identical in the retained distribution; register the 400 face once. */
export const OPEN_SANS_FACES = [
  { weight: 300, style: 'normal', name: 'Light', url: openSansLight },
  { weight: 400, style: 'normal', name: 'Regular', url: openSansRegular },
  { weight: 600, style: 'normal', name: 'SemiBold', url: openSansSemiBold },
  { weight: 700, style: 'normal', name: 'Bold', url: openSansBold },
  { weight: 800, style: 'normal', name: 'ExtraBold', url: openSansExtraBold },
  { weight: 300, style: 'italic', name: 'LightItalic', url: openSansLightItalic },
  { weight: 400, style: 'italic', name: 'Italic', url: openSansItalic },
  { weight: 600, style: 'italic', name: 'SemiBoldItalic', url: openSansSemiBoldItalic },
  { weight: 700, style: 'italic', name: 'BoldItalic', url: openSansBoldItalic },
  { weight: 800, style: 'italic', name: 'ExtraBoldItalic', url: openSansExtraBoldItalic },
] as const;

function fontCSS(family: string, faces: readonly { weight: number; style: string; url: string }[]): string {
  return faces.map(face => `@font-face{font-family:"${family}";font-style:${face.style};font-weight:${face.weight};font-display:block;src:url("${face.url}") format("truetype")}`).join('\n');
}

// No local() source: the same retained font bytes must win over missing or
// differently-versioned system fonts in the browser, desktop and exported file.
export const ROBOTO_FONT_CSS = fontCSS('Roboto', ROBOTO_FACES);
export const ROBOTO_FONT_LICENSE = `${notice.trim()}\n\n${license.trim()}`;
export const OPEN_SANS_FONT_CSS = fontCSS('Open Sans', OPEN_SANS_FACES);
export const OPEN_SANS_FONT_LICENSE = `${openSansNotice.trim()}\n\n${openSansLicense.trim()}`;
const families = [
  { name: 'Roboto', id: 'rea-embedded-roboto', css: ROBOTO_FONT_CSS, license: ROBOTO_FONT_LICENSE },
  { name: 'Open Sans', id: 'rea-embedded-open-sans', css: OPEN_SANS_FONT_CSS, license: OPEN_SANS_FONT_LICENSE },
] as const;

/** Install before the editor mounts. Font loading stays local to data URLs. */
export function installEmbeddedFonts(target: globalThis.Document): void {
  for (const family of families) {
    if (target.getElementById(family.id)) continue;
    const style = target.createElement('style'); style.id = family.id; style.textContent = family.css; target.head.append(style);
  }
}

function usesFamily(style: Partial<WidgetStyle> | undefined, family: string): boolean {
  // A comma inside a quoted name is not a fallback-family delimiter.
  const value = style?.fontFamily ?? '', names: string[] = []; let start = 0, quote = '';
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === ',') { names.push(value.slice(start, index)); start = index + 1; }
  }
  if (quote) return false;
  names.push(value.slice(start));
  return names.some(name => {
    const trimmed = name.trim();
    const quoted = trimmed.match(/^(['"])(.*)\1$/);
    // CSS unquoted family names collapse whitespace; quoted names retain it.
    const normalized = quoted ? quoted[2] : trimmed.replace(/[ \t\r\n\f]+/g, ' ');
    return normalized.toLowerCase() === family.toLowerCase();
  });
}
function interactionsUseFamily(interactions: Interaction[], family: string): boolean {
  return interactions.some(interaction => interaction.actions.some(action => usesFamily(action.style, family)));
}
function widgetsUseFamily(widgets: Widget[], family: string): boolean {
  return widgets.some(widget =>
    [widget.style, widget.selectedStyle, widget.mouseOverStyle, widget.mouseDownStyle, widget.focusedStyle, widget.disabledStyle, widget.errorStyle, widget.hintStyle].some(style => usesFamily(style, family))
    || interactionsUseFamily(widget.interactions, family)
    || widget.richText?.paragraphs.some(paragraph => paragraph.runs.some(run => usesFamily(run.style, family)))
    || widget.richText?.links?.some(link => usesFamily(link.mouseOverStyle, family) || usesFamily(link.mouseDownStyle, family) || interactionsUseFamily(link.interactions, family))
    || Boolean(widget.layer && widgetsUseFamily(widget.layer.widgets, family))
    || widget.states?.some(state => widgetsUseFamily(state.widgets, family))
    || Boolean(widget.repeater && widgetsUseFamily(widget.repeater.template, family))
    || Boolean(widget.table && widgetsUseFamily(widget.table.cells, family))
    || Boolean(widget.menu && widgetsUseFamily([widget.menu.table, ...widget.menu.submenus], family))
    || Boolean(widget.tree && widgetsUseFamily(widget.tree.nodes, family))
    || Boolean(widget.treeNode && widgetsUseFamily([widget.treeNode.label, ...widget.treeNode.children], family)),
  );
}

/** Include every face when the document can use a family, including deferred
 * states/actions. A runtime weight change must never fall back to an OS font. */
function documentUsesFamily(doc: PrototypeDocument, family: string): boolean {
  return doc.pages.some(page => widgetsUseFamily(page.widgets, family) || interactionsUseFamily(page.interactions, family)
    || [...page.adaptiveViews.map(view => view.overrides), ...Object.values(page.adaptiveOverrides ?? {})].some(map => Object.values(map).some(override => usesFamily(override.style, family) || Object.values(override.stateStyles ?? {}).some(style => usesFamily(style, family)))))
    || doc.components.some(component => widgetsUseFamily(component.widgets, family))
    || doc.styles.some(style => usesFamily(style.style, family));
}
export function documentUsesRoboto(doc: PrototypeDocument): boolean { return documentUsesFamily(doc, 'Roboto'); }
export function documentUsesOpenSans(doc: PrototypeDocument): boolean { return documentUsesFamily(doc, 'Open Sans'); }
export function documentFontAssets(doc: PrototypeDocument): { css: string; license: string } {
  const used = families.filter(family => documentUsesFamily(doc, family.name));
  return { css: used.map(family => family.css).join('\n'), license: used.map(family => family.license).join('\n\n') };
}
