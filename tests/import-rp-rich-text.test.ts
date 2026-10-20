import { describe, it, expect } from 'vitest';
import { importRpSemantics } from '../src/model/import-rp';
import { parseDocument, serializeDocument } from '../src/model/document';

type Data = Record<string, any>;
const runStyle = { fontFamily:'Arial',fontSize:22,fontWeight:400,fontStyle:'italic',color:'#123456',underline:false,strikethrough:false };
function fixture(): Data {
  const paragraphs = [
    {runs:[{text:'Bold ',style:{...runStyle,fontWeight:700,fontStyle:'normal'}},{text:'[[Example]]',style:{...runStyle}}],textAlign:'left',lineHeightPx:16},
    {runs:[{text:'',style:{...runStyle}}],textAlign:'center',lineHeightPx:28},
    {runs:[{text:'Final',style:{...runStyle}},{text:'',style:{...runStyle}}],textAlign:'right',lineHeightPx:36},
  ];
  return {status:'partial-read-only-recovery',recoveryVersion:1,fileSha256:'c'.repeat(64),packageFailures:[],semanticFailures:[],diagrams:[{rootType:'Axure:Page',packageId:'b'.repeat(32),name:'Rich text',widgets:[{
    status:'stored-fields-recovered',id:'a'.repeat(32),type:'Axure:DiagramObject:VectorShape',typeCandidate:{type:'box'},label:'Typography',
    storedGeometry:{location:{determined:true,overridden:true,value:{X:20,Y:30}},size:{determined:true,overridden:true,value:{Width:160,Height:120}},rotation:null,transform:null,adaptiveStyleCount:0,isComputedLayout:false},
    storedFlags:{AutoFitWidth:false,AutoFitHeight:false,'fit-to-content':false,'is-fixed':false,'is-percent-width':false,IsContained:false,IsLocked:false,Disabled:false,VisibleFromSettings:true},
    text:{status:'stored-rich-text-as-plain',text:'Bold [[Example]]\n\n\n\nFinal'},styleRecovery:{style:{fontSize:18,fontStyle:'normal'},visible:true},
    richTextRecovery:{status:'supported-rich-text',richText:{paragraphs,expressionMode:'literal'},text:'Bold [[Example]]\n\nFinal',source:{kind:'native-rp11-paragraph-runs',runStyleSchemaVersion:2,paragraphCount:3,runCount:5,normalizedBoundaryLF:2,nativeSizeDivisor:.75,nativeLineSpacingDivisor:.75,nativeFontMetricsVerified:false},evidence:'Synthetic protocol fixture; no native format claim'},
  }]}]};
}
const item = (source:Data)=>source.diagrams[0].widgets[0];
describe('strict native structured rich text import',()=>{
  it('preserves literal text, empty runs/paragraphs, per-run fonts and paragraph pixel spacing through save/reopen',()=>{
    const source=fixture(),before=JSON.stringify(source),result=importRpSemantics(source),widget=result.document.pages[0].widgets[0];
    expect(result.report).toMatchObject({widgetsImported:1,widgetsSkipped:0});
    expect(widget.text).toBe('Bold [[Example]]\n\nFinal');
    expect(widget.richText).toEqual(item(source).richTextRecovery.richText);
    expect(widget.style.fontSize).toBe(18);expect(widget.richText!.paragraphs[0].runs[1].style!.fontSize).toBe(22);
    expect(widget.richText!.expressionMode).toBe('literal');
    expect(result.report.issues.some(issue=>issue.code==='rich-text-recovery')).toBe(true);
    expect(parseDocument(serializeDocument(result.document))).toEqual(result.document);expect(JSON.stringify(source)).toBe(before);
  });
  it.each(['font','expression','projection','legacy','count','source','paragraph','run','newline','lineHeight','family','style','type'])(
    'rejects malformed worker rich payload atomically: %s',kind=>{
      const source=fixture(),widget=item(source),r=widget.richTextRecovery,p=r.richText.paragraphs[0];
      switch(kind) {
        case 'font':delete p.runs[0].style.fontWeight;break;
        case 'expression':delete r.richText.expressionMode;break;
        case 'projection':r.text='unrelated text';break;
        case 'legacy':widget.text.text='unrelated text';break;
        case 'count':r.source.runCount=6;break;
        case 'source':r.source.nativeSizeDivisor=1;break;
        case 'paragraph':p.unknown=true;break;
        case 'run':p.runs[0].href='javascript:alert(1)';break;
        case 'newline':p.runs[0].text='Line\nBreak';break;
        case 'lineHeight':p.lineHeightPx=Infinity;break;
        case 'family':p.runs[0].style.fontFamily='Arial;url(x)';break;
        case 'style':p.runs[0].style.fontStyle='oblique';break;
        case 'type':widget.type='Axure:DiagramObject:TextBox';widget.typeCandidate={type:'input'};break;
      }
      const result=importRpSemantics(source);expect(result.report).toMatchObject({widgetsImported:0,widgetsSkipped:1});
    });
  it('reports unsupported rich content honestly and preserves the prior plain fallback',()=>{
    const source=fixture(),widget=item(source);widget.richTextRecovery={status:'unsupported-rich-text',reason:'Hyperlink inline not recovered'};
    const result=importRpSemantics(source),actual=result.document.pages[0].widgets[0];
    expect(actual.richText).toBeUndefined();expect(actual.text).toBe(widget.text.text);
    expect(result.report.issues.some(issue=>issue.code==='rich-text-omitted')).toBe(true);
    expect(result.report.widgetsSkipped).toBe(0);
  });
  it('rejects unknown status, excessive paragraph count and nonliteral protocol values',()=>{
    for(const kind of ['status','count','mode']) {
      const source=fixture(),r=item(source).richTextRecovery;
      if(kind==='status')r.status='almost-supported';
      if(kind==='count')r.richText.paragraphs=Array.from({length:1001},()=>r.richText.paragraphs[0]);
      if(kind==='mode')r.richText.expressionMode='evaluate';
      expect(importRpSemantics(source).report.widgetsSkipped).toBe(1);
    }
  });
});
