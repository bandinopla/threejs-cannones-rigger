
import { defineConfig } from 'vite';
import path from 'path';

/**
 * Config to build the "inspector" app... a quick way to load glb files and see how the rig will work...
 */
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173, 
  },
});
