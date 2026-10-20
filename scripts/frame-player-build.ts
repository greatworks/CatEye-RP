import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export function renderFramePlayerHtml(code: string, template: string): string {
  if (template.split('__REA_PLAYER_SCRIPT__').length !== 2 || template.split('__REA_PLAYER_CSP_HASH__').length !== 2) throw new Error('Invalid fixed frame player template');
  // HTML normalizes line endings before CSP checks inline script text. Prevent
  // a source string/comment containing an HTML end tag from ending the script.
  const script = code.replace(/\r\n?/g, '\n').replace(/<\/script/gi, value => '<\\/' + value.slice(2));
  const hash = createHash('sha256').update(script).digest('base64');
  return template.replace('__REA_PLAYER_CSP_HASH__', `sha256-${hash}`).replace('__REA_PLAYER_SCRIPT__', () => script);
}

export async function buildFramePlayerHtml(): Promise<string> {
  const result = await build({ configFile: false, publicDir: false, logLevel: 'silent', build: { write: false, minify: false, emptyOutDir: false, lib: { entry: fileURLToPath(new URL('../src/runtime/frame-player.ts', import.meta.url)), formats: ['iife'], name: 'REAFramePlayer' } } });
  const outputs = Array.isArray(result) ? result : [result];
  const code = outputs.flatMap(item => 'output' in item ? item.output.filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code) : []).join('\n');
  if (!code) throw new Error('The fixed frame player bundle is empty');
  return renderFramePlayerHtml(code, await readFile(new URL('../public/frame-player.html', import.meta.url), 'utf8'));
}
