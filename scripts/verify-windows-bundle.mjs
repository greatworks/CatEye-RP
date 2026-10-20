import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { extractFile, listPackage } from '@electron/asar';

// Verify the tested package against current source before archiving it.
const root = path.resolve(import.meta.dirname, '..');
const bundle = path.join(root, 'release', 'REA Prototype Studio-win32-x64');
const archive = path.join(bundle, 'resources', 'app.asar');
const digest = value => createHash('sha256').update(value).digest('hex');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const expected = new Map();
async function collect(relative) {
  const files = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  for (const file of files) {
    const name = `${relative}/${file.name}`;
    if (file.isDirectory()) await collect(name);
    else if (file.isFile()) expected.set(name, await fs.readFile(path.join(root, name)));
    else throw new Error(`Unsupported source entry: ${name}`);
  }
}
await collect('dist'); await collect('desktop');
for (const name of ['read-rp-container.mjs', 'read-rp-objects.mjs', 'read-rp-interactions.mjs', 'read-rp-adaptive.mjs', 'read-rp-semantics.mjs']) {
  const relative = `research/scripts/${name}`; expected.set(relative, await fs.readFile(path.join(root, relative)));
}
const packagedPaths = listPackage(archive).map(entry => entry.replaceAll('\\', '/').replace(/^\//, ''));
const allowedDirectories = new Set(['dist', 'dist/assets', 'desktop', 'research', 'research/scripts']);
for (const entry of packagedPaths) if (entry !== 'package.json' && !allowedDirectories.has(entry) && !expected.has(entry)) throw new Error(`Unexpected packaged entry: ${entry}`);
for (const [entry, contents] of expected) {
  if (!packagedPaths.includes(entry) || digest(extractFile(archive, path.normalize(entry))) !== digest(contents)) throw new Error(`Packaged file differs from source: ${entry}`);
}
const packagedMetadata = JSON.parse(extractFile(archive, 'package.json').toString('utf8'));
// Electron Packager removes npm-only development metadata such as `private`.
const expectedMetadata = { name: pkg.name, productName: 'REA Prototype Studio', version: pkg.version, main: 'desktop/main.cjs' };
if (JSON.stringify(packagedMetadata) !== JSON.stringify(expectedMetadata)) throw new Error('Packaged metadata mismatch');
const quickStart = (await fs.readFile(path.join(root, 'docs', 'windows-readme.txt'), 'utf8')).replaceAll('{{VERSION}}', pkg.version);
if (await fs.readFile(path.join(bundle, '使用说明.txt'), 'utf8') !== quickStart) throw new Error('Packaged quick start differs from source');
const result = {
  appAsarSha256: digest(await fs.readFile(archive)), packagedAsarEntries: packagedPaths.length,
  parserCopiesMatchSource: true, allPackagedAppFilesMatchSource: true, quickStartMatchesSource: true, originalVendorAssetsPackaged: false,
};
await fs.writeFile(path.join(root, '.build', 'bundle-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
