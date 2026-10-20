import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { type Plugin } from 'vite';
import { buildFramePlayerHtml } from './scripts/frame-player-build';
function framePlayer(): Plugin {
  return {
    name: 'isolated-frame-player',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/frame-player.html') { next(); return; }
        void buildFramePlayerHtml().then(html => { response.setHeader('Content-Type', 'text/html'); response.end(html); }, error => { response.statusCode = 500; response.end(String(error)); });
      });
    },
    async generateBundle() { this.emitFile({ type: 'asset', fileName: 'frame-player.html', source: await buildFramePlayerHtml() }); },
  };
}
export default defineConfig({
  base: './',
  plugins: [react(), framePlayer()],
  // Keep the framework and icon library separate as the editor grows.
  build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] } } } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
