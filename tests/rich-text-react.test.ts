import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createWidget } from '../src/model/document';
import { RichTextContent } from '../src/components/RichTextContent';
import { changedTextRange, richParagraphAt, textInputRange } from '../src/components/RichTextEditor';
import { WidgetContent } from '../src/components/WidgetView';
import type { RichText } from '../src/model/types';

describe('safe mixed text React rendering and edit ranges', () => {
  it('preserves paragraphs, empty lines and explicit run fonts without interpreting markup', () => {
    const rich:RichText={paragraphs:[{textAlign:'left',lineHeightPx:28,runs:[{text:'<img src=x onerror=alert(1)>',style:{fontFamily:'Roboto',fontSize:22,fontWeight:700,fontStyle:'italic',color:'#aa2200'}},{text:' & normal',style:{fontStyle:'normal'}}]},{runs:[{text:''}]},{lineHeightPx:'normal',runs:[{text:'Last'}]}]};
    const html=renderToStaticMarkup(createElement(RichTextContent,{richText:rich}));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');expect(html).not.toContain('<img');expect(html).toContain('font-family:Roboto;font-size:22px;font-weight:700;font-style:italic;color:#aa2200');
    expect(html).toContain('text-align:left;line-height:28px');expect(html).toContain('font-style:normal');expect(html.match(/data-rich-paragraph=/g)).toHaveLength(3);expect(html).toContain('<br/>');expect(html).toContain('line-height:normal');
  });
  it('composes only explicit static effects into runs and leaves the authored data untouched', () => {
    const widget=createWidget('text');widget.richText={paragraphs:[{runs:[{text:'Mixed',style:{fontStyle:'italic',fontWeight:700,color:'#aa2200'}}]}]};widget.text='Mixed';widget.selected=true;widget.selectedStyle={fontStyle:'normal'};const before=structuredClone(widget);
    const html=renderToStaticMarkup(createElement(WidgetContent,{widget}));expect(html).toContain('font-style:normal;font-weight:700;color:#aa2200');expect(widget).toEqual(before);
    const projected=renderToStaticMarkup(createElement(WidgetContent,{widget,resolved:true}));expect(projected).toContain('font-style:italic');
  });
  it('projects Item interpolation across runs in static rows and preserves literal imported tokens', () => {
    const repeater=createWidget('repeater'),child=createWidget('text');child.text='[[Item.Name]]';child.richText={paragraphs:[{runs:[{text:'[[Item.',style:{fontStyle:'italic'}},{text:'Name]]',style:{fontWeight:700}}]}]};repeater.repeater!.template=[child];repeater.repeater!.rows=[{Name:'<Alpha>'}];
    const html=renderToStaticMarkup(createElement(WidgetContent,{widget:repeater}));expect(html).toContain('&lt;Alpha&gt;');expect(html).not.toContain('[[Item.');expect(html).toContain('font-style:italic');
    child.richText.expressionMode='literal';const literal=renderToStaticMarkup(createElement(WidgetContent,{widget:repeater}));expect(literal).toContain('[[Item.');expect(literal).toContain('Name]]');
  });
  it.each([['abc','abXc',{start:2,end:2,text:'X'}],['A😀B','A😃B',{start:1,end:3,text:'😃'}],['abc','',{start:0,end:3,text:''}],['one\ntwo','one\n\ntwo',{start:4,end:4,text:'\n'}]])('locates a bounded Unicode-safe replacement for %j → %j',(before,after,expected)=>{expect(changedTextRange(before as string,after as string)).toEqual(expected)});
  it('uses real beforeinput offsets to retain formatting identity in repeated text',()=>{
    expect(textInputRange('aaa','aaaa',{start:0,end:0,inputType:'insertText'})).toEqual({start:0,end:0,text:'a'});
    expect(textInputRange('aaa','aa',{start:1,end:1,inputType:'deleteContentBackward'})).toEqual({start:0,end:1,text:''});
    expect(textInputRange('aaa','aa',{start:1,end:1,inputType:'deleteContentForward'})).toEqual({start:1,end:2,text:''});
    expect(textInputRange('aaa','aX',{start:1,end:3,inputType:'insertFromPaste'})).toEqual({start:1,end:3,text:'X'});
  });
  it('distinguishes a line break inside a run from a paragraph boundary when locating the caret',()=>{
    const rich:RichText={paragraphs:[{runs:[{text:'a\nb'}]},{runs:[{text:''}]},{runs:[{text:'last'}]}]};
    expect([0,1,2,3].map(offset=>richParagraphAt(rich,offset))).toEqual([0,0,0,0]);expect(richParagraphAt(rich,4)).toBe(1);expect(richParagraphAt(rich,5)).toBe(2);expect(richParagraphAt(rich,9)).toBe(2);
  });
});
