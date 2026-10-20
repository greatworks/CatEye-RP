export {};
declare global {
  interface Window {
    desktop?: {
      openUrl(url: string, target: 'current'|'new', previewId: string): Promise<void>;
      openDocument(): Promise<{name: string; text: string} | null>;
      importRpDocument(): Promise<{name: string; semantics: unknown} | null>;
      saveDocument(text: string, name: string): Promise<string | null>;
      exportPrototype(html: string, name: string): Promise<string | null>;
    };
  }
}
