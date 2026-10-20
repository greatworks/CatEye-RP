import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

describe('desktop frame capability isolation', () => {
  it('exposes the desktop API only in the main frame', () => {
    for(const isMainFrame of [true,false]) {
      const exposed: string[]=[];
      vm.runInNewContext(fs.readFileSync('desktop/preload.cjs','utf8'),{process:{isMainFrame},require:()=>({contextBridge:{exposeInMainWorld:(name:string)=>exposed.push(name)},ipcRenderer:{invoke:()=>undefined}})});
      expect(exposed).toEqual(isMainFrame?['desktop']:[]);
    }
  });
  it('rejects every file/navigation IPC from subframes sharing the main webContents', async () => {
    const handlers=new Map<string,(...args:any[])=>any>(), windows:any[]=[], mainFrame={id:'main'};
    let dialogs=0;
    class Window {
      webContents={mainFrame,on:()=>undefined,setWindowOpenHandler:()=>undefined,session:{setPermissionRequestHandler:()=>undefined}};
      constructor(){windows.push(this);}
      loadFile(){return Promise.resolve();}
    }
    const electron={app:{whenReady:()=>Promise.resolve(),on:()=>undefined},BrowserWindow:Window,ipcMain:{handle:(name:string,fn:(...args:any[])=>any)=>handlers.set(name,fn)},dialog:{showOpenDialog:async()=>{dialogs++;return {canceled:true};},showSaveDialog:async()=>{dialogs++;return {canceled:true};}}};
    vm.runInNewContext(fs.readFileSync('desktop/main.cjs','utf8'),{process:{env:{}},__dirname:path.resolve('desktop'),require:(name:string)=>name==='electron'?electron:name==='node:path'?path:name==='node:worker_threads'?{Worker:class{}}:{},URL,Buffer});
    await Promise.resolve();
    expect(handlers.size).toBe(5);
    for(const senderFrame of [{id:'child'},undefined]) for(const handler of handlers.values()) await expect(handler({sender:windows[0].webContents,senderFrame},'{}','test','preview')).rejects.toThrow('Unauthorized sender');
    expect(dialogs).toBe(0);
    await expect(handlers.get('document:open')!({sender:windows[0].webContents,senderFrame:mainFrame})).resolves.toBeNull();
    expect(dialogs).toBe(1);
    await expect(handlers.get('document:open')!({sender:{},senderFrame:mainFrame})).rejects.toThrow('Unauthorized sender');
  });
});
