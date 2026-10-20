import { useEffect, useRef, useState } from 'react';
import type { Document as PrototypeDocument, FrameTarget, Widget } from '../model/types';
import { DOCUMENT_LIMITS, isSafeImageSource, parseFrameTarget } from '../model/document';
import './FrameTargetEditor.css';

export function frameTargetLabel(target: FrameTarget | undefined, pages: PrototypeDocument['pages']): string {
  if (!target) return 'No frame target';
  if (target.kind === 'page') return pages.find(page => page.id === target.pageId)?.name ?? `Missing page: ${target.pageId}`;
  return target.kind === 'url' ? target.url : target.path;
}

/** Both initial frame targets and actions use this literal, validated target editor. */
export function FrameTargetEditor({ value, pages, allowBlank = false, title = 'Frame target', onApply, onClose }: {
  value?: FrameTarget; pages: PrototypeDocument['pages']; allowBlank?: boolean; title?: string;
  onApply: (target: FrameTarget | undefined) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<FrameTarget['kind'] | 'none'>(value?.kind ?? (allowBlank ? 'none' : 'page'));
  const [pageId, setPageId] = useState(value?.kind === 'page' ? value.pageId : pages[0]?.id ?? '');
  const [url, setUrl] = useState(value?.kind === 'url' ? value.url : '');
  const [path, setPath] = useState(value?.kind === 'file' ? value.path : '');
  const [error, setError] = useState(''); const form = useRef<HTMLFormElement>(null);
  useEffect(() => { const previous=document.activeElement as HTMLElement|null; form.current?.querySelector('select')?.focus(); return () => { if(previous?.isConnected)previous.focus(); }; }, []);
  function apply() {
    try {
      const target = kind === 'none' && allowBlank ? undefined : parseFrameTarget(kind === 'page' ? { kind, pageId } : kind === 'url' ? { kind, url } : { kind, path });
      onApply(target);
    } catch (cause) { setError(String(cause)); }
  }
  return <div className="frame-target-backdrop" onPointerDown={event => event.stopPropagation()} onClick={onClose}>
    <form ref={form} role="dialog" aria-modal="true" aria-label={title} className="frame-target-dialog" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); apply(); }} onKeyDown={event => {
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();onClose()}
      if(event.key==='Tab'){
        const controls=[...form.current!.querySelectorAll<HTMLElement>('select, input, button')].filter(element=>!(element as HTMLButtonElement).disabled),first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }}>
      <h2>{title}</h2>
      <label>Target type<select aria-label="Frame target type" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setError(''); }}>{allowBlank && <option value="none">None</option>}<option value="page">Page in this project</option><option value="url">External URL</option><option value="file">Local file</option></select></label>
      {kind==='page' && <><label>Page<select aria-label="Frame page" value={pageId} onChange={event=>{setPageId(event.target.value);setError('')}}>{pages.map(page=><option key={page.id} value={page.id}>{page.name}</option>)}{pageId&&!pages.some(page=>page.id===pageId)&&<option value={pageId}>Missing page: {pageId}</option>}</select></label>{pageId&&!pages.some(page=>page.id===pageId)&&<p className="frame-target-note">The referenced page is missing. Its reference will be kept until you choose another target.</p>}</>}
      {kind==='url' && <><label>URL<input aria-label="Frame URL" type="text" maxLength={4096} value={url} placeholder="https://example.com/embedded-page" onChange={event=>{setUrl(event.target.value);setError('')}}/></label><p className="frame-target-note">Use a literal HTTP or HTTPS URL. Some websites block embedding.</p></>}
      {kind==='file' && <><label>File path<input aria-label="Frame file path" type="text" maxLength={4096} value={path} placeholder="media/example.html or C:\Prototype\example.html" onChange={event=>{setPath(event.target.value);setError('')}}/></label><p className="frame-target-note">Relative and absolute paths are kept as entered. The file is not imported into the project. Browser previews served over HTTP cannot access local files; use a local export in a compatible host.</p></>}
      {kind==='none' && <p className="frame-target-note">The frame starts without a target. An interaction can set one later.</p>}
      {error&&<p role="alert" className="frame-target-error">{error}</p>}
      <div className="frame-target-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Apply</button></div>
    </form>
  </div>;
}

export function InlineFrameProperties({ widget, pages, onChange, onEditTarget }: {
  widget: Widget; pages: PrototypeDocument['pages']; onChange: (patch: Partial<Widget>) => void; onEditTarget: () => void;
}) {
  const data=widget.inlineFrame!,[error,setError]=useState(''),file=useRef<HTMLInputElement>(null),active=useRef(true),latest=useRef(data);latest.current=data;
  useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
  function update(patch:Partial<typeof data>){onChange({inlineFrame:{...latest.current,...patch}})}
  async function image(file:File){
    setError('');
    try{
      if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
      if(file.size>DOCUMENT_LIMITS.image*3/4)throw new Error('The encoded preview image must fit within 8 MB.');
      const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Cannot read the preview image.'));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file)});
      if(!source.startsWith('data:image/')||!isSafeImageSource(source))throw new Error('Invalid preview image.');
      if(active.current)update({preview:{kind:'custom',imageSrc:source}});
    }catch(cause){if(active.current)setError(String(cause))}
  }
  return <section className="inline-frame-properties" aria-label="Inline frame properties">
    <h3>Inline frame</h3><p className="frame-target-summary">{frameTargetLabel(data.target,pages)}</p>
    <button type="button" onClick={onEditTarget}>{data.target?'Edit frame target':'Add frame target'}</button>
    {data.target&&<button type="button" onClick={()=>update({target:undefined})}>Remove frame target</button>}
    <label className="inline-frame-check"><input type="checkbox" aria-label="Hide frame borders" checked={data.hideBorders} onChange={event=>update({hideBorders:event.target.checked})}/>Hide borders</label>
    <label>Scroll<select aria-label="Frame scrolling" value={data.scrolling} onChange={event=>update({scrolling:event.target.value as typeof data.scrolling})}><option value="auto">As needed</option><option value="yes">Always</option><option value="no">Never</option></select></label>
    <label>Canvas preview<select aria-label="Frame canvas preview" value={data.preview.kind} onChange={event=>{setError('');update({preview:{kind:event.target.value as typeof data.preview.kind}})}}><option value="none">No preview</option><option value="video">Video</option><option value="map">Map</option><option value="custom">Custom preview</option></select></label>
    {data.preview.kind==='custom'&&<><input ref={file} type="file" aria-label="Custom frame preview image" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event=>{const picked=event.target.files?.[0];event.target.value='';if(picked)void image(picked)}}/>{data.preview.imageSrc&&<button type="button" onClick={()=>update({preview:{kind:'custom'}})}>Remove custom preview image</button>}</>}
    <p className="frame-target-note">Preview images appear only on the editor canvas. The prototype loads the frame target instead.</p>
    {error&&<p role="alert" className="frame-target-error">{error}</p>}
  </section>;
}

/** Passive authored illustration only. Never creates a browsing context or requests the target. */
export function InlineFrameThumbnail({ widget }: { widget: Widget }) {
  const data=widget.inlineFrame!,kind=data.preview.kind;
  return <div className={`inline-frame-thumbnail inline-frame-${kind}`} data-frame-preview={kind} aria-label={`${widget.name} canvas preview`} style={{border:data.hideBorders?'none':'2px inset #d5d9df'}}>
    {kind==='custom'&&data.preview.imageSrc?<img src={data.preview.imageSrc} alt="Custom frame preview" draggable={false}/>:kind==='video'?<svg viewBox="0 0 300 170" width="100%" height="100%" aria-label="Video preview illustration"><rect width="300" height="170" fill="#344256"/><circle cx="150" cy="78" r="25" fill="#ffffffdd"/><path d="M143 63L143 93L165 78Z" fill="#344256"/><rect x="16" y="147" width="268" height="3" fill="#98a6b9"/><rect x="16" y="147" width="72" height="3" fill="white"/></svg>:kind==='map'?<svg viewBox="0 0 300 170" width="100%" height="100%" preserveAspectRatio="none" aria-label="Map preview illustration"><rect width="300" height="170" fill="#e7eddc"/><path d="M0 40L300 130M45 0L150 170M240 0L155 170" stroke="white" strokeWidth="15"/><path d="M0 127Q120 85 300 18" fill="none" stroke="#9dccdf" strokeWidth="24"/><path d="M150 57C130 57 124 80 140 96L150 108L160 96C176 80 170 57 150 57Z" fill="#4776da"/><circle cx="150" cy="77" r="7" fill="white"/></svg>:<span className="inline-frame-empty">{kind==='custom'?'Choose a custom preview image':'Inline Frame'}</span>}
  </div>;
}
