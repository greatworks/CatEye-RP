/** External previews have their own browsing context, so navigating never replaces the editor. */
export function createPreviewNavigation(onError: (error: unknown) => void): (url: string, target: 'current'|'new') => void {
  const previewId = crypto.randomUUID(); let current: Window | null = null;
  return (url, target) => {
    if (window.desktop) { void window.desktop.openUrl(url, target, previewId).catch(onError); return; }
    if (target === 'current' && current && !current.closed) { current.location.href = url; return; }
    const next = window.open('about:blank', '_blank');
    if (!next) throw new Error('The browser blocked the preview window. Allow popups to open this link.');
    next.opener = null; next.location.replace(url);
    if (target === 'current') current = next;
  };
}
