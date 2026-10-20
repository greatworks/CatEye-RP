import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Dialogs.css';

type Prompt = (message: string, initialValue?: string) => Promise<string | null>;
interface Request { message: string; initialValue: string; resolve: (value: string | null) => void; previousFocus: HTMLElement | null }
const DialogContext = createContext<{ prompt: Prompt } | null>(null);

/** Application-owned input dialogs work in both Chromium browsers and Electron. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  const pending = useRef<Request[]>([]);
  const active = useRef<Request | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const showNext = useCallback(() => {
    if (active.current) return;
    const next = pending.current.shift() ?? null;
    active.current = next;
    setValue(next?.initialValue ?? '');
    setRequest(next);
  }, []);
  const prompt = useCallback<Prompt>((message, initialValue = '') => new Promise(resolve => {
    pending.current.push({ message, initialValue, resolve, previousFocus: document.activeElement as HTMLElement | null });
    showNext();
  }), [showNext]);
  function finish(result: string | null) {
    const current = active.current;
    if (!current) return;
    active.current = null;
    setRequest(null);
    current.resolve(result);
    if (current.previousFocus?.isConnected) current.previousFocus.focus();
    showNext();
  }
  useEffect(() => () => {
    active.current?.resolve(null);
    pending.current.forEach(item => item.resolve(null));
    active.current = null; pending.current = [];
  }, []);
  return <DialogContext.Provider value={{ prompt }}>
    {children}
    {request && <div className="input-dialog-backdrop">
      <form ref={form} className="input-dialog" role="dialog" aria-modal="true" aria-labelledby="input-dialog-title"
        onSubmit={event => { event.preventDefault(); finish(value); }}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Escape') { event.preventDefault(); finish(null); }
          if (event.key === 'Tab') {
            const controls = [...form.current!.querySelectorAll<HTMLElement>('input, button')];
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}>
        <h2 id="input-dialog-title">{request.message}</h2>
        <input autoFocus aria-label={request.message} value={value} onFocus={event => event.target.select()} onChange={event => setValue(event.target.value)} />
        <div className="input-dialog-actions"><button type="button" onClick={() => finish(null)}>Cancel</button><button type="submit" className="primary-button">OK</button></div>
      </form>
    </div>}
  </DialogContext.Provider>;
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogProvider is required');
  return context;
}
