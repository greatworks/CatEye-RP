import {ROTATION_ANCHORS,ROTATION_EASINGS,type RotateActionSpec} from '../model/types';

export function defaultRotateAction():RotateActionSpec {
  return {mode:'by',degrees:'0',clockwise:true,anchor:'center',offsetX:'0',offsetY:'0',easing:'none',duration:500};
}

const easingLabel=(value:string)=>value==='none'?'None':value==='swing'?'Swing':value==='linear'?'Linear':value.replace(/^ease/,'Ease ').replace(/([a-z])([A-Z])/g,'$1 $2');

export function RotationActionEditor({value,onChange}:{value:RotateActionSpec;onChange:(value:RotateActionSpec)=>void}) {
  const update=(patch:Partial<RotateActionSpec>)=>onChange({...value,...patch});
  return <fieldset className="inspector-rotation-action" aria-label="Rotation action">
    <legend>Rotation</legend>
    <div className="inspector-grid">
      <label className="inspector-field">Rotate<select aria-label="Rotation mode" value={value.mode} onChange={e=>update({mode:e.target.value as RotateActionSpec['mode']})}><option value="by">By</option><option value="to">To</option></select></label>
      <label className="inspector-field">Degrees<input aria-label="Rotation degrees" value={value.degrees} maxLength={4100} onChange={e=>update({degrees:e.target.value})} placeholder="90 or [[Angle]]"/></label>
    </div>
    <label className="inspector-field">Direction<select aria-label="Rotation direction" value={value.clockwise?'clockwise':'counterclockwise'} onChange={e=>update({clockwise:e.target.value==='clockwise'})}><option value="clockwise">Clockwise</option><option value="counterclockwise">Counterclockwise</option></select></label>
    <label className="inspector-field">Anchor<select aria-label="Rotation anchor" value={value.anchor} onChange={e=>update({anchor:e.target.value as RotateActionSpec['anchor']})}>{ROTATION_ANCHORS.map(anchor=><option key={anchor} value={anchor}>{anchor.replace(/^./,letter=>letter.toUpperCase())}</option>)}</select></label>
    <div className="inspector-grid">{(['offsetX','offsetY'] as const).map((field,index)=><label key={field} className="inspector-field">Offset {index?'Y':'X'}<input aria-label={`Rotation offset ${index?'Y':'X'}`} value={value[field]} maxLength={4100} onChange={e=>update({[field]:e.target.value})}/></label>)}</div>
    <div className="inspector-grid">
      <label className="inspector-field">Animate<select aria-label="Rotation animation" value={value.easing} onChange={e=>update({easing:e.target.value as RotateActionSpec['easing']})}>{ROTATION_EASINGS.map(easing=><option key={easing} value={easing}>{easingLabel(easing)}</option>)}</select></label>
      <label className="inspector-field">Duration (ms)<input aria-label="Rotation duration" type="number" min={0} max={60000} step="any" disabled={value.easing==='none'} value={value.duration} onChange={e=>{const duration=Number(e.target.value);if(Number.isFinite(duration)&&duration>=0&&duration<=60000)update({duration});}}/></label>
    </div>
    <p className="inspector-help">Degrees and offsets accept expressions. Offsets are measured from the selected anchor in the widget’s local axes.</p>
  </fieldset>;
}
