import { useLayoutEffect, useRef, useState } from 'react';
import type { CaseMenu } from '../model/types';
import './CaseMenus.css';

interface CaseMenusProps {
  menus: CaseMenu[];
  onSelect: (menuId: string, optionId: string) => void;
  onCancel: (menuId: string) => void;
  getSource: (menu: CaseMenu) => HTMLElement | null;
  /** Accessibility focus changes must not dispatch prototype focus/blur interactions. */
  focusElement: (element: HTMLElement) => void;
}

function CaseMenuPopup({ menu, onSelect, onCancel, getSource, focusElement }: Omit<CaseMenusProps, 'menus'> & { menu: CaseMenu }) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(menu.anchor ?? { x: 16, y: 80 });
  const anchorX = menu.anchor?.x ?? 16, anchorY = menu.anchor?.y ?? 80;
  useLayoutEffect(() => {
    const place = () => {
      const rect = panel.current?.getBoundingClientRect();
      if (rect) setPosition({ x: Math.max(8, Math.min(anchorX, window.innerWidth - rect.width - 8)), y: Math.max(8, Math.min(anchorY, window.innerHeight - rect.height - 8)) });
    };
    place(); window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorX, anchorY]);
  useLayoutEffect(() => {
    const element = panel.current!;
    const source = getSource(menu) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const initial = element.querySelector<HTMLElement>('[role="menuitem"]') ?? element.querySelector<HTMLElement>('button');
    if (initial) focusElement(initial);
    return () => {
      if (element.contains(document.activeElement)) requestAnimationFrame(() => {
        // A replacement menu or navigation may already have moved focus elsewhere.
        if (source?.isConnected && document.activeElement === document.body) focusElement(source);
      });
    };
  }, [menu.id]);
  return <div ref={panel} className="case-menu-panel" role="menu" aria-label="Choose a case" tabIndex={-1} data-case-menu-id={menu.id}
    style={{ left: position.x, top: position.y }} onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); onCancel(menu.id); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...panel.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      if (!buttons.length) return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (current + 1) % buttons.length : current < 0 ? buttons.length - 1 : (current - 1 + buttons.length) % buttons.length;
      focusElement(buttons[index]);
    }}>
    <div className="case-menu-title">Choose a case</div>
    <div className="case-menu-options">{menu.options.map(option => <button type="button" className="case-menu-option" role="menuitem" key={option.id} onClick={() => onSelect(menu.id, option.id)}>{option.name}</button>)}</div>
    <button type="button" className="case-menu-cancel" onClick={() => onCancel(menu.id)}>Cancel</button>
  </div>;
}

export function CaseMenus({ menus, ...props }: CaseMenusProps) {
  return <>{menus.map(menu => <CaseMenuPopup key={menu.id} menu={menu} {...props} />)}</>;
}
