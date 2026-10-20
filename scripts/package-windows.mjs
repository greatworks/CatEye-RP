import fs from 'node:fs/promises';
import path from 'node:path';
import {packager} from '@electron/packager';
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const electronPackage = JSON.parse(await fs.readFile(path.join(root, 'node_modules/electron/package.json'), 'utf8'));
const electronVersion = electronPackage.version;
let electronZipDir = process.env.ELECTRON_ZIP_DIR;
if (!electronZipDir && process.env.LOCALAPPDATA) {
  const cache = path.join(process.env.LOCALAPPDATA, 'electron', 'Cache');
  for (const entry of await fs.readdir(cache, {withFileTypes:true}).catch(()=>[])) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(cache, entry.name);
    if (await fs.stat(path.join(directory, `electron-v${electronVersion}-win32-x64.zip`)).then(s=>s.isFile()).catch(()=>false)) {
      electronZipDir = directory; break;
    }
  }
}
const buildRoot = path.join(root, '.build');
await fs.mkdir(buildRoot, {recursive:true});
const stage = await fs.mkdtemp(path.join(buildRoot,'app-'));
await fs.cp(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});
await fs.cp(path.join(root,'desktop'),path.join(stage,'desktop'),{recursive:true});
await fs.mkdir(path.join(stage,'research/scripts'),{recursive:true});
for (const file of ['read-rp-container.mjs','read-rp-objects.mjs','read-rp-interactions.mjs','read-rp-adaptive.mjs','read-rp-semantics.mjs']) {
  await fs.copyFile(path.join(root,'research/scripts',file),path.join(stage,'research/scripts',file));
}
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:pkg.name,productName:'REA Prototype Studio',version:pkg.version,main:'desktop/main.cjs',private:true},null,2));
const releaseRoot=path.resolve(root,'release');
const expectedOutput=path.resolve(releaseRoot,'REA Prototype Studio-win32-x64');
if(!expectedOutput.startsWith(releaseRoot+path.sep))throw new Error('Package output escapes release directory');
const results=await packager({dir:stage,out:releaseRoot,name:'REA Prototype Studio',platform:'win32',arch:'x64',
  electronVersion,electronZipDir,overwrite:true,asar:true,prune:false,
  win32metadata:{CompanyName:'REA Project',FileDescription:'REA Prototype Studio',ProductName:'REA Prototype Studio'}});
const instructions=(await fs.readFile(path.join(root,'docs','windows-readme.txt'),'utf8')).replaceAll('{{VERSION}}',pkg.version);
for(const output of results){
  if(path.resolve(output)!==expectedOutput)throw new Error('Unexpected package output directory');
  await fs.writeFile(path.join(output,'使用说明.txt'),instructions,'utf8');
  await fs.copyFile(path.join(root,'docs/third-party-notices.txt'),path.join(output,'THIRD_PARTY_NOTICES.txt'));
}
console.log(JSON.stringify({outputs:results,version:pkg.version},null,2));
