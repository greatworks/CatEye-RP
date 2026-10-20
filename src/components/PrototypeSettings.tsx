import { useEffect, useRef, useState } from 'react';
import './PrototypeSettings.css';

type CaseSelection = 'auto' | 'always' | 'never';
export function PrototypeSettings({ value, onApply, onClose }: {
  value: CaseSelection; onApply: (value: CaseSelection) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    form.current?.querySelector('select')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <div className="prototype-settings-backdrop" onClick={onClose}>
    <form ref={form} className="prototype-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="prototype-settings-title"
      onClick={event => event.stopPropagation()}
      onSubmit={event => { event.preventDefault(); onApply(draft); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const controls = [...form.current!.querySelectorAll<HTMLElement>('select, button')];
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}>
      <h2 id="prototype-settings-title">Prototype settings</h2>
      <p>Choose how cases run in previews and exported prototypes.</p>
      <label className="prototype-settings-field">Case selection
        <select aria-label="Case selection" aria-describedby="case-selection-help" value={draft} onChange={event => setDraft(event.target.value as CaseSelection)}>
          <option value="auto">Automatic</option><option value="always">Always</option><option value="never">Never</option>
        </select>
      </label>
      <dl id="case-selection-help" className="prototype-settings-help">
        <div className={draft === 'auto' ? 'is-selected' : ''}><dt>Automatic</dt><dd>Show a menu when an event has at least two enabled cases and none of its cases contain conditions.</dd></div>
        <div className={draft === 'always' ? 'is-selected' : ''}><dt>Always</dt><dd>Show a menu for events that contain cases. An event with conditions has one entry that evaluates its conditional cases.</dd></div>
        <div className={draft === 'never' ? 'is-selected' : ''}><dt>Never</dt><dd>Run the event's cases directly, without showing a case menu.</dd></div>
      </dl>
      <p className="prototype-settings-note">Initial page load runs directly.</p>
      <div className="prototype-settings-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Apply</button></div>
    </form>
  </div>;
}
