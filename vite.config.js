import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// Gera dist/livehelm.html com todo o JS e CSS dentro: é um arquivo só, que o OBS abre como dock de navegador.
// `npm run dev` serve o mesmo arquivo em http://localhost:5173/livehelm.html.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'livehelm.html'),
    },
  },
});
