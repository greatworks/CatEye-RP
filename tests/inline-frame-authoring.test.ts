import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createDocument, createWidget } from '../src/model/document';
import { frameTargetLabel, FrameTargetEditor, InlineFrameProperties } from '../src/components/FrameTargetEditor';
import { WidgetContent } from '../src/components/WidgetView';
import { Inspector, InteractionsEditor } from '../src/components/Inspector';
import type { Interaction, FrameTarget } from '../src/model/types';
const noop=()=>{};
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

describe('inline frame authoring',()=>{
  it('keeps every canvas preview passive and omits it entirely when a runtime owns the frame',()=>{
    const widget=createWidget('inlineFrame');widget.inlineFrame!.target={kind:'url',url:'https://frame-target.invalid/private'};
    for(const kind of ['none','video','map','custom'] as const){widget.inlineFrame!.preview={kind,...(kind==='custom'?{imageSrc:pixel}:{})};const html=renderToStaticMarkup(createElement(WidgetContent,{widget}));expect(html).toContain(`data-frame-preview="${kind}"`);expect(html).not.toContain('<iframe');expect(html).not.toContain('frame-target.invalid');if(kind==='custom')expect(html).toContain(pixel);
      const runtime={pageId:'p',variables:{},widgetOverrides:{},repeaterRows:{}};expect(renderToStaticMarkup(createElement(WidgetContent,{widget,runtime}))).toBe('');}
  });
  it('shows frame-specific properties without fake text/shape border and keeps a missing internal page visible',()=>{
    const document=createDocument(),widget=createWidget('inlineFrame');document.pages[0].widgets=[widget];widget.inlineFrame!.target={kind:'page',pageId:'missing-page'};
    const html=renderToStaticMarkup(createElement(Inspector,{document,page:document.pages[0],widget,onWidgetChange:noop,onPageChange:noop,onEditFrameTarget:noop}));
    expect(html).toContain('Missing page: missing-page');expect(html).toContain('Hide frame borders');expect(html).toContain('Frame scrolling');expect(html).toContain('Frame canvas preview');expect(html).not.toContain('Widget text');expect(html).not.toContain('Font style');expect(html).not.toContain('Fill &amp; border');
    const properties=renderToStaticMarkup(createElement(InlineFrameProperties,{widget,pages:document.pages,onChange:noop,onEditTarget:noop}));expect(properties).toContain('Remove frame target');expect(properties).toContain('Preview images appear only on the editor canvas');
  });
  it('preserves literal target summaries and exposes missing-page and local-file limitations in the shared draft editor',()=>{
    const document=createDocument();const targets:FrameTarget[]=[{kind:'page',pageId:document.pages[0].id},{kind:'page',pageId:'gone'},{kind:'url',url:'https://example.com/?a=1&b=2'},{kind:'file',path:'C:\\Demo files\\example.html'}];
    expect(targets.map(target=>frameTargetLabel(target,document.pages))).toEqual([document.pages[0].name,'Missing page: gone','https://example.com/?a=1&b=2','C:\\Demo files\\example.html']);
    const dialog=renderToStaticMarkup(createElement(FrameTargetEditor,{value:targets[3],pages:document.pages,allowBlank:true,onApply:noop,onClose:noop}));expect(dialog).toContain('Frame file path');expect(dialog).toContain('not imported into the project');expect(dialog).toContain('<option value="none">');
    const action=renderToStaticMarkup(createElement(FrameTargetEditor,{value:targets[1],pages:document.pages,onApply:noop,onClose:noop}));expect(action).toContain('Missing page: gone');expect(action).not.toContain('<option value="none">');
  });
  it('offers only inline frames as widget destinations and a separate parent frame scope without changing ordinary URL controls',()=>{
    const document=createDocument(),frame=createWidget('inlineFrame'),button=createWidget('button');document.pages[0].widgets=[frame,button];
    const interaction:Interaction={id:'case',name:'Open embedded page',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:'action',type:'openLinkInFrame',frameScope:'widget',targetId:frame.id,frameTarget:{kind:'page',pageId:document.pages[0].id}}]};
    const widgetHtml=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget:button,interactions:[interaction],onChange:noop}));expect(widgetHtml).toContain(`<option value="${frame.id}" selected="">`);expect(widgetHtml).not.toContain(`<option value="${button.id}">`);expect(widgetHtml).toContain('Parent frame');
    interaction.actions[0]={...interaction.actions[0],frameScope:'parent',targetId:undefined};const parentHtml=renderToStaticMarkup(createElement(InteractionsEditor,{document,page:document.pages[0],widget:button,interactions:[interaction],onChange:noop}));expect(parentHtml).not.toContain('aria-label="Action 1 target"');expect(parentHtml).toContain('Edit link in frame target');
  });
});
