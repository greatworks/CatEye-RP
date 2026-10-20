/** Resolve a literal local filename only when playback itself has a file base.
 * A raw filename encodes #, ? and % literally; use a file: URL for a fragment.
 * This function is self-contained so the portable player can serialize it.
 */
export function frameFileUrl(value: string, base: string): string {
  const invalid = () => { throw new Error('Use a literal local path or local file URL'); };
  if (typeof value !== 'string' || !value || value.length > 4096 || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value) || value.includes('[[') || /^[\\/]{2}/.test(value)) return invalid();
  let destination: URL;
  if (/^file:/i.test(value)) {
    if (!/^file:\/\/\//i.test(value) || value.includes('\\')) return invalid();
    try { destination = new URL(value); } catch { return invalid(); }
    if (destination.hostname || destination.username || destination.password || /^\/\//.test(destination.pathname)) return invalid();
  } else {
    const path = value.replaceAll('\\', '/'), drive = /^[a-z]:\//i.test(path);
    if (drive ? path.slice(2).includes(':') : path.includes(':')) return invalid();
    const encoded = path.split('/').map((part, index) => drive && index === 0 ? part : encodeURIComponent(part)).join('/');
    try {
      const baseUrl = new URL(base);
      if (baseUrl.protocol !== 'file:' || baseUrl.hostname) throw new Error('Local files require a file-based exported prototype');
      destination = new URL(drive ? `file:///${encoded}` : encoded, baseUrl);
    } catch (error) {
      if (error instanceof Error && error.message.includes('file-based')) throw error;
      return invalid();
    }
  }
  // Even an absolute file URL cannot load from an HTTP-hosted author preview.
  let baseUrl: URL; try { baseUrl = new URL(base); } catch { return invalid(); }
  if (baseUrl.protocol !== 'file:' || baseUrl.hostname) throw new Error('Local files require a file-based exported prototype');
  if (destination.protocol !== 'file:' || destination.hostname) return invalid();
  return destination.href;
}
